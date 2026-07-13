import { send, callFn, dbInsert, dbSelect, readBody, PLATFORM_FEE_WALLET } from "../_lib.js";

/**
 * OG DEX Token Launcher backend.
 *
 * $1.50 launch fee on SOLANA launches only, paid in SOL to PLATFORM_FEE_WALLET,
 * verified on-chain via the fee transaction signature. Every other chain
 * (all 16 EVM chains) remains free.
 *
 * GET  /api/launch?config=1&chain=solana
 *   → { ok, feeUsd, payWallet, solPrice, usdcMint, usdtMint }
 *
 * POST /api/launch   (body.step)
 *   step "ipfs"   { imageBase64, imageMimeType, name, symbol, description, twitter, telegram, website }
 *                 → { metadataUri, metadata }   (uploads to pump.fun IPFS)
 *   step "create" { publicKey, metadataUri, name, symbol, mintPublicKey, devBuySol, slippage }
 *                 → { transaction }              (unsigned PumpPortal create tx, base64)
 *   step "record" { payment_tx, pay_currency, creator_wallet, mint, name, symbol, icon,
 *                   description, launch_tx, links, chain }
 *                 → { ok, token }   verifies the $1.50 fee on-chain (Solana only), then stores the launch
 *
 * Launched tokens are stored UNVERIFIED with no boost — they surface only in
 * the "Newly Listed" section (/api/launches).
 */

const FEE_USD = 1.5;                      // Solana launch fee — other chains are free
const FEE_TOLERANCE = 0.92;               // accept >= 92% of $1.50 to absorb price drift
const SOL_MINT = "So11111111111111111111111111111111111111112";
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const USDT_MINT = "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB";
const STABLES = { [USDC_MINT]: "usdc", [USDT_MINT]: "usdt" };

/**
 * Duplicate-launch guard. No two Launchpad tokens may share the same name OR
 * the same symbol (case-insensitive, trimmed). The DB narrows candidates with
 * a case-insensitive `ilike`; we then confirm an EXACT case-insensitive match
 * in JS so that names containing SQL wildcard characters (% or _) can't cause
 * false positives that would block a legitimate launch.
 *
 * Returns { field, value, existing } for the first collision, or null.
 */
async function findDuplicateLaunch(name, symbol, chain = "solana") {
  const nm = String(name || "").trim();
  const sy = String(symbol || "").trim();
  const filters = [];
  if (nm) filters.push(`name.ilike.${encodeURIComponent(nm)}`);
  if (sy) filters.push(`symbol.ilike.${encodeURIComponent(sy)}`);
  if (!filters.length) return null;

  let rows = [];
  try {
    rows = await dbSelect(
      "ogdex_launches",
      `or=(${filters.join(",")})&status=eq.listed&select=id,name,symbol,mint,links&limit=100`
    );
  } catch {
    return null; // fail-open on lookup error — never block a launch on infra hiccup
  }

  const nml = nm.toLowerCase();
  const syl = sy.toLowerCase();
  // Duplicates are scoped PER CHAIN — the same name may exist on Solana and BSC.
  // Chain is stored inside the links jsonb; legacy rows with no chain are Solana.
  for (const r of rows) {
    const rowChain = (r.links && r.links.chain) || "solana";
    if (rowChain !== chain) continue;
    if (nm && String(r.name || "").trim().toLowerCase() === nml)
      return { field: "name", value: nm, existing: r };
    if (sy && String(r.symbol || "").trim().toLowerCase() === syl)
      return { field: "symbol", value: sy, existing: r };
  }
  return null;
}

function dupError(dup) {
  const label = dup.field === "name" ? "name" : "ticker";
  return `A token with that ${label} ("${dup.value}") has already been launched on the OrbitX Launchpad. Duplicate launches aren't allowed — pick a different ${dup.field}.`;
}

async function rpc(method, params) {
  const r = await callFn("rpc-proxy", { jsonrpc: "2.0", id: 1, method, params });
  return r?.data?.result ?? r?.result ?? null;
}

async function solPriceUsd() {
  // Jupiter price v3 (primary), then v2, then CoinGecko as a final fallback.
  try {
    const r = await fetch(`https://lite-api.jup.ag/price/v3?ids=${SOL_MINT}`);
    if (r.ok) { const d = await r.json(); const p = Number(d?.[SOL_MINT]?.usdPrice); if (p > 0) return p; }
  } catch {}
  try {
    const r = await fetch(`https://lite-api.jup.ag/price/v2?ids=${SOL_MINT}`);
    if (r.ok) { const d = await r.json(); const p = Number(d?.data?.[SOL_MINT]?.price); if (p > 0) return p; }
  } catch {}
  try {
    const r = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd");
    if (r.ok) { const d = await r.json(); const p = Number(d?.solana?.usd); if (p > 0) return p; }
  } catch {}
  return null;
}

export default async function handler(req, res) {
  if (req.method === "GET") {
    const url = new URL(req.url, "http://x");
    if (url.searchParams.get("config")) {
      const chain = (url.searchParams.get("chain") || "solana").toLowerCase();
      const solPrice = await solPriceUsd();
      const feeUsd = chain === "solana" ? FEE_USD : 0;
      return send(res, 200, {
        ok: true, feeUsd, payWallet: PLATFORM_FEE_WALLET, solPrice,
        usdcMint: USDC_MINT, usdtMint: USDT_MINT, solMint: SOL_MINT,
      });
    }
    return send(res, 400, { ok: false, error: "use ?config=1 or POST" });
  }
  if (req.method !== "POST") return send(res, 405, { ok: false, error: "method not allowed" });

  try {
    const body = await readBody(req);
    switch (body?.step) {
      case "check":  return await handleCheck(body, res);
      case "ipfs":   return await handleIpfs(body, res);
      case "create": return await handleCreate(body, res);
      case "record": return await handleRecord(body, res);
      default:       return send(res, 400, { ok: false, error: "invalid step (check|ipfs|create|record)" });
    }
  } catch (e) {
    return send(res, 500, { ok: false, error: String(e?.message || e) });
  }
}

/* ── Step 0 (optional): pre-deploy duplicate check ────────────────────── */
/**
 * Lets the client confirm a name/symbol is free ON THE SELECTED CHAIN before
 * spending any gas or building a transaction. Always 200 — the caller reads
 * `duplicate` to decide whether to proceed. Duplicates are scoped per chain,
 * so the same name may live on Solana and on an EVM chain independently.
 */
async function handleCheck(body, res) {
  const chain = String(body.chain || "solana").toLowerCase();
  const dup = await findDuplicateLaunch(body.name, body.symbol, chain);
  if (dup) return send(res, 200, { ok: true, duplicate: true, field: dup.field, error: dupError(dup) });
  return send(res, 200, { ok: true, duplicate: false });
}

/* ── Step 1: upload image + metadata to pump.fun IPFS ─────────────────── */
async function handleIpfs(body, res) {
  const { imageBase64, imageMimeType, name, symbol, description, twitter, telegram, website } = body;
  if (!imageBase64 || !name || !symbol)
    return send(res, 400, { ok: false, error: "imageBase64, name and symbol are required" });

  // Reject duplicate launches up front — before any IPFS upload or on-chain
  // deploy — so the user finds out immediately, not after paying gas.
  const dup = await findDuplicateLaunch(name, symbol, String(body.chain || "solana").toLowerCase());
  if (dup) return send(res, 409, { ok: false, error: dupError(dup) });

  const imageBuffer = Buffer.from(imageBase64, "base64");
  const ext = (imageMimeType || "image/png").split("/")[1] || "png";
  const form = new FormData();
  form.append("file", new Blob([imageBuffer], { type: imageMimeType || "image/png" }), `token.${ext}`);
  form.append("name", name);
  form.append("symbol", symbol);
  form.append("description", description || "");
  form.append("twitter", twitter || "");
  form.append("telegram", telegram || "");
  form.append("website", website || "");
  form.append("showName", "true");

  const r = await fetch("https://pump.fun/api/ipfs", { method: "POST", body: form });
  if (!r.ok) return send(res, 502, { ok: false, error: `IPFS upload failed (${r.status}): ${await r.text()}` });
  const data = await r.json();
  if (!data.metadataUri) return send(res, 502, { ok: false, error: "no metadataUri returned" });
  return send(res, 200, { ok: true, metadataUri: data.metadataUri, metadata: data.metadata || data });
}

/* ── Step 2: build the unsigned create transaction via PumpPortal ──────── */
async function handleCreate(body, res) {
  const { publicKey, metadataUri, name, symbol, mintPublicKey, devBuySol, slippage } = body;
  if (!publicKey || !metadataUri || !name || !symbol || !mintPublicKey)
    return send(res, 400, { ok: false, error: "missing required fields" });

  // Defence in depth: block dup name/symbol before building the on-chain tx,
  // in case a client reaches this step without going through "ipfs".
  const dupC = await findDuplicateLaunch(name, symbol, "solana");
  if (dupC) return send(res, 409, { ok: false, error: dupError(dupC) });

  const payload = {
    publicKey, action: "create",
    tokenMetadata: { name, symbol, uri: metadataUri },
    mint: mintPublicKey,
    denominatedInSol: "true",
    amount: Number(devBuySol) || 0,
    slippage: Number(slippage) || 10,
    priorityFee: 0.0005,
    pool: "pump",
  };
  const r = await fetch("https://pumpportal.fun/api/trade-local", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
  });
  if (!r.ok) return send(res, 502, { ok: false, error: `PumpPortal create failed (${r.status}): ${await r.text()}` });
  const txBase64 = Buffer.from(new Uint8Array(await r.arrayBuffer())).toString("base64");
  return send(res, 200, { ok: true, transaction: txBase64 });
}

/* ── Step 3: verify the $5 fee on-chain, then record the launch ────────── */
async function handleRecord(body, res) {
  const mint = String(body.mint || "").trim();
  const payment_tx = String(body.payment_tx || "").trim();
  const pay_currency = String(body.pay_currency || "sol").toLowerCase();
  const creator_wallet = body.creator_wallet || null;
  const chain = String(body.chain || "solana").toLowerCase();
  const launchpad = body.launchpad ? String(body.launchpad) : (chain === "solana" ? "pumpfun" : null);
  if (!mint) return send(res, 400, { ok: false, error: "mint required" });

  // $1.50 fee on Solana only — every other chain is free. Never trust the
  // client's own claim about the chain being free; re-derive it here.
  const chargeFee = chain === "solana";

  let verify = { ok: true, usd: 0, currency: pay_currency };
  if (chargeFee) {
    if (!payment_tx) return send(res, 400, { ok: false, error: "payment_tx required" });
    // Reject reused payments (defence in depth — DB has a UNIQUE constraint too).
    try {
      const dup = await dbSelect("ogdex_launches", `payment_tx=eq.${encodeURIComponent(payment_tx)}&select=id&limit=1`);
      if (dup.length) return send(res, 409, { ok: false, error: "this payment has already been used" });
    } catch {}
    verify = await verifyFee(payment_tx, pay_currency);
    if (!verify.ok) return send(res, 402, { ok: false, error: verify.error || "fee payment could not be verified" });
  } else if (payment_tx) {
    // A tx was sent anyway (e.g. stale client) — still guard against reuse.
    try {
      const dup = await dbSelect("ogdex_launches", `payment_tx=eq.${encodeURIComponent(payment_tx)}&select=id&limit=1`);
      if (dup.length) return send(res, 409, { ok: false, error: "this payment has already been used" });
    } catch {}
  }

  const row = {
    mint,
    symbol: body.symbol || null,
    name: body.name || null,
    icon: body.icon || null,
    description: body.description || null,
    creator_wallet,
    pay_currency: ["sol", "usdc", "usdt"].includes(pay_currency) ? pay_currency : "sol",
    fee_usd: chargeFee ? FEE_USD : 0,
    // Placeholder for free (non-Solana) launches must still be unique —
    // payment_tx has a DB UNIQUE constraint, and a fixed literal here would
    // let only the very first free launch ever succeed.
    payment_tx: payment_tx || `FREE-${chain}-${mint}`,
    launch_tx: body.launch_tx || null,
    // Chain + launchpad live in the links jsonb (no schema migration needed);
    // legacy rows with no chain are treated as Solana everywhere.
    links: { ...(body.links || {}), chain, launchpad, contract: mint },
    status: "listed",
  };

  // Authoritative duplicate guard — the last line of defence before a token
  // enters the Launchpad feed. Nothing gets listed twice under the same
  // name/symbol on the same chain, even if earlier client-side steps were bypassed.
  const dupR = await findDuplicateLaunch(row.name, row.symbol, chain);
  if (dupR && dupR.existing?.mint !== mint)
    return send(res, 409, { ok: false, error: dupError(dupR) });

  let inserted;
  try {
    inserted = await dbInsert("ogdex_launches", row);
  } catch (e) {
    if (String(e?.message || e).includes("duplicate"))
      return send(res, 409, { ok: false, error: "this payment or token has already been recorded" });
    throw e;
  }
  const token = (inserted && inserted[0]) || row;
  const isEvm = chain !== "solana";
  return send(res, 200, {
    ok: true,
    token: { ...token, chain, launchpad, paidUsd: verify.usd, freeLaunch: !chargeFee },
    links: isEvm
      ? { ogdex: `/token/${mint}?chain=${chain}` }
      : { pumpfun: `https://pump.fun/${mint}`, solscan: `https://solscan.io/token/${mint}`, ogdex: `/token/${mint}` },
  });
}

/**
 * Verify a fee payment transaction actually transferred >= $1.50 (allowing
 * small price drift) to PLATFORM_FEE_WALLET, in SOL or the chosen stablecoin.
 */
async function verifyFee(signature, payCurrency) {
  let tx;
  try {
    tx = await rpc("getTransaction", [signature, { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 }]);
  } catch (e) {
    return { ok: false, error: `could not fetch transaction: ${String(e?.message || e)}` };
  }
  if (!tx) return { ok: false, error: "transaction not found yet — wait for confirmation and retry" };
  if (tx.meta?.err) return { ok: false, error: "fee transaction failed on-chain" };

  const min = FEE_USD * FEE_TOLERANCE;

  if (payCurrency === "sol") {
    const keys = (tx.transaction?.message?.accountKeys || []).map((k) => (typeof k === "string" ? k : k.pubkey));
    const idx = keys.indexOf(PLATFORM_FEE_WALLET);
    if (idx < 0) return { ok: false, error: "payment wallet not found in transaction" };
    const pre = tx.meta?.preBalances?.[idx] ?? 0;
    const post = tx.meta?.postBalances?.[idx] ?? 0;
    const lamports = post - pre;
    if (lamports <= 0) return { ok: false, error: "no SOL received by payment wallet" };
    const price = await solPriceUsd();
    if (!price) return { ok: false, error: "could not fetch SOL price" };
    const usd = (lamports / 1e9) * price;
    if (usd < min) return { ok: false, error: `fee too low: received ~$${usd.toFixed(2)}, need $${FEE_USD}` };
    return { ok: true, usd: Number(usd.toFixed(2)), currency: "sol" };
  }

  // Stablecoin (USDC / USDT): compare token balance deltas owned by PLATFORM_FEE_WALLET.
  const pre = tx.meta?.preTokenBalances || [];
  const post = tx.meta?.postTokenBalances || [];
  let best = 0;
  for (const pb of post) {
    if (pb.owner !== PLATFORM_FEE_WALLET) continue;
    if (!STABLES[pb.mint]) continue;
    const match = pre.find((x) => x.accountIndex === pb.accountIndex) || {};
    const before = Number(match.uiTokenAmount?.uiAmount || 0);
    const after = Number(pb.uiTokenAmount?.uiAmount || 0);
    best = Math.max(best, after - before);
  }
  if (best <= 0) return { ok: false, error: "no USDC/USDT received by payment wallet" };
  if (best < min) return { ok: false, error: `fee too low: received ~$${best.toFixed(2)}, need $${FEE_USD}` };
  return { ok: true, usd: Number(best.toFixed(2)), currency: payCurrency };
}

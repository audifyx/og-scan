import { send, callFn, dbInsert, dbSelect, readBody, PAY_WALLET } from "../_lib.js";

/**
 * OG DEX Token Launcher backend.
 *
 * Flat $5 launch fee, paid in SOL or USDC/USDT to PAY_WALLET (same wallet as
 * boosts/listings), verified on-chain via the fee transaction signature.
 *
 * GET  /api/launch?config=1
 *   → { ok, feeUsd, payWallet, solPrice, usdcMint, usdtMint }
 *
 * POST /api/launch   (body.step)
 *   step "ipfs"   { imageBase64, imageMimeType, name, symbol, description, twitter, telegram, website }
 *                 → { metadataUri, metadata }   (uploads to pump.fun IPFS)
 *   step "create" { publicKey, metadataUri, name, symbol, mintPublicKey, devBuySol, slippage }
 *                 → { transaction }              (unsigned PumpPortal create tx, base64)
 *   step "record" { payment_tx, pay_currency, creator_wallet, mint, name, symbol, icon,
 *                   description, launch_tx, links }
 *                 → { ok, token }   verifies the $5 fee on-chain, then stores the launch
 *
 * Launched tokens are stored UNVERIFIED with no boost — they surface only in
 * the "Newly Listed" section (/api/launches).
 */

const FEE_USD = 5;
const FEE_TOLERANCE = 0.92;               // accept >= 92% of $5 to absorb price drift
const SOL_MINT = "So11111111111111111111111111111111111111112";
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const USDT_MINT = "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB";
const STABLES = { [USDC_MINT]: "usdc", [USDT_MINT]: "usdt" };

async function rpc(method, params) {
  const r = await callFn("rpc-proxy", { jsonrpc: "2.0", id: 1, method, params });
  return r?.data?.result ?? r?.result ?? null;
}

async function solPriceUsd() {
  try {
    const r = await fetch(`https://lite-api.jup.ag/price/v2?ids=${SOL_MINT}`);
    const d = await r.json();
    const p = Number(d?.data?.[SOL_MINT]?.price);
    return p > 0 ? p : null;
  } catch { return null; }
}

export default async function handler(req, res) {
  if (req.method === "GET") {
    const url = new URL(req.url, "http://x");
    if (url.searchParams.get("config")) {
      const solPrice = await solPriceUsd();
      return send(res, 200, {
        ok: true, feeUsd: FEE_USD, payWallet: PAY_WALLET, solPrice,
        usdcMint: USDC_MINT, usdtMint: USDT_MINT, solMint: SOL_MINT,
      });
    }
    return send(res, 400, { ok: false, error: "use ?config=1 or POST" });
  }
  if (req.method !== "POST") return send(res, 405, { ok: false, error: "method not allowed" });

  try {
    const body = await readBody(req);
    switch (body?.step) {
      case "ipfs":   return await handleIpfs(body, res);
      case "create": return await handleCreate(body, res);
      case "record": return await handleRecord(body, res);
      default:       return send(res, 400, { ok: false, error: "invalid step (ipfs|create|record)" });
    }
  } catch (e) {
    return send(res, 500, { ok: false, error: String(e?.message || e) });
  }
}

/* ── Step 1: upload image + metadata to pump.fun IPFS ─────────────────── */
async function handleIpfs(body, res) {
  const { imageBase64, imageMimeType, name, symbol, description, twitter, telegram, website } = body;
  if (!imageBase64 || !name || !symbol)
    return send(res, 400, { ok: false, error: "imageBase64, name and symbol are required" });

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
  if (!mint) return send(res, 400, { ok: false, error: "mint required" });
  if (!payment_tx) return send(res, 400, { ok: false, error: "payment_tx required" });

  // Reject reused payments (defence in depth — DB has a UNIQUE constraint too).
  try {
    const dup = await dbSelect("ogdex_launches", `payment_tx=eq.${encodeURIComponent(payment_tx)}&select=id&limit=1`);
    if (dup.length) return send(res, 409, { ok: false, error: "this payment has already been used" });
  } catch {}

  const verify = await verifyFee(payment_tx, pay_currency);
  if (!verify.ok) return send(res, 402, { ok: false, error: verify.error || "fee payment could not be verified" });

  const row = {
    mint,
    symbol: body.symbol || null,
    name: body.name || null,
    icon: body.icon || null,
    description: body.description || null,
    creator_wallet: body.creator_wallet || null,
    pay_currency: ["sol", "usdc", "usdt"].includes(pay_currency) ? pay_currency : "sol",
    fee_usd: FEE_USD,
    payment_tx,
    launch_tx: body.launch_tx || null,
    links: body.links || {},
    status: "listed",
  };
  let inserted;
  try {
    inserted = await dbInsert("ogdex_launches", row);
  } catch (e) {
    if (String(e?.message || e).includes("duplicate"))
      return send(res, 409, { ok: false, error: "this payment or token has already been recorded" });
    throw e;
  }
  const token = (inserted && inserted[0]) || row;
  return send(res, 200, {
    ok: true,
    token: { ...token, paidUsd: verify.usd },
    links: {
      pumpfun: `https://pump.fun/${mint}`,
      solscan: `https://solscan.io/token/${mint}`,
      ogdex: `/token/${mint}`,
    },
  });
}

/**
 * Verify a fee payment transaction actually transferred >= $5 (allowing
 * small price drift) to PAY_WALLET, in SOL or the chosen stablecoin.
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
    const idx = keys.indexOf(PAY_WALLET);
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

  // Stablecoin (USDC / USDT): compare token balance deltas owned by PAY_WALLET.
  const pre = tx.meta?.preTokenBalances || [];
  const post = tx.meta?.postTokenBalances || [];
  let best = 0;
  for (const pb of post) {
    if (pb.owner !== PAY_WALLET) continue;
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

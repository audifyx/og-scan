/**
 * OG DEX — non-custodial trade transaction builder.
 * Builds candidate buy/sell transactions (PumpPortal across venues, then the
 * Jupiter aggregator). Prefers a simulation-passing route, but ALWAYS returns a
 * built transaction when one exists so Phantom/Jupiter can open for signing —
 * never dead-end with "transaction would fail" when a tx was constructed.
 * The user's wallet signs and sends; OG DEX never holds keys or funds.
 */
import { send, readBody, callFn, jup } from "../_lib.js";

const SOL = "So11111111111111111111111111111111111111112";
const isPubkey = (v) => typeof v === "string" && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(v);

async function rpc(method, params) {
  const r = await callFn("rpc-proxy", { method, params, id: 1, provider: "helius" });
  return r?.data?.result ?? r?.result ?? null;
}

// Simulate an unsigned base64 tx with a replaced blockhash. Returns {ok, err}.
// Fails OPEN (ok:true) if the simulation RPC itself is unavailable, so a flaky
// RPC never blocks a legitimate trade.
async function simulate(txB64) {
  try {
    const res = await rpc("simulateTransaction", [txB64, { sigVerify: false, replaceRecentBlockhash: true, encoding: "base64", commitment: "processed" }]);
    if (!res || !res.value) return { ok: true, unknown: true };
    return { ok: res.value.err == null, err: res.value.err };
  } catch { return { ok: true, unknown: true }; }
}


async function tokenBalance(owner, mint) {
  try {
    const res = await rpc("getTokenAccountsByOwner", [owner, { mint }, { encoding: "jsonParsed" }]);
    let raw = 0n, decimals = 0;
    for (const a of (res?.value || [])) {
      const ta = a.account?.data?.parsed?.info?.tokenAmount;
      if (ta) { raw += BigInt(ta.amount || "0"); decimals = Number(ta.decimals) || decimals; }
    }
    return { raw, decimals };
  } catch { return { raw: 0n, decimals: 0 }; }
}

async function pumpPortalTx({ publicKey, action, mint, amt, denominatedInSol, slippage, priorityFee, pool }) {
  try {
    const r = await fetch("https://pumpportal.fun/api/trade-local", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ publicKey, action, mint, amount: amt, denominatedInSol, slippage, priorityFee, pool }),
    });
    const ct = r.headers.get("content-type") || "";
    if (r.ok && !ct.includes("application/json")) {
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.length) return { tx: buf.toString("base64") };
    }
    const txt = await r.text().catch(() => "");
    let msg = txt.slice(0, 160);
    try { const j = JSON.parse(txt); msg = j.errors ? (Array.isArray(j.errors) ? j.errors.join("; ") : JSON.stringify(j.errors)) : (j.error || msg); } catch { /* keep */ }
    return { error: msg };
  } catch (e) { return { error: String(e?.message || e) }; }
}

async function jupiterTx({ publicKey, action, mint, amt, slippage }) {
  try {
    const slippageBps = Math.min(Math.max(Math.round((Number(slippage) || 10) * 100), 50), 5000);
    let inputMint, outputMint, amount;
    if (action === "buy") {
      inputMint = SOL; outputMint = mint; amount = Math.floor(Number(amt) * 1e9);
    } else {
      inputMint = mint; outputMint = SOL;
      const { raw, decimals } = await tokenBalance(publicKey, mint);
      if (raw <= 0n) return { error: "no balance to sell" };
      if (typeof amt === "string" && amt.endsWith("%")) amount = Number((raw * BigInt(Math.round(Number(amt.slice(0, -1)))) / 100n).toString());
      else amount = Math.floor(Number(amt) * 10 ** decimals);
    }
    if (!amount || amount <= 0) return { error: "invalid amount" };
    const q = await jup(`/swap/v1/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=${slippageBps}&restrictIntermediateTokens=true`).catch(() => null);
    if (!q || q.error || !q.outAmount) return { error: q?.error || "no route" };
    const r = await fetch("https://lite-api.jup.ag/swap/v1/swap", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quoteResponse: q, userPublicKey: publicKey, wrapAndUnwrapSol: true, dynamicComputeUnitLimit: true, prioritizationFeeLamports: "auto" }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.swapTransaction) return { error: j.error || "jupiter swap failed" };
    return { tx: j.swapTransaction };
  } catch (e) { return { error: String(e?.message || e) }; }
}

export default async function handler(req, res) {
  if (req.method !== "POST") return send(res, 405, { ok: false, error: "POST only" });
  let body = {};
  try { body = await readBody(req); } catch { body = {}; }

  const publicKey = body.publicKey;
  const action = body.action === "sell" ? "sell" : "buy";
  const mint = body.mint;
  const denominatedInSol = action === "buy" ? "true" : (body.denominatedInSol === true || body.denominatedInSol === "true" ? "true" : "false");
  const slippage = Math.min(Math.max(Number(body.slippage) || 10, 1), 50);
  const priorityFee = Math.min(Math.max(Number(body.priorityFee) || 0.0003, 0), 0.01);
  const reqPool = ["auto", "pump", "raydium", "pump-amm", "launchlab", "raydium-cpmm", "bonk"].includes(body.pool) ? body.pool : "auto";

  if (!isPubkey(publicKey)) return send(res, 400, { ok: false, error: "invalid publicKey" });
  if (!isPubkey(mint)) return send(res, 400, { ok: false, error: "invalid mint" });

  let amt;
  const rawAmt = typeof body.amount === "string" ? body.amount.trim() : body.amount;
  if (action === "sell" && typeof rawAmt === "string" && rawAmt.endsWith("%")) {
    const pct = Number(rawAmt.slice(0, -1));
    if (!Number.isFinite(pct) || pct <= 0 || pct > 100) return send(res, 400, { ok: false, error: "invalid sell percentage" });
    amt = `${pct}%`;
  } else {
    const n = Number(rawAmt);
    if (!Number.isFinite(n) || n <= 0) return send(res, 400, { ok: false, error: "invalid amount" });
    amt = n;
  }

  let lastErr = "Could not build a working trade";
  let firstBuilt = null;     // any constructed tx — hand to wallet as last resort
  let firstUnknown = null;   // built but simulation couldn't run (RPC)
  let firstSimFail = null;   // built but sim erred — still return so wallet can try

  // Candidate builders: PumpPortal venues (best for bonding-curve buys), then Jupiter.
  const pools = [...new Set([reqPool, "auto", "pump", "pump-amm", "raydium", "bonk", "raydium-cpmm", "launchlab"])];
  const builders = pools.map((pl) => ({ via: "pumpportal", pool: pl, run: () => pumpPortalTx({ publicKey, action, mint, amt, denominatedInSol, slippage, priorityFee, pool: pl }) }));
  builders.push({ via: "jupiter", run: () => jupiterTx({ publicKey, action, mint, amt, slippage }) });

  for (const b of builders) {
    const out = await b.run();
    if (out.error) { lastErr = out.error; continue; }
    if (!out.tx) continue;
    const payload = { ok: true, tx: out.tx, via: b.via, pool: b.pool || null };
    if (!firstBuilt) firstBuilt = { ...payload, simulated: false };
    const sim = await simulate(out.tx);
    if (sim.ok && !sim.unknown) {
      // Definitive pass — best case for Phantom.
      return send(res, 200, { ...payload, simulated: true });
    }
    if (sim.unknown) {
      if (!firstUnknown) firstUnknown = { ...payload, simulated: false };
    } else if (!firstSimFail) {
      firstSimFail = {
        ...payload,
        simulated: false,
        warning: "Route simulation flagged a risk — confirm carefully in your wallet",
      };
      lastErr = "simulation flagged route (wallet may still succeed)";
    }
  }

  // Prefer unknown (RPC flake) → sim-fail candidate → any built tx.
  // Never block the wallet prompt when we have a transaction to sign.
  if (firstUnknown) return send(res, 200, firstUnknown);
  if (firstSimFail) return send(res, 200, firstSimFail);
  if (firstBuilt) return send(res, 200, firstBuilt);
  return send(res, 200, { ok: false, error: lastErr });
}

/**
 * OG DEX — wallet-synced watchlist (cross-device).
 * Requires Solana wallet signature proof (same as alerts) to prevent IDOR.
 */
import { send, kvGet, kvPut, readBody } from "../_lib.js";
import { extractProof, verifyWalletProof } from "../_walletProof.js";

const isAddr = (v) => typeof v === "string" && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(v);
const SCOPE = "ogdex-wallet";

function requireProof(req, body, wallet) {
  const p = extractProof(req, body);
  if (wallet && p.wallet && p.wallet !== wallet) return false;
  return verifyWalletProof({ wallet: wallet || p.wallet, ts: p.ts, sig: p.sig, scope: SCOPE });
}

export default async function handler(req, res) {
  if (req.method === "POST") {
    const body = await readBody(req);
    if (!isAddr(body.wallet)) return send(res, 400, { ok: false, error: "invalid wallet" });
    if (!requireProof(req, body, body.wallet)) {
      return send(res, 401, { ok: false, error: "wallet signature required" });
    }
    const items = Array.isArray(body.items) ? body.items.filter(isAddr).slice(0, 500) : [];
    try {
      await kvPut(`watchlist/${body.wallet}.json`, { items, updatedAt: Date.now() });
      return send(res, 200, { ok: true, count: items.length });
    } catch (e) {
      return send(res, 200, { ok: false, error: String(e?.message || e) });
    }
  }
  const url = new URL(req.url, "http://x");
  const wallet = url.searchParams.get("wallet");
  if (!isAddr(wallet)) return send(res, 400, { ok: false, error: "invalid wallet" });
  if (!requireProof(req, {}, wallet)) {
    return send(res, 401, { ok: false, error: "wallet signature required" });
  }
  const data = await kvGet(`watchlist/${wallet}.json`);
  return send(res, 200, { ok: true, items: data?.items || [] });
}

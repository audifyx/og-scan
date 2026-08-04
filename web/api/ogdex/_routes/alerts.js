/**
 * OG DEX — smart alerts CRUD (stored per-wallet in Supabase Storage).
 * Mutations and reads require a Solana wallet signature proof to prevent IDOR.
 * GET  ?wallet=&ts=&sig=  (or headers) -> { ok, alerts:[...] }
 * POST { wallet, alert|remove, ts, sig } -> mutate
 */
import { send, kvGet, kvPut, readBody, jup } from "../_lib.js";
import { extractProof, verifyWalletProof, isSafeWebhookUrl } from "../_walletProof.js";

const isAddr = (v) => typeof v === "string" && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(v);
const TYPES = ["price_above", "price_below", "pct_up", "pct_down", "wallet_trade"];
const SCOPE = "ogdex-wallet";

async function priceOf(mint) {
  try {
    const d = await jup(`/price/v3?ids=${mint}`);
    return Number(d?.[mint]?.usdPrice) || null;
  } catch {
    return null;
  }
}

function requireProof(req, body, wallet) {
  const p = extractProof(req, body);
  if (wallet && p.wallet && p.wallet !== wallet) return false;
  const w = wallet || p.wallet;
  return verifyWalletProof({ wallet: w, ts: p.ts, sig: p.sig, scope: SCOPE });
}

export default async function handler(req, res) {
  if (req.method === "POST") {
    const body = await readBody(req);
    if (!isAddr(body.wallet)) return send(res, 400, { ok: false, error: "invalid wallet" });
    if (!requireProof(req, body, body.wallet)) {
      return send(res, 401, { ok: false, error: "wallet signature required — sign orbitx-dex:ogdex-wallet:<wallet>:<ts>" });
    }
    const key = `alerts/${body.wallet}.json`;
    const cur = (await kvGet(key))?.alerts || [];

    if (body.remove) {
      const next = cur.filter((a) => a.id !== body.remove);
      await kvPut(key, { alerts: next });
      return send(res, 200, { ok: true, alerts: next });
    }
    const a = body.alert || {};
    if (!TYPES.includes(a.type)) return send(res, 400, { ok: false, error: "invalid type" });
    const channel = a.channel === "telegram" ? "telegram" : "webhook";
    const target = String(a.target || "").trim();
    if (channel === "telegram") {
      if (!/^(-?\d{4,}|@[A-Za-z0-9_]{4,})$/.test(target)) {
        return send(res, 400, { ok: false, error: "Telegram target must be your numeric chat ID or @channel" });
      }
    } else if (!isSafeWebhookUrl(target)) {
      return send(res, 400, { ok: false, error: "target must be a public https:// webhook URL" });
    }
    let alert;
    if (a.type === "wallet_trade") {
      if (!isAddr(a.watch)) return send(res, 400, { ok: false, error: "watch wallet address required" });
      alert = {
        id: Math.random().toString(36).slice(2, 10),
        type: "wallet_trade",
        watch: a.watch,
        label: (a.label || "").toString().slice(0, 40) || null,
        channel,
        target,
        lastTx: null,
        enabled: true,
        createdAt: Date.now(),
        lastFired: 0,
      };
    } else {
      if (!isAddr(a.mint)) return send(res, 400, { ok: false, error: "invalid mint" });
      const kind = ["limit", "tp", "stop"].includes(a.kind) ? a.kind : null;
      const refPrice = await priceOf(a.mint);
      alert = {
        id: Math.random().toString(36).slice(2, 10),
        mint: a.mint,
        symbol: a.symbol || null,
        kind,
        type: a.type,
        value: Number(a.value) || 0,
        channel,
        target,
        refPrice,
        enabled: true,
        createdAt: Date.now(),
        lastFired: 0,
      };
    }
    if (cur.length >= 25) return send(res, 200, { ok: false, error: "max 25 alerts per wallet" });
    const next = [alert, ...cur];
    await kvPut(key, { alerts: next });
    return send(res, 200, { ok: true, alerts: next });
  }

  const url = new URL(req.url, "http://x");
  const wallet = url.searchParams.get("wallet");
  if (!isAddr(wallet)) return send(res, 400, { ok: false, error: "invalid wallet" });
  if (!requireProof(req, {}, wallet)) {
    return send(res, 401, { ok: false, error: "wallet signature required" });
  }
  const data = await kvGet(`alerts/${wallet}.json`);
  return send(res, 200, { ok: true, alerts: data?.alerts || [] });
}

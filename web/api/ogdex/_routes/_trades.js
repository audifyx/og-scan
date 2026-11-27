// OG DEX — in-app user trades: record + volume leaderboard.
//
// Closes the gap the referrals build documented: in-app swaps were recorded
// on-device only, so no server-side volume ranking was possible. The app
// calls POST /trades after each successful swap (best-effort — a record
// failure must never block the swap) and GET /trades for the volume board.
//
// Auth: recording requires the caller's Supabase JWT AND a profiles row
// whose wallet_address matches the submitted wallet. A caller can never
// record trades for someone else's wallet. Aggregates come from the
// user_trade_volume view (public profile fields + totals only).
import { send, cache, dbSelect, dbInsert, readBody, kvGet, kvPut, SUPA_URL, ANON } from "../_lib.js";

const isAddr = (a) => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(a || "");
const isSig = (s) => /^[1-9A-HJ-NP-Za-km-z]{43,128}$/.test(s || "");
const isPosNum = (n) => Number.isFinite(Number(n)) && Number(n) > 0;
const isNonNegNum = (n) => Number.isFinite(Number(n)) && Number(n) >= 0;

const VOLUME_CACHE_KEY = "trades/volume-v1.json";
const VOLUME_TTL_MS = 5 * 60 * 1000;

/** Pure: validate a record-trade payload. Exported for tests. */
export function validateTrade(b) {
  if (!b || typeof b !== "object") return { ok: false, error: "body required" };
  const wallet_address = String(b.wallet_address || "").trim();
  const mint = String(b.mint || "").trim();
  const side = String(b.side || "").trim().toLowerCase();
  const tx_signature = String(b.tx_signature || "").trim();
  if (!isAddr(wallet_address)) return { ok: false, error: "valid wallet_address required" };
  if (!isAddr(mint)) return { ok: false, error: "valid mint required" };
  if (side !== "buy" && side !== "sell") return { ok: false, error: "side must be buy or sell" };
  if (!isPosNum(b.token_amount)) return { ok: false, error: "token_amount must be > 0" };
  if (!isNonNegNum(b.usd_amount)) return { ok: false, error: "usd_amount must be >= 0" };
  if (b.sol_amount !== undefined && b.sol_amount !== null && !isNonNegNum(b.sol_amount)) {
    return { ok: false, error: "sol_amount must be >= 0" };
  }
  if (b.fee_usd !== undefined && b.fee_usd !== null && !isNonNegNum(b.fee_usd)) {
    return { ok: false, error: "fee_usd must be >= 0" };
  }
  if (!isSig(tx_signature)) return { ok: false, error: "valid tx_signature required" };
  return {
    ok: true,
    trade: {
      wallet_address,
      mint,
      symbol: b.symbol ? String(b.symbol).slice(0, 32) : null,
      side,
      token_amount: Number(b.token_amount),
      sol_amount: b.sol_amount === undefined || b.sol_amount === null ? null : Number(b.sol_amount),
      usd_amount: Number(b.usd_amount),
      fee_usd: b.fee_usd === undefined || b.fee_usd === null ? 0 : Number(b.fee_usd),
      tx_signature,
      source: b.source === "web" ? "web" : "app",
    },
  };
}

/** Pure: rank volume rows best-first. Exported for tests. */
export function rankVolume(rows, limit = 50) {
  return (rows || [])
    .map((r) => ({
      wallet_address: r.wallet_address,
      user_id: r.user_id || null,
      username: r.username || null,
      display_name: r.display_name || null,
      avatar_url: r.avatar_url || null,
      volume_usd_30d: Number(r.volume_usd_30d) || 0,
      trade_count_30d: Number(r.trade_count_30d) || 0,
      volume_usd_all: Number(r.volume_usd_all) || 0,
      trade_count_all: Number(r.trade_count_all) || 0,
      last_trade_at: r.last_trade_at || null,
    }))
    .sort((a, b) => b.volume_usd_30d - a.volume_usd_30d || b.volume_usd_all - a.volume_usd_all)
    .slice(0, limit)
    .map((e, i) => ({ ...e, rank: i + 1 }));
}

async function verifySupabaseUser(req) {
  const auth = String(req.headers.authorization || req.headers.Authorization || "");
  const m = auth.match(/^Bearer\s+(\S+)$/i);
  if (!m || !SUPA_URL || !ANON) return null;
  try {
    const r = await fetch(`${SUPA_URL}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${m[1]}`, apikey: ANON },
    });
    if (!r.ok) return null;
    const u = await r.json().catch(() => null);
    return u?.id ? { id: u.id, email: u.email || null } : null;
  } catch {
    return null;
  }
}

async function walletOwnedBy(userId, wallet) {
  try {
    const rows = await dbSelect(
      "profiles",
      `select=wallet_address&user_id=eq.${encodeURIComponent(userId)}&limit=1`
    );
    return rows?.[0]?.wallet_address === wallet;
  } catch {
    return false;
  }
}

async function handleRecord(req, res) {
  const user = await verifySupabaseUser(req);
  if (!user) return send(res, 401, { ok: false, error: "sign in required" });
  const body = await readBody(req);
  const v = validateTrade(body);
  if (!v.ok) return send(res, 400, { ok: false, error: v.error });
  // The wallet on the trade must be the wallet linked to THIS account.
  if (!(await walletOwnedBy(user.id, v.trade.wallet_address))) {
    return send(res, 403, { ok: false, error: "wallet not linked to this account" });
  }
  try {
    const rows = await dbInsert("user_trades", { ...v.trade, user_id: user.id });
    return send(res, 200, { ok: true, id: rows?.[0]?.id || null, duplicate: false });
  } catch (e) {
    const msg = String(e?.message || e);
    // Idempotent retry: the same tx was already recorded.
    if (/409|duplicate|unique/i.test(msg)) {
      return send(res, 200, { ok: true, duplicate: true });
    }
    return send(res, 500, { ok: false, error: "record failed" });
  }
}

async function handleVolume(res) {
  const cached = await kvGet(VOLUME_CACHE_KEY).catch(() => null);
  if (cached && Date.now() - (cached.at || 0) < VOLUME_TTL_MS) {
    cache(res, 60, 300);
    return send(res, 200, { ...cached, cached: true });
  }
  try {
    const rows = await dbSelect(
      "user_trade_volume",
      "select=*&order=volume_usd_30d.desc&limit=50"
    );
    const payload = { ok: true, at: Date.now(), count: rows.length, entries: rankVolume(rows, 50) };
    await kvPut(VOLUME_CACHE_KEY, payload).catch(() => {});
    cache(res, 60, 300);
    return send(res, 200, payload);
  } catch (e) {
    return send(res, 200, { ok: false, error: String(e?.message || e) });
  }
}

async function handleWalletTrades(res, wallet) {
  if (!isAddr(wallet)) return send(res, 400, { ok: false, error: "valid wallet address required" });
  try {
    const rows = await dbSelect(
      "user_trades",
      `select=wallet_address,mint,symbol,side,token_amount,sol_amount,usd_amount,fee_usd,tx_signature,created_at&wallet_address=eq.${encodeURIComponent(wallet)}&order=created_at.desc&limit=50`
    );
    return send(res, 200, { ok: true, wallet, count: rows.length, trades: rows });
  } catch (e) {
    return send(res, 200, { ok: false, error: String(e?.message || e) });
  }
}

async function handleMine(req, res) {
  const user = await verifySupabaseUser(req);
  if (!user) return send(res, 401, { ok: false, error: "sign in required" });
  try {
    const rows = await dbSelect(
      "user_trades",
      `select=wallet_address,mint,symbol,side,token_amount,sol_amount,usd_amount,fee_usd,tx_signature,created_at&user_id=eq.${encodeURIComponent(user.id)}&order=created_at.desc&limit=100`
    );
    return send(res, 200, { ok: true, count: rows.length, trades: rows });
  } catch (e) {
    return send(res, 200, { ok: false, error: String(e?.message || e) });
  }
}

export default async function handler(req, res) {
  const url = new URL(req.url, "http://x");
  if (req.method === "POST") return handleRecord(req, res);
  if (req.method !== "GET") return send(res, 405, { ok: false, error: "method" });
  const wallet = (url.searchParams.get("wallet") || "").trim();
  if (url.searchParams.get("mine") === "1") return handleMine(req, res);
  if (wallet) return handleWalletTrades(res, wallet);
  // Default: the volume leaderboard (30d ranked, all-time alongside).
  return handleVolume(res);
}

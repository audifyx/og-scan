// OG DEX — referral leaderboard aggregate.
//
// The referral_earnings ledger is RLS-gated per user, so the app cannot
// aggregate it client-side. This endpoint reads the
// referral_leaderboard_view (owner-privilege view: aggregates + public
// profile fields only — no wallet addresses, emails, or per-referee
// detail) and returns the ranked board, cached 5 min in Storage KV.
import { send, cache, dbSelect, kvGet, kvPut } from "../_lib.js";

const CACHE_KEY = "referrals/leaderboard-v1.json";
const TTL_MS = 5 * 60 * 1000;

export default async function handler(req, res) {
  if (req.method !== "GET") return send(res, 405, { ok: false, error: "method" });
  const url = new URL(req.url, "http://x");
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 50, 1), 100);
  const cached = await kvGet(CACHE_KEY).catch(() => null);
  if (cached && Date.now() - (cached.at || 0) < TTL_MS && limit <= 50) {
    cache(res, 60, 300);
    return send(res, 200, { ...cached, cached: true });
  }
  try {
    const rows = await dbSelect(
      "referral_leaderboard_view",
      `select=*&order=invite_count.desc,total_earnings.desc&limit=${limit}`
    );
    const entries = (rows || []).map((r, i) => ({
      rank: i + 1,
      referrer_id: r.referrer_id,
      username: r.referrer_username || null,
      display_name: r.referrer_display_name || null,
      avatar_url: r.referrer_avatar_url || null,
      invite_count: Number(r.invite_count) || 0,
      total_earnings: Number(r.total_earnings) || 0,
      total_fees_generated: Number(r.total_fees_generated) || 0,
      earning_events: Number(r.earning_events) || 0,
    }));
    const payload = { ok: true, at: Date.now(), count: entries.length, entries };
    if (limit <= 50) await kvPut(CACHE_KEY, payload).catch(() => {});
    cache(res, 60, 300);
    return send(res, 200, payload);
  } catch (e) {
    return send(res, 200, { ok: false, error: String(e?.message || e) });
  }
}

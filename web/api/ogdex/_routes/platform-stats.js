// Platform-wide stats endpoint — returns a mix of live and static values.
// Live: tokenCount (from ogdex_listings), daysLive (from launch date).
// Static fallbacks: activeUsers, telegram, xFollowers, volume.
import { send, cache, dbSelect } from "../_lib.js";

// OGS token pair created on Dexscreener: 2026-05-07
const LAUNCH_MS = new Date("2026-05-07T00:00:00Z").getTime();

export default async function handler(_req, res) {
  cache(res, 120, 600); // 2-min fresh, 10-min stale-while-revalidate

  let tokenCount = 847;
  try {
    const rows = await dbSelect("ogdex_listings", "status=eq.approved&select=id");
    if (Array.isArray(rows) && rows.length > 0) tokenCount = rows.length;
  } catch { /* keep fallback */ }

  const daysLive = Math.max(1, Math.floor((Date.now() - LAUNCH_MS) / 86_400_000));

  return send(res, 200, {
    ok: true,
    activeUsers: 55,        // static — no server-side analytics infra yet
    telegram: 185,          // static — needs Telegram Bot API token
    xFollowers: 182,        // static — needs X/Twitter API
    tokenCount,             // live from DB
    volume: "$2.4M",        // static — platform aggregate; update manually or wire DexScreener later
    daysLive,               // live — calculated from OGS token launch date
  });
}

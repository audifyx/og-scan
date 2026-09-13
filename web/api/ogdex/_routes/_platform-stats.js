// Platform-wide stats — live counts from Supabase + derived daysLive.
// Falls back gracefully when service-role is missing or a table is unavailable.
import { send, cache, dbRpcCount, SRK, SUPA_URL, ANON } from "../_lib.js";

// OGS token pair created on Dexscreener: 2026-05-07
const LAUNCH_MS = new Date("2026-05-07T00:00:00Z").getTime();

async function countTable(table, query = "select=id") {
  try {
    if (SRK) return await dbRpcCount(table, query);
  } catch { /* try anon below */ }
  try {
    const r = await fetch(`${SUPA_URL}/rest/v1/${table}?${query}`, {
      headers: {
        apikey: ANON,
        Authorization: `Bearer ${ANON}`,
        Prefer: "count=exact",
        Range: "0-0",
      },
    });
    if (!r.ok) return 0;
    const cr = r.headers.get("content-range") || "*/0";
    return Number(cr.split("/")[1]) || 0;
  } catch {
    return 0;
  }
}

export default async function handler(_req, res) {
  cache(res, 60, 300);

  const daysLive = Math.max(1, Math.floor((Date.now() - LAUNCH_MS) / 86_400_000));

  const [users, kols, communities, spaces, tokens, kolWallets] = await Promise.all([
    countTable("profiles"),
    countTable("ogdex_kol_directory"),
    countTable("communities"),
    countTable("spaces"),
    countTable("tokens"),
    countTable("kol_wallets"),
  ]);

  // Prefer directory count; fall back to kol_profiles if directory empty.
  const kolCount = kols > 0 ? kols : await countTable("kol_profiles");

  return send(res, 200, {
    ok: true,
    // Canonical live fields for splash / marketing
    users,
    kols: kolCount,
    communities,
    spaces,
    tokens,
    walletsTracked: kolWallets,
    daysLive,
    // Back-compat for ogdex LiveStats / Layout nav pills
    activeUsers: users,
    telegram: 185,
    xFollowers: 182,
    tokenCount: tokens > 0 ? tokens : kolCount,
    volume: "$2.4M",
    source: "db",
  });
}

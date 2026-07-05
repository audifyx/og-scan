import type { VercelRequest, VercelResponse } from "@vercel/node";

// GET /api/kol/new-launches?minAgeHours=5&maxAgeHours=10&limit=10
// New Solana token launches, filtered to an age window (default 5-10h old),
// i.e. launches that SURVIVED their first hours — unique signal vs. raw feeds.
// Sources: Supabase snapshot table (if cron has been running) -> GeckoTerminal new pools.
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "https://ffjipnkhcebjvttliptb.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

export type Launch = {
  poolAddress: string; mint: string | null; symbol: string; name: string;
  dex: string | null; createdAt: string | null; ageHours: number | null;
  priceUsd: number | null; fdvUsd: number | null; volume24h: number | null;
  priceChangeH1: number | null; buys24h: number | null; sells24h: number | null;
};

function parsePool(p: any): Launch | null {
  const a = p?.attributes;
  if (!a) return null;
  const created = a.pool_created_at ? new Date(a.pool_created_at) : null;
  const mint = String(p?.relationships?.base_token?.data?.id || "").replace(/^solana_/, "") || null;
  const nameParts = String(a.name || "").split("/");
  return {
    poolAddress: String(a.address || p.id || ""),
    mint,
    symbol: nameParts[0]?.trim() || "?",
    name: String(a.name || ""),
    dex: String(p?.relationships?.dex?.data?.id || "").replace(/^solana_/, "") || null,
    createdAt: created ? created.toISOString() : null,
    ageHours: created ? Number(((Date.now() - created.getTime()) / 3_600_000).toFixed(2)) : null,
    priceUsd: a.base_token_price_usd != null ? Number(a.base_token_price_usd) : null,
    fdvUsd: a.fdv_usd != null ? Number(a.fdv_usd) : null,
    volume24h: a?.volume_usd?.h24 != null ? Number(a.volume_usd.h24) : null,
    priceChangeH1: a?.price_change_percentage?.h1 != null ? Number(a.price_change_percentage.h1) : null,
    buys24h: a?.transactions?.h24?.buys != null ? Number(a.transactions.h24.buys) : null,
    sells24h: a?.transactions?.h24?.sells != null ? Number(a.transactions.h24.sells) : null,
  };
}

export async function fetchGeckoNewPools(pages = 5): Promise<Launch[]> {
  const out: Launch[] = [];
  for (let page = 1; page <= pages; page++) {
    const r = await fetch(`https://api.geckoterminal.com/api/v2/networks/solana/new_pools?page=${page}`, {
      headers: { Accept: "application/json" },
    });
    if (!r.ok) break;
    const j = (await r.json()) as any;
    const pools: any[] = j?.data || [];
    if (!pools.length) break;
    for (const p of pools) {
      const l = parsePool(p);
      if (l) out.push(l);
    }
  }
  return out;
}

export async function fetchSnapshotLaunches(minAgeHours: number, maxAgeHours: number): Promise<Launch[]> {
  if (!SERVICE_KEY) return [];
  const now = Date.now();
  const newest = new Date(now - minAgeHours * 3_600_000).toISOString();
  const oldest = new Date(now - maxAgeHours * 3_600_000).toISOString();
  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/kol_launch_radar?pool_created_at=gte.${oldest}&pool_created_at=lte.${newest}&order=pool_created_at.desc&limit=200`,
    { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
  );
  if (!r.ok) return [];
  const rows: any[] = await r.json();
  const out: Launch[] = [];
  // Re-check live stats for survivors (still trading = survived)
  for (const chunk of chunked(rows.slice(0, 60), 30)) {
    const addrs = chunk.map((r2) => r2.pool_address).join(",");
    try {
      const lr = await fetch(`https://api.geckoterminal.com/api/v2/networks/solana/pools/multi/${addrs}`, { headers: { Accept: "application/json" } });
      if (!lr.ok) continue;
      const lj = (await lr.json()) as any;
      for (const p of lj?.data || []) {
        const l = parsePool(p);
        if (l) out.push(l);
      }
    } catch { /* skip chunk */ }
  }
  return out;
}

function chunked<T>(arr: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

export async function getLaunches(minAgeHours: number, maxAgeHours: number, limit: number) {
  // Preferred: snapshot table (true 5-10h survivors, populated by hourly cron)
  let launches = await fetchSnapshotLaunches(minAgeHours, maxAgeHours).catch(() => [] as Launch[]);
  let source = "snapshot";
  if (!launches.length) {
    // Fallback: live new-pools feed filtered by age (covers as far back as the feed goes)
    const all = await fetchGeckoNewPools(10);
    launches = all.filter((l) => l.ageHours != null && l.ageHours >= minAgeHours && l.ageHours <= maxAgeHours);
    source = "live";
    if (!launches.length) {
      // Last resort: oldest available new pools with real volume, so the digest is never empty
      launches = all.filter((l) => (l.volume24h || 0) > 1000).sort((a, b) => (b.ageHours || 0) - (a.ageHours || 0));
      source = "live-recent";
    }
  }
  launches.sort((a, b) => (b.volume24h || 0) - (a.volume24h || 0));
  return { launches: launches.slice(0, limit), source };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const minAge = Math.max(0, Number(req.query.minAgeHours) || 5);
  const maxAge = Math.max(minAge + 0.5, Number(req.query.maxAgeHours) || 10);
  const limit = Math.max(1, Math.min(Number(req.query.limit) || 10, 50));
  try {
    const { launches, source } = await getLaunches(minAge, maxAge, limit);
    res.setHeader("Cache-Control", "s-maxage=120, stale-while-revalidate=300");
    return res.status(200).json({ ok: true, source, window: { minAgeHours: minAge, maxAgeHours: maxAge }, count: launches.length, launches });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
}

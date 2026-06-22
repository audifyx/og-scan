// pumpfun-migrations — recent pump.fun token graduations/migrations.
// Source: Bitquery EAP (pump.fun `migrate` instruction). Enriched with
// DexScreener (no key) for symbol/name/price/mc/liquidity. Free fallback for
// instant streaming is PumpPortal ws (subscribeMigration) handled elsewhere.
//
// GET/POST -> { migrations: [{ mint, symbol, name, priceUsd, marketCap,
//   liquidityUsd, image, migratedAt, signature, dexUrl }], count, source }

const PUMP_PROGRAM = "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

let cachedToken: { token: string; exp: number } | null = null;
async function bitqueryToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.exp > now + 60_000) return cachedToken.token;
  const id = Deno.env.get("BITQUERY_CLIENT_ID") || "";
  const secret = Deno.env.get("BITQUERY_CLIENT_SECRET") || "";
  const res = await fetch("https://oauth2.bitquery.io/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=client_credentials&client_id=${encodeURIComponent(id)}&client_secret=${encodeURIComponent(secret)}&scope=api`,
  });
  const raw = await res.text();
  let j: any; try { j = JSON.parse(raw); } catch { throw new Error("Bitquery auth non-JSON: " + raw.slice(0, 150)); }
  if (!j.access_token) throw new Error("Bitquery auth failed: " + JSON.stringify(j).slice(0, 200));
  cachedToken = { token: j.access_token, exp: now + (j.expires_in || 600) * 1000 };
  return j.access_token;
}

async function fetchMigrations(sinceISO: string, limit: number) {
  const token = await bitqueryToken();
  const query = `query ($since: DateTime, $limit: Int) {
    Solana {
      Instructions(
        where: {
          Instruction: { Program: { Address: { is: "${PUMP_PROGRAM}" }, Method: { is: "migrate" } } }
          Transaction: { Result: { Success: true } }
          Block: { Time: { since: $since } }
        }
        orderBy: { descending: Block_Time }
        limit: { count: $limit }
      ) {
        Block { Time }
        Transaction { Signature }
        Instruction { Accounts { Address } }
      }
    }
  }`;
  const res = await fetch("https://streaming.bitquery.io/eap", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ query, variables: { since: sinceISO, limit } }),
  });
  const raw = await res.text();
  let j: any; try { j = JSON.parse(raw); } catch { throw new Error("Bitquery query non-JSON (likely quota/points): " + raw.slice(0, 150)); }
  const rows = j?.data?.Solana?.Instructions || [];
  const seen = new Set<string>();
  const out: any[] = [];
  for (const r of rows) {
    const accts: string[] = (r.Instruction?.Accounts || []).map((a: any) => a.Address);
    // pump.fun mints always end in "pump"; fallback to the canonical mint slot.
    const mint = accts.find((a) => a.endsWith("pump")) || accts[2];
    if (!mint || seen.has(mint)) continue;
    seen.add(mint);
    out.push({ mint, migratedAt: r.Block?.Time, signature: r.Transaction?.Signature });
  }
  return out;
}

async function enrich(migs: any[]) {
  // DexScreener batch endpoint accepts up to 30 comma-separated addresses.
  for (let i = 0; i < migs.length; i += 30) {
    const batch = migs.slice(i, i + 30);
    try {
      const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${batch.map((m) => m.mint).join(",")}`);
      const j = await res.json();
      const pairs: any[] = j?.pairs || [];
      const byMint: Record<string, any> = {};
      for (const p of pairs) {
        const addr = p?.baseToken?.address;
        if (!addr) continue;
        const cur = byMint[addr];
        if (!cur || (p?.liquidity?.usd || 0) > (cur?.liquidity?.usd || 0)) byMint[addr] = p;
      }
      for (const m of batch) {
        const p = byMint[m.mint];
        if (!p) continue;
        m.symbol = p.baseToken?.symbol || null;
        m.name = p.baseToken?.name || null;
        m.priceUsd = p.priceUsd ? Number(p.priceUsd) : null;
        m.marketCap = p.marketCap ?? p.fdv ?? null;
        m.liquidityUsd = p.liquidity?.usd ?? null;
        m.volume24h = p.volume?.h24 ?? null;
        m.image = p.info?.imageUrl || null;
        m.dexUrl = p.url || `https://dexscreener.com/solana/${m.mint}`;
      }
    } catch { /* ignore batch errors */ }
  }
  for (const m of migs) if (!m.dexUrl) m.dexUrl = `https://dexscreener.com/solana/${m.mint}`;
  return migs;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const url = new URL(req.url);
    let hours = 24, limit = 100;
    if (req.method === "POST") {
      const b = await req.json().catch(() => ({}));
      hours = Number(b.hours) || 24;
      limit = Math.min(Number(b.limit) || 100, 200);
    } else {
      hours = Number(url.searchParams.get("hours")) || 24;
      limit = Math.min(Number(url.searchParams.get("limit")) || 100, 200);
    }
    const since = new Date(Date.now() - hours * 3600_000).toISOString();
    const migs = await fetchMigrations(since, limit);
    await enrich(migs);
    return json({ migrations: migs, count: migs.length, hours, source: "bitquery", generatedAt: new Date().toISOString() });
  } catch (e) {
    // Degrade gracefully so the UI feed never hard-errors (e.g. Bitquery quota/points exhausted).
    return json({ migrations: [], count: 0, source: "unavailable", error: e instanceof Error ? e.message : String(e), generatedAt: new Date().toISOString() }, 200);
  }
});

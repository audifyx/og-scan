import { jup, callFn, send, cache, dbSelect } from "../_lib.js";
import { normToken, num } from "../_normalize.js";
import { CELEB_MINTS, fetchMints } from "../_curated.js";

const CHAINS = ["solana","ethereum","bsc","base","polygon","arbitrum","avalanche","sui","ton"];
const GT_HDR = { Accept: "application/json;version=20230302" };
const STABLES = new Set(["USDC","USDT","SOL","WSOL","JLP","JITOSOL","MSOL","BSOL","JUPSOL","INF","USDS","USDE","PYUSD","EURC","CBBTC","WBTC","HSOL","JUP","ISC","USDH","DAI","BUSD"]);

// ── Deduplication by mint ─────────────────────────────────────────────────────
function dedup(rows) {
  const seen = new Set();
  return rows.filter((r) => {
    const key = r?.mint;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ── Dedup by symbol ticker (pump.fun spam — same name, different mint) ────────
// Keeps the entry with the highest mcap per ticker symbol.
function dedupBySymbol(rows) {
  const map = {};
  for (const r of rows) {
    const key = (r.symbol || r.name || "").toUpperCase().trim();
    if (!key) continue;
    if (!map[key] || (r.mcap ?? 0) > (map[key].mcap ?? 0)) map[key] = r;
  }
  return Object.values(map);
}

// ── Compact formatter ─────────────────────────────────────────────────────────
const compact = (v) => {
  if (v == null) return null;
  if (v >= 1e9) return (v / 1e9).toFixed(1) + "B";
  if (v >= 1e6) return (v / 1e6).toFixed(1) + "M";
  if (v >= 1e3) return (v / 1e3).toFixed(0) + "K";
  return String(Math.round(v));
};

// ── Pump.fun normalizer ───────────────────────────────────────────────────────
function normPump(t) {
  if (!t || !t.mint) return null;
  const complete = !!t.complete;
  const rqr = num(t.real_quote_reserves) || num(t.real_sol_reserves) || 0;
  const bondingPct = complete ? 100 : Math.min(100, Math.round((rqr / 85_000_000_000) * 100));
  const total = num(t.total_supply) || 1_000_000_000;
  const mcap  = num(t.usd_market_cap);
  return {
    mint: t.mint, name: t.name, symbol: t.symbol,
    icon: t.image_uri || t.image || null,
    priceUsd: mcap && total ? mcap / total : null,
    mcap,
    liquidity: null,
    holderCount: num(t.holder_count) || null,
    volume: null, // pump.fun API v3 does not expose volume field
    change24h: null,
    bondingPct,
    complete,
    athMcap: num(t.ath_market_cap) || null,
    createdAt: t.created_timestamp ? new Date(t.created_timestamp).toISOString() : null,
    ageDays: t.created_timestamp ? Math.round((Date.now() - t.created_timestamp) / 864e5) : null,
    lastTrade: t.last_trade_timestamp || null,
    _source: "pumpfun",
  };
}

// ── GeckoTerminal pool normalizer ─────────────────────────────────────────────
function normGecko(item, tokenMap = {}) {
  if (!item) return null;
  const a   = item.attributes || {};
  const rel = item.relationships || {};
  const netId       = rel.network?.data?.id || "solana";
  const baseTokenId = rel.base_token?.data?.id;
  const bt  = tokenMap[baseTokenId] || {};
  const mint = bt.address || null;
  if (!mint) return null;
  const sym  = bt.symbol || (a.name || "").split(" / ")[0].trim() || null;
  return {
    mint, name: bt.name || sym, symbol: sym,
    icon: bt.image_url || null,
    priceUsd:  num(a.base_token_price_usd),
    mcap:      num(a.market_cap_usd ?? a.fdv_usd),
    liquidity: num(a.reserve_in_usd),
    volume:    num(a.volume_usd?.h24),
    change5m:  num(a.price_change_percentage?.m5),
    change1h:  num(a.price_change_percentage?.h1),
    change24h: num(a.price_change_percentage?.h24),
    holderCount: null,
    chain: netId, poolAddress: item.id || null,
    createdAt: a.pool_created_at || null,
    _source: "gecko",
  };
}

// ── Pump.fun API fetch ────────────────────────────────────────────────────────
async function fetchPump(sortBy, limit = 200, filterFn = null) {
  const url = `https://frontend-api-v3.pump.fun/coins?limit=${limit}&offset=0&sort=${sortBy}&order=DESC&includeNsfw=false`;
  try {
    const resp = await fetch(url, { headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0" } });
    if (!resp.ok) throw new Error(`status ${resp.status}`);
    const data = await resp.json();
    const coins = Array.isArray(data) ? data : (data.coins || []);
    return filterFn ? coins.filter(filterFn) : coins;
  } catch (e) {
    console.error("pump.fun fetch failed:", e.message);
    return [];
  }
}

// ── GeckoTerminal trending pages ─────────────────────────────────────────────
async function fetchGeckoTrending(network, pages = 2) {
  const allData = [];
  const tokenMap = {};
  const fetches = Array.from({ length: pages }, (_, i) =>
    fetch(`https://api.geckoterminal.com/api/v2/networks/${network}/trending_pools?page=${i + 1}&include=base_token`, { headers: GT_HDR })
      .then(r => r.ok ? r.json() : null).catch(() => null)
  );
  const results = await Promise.all(fetches);
  for (const gt of results) {
    if (!gt) continue;
    for (const inc of (gt.included || [])) if (inc.type === "token") tokenMap[inc.id] = inc.attributes;
    allData.push(...(gt.data || []));
  }
  return { data: allData, tokenMap };
}

// ── GeckoTerminal new pools ───────────────────────────────────────────────────
async function fetchGeckoNew(network) {
  const tokenMap = {};
  const r = await fetch(`https://api.geckoterminal.com/api/v2/networks/${network}/new_pools?page=1&include=base_token`, { headers: GT_HDR }).then(r => r.ok ? r.json() : null).catch(() => null);
  if (!r) return { data: [], tokenMap };
  for (const inc of (r.included || [])) if (inc.type === "token") tokenMap[inc.id] = inc.attributes;
  return { data: r.data || [], tokenMap };
}

// ── DexScreener pumpswap/raydium migrated pairs ───────────────────────────────
async function fetchDexMigrated(limit) {
  try {
    const r = await fetch(
      `https://api.dexscreener.com/latest/dex/search?q=pumpswap&chainId=solana`,
      { headers: { Accept: "application/json" } }
    );
    const d = await r.json();
    return dedup(
      (d.pairs || [])
        .filter(p => p.chainId === "solana" && ["pumpswap","raydium"].includes(p.dexId) && (p.volume?.h24 ?? 0) >= 500)
        .sort((a, b) => (b.volume?.h24 ?? 0) - (a.volume?.h24 ?? 0))
        .slice(0, limit)
        .map(p => ({
          mint: p.baseToken?.address || null,
          name: p.baseToken?.name || null,
          symbol: p.baseToken?.symbol || null,
          icon: p.info?.imageUrl || null,
          priceUsd: num(p.priceUsd),
          mcap: num(p.marketCap),
          liquidity: num(p.liquidity?.usd),
          volume: num(p.volume?.h24),
          change24h: num(p.priceChange?.h24),
          change1h: num(p.priceChange?.h1),
          change5m: num(p.priceChange?.m5),
          holderCount: null,
          bondingPct: 100, complete: true,
          athMcap: null, _source: "dexscreener",
        }))
        .filter(r => r.mint)
    );
  } catch { return []; }
}

// ── Handler ───────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  const url      = new URL(req.url, "http://x");
  const type     = url.searchParams.get("type") || "trending";
  const interval = url.searchParams.get("interval") || "24h";
  const limit    = Math.min(Number(url.searchParams.get("limit")) || 100, 200);
  const chain    = (url.searchParams.get("chain") || "solana").toLowerCase();
  cache(res, 15, 45);

  try {
    let rows = [];

    // ── Multi-chain (non-Solana via GeckoTerminal) ────────────────────────────
    if (chain !== "solana" && CHAINS.includes(chain)) {
      const netMap = {
        ethereum: "eth", bsc: "bsc", base: "base", polygon: "polygon_pos",
        arbitrum: "arbitrum", avalanche: "avax", sui: "sui-network", ton: "ton",
      };
      const net = netMap[chain] || chain;
      // Fetch 4 pages of trending + 2 pages of new pools for volume variety
      const [trend, newP] = await Promise.all([
        fetchGeckoTrending(net, 4),
        fetchGeckoNew(net),
      ]);
      const tokenMap = { ...trend.tokenMap, ...newP.tokenMap };
      rows = dedup(
        [...trend.data, ...newP.data]
          .map(p => normGecko(p, tokenMap))
          .filter(Boolean)
          .filter(r => (r.volume ?? 0) >= 100)
          .sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0))
      ).slice(0, limit);
      return send(res, 200, { type, interval, chain, count: rows.length, rows });
    }

    // ── Pump.fun: Unbonded (still on bonding curve, recently traded) ──────────
    if (type === "unbonded") {
      const coins = await fetchPump("last_trade_timestamp", 200);
      rows = dedup(
        coins
          .filter(c => !c.complete && (c.usd_market_cap || 0) >= 100)
          .map(normPump)
          .filter(Boolean)
          .sort((a, b) => (b.bondingPct ?? 0) - (a.bondingPct ?? 0))
      ).slice(0, limit);

    // ── Pump.fun: Migrated (graduated — DexScreener has real volume) ──────────
    } else if (type === "migrated") {
      // Primary: DexScreener pumpswap/raydium (has real 24h volume)
      const dexRows = await fetchDexMigrated(100);
      // Supplement: GeckoTerminal Solana trending (more variety)
      const { data: gtData, tokenMap } = await fetchGeckoTrending("solana", 3);
      const gtRows = gtData.map(p => normGecko(p, tokenMap)).filter(Boolean).filter(r => (r.volume ?? 0) >= 500);
      rows = dedup([...dexRows, ...gtRows]).sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0)).slice(0, limit);
      // Last fallback: pump.fun complete coins
      if (rows.length < 20) {
        const pumpCoins = await fetchPump("last_trade_timestamp", 200, c => c.complete === true);
        const pumpRows  = pumpCoins.map(normPump).filter(Boolean).filter(r => (r.mcap ?? 0) >= 1000);
        rows = dedup([...rows, ...pumpRows]).sort((a, b) => (b.volume ?? b.mcap ?? 0) - (a.volume ?? a.mcap ?? 0)).slice(0, limit);
      }

    // ── Pump.fun: New Pairs (newest coins, no symbol spam, must have activity) ──
    } else if (type === "newpairs") {
      // ── Fetch pump.fun newest (created in last 24h, both bonded + unbonded) ──
      const cutoff24h = Date.now() - 86_400_000;
      const coins = await fetchPump("created_timestamp", 200);
      const todayCoins = coins.filter(c =>
        (c.created_timestamp ?? 0) >= cutoff24h &&
        (c.usd_market_cap || 0) >= 10_000
      );
      const normCoins = todayCoins.map(normPump).filter(Boolean);

      // ── Batch-enrich with DexScreener for real volume.h24 ─────────────────
      // DexScreener accepts up to 30 addresses per call
      const CHUNK = 30;
      const dexMap = {};
      for (let i = 0; i < normCoins.length; i += CHUNK) {
        const chunk  = normCoins.slice(i, i + CHUNK);
        const addrs  = chunk.map(c => c.mint).join(",");
        try {
          const d = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${addrs}`, {
            headers: { Accept: "application/json" },
          }).then(r => r.ok ? r.json() : null).catch(() => null);
          for (const p of (d?.pairs || [])) {
            const addr = p.baseToken?.address;
            if (!addr) continue;
            const key = addr.toLowerCase();
            const vol = p.volume?.h24 ?? 0;
            if (!dexMap[key] || vol > (dexMap[key].volume ?? 0)) {
              dexMap[key] = {
                volume:   vol,
                priceUsd: p.priceUsd ? parseFloat(p.priceUsd) : null,
                mcap:     p.marketCap ? parseFloat(p.marketCap) : null,
                change24h: p.priceChange?.h24 ? parseFloat(p.priceChange.h24) : null,
                liquidity: p.liquidity?.usd ?? null,
              };
            }
          }
        } catch {}
      }

      // Merge DexScreener data, then filter: volume ≥ $10k
      const enriched = normCoins.map(c => {
        const dx = dexMap[c.mint.toLowerCase()];
        if (!dx) return c;
        return {
          ...c,
          volume:   dx.volume   ?? c.volume,
          priceUsd: dx.priceUsd ?? c.priceUsd,
          mcap:     dx.mcap     ?? c.mcap,
          change24h: dx.change24h ?? c.change24h,
          liquidity: dx.liquidity ?? c.liquidity,
        };
      }).filter(c => (c.volume ?? 0) >= 10_000 && (c.mcap ?? 0) >= 10_000);

      rows = dedupBySymbol(dedup(enriched))
        .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
        .slice(0, limit);

    // ── Moonshot (Jupiter moonshot-verified tag) ──────────────────────────────
    } else if (type === "moonshot") {
      const data = await jup(`/tokens/v2/toptraded/24h?limit=500`);
      rows = (Array.isArray(data) ? data : [])
        .filter(t => Array.isArray(t.tags) && t.tags.some(tag => String(tag).toLowerCase().includes("moonshot")))
        .map(t => { const r = normToken(t, "24h"); if (r) r.isMoonshot = true; return r; })
        .filter(Boolean)
        .filter(r => (r.volume ?? 0) >= 500);
      rows = dedup(rows).sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0));
      // Supplement with GeckoTerminal new Solana pools
      if (rows.length < 30) {
        const { data: gtData, tokenMap } = await fetchGeckoNew("solana");
        const gtRows = gtData.map(p => normGecko(p, tokenMap)).filter(Boolean).filter(r => (r.volume ?? 0) >= 100);
        rows = dedup([...rows, ...gtRows]).sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0));
      }
      rows = rows.slice(0, limit);

    // ── FOMO: 1h biggest spikes, must have real volume ────────────────────────
    } else if (type === "fomo") {
      const data = await jup(`/tokens/v2/toptraded/1h?limit=500`);
      rows = (Array.isArray(data) ? data : [])
        .filter(t => !STABLES.has(String(t.symbol || "").toUpperCase()))
        .map(t => normToken(t, "1h"))
        .filter(Boolean)
        .filter(r => (r.liquidity ?? 0) >= 1000 && (r.volume ?? 0) >= 500)
        .sort((a, b) => (b.change1h ?? -999) - (a.change1h ?? -999));
      rows = dedup(rows).slice(0, limit);

    // ── Jupiter: verified tokens with strong organic score ────────────────────
    } else if (type === "jupiter") {
      const data = await jup(`/tokens/v2/toptraded/24h?limit=500`);
      rows = (Array.isArray(data) ? data : [])
        .filter(t => (t.isVerified || (t.organicScore ?? 0) > 40) && !STABLES.has(String(t.symbol || "").toUpperCase()))
        .map(t => { const r = normToken(t, "24h"); if (r) r.isVerified = !!t.isVerified; return r; })
        .filter(Boolean)
        .filter(r => (r.volume ?? 0) >= 1000)
        .sort((a, b) => (b.organicScore ?? 0) - (a.organicScore ?? 0));
      rows = dedup(rows).slice(0, limit);

    // ── New (recently listed on Jupiter) ─────────────────────────────────────
    } else if (type === "new") {
      const data = await jup(`/tokens/v2/recent?limit=${limit}`);
      rows = dedup((Array.isArray(data) ? data : []).map(t => normToken(t, interval)).filter(Boolean));

    // ── OG: established verified Solana tokens ────────────────────────────────
    } else if (type === "og") {
      const data = await jup(`/tokens/v2/tag?query=verified`);
      rows = (Array.isArray(data) ? data : [])
        .filter(t => !STABLES.has(String(t.symbol || "").toUpperCase()) && (t.mcap ?? 0) > 100_000)
        .map(t => { const r = normToken(t, interval); if (r) r.isVerified = true; return r; })
        .filter(Boolean);
      rows = dedup(rows).sort((a, b) => (b.mcap ?? 0) - (a.mcap ?? 0)).slice(0, 300);

    // ── Celebrity tokens ──────────────────────────────────────────────────────
    } else if (type === "celebrity") {
      rows = await fetchMints(CELEB_MINTS);
      rows = dedup(rows.sort((a, b) => (b.mcap ?? 0) - (a.mcap ?? 0)));

    // ── Runners: biggest 24h gainers with real liquidity ─────────────────────
    } else if (type === "runners") {
      const data = await jup(`/tokens/v2/toptraded/24h?limit=500`);
      rows = (Array.isArray(data) ? data : [])
        .filter(t => !STABLES.has(String(t.symbol || "").toUpperCase()))
        .map(t => normToken(t, "24h"))
        .filter(Boolean)
        .filter(r => (r.liquidity ?? 0) >= 5000 && (r.volume ?? 0) >= 1000);
      rows = dedup(rows).sort((a, b) => (b.change24h ?? -999) - (a.change24h ?? -999)).slice(0, limit);

    // ── Organic: high organic score tokens ────────────────────────────────────
    } else if (type === "organic") {
      const data = await jup(`/tokens/v2/toporganicscore/${interval}?limit=${limit}`);
      rows = dedup((Array.isArray(data) ? data : []).map(t => normToken(t, interval)).filter(Boolean));

    // ── KOL picks: tokens most bought by tracked KOLs ─────────────────────────
    } else if (type === "kols") {
      try {
        // Aggregate last 48h KOL buys from kol_feed, count per mint
        const feedRows = await dbSelect("ogdex_kol_feed",
          `select=token_out,symbol_out,price_usd,amount_out,tx_timestamp,name,kol_id&tx_type=eq.buy&order=tx_timestamp.desc&limit=500`
        );
        const mintCounts = {};
        const mintMeta   = {};
        const cutoff = Date.now() - 48 * 3600 * 1000;
        for (const r of feedRows) {
          const ts = r.tx_timestamp ? new Date(r.tx_timestamp).getTime() : 0;
          if (ts < cutoff || !r.token_out) continue;
          mintCounts[r.token_out] = (mintCounts[r.token_out] || 0) + 1;
          if (!mintMeta[r.token_out]) mintMeta[r.token_out] = { symbol: r.symbol_out, priceUsd: r.price_usd };
        }
        const topMints = Object.entries(mintCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, limit)
          .map(([mint, count]) => ({ mint, kolBuys: count, ...mintMeta[mint] }));
        if (!topMints.length) throw new Error("no kol feed data");

        // ── Enrich: Jupiter toptraded (price, volume, mcap, changes) ──────────
        const jupData = await jup(`/tokens/v2/toptraded/24h?limit=500`).catch(() => []);
        const jupMap  = {};
        for (const t of (Array.isArray(jupData) ? jupData : [])) jupMap[t.id || t.mint] = t;

        // ── Enrich: GeckoTerminal multi-token (name, symbol, icon fallback) ───
        // Batch in chunks of 25 — GeckoTerminal limit per request
        const missedMints = topMints.filter(t => !jupMap[t.mint]).map(t => t.mint);
        const gtMeta = {};
        if (missedMints.length > 0) {
          const chunks = [];
          for (let i = 0; i < missedMints.length; i += 25) chunks.push(missedMints.slice(i, i + 25));
          const batches = await Promise.all(
            chunks.map(chunk =>
              fetch(`https://api.geckoterminal.com/api/v2/networks/solana/tokens/multi/${chunk.join(",")}`, { headers: GT_HDR })
                .then(r => r.ok ? r.json() : null).catch(() => null)
            )
          );
          for (const batch of batches) {
            for (const item of (batch?.data || [])) {
              const a = item.attributes || {};
              if (a.address) gtMeta[a.address] = {
                symbol: a.symbol || null,
                name: a.name || null,
                icon: a.image_url || null,
                priceUsd: num(a.price_in_usd),
              };
            }
          }
        }

        rows = dedup(topMints.map(t => {
          const jt = jupMap[t.mint];
          const gt = gtMeta[t.mint] || {};
          // Prefer Jupiter (has full market data), supplement with GeckoTerminal for missing icon/meta
          if (jt) {
            const r = normToken(jt, "24h");
            if (r) {
              r.kolBuys = t.kolBuys;
              if (!r.icon && gt.icon) r.icon = gt.icon;
              return r;
            }
          }
          // GeckoTerminal metadata (no Jupiter entry)
          if (gt.symbol || gt.name) {
            return {
              mint: t.mint,
              symbol: gt.symbol || t.symbol || null,
              name: gt.name || t.symbol || null,
              icon: gt.icon || null,
              priceUsd: gt.priceUsd ?? (t.priceUsd ? num(t.priceUsd) : null),
              mcap: null, volume: null, liquidity: null, change24h: null,
              kolBuys: t.kolBuys, _source: "kol",
            };
          }
          // Last resort: bare entry with whatever we have from kol_feed
          return {
            mint: t.mint,
            symbol: t.symbol || t.mint.slice(0, 6) + "…",
            name: t.symbol || null,
            icon: null,
            priceUsd: t.priceUsd ? num(t.priceUsd) : null,
            mcap: null, volume: null, liquidity: null, change24h: null,
            kolBuys: t.kolBuys, _source: "kol",
          };
        }).filter(Boolean)
        // ── Liveness filter: drop dead coins with no price or tiny mcap ────────
        .filter(r => (r.priceUsd ?? 0) > 0 || (r.mcap ?? 0) >= 5000)
        .filter(r => !((r.mcap ?? 0) > 0 && r.mcap < 5000))
      );
      } catch (e) {
        // Fallback: verified tokens with high organic score
        const data = await jup(`/tokens/v2/toptraded/24h?limit=200`);
        rows = dedup((Array.isArray(data) ? data : [])
          .filter(t => (t.organicScore ?? 0) > 50 && !STABLES.has(String(t.symbol || "").toUpperCase()))
          .map(t => normToken(t, "24h")).filter(Boolean)
          .sort((a, b) => (b.organicScore ?? 0) - (a.organicScore ?? 0))
        ).slice(0, limit);
      }

    // ── Multichain (Solana via GeckoTerminal when called directly) ────────────
    } else if (type === "multichain") {
      const { data: gtData, tokenMap } = await fetchGeckoTrending("solana", 3);
      rows = dedup(
        gtData.map(p => normGecko(p, tokenMap)).filter(Boolean).filter(r => (r.volume ?? 0) >= 100)
          .sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0))
      ).slice(0, limit);

    // ── Social trending (inlined — stays within 12-function Hobby limit) ──────
    } else if (type === "social") {
      cache(res, 90, 180);
      const [gecko, cgTrend, dexBoosts] = await Promise.all([
        fetch("https://api.geckoterminal.com/api/v2/networks/solana/trending_pools?page=1&include=base_token", { headers: GT_HDR })
          .then(r => r.ok ? r.json() : null).catch(() => null),
        fetch("https://api.coingecko.com/api/v3/search/trending", { headers: { Accept: "application/json" } })
          .then(r => r.ok ? r.json() : null).catch(() => null),
        fetch("https://api.dexscreener.com/token-boosts/top/v1", { headers: { Accept: "application/json" } })
          .then(r => r.ok ? r.json() : null).catch(() => null),
      ]);
      const items = []; const seen = new Set();
      if (gecko) {
        const tokenMap = {};
        for (const inc of (gecko.included || [])) if (inc.type === "token") tokenMap[inc.id] = inc.attributes;
        for (const pool of (gecko.data || []).slice(0, 15)) {
          const a = pool.attributes || {};
          const bt = tokenMap[pool.relationships?.base_token?.data?.id] || {};
          const mint = bt.address;
          if (!mint || seen.has(mint)) continue;
          seen.add(mint);
          const ch1  = num(a.price_change_percentage?.h1)  || 0;
          const ch24 = num(a.price_change_percentage?.h24) || 0;
          const vol  = num(a.volume_usd?.h24) || 0;
          const liq  = num(a.reserve_in_usd) || 0;
          const reasons = [];
          if (ch1 > 30)           reasons.push(`🚀 +${ch1.toFixed(0)}% in last 1h`);
          else if (ch1 > 10)      reasons.push(`📈 +${ch1.toFixed(0)}% in 1h`);
          if (ch24 > 100)         reasons.push(`🔥 +${ch24.toFixed(0)}% today`);
          else if (ch24 > 30)     reasons.push(`📊 +${ch24.toFixed(0)}% in 24h`);
          if (vol > 5_000_000)    reasons.push(`⚡ $${compact(vol)} volume today`);
          else if (vol > 500_000) reasons.push(`💧 $${compact(vol)} volume`);
          if (liq > 1_000_000)    reasons.push(`🏦 $${compact(liq)} liquidity`);
          reasons.push("🔥 Trending on GeckoTerminal");
          items.push({ mint, symbol: bt.symbol || (a.name||"").split(" / ")[0], name: bt.name || null,
            icon: bt.image_url || null, priceUsd: num(a.base_token_price_usd),
            mcap: num(a.market_cap_usd ?? a.fdv_usd), change1h: ch1, change24h: ch24,
            volume: vol, liquidity: liq, reason: reasons[0] || "🔥 Trending",
            reasons: reasons.slice(0, 3), source: "geckoterminal", chain: "solana", poolAddress: pool.id || null });
        }
      }
      if (cgTrend?.coins) {
        for (const { item } of cgTrend.coins.slice(0, 10)) {
          const solanaMint = item.platforms?.solana || item.data?.platforms?.solana || null;
          if (!solanaMint || seen.has(solanaMint)) continue;
          seen.add(solanaMint);
          const rank = item.market_cap_rank || (item.score ?? 0) + 1 || "?";
          const pct  = item.data?.price_change_percentage_24h?.usd;
          const reasons = [`🏆 #${rank} trending on CoinGecko`,
            pct > 0 ? `📈 +${Number(pct).toFixed(1)}% in 24h` : pct < 0 ? `📉 ${Number(pct).toFixed(1)}% in 24h` : "💬 Community buzz",
            "🔎 High search volume"].filter(Boolean);
          items.push({ mint: solanaMint, symbol: item.symbol, name: item.name,
            icon: item.large || item.thumb || null, priceUsd: num(item.data?.price),
            mcap: null, change24h: pct ? num(pct) : null,
            reason: reasons[0], reasons: reasons.slice(0, 3), source: "coingecko", chain: "solana", cgId: item.id });
        }
      }
      if (Array.isArray(dexBoosts)) {
        for (const b of dexBoosts.filter(b => b.chainId === "solana").slice(0, 8)) {
          const mint = b.tokenAddress;
          if (!mint || seen.has(mint)) continue;
          seen.add(mint);
          items.push({ mint, symbol: null, name: b.description || null,
            icon: b.icon || b.header || null, priceUsd: null, mcap: null,
            reason: "🎯 Trending on DexScreener",
            reasons: ["🎯 Trending on DexScreener", b.description ? `💬 "${b.description.slice(0, 60)}"` : "📢 Boosted project", "👀 High community attention"],
            source: "dexscreener", chain: "solana", url: b.url || null });
        }
      }
      return send(res, 200, { count: items.length, items, sources: ["geckoterminal","coingecko","dexscreener"] });

    // ── Default: Trending (Jupiter primary + GeckoTerminal fallback) ──────────
    } else {
      try {
        const data = await jup(`/tokens/v2/toptraded/${interval}?limit=500`);
        rows = (Array.isArray(data) ? data : [])
          .filter(t => !STABLES.has(String(t.symbol || "").toUpperCase()))
          .map(t => normToken(t, interval))
          .filter(Boolean)
          .filter(r => (r.volume ?? 0) >= 500);
        rows = dedup(rows).sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0));
      } catch {}
      // Always supplement with GeckoTerminal for more variety
      if (rows.length < 50) {
        const { data: gtData, tokenMap } = await fetchGeckoTrending("solana", 2);
        const gtRows = gtData.map(p => normGecko(p, tokenMap)).filter(Boolean).filter(r => (r.volume ?? 0) >= 500);
        rows = dedup([...rows, ...gtRows]).sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0));
      }
      rows = rows.slice(0, limit);
    }

    return send(res, 200, { type, interval, chain, count: rows.length, rows });
  } catch (e) {
    console.error("screener error:", type, e);
    return send(res, 200, { type, rows: [], error: String(e?.message || e) });
  }
}

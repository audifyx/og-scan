import { jup, callFn, send, cache, dbSelect } from "../_lib.js";
import { normToken, num } from "../_normalize.js";
import { CELEB_MINTS, fetchMints } from "../_curated.js";

const CHAINS = ["solana","ethereum","bsc","base","polygon","arbitrum","avalanche","sui","ton","robinhood"];
const GT_HDR = { Accept: "application/json;version=20230302" };
const STABLES = new Set(["USDC","USDT","SOL","WSOL","JLP","JITOSOL","MSOL","BSOL","JUPSOL","INF","USDS","USDE","PYUSD","EURC","CBBTC","WBTC","HSOL","JUP","ISC","USDH","DAI","BUSD","WETH","ETH","WBNB","BNB","WMATIC","MATIC","POL","WPOL","WAVAX","AVAX","WTON","STETH","WSTETH","FDUSD","TUSD","USDD"]);

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
async function gtGet(url) {
  for (let i = 0; i < 2; i++) {
    try { const r = await fetch(url, { headers: GT_HDR }); if (r.ok) return await r.json(); } catch { /* retry */ }
    await new Promise((res) => setTimeout(res, 500));
  }
  return null;
}
async function fetchGeckoTrending(network, pages = 2) {
  const allData = [];
  const tokenMap = {};
  const fetches = Array.from({ length: pages }, (_, i) =>
    gtGet(`https://api.geckoterminal.com/api/v2/networks/${network}/trending_pools?page=${i + 1}&include=base_token`)
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
  const r = await gtGet(`https://api.geckoterminal.com/api/v2/networks/${network}/new_pools?page=1&include=base_token`);
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
      cache(res, 60, 300); // cache hard — GeckoTerminal rate-limits shared IPs
      const [trend, newP] = await Promise.all([
        fetchGeckoTrending(net, 3),
        fetchGeckoNew(net),
      ]);
      const tokenMap = { ...trend.tokenMap, ...newP.tokenMap };
      rows = dedup(
        [...trend.data, ...newP.data]
          .map(p => normGecko(p, tokenMap))
          .filter(Boolean)
          .filter(r => !STABLES.has(String(r.symbol || "").toUpperCase()))
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
          // still on the bonding curve, actively reserved, real size but below the
          // ~graduation cap (mislabeled/migrated coins show huge mcap with 0 reserves)
          .filter(c => !c.complete
            && ((Number(c.real_sol_reserves) || 0) > 0 || (Number(c.real_quote_reserves) || 0) > 0)
            && (c.usd_market_cap || 0) >= 1500 && (c.usd_market_cap || 0) <= 40000)
          .map(normPump)
          .filter(Boolean)
          .filter(r => (r.bondingPct ?? 0) > 0 && (r.bondingPct ?? 0) < 100)
          .sort((a, b) => (b.bondingPct ?? 0) - (a.bondingPct ?? 0))
      ).slice(0, limit);

    // ── Pump.fun: Migrated (graduated — DexScreener has real volume) ──────────
    } else if (type === "migrated") {
      // Migrated = real graduated pools on pumpswap/raydium (DexScreener has the
      // accurate post-migration volume + liquidity). No trending supplement —
      // that polluted the list with non-migrated coins.
      const dexRows = await fetchDexMigrated(150);
      rows = dedup(dexRows)
        .filter(r => (r.liquidity ?? 0) >= 3000 && (r.volume ?? 0) >= 1000)
        .sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0))
        .slice(0, limit);

    // ── Pump.fun: New Pairs (newest coins, no symbol spam, must have activity) ──
    } else if (type === "newpairs") {
      // ── Fetch pump.fun newest (created in last 24h, both bonded + unbonded) ──
      const cutoff24h = Date.now() - 86_400_000;
      const coins = await fetchPump("created_timestamp", 200);
      const todayCoins = coins.filter(c =>
        (c.created_timestamp ?? 0) >= cutoff24h &&
        (c.usd_market_cap || 0) >= 2500 &&
        ((Number(c.real_sol_reserves) || 0) > 0 || c.complete) // active / not abandoned
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
      }).filter(c => (c.mcap ?? 0) >= 2500);

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
      const data = await jup(`/tokens/v2/recent?limit=300`);
      rows = dedup((Array.isArray(data) ? data : [])
        .filter(t => !STABLES.has(String(t.symbol || "").toUpperCase()))
        .map(t => normToken(t, interval)).filter(Boolean)
        // liveness: real price + tradable liquidity (no empty/dead shells)
        .filter(r => (r.priceUsd ?? 0) > 0 && (r.liquidity ?? 0) >= 1500))
        .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
        .slice(0, limit);

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
      const [gecko, cgTrend] = await Promise.all([
        fetch("https://api.geckoterminal.com/api/v2/networks/solana/trending_pools?page=1&include=base_token", { headers: GT_HDR })
          .then(r => r.ok ? r.json() : null).catch(() => null),
        fetch("https://api.coingecko.com/api/v3/search/trending", { headers: { Accept: "application/json" } })
          .then(r => r.ok ? r.json() : null).catch(() => null),
      ]);
      const cand = new Map();
      if (gecko) {
        const tokenMap = {};
        for (const inc of (gecko.included || [])) if (inc.type === "token") tokenMap[inc.id] = inc.attributes;
        for (const pool of (gecko.data || []).slice(0, 20)) {
          const a = pool.attributes || {};
          const bt = tokenMap[pool.relationships?.base_token?.data?.id] || {};
          const mint = bt.address;
          if (!mint || cand.has(mint) || STABLES.has(String(bt.symbol||"").toUpperCase())) continue;
          cand.set(mint, { source: "geckoterminal", name: bt.name || null, symbol: bt.symbol || (a.name||"").split(" / ")[0], icon: bt.image_url || null, poolAddress: pool.id || null });
        }
      }
      if (cgTrend?.coins) {
        for (const { item } of cgTrend.coins.slice(0, 12)) {
          const mint = item.platforms?.solana || item.data?.platforms?.solana || null;
          if (!mint || cand.has(mint)) continue;
          cand.set(mint, { source: "coingecko", name: item.name, symbol: item.symbol, icon: item.large || item.thumb || null, cgRank: item.market_cap_rank || null, cgId: item.id });
        }
      }
      const mints = [...cand.keys()];
      const dexMap = {};
      for (let i = 0; i < mints.length; i += 30) {
        const chunk = mints.slice(i, i + 30);
        try {
          const d = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${chunk.join(",")}`, { headers: { Accept: "application/json" } })
            .then(r => r.ok ? r.json() : null).catch(() => null);
          for (const p of (d?.pairs || [])) {
            const addr = p.baseToken?.address; if (!addr) continue;
            const liq = num(p.liquidity?.usd) || 0;
            if (!dexMap[addr] || liq > (dexMap[addr].liq || 0)) {
              dexMap[addr] = {
                liq, vol: num(p.volume?.h24) || 0, price: num(p.priceUsd),
                mcap: num(p.marketCap) || num(p.fdv) || null,
                ch1: num(p.priceChange?.h1) || 0, ch24: num(p.priceChange?.h24) || 0,
                buys: p.txns?.h24?.buys || 0, sells: p.txns?.h24?.sells || 0,
                icon: p.info?.imageUrl || null, name: p.baseToken?.name || null, symbol: p.baseToken?.symbol || null,
              };
            }
          }
        } catch {}
      }
      const reasonsFor = (e) => {
        const r = [];
        if (e.ch1 > 20) r.push(`\u{1F680} +${e.ch1.toFixed(0)}% in the last hour`);
        else if (e.ch1 > 5) r.push(`\u{1F4C8} +${e.ch1.toFixed(0)}% in 1h`);
        if (e.ch24 >= 100) r.push(`\u{1F525} +${e.ch24.toFixed(0)}% in 24h`);
        else if (e.ch24 >= 20) r.push(`\u{1F4CA} +${e.ch24.toFixed(0)}% in 24h`);
        else if (e.ch24 <= -20) r.push(`\u{1F4C9} ${e.ch24.toFixed(0)}% in 24h`);
        if (e.vol >= 2000000) r.push(`\u26A1 $${compact(e.vol)} traded today`);
        else if (e.vol >= 200000) r.push(`\u{1F4A7} $${compact(e.vol)} volume`);
        const br = e.buys / Math.max(e.sells, 1);
        if (e.buys + e.sells > 50 && br >= 1.5) r.push(`\u{1F7E2} Buyers leading ${br.toFixed(1)}:1`);
        else if (e.buys + e.sells > 50 && br <= 0.66) r.push(`\u{1F534} Sellers in control`);
        if (e.liq >= 1000000) r.push(`\u{1F3E6} Deep $${compact(e.liq)} liquidity`);
        return r;
      };
      const aiFor = (e, sym) => {
        const dir = e.ch24 >= 0 ? `up ${e.ch24.toFixed(0)}%` : `down ${Math.abs(e.ch24).toFixed(0)}%`;
        let s = `${sym || "This token"} is ${dir} over 24h`;
        if (e.vol) s += ` on $${compact(e.vol)} of volume`;
        const br = e.buys / Math.max(e.sells, 1);
        if (e.buys + e.sells > 50) s += br >= 1.3 ? `, buyers outpacing sellers ${br.toFixed(1)}:1` : br <= 0.77 ? `, but sellers are dominating` : `, with balanced flow`;
        s += e.ch1 >= 10 ? " \u2014 momentum is accelerating right now." : e.ch24 >= 50 ? " \u2014 a strong breakout is underway." : e.liq >= 500000 ? " \u2014 liquidity looks healthy." : ".";
        return s;
      };
      const items = [];
      for (const [mint, c] of cand) {
        const e = dexMap[mint];
        if (!e) continue;
        if (e.liq < 15000) continue;
        if (e.vol < 10000) continue;
        if (e.buys + e.sells < 30) continue;
        const sym = c.symbol || e.symbol;
        const reasons = reasonsFor(e);
        if (c.source === "coingecko" && c.cgRank) reasons.push(`\u{1F3C6} #${c.cgRank} trending on CoinGecko`);
        reasons.push(c.source === "coingecko" ? "\u{1F50E} High search interest" : "\u{1F525} Trending on GeckoTerminal");
        const score = (e.ch24 > 0 ? e.ch24 : 0) + Math.min(e.vol / 50000, 60) + (e.ch1 > 0 ? e.ch1 * 1.5 : 0);
        items.push({
          mint, symbol: sym, name: c.name || e.name || null, icon: c.icon || e.icon || null,
          priceUsd: e.price, mcap: e.mcap, change1h: e.ch1, change24h: e.ch24, volume: e.vol, liquidity: e.liq,
          reason: reasons[0] || "Trending", reasons: reasons.slice(0, 3), aiSummary: aiFor(e, sym),
          source: c.source, chain: "solana", poolAddress: c.poolAddress || null, cgId: c.cgId || null, _score: score,
        });
      }
      // Fallback: GeckoTerminal + CoinGecko frequently rate-limit Vercel's shared
      // IPs and return nothing, leaving the social feed empty. Jupiter top-traded
      // is reliable, so seed the feed from it whenever the social sources are thin.
      let usedJup = false;
      if (items.length < 8) {
        try {
          const jdata = await jup(`/tokens/v2/toptraded/24h?limit=100`).catch(() => null);
          const jrows = (Array.isArray(jdata) ? jdata : [])
            .filter((t) => !STABLES.has(String(t.symbol || "").toUpperCase()))
            .map((t) => normToken(t, "24h"))
            .filter(Boolean)
            .filter((r) => (r.volume ?? 0) >= 10000 && (r.liquidity ?? 0) >= 15000 && ((r.numBuys || 0) + (r.numSells || 0)) >= 30);
          const have = new Set(items.map((i) => i.mint));
          for (const r of jrows) {
            if (items.length >= 24) break;
            if (!r.mint || have.has(r.mint)) continue;
            const e = { ch1: r.change1h || 0, ch24: r.change24h || 0, vol: r.volume || 0, liq: r.liquidity || 0, buys: r.numBuys || 0, sells: r.numSells || 0, price: r.priceUsd, mcap: r.mcap };
            const reasons = reasonsFor(e);
            reasons.push("\u{1F525} Top traded on Jupiter");
            const score = (e.ch24 > 0 ? e.ch24 : 0) + Math.min(e.vol / 50000, 60) + (e.ch1 > 0 ? e.ch1 * 1.5 : 0);
            items.push({
              mint: r.mint, symbol: r.symbol, name: r.name, icon: r.icon,
              priceUsd: e.price, mcap: e.mcap, change1h: e.ch1, change24h: e.ch24, volume: e.vol, liquidity: e.liq,
              reason: reasons[0] || "Trending", reasons: reasons.slice(0, 3), aiSummary: aiFor(e, r.symbol),
              source: "jupiter", chain: "solana", poolAddress: null, cgId: null, _score: score,
            });
            have.add(r.mint);
            usedJup = true;
          }
        } catch {}
      }
      items.sort((a, b) => (b._score || 0) - (a._score || 0));
      for (const it of items) delete it._score;
      // Don't let a transient empty result get cached for long.
      if (!items.length) cache(res, 10, 30);
      const sources = ["geckoterminal", "coingecko", "dexscreener"];
      if (usedJup) sources.push("jupiter");
      return send(res, 200, { count: items.length, items, sources });

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

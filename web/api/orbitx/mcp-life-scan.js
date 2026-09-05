/**
 * Grounded meme-coin scan for Life Agents.
 * DexScreener + GeckoTerminal + CoinGecko trending. No invented mints.
 */

const STABLES = new Set([
  "USDC", "USDT", "SOL", "WSOL", "JLP", "JITOSOL", "MSOL", "USDS", "USDE",
  "DAI", "WETH", "ETH", "WBTC", "CBBTC", "JUP",
]);

async function jget(url, timeoutMs = 8000) {
  const r = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.json();
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function compact(n) {
  const v = num(n);
  if (v >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return String(Math.round(v));
}

export function scoreCoin(c, knowledge = []) {
  const liq = num(c.liquidityUsd);
  const vol = num(c.volume1h || c.volume24h);
  const mcap = num(c.mcap);
  const chg = num(c.change1h || c.change24h);
  let s = 0;
  if (liq >= 20_000) s += 12;
  if (liq >= 80_000) s += 8;
  if (vol >= 50_000) s += 14;
  if (vol >= 250_000) s += 10;
  if (mcap > 0 && mcap < 5_000_000) s += 10;
  if (mcap >= 5_000_000 && mcap < 40_000_000) s += 6;
  if (chg >= 8) s += 8;
  if (chg >= 25) s += 6;
  if (c.boosts) s += 10;
  if (c.social) s += 8;
  if (liq < 8_000) s -= 20;
  if (chg < -20) s -= 8;
  const prior = knowledge.filter((k) => k.mint && k.mint === c.mint);
  if (prior.length) s += Math.min(12, prior.length * 3);
  const dumped = prior.some((k) => Number(k.score) < 0);
  if (dumped) s -= 15;
  return s;
}

function fromPair(p, extra = {}) {
  const base = p?.baseToken || {};
  const mint = base.address || extra.mint;
  const symbol = (base.symbol || extra.symbol || "").toUpperCase();
  if (!mint || STABLES.has(symbol)) return null;
  return {
    mint,
    symbol: symbol || mint.slice(0, 6),
    name: base.name || extra.name || symbol,
    chain: p?.chainId || extra.chain || "solana",
    priceUsd: num(p?.priceUsd),
    mcap: num(p?.marketCap || p?.fdv),
    liquidityUsd: num(p?.liquidity?.usd),
    volume1h: num(p?.volume?.h1),
    volume24h: num(p?.volume?.h24),
    change1h: num(p?.priceChange?.h1),
    change24h: num(p?.priceChange?.h24),
    url: p?.url || extra.url || `https://dexscreener.com/solana/${mint}`,
    source: extra.source || "dexscreener",
    boosts: Boolean(extra.boosts),
    social: Boolean(extra.social),
  };
}

async function dexBoosts() {
  try {
    const rows = await jget("https://api.dexscreener.com/token-boosts/top/v1");
    const list = Array.isArray(rows) ? rows : [];
    return list
      .filter((r) => String(r?.chainId || "").toLowerCase() === "solana")
      .slice(0, 12)
      .map((r) => ({
        mint: r.tokenAddress,
        symbol: "",
        name: "",
        chain: "solana",
        url: r.url,
        source: "x-heat",
        boosts: true,
        social: true,
        liquidityUsd: 0,
        volume1h: 0,
        mcap: 0,
      }))
      .filter((c) => c.mint);
  } catch {
    return [];
  }
}

async function geckoTrending() {
  try {
    const d = await jget(
      "https://api.geckoterminal.com/api/v2/networks/solana/trending_pools?page=1&include=base_token",
    );
    const pools = Array.isArray(d?.data) ? d.data : [];
    const tokens = {};
    for (const inc of d?.included || []) {
      if (inc?.type === "token") tokens[inc.id] = inc.attributes || {};
    }
    return pools.slice(0, 16).map((p) => {
      const rel = p?.relationships?.base_token?.data?.id;
      const attr = p?.attributes || {};
      const tok = tokens[rel] || {};
      const mint = String(rel || "").includes("_") ? String(rel).split("_").pop() : tok.address;
      return {
        mint,
        symbol: (tok.symbol || "").toUpperCase(),
        name: tok.name || tok.symbol,
        chain: "solana",
        priceUsd: num(attr.base_token_price_usd),
        mcap: num(attr.market_cap_usd || attr.fdv_usd),
        liquidityUsd: num(attr.reserve_in_usd),
        volume1h: num(attr.volume_usd?.h1),
        volume24h: num(attr.volume_usd?.h24),
        change1h: num(attr.price_change_percentage?.h1),
        url: `https://www.geckoterminal.com/solana/pools/${p.id}`,
        source: "geckoterminal",
        social: true,
      };
    }).filter((c) => c.mint && !STABLES.has(c.symbol));
  } catch {
    return [];
  }
}

async function cgTrending() {
  try {
    const d = await jget("https://api.coingecko.com/api/v3/search/trending");
    const coins = Array.isArray(d?.coins) ? d.coins : [];
    return coins.slice(0, 8).map((c) => {
      const item = c.item || {};
      return {
        mint: item.contract_address || item.id,
        symbol: String(item.symbol || "").toUpperCase(),
        name: item.name,
        chain: "multi",
        mcap: num(item.data?.market_cap),
        url: `https://www.coingecko.com/en/coins/${item.id}`,
        source: "coingecko",
        social: true,
        liquidityUsd: 0,
        volume1h: 0,
      };
    });
  } catch {
    return [];
  }
}

async function hydrateDex(coins) {
  const mints = [...new Set(coins.map((c) => c.mint).filter((m) => m && m.length >= 32))].slice(0, 18);
  if (!mints.length) return coins;
  const byMint = new Map(coins.map((c) => [c.mint, { ...c }]));
  for (let i = 0; i < mints.length; i += 6) {
    const chunk = mints.slice(i, i + 6);
    try {
      const d = await jget(`https://api.dexscreener.com/tokens/v1/solana/${chunk.join(",")}`);
      const pairs = Array.isArray(d) ? d : Array.isArray(d?.pairs) ? d.pairs : [];
      for (const p of pairs) {
        const parsed = fromPair(p, { source: "dexscreener" });
        if (!parsed) continue;
        const prev = byMint.get(parsed.mint) || {};
        byMint.set(parsed.mint, {
          ...prev,
          ...parsed,
          boosts: prev.boosts || parsed.boosts,
          social: prev.social || parsed.social,
        });
      }
    } catch {
      /* keep unhydrated */
    }
  }
  return [...byMint.values()];
}

export async function scanRunningMemes({ sources = [], knowledge = [] } = {}) {
  const wantX = sources.includes("x") || sources.includes("social");
  const [boosts, gecko, cg] = await Promise.all([
    wantX || sources.includes("dexscreener") ? dexBoosts() : Promise.resolve([]),
    sources.includes("geckoterminal") || sources.length === 0 ? geckoTrending() : Promise.resolve([]),
    cgTrending(),
  ]);
  const merged = [...boosts, ...gecko, ...cg];
  const hydrated = await hydrateDex(merged);
  const scored = hydrated
    .map((c) => ({ ...c, apeScore: scoreCoin(c, knowledge) }))
    .sort((a, b) => b.apeScore - a.apeScore);
  const picks = scored.filter((c) => c.apeScore > 0).slice(0, 5);
  return {
    scanned: scored.length,
    picks,
    sourcesUsed: [
      wantX ? "x-heat (DexScreener boosts)" : null,
      "GeckoTerminal trending",
      "CoinGecko trending",
      "DexScreener pairs",
    ].filter(Boolean),
    compact,
  };
}

export function formatPick(p, i) {
  const risk = num(p.liquidityUsd) < 25_000 ? "thin LP" : num(p.change1h) > 40 ? "parabolic" : "watchable";
  return `${i + 1}. **${p.symbol}** (${p.apeScore}) — mcap ${compact(p.mcap)} · liq ${compact(p.liquidityUsd)} · ${risk}\n   \`${p.mint}\`\n   ${p.url}`;
}

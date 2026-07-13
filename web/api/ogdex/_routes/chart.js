import { send, cache } from "../_lib.js";

// OHLCV candles for the token's top liquidity pool, via GeckoTerminal (free, no key).
// Used by the price chart on the coin page. Returns ascending candles for lightweight-charts.
const GT = "https://api.geckoterminal.com/api/v2";

// chain -> GeckoTerminal network id
const NETWORK = {
  solana: "solana", ethereum: "eth", base: "base", bsc: "bsc",
  polygon: "polygon_pos", arbitrum: "arbitrum", avalanche: "avax", ton: "ton", tron: "tron", sui: "sui",
  robinhood: "robinhood", optimism: "optimism", blast: "blast", sonic: "sonic",
  berachain: "berachain", linea: "linea", scroll: "scroll", zksync: "zksync",
  mantle: "mantle", celo: "celo",
};

// app interval -> GeckoTerminal { timeframe, aggregate }
const TF = {
  "1m": { timeframe: "minute", aggregate: 1 },
  "5m": { timeframe: "minute", aggregate: 5 },
  "15m": { timeframe: "minute", aggregate: 15 },
  "1h": { timeframe: "hour", aggregate: 1 },
  "4h": { timeframe: "hour", aggregate: 4 },
  "1d": { timeframe: "day", aggregate: 1 },
};

async function gt(path) {
  const r = await fetch(`${GT}${path}`, { headers: { Accept: "application/json;version=20230302" } });
  if (!r.ok) throw new Error(`geckoterminal ${r.status}`);
  return r.json();
}

export default async function handler(req, res) {
  const url = new URL(req.url, "http://x");
  const mint = url.searchParams.get("mint") || "";
  const chain = (url.searchParams.get("chain") || "solana").toLowerCase();
  const interval = url.searchParams.get("interval") || "1h";
  const limit = Math.min(Number(url.searchParams.get("limit")) || 200, 1000);
  let pool = url.searchParams.get("pool") || "";
  if (!mint && !pool) return send(res, 400, { ok: false, error: "mint required" });

  const net = NETWORK[chain] || (chain && chain !== "solana" ? chain : "solana");
  const tf = TF[interval] || TF["1h"];
  cache(res, 30, 120);

  try {
    // 1. Resolve the deepest pool for this token if not supplied.
    let poolMeta = null;
    if (!pool) {
      const pools = await gt(`/networks/${net}/tokens/${mint}/pools?page=1`);
      const arr = (pools?.data || []);
      if (!arr.length) return send(res, 200, { ok: true, candles: [], pool: null, note: "no pool found" });
      // pick the most-traded pool (deepest real price discovery): 24h volume, then liquidity.
      const score = (p) => Number(p.attributes?.volume_usd?.h24 || 0) * 1e6 + Number(p.attributes?.reserve_in_usd || 0);
      arr.sort((a, b) => score(b) - score(a));
      poolMeta = arr[0];
      pool = poolMeta.attributes?.address || poolMeta.id?.split("_").pop();
    }

    // 2. Fetch OHLCV for that pool.
    const ohlc = await gt(`/networks/${net}/pools/${pool}/ohlcv/${tf.timeframe}?aggregate=${tf.aggregate}&limit=${limit}&currency=usd`);
    const list = ohlc?.data?.attributes?.ohlcv_list || [];
    // GeckoTerminal returns newest-first; lightweight-charts wants ascending unique times.
    const candles = list
      .map((c) => ({ time: c[0], open: c[1], high: c[2], low: c[3], close: c[4], volume: c[5] }))
      .filter((c) => Number.isFinite(c.time) && Number.isFinite(c.close))
      .sort((a, b) => a.time - b.time);

    return send(res, 200, {
      ok: true,
      pool,
      poolName: poolMeta?.attributes?.name || null,
      dex: poolMeta?.relationships?.dex?.data?.id || null,
      interval,
      candles,
    });
  } catch (e) {
    return send(res, 200, { ok: false, error: String(e?.message || e), candles: [] });
  }
}

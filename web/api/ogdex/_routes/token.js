import { jup, callFn, send, cache } from "../_lib.js";
import { normToken, num } from "../_normalize.js";

const GT_HDR = { Accept: "application/json;version=20230302" };
const EVM_CHAIN_TO_GT = {
  ethereum: "eth", bsc: "bsc", base: "base", polygon: "polygon_pos",
  arbitrum: "arbitrum", avalanche: "avax", sui: "sui-network",
};

export default async function handler(req, res) {
  const url  = new URL(req.url, "http://x");
  const mint = url.searchParams.get("mint") || "";
  if (!mint) return send(res, 400, { error: "mint required" });
  cache(res, 10, 30);

  // ── EVM chains (0x address) ────────────────────────────────────────────────
  const isEVM = /^0x[0-9a-fA-F]{40}$/.test(mint);
  if (isEVM) {
    try {
      const dexRaw = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mint}`, {
        headers: { Accept: "application/json" },
      }).then(r => r.ok ? r.json() : null).catch(() => null);

      const pairs = (dexRaw?.pairs || []).filter(p => p.baseToken?.address?.toLowerCase() === mint.toLowerCase());
      const best  = [...pairs].sort((a, b) => (num(b.liquidity?.usd) || 0) - (num(a.liquidity?.usd) || 0))[0] || null;

      if (!best) return send(res, 200, { mint, token: null, pairs: [], error: "Token not found on any chain" });

      const chain = best.chainId || "ethereum";
      const token = {
        mint,
        name:     best.baseToken?.name    || null,
        symbol:   best.baseToken?.symbol  || null,
        icon:     best.info?.imageUrl     || best.info?.header || null,
        priceUsd: num(best.priceUsd),
        mcap:     num(best.marketCap),
        fdv:      num(best.fdv),
        liquidity: num(best.liquidity?.usd),
        volume:    num(best.volume?.h24),
        change5m:  num(best.priceChange?.m5),
        change1h:  num(best.priceChange?.h1),
        change6h:  num(best.priceChange?.h6),
        change24h: num(best.priceChange?.h24),
        holderCount: null,
        isVerified: false,
        chain,
        createdAt: best.pairCreatedAt ? new Date(best.pairCreatedAt).toISOString() : null,
        ageDays:   best.pairCreatedAt ? Math.round((Date.now() - best.pairCreatedAt) / 864e5) : null,
        firstPool: { id: best.pairAddress },
        audit: { mintAuthorityDisabled: null, freezeAuthorityDisabled: null },
        stats: { "5m": {}, "1h": {}, "6h": {}, "24h": {} },
      };

      // Enrich icon/name from GeckoTerminal if DexScreener missing them
      if (!token.icon || !token.name) {
        try {
          const gtNet = EVM_CHAIN_TO_GT[chain] || chain;
          const gtTok = await fetch(
            `https://api.geckoterminal.com/api/v2/networks/${gtNet}/tokens/${mint}`,
            { headers: GT_HDR }
          ).then(r => r.ok ? r.json() : null).catch(() => null);
          const a = gtTok?.data?.attributes || {};
          if (!token.icon && a.image_url)  token.icon = a.image_url;
          if (!token.name && a.name)        token.name = a.name;
          if (!token.symbol && a.symbol)    token.symbol = a.symbol;
        } catch {}
      }

      // ATH price from GeckoTerminal OHLCV (using correct network)
      let athPrice = null, athMcap = null;
      try {
        const gtNet = EVM_CHAIN_TO_GT[chain] || chain;
        const gt = await fetch(
          `https://api.geckoterminal.com/api/v2/networks/${gtNet}/pools/${best.pairAddress}/ohlcv/day?limit=365&currency=usd&aggregate=1`,
          { headers: GT_HDR }
        ).then(r => r.ok ? r.json() : null).catch(() => null);
        const candles = gt?.data?.attributes?.ohlcv_list || [];
        const highs = candles.map(c => num(c[2])).filter(Boolean);
        if (highs.length) {
          athPrice = Math.max(...highs);
          if (athPrice && token.priceUsd && token.mcap) athMcap = (athPrice / token.priceUsd) * token.mcap;
        }
      } catch {}

      const pairsMapped = pairs.slice(0, 5).map(p => ({
        dex:       p.dexId,
        address:   p.pairAddress,
        priceUsd:  num(p.priceUsd),
        liquidity: num(p.liquidity?.usd),
        volume24h: num(p.volume?.h24),
        change24h: num(p.priceChange?.h24),
        txnsBuys:  p.txns?.h24?.buys  || 0,
        txnsSells: p.txns?.h24?.sells || 0,
        chain:     p.chainId,
      }));

      return send(res, 200, { mint, token, athPrice, athMcap, pairs: pairsMapped, chain });
    } catch (e) {
      return send(res, 200, { mint, error: String(e?.message || e) });
    }
  }

  // ── Solana path (original logic) ───────────────────────────────────────────
  try {
    // 1. Fetch Jupiter token + DexScreener pairs + custom scan in parallel
    const [jupRaw, dexRaw, scan, intel] = await Promise.all([
      jup(`/tokens/v1/token/${mint}`).catch(() => null),
      fetch(`https://api.dexscreener.com/latest/dex/tokens/${mint}`, {
        headers: { Accept: "application/json" },
      }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
      callFn("og-scan-token", { query: mint }).catch(() => null),
      callFn("ogdex-intel", { mint }).catch(() => null),
    ]);

    // 2. Normalise from Jupiter
    let token = normToken(jupRaw, "24h");

    // 3. Best DexScreener pair (highest liquidity)
    const pairs = dexRaw?.pairs || [];
    const best = [...pairs].sort(
      (a, b) => (num(b.liquidity?.usd) || 0) - (num(a.liquidity?.usd) || 0)
    )[0] || null;

    if (best) {
      if (!token) {
        // Build token from DexScreener if Jupiter returned nothing
        token = {
          mint,
          name: best.baseToken?.name || null,
          symbol: best.baseToken?.symbol || null,
          icon: best.info?.imageUrl || best.info?.header || null,
          priceUsd: num(best.priceUsd),
          mcap: num(best.marketCap),
          fdv: num(best.fdv),
          liquidity: num(best.liquidity?.usd),
          volume: num(best.volume?.h24),
          change5m: num(best.priceChange?.m5),
          change1h: num(best.priceChange?.h1),
          change6h: num(best.priceChange?.h6),
          change24h: num(best.priceChange?.h24),
          holderCount: null,
          isVerified: false,
          createdAt: best.pairCreatedAt ? new Date(best.pairCreatedAt).toISOString() : null,
          ageDays: best.pairCreatedAt ? Math.round((Date.now() - best.pairCreatedAt) / 864e5) : null,
          firstPool: best.pairAddress ? { id: best.pairAddress } : null,
          audit: { mintAuthorityDisabled: null, freezeAuthorityDisabled: null },
          stats: { "5m": {}, "1h": {}, "6h": {}, "24h": {} },
        };
      } else {
        // Enrich existing Jupiter token with DexScreener data
        if (token.priceUsd == null) token.priceUsd = num(best.priceUsd);
        if (!token.volume)         token.volume    = num(best.volume?.h24);
        if (!token.liquidity)      token.liquidity = num(best.liquidity?.usd);
        if (!token.mcap)           token.mcap      = num(best.marketCap);
        if (token.change24h == null) token.change24h = num(best.priceChange?.h24);
        if (token.change1h  == null) token.change1h  = num(best.priceChange?.h1);
        if (token.change6h  == null) token.change6h  = num(best.priceChange?.h6);
        if (token.change5m  == null) token.change5m  = num(best.priceChange?.m5);
        if (!token.icon)           token.icon = best.info?.imageUrl || best.info?.header || null;
        if (!token.firstPool?.id)  token.firstPool = { id: best.pairAddress };
        if (!token.ageDays && best.pairCreatedAt) {
          token.ageDays = Math.round((Date.now() - best.pairCreatedAt) / 864e5);
          token.createdAt = new Date(best.pairCreatedAt).toISOString();
        }
      }
    }

    // 4. Merge custom scan metadata (OG Scan / Soltools)
    const meta = scan?.token ?? null;
    if (token && meta) {
      token.isVerified = token.isVerified || !!meta.isVerifiedJup;
      if (!token.icon) token.icon = meta.icon || meta.image;
      if (!token.holderCount) token.holderCount = meta.holderCount;
    }

    // 5. Compute ATH price & market cap from GeckoTerminal OHLCV
    const poolAddr = best?.pairAddress || token?.firstPool?.id || null;
    let athPrice = null;
    let athMcap  = null;
    if (poolAddr) {
      try {
        const gt = await fetch(
          `https://api.geckoterminal.com/api/v2/networks/solana/pools/${poolAddr}/ohlcv/day?limit=1000&currency=usd&aggregate=1`,
          { headers: { Accept: "application/json;version=20230302" } }
        ).then((r) => (r.ok ? r.json() : null));
        const candles = gt?.data?.attributes?.ohlcv_list || [];
        const highs = candles.map((c) => num(c[2])).filter(Boolean);
        if (highs.length) {
          athPrice = Math.max(...highs);
          const supply = num(token?.totalSupply) || num(token?.circSupply);
          if (athPrice && supply) athMcap = athPrice * supply;
          // Fallback: use ATH price * (current mcap / current price) to estimate ATH mcap
          if (!athMcap && athPrice && token?.priceUsd && token?.mcap) {
            athMcap = (athPrice / token.priceUsd) * token.mcap;
          }
        }
      } catch {}
    }

    // Fallback: meta.athMcap from og-scan-token if GeckoTerminal didn't work
    if (!athMcap && meta?.athMcap) athMcap = num(meta.athMcap);

    // 6. Mapped pair list for detail page
    const pairsMapped = pairs.slice(0, 5).map((p) => ({
      dex:      p.dexId,
      address:  p.pairAddress,
      priceUsd: num(p.priceUsd),
      liquidity: num(p.liquidity?.usd),
      volume24h: num(p.volume?.h24),
      change24h: num(p.priceChange?.h24),
      txnsBuys:  p.txns?.h24?.buys  || 0,
      txnsSells: p.txns?.h24?.sells || 0,
    }));

    return send(res, 200, {
      mint,
      token: token || (meta ? normMetaToken(meta) : null),
      meta,
      athPrice,
      athMcap,
      pairs: pairsMapped,
      score:         scan?.score   ?? null,
      flags:         scan?.flags   ?? null,
      verdict:       scan?.verdict ?? null,
      momentum:      meta?.momentum      ?? null,
      momentumLabel: meta?.momentumLabel ?? null,
      intel:  intel?.ok ? intel : null,
      safety: intel?.safety ?? null,
    });
  } catch (e) {
    return send(res, 200, { mint, error: String(e?.message || e) });
  }
}

function normMetaToken(m) {
  return {
    mint: m.mint, name: m.name, symbol: m.symbol, icon: m.icon || m.image,
    priceUsd: m.priceUsd, mcap: m.mcap, fdv: m.fdv, liquidity: m.liquidity,
    holderCount: m.holderCount,
    volume: (num(m.buyVolume24h) || 0) + (num(m.sellVolume24h) || 0),
    change24h: m.priceChange24h, isVerified: !!m.isVerifiedJup,
    audit: { mintAuthorityDisabled: null, freezeAuthorityDisabled: null },
    stats: { "5m": {}, "1h": {}, "6h": {}, "24h": {} },
  };
}

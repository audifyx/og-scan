import { jup, callFn, send, cache, INTEL_FN } from "../_lib.js";
import { getLabeledHolders } from "../_holders.js";
import { normToken, num } from "../_normalize.js";
import { evmTrades, evmSecurity } from "../_evm.js";

const GT_HDR = { Accept: "application/json;version=20230302" };
const GT = "https://api.geckoterminal.com/api/v2";
const EVM_CHAIN_TO_GT = {
  ethereum: "eth", bsc: "bsc", base: "base", polygon: "polygon_pos",
  arbitrum: "arbitrum", avalanche: "avax", sui: "sui-network",
};

// Pull website / socials / banner out of a DexScreener pair's info block.
function dexLinks(best) {
  const info = best?.info || {};
  const socials = {};
  for (const s of info.socials || []) {
    const k = String(s.type || s.platform || "").toLowerCase();
    if (k.includes("twitter") || k === "x") socials.twitter = s.url;
    else if (k.includes("telegram")) socials.telegram = s.url;
    else if (k.includes("discord")) socials.discord = s.url;
  }
  const site = (info.websites || [])[0];
  if (site?.url) socials.website = site.url;
  return { socials, banner: info.header || info.openGraph || null, imageUrl: info.imageUrl || null };
}

// Compute ATH price/mcap from the *canonical* (deepest-liquidity) GeckoTerminal
// pool for this token, then derive ATH mcap from real circulating supply.
async function poolHigh(network, pool) {
  try {
    const gt = await fetch(
      `${GT}/networks/${network}/pools/${pool}/ohlcv/day?limit=1000&currency=usd&aggregate=1`,
      { headers: GT_HDR }
    ).then((r) => (r.ok ? r.json() : null));
    const candles = gt?.data?.attributes?.ohlcv_list || [];
    const highs = candles.map((c) => num(c[2])).filter((h) => h && h > 0);
    return highs.length ? Math.max(...highs) : null;
  } catch { return null; }
}

// ATH is computed across the token's *top pools*, not just the deepest current
// one — older pools often hold the true peak that a newer deep pool has never
// seen. We take the global max daily high, then derive ATH mcap from real supply.
async function computeAth(network, mint, token, fallbackPool) {
  let pools = [];
  try {
    const pr = await fetch(`${GT}/networks/${network}/tokens/${mint}/pools`, { headers: GT_HDR })
      .then((r) => (r.ok ? r.json() : null)).catch(() => null);
    pools = (pr?.data || [])
      .map((p) => ({ addr: p.attributes?.address, liq: Number(p.attributes?.reserve_in_usd) || 0 }))
      .filter((p) => p.addr)
      .sort((a, b) => b.liq - a.liq);
  } catch {}
  const addrs = [...new Set([...pools.slice(0, 4).map((p) => p.addr), fallbackPool].filter(Boolean))].slice(0, 4);
  if (!addrs.length) return { athPrice: null, athMcap: null };
  try {
    const highs = (await Promise.all(addrs.map((a) => poolHigh(network, a)))).filter((h) => h && h > 0);
    if (!highs.length) return { athPrice: null, athMcap: null };
    let athPrice = Math.max(...highs);
    const price = num(token?.priceUsd);
    // Guard against a single corrupt candle wick.
    if (price && athPrice > price * 5000) athPrice = price;
    const supply = num(token?.totalSupply) || num(token?.circSupply);
    let athMcap = null;
    if (athPrice && supply) athMcap = athPrice * supply;
    else if (athPrice && price && token?.mcap) athMcap = (athPrice / price) * token.mcap;
    if (athMcap != null && token?.mcap) athMcap = Math.max(athMcap, token.mcap);
    return { athPrice, athMcap };
  } catch { return { athPrice: null, athMcap: null }; }
}

export default async function handler(req, res) {
  const url  = new URL(req.url, "http://x");
  const mint = url.searchParams.get("mint") || "";
  const chainHint = (url.searchParams.get("chain") || "").toLowerCase();
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
      // Prefer pairs on the caller-specified chain (avoids picking the wrong
      // chain when the same 0x address exists on several chains); else deepest LP.
      const onHint = chainHint ? pairs.filter(p => String(p.chainId).toLowerCase() === chainHint) : [];
      const pool   = (onHint.length ? onHint : pairs);
      const best   = [...pool].sort((a, b) => (num(b.liquidity?.usd) || 0) - (num(a.liquidity?.usd) || 0))[0] || null;

      if (!best) return send(res, 200, { mint, token: null, pairs: [], error: "Token not found on any chain" });

      const chain = best.chainId || "ethereum";
      const links = dexLinks(best);
      const token = {
        mint,
        name:     best.baseToken?.name    || null,
        symbol:   best.baseToken?.symbol  || null,
        icon:     links.imageUrl || best.info?.header || null,
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

      if (!token.icon || !token.name) {
        try {
          const gtNet = EVM_CHAIN_TO_GT[chain] || chain;
          const gtTok = await fetch(`${GT}/networks/${gtNet}/tokens/${mint}`, { headers: GT_HDR })
            .then(r => r.ok ? r.json() : null).catch(() => null);
          const a = gtTok?.data?.attributes || {};
          if (!token.icon && a.image_url)  token.icon = a.image_url;
          if (!token.name && a.name)        token.name = a.name;
          if (!token.symbol && a.symbol)    token.symbol = a.symbol;
        } catch {}
      }

      const gtNet = EVM_CHAIN_TO_GT[chain] || chain;
      const [{ athPrice, athMcap }, trades, sec] = await Promise.all([
        computeAth(gtNet, mint, token, best.pairAddress),
        evmTrades(gtNet, best.pairAddress, mint, 100),
        evmSecurity(chain, mint, token),
      ]);
      if (sec.holderCount != null) token.holderCount = sec.holderCount;

      const pairsMapped = pairs.slice(0, 5).map(p => ({
        dex: p.dexId, address: p.pairAddress, priceUsd: num(p.priceUsd),
        liquidity: num(p.liquidity?.usd), volume24h: num(p.volume?.h24), change24h: num(p.priceChange?.h24),
        txnsBuys: p.txns?.h24?.buys || 0, txnsSells: p.txns?.h24?.sells || 0, chain: p.chainId,
      }));

      return send(res, 200, {
        mint, token, athPrice, athMcap, pairs: pairsMapped, chain,
        safety: sec.safety,
        intel: { trades, holders: sec.holders },
        flags: { securityUnavailable: sec.unsupported },
        meta: {
          chain, socials: links.socials, banner: links.banner,
          ageDays: token.ageDays, createdAt: token.createdAt,
          securityUnavailable: sec.unsupported,
        },
      });
    } catch (e) {
      return send(res, 200, { mint, error: String(e?.message || e) });
    }
  }

  // ── Solana path ────────────────────────────────────────────────────────────
  try {
    // 1. Fetch sources in parallel. Jupiter v2 search is the PRIMARY source —
    //    it returns correct usdPrice / mcap / fdv / supply / holderCount /
    //    decimals / per-window stats / audit, all internally consistent.
    const [jupArr, dexRaw, scan, intel] = await Promise.all([
      jup(`/tokens/v2/search?query=${mint}`).catch(() => null),
      fetch(`https://api.dexscreener.com/latest/dex/tokens/${mint}`, { headers: { Accept: "application/json" } })
        .then((r) => (r.ok ? r.json() : null)).catch(() => null),
      callFn("og-scan-token", { query: mint }).catch(() => null),
      callFn(INTEL_FN, { mint }).catch(() => null),
    ]);

    const jupRaw = Array.isArray(jupArr) ? (jupArr.find((t) => (t.id || t.mint) === mint) || null) : null;
    let token = normToken(jupRaw, "24h");
    if (token) token.chain = "solana";

    // 2. DexScreener — ONLY pairs where this mint is the base token (a quote-side
    //    pair reports the *other* token's price and corrupts mcap/ATH).
    const pairs = (dexRaw?.pairs || []).filter((p) => p.baseToken?.address === mint);
    const best = [...pairs].sort((a, b) => (num(b.liquidity?.usd) || 0) - (num(a.liquidity?.usd) || 0))[0] || null;
    const links = best ? dexLinks(best) : { socials: {}, banner: null, imageUrl: null };

    if (best) {
      const dexPrice = num(best.priceUsd);
      if (!token) {
        // No Jupiter entry — build from DexScreener.
        token = {
          mint, chain: "solana",
          name: best.baseToken?.name || null,
          symbol: best.baseToken?.symbol || null,
          icon: links.imageUrl || best.info?.header || null,
          priceUsd: dexPrice,
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
        // Enrich Jupiter token with DexScreener — but never let a divergent
        // DexScreener price override the authoritative Jupiter price/mcap.
        const trustDex = token.priceUsd == null ||
          (dexPrice != null && dexPrice > 0 && token.priceUsd > 0 &&
            dexPrice / token.priceUsd < 3 && dexPrice / token.priceUsd > 0.33);
        if (token.priceUsd == null && dexPrice != null) token.priceUsd = dexPrice;
        if (!token.volume)    token.volume    = num(best.volume?.h24);
        if (!token.liquidity) token.liquidity = num(best.liquidity?.usd);
        if (!token.mcap && trustDex) token.mcap = num(best.marketCap);
        if (!token.fdv && trustDex)  token.fdv  = num(best.fdv);
        if (token.change24h == null) token.change24h = num(best.priceChange?.h24);
        if (token.change1h  == null) token.change1h  = num(best.priceChange?.h1);
        if (token.change6h  == null) token.change6h  = num(best.priceChange?.h6);
        if (token.change5m  == null) token.change5m  = num(best.priceChange?.m5);
        if (!token.icon)            token.icon = links.imageUrl || best.info?.header || null;
        if (!token.firstPool?.id)   token.firstPool = { id: best.pairAddress };
        if (!token.ageDays && best.pairCreatedAt) {
          token.ageDays = Math.round((Date.now() - best.pairCreatedAt) / 864e5);
          token.createdAt = new Date(best.pairCreatedAt).toISOString();
        }
      }
    }

    // 3. Merge custom scan metadata (OG Scan / Soltools).
    const scanMeta = scan?.token ?? null;
    if (token && scanMeta) {
      token.isVerified = token.isVerified || !!scanMeta.isVerifiedJup;
      if (!token.icon) token.icon = scanMeta.icon || scanMeta.image;
      if (!token.holderCount) token.holderCount = scanMeta.holderCount;
    }

    // 4. ATH via the canonical (deepest) GeckoTerminal pool + real supply.
    let { athPrice, athMcap } = await computeAth(
      "solana", mint, token, best?.pairAddress || token?.firstPool?.id || null
    );
    // Fallback to OG Scan's stored ATH mcap if GeckoTerminal had no history.
    if (athMcap == null && scanMeta?.athMcap) athMcap = num(scanMeta.athMcap);

    // 5. Compose meta (frontend reads socials/banner/chain/age from here).
    const meta = {
      ...(scanMeta || {}),
      chain: "solana",
      socials: { ...(scanMeta?.socials || {}), ...links.socials },
      banner: scanMeta?.banner || links.banner,
      ageDays: scanMeta?.ageDays ?? token?.ageDays ?? null,
      createdAt: scanMeta?.createdAt ?? token?.createdAt ?? null,
      holderCount: scanMeta?.holderCount ?? token?.holderCount ?? intel?.holderCount ?? null,
      pairDexId: best?.dexId || scanMeta?.pairDexId || null,
      athPrice, athMcap,
    };

    // 6. Mapped pair list.
    const pairsMapped = pairs.slice(0, 5).map((p) => ({
      dex: p.dexId, address: p.pairAddress, priceUsd: num(p.priceUsd),
      liquidity: num(p.liquidity?.usd), volume24h: num(p.volume?.h24), change24h: num(p.priceChange?.h24),
      txnsBuys: p.txns?.h24?.buys || 0, txnsSells: p.txns?.h24?.sells || 0,
    }));

    // Backfill top holders if the intel function returned none (e.g. its
    // Birdeye source is down / Helius index overloaded). Uses the resilient
    // largest-accounts helper so whales / holder-count / holders tab keep working.
    let intelOut = intel?.ok ? intel : null;
    if (!intelOut?.holders?.length) {
      const hp = meta.priceUsd ?? token?.priceUsd ?? null;
      const hb = await Promise.race([
        getLabeledHolders(mint, hp).catch(() => ({ holders: [] })),
        new Promise((r) => setTimeout(() => r({ holders: [] }), 6500)),
      ]);
      if (hb.holders?.length) {
        intelOut = { ...(intelOut || { ok: true }), ok: true, holders: hb.holders, holdersBackfilled: true, holdersSource: hb.source };
      }
    }

    return send(res, 200, {
      mint,
      token: token || (scanMeta ? normMetaToken(scanMeta) : null),
      meta,
      athPrice,
      athMcap,
      pairs: pairsMapped,
      score:         scan?.score   ?? null,
      flags:         scan?.flags   ?? null,
      verdict:       scan?.verdict ?? null,
      momentum:      scanMeta?.momentum      ?? null,
      momentumLabel: scanMeta?.momentumLabel ?? null,
      intel:  intelOut,
      safety: intel?.safety ?? null,
    });
  } catch (e) {
    return send(res, 200, { mint, error: String(e?.message || e) });
  }
}

function normMetaToken(m) {
  return {
    mint: m.mint, name: m.name, symbol: m.symbol, icon: m.icon || m.image, chain: "solana",
    priceUsd: m.priceUsd, mcap: m.mcap, fdv: m.fdv, liquidity: m.liquidity,
    holderCount: m.holderCount,
    volume: (num(m.buyVolume24h) || 0) + (num(m.sellVolume24h) || 0),
    change24h: m.priceChange24h, isVerified: !!m.isVerifiedJup,
    audit: { mintAuthorityDisabled: null, freezeAuthorityDisabled: null },
    stats: { "5m": {}, "1h": {}, "6h": {}, "24h": {} },
  };
}

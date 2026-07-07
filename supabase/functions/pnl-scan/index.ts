import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const HELIUS_API_KEY = Deno.env.get("HELIUS_API_KEY") || "";
const SOL_MINT = "So11111111111111111111111111111111111111112";
const STABLES: Record<string, number> = {
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v": 1, // USDC
  "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB": 1, // USDT
};
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (o: unknown, s = 200) =>
  new Response(JSON.stringify(o), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

async function solPrice(): Promise<number> {
  try { const r = await fetch(`https://price.jup.ag/v6/price?ids=${SOL_MINT}`, { signal: AbortSignal.timeout(8000) }); const j = await r.json(); const p = j?.data?.[SOL_MINT]?.price; if (p) return Number(p); } catch { /* */ }
  try { const r = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd", { signal: AbortSignal.timeout(8000) }); const j = await r.json(); if (j?.solana?.usd) return Number(j.solana.usd); } catch { /* */ }
  return 0;
}

async function tokenInfo(mint: string) {
  try {
    const r = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mint}`, { signal: AbortSignal.timeout(10000) });
    const j = await r.json();
    const pairs = ((j?.pairs || []) as any[]).filter((p) => p.chainId === "solana")
      .sort((a, b) => Number(b.liquidity?.usd || 0) - Number(a.liquidity?.usd || 0));
    const p = pairs[0];
    if (!p) return null;
    const priceUsd = Number(p.priceUsd || 0);
    const marketCap = Number(p.marketCap || p.fdv || 0);
    const supply = priceUsd > 0 && marketCap > 0 ? marketCap / priceUsd : null;
    return {
      symbol: p.baseToken?.symbol || "TOKEN", name: p.baseToken?.name || p.baseToken?.symbol || "Token",
      priceUsd, marketCap, supply, image: p.info?.imageUrl || null, url: p.url || null,
      liquidityUsd: Number(p.liquidity?.usd || 0), volume24h: Number(p.volume?.h24 || 0),
      priceChange24h: Number(p.priceChange?.h24 || 0), pairCreatedAt: Number(p.pairCreatedAt || 0),
      dexId: p.dexId || null,
      socials: { website: (p.info?.websites || [])[0]?.url || null, twitter: (p.info?.socials || []).find((x: any) => x.type === "twitter")?.url || null, telegram: (p.info?.socials || []).find((x: any) => x.type === "telegram")?.url || null },
    };
  } catch { return null; }
}

async function athMarketCap(mint: string, supply: number | null): Promise<number | null> {
  if (!supply) return null;
  try {
    const pr = await fetch(`https://api.geckoterminal.com/api/v2/networks/solana/tokens/${mint}/pools?page=1`, { signal: AbortSignal.timeout(8000) });
    const pj = await pr.json();
    const pool = pj?.data?.[0]?.attributes?.address;
    if (!pool) return null;
    const or = await fetch(`https://api.geckoterminal.com/api/v2/networks/solana/pools/${pool}/ohlcv/day?aggregate=1&limit=1000&currency=usd`, { signal: AbortSignal.timeout(9000) });
    const oj = await or.json();
    const list = (oj?.data?.attributes?.ohlcv_list || []) as number[][];
    let hi = 0;
    for (const row of list) { const h = Number(row[2] || 0); if (h > hi) hi = h; }
    if (hi <= 0) return null;
    const athMc = hi * supply;
    return athMc > 0 ? athMc : null;
  } catch { return null; }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { wallet, mint } = await req.json().catch(() => ({}));
    if (!wallet || !mint) return json({ error: "wallet and mint are required" }, 400);
    if (!HELIUS_API_KEY) return json({ error: "Helius not configured" }, 500);

    const [tok, sp] = await Promise.all([tokenInfo(String(mint)), solPrice()]);
    if (!tok) return json({ error: "Token not found on DexScreener" }, 404);
    const supply = tok.supply;
    const ath = await athMarketCap(String(mint), supply);

    type T = { ts: number; type: "buy" | "sell"; tokens: number; sol: number; usd: number; priceUsd: number; mc: number | null; sig: string; via: string };
    const trades: T[] = [];
    let before = ""; const maxPages = 10; let truncated = false; let scanned = 0;
    for (let page = 0; page < maxPages; page++) {
      const url = `https://api.helius.xyz/v0/addresses/${wallet}/transactions?api-key=${HELIUS_API_KEY}&type=SWAP&limit=100${before ? `&before=${before}` : ""}`;
      let arr: any;
      try { const r = await fetch(url, { signal: AbortSignal.timeout(15000) }); arr = await r.json(); } catch { break; }
      if (!Array.isArray(arr) || arr.length === 0) break;
      scanned += arr.length;
      for (const tx of arr) {
        const ev = tx?.events?.swap; if (!ev) continue;
        const ts = tx.timestamp ? tx.timestamp * 1000 : (tx.blockTime ? tx.blockTime * 1000 : Date.now());
        const sig = tx.signature || "";
        const outs = (ev.tokenOutputs || []) as any[]; const ins = (ev.tokenInputs || []) as any[];
        const nativeIn = ev.nativeInput ? Number(ev.nativeInput.amount || 0) / 1e9 : 0;
        const nativeOut = ev.nativeOutput ? Number(ev.nativeOutput.amount || 0) / 1e9 : 0;
        const amt = (t: any) => { const raw = t?.rawTokenAmount; if (raw) return Number(raw.tokenAmount || 0) / Math.pow(10, Number(raw.decimals || 0)); return Number(t?.tokenAmount || 0); };
        const outTok = outs.find((t) => t.mint === mint);
        const inTok = ins.find((t) => t.mint === mint);
        // stable counter-sides
        const stableIn = ins.find((t) => STABLES[t.mint]); const stableOut = outs.find((t) => STABLES[t.mint]);
        if (outTok) {
          const tokens = amt(outTok); if (tokens <= 0) continue;
          let usd = 0, sol = 0, via = "";
          if (nativeIn > 0) { sol = nativeIn; usd = nativeIn * sp; via = "SOL"; }
          else if (stableIn) { usd = amt(stableIn); via = "USD"; }
          else continue;
          const priceUsd = usd / tokens;
          trades.push({ ts, type: "buy", tokens, sol, usd, priceUsd, mc: supply ? priceUsd * supply : null, sig, via });
        } else if (inTok) {
          const tokens = amt(inTok); if (tokens <= 0) continue;
          let usd = 0, sol = 0, via = "";
          if (nativeOut > 0) { sol = nativeOut; usd = nativeOut * sp; via = "SOL"; }
          else if (stableOut) { usd = amt(stableOut); via = "USD"; }
          else continue;
          const priceUsd = usd / tokens;
          trades.push({ ts, type: "sell", tokens, sol, usd, priceUsd, mc: supply ? priceUsd * supply : null, sig, via });
        }
      }
      if (arr.length < 100) break;
      before = arr[arr.length - 1]?.signature || ""; if (!before) break;
      if (page === maxPages - 1) truncated = true;
    }

    trades.sort((a, b) => a.ts - b.ts);
    let boughtTok = 0, boughtSol = 0, soldTok = 0, soldSol = 0, investedUsd = 0, soldUsd = 0;
    let buyCount = 0, sellCount = 0, biggestBuyUsd = 0, biggestSellUsd = 0;
    let firstBuyTs = 0, lastTradeTs = 0, peakTradeMc = 0;
    for (const t of trades) {
      lastTradeTs = Math.max(lastTradeTs, t.ts);
      if (t.mc && t.mc > peakTradeMc) peakTradeMc = t.mc;
      if (t.type === "buy") { boughtTok += t.tokens; boughtSol += t.sol; investedUsd += t.usd; buyCount++; if (t.usd > biggestBuyUsd) biggestBuyUsd = t.usd; if (!firstBuyTs) firstBuyTs = t.ts; }
      else { soldTok += t.tokens; soldSol += t.sol; soldUsd += t.usd; sellCount++; if (t.usd > biggestSellUsd) biggestSellUsd = t.usd; }
    }
    const remainingTok = Math.max(0, boughtTok - soldTok);
    const avgBuyPriceUsd = boughtTok > 0 ? investedUsd / boughtTok : 0;
    const avgSellPriceUsd = soldTok > 0 ? soldUsd / soldTok : 0;
    const avgBuyMc = supply ? avgBuyPriceUsd * supply : null;
    const avgSellMc = supply ? avgSellPriceUsd * supply : null;
    const realizedPnlUsd = soldUsd - soldTok * avgBuyPriceUsd;
    const remainingValueUsd = remainingTok * tok.priceUsd;
    const unrealizedPnlUsd = remainingValueUsd - remainingTok * avgBuyPriceUsd;
    const totalPnlUsd = realizedPnlUsd + unrealizedPnlUsd;
    const roi = investedUsd > 0 ? (totalPnlUsd / investedUsd) * 100 : 0;
    const roiX = investedUsd > 0 ? (soldUsd + remainingValueUsd) / investedUsd : 0;
    const soldSupplyWorthNow = soldTok * tok.priceUsd;
    const soldSupplyWorthAth = ath && supply ? soldTok * (ath / supply) : null;
    const missedGainsUsd = soldTok * (tok.priceUsd - avgSellPriceUsd);
    const jeeted = avgSellMc != null && tok.marketCap > 0 && soldTok > 0 && tok.marketCap > avgSellMc * 1.5;
    const breakevenPriceUsd = remainingTok > 0 ? Math.max(0, (investedUsd - soldUsd)) / remainingTok : 0;
    const breakevenMc = supply ? breakevenPriceUsd * supply : null;
    const holdDays = firstBuyTs && lastTradeTs ? (lastTradeTs - firstBuyTs) / 86400000 : 0;
    const scen = [1, 2, 5, 10].map((m) => ({ label: `${m}x`, mc: tok.marketCap * m, remainingValue: remainingValueUsd * m }));
    if (ath && ath > tok.marketCap) scen.push({ label: "ATH", mc: ath, remainingValue: remainingValueUsd * (ath / tok.marketCap) });

    return json({
      ok: true, wallet, mint, token: tok, solUsd: sp, truncated, scanned, athMc: ath, peakTradeMc, trades,
      stats: {
        boughtTok, boughtSol, soldTok, soldSol, remainingTok, investedUsd, soldUsd,
        avgBuyPriceUsd, avgSellPriceUsd, avgBuyMc, avgSellMc,
        realizedPnlUsd, unrealizedPnlUsd, totalPnlUsd, roi, roiX,
        realizedPnlSol: sp ? realizedPnlUsd / sp : 0, unrealizedPnlSol: sp ? unrealizedPnlUsd / sp : 0, totalPnlSol: sp ? totalPnlUsd / sp : 0,
        remainingValueUsd, soldSupplyWorthNow, soldSupplyWorthAth, missedGainsUsd, jeeted,
        buyCount, sellCount, biggestBuyUsd, biggestSellUsd, firstBuyTs, lastTradeTs, holdDays,
        breakevenMc, currentPriceUsd: tok.priceUsd, currentMc: tok.marketCap,
      },
      scenarios: scen,
    });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

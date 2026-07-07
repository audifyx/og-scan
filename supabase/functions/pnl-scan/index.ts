import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const HELIUS_API_KEY = Deno.env.get("HELIUS_API_KEY") || "";
const SOL_MINT = "So11111111111111111111111111111111111111112";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (o: unknown, s = 200) =>
  new Response(JSON.stringify(o), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

async function solPrice(): Promise<number> {
  try {
    const r = await fetch(`https://price.jup.ag/v6/price?ids=${SOL_MINT}`, { signal: AbortSignal.timeout(8000) });
    const j = await r.json();
    const p = j?.data?.[SOL_MINT]?.price;
    if (p) return Number(p);
  } catch { /* fallthrough */ }
  try {
    const r = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd", { signal: AbortSignal.timeout(8000) });
    const j = await r.json();
    if (j?.solana?.usd) return Number(j.solana.usd);
  } catch { /* noop */ }
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
      symbol: p.baseToken?.symbol || "TOKEN",
      name: p.baseToken?.name || p.baseToken?.symbol || "Token",
      priceUsd, marketCap, supply,
      image: p.info?.imageUrl || null,
      url: p.url || null,
    };
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

    const trades: { ts: number; type: "buy" | "sell"; tokens: number; sol: number; priceUsd: number; mc: number | null }[] = [];
    let before = "";
    const maxPages = 8;
    let truncated = false;
    for (let page = 0; page < maxPages; page++) {
      const url = `https://api.helius.xyz/v0/addresses/${wallet}/transactions?api-key=${HELIUS_API_KEY}&type=SWAP&limit=100${before ? `&before=${before}` : ""}`;
      let arr: any;
      try { const r = await fetch(url, { signal: AbortSignal.timeout(15000) }); arr = await r.json(); } catch { break; }
      if (!Array.isArray(arr) || arr.length === 0) break;
      for (const tx of arr) {
        const ev = tx?.events?.swap;
        if (!ev) continue;
        const ts = tx.timestamp ? tx.timestamp * 1000 : (tx.blockTime ? tx.blockTime * 1000 : Date.now());
        const outs = (ev.tokenOutputs || []) as any[];
        const ins = (ev.tokenInputs || []) as any[];
        const nativeIn = ev.nativeInput ? Number(ev.nativeInput.amount || 0) / 1e9 : 0;
        const nativeOut = ev.nativeOutput ? Number(ev.nativeOutput.amount || 0) / 1e9 : 0;
        const outTok = outs.find((t) => t.mint === mint);
        const inTok = ins.find((t) => t.mint === mint);
        const amt = (t: any) => { const raw = t?.rawTokenAmount; if (raw) return Number(raw.tokenAmount || 0) / Math.pow(10, Number(raw.decimals || 0)); return Number(t?.tokenAmount || 0); };
        if (outTok && nativeIn > 0) {
          const tokens = amt(outTok); if (tokens <= 0) continue;
          const priceUsd = (nativeIn / tokens) * sp;
          trades.push({ ts, type: "buy", tokens, sol: nativeIn, priceUsd, mc: supply ? priceUsd * supply : null });
        } else if (inTok && nativeOut > 0) {
          const tokens = amt(inTok); if (tokens <= 0) continue;
          const priceUsd = (nativeOut / tokens) * sp;
          trades.push({ ts, type: "sell", tokens, sol: nativeOut, priceUsd, mc: supply ? priceUsd * supply : null });
        }
      }
      if (arr.length < 100) break;
      before = arr[arr.length - 1]?.signature || "";
      if (!before) break;
      if (page === maxPages - 1) truncated = true;
    }

    trades.sort((a, b) => a.ts - b.ts);
    let boughtTok = 0, boughtSol = 0, soldTok = 0, soldSol = 0;
    for (const t of trades) { if (t.type === "buy") { boughtTok += t.tokens; boughtSol += t.sol; } else { soldTok += t.tokens; soldSol += t.sol; } }
    const remainingTok = Math.max(0, boughtTok - soldTok);
    const avgBuyPriceUsd = boughtTok > 0 ? (boughtSol * sp) / boughtTok : 0;
    const avgSellPriceUsd = soldTok > 0 ? (soldSol * sp) / soldTok : 0;
    const avgBuyMc = supply ? avgBuyPriceUsd * supply : null;
    const avgSellMc = supply ? avgSellPriceUsd * supply : null;
    const realizedCostUsd = soldTok * avgBuyPriceUsd;
    const realizedPnlUsd = (soldSol * sp) - realizedCostUsd;
    const remainingCostUsd = remainingTok * avgBuyPriceUsd;
    const remainingValueUsd = remainingTok * tok.priceUsd;
    const unrealizedPnlUsd = remainingValueUsd - remainingCostUsd;
    const totalPnlUsd = realizedPnlUsd + unrealizedPnlUsd;
    const investedUsd = boughtSol * sp;
    const roi = investedUsd > 0 ? (totalPnlUsd / investedUsd) * 100 : 0;
    const soldSupplyWorthNow = soldTok * tok.priceUsd;
    const missedGainsUsd = soldTok * (tok.priceUsd - avgSellPriceUsd);
    const jeeted = avgSellMc != null && tok.marketCap > 0 && soldTok > 0 && tok.marketCap > avgSellMc * 1.5;
    const scenarios = [1, 2, 5, 10].map((m) => ({ mult: m, mc: tok.marketCap * m, remainingValue: remainingValueUsd * m }));

    return json({
      ok: true, wallet, mint, token: tok, solUsd: sp, truncated, trades,
      stats: {
        boughtTok, boughtSol, soldTok, soldSol, remainingTok,
        avgBuyPriceUsd, avgSellPriceUsd, avgBuyMc, avgSellMc,
        realizedPnlUsd, unrealizedPnlUsd, totalPnlUsd, investedUsd, roi,
        remainingValueUsd, soldSupplyWorthNow, missedGainsUsd, jeeted,
        currentPriceUsd: tok.priceUsd, currentMc: tok.marketCap,
      },
      scenarios,
    });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

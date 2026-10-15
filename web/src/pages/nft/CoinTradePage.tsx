// OrbitX — trade an NFT's coin. If the NFT's collection launched a pump.fun coin
// (one per collection), trade it for real in-app (Jupiter) with a live
// DexScreener chart. Otherwise fall back to the DB-tracked preview curve.
import { useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useActiveTradingWallet } from "@/hooks/useActiveTradingWallet";
import { toast } from "sonner";
import { ArrowLeft, Flame, Loader2, Rocket, TrendingUp, Info, ExternalLink, Copy } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getMarketWithNft, getHoldings, listCoinTrades, tradeCoin, enableNftCoin } from "./nftCoin";
import { Media, Empty } from "./_ui";
import { fmtSol, fmtInt, shortAddr, timeAgo } from "./nftMarketData";
import { PriceText } from "./currency";


async function fetchNftCoin(nftId: string): Promise<{ nft: any; coinMint: string | null }> {
  const { data } = await supabase.from("orbitx_nfts").select("*, collection:orbitx_nft_collections(coin_mint, name)").eq("id", nftId).maybeSingle();
  return { nft: data, coinMint: (data as any)?.collection?.coin_mint ?? null };
}

export default function CoinTradePage() {
  const { nftId } = useParams();
  const { data, isLoading } = useQuery({ queryKey: ["nft-coin-resolve", nftId], enabled: !!nftId, queryFn: () => fetchNftCoin(nftId!) });
  if (isLoading) return <div className="px-4 py-16 text-center text-sm mkt-muted">Loading…</div>;
  if (data?.coinMint) return <RealCoinTrade nft={data.nft} coinMint={data.coinMint} />;
  return <PaperMarket nftId={nftId!} />;
}

/* ── Real pump.fun coin: DexScreener chart + in-app Jupiter swap ── */
function RealCoinTrade({ nft, coinMint }: { nft: any; coinMint: string }) {
  const { address, ready, buy, sell, solscanTxUrl } = useActiveTradingWallet();
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [lastTx, setLastTx] = useState<string | null>(null);
  const { data: ds } = useQuery({
    queryKey: ["dexscreener", coinMint], refetchInterval: 30_000,
    queryFn: async () => {
      const r = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${coinMint}`);
      const j = await r.json();
      return (j?.pairs ?? [])[0] ?? null;
    },
  });

  // Backend-signed swap through the in-app wallet (no Phantom).
  const onSwap = async () => {
    if (!ready || !address) return toast.error("Link your in-app wallet first");
    const amt = Number(amount);
    if (!amt || amt <= 0) return toast.error("Enter an amount");
    setBusy(true);
    try {
      const sig = side === "buy" ? await buy(coinMint, amt) : await sell(coinMint, amt);
      setLastTx(sig);
      toast.success(`${side === "buy" ? "Bought" : "Sold"} — confirmed on-chain`);
      setAmount("");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Swap failed"); }
    finally { setBusy(false); }
  };

  return (
    <div>
      <Link to="/nft" className="mkt-btn ghost mb-4"><ArrowLeft className="h-4 w-4" /> Back to marketplace</Link>
      <div className="mkt-panel mb-4 flex items-center gap-4 p-4">
        <Media src={nft?.image_url} className="h-16 w-16 rounded-xl" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-xl font-black">{nft?.name ?? "NFT"} <span className="mkt-muted text-sm">coin</span></div>
          <button onClick={() => { navigator.clipboard?.writeText(coinMint); toast.success("Mint copied"); }} className="mt-0.5 inline-flex items-center gap-1 mkt-mono text-[11px] mkt-muted hover:text-[hsl(var(--mkt-ink))]"><Copy className="h-3 w-3" /> {shortAddr(coinMint, 6)}</button>
        </div>
        <div className="text-right">
          <div className="text-lg font-black text-[hsl(var(--og-lime))]">{ds?.priceUsd ? `$${Number(ds.priceUsd) < 0.01 ? Number(ds.priceUsd).toPrecision(2) : Number(ds.priceUsd).toFixed(4)}` : "—"}</div>
          <div className="mkt-mono text-[11px] mkt-muted">{ds?.marketCap ? `MC $${fmtInt(ds.marketCap)}` : "trading soon"}</div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <div className="mkt-panel overflow-hidden" style={{ minHeight: 420 }}>
          {ds?.pairAddress ? (
            <iframe title="chart" src={`https://dexscreener.com/solana/${ds.pairAddress}?embed=1&theme=dark&info=0&trades=0`} className="h-[420px] w-full" style={{ border: 0 }} />
          ) : (
            <div className="flex h-[420px] items-center justify-center text-center text-[13px] mkt-muted">Chart appears once the coin has its first trades on pump.fun.</div>
          )}
        </div>
        <div className="space-y-3">
          <div className="mkt-panel p-4">
            <div className="mb-3 flex items-center gap-1.5 text-sm font-black"><Rocket className="h-4 w-4 text-[hsl(var(--og-cyan))]" /> Swap in-app</div>
            <div className="mb-3 grid grid-cols-2 gap-1 rounded-xl bg-white/5 p-1">
              {(["buy", "sell"] as const).map((s) => (
                <button key={s} type="button" onClick={() => setSide(s)}
                  className={`rounded-lg py-2 text-[12px] font-black uppercase tracking-widest transition ${side === s ? (s === "buy" ? "bg-[hsl(var(--og-lime))] text-black" : "bg-red-500/80 text-white") : "text-white/50 hover:text-white"}`}>
                  {s}
                </button>
              ))}
            </div>
            <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder={side === "buy" ? "SOL amount" : "% of position"}
              className="mkt-input mb-3 w-full" />
            <button type="button" onClick={onSwap} disabled={busy || !ready}
              className="mkt-btn primary w-full justify-center py-3">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : side === "buy" ? `Buy ${nft?.symbol ?? "coin"}` : `Sell ${nft?.symbol ?? "coin"}`}
            </button>
            {!ready && <div className="mt-2 text-center text-[11px] mkt-muted">Link your in-app wallet to trade.</div>}
            {lastTx && <a href={solscanTxUrl(lastTx)} target="_blank" rel="noreferrer" className="mt-2 block text-center mkt-mono text-[11px] text-[hsl(var(--og-cyan))] hover:underline">View transaction</a>}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <a href={`https://jup.ag/swap/SOL-${coinMint}`} target="_blank" rel="noreferrer" className="mkt-btn ghost justify-center text-[12px]">Jupiter <ExternalLink className="h-3.5 w-3.5" /></a>
            <a href={`https://pump.fun/${coinMint}`} target="_blank" rel="noreferrer" className="mkt-btn ghost justify-center text-[12px]">pump.fun <ExternalLink className="h-3.5 w-3.5" /></a>
          </div>
          <div className="mkt-panel p-3 text-[12px] mkt-muted">
            <span className="inline-flex items-center gap-1.5 font-bold text-[hsl(var(--mkt-ink))]"><Info className="h-3.5 w-3.5" /> Real coin</span> — this collection's coin trades live on pump.fun / Jupiter. Creator earns pump.fun creator rewards on every trade.
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Fallback: DB-tracked preview curve (no pump.fun coin for this collection) ── */
function PaperMarket({ nftId }: { nftId: string }) {
  const { address: wallet } = useActiveTradingWallet();
  const qc = useQueryClient();
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: market } = useQuery({ queryKey: ["coin-mkt", nftId], refetchInterval: 15_000, queryFn: () => getMarketWithNft(nftId) });
  const { data: holdings } = useQuery({ queryKey: ["coin-hold", nftId, wallet], enabled: !!wallet, queryFn: () => getHoldings(nftId, wallet!) });
  const { data: trades } = useQuery({ queryKey: ["coin-trades", nftId], refetchInterval: 15_000, queryFn: () => listCoinTrades(nftId, 30) });
  const refresh = () => { qc.invalidateQueries({ queryKey: ["coin-mkt", nftId] }); qc.invalidateQueries({ queryKey: ["coin-hold", nftId, wallet] }); qc.invalidateQueries({ queryKey: ["coin-trades", nftId] }); };

  const nft = market?.nft;
  const onEnable = async () => {
    if (!wallet) return toast.error("Connect your wallet");
    setBusy(true);
    try { await enableNftCoin(nftId, wallet); toast.success("Preview market launched"); refresh(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Only the creator can enable this"); } finally { setBusy(false); }
  };
  const onTrade = async () => {
    if (!wallet) return toast.error("Connect your wallet");
    const amt = Number(amount); if (!amt || amt <= 0) return toast.error("Enter an amount");
    setBusy(true);
    try { const r = await tradeCoin(nftId, wallet, side, amt); toast.success(side === "buy" ? `Bought ${fmtInt(r.tokens)} tokens` : `Sold for ${fmtSol(r.sol)}`); setAmount(""); refresh(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Trade failed"); } finally { setBusy(false); }
  };

  return (
    <div>
      <Link to="/nft" className="mkt-btn ghost mb-4"><ArrowLeft className="h-4 w-4" /> Back</Link>
      {!market ? (
        <div className="mkt-panel flex flex-col items-center gap-3 px-6 py-16 text-center">
          <Rocket className="h-8 w-8 text-[hsl(var(--og-cyan))]" />
          <div className="text-sm font-bold">No coin for this NFT's collection</div>
          <p className="max-w-sm text-[12px] mkt-muted">Coins launch once per collection on pump.fun when the collection is created. The creator can enable a preview market here instead.</p>
          <button onClick={onEnable} disabled={busy} className="mkt-btn mt-1">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Flame className="h-4 w-4" />} Enable preview market</button>
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
          <div className="space-y-4">
            <div className="mkt-panel flex items-center gap-4 p-4">
              <Media src={nft?.image_url} className="h-20 w-20 rounded-xl" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-xl font-black">{nft?.name ?? "NFT"} <span className="mkt-muted text-sm">/ preview coin</span></div>
                <div className="mt-1 flex flex-wrap items-center gap-x-5 gap-y-1 text-[13px]">
                  <span><span className="mkt-muted">Price </span><PriceText sol={market.last_price_sol} className="mkt-mono font-bold text-[hsl(var(--og-lime))]" /></span>
                  <span><span className="mkt-muted">MC </span><PriceText sol={market.market_cap_sol} className="mkt-mono font-bold" /></span>
                </div>
              </div>
            </div>
            <div className="mkt-panel p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-black"><TrendingUp className="h-4 w-4 text-[hsl(var(--og-cyan))]" /> Recent trades</div>
              {(trades ?? []).length === 0 ? <Empty label="No trades yet." /> : (
                <div className="divide-y divide-[hsl(var(--mkt-line))]">
                  {(trades ?? []).map((t) => (
                    <div key={t.id} className="flex items-center justify-between py-2 text-[13px]">
                      <span className={`font-bold uppercase ${t.side === "buy" ? "text-[hsl(var(--og-lime))]" : "text-[hsl(var(--og-blood))]"}`}>{t.side}</span>
                      <span className="mkt-mono mkt-muted">{shortAddr(t.trader_wallet)}</span>
                      <span className="mkt-mono">{fmtInt(t.token_amount)} tok</span>
                      <span className="mkt-mono">{fmtSol(t.sol_amount)}</span>
                      <span className="mkt-mono mkt-muted">{timeAgo(t.created_at)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="space-y-4">
            <div className="mkt-panel p-4">
              <div className="mb-3 flex gap-1 rounded-xl bg-[hsl(var(--mkt-panel-2))] p-1">
                <button onClick={() => setSide("buy")} className={`flex-1 rounded-lg py-2 text-sm font-black ${side === "buy" ? "bg-[hsl(var(--og-lime))] text-black" : "mkt-muted"}`}>Buy</button>
                <button onClick={() => setSide("sell")} className={`flex-1 rounded-lg py-2 text-sm font-black ${side === "sell" ? "bg-[hsl(var(--og-blood))] text-white" : "mkt-muted"}`}>Sell</button>
              </div>
              <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder={side === "buy" ? "Amount (SOL)" : "Amount (tokens)"}
                className="w-full rounded-xl border mkt-hairline bg-[hsl(var(--mkt-panel-2))] px-3 py-2.5 text-sm outline-none focus:border-[hsl(var(--og-cyan))]/60" />
              {side === "sell" && <div className="mt-2 flex items-center justify-between text-[12px] mkt-muted"><span>Balance: <span className="mkt-mono">{fmtInt(holdings)}</span></span><button onClick={() => setAmount(String(holdings ?? 0))} className="mkt-chip px-2 py-1 text-[11px]">Max</button></div>}
              <button onClick={onTrade} disabled={busy || !wallet} className={`mt-3 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-black disabled:opacity-50 ${side === "buy" ? "bg-[hsl(var(--og-lime))] text-black" : "bg-[hsl(var(--og-blood))] text-white"}`}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Flame className="h-4 w-4" />} {wallet ? (side === "buy" ? "Buy" : "Sell") : "Connect wallet"}
              </button>
            </div>
            <div className="mkt-panel p-4 text-[12px] mkt-muted"><span className="inline-flex items-center gap-1.5 font-bold text-[hsl(var(--mkt-ink))]"><Info className="h-3.5 w-3.5" /> Preview market</span> — price discovery + creator-fee accrual are tracked in-app. For real settlement, launch a pump.fun coin for the collection.</div>
          </div>
        </div>
      )}
    </div>
  );
}

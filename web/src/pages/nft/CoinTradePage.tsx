// OrbitX — trade an NFT like a meme coin (DB-tracked bonding curve).
// Buy/sell on a constant-product curve; creator earns 0.50% per trade.
// Preview market: on-chain SOL settlement activates when the NFT-coin program
// is deployed (docs/NFT_COIN_TRADING.md). Price discovery + fee accrual are real.
import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useWallet } from "@solana/wallet-adapter-react";
import { toast } from "sonner";
import { ArrowLeft, Flame, Loader2, Rocket, TrendingUp, Info } from "lucide-react";
import { getMarketWithNft, getHoldings, listCoinTrades, tradeCoin, enableNftCoin } from "./nftCoin";
import { Media, Empty } from "./_ui";
import { fmtSol, fmtInt, shortAddr, timeAgo } from "./nftMarketData";
import { PriceText } from "./currency";

export default function CoinTradePage() {
  const { nftId } = useParams();
  const { publicKey } = useWallet();
  const wallet = publicKey?.toBase58();
  const qc = useQueryClient();
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: market, isLoading } = useQuery({ queryKey: ["coin-mkt", nftId], enabled: !!nftId, refetchInterval: 15_000, queryFn: () => getMarketWithNft(nftId!) });
  const { data: holdings } = useQuery({ queryKey: ["coin-hold", nftId, wallet], enabled: !!nftId && !!wallet, queryFn: () => getHoldings(nftId!, wallet!) });
  const { data: trades } = useQuery({ queryKey: ["coin-trades", nftId], enabled: !!nftId, refetchInterval: 15_000, queryFn: () => listCoinTrades(nftId!, 30) });

  const refresh = () => { qc.invalidateQueries({ queryKey: ["coin-mkt", nftId] }); qc.invalidateQueries({ queryKey: ["coin-hold", nftId, wallet] }); qc.invalidateQueries({ queryKey: ["coin-trades", nftId] }); };

  const onEnable = async () => {
    if (!wallet) return toast.error("Connect your wallet");
    setBusy(true);
    try { await enableNftCoin(nftId!, wallet); toast.success("Coin market launched"); refresh(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Only the creator can launch this market"); }
    finally { setBusy(false); }
  };

  const onTrade = async () => {
    if (!wallet) return toast.error("Connect your wallet");
    const amt = Number(amount);
    if (!amt || amt <= 0) return toast.error("Enter an amount");
    setBusy(true);
    try {
      const r = await tradeCoin(nftId!, wallet, side, amt);
      toast.success(side === "buy" ? `Bought ${fmtInt(r.tokens)} tokens` : `Sold for ${fmtSol(r.sol)}`);
      setAmount(""); refresh();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Trade failed"); }
    finally { setBusy(false); }
  };

  if (isLoading) return <div className="px-4 py-16 text-center text-sm mkt-muted">Loading market…</div>;

  const nft = market?.nft;
  if (!market) {
    return (
      <div>
        <Link to="/nft" className="mkt-btn ghost mb-4"><ArrowLeft className="h-4 w-4" /> Back</Link>
        <div className="mkt-panel flex flex-col items-center gap-3 px-6 py-16 text-center">
          <Rocket className="h-8 w-8 text-[hsl(var(--og-cyan))]" />
          <div className="text-sm font-bold">No coin market for this NFT yet</div>
          <p className="max-w-sm text-[12px] mkt-muted">The creator can launch a tradeable meme-coin market bound to this NFT — same art, same data, now with a bonding curve.</p>
          <button onClick={onEnable} disabled={busy} className="mkt-btn mt-1">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Flame className="h-4 w-4" />} Launch coin market</button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Link to="/nft" className="mkt-btn ghost mb-4"><ArrowLeft className="h-4 w-4" /> Back to marketplace</Link>
      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        {/* left: market */}
        <div className="space-y-4">
          <div className="mkt-panel flex items-center gap-4 p-4">
            <Media src={nft?.image_url} className="h-20 w-20 rounded-xl" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-xl font-black">{nft?.name ?? "NFT"} <span className="mkt-muted text-sm">/ coin</span></div>
              <div className="mt-1 flex flex-wrap items-center gap-x-5 gap-y-1 text-[13px]">
                <span><span className="mkt-muted">Price </span><PriceText sol={market.last_price_sol} className="mkt-mono font-bold text-[hsl(var(--og-lime))]" /></span>
                <span><span className="mkt-muted">Market cap </span><PriceText sol={market.market_cap_sol} className="mkt-mono font-bold" /></span>
                <span><span className="mkt-muted">Reserves </span><span className="mkt-mono">{fmtSol(market.sol_reserves)}</span></span>
              </div>
            </div>
          </div>

          <div className="mkt-panel p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-black"><TrendingUp className="h-4 w-4 text-[hsl(var(--og-cyan))]" /> Recent trades</div>
            {(trades ?? []).length === 0 ? <Empty label="No trades yet — be the first." /> : (
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

        {/* right: trade panel */}
        <div className="space-y-4">
          <div className="mkt-panel p-4">
            <div className="mb-3 flex gap-1 rounded-xl bg-[hsl(var(--mkt-panel-2))] p-1">
              <button onClick={() => setSide("buy")} className={`flex-1 rounded-lg py-2 text-sm font-black ${side === "buy" ? "bg-[hsl(var(--og-lime))] text-black" : "mkt-muted"}`}>Buy</button>
              <button onClick={() => setSide("sell")} className={`flex-1 rounded-lg py-2 text-sm font-black ${side === "sell" ? "bg-[hsl(var(--og-blood))] text-white" : "mkt-muted"}`}>Sell</button>
            </div>
            <label className="mkt-mono text-[10px] uppercase tracking-widest mkt-muted">{side === "buy" ? "Amount (SOL)" : "Amount (tokens)"}</label>
            <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="0.0"
              className="mt-1 w-full rounded-xl border mkt-hairline bg-[hsl(var(--mkt-panel-2))] px-3 py-2.5 text-sm outline-none focus:border-[hsl(var(--og-cyan))]/60" />
            {side === "buy" ? (
              <div className="mt-2 flex flex-wrap gap-1.5">{[0.1, 0.5, 1, 5].map((v) => <button key={v} onClick={() => setAmount(String(v))} className="mkt-chip px-2 py-1 text-[11px]">{v} SOL</button>)}</div>
            ) : (
              <div className="mt-2 flex items-center justify-between text-[12px] mkt-muted">
                <span>Balance: <span className="mkt-mono">{fmtInt(holdings)}</span></span>
                <button onClick={() => setAmount(String(holdings ?? 0))} className="mkt-chip px-2 py-1 text-[11px]">Max</button>
              </div>
            )}
            <button onClick={onTrade} disabled={busy || !wallet} className={`mt-3 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-black disabled:opacity-50 ${side === "buy" ? "bg-[hsl(var(--og-lime))] text-black" : "bg-[hsl(var(--og-blood))] text-white"}`}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Flame className="h-4 w-4" />} {wallet ? (side === "buy" ? "Buy" : "Sell") : "Connect wallet"}
            </button>
          </div>

          <div className="mkt-panel p-4 text-[12px] mkt-muted">
            <div className="mb-1 flex items-center gap-1.5 font-bold text-[hsl(var(--mkt-ink))]"><Info className="h-3.5 w-3.5" /> How it works</div>
            1% fee per trade → 0.50% to the creator (claimable), 0.50% platform. Price moves on a bonding curve. This is a preview market: SOL settles on-chain once the OrbitX NFT-coin program is deployed; price discovery and creator-fee accrual are live now.
          </div>
        </div>
      </div>
    </div>
  );
}

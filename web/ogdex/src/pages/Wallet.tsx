import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { getWallet, WalletPortfolio, WalletHolding, fmtUsd, compact, short, isWatched, toggleWatch } from "../lib/api";
import TokenLogo from "../components/TokenLogo";
import Copyable from "../components/Copyable";
import Change from "../components/Change";
import { ArrowLeft, Loader2, Wallet as WalletIcon, ExternalLink, Star, RefreshCw, Eye, EyeOff, Coins } from "lucide-react";

const SOL_MINT = "So11111111111111111111111111111111111111112";

export default function Wallet() {
  const { address = "" } = useParams();
  const [d, setD] = useState<WalletPortfolio | null>(null);
  const [loading, setLoading] = useState(true);
  const [watched, setWatched] = useState(false);
  const [hideDust, setHideDust] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = () => { setRefreshing(true); getWallet(address).then((x) => { setD(x); setLoading(false); setRefreshing(false); }); };
  useEffect(() => { setLoading(true); load(); setWatched(isWatched(address)); /* eslint-disable-next-line */ }, [address]);

  const rows: (WalletHolding & { isSol?: boolean })[] = useMemo(() => {
    if (!d?.ok) return [];
    const sol: any = { mint: SOL_MINT, isSol: true, uiAmount: d.sol, decimals: 9, priceUsd: d.solPrice, usdValue: d.solUsd, name: "Solana", symbol: "SOL", image: "https://wsrv.nl/?url=https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png" };
    const list = [sol, ...d.holdings];
    return hideDust ? list.filter((h) => (h.usdValue || 0) >= 0.01 || h.isSol) : list;
  }, [d, hideDust]);

  const total = d?.totalUsd || 0;

  if (loading) return <div className="grid place-items-center py-24 text-muted"><Loader2 className="w-6 h-6 animate-spin" /></div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-white"><ArrowLeft className="w-4 h-4" /> Screener</Link>
        <button onClick={load} className="btn bg-panel2 text-muted hover:text-white inline-flex items-center gap-1.5 text-xs"><RefreshCw className={`w-3 h-3 ${refreshing ? "animate-spin" : ""}`} /> Refresh</button>
      </div>

      {/* Header */}
      <div className="card p-5 mb-4">
        <div className="flex flex-wrap items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-accent/15 border border-accent/30 grid place-items-center shrink-0"><WalletIcon className="w-7 h-7 text-accent" /></div>
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-wide text-muted">Wallet portfolio</div>
            <div className="mt-0.5"><Copyable text={address} display={short(address)} className="text-sm" /></div>
            <div className="text-4xl font-bold mt-2">{fmtUsd(total)}</div>
            <div className="text-xs text-muted mt-1">{d?.tokenCount ?? 0} tokens · {d?.sol?.toLocaleString(undefined, { maximumFractionDigits: 3 })} SOL</div>
            {d?.pnl && (d.pnl.closedTrades || 0) > 0 && (
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <span className={`pill ${d.pnl.realizedPnlUsd >= 0 ? "bg-up/15 text-up" : "bg-down/15 text-down"}`}>Realized PnL {d.pnl.realizedPnlUsd >= 0 ? "+" : ""}{fmtUsd(d.pnl.realizedPnlUsd)}</span>
                {d.pnl.winRate != null && <span className="pill bg-panel2 text-muted">Win rate {d.pnl.winRate}%</span>}
                <span className="pill bg-panel2 text-muted">{d.pnl.closedTrades} closed trades</span>
                <span className="text-[10px] text-muted/60 self-center">recent activity</span>
              </div>
            )}
          </div>
          <div className="sm:ml-auto flex flex-wrap gap-2">
            <button onClick={() => setWatched(toggleWatch(address))} className={`btn inline-flex items-center gap-1.5 ${watched ? "bg-accent text-black font-semibold" : "bg-panel2 text-muted hover:text-white"}`}>
              <Star className={`w-3.5 h-3.5 ${watched ? "fill-black" : ""}`} /> {watched ? "Watching" : "Watch wallet"}
            </button>
            <a href={`https://solscan.io/account/${address}`} target="_blank" rel="noreferrer" className="btn bg-panel2 text-muted hover:text-white inline-flex items-center gap-1.5">Solscan <ExternalLink className="w-3 h-3" /></a>
          </div>
        </div>
      </div>

      {!d?.ok && <div className="card p-10 text-center text-muted">Could not load this wallet. {d?.error}</div>}

      {d?.ok && (
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-line flex items-center gap-2">
            <Coins className="w-4 h-4 text-accent" /><span className="text-sm font-semibold">Holdings</span>
            <span className="text-xs text-muted">click any token for charts & data</span>
            <button onClick={() => setHideDust((v) => !v)} className="ml-auto btn bg-panel2 text-muted hover:text-white inline-flex items-center gap-1.5 text-xs">
              {hideDust ? <><Eye className="w-3 h-3" /> Show dust</> : <><EyeOff className="w-3 h-3" /> Hide dust</>}
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[680px]">
              <thead><tr className="text-muted text-xs border-b border-line">
                <th className="text-left px-4 py-2">Token</th><th className="text-right px-2 py-2">Amount</th>
                <th className="text-right px-2 py-2">Price</th><th className="text-right px-2 py-2">24h</th>
                <th className="text-right px-2 py-2">Market Cap</th><th className="text-right px-2 py-2 w-40">Value</th>
                <th className="text-right px-4 py-2 w-24">% Port.</th>
              </tr></thead>
              <tbody>
                {rows.map((h) => {
                  const pctPort = total > 0 ? ((h.usdValue || 0) / total) * 100 : 0;
                  const inner = (
                    <>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <TokenLogo src={h.image} sym={h.symbol || ""} size={30} />
                          <div className="min-w-0">
                            <div className="font-semibold truncate flex items-center gap-1.5">{h.symbol || short(h.mint)}{(h as any).isSol && <span className="pill bg-panel2 text-muted text-[9px]">native</span>}</div>
                            <div className="text-[11px] text-muted truncate">{h.name || "Unknown token"}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-2 py-2.5 text-right tabular-nums">{compact(h.uiAmount)}</td>
                      <td className="px-2 py-2.5 text-right tabular-nums">{fmtUsd(h.priceUsd)}</td>
                      <td className="px-2 py-2.5 text-right"><Change v={h.change24h} /></td>
                      <td className="px-2 py-2.5 text-right tabular-nums text-muted">{h.mcap ? "$" + compact(h.mcap) : "—"}</td>
                      <td className="px-2 py-2.5 text-right font-semibold tabular-nums">{fmtUsd(h.usdValue)}</td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="flex items-center gap-2 justify-end"><div className="w-12 h-1.5 bg-panel2 rounded-full overflow-hidden"><div className="h-full bg-accent" style={{ width: `${Math.min(pctPort, 100)}%` }} /></div><span className="text-xs text-muted w-9">{pctPort.toFixed(1)}%</span></div>
                      </td>
                    </>
                  );
                  return (h as any).isSol
                    ? <tr key={h.mint} className="border-b border-line/50">{inner}</tr>
                    : <tr key={h.mint} className="border-b border-line/50 hover:bg-panel2/40 cursor-pointer" onClick={() => (window.location.href = `/token/${h.mint}`)}>{inner}</tr>;
                })}
              </tbody>
            </table>
          </div>
          {!rows.length && <div className="p-10 text-center text-muted text-sm">No holdings found.</div>}
        </div>
      )}
      <p className="text-[11px] text-muted text-center mt-4">Balances via on-chain RPC · prices from Jupiter · metadata from GeckoTerminal. Values are estimates.</p>
    </div>
  );
}

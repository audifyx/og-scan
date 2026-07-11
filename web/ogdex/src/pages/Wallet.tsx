import { useEffect, useMemo, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useWallet } from "../lib/wallet";
import { getWallet, getSwaps, WalletPortfolio, WalletHolding, WalletTrade, fmtUsd, compact, short, isWatched, toggleWatch } from "../lib/api";
import { timeAgo } from "../lib/format";
import TokenLogo from "../components/TokenLogo";
import Copyable from "../components/Copyable";
import WalletShareButton from "../components/WalletShareButton";
import Change from "../components/Change";
import { ArrowLeft, Loader2, Wallet as WalletIcon, ExternalLink, Star, RefreshCw, Eye, EyeOff, Coins, TrendingUp, Zap, History, Bell, BellPlus, CheckCircle2, AlertTriangle } from "lucide-react";

const SOL_MINT = "So11111111111111111111111111111111111111112";

export default function Wallet() {
  const { address = "" } = useParams();
  const nav = useNavigate();
  const [d, setD] = useState<WalletPortfolio | null>(null);
  const [loading, setLoading] = useState(true);
  const [watched, setWatched] = useState(false);
  const [hideDust, setHideDust] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [trades, setTrades] = useState<WalletTrade[] | null>(null);
  const { address: owner, connect, connecting } = useWallet();
  const [showNotify, setShowNotify] = useState(false);
  const [nChan, setNChan] = useState<"telegram" | "webhook">(() => (typeof localStorage !== "undefined" && (localStorage.getItem("ogdex.alertChan") as any)) || "telegram");
  const [nTarget, setNTarget] = useState<string>(() => (typeof localStorage !== "undefined" && localStorage.getItem("ogdex.alertTarget")) || "");
  const [nBusy, setNBusy] = useState(false);
  const [nMsg, setNMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const createWalletAlert = async () => {
    setNMsg(null);
    if (!owner) { await connect(); return; }
    const tgt = nTarget.trim();
    if (nChan === "telegram" ? !/^(-?\d{4,}|@[A-Za-z0-9_]{4,})$/.test(tgt) : !/^https?:\/\//i.test(tgt)) {
      setNMsg({ ok: false, text: nChan === "telegram" ? "Enter your Telegram chat ID or @channel" : "Enter a webhook URL" }); return;
    }
    setNBusy(true);
    try {
      localStorage.setItem("ogdex.alertChan", nChan); localStorage.setItem("ogdex.alertTarget", tgt);
      const r = await fetch("/api/ogdex/alerts", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet: owner, alert: { type: "wallet_trade", watch: address, label: short(address), channel: nChan, target: tgt } }) });
      const dd = await r.json();
      if (!dd.ok) throw new Error(dd.error || "Could not create alert");
      setNMsg({ ok: true, text: "You will be notified when this wallet trades" });
    } catch (e: any) { setNMsg({ ok: false, text: e?.message || "Failed" }); } finally { setNBusy(false); }
  };

  const load = () => { setRefreshing(true); getWallet(address).then((x) => { setD(x); setLoading(false); setRefreshing(false); }); };
  useEffect(() => { setLoading(true); load(); setWatched(isWatched(address)); /* eslint-disable-next-line */ }, [address]);
  useEffect(() => { let on = true; setTrades(null); getSwaps(address, 25).then((x) => { if (on) setTrades(x.ok ? x.trades : []); }).catch(() => { if (on) setTrades([]); }); return () => { on = false; }; }, [address]);

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
            {d?.pnl && ((d.pnl.closedTrades || 0) > 0 || (d.pnl.openPositions || 0) > 0) && (
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                {d.pnl.totalPnlUsd != null && (
                  <span className={`pill ${d.pnl.totalPnlUsd >= 0 ? "bg-up/15 text-up" : "bg-down/15 text-down"}`}>Total PnL {d.pnl.totalPnlUsd >= 0 ? "+" : ""}{fmtUsd(d.pnl.totalPnlUsd)}</span>
                )}
                <span className={`pill ${d.pnl.realizedPnlUsd >= 0 ? "bg-up/15 text-up" : "bg-down/15 text-down"}`}>Realized {d.pnl.realizedPnlUsd >= 0 ? "+" : ""}{fmtUsd(d.pnl.realizedPnlUsd)}</span>
                {d.pnl.unrealizedPnlUsd != null && (
                  <span className={`pill ${d.pnl.unrealizedPnlUsd >= 0 ? "bg-up/15 text-up" : "bg-down/15 text-down"}`}>Unrealized {d.pnl.unrealizedPnlUsd >= 0 ? "+" : ""}{fmtUsd(d.pnl.unrealizedPnlUsd)}</span>
                )}
                {d.pnl.winRate != null && <span className="pill bg-panel2 text-muted">Win rate {d.pnl.winRate}%</span>}
                <span className="pill bg-panel2 text-muted">{d.pnl.closedTrades} closed · {d.pnl.openPositions} open</span>
                <span className="text-[10px] text-muted/60 self-center">recent activity</span>
                <WalletShareButton address={address} pnl={d.pnl.totalPnlUsd ?? d.pnl.realizedPnlUsd} win={d.pnl.winRate} trades={d.pnl.closedTrades} />
              </div>
            )}
          </div>
          <div className="sm:ml-auto flex flex-wrap gap-2">
            <button onClick={() => setWatched(toggleWatch(address))} className={`btn inline-flex items-center gap-1.5 ${watched ? "bg-accent text-black font-semibold" : "bg-panel2 text-muted hover:text-white"}`}>
              <Star className={`w-3.5 h-3.5 ${watched ? "fill-black" : ""}`} /> {watched ? "Watching" : "Watch wallet"}
            </button>
            <button onClick={() => setShowNotify((v) => !v)} className="btn bg-panel2 text-muted hover:text-white inline-flex items-center gap-1.5"><Bell className="w-3.5 h-3.5" /> Notify on trades</button>
            <a href={`https://solscan.io/account/${address}`} target="_blank" rel="noreferrer" className="btn bg-panel2 text-muted hover:text-white inline-flex items-center gap-1.5">Solscan <ExternalLink className="w-3 h-3" /></a>
          </div>
        </div>
        {showNotify && (
          <div className="mt-4 rounded-xl border border-line bg-panel2/30 p-3 text-xs">
            <div className="mb-2 flex items-center gap-1.5 font-semibold text-white"><Bell className="h-3.5 w-3.5 text-accent" /> Get notified when this wallet trades</div>
            <div className="grid grid-cols-2 gap-1 rounded-lg bg-panel2/60 p-1 mb-2 max-w-xs">
              <button onClick={() => setNChan("telegram")} className={`rounded-md py-1.5 text-[11px] font-semibold transition ${nChan === "telegram" ? "bg-accent/15 text-accent" : "text-muted hover:text-white"}`}>Telegram</button>
              <button onClick={() => setNChan("webhook")} className={`rounded-md py-1.5 text-[11px] font-semibold transition ${nChan === "webhook" ? "bg-accent/15 text-accent" : "text-muted hover:text-white"}`}>Webhook</button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input value={nTarget} onChange={(e) => setNTarget(e.target.value)} placeholder={nChan === "telegram" ? "Telegram chat ID or @channel" : "Discord/Slack/webhook URL"} className="inp flex-1 min-w-[220px]" />
              <button onClick={createWalletAlert} disabled={nBusy || connecting} className="btn bg-accent text-black font-semibold inline-flex items-center gap-1.5">{nBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <BellPlus className="h-4 w-4" />}{owner ? "Create alert" : "Connect & create"}</button>
            </div>
            {nMsg && <div className={`mt-2 flex items-center gap-1.5 ${nMsg.ok ? "text-up" : "text-down"}`}>{nMsg.ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}{nMsg.text}</div>}
            <p className="mt-2 text-[10px] text-muted/70">Notify-only — ORBITX_DEX never copies or auto-executes trades. Manage alerts on the Alerts page.</p>
          </div>
        )}
      </div>

      {/* ── Summary stats ── */}
      {d?.ok && (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 mb-4">
          <SCard label="Portfolio" value={fmtUsd(total)} />
          <SCard label="SOL balance" value={(d.sol || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })} sub={fmtUsd(d.solUsd)} />
          <SCard label="Tokens held" value={String(d.tokenCount || 0)} />
          <SCard label="Win rate" value={d.pnl?.winRate != null ? d.pnl.winRate + "%" : "—"} sub={d.pnl ? `${d.pnl.closedTrades} closed` : undefined} />
          {d.pnl && (
            <>
              <SCard label="Realized PnL" value={(d.pnl.realizedPnlUsd >= 0 ? "+" : "") + fmtUsd(d.pnl.realizedPnlUsd)} tone={d.pnl.realizedPnlUsd >= 0 ? "up" : "down"} />
              <SCard label="Unrealized PnL" value={d.pnl.unrealizedPnlUsd != null ? (d.pnl.unrealizedPnlUsd >= 0 ? "+" : "") + fmtUsd(d.pnl.unrealizedPnlUsd) : "—"} tone={d.pnl.unrealizedPnlUsd != null ? (d.pnl.unrealizedPnlUsd >= 0 ? "up" : "down") : undefined} />
              <SCard label="Net PnL" value={d.pnl.totalPnlUsd != null ? (d.pnl.totalPnlUsd >= 0 ? "+" : "") + fmtUsd(d.pnl.totalPnlUsd) : "—"} tone={d.pnl.totalPnlUsd != null ? (d.pnl.totalPnlUsd >= 0 ? "up" : "down") : undefined} />
              <SCard label="Activity" value={`${d.pnl.openPositions} open`} sub={`${d.pnl.totalSwaps} swaps`} />
            </>
          )}
        </div>
      )}

      {/* ── Allocation ── */}
      {d?.ok && total > 0 && rows.length > 0 && (() => {
        const COLORS = ["#00FFA3", "#00D1FF", "#14E0C8", "#FFC53D", "#FF6BD0", "#19E3D0", "#FF8A3D", "#7B5BFF"];
        const top = rows.slice(0, 8);
        const otherVal = rows.slice(8).reduce((a, h) => a + (h.usdValue || 0), 0);
        return (
          <div className="card p-4 mb-4">
            <div className="mb-2 text-xs font-semibold text-muted">Portfolio allocation</div>
            <div className="flex h-3 w-full overflow-hidden rounded-full bg-panel2">
              {top.map((h, i) => (
                <div key={h.mint} title={`${h.symbol || short(h.mint)} ${(((h.usdValue || 0) / total) * 100).toFixed(1)}%`} style={{ width: `${((h.usdValue || 0) / total) * 100}%`, background: COLORS[i % COLORS.length] }} />
              ))}
              {otherVal > 0 && <div style={{ width: `${(otherVal / total) * 100}%`, background: "#3a4250" }} />}
            </div>
            <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1.5 text-[11px]">
              {top.map((h, i) => (
                <span key={h.mint} className="inline-flex items-center gap-1.5 text-muted">
                  <span className="h-2 w-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                  <span className="text-white/85 font-medium">{h.symbol || short(h.mint)}</span> {(((h.usdValue || 0) / total) * 100).toFixed(1)}%
                </span>
              ))}
              {otherVal > 0 && <span className="inline-flex items-center gap-1.5 text-muted"><span className="h-2 w-2 rounded-full" style={{ background: "#3a4250" }} /> Other {((otherVal / total) * 100).toFixed(1)}%</span>}
            </div>
          </div>
        );
      })()}

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
                    : <tr key={h.mint} className="border-b border-line/50 hover:bg-panel2/40 cursor-pointer" onClick={() => nav(`/token/${h.mint}`)}>{inner}</tr>;
                })}
              </tbody>
            </table>
          </div>
          {!rows.length && <div className="p-10 text-center text-muted text-sm">No holdings found.</div>}
        </div>
      )}
      {d?.ok && d.pnl && (d.pnl.perToken || []).some((t) => (t.closedTrades || 0) > 0 || t.open) && (
        <div className="card overflow-hidden mt-4">
          <div className="px-4 py-3 border-b border-line flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-accent" /><span className="text-sm font-semibold">Per-token PnL</span>
            <span className="text-xs text-muted">realized + unrealized from recent swaps</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead><tr className="text-muted text-xs border-b border-line">
                <th className="text-left px-4 py-2">Token</th>
                <th className="text-right px-2 py-2">Realized</th>
                <th className="text-right px-2 py-2">Unrealized</th>
                <th className="text-right px-2 py-2">Total</th>
                <th className="text-right px-2 py-2">Win rate</th>
                <th className="text-right px-4 py-2">Status</th>
              </tr></thead>
              <tbody>
                {(d.pnl.perToken || []).filter((t) => (t.closedTrades || 0) > 0 || t.open).slice(0, 30).map((t) => (
                  <tr key={t.mint} className="border-b border-line/50 hover:bg-panel2/40 cursor-pointer" onClick={() => nav(`/token/${t.mint}`)}>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <TokenLogo src={t.image} sym={t.symbol || ""} size={26} />
                        <div className="min-w-0"><div className="font-semibold truncate">{t.symbol || short(t.mint)}</div><div className="text-[11px] text-muted truncate">{t.name || "Unknown"}</div></div>
                      </div>
                    </td>
                    <td className={`px-2 py-2.5 text-right tabular-nums ${t.realizedUsd >= 0 ? "text-up" : "text-down"}`}>{t.closedTrades > 0 ? (t.realizedUsd >= 0 ? "+" : "") + fmtUsd(t.realizedUsd) : "—"}</td>
                    <td className={`px-2 py-2.5 text-right tabular-nums ${(t.unrealizedUsd || 0) >= 0 ? "text-up" : "text-down"}`}>{t.unrealizedUsd != null ? (t.unrealizedUsd >= 0 ? "+" : "") + fmtUsd(t.unrealizedUsd) : "—"}</td>
                    <td className={`px-2 py-2.5 text-right font-semibold tabular-nums ${(t.totalUsd || 0) >= 0 ? "text-up" : "text-down"}`}>{(t.totalUsd || 0) >= 0 ? "+" : ""}{fmtUsd(t.totalUsd)}</td>
                    <td className="px-2 py-2.5 text-right text-muted tabular-nums">{t.winRate != null ? t.winRate + "%" : "—"}</td>
                    <td className="px-4 py-2.5 text-right">{t.open ? <span className="pill bg-accent/15 text-accent text-[10px]">Open</span> : <span className="pill bg-panel2 text-muted text-[10px]">Closed</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {d?.ok && trades && trades.length > 0 && (
        <div className="card overflow-hidden mt-4">
          <div className="px-4 py-3 border-b border-line flex items-center gap-2">
            <History className="w-4 h-4 text-accent" /><span className="text-sm font-semibold">Recent trades</span>
            <span className="text-xs text-muted">last {trades.length} swaps · tap Ape to mirror</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[620px]">
              <thead><tr className="text-muted text-xs border-b border-line">
                <th className="text-left px-4 py-2">Token</th>
                <th className="text-left px-2 py-2">Side</th>
                <th className="text-right px-2 py-2">Amount</th>
                <th className="text-right px-2 py-2">Value</th>
                <th className="text-right px-2 py-2">When</th>
                <th className="text-right px-4 py-2">Action</th>
              </tr></thead>
              <tbody>
                {trades.map((t, i) => (
                  <tr key={(t.txHash || "") + i} className="border-b border-line/50 hover:bg-panel2/40">
                    <td className="px-4 py-2.5">
                      <Link to={`/token/${t.mint}`} className="flex items-center gap-2.5 min-w-0">
                        <TokenLogo src={t.image} sym={t.symbol || ""} size={26} />
                        <div className="min-w-0"><div className="font-semibold truncate">{t.symbol || short(t.mint)}</div><div className="text-[11px] text-muted truncate">{t.name || "Unknown"}</div></div>
                      </Link>
                    </td>
                    <td className="px-2 py-2.5"><span className={`pill text-[10px] ${t.side === "buy" ? "bg-up/15 text-up" : "bg-down/15 text-down"}`}>{t.side.toUpperCase()}</span></td>
                    <td className="px-2 py-2.5 text-right tabular-nums">{t.solAmount.toFixed(3)} SOL</td>
                    <td className="px-2 py-2.5 text-right tabular-nums text-muted">{t.usd != null ? fmtUsd(t.usd, { compact: true }) : "—"}</td>
                    <td className="px-2 py-2.5 text-right text-muted tabular-nums whitespace-nowrap">{t.time ? timeAgo(t.time) : "—"}</td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="inline-flex items-center gap-2 justify-end">
                        <Link to={`/token/${t.mint}`} className="inline-flex items-center gap-1 rounded-lg bg-accent/15 px-2.5 py-1 text-[11px] font-bold text-accent hover:bg-accent/25"><Zap className="w-3 h-3" /> Ape</Link>
                        {t.txHash && <a href={`https://solscan.io/tx/${t.txHash}`} target="_blank" rel="noreferrer" className="text-muted hover:text-white" title="View tx"><ExternalLink className="w-3.5 h-3.5" /></a>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2 text-[10px] text-muted border-t border-line/50">Ape opens the token trade panel — you review, size and sign every trade yourself. Mirroring is manual and non-custodial.</div>
        </div>
      )}

      <p className="text-[11px] text-muted text-center mt-4">Balances via on-chain RPC · prices from Jupiter · metadata from GeckoTerminal. Values are estimates.</p>
    </div>
  );
}

function SCard({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "up" | "down" }) {
  return (
    <div className="rounded-2xl border border-line bg-panel2/50 p-3.5">
      <div className="text-[10px] uppercase tracking-wider text-muted">{label}</div>
      <div className={`mt-1 text-lg font-black tabular-nums ${tone === "up" ? "text-up" : tone === "down" ? "text-down" : "text-white"}`}>{value}</div>
      {sub && <div className="text-[11px] text-muted mt-0.5">{sub}</div>}
    </div>
  );
}

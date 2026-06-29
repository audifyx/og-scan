import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getLeaderboard, LeaderboardEntry, fmtUsd, short } from "../lib/api";
import { Trophy, Loader2, ArrowLeft, ExternalLink, Crown } from "lucide-react";

export default function Leaderboard() {
  const [entries, setEntries] = useState<LeaderboardEntry[] | null>(null);
  const [at, setAt] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { let on = true; setLoading(true); getLeaderboard().then((d) => { if (on) { setEntries(d.ok ? d.entries : []); setAt(d.at || null); setLoading(false); } }).catch(() => { if (on) { setEntries([]); setLoading(false); } }); return () => { on = false; }; }, []);

  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      <div className="mb-4"><Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-white"><ArrowLeft className="w-4 h-4" /> Discovery</Link></div>
      <div className="mb-6 text-center">
        <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl border border-accent/20 bg-accent/10"><Trophy className="h-7 w-7 text-accent" /></div>
        <h1 className="text-2xl font-black tracking-tight">Trader Leaderboard</h1>
        <p className="mt-2 text-sm text-muted">Realized PnL and win rate from recent on-chain swaps, ranked across tracked KOL / smart-money wallets.</p>
      </div>

      {loading ? <div className="grid place-items-center py-16 text-muted"><Loader2 className="h-6 w-6 animate-spin" /></div>
        : !entries || entries.length === 0 ? (
          <div className="card p-10 text-center space-y-3">
            <Trophy className="h-10 w-10 text-accent/40 mx-auto" />
            <p className="text-white font-semibold">Loading trader stats…</p>
            <p className="text-sm text-muted">PnL is computed live from on-chain swaps for {">"}35 tracked KOL wallets. This takes ~30s on the first load.</p>
            <button onClick={() => { setLoading(true); getLeaderboard().then((d) => { setEntries(d.ok ? d.entries : []); setAt(d.at || null); setLoading(false); }); }}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-semibold text-accent border border-accent/30 hover:bg-accent/10 transition-colors">
              Retry
            </button>
          </div>
        )
        : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[760px]">
              <thead><tr className="text-muted text-xs border-b border-line">
                <th className="text-left px-4 py-2.5">#</th>
                <th className="text-left px-2 py-2.5">Trader</th>
                <th className="text-right px-2 py-2.5">Realized PnL</th>
                <th className="text-right px-2 py-2.5">SOL</th>
                <th className="text-right px-2 py-2.5">Win rate</th>
                <th className="text-right px-2 py-2.5">Closed</th>
                <th className="text-right px-2 py-2.5">Open</th>
                <th className="text-right px-2 py-2.5">Swaps</th>
                <th className="text-right px-4 py-2.5">Wallet</th>
              </tr></thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.address} className="border-b border-line/50 hover:bg-panel2/40">
                    <td className="px-4 py-2.5 tabular-nums">{e.rank <= 3 ? <Crown className={`inline h-4 w-4 ${e.rank === 1 ? "text-yellow-300" : e.rank === 2 ? "text-slate-300" : "text-amber-600"}`} /> : e.rank}</td>
                    <td className="px-2 py-2.5">
                      <Link to={`/wallet/${e.address}`} className="flex items-center gap-2.5 min-w-0">
                        {e.avatar ? <img src={e.avatar} alt="" className="h-7 w-7 rounded-full object-cover" /> : <div className="h-7 w-7 rounded-full bg-panel2 grid place-items-center text-[10px] text-muted">{(e.name || e.address).slice(0, 2)}</div>}
                        <div className="min-w-0"><div className="font-semibold truncate">{e.name || short(e.address)}</div>{e.twitter && <div className="text-[11px] text-muted truncate">@{String(e.twitter).replace(/^@/, "")}</div>}</div>
                      </Link>
                    </td>
                    <td className={`px-2 py-2.5 text-right font-semibold tabular-nums ${e.realizedPnlUsd >= 0 ? "text-up" : "text-down"}`}>{e.realizedPnlUsd >= 0 ? "+" : ""}{fmtUsd(e.realizedPnlUsd)}</td>
                    <td className={`px-2 py-2.5 text-right tabular-nums ${e.realizedPnlSol >= 0 ? "text-up/80" : "text-down/80"}`}>{e.realizedPnlSol >= 0 ? "+" : ""}{e.realizedPnlSol.toFixed(2)}</td>
                    <td className="px-2 py-2.5 text-right tabular-nums text-muted">{e.winRate != null ? e.winRate + "%" : "—"}</td>
                    <td className="px-2 py-2.5 text-right tabular-nums text-muted">{e.closedTrades}</td>
                    <td className="px-2 py-2.5 text-right tabular-nums text-muted">{e.openPositions ?? "—"}</td>
                    <td className="px-2 py-2.5 text-right tabular-nums text-muted">{e.totalSwaps ?? "—"}</td>
                    <td className="px-4 py-2.5 text-right"><a href={`https://solscan.io/account/${e.address}`} target="_blank" rel="noreferrer" className="text-muted hover:text-white inline-flex items-center gap-1 justify-end"><ExternalLink className="h-3.5 w-3.5" /></a></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {at && <div className="px-4 py-2 text-[10px] text-muted border-t border-line/50">Updated {new Date(at).toLocaleString()} · realized PnL from recent swaps · estimates, not financial advice.</div>}
        </div>
      )}
    </div>
  );
}

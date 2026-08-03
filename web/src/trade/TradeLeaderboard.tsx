import { useEffect, useState } from "react";
import { Loader2, Trophy, ExternalLink } from "lucide-react";
import { fetchLeaderboard, type LeaderEntry } from "./tradeApi";
import { fmtUsd, shortAddr } from "./tradeFmt";

export default function TradeLeaderboard() {
  const [rows, setRows] = useState<LeaderEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    let on = true;
    setLoading(true);
    fetchLeaderboard()
      .then((entries) => {
        if (!on) return;
        setRows(entries);
        if (!entries.length) setErr("Leaderboard empty or still computing");
        setLoading(false);
      })
      .catch(() => {
        if (!on) return;
        setErr("Could not load leaderboard");
        setLoading(false);
      });
    return () => {
      on = false;
    };
  }, []);

  return (
    <div className="flex h-full flex-col bg-black">
      <div className="border-b border-white/10 px-4 py-4">
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-white" />
          <h1 className="text-base font-bold">Trader leaderboard</h1>
        </div>
        <p className="mt-1 text-[12px] text-white/40">
          Tracked wallets ranked by realized PnL, win rate, and closed trades
        </p>
      </div>

      <div className="grid grid-cols-5 gap-1 border-b border-white/10 px-3 py-2 font-mono text-[9px] uppercase tracking-wider text-white/30">
        <span>#</span>
        <span className="col-span-2">Trader</span>
        <span className="text-right">W/L</span>
        <span className="text-right">PnL</span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-white/30" />
          </div>
        ) : !rows.length ? (
          <p className="px-4 py-16 text-center text-sm text-white/35">{err || "No data"}</p>
        ) : (
          rows.map((e) => {
            // API winRate is 0–100
            const wr = e.winRate != null ? e.winRate / 100 : 0;
            const wins = Math.round(wr * (e.closedTrades || 0));
            const losses = Math.max(0, (e.closedTrades || 0) - wins);
            return (
              <a
                key={e.address}
                href={`https://solscan.io/account/${e.address}`}
                target="_blank"
                rel="noreferrer"
                className="grid grid-cols-5 items-center gap-1 border-b border-white/[0.06] px-3 py-3 hover:bg-white/[0.04]"
              >
                <span className="font-mono text-xs text-white/40">{e.rank}</span>
                <div className="col-span-2 flex min-w-0 items-center gap-2">
                  {e.avatar ? (
                    <img src={e.avatar} alt="" className="h-8 w-8 rounded-full object-cover" />
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-[10px] font-bold">
                      {(e.name || e.address).slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold">{e.name || shortAddr(e.address)}</p>
                    <p className="truncate font-mono text-[10px] text-white/30">
                      {e.twitter ? `@${e.twitter}` : shortAddr(e.address, 4)}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-mono text-[11px]">
                    <span className="text-green-400">{wins}</span>
                    <span className="text-white/20">/</span>
                    <span className="text-red-400">{losses}</span>
                  </p>
                  <p className="font-mono text-[9px] text-white/30">
                    {e.winRate != null ? `${Number(e.winRate).toFixed(0)}%` : "—"}
                  </p>
                </div>
                <div className="flex items-center justify-end gap-1">
                  <p
                    className={`font-mono text-xs font-semibold ${
                      e.realizedPnlUsd >= 0 ? "text-green-400" : "text-red-400"
                    }`}
                  >
                    {fmtUsd(e.realizedPnlUsd)}
                  </p>
                  <ExternalLink className="h-3 w-3 text-white/20" />
                </div>
              </a>
            );
          })
        )}
      </div>
    </div>
  );
}

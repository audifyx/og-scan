import { useEffect, useState } from "react";
import { Loader2, Trophy, ExternalLink } from "lucide-react";
import { fetchLeaderboard, type LeaderEntry } from "./tradeApi";
import { fmtUsd, shortAddr } from "./tradeFmt";
import "./trade-leaderboard.css";

export default function TradeLeaderboard() {
  const [rows, setRows] = useState<LeaderEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [timeframe, setTimeframe] = useState("24h");

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
    <div className="tl">
      <div className="tl__top">
        <div className="tl__header">
          <h1 className="tl__title">Leaderboard</h1>
          <p className="tl__subtitle">Top traders by realized PnL</p>
        </div>
        
        <div className="tl__filters">
          {["24h", "7d", "30d", "All"].map((tf) => (
            <button
              key={tf}
              type="button"
              className={`tl__filter ${timeframe === tf ? "tl__filter--on" : ""}`}
              onClick={() => setTimeframe(tf)}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      <div className="tl__list">
        {loading ? (
          <div className="tl__loading">
            <Loader2 className="tl__spin" />
            <p>Loading leaderboard…</p>
          </div>
        ) : !rows.length ? (
          <div className="tl__empty">
            <p>{err || "No data"}</p>
          </div>
        ) : (
          <div className="tl__rows">
            {rows.map((e, idx) => {
              const wr = e.winRate != null ? e.winRate / 100 : 0;
              const wins = Math.round(wr * (e.closedTrades || 0));
              const losses = Math.max(0, (e.closedTrades || 0) - wins);
              const isProfitable = e.realizedPnlUsd >= 0;
              
              return (
                <a
                  key={e.address}
                  href={`https://solscan.io/account/${e.address}`}
                  target="_blank"
                  rel="noreferrer"
                  className="tl__row"
                >
                  <div className="tl__rank-badge">{idx + 1}</div>
                  
                  <div className="tl__trader">
                    {e.avatar ? (
                      <img src={e.avatar} alt="" className="tl__avatar" />
                    ) : (
                      <div className="tl__avatar-fallback">
                        {(e.name || e.address).slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div className="tl__trader-info">
                      <p className="tl__name">{e.name || shortAddr(e.address)}</p>
                      <p className="tl__handle">
                        {e.twitter ? `@${e.twitter}` : shortAddr(e.address, 4)}
                      </p>
                    </div>
                  </div>
                  
                  <div className="tl__stats">
                    <div className="tl__stat">
                      <span className="tl__stat-label">W/L</span>
                      <p className="tl__stat-value">
                        <span className="tl__win">{wins}</span>
                        <span className="tl__sep">/</span>
                        <span className="tl__loss">{losses}</span>
                      </p>
                    </div>
                    
                    <div className="tl__stat">
                      <span className="tl__stat-label">Win%</span>
                      <p className="tl__stat-value">
                        {e.winRate != null ? `${Number(e.winRate).toFixed(0)}%` : "—"}
                      </p>
                    </div>
                    
                    <div className="tl__stat">
                      <span className="tl__stat-label">PnL</span>
                      <p className={`tl__stat-value ${isProfitable ? "tl__stat-gain" : "tl__stat-loss"}`}>
                        {fmtUsd(e.realizedPnlUsd)}
                      </p>
                    </div>
                  </div>
                  
                  <div className="tl__link">
                    <ExternalLink className="h-4 w-4" />
                  </div>
                </a>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

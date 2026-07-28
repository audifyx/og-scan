import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { listPositions, listTrades } from "@/lib/predictions/api";
import { fmtUsd, fmtCents } from "@/lib/predictions/types";
import { DEMO_MARKETS } from "@/lib/predictions/api";
import { usePredictionsContext } from "./PredictionsLayout";

function marketQuestion(id: string) {
  return DEMO_MARKETS.find((m) => m.id === id)?.question ?? id.slice(0, 8) + "…";
}

export default function PredictionsPortfolio() {
  const { userId, portfolio, openWalletPicker, profileUsername } = usePredictionsContext();

  const { data: positions, isLoading: lp } = useQuery({
    queryKey: ["pred-positions", userId],
    queryFn: () => (userId ? listPositions(userId) : []),
    enabled: !!userId,
  });

  const { data: trades, isLoading: lt } = useQuery({
    queryKey: ["pred-trades", userId],
    queryFn: () => (userId ? listTrades(userId) : []),
    enabled: !!userId,
  });

  if (!userId) {
    return (
      <div className="pm-empty">
        <p>Connect Phantom or Jupiter to view your portfolio.</p>
        <button type="button" className="pm-btn pm-btn--gold" style={{ marginTop: 16 }} onClick={openWalletPicker}>
          Connect wallet
        </button>
      </div>
    );
  }

  const pnl = portfolio ? portfolio.usdc_balance - portfolio.initial_balance : 0;

  return (
    <>
      <div className="pm-hero">
        <p className="pm-kicker">Portfolio</p>
        <h1 className="pm-title">@{profileUsername || "trader"}</h1>
        <div className="pm-stats">
          <div className="pm-stat">
            <div className="pm-stat-label">Balance</div>
            <div className="pm-stat-val">${portfolio?.usdc_balance.toFixed(2) ?? "—"}</div>
          </div>
          <div className="pm-stat">
            <div className="pm-stat-label">P&amp;L</div>
            <div className="pm-stat-val" style={{ color: pnl >= 0 ? "#4ade80" : "#f87171" }}>
              {pnl >= 0 ? "+" : ""}{pnl.toFixed(2)}
            </div>
          </div>
          <div className="pm-stat">
            <div className="pm-stat-label">Trades</div>
            <div className="pm-stat-val">{portfolio?.total_trades ?? 0}</div>
          </div>
        </div>
      </div>

      <div className="pm-panel" style={{ marginBottom: 24 }}>
        <h2>Open positions</h2>
        {lp ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : !positions?.length ? (
          <p className="pm-sub">No open positions. <Link to="/predictions">Browse markets</Link></p>
        ) : (
          <table className="pm-pos-table">
            <thead>
              <tr>
                <th>Market</th>
                <th>Side</th>
                <th>Shares</th>
                <th>Avg</th>
                <th>Cost</th>
              </tr>
            </thead>
            <tbody>
              {positions.map((p) => (
                <tr key={p.id}>
                  <td>
                    <Link to={`/predictions/market/${p.market?.slug || p.market_id}`} style={{ color: "#fff", fontWeight: 700 }}>
                      {p.market?.question ?? marketQuestion(p.market_id)}
                    </Link>
                  </td>
                  <td style={{ color: p.side === "yes" ? "#4ade80" : "#f87171", fontWeight: 800, textTransform: "uppercase" }}>{p.side}</td>
                  <td>{p.shares.toFixed(2)}</td>
                  <td>{fmtCents(p.avg_price)}</td>
                  <td>{fmtUsd(p.cost_basis)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="pm-panel">
        <h2>Recent trades</h2>
        {lt ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : !trades?.length ? (
          <p className="pm-sub">No trades yet.</p>
        ) : (
          <table className="pm-pos-table">
            <thead>
              <tr>
                <th>Action</th>
                <th>Side</th>
                <th>Amount</th>
                <th>Price</th>
                <th>When</th>
              </tr>
            </thead>
            <tbody>
              {trades.map((t) => (
                <tr key={t.id}>
                  <td style={{ textTransform: "capitalize" }}>{t.action}</td>
                  <td style={{ color: t.side === "yes" ? "#4ade80" : "#f87171", fontWeight: 700 }}>{t.side.toUpperCase()}</td>
                  <td>{fmtUsd(t.amount_usdc)}</td>
                  <td>{fmtCents(t.price)}</td>
                  <td style={{ color: "var(--pm-muted)", fontSize: 12 }}>{new Date(t.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

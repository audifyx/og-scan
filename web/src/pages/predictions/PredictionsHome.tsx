import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { listMarkets } from "@/lib/predictions/api";
import { PRED_CATEGORIES, fmtUsd, yesPrice } from "@/lib/predictions/types";
import { MarketCard } from "./MarketCard";
import { usePredictionsContext } from "./PredictionsLayout";

export default function PredictionsHome() {
  const [category, setCategory] = useState<(typeof PRED_CATEGORIES)[number]["id"]>("all");
  const { portfolio, userId, openWalletPicker } = usePredictionsContext();

  const { data: markets, isLoading } = useQuery({
    queryKey: ["pred-markets", category],
    queryFn: () => listMarkets({ category }),
    staleTime: 20_000,
  });

  const stats = useMemo(() => {
    const list = markets ?? [];
    const vol = list.reduce((a, m) => a + m.volume_usdc, 0);
    const avg = list.length ? list.reduce((a, m) => a + yesPrice(m), 0) / list.length : 0;
    return { count: list.length, vol, avg };
  }, [markets]);

  return (
    <>
      <div className="pm-hero">
        <p className="pm-kicker">OrbitX Prediction Markets</p>
        <h1 className="pm-title">Trade conviction. Not just tokens.</h1>
        <p className="pm-sub">
          Polymarket-style YES/NO markets wired to your unified OrbitX identity — sign in with Phantom or Jupiter,
          same @username as DEX and Social. Virtual USDC ledger live now; on-chain settlement ships next.
        </p>
        {!userId && (
          <button type="button" className="pm-btn pm-btn--gold" style={{ marginTop: 20 }} onClick={openWalletPicker}>
            Connect to trade
          </button>
        )}
        <div className="pm-stats">
          <div className="pm-stat">
            <div className="pm-stat-label">Open markets</div>
            <div className="pm-stat-val">{stats.count || "—"}</div>
          </div>
          <div className="pm-stat">
            <div className="pm-stat-label">24h volume</div>
            <div className="pm-stat-val">{stats.vol ? fmtUsd(stats.vol, true) : "—"}</div>
          </div>
          <div className="pm-stat">
            <div className="pm-stat-label">Your balance</div>
            <div className="pm-stat-val">{portfolio ? `$${portfolio.usdc_balance.toFixed(0)}` : "—"}</div>
          </div>
        </div>
      </div>

      <div className="pm-filters" role="tablist">
        {PRED_CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            role="tab"
            className={`pm-filter ${category === c.id ? "pm-filter--on" : ""}`}
            onClick={() => setCategory(c.id)}
          >
            {c.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="pm-empty"><Loader2 className="inline h-6 w-6 animate-spin" /></div>
      ) : !markets?.length ? (
        <div className="pm-empty">No markets in this category yet.</div>
      ) : (
        <div className="pm-grid">
          {markets.map((m) => (
            <MarketCard key={m.id} m={m} />
          ))}
        </div>
      )}

      <p className="pm-demo-note">
        Trading uses a virtual USDC portfolio ($1,000 starter balance) until on-chain escrow goes live.
        Run the <code>pred_*</code> Supabase migration for persistent server-side markets and trades.
      </p>
    </>
  );
}

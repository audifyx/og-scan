import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getMarket, executeTrade } from "@/lib/predictions/api";
import { yesPrice, noPrice, fmtCents, fmtUsd } from "@/lib/predictions/types";
import type { PredSide } from "@/lib/predictions/types";
import { usePredictionsContext } from "./PredictionsLayout";

const QUICK = [10, 25, 50, 100, 250];

export default function PredictionsMarket() {
  const { id = "" } = useParams();
  const { userId, openWalletPicker, refetchPortfolio } = usePredictionsContext();
  const qc = useQueryClient();
  const [side, setSide] = useState<PredSide>("yes");
  const [amount, setAmount] = useState("25");
  const [busy, setBusy] = useState(false);

  const { data: market, isLoading } = useQuery({
    queryKey: ["pred-market", id],
    queryFn: () => getMarket(id),
    enabled: !!id,
  });

  if (isLoading) {
    return <div className="pm-empty"><Loader2 className="inline h-6 w-6 animate-spin" /></div>;
  }
  if (!market) {
    return (
      <div className="pm-empty">
        Market not found. <Link to="/predictions">Back to markets</Link>
      </div>
    );
  }

  const yp = yesPrice(market);
  const np = noPrice(market);
  const price = side === "yes" ? yp : np;
  const amt = Math.max(0, Number(amount) || 0);
  const estShares = price > 0 ? amt / price : 0;

  const trade = async () => {
    if (!userId) {
      openWalletPicker();
      return;
    }
    if (amt < 1) {
      toast.error("Minimum trade $1 USDC");
      return;
    }
    setBusy(true);
    try {
      const r = await executeTrade(userId, market.id, side, "buy", amt);
      if (!r.ok) throw new Error(r.error || "Trade failed");
      toast.success(`Bought ~${(r.shares ?? estShares).toFixed(2)} ${side.toUpperCase()} shares`);
      qc.invalidateQueries({ queryKey: ["pred-market", id] });
      qc.invalidateQueries({ queryKey: ["pred-markets"] });
      qc.invalidateQueries({ queryKey: ["pred-portfolio"] });
      qc.invalidateQueries({ queryKey: ["pred-positions"] });
      refetchPortfolio();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Trade failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Link to="/predictions" className="pm-back"><ArrowLeft className="h-4 w-4" /> All markets</Link>
      <div className="pm-detail">
        <div>
          <span className="pm-card-tag">{market.category}</span>
          <h1 className="pm-title" style={{ fontSize: "clamp(22px, 4vw, 32px)", marginTop: 12 }}>{market.question}</h1>
          {market.description && <p className="pm-sub" style={{ marginTop: 12 }}>{market.description}</p>}

          <div className="pm-bar">
            <div className="pm-bar-yes" style={{ width: `${yp * 100}%` }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 700 }}>
            <span style={{ color: "#4ade80" }}>Yes {fmtCents(yp)}</span>
            <span style={{ color: "#f87171" }}>No {fmtCents(np)}</span>
          </div>

          <div className="pm-stats" style={{ marginTop: 24 }}>
            <div className="pm-stat">
              <div className="pm-stat-label">Volume</div>
              <div className="pm-stat-val">{fmtUsd(market.volume_usdc, true)}</div>
            </div>
            <div className="pm-stat">
              <div className="pm-stat-label">Implied odds</div>
              <div className="pm-stat-val">{Math.round(yp * 100)}%</div>
            </div>
            <div className="pm-stat">
              <div className="pm-stat-label">Status</div>
              <div className="pm-stat-val" style={{ fontSize: 16, textTransform: "capitalize" }}>{market.status}</div>
            </div>
          </div>
        </div>

        <aside className="pm-panel">
          <h2>Place trade</h2>
          <div className="pm-trade-tabs">
            <button type="button" className={`pm-trade-tab pm-trade-tab--yes ${side === "yes" ? "pm-trade-tab--on" : ""}`} onClick={() => setSide("yes")}>
              Buy Yes {fmtCents(yp)}
            </button>
            <button type="button" className={`pm-trade-tab pm-trade-tab--no ${side === "no" ? "pm-trade-tab--on" : ""}`} onClick={() => setSide("no")}>
              Buy No {fmtCents(np)}
            </button>
          </div>
          <label className="pm-stat-label" htmlFor="pred-amt">Amount (USDC)</label>
          <input
            id="pred-amt"
            className="pm-input"
            type="number"
            min={1}
            step={1}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <div className="pm-quick-amts">
            {QUICK.map((q) => (
              <button key={q} type="button" className="pm-quick-amt" onClick={() => setAmount(String(q))}>${q}</button>
            ))}
          </div>
          <p className="pm-estimate">
            Est. shares <strong>{estShares.toFixed(2)}</strong> · avg <strong>{fmtCents(price)}</strong>/share
          </p>
          <button type="button" className="pm-btn pm-btn--gold" style={{ width: "100%" }} disabled={busy} onClick={trade}>
            {busy ? "Processing…" : userId ? `Buy ${side.toUpperCase()}` : "Connect wallet to trade"}
          </button>
          <p className="pm-estimate" style={{ marginTop: 12, marginBottom: 0 }}>
            Non-custodial sign-in · virtual ledger · 2% pool fee
          </p>
        </aside>
      </div>
    </>
  );
}

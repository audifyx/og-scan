import { useCallback, useEffect, useState } from "react";
import { fetchXMcpCredits, type XMcpCredits } from "@/lib/xMcp";

export default function XMcpCreditsPanel() {
  const [credits, setCredits] = useState<XMcpCredits | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchXMcpCredits().then(setCredits).catch((e) => setError(e instanceof Error ? e.message : "Unable to load credits")).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);
  if (error) return <section className="xh__card"><div className="xh__card-title">Usage & Credits</div><p>{error}</p><button type="button" className="ox-agent__btn" onClick={load}>Retry balance</button></section>;
  if (!credits) return <section className="xh__card"><div className="xh__card-title">Usage & Credits</div><p>{loading ? "Loading balance…" : "No balance available"}</p></section>;
  const low = credits.balanceCredits <= credits.freeCreditsGranted * 0.25;
  return <section className="xh__card" aria-label="Usage and credits">
    <div className="xh__card-h"><div><div className="xh__card-title">Usage & Credits</div><div className="xh__card-meta">Prepaid API usage · 1 credit = $0.01</div></div><strong>{credits.balanceCredits.toLocaleString(undefined, { maximumFractionDigits: 6 })} credits</strong></div>
    <div className="xh__card-meta">${credits.balanceUsd.toFixed(6)} available · {credits.freeCreditsRemaining.toLocaleString()} free · {credits.purchasedCreditsRemaining.toLocaleString()} purchased</div>
    {low && <div className="xh__card-meta">You&apos;re running low on OrbitX credits. Buy credits before your next MCP action.</div>}
    <div className="xh__card-meta">Used this month: {credits.monthCreditsUsed.toLocaleString(undefined, { maximumFractionDigits: 6 })} · Lifetime: {credits.lifetimeCreditsUsed.toLocaleString(undefined, { maximumFractionDigits: 6 })}</div>
    <div className="ox-agent__actions" style={{ marginTop: "0.75rem" }}>
      <button type="button" className="ox-agent__btn" onClick={load} disabled={loading}>{loading ? "Refreshing…" : "Refresh balance"}</button>
      <button type="button" className="ox-agent__btn ox-agent__btn--primary" onClick={() => window.dispatchEvent(new CustomEvent("orbitx:open-credit-purchase"))}>Buy credits</button>
    </div>
  </section>;
}

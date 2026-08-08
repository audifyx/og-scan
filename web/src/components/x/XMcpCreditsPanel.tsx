import { useEffect, useState } from "react";
import { fetchXMcpCredits, type XMcpCredits } from "@/lib/xMcp";

export default function XMcpCreditsPanel() {
  const [credits, setCredits] = useState<XMcpCredits | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { fetchXMcpCredits().then(setCredits).catch((e) => setError(e instanceof Error ? e.message : "Unable to load credits")); }, []);
  if (error) return <section className="xh__card"><div className="xh__card-title">Usage & Credits</div><p>{error}</p></section>;
  if (!credits) return <section className="xh__card"><div className="xh__card-title">Usage & Credits</div><p>Loading balance…</p></section>;
  const low = credits.balanceCredits <= credits.freeCreditsGranted * 0.25;
  return <section className="xh__card" aria-label="Usage and credits">
    <div className="xh__card-h"><div><div className="xh__card-title">Usage & Credits</div><div className="xh__card-meta">Prepaid API usage · 1 credit = $0.01</div></div><strong>{credits.balanceCredits.toLocaleString(undefined, { maximumFractionDigits: 6 })} credits</strong></div>
    <div className="xh__card-meta">${credits.balanceUsd.toFixed(6)} available · {credits.freeCreditsRemaining.toLocaleString()} free · {credits.purchasedCreditsRemaining.toLocaleString()} purchased</div>
    {low && <div className="xh__card-meta">You&apos;re running low on OrbitX credits. Buy credits before your next MCP action.</div>}
    <div className="xh__card-meta">Used this month: {credits.monthCreditsUsed.toLocaleString(undefined, { maximumFractionDigits: 6 })} · Lifetime: {credits.lifetimeCreditsUsed.toLocaleString(undefined, { maximumFractionDigits: 6 })}</div>
  </section>;
}

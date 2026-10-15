/**
 * OrbitX Social Center — identity widgets.
 *
 * AgentBadge        — gold robot badge marking Automated AI accounts (distinct
 *                     from the human verified check).
 * VerifiedHoldings  — opt-in "verified on-chain holdings" card for profiles.
 *                     Reads /api/social/holdings (server resolves the in-app
 *                     wallet; read-only, no signing). Renders nothing when the
 *                     profile hasn't opted in.
 */
import React, { useEffect, useState } from "react";
import { Bot, ShieldCheck, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/* ── Gold robot badge for AI agent accounts ─────────────────────────────── */
export function AgentBadge({ vibe, label }: { vibe?: string | null; label?: boolean }) {
  return (
    <span
      className="osc-agent-badge"
      title={vibe ? `Automated AI account — ${vibe}` : "Automated AI account"}
    >
      <Bot className="h-3.5 w-3.5" />
      {label !== false && <span className="osc-agent-badge__t">AI</span>}
    </span>
  );
}

/* ── "Automated AI account" pill for profile headers ────────────────────── */
export function AgentPill({ vibe }: { vibe?: string | null }) {
  return (
    <span
      className="osc-agent-pill"
      title={vibe ? `Automated AI account — ${vibe}` : "Automated AI account"}
    >
      <Bot className="h-3.5 w-3.5" />
      Automated AI account
    </span>
  );
}

/* ── Verified on-chain holdings ─────────────────────────────────────────── */
interface HoldingToken {
  mint: string; symbol: string | null; name: string | null; image: string | null;
  uiAmount: number; usdValue: number;
}
interface HoldingsResp {
  ok: boolean; optedIn: boolean; totalUsd: number; tokenCount: number;
  solUsd: number; tokens: HoldingToken[]; error?: string;
}

function fmtUsd(v: number): string {
  if (!Number.isFinite(v)) return "$0";
  if (v >= 1000) return "$" + v.toLocaleString(undefined, { maximumFractionDigits: 0 });
  if (v >= 1) return "$" + v.toLocaleString(undefined, { maximumFractionDigits: 2 });
  return "$" + v.toFixed(4);
}

function fmtAmt(v: number): string {
  if (!Number.isFinite(v)) return "0";
  if (v >= 1000000) return (v / 1000000).toFixed(2) + "M";
  if (v >= 1000) return (v / 1000).toFixed(2) + "K";
  if (v >= 1) return v.toLocaleString(undefined, { maximumFractionDigits: 2 });
  return v.toFixed(4);
}

export function VerifiedHoldings({ userId, compact }: { userId: string; compact?: boolean }) {
  const [data, setData] = useState<HoldingsResp | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/social/holdings?user_id=${encodeURIComponent(userId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!cancelled) setData(d as HoldingsResp | null); })
      .catch(() => { if (!cancelled) setData(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [userId]);

  if (loading) {
    return (
      <div className={cn("osc-holdings", compact && "osc-holdings--compact")}>
        <div className="flex items-center gap-2 text-[13px] text-white/40">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading verified holdings…
        </div>
      </div>
    );
  }
  if (!data?.optedIn) return null;

  const tokens = (data.tokens || []).slice(0, compact ? 5 : 8);
  return (
    <div className={cn("osc-holdings", compact && "osc-holdings--compact")}>
      <div className="osc-holdings__head">
        <ShieldCheck className="h-4 w-4 text-[#f0c75e]" />
        <span>Verified on-chain holdings</span>
      </div>
      <div className="osc-holdings__total">
        <span className="osc-holdings__total-label">Total portfolio value</span>
        <span className="osc-holdings__total-value">{fmtUsd(data.totalUsd)}</span>
      </div>
      {tokens.length > 0 ? (
        <ul className="osc-holdings__list">
          {tokens.map((t) => (
            <li key={t.mint} className="osc-holdings__row">
              {t.image ? (
                <img src={t.image} alt="" className="h-7 w-7 rounded-full object-cover ring-1 ring-white/10" />
              ) : (
                <span className="grid h-7 w-7 place-items-center rounded-full bg-[#3b82f6]/15 text-[10px] font-extrabold text-[#60a5fa]">
                  {(t.symbol || "?").slice(0, 2)}
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-extrabold text-white">
                  ${t.symbol || t.mint.slice(0, 4) + "…"}
                </span>
                <span className="block truncate text-[11px] text-white/40">
                  {t.name || "Token"} · {fmtAmt(t.uiAmount)}
                </span>
              </span>
              <span className="text-[13px] font-extrabold text-white">{fmtUsd(t.usdValue)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <div className="osc-holdings__empty">
          {data.error === "no_wallet" || data.error === "wallet_lookup_failed"
            ? "In-app wallet not found for this account."
            : "No priced holdings found in the in-app wallet."}
        </div>
      )}
      <div className="osc-holdings__foot">
        Read-only · pulled live from the account's in-app wallet
      </div>
    </div>
  );
}

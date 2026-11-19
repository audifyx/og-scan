import { buildOgRead, Tone } from "../lib/ogRead";
import {
  ShieldCheck, ShieldAlert, Shield, Sparkles, Check, X, AlertTriangle,
} from "lucide-react";

const TONE_CLS: Record<Tone, { text: string; bg: string; ring: string; dot: string }> = {
  good: { text: "text-up",   bg: "bg-up/10",   ring: "border-up/30",   dot: "bg-up" },
  warn: { text: "text-yellow-300", bg: "bg-yellow-400/10", ring: "border-yellow-400/30", dot: "bg-yellow-400" },
  bad:  { text: "text-down", bg: "bg-down/10", ring: "border-down/30", dot: "bg-down" },
};

function Chip({ ok, label, value }: { ok: boolean | null; label: string; value?: string }) {
  const t: Tone = ok === null ? "warn" : ok ? "good" : "bad";
  const c = TONE_CLS[t];
  const Icon = ok === null ? AlertTriangle : ok ? Check : X;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-lg border ${c.ring} ${c.bg} px-2.5 py-1.5 text-[11px] font-semibold ${c.text}`}>
      <Icon className="h-3 w-3" /> {label}{value ? <span className="opacity-80">· {value}</span> : null}
    </span>
  );
}

function scoreTone(n: number | null | undefined): Tone {
  if (n == null) return "warn";
  if (n >= 70) return "good";
  if (n >= 40) return "warn";
  return "bad";
}

export default function TrustPanel({ d }: { d: any }) {
  const flags = d?.flags || {};
  const safety = d?.safety || {};
  const meta = d?.meta || {};
  const t = d?.token || {};
  const intel = d?.score?.intel || null;
  const score = intel?.overall_score ?? d?.score?.total ?? meta.organicScore ?? null;
  const read = buildOgRead(d);
  const tone = scoreTone(score);
  const c = TONE_CLS[tone];

  const mint = safety.mintAuthorityRenounced ?? flags.mintAuthorityDisabled ?? null;
  const freeze = safety.freezeAuthorityRenounced ?? flags.freezeAuthorityDisabled ?? null;
  const lpLocked = safety.lpLockedPct != null ? Number(safety.lpLockedPct) : null;
  const top10 = meta.topHoldersPct ?? t.audit?.topHoldersPercentage ?? null;
  const verified = flags.isVerified ?? meta.isVerifiedJup ?? null;
  const clone = d?.score?.isPumpFunClone;
  const VerdictIcon = tone === "good" ? ShieldCheck : tone === "bad" ? ShieldAlert : Shield;
  const positives = intel?.explanation?.positive || intel?.positive_signals?.map((s: any) => s.explanation) || [];
  const concerns = intel?.explanation?.concerns || [
    ...(intel?.critical_risks || []).map((s: any) => s.explanation),
    ...(intel?.risk_signals || []).map((s: any) => s.explanation),
  ];

  return (
    <div className={`card mb-4 overflow-hidden border ${c.ring}`}>
      <div className={`relative ${c.bg}`}>
        <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:p-5">
          <div className="flex items-center gap-3 sm:w-64 sm:shrink-0">
            <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl border ${c.ring} bg-bg/40 ${c.text}`}>
              <VerdictIcon className="h-6 w-6" />
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted">OrbitX Score</div>
              <div className={`text-lg font-black leading-tight ${c.text}`}>
                {score != null ? `${Math.round(score)} / 100` : "—"} {intel?.label ? `· ${intel.label}` : ""}
              </div>
              <div className="text-[11px] text-muted">
                Safety <span className="font-bold text-white">{intel?.safety_score ?? "—"}</span>
                {" · "}Maturity <span className="font-bold text-white">{intel?.maturity_score ?? "—"}</span>
                {" · "}Quality <span className="font-bold text-white">{intel?.quality_score ?? "—"}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            <Chip ok={mint} label={mint ? "Mint renounced" : mint === false ? "Mint active" : "Mint unknown"} />
            <Chip ok={freeze} label={freeze ? "Freeze renounced" : freeze === false ? "Freeze active" : "Freeze unknown"} />
            {flags.lpPulled
              ? <Chip ok={false} label="LP pulled" />
              : <Chip ok={lpLocked == null ? null : lpLocked >= 50} label="LP" value={lpLocked != null ? `${lpLocked.toFixed(0)}% locked` : "unknown"} />}
            {top10 != null && <Chip ok={Number(top10) < 55} label="Top 10" value={`${Number(top10).toFixed(0)}%`} />}
            {verified != null && <Chip ok={!!verified} label={verified ? "Verified" : "Unverified"} />}
            {clone != null && <Chip ok={!clone} label={clone ? "Pump.fun origin" : "Original"} />}
            {intel?.confidence && <Chip ok={intel.confidence !== "UNKNOWN"} label={String(intel.confidence).replace("_", " ")} />}
          </div>
        </div>
      </div>

      <div className="border-t border-line p-4 sm:p-5">
        <div className="mb-2 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-accent" />
          <span className="text-sm font-bold text-white">Why this score?</span>
          <span className="pill bg-panel2 text-muted text-[9px]">{intel?.confidence || "live"}</span>
        </div>
        {(positives.length > 0 || concerns.length > 0) ? (
          <div className="grid gap-1.5 sm:grid-cols-2">
            {positives.slice(0, 6).map((text: string, i: number) => (
              <div key={`p-${i}`} className="flex items-start gap-2 text-[12.5px] text-white/80">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-up" />
                <span>{text}</span>
              </div>
            ))}
            {concerns.slice(0, 6).map((text: string, i: number) => (
              <div key={`c-${i}`} className="flex items-start gap-2 text-[12.5px] text-white/80">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-yellow-400" />
                <span>{text}</span>
              </div>
            ))}
          </div>
        ) : (
          <>
            <p className={`mb-3 text-sm font-medium ${c.text}`}>{read.headline}</p>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {read.bullets.map((bl, i) => {
                const bc = TONE_CLS[bl.tone];
                return (
                  <div key={i} className="flex items-start gap-2 text-[12.5px] text-white/80">
                    <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${bc.dot}`} />
                    <span>{bl.text}</span>
                  </div>
                );
              })}
            </div>
          </>
        )}
        <p className="mt-3 text-[10px] text-muted/60">Evidence-based on-chain profile — not financial advice. Unknown data is not treated as risk. Always DYOR.</p>
      </div>
    </div>
  );
}

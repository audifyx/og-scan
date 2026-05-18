import { AlertTriangle, Info, ShieldAlert } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { fmtUsd, hasPulledOrDeadLiquidity, shortAddr, shortDate, tokenEffectiveLiquidityUsd, type ForensicOgReport, type JupTokenInfo, type TokenForensicScores } from "@/lib/og";

export type TruthTermKey =
  | "mintProof"
  | "narrativeCluster"
  | "originPercent"
  | "clonePercent"
  | "ctoPercent"
  | "migrationPercent"
  | "revivalPercent"
  | "communitySupportShift"
  | "classification"
  | "authorityStatus";

export type TruthLegendEntry = {
  label: string;
  tooltip: string;
  why: string;
  placement: string;
};

export const TRUTH_LEGEND: Record<TruthTermKey, TruthLegendEntry> = {
  mintProof: {
    label: "Mint Proof",
    tooltip: "Earliest known creation evidence for this Solana token mint. It is separate from first liquidity and current scan time.",
    why: "Traders need this to tell the real origin contract from later scam or relaunch contracts.",
    placement: "Next to Mint Proof, First Proof, and on-chain mint timestamps.",
  },
  narrativeCluster: {
    label: "Narrative Cluster",
    tooltip: "All tokens that match the same ticker/name/meme narrative after normalization. OGSCAN compares tokens inside this cluster before assigning labels.",
    why: "Copycats often use tiny spelling, casing, emoji, or unicode changes to hide inside the same meme narrative.",
    placement: "Beside Narrative ID / Cluster metrics at the top of Scanner and Direct OG reports.",
  },
  originPercent: {
    label: "Origin %",
    tooltip: "Confidence that this contract is the earliest credible origin for the searched narrative. It prioritizes mint, transaction, liquidity, holder, metadata, and social-origin proof.",
    why: "A high Origin % helps identify the real OG even if newer clones have more volume or liquidity.",
    placement: "Beside Origin score labels, progress bars, and main label cards.",
  },
  clonePercent: {
    label: "Clone %",
    tooltip: "Likelihood this token is a later copy of an older matching token. It weighs launch timing, metadata/logo/social similarity, deployer behavior, and hype-wave timing.",
    why: "High clone probability is one of the fastest ways to spot fake versions stealing attention from the original.",
    placement: "Beside Clone score metrics and copycat rows.",
  },
  ctoPercent: {
    label: "CTO %",
    tooltip: "Probability that control/support shifted from the original deployer to the community while the same contract continued. CTO is not the same as a new-contract revival.",
    why: "A true CTO can still be the original CA; mislabeling it as a revival can hide valuable provenance.",
    placement: "Beside CTO metrics, community support badges, and control-status rows.",
  },
  migrationPercent: {
    label: "Migration %",
    tooltip: "Strength of evidence that an original project moved from an old CA to a new CA. It looks for old-to-new proof, official confirmation, holder/liquidity movement, and continuity.",
    why: "Migration proof separates legitimate moved projects from random copycats claiming to be official.",
    placement: "Beside Migration scores and lifecycle status.",
  },
  revivalPercent: {
    label: "Revival %",
    tooltip: "Likelihood that this is a later new-contract restart of an older narrative. Revival should only apply when the CA is not the original contract.",
    why: "This protects original CTOs from being downgraded and helps traders understand relaunch risk.",
    placement: "Beside Revival metrics and lifecycle labels.",
  },
  communitySupportShift: {
    label: "Community Support Shift",
    tooltip: "Signals that a different group is now supporting liquidity, socials, holders, or activity after original deployer inactivity. Same CA + support shift can indicate TRUE OG CTO.",
    why: "Builders and traders need to know whether momentum is still dev-led, community-led, or abandoned.",
    placement: "Beside Control Status, CTO labels, and risk alerts.",
  },
  classification: {
    label: "True OG vs UNKNOWN",
    tooltip: "TRUE OG means the token has the strongest verified origin proof in its cluster. UNKNOWN means proof is incomplete or too risky to crown a definitive origin.",
    why: "This prevents fake low-trust tokens from being presented as the origin when evidence is weak.",
    placement: "Beside Main Label / Classification fields.",
  },
  authorityStatus: {
    label: "Mint/Freeze Authority",
    tooltip: "Shows whether supply minting or wallet freezing powers appear disabled. Open or unknown authority is treated as a safety warning.",
    why: "Enabled mint/freeze authority can let insiders inflate supply or restrict holders, even if the narrative looks legitimate.",
    placement: "Beside audit chips, safety panels, and warning banners.",
  },
};

export const HELP_TERM_BY_LABEL: Record<string, TruthTermKey> = {
  "MINT PROOF": "mintProof",
  "OG MINT PROOF": "mintProof",
  "FIRST PROOF": "mintProof",
  "ON-CHAIN MINT": "mintProof",
  "NARRATIVE ID": "narrativeCluster",
  CLUSTER: "narrativeCluster",
  ORIGIN: "originPercent",
  "ORIGIN SCORE": "originPercent",
  CLONE: "clonePercent",
  CLONES: "clonePercent",
  CTO: "ctoPercent",
  MIGRATION: "migrationPercent",
  MIGR: "migrationPercent",
  REVIVAL: "revivalPercent",
  "CONTROL STATUS": "communitySupportShift",
  "MAIN LABEL": "classification",
  LABEL: "classification",
  CLASSIFICATION: "classification",
  "MINT AUTHORITY": "authorityStatus",
  "FREEZE AUTHORITY": "authorityStatus",
  MINT: "authorityStatus",
  FREEZE: "authorityStatus",
};

export function HelpTip({ term, className }: { term: TruthTermKey; className?: string }) {
  const entry = TRUTH_LEGEND[term];
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          aria-label={`${entry.label} help`}
          onClick={(event) => event.stopPropagation()}
          className={cn("inline-flex h-4 w-4 shrink-0 cursor-help items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-foreground/55 transition hover:border-og-cyan/60 hover:text-og-cyan", className)}
        >
          <Info className="h-2.5 w-2.5" />
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[280px] border-og-cyan/35 bg-[#06111f] p-3 text-xs leading-relaxed text-foreground shadow-[0_18px_70px_rgba(0,229,255,0.18)]">
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-og-cyan">{entry.label}</div>
        <div className="mt-1 text-foreground/90">{entry.tooltip}</div>
        <div className="mt-2 border-t border-white/10 pt-2 text-muted-foreground">Why it matters: {entry.why}</div>
      </TooltipContent>
    </Tooltip>
  );
}

export function HelpLabel({ label, term, className }: { label: string; term?: TruthTermKey; className?: string }) {
  const resolvedTerm: TruthTermKey | undefined = term ?? HELP_TERM_BY_LABEL[label.toUpperCase()];
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-1", className)}>
      <span className="truncate">{label}</span>
      {resolvedTerm ? <HelpTip term={resolvedTerm} /> : null}
    </span>
  );
}

export function TokenTruthLegend({ compact = false }: { compact?: boolean }) {
  const entries: TruthLegendEntry[] = Object.values(TRUTH_LEGEND);
  return (
    <div className="rounded-3xl border border-og-cyan/25 bg-og-cyan/[0.045] p-3 sm:p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.3em] text-og-cyan">
          <Info className="h-3.5 w-3.5" /> layered legend
        </div>
        <span className="rounded-full border border-og-cyan/25 bg-og-ink/70 px-2 py-1 font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
          hover info icons for context
        </span>
      </div>
      <div className={cn("grid gap-2", compact ? "sm:grid-cols-2" : "sm:grid-cols-2 xl:grid-cols-3")}>
        {entries.map((entry) => (
          <div key={entry.label} className="rounded-2xl border border-white/10 bg-white/[0.035] p-3">
            <div className="font-mono text-[10px] uppercase tracking-widest text-foreground">{entry.label}</div>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{entry.tooltip}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export type ScoreKind = "origin" | "clone" | "risk" | "cto" | "migration" | "revival";

export function scoreTextClass(kind: ScoreKind, score: number): string {
  if (kind === "origin") return score > 80 ? "text-og-lime" : score >= 50 ? "text-og-gold" : "text-og-blood";
  if (kind === "clone") return score >= 65 ? "text-og-blood" : score >= 35 ? "text-og-gold" : "text-og-lime";
  if (kind === "risk") return score >= 70 ? "text-og-blood" : score >= 40 ? "text-orange-300" : "text-og-lime";
  return score >= 65 ? "text-og-lime" : score >= 35 ? "text-og-cyan" : "text-muted-foreground";
}

export function scoreBarClass(kind: ScoreKind, score: number): string {
  if (kind === "origin") return score > 80 ? "bg-og-lime" : score >= 50 ? "bg-og-gold" : "bg-og-blood";
  if (kind === "clone") return score >= 65 ? "bg-og-blood" : score >= 35 ? "bg-og-gold" : "bg-og-lime";
  if (kind === "risk") return score >= 70 ? "bg-og-blood" : score >= 40 ? "bg-orange-400" : "bg-og-lime";
  return score >= 65 ? "bg-og-lime" : score >= 35 ? "bg-og-cyan" : "bg-white/25";
}

export function labelToneClass(label: string): string {
  if (label.includes("TRUE OG")) return "border-og-lime/45 bg-og-lime/10 text-og-lime shadow-[0_0_26px_rgba(0,229,255,0.12)]";
  if (label.includes("REVIVED OFFICIAL")) return "border-og-cyan/55 bg-og-cyan/10 text-og-cyan shadow-[0_0_26px_rgba(0,229,255,0.12)]";
  if (label.includes("LEGACY OG")) return "border-og-gold/50 bg-og-gold/10 text-og-gold";
  if (label.includes("CONTESTED")) return "border-orange-300/55 bg-orange-400/10 text-orange-200";
  if (label.includes("LATER OFFICIAL")) return "border-og-gold/50 bg-og-gold/10 text-og-gold";
  if (label.includes("UNKNOWN") || label.includes("MID RISK")) return "border-orange-300/45 bg-orange-400/10 text-orange-200";
  if (label.includes("CLONE") || label.includes("COPY") || label.includes("RUG")) return "border-og-blood/50 bg-og-blood/10 text-og-blood";
  if (label.includes("MIGR")) return "border-og-gold/45 bg-og-gold/10 text-og-gold";
  return "border-og-cyan/35 bg-og-cyan/10 text-og-cyan";
}

export function ScoreMeter({ score, kind, label, className }: { score: number; kind: ScoreKind; label?: string; className?: string }) {
  const safeScore: number = Math.max(0, Math.min(100, Math.round(Number.isFinite(score) ? score : 0)));
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-2", className)}>
      {label ? <HelpLabel label={label} className="text-[9px] text-muted-foreground" /> : null}
      <span className="h-1.5 w-20 overflow-hidden rounded-full border border-white/10 bg-white/[0.06]">
        <span className={cn("block h-full rounded-full transition-all", scoreBarClass(kind, safeScore))} style={{ width: `${safeScore}%` }} />
      </span>
      <span className={cn("font-mono text-[10px]", scoreTextClass(kind, safeScore))}>{safeScore}%</span>
    </span>
  );
}

export type TokenRiskAlert = {
  level: "danger" | "warning" | "info";
  title: string;
  text: string;
};

export function buildTokenRiskAlerts(token: JupTokenInfo, forensic?: TokenForensicScores): TokenRiskAlert[] {
  const alerts: TokenRiskAlert[] = [];
  const mintOpen: boolean = token.audit?.mintAuthorityDisabled !== true;
  const freezeOpen: boolean = token.audit?.freezeAuthorityDisabled !== true;
  const cloneScore: number = forensic?.cloneScore ?? 0;
  const ctoScore: number = forensic?.ctoScore ?? 0;
  const liquidity: number = tokenEffectiveLiquidityUsd(token);
  const delayHours: number | undefined = forensic?.evidence.liquidityDelayHours;
  const lpPulled: boolean = hasPulledOrDeadLiquidity(token);

  if (lpPulled) {
    alerts.push({
      level: "danger",
      title: "LP pulled / dead liquidity detected",
      text: token.lpPullReason ?? `This token shows ${fmtUsd(token.reportedLiquidity ?? token.liquidity)} reported LP/MC but only ${fmtUsd(liquidity)} quote-backed live liquidity. OGSCAN excludes it from TRUE OG selection.`,
    });
  }

  if (mintOpen) {
    alerts.push({
      level: "danger",
      title: "Mint authority is not fully disabled",
      text: "Creator-side supply controls may still be open or unknown. Verify before treating this as a clean OG.",
    });
  }

  if (freezeOpen) {
    alerts.push({
      level: "danger",
      title: "Freeze authority is not fully disabled",
      text: "Wallet-freeze controls may still be open or unknown, which can create holder lock risk.",
    });
  }

  if (cloneScore >= 70) {
    alerts.push({
      level: "danger",
      title: "High clone probability",
      text: `Clone score is ${cloneScore}%. This contract appears later or highly similar to an older narrative origin.`,
    });
  } else if (cloneScore >= 45) {
    alerts.push({
      level: "warning",
      title: "Clone watch",
      text: `Clone score is ${cloneScore}%. Compare mint proof, first LP, and authority status before trusting it.`,
    });
  }

  if (typeof delayHours === "number" && delayHours >= 48) {
    alerts.push({
      level: "warning",
      title: "Late first LP vs mint proof",
      text: `First liquidity appeared about ${Math.round(delayHours)}h after the earliest mint proof. Check for abandoned/relaunched behavior.`,
    });
  }

  if (ctoScore >= 60 || forensic?.classification.primary_label.includes("CTO")) {
    alerts.push({
      level: "info",
      title: "Community support shift detected",
      text: "CTO signals are present. Confirm whether the same CA continued and whether current socials/liquidity are community-led.",
    });
  }

  if (liquidity > 0 && liquidity < 5_000) {
    alerts.push({
      level: "warning",
      title: "Thin liquidity anomaly",
      text: `Quote-backed live liquidity is only ${fmtUsd(liquidity)}. OGSCAN excludes sub-$1k or LP-pulled candidates from OG selection, but thin LP still deserves caution.`,
    });
  }

  if ((token.audit?.topHoldersPercentage ?? 0) >= 40) {
    alerts.push({
      level: "warning",
      title: "Holder concentration watch",
      text: `Top holders control about ${token.audit?.topHoldersPercentage?.toFixed(1)}% of supply. This can increase bundle or dump risk.`,
    });
  }

  return alerts.slice(0, 6);
}

export function buildClusterRiskAlerts(report: ForensicOgReport): TokenRiskAlert[] {
  const alerts: TokenRiskAlert[] = [];
  const primaryLiquidity: number = report.primaryToken?.liquidity ?? report.og?.liquidity ?? 0;
  const richerCopycat = report.copycats.find((token) => tokenEffectiveLiquidityUsd(token) > Math.max(25_000, primaryLiquidity * 2));
  const authorityCopycat = report.copycats.find((token) => token.audit?.mintAuthorityDisabled !== true || token.audit?.freezeAuthorityDisabled !== true);
  const lpPulledCopycat = report.copycats.find(hasPulledOrDeadLiquidity);
  const laterOfficial = report.copycats.find((token) => {
    const label: string | undefined = report.tokenScores[`${token.chainId ?? "solana"}:${token.id}`]?.classification.primary_label;
    return label === "LATER OFFICIAL" || label === "REVIVED OFFICIAL";
  });
  const legacyOg = report.firstMintToken && report.primaryToken && report.firstMintToken.id !== report.primaryToken.id ? report.firstMintToken : null;

  if (legacyOg) {
    alerts.push({
      level: "info",
      title: "Primary differs from first mint",
      text: `${shortAddr(report.primaryToken?.id, 5)} is currently primary by dominance score, while ${shortAddr(legacyOg.id, 5)} remains the earliest first-mint / Legacy OG.`,
    });
  }

  if (lpPulledCopycat) {
    alerts.push({
      level: "danger",
      title: "LP-pulled token blocked",
      text: `${shortAddr(lpPulledCopycat.id, 5)} has dead/pulled quote-side liquidity and is excluded from TRUE OG eligibility even if it has earlier mint proof or inflated market cap.`,
    });
  }

  if (authorityCopycat) {
    alerts.push({
      level: "danger",
      title: "Copycat authority warning",
      text: `At least one copycat (${shortAddr(authorityCopycat.id, 5)}) has mint or freeze authority open/unknown. Do not let it outrank the verified origin.`,
    });
  }

  if (laterOfficial) {
    alerts.push({
      level: "info",
      title: "Later official token detected",
      text: `${shortAddr(laterOfficial.id, 5)} appears verified/official or primary, but first-mint provenance is still shown separately so official status cannot erase origin history.`,
    });
  }

  if (richerCopycat) {
    alerts.push({
      level: "warning",
      title: "Liquidity difference detected",
      text: `A later token (${shortAddr(richerCopycat.id, 5)}) has materially higher liquidity than the OG. Higher LP does not make it the origin.`,
    });
  }

  if (report.summary.highRiskCount > 0) {
    alerts.push({
      level: "warning",
      title: "High-risk cluster members",
      text: `${report.summary.highRiskCount} token(s) in this narrative cluster have elevated risk or weak wallet behavior.`,
    });
  }

  return alerts;
}

export function copycatDangerScore(token: JupTokenInfo, forensic?: TokenForensicScores): number {
  const risk: number = forensic?.riskScore ?? 0;
  const clone: number = forensic?.cloneScore ?? 0;
  const liquidity: number = Math.min(30, Math.log10(tokenEffectiveLiquidityUsd(token) + 1) * 5);
  const authorityPenalty: number = (token.audit?.mintAuthorityDisabled !== true ? 12 : 0) + (token.audit?.freezeAuthorityDisabled !== true ? 12 : 0);
  const holderPenalty: number = (token.audit?.topHoldersPercentage ?? 0) >= 40 ? 10 : 0;
  const lpPulledPenalty: number = hasPulledOrDeadLiquidity(token) ? 30 : 0;
  return Math.round(risk * 0.45 + clone * 0.3 + liquidity + authorityPenalty + holderPenalty + lpPulledPenalty);
}

export function TokenRiskAlerts({ alerts, title = "Risk Alerts" }: { alerts: TokenRiskAlert[]; title?: string }) {
  if (alerts.length === 0) {
    return (
      <div className="rounded-3xl border border-og-lime/25 bg-og-lime/[0.055] p-3">
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.3em] text-og-lime">
          <Info className="h-3.5 w-3.5" /> watch items clear
        </div>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">No major mint/freeze, clone, delayed-LP, or liquidity anomaly flags were detected from available public data.</p>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-og-blood/35 bg-og-blood/[0.055] p-3 sm:p-4">
      <div className="mb-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.3em] text-og-blood">
        <ShieldAlert className="h-3.5 w-3.5" /> {title}
      </div>
      <div className="grid gap-2">
        {alerts.map((alert) => {
          const toneClass: string = alert.level === "danger"
            ? "border-og-blood/45 bg-og-blood/10 text-og-blood"
            : alert.level === "warning"
              ? "border-orange-300/40 bg-orange-400/10 text-orange-200"
              : "border-og-cyan/35 bg-og-cyan/10 text-og-cyan";
          return (
            <div key={`${alert.title}-${alert.text}`} className={cn("rounded-2xl border p-3", toneClass)}>
              <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest">
                <AlertTriangle className="h-3.5 w-3.5" /> {alert.title}
              </div>
              <p className="mt-1 text-xs leading-relaxed text-foreground/78">{alert.text}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function proofTimestampText(iso: string | undefined): string {
  return iso ? `${shortDate(iso)} · ${new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "unknown";
}

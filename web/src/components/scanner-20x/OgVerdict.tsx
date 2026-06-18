/**
 * OgVerdict — the OG Scan tool's full intelligence report for the primary token.
 * Shows EVERYTHING (classification, forensic scores, identity/origin, authority,
 * market/liquidity, holders, DEX-paid, lifecycle/trend, clone lineage) organised
 * into glass-themed collapsible dropdowns. Logs each verdict to the append-only log.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Sparkles, TrendingUp, GitBranch, ChevronDown, ShieldCheck, Coins,
  Users, BadgeDollarSign, Fingerprint, Crown, FileDown, Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ClassificationCard } from "@/components/scanner-20x/ClassificationCard";
import { ShareScanCard } from "@/components/intel/ShareScanCard";
import { classifyToken } from "@/lib/classification";
import { forensicToInput, jupSeries } from "@/lib/classificationAdapter";
import { trendVelocityScore, reconstructLifecycle, hypeDecayScore, holderEntropyScore, whyExists, type LifecycleStage } from "@/lib/intelligence";
import { logScan, captureTrendSnapshot } from "@/lib/scanLog";
import { downloadReportPdf } from "@/lib/reportPdf";
import {
  fmtUsd, fmtNum, fmtPct, fmtHolderCount, shortAddr, shortDate, tokenOgCreatedAtIso,
  tokenEffectiveLiquidityUsd,
  type JupTokenInfo, type TokenForensicScores, type ForensicOgReport,
} from "@/lib/og";

const STAGES: LifecycleStage[] = ["launch", "expansion", "peak", "decline"];

/* ── glass collapsible section ── */
function Section({ icon, title, subtitle, defaultOpen = false, accent = "text-og-cyan", children }: {
  icon: ReactNode; title: string; subtitle?: string; defaultOpen?: boolean; accent?: string; children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="glass-sm overflow-hidden rounded-2xl border border-white/10">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-2 px-4 py-3 text-left transition hover:bg-white/[0.03]">
        <span className={cn("flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/5", accent)}>{icon}</span>
        <span className="min-w-0 flex-1">
          <span className="block font-display text-sm font-bold text-foreground">{title}</span>
          {subtitle && <span className="block truncate font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{subtitle}</span>}
        </span>
        <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && <div className="border-t border-white/5 px-4 py-3">{children}</div>}
    </div>
  );
}

/* ── key/value row ── */
function KV({ k, v, tone }: { k: string; v: ReactNode; tone?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{k}</span>
      <span className={cn("truncate text-right text-sm font-medium", tone ?? "text-foreground")}>{v ?? "—"}</span>
    </div>
  );
}

/* ── labelled score bar ── */
function Bar({ label, value, tone = "auto" }: { label: string; value?: number; tone?: "auto" | "good" | "bad" }) {
  const v = Math.max(0, Math.min(100, Math.round(value ?? 0)));
  const color = tone === "good" ? "bg-og-lime" : tone === "bad" ? "bg-og-blood"
    : v >= 66 ? "bg-og-lime" : v >= 33 ? "bg-og-gold" : "bg-og-blood";
  return (
    <div>
      <div className="mb-1 flex justify-between font-mono text-[10px] uppercase tracking-widest text-muted-foreground"><span className="truncate">{label}</span><span>{v}</span></div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5"><div className={cn("h-full rounded-full", color)} style={{ width: `${v}%` }} /></div>
    </div>
  );
}

const yn = (b?: boolean, onTrue = "Yes", onFalse = "No") => (b === undefined ? "—" : b ? onTrue : onFalse);

export function OgVerdict({ token, score, report }: { token: JupTokenInfo; score?: TokenForensicScores; report?: ForensicOgReport }) {
  const result = useMemo(() => classifyToken(forensicToInput(token, score)), [token, score]);
  const series = useMemo(() => jupSeries(token), [token]);
  const velocity = useMemo(() => trendVelocityScore(series), [series]);
  const lifecycle = useMemo(() => reconstructLifecycle(series), [series]);
  const decay = useMemo(() => hypeDecayScore(series), [series]);
  const entropy = useMemo(() => holderEntropyScore((token.topHolders ?? []).map((h) => h.uiAmount).filter((n) => n > 0)), [token]);
  const [pdfBusy, setPdfBusy] = useState(false);
  async function handleDownloadPdf() {
    setPdfBusy(true);
    try {
      await downloadReportPdf({ token, score, result, velocity, decay, entropy, lifecycle, report });
    } catch (e) {
      console.error("PDF export failed", e);
    } finally {
      setPdfBusy(false);
    }
  }

  const loggedRef = useRef<string | null>(null);
  useEffect(() => {
    if (loggedRef.current === token.id) return;
    loggedRef.current = token.id;
    void logScan({ mint: token.id, chain: token.chainId ?? "solana", symbol: token.symbol, name: token.name }, result);
    void captureTrendSnapshot(token.id, {
      priceUsd: token.usdPrice,
      volume24h: token.stats24h ? (token.stats24h.buyVolume ?? 0) + (token.stats24h.sellVolume ?? 0) : undefined,
      liquidityUsd: token.liquidity, velocity,
    });
  }, [token, result, velocity]);

  const s = score;
  const cls = s?.classification;
  const lineage = report?.familyTree ?? [];
  const copycats = report?.copycats ?? [];
  const vol24 = token.stats24h ? (token.stats24h.buyVolume ?? 0) + (token.stats24h.sellVolume ?? 0) : undefined;

  return (
    <div className="mt-4 space-y-3">
      <div className="flex items-center gap-2">
        <div className="flex flex-1 items-center gap-2 font-mono text-[10px] uppercase tracking-[0.3em] text-og-cyan">
          <Sparkles className="h-3 w-3" /> OG Verdict · full report
        </div>
        <button
          type="button"
          onClick={handleDownloadPdf}
          disabled={pdfBusy}
          className="inline-flex items-center gap-1.5 rounded-full border border-og-cyan/40 bg-og-cyan/10 px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-og-cyan transition hover:bg-og-cyan/20 disabled:opacity-50"
        >
          {pdfBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileDown className="h-3.5 w-3.5" />}
          {pdfBusy ? "Building…" : "Download PDF"}
        </button>
      </div>

      <ClassificationCard result={result} symbol={token.symbol} />

      {/* Trend & lifecycle — open by default */}
      <Section icon={<TrendingUp className="h-4 w-4" />} title="Trend & Lifecycle" subtitle={lifecycle.stage} defaultOpen accent="text-og-gold">
        <div className="grid gap-3 sm:grid-cols-3">
          <Bar label="Trend velocity" value={velocity} />
          <Bar label="Hype decay risk" value={decay} tone="bad" />
          <Bar label="Drawdown from peak" value={lifecycle.drawdownFromPeakPct} tone="bad" />
        </div>
        <div className="mt-3 flex flex-wrap gap-1">
          {STAGES.map((st) => (
            <span key={st} className={cn("rounded-full border px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest capitalize",
              lifecycle.stage === st ? "border-og-gold/50 bg-og-gold/10 text-og-gold" : "border-white/10 text-muted-foreground")}>{st}</span>
          ))}
          {lifecycle.failure && <span className="rounded-full border border-og-blood/50 bg-og-blood/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest text-og-blood">{lifecycle.failure.replace("_", " ")}</span>}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">{lifecycle.summary}</p>
      </Section>

      {/* Forensic scores */}
      {s && (
        <Section icon={<Fingerprint className="h-4 w-4" />} title="Forensic Scores" subtitle={`${cls?.primary_label ?? ""}`} accent="text-og-cyan">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Bar label="Dominance" value={s.dominanceScore} />
            <Bar label="Origin" value={s.originScore} />
            <Bar label="True OG prob" value={s.trueOgProbability} />
            <Bar label="Clone prob" value={s.cloneProbability} tone="bad" />
            <Bar label="Risk" value={s.riskScore} tone="bad" />
            <Bar label="CTO" value={s.ctoScore} />
            <Bar label="Migration" value={s.migrationScore} />
            <Bar label="Revival" value={s.revivalScore} />
            <Bar label="Deployer trust" value={s.deployerTrustScore} />
            <Bar label="Liquidity authenticity" value={s.liquidityAuthenticityScore} />
            <Bar label="Holder distribution" value={s.holderDistributionScore} />
            <Bar label="On-chain activity" value={s.onChainActivityScore} />
          </div>
          {cls?.reasoning_summary && <p className="mt-3 text-xs text-muted-foreground">{cls.reasoning_summary}</p>}
          {cls && (
            <div className="mt-2 grid gap-1 sm:grid-cols-3">
              <KV k="Identity" v={cls.layers.origin_identity} />
              <KV k="Control" v={cls.layers.control_status} />
              <KV k="Lifecycle" v={cls.layers.lifecycle_status} />
            </div>
          )}
          {cls?.secondary_labels?.length ? (
            <div className="mt-2 flex flex-wrap gap-1">
              {cls.secondary_labels.map((l) => <span key={l} className="rounded-full border border-og-cyan/20 bg-og-cyan/5 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest text-og-cyan/80">{l}</span>)}
            </div>
          ) : null}
        </Section>
      )}

      {/* Identity & origin */}
      <Section icon={<ShieldCheck className="h-4 w-4" />} title="Identity & Origin" accent="text-og-lime">
        <div className="grid gap-x-6 sm:grid-cols-2">
          <KV k="Symbol" v={`$${token.symbol}`} />
          <KV k="Name" v={token.name} />
          <KV k="Contract" v={shortAddr(token.id, 5)} />
          <KV k="Chain" v={token.chainId ?? "solana"} />
          <KV k="First mint" v={shortDate(tokenOgCreatedAtIso(token))} />
          <KV k="First mint source" v={token.firstMintSource ?? "—"} />
          <KV k="Creation source" v={token.creationSource ?? "—"} />
          <KV k="Narrative ID" v={report?.narrativeFingerprintId ?? "—"} />
          <KV k="Verified" v={yn(token.isVerified)} tone={token.isVerified ? "text-og-lime" : undefined} />
          <KV k="Primary token" v={yn(s?.isPrimaryToken)} tone={s?.isPrimaryToken ? "text-og-gold" : undefined} />
        </div>
      </Section>

      {/* Authority & contract */}
      <Section icon={<ShieldCheck className="h-4 w-4" />} title="Authority & Contract" accent="text-og-cyan">
        <div className="grid gap-x-6 sm:grid-cols-2">
          <KV k="Mint authority" v={token.audit?.mintAuthorityDisabled === undefined ? "—" : yn(!token.audit.mintAuthorityDisabled, "Active", "Renounced")} tone={token.audit?.mintAuthorityDisabled ? "text-og-lime" : token.audit?.mintAuthorityDisabled === false ? "text-og-blood" : undefined} />
          <KV k="Freeze authority" v={token.audit?.freezeAuthorityDisabled === undefined ? "—" : yn(!token.audit.freezeAuthorityDisabled, "Active", "Renounced")} tone={token.audit?.freezeAuthorityDisabled ? "text-og-lime" : token.audit?.freezeAuthorityDisabled === false ? "text-og-blood" : undefined} />
          <KV k="First mint wallet" v={token.firstMintAuthorityWallet ? shortAddr(token.firstMintAuthorityWallet, 4) : "—"} />
          <KV k="Creator wallet" v={token.creatorFunding?.creatorWallet ? shortAddr(token.creatorFunding.creatorWallet, 4) : "—"} />
          <KV k="Top holders %" v={token.topHoldersPercent != null ? fmtPct(token.topHoldersPercent) : (token.audit?.topHoldersPercentage != null ? fmtPct(token.audit.topHoldersPercentage) : "—")} />
        </div>
      </Section>

      {/* Market & liquidity */}
      <Section icon={<Coins className="h-4 w-4" />} title="Market & Liquidity" subtitle={fmtUsd(token.usdPrice)} accent="text-og-gold">
        <div className="grid gap-x-6 sm:grid-cols-2">
          <KV k="Price" v={fmtUsd(token.usdPrice)} />
          <KV k="24h change" v={fmtPct(token.stats24h?.priceChange ?? 0)} tone={(token.stats24h?.priceChange ?? 0) >= 0 ? "text-og-lime" : "text-og-blood"} />
          <KV k="Market cap" v={fmtUsd(token.mcap)} />
          <KV k="FDV" v={fmtUsd(token.fdv)} />
          <KV k="Liquidity (effective)" v={fmtUsd(tokenEffectiveLiquidityUsd(token))} />
          <KV k="Liquidity (reported)" v={token.reportedLiquidity != null ? fmtUsd(token.reportedLiquidity) : "—"} />
          <KV k="Volume 24h" v={vol24 != null ? fmtUsd(vol24) : "—"} />
          <KV k="ATH" v={token.allTimeHighUsd != null ? `${fmtUsd(token.allTimeHighUsd)} · ${shortDate(token.allTimeHighAt)}` : "—"} />
          <KV k="ATL" v={token.allTimeLowUsd != null ? fmtUsd(token.allTimeLowUsd) : "—"} />
          <KV k="Pools" v={token.poolCount ?? "—"} />
        </div>
      </Section>

      {/* Holders & distribution */}
      <Section icon={<Users className="h-4 w-4" />} title="Holders & Distribution" subtitle={fmtHolderCount(token.holderCount)} accent="text-og-cyan">
        <div className="mb-3 grid gap-3 sm:grid-cols-3">
          <Bar label="Holder entropy" value={entropy} tone="good" />
          <KV k="Holders" v={fmtHolderCount(token.holderCount)} />
          <KV k="Whales" v={token.whaleCount ?? "—"} />
        </div>
        {token.topHolders?.length ? (
          <ul className="space-y-1">
            {token.topHolders.slice(0, 10).map((h, i) => (
              <li key={h.owner + i} className="flex items-center justify-between gap-2 rounded-lg border border-white/5 bg-white/[0.02] px-2.5 py-1.5 text-xs">
                <span className="truncate font-mono text-muted-foreground">{i + 1}. {shortAddr(h.owner, 4)}{h.label ? ` · ${h.label}` : ""}</span>
                <span className="shrink-0 font-medium">{fmtPct(h.percent)}</span>
              </li>
            ))}
          </ul>
        ) : <p className="text-xs text-muted-foreground">Holder breakdown unavailable.</p>}
      </Section>

      {/* DEX paid & boosts */}
      <Section icon={<BadgeDollarSign className="h-4 w-4" />} title="DEX Paid & Boosts" accent="text-og-lime">
        <div className="grid gap-x-6 sm:grid-cols-2">
          <KV k="Profile paid" v={yn(token.dexProfilePaid)} tone={token.dexProfilePaid ? "text-og-lime" : undefined} />
          <KV k="Boosts active" v={token.dexBoostActive ?? "—"} />
          <KV k="Boost amount" v={token.dexBoostAmount != null ? fmtNum(token.dexBoostAmount) : "—"} />
          <KV k="CTO paid" v={yn(token.dexCommunityTakeoverPaid)} />
          <KV k="Ads paid" v={yn(token.dexAdsPaid)} />
          <KV k="First paid" v={shortDate(token.dexFirstPaidAt)} />
        </div>
      </Section>

      {/* Clone lineage */}
      {(lineage.length > 0 || copycats.length > 0 || (report?.clusterAliases?.length ?? 0) > 0) && (
        <Section icon={<GitBranch className="h-4 w-4" />} title="Clone Lineage & Cluster" subtitle={`${copycats.length} copycats`} accent="text-og-blood">
          {report?.clusterAliases?.length ? (
            <div className="mb-3 flex flex-wrap gap-1">
              {report.clusterAliases.slice(0, 12).map((a) => <span key={a} className="rounded-full border border-white/10 px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground">{a}</span>)}
            </div>
          ) : null}
          {lineage.length > 0 && (
            <ul className="space-y-1">
              {lineage.slice(0, 12).map((n, i) => (
                <li key={n.token.id + i} className="flex items-center justify-between gap-2 rounded-lg border border-white/5 bg-white/[0.02] px-2.5 py-1.5 text-xs">
                  <span className="flex min-w-0 items-center gap-1.5 truncate">
                    {n.relationship === "TRUE OG" && <Crown className="h-3 w-3 text-og-gold" />}
                    <span className="truncate font-medium">${n.token.symbol}</span>
                    <span className="truncate font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{n.relationship}</span>
                  </span>
                  <span className="shrink-0 font-mono text-muted-foreground">{Math.round(n.score)}%</span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      )}

      {/* Why this exists */}
      <Section icon={<Sparkles className="h-4 w-4" />} title="Why This Exists" defaultOpen accent="text-og-cyan">
        <p className="text-sm text-muted-foreground">{whyExists({ name: token.name, symbol: token.symbol, isOg: result.tier === "OG_TOKEN" })}</p>
      </Section>

      <ShareScanCard mint={token.id} symbol={token.symbol} name={token.name} result={result} />
    </div>
  );
}

export default OgVerdict;

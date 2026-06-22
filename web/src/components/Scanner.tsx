import { type ComponentType, type ReactNode, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  BadgeDollarSign,
  BarChart3,
  Bell,
  Calendar,
  CheckCircle2,
  Coins,
  Cpu,
  Crown,
  Crosshair,
  FileDown,
  ExternalLink,
  Filter,
  Fingerprint,
  Flame,
  Gauge,
  Globe,
  Info,
  ChevronDown,
  GitBranch,
  Loader2,
  Lock,
  RadioTower,
  RotateCcw,
  Search,
  Settings,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Target,
  Users,
  Wallet,
  Zap,
} from "lucide-react";
import { CoinDetailDialog } from "@/components/CoinDetailDialog";
import { CopyMintButton } from "@/components/CopyMintButton";
import { ScanProgress } from "@/components/ScanProgress";
import {
  dexScreenerChartUrl,
  enrichTokensWithMarketIntel,
  forensicOgAttribution,
  fmtHolderCount,
  fmtNum,
  fmtPct,
  fmtUsd,
  hasPulledOrDeadLiquidity,
  isTrustedOgScanCandidate,
  jupSearchToken,
  shortAddr,
  shortDate,
  tokenDexPaidLabel,
  tokenEffectiveLiquidityUsd,
  tokenMigrationDateIso,
  tokenOgCreatedAtIso,
  type ForensicOgReport,
  type JupTokenInfo,
  type TokenForensicScores,
} from "@/lib/og";
import { cn } from "@/lib/utils";
import { HelpLabel, ScoreMeter, TokenTruthLegend, labelToneClass, scoreTextClass } from "@/components/TokenTruthKit";
import { OgVerdict } from "@/components/scanner-20x/OgVerdict";
import { ScanHistory, addToScanHistory } from "@/components/scanner-20x/ScanHistory";
import { ComparativeScan } from "@/components/scanner-20x/ComparativeScan";
import { downloadReportPdf } from "@/lib/reportPdf";
import { classifyToken, TIER_LABEL } from "@/lib/classification";
import { forensicToInput } from "@/lib/classificationAdapter";

import { getChain, explorerAddressUrl, isSolana } from "@/lib/chains";

const PUMPFUN_BASE_URL = "https://pump.fun/coin";
const SOLSCAN_BASE_URL = "https://solscan.io/token";

type Props = { onSelect: (mint: string) => void; initialQuery?: string };

type ScanSortMode = "dominance" | "origin" | "risk" | "liquidity" | "marketCap" | "holders" | "oldest" | "activity";

type ScanFilters = {
  minLiq: number;
  minMcap: number;
  minHolders: number;
  minDominance: number;
  minOrigin: number;
  maxRisk: number;
  verifiedOnly: boolean;
  greenOnly: boolean;
  hideClones: boolean;
  hideLpPulled: boolean;
  authoritySafeOnly: boolean;
  primaryOnly: boolean;
  dexPaidOnly: boolean;
  sortBy: ScanSortMode;
};

const DEFAULT_FILTERS: ScanFilters = {
  minLiq: 1000,
  minMcap: 0,
  minHolders: 0,
  minDominance: 0,
  minOrigin: 0,
  maxRisk: 100,
  verifiedOnly: false,
  greenOnly: false,
  hideClones: false,
  hideLpPulled: true,
  authoritySafeOnly: false,
  primaryOnly: false,
  dexPaidOnly: false,
  sortBy: "dominance",
};

const PRESET_FILTERS: Array<{ label: string; filters: ScanFilters }> = [
  {
    label: "Primary Hunt",
    filters: { ...DEFAULT_FILTERS, primaryOnly: true, minDominance: 55, sortBy: "dominance" },
  },
  {
    label: "OG Proof",
    filters: { ...DEFAULT_FILTERS, minOrigin: 65, hideClones: true, sortBy: "oldest" },
  },
  {
    label: "Clean Only",
    filters: { ...DEFAULT_FILTERS, maxRisk: 45, authoritySafeOnly: true, hideClones: true, sortBy: "risk" },
  },
  {
    label: "Whale/Holder",
    filters: { ...DEFAULT_FILTERS, minHolders: 500, sortBy: "holders" },
  },
  {
    label: "Paid DEX",
    filters: { ...DEFAULT_FILTERS, dexPaidOnly: true, sortBy: "activity" },
  },
];

function forensicKey(t: JupTokenInfo): string {
  return `${t.chainId ?? "solana"}:${t.id}`;
}

function tokenScore(report: ForensicOgReport | undefined, token: JupTokenInfo): TokenForensicScores | undefined {
  return report?.tokenScores[forensicKey(token)];
}

function tokenMarketCap(token: JupTokenInfo): number {
  return token.mcap ?? token.fdv ?? 0;
}

function tokenHolderConcentration(token: JupTokenInfo): number | undefined {
  return token.topHoldersPercent ?? token.audit?.topHoldersPercentage;
}

function tokenAuthoritySafe(token: JupTokenInfo): boolean {
  const mintDisabled: boolean | undefined = token.heliusAuthorities?.mintAuthorityDisabled ?? token.audit?.mintAuthorityDisabled;
  const freezeDisabled: boolean | undefined = token.heliusAuthorities?.freezeAuthorityDisabled ?? token.audit?.freezeAuthorityDisabled;
  return mintDisabled === true && freezeDisabled === true;
}

function tokenAuthorityLabel(token: JupTokenInfo): string {
  if (tokenAuthoritySafe(token)) return "Locked";
  const mintDisabled: boolean | undefined = token.heliusAuthorities?.mintAuthorityDisabled ?? token.audit?.mintAuthorityDisabled;
  const freezeDisabled: boolean | undefined = token.heliusAuthorities?.freezeAuthorityDisabled ?? token.audit?.freezeAuthorityDisabled;
  if (mintDisabled === false || freezeDisabled === false) return "Open risk";
  return "Unknown";
}

function tokenOldestProofMs(token: JupTokenInfo): number {
  const dates: string[] = [tokenOgCreatedAtIso(token), token.firstPool?.createdAt, tokenMigrationDateIso(token)].filter((value): value is string => Boolean(value));
  const parsed: number[] = dates.map((value) => new Date(value).getTime()).filter((value) => Number.isFinite(value));
  return parsed.length > 0 ? Math.min(...parsed) : Number.POSITIVE_INFINITY;
}

function scoreOrDefault(score: number | undefined, fallback = 0): number {
  return Number.isFinite(score) ? Math.round(score ?? fallback) : fallback;
}

function passesScanFilters(t: JupTokenInfo, filters: ScanFilters, score?: TokenForensicScores): boolean {
  if (tokenEffectiveLiquidityUsd(t) < filters.minLiq) return false;
  if (tokenMarketCap(t) < filters.minMcap) return false;
  if ((t.holderCount ?? 0) < filters.minHolders) return false;
  if (scoreOrDefault(score?.dominanceScore) < filters.minDominance) return false;
  if (scoreOrDefault(score?.originScore) < filters.minOrigin) return false;
  if (scoreOrDefault(score?.riskScore) > filters.maxRisk) return false;
  if (filters.verifiedOnly && !t.isVerified) return false;
  if (filters.greenOnly && (t.stats24h?.priceChange ?? 0) < 0) return false;
  if (filters.hideClones && ((score?.cloneScore ?? 0) >= 50 || score?.classification.primary_label.includes("CLONE") || score?.classification.primary_label.includes("COPY"))) return false;
  if (filters.hideLpPulled && hasPulledOrDeadLiquidity(t)) return false;
  if (filters.authoritySafeOnly && !tokenAuthoritySafe(t)) return false;
  if (filters.primaryOnly && score?.isPrimaryToken !== true) return false;
  if (filters.dexPaidOnly && tokenDexPaidLabel(t) === "—") return false;
  return true;
}

function sortScanResults(tokens: JupTokenInfo[], filters: ScanFilters, report: ForensicOgReport | undefined): JupTokenInfo[] {
  return [...tokens].sort((a, b) => {
    const scoreA: TokenForensicScores | undefined = tokenScore(report, a);
    const scoreB: TokenForensicScores | undefined = tokenScore(report, b);

    if (filters.sortBy === "oldest") return tokenOldestProofMs(a) - tokenOldestProofMs(b);
    if (filters.sortBy === "risk") return scoreOrDefault(scoreA?.riskScore, 50) - scoreOrDefault(scoreB?.riskScore, 50);

    const valueFor = (token: JupTokenInfo, score: TokenForensicScores | undefined): number => {
      switch (filters.sortBy) {
        case "origin":
          return scoreOrDefault(score?.originScore);
        case "liquidity":
          return tokenEffectiveLiquidityUsd(token);
        case "marketCap":
          return tokenMarketCap(token);
        case "holders":
          return token.holderCount ?? 0;
        case "activity":
          return scoreOrDefault(score?.onChainActivityScore) + (token.stats24h?.numTraders ?? 0) * 0.08 + ((token.stats24h?.buyVolume ?? 0) + (token.stats24h?.sellVolume ?? 0)) / 100_000;
        case "dominance":
        default:
          return scoreOrDefault(score?.dominanceScore) || tokenMarketCap(token) * 0.000001 + tokenEffectiveLiquidityUsd(token) * 0.00001;
      }
    };

    return valueFor(b, scoreB) - valueFor(a, scoreA);
  });
}

export const Scanner = ({ onSelect, initialQuery = "" }: Props) => {
  const [q, setQ] = useState<string>(initialQuery);
  const [debounced, setDebounced] = useState<string>(initialQuery.trim());
  const [filters, setFilters] = useState<ScanFilters>(DEFAULT_FILTERS);
  const [showFilters, setShowFilters] = useState<boolean>(false);

  useEffect(() => {
    const cleanQuery: string = initialQuery.trim();
    if (!cleanQuery) return;
    setQ(cleanQuery);
    setDebounced(cleanQuery);
  }, [initialQuery]);

  const { data, isFetching } = useQuery({
    queryKey: ["scan", debounced, "forensic-v10-scanner-controls"],
    queryFn: async (): Promise<ForensicOgReport> => {
      const report: ForensicOgReport = await forensicOgAttribution(debounced);
      if (report.candidates.length > 0) return report;

      const tokens: JupTokenInfo[] = await jupSearchToken(debounced);
      const fallbackCandidates: JupTokenInfo[] = (await enrichTokensWithMarketIntel(tokens, { includeAth: false, maxBirdeye: 12 }))
        .filter(isTrustedOgScanCandidate);
      return { ...report, candidates: fallbackCandidates, copycats: fallbackCandidates.slice(1) };
    },
    enabled: debounced.length >= 2,
    staleTime: 30_000,
  });

  const report: ForensicOgReport | undefined = data;
  const rawResults: JupTokenInfo[] = report?.candidates ?? [];
  const filteredResults: JupTokenInfo[] = useMemo(() => {
    const passing: JupTokenInfo[] = rawResults.filter((t) => passesScanFilters(t, filters, tokenScore(report, t)));
    return sortScanResults(passing, filters, report);
  }, [rawResults, filters, report]);
  const dropped: number = rawResults.length - filteredResults.length;
  const highRiskVisible: number = filteredResults.filter((token) => (tokenScore(report, token)?.riskScore ?? 0) >= 65 || hasPulledOrDeadLiquidity(token)).length;
  const primaryToken: JupTokenInfo | undefined = report?.primaryToken ?? filteredResults.find((token) => tokenScore(report, token)?.isPrimaryToken);
  const firstMintToken: JupTokenInfo | undefined = report?.firstMintToken ?? filteredResults.find((token) => tokenScore(report, token)?.isFirstMintToken);
  const primaryScore: TokenForensicScores | undefined = primaryToken ? tokenScore(report, primaryToken) : undefined;

  // Persist completed scans to the global scan history feed
  useEffect(() => {
    const tok = primaryToken ?? firstMintToken ?? filteredResults[0];
    if (!tok || !report) return;
    const sc = tokenScore(report, tok);
    addToScanHistory({
      mint: tok.id,
      symbol: tok.symbol ?? "",
      name: tok.name ?? "",
      rugScore: sc?.riskScore ?? null,
      liquidity: tokenEffectiveLiquidityUsd(tok),
      marketCap: tok.mcap ?? tok.fdv ?? null,
      holders: tok.holderCount ?? null,
      priceAtScan: tok.usdPrice ?? null,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [report?.narrativeFingerprintId, primaryToken?.id, firstMintToken?.id]);

  const cleanAll = filters.authoritySafeOnly && filters.hideLpPulled;
  const moduleDefs: Array<{ key: string; label: string; desc: string; icon: ComponentType<{ className?: string }>; active: boolean; onToggle: () => void }> = [
    { key: "primary", label: "Primary Hunt", desc: "Surface the dominant origin token", icon: Crown, active: filters.primaryOnly, onToggle: () => setFilters({ ...filters, primaryOnly: !filters.primaryOnly }) },
    { key: "ogproof", label: "OG Proof", desc: "Hide clones & copycats", icon: Fingerprint, active: filters.hideClones, onToggle: () => setFilters({ ...filters, hideClones: !filters.hideClones }) },
    { key: "clean", label: "Clean Only", desc: "Authority locked + LP safe", icon: ShieldCheck, active: cleanAll, onToggle: () => setFilters({ ...filters, authoritySafeOnly: !cleanAll, hideLpPulled: !cleanAll }) },
    { key: "whale", label: "Whale / Holder", desc: "Rank by holder strength", icon: Users, active: filters.sortBy === "holders", onToggle: () => setFilters({ ...filters, sortBy: filters.sortBy === "holders" ? "dominance" : "holders" }) },
    { key: "dexpaid", label: "Paid DEX", desc: "Only paid-boost tokens", icon: BadgeDollarSign, active: filters.dexPaidOnly, onToggle: () => setFilters({ ...filters, dexPaidOnly: !filters.dexPaidOnly }) },
    { key: "reset", label: "Reset", desc: "Clear all modules & filters", icon: RotateCcw, active: false, onToggle: () => setFilters(DEFAULT_FILTERS) },
  ];
  const featureChips: Array<{ label: string; icon: ComponentType<{ className?: string }> }> = [
    { label: "Secure", icon: Shield },
    { label: "Private", icon: Lock },
    { label: "Real-Time", icon: Zap },
    { label: "Multi-Chain", icon: Globe },
    { label: "Advanced AI", icon: Sparkles },
  ];
  const searching = debounced.length >= 2;
  const runScan = () => { window.clearTimeout((window as unknown as { __og?: number }).__og); setDebounced(q.trim()); };

  return (
    <section id="scanner" className="relative scroll-mt-36 space-y-4">
      {/* ── Header ── */}
      <div className="relative overflow-hidden rounded-3xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/[0.06] via-white/[0.02] to-transparent p-5">
        <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-emerald-500/20 blur-3xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="grid h-12 w-12 flex-none place-items-center rounded-2xl bg-gradient-to-br from-emerald-500 to-green-400 shadow-lg shadow-emerald-500/30">
              <Crosshair className="h-6 w-6 text-white" strokeWidth={2.2} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black tracking-tight text-white">OG Scanner</h2>
                <span className="rounded-full border border-emerald-400/40 bg-emerald-500/15 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-emerald-300">Forensic</span>
              </div>
              <p className="mt-1 max-w-md text-xs leading-relaxed text-white/45">Forensic origin attribution for any token. Verify the OG, expose clones, audit liquidity, holders &amp; risk.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2 text-right sm:block">
              <div className="text-[9px] uppercase tracking-widest text-white/30">Enterprise Grade</div>
              <div className="text-xs font-bold text-emerald-300">Forensic Engine</div>
            </div>
            <button type="button" onClick={() => setShowFilters((v) => !v)} title="Advanced mode" className={cn("grid h-9 w-9 place-items-center rounded-xl border transition", showFilters ? "border-emerald-400/50 bg-emerald-500/15 text-emerald-300" : "border-white/10 bg-white/[0.03] text-white/50 hover:text-white")}>
              <Settings className="h-4 w-4" />
            </button>
            <button type="button" className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/[0.03] text-white/50 transition hover:text-white"><Bell className="h-4 w-4" /></button>
            <button type="button" className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/[0.03] text-white/50 transition hover:text-white"><Cpu className="h-4 w-4" /></button>
          </div>
        </div>
      </div>

      {/* ── Search ── */}
      <div className="relative">
        <div className="flex items-center gap-2 rounded-2xl border border-emerald-500/25 bg-white/[0.03] p-2 backdrop-blur-xl focus-within:border-emerald-400/60">
          <Search className="ml-2 h-5 w-5 flex-none text-emerald-400" />
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              window.clearTimeout((window as unknown as { __og?: number }).__og);
              (window as unknown as { __og?: number }).__og = window.setTimeout(() => setDebounced(e.target.value.trim()), 300);
            }}
            onKeyDown={(e) => { if (e.key === "Enter") runScan(); }}
            placeholder="$BONK · WIF · So111…1112"
            className="min-w-0 flex-1 bg-transparent px-1 font-mono text-sm tracking-wide text-white placeholder:text-white/25 focus:outline-none"
          />
          {isFetching && <Loader2 className="h-4 w-4 flex-none animate-spin text-emerald-400" />}
          <span className="hidden text-[10px] uppercase tracking-widest text-white/30 sm:inline">{rawResults.length ? `${filteredResults.length}/${rawResults.length} HITS` : "READY"}</span>
          <button type="button" onClick={runScan} className="flex flex-none items-center gap-1.5 rounded-xl bg-gradient-to-br from-emerald-500 to-green-400 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-emerald-500/30 transition hover:brightness-110">
            Scan <ArrowRight className="h-4 w-4" />
          </button>
        </div>
        <div className={`pointer-events-none absolute inset-x-0 top-0 h-px overflow-hidden transition-opacity duration-300 ${isFetching ? "opacity-100" : "opacity-0"}`}>
          <div className="scan-line h-full w-full bg-gradient-to-r from-transparent via-emerald-400 to-transparent" />
        </div>
      </div>

      {/* ── Feature chips ── */}
      <div className="flex flex-wrap items-center gap-2">
        {featureChips.map((chip) => (
          <span key={chip.label} className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[11px] font-semibold text-white/55">
            <chip.icon className="h-3.5 w-3.5 text-emerald-400" /> {chip.label}
          </span>
        ))}
      </div>

      <ScanProgress active={isFetching} query={debounced} />

      {/* ── Advanced mode (collapsible filters) ── */}
      {showFilters && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-xl">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-emerald-300"><Filter className="h-3.5 w-3.5" /> Advanced Mode</span>
            <div className="ml-auto flex flex-wrap gap-1.5">
              {PRESET_FILTERS.map((preset) => (
                <button key={preset.label} type="button" onClick={() => setFilters(preset.filters)} className="rounded-full border border-white/12 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-white/55 transition hover:border-emerald-400/50 hover:text-emerald-300">{preset.label}</button>
              ))}
              <button type="button" onClick={() => setFilters(DEFAULT_FILTERS)} className="rounded-full border border-white/12 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-white/55 transition hover:border-emerald-400/50 hover:text-emerald-300">RESET</button>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <FilterNum label="MIN LIQ" value={filters.minLiq} step={1000} min={0} onChange={(v) => setFilters({ ...filters, minLiq: Math.max(0, v) })} />
            <FilterNum label="MIN MCAP" value={filters.minMcap} step={10_000} min={0} onChange={(v) => setFilters({ ...filters, minMcap: v })} />
            <FilterNum label="MIN HOLDERS" value={filters.minHolders} step={100} min={0} onChange={(v) => setFilters({ ...filters, minHolders: v })} />
            <FilterNum label="MIN DOM" value={filters.minDominance} step={5} min={0} max={100} onChange={(v) => setFilters({ ...filters, minDominance: Math.min(100, v) })} />
            <FilterNum label="MIN ORIGIN" value={filters.minOrigin} step={5} min={0} max={100} onChange={(v) => setFilters({ ...filters, minOrigin: Math.min(100, v) })} />
            <FilterNum label="MAX RISK" value={filters.maxRisk} step={5} min={0} max={100} onChange={(v) => setFilters({ ...filters, maxRisk: Math.min(100, v) })} />
            <FilterSelect label="SORT" value={filters.sortBy} onChange={(v) => setFilters({ ...filters, sortBy: v })} />
            <div className="grid grid-cols-2 gap-2">
              <FilterToggle label="LP SAFE" value={filters.hideLpPulled} onChange={(v) => setFilters({ ...filters, hideLpPulled: v })} />
              <FilterToggle label="NO CLONES" value={filters.hideClones} onChange={(v) => setFilters({ ...filters, hideClones: v })} />
            </div>
            <FilterToggle label="PRIMARY ONLY" value={filters.primaryOnly} onChange={(v) => setFilters({ ...filters, primaryOnly: v })} />
            <FilterToggle label="AUTH LOCKED" value={filters.authoritySafeOnly} onChange={(v) => setFilters({ ...filters, authoritySafeOnly: v })} />
            <FilterToggle label="VERIFIED" value={filters.verifiedOnly} onChange={(v) => setFilters({ ...filters, verifiedOnly: v })} />
            <FilterToggle label="GREEN 24H" value={filters.greenOnly} onChange={(v) => setFilters({ ...filters, greenOnly: v })} />
            <FilterToggle label="DEX PAID" value={filters.dexPaidOnly} onChange={(v) => setFilters({ ...filters, dexPaidOnly: v })} />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-white/40">
            <span><span className="text-emerald-300">{filteredResults.length}</span> shown</span><span>·</span>
            <span><span className="text-red-400">{dropped}</span> filtered</span><span>·</span>
            <span><span className={highRiskVisible > 0 ? "text-red-400" : "text-emerald-300"}>{highRiskVisible}</span> visible risk alerts</span>
          </div>
        </div>
      )}

      {searching ? (
        <>
          {report && rawResults.length > 0 && (
            <>
              <div className="grid gap-2.5 rounded-2xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-xl sm:grid-cols-2 xl:grid-cols-6">
                <ForensicStat icon={Fingerprint} label="Narrative ID" value={report.narrativeFingerprintId} accent="text-og-cyan" />
                <ForensicStat icon={GitBranch} label="Cluster" value={`${report.summary.candidateCount} tokens · ${report.summary.chainCount} chain${report.summary.chainCount !== 1 ? "s" : ""}`} accent="text-og-gold" />
                <ForensicStat icon={ShieldCheck} label="Primary" value={primaryToken ? `$${primaryToken.symbol}` : "Unknown"} accent="text-emerald-300" />
                <ForensicStat icon={Calendar} label="First Mint" value={firstMintToken ? shortDate(tokenOgCreatedAtIso(firstMintToken)) : "Unknown"} accent="text-og-gold" />
                <ForensicStat icon={Gauge} label="Primary Score" value={report.summary.primaryDominanceScore != null ? `${report.summary.primaryDominanceScore}%` : "—"} accent="text-og-cyan" />
                <ForensicStat icon={ShieldAlert} label="Risk Queue" value={`${report.summary.highRiskCount} flagged`} accent={report.summary.highRiskCount > 0 ? "text-red-400" : "text-emerald-300"} />
              </div>
              <LegendToggle />
              {primaryToken && <OgVerdict token={primaryToken} score={primaryScore} report={report} />}
            </>
          )}
          <div className={`grid grid-cols-1 gap-2 transition-opacity duration-500 ${isFetching ? "opacity-0 pointer-events-none" : "opacity-100"}`}>
            {filteredResults.slice(0, 18).map((t) => (
              <ResultRow key={forensicKey(t)} t={t} score={tokenScore(report, t)} report={report} onSelect={() => onSelect(t.id)} />
            ))}
            {!isFetching && rawResults.length === 0 && (
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center text-xs uppercase tracking-widest text-white/40">NO MATCHES // EOF</div>
            )}
            {!isFetching && rawResults.length > 0 && filteredResults.length === 0 && (
              <div className="rounded-2xl border border-dashed border-white/12 p-8 text-center text-xs uppercase tracking-widest text-white/40">NO RESULTS PASS FILTERS · RESET OR LOWER THE BAR</div>
            )}
          </div>
        </>
      ) : (
        <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-5">
          <div className="mb-4 flex items-center gap-2">
            <Target className="h-4 w-4 text-emerald-400" />
            <h3 className="text-sm font-black uppercase tracking-widest text-white">Scan Modules</h3>
            <span className="ml-auto text-[10px] uppercase tracking-widest text-white/30">tap to arm</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {moduleDefs.map((m) => (
              <button key={m.key} type="button" onClick={m.onToggle} className={cn("group flex items-start gap-3 rounded-2xl border p-4 text-left transition", m.active ? "border-emerald-400/50 bg-emerald-500/[0.08]" : "border-white/10 bg-white/[0.03] hover:border-emerald-400/30 hover:bg-white/[0.05]")}>
                <span className={cn("mt-0.5 grid h-5 w-5 flex-none place-items-center rounded-md border transition", m.active ? "border-emerald-400 bg-emerald-400 text-black" : "border-white/20 text-transparent")}>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                </span>
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5 text-sm font-bold text-white"><m.icon className={cn("h-4 w-4", m.active ? "text-emerald-300" : "text-white/40")} /> {m.label}</span>
                  <span className="mt-0.5 block text-[11px] leading-snug text-white/40">{m.desc}</span>
                </span>
              </button>
            ))}
          </div>

          <button type="button" onClick={() => setShowFilters((v) => !v)} className="mt-4 flex w-full items-center gap-3 rounded-2xl border border-emerald-500/25 bg-gradient-to-r from-emerald-500/[0.08] to-transparent p-4 text-left transition hover:border-emerald-400/40">
            <span className="grid h-9 w-9 flex-none place-items-center rounded-xl bg-emerald-500/15 text-emerald-300"><Settings className="h-4 w-4" /></span>
            <span className="min-w-0">
              <span className="block text-sm font-bold text-white">Advanced Mode</span>
              <span className="block text-[11px] text-white/40">Fine-tune liquidity, market cap, origin, risk thresholds &amp; sort order</span>
            </span>
            <ChevronDown className={cn("ml-auto h-4 w-4 flex-none text-white/40 transition-transform", showFilters && "rotate-180")} />
          </button>

          <div className="mt-5 grid gap-3 lg:grid-cols-2">
            <ScanHistory onSelect={onSelect} />
            <ComparativeScan onSelect={onSelect} />
          </div>
          <div className="mt-5 rounded-2xl border border-white/[0.06] bg-white/[0.01] p-4">
            <div className="grid gap-3 text-[11px] sm:grid-cols-4">
              <div><div className="font-bold text-emerald-300">Forensic</div><div className="mt-0.5 text-white/35">Origin attribution, clone lineage, dev wallet tracing</div></div>
              <div><div className="font-bold text-emerald-300">Coverage</div><div className="mt-0.5 text-white/35">Solana &amp; multi-chain via Jupiter, DexScreener, Helius</div></div>
              <div><div className="font-bold text-emerald-300">Safety</div><div className="mt-0.5 text-white/35">LP status, authority locks, holder concentration</div></div>
              <div><div className="font-bold text-emerald-300">Reports</div><div className="mt-0.5 text-white/35">Export full intelligence reports as PDF</div></div>
            </div>
            <div className="mt-3 border-t border-white/[0.06] pt-3 text-center text-[11px] font-semibold tracking-wide text-white/40">Built for truth. Backed by data. Secured by privacy.</div>
          </div>
        </div>
      )}
    </section>
  );
};

const FilterNum = ({
  label,
  value,
  onChange,
  step,
  min = 0,
  max,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step: number;
  min?: number;
  max?: number;
}) => (
  <label className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-2.5 py-2 font-mono text-[10px] uppercase tracking-widest">
    <span className="text-muted-foreground">{label}</span>
    <input
      type="number"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(Math.max(min, Number(e.target.value) || 0))}
      className="og-filter-input w-24 px-2 py-1 text-right text-foreground outline-none"
    />
  </label>
);

const FilterSelect = ({ label, value, onChange }: { label: string; value: ScanSortMode; onChange: (v: ScanSortMode) => void }) => (
  <label className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-2.5 py-2 font-mono text-[10px] uppercase tracking-widest">
    <span className="text-muted-foreground">{label}</span>
    <select
      value={value}
      onChange={(event) => onChange(event.target.value as ScanSortMode)}
      className="og-filter-input w-32 px-2 py-1 text-right text-foreground outline-none"
    >
      <option value="dominance">Dominance</option>
      <option value="origin">Origin</option>
      <option value="risk">Lowest Risk</option>
      <option value="liquidity">Liquidity</option>
      <option value="marketCap">Market Cap</option>
      <option value="holders">Holders</option>
      <option value="oldest">Oldest Proof</option>
      <option value="activity">Activity</option>
    </select>
  </label>
);

const FilterToggle = ({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) => (
  <button
    type="button"
    onClick={() => onChange(!value)}
    className={`rounded-xl border px-2.5 py-2 text-left font-mono text-[10px] uppercase tracking-widest transition ${
      value
        ? "border-og-lime bg-og-lime/10 text-og-lime"
        : "border-white/10 text-foreground/55 hover:border-og-cyan/50 hover:text-og-cyan"
    }`}
  >
    {label} · {value ? "ON" : "OFF"}
  </button>
);

const LegendToggle = () => {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.3em] text-og-cyan transition hover:text-og-lime"
      >
        <Info className="h-3 w-3" /> How scoring works
        <ChevronDown className={cn("ml-auto h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
      </button>
      {open && <div className="border-t border-white/5 px-3 py-3"><TokenTruthLegend compact /></div>}
    </div>
  );
};

const ResultRow = ({ t, score, report, onSelect }: { t: JupTokenInfo; score?: TokenForensicScores; report?: ForensicOgReport; onSelect: () => void }) => {
  const [pdfBusy, setPdfBusy] = useState(false);
  const handlePdf = async () => { setPdfBusy(true); try { await downloadReportPdf({ token: t, score, report }); } catch (e) { console.error(e); } finally { setPdfBusy(false); } };
  const ch: number = t.stats24h?.priceChange ?? 0;
  const up: boolean = ch >= 0;
  const firstMintDate: string = shortDate(tokenOgCreatedAtIso(t));
  const dexPaid: string = tokenDexPaidLabel(t);
  const dexDisplay: string = dexPaid === "—" ? "No paid boost" : dexPaid;
  const originScore: number = score?.originScore ?? 0;
  const cloneScore: number = score?.cloneScore ?? 0;
  const riskScore: number = score?.riskScore ?? (hasPulledOrDeadLiquidity(t) ? 92 : 0);
  const dominanceScore: number = score?.dominanceScore ?? 0;
  const label: string = score?.classification.primary_label ?? "SCANNED";
  const ogTier = classifyToken(forensicToInput(t, score)).tier;
  const tierToneMap: Record<string, string> = { OG_TOKEN: "border-og-lime/50 text-og-lime", SAFE_CLONE: "border-og-cyan/50 text-og-cyan", RISKY_TOKEN: "border-og-gold/50 text-og-gold", DANGEROUS_TOKEN: "border-og-blood/50 text-og-blood" };
  const secondaryLabels: string[] = score?.classification.secondary_labels.slice(0, 3) ?? [];
  const chartUrl: string = dexScreenerChartUrl(t);
  const lpPulled: boolean = hasPulledOrDeadLiquidity(t);
  const cardTone: string = lpPulled || riskScore >= 70
    ? "collector-token-card--danger"
    : score?.isPrimaryToken
      ? "collector-token-card--primary"
      : "collector-token-card--copy";

  return (
    <article className={cn(
      "group relative overflow-hidden rounded-2xl border bg-white/[0.03] backdrop-blur-xl text-left transition duration-200 hover:bg-white/[0.05] hover:-translate-y-0.5",
      lpPulled || riskScore >= 70 ? "border-og-blood/45" : score?.isPrimaryToken ? "border-og-gold/45" : "border-white/10",
    )}>
      {/* Top row: avatar + name + price + label + actions */}
      <div className="flex items-center gap-3 px-3 pt-3 pb-2">
        {/* Avatar */}
        <div className="relative h-10 w-10 flex-none overflow-hidden rounded-xl">
          {t.icon ? (
            <img src={t.icon} alt={t.symbol} className="h-full w-full object-cover" loading="lazy" />
          ) : (
            <div className="grid h-full w-full place-items-center bg-og-cyan/10 font-display text-base font-black text-og-lime">
              {t.symbol?.slice(0, 1) ?? "?"}
            </div>
          )}
        </div>

        {/* Name + label */}
        <div
          role="button"
          tabIndex={0}
          onClick={onSelect}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onSelect(); }}
          className="min-w-0 flex-1 cursor-pointer focus:outline-none"
        >
          <div className="flex items-baseline gap-2 min-w-0">
            <span className="font-display text-base font-black tracking-tight text-foreground truncate">${t.symbol}</span>
            {t.isVerified && <span className="rounded-full bg-og-lime/20 px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-widest text-og-lime flex-none">✓ VFD</span>}
            {lpPulled && <span className="rounded-full bg-og-blood/20 px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-widest text-og-blood flex-none">LP PULLED</span>}
            {score?.isPrimaryToken && !lpPulled && <span className="rounded-full bg-og-gold/15 px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-widest text-og-gold flex-none"><Crown className="inline h-2.5 w-2.5 mr-0.5" />PRIMARY</span>}
          </div>
          <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground truncate">
            {!isSolana(t.chainId ?? "solana") && <span className="text-og-cyan mr-1">{getChain(t.chainId ?? "solana").emoji} {getChain(t.chainId ?? "solana").shortName} ·</span>}
            {t.name} · {shortAddr(t.id, 4)}
          </div>
        </div>

        {/* Price + change */}
        <div className="flex-none text-right font-mono">
          <div className="text-sm font-bold text-foreground">{fmtUsd(t.usdPrice)}</div>
          <div className={`text-[10px] ${up ? "text-og-lime" : "text-og-blood"}`}>{fmtPct(ch)} 24H</div>
        </div>
      </div>

      {/* Score chips row */}
      <div className="flex flex-wrap items-center gap-1.5 px-3 pb-2 font-mono text-[9px] uppercase tracking-widest">
        <span className={`rounded-full border px-2 py-0.5 ${dominanceScore >= 70 ? "border-og-lime/40 text-og-lime" : dominanceScore >= 45 ? "border-og-cyan/40 text-og-cyan" : "border-white/12 text-muted-foreground"}`}>
          DOM {dominanceScore}%
        </span>
        <span className={`rounded-full border px-2 py-0.5 ${scoreTextClass("origin", originScore)} border-current/30`}>
          ORI {originScore}%
        </span>
        <span className={`rounded-full border px-2 py-0.5 ${scoreTextClass("risk", riskScore)} border-current/30`}>
          RSK {riskScore}%
        </span>
        <span className={`rounded-full border px-2 py-0.5 ${scoreTextClass("clone", cloneScore)} border-current/30`}>
          CLN {cloneScore}%
        </span>
        <span className="rounded-full border border-og-cyan/30 px-2 py-0.5 text-og-cyan">
          LP {fmtUsd(tokenEffectiveLiquidityUsd(t))}
        </span>
        <span className="rounded-full border border-og-grid px-2 py-0.5 text-muted-foreground">
          H {fmtHolderCount(t.holderCount)}
        </span>
        <span className={`rounded-full border px-2 py-0.5 ${tierToneMap[ogTier]} font-display font-black text-[9px]`}>
          {TIER_LABEL[ogTier]}
        </span>
        <span className={`rounded-full border px-2 py-0.5 ${labelToneClass(label)} border-current/30 font-display font-black text-[9px]`}>
          {label}
        </span>
        {secondaryLabels.map((s) => (
          <span key={s} className="rounded-full border border-og-cyan/20 bg-og-cyan/5 px-1.5 py-0.5 text-og-cyan/70">{s}</span>
        ))}
      </div>

      {/* Stats + actions row */}
      <div className="flex flex-wrap items-center gap-2 border-t border-white/10 px-3 py-2 font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
        <span><RadioTower className="inline h-2.5 w-2.5 mr-0.5" />{firstMintDate}</span>
        <span>·</span>
        <span><ShieldCheck className="inline h-2.5 w-2.5 mr-0.5" />{tokenAuthorityLabel(t)}</span>
        <span>·</span>
        <span className={dexPaid === "—" ? "text-muted-foreground" : "text-og-lime"}><BadgeDollarSign className="inline h-2.5 w-2.5 mr-0.5" />{dexDisplay}</span>
        <span className="ml-auto flex items-center gap-1.5">
          <QuickTool href={chartUrl} icon={<BarChart3 className="h-3 w-3" />} label="Chart" />
          <QuickTool href={explorerAddressUrl(t.chainId ?? "solana", t.id)} icon={<ExternalLink className="h-3 w-3" />} label="Explorer" />
          {isSolana(t.chainId ?? "solana") && <QuickTool href={`${PUMPFUN_BASE_URL}/${t.id}`} icon={<Flame className="h-3 w-3" />} label="Pump" />}
          <button type="button" onClick={handlePdf} disabled={pdfBusy} title="Generate OG Scan Intelligence Report" className="collector-action px-2 py-1 inline-flex items-center gap-1 disabled:opacity-50">
            {pdfBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileDown className="h-3 w-3" />} Report
          </button>
          <CoinDetailDialog token={t} onOpenScanner={() => onSelect()} actionLabel="Intel" className="collector-action px-2 py-1" />
          <CopyMintButton mint={t.id} label="Copy" copiedLabel="✓" className="collector-action border-og-cyan/45 px-2 py-1 text-og-cyan" />
        </span>
      </div>
    </article>
  );
};


const QuickTool = ({ href, icon, label }: { href: string; icon: ReactNode; label: string }) => (
  <a
    href={href}
    target="_blank"
    rel="noreferrer"
    onClick={(event) => event.stopPropagation()}
    className="collector-action inline-flex items-center justify-center gap-1 px-2 py-1 text-foreground/70 transition"
  >
    {icon}
    {label}
  </a>
);

const ForensicStat = ({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
  accent?: string;
}) => (
  <div className="min-w-0 rounded-xl border border-white/10 bg-white/[0.04] p-2.5 font-mono uppercase tracking-widest">
    <div className="flex items-center gap-1 text-[9px] text-muted-foreground">
      <Icon className="h-3 w-3" /> <HelpLabel label={label} />
    </div>
    <div className={`mt-1 truncate text-[11px] ${accent ?? "text-foreground"}`}>{value}</div>
  </div>
);

const MiniIntel = ({
  icon: Icon,
  label,
  value,
  accent,
  meter,
  valueClassName,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
  accent?: string;
  meter?: ReactNode;
  valueClassName?: string;
}) => (
  <span className="collector-stat-tile min-w-0 px-1.5 py-1">
    <span className="flex items-center gap-1 text-foreground/40">
      <Icon className="h-2.5 w-2.5" /> <HelpLabel label={label} />
    </span>
    <span className={`block truncate ${valueClassName ?? accent ?? "text-foreground"}`}>{value}</span>
    {meter}
  </span>
);

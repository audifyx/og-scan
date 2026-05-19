import { type ComponentType, type ReactNode, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  BadgeDollarSign,
  BarChart3,
  Calendar,
  Coins,
  Crosshair,
  ExternalLink,
  Filter,
  Fingerprint,
  Flame,
  Gauge,
  GitBranch,
  Loader2,
  RadioTower,
  Search,
  ShieldAlert,
  ShieldCheck,
  Target,
  Users,
  Wallet,
} from "lucide-react";
import { CoinDetailDialog } from "@/components/CoinDetailDialog";
import { CopyMintButton } from "@/components/CopyMintButton";
import {
  dexScreenerChartUrl,
  enrichTokensWithMarketIntel,
  forensicOgAttribution,
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
import { HelpLabel, ScoreMeter, TokenTruthLegend, labelToneClass, scoreTextClass } from "@/components/TokenTruthKit";

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
  hasAth: boolean;
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
  hasAth: false,
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
  if (filters.hasAth && t.allTimeHighUsd == null) return false;
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
      const fallbackCandidates: JupTokenInfo[] = (await enrichTokensWithMarketIntel(tokens, { includeAth: true, maxAth: 12 }))
        .filter((token: JupTokenInfo): boolean => (token.chainId ?? "solana") === "solana")
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

  return (
    <section id="scanner" className="relative scroll-mt-36">
      <div>
        <div className="mb-6">
          <div className="mb-2 flex items-center gap-2 text-[10px] uppercase tracking-[0.4em] text-og-cyan">
            <span className="h-px w-10 bg-og-cyan" /> SCANNER.EXE
          </div>
          <h2 className="font-display text-3xl font-bold tracking-tight sm:text-5xl">
            <span className="text-foreground">SCAN ANY</span>{" "}
            <span className="text-og-cyan text-glow">MINT</span>
          </h2>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            Search any Solana ticker, meme, brand, narrative, or CA. The scanner now layers OG proof, dominance, holder concentration, liquidity authenticity, authority status, DEX paid signals, and quick investigation tools into one triage board.
          </p>
        </div>

        <div className="relative">
          <div className="og-search-box px-3">
            <Search className="h-4 w-4 text-og-cyan" />
            <input
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                window.clearTimeout((window as unknown as { __og?: number }).__og);
                (window as unknown as { __og?: number }).__og = window.setTimeout(() => setDebounced(e.target.value.trim()), 300);
              }}
              placeholder="$BONK · WIF · So111…1112"
              className="og-search-input px-1 font-mono text-sm tracking-wide"
            />
            {isFetching && <Loader2 className="mr-3 h-4 w-4 animate-spin text-og-lime" />}
            <span className="mr-3 hidden text-[10px] uppercase tracking-widest text-muted-foreground sm:inline">
              {rawResults.length ? `${filteredResults.length}/${rawResults.length} HITS` : "READY"}
            </span>
          </div>

          {isFetching && (
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px overflow-hidden">
              <div className="scan-line h-full w-full bg-gradient-to-r from-transparent via-og-lime to-transparent" />
            </div>
          )}
        </div>

        <div className="mt-3 border border-og-grid bg-og-ink/70 p-3 shadow-[0_24px_80px_-60px_hsl(var(--og-cyan))]">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.3em] text-og-cyan">
              <Filter className="h-3 w-3" /> scanner filters
            </div>
            <div className="ml-auto flex flex-wrap gap-1.5">
              {PRESET_FILTERS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => setFilters(preset.filters)}
                  className="border border-og-grid px-2 py-1 font-mono text-[9px] uppercase tracking-widest text-foreground/60 transition hover:border-og-lime hover:text-og-lime"
                >
                  {preset.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setFilters(DEFAULT_FILTERS)}
                className="border border-og-grid px-2 py-1 font-mono text-[9px] uppercase tracking-widest text-foreground/60 transition hover:border-og-cyan hover:text-og-cyan"
              >
                RESET
              </button>
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
            <FilterToggle label="HAS ATH" value={filters.hasAth} onChange={(v) => setFilters({ ...filters, hasAth: v })} />
            <FilterToggle label="DEX PAID" value={filters.dexPaidOnly} onChange={(v) => setFilters({ ...filters, dexPaidOnly: v })} />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            <span><span className="text-og-lime">{filteredResults.length}</span> shown</span>
            <span>·</span>
            <span><span className="text-og-blood">{dropped}</span> filtered</span>
            <span>·</span>
            <span><span className={highRiskVisible > 0 ? "text-og-blood" : "text-og-lime"}>{highRiskVisible}</span> visible risk alerts</span>
          </div>
        </div>

        {report && rawResults.length > 0 && (
          <>
            <div className="mt-4 grid gap-2 border border-og-cyan/35 bg-og-cyan/5 p-3 sm:grid-cols-2 xl:grid-cols-6">
              <ForensicStat icon={Fingerprint} label="Narrative ID" value={report.narrativeFingerprintId} accent="text-og-cyan" />
              <ForensicStat icon={GitBranch} label="Cluster" value={`${report.summary.candidateCount} Solana tokens`} accent="text-og-gold" />
              <ForensicStat icon={ShieldCheck} label="Primary" value={primaryToken ? `$${primaryToken.symbol}` : "Unknown"} accent="text-og-lime" />
              <ForensicStat icon={Calendar} label="First Mint" value={firstMintToken ? shortDate(tokenOgCreatedAtIso(firstMintToken)) : "Unknown"} accent="text-og-gold" />
              <ForensicStat icon={Gauge} label="Primary Score" value={report.summary.primaryDominanceScore != null ? `${report.summary.primaryDominanceScore}%` : "—"} accent="text-og-cyan" />
              <ForensicStat icon={ShieldAlert} label="Risk Queue" value={`${report.summary.highRiskCount} flagged`} accent={report.summary.highRiskCount > 0 ? "text-og-blood" : "text-og-lime"} />
            </div>
            <div className="mt-3">
              <TokenTruthLegend compact />
            </div>
          </>
        )}

        <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-2">
          {filteredResults.slice(0, 18).map((t) => (
            <ResultRow key={forensicKey(t)} t={t} score={tokenScore(report, t)} onSelect={() => onSelect(t.id)} />
          ))}
          {debounced.length >= 2 && !isFetching && rawResults.length === 0 && (
            <div className="col-span-full border border-og-grid bg-og-ink/70 p-6 text-center text-xs uppercase tracking-widest text-muted-foreground">
              NO MATCHES // EOF
            </div>
          )}
          {debounced.length >= 2 && !isFetching && rawResults.length > 0 && filteredResults.length === 0 && (
            <div className="col-span-full border border-dashed border-og-grid p-6 text-center text-xs uppercase tracking-widest text-muted-foreground">
              NO RESULTS PASS FILTERS · RESET OR LOWER THE BAR
            </div>
          )}
          {debounced.length < 2 && (
            <div className="col-span-full border border-dashed border-og-grid p-6 text-center text-xs uppercase tracking-widest text-muted-foreground">
              › type 2+ chars to engage
            </div>
          )}
        </div>
      </div>
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
  <label className="flex items-center justify-between gap-2 border border-og-grid bg-og-ink px-2 py-1.5 font-mono text-[10px] uppercase tracking-widest">
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
  <label className="flex items-center justify-between gap-2 border border-og-grid bg-og-ink px-2 py-1.5 font-mono text-[10px] uppercase tracking-widest">
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
    className={`border px-2 py-1.5 text-left font-mono text-[10px] uppercase tracking-widest transition ${
      value
        ? "border-og-lime bg-og-lime/10 text-og-lime"
        : "border-og-grid text-foreground/60 hover:border-og-cyan hover:text-og-cyan"
    }`}
  >
    {label} · {value ? "ON" : "OFF"}
  </button>
);

const ResultRow = ({ t, score, onSelect }: { t: JupTokenInfo; score?: TokenForensicScores; onSelect: () => void }) => {
  const ch: number = t.stats24h?.priceChange ?? 0;
  const up: boolean = ch >= 0;
  const migrationDate: string = shortDate(tokenMigrationDateIso(t));
  const firstMintDate: string = shortDate(tokenOgCreatedAtIso(t));
  const dexPaid: string = tokenDexPaidLabel(t);
  const originScore: number = score?.originScore ?? 0;
  const cloneScore: number = score?.cloneScore ?? 0;
  const riskScore: number = score?.riskScore ?? (hasPulledOrDeadLiquidity(t) ? 92 : 0);
  const dominanceScore: number = score?.dominanceScore ?? 0;
  const label: string = score?.classification.primary_label ?? "SCANNED";
  const secondaryLabels: string[] = score?.classification.secondary_labels.slice(0, 5) ?? [];
  const holderConcentration: number | undefined = tokenHolderConcentration(t);
  const holderConcentrationLabel: string = holderConcentration != null ? `${Math.round(holderConcentration)}% top` : "—";
  const chartUrl: string = dexScreenerChartUrl(t);
  const lpPulled: boolean = hasPulledOrDeadLiquidity(t);
  const cardTone: string = lpPulled || riskScore >= 70 ? "hover:border-og-blood hover:bg-og-blood/5" : score?.isPrimaryToken ? "hover:border-og-lime hover:bg-og-lime/5" : "hover:border-og-cyan hover:bg-og-cyan/5";

  return (
    <article className={`group flex flex-col gap-3 border border-og-grid bg-og-ink/70 p-3 text-left transition ${cardTone}`}>
      <div className="flex gap-3">
        <button type="button" onClick={onSelect} className="flex min-w-0 flex-1 items-center gap-4 text-left">
          <div className="relative h-12 w-12 shrink-0 overflow-hidden border border-og-grid bg-og-ink">
            {t.icon ? (
              <img src={t.icon} alt={t.symbol} className="h-full w-full object-cover" loading="lazy" />
            ) : (
              <div className="grid h-full w-full place-items-center text-xs text-og-lime">{t.symbol?.[0]}</div>
            )}
            {score?.isPrimaryToken ? <span className="absolute bottom-0 right-0 h-2.5 w-2.5 bg-og-lime shadow-[0_0_12px_hsl(var(--og-lime))]" /> : null}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate font-display text-sm font-bold text-og-gold">${t.symbol}</span>
              {t.isVerified && <ShieldCheck className="h-3 w-3 text-og-lime" />}
              {lpPulled && <ShieldAlert className="h-3 w-3 text-og-blood" />}
              <span className="ml-auto text-xs text-foreground">{fmtUsd(t.usdPrice)}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-widest text-muted-foreground">
              <span className="truncate">{t.name}</span>
              <span className={up ? "text-og-lime" : "text-og-blood"}>{fmtPct(ch)}</span>
              <span>· LQ {fmtUsd(tokenEffectiveLiquidityUsd(t))}</span>
              <span>· MC {fmtUsd(tokenMarketCap(t))}</span>
            </div>
            <div className="mt-1 font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
              CA {shortAddr(t.id, 5)} · {score?.primaryStatusNote ?? "Open detail panel for full token truth."}
            </div>
          </div>
        </button>
        <div className="flex shrink-0 flex-col gap-2">
          <CoinDetailDialog token={t} onOpenScanner={() => onSelect()} actionLabel="Load" className="px-2 py-1" />
          <CopyMintButton mint={t.id} className="border-og-cyan/45 text-og-cyan hover:bg-og-cyan hover:text-og-ink" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-1.5 font-mono text-[9px] uppercase tracking-widest text-muted-foreground sm:grid-cols-4 xl:grid-cols-5">
        <MiniIntel icon={Gauge} label="Dominance" value={score ? `#${score.dominanceRank} · ${dominanceScore}%` : "—"} accent={dominanceScore >= 70 ? "text-og-lime" : dominanceScore >= 45 ? "text-og-cyan" : "text-muted-foreground"} meter={score ? <ScoreMeter score={dominanceScore} kind="cto" className="mt-1" /> : undefined} />
        <MiniIntel icon={Fingerprint} label="Origin" value={score ? `${originScore}%` : "—"} accent={scoreTextClass("origin", originScore)} meter={score ? <ScoreMeter score={originScore} kind="origin" className="mt-1" /> : undefined} />
        <MiniIntel icon={ShieldAlert} label="Risk" value={score || lpPulled ? `${riskScore}%` : "—"} accent={scoreTextClass("risk", riskScore)} meter={score || lpPulled ? <ScoreMeter score={riskScore} kind="risk" className="mt-1" /> : undefined} />
        <MiniIntel icon={Target} label="Clone" value={score ? `${cloneScore}%` : "—"} accent={scoreTextClass("clone", cloneScore)} meter={score ? <ScoreMeter score={cloneScore} kind="clone" className="mt-1" /> : undefined} />
        <MiniIntel icon={GitBranch} label="Label" value={label} valueClassName={labelToneClass(label)} />
        <MiniIntel icon={ShieldCheck} label="Authority" value={tokenAuthorityLabel(t)} accent={tokenAuthoritySafe(t) ? "text-og-lime" : "text-og-gold"} />
        <MiniIntel icon={Users} label="Holders" value={fmtNum(t.holderCount)} accent={(t.holderCount ?? 0) >= 1000 ? "text-og-lime" : "text-muted-foreground"} />
        <MiniIntel icon={Wallet} label="Top 10" value={holderConcentrationLabel} accent={(holderConcentration ?? 0) > 45 ? "text-og-blood" : holderConcentration != null ? "text-og-lime" : undefined} />
        <MiniIntel icon={Activity} label="Activity" value={score ? `${score.onChainActivityScore}%` : fmtNum(t.stats24h?.numTraders)} accent={score && score.onChainActivityScore >= 60 ? "text-og-lime" : "text-og-cyan"} />
        <MiniIntel icon={Coins} label="Pools" value={fmtNum(t.poolCount ?? t.allPools?.length)} accent={(t.poolCount ?? 0) > 1 ? "text-og-cyan" : undefined} />
        <MiniIntel icon={Flame} label="ATH" value={fmtUsd(t.allTimeHighUsd)} accent="text-og-gold" />
        <MiniIntel icon={Calendar} label="ATH Date" value={shortDate(t.allTimeHighAt)} accent="text-og-gold" />
        <MiniIntel icon={RadioTower} label="First Mint" value={firstMintDate} accent={score?.isFirstMintToken ? "text-og-lime" : "text-og-gold"} />
        <MiniIntel icon={Calendar} label="Migrated" value={migrationDate} accent="text-og-cyan" />
        <MiniIntel icon={BadgeDollarSign} label="DEX" value={dexPaid} accent={dexPaid === "—" ? undefined : "text-og-lime"} />
      </div>

      {secondaryLabels.length > 0 && (
        <div className="flex flex-wrap gap-1 font-mono text-[8px] uppercase tracking-widest">
          {secondaryLabels.map((secondary) => (
            <span key={secondary} className="border border-og-cyan/30 bg-og-cyan/10 px-1.5 py-0.5 text-og-cyan">
              {secondary}
            </span>
          ))}
        </div>
      )}

      <div className="grid grid-cols-3 gap-2 border-t border-og-grid/70 pt-2 font-mono text-[9px] uppercase tracking-widest sm:flex sm:flex-wrap">
        <QuickTool href={chartUrl} icon={<BarChart3 className="h-3 w-3" />} label="Chart" />
        <QuickTool href={`${SOLSCAN_BASE_URL}/${t.id}`} icon={<ExternalLink className="h-3 w-3" />} label="Solscan" />
        <QuickTool href={`${PUMPFUN_BASE_URL}/${t.id}`} icon={<Flame className="h-3 w-3" />} label="Pump" />
        <button type="button" onClick={onSelect} className="border border-og-grid px-2 py-1 text-foreground/60 transition hover:border-og-lime hover:text-og-lime">
          Deep Scan
        </button>
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
    className="inline-flex items-center justify-center gap-1 border border-og-grid px-2 py-1 text-foreground/60 transition hover:border-og-cyan hover:text-og-cyan"
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
  <div className="min-w-0 border border-og-grid/70 bg-og-ink/70 p-2 font-mono uppercase tracking-widest">
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
  <span className="min-w-0 border border-og-grid/60 bg-og-ink/55 px-1.5 py-1">
    <span className="flex items-center gap-1 text-foreground/40">
      <Icon className="h-2.5 w-2.5" /> <HelpLabel label={label} />
    </span>
    <span className={`block truncate ${valueClassName ?? accent ?? "text-foreground"}`}>{value}</span>
    {meter}
  </span>
);

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  Crosshair,
  ExternalLink,
  ShieldCheck,
  ShieldAlert,
  Loader2,
  Crown,
  Copy,
  Skull,
  Droplets,
  Users,
  Calendar,
  Snowflake,
  Lock,
  Unlock,
  Filter,
  Fingerprint,
  GitBranch,
  Network,
  BrainCircuit,
  AlertTriangle,
} from "lucide-react";
import { CoinDetailDialog } from "@/components/CoinDetailDialog";
import { CopyMintButton } from "@/components/CopyMintButton";
import { ScanProgress } from "@/components/ScanProgress";
import {
  dexScreenerChartUrl,
  forensicOgAttribution,
  fmtHolderCount,
  fmtPct,
  fmtUsd,
  fmtNum,
  fmtWhaleCount,
  shortAddr,
  timeAgo,
  tokenDexPaidLabel,
  tokenEffectiveLiquidityUsd,
  tokenMigrationDateIso,
  tokenOgCreatedAtIso,
  tokenOgCreatedAtMs,
  type ForensicOgReport,
  type JupTokenInfo,
  type TokenForensicScores,
} from "@/lib/og";
import {
  HelpLabel,
  ScoreMeter,
  TokenRiskAlerts,
  TokenTruthLegend,
  buildClusterRiskAlerts,
  buildTokenRiskAlerts,
  copycatDangerScore,
  labelToneClass,
  proofTimestampText,
  scoreTextClass,
} from "@/components/TokenTruthKit";

type Props = { onSelect: (mint: string) => void };

const QUICK_TICKERS = ["TRUMP", "YE", "FARTCOIN", "OG", "BONK", "WIF", "POPCAT"];

type FinderFilters = {
  minScore: number;
  minLiq: number;
  verifiedOnly: boolean;
  hideHighRisk: boolean;
};

const DEFAULT_FILTERS: FinderFilters = {
  minScore: 0,
  minLiq: 1000,
  verifiedOnly: false,
  hideHighRisk: false,
};

// OG score is intentionally age-only after quote-backed LP safety gates. Price,
// verification, migration, and market hype never decide OG status.
function ogScore(t: JupTokenInfo, oldest: number | null): number {
  const created = tokenOgCreatedAtMs(t);
  if (!Number.isFinite(created) || !oldest) return 0;
  const ageDays = Math.max(0, (Date.now() - created) / 86_400_000);
  const oldestDays = Math.max(1, (Date.now() - oldest) / 86_400_000);
  return Math.min(100, Math.round((ageDays / oldestDays) * 100));
}

function ageDaysFromIso(createdAt: string | undefined): number | null {
  if (!createdAt) return null;
  const createdMs = new Date(createdAt).getTime();
  if (!Number.isFinite(createdMs)) return null;
  return Math.max(0, Math.floor((Date.now() - createdMs) / 86_400_000));
}

function shortDate(createdAt: string | undefined): string {
  return createdAt ? new Date(createdAt).toISOString().slice(0, 10) : "—";
}

function forensicKey(t: JupTokenInfo): string {
  return `${t.chainId ?? "solana"}:${t.id}`;
}

function rugRisk(t: JupTokenInfo): "low" | "med" | "high" {
  let bad = 0;
  if (!t.audit?.mintAuthorityDisabled) bad++;
  if (!t.audit?.freezeAuthorityDisabled) bad++;
  if ((t.audit?.topHoldersPercentage ?? 0) > 40) bad++;
  if (tokenEffectiveLiquidityUsd(t) < 5000) bad++;
  if (!t.isVerified) bad++;
  if (bad >= 4) return "high";
  if (bad >= 2) return "med";
  return "low";
}

export const OgFinder = ({ onSelect }: Props) => {
  const [q, setQ] = useState<string>("");
  const [submitted, setSubmitted] = useState<string>("");
  const [filters, setFilters] = useState<FinderFilters>(DEFAULT_FILTERS);
  const [showAllCopycats, setShowAllCopycats] = useState<boolean>(false);

  const { data, isFetching, refetch, dataUpdatedAt } = useQuery({
    queryKey: ["og-forensic-attribution", submitted, "v11-origin-primary-separated"],
    queryFn: (): Promise<ForensicOgReport> => forensicOgAttribution(submitted),
    enabled: submitted.length >= 1,
    staleTime: 30_000,
  });

  const report: ForensicOgReport | undefined = data;
  const og = report?.firstMintToken ?? report?.og ?? report?.primaryToken ?? null;
  const currentPrimary = report?.primaryToken ?? report?.og ?? null;
  const ogKey: string | undefined = og ? forensicKey(og) : undefined;
  const cats = report?.candidates.filter((token) => forensicKey(token) !== ogKey) ?? [];

  const oldestTs = useMemo(() => {
    const all = [og, ...cats].filter(Boolean) as JupTokenInfo[];
    const ts = all
      .map((t) => tokenOgCreatedAtMs(t))
      .filter((x): x is number => Number.isFinite(x));
    return ts.length ? Math.min(...ts) : null;
  }, [og, cats]);

  const ogS = og ? ogScore(og, oldestTs) : 0;
  const scanFreshness: string = useMemo(() => {
    if (isFetching) return "Verifying now";
    if (!dataUpdatedAt) return "Awaiting scan";
    const secondsAgo: number = Math.max(0, Math.floor((Date.now() - dataUpdatedAt) / 1000));
    if (secondsAgo < 45) return "Verified just now";
    return `Last full scan: ${timeAgo(Math.floor(dataUpdatedAt / 1000))} ago`;
  }, [dataUpdatedAt, isFetching]);

  const filteredCats = useMemo(() => {
    return cats.filter((c) => {
      const forensicScore: number = report?.tokenScores[forensicKey(c)]?.trueOgProbability ?? ogScore(c, oldestTs);
      if (forensicScore < filters.minScore) return false;
      if (tokenEffectiveLiquidityUsd(c) < filters.minLiq) return false;
      if (filters.verifiedOnly && !c.isVerified) return false;
      if (filters.hideHighRisk && rugRisk(c) === "high") return false;
      return true;
    });
  }, [cats, oldestTs, filters, report]);

  const droppedCats = cats.length - filteredCats.length;
  const topRiskyCopycats = useMemo(() => {
    return [...filteredCats]
      .sort((a, b) => {
        const scoreA = copycatDangerScore(a, report?.tokenScores[forensicKey(a)]);
        const scoreB = copycatDangerScore(b, report?.tokenScores[forensicKey(b)]);
        return scoreB - scoreA;
      })
      .slice(0, 3);
  }, [filteredCats, report]);
  const visibleCopycats: JupTokenInfo[] = showAllCopycats ? filteredCats : filteredCats.slice(0, 6);
  const reportAlerts = useMemo(() => {
    if (!report) return [];
    const originAlerts = report.firstMintToken ? buildTokenRiskAlerts(report.firstMintToken, report.tokenScores[forensicKey(report.firstMintToken)]) : [];
    return [...buildClusterRiskAlerts(report), ...originAlerts].slice(0, 5);
  }, [report]);

  const submit = (raw: string) => {
    setShowAllCopycats(false);
    const v = raw.trim().replace(/^\$/, "");
    setQ(v);
    setSubmitted(v);
  };

  return (
    <section className="relative">
      <div>
        <div className="mb-6">
          <div className="mb-2 flex items-center gap-2 text-[10px] uppercase tracking-[0.4em] text-og-gold">
            <span className="h-px w-10 bg-og-gold" /> /DIRECT · OG · SCANNER
          </div>
          <h2 className="font-display text-3xl font-bold tracking-tight sm:text-5xl">
            <span className="text-foreground">SCAN THE</span>{" "}
            <span className="text-og-gold text-glow-gold">DIRECT OG</span>
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Drop any ticker, meme, brand, or narrative. OGSCAN now shows both layers: the earliest Solana mint proof and the current Primary token by dominance. A later official winner can be Primary, while the first mint remains Legacy OG.
          </p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit(q);
          }}
          className="og-search-box pl-3"
        >
          <Crosshair className="h-4 w-4 text-og-gold" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="$OG · BONK · WIF · MOG"
            className="og-search-input px-1 font-mono text-sm tracking-wide"
          />
          {isFetching && <Loader2 className="mr-3 h-4 w-4 animate-spin text-og-gold" />}
          <button
            type="submit"
            className="og-search-action px-5 text-[11px] font-bold uppercase tracking-widest text-og-gold transition"
          >
            SCAN
          </button>
        </form>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">quick:</span>
          {QUICK_TICKERS.map((t) => (
            <button
              key={t}
              onClick={() => submit(t)}
              className="border border-og-grid bg-og-ink/60 px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-foreground/70 transition hover:border-og-gold hover:text-og-gold"
            >
              ${t}
            </button>
          ))}
          {submitted && (
            <>
              <span className="ml-auto rounded-full border border-og-cyan/25 bg-og-cyan/10 px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-og-cyan">
                {scanFreshness}
              </span>
              <button
                onClick={() => refetch()}
                className="border border-og-grid px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-og-cyan hover:border-og-cyan"
              >
                ↻ refresh
              </button>
            </>
          )}
        </div>

        {/* Animated scan progress — shown while fetching */}
        <ScanProgress active={isFetching} query={submitted} className="mt-4" />

        {submitted && (
          <div className={`mt-4 border border-og-grid bg-og-ink/70 p-3 transition-opacity duration-300 ${isFetching ? "pointer-events-none opacity-40" : "opacity-100"}`}>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.3em] text-og-gold">
                <Filter className="h-3 w-3" /> filters
              </div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                <span className="text-og-lime">{filteredCats.length}</span> cluster tokens shown · <span className="text-og-blood">{droppedCats}</span> filtered · LP-pulled scams are blocked before Primary/Legacy scoring
              </div>
              <button
                onClick={() => setFilters(DEFAULT_FILTERS)}
                className="ml-auto border border-og-grid px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-foreground/60 transition hover:border-og-gold hover:text-og-gold"
              >
                RESET
              </button>
            </div>
            <div className="grid gap-2 sm:grid-cols-4">
              <FilterNum label="MIN OG SCORE" value={filters.minScore} step={5} onChange={(v) => setFilters({ ...filters, minScore: v })} />
              <FilterNum label="MIN LIQ" value={filters.minLiq} step={1000} onChange={(v) => setFilters({ ...filters, minLiq: Math.max(1000, v) })} />
              <FilterToggle label="VERIFIED" value={filters.verifiedOnly} onChange={(v) => setFilters({ ...filters, verifiedOnly: v })} />
              <FilterToggle label="HIDE RUG RISK" value={filters.hideHighRisk} onChange={(v) => setFilters({ ...filters, hideHighRisk: v })} />
            </div>
          </div>
        )}

        {submitted && report && report.summary.candidateCount > 0 && (
          <>
            <ForensicReportPanel report={report} scanFreshness={scanFreshness} />
            <div className="mt-4 grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
              <TokenRiskAlerts alerts={reportAlerts} title="Watch Items" />
              <TokenTruthLegend compact />
            </div>
          </>
        )}

        {submitted && og && (
          <div className={`mt-8 grid gap-4 lg:grid-cols-3 transition-opacity duration-500 ${isFetching ? "opacity-0 pointer-events-none" : "opacity-100"}`}>
            <div className="lg:col-span-1">
              <div className="mb-2 flex items-center justify-between gap-2 text-[10px] uppercase tracking-[0.4em] text-og-gold">
                <span className="flex items-center gap-2">
                  <Crown className="h-3 w-3" /> TRUE OG / FIRST MINT
                </span>
                <ScoreBar score={report?.tokenScores[forensicKey(og)]?.dominanceScore ?? ogS} />
              </div>
              <CoinCard t={og} highlight score={report?.tokenScores[forensicKey(og)]?.originScore ?? ogS} forensic={report?.tokenScores[forensicKey(og)]} onSelect={() => onSelect(og.id)} />
              {currentPrimary && currentPrimary.id !== og.id ? (
                <div className="mt-3 rounded-2xl border border-og-cyan/35 bg-og-cyan/10 p-3 font-mono text-[10px] uppercase tracking-widest text-og-cyan">
                  current primary / market leader: <span className="text-foreground">${currentPrimary.symbol}</span> · {shortAddr(currentPrimary.id, 5)} · dominance {report?.tokenScores[forensicKey(currentPrimary)]?.dominanceScore ?? "—"}% · not first mint
                </div>
              ) : null}
            </div>
            <div className="lg:col-span-2">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-[10px] uppercase tracking-[0.4em] text-og-blood">
                <span className="flex items-center gap-2"><Copy className="h-3 w-3" /> CLUSTER TOKENS · {filteredCats.length}/{cats.length}</span>
                {filteredCats.length > 6 ? (
                  <button
                    type="button"
                    onClick={() => setShowAllCopycats((value) => !value)}
                    className="border border-og-blood/40 bg-og-blood/10 px-2 py-1 font-mono text-[9px] uppercase tracking-widest text-og-blood transition hover:bg-og-blood hover:text-og-ink"
                  >
                    {showAllCopycats ? "Show Top" : "View All"}
                  </button>
                ) : null}
              </div>
              {topRiskyCopycats.length > 0 ? (
                <TopRiskyCopycats tokens={topRiskyCopycats} report={report} onSelect={onSelect} />
              ) : null}
              {cats.length === 0 ? (
                <div className="border border-dashed border-og-grid p-6 text-center text-xs uppercase tracking-widest text-muted-foreground">
                  NO LATER TOKENS DETECTED
                </div>
              ) : filteredCats.length === 0 ? (
                <div className="border border-dashed border-og-grid p-6 text-center text-xs uppercase tracking-widest text-muted-foreground">
                  NO LATER TOKENS PASS FILTERS · RESET OR LOWER THE BAR
                </div>
              ) : (
                <div className="grid gap-2">
                  {visibleCopycats.map((c) => (
                    <CoinCard
                      key={forensicKey(c)}
                      t={c}
                      score={report?.tokenScores[forensicKey(c)]?.dominanceScore ?? ogScore(c, oldestTs)}
                      forensic={report?.tokenScores[forensicKey(c)]}
                      onSelect={() => onSelect(c.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {submitted && !isFetching && !og && (
          <div className="mt-8 border border-og-grid bg-og-ink/70 p-6 text-center text-xs uppercase tracking-widest text-muted-foreground">
            NO HITS // TRY ANOTHER TICKER
          </div>
        )}
        {!submitted && (
          <div className="mt-8 border border-dashed border-og-grid p-6 text-center text-xs uppercase tracking-widest text-muted-foreground">
            › enter a ticker, hit a quick chip, or press SCAN
          </div>
        )}
      </div>
    </section>
  );
};

const FilterNum = ({
  label,
  value,
  onChange,
  step,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step: number;
}) => (
  <label className="flex items-center justify-between gap-2 border border-og-grid bg-og-ink px-2 py-1.5 font-mono text-[10px] uppercase tracking-widest">
    <span className="text-muted-foreground">{label}</span>
    <input
      type="number"
      min={label === "MIN LIQ" ? 1000 : 0}
      step={step}
      value={value}
      onChange={(e) => onChange(Math.max(label === "MIN LIQ" ? 1000 : 0, Number(e.target.value) || 0))}
      className="og-filter-input w-24 px-2 py-1 text-right text-foreground outline-none"
    />
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
    onClick={() => onChange(!value)}
    className={`border px-2 py-1.5 text-left font-mono text-[10px] uppercase tracking-widest transition ${
      value
        ? "border-og-lime bg-og-lime/10 text-og-lime"
        : "border-og-grid text-foreground/60 hover:border-og-gold hover:text-og-gold"
    }`}
  >
    {label} · {value ? "ON" : "OFF"}
  </button>
);

const ScoreBar = ({ score }: { score: number }) => <ScoreMeter score={score} kind="origin" />;

const RiskBadge = ({ t }: { t: JupTokenInfo }) => {
  const r = rugRisk(t);
  const map = {
    low: { label: "LOW RISK", cls: "border-og-lime/60 text-og-lime", Icon: ShieldCheck },
    med: { label: "MID RISK", cls: "border-og-gold/60 text-og-gold", Icon: ShieldAlert },
    high: { label: "RUG RISK", cls: "border-og-blood/60 text-og-blood", Icon: Skull },
  } as const;
  const { label, cls, Icon } = map[r];
  return (
    <span className={`inline-flex items-center gap-1 border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest ${cls}`}>
      <Icon className="h-3 w-3" /> {label}
    </span>
  );
};

const CoinCard = ({
  t,
  onSelect,
  highlight = false,
  score,
  forensic,
}: {
  t: JupTokenInfo;
  onSelect: () => void;
  highlight?: boolean;
  score: number;
  forensic?: TokenForensicScores;
}) => {
  const ch = t.stats24h?.priceChange ?? 0;
  const up = ch >= 0;
  const onChainCreatedAt = tokenOgCreatedAtIso(t);
  const mintAgeDays = ageDaysFromIso(onChainCreatedAt);
  const poolCreatedAt = t.firstPool?.createdAt;
  const migrationCreatedAt = tokenMigrationDateIso(t);
  const dexPaid = tokenDexPaidLabel(t);
  const dexDisplay: string = dexPaid === "—" ? "No paid boost" : dexPaid;
  const chartUrl: string = dexScreenerChartUrl(t);
  const primaryLabel: string = forensic?.classification.primary_label ?? (highlight ? "TRUE OG" : "COPYCAT");
  const secondaryLabels: string[] = forensic?.classification.secondary_labels.slice(0, 5) ?? [];
  const riskScore: number = forensic?.riskScore ?? (t.lpPulled ? 92 : rugRisk(t) === "high" ? 78 : 0);
  const cloneScore: number = forensic?.cloneScore ?? 0;
  const dominanceScore: number = forensic?.dominanceScore ?? score;
  const rarityLabel: string = t.lpPulled || riskScore >= 70
    ? "Danger Foil"
    : forensic?.isFirstMintToken && forensic?.isPrimaryToken
      ? "True OG Holo"
      : forensic?.isFirstMintToken
        ? "Legacy OG"
        : forensic?.isPrimaryToken
          ? "Primary Holo"
          : cloneScore >= 50
            ? "Clone Card"
            : dominanceScore >= 70
              ? "Rare Runner"
              : "Cluster Card";
  const cardTone: string = t.lpPulled || riskScore >= 70
    ? "collector-token-card--danger"
    : highlight || forensic?.isFirstMintToken || forensic?.isPrimaryToken
      ? "collector-token-card--primary"
      : "collector-token-card--copy";

  return (
    <article className={`collector-token-card ${cardTone} group relative overflow-hidden text-left transition duration-200`}>
      {/* Top row: avatar + name/symbol + price */}
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

        {/* Name + badges */}
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
            {(t.lpPulled || riskScore >= 70) && <span className="rounded-full bg-og-blood/20 px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-widest text-og-blood flex-none">DANGER</span>}
            {forensic?.isPrimaryToken && !(t.lpPulled || riskScore >= 70) && <span className="rounded-full bg-og-gold/15 px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-widest text-og-gold flex-none"><Crown className="inline h-2.5 w-2.5 mr-0.5" />PRIMARY</span>}
            {forensic?.isFirstMintToken && !forensic?.isPrimaryToken && <span className="rounded-full bg-og-lime/15 px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-widest text-og-lime flex-none">LEGACY OG</span>}
          </div>
          <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground truncate">{t.name} · {shortAddr(t.id, 4)}</div>
        </div>

        {/* Price + change */}
        <div className="flex-none text-right font-mono">
          <div className="text-sm font-bold text-foreground">{fmtUsd(t.usdPrice)}</div>
          <div className={`text-[10px] ${up ? "text-og-lime" : "text-og-blood"}`}>{fmtPct(ch)} 24H</div>
        </div>
      </div>

      {/* Score + key metric chips */}
      <div className="flex flex-wrap items-center gap-1.5 px-3 pb-2 font-mono text-[9px] uppercase tracking-widest">
        <span className={`rounded-full border px-2 py-0.5 ${scoreTextClass("origin", dominanceScore)} border-current/30`}>DOM {dominanceScore}%</span>
        <span className={`rounded-full border px-2 py-0.5 ${scoreTextClass("origin", forensic?.originScore ?? score)} border-current/30`}>ORI {forensic?.originScore ?? score}%</span>
        <span className={`rounded-full border px-2 py-0.5 ${scoreTextClass("risk", riskScore)} border-current/30`}>RSK {riskScore}%</span>
        <span className={`rounded-full border px-2 py-0.5 ${scoreTextClass("clone", cloneScore)} border-current/30`}>CLN {cloneScore}%</span>
        <span className="rounded-full border border-og-cyan/30 px-2 py-0.5 text-og-cyan">LP {fmtUsd(tokenEffectiveLiquidityUsd(t))}</span>
        <span className="rounded-full border border-og-grid px-2 py-0.5 text-muted-foreground">H {fmtHolderCount(t.holderCount)}</span>
        <span className="rounded-full border border-og-grid px-2 py-0.5 text-muted-foreground">AGE {mintAgeDays != null ? `${mintAgeDays}d` : "—"}</span>
        <span className={`rounded-full border px-2 py-0.5 font-display font-black text-[9px] ${labelToneClass(primaryLabel)} border-current/30`}>{primaryLabel}</span>
        {secondaryLabels.map((s) => (
          <span key={s} className="rounded-full border border-og-cyan/20 bg-og-cyan/5 px-1.5 py-0.5 text-og-cyan/70">{s}</span>
        ))}
      </div>

      {/* Proof + audit + actions footer */}
      <div className="flex flex-wrap items-center gap-2 border-t border-white/10 px-3 py-2 font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
        <AuditChip ok={!!t.audit?.mintAuthorityDisabled} label="MINT" OkIcon={Lock} BadIcon={Unlock} />
        <AuditChip ok={!!t.audit?.freezeAuthorityDisabled} label="FREEZE" OkIcon={Snowflake} BadIcon={Snowflake} />
        <span><HelpLabel label="LP" /> {shortDate(poolCreatedAt)}</span>
        <span className={dexPaid === "—" ? "text-muted-foreground" : "text-og-lime"}>DEX {dexDisplay}</span>
        {forensic?.warnings[0] && (
          <span className="text-og-blood truncate max-w-[180px]">⚠ {forensic.warnings[0]}</span>
        )}
        <span className="ml-auto flex items-center gap-1.5">
          <a href={chartUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="collector-action inline-flex items-center gap-1 px-2 py-1 text-og-cyan">
            <BarChart3 className="h-3 w-3" /> Chart
          </a>
          <CoinDetailDialog token={t} onOpenScanner={() => onSelect()} actionLabel="Intel" className="collector-action px-2 py-1" />
          <CopyMintButton mint={t.id} label="Copy" copiedLabel="✓" className="collector-action px-2 py-1" iconClassName="h-3 w-3" />
        </span>
      </div>
    </article>
  );
};


const TopRiskyCopycats = ({ tokens, report, onSelect }: { tokens: JupTokenInfo[]; report: ForensicOgReport; onSelect: (mint: string) => void }) => {
  const hasAuthorityRisk: boolean = tokens.some((token) => token.audit?.mintAuthorityDisabled !== true || token.audit?.freezeAuthorityDisabled !== true);
  return (
    <div className="mb-3 border border-og-blood/35 bg-og-blood/[0.045] p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.3em] text-og-blood">
          <ShieldAlert className="h-3.5 w-3.5" /> top risky later tokens
        </div>
        <span className="rounded-full border border-og-blood/35 bg-og-ink/70 px-2 py-1 font-mono text-[9px] uppercase tracking-widest text-og-blood">
          ranked by risk + liquidity
        </span>
      </div>
      {hasAuthorityRisk ? (
        <div className="mb-2 border border-og-blood/45 bg-og-blood/10 px-3 py-2 font-mono text-[9px] uppercase tracking-widest text-og-blood">
          warning: one or more later tokens has mint/freeze authority open or unknown
        </div>
      ) : null}
      <div className="grid gap-2">
        {tokens.map((token) => {
          const forensic: TokenForensicScores | undefined = report.tokenScores[forensicKey(token)];
          const mintSafe: boolean = token.audit?.mintAuthorityDisabled === true;
          const freezeSafe: boolean = token.audit?.freezeAuthorityDisabled === true;
          return (
            <button
              key={forensicKey(token)}
              type="button"
              onClick={() => onSelect(token.id)}
              className="grid gap-2 border border-og-grid bg-og-ink/75 p-2 text-left transition hover:border-og-blood hover:bg-og-blood/10 sm:grid-cols-[1fr_auto]"
            >
              <div className="min-w-0">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="truncate font-display text-sm font-black text-foreground">${token.symbol}</span>
                  <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">CA {shortAddr(token.id, 5)}</span>
                </div>
                <div className="mt-1 grid grid-cols-1 gap-1.5 sm:grid-cols-2 md:grid-cols-5 font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
                  <span><HelpLabel label="ORIGIN" /> <span className={scoreTextClass("origin", forensic?.originScore ?? 0)}>{forensic ? `${forensic.originScore}%` : "—"}</span></span>
                  <span><HelpLabel label="RISK" /> <span className={scoreTextClass("risk", forensic?.riskScore ?? 0)}>{forensic ? `${forensic.riskScore}%` : "—"}</span></span>
                  <span>LP <span className="text-foreground">{shortDate(token.firstPool?.createdAt)}</span></span>
                  <span>WHALES <span className={(token.whaleCount ?? 0) >= 3 ? "text-og-blood" : "text-foreground"}>{fmtWhaleCount(token.whaleCount)}</span></span>
                  <span><HelpLabel label="MINT" /> <span className={mintSafe ? "text-og-lime" : "text-og-blood"}>{mintSafe ? "OFF" : "ON/UNK"}</span></span>
                  <span><HelpLabel label="FREEZE" /> <span className={freezeSafe ? "text-og-lime" : "text-og-blood"}>{freezeSafe ? "OFF" : "ON/UNK"}</span></span>
                </div>
              </div>
              <div className="flex items-center justify-between gap-2 sm:flex-col sm:items-end">
                <span className="font-mono text-[10px] uppercase tracking-widest text-og-gold">QUOTE LP {fmtUsd(tokenEffectiveLiquidityUsd(token))}</span>
                <span className="font-mono text-[9px] uppercase tracking-widest text-og-blood">danger {copycatDangerScore(token, forensic)}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

const ForensicReportPanel = ({ report, scanFreshness }: { report: ForensicOgReport; scanFreshness: string }) => {
  const ogScore: TokenForensicScores | undefined = report.primaryToken ? report.tokenScores[forensicKey(report.primaryToken)] : undefined;
  const firstMintScore: TokenForensicScores | undefined = report.firstMintToken ? report.tokenScores[forensicKey(report.firstMintToken)] : undefined;
  const mainAccent: string = ogScore?.classification.primary_label.includes("TRUE OG") || ogScore?.classification.primary_label.includes("REVIVED")
    ? "text-og-lime"
    : ogScore?.classification.primary_label.includes("CONTESTED")
      ? "text-orange-200"
      : "text-og-gold";
  return (
    <div className="mt-5 border border-og-gold/40 bg-og-gold/5 p-3 sm:p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.3em] text-og-gold">
          <Fingerprint className="h-3.5 w-3.5" /> forensic origin report
        </div>
        <span className="border border-og-grid bg-og-ink/80 px-2 py-1 font-mono text-[9px] uppercase tracking-widest text-og-cyan">
          {report.narrativeFingerprintId}
        </span>
        <span className="border border-og-grid bg-og-ink/80 px-2 py-1 font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
          normalized: {report.normalizedQuery}
        </span>
        <span className="ml-auto border border-og-lime/35 bg-og-lime/10 px-2 py-1 font-mono text-[9px] uppercase tracking-widest text-og-lime">
          {scanFreshness}
        </span>
      </div>

      <div className="grid gap-3 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="grid gap-2 sm:grid-cols-3">
          <ForensicMetric icon={Crown} label="PRIMARY STATUS" value={ogScore?.classification.primary_label ?? (report.primaryToken ? "PRIMARY" : "UNKNOWN")} accent={mainAccent} />
          <ForensicMetric icon={BrainCircuit} label="DOMINANCE" value={ogScore ? `${ogScore.dominanceScore}% · #${ogScore.dominanceRank}` : "—"} accent={scoreTextClass("origin", ogScore?.dominanceScore ?? 0)} />
          <ForensicMetric icon={Fingerprint} label="FIRST MINT" value={report.firstMintToken ? shortAddr(report.firstMintToken.id, 5) : "—"} accent={firstMintScore?.classification.primary_label === "LEGACY OG" ? "text-og-gold" : "text-og-lime"} />
          <ForensicMetric icon={ShieldAlert} label="CLONES" value={`${report.summary.cloneCount}/${report.summary.candidateCount}`} accent={report.summary.cloneCount > 0 ? "text-og-blood" : "text-og-lime"} />
          <ForensicMetric icon={Calendar} label="MINT PROOF" value={proofTimestampText(report.summary.earliestProof)} accent="text-og-lime" />
          <ForensicMetric icon={Droplets} label="FIRST LP" value={shortDate(report.summary.earliestLiquidity)} accent="text-og-cyan" />
        </div>

        <div className="border border-og-grid bg-og-ink/70 p-3">
          <div className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.3em] text-og-cyan">
            <GitBranch className="h-3 w-3" /> lineage map
          </div>
          <div className="space-y-1.5">
            {report.familyTree.slice(0, 7).map((node, index) => (
              <div key={`${node.relationship}-${node.token.id}`} className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-widest">
                <span className={report.tokenScores[forensicKey(node.token)]?.isPrimaryToken ? "text-og-lime" : report.tokenScores[forensicKey(node.token)]?.isFirstMintToken ? "text-og-gold" : "text-muted-foreground"}>{report.tokenScores[forensicKey(node.token)]?.classification.primary_label ?? (index === 0 ? "PRIMARY" : `├─ ${node.relationship}`)}</span>
                <span className="truncate text-foreground">${node.token.symbol}</span>
                <span className="ml-auto text-og-cyan">dom {node.score}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <div className="border border-og-grid bg-og-ink/70 p-3">
          <div className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.3em] text-og-lime">
            <Calendar className="h-3 w-3" /> chronological proof
          </div>
          <div className="space-y-1.5">
            {report.timeline.slice(0, 6).map((event) => (
              <div key={`${event.at}-${event.tokenId}-${event.type}`} className="grid grid-cols-[82px_1fr] gap-2 font-mono text-[9px] uppercase tracking-widest">
                <span className="text-muted-foreground">{shortDate(event.at)}</span>
                <span className="truncate text-foreground"><span className="text-og-cyan">{event.type}</span> · {event.detail}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="border border-og-grid bg-og-ink/70 p-3">
          <div className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.3em] text-og-blood">
            <AlertTriangle className="h-3 w-3" /> attribution warnings
          </div>
          <div className="space-y-1.5 font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
            <div><HelpLabel label="Control status" term="communitySupportShift" />: <span className="text-og-cyan">{ogScore?.classification.layers.control_status ?? "—"}</span></div>
            <div>Lifecycle status: <span className="text-og-cyan">{ogScore?.classification.layers.lifecycle_status ?? "—"}</span></div>
            <div>Primary rule: <span className="text-og-lime">{report.summary.primaryStatus ?? "—"}</span> · first mint authority <span className="text-og-gold">{shortAddr(report.summary.firstMintAuthorityWallet ?? undefined, 4)}</span></div>
            <div><HelpLabel label="CTO" /> score: <span className={scoreTextClass("cto", ogScore?.ctoScore ?? 0)}>{ogScore ? `${ogScore.ctoScore}%` : "—"}</span> · <HelpLabel label="Migration" /> score: <span className={scoreTextClass("migration", ogScore?.migrationScore ?? 0)}>{ogScore ? `${ogScore.migrationScore}%` : "—"}</span></div>
            <div>Priority labels: <span className="text-og-gold">TRUE OG · REVIVED OFFICIAL · LEGACY OG · CONTESTED · CLONE</span></div>
          </div>
        </div>
      </div>
    </div>
  );
};

const ForensicMetric = ({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  accent?: string;
}) => (
  <div className="border border-og-grid bg-og-ink/80 p-3 font-mono uppercase tracking-widest">
    <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground">
      <Icon className="h-3 w-3" /> <HelpLabel label={label} />
    </div>
    <div className={`mt-1 truncate text-sm ${accent ?? "text-foreground"}`}>{value}</div>
  </div>
);

const Stat = ({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  accent?: string;
}) => (
  <div className="collector-stat-tile min-w-0 px-1.5 py-1">
    <div className="flex items-center gap-1 text-foreground/40">
      <Icon className="h-2.5 w-2.5" /> <HelpLabel label={label} />
    </div>
    <div className={`truncate ${accent ?? "text-foreground"}`}>{value}</div>
  </div>
);

const AuditChip = ({
  ok,
  label,
  OkIcon,
  BadIcon,
}: {
  ok: boolean;
  label: string;
  OkIcon: React.ComponentType<{ className?: string }>;
  BadIcon: React.ComponentType<{ className?: string }>;
}) => {
  const Icon = ok ? OkIcon : BadIcon;
  return (
    <span
      className={`inline-flex items-center gap-1 border px-1.5 py-0.5 ${
        ok ? "border-og-lime/40 text-og-lime" : "border-og-blood/40 text-og-blood"
      }`}
    >
      <Icon className="h-2.5 w-2.5" /> <HelpLabel label={label} /> {ok ? "OFF" : "ON"}
    </span>
  );
};

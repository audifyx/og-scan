import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, ShieldCheck, Loader2, Filter, Calendar, Flame, BadgeDollarSign, Fingerprint, GitBranch, ShieldAlert } from "lucide-react";
import { CoinDetailDialog } from "@/components/CoinDetailDialog";
import { CopyMintButton } from "@/components/CopyMintButton";
import {
  enrichTokensWithMarketIntel,
  forensicOgAttribution,
  jupSearchToken,
  fmtPct,
  fmtUsd,
  shortAddr,
  shortDate,
  tokenDexPaidLabel,
  tokenMigrationDateIso,
  type ForensicOgReport,
  type JupTokenInfo,
  type TokenForensicScores,
} from "@/lib/og";

type Props = { onSelect: (mint: string) => void; initialQuery?: string };

type ScanFilters = {
  minLiq: number;
  minMcap: number;
  verifiedOnly: boolean;
  greenOnly: boolean;
};

const DEFAULT_FILTERS: ScanFilters = {
  minLiq: 0,
  minMcap: 0,
  verifiedOnly: false,
  greenOnly: false,
};

function forensicKey(t: JupTokenInfo): string {
  return `${t.chainId ?? "solana"}:${t.id}`;
}

function passesScanFilters(t: JupTokenInfo, filters: ScanFilters): boolean {
  if ((t.liquidity ?? 0) < filters.minLiq) return false;
  if ((t.mcap ?? t.fdv ?? 0) < filters.minMcap) return false;
  if (filters.verifiedOnly && !t.isVerified) return false;
  if (filters.greenOnly && (t.stats24h?.priceChange ?? 0) < 0) return false;
  return true;
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
    queryKey: ["scan", debounced, "forensic-v3"],
    queryFn: async (): Promise<ForensicOgReport> => {
      const report: ForensicOgReport = await forensicOgAttribution(debounced);
      if (report.candidates.length > 0) return report;

      const tokens: JupTokenInfo[] = await jupSearchToken(debounced);
      const fallbackCandidates: JupTokenInfo[] = await enrichTokensWithMarketIntel(tokens, { includeAth: true, maxAth: 12 });
      return { ...report, candidates: fallbackCandidates, copycats: fallbackCandidates.slice(1) };
    },
    enabled: debounced.length >= 2,
    staleTime: 30_000,
  });

  const report: ForensicOgReport | undefined = data;
  const rawResults: JupTokenInfo[] = report?.candidates ?? [];
  const filteredResults: JupTokenInfo[] = useMemo(() => {
    return rawResults.filter((t) => passesScanFilters(t, filters));
  }, [rawResults, filters]);
  const dropped: number = rawResults.length - filteredResults.length;

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
          <p className="mt-2 text-sm text-muted-foreground">
            Search a ticker, meme, brand, narrative, or mint. OGSCAN now clusters variants and ranks origin by earliest on-chain proof — not hype.
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

          {/* Scanning sweep line */}
          {isFetching && (
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px overflow-hidden">
              <div className="h-full w-full bg-gradient-to-r from-transparent via-og-lime to-transparent scan-line" />
            </div>
          )}
        </div>

        {/* Filters */}
        <div className="mt-3 border border-og-grid bg-og-ink/70 p-3">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.3em] text-og-cyan">
              <Filter className="h-3 w-3" /> filters
            </div>
            <button
              onClick={() => setFilters(DEFAULT_FILTERS)}
              className="ml-auto border border-og-grid px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-foreground/60 transition hover:border-og-cyan hover:text-og-cyan"
            >
              RESET
            </button>
          </div>
          <div className="grid gap-2 sm:grid-cols-4">
            <FilterNum label="MIN LIQ" value={filters.minLiq} step={1000} onChange={(v) => setFilters({ ...filters, minLiq: v })} />
            <FilterNum label="MIN MCAP" value={filters.minMcap} step={10_000} onChange={(v) => setFilters({ ...filters, minMcap: v })} />
            <FilterToggle label="VERIFIED" value={filters.verifiedOnly} onChange={(v) => setFilters({ ...filters, verifiedOnly: v })} />
            <FilterToggle label="GREEN 24H" value={filters.greenOnly} onChange={(v) => setFilters({ ...filters, greenOnly: v })} />
          </div>
          <div className="mt-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            <span className="text-og-lime">{filteredResults.length}</span> shown · <span className="text-og-blood">{dropped}</span> filtered
          </div>
        </div>

        {report && rawResults.length > 0 && (
          <div className="mt-4 grid gap-2 border border-og-cyan/35 bg-og-cyan/5 p-3 sm:grid-cols-4">
            <ForensicStat icon={Fingerprint} label="Narrative ID" value={report.narrativeFingerprintId} accent="text-og-cyan" />
            <ForensicStat icon={GitBranch} label="Cluster" value={`${report.summary.candidateCount} tokens · ${report.summary.chainCount} chains`} accent="text-og-gold" />
            <ForensicStat icon={ShieldCheck} label="True OG" value={report.og ? `${report.og.symbol}` : "Unknown"} accent="text-og-lime" />
            <ForensicStat icon={ShieldAlert} label="Clones" value={`${report.summary.cloneCount} flagged`} accent={report.summary.cloneCount > 0 ? "text-og-blood" : "text-og-lime"} />
          </div>
        )}

        {/* Results */}
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          {filteredResults.slice(0, 12).map((t) => (
            <ResultRow key={forensicKey(t)} t={t} score={report?.tokenScores[forensicKey(t)]} onSelect={() => onSelect(t.id)} />
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
      min={0}
      step={step}
      value={value}
      onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
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
        : "border-og-grid text-foreground/60 hover:border-og-cyan hover:text-og-cyan"
    }`}
  >
    {label} · {value ? "ON" : "OFF"}
  </button>
);

const ResultRow = ({ t, score, onSelect }: { t: JupTokenInfo; score?: TokenForensicScores; onSelect: () => void }) => {
  const ch = t.stats24h?.priceChange ?? 0;
  const up = ch >= 0;
  const migrationDate: string = shortDate(tokenMigrationDateIso(t));
  const dexPaid: string = tokenDexPaidLabel(t);
  const ogProbability: string = score ? `${score.originScore}%` : "—";
  const cloneProbability: string = score ? `${score.cloneScore}%` : "—";
  const label: string = score?.classification.primary_label ?? "SCANNED";
  const secondaryLabels: string[] = score?.classification.secondary_labels.slice(0, 4) ?? [];
  return (
    <article className="group flex items-center gap-3 border border-og-grid bg-og-ink/70 p-3 text-left transition hover:border-og-lime hover:bg-og-lime/5">
      <button type="button" onClick={onSelect} className="flex min-w-0 flex-1 items-center gap-4 text-left">
        <div className="relative h-10 w-10 shrink-0 overflow-hidden border border-og-grid bg-og-ink">
          {t.icon ? (
            <img src={t.icon} alt={t.symbol} className="h-full w-full object-cover" loading="lazy" />
          ) : (
            <div className="grid h-full w-full place-items-center text-xs text-og-lime">{t.symbol?.[0]}</div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-display text-sm font-bold text-og-gold">${t.symbol}</span>
            {t.isVerified && <ShieldCheck className="h-3 w-3 text-og-lime" />}
            <span className="ml-auto text-xs text-foreground">{fmtUsd(t.usdPrice)}</span>
          </div>
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-muted-foreground">
            <span className="truncate">{t.name}</span>
            <span className={up ? "text-og-lime" : "text-og-blood"}>{fmtPct(ch)}</span>
            <span>· LQ {fmtUsd(t.liquidity)}</span>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-1.5 font-mono text-[9px] uppercase tracking-widest text-muted-foreground sm:grid-cols-4">
            <MiniIntel icon={Fingerprint} label="Origin" value={ogProbability} accent={label.includes("TRUE OG") ? "text-og-lime" : "text-og-gold"} />
            <MiniIntel icon={ShieldAlert} label="Clone" value={cloneProbability} accent={(score?.cloneScore ?? 0) >= 70 ? "text-og-blood" : "text-foreground"} />
            <MiniIntel icon={GitBranch} label="Label" value={label} accent={label.includes("TRUE OG") ? "text-og-lime" : score ? "text-og-cyan" : undefined} />
            <MiniIntel icon={Flame} label="ATH" value={fmtUsd(t.allTimeHighUsd)} accent="text-og-gold" />
            <MiniIntel icon={Calendar} label="ATH Date" value={shortDate(t.allTimeHighAt)} accent="text-og-gold" />
            <MiniIntel icon={ShieldAlert} label="ATL" value={fmtUsd(t.allTimeLowUsd)} accent="text-og-cyan" />
            <MiniIntel icon={Calendar} label="Migrated" value={migrationDate} accent="text-og-cyan" />
            <MiniIntel icon={BadgeDollarSign} label="DEX" value={dexPaid} accent={dexPaid === "—" ? undefined : "text-og-lime"} />
          </div>
          {secondaryLabels.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1 font-mono text-[8px] uppercase tracking-widest">
              {secondaryLabels.map((secondary) => (
                <span key={secondary} className="border border-og-cyan/30 bg-og-cyan/10 px-1.5 py-0.5 text-og-cyan">
                  {secondary}
                </span>
              ))}
            </div>
          )}
          <div className="mt-1 font-mono text-[9px] uppercase tracking-widest text-muted-foreground">CA {shortAddr(t.id, 5)}</div>
        </div>
      </button>
      <div className="flex shrink-0 flex-col gap-2">
        <CoinDetailDialog token={t} onOpenScanner={() => onSelect()} actionLabel="Load" className="px-2 py-1" />
        <CopyMintButton mint={t.id} className="border-og-cyan/45 text-og-cyan hover:bg-og-cyan hover:text-og-ink" />
      </div>
    </article>
  );
};

const ForensicStat = ({
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
  <div className="min-w-0 border border-og-grid/70 bg-og-ink/70 p-2 font-mono uppercase tracking-widest">
    <div className="flex items-center gap-1 text-[9px] text-muted-foreground">
      <Icon className="h-3 w-3" /> {label}
    </div>
    <div className={`mt-1 truncate text-[11px] ${accent ?? "text-foreground"}`}>{value}</div>
  </div>
);

const MiniIntel = ({
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
  <span className="min-w-0 border border-og-grid/60 bg-og-ink/55 px-1.5 py-1">
    <span className="flex items-center gap-1 text-foreground/40">
      <Icon className="h-2.5 w-2.5" /> {label}
    </span>
    <span className={`block truncate ${accent ?? "text-foreground"}`}>{value}</span>
  </span>
);

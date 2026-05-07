import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, ShieldCheck, Loader2, Filter } from "lucide-react";
import { jupSearchToken, fmtPct, fmtUsd, fmtNum, type JupTokenInfo } from "@/lib/og";

type Props = { onSelect: (mint: string) => void };

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

function passesScanFilters(t: JupTokenInfo, filters: ScanFilters): boolean {
  if ((t.liquidity ?? 0) < filters.minLiq) return false;
  if ((t.mcap ?? t.fdv ?? 0) < filters.minMcap) return false;
  if (filters.verifiedOnly && !t.isVerified) return false;
  if (filters.greenOnly && (t.stats24h?.priceChange ?? 0) < 0) return false;
  return true;
}

export const Scanner = ({ onSelect }: Props) => {
  const [q, setQ] = useState<string>("");
  const [debounced, setDebounced] = useState<string>("");
  const [filters, setFilters] = useState<ScanFilters>(DEFAULT_FILTERS);

  const { data, isFetching } = useQuery({
    queryKey: ["scan", debounced],
    queryFn: () => jupSearchToken(debounced),
    enabled: debounced.length >= 2,
    staleTime: 30_000,
  });

  const rawResults: JupTokenInfo[] = data ?? [];
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
          <p className="mt-2 text-sm text-muted-foreground">Search by ticker, name, or paste a mint address. Powered by Jupiter token registry.</p>
        </div>

        <div className="relative">
          <div className="flex items-center border border-og-grid bg-og-ink/80 focus-within:border-og-lime">
            <Search className="ml-3 h-4 w-4 text-og-lime" />
            <input
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                window.clearTimeout((window as unknown as { __og?: number }).__og);
                (window as unknown as { __og?: number }).__og = window.setTimeout(() => setDebounced(e.target.value.trim()), 300);
              }}
              placeholder="$BONK · WIF · So111…1112"
              className="w-full bg-transparent px-3 py-4 font-mono text-sm text-foreground outline-none placeholder:text-muted-foreground"
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

        {/* Results */}
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          {filteredResults.slice(0, 12).map((t) => (
            <ResultRow key={t.id} t={t} onSelect={() => onSelect(t.id)} />
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
      className="w-20 bg-transparent text-right text-foreground outline-none"
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

const ResultRow = ({ t, onSelect }: { t: JupTokenInfo; onSelect: () => void }) => {
  const ch = t.stats24h?.priceChange ?? 0;
  const up = ch >= 0;
  return (
    <button
      onClick={onSelect}
      className="group flex items-center gap-4 border border-og-grid bg-og-ink/70 p-3 text-left transition hover:border-og-lime hover:bg-og-lime/5"
    >
      <div className="relative h-10 w-10 shrink-0 overflow-hidden border border-og-grid bg-og-ink">
        {t.icon ? (
          <img src={t.icon} alt={t.symbol} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="grid h-full w-full place-items-center text-xs text-og-lime">{t.symbol?.[0]}</div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-display text-sm font-bold text-og-gold truncate">${t.symbol}</span>
          {t.isVerified && <ShieldCheck className="h-3 w-3 text-og-lime" />}
          <span className="ml-auto text-xs text-foreground">{fmtUsd(t.usdPrice)}</span>
        </div>
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-muted-foreground">
          <span className="truncate">{t.name}</span>
          <span className={up ? "text-og-lime" : "text-og-blood"}>{fmtPct(ch)}</span>
          <span>· LQ {fmtUsd(t.liquidity)}</span>
        </div>
      </div>
    </button>
  );
};

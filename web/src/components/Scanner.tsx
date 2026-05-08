import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, ShieldCheck, Loader2, Filter } from "lucide-react";
import { jupSearchToken, fmtPct, fmtUsd, fmtNum, type JupTokenInfo } from "@/lib/og";

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
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="mb-2 flex items-center gap-2 text-[10px] uppercase tracking-[0.34em] text-og-cyan">
              <span className="h-px w-8 bg-og-cyan" /> Token search
            </div>
            <h2 className="font-display text-2xl font-black tracking-tight text-foreground sm:text-3xl">Live Token Monitor</h2>
            <p className="mt-1 text-sm text-muted-foreground">Search by ticker, name, or paste a mint address. Results now scan like a coin feed.</p>
          </div>
          <span className="rounded-full border border-og-lime/40 bg-og-lime/10 px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-og-lime">
            {rawResults.length ? `${filteredResults.length}/${rawResults.length} hits` : "ready"}
          </span>
        </div>

        <div className="relative">
          <div className="tool-searchbar">
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
        <div className="mt-3 rounded-[1.2rem] border border-og-grid/80 bg-black/20 p-3">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.3em] text-og-cyan">
              <Filter className="h-3 w-3" /> filters
            </div>
            <button
              onClick={() => setFilters(DEFAULT_FILTERS)}
              className="ml-auto tool-chip"
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
        <div className="monitor-panel mt-4">
          <div className="monitor-panel-header">
            <div className="flex items-center gap-2 font-display text-xl font-black text-foreground">
              <Search className="h-5 w-5 text-og-lime" /> Search Feed
            </div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              <span className="text-og-lime">{filteredResults.length}</span> shown · <span className="text-og-blood">{dropped}</span> filtered
            </div>
          </div>
          <div className="hidden grid-cols-12 gap-3 border-b border-og-grid/60 px-4 py-2 font-mono text-[9px] uppercase tracking-[0.24em] text-muted-foreground md:grid">
            <div className="col-span-5">Token</div>
            <div className="col-span-2 text-right">Price / 24h</div>
            <div className="col-span-2 text-right">Mcap</div>
            <div className="col-span-2 text-right">Liquidity</div>
            <div className="col-span-1 text-right">Open</div>
          </div>
          {filteredResults.slice(0, 16).map((t) => (
            <ResultRow key={t.id} t={t} onSelect={() => onSelect(t.id)} />
          ))}
          {debounced.length >= 2 && !isFetching && rawResults.length === 0 && (
            <div className="p-6 text-center text-xs uppercase tracking-widest text-muted-foreground">
              NO MATCHES // EOF
            </div>
          )}
          {debounced.length >= 2 && !isFetching && rawResults.length > 0 && filteredResults.length === 0 && (
            <div className="p-6 text-center text-xs uppercase tracking-widest text-muted-foreground">
              NO RESULTS PASS FILTERS · RESET OR LOWER THE BAR
            </div>
          )}
          {debounced.length < 2 && (
            <div className="p-6 text-center text-xs uppercase tracking-widest text-muted-foreground">
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
    <button onClick={onSelect} className="token-feed-row md:grid md:grid-cols-12 md:gap-3">
      <div className="flex min-w-0 items-center gap-3 md:col-span-5">
        <div className="token-avatar">
          {t.icon ? (
            <img src={t.icon} alt={t.symbol} className="h-full w-full object-cover" loading="lazy" />
          ) : (
            <span>{t.symbol?.[0]}</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate font-display text-base font-black text-foreground">{t.name}</span>
            <span className="rounded-full border border-og-grid bg-black/25 px-2 py-0.5 font-mono text-[10px] font-bold text-foreground/80">{t.symbol}</span>
            {t.isVerified && <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-og-lime" />}
          </div>
          <div className="mt-0.5 truncate font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{t.id.slice(0, 6)}... · jupiter</div>
        </div>
      </div>

      <div className="ml-auto text-right md:col-span-2 md:ml-0">
        <div className="font-mono text-sm font-bold text-foreground">{fmtUsd(t.usdPrice)}</div>
        <div className={`font-mono text-[10px] ${up ? "text-og-lime" : "text-og-blood"}`}>{fmtPct(ch)}</div>
      </div>

      <div className="hidden text-right md:block md:col-span-2">
        <div className="font-mono text-sm font-bold text-foreground">{fmtUsd(t.mcap ?? t.fdv)}</div>
        <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">MCap</div>
      </div>

      <div className="hidden text-right md:block md:col-span-2">
        <div className="font-mono text-sm font-bold text-foreground">{fmtUsd(t.liquidity)}</div>
        <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Liq</div>
      </div>

      <div className="hidden text-right font-mono text-lg text-og-lime md:block md:col-span-1">+</div>
    </button>
  );
};

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Crosshair,
  ShieldCheck,
  ShieldAlert,
  Loader2,
  Crown,
  Copy,
  Skull,
  Flame,
  Droplets,
  Users,
  Calendar,
  Snowflake,
  Lock,
  Unlock,
  Filter,
} from "lucide-react";
import { CopyMintButton } from "@/components/CopyMintButton";
import {
  jupOgCopycats,
  fmtPct,
  fmtUsd,
  fmtNum,
  shortAddr,
  tokenOgCreatedAtIso,
  tokenOgCreatedAtMs,
  type JupTokenInfo,
} from "@/lib/og";

type Props = { onSelect: (mint: string) => void };

const QUICK_TICKERS = ["OG", "BONK", "WIF", "MOG", "PEPE", "POPCAT", "FARTCOIN"];

type FinderFilters = {
  minScore: number;
  minLiq: number;
  verifiedOnly: boolean;
  hideHighRisk: boolean;
};

const DEFAULT_FILTERS: FinderFilters = {
  minScore: 0,
  minLiq: 0,
  verifiedOnly: false,
  hideHighRisk: false,
};

// OG score is intentionally age-only. Price, liquidity, verification, migration,
// and market quality never decide OG status.
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

function rugRisk(t: JupTokenInfo): "low" | "med" | "high" {
  let bad = 0;
  if (!t.audit?.mintAuthorityDisabled) bad++;
  if (!t.audit?.freezeAuthorityDisabled) bad++;
  if ((t.audit?.topHoldersPercentage ?? 0) > 40) bad++;
  if ((t.liquidity ?? 0) < 5000) bad++;
  if (!t.isVerified) bad++;
  if (bad >= 4) return "high";
  if (bad >= 2) return "med";
  return "low";
}

export const OgFinder = ({ onSelect }: Props) => {
  const [q, setQ] = useState<string>("");
  const [submitted, setSubmitted] = useState<string>("");
  const [filters, setFilters] = useState<FinderFilters>(DEFAULT_FILTERS);

  const { data, isFetching, refetch } = useQuery({
    queryKey: ["og-copycats", submitted],
    queryFn: () => jupOgCopycats(submitted),
    enabled: submitted.length >= 1,
    staleTime: 30_000,
  });

  const og = data?.og ?? null;
  const cats = data?.copycats ?? [];

  const oldestTs = useMemo(() => {
    const all = [og, ...cats].filter(Boolean) as JupTokenInfo[];
    const ts = all
      .map((t) => tokenOgCreatedAtMs(t))
      .filter((x): x is number => Number.isFinite(x));
    return ts.length ? Math.min(...ts) : null;
  }, [og, cats]);

  const ogS = og ? ogScore(og, oldestTs) : 0;

  const filteredCats = useMemo(() => {
    return cats.filter((c) => {
      if (ogScore(c, oldestTs) < filters.minScore) return false;
      if ((c.liquidity ?? 0) < filters.minLiq) return false;
      if (filters.verifiedOnly && !c.isVerified) return false;
      if (filters.hideHighRisk && rugRisk(c) === "high") return false;
      return true;
    });
  }, [cats, oldestTs, filters]);

  const droppedCats = cats.length - filteredCats.length;

  const submit = (raw: string) => {
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
            Drop a ticker. We pull every Solana mint sharing it, normalize symbols like $WIF,
            then crown the earliest on-chain mint creation date. Price, liquidity, migrated pools,
            market cap, and hype never decide the OG.
          </p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit(q);
          }}
          className="flex items-center border border-og-grid bg-og-ink/80 focus-within:border-og-gold"
        >
          <Crosshair className="ml-3 h-4 w-4 text-og-gold" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="$OG · BONK · WIF · MOG"
            className="w-full bg-transparent px-3 py-4 font-mono text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
          {isFetching && <Loader2 className="mr-3 h-4 w-4 animate-spin text-og-gold" />}
          <button
            type="submit"
            className="border-l border-og-grid px-4 py-4 text-[11px] font-bold uppercase tracking-widest text-og-gold transition hover:bg-og-gold hover:text-og-ink"
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
            <button
              onClick={() => refetch()}
              className="ml-auto border border-og-grid px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-og-cyan hover:border-og-cyan"
            >
              ↻ refresh
            </button>
          )}
        </div>

        {submitted && (
          <div className="mt-4 border border-og-grid bg-og-ink/70 p-3">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.3em] text-og-gold">
                <Filter className="h-3 w-3" /> filters
              </div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                <span className="text-og-lime">{filteredCats.length}</span> copycats shown · <span className="text-og-blood">{droppedCats}</span> filtered · filters do not change OG
              </div>
              <button
                onClick={() => setFilters(DEFAULT_FILTERS)}
                className="ml-auto border border-og-grid px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-foreground/60 transition hover:border-og-gold hover:text-og-gold"
              >
                RESET
              </button>
            </div>
            <div className="grid gap-2 sm:grid-cols-4">
              <FilterNum label="MIN AGE SCORE" value={filters.minScore} step={5} onChange={(v) => setFilters({ ...filters, minScore: v })} />
              <FilterNum label="MIN LIQ" value={filters.minLiq} step={1000} onChange={(v) => setFilters({ ...filters, minLiq: v })} />
              <FilterToggle label="VERIFIED" value={filters.verifiedOnly} onChange={(v) => setFilters({ ...filters, verifiedOnly: v })} />
              <FilterToggle label="HIDE RUG RISK" value={filters.hideHighRisk} onChange={(v) => setFilters({ ...filters, hideHighRisk: v })} />
            </div>
          </div>
        )}

        {submitted && og && (
          <div className="mt-8 grid gap-4 lg:grid-cols-3">
            <div className="lg:col-span-1">
              <div className="mb-2 flex items-center justify-between gap-2 text-[10px] uppercase tracking-[0.4em] text-og-gold">
                <span className="flex items-center gap-2">
                  <Crown className="h-3 w-3" /> DIRECT OG
                </span>
                <ScoreBar score={ogS} />
              </div>
              <CoinCard t={og} highlight score={ogS} onSelect={() => onSelect(og.id)} />
            </div>
            <div className="lg:col-span-2">
              <div className="mb-2 flex items-center gap-2 text-[10px] uppercase tracking-[0.4em] text-og-blood">
                <Copy className="h-3 w-3" /> COPYCATS · {filteredCats.length}/{cats.length}
              </div>
              {cats.length === 0 ? (
                <div className="border border-dashed border-og-grid p-6 text-center text-xs uppercase tracking-widest text-muted-foreground">
                  NO COPYCATS DETECTED
                </div>
              ) : filteredCats.length === 0 ? (
                <div className="border border-dashed border-og-grid p-6 text-center text-xs uppercase tracking-widest text-muted-foreground">
                  NO COPYCATS PASS FILTERS · RESET OR LOWER THE BAR
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {filteredCats.map((c) => (
                    <CoinCard
                      key={c.id}
                      t={c}
                      score={ogScore(c, oldestTs)}
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
        : "border-og-grid text-foreground/60 hover:border-og-gold hover:text-og-gold"
    }`}
  >
    {label} · {value ? "ON" : "OFF"}
  </button>
);

const ScoreBar = ({ score }: { score: number }) => {
  const color = score >= 75 ? "bg-og-lime" : score >= 50 ? "bg-og-gold" : "bg-og-blood";
  return (
    <span className="flex items-center gap-2">
      <span className="h-1 w-20 overflow-hidden border border-og-grid bg-og-ink">
        <span className={`block h-full ${color}`} style={{ width: `${score}%` }} />
      </span>
      <span className="font-mono text-og-gold">{score}</span>
    </span>
  );
};

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
}: {
  t: JupTokenInfo;
  onSelect: () => void;
  highlight?: boolean;
  score: number;
}) => {
  const ch = t.stats24h?.priceChange ?? 0;
  const up = ch >= 0;
  const onChainCreatedAt = tokenOgCreatedAtIso(t);
  const mintAgeDays = ageDaysFromIso(onChainCreatedAt);
  const poolCreatedAt = t.firstPool?.createdAt;

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") onSelect();
      }}
      className={`group relative flex cursor-pointer flex-col gap-3 border p-4 text-left transition ${
        highlight
          ? "border-og-gold bg-og-gold/5 shadow-[0_0_24px_rgba(234,196,53,0.15)] hover:bg-og-gold/10"
          : "border-og-grid bg-og-ink/70 hover:border-og-blood hover:bg-og-blood/5"
      }`}
    >
      {highlight && (
        <span className="absolute -top-2 left-3 bg-og-gold px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-widest text-og-ink">
          ◆ EARLIEST MINT
        </span>
      )}
      <div className="flex items-center gap-3">
        <div className="relative h-11 w-11 shrink-0 overflow-hidden border border-og-grid bg-og-ink">
          {t.icon ? (
            <img src={t.icon} alt={t.symbol} className="h-full w-full object-cover" loading="lazy" />
          ) : (
            <div className="grid h-full w-full place-items-center text-xs text-og-lime">
              {t.symbol?.[0]}
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className={`font-display text-sm font-bold truncate ${highlight ? "text-og-gold" : "text-foreground"}`}>
              ${t.symbol}
            </span>
            {t.isVerified && <ShieldCheck className="h-3 w-3 text-og-lime" />}
            {!highlight && <RiskBadge t={t} />}
          </div>
          <div className="truncate text-[10px] uppercase tracking-widest text-muted-foreground">
            {t.name}
          </div>
        </div>
        <div className="text-right">
          <div className="font-mono text-xs text-foreground">{fmtUsd(t.usdPrice)}</div>
          <div className={`font-mono text-[10px] ${up ? "text-og-lime" : "text-og-blood"}`}>
            {fmtPct(ch)}
          </div>
        </div>
      </div>

      {!highlight ? null : (
        <div className="flex items-center justify-between border-y border-og-gold/30 py-2">
          <span className="font-mono text-[10px] uppercase tracking-widest text-og-gold/80">CHAIN AGE SCORE</span>
          <ScoreBar score={score} />
        </div>
      )}

      <div className="grid grid-cols-4 gap-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        <Stat icon={Flame} label="MCAP" value={fmtUsd(t.mcap)} accent="text-og-cyan" />
        <Stat icon={Droplets} label="LIQ" value={fmtUsd(t.liquidity)} />
        <Stat icon={Users} label="HLDR" value={fmtNum(t.holderCount)} />
        <Stat
          icon={Calendar}
          label="MINT AGE"
          value={mintAgeDays != null ? `${mintAgeDays}d` : "—"}
          accent={highlight ? "text-og-gold" : undefined}
        />
      </div>

      <div className="flex items-center gap-2 border-t border-og-grid/60 pt-2 font-mono text-[9px] uppercase tracking-widest">
        <AuditChip
          ok={!!t.audit?.mintAuthorityDisabled}
          label="MINT"
          OkIcon={Lock}
          BadIcon={Unlock}
        />
        <AuditChip
          ok={!!t.audit?.freezeAuthorityDisabled}
          label="FREEZE"
          OkIcon={Snowflake}
          BadIcon={Snowflake}
        />
        <span className="text-muted-foreground">
          MINTED <span className="text-foreground">{shortDate(onChainCreatedAt)}</span>
        </span>
        <span className="hidden text-muted-foreground sm:inline">
          POOL <span className="text-foreground">{shortDate(poolCreatedAt)}</span>
        </span>
        <span className="ml-auto flex items-center gap-2">
          <span className="text-muted-foreground">{shortAddr(t.id, 5)}</span>
          <CopyMintButton mint={t.id} label="copy" copiedLabel="copied" className="px-1.5 py-0.5" iconClassName="h-3 w-3" />
        </span>
      </div>
    </article>
  );
};

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
  <div>
    <div className="flex items-center gap-1 text-foreground/40">
      <Icon className="h-2.5 w-2.5" /> {label}
    </div>
    <div className={accent ?? "text-foreground"}>{value}</div>
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
      <Icon className="h-2.5 w-2.5" /> {label} {ok ? "OFF" : "ON"}
    </span>
  );
};

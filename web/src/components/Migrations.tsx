import { type CSSProperties, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Rocket,
  Loader2,
  Droplets,
  TrendingUp,
  Users,
  ExternalLink,
  Flame,
  Sparkles,
  Moon,
  Star,
  Filter,
  ArrowUpRight,
  Activity,
} from "lucide-react";
import { CopyMintButton } from "@/components/CopyMintButton";
import {
  enrichTokensWithMarketIntel,
  fmtUsd,
  fmtPct,
  fmtNum,
  shortAddr,
  shortDate,
  timeAgo,
  tokenDexPaidLabel,
  tokenMigrationDateIso,
  type JupTokenInfo,
} from "@/lib/og";

type Props = { onSelect: (mint: string) => void };

type DSPair = {
  chainId: string;
  dexId: string;
  url: string;
  pairAddress: string;
  labels?: string[];
  baseToken: { address: string; name: string; symbol: string };
  quoteToken: { address: string; name: string; symbol: string };
  priceUsd?: string;
  priceChange?: { m5?: number; h1?: number; h6?: number; h24?: number };
  liquidity?: { usd?: number; base?: number; quote?: number };
  volume?: { m5?: number; h1?: number; h6?: number; h24?: number };
  txns?: {
    m5?: { buys: number; sells: number };
    h1?: { buys: number; sells: number };
    h24?: { buys: number; sells: number };
  };
  fdv?: number;
  marketCap?: number;
  pairCreatedAt?: number;
  info?: { imageUrl?: string; websites?: { url: string }[]; socials?: { type: string; url: string }[] };
};

type DSResponse = { pairs?: DSPair[] | null; schemaVersion?: string };

function pairToToken(p: DSPair): JupTokenInfo {
  const price: number | undefined = p.priceUsd ? Number(p.priceUsd) : undefined;
  const migrationCreatedAt: string | undefined = p.pairCreatedAt ? new Date(p.pairCreatedAt).toISOString() : undefined;
  return {
    id: p.baseToken.address,
    name: p.baseToken.name,
    symbol: p.baseToken.symbol,
    icon: p.info?.imageUrl,
    decimals: 0,
    usdPrice: Number.isFinite(price) ? price : undefined,
    mcap: p.marketCap,
    fdv: p.fdv,
    liquidity: p.liquidity?.usd,
    stats24h: { priceChange: p.priceChange?.h24, numBuys: p.txns?.h24?.buys, numSells: p.txns?.h24?.sells },
    firstPool: migrationCreatedAt ? { createdAt: migrationCreatedAt } : undefined,
    migrationCreatedAt,
    dexUrl: p.url,
    pairAddress: p.pairAddress,
    pairDexId: p.dexId,
  };
}

type Source = {
  id: "pumpfun" | "moonshot" | "jupiter" | "all";
  label: string;
  Icon: typeof Rocket;
  color: string;
  query: string;
  matches: (p: DSPair) => boolean;
  desc: string;
};

const SOURCES: Source[] = [
  {
    id: "pumpfun",
    label: "PUMP.FUN",
    Icon: Flame,
    color: "text-og-blood",
    query: "pumpswap",
    desc: "Bonding curves that graduated → PumpSwap / Raydium",
    matches: (p) =>
      p.chainId === "solana" &&
      (p.dexId === "pumpswap" ||
        (p.labels ?? []).some((l) => /pump/i.test(l)) ||
        /pump/i.test(p.dexId)),
  },
  {
    id: "moonshot",
    label: "MOONSHOT",
    Icon: Moon,
    color: "text-og-cyan",
    query: "moonshot",
    desc: "Moonshot launches that hit the curve",
    matches: (p) =>
      p.chainId === "solana" &&
      (p.dexId === "moonshot" ||
        (p.labels ?? []).some((l) => /moonshot/i.test(l))),
  },
  {
    id: "jupiter",
    label: "JUP STUDIO",
    Icon: Star,
    color: "text-og-gold",
    query: "meteora",
    desc: "Jupiter Studio / Meteora DLMM fresh launches",
    matches: (p) =>
      p.chainId === "solana" &&
      (p.dexId === "meteora" ||
        (p.labels ?? []).some((l) => /dlmm|dynamic/i.test(l))),
  },
  {
    id: "all",
    label: "ALL FRESH",
    Icon: Sparkles,
    color: "text-og-lime",
    query: "SOL",
    desc: "Every new SOL pair, ranked by quality + recency",
    matches: (p) => p.chainId === "solana",
  },
];

async function dsSearch(query: string): Promise<DSPair[]> {
  const url = `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(query)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status}`);
  const j = (await res.json()) as DSResponse;
  return (j.pairs ?? []).filter(Boolean);
}

type Quality = {
  minLiq: number;
  minVol: number;
  maxAgeHours: number;
  minBuys: number;
};

const DEFAULT_Q: Quality = { minLiq: 0, minVol: 0, maxAgeHours: 168, minBuys: 0 };
const GOOD_Q: Quality = { minLiq: 5_000, minVol: 1_000, maxAgeHours: 72, minBuys: 10 };
const STRICT_Q: Quality = { minLiq: 25_000, minVol: 10_000, maxAgeHours: 24, minBuys: 50 };

function qualityEquals(a: Quality, b: Quality): boolean {
  return (
    a.minLiq === b.minLiq &&
    a.minVol === b.minVol &&
    a.maxAgeHours === b.maxAgeHours &&
    a.minBuys === b.minBuys
  );
}

function passes(p: DSPair, q: Quality): boolean {
  const liq = p.liquidity?.usd ?? 0;
  const vol = p.volume?.h24 ?? 0;
  const created = p.pairCreatedAt ?? 0;
  const ageH = created ? (Date.now() - created) / 3_600_000 : Infinity;
  const buys = p.txns?.h24?.buys ?? 0;
  if (liq < q.minLiq) return false;
  if (vol < q.minVol) return false;
  if (ageH > q.maxAgeHours) return false;
  if (buys < q.minBuys) return false;
  return true;
}

function score(p: DSPair): number {
  // Quality + momentum score
  const liq = p.liquidity?.usd ?? 0;
  const vol = p.volume?.h24 ?? 0;
  const buys = p.txns?.h24?.buys ?? 0;
  const sells = p.txns?.h24?.sells ?? 0;
  const total = buys + sells;
  const buyRatio = total > 0 ? buys / total : 0.5;
  const ch = p.priceChange?.h24 ?? 0;
  const ageH = p.pairCreatedAt ? (Date.now() - p.pairCreatedAt) / 3_600_000 : 24;
  const recencyBoost = Math.max(0, 24 - ageH) * 1000;
  return liq * 0.3 + vol * 0.5 + total * 50 + buyRatio * 5000 + ch * 100 + recencyBoost;
}

export const Migrations = ({ onSelect }: Props) => {
  const [src, setSrc] = useState<Source["id"]>("pumpfun");
  const [q, setQ] = useState<Quality>(DEFAULT_Q);

  const source = SOURCES.find((s) => s.id === src)!;

  const { data, isFetching, refetch, error } = useQuery({
    queryKey: ["migrations", src],
    queryFn: () => dsSearch(source.query),
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  const sourceMatches = useMemo(() => {
    return (data ?? []).filter(source.matches);
  }, [data, source]);

  const filtered = useMemo(() => {
    return sourceMatches.filter((p) => passes(p, q)).sort((a, b) => score(b) - score(a));
  }, [sourceMatches, q]);

  const dropped = sourceMatches.length - filtered.length;
  const intelSeed = useMemo(() => filtered.slice(0, 40).map(pairToToken), [filtered]);
  const intelKey = intelSeed.map((token) => token.id).join(",");
  const { data: intelTokens } = useQuery({
    queryKey: ["migration-token-intel", intelKey],
    queryFn: () => enrichTokensWithMarketIntel(intelSeed, { includeAth: true, maxAth: 12 }),
    enabled: intelSeed.length > 0,
    staleTime: 60_000,
  });
  const intelByMint = useMemo(() => new Map((intelTokens ?? []).map((token) => [token.id, token])), [intelTokens]);

  const stats = useMemo(() => {
    const total = filtered.length;
    const newest = filtered[0]?.pairCreatedAt ?? 0;
    const totalLiq = filtered.reduce((s, p) => s + (p.liquidity?.usd ?? 0), 0);
    const totalVol = filtered.reduce((s, p) => s + (p.volume?.h24 ?? 0), 0);
    return { total, newest, totalLiq, totalVol };
  }, [filtered]);

  return (
    <section className="relative">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="mb-2 flex items-center gap-2 text-[10px] uppercase tracking-[0.4em] text-og-lime">
            <span className="h-px w-10 bg-og-lime" /> /MIGRATIONS · LIVE FEED
          </div>
          <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
            <span className="text-foreground">RECENTLY</span>{" "}
            <span className="text-og-lime text-glow">MIGRATED</span>
          </h2>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            <Rocket className="mr-1 inline h-3.5 w-3.5 text-og-lime" />
            Coins that just graduated from launchpads to live DEX pools, polled live from DexScreener every 30s.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isFetching && <Loader2 className="h-4 w-4 animate-spin text-og-lime" />}
          <button
            onClick={() => refetch()}
            className="border border-og-grid bg-og-ink px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-foreground/70 hover:border-og-lime hover:text-og-lime"
          >
            REFRESH
          </button>
        </div>
      </div>

      {/* Source selector */}
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {SOURCES.map((s) => {
          const active = s.id === src;
          return (
            <button
              key={s.id}
              onClick={() => setSrc(s.id)}
              className={`group relative overflow-hidden border p-3 text-left transition ${
                active
                  ? "border-og-lime bg-og-lime/10"
                  : "border-og-grid bg-og-ink/70 hover:border-og-lime/60"
              }`}
            >
              <div className="flex items-center gap-2">
                <s.Icon className={`h-4 w-4 ${active ? "text-og-lime" : s.color}`} />
                <span className={`font-display text-sm font-bold ${active ? "text-og-lime" : "text-foreground"}`}>
                  {s.label}
                </span>
              </div>
              <div className="mt-1 text-[10px] leading-tight text-muted-foreground">
                {s.desc}
              </div>
              {active && (
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-og-lime" />
              )}
            </button>
          );
        })}
      </div>

      {/* Stats strip */}
      <div className="mb-4 grid grid-cols-2 gap-2 border border-og-grid bg-og-ink/70 p-3 sm:grid-cols-4">
        <Stat label="MATCHES" value={String(stats.total)} icon={<Activity className="h-3 w-3" />} />
        <Stat
          label="NEWEST"
          value={stats.newest ? `${timeAgo(Math.floor(stats.newest / 1000))} ago` : "—"}
          icon={<Sparkles className="h-3 w-3" />}
        />
        <Stat label="Σ LIQUIDITY" value={fmtUsd(stats.totalLiq)} icon={<Droplets className="h-3 w-3" />} />
        <Stat label="Σ VOL 24H" value={fmtUsd(stats.totalVol)} icon={<TrendingUp className="h-3 w-3" />} />
      </div>

      {/* Filters */}
      <div className="mb-4 border border-og-grid bg-og-ink/70 p-3">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.3em] text-og-lime">
            <Filter className="h-3 w-3" /> filters
          </div>
          <PresetButton label="OPEN" active={qualityEquals(q, DEFAULT_Q)} onClick={() => setQ(DEFAULT_Q)} />
          <PresetButton label="GOOD" active={qualityEquals(q, GOOD_Q)} onClick={() => setQ(GOOD_Q)} />
          <PresetButton label="STRICT" active={qualityEquals(q, STRICT_Q)} onClick={() => setQ(STRICT_Q)} />
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            <span className="text-og-lime">{filtered.length}</span> shown · <span className="text-og-blood">{dropped}</span> filtered
          </div>
          <button
            onClick={() => setQ(DEFAULT_Q)}
            className="ml-auto border border-og-grid px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-foreground/60 transition hover:border-og-lime hover:text-og-lime"
          >
            RESET
          </button>
        </div>
        <div className="grid gap-2 sm:grid-cols-4">
          <Range label="LIQ" value={q.minLiq} suffix="$" step={1000} onChange={(v) => setQ({ ...q, minLiq: v })} />
          <Range label="VOL24H" value={q.minVol} suffix="$" step={500} onChange={(v) => setQ({ ...q, minVol: v })} />
          <Range
            label="AGE"
            value={q.maxAgeHours}
            suffix="h"
            step={6}
            max={168}
            onChange={(v) => setQ({ ...q, maxAgeHours: v })}
          />
          <Range label="BUYS" value={q.minBuys} step={5} onChange={(v) => setQ({ ...q, minBuys: v })} />
        </div>
      </div>

      {/* List */}
      <div className="overflow-hidden border border-og-grid bg-og-ink/70">
        <div className="hidden grid-cols-12 gap-2 border-b border-og-grid px-3 py-2 text-[10px] uppercase tracking-[0.3em] text-muted-foreground md:grid">
          <div className="col-span-4">PAIR</div>
          <div className="col-span-1 text-right">PRICE</div>
          <div className="col-span-1 text-right">24H Δ</div>
          <div className="col-span-2 text-right">LIQ / VOL</div>
          <div className="col-span-2 text-right">B / S 24H</div>
          <div className="col-span-2 text-right">AGE / DEX</div>
        </div>
        {filtered.length === 0 && !isFetching && (
          <div className="p-6 text-center text-xs uppercase tracking-widest text-muted-foreground">
            {error ? "FEED ERROR · RETRY" : "NO MATCHES · LOOSEN FILTERS"}
          </div>
        )}
        {filtered.slice(0, 40).map((p) => (
          <PairRow key={p.pairAddress} p={p} token={intelByMint.get(p.baseToken.address)} onSelect={() => onSelect(p.baseToken.address)} />
        ))}
      </div>

      <div className="mt-3 text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
        SOURCE · DexScreener public API · auto-refresh 30s · ranking = liq×vol×buy-pressure×recency
      </div>
    </section>
  );
};

const PresetButton = ({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) => (
  <button
    onClick={onClick}
    className={`border px-2 py-1 font-mono text-[10px] uppercase tracking-widest transition ${
      active
        ? "border-og-lime bg-og-lime/10 text-og-lime"
        : "border-og-grid text-foreground/60 hover:border-og-lime hover:text-og-lime"
    }`}
  >
    {label}
  </button>
);

const Stat = ({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) => (
  <div className="flex items-center gap-2 border border-og-grid/60 bg-og-ink/40 px-2 py-1.5">
    <span className="text-og-lime">{icon}</span>
    <div className="min-w-0">
      <div className="text-[9px] uppercase tracking-[0.3em] text-muted-foreground">{label}</div>
      <div className="truncate font-mono text-sm text-foreground">{value}</div>
    </div>
  </div>
);

const Range = ({
  label,
  value,
  onChange,
  step = 1,
  max,
  suffix,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  max?: number;
  suffix?: string;
}) => (
  <label className="flex items-center justify-between gap-1.5 border border-og-grid bg-og-ink px-2 py-1.5 font-mono text-[10px] uppercase tracking-widest">
    <span className="text-muted-foreground">{label}</span>
    <input
      type="number"
      inputMode="numeric"
      step={step}
      min={0}
      max={max}
      value={value}
      onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
      className="og-filter-input w-24 px-2 py-1 text-right text-foreground outline-none"
    />
    {suffix && <span className="text-og-lime">{suffix}</span>}
  </label>
);

const PairRow = ({ p, token, onSelect }: { p: DSPair; token?: JupTokenInfo; onSelect: () => void }) => {
  const ch = p.priceChange?.h24 ?? 0;
  const up = ch >= 0;
  const created = p.pairCreatedAt ? Math.floor(p.pairCreatedAt / 1000) : 0;
  const buys = p.txns?.h24?.buys ?? 0;
  const sells = p.txns?.h24?.sells ?? 0;
  const total = buys + sells;
  const buyPct = total > 0 ? (buys / total) * 100 : 50;
  const fresh = Boolean(created && Date.now() / 1000 - created < 60 * 60 * 6);
  const meterWidth: CSSProperties = { width: `${buyPct}%` };
  const dexPaid = token ? tokenDexPaidLabel(token) : "—";

  return (
    <div className="border-b border-og-grid/50 p-3 transition hover:bg-og-lime/5 last:border-b-0 md:grid md:grid-cols-12 md:items-center md:gap-2 md:px-3 md:py-2.5">
      <button onClick={onSelect} className="flex min-w-0 items-center gap-3 text-left md:col-span-4 md:gap-2">
        <div className="relative h-11 w-11 shrink-0 overflow-hidden border border-og-grid bg-og-ink md:h-8 md:w-8">
          {p.info?.imageUrl ? (
            <img src={p.info.imageUrl} alt={p.baseToken.symbol} className="h-full w-full object-cover" loading="lazy" />
          ) : (
            <div className="grid h-full w-full place-items-center text-[10px] text-og-lime">
              {p.baseToken.symbol?.[0]}
            </div>
          )}
          {fresh && (
            <div className="absolute -right-px -top-px bg-og-lime px-1 font-mono text-[8px] font-bold text-og-ink md:px-0.5">
              NEW
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="truncate font-display text-base font-bold text-og-gold md:text-sm">${p.baseToken.symbol}</span>
            <span className="shrink-0 text-[10px] uppercase tracking-widest text-muted-foreground">/ {p.quoteToken.symbol}</span>
          </div>
          <div className="truncate text-[10px] uppercase tracking-widest text-muted-foreground">
            {p.baseToken.name}
          </div>
          <div className="mt-1 truncate font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
            ATH <span className="text-og-gold">{fmtUsd(token?.allTimeHighUsd)}</span> · Migrated <span className="text-og-cyan">{shortDate(token ? tokenMigrationDateIso(token) : undefined)}</span> · DEX <span className={dexPaid === "—" ? "" : "text-og-lime"}>{dexPaid}</span>
          </div>
        </div>
      </button>

      <div className="mt-3 grid grid-cols-2 gap-2 md:contents">
        <div className="border border-og-grid/60 bg-og-ink/55 p-2 text-left font-mono md:col-span-1 md:border-0 md:bg-transparent md:p-0 md:text-right">
          <div className="mb-1 text-[8px] uppercase tracking-[0.22em] text-muted-foreground md:hidden">Price</div>
          <div className="whitespace-nowrap text-xs text-foreground">{p.priceUsd ? fmtUsd(Number(p.priceUsd)) : "—"}</div>
        </div>
        <div className="border border-og-grid/60 bg-og-ink/55 p-2 text-left font-mono md:col-span-1 md:border-0 md:bg-transparent md:p-0 md:text-right">
          <div className="mb-1 text-[8px] uppercase tracking-[0.22em] text-muted-foreground md:hidden">24H Δ</div>
          <div className={`whitespace-nowrap text-xs ${up ? "text-og-lime" : "text-og-blood"}`}>{fmtPct(ch)}</div>
        </div>
        <div className="border border-og-grid/60 bg-og-ink/55 p-2 text-left font-mono text-[10px] uppercase tracking-widest text-muted-foreground md:col-span-2 md:border-0 md:bg-transparent md:p-0 md:text-right">
          <div className="mb-1 text-[8px] tracking-[0.22em] md:hidden">Liq / Vol</div>
          <div className="whitespace-nowrap text-og-cyan">L {fmtUsd(p.liquidity?.usd)}</div>
          <div className="whitespace-nowrap">V {fmtUsd(p.volume?.h24)}</div>
        </div>
        <div className="border border-og-grid/60 bg-og-ink/55 p-2 text-left md:col-span-2 md:border-0 md:bg-transparent md:p-0 md:text-right">
          <div className="mb-1 font-mono text-[8px] uppercase tracking-[0.22em] text-muted-foreground md:hidden">Buys / Sells</div>
          <div className="font-mono text-[10px]">
            <span className="text-og-lime">{fmtNum(buys)}</span>
            <span className="text-muted-foreground"> / </span>
            <span className="text-og-blood">{fmtNum(sells)}</span>
          </div>
          <div className="mt-1 h-1 w-full overflow-hidden border border-og-grid md:ml-auto md:w-20">
            <div className="h-full bg-og-lime" style={meterWidth} />
          </div>
        </div>
        <div className="col-span-2 flex items-center justify-between gap-2 border border-og-grid/60 bg-og-ink/55 p-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground md:col-span-2 md:justify-end md:border-0 md:bg-transparent md:p-0">
          <div className="text-left md:text-right">
            <div className="text-foreground">{created ? timeAgo(created) : "—"}</div>
            <div className="max-w-[180px] truncate text-og-lime md:max-w-[120px]">{p.dexId}</div>
            <div className="text-muted-foreground">CA {shortAddr(p.baseToken.address, 4)}</div>
            <div className="text-og-gold">ATH {fmtUsd(token?.allTimeHighUsd)}</div>
          </div>
          <CopyMintButton mint={p.baseToken.address} label="copy" copiedLabel="copied" className="shrink-0 px-2 py-2 md:px-1" iconClassName="h-3 w-3" />
          <a
            href={p.url}
            target="_blank"
            rel="noreferrer"
            className="shrink-0 border border-og-grid p-2 hover:border-og-lime hover:text-og-lime md:p-1"
            title="Open on DexScreener"
          >
            <ExternalLink className="h-3.5 w-3.5 md:h-3 md:w-3" />
          </a>
        </div>
      </div>
    </div>
  );
};

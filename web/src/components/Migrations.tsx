import { type CSSProperties, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
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
import { CoinDetailDialog } from "@/components/CoinDetailDialog";
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
      (p.dexId === "meteora" ||
        (p.labels ?? []).some((l) => /dlmm|dynamic/i.test(l))),
  },
  {
    id: "uniswap",
    label: "UNISWAP",
    Icon: Sparkles,
    color: "text-[#FF007A]",
    query: "uniswap",
    desc: "Uniswap V2/V3 new pairs across EVM chains",
    matches: (p) => /uniswap/i.test(p.dexId),
  },
  {
    id: "all",
    label: "ALL FRESH",
    Icon: Sparkles,
    color: "text-og-lime",
    query: "SOL",
    desc: "Every new pair across all chains, ranked by quality + recency",
    matches: () => true,
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
    <section className="space-y-3">
      {/* Source pills + refresh */}
      <div className="flex flex-wrap items-center gap-2">
        {SOURCES.map((s) => {
          const active = s.id === src;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setSrc(s.id)}
              className={cn(
                "inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-left transition",
                active ? "border-emerald-400/50 bg-emerald-500/[0.08]" : "border-white/10 bg-white/[0.03] hover:border-emerald-400/30 hover:bg-white/[0.05]"
              )}
            >
              <s.Icon className={cn("h-4 w-4", active ? "text-emerald-300" : "text-white/40")} />
              <span className="min-w-0">
                <span className={cn("block text-xs font-bold", active ? "text-emerald-300" : "text-white")}>{s.label}</span>
                <span className="block font-mono text-[8px] uppercase tracking-widest text-white/30">{s.desc}</span>
              </span>
            </button>
          );
        })}
        <div className="ml-auto flex items-center gap-2">
          {isFetching && <Loader2 className="h-4 w-4 animate-spin text-emerald-300" />}
          <button onClick={() => refetch()} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-white/55 transition hover:border-emerald-400/40 hover:text-emerald-300">Refresh</button>
        </div>
      </div>

      {/* Stat chips */}
      <div className="flex flex-wrap items-center gap-2">
        <MStat Icon={Activity} value={String(stats.total)} label="matches" />
        <MStat Icon={Sparkles} value={stats.newest ? `${timeAgo(Math.floor(stats.newest / 1000))}` : "—"} label="newest" />
        <MStat Icon={Droplets} value={fmtUsd(stats.totalLiq)} label="liquidity" />
        <MStat Icon={TrendingUp} value={fmtUsd(stats.totalVol)} label="vol 24h" />
      </div>

      {/* Filters */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-emerald-300"><Filter className="h-3 w-3" /> filters</span>
          <PresetButton label="OPEN" active={qualityEquals(q, DEFAULT_Q)} onClick={() => setQ(DEFAULT_Q)} />
          <PresetButton label="GOOD" active={qualityEquals(q, GOOD_Q)} onClick={() => setQ(GOOD_Q)} />
          <PresetButton label="STRICT" active={qualityEquals(q, STRICT_Q)} onClick={() => setQ(STRICT_Q)} />
          <span className="font-mono text-[10px] uppercase tracking-widest text-white/40"><span className="text-emerald-300">{filtered.length}</span> shown · <span className="text-red-400">{dropped}</span> filtered</span>
          <button onClick={() => setQ(DEFAULT_Q)} className="ml-auto rounded-lg border border-white/10 px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-white/55 transition hover:border-emerald-400/40 hover:text-emerald-300">RESET</button>
        </div>
        <div className="grid gap-2 sm:grid-cols-4">
          <Range label="LIQ" value={q.minLiq} suffix="$" step={1000} onChange={(v) => setQ({ ...q, minLiq: v })} />
          <Range label="VOL24H" value={q.minVol} suffix="$" step={500} onChange={(v) => setQ({ ...q, minVol: v })} />
          <Range label="AGE" value={q.maxAgeHours} suffix="h" step={6} max={168} onChange={(v) => setQ({ ...q, maxAgeHours: v })} />
          <Range label="BUYS" value={q.minBuys} step={5} onChange={(v) => setQ({ ...q, minBuys: v })} />
        </div>
      </div>

      {/* List */}
      <div className="space-y-2">
        {filtered.length === 0 && !isFetching && (
          <div className="rounded-2xl border border-dashed border-white/12 p-8 text-center font-mono text-xs uppercase tracking-widest text-white/40">
            {error ? "Feed error · retry" : "No matches · loosen filters"}
          </div>
        )}
        {filtered.slice(0, 40).map((p) => (
          <PairRow key={p.pairAddress} p={p} token={intelByMint.get(p.baseToken.address)} onSelect={() => onSelect(p.baseToken.address)} />
        ))}
      </div>

      <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/25">
        Source · DexScreener · auto-refresh 30s · rank = liq × vol × buy-pressure × recency
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
        : "border-white/10 text-foreground/60 hover:border-og-lime hover:text-og-lime"
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
  <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-2.5 py-2">
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
  <label className="flex items-center justify-between gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-2.5 py-2 font-mono text-[10px] uppercase tracking-widest">
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

const MStat = ({ Icon, value, label }: { Icon: React.ComponentType<{ className?: string }>; value: string; label: string }) => (
  <div className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-1.5">
    <Icon className="h-3.5 w-3.5 text-emerald-300" />
    <span className="font-display text-sm font-black text-white">{value}</span>
    <span className="font-mono text-[9px] uppercase tracking-widest text-white/35">{label}</span>
  </div>
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
  const detailToken: JupTokenInfo = token ?? pairToToken(p);
  const dexPaid = token ? tokenDexPaidLabel(token) : "—";

  return (
    <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 transition hover:border-emerald-400/40 hover:bg-white/[0.05]">
      <div className="flex items-start gap-3">
        <div className="relative h-10 w-10 flex-none overflow-hidden rounded-xl border border-white/10 bg-white/[0.04]">
          {p.info?.imageUrl ? (
            <img src={p.info.imageUrl} alt={p.baseToken.symbol} className="h-full w-full object-cover" loading="lazy" />
          ) : (
            <div className="grid h-full w-full place-items-center text-xs font-black text-emerald-300">{p.baseToken.symbol?.[0]}</div>
          )}
          {fresh && <div className="absolute -right-px -top-px bg-emerald-400 px-1 font-mono text-[7px] font-black text-black">NEW</div>}
        </div>
        <button onClick={onSelect} className="min-w-0 flex-1 text-left">
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="truncate font-display text-base font-black tracking-tight text-white">${p.baseToken.symbol}</span>
            <span className="flex-none font-mono text-[9px] uppercase tracking-widest text-white/30">/ {p.quoteToken.symbol}</span>
          </div>
          <div className="truncate text-[11px] text-white/40">{p.baseToken.name}</div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 font-mono text-[9px] uppercase tracking-widest text-white/30">
            <span className="text-emerald-300/80">{created ? timeAgo(created) : "—"}</span>
            <span>CA {shortAddr(p.baseToken.address, 4)}</span>
            <span className="text-emerald-300/70">{p.dexId}</span>
            {dexPaid !== "—" ? <span className="text-emerald-300/70">DEX {dexPaid}</span> : null}
          </div>
        </button>
        <div className="flex-none text-right font-mono">
          <div className="text-sm font-bold text-white">{p.priceUsd ? fmtUsd(Number(p.priceUsd)) : "—"}</div>
          <div className={cn("text-[10px]", up ? "text-emerald-300" : "text-red-400")}>{fmtPct(ch)} 24H</div>
        </div>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-1.5 border-t border-white/[0.06] pt-2.5 font-mono text-[9px] uppercase tracking-widest">
        <span className="rounded-full border border-white/10 px-2 py-0.5 text-white/45">LIQ {fmtUsd(p.liquidity?.usd)}</span>
        <span className="rounded-full border border-white/10 px-2 py-0.5 text-white/45">VOL24H {fmtUsd(p.volume?.h24)}</span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-2 py-0.5 text-white/45">
          <span className="text-emerald-300">{fmtNum(buys)}</span>/<span className="text-red-400">{fmtNum(sells)}</span>
          <span className="hidden h-1 w-12 overflow-hidden rounded-full bg-white/10 sm:block"><span className="block h-full bg-emerald-400" style={meterWidth} /></span>
        </span>
        {token?.allTimeHighUsd ? <span className="rounded-full border border-og-gold/30 px-2 py-0.5 text-og-gold">ATH {fmtUsd(token.allTimeHighUsd)}</span> : null}
        <div className="ml-auto flex items-center gap-1.5">
          <CoinDetailDialog token={detailToken} onOpenScanner={() => onSelect()} actionLabel="Load" className="rounded-lg border border-white/10 px-2 py-1 text-[9px] text-white/55" />
          <CopyMintButton mint={p.baseToken.address} label="CA" copiedLabel="ok" className="rounded-lg border border-white/10 px-2 py-1 text-[9px] text-white/55" iconClassName="h-3 w-3" />
          <a href={p.url} target="_blank" rel="noreferrer" title="Open on DexScreener" className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2 py-1 text-[9px] uppercase tracking-widest text-white/55 transition hover:border-emerald-400/40 hover:text-emerald-300">chart <ExternalLink className="h-3 w-3" /></a>
        </div>
      </div>
    </article>
  );
};

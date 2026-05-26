import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowUpRight,
  ExternalLink,
  Filter,
  Flame,
  Loader2,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Zap,
} from "lucide-react";
import { CoinDetailDialog } from "@/components/CoinDetailDialog";
import { CopyMintButton } from "@/components/CopyMintButton";
import { ToolHeader } from "@/components/ToolPageShell";
import {
  enrichTokensWithMarketIntel,
  fmtPct,
  fmtUsd,
  shortAddr,
  shortDate,
  timeAgo,
  tokenDexPaidLabel,
  tokenMigrationDateIso,
  type JupTokenInfo,
} from "@/lib/og";

type Props = { onSelect: (mint: string) => void };

type TrendInterval = "m5" | "h1" | "h6" | "h24";

const INTERVALS: { id: TrendInterval; label: string; title: string }[] = [
  { id: "m5", label: "5M", title: "right now" },
  { id: "h1", label: "1H", title: "last hour" },
  { id: "h6", label: "6H", title: "last 6h" },
  { id: "h24", label: "24H", title: "last day" },
];

type DexBoost = {
  chainId?: string;
  tokenAddress?: string;
  url?: string;
  amount?: number;
  totalAmount?: number;
  icon?: string;
  description?: string;
};

type DexPair = {
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
    h6?: { buys: number; sells: number };
    h24?: { buys: number; sells: number };
  };
  fdv?: number;
  marketCap?: number;
  pairCreatedAt?: number;
  info?: { imageUrl?: string; websites?: { url: string; label?: string }[]; socials?: { type: string; url: string }[] };
  boosts?: { active?: number };
};

type TrendCoin = {
  pair: DexPair;
  boost?: DexBoost;
  token?: JupTokenInfo;
  score: number;
};

type TrendFilters = {
  minLiq: number;
  minVol: number;
  minTxns: number;
  greenOnly: boolean;
};

const DEFAULT_FILTERS: TrendFilters = {
  minLiq: 0,
  minVol: 0,
  minTxns: 0,
  greenOnly: false,
};

function getIntervalValue(values: { m5?: number; h1?: number; h6?: number; h24?: number } | undefined, interval: TrendInterval): number {
  return values?.[interval] ?? 0;
}

function getTxns(pair: DexPair, interval: TrendInterval): number {
  const bucket = pair.txns?.[interval];
  return (bucket?.buys ?? 0) + (bucket?.sells ?? 0);
}

function getBuyRatio(pair: DexPair, interval: TrendInterval): number {
  const bucket = pair.txns?.[interval];
  const buys = bucket?.buys ?? 0;
  const sells = bucket?.sells ?? 0;
  const total = buys + sells;
  return total > 0 ? buys / total : 0.5;
}

function trendScore(pair: DexPair, boost: DexBoost | undefined, interval: TrendInterval): number {
  const volume = getIntervalValue(pair.volume, interval);
  const txns = getTxns(pair, interval);
  const change = getIntervalValue(pair.priceChange, interval);
  const liquidity = pair.liquidity?.usd ?? 0;
  const boostAmount = pair.boosts?.active ?? boost?.amount ?? boost?.totalAmount ?? 0;
  const buyRatio = getBuyRatio(pair, interval);
  const ageHours = pair.pairCreatedAt ? Math.max(0, (Date.now() - pair.pairCreatedAt) / 3_600_000) : 24;
  const recency = Math.max(0, 48 - ageHours) * 60;
  const positiveMomentum = Math.max(0, change) * 110;

  return volume * 0.75 + txns * 80 + liquidity * 0.08 + boostAmount * 18 + buyRatio * 2500 + positiveMomentum + recency;
}

function passesTrendFilters(coin: TrendCoin, interval: TrendInterval, filters: TrendFilters): boolean {
  const pair = coin.pair;
  if ((pair.liquidity?.usd ?? 0) < filters.minLiq) return false;
  if (getIntervalValue(pair.volume, interval) < filters.minVol) return false;
  if (getTxns(pair, interval) < filters.minTxns) return false;
  if (filters.greenOnly && getIntervalValue(pair.priceChange, interval) < 0) return false;
  return true;
}

function dedupePairsByToken(pairs: DexPair[]): DexPair[] {
  const best = new Map<string, DexPair>();
  for (const pair of pairs) {
    const tokenAddress = pair.baseToken?.address;
    if (!tokenAddress) continue;
    const key = `${pair.chainId ?? "solana"}:${tokenAddress}`;
    const previous = best.get(key);
    const previousVolume = previous?.volume?.h24 ?? 0;
    const currentVolume = pair.volume?.h24 ?? 0;
    if (!previous || currentVolume > previousVolume) best.set(key, pair);
  }
  return Array.from(best.values());
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return (await response.json()) as T;
}

async function fetchDexBoosts(): Promise<DexBoost[]> {
  const endpoints = [
    "https://api.dexscreener.com/token-boosts/top/v1",
    "https://api.dexscreener.com/token-boosts/latest/v1",
  ];

  const responses = await Promise.allSettled(endpoints.map((url) => fetchJson<DexBoost[]>(url)));
  const boosts = new Map<string, DexBoost>();

  for (const response of responses) {
    if (response.status !== "fulfilled") continue;
    for (const boost of response.value) {
      if (!boost.tokenAddress) continue;
      const previous = boosts.get(boost.tokenAddress);
      const previousAmount = previous?.amount ?? previous?.totalAmount ?? 0;
      const nextAmount = boost.amount ?? boost.totalAmount ?? 0;
      if (!previous || nextAmount >= previousAmount) boosts.set(boost.tokenAddress, boost);
    }
  }

  return Array.from(boosts.values()).slice(0, 60);
}

async function fetchPairsForMints(mints: string[]): Promise<DexPair[]> {
  const chunks: string[][] = [];
  for (let index = 0; index < mints.length; index += 30) chunks.push(mints.slice(index, index + 30));

  const responses = await Promise.allSettled(
    chunks.map((chunk) => fetchJson<DexPair[]>(`https://api.dexscreener.com/tokens/v1/solana/${chunk.join(",")}`))
  );

  return responses.flatMap((response) => (response.status === "fulfilled" ? response.value : []));
}

function pairToToken(pair: DexPair, boost?: DexBoost): JupTokenInfo {
  const price: number | undefined = pair.priceUsd ? Number(pair.priceUsd) : undefined;
  const migrationCreatedAt: string | undefined = pair.pairCreatedAt ? new Date(pair.pairCreatedAt).toISOString() : undefined;
  return {
    id: pair.baseToken.address,
    name: pair.baseToken.name,
    symbol: pair.baseToken.symbol,
    icon: pair.info?.imageUrl ?? boost?.icon,
    decimals: 0,
    usdPrice: Number.isFinite(price) ? price : undefined,
    mcap: pair.marketCap,
    fdv: pair.fdv,
    liquidity: pair.liquidity?.usd,
    stats24h: { priceChange: pair.priceChange?.h24, numBuys: pair.txns?.h24?.buys, numSells: pair.txns?.h24?.sells },
    firstPool: migrationCreatedAt ? { createdAt: migrationCreatedAt } : undefined,
    migrationCreatedAt,
    dexPaidAmount: boost?.totalAmount ?? boost?.amount,
    dexBoostAmount: boost?.amount,
    dexBoostTotalAmount: boost?.totalAmount,
    dexBoostActive: pair.boosts?.active,
    dexUrl: pair.url ?? boost?.url,
    pairAddress: pair.pairAddress,
    pairDexId: pair.dexId,
  };
}

async function fetchLiveTrending(interval: TrendInterval): Promise<TrendCoin[]> {
  const boosts = await fetchDexBoosts();
  const boostByMint = new Map<string, DexBoost>();
  for (const boost of boosts) {
    if (boost.tokenAddress) boostByMint.set(boost.tokenAddress, boost);
  }

  const pairs = dedupePairsByToken(await fetchPairsForMints(Array.from(boostByMint.keys())));
  const tokenSeed: JupTokenInfo[] = pairs.map((pair) => pairToToken(pair, boostByMint.get(pair.baseToken.address)));
  const enrichedTokens: JupTokenInfo[] = await enrichTokensWithMarketIntel(tokenSeed, { includeAth: true, maxAth: 10 });
  const tokenByMint = new Map(enrichedTokens.map((token) => [token.id, token]));

  return pairs
    .map((pair) => {
      const boost = boostByMint.get(pair.baseToken.address);
      return { pair, boost, token: tokenByMint.get(pair.baseToken.address), score: trendScore(pair, boost, interval) };
    })
    .filter((coin) => coin.score > 0)
    .sort((a, b) => b.score - a.score);
}

export const Trending = ({ onSelect }: Props) => {
  const [interval, setInterval] = useState<TrendInterval>("m5");
  const [filters, setFilters] = useState<TrendFilters>(DEFAULT_FILTERS);

  const { data, isFetching, error, refetch, dataUpdatedAt } = useQuery({
    queryKey: ["dex-live-trending", interval],
    queryFn: () => fetchLiveTrending(interval),
    staleTime: 15_000,
    refetchInterval: 20_000,
  });

  const rawResults: TrendCoin[] = data ?? [];
  const filteredResults: TrendCoin[] = useMemo(() => {
    return rawResults.filter((coin) => passesTrendFilters(coin, interval, filters)).slice(0, 10);
  }, [rawResults, interval, filters]);
  const dropped: number = rawResults.length - filteredResults.length;
  const activeInterval = INTERVALS.find((item) => item.id === interval);

  return (
    <section className="relative">
      <div>
        <div className="mb-5">
          <ToolHeader
            icon={Flame}
            title="Trending"
            subtitle={`Ranked from DexScreener live Solana boosts + pair volume, buys, liquidity and price action for ${activeInterval?.title ?? interval}.`}
            gradient="from-red-500 to-orange-400"
            glowColor="rgba(239,68,68,0.25)"
            badge="HOT"
            badgeColor="red"
            rightSlot={
              <div className="flex items-center gap-2">
                <div className="flex overflow-hidden rounded-xl border border-white/[0.08]">
                  {INTERVALS.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => setInterval(item.id)}
                      className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest transition ${
                        interval === item.id
                          ? "bg-white/10 text-white"
                          : "text-white/25 hover:text-white/50"
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => void refetch()}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.03] px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-widest text-white/40 transition hover:bg-white/[0.06] hover:text-white/60"
                >
                  {isFetching ? <Loader2 className="h-3 w-3 animate-spin text-og-lime" /> : <Zap className="h-3 w-3" />}
                  LIVE
                </button>
              </div>
            }
          />
        </div>

        <div className="mb-4 grid gap-3 lg:grid-cols-[1fr_260px]">
          <div className="border border-og-grid bg-og-ink/70 p-3">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.3em] text-og-blood">
                <Filter className="h-3 w-3" /> live filters
              </div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                <span className="text-og-lime">{filteredResults.length}</span> shown · <span className="text-og-blood">{dropped}</span> filtered
              </div>
              <button
                onClick={() => setFilters(DEFAULT_FILTERS)}
                className="ml-auto border border-og-grid px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-foreground/60 transition hover:border-og-blood hover:text-og-blood"
              >
                RESET
              </button>
            </div>
            <div className="grid gap-2 sm:grid-cols-4">
              <FilterNum label="MIN LIQ" value={filters.minLiq} step={1000} onChange={(value) => setFilters({ ...filters, minLiq: value })} />
              <FilterNum label="MIN VOL" value={filters.minVol} step={1000} onChange={(value) => setFilters({ ...filters, minVol: value })} />
              <FilterNum label="MIN TXNS" value={filters.minTxns} step={10} onChange={(value) => setFilters({ ...filters, minTxns: value })} />
              <FilterToggle label="GREEN" value={filters.greenOnly} onChange={(value) => setFilters({ ...filters, greenOnly: value })} />
            </div>
          </div>

          <div className="border border-og-blood/35 bg-og-blood/5 p-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            <div className="mb-2 flex items-center gap-2 text-og-blood">
              <Sparkles className="h-3 w-3" /> source check
            </div>
            <div>DexScreener boosts + token pairs</div>
            <div>Refresh: 20s</div>
            <div>Updated: {dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString() : "syncing"}</div>
          </div>
        </div>

        <div className="overflow-hidden border border-og-grid bg-og-ink/70">
          <div className="hidden grid-cols-12 gap-2 border-b border-og-grid px-4 py-2 text-[10px] uppercase tracking-[0.3em] text-muted-foreground md:grid">
            <div className="col-span-1">#</div>
            <div className="col-span-4">TOKEN</div>
            <div className="col-span-2 text-right">VOL / TXNS</div>
            <div className="col-span-2 text-right">{interval} Δ</div>
            <div className="col-span-2 text-right">MCAP / LIQ</div>
            <div className="col-span-1 text-right">DEX</div>
          </div>
          {filteredResults.map((coin, idx) => (
            <TrendingRow
              key={`${coin.pair.pairAddress}-${coin.pair.baseToken.address}`}
              idx={idx}
              coin={coin}
              interval={interval}
              onSelect={() => onSelect(coin.pair.baseToken.address)}
            />
          ))}
          {!isFetching && rawResults.length === 0 && (
            <div className="p-6 text-center text-xs uppercase tracking-widest text-muted-foreground">
              {error ? "DEXSCREENER TRENDING UNAVAILABLE · TAP LIVE TO RETRY" : "SYNCING LIVE TRENDING COINS"}
            </div>
          )}
          {!isFetching && rawResults.length > 0 && filteredResults.length === 0 && (
            <div className="p-6 text-center text-xs uppercase tracking-widest text-muted-foreground">
              NO LIVE TRENDING COINS PASS FILTERS · RESET OR LOWER THE BAR
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
  onChange: (value: number) => void;
  step: number;
}) => (
  <label className="flex items-center justify-between gap-2 border border-og-grid bg-og-ink px-2 py-1.5 font-mono text-[10px] uppercase tracking-widest">
    <span className="text-muted-foreground">{label}</span>
    <input
      type="number"
      min={0}
      step={step}
      value={value}
      onChange={(event) => onChange(Math.max(0, Number(event.target.value) || 0))}
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
  onChange: (value: boolean) => void;
}) => (
  <button
    onClick={() => onChange(!value)}
    className={`border px-2 py-1.5 text-left font-mono text-[10px] uppercase tracking-widest transition ${
      value
        ? "border-og-lime bg-og-lime/10 text-og-lime"
        : "border-og-grid text-foreground/60 hover:border-og-blood hover:text-og-blood"
    }`}
  >
    {label} · {value ? "ON" : "OFF"}
  </button>
);

const TrendingRow = ({
  idx,
  coin,
  interval,
  onSelect,
}: {
  idx: number;
  coin: TrendCoin;
  interval: TrendInterval;
  onSelect: () => void;
}) => {
  const pair = coin.pair;
  const change = getIntervalValue(pair.priceChange, interval);
  const up = change >= 0;
  const volume = getIntervalValue(pair.volume, interval);
  const txns = getTxns(pair, interval);
  const marketCap = pair.marketCap ?? pair.fdv;
  const ageSeconds = pair.pairCreatedAt ? Math.floor(pair.pairCreatedAt / 1000) : 0;
  const imageUrl = pair.info?.imageUrl ?? coin.boost?.icon;
  const detailToken: JupTokenInfo = coin.token ?? pairToToken(pair, coin.boost);
  const dexPaid = coin.token ? tokenDexPaidLabel(coin.token) : tokenDexPaidLabel({ dexPaidAmount: coin.boost?.totalAmount ?? coin.boost?.amount, dexBoostActive: pair.boosts?.active });

  return (
    <div className="group w-full border-b border-og-grid/50 p-3 transition hover:bg-og-blood/5 last:border-b-0 md:grid md:grid-cols-12 md:items-center md:gap-2 md:px-4 md:py-3">
      <button onClick={onSelect} className="flex min-w-0 items-center gap-3 text-left md:contents">
        <div className="font-mono text-xs text-og-blood md:col-span-1">
          {String(idx + 1).padStart(2, "0")}
        </div>
        <div className="flex min-w-0 flex-1 items-center gap-3 md:col-span-4">
          <div className="relative h-10 w-10 shrink-0 overflow-hidden border border-og-grid bg-og-ink md:h-8 md:w-8">
            {imageUrl ? (
              <img src={imageUrl} alt={pair.baseToken.symbol} className="h-full w-full object-cover" loading="lazy" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
            ) : (
              <div className="grid h-full w-full place-items-center text-[10px] text-og-lime">
                {pair.baseToken.symbol?.[0] ?? "?"}
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-1">
              <span className="truncate font-display text-base font-bold text-og-gold md:text-sm">${pair.baseToken.symbol}</span>
              {(pair.boosts?.active ?? coin.boost?.amount ?? 0) > 0 && <ShieldCheck className="h-3 w-3 shrink-0 text-og-lime" />}
            </div>
            <div className="truncate text-[10px] uppercase tracking-widest text-muted-foreground">
              {pair.baseToken.name} · {pair.dexId} {ageSeconds ? `· ${timeAgo(ageSeconds)} old` : ""}
            </div>
            <div className="mt-1 truncate font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
              ATH <span className="text-og-gold">{fmtUsd(coin.token?.allTimeHighUsd)}</span> <span className="text-og-gold/70">{shortDate(coin.token?.allTimeHighAt)}</span> · ATL <span className="text-og-cyan">{fmtUsd(coin.token?.allTimeLowUsd)}</span> · MIGR <span className="text-og-cyan">{shortDate(coin.token ? tokenMigrationDateIso(coin.token) : undefined)}</span> · DEX <span className={dexPaid === "—" ? "" : "text-og-lime"}>{dexPaid}</span>
            </div>
          </div>
        </div>
      </button>

      <div className="mt-3 grid grid-cols-3 gap-2 md:contents">
        <button onClick={onSelect} className="border border-og-grid/60 bg-og-ink/55 p-2 text-left font-mono md:col-span-2 md:border-0 md:bg-transparent md:p-0 md:text-right">
          <div className="mb-1 text-[8px] uppercase tracking-[0.22em] text-muted-foreground md:hidden">Vol / Txns</div>
          <div className="whitespace-nowrap text-xs text-og-cyan">{fmtUsd(volume)}</div>
          <div className="whitespace-nowrap text-[10px] text-muted-foreground">{txns.toLocaleString()} tx</div>
        </button>
        <button onClick={onSelect} className="border border-og-grid/60 bg-og-ink/55 p-2 text-left font-mono md:col-span-2 md:border-0 md:bg-transparent md:p-0 md:text-right">
          <div className="mb-1 text-[8px] uppercase tracking-[0.22em] text-muted-foreground md:hidden">{interval} Δ</div>
          <div className={`whitespace-nowrap text-xs ${up ? "text-og-lime" : "text-og-blood"}`}>
            <TrendingUp className={`mr-1 inline h-3 w-3 ${up ? "" : "rotate-180"}`} />
            {fmtPct(change)}
          </div>
          <div className="whitespace-nowrap text-[10px] text-muted-foreground">{fmtUsd(Number(pair.priceUsd))}</div>
        </button>
        <button onClick={onSelect} className="border border-og-grid/60 bg-og-ink/55 p-2 text-right font-mono text-[10px] uppercase tracking-widest text-muted-foreground md:col-span-2 md:border-0 md:bg-transparent md:p-0">
          <div className="mb-1 text-left text-[8px] tracking-[0.22em] md:hidden">Mcap / Liq</div>
          <div className="whitespace-nowrap text-og-cyan">MC {fmtUsd(marketCap)}</div>
          <div className="whitespace-nowrap">LQ {fmtUsd(pair.liquidity?.usd)}</div>
        </button>
        <div className="col-span-3 flex items-center justify-between border border-og-grid/60 bg-og-ink/55 p-2 font-mono text-[10px] uppercase tracking-widest md:col-span-1 md:border-0 md:bg-transparent md:p-0 md:justify-end">
          <span className="text-muted-foreground md:hidden">Dex</span>
          <a
            href={pair.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-og-gold transition hover:text-og-lime"
            title="Open on DexScreener"
            onClick={(event) => event.stopPropagation()}
          >
            <span className="max-w-[72px] truncate">{pair.dexId}</span>
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-og-grid/40 pt-2 font-mono text-[9px] uppercase tracking-widest text-muted-foreground md:col-span-12 md:ml-[calc(8.333333%+0.75rem)]">
        <span>boost {pair.boosts?.active ?? coin.boost?.amount ?? 0} · DEX {dexPaid} · ATH {fmtUsd(coin.token?.allTimeHighUsd)} {shortDate(coin.token?.allTimeHighAt)} · ATL {fmtUsd(coin.token?.allTimeLowUsd)} · CA {shortAddr(pair.baseToken.address, 4)}</span>
        <span className="inline-flex items-center gap-2">
          <CoinDetailDialog token={detailToken} onOpenScanner={() => onSelect()} actionLabel="Load" className="px-2 py-1" />
          <CopyMintButton mint={pair.baseToken.address} label="copy" copiedLabel="copied" className="px-2 py-1" iconClassName="h-3 w-3" />
          <button onClick={onSelect} className="inline-flex items-center gap-1 text-og-blood transition group-hover:text-og-lime">
            load coin <ArrowUpRight className="h-3 w-3" />
          </button>
        </span>
      </div>
    </div>
  );
};

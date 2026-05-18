import { type ComponentType, type ReactNode, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  BadgeDollarSign,
  BarChart3,
  Calendar,
  CandlestickChart,
  ExternalLink,
  Flame,
  Globe,
  Image as ImageIcon,
  Info,
  Loader2,
  Radar,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Users,
  Wallet,
  Zap,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { CopyMintButton } from "@/components/CopyMintButton";
import { HelpLabel, TokenRiskAlerts, buildTokenRiskAlerts, proofTimestampText } from "@/components/TokenTruthKit";
import { cn } from "@/lib/utils";
import {
  dexScreenerChartUrl,
  dexScreenerEmbedUrl,
  enrichTokensWithMarketIntel,
  forensicOgAttribution,
  fmtNum,
  fmtPct,
  fmtUsd,
  jupGetTokens,
  shortAddr,
  shortDate,
  timeAgo,
  tokenDevLaunchIntel,
  tokenDexPaidLabel,
  tokenHolderBundleIntel,
  tokenMigrationDateIso,
  tokenOgCreatedAtIso,
  type JupTokenInfo,
  type TokenDevLaunchIntel,
  type TokenHolderBundleIntel,
} from "@/lib/og";

type DetailDexPair = {
  chainId?: string;
  dexId?: string;
  url?: string;
  pairAddress?: string;
  labels?: string[];
  baseToken?: { address?: string; name?: string; symbol?: string };
  quoteToken?: { address?: string; name?: string; symbol?: string };
  priceUsd?: string;
  priceChange?: { m5?: number; h1?: number; h6?: number; h24?: number };
  liquidity?: { usd?: number; base?: number; quote?: number };
  volume?: { m5?: number; h1?: number; h6?: number; h24?: number };
  txns?: {
    m5?: { buys?: number; sells?: number };
    h1?: { buys?: number; sells?: number };
    h6?: { buys?: number; sells?: number };
    h24?: { buys?: number; sells?: number };
  };
  fdv?: number;
  marketCap?: number;
  pairCreatedAt?: number;
  info?: {
    imageUrl?: string;
    header?: string;
    openGraph?: string;
    websites?: { url?: string; label?: string }[];
    socials?: { type?: string; url?: string }[];
  };
  boosts?: { active?: number };
};

type CoinDetailDialogProps = {
  token: JupTokenInfo;
  trigger?: ReactNode;
  onOpenScanner?: (mint: string) => void;
  actionLabel?: string;
  className?: string;
};

async function fetchDexPairs(mint: string): Promise<DetailDexPair[]> {
  const response = await fetch(`https://api.dexscreener.com/tokens/v1/solana/${encodeURIComponent(mint)}`);
  if (!response.ok) return [];
  const json = (await response.json()) as DetailDexPair[];
  return Array.isArray(json) ? json : [];
}

function bestPair(pairs: DetailDexPair[]): DetailDexPair | undefined {
  return [...pairs]
    .filter((pair) => pair.baseToken?.address)
    .sort((a, b) => {
      const scoreA = (a.liquidity?.usd ?? 0) + (a.volume?.h24 ?? 0) * 0.35 + (a.txns?.h24?.buys ?? 0) * 12;
      const scoreB = (b.liquidity?.usd ?? 0) + (b.volume?.h24 ?? 0) * 0.35 + (b.txns?.h24?.buys ?? 0) * 12;
      return scoreB - scoreA;
    })[0];
}

function mergeToken(primary: JupTokenInfo, fallback: JupTokenInfo): JupTokenInfo {
  return {
    ...fallback,
    ...primary,
    chainId: primary.chainId ?? fallback.chainId,
    name: primary.name || fallback.name,
    symbol: primary.symbol || fallback.symbol,
    icon: primary.icon ?? fallback.icon,
    usdPrice: primary.usdPrice ?? fallback.usdPrice,
    mcap: primary.mcap ?? fallback.mcap,
    fdv: primary.fdv ?? fallback.fdv,
    liquidity: primary.liquidity ?? fallback.liquidity,
    holderCount: primary.holderCount ?? fallback.holderCount,
    organicScore: primary.organicScore ?? fallback.organicScore,
    organicScoreLabel: primary.organicScoreLabel ?? fallback.organicScoreLabel,
    isVerified: primary.isVerified ?? fallback.isVerified,
    stats24h: primary.stats24h ?? fallback.stats24h,
    stats1h: primary.stats1h ?? fallback.stats1h,
    stats5m: primary.stats5m ?? fallback.stats5m,
    audit: primary.audit ?? fallback.audit,
    firstPool: primary.firstPool?.createdAt ? primary.firstPool : fallback.firstPool,
    onChainCreatedAt: primary.onChainCreatedAt ?? fallback.onChainCreatedAt,
    creationSource: primary.creationSource ?? fallback.creationSource,
    allTimeHighUsd: primary.allTimeHighUsd ?? fallback.allTimeHighUsd,
    allTimeHighAt: primary.allTimeHighAt ?? fallback.allTimeHighAt,
    allTimeLowUsd: primary.allTimeLowUsd ?? fallback.allTimeLowUsd,
    allTimeLowAt: primary.allTimeLowAt ?? fallback.allTimeLowAt,
    migrationCreatedAt: primary.migrationCreatedAt ?? fallback.migrationCreatedAt,
    dexPaidAmount: primary.dexPaidAmount ?? fallback.dexPaidAmount,
    dexBoostAmount: primary.dexBoostAmount ?? fallback.dexBoostAmount,
    dexBoostTotalAmount: primary.dexBoostTotalAmount ?? fallback.dexBoostTotalAmount,
    dexBoostActive: primary.dexBoostActive ?? fallback.dexBoostActive,
    dexPaidOrderCount: primary.dexPaidOrderCount ?? fallback.dexPaidOrderCount,
    dexApprovedOrderCount: primary.dexApprovedOrderCount ?? fallback.dexApprovedOrderCount,
    dexProfilePaid: primary.dexProfilePaid ?? fallback.dexProfilePaid,
    dexCommunityTakeoverPaid: primary.dexCommunityTakeoverPaid ?? fallback.dexCommunityTakeoverPaid,
    dexAdsPaid: primary.dexAdsPaid ?? fallback.dexAdsPaid,
    dexFirstPaidAt: primary.dexFirstPaidAt ?? fallback.dexFirstPaidAt,
    dexLastPaidAt: primary.dexLastPaidAt ?? fallback.dexLastPaidAt,
    dexUrl: primary.dexUrl ?? fallback.dexUrl,
    pairAddress: primary.pairAddress ?? fallback.pairAddress,
    pairDexId: primary.pairDexId ?? fallback.pairDexId,
  };
}

function pairFallbackToken(pair: DetailDexPair, token: JupTokenInfo): JupTokenInfo {
  const price = pair.priceUsd ? Number(pair.priceUsd) : undefined;
  const buys24h = pair.txns?.h24?.buys ?? 0;
  const sells24h = pair.txns?.h24?.sells ?? 0;
  const total24h = buys24h + sells24h;
  const buyRatio = total24h > 0 ? buys24h / total24h : 0.5;
  const volume24h = pair.volume?.h24;
  const migrationCreatedAt = pair.pairCreatedAt ? new Date(pair.pairCreatedAt).toISOString() : undefined;

  return mergeToken(
    {
      ...token,
      chainId: pair.chainId ?? token.chainId ?? "solana",
      name: pair.baseToken?.name ?? token.name,
      symbol: pair.baseToken?.symbol ?? token.symbol,
      icon: pair.info?.imageUrl ?? token.icon,
      usdPrice: Number.isFinite(price) ? price : token.usdPrice,
      mcap: pair.marketCap ?? token.mcap,
      fdv: pair.fdv ?? token.fdv,
      liquidity: pair.liquidity?.usd ?? token.liquidity,
      stats24h: {
        priceChange: pair.priceChange?.h24 ?? token.stats24h?.priceChange,
        buyVolume: volume24h != null ? volume24h * buyRatio : token.stats24h?.buyVolume,
        sellVolume: volume24h != null ? volume24h * (1 - buyRatio) : token.stats24h?.sellVolume,
        numTraders: total24h || token.stats24h?.numTraders,
        numBuys: buys24h || token.stats24h?.numBuys,
        numSells: sells24h || token.stats24h?.numSells,
      },
      stats1h: { priceChange: pair.priceChange?.h1 ?? token.stats1h?.priceChange },
      stats5m: { priceChange: pair.priceChange?.m5 ?? token.stats5m?.priceChange },
      firstPool: migrationCreatedAt ? { createdAt: migrationCreatedAt } : token.firstPool,
      migrationCreatedAt: migrationCreatedAt ?? token.migrationCreatedAt,
      dexBoostActive: pair.boosts?.active ?? token.dexBoostActive,
      dexUrl: pair.url ?? token.dexUrl,
      pairAddress: pair.pairAddress ?? token.pairAddress,
      pairDexId: pair.dexId ?? token.pairDexId,
    },
    token,
  );
}

function getPairTxns(pair: DetailDexPair | undefined, window: "m5" | "h1" | "h24"): { buys: number; sells: number } {
  const bucket = pair?.txns?.[window];
  return { buys: bucket?.buys ?? 0, sells: bucket?.sells ?? 0 };
}

function linkHost(url: string | undefined): string {
  if (!url) return "link";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url.slice(0, 24);
  }
}

export const CoinDetailDialog = ({ token, trigger, onOpenScanner, actionLabel = "Scan", className }: CoinDetailDialogProps) => {
  const [open, setOpen] = useState<boolean>(false);
  const chainId = token.chainId ?? "solana";

  const { data: dexPairs, isFetching: isFetchingPairs } = useQuery({
    queryKey: ["coin-detail-dex-pairs", token.id],
    queryFn: () => fetchDexPairs(token.id),
    enabled: open && chainId === "solana" && Boolean(token.id),
    staleTime: 30_000,
  });

  const pair = useMemo(() => bestPair(dexPairs ?? []), [dexPairs]);

  const { data: enrichedTokens, isFetching: isFetchingToken } = useQuery({
    queryKey: ["coin-detail-token-intel", token.id, pair?.pairAddress ?? "none"],
    queryFn: async (): Promise<JupTokenInfo[]> => {
      const jupTokens = await jupGetTokens([token.id]);
      const base = jupTokens[0] ? mergeToken(jupTokens[0], token) : token;
      const withPair = pair ? pairFallbackToken(pair, base) : base;
      return enrichTokensWithMarketIntel([withPair], { includeAth: true, maxAth: 1 });
    },
    enabled: open && Boolean(token.id),
    staleTime: 30_000,
  });

  const detailToken = enrichedTokens?.[0] ?? (pair ? pairFallbackToken(pair, token) : token);

  const chartUrl = dexScreenerChartUrl({
    id: detailToken.id,
    chainId: detailToken.chainId ?? pair?.chainId ?? "solana",
    dexUrl: pair?.url ?? detailToken.dexUrl,
    pairAddress: pair?.pairAddress ?? detailToken.pairAddress,
  });
  const chartEmbedUrl = dexScreenerEmbedUrl(chartUrl);
  const banner = pair?.info?.header ?? pair?.info?.openGraph;
  const image = pair?.info?.imageUrl ?? detailToken.icon;
  const change24 = pair?.priceChange?.h24 ?? detailToken.stats24h?.priceChange ?? 0;
  const isUp24 = change24 >= 0;
  const buys24 = pair?.txns?.h24?.buys ?? detailToken.stats24h?.numBuys ?? 0;
  const sells24 = pair?.txns?.h24?.sells ?? detailToken.stats24h?.numSells ?? 0;
  const total24 = buys24 + sells24;
  const buyPct = total24 > 0 ? Math.round((buys24 / total24) * 100) : 0;
  const dexPaid = tokenDexPaidLabel(detailToken);
  const createdAt = tokenOgCreatedAtIso(detailToken);
  const migratedAt = tokenMigrationDateIso(detailToken);
  const pairCreated = pair?.pairCreatedAt ? new Date(pair.pairCreatedAt).toISOString() : migratedAt;

  const { data: classificationReport, isFetching: isFetchingClassification } = useQuery({
    queryKey: ["coin-detail-layered-classification", detailToken.symbol, "v7-origin-vs-later-official"],
    queryFn: () => forensicOgAttribution(detailToken.symbol),
    enabled: open && Boolean(detailToken.symbol),
    staleTime: 30_000,
  });

  const { data: devIntel, isFetching: isFetchingDevIntel } = useQuery({
    queryKey: ["coin-detail-dev-launch-intel", detailToken.chainId ?? "solana", detailToken.id],
    queryFn: (): Promise<TokenDevLaunchIntel> => tokenDevLaunchIntel(detailToken),
    enabled: open && Boolean(detailToken.id),
    staleTime: 60_000,
  });

  const { data: bundleIntel, isFetching: isFetchingBundleIntel } = useQuery({
    queryKey: ["coin-detail-holder-bundle-intel", detailToken.chainId ?? "solana", detailToken.id],
    queryFn: (): Promise<TokenHolderBundleIntel> => tokenHolderBundleIntel(detailToken),
    enabled: open && Boolean(detailToken.id),
    staleTime: 60_000,
  });
  const forensicKey = `${detailToken.chainId ?? "solana"}:${detailToken.id}`;
  const forensicScore = classificationReport?.tokenScores[forensicKey];
  const primaryLabel: string = forensicScore?.classification.primary_label ?? "SCANNED";
  const secondaryLabels: string[] = forensicScore?.classification.secondary_labels.slice(0, 6) ?? [];
  const primaryTone: "lime" | "gold" | "cyan" | "blood" | "muted" = primaryLabel.includes("TRUE OG")
    ? "lime"
    : primaryLabel.includes("CLONE") || primaryLabel.includes("COPY")
      ? "blood"
      : primaryLabel.includes("MIGR") || primaryLabel.includes("LATER OFFICIAL")
        ? "gold"
        : "cyan";

  const links = useMemo(() => {
    const raw: { label: string; url: string }[] = [];
    raw.push({ label: "DexScreener Chart", url: chartUrl });
    raw.push({ label: "Solscan", url: `https://solscan.io/token/${detailToken.id}` });
    raw.push({ label: "Jupiter", url: `https://jup.ag/swap/SOL-${detailToken.id}` });
    for (const website of pair?.info?.websites ?? []) if (website.url) raw.push({ label: website.label ?? linkHost(website.url), url: website.url });
    for (const social of pair?.info?.socials ?? []) if (social.url) raw.push({ label: social.type ?? linkHost(social.url), url: social.url });
    const seen = new Set<string>();
    return raw.filter((item) => item.url && !seen.has(item.url) && seen.add(item.url)).slice(0, 8);
  }, [chartUrl, detailToken.id, pair]);

  const riskAlerts = useMemo(() => buildTokenRiskAlerts(detailToken, forensicScore), [detailToken, forensicScore]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <button
            type="button"
            onClick={(event) => event.stopPropagation()}
            className={cn(
              "inline-flex items-center gap-1.5 border border-og-cyan/55 bg-og-cyan/10 px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-widest text-og-cyan transition hover:bg-og-cyan hover:text-og-ink",
              className,
            )}
          >
            <Radar className="h-3.5 w-3.5" /> Details
          </button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[92vh] w-[calc(100vw-1rem)] max-w-6xl overflow-y-auto border-og-cyan/35 bg-[#020814]/95 p-0 text-foreground shadow-[0_40px_140px_rgba(0,229,255,0.22)] backdrop-blur-xl sm:rounded-3xl">
        <DialogHeader className="sr-only">
          <DialogTitle>{detailToken.symbol} coin intelligence</DialogTitle>
          <DialogDescription>Token metadata, chart, trades, liquidity, links, and forensic market details.</DialogDescription>
        </DialogHeader>

        <div className="relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_0%,hsl(var(--og-cyan)/0.25),transparent_34%),radial-gradient(circle_at_92%_12%,hsl(var(--og-gold)/0.16),transparent_26%),linear-gradient(135deg,rgba(255,255,255,0.05),transparent_45%)]" />
          <div className="relative h-40 overflow-hidden border-b border-white/10 sm:h-56">
            {banner ? (
              <img src={banner} alt={`${detailToken.symbol} banner`} className="h-full w-full object-cover opacity-70" loading="lazy" />
            ) : (
              <div className="h-full w-full bg-[linear-gradient(135deg,rgba(0,229,255,0.18),rgba(234,196,53,0.14)_42%,rgba(188,255,0,0.10)),radial-gradient(circle_at_22%_34%,rgba(255,255,255,0.18),transparent_28%)]" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-[#020814] via-[#020814]/55 to-transparent" />
            <div className="absolute bottom-4 left-4 right-4 flex flex-wrap items-end justify-between gap-3 sm:left-6 sm:right-6">
              <div className="flex min-w-0 items-end gap-4">
                <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-3xl border border-og-cyan/40 bg-og-ink shadow-[0_0_40px_rgba(0,229,255,0.18)] sm:h-24 sm:w-24">
                  {image ? <img src={image} alt={detailToken.symbol} className="h-full w-full object-cover" loading="lazy" /> : <ImageIcon className="h-9 w-9 text-og-cyan" />}
                </div>
                <div className="min-w-0 pb-1">
                  <div className="mb-1 flex flex-wrap items-center gap-2 font-mono text-[9px] uppercase tracking-[0.28em] text-og-cyan">
                    <Sparkles className="h-3 w-3" /> coin intelligence popup
                    {detailToken.isVerified ? <span className="rounded-full border border-og-lime/40 bg-og-lime/10 px-2 py-0.5 text-og-lime">verified</span> : null}
                    {isFetchingPairs || isFetchingToken || isFetchingClassification || isFetchingDevIntel ? <span className="rounded-full border border-og-cyan/35 bg-og-cyan/10 px-2 py-0.5 text-og-cyan">syncing</span> : null}
                  </div>
                  <h2 className="truncate font-display text-4xl font-black uppercase tracking-tight text-foreground sm:text-6xl">
                    ${detailToken.symbol}
                  </h2>
                  <p className="mt-1 max-w-2xl truncate text-sm text-muted-foreground">{detailToken.name}</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 font-mono text-[10px] uppercase tracking-widest">
                <CopyMintButton mint={detailToken.id} label="copy CA" copiedLabel="copied" className="rounded-full border-og-gold/50 bg-og-gold/10 px-3 py-2 text-og-gold" iconClassName="h-3.5 w-3.5" />
                {onOpenScanner ? (
                  <button
                    type="button"
                    onClick={() => onOpenScanner(detailToken.id)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-og-cyan bg-og-cyan px-3 py-2 font-bold text-og-ink transition hover:bg-transparent hover:text-og-cyan"
                  >
                    <Radar className="h-3.5 w-3.5" /> {actionLabel}
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          <div className="relative grid gap-4 p-4 sm:p-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(330px,0.65fr)]">
            <div className="grid gap-4">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <IntelCard icon={Radar} label="Main Label" value={primaryLabel} sub={forensicScore ? `origin ${forensicScore.originScore}% · official ${forensicScore.officialVerificationScore}%` : "layered classifier"} tone={primaryTone} helpLabel="MAIN LABEL" />
                <IntelCard icon={CandlestickChart} label="Price" value={fmtUsd(detailToken.usdPrice ?? (pair?.priceUsd ? Number(pair.priceUsd) : undefined))} sub={<span className={isUp24 ? "text-og-lime" : "text-og-blood"}>24H {fmtPct(change24)}</span>} tone={isUp24 ? "lime" : "blood"} />
                <IntelCard icon={Users} label="Market Cap" value={fmtUsd(detailToken.mcap ?? detailToken.fdv ?? pair?.marketCap ?? pair?.fdv)} sub={`holders ${fmtNum(detailToken.holderCount)}`} tone="gold" />
                <IntelCard icon={BadgeDollarSign} label="DEX Paid" value={dexPaid} sub={`${fmtNum(detailToken.dexBoostActive ?? pair?.boosts?.active)} active · last ${shortDate(detailToken.dexLastPaidAt)}`} tone={dexPaid === "—" ? "muted" : "lime"} />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <IntelCard icon={Flame} label="All-Time High" value={fmtUsd(detailToken.allTimeHighUsd)} sub={`ATH date ${shortDate(detailToken.allTimeHighAt)}`} tone="gold" />
                <IntelCard icon={Activity} label="All-Time Low" value={fmtUsd(detailToken.allTimeLowUsd)} sub={`ATL date ${shortDate(detailToken.allTimeLowAt)}`} tone="cyan" />
              </div>

              <div className="rounded-3xl border border-og-cyan/25 bg-white/[0.035] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                <div className="mb-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.3em] text-og-cyan">
                  <Radar className="h-3.5 w-3.5" /> layered token truth
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <MetaLine label="Origin identity" value={forensicScore?.classification.layers.origin_identity ?? "scanning"} />
                  <MetaLine label="Control status" value={forensicScore?.classification.layers.control_status ?? "scanning"} />
                  <MetaLine label="Lifecycle" value={forensicScore?.classification.layers.lifecycle_status ?? "scanning"} />
                </div>
                {secondaryLabels.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-1 font-mono text-[9px] uppercase tracking-widest">
                    {secondaryLabels.map((label) => (
                      <span key={label} className="rounded-full border border-og-cyan/30 bg-og-cyan/10 px-2 py-1 text-og-cyan">
                        {label}
                      </span>
                    ))}
                  </div>
                ) : null}
                <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                  {forensicScore?.classification.reasoning_summary ?? "Open this token from a narrative search to compare it against the full origin cluster."}
                </p>
              </div>

              <div className="overflow-hidden rounded-3xl border border-og-cyan/25 bg-white/[0.035] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.3em] text-og-cyan">
                    <BarChart3 className="h-3.5 w-3.5" /> DexScreener chart · live pair
                  </div>
                  <a href={chartUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-full border border-og-cyan/35 bg-og-cyan/10 px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-og-cyan transition hover:bg-og-cyan hover:text-og-ink">
                    open full chart <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
                <div className="relative h-[360px] overflow-hidden rounded-2xl border border-white/10 bg-[#030b18] sm:h-[430px]">
                  <iframe
                    src={chartEmbedUrl}
                    title={`${detailToken.symbol} DexScreener chart`}
                    className="h-full w-full border-0"
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                  />
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <TapePanel pair={pair} token={detailToken} buyPct={buyPct} buys24={buys24} sells24={sells24} />
                <MetadataPanel token={detailToken} pair={pair} createdAt={createdAt} migratedAt={migratedAt} pairCreated={pairCreated} />
              </div>

              <div className="grid gap-4 xl:grid-cols-3">
                <DexPaidPanel token={detailToken} pair={pair} />
                <DevLaunchPanel intel={devIntel} isLoading={isFetchingDevIntel} primaryLabel={primaryLabel} />
                <HolderBundlePanel intel={bundleIntel} isLoading={isFetchingBundleIntel} token={detailToken} />
              </div>

              <TokenRiskAlerts alerts={riskAlerts} title="Watch Items" />
            </div>

            <aside className="grid content-start gap-4">
              <div className="rounded-3xl border border-og-gold/30 bg-og-gold/5 p-4">
                <div className="mb-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.3em] text-og-gold">
                  <Info className="h-3.5 w-3.5" /> token metadata
                </div>
                <div className="grid gap-2">
                  <MetaLine label="Chain" value={chainId} />
                  <MetaLine label="DEX" value={pair?.dexId ?? detailToken.pairDexId ?? "—"} />
                  <MetaLine label="Pair" value={shortAddr(pair?.pairAddress ?? detailToken.pairAddress, 5)} />
                  <MetaLine label="CA" value={shortAddr(detailToken.id, 7)} />
                  <MetaLine label="Decimals" value={String(detailToken.decimals ?? "—")} />
                  <MetaLine label="ATH" value={`${fmtUsd(detailToken.allTimeHighUsd)} · ${shortDate(detailToken.allTimeHighAt)}`} />
                  <MetaLine label="ATL" value={`${fmtUsd(detailToken.allTimeLowUsd)} · ${shortDate(detailToken.allTimeLowAt)}`} />
                  <MetaLine label="Migration" value={shortDate(migratedAt)} />
                  <MetaLine label="Mint proof" value={proofTimestampText(createdAt)} />
                </div>
              </div>

              <div className="rounded-3xl border border-og-lime/25 bg-white/[0.035] p-4">
                <div className="mb-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.3em] text-og-lime">
                  <ShieldCheck className="h-3.5 w-3.5" /> safety + audit
                </div>
                <div className="grid gap-2">
                  <AuditLine label="Mint authority" ok={detailToken.audit?.mintAuthorityDisabled === true} good="disabled" bad="open / unknown" />
                  <AuditLine label="Freeze authority" ok={detailToken.audit?.freezeAuthorityDisabled === true} good="disabled" bad="open / unknown" />
                  <AuditLine label="Verified" ok={detailToken.isVerified === true} good="verified" bad="unverified" />
                  <MetaLine label="Top holders" value={detailToken.audit?.topHoldersPercentage != null ? `${detailToken.audit.topHoldersPercentage.toFixed(1)}%` : "—"} />
                  <MetaLine label="Organic score" value={detailToken.organicScore != null ? `${detailToken.organicScore.toFixed(0)} · ${detailToken.organicScoreLabel ?? ""}` : "—"} />
                  <MetaLine label="Origin score" value={forensicScore ? `${forensicScore.originScore}%` : "—"} />
                  <MetaLine label="Official status" value={forensicScore ? `${forensicScore.officialVerificationScore}%` : "—"} />
                  <MetaLine label="Clone score" value={forensicScore ? `${forensicScore.cloneScore}%` : "—"} />
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-4">
                <div className="mb-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.3em] text-og-cyan">
                  <Globe className="h-3.5 w-3.5" /> links + chart
                </div>
                <div className="grid gap-2">
                  {links.map((link) => (
                    <a key={link.url} href={link.url} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-2 rounded-2xl border border-white/10 bg-white/[0.035] px-3 py-2 text-sm text-foreground/80 transition hover:border-og-cyan hover:text-og-cyan">
                      <span className="truncate capitalize">{link.label || linkHost(link.url)}</span>
                      <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                    </a>
                  ))}
                </div>
              </div>
            </aside>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const IntelCard = ({ icon: Icon, label, value, sub, tone, helpLabel }: { icon: ComponentType<{ className?: string }>; label: string; value: string; sub?: ReactNode; tone: "lime" | "gold" | "cyan" | "blood" | "muted"; helpLabel?: string }) => {
  const toneClass = tone === "lime" ? "border-og-lime/35 text-og-lime" : tone === "gold" ? "border-og-gold/35 text-og-gold" : tone === "cyan" ? "border-og-cyan/35 text-og-cyan" : tone === "blood" ? "border-og-blood/35 text-og-blood" : "border-white/10 text-muted-foreground";
  return (
    <div className={cn("rounded-3xl border bg-white/[0.035] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]", toneClass)}>
      <div className="flex items-center justify-between gap-2 font-mono text-[10px] uppercase tracking-[0.26em] text-muted-foreground">
        <HelpLabel label={helpLabel ?? label} />
        <Icon className="h-4 w-4" />
      </div>
      <div className="mt-3 truncate font-display text-2xl font-black text-foreground">{value}</div>
      {sub ? <div className="mt-1 truncate font-mono text-[10px] uppercase tracking-widest">{sub}</div> : null}
    </div>
  );
};

const TapePanel = ({ pair, token, buyPct, buys24, sells24 }: { pair?: DetailDexPair; token: JupTokenInfo; buyPct: number; buys24: number; sells24: number }) => {
  const tx5 = getPairTxns(pair, "m5");
  const tx1h = getPairTxns(pair, "h1");
  return (
    <div className="rounded-3xl border border-og-lime/25 bg-white/[0.035] p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.3em] text-og-lime">
          <Activity className="h-3.5 w-3.5" /> buys / sells
        </div>
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">24h tape</span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <TapeMetric label="Buys" value={fmtNum(buys24 || token.stats24h?.numBuys)} tone="lime" />
        <TapeMetric label="Sells" value={fmtNum(sells24 || token.stats24h?.numSells)} tone="blood" />
        <TapeMetric label="Buy volume" value={fmtUsd(token.stats24h?.buyVolume)} tone="lime" />
        <TapeMetric label="Sell volume" value={fmtUsd(token.stats24h?.sellVolume)} tone="blood" />
      </div>
      <div className="mt-4 h-3 overflow-hidden rounded-full border border-white/10 bg-og-blood/25">
        <div className="h-full rounded-full bg-og-lime transition-all" style={{ width: `${buyPct}%` }} />
      </div>
      <div className="mt-2 flex justify-between font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        <span>Buy pressure</span>
        <span className="text-og-lime">{buyPct || "—"}%</span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-2">5m <span className="text-og-lime">B {fmtNum(tx5.buys)}</span> / <span className="text-og-blood">S {fmtNum(tx5.sells)}</span></div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-2">1h <span className="text-og-lime">B {fmtNum(tx1h.buys)}</span> / <span className="text-og-blood">S {fmtNum(tx1h.sells)}</span></div>
      </div>
    </div>
  );
};

const MetadataPanel = ({ token, pair, createdAt, migratedAt, pairCreated }: { token: JupTokenInfo; pair?: DetailDexPair; createdAt?: string; migratedAt?: string; pairCreated?: string }) => (
  <div className="rounded-3xl border border-og-cyan/25 bg-white/[0.035] p-4">
    <div className="mb-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.3em] text-og-cyan">
      <Calendar className="h-3.5 w-3.5" /> origin + market dates
    </div>
    <div className="grid gap-2">
      <MetaLine label="On-chain mint" value={createdAt ? `${shortDate(createdAt)} · ${timeAgo(Math.floor(new Date(createdAt).getTime() / 1000))} old` : "unknown"} />
      <MetaLine label="Pair created" value={pairCreated ? `${shortDate(pairCreated)} · ${timeAgo(Math.floor(new Date(pairCreated).getTime() / 1000))} old` : "—"} />
      <MetaLine label="Migration day" value={shortDate(migratedAt)} />
      <MetaLine label="ATH" value={`${fmtUsd(token.allTimeHighUsd)} · ${shortDate(token.allTimeHighAt)}`} />
      <MetaLine label="ATL" value={`${fmtUsd(token.allTimeLowUsd)} · ${shortDate(token.allTimeLowAt)}`} />
      <MetaLine label="Labels" value={(pair?.labels ?? []).join(", ") || "—"} />
      <MetaLine label="Pair quote" value={pair?.quoteToken?.symbol ? `${pair.quoteToken.symbol} · ${pair.dexId ?? "DEX"}` : "—"} />
    </div>
  </div>
);

const DexPaidPanel = ({ token, pair }: { token: JupTokenInfo; pair?: DetailDexPair }) => {
  const activeBoosts = token.dexBoostActive ?? pair?.boosts?.active ?? 0;
  const boostPaid = token.dexBoostTotalAmount ?? token.dexPaidAmount ?? token.dexBoostAmount;
  const hasDexSignal = tokenDexPaidLabel(token) !== "—" || activeBoosts > 0;

  return (
    <div className="rounded-3xl border border-og-gold/25 bg-white/[0.035] p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.3em] text-og-gold">
          <BadgeDollarSign className="h-3.5 w-3.5" /> DEX paid + boosts
        </div>
        <span className={cn("rounded-full border px-2 py-1 font-mono text-[9px] uppercase tracking-widest", hasDexSignal ? "border-og-lime/45 bg-og-lime/10 text-og-lime" : "border-white/10 text-muted-foreground")}>{hasDexSignal ? "live signal" : "none public"}</span>
      </div>
      <div className="grid gap-2">
        <MetaLine label="Paid status" value={tokenDexPaidLabel(token)} />
        <MetaLine label="Active boosts" value={activeBoosts > 0 ? fmtNum(activeBoosts) : "0"} />
        <MetaLine label="Boost total" value={boostPaid != null ? fmtNum(boostPaid) : "—"} />
        <MetaLine label="DEX orders" value={`${fmtNum(token.dexApprovedOrderCount ?? 0)} approved / ${fmtNum(token.dexPaidOrderCount ?? 0)} total`} />
        <MetaLine label="First paid" value={shortDate(token.dexFirstPaidAt)} />
        <MetaLine label="Last paid" value={shortDate(token.dexLastPaidAt)} />
      </div>
      <div className="mt-3 flex flex-wrap gap-1 font-mono text-[9px] uppercase tracking-widest">
        <DexFlag active={token.dexProfilePaid === true} label="profile" />
        <DexFlag active={token.dexCommunityTakeoverPaid === true} label="CTO" />
        <DexFlag active={token.dexAdsPaid === true} label="ads" />
        <DexFlag active={activeBoosts > 0} label="active boost" />
      </div>
    </div>
  );
};

const DevLaunchPanel = ({ intel, isLoading, primaryLabel }: { intel?: TokenDevLaunchIntel; isLoading: boolean; primaryLabel: string }) => {
  const isCto = intel?.launchType === "CTO / community support" || primaryLabel.includes("CTO");
  const devRiskTone: "lime" | "gold" | "blood" = intel?.devRiskLabel === "severe" || intel?.devRiskLabel === "high" ? "blood" : intel?.devRiskLabel === "watch" ? "gold" : "lime";
  return (
    <div className="rounded-3xl border border-og-cyan/25 bg-white/[0.035] p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.3em] text-og-cyan">
          <Wallet className="h-3.5 w-3.5" /> CTO / dev launch intel
        </div>
        {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin text-og-cyan" /> : <span className={cn("rounded-full border px-2 py-1 font-mono text-[9px] uppercase tracking-widest", isCto ? "border-og-gold/50 bg-og-gold/10 text-og-gold" : devRiskTone === "blood" ? "border-og-blood/50 bg-og-blood/10 text-og-blood" : "border-og-cyan/35 bg-og-cyan/10 text-og-cyan")}>{intel?.launchType ?? "scanning"}</span>}
      </div>
      <div className="grid gap-2">
        <MetaLine label="Creator wallet" value={shortAddr(intel?.wallet ?? undefined, 6)} />
        <MetaLine label="Confidence" value={intel?.confidence ?? "scanning"} />
        <MetaLine label="Recent mints" value={fmtNum(intel?.recentTokenMints)} />
        <MetaLine label="Bonded coins" value={fmtNum(intel?.bondedCoinCount)} />
        <MetaLine label="DEX-paid coins" value={fmtNum(intel?.dexPaidCoinCount)} />
        <MetaLine label="Boosted coins" value={fmtNum(intel?.activeBoostedCoinCount)} />
        <MetaLine label="CTO orders" value={fmtNum(intel?.ctoOrderCount)} />
        <MetaLine label="Dev risk" value={intel?.devRiskLabel ? `${intel.devRiskLabel} · farm ${fmtNum(intel.farmingRiskScore)} / rug ${fmtNum(intel.rugRiskScore)}` : "scanning"} />
        <MetaLine label="Rug/dead coins" value={`${fmtNum(intel?.ruggedCoinCount)} dead · ${fmtNum(intel?.lowLiquidityCoinCount)} low LP`} />
        <MetaLine label="Avg linked LP" value={fmtUsd(intel?.averageLiquidity)} />
        <MetaLine label="Last seen" value={shortDate(intel?.lastSeenAt)} />
      </div>
      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
        {(intel?.riskNotes?.[0] ?? intel?.notes?.[0]) ?? "Wallet history loads from early mint/pool fee-payer activity and public DEX pair/order data."}
      </p>
      {intel?.sampleMints.length ? (
        <div className="mt-3 flex flex-wrap gap-1 font-mono text-[9px] uppercase tracking-widest">
          {intel.sampleMints.slice(0, 5).map((mint) => (
            <span key={mint} className="rounded-full border border-white/10 bg-white/[0.035] px-2 py-1 text-muted-foreground">{shortAddr(mint, 4)}</span>
          ))}
        </div>
      ) : null}
    </div>
  );
};

const HolderBundlePanel = ({ intel, isLoading, token }: { intel?: TokenHolderBundleIntel; isLoading: boolean; token: JupTokenInfo }) => {
  const fallbackTop: number = token.audit?.topHoldersPercentage ?? 0;
  const status: string = intel?.status ?? "scanning";
  const toneClass: string = status === "Likely bundled"
    ? "border-og-blood/50 bg-og-blood/10 text-og-blood"
    : status === "Bundle watch"
      ? "border-og-gold/50 bg-og-gold/10 text-og-gold"
      : "border-og-lime/35 bg-og-lime/10 text-og-lime";

  return (
    <div className="rounded-3xl border border-og-gold/25 bg-white/[0.035] p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.3em] text-og-gold">
          <ShieldAlert className="h-3.5 w-3.5" /> holder bundle tracking
        </div>
        {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin text-og-gold" /> : <span className={cn("rounded-full border px-2 py-1 font-mono text-[9px] uppercase tracking-widest", toneClass)}>{status}</span>}
      </div>
      <div className="grid gap-2">
        <MetaLine label="Bundle score" value={intel ? `${fmtNum(intel.score)}/100 · ${intel.confidence}` : "scanning"} />
        <MetaLine label="Bundle count" value={fmtNum(intel?.bundleCount)} />
        <MetaLine label="Largest holder" value={intel ? `${intel.topHolderPercent.toFixed(1)}%` : fallbackTop ? `${fallbackTop.toFixed(1)}%` : "—"} />
        <MetaLine label="Top 10 holders" value={intel ? `${intel.top10Percent.toFixed(1)}%` : "scanning"} />
      </div>
      <div className="mt-3 grid gap-1.5">
        {(intel?.suspectedBundlers ?? []).slice(0, 4).map((holder) => (
          <div key={`${holder.owner}-${holder.tokenAccount}`} className="flex items-center justify-between gap-2 rounded-2xl border border-white/10 bg-white/[0.035] px-3 py-2 font-mono text-[9px] uppercase tracking-widest">
            <span className="truncate text-muted-foreground">{holder.label}</span>
            <span className="shrink-0 text-og-gold">{shortAddr(holder.owner, 4)} · {holder.percent.toFixed(1)}%</span>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
        {intel?.evidence?.[0] ?? "Resolves largest token accounts into owner wallets to estimate bundle count and suspected bundlers."}
      </p>
    </div>
  );
};

const DexFlag = ({ active, label }: { active: boolean; label: string }) => (
  <span className={cn("rounded-full border px-2 py-1", active ? "border-og-lime/35 bg-og-lime/10 text-og-lime" : "border-white/10 bg-white/[0.025] text-muted-foreground")}>{label}</span>
);

const TapeMetric = ({ label, value, tone }: { label: string; value: string; tone: "lime" | "blood" }) => (
  <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-3">
    <div className="font-mono text-[9px] uppercase tracking-[0.24em] text-muted-foreground">{label}</div>
    <div className={cn("mt-1 font-display text-xl font-bold", tone === "lime" ? "text-og-lime" : "text-og-blood")}>{value}</div>
  </div>
);

const MetaLine = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.035] px-3 py-2 font-mono text-[10px] uppercase tracking-widest">
    <span className="shrink-0 text-muted-foreground"><HelpLabel label={label} /></span>
    <span className="min-w-0 truncate text-right text-foreground">{value}</span>
  </div>
);

const AuditLine = ({ label, ok, good, bad }: { label: string; ok: boolean; good: string; bad: string }) => (
  <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.035] px-3 py-2 font-mono text-[10px] uppercase tracking-widest">
    <span className="text-muted-foreground"><HelpLabel label={label} /></span>
    <span className={cn("inline-flex items-center gap-1", ok ? "text-og-lime" : "text-og-blood")}>
      {ok ? <ShieldCheck className="h-3 w-3" /> : <ShieldAlert className="h-3 w-3" />}
      {ok ? good : bad}
    </span>
  </div>
);

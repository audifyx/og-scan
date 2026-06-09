import { type ComponentType, type ReactNode, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  BadgeDollarSign,
  BarChart3,
  Calendar,
  CandlestickChart,
  ExternalLink,
  Flame,
  Globe,
  Image as ImageIcon,
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
  fmtHolderCount,
  fmtNum,
  fmtPct,
  fmtUsd,
  fmtWhaleCount,
  hasPulledOrDeadLiquidity,
  jupGetTokens,
  shortAddr,
  shortDate,
  timeAgo,
  tokenDevLaunchIntel,
  tokenDexPaidLabel,
  tokenEffectiveLiquidityUsd,
  tokenHolderBundleIntel,
  tokenMigrationDateIso,
  tokenOgCreatedAtIso,
  type JupTokenInfo,
  type TokenCreatorFundingIntel,
  type TokenDevLaunchIntel,
  type TokenDexPoolIntel,
  type TokenHolderBundleIntel,
  type TokenPumpFunIntel,
} from "@/lib/og";
import { explorerAddressUrl, getChain } from "@/lib/chains";
import { fetchEvmTokenSecurity, type EvmTokenSecurity } from "@/lib/evm-intel";
import { CoinCommunityFull } from "@/components/CoinCommunityFull";

// ─── Types ────────────────────────────────────────────────────────────────────

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
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function fetchDexPairs(mint: string, chainId?: string): Promise<DetailDexPair[]> {
  const dexChain = chainId || "solana";
  const response = await fetch(`https://api.dexscreener.com/tokens/v1/${encodeURIComponent(dexChain)}/${encodeURIComponent(mint)}`);
  if (!response.ok) return [];
  const json = (await response.json()) as DetailDexPair[];
  return Array.isArray(json) ? json : [];
}

// Keyless market fallback (used when Birdeye is rate-limited / over quota).
type GeckoMarket = { price?: number; fdv?: number; mcap?: number; volume24h?: number };
async function fetchGeckoMarket(mint: string, chainId?: string): Promise<GeckoMarket | null> {
  const network = (chainId || "solana") === "solana" ? "solana" : chainId;
  try {
    const res = await fetch(
      `https://api.geckoterminal.com/api/v2/networks/${encodeURIComponent(network ?? "solana")}/tokens/${encodeURIComponent(mint)}`,
      { headers: { accept: "application/json" } },
    );
    if (!res.ok) return null;
    const attr = ((await res.json())?.data?.attributes ?? {}) as Record<string, unknown>;
    const num = (v: unknown): number | undefined => {
      const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : undefined;
      return n != null && Number.isFinite(n) && n > 0 ? n : undefined;
    };
    const vol = attr.volume_usd as Record<string, unknown> | undefined;
    return {
      price: num(attr.price_usd),
      fdv: num(attr.fdv_usd),
      mcap: num(attr.market_cap_usd),
      volume24h: num(vol?.h24),
    };
  } catch {
    return null;
  }
}

function pairQuoteLiquidityUsd(pair: DetailDexPair | undefined): number | undefined {
  const quoteAmount: number | undefined = pair?.liquidity?.quote;
  if (quoteAmount == null || !Number.isFinite(quoteAmount)) return undefined;
  const quoteSymbol: string = (pair?.quoteToken?.symbol ?? "").toUpperCase();
  const quoteMint: string | undefined = pair?.quoteToken?.address;
  // Stablecoin quotes: amount IS the USD value
  if (quoteSymbol === "USDC" || quoteSymbol === "USDT" || quoteSymbol === "USDH" || quoteSymbol === "USDS" || quoteMint === "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v") return quoteAmount;
  // SOL-quoted pairs: derive USD from reported — quote side is ~half
  if (quoteSymbol === "SOL" || quoteSymbol === "WSOL" || quoteMint === "So11111111111111111111111111111111111111112") {
    const reportedUsd: number | undefined = pair?.liquidity?.usd;
    if (reportedUsd != null && Number.isFinite(reportedUsd) && reportedUsd > 0) return reportedUsd / 2;
  }
  return undefined;
}

function pairEffectiveLiquidityUsd(pair: DetailDexPair | undefined): number | undefined {
  const reported: number | undefined = pair?.liquidity?.usd;
  const quoteLiquidity: number | undefined = pairQuoteLiquidityUsd(pair);
  if (quoteLiquidity != null) return reported != null ? Math.min(reported, quoteLiquidity * 2) : quoteLiquidity * 2;
  return reported;
}

function pairHasPulledLiquidity(pair: DetailDexPair | undefined): boolean {
  if (!pair) return false;
  const reported: number = pair.liquidity?.usd ?? 0;
  const quoteLiquidity: number | undefined = pairQuoteLiquidityUsd(pair);
  const effective: number = pairEffectiveLiquidityUsd(pair) ?? 0;
  // Quote-side liquidity is tiny despite high reported liquidity — classic rug
  if (quoteLiquidity != null && quoteLiquidity < 500 && reported >= 10_000) return true;
  // Effective liquidity is near-zero but reported is large — LP backing removed
  if (effective < 1_000 && reported >= 50_000) return true;
  return false;
}

function bestPair(pairs: DetailDexPair[]): DetailDexPair | undefined {
  return [...pairs]
    .filter((pair) => pair.baseToken?.address)
    .sort((a, b) => {
      const scoreA = (pairEffectiveLiquidityUsd(a) ?? 0) + (a.volume?.h24 ?? 0) * 0.35 + (a.txns?.h24?.buys ?? 0) * 12;
      const scoreB = (pairEffectiveLiquidityUsd(b) ?? 0) + (b.volume?.h24 ?? 0) * 0.35 + (b.txns?.h24?.buys ?? 0) * 12;
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
    reportedLiquidity: primary.reportedLiquidity ?? fallback.reportedLiquidity,
    effectiveLiquidityUsd: primary.effectiveLiquidityUsd ?? fallback.effectiveLiquidityUsd,
    quoteLiquidityUsd: primary.quoteLiquidityUsd ?? fallback.quoteLiquidityUsd,
    lpPulled: primary.lpPulled ?? fallback.lpPulled,
    lpPullReason: primary.lpPullReason ?? fallback.lpPullReason,
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
    firstMintAt: primary.firstMintAt ?? fallback.firstMintAt,
    firstMintAuthorityWallet: primary.firstMintAuthorityWallet ?? fallback.firstMintAuthorityWallet,
    firstMintSource: primary.firstMintSource ?? fallback.firstMintSource,
    creationSource: primary.creationSource ?? fallback.creationSource,
    allTimeHighUsd: primary.allTimeHighUsd ?? fallback.allTimeHighUsd,
    allTimeHighAt: primary.allTimeHighAt ?? fallback.allTimeHighAt,
    allTimeHighSource: primary.allTimeHighSource ?? fallback.allTimeHighSource,
    allTimeLowUsd: primary.allTimeLowUsd ?? fallback.allTimeLowUsd,
    allTimeLowAt: primary.allTimeLowAt ?? fallback.allTimeLowAt,
    allTimeLowSource: primary.allTimeLowSource ?? fallback.allTimeLowSource,
    allTimeHighMarketCap: primary.allTimeHighMarketCap ?? fallback.allTimeHighMarketCap,
    allTimeHighMarketCapAt: primary.allTimeHighMarketCapAt ?? fallback.allTimeHighMarketCapAt,
    allTimeLowMarketCap: primary.allTimeLowMarketCap ?? fallback.allTimeLowMarketCap,
    allTimeLowMarketCapAt: primary.allTimeLowMarketCapAt ?? fallback.allTimeLowMarketCapAt,
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
    heliusAuthorities: primary.heliusAuthorities ?? fallback.heliusAuthorities,
    topHolders: primary.topHolders ?? fallback.topHolders,
    topHoldersPercent: primary.topHoldersPercent ?? fallback.topHoldersPercent,
    whaleCount: primary.whaleCount ?? fallback.whaleCount,
    creatorFunding: primary.creatorFunding ?? fallback.creatorFunding,
    pumpFun: primary.pumpFun ?? fallback.pumpFun,
    allPools: primary.allPools ?? fallback.allPools,
    poolCount: primary.poolCount ?? fallback.poolCount,
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
  const reportedLiquidity: number | undefined = pair.liquidity?.usd;
  const effectiveLiquidityUsd: number | undefined = pairEffectiveLiquidityUsd(pair);
  const quoteLiquidityUsd: number | undefined = pairQuoteLiquidityUsd(pair);
  const lpPulled: boolean = pairHasPulledLiquidity(pair);

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
      liquidity: effectiveLiquidityUsd ?? token.liquidity,
      reportedLiquidity: reportedLiquidity ?? token.reportedLiquidity,
      effectiveLiquidityUsd: effectiveLiquidityUsd ?? token.effectiveLiquidityUsd,
      quoteLiquidityUsd: quoteLiquidityUsd ?? token.quoteLiquidityUsd,
      lpPulled: lpPulled || token.lpPulled,
      lpPullReason: lpPulled ? `LP appears pulled/dead: ${fmtUsd(reportedLiquidity)} reported liquidity but only ${fmtUsd(quoteLiquidityUsd)} quote-side depth.` : token.lpPullReason,
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

function marketExtremeLine(price: number | undefined, dateIso: string | undefined): string {
  return price != null ? `${fmtUsd(price)} · ${shortDate(dateIso)}` : "—";
}

function linkHost(url: string | undefined): string {
  if (!url) return "link";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url.slice(0, 24);
  }
}

// ─── Main Dialog ──────────────────────────────────────────────────────────────

export const CoinDetailDialog = ({ token, trigger, onOpenScanner, actionLabel = "Scan", className, defaultOpen, onOpenChange: externalOnOpenChange }: CoinDetailDialogProps) => {
  const [open, setOpen] = useState<boolean>(defaultOpen ?? false);
  const chainId = token.chainId ?? "solana";
  const isSolana = chainId === "solana";

  const { data: dexPairs, isFetching: isFetchingPairs } = useQuery({
    queryKey: ["coin-detail-dex-pairs", chainId, token.id],
    queryFn: () => fetchDexPairs(token.id, chainId),
    enabled: open && Boolean(token.id),
    staleTime: 30_000,
  });

  const pair = useMemo(() => bestPair(dexPairs ?? []), [dexPairs]);

  const { data: geckoMarket } = useQuery({
    queryKey: ["coin-detail-gecko-market", chainId, token.id],
    queryFn: () => fetchGeckoMarket(token.id, chainId),
    enabled: open && Boolean(token.id),
    staleTime: 30_000,
  });

  const { data: enrichedTokens, isFetching: isFetchingToken } = useQuery({
    queryKey: ["coin-detail-token-intel", token.id, pair?.pairAddress ?? "none", "v10-dominance-engine"],
    queryFn: async (): Promise<JupTokenInfo[]> => {
      const jupTokens = await jupGetTokens([token.id]);
      const base = jupTokens[0] ? mergeToken(jupTokens[0], token) : token;
      const withPair = pair ? pairFallbackToken(pair, base) : base;
      return enrichTokensWithMarketIntel([withPair], { includeAth: true, includeOnChainIntel: true, maxOnChain: 1, maxBirdeye: 1 });
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
  const change1h = pair?.priceChange?.h1 ?? detailToken.stats1h?.priceChange ?? 0;
  const change5m = pair?.priceChange?.m5 ?? detailToken.stats5m?.priceChange ?? 0;
  const isUp24 = change24 >= 0;

  const buys24 = pair?.txns?.h24?.buys ?? detailToken.stats24h?.numBuys ?? 0;
  const sells24 = pair?.txns?.h24?.sells ?? detailToken.stats24h?.numSells ?? 0;
  const total24 = buys24 + sells24;
  const buyPct = total24 > 0 ? Math.round((buys24 / total24) * 100) : 0;

  const dexPaid = tokenDexPaidLabel(detailToken);
  const createdAt = tokenOgCreatedAtIso(detailToken);
  const migratedAt = tokenMigrationDateIso(detailToken);
  const pairCreated = pair?.pairCreatedAt ? new Date(pair.pairCreatedAt).toISOString() : migratedAt;
  const lpPulled = hasPulledOrDeadLiquidity(detailToken);
  const quoteBackedLiquidity: number = tokenEffectiveLiquidityUsd(detailToken);
  const fdv = detailToken.fdv ?? pair?.fdv ?? geckoMarket?.fdv ?? 0;
  const marketCap = detailToken.mcap ?? pair?.marketCap ?? geckoMarket?.mcap ?? fdv ?? 0;
  const volume24h = (pair?.volume?.h24 ?? geckoMarket?.volume24h ?? ((detailToken.stats24h?.buyVolume ?? 0) + (detailToken.stats24h?.sellVolume ?? 0)));
  const isLoading = isFetchingPairs || isFetchingToken;

  const { data: classificationReport, isFetching: isFetchingClassification } = useQuery({
    queryKey: ["coin-detail-layered-classification", detailToken.symbol, "v10-dominance-engine"],
    queryFn: () => forensicOgAttribution(detailToken.symbol),
    enabled: open && Boolean(detailToken.symbol),
    staleTime: 30_000,
  });

  const { data: devIntel, isFetching: isFetchingDevIntel } = useQuery({
    queryKey: ["coin-detail-dev-launch-intel", detailToken.chainId ?? "solana", detailToken.id],
    queryFn: (): Promise<TokenDevLaunchIntel> => tokenDevLaunchIntel(detailToken),
    enabled: open && isSolana && Boolean(detailToken.id),
    staleTime: 60_000,
  });

  const { data: bundleIntel, isFetching: isFetchingBundleIntel } = useQuery({
    queryKey: ["coin-detail-holder-bundle-intel", detailToken.chainId ?? "solana", detailToken.id],
    queryFn: (): Promise<TokenHolderBundleIntel> => tokenHolderBundleIntel(detailToken),
    enabled: open && isSolana && Boolean(detailToken.id),
    staleTime: 60_000,
  });

  const { data: evmSecurity, isFetching: isFetchingEvmSecurity } = useQuery({
    queryKey: ["coin-detail-evm-security", chainId, detailToken.id],
    queryFn: () => fetchEvmTokenSecurity(chainId, detailToken.id),
    enabled: open && !isSolana && Boolean(detailToken.id),
    staleTime: 60_000,
  });

  const forensicKey = `${detailToken.chainId ?? "solana"}:${detailToken.id}`;
  const forensicScore = classificationReport?.tokenScores[forensicKey];
  // "SCANNING" only while the fetch is in-flight; show "UNVERIFIED" when done but no score found
  const primaryLabel: string = forensicScore?.classification.primary_label
    ?? (isFetchingClassification ? "SCANNING" : "UNVERIFIED");
  const secondaryLabels: string[] = forensicScore?.classification.secondary_labels.slice(0, 6) ?? [];

  const primaryTone: "lime" | "gold" | "cyan" | "blood" | "muted" = primaryLabel.includes("TRUE OG")
    ? "lime"
    : primaryLabel.includes("REVIVED OFFICIAL")
      ? "cyan"
      : primaryLabel.includes("LEGACY OG") || primaryLabel.includes("MIGR") || primaryLabel.includes("LATER OFFICIAL")
        ? "gold"
        : primaryLabel.includes("CLONE") || primaryLabel.includes("COPY")
          ? "blood"
          : primaryLabel.includes("CONTESTED")
            ? "gold"
            : "cyan";

  const links = useMemo(() => {
    const raw: { label: string; url: string }[] = [];
    raw.push({ label: "DexScreener Chart", url: chartUrl });
    const chainCfg = getChain(chainId);
    raw.push({ label: chainCfg.explorerUrl.replace(/^https?:\/\//, "").split("/")[0], url: explorerAddressUrl(chainId, detailToken.id) });
    if (isSolana) raw.push({ label: "Jupiter", url: `https://jup.ag/swap/SOL-${detailToken.id}` });
    if (detailToken.pumpFun?.sourceUrl) raw.push({ label: "Pump.fun", url: detailToken.pumpFun.sourceUrl });
    for (const website of pair?.info?.websites ?? []) if (website.url) raw.push({ label: website.label ?? linkHost(website.url), url: website.url });
    for (const social of pair?.info?.socials ?? []) if (social.url) raw.push({ label: social.type ?? linkHost(social.url), url: social.url });
    const seen = new Set<string>();
    return raw.filter((item) => item.url && !seen.has(item.url) && seen.add(item.url)).slice(0, 8);
  }, [chartUrl, detailToken.id, pair, chainId, isSolana]);

  const riskAlerts = useMemo(() => buildTokenRiskAlerts(detailToken, forensicScore), [detailToken, forensicScore]);

  const mintAuthOk = detailToken.heliusAuthorities?.mintAuthorityDisabled === true || detailToken.audit?.mintAuthorityDisabled === true;
  const freezeAuthOk = detailToken.heliusAuthorities?.freezeAuthorityDisabled === true || detailToken.audit?.freezeAuthorityDisabled === true;

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); externalOnOpenChange?.(v); }}>
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
      <DialogContent className="max-h-[92vh] w-[calc(100vw-1rem)] max-w-5xl overflow-y-auto border-white/10 bg-[#060d18] p-0 text-foreground shadow-[0_40px_120px_rgba(0,0,0,0.8)] sm:rounded-2xl">
        <DialogHeader className="sr-only">
          <DialogTitle>{detailToken.symbol} token details</DialogTitle>
          <DialogDescription>Token metadata, chart, trades, liquidity, links, and forensic market details.</DialogDescription>
        </DialogHeader>

        {/* ── Hero banner ── */}
        <div className="relative h-32 overflow-hidden sm:h-44">
          {banner ? (
            <img src={banner} alt="" className="h-full w-full object-cover opacity-60" loading="lazy" />
          ) : (
            <div className="h-full w-full bg-[linear-gradient(135deg,#0a1628,#08111f_50%,#06101c)]" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#060d18] via-[#060d18]/70 to-transparent" />

          {/* Status pill top-right */}
          <div className="absolute right-4 top-4 flex items-center gap-2">
            {(isLoading || isFetchingClassification) && (
              <span className="flex items-center gap-1.5 rounded-full border border-white/10 bg-black/40 px-2.5 py-1 font-mono text-[9px] uppercase tracking-widest text-white/50 backdrop-blur">
                <Loader2 className="h-3 w-3 animate-spin" /> syncing
              </span>
            )}
          </div>
        </div>

        {/* ── Token identity strip ── */}
        <div className="relative -mt-10 flex flex-wrap items-end justify-between gap-4 px-5 pb-4 sm:px-6">
          <div className="flex items-end gap-4">
            {/* Avatar */}
            <div className="relative h-[72px] w-[72px] shrink-0 overflow-hidden rounded-2xl border-2 border-[#060d18] ring-1 ring-white/10 sm:h-20 sm:w-20">
              {image
                ? <img src={image} alt={detailToken.symbol} className="h-full w-full object-cover" loading="lazy" />
                : <div className="grid h-full w-full place-items-center bg-[#0e1e33] font-display text-2xl font-black text-og-cyan">{detailToken.symbol?.slice(0, 1) ?? "?"}</div>
              }
            </div>
            <div className="pb-0.5">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-display text-3xl font-black uppercase tracking-tight text-white sm:text-4xl">${detailToken.symbol}</h2>
                {detailToken.isVerified && (
                  <span className="rounded-full border border-og-lime/40 bg-og-lime/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest text-og-lime">✓ Verified</span>
                )}
                {lpPulled && (
                  <span className="rounded-full border border-red-500/40 bg-red-500/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest text-red-400">LP Pulled</span>
                )}
              </div>
              <p className="mt-0.5 text-sm text-white/40">{detailToken.name} · <span className="font-mono text-[11px]">{shortAddr(detailToken.id, 6)}</span></p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-2 pb-1">
            <CopyMintButton
              mint={detailToken.id}
              label="Copy CA"
              copiedLabel="Copied"
              className="rounded-lg border border-white/10 bg-white/[0.06] px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-white/60 transition hover:border-white/25 hover:text-white"
              iconClassName="h-3.5 w-3.5"
            />
            <a
              href={chartUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.06] px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-white/60 transition hover:border-og-cyan/40 hover:text-og-cyan"
            >
              <BarChart3 className="h-3.5 w-3.5" /> Chart
            </a>
            {onOpenScanner ? (
              <button
                type="button"
                onClick={() => onOpenScanner(detailToken.id)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-og-cyan/50 bg-og-cyan/10 px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-widest text-og-cyan transition hover:bg-og-cyan/20"
              >
                <Radar className="h-3.5 w-3.5" /> {actionLabel}
              </button>
            ) : null}
          </div>
        </div>

        {/* ── Key metrics row ── */}
        <div className="mx-5 mb-5 grid grid-cols-2 gap-2 sm:mx-6 sm:grid-cols-4 lg:grid-cols-6">
          <MetricTile
            label="Price"
            value={fmtUsd(detailToken.usdPrice ?? (pair?.priceUsd ? Number(pair.priceUsd) : undefined) ?? geckoMarket?.price)}
            badge={<PctBadge value={change24} />}
          />
          <MetricTile
            label="Market Cap"
            value={fmtUsd(marketCap || undefined)}
          />
          <MetricTile
            label="FDV"
            value={fmtUsd(fdv || undefined)}
          />
          <MetricTile
            label="Liquidity"
            value={fmtUsd(quoteBackedLiquidity || undefined)}
            badge={lpPulled ? <span className="rounded px-1 py-0.5 font-mono text-[8px] bg-red-500/20 text-red-400">PULLED</span> : undefined}
          />
          <MetricTile
            label="Volume 24h"
            value={fmtUsd(volume24h || undefined)}
          />
          <MetricTile
            label="Holders"
            value={fmtHolderCount(detailToken.holderCount)}
          />
        </div>

        {/* ── Divider ── */}
        <div className="mx-5 border-t border-white/[0.06] sm:mx-6" />

        {/* ── Content grid ── */}
        <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[minmax(0,1.4fr)_280px]">

          {/* LEFT COLUMN */}
          <div className="grid gap-5">

            {/* Live Chart — FIRST (pump.fun style: chart at top) */}
            <Section title="Live Chart" icon={<BarChart3 className="h-3.5 w-3.5" />} accent="cyan"
              badge={
                <a href={chartUrl} target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-1 font-mono text-[9px] uppercase tracking-widest text-white/50 transition hover:border-og-cyan/40 hover:text-og-cyan">
                  Full chart <ExternalLink className="h-2.5 w-2.5" />
                </a>
              }>
              <div className="relative h-[340px] overflow-hidden rounded-xl border border-white/[0.07] bg-[#030b18] sm:h-[420px]">
                <iframe
                  src={chartEmbedUrl}
                  title={`${detailToken.symbol} chart`}
                  className="h-full w-full border-0"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </div>
            </Section>

            {/* OG Classification */}
            <Section title="OG Classification" icon={<Sparkles className="h-3.5 w-3.5" />} accent="cyan" badge={
              isFetchingClassification
                ? <Loader2 className="h-3.5 w-3.5 animate-spin text-white/30" />
                : <ClassBadge label={primaryLabel} tone={primaryTone} />
            }>
              <div className="grid gap-3 sm:grid-cols-3">
                <DataRow label="Origin identity" value={forensicScore?.classification.layers.origin_identity ?? "—"} />
                <DataRow label="Control status" value={forensicScore?.classification.layers.control_status ?? "—"} />
                <DataRow label="Lifecycle" value={forensicScore?.classification.layers.lifecycle_status ?? "—"} />
                <DataRow label="Dominance score" value={forensicScore ? `${forensicScore.dominanceScore}%  ·  rank #${forensicScore.dominanceRank}` : "—"} />
                <DataRow label="Origin score" value={forensicScore ? `${forensicScore.originScore}%` : "—"} />
                <DataRow label="Clone score" value={forensicScore ? `${forensicScore.cloneScore}%` : "—"} />
                <DataRow label="First mint" value={proofTimestampText(createdAt) ?? (migratedAt ? `~${shortDate(migratedAt)} (migration)` : undefined)} />
                <DataRow label="Mint source" value={detailToken.firstMintSource ?? detailToken.creationSource ?? (detailToken.pumpFun?.isPumpFun ? "pump.fun" : detailToken.migrationCreatedAt ? "migrated" : "—")} />
                <DataRow label="Mint authority" value={shortAddr(detailToken.firstMintAuthorityWallet ?? detailToken.creatorFunding?.creatorWallet ?? detailToken.pumpFun?.creator, 5)} />
              </div>
              {secondaryLabels.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {secondaryLabels.map((lbl) => (
                    <span key={lbl} className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 font-mono text-[9px] uppercase tracking-widest text-white/50">{lbl}</span>
                  ))}
                </div>
              )}
              {forensicScore?.classification.reasoning_summary && (
                <p className="mt-3 text-xs leading-relaxed text-white/40">{forensicScore.classification.reasoning_summary}</p>
              )}
            </Section>

            {/* Trade Activity */}
            <Section title="Trade Activity" icon={<Activity className="h-3.5 w-3.5" />} accent="lime">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <TradeTile label="Buys 24h" value={fmtNum(buys24 || detailToken.stats24h?.numBuys)} tone="lime" />
                <TradeTile label="Sells 24h" value={fmtNum(sells24 || detailToken.stats24h?.numSells)} tone="red" />
                <TradeTile label="Buy vol" value={fmtUsd(detailToken.stats24h?.buyVolume)} tone="lime" />
                <TradeTile label="Sell vol" value={fmtUsd(detailToken.stats24h?.sellVolume)} tone="red" />
              </div>
              {/* Buy/sell bar */}
              <div className="mt-3">
                <div className="mb-1.5 flex justify-between font-mono text-[10px] uppercase tracking-widest text-white/40">
                  <span>Buy pressure</span>
                  <span className={buyPct >= 50 ? "text-og-lime" : "text-red-400"}>{total24 > 0 ? `${buyPct}%` : "—"}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-red-500/20">
                  <div className="h-full rounded-full bg-og-lime transition-all" style={{ width: `${buyPct}%` }} />
                </div>
              </div>
              {/* 5m / 1h tape */}
              <div className="mt-3 grid grid-cols-2 gap-2">
                {(["m5", "h1"] as const).map((w) => {
                  const tx = getPairTxns(pair, w);
                  return (
                    <div key={w} className="flex items-center justify-between rounded-lg border border-white/[0.07] bg-white/[0.03] px-3 py-2 font-mono text-[10px] uppercase tracking-widest">
                      <span className="text-white/40">{w === "m5" ? "5 min" : "1 hour"}</span>
                      <span>
                        <span className="text-og-lime">B {fmtNum(tx.buys)}</span>
                        <span className="mx-1.5 text-white/20">/</span>
                        <span className="text-red-400">S {fmtNum(tx.sells)}</span>
                      </span>
                    </div>
                  );
                })}
              </div>
              {/* Price changes */}
              <div className="mt-2 grid grid-cols-3 gap-2">
                {([["5m", change5m], ["1h", change1h], ["24h", change24]] as [string, number][]).map(([lbl, val]) => (
                  <div key={lbl} className="flex items-center justify-between rounded-lg border border-white/[0.07] bg-white/[0.03] px-3 py-2 font-mono text-[10px] uppercase tracking-widest">
                    <span className="text-white/40">{lbl}</span>
                    <PctBadge value={val} />
                  </div>
                ))}
              </div>
            </Section>

            {/* Intelligence panels grid */}
            <div className="grid gap-5 xl:grid-cols-2">
              {isSolana && <DevLaunchPanel intel={devIntel} isLoading={isFetchingDevIntel} primaryLabel={primaryLabel} creatorFunding={detailToken.creatorFunding} pumpFun={detailToken.pumpFun} />}
              {isSolana && <HolderBundlePanel intel={bundleIntel} isLoading={isFetchingBundleIntel} token={detailToken} />}
              {isSolana && <OnChainIntelPanel token={detailToken} />}
              {isSolana && <PumpFunPanel pumpFun={detailToken.pumpFun} createdAt={createdAt} migratedAt={migratedAt} />}
              {!isSolana && <EvmContractSecurityPanel security={evmSecurity} isLoading={isFetchingEvmSecurity} />}
              {!isSolana && <EvmHolderPanel security={evmSecurity} isLoading={isFetchingEvmSecurity} />}
              {!isSolana && <EvmTradingSecurityPanel security={evmSecurity} isLoading={isFetchingEvmSecurity} />}
              {!isSolana && <EvmChainInfoPanel token={detailToken} chainId={chainId} security={evmSecurity} />}
            </div>

            {/* DEX pools — synthesize from pair data when allPools[] is empty but a pair is known */}
            <DexPoolsPanel pools={(() => {
              const existing = detailToken.allPools ?? [];
              if (existing.length > 0) return existing;
              // Build a synthetic pool entry from the token's known pair data
              if (detailToken.pairAddress || detailToken.dexUrl) {
                return [{
                  dexId: detailToken.pairDexId ?? "dex",
                  pairAddress: detailToken.pairAddress,
                  url: detailToken.dexUrl,
                  quoteSymbol: "SOL",
                  liquidityUsd: detailToken.reportedLiquidity ?? detailToken.liquidity,
                  effectiveLiquidityUsd: detailToken.effectiveLiquidityUsd ?? detailToken.liquidity,
                  quoteLiquidityUsd: detailToken.quoteLiquidityUsd,
                  marketCap: detailToken.mcap,
                  fdv: detailToken.fdv,
                  volume24h: detailToken.stats24h?.buyVolume != null && detailToken.stats24h?.sellVolume != null
                    ? detailToken.stats24h.buyVolume + detailToken.stats24h.sellVolume : undefined,
                  buys24h: detailToken.stats24h?.numBuys,
                  sells24h: detailToken.stats24h?.numSells,
                  createdAt: detailToken.migrationCreatedAt ?? detailToken.firstPool?.createdAt,
                }];
              }
              return [];
            })()} />

            {/* Risk alerts */}
            <TokenRiskAlerts alerts={riskAlerts} title="Risk Flags" />
          </div>

          {/* RIGHT SIDEBAR */}
          <aside className="grid content-start gap-4">

            {/* Trade quick-links (pump.fun style: trade actions at top of sidebar) */}
            <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-4">
              <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-og-gold mb-3 flex items-center gap-2">
                <CandlestickChart className="h-3.5 w-3.5" /> Trade
              </div>
              <div className="grid grid-cols-2 gap-2 mb-3">
                <a
                  href={isSolana ? `https://jup.ag/swap/SOL-${detailToken.id}` : (pair?.url ?? chartUrl)}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center gap-1.5 rounded-lg bg-og-lime/15 border border-og-lime/30 px-3 py-2.5 font-mono text-[10px] font-bold uppercase tracking-widest text-og-lime transition hover:bg-og-lime/25"
                >
                  Buy ↑
                </a>
                <a
                  href={isSolana ? `https://jup.ag/swap/${detailToken.id}-SOL` : (pair?.url ?? chartUrl)}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center gap-1.5 rounded-lg bg-red-500/10 border border-red-500/25 px-3 py-2.5 font-mono text-[10px] font-bold uppercase tracking-widest text-red-400 transition hover:bg-red-500/20"
                >
                  Sell ↓
                </a>
              </div>
              <a
                href={chartUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-1.5 w-full rounded-lg border border-white/10 bg-white/[0.04] py-2 font-mono text-[10px] uppercase tracking-widest text-white/50 transition hover:border-og-cyan/40 hover:text-og-cyan"
              >
                <BarChart3 className="h-3 w-3" /> Full chart on DexScreener
              </a>
            </div>

            {/* CoinCommunities — full pump.fun-style community section */}
            <div className="rounded-xl overflow-hidden border border-white/[0.07] bg-[#080f1a]" style={{ height: 480 }}>
              <CoinCommunityFull
                tokenAddress={detailToken.id}
                tokenSymbol={detailToken.symbol ?? "—"}
                tokenName={detailToken.name}
                tokenImageUrl={detailToken.logoURI}
                marketCap={marketCap || undefined}
                priceChange={change24 || undefined}
                description={detailToken.description}
                embedded
              />
            </div>

            {/* Market data */}
            <SidePanel title="Market Data" icon={<CandlestickChart className="h-3.5 w-3.5" />} accent="gold">
              <DataRow label="Price" value={fmtUsd(detailToken.usdPrice ?? (pair?.priceUsd ? Number(pair.priceUsd) : undefined))} />
              <DataRow label="Market Cap" value={fmtUsd(marketCap || undefined)} />
              <DataRow label="FDV" value={fmtUsd(fdv || undefined)} />
              <DataRow label="Volume 24h" value={fmtUsd(volume24h || undefined)} />
              <DataRow label="Liquidity" value={fmtUsd(quoteBackedLiquidity || undefined)} />
              <DataRow label="Reported LP" value={fmtUsd(detailToken.reportedLiquidity ?? pair?.liquidity?.usd)} />
              <DataRow label="LP status" value={lpPulled ? "Pulled / dead" : "Quote-backed"} highlight={lpPulled ? "red" : "lime"} />
              <DataRow label="ATH price" value={marketExtremeLine(detailToken.allTimeHighUsd, detailToken.allTimeHighAt)} />
              <DataRow label="ATL price" value={marketExtremeLine(detailToken.allTimeLowUsd, detailToken.allTimeLowAt)} />
              <DataRow label="ATH MC" value={marketExtremeLine(detailToken.allTimeHighMarketCap, detailToken.allTimeHighMarketCapAt)} />
            </SidePanel>

            {/* Safety audit */}
            <SidePanel title="Safety Audit" icon={<ShieldCheck className="h-3.5 w-3.5" />} accent="lime">
              <AuditRow label="Mint authority" ok={mintAuthOk} good="Disabled" bad={shortAddr(detailToken.heliusAuthorities?.mintAuthority ?? undefined, 4) || "Open"} />
              <AuditRow label="Freeze authority" ok={freezeAuthOk} good="Disabled" bad={shortAddr(detailToken.heliusAuthorities?.freezeAuthority ?? undefined, 4) || "Open"} />
              <AuditRow label="Verified" ok={detailToken.isVerified === true} good="Verified" bad="Unverified" />
              <DataRow label="Top 10 holders" value={detailToken.topHoldersPercent != null ? `${detailToken.topHoldersPercent.toFixed(1)}%` : detailToken.audit?.topHoldersPercentage != null ? `${detailToken.audit.topHoldersPercentage.toFixed(1)}%` : "—"} />
              <DataRow label="Whale wallets" value={fmtWhaleCount(detailToken.whaleCount)} />
              <DataRow label="Organic score" value={detailToken.organicScore != null ? `${detailToken.organicScore.toFixed(0)} · ${detailToken.organicScoreLabel ?? ""}` : "—"} />
              <DataRow label="Dominance" value={forensicScore ? `${forensicScore.dominanceScore}%  ·  #${forensicScore.dominanceRank}` : "—"} />
              <DataRow label="Official score" value={forensicScore ? `${forensicScore.officialVerificationScore}%` : "—"} />
            </SidePanel>

            {/* Token metadata */}
            <SidePanel title="Token Metadata" icon={<Sparkles className="h-3.5 w-3.5" />} accent="cyan">
              <DataRow label="Chain" value={chainId} />
              <DataRow label="Contract" value={shortAddr(detailToken.id, 7)} />
              <DataRow label="Decimals" value={String(detailToken.decimals ?? "—")} />
              <DataRow label="DEX" value={pair?.dexId ?? detailToken.pairDexId ?? "—"} />
              <DataRow label="Pools" value={fmtNum(detailToken.poolCount ?? detailToken.allPools?.length)} />
              <DataRow label="Pair" value={shortAddr(pair?.pairAddress ?? detailToken.pairAddress, 5)} />
              <DataRow label="On-chain mint" value={createdAt ? `${shortDate(createdAt)} · ${timeAgo(Math.floor(new Date(createdAt).getTime() / 1000))} ago` : "—"} />
              <DataRow label="Migration" value={shortDate(migratedAt)} />
              <DataRow label="Quote token" value={pair?.quoteToken?.symbol ? `${pair.quoteToken.symbol} · ${pair.dexId ?? "DEX"}` : "—"} />
            </SidePanel>

            {/* DEX paid */}
            <DexPaidPanel token={detailToken} pair={pair} />

            {/* Links */}
            <SidePanel title="Links" icon={<Globe className="h-3.5 w-3.5" />} accent="cyan">
              <div className="grid gap-1.5">
                {links.map((link) => (
                  <a key={link.url} href={link.url} target="_blank" rel="noreferrer"
                    className="flex items-center justify-between gap-2 rounded-lg border border-white/[0.07] bg-white/[0.03] px-3 py-2 text-sm text-white/60 transition hover:border-og-cyan/30 hover:text-og-cyan">
                    <span className="truncate capitalize">{link.label || linkHost(link.url)}</span>
                    <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-50" />
                  </a>
                ))}
              </div>
            </SidePanel>
          </aside>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const Section = ({
  title,
  icon,
  accent = "cyan",
  badge,
  children,
}: {
  title: string;
  icon: ReactNode;
  accent?: "cyan" | "lime" | "gold";
  badge?: ReactNode;
  children: ReactNode;
}) => {
  const accentClass = accent === "lime" ? "text-og-lime" : accent === "gold" ? "text-og-gold" : "text-og-cyan";
  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className={cn("flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.28em]", accentClass)}>
          {icon} {title}
        </div>
        {badge && <div className="flex items-center">{badge}</div>}
      </div>
      {children}
    </div>
  );
};

const SidePanel = ({
  title,
  icon,
  accent = "cyan",
  children,
}: {
  title: string;
  icon: ReactNode;
  accent?: "cyan" | "lime" | "gold";
  children: ReactNode;
}) => {
  const accentClass = accent === "lime" ? "text-og-lime" : accent === "gold" ? "text-og-gold" : "text-og-cyan";
  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-4">
      <div className={cn("mb-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.28em]", accentClass)}>
        {icon} {title}
      </div>
      <div className="grid gap-1.5">{children}</div>
    </div>
  );
};

const DataRow = ({ label, value, highlight }: { label: string; value: string | undefined; highlight?: "lime" | "red" }) => (
  <div className="flex items-center justify-between gap-3 rounded-lg border border-white/[0.05] bg-white/[0.025] px-3 py-2 font-mono text-[10px] uppercase tracking-widest">
    <span className="shrink-0 text-white/35"><HelpLabel label={label} /></span>
    <span className={cn(
      "min-w-0 truncate text-right",
      highlight === "lime" ? "text-og-lime" : highlight === "red" ? "text-red-400" : "text-white/70"
    )}>{value ?? "—"}</span>
  </div>
);

const AuditRow = ({ label, ok, good, bad }: { label: string; ok: boolean; good: string; bad: string }) => (
  <div className="flex items-center justify-between gap-3 rounded-lg border border-white/[0.05] bg-white/[0.025] px-3 py-2 font-mono text-[10px] uppercase tracking-widest">
    <span className="shrink-0 text-white/35"><HelpLabel label={label} /></span>
    <span className={cn("flex items-center gap-1", ok ? "text-og-lime" : "text-red-400")}>
      {ok ? <ShieldCheck className="h-3 w-3" /> : <ShieldAlert className="h-3 w-3" />}
      {ok ? good : bad}
    </span>
  </div>
);

const MetricTile = ({ label, value, badge }: { label: string; value: string | undefined; badge?: ReactNode }) => (
  <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] px-4 py-3">
    <div className="mb-1 font-mono text-[9px] uppercase tracking-[0.28em] text-white/35">{label}</div>
    <div className="flex items-center gap-2">
      <span className="font-display text-lg font-bold text-white">{value ?? "—"}</span>
      {badge}
    </div>
  </div>
);

const TradeTile = ({ label, value, tone }: { label: string; value: string; tone: "lime" | "red" }) => (
  <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 py-3">
    <div className="mb-1 font-mono text-[9px] uppercase tracking-widest text-white/35">{label}</div>
    <div className={cn("font-display text-xl font-bold", tone === "lime" ? "text-og-lime" : "text-red-400")}>{value}</div>
  </div>
);

const PctBadge = ({ value }: { value: number }) => {
  const up = value >= 0;
  return (
    <span className={cn("inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 font-mono text-[9px] font-bold", up ? "bg-og-lime/10 text-og-lime" : "bg-red-500/10 text-red-400")}>
      {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      {fmtPct(value)}
    </span>
  );
};

const ClassBadge = ({ label, tone }: { label: string; tone: "lime" | "gold" | "cyan" | "blood" | "muted" }) => {
  const cls = tone === "lime" ? "border-og-lime/40 bg-og-lime/10 text-og-lime"
    : tone === "gold" ? "border-og-gold/40 bg-og-gold/10 text-og-gold"
    : tone === "blood" ? "border-red-500/40 bg-red-500/10 text-red-400"
    : tone === "muted" ? "border-white/10 bg-white/[0.04] text-white/40"
    : "border-og-cyan/40 bg-og-cyan/10 text-og-cyan";
  return (
    <span className={cn("rounded-full border px-2.5 py-1 font-mono text-[9px] uppercase tracking-widest", cls)}>{label}</span>
  );
};

const DexPaidPanel = ({ token, pair }: { token: JupTokenInfo; pair?: DetailDexPair }) => {
  const activeBoosts = token.dexBoostActive ?? pair?.boosts?.active ?? 0;
  const boostPaid = token.dexBoostTotalAmount ?? token.dexPaidAmount ?? token.dexBoostAmount;
  const hasDexSignal = tokenDexPaidLabel(token) !== "—" || activeBoosts > 0;

  return (
    <SidePanel title="DEX Paid & Boosts" icon={<BadgeDollarSign className="h-3.5 w-3.5" />} accent="gold">
      <DataRow label="Status" value={tokenDexPaidLabel(token)} highlight={hasDexSignal ? "lime" : undefined} />
      <DataRow label="Active boosts" value={fmtNum(activeBoosts)} />
      <DataRow label="Total paid" value={boostPaid != null ? fmtNum(boostPaid) : "—"} />
      <DataRow label="Orders" value={`${fmtNum(token.dexApprovedOrderCount ?? 0)} approved`} />
      <DataRow label="First paid" value={shortDate(token.dexFirstPaidAt)} />
      <DataRow label="Last paid" value={shortDate(token.dexLastPaidAt)} />
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        <DexFlag active={token.dexProfilePaid === true} label="Profile" />
        <DexFlag active={token.dexCommunityTakeoverPaid === true} label="CTO" />
        <DexFlag active={token.dexAdsPaid === true} label="Ads" />
        <DexFlag active={activeBoosts > 0} label="Boost" />
      </div>
    </SidePanel>
  );
};

const DexFlag = ({ active, label }: { active: boolean; label: string }) => (
  <span className={cn(
    "rounded-full border px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest",
    active ? "border-og-lime/35 bg-og-lime/10 text-og-lime" : "border-white/[0.07] text-white/25"
  )}>{label}</span>
);

const DevLaunchPanel = ({ intel, isLoading, primaryLabel, creatorFunding, pumpFun }: {
  intel?: TokenDevLaunchIntel;
  isLoading: boolean;
  primaryLabel: string;
  creatorFunding?: TokenCreatorFundingIntel;
  pumpFun?: TokenPumpFunIntel;
}) => {
  const isCto = intel?.launchType === "CTO / community support" || primaryLabel.includes("CTO");
  return (
    <Section title="Dev / Launch Intel" icon={<Wallet className="h-3.5 w-3.5" />} accent="cyan"
      badge={isLoading
        ? <Loader2 className="h-3.5 w-3.5 animate-spin text-white/30" />
        : <span className={cn("rounded-full border px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest", isCto ? "border-og-gold/40 bg-og-gold/10 text-og-gold" : "border-white/10 text-white/40")}>{intel?.launchType ?? "scanning"}</span>
      }>
      <div className="grid gap-1.5">
        <DataRow label="Creator" value={shortAddr(pumpFun?.creator ?? creatorFunding?.creatorWallet ?? intel?.wallet ?? undefined, 6)} />
        <DataRow label="Funding wallet" value={shortAddr(creatorFunding?.fundingWallet ?? undefined, 6)} />
        <DataRow label="Confidence" value={creatorFunding?.confidence ?? intel?.confidence ?? "—"} />
        <DataRow label="Recent mints" value={fmtNum(intel?.recentTokenMints)} />
        <DataRow label="Bonded coins" value={fmtNum(intel?.bondedCoinCount)} />
        <DataRow label="DEX-paid coins" value={fmtNum(intel?.dexPaidCoinCount)} />
        <DataRow label="Dev risk" value={intel?.devRiskLabel ? `${intel.devRiskLabel} · risk ${fmtNum(intel.rugRiskScore)}` : "—"} highlight={intel?.devRiskLabel === "severe" || intel?.devRiskLabel === "high" ? "red" : undefined} />
        <DataRow label="Rug pulls" value={fmtNum(intel?.ruggedCoinCount)} highlight={(intel?.ruggedCoinCount ?? 0) > 0 ? "red" : "lime"} />
        <DataRow label="LP pulls" value={fmtNum(intel?.lpPullCount)} highlight={(intel?.lpPullCount ?? 0) > 0 ? "red" : "lime"} />
        <DataRow label="Dead coins" value={fmtNum(intel?.deadCoinCount)} />
        <DataRow label="Low LP coins" value={fmtNum(intel?.lowLiquidityCoinCount)} highlight={(intel?.lowLiquidityCoinCount ?? 0) > 3 ? "gold" : undefined} />
      </div>
      {(intel?.riskNotes?.[0] ?? intel?.notes?.[0]) && (
        <p className="mt-3 text-xs leading-relaxed text-white/35">{intel?.riskNotes?.[0] ?? intel?.notes?.[0]}</p>
      )}
    </Section>
  );
};

const HolderBundlePanel = ({ intel, isLoading, token }: { intel?: TokenHolderBundleIntel; isLoading: boolean; token: JupTokenInfo }) => {
  const fallbackTop: number = token.audit?.topHoldersPercentage ?? 0;
  const status: string = intel?.status ?? "scanning";
  const tone = status === "Likely bundled" ? "red" : status === "Bundle watch" ? "gold" : "lime";
  const toneClass = tone === "red" ? "border-red-500/40 bg-red-500/10 text-red-400" : tone === "gold" ? "border-og-gold/40 bg-og-gold/10 text-og-gold" : "border-og-lime/35 bg-og-lime/10 text-og-lime";

  return (
    <Section title="Bundle Tracking" icon={<ShieldAlert className="h-3.5 w-3.5" />} accent="gold"
      badge={isLoading
        ? <Loader2 className="h-3.5 w-3.5 animate-spin text-white/30" />
        : <span className={cn("rounded-full border px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest", toneClass)}>{status}</span>
      }>
      <div className="grid gap-1.5">
        <DataRow label="Bundle score" value={intel ? `${fmtNum(intel.score)}/100  ·  ${intel.confidence}` : "—"} />
        <DataRow label="Bundle count" value={fmtNum(intel?.bundleCount)} />
        <DataRow label="Top holder" value={intel ? `${intel.topHolderPercent.toFixed(1)}%` : fallbackTop ? `${fallbackTop.toFixed(1)}%` : "—"} />
        <DataRow label="Top 10" value={intel ? `${intel.top10Percent.toFixed(1)}%` : "—"} />
      </div>
      {(intel?.suspectedBundlers ?? []).length > 0 && (
        <div className="mt-3 grid gap-1.5">
          {(intel?.suspectedBundlers ?? []).slice(0, 3).map((holder) => (
            <div key={`${holder.owner}-${holder.tokenAccount}`}
              className="flex items-center justify-between gap-2 rounded-lg border border-white/[0.07] bg-white/[0.025] px-3 py-2 font-mono text-[9px] uppercase tracking-widest">
              <span className="truncate text-white/35">{holder.label}</span>
              <span className="shrink-0 text-og-gold">{shortAddr(holder.owner, 4)} · {holder.percent.toFixed(1)}%</span>
            </div>
          ))}
        </div>
      )}
    </Section>
  );
};

const OnChainIntelPanel = ({ token }: { token: JupTokenInfo }) => {
  const authority = token.heliusAuthorities;
  const creator = token.creatorFunding;
  const topHolders = token.topHolders ?? [];
  // A brand-new token may not yet be indexed by Helius — show INDEXING badge instead of silently showing dashes
  const isNewToken = !!(token.migrationCreatedAt ?? token.pumpFun?.migrationAt ?? token.pumpFun?.launchAt);
  const badgeLabel = authority?.source ?? creator?.source ?? (isNewToken && !authority ? "indexing" : "Helius");

  return (
    <Section title="On-Chain Truth" icon={<ShieldCheck className="h-3.5 w-3.5" />} accent="lime"
      badge={<span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest text-white/35">{badgeLabel}</span>}>
      <div className="grid gap-1.5">
        <DataRow label="Mint authority" value={authority ? authority.mintAuthorityDisabled ? "Disabled" : shortAddr(authority.mintAuthority ?? undefined, 5) : token.audit?.mintAuthorityDisabled ? "Disabled" : "—"} highlight={authority?.mintAuthorityDisabled ? "lime" : "red"} />
        <DataRow label="Freeze authority" value={authority ? authority.freezeAuthorityDisabled ? "Disabled" : shortAddr(authority.freezeAuthority ?? undefined, 5) : token.audit?.freezeAuthorityDisabled ? "Disabled" : "—"} highlight={authority?.freezeAuthorityDisabled ? "lime" : "red"} />
        <DataRow label="Creator" value={shortAddr(creator?.creatorWallet ?? token.pumpFun?.creator, 6)} />
        <DataRow label="Funding tx" value={shortAddr(creator?.fundingWallet ?? undefined, 6)} />
        <DataRow label="Whale wallets" value={fmtWhaleCount(token.whaleCount)} />
      </div>
      {topHolders.length > 0 && (
        <div className="mt-3 grid gap-1.5">
          {topHolders.slice(0, 3).map((holder) => (
            <div key={`${holder.owner}-${holder.tokenAccount}`}
              className="flex items-center justify-between gap-2 rounded-lg border border-white/[0.07] bg-white/[0.025] px-3 py-2 font-mono text-[9px] uppercase tracking-widest">
              <span className="truncate text-white/35">{holder.label}</span>
              <span className="shrink-0 text-og-lime">{shortAddr(holder.owner, 4)} · {holder.percent.toFixed(1)}%</span>
            </div>
          ))}
        </div>
      )}
    </Section>
  );
};

const PumpFunPanel = ({ pumpFun, createdAt, migratedAt }: { pumpFun?: TokenPumpFunIntel; createdAt?: string; migratedAt?: string }) => (
  <Section title="Pump.fun Migration" icon={<Zap className="h-3.5 w-3.5" />} accent="cyan"
    badge={
      <span className={cn("rounded-full border px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest", pumpFun?.isPumpFun ? "border-og-cyan/40 bg-og-cyan/10 text-og-cyan" : "border-white/10 text-white/25")}>
        {pumpFun?.isPumpFun ? "Pump tracked" : "No signal"}
      </span>
    }>
    <div className="grid gap-1.5">
      <DataRow label="Creator" value={shortAddr(pumpFun?.creator, 6)} />
      <DataRow label="Bonding curve" value={shortAddr(pumpFun?.bondingCurve ?? pumpFun?.associatedBondingCurve, 5)} />
      <DataRow label="Launch date" value={shortDate(pumpFun?.launchAt ?? createdAt)} />
      <DataRow label="Migration date" value={shortDate(pumpFun?.migrationAt ?? migratedAt)} />
      <DataRow label="Migration time" value={pumpFun?.migrationDurationHours != null ? `${pumpFun.migrationDurationHours}h` : "—"} />
      <DataRow label="Status" value={pumpFun?.complete === true ? "Complete / migrated" : pumpFun?.complete === false ? "Still bonding" : "—"} />
    </div>
  </Section>
);

// ─── EVM Intelligence Panels ──────────────────────────────────────────────────

const EvmSecurityFlag = ({ ok, label }: { ok: boolean; label: string }) => (
  <span className={cn("rounded-full border px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest", ok ? "border-og-lime/35 bg-og-lime/10 text-og-lime" : "border-red-500/35 bg-red-500/10 text-red-400")}>{label}</span>
);

const EvmContractSecurityPanel = ({ security, isLoading }: { security?: EvmTokenSecurity | null; isLoading: boolean }) => {
  const verified = security?.isOpenSource === true;
  const safe = verified && !security?.isMintable && !security?.canSelfDestruct && !security?.hiddenOwner && !security?.canTakeBackOwnership;
  return (
    <Section title="Contract Security" icon={<ShieldCheck className="h-3.5 w-3.5" />} accent="lime"
      badge={isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin text-white/30" /> : <span className={cn("rounded-full border px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest", safe ? "border-og-lime/40 bg-og-lime/10 text-og-lime" : security ? "border-red-500/40 bg-red-500/10 text-red-400" : "border-white/10 text-white/40")}>{safe ? "Safe" : security ? "Risks found" : "Scanning"}</span>}>
      <div className="grid gap-1.5">
        <DataRow label="Source verified" value={security ? (verified ? "Yes ✓" : "No ✗") : "—"} highlight={verified ? "lime" : "red"} />
        <DataRow label="Proxy contract" value={security ? (security.isProxy ? "Yes ⚠" : "No ✓") : "—"} highlight={security?.isProxy ? "red" : "lime"} />
        <DataRow label="Mintable" value={security ? (security.isMintable ? "Yes ⚠" : "No ✓") : "—"} highlight={security?.isMintable ? "red" : "lime"} />
        <DataRow label="Self-destruct" value={security ? (security.canSelfDestruct ? "Yes ⚠" : "No ✓") : "—"} highlight={security?.canSelfDestruct ? "red" : "lime"} />
        <DataRow label="Hidden owner" value={security ? (security.hiddenOwner ? "Yes ⚠" : "No ✓") : "—"} highlight={security?.hiddenOwner ? "red" : "lime"} />
        <DataRow label="Can reclaim ownership" value={security ? (security.canTakeBackOwnership ? "Yes ⚠" : "No ✓") : "—"} highlight={security?.canTakeBackOwnership ? "red" : "lime"} />
      </div>
      {security && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          <EvmSecurityFlag ok={verified} label="Verified" />
          <EvmSecurityFlag ok={!security.isMintable} label="Not mintable" />
          <EvmSecurityFlag ok={!security.isProxy} label="Not proxy" />
          <EvmSecurityFlag ok={!security.canSelfDestruct} label="No destruct" />
        </div>
      )}
    </Section>
  );
};

const EvmTradingSecurityPanel = ({ security, isLoading }: { security?: EvmTokenSecurity | null; isLoading: boolean }) => {
  const honeypot = security?.isHoneypot === true;
  const hasTax = (security?.buyTax && parseFloat(security.buyTax) > 0) || (security?.sellTax && parseFloat(security.sellTax) > 0);
  const safe = security && !honeypot && !hasTax && !security.cannotBuy && !security.transferPausable && !security.slippageModifiable;
  return (
    <Section title="Trading Safety" icon={<ShieldAlert className="h-3.5 w-3.5" />} accent="gold"
      badge={isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin text-white/30" /> : <span className={cn("rounded-full border px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest", honeypot ? "border-red-500/40 bg-red-500/10 text-red-400" : safe ? "border-og-lime/40 bg-og-lime/10 text-og-lime" : "border-og-gold/40 bg-og-gold/10 text-og-gold")}>{honeypot ? "HONEYPOT ⚠" : safe ? "Safe" : security ? "Caution" : "Scanning"}</span>}>
      <div className="grid gap-1.5">
        <DataRow label="Honeypot" value={security ? (honeypot ? "YES ⚠" : "No ✓") : "—"} highlight={honeypot ? "red" : "lime"} />
        {honeypot && security?.honeypotReason && <DataRow label="Reason" value={security.honeypotReason} highlight="red" />}
        {honeypot && security?.honeypotRiskLevel != null && <DataRow label="Risk level" value={`${security.honeypotRiskLevel}/100`} highlight="red" />}
        <DataRow label="Buy tax" value={security?.buyTax ? `${(parseFloat(security.buyTax) * 100).toFixed(1)}%` : "—"} highlight={security?.buyTax && parseFloat(security.buyTax) > 0.05 ? "red" : undefined} />
        <DataRow label="Sell tax" value={security?.sellTax ? `${(parseFloat(security.sellTax) * 100).toFixed(1)}%` : "—"} highlight={security?.sellTax && parseFloat(security.sellTax) > 0.05 ? "red" : undefined} />
        <DataRow label="Cannot buy" value={security ? (security.cannotBuy ? "Yes ⚠" : "No ✓") : "—"} highlight={security?.cannotBuy ? "red" : "lime"} />
        <DataRow label="Transfer pausable" value={security ? (security.transferPausable ? "Yes ⚠" : "No ✓") : "—"} highlight={security?.transferPausable ? "red" : "lime"} />
        <DataRow label="Slippage modifiable" value={security ? (security.slippageModifiable ? "Yes ⚠" : "No ✓") : "—"} highlight={security?.slippageModifiable ? "red" : "lime"} />
        <DataRow label="Blacklist" value={security ? (security.isBlacklisted ? "Yes ⚠" : "No") : "—"} highlight={security?.isBlacklisted ? "red" : undefined} />
        <DataRow label="Trading cooldown" value={security ? (security.tradingCooldown ? "Yes" : "No") : "—"} />
      </div>
    </Section>
  );
};

const EvmHolderPanel = ({ security, isLoading }: { security?: EvmTokenSecurity | null; isLoading: boolean }) => (
  <Section title="Holder Analysis" icon={<ShieldAlert className="h-3.5 w-3.5" />} accent="gold"
    badge={isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin text-white/30" /> : <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest text-white/35">{security ? fmtNum(security.holderCount) + " holders" : "Scanning"}</span>}>
    <div className="grid gap-1.5">
      <DataRow label="Holders" value={security ? fmtNum(security.holderCount) : "—"} />
      <DataRow label="Top holder" value={security ? `${security.topHolderPercent.toFixed(1)}%` : "—"} highlight={security && security.topHolderPercent > 20 ? "red" : security && security.topHolderPercent > 10 ? "gold" : undefined} />
      <DataRow label="Top 10" value={security ? `${security.top10Percent.toFixed(1)}%` : "—"} highlight={security && security.top10Percent > 50 ? "red" : security && security.top10Percent > 30 ? "gold" : undefined} />
      <DataRow label="Creator" value={shortAddr(security?.creatorAddress ?? undefined, 6)} />
      <DataRow label="Creator %" value={security ? `${security.creatorPercent.toFixed(2)}%` : "—"} />
      <DataRow label="Owner" value={shortAddr(security?.ownerAddress ?? undefined, 6)} />
      <DataRow label="Owner %" value={security ? `${security.ownerPercent.toFixed(2)}%` : "—"} />
    </div>
    {(security?.topHolders ?? []).length > 0 && (
      <div className="mt-3 grid gap-1.5">
        {(security?.topHolders ?? []).slice(0, 5).map((holder) => (
          <div key={holder.address}
            className="flex items-center justify-between gap-2 rounded-lg border border-white/[0.07] bg-white/[0.025] px-3 py-2 font-mono text-[9px] uppercase tracking-widest">
            <span className="truncate text-white/35">{holder.isContract ? "📄 " : "👤 "}{holder.tag || shortAddr(holder.address, 4)}</span>
            <span className={cn("shrink-0", holder.percent > 10 ? "text-red-400" : "text-og-gold")}>{holder.percent.toFixed(1)}%{holder.isLocked ? " 🔒" : ""}</span>
          </div>
        ))}
      </div>
    )}
  </Section>
);

const EvmChainInfoPanel = ({ token, chainId, security }: { token: JupTokenInfo; chainId: string; security?: EvmTokenSecurity | null }) => {
  const chainCfg = getChain(chainId);
  const explorerHost = chainCfg.explorerUrl.replace(/^https?:\/\//, "").split("/")[0];
  const createdAt = token.firstPool?.createdAt ?? token.migrationCreatedAt;
  return (
    <Section title={`${chainCfg.name} Token`} icon={<Globe className="h-3.5 w-3.5" />} accent="cyan"
      badge={<span className="rounded-full border border-og-cyan/40 bg-og-cyan/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest text-og-cyan">{chainCfg.name}</span>}>
      <div className="grid gap-1.5">
        <DataRow label="Chain" value={chainCfg.name} />
        <DataRow label="Contract" value={shortAddr(token.id, 8)} />
        <DataRow label="First pool" value={shortDate(createdAt)} />
        <DataRow label="DEX" value={token.pairDexId ?? "—"} />
        <DataRow label="Liquidity" value={fmtUsd(tokenEffectiveLiquidityUsd(token))} highlight={tokenEffectiveLiquidityUsd(token) >= 10_000 ? "lime" : tokenEffectiveLiquidityUsd(token) >= 1_000 ? "gold" : "red"} />
        <DataRow label="Market cap" value={fmtUsd(token.mcap ?? token.fdv)} />
        {security?.honeypotWithSameCreator && <DataRow label="⚠ Same creator honeypots" value="Yes" highlight="red" />}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <a href={explorerAddressUrl(chainId, token.id)} target="_blank" rel="noreferrer"
          className="inline-flex items-center gap-1 rounded-full border border-og-cyan/30 bg-og-cyan/5 px-2.5 py-1 font-mono text-[9px] uppercase tracking-widest text-og-cyan transition hover:bg-og-cyan/15">
          <ExternalLink className="h-2.5 w-2.5" /> {explorerHost}
        </a>
        {token.dexUrl && (
          <a href={token.dexUrl} target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-full border border-og-gold/30 bg-og-gold/5 px-2.5 py-1 font-mono text-[9px] uppercase tracking-widest text-og-gold transition hover:bg-og-gold/15">
            <ExternalLink className="h-2.5 w-2.5" /> DexScreener
          </a>
        )}
      </div>
    </Section>
  );
};

const DexPoolsPanel = ({ pools }: { pools: TokenDexPoolIntel[] }) => (
  <Section title="DEX Pools" icon={<CandlestickChart className="h-3.5 w-3.5" />} accent="gold"
    badge={<span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest text-white/35">{fmtNum(pools.length)} pools</span>}>
    <div className="grid gap-2">
      {pools.slice(0, 4).map((pool) => (
        <a key={`${pool.dexId}-${pool.pairAddress}`} href={pool.url} target="_blank" rel="noreferrer"
          className="grid gap-1 rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 py-2.5 transition hover:border-og-gold/30">
          <div className="flex items-center justify-between gap-2 font-mono text-[10px] uppercase tracking-widest">
            <span className="truncate text-white/70">{pool.dexId ?? "DEX"} / {pool.quoteSymbol ?? "quote"}</span>
            <span className="text-og-gold">{fmtUsd(pool.effectiveLiquidityUsd ?? pool.liquidityUsd)}</span>
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 font-mono text-[9px] uppercase tracking-widest text-white/30">
            <span>LP {shortDate(pool.createdAt)}</span>
            <span>Vol {fmtUsd(pool.volume24h)}</span>
            <span>B/S {fmtNum(pool.buys24h)}/{fmtNum(pool.sells24h)}</span>
            {pool.boostsActive ? <span>Boost {fmtNum(pool.boostsActive)}</span> : null}
          </div>
        </a>
      ))}
      {pools.length === 0 && (
        <div className="rounded-xl border border-dashed border-white/[0.07] p-4 text-center font-mono text-[10px] uppercase tracking-widest text-white/25">No pools returned yet</div>
      )}
    </div>
  </Section>
);

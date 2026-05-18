import { memo, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  Crosshair,
  ExternalLink,
  Loader2,
  Radio,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Target,
  TrendingUp,
  Trophy,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { CoinDetailDialog } from "@/components/CoinDetailDialog";
import { CopyMintButton } from "@/components/CopyMintButton";
import { cn } from "@/lib/utils";
import {
  dexBoostsByMint,
  dexPairsForMints,
  dexScreenerChartUrl,
  dexScreenerEmbedUrl,
  enrichTokensWithMarketIntel,
  fmtNum,
  fmtPct,
  fmtUsd,
  forensicOgAttribution,
  jupTopOrganic,
  jupTopTraded,
  jupTrending,
  shortAddr,
  shortDate,
  timeAgo,
  tokenDevLaunchIntel,
  tokenDexPaidLabel,
  type DexBoostInfo,
  type DexSearchPair,
  type ForensicOgReport,
  type JupTokenInfo,
  type TokenDevLaunchIntel,
  type TokenForensicScores,
} from "@/lib/og";

type Props = { onSelect: (mint: string) => void };

type DexTokenProfile = {
  chainId?: string;
  tokenAddress?: string;
  url?: string;
  icon?: string;
  header?: string | null;
  description?: string | null;
  links?: { type?: string | null; label?: string | null; url?: string }[] | null;
};

type BundleSignal = {
  label: "Likely bundled" | "Bundle watch" | "No bundle signal";
  score: number;
  tone: "blood" | "gold" | "lime";
  reasons: string[];
};

type FeedCoin = {
  token: JupTokenInfo;
  pair?: DexSearchPair;
  profile?: DexTokenProfile;
  boost?: DexBoostInfo;
  forensic?: TokenForensicScores;
  rankScore: number;
  runnerScore: number;
  spotlightScore: number;
  reasons: string[];
  tags: string[];
  bundle: BundleSignal;
};

type FeedPayload = {
  coins: FeedCoin[];
  spotlights: FeedCoin[];
  runners: FeedCoin[];
  updatedAt: string;
  sourceCount: number;
};

type TrendBucket = "m5" | "h1" | "h6" | "h24";

const FEED_REFRESH_MS = 25_000;

async function fetchJson<T>(url: string): Promise<T> {
  const response: Response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return (await response.json()) as T;
}

async function fetchDexProfiles(): Promise<DexTokenProfile[]> {
  try {
    const profiles: DexTokenProfile[] = await fetchJson<DexTokenProfile[]>("https://api.dexscreener.com/token-profiles/latest/v1");
    return profiles.filter((profile: DexTokenProfile): boolean => profile.chainId === "solana" && Boolean(profile.tokenAddress)).slice(0, 90);
  } catch {
    return [];
  }
}

function getPairTxns(pair: DexSearchPair | undefined, bucket: TrendBucket): number {
  const txns = pair?.txns?.[bucket];
  return (txns?.buys ?? 0) + (txns?.sells ?? 0);
}

function getPairVolume(pair: DexSearchPair | undefined, bucket: TrendBucket): number {
  return pair?.volume?.[bucket] ?? 0;
}

function getPairChange(pair: DexSearchPair | undefined, bucket: TrendBucket): number {
  return pair?.priceChange?.[bucket] ?? 0;
}

function getBuyPressure(pair: DexSearchPair | undefined, bucket: TrendBucket): number {
  const txns = pair?.txns?.[bucket];
  const buys: number = txns?.buys ?? 0;
  const sells: number = txns?.sells ?? 0;
  const total: number = buys + sells;
  return total > 0 ? buys / total : 0.5;
}

function bestPairsByMint(pairs: DexSearchPair[]): Map<string, DexSearchPair> {
  const byMint = new Map<string, DexSearchPair>();
  for (const pair of pairs) {
    const mint: string | undefined = pair.baseToken?.address;
    if (!mint || pair.chainId !== "solana") continue;
    const previous: DexSearchPair | undefined = byMint.get(mint);
    const previousScore: number = (previous?.liquidity?.usd ?? 0) + (previous?.volume?.h24 ?? 0) * 0.35 + getPairTxns(previous, "h24") * 55;
    const nextScore: number = (pair.liquidity?.usd ?? 0) + (pair.volume?.h24 ?? 0) * 0.35 + getPairTxns(pair, "h24") * 55;
    if (!previous || nextScore >= previousScore) byMint.set(mint, pair);
  }
  return byMint;
}

function pairToToken(pair: DexSearchPair): JupTokenInfo | null {
  const mint: string | undefined = pair.baseToken?.address;
  if (!mint) return null;
  const price: number | undefined = pair.priceUsd ? Number(pair.priceUsd) : undefined;
  const buyPressure: number = getBuyPressure(pair, "h24");
  const volume24h: number = pair.volume?.h24 ?? 0;
  const createdAt: string | undefined = pair.pairCreatedAt ? new Date(pair.pairCreatedAt).toISOString() : undefined;

  return {
    id: mint,
    chainId: "solana",
    name: pair.baseToken?.name ?? "Live token",
    symbol: pair.baseToken?.symbol ?? "TOKEN",
    icon: pair.info?.imageUrl,
    decimals: 0,
    usdPrice: Number.isFinite(price) ? price : undefined,
    mcap: pair.marketCap,
    fdv: pair.fdv,
    liquidity: pair.liquidity?.usd,
    stats24h: {
      priceChange: pair.priceChange?.h24,
      buyVolume: volume24h > 0 ? volume24h * buyPressure : undefined,
      sellVolume: volume24h > 0 ? volume24h * (1 - buyPressure) : undefined,
      numBuys: pair.txns?.h24?.buys,
      numSells: pair.txns?.h24?.sells,
      numTraders: getPairTxns(pair, "h24") || undefined,
    },
    stats1h: { priceChange: pair.priceChange?.h1 },
    stats5m: { priceChange: pair.priceChange?.m5 },
    firstPool: createdAt ? { createdAt } : undefined,
    migrationCreatedAt: createdAt,
    dexBoostActive: pair.boosts?.active,
    dexUrl: pair.url,
    pairAddress: pair.pairAddress,
    pairDexId: pair.dexId,
  };
}

function mergeTokenMap(tokens: JupTokenInfo[]): Map<string, JupTokenInfo> {
  const byMint = new Map<string, JupTokenInfo>();
  for (const token of tokens) {
    const existing: JupTokenInfo | undefined = byMint.get(token.id);
    byMint.set(token.id, {
      ...(existing ?? token),
      ...token,
      icon: existing?.icon ?? token.icon,
      usdPrice: token.usdPrice ?? existing?.usdPrice,
      mcap: token.mcap ?? existing?.mcap,
      fdv: token.fdv ?? existing?.fdv,
      liquidity: token.liquidity ?? existing?.liquidity,
      stats24h: token.stats24h ?? existing?.stats24h,
      stats1h: token.stats1h ?? existing?.stats1h,
      stats5m: token.stats5m ?? existing?.stats5m,
      firstPool: token.firstPool ?? existing?.firstPool,
      dexUrl: token.dexUrl ?? existing?.dexUrl,
      pairAddress: token.pairAddress ?? existing?.pairAddress,
      pairDexId: token.pairDexId ?? existing?.pairDexId,
    });
  }
  return byMint;
}

function bundleSignal(token: JupTokenInfo, pair: DexSearchPair | undefined): BundleSignal {
  const reasons: string[] = [];
  const topHolders: number = token.audit?.topHoldersPercentage ?? 0;
  const buyPressure5m: number = getBuyPressure(pair, "m5");
  const txns5m: number = getPairTxns(pair, "m5");
  const liquidity: number = token.liquidity ?? pair?.liquidity?.usd ?? 0;
  const holders: number = token.holderCount ?? 0;
  const activeBoosts: number = token.dexBoostActive ?? pair?.boosts?.active ?? 0;
  const volume1h: number = getPairVolume(pair, "h1");

  let score = 8;
  if (topHolders >= 60) {
    score += 44;
    reasons.push(`top holders ${topHolders.toFixed(1)}%`);
  } else if (topHolders >= 42) {
    score += 24;
    reasons.push(`holder concentration ${topHolders.toFixed(1)}%`);
  }
  if (buyPressure5m >= 0.82 && txns5m >= 12) {
    score += 20;
    reasons.push("one-sided early buys");
  }
  if (holders > 0 && holders < 220 && volume1h > 25_000) {
    score += 14;
    reasons.push("high volume / low holder count");
  }
  if (liquidity > 0 && liquidity < 2_500 && volume1h > liquidity * 5) {
    score += 12;
    reasons.push("volume outruns thin LP");
  }
  if (activeBoosts > 0 && liquidity < 8_000) {
    score += 8;
    reasons.push("boosted before deep liquidity");
  }
  if (token.audit && token.audit.mintAuthorityDisabled === false) {
    score += 8;
    reasons.push("mint authority open");
  }
  if (token.audit && token.audit.freezeAuthorityDisabled === false) {
    score += 8;
    reasons.push("freeze authority open");
  }

  const safeScore: number = Math.max(0, Math.min(100, Math.round(score)));
  if (safeScore >= 65) return { label: "Likely bundled", score: safeScore, tone: "blood", reasons: reasons.slice(0, 4) };
  if (safeScore >= 35) return { label: "Bundle watch", score: safeScore, tone: "gold", reasons: reasons.slice(0, 4) };
  return { label: "No bundle signal", score: safeScore, tone: "lime", reasons: reasons.length ? reasons.slice(0, 3) : ["no major concentration signal"] };
}

function buildReasons(token: JupTokenInfo, pair: DexSearchPair | undefined, boost: DexBoostInfo | undefined, profile: DexTokenProfile | undefined, forensic: TokenForensicScores | undefined): string[] {
  const reasons: string[] = [];
  const change5m: number = getPairChange(pair, "m5") || token.stats5m?.priceChange || 0;
  const change1h: number = getPairChange(pair, "h1") || token.stats1h?.priceChange || 0;
  const txns5m: number = getPairTxns(pair, "m5");
  const buys5m: number = pair?.txns?.m5?.buys ?? 0;
  const sells5m: number = pair?.txns?.m5?.sells ?? 0;
  const volume1h: number = getPairVolume(pair, "h1");
  const volume24h: number = getPairVolume(pair, "h24");
  const activeBoosts: number = token.dexBoostActive ?? pair?.boosts?.active ?? 0;

  if (change5m >= 8) reasons.push(`${fmtPct(change5m)} in 5m`);
  if (change1h >= 18) reasons.push(`${fmtPct(change1h)} in 1h`);
  if (volume1h >= 50_000) reasons.push(`${fmtUsd(volume1h)} 1h volume`);
  if (volume24h >= 250_000) reasons.push(`${fmtUsd(volume24h)} 24h tape`);
  if (txns5m >= 25) reasons.push(`${fmtNum(txns5m)} tx in 5m`);
  if (buys5m > sells5m * 1.45 && buys5m >= 8) reasons.push(`${fmtNum(buys5m)} buys vs ${fmtNum(sells5m)} sells`);
  if (activeBoosts > 0 || (boost?.amount ?? boost?.totalAmount ?? 0) > 0) reasons.push("active DexScreener boost");
  if (token.dexCommunityTakeoverPaid) reasons.push("CTO paid/order signal");
  if (profile?.header || profile?.icon || (profile?.links?.length ?? 0) > 0) reasons.push("fresh DEX profile/social update");
  if ((token.organicScore ?? 0) >= 65) reasons.push(`organic score ${fmtNum(token.organicScore)}`);
  if (forensic?.classification.primary_label === "TRUE OG CTO") reasons.push("TRUE OG CTO classification");
  if (forensic?.classification.primary_label === "TRUE OG") reasons.push("TRUE OG origin signal");
  return Array.from(new Set(reasons)).slice(0, 5);
}

function buildTags(token: JupTokenInfo, pair: DexSearchPair | undefined, forensic: TokenForensicScores | undefined, bundle: BundleSignal): string[] {
  const tags: string[] = [];
  if (forensic?.classification.primary_label) tags.push(forensic.classification.primary_label);
  if (bundle.label !== "No bundle signal") tags.push(bundle.label);
  if (token.dexCommunityTakeoverPaid) tags.push("CTO paid");
  if (token.dexProfilePaid) tags.push("DEX profile");
  if ((token.dexBoostActive ?? pair?.boosts?.active ?? 0) > 0) tags.push("Boosted");
  if ((token.isVerified ?? false) === true) tags.push("Verified");
  if ((token.audit?.mintAuthorityDisabled ?? false) && (token.audit?.freezeAuthorityDisabled ?? false)) tags.push("Authorities off");
  if ((pair?.pairCreatedAt ?? 0) > Date.now() - 86_400_000) tags.push("Fresh pair");
  return Array.from(new Set(tags)).slice(0, 5);
}

function rankCoin(token: JupTokenInfo, pair: DexSearchPair | undefined, boost: DexBoostInfo | undefined, profile: DexTokenProfile | undefined, forensic: TokenForensicScores | undefined, bundle: BundleSignal): number {
  const volumeScore: number = Math.log10(getPairVolume(pair, "h24") + getPairVolume(pair, "h1") * 4 + 1) * 680;
  const txScore: number = getPairTxns(pair, "m5") * 95 + getPairTxns(pair, "h1") * 18;
  const momentumScore: number = Math.max(0, getPairChange(pair, "m5")) * 170 + Math.max(0, getPairChange(pair, "h1")) * 70;
  const liquidityScore: number = Math.log10((token.liquidity ?? pair?.liquidity?.usd ?? 0) + 1) * 240;
  const boostScore: number = ((token.dexBoostActive ?? pair?.boosts?.active ?? boost?.amount ?? boost?.totalAmount ?? 0) > 0 ? 820 : 0) + (token.dexApprovedOrderCount ?? 0) * 180;
  const profileScore: number = profile ? 420 + (profile.links?.length ?? 0) * 55 : 0;
  const forensicScore: number = (forensic?.trueOgProbability ?? 0) * 8 - (forensic?.cloneProbability ?? 0) * 3;
  const organicScore: number = (token.organicScore ?? 0) * 12;
  const bundlePenalty: number = bundle.label === "Likely bundled" ? 520 : bundle.label === "Bundle watch" ? 190 : 0;
  return Math.max(0, Math.round(volumeScore + txScore + momentumScore + liquidityScore + boostScore + profileScore + forensicScore + organicScore - bundlePenalty));
}

function runnerScore(token: JupTokenInfo, pair: DexSearchPair | undefined, rankScore: number): number {
  const buyPressure: number = getBuyPressure(pair, "m5");
  const changeScore: number = Math.max(0, getPairChange(pair, "m5")) * 120 + Math.max(0, getPairChange(pair, "h1")) * 45;
  const txScore: number = getPairTxns(pair, "m5") * 80;
  const liqBase: number = Math.log10((token.liquidity ?? pair?.liquidity?.usd ?? 0) + 1) * 120;
  return Math.max(0, Math.round(rankScore * 0.2 + changeScore + txScore + buyPressure * 900 + liqBase));
}

async function fetchFeedPayload(): Promise<FeedPayload> {
  const [profilesResult, trending5mResult, trending1hResult, topTradedResult, organicResult] = await Promise.allSettled([
    fetchDexProfiles(),
    jupTrending("5m", 35),
    jupTrending("1h", 35),
    jupTopTraded("1h", 35),
    jupTopOrganic("24h", 25),
  ]);

  const profiles: DexTokenProfile[] = profilesResult.status === "fulfilled" ? profilesResult.value : [];
  const jupiterTokens: JupTokenInfo[] = [trending5mResult, trending1hResult, topTradedResult, organicResult].flatMap((result): JupTokenInfo[] =>
    result.status === "fulfilled" ? result.value : [],
  );
  const boostMap: Map<string, DexBoostInfo> = await dexBoostsByMint().catch(() => new Map<string, DexBoostInfo>());
  const profileByMint = new Map<string, DexTokenProfile>();
  for (const profile of profiles) {
    if (profile.tokenAddress) profileByMint.set(profile.tokenAddress, profile);
  }

  const seedMints: string[] = Array.from(
    new Set<string>([
      ...jupiterTokens.map((token: JupTokenInfo): string => token.id),
      ...profiles.map((profile: DexTokenProfile): string => profile.tokenAddress ?? "").filter(Boolean),
      ...Array.from(boostMap.keys()),
    ]),
  ).slice(0, 90);

  const pairs: DexSearchPair[] = await dexPairsForMints(seedMints);
  const pairByMint: Map<string, DexSearchPair> = bestPairsByMint(pairs);
  const pairTokens: JupTokenInfo[] = Array.from(pairByMint.values()).map(pairToToken).filter((token): token is JupTokenInfo => Boolean(token));
  const tokenMap: Map<string, JupTokenInfo> = mergeTokenMap([...pairTokens, ...jupiterTokens.map((token: JupTokenInfo): JupTokenInfo => ({ ...token, chainId: token.chainId ?? "solana" }))]);
  const enrichedTokens: JupTokenInfo[] = await enrichTokensWithMarketIntel(Array.from(tokenMap.values()).slice(0, 60), { includeAth: true, maxAth: 18 });

  const quickSorted: JupTokenInfo[] = [...enrichedTokens].sort((a: JupTokenInfo, b: JupTokenInfo): number => {
    const aPair: DexSearchPair | undefined = pairByMint.get(a.id);
    const bPair: DexSearchPair | undefined = pairByMint.get(b.id);
    const aQuick: number = getPairVolume(aPair, "h1") + getPairTxns(aPair, "m5") * 700 + Math.max(0, getPairChange(aPair, "m5")) * 800 + (a.dexBoostActive ?? 0) * 1200;
    const bQuick: number = getPairVolume(bPair, "h1") + getPairTxns(bPair, "m5") * 700 + Math.max(0, getPairChange(bPair, "m5")) * 800 + (b.dexBoostActive ?? 0) * 1200;
    return bQuick - aQuick;
  });

  const forensicTargets: JupTokenInfo[] = quickSorted.filter((token: JupTokenInfo): boolean => Boolean(token.symbol)).slice(0, 8);
  const forensicResults = await Promise.allSettled(forensicTargets.map((token: JupTokenInfo): Promise<ForensicOgReport> => forensicOgAttribution(token.symbol)));
  const forensicByMint = new Map<string, TokenForensicScores>();
  forensicResults.forEach((result): void => {
    if (result.status !== "fulfilled") return;
    for (const [mint, score] of Object.entries(result.value.tokenScores)) forensicByMint.set(mint, score);
  });

  const coins: FeedCoin[] = quickSorted
    .map((token: JupTokenInfo): FeedCoin => {
      const pair: DexSearchPair | undefined = pairByMint.get(token.id);
      const boost: DexBoostInfo | undefined = boostMap.get(token.id);
      const profile: DexTokenProfile | undefined = profileByMint.get(token.id);
      const forensic: TokenForensicScores | undefined = forensicByMint.get(token.id);
      const bundle: BundleSignal = bundleSignal(token, pair);
      const rankScore: number = rankCoin(token, pair, boost, profile, forensic, bundle);
      const runScore: number = runnerScore(token, pair, rankScore);
      return {
        token,
        pair,
        profile,
        boost,
        forensic,
        rankScore,
        runnerScore: runScore,
        spotlightScore: Math.round(rankScore * 0.68 + runScore * 0.32 + (profile?.header ? 550 : 0)),
        reasons: buildReasons(token, pair, boost, profile, forensic),
        tags: buildTags(token, pair, forensic, bundle),
        bundle,
      };
    })
    .filter((coin: FeedCoin): boolean => coin.rankScore > 0 || Boolean(coin.profile) || Boolean(coin.boost))
    .sort((a: FeedCoin, b: FeedCoin): number => b.rankScore - a.rankScore)
    .slice(0, 32);

  return {
    coins,
    spotlights: [...coins].sort((a: FeedCoin, b: FeedCoin): number => b.spotlightScore - a.spotlightScore).slice(0, 3),
    runners: [...coins].sort((a: FeedCoin, b: FeedCoin): number => b.runnerScore - a.runnerScore).slice(0, 10),
    updatedAt: new Date().toISOString(),
    sourceCount: seedMints.length,
  };
}

export const Feed = ({ onSelect }: Props) => {
  const [selectedMint, setSelectedMint] = useState<string | null>(null);

  const { data, isFetching, error, refetch, dataUpdatedAt } = useQuery({
    queryKey: ["ogscan-live-feed"],
    queryFn: fetchFeedPayload,
    staleTime: 18_000,
    refetchInterval: FEED_REFRESH_MS,
  });

  const coins: FeedCoin[] = data?.coins ?? [];
  const selectedCoin: FeedCoin | null = useMemo((): FeedCoin | null => coins.find((coin: FeedCoin): boolean => coin.token.id === selectedMint) ?? coins[0] ?? null, [coins, selectedMint]);

  const { data: devIntel, isFetching: devIntelLoading } = useQuery({
    queryKey: ["feed-dev-intel", selectedCoin?.token.id],
    queryFn: (): Promise<TokenDevLaunchIntel> => tokenDevLaunchIntel(selectedCoin!.token),
    enabled: Boolean(selectedCoin),
    staleTime: 60_000,
  });

  useEffect((): void => {
    if (!selectedMint && coins[0]) setSelectedMint(coins[0].token.id);
  }, [coins, selectedMint]);

  const summary = useMemo(() => {
    const bundled: number = coins.filter((coin: FeedCoin): boolean => coin.bundle.label !== "No bundle signal").length;
    const ctos: number = coins.filter((coin: FeedCoin): boolean => coin.token.dexCommunityTakeoverPaid === true || coin.forensic?.classification.primary_label.includes("CTO") === true).length;
    const avgRunner: number = coins.reduce((sum: number, coin: FeedCoin): number => sum + coin.runnerScore, 0) / Math.max(1, coins.length);
    return { bundled, ctos, avgRunner };
  }, [coins]);

  return (
    <section className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_0%,hsl(var(--og-lime)/0.14),transparent_32%),radial-gradient(circle_at_88%_10%,hsl(var(--og-cyan)/0.18),transparent_34%)]" />
      <div className="relative space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-2 text-[10px] uppercase tracking-[0.4em] text-og-lime">
              <span className="h-px w-10 bg-og-lime" /> /FEED · LIVE TOKEN INTEL
            </div>
            <h2 className="font-display text-4xl font-black uppercase leading-none tracking-tighter text-white sm:text-6xl">
              Live market <span className="text-og-cyan text-glow">feed</span>
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-white/66">
              A real-time command feed for what is moving now, why it is moving, spotlight coins, high-ranking runners, bundle-risk signals, paid boost status, CTO/dev-launch context, and scanner actions.
            </p>
          </div>

          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest">
            <span className="rounded-full border border-og-lime/45 bg-og-lime/10 px-3 py-2 text-og-lime">
              {isFetching ? "Syncing" : "Live"}
            </span>
            <button type="button" onClick={() => void refetch()} className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.055] px-3 py-2 text-white/70 transition hover:border-og-cyan hover:text-og-cyan">
              {isFetching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              refresh
            </button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <FeedMetric Icon={Radio} label="Live coins" value={fmtNum(coins.length)} detail={`${fmtNum(data?.sourceCount)} source mints`} tone="cyan" />
          <FeedMetric Icon={Trophy} label="Spotlights" value={fmtNum(data?.spotlights.length)} detail="top narrative + tape" tone="lime" />
          <FeedMetric Icon={ShieldAlert} label="Bundle watch" value={fmtNum(summary.bundled)} detail="inferred concentration" tone="blood" />
          <FeedMetric Icon={Wallet} label="CTO/dev signals" value={fmtNum(summary.ctos)} detail={`runner avg ${fmtNum(summary.avgRunner)}`} tone="gold" />
        </div>

        {error ? (
          <div className="rounded-3xl border border-og-blood/50 bg-og-blood/10 p-4 text-sm text-og-blood">
            Feed data is temporarily unavailable. DexScreener/Jupiter/RPC may be rate-limited — tap refresh in a moment.
          </div>
        ) : null}

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
          <div className="space-y-4">
            <SpotlightGrid spotlights={data?.spotlights ?? []} selectedMint={selectedCoin?.token.id} onSelect={setSelectedMint} onOpenScanner={onSelect} />
            <RunnerBoard runners={data?.runners ?? []} selectedMint={selectedCoin?.token.id} onSelect={setSelectedMint} onOpenScanner={onSelect} />
            <LiveFeedList coins={coins} selectedMint={selectedCoin?.token.id} onSelect={setSelectedMint} onOpenScanner={onSelect} loading={isFetching && coins.length === 0} />
          </div>

          <FeedDetail coin={selectedCoin} devIntel={devIntel} devIntelLoading={devIntelLoading} updatedAt={dataUpdatedAt || (data?.updatedAt ? new Date(data.updatedAt).getTime() : 0)} onOpenScanner={onSelect} />
        </div>
      </div>
    </section>
  );
};

const FeedMetric = memo(({ Icon, label, value, detail, tone }: { Icon: LucideIcon; label: string; value: string; detail: string; tone: "cyan" | "lime" | "gold" | "blood" }) => {
  const toneClass: string = tone === "lime" ? "border-og-lime/35 bg-og-lime/10 text-og-lime" : tone === "gold" ? "border-og-gold/35 bg-og-gold/10 text-og-gold" : tone === "blood" ? "border-og-blood/35 bg-og-blood/10 text-og-blood" : "border-og-cyan/35 bg-og-cyan/10 text-og-cyan";
  return (
    <div className={cn("rounded-[1.45rem] border p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]", toneClass)}>
      <div className="flex items-center justify-between gap-2">
        <div className="font-mono text-[9px] font-black uppercase tracking-[0.24em] text-white/52">{label}</div>
        <Icon className="h-4 w-4" />
      </div>
      <div className="mt-2 font-display text-3xl font-black uppercase tracking-tight text-white">{value}</div>
      <div className="mt-1 font-mono text-[9px] uppercase tracking-widest opacity-80">{detail}</div>
    </div>
  );
});
FeedMetric.displayName = "FeedMetric";

const SpotlightGrid = memo(({ spotlights, selectedMint, onSelect, onOpenScanner }: { spotlights: FeedCoin[]; selectedMint?: string; onSelect: (mint: string) => void; onOpenScanner: (mint: string) => void }) => (
  <div className="rounded-[1.8rem] border border-white/10 bg-white/[0.045] p-4 backdrop-blur-xl">
    <PanelHeader Icon={Sparkles} eyebrow="spotlight coins" title="Coins the tape is highlighting" right={`${fmtNum(spotlights.length)} live`} />
    <div className="mt-4 grid gap-3 lg:grid-cols-3">
      {spotlights.map((coin: FeedCoin, index: number) => (
        <button
          key={coin.token.id}
          type="button"
          onClick={() => onSelect(coin.token.id)}
          className={cn(
            "group relative overflow-hidden rounded-[1.45rem] border p-4 text-left transition hover:-translate-y-0.5 active:scale-[0.99]",
            selectedMint === coin.token.id ? "border-og-lime bg-og-lime/10" : "border-white/10 bg-black/24 hover:border-og-cyan/60",
          )}
        >
          <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-og-cyan/15 blur-2xl" />
          <div className="relative flex items-start justify-between gap-3">
            <TokenAvatar token={coin.token} />
            <div className="rounded-full border border-og-lime/35 bg-og-lime/10 px-2 py-1 font-mono text-[9px] uppercase tracking-widest text-og-lime">#{index + 1}</div>
          </div>
          <div className="relative mt-3 min-w-0">
            <div className="truncate font-display text-2xl font-black uppercase leading-none text-white">${coin.token.symbol}</div>
            <div className="mt-1 truncate text-xs font-semibold text-white/54">{coin.token.name}</div>
          </div>
          <div className="relative mt-4 grid grid-cols-2 gap-2 font-mono text-[10px] uppercase tracking-widest">
            <MiniStat label="Run" value={fmtNum(coin.runnerScore)} tone="lime" />
            <MiniStat label="1h" value={fmtPct(getPairChange(coin.pair, "h1") || coin.token.stats1h?.priceChange)} tone={(getPairChange(coin.pair, "h1") || 0) >= 0 ? "cyan" : "blood"} />
          </div>
          <div className="relative mt-3 flex flex-wrap gap-1">
            {coin.tags.slice(0, 3).map((tag: string) => <Tag key={tag} label={tag} />)}
          </div>
          <button type="button" onClick={(event) => { event.stopPropagation(); onOpenScanner(coin.token.id); }} className="relative mt-4 inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest text-og-cyan transition group-hover:text-og-lime">
            scan coin <ArrowUpRight className="h-3 w-3" />
          </button>
        </button>
      ))}
    </div>
  </div>
));
SpotlightGrid.displayName = "SpotlightGrid";

const RunnerBoard = memo(({ runners, selectedMint, onSelect, onOpenScanner }: { runners: FeedCoin[]; selectedMint?: string; onSelect: (mint: string) => void; onOpenScanner: (mint: string) => void }) => (
  <div className="overflow-hidden rounded-[1.8rem] border border-white/10 bg-[#020917]/78 backdrop-blur-xl">
    <div className="border-b border-white/10 p-4">
      <PanelHeader Icon={TrendingUp} eyebrow="high-ranking runners" title="Fastest movers + bundle status" right="live ranked" />
    </div>
    <div className="hidden grid-cols-12 gap-2 border-b border-white/10 px-4 py-2 font-mono text-[9px] uppercase tracking-[0.24em] text-white/42 md:grid">
      <div className="col-span-1">#</div>
      <div className="col-span-4">coin</div>
      <div className="col-span-2 text-right">runner</div>
      <div className="col-span-2 text-right">bundle</div>
      <div className="col-span-2 text-right">tape</div>
      <div className="col-span-1 text-right">open</div>
    </div>
    {runners.map((coin: FeedCoin, index: number) => (
      <RunnerRow key={coin.token.id} coin={coin} index={index} selected={selectedMint === coin.token.id} onSelect={() => onSelect(coin.token.id)} onOpenScanner={() => onOpenScanner(coin.token.id)} />
    ))}
  </div>
));
RunnerBoard.displayName = "RunnerBoard";

const RunnerRow = memo(({ coin, index, selected, onSelect, onOpenScanner }: { coin: FeedCoin; index: number; selected: boolean; onSelect: () => void; onOpenScanner: () => void }) => {
  const change: number = getPairChange(coin.pair, "m5") || coin.token.stats5m?.priceChange || 0;
  const up: boolean = change >= 0;
  return (
    <div className={cn("border-b border-white/10 p-3 transition last:border-b-0 md:grid md:grid-cols-12 md:items-center md:gap-2 md:px-4", selected ? "bg-og-lime/8" : "hover:bg-white/[0.035]")}> 
      <button type="button" onClick={onSelect} className="flex min-w-0 items-center gap-3 text-left md:contents">
        <div className="font-mono text-xs text-og-cyan md:col-span-1">{String(index + 1).padStart(2, "0")}</div>
        <div className="flex min-w-0 items-center gap-3 md:col-span-4">
          <TokenAvatar token={coin.token} small />
          <div className="min-w-0">
            <div className="truncate font-display text-base font-black uppercase text-white">${coin.token.symbol}</div>
            <div className="truncate font-mono text-[9px] uppercase tracking-widest text-white/42">{coin.token.name} · {shortAddr(coin.token.id, 4)}</div>
          </div>
        </div>
      </button>
      <button type="button" onClick={onSelect} className="mt-3 rounded-2xl border border-white/10 bg-white/[0.035] p-2 text-left font-mono md:col-span-2 md:mt-0 md:border-0 md:bg-transparent md:p-0 md:text-right">
        <div className="text-xs font-black text-og-lime">{fmtNum(coin.runnerScore)}</div>
        <div className="text-[9px] uppercase tracking-widest text-white/42">rank {fmtNum(coin.rankScore)}</div>
      </button>
      <button type="button" onClick={onSelect} className="mt-2 rounded-2xl border border-white/10 bg-white/[0.035] p-2 text-left font-mono md:col-span-2 md:mt-0 md:border-0 md:bg-transparent md:p-0 md:text-right">
        <BundleBadge bundle={coin.bundle} />
      </button>
      <button type="button" onClick={onSelect} className="mt-2 rounded-2xl border border-white/10 bg-white/[0.035] p-2 text-left font-mono md:col-span-2 md:mt-0 md:border-0 md:bg-transparent md:p-0 md:text-right">
        <div className={cn("text-xs font-black", up ? "text-og-lime" : "text-og-blood")}>{fmtPct(change)}</div>
        <div className="text-[9px] uppercase tracking-widest text-white/42">{fmtUsd(getPairVolume(coin.pair, "h1"))} 1h</div>
      </button>
      <div className="mt-2 flex justify-end md:col-span-1 md:mt-0">
        <button type="button" onClick={onOpenScanner} className="rounded-full border border-og-cyan/35 bg-og-cyan/10 p-2 text-og-cyan transition hover:border-og-lime hover:text-og-lime" title="Load in scanner">
          <ArrowUpRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
});
RunnerRow.displayName = "RunnerRow";

const LiveFeedList = memo(({ coins, selectedMint, onSelect, onOpenScanner, loading }: { coins: FeedCoin[]; selectedMint?: string; onSelect: (mint: string) => void; onOpenScanner: (mint: string) => void; loading: boolean }) => (
  <div className="overflow-hidden rounded-[1.8rem] border border-white/10 bg-white/[0.04] backdrop-blur-xl">
    <div className="border-b border-white/10 p-4">
      <PanelHeader Icon={Radio} eyebrow="full feed" title="Trending now + why" right={`${fmtNum(coins.length)} coins`} />
    </div>
    {loading ? (
      <div className="grid min-h-[240px] place-items-center font-mono text-[10px] uppercase tracking-[0.3em] text-og-cyan">
        <div className="text-center"><Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin" /> Syncing live token feed</div>
      </div>
    ) : null}
    {coins.map((coin: FeedCoin, index: number) => (
      <FeedRow key={coin.token.id} coin={coin} index={index} selected={selectedMint === coin.token.id} onSelect={() => onSelect(coin.token.id)} onOpenScanner={() => onOpenScanner(coin.token.id)} />
    ))}
    {!loading && coins.length === 0 ? <div className="p-6 text-center font-mono text-[10px] uppercase tracking-[0.24em] text-white/45">No live feed items yet · refresh again</div> : null}
  </div>
));
LiveFeedList.displayName = "LiveFeedList";

const FeedRow = memo(({ coin, index, selected, onSelect, onOpenScanner }: { coin: FeedCoin; index: number; selected: boolean; onSelect: () => void; onOpenScanner: () => void }) => {
  const dexPaid: string = tokenDexPaidLabel(coin.token);
  const createdAtSeconds: number = coin.pair?.pairCreatedAt ? Math.floor(coin.pair.pairCreatedAt / 1000) : 0;
  return (
    <div className={cn("group border-b border-white/10 p-3 transition last:border-b-0 hover:bg-white/[0.035]", selected && "bg-og-cyan/8")}> 
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <button type="button" onClick={onSelect} className="flex min-w-0 flex-1 gap-3 text-left">
          <div className="pt-1 font-mono text-[10px] text-og-cyan">{String(index + 1).padStart(2, "0")}</div>
          <TokenAvatar token={coin.token} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-display text-xl font-black uppercase leading-none text-white">${coin.token.symbol}</span>
              <BundleBadge bundle={coin.bundle} compact />
              {coin.forensic?.classification.primary_label ? <Tag label={coin.forensic.classification.primary_label} /> : null}
            </div>
            <div className="mt-1 truncate text-xs font-semibold text-white/54">{coin.token.name} {createdAtSeconds ? `· ${timeAgo(createdAtSeconds)} old` : ""}</div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {(coin.reasons.length ? coin.reasons : ["live profile / boost candidate"]).map((reason: string) => <ReasonChip key={reason} label={reason} />)}
            </div>
          </div>
        </button>

        <div className="grid grid-cols-2 gap-2 font-mono text-[10px] uppercase tracking-widest sm:grid-cols-4 lg:w-[430px]">
          <MiniStat label="5m" value={fmtPct(getPairChange(coin.pair, "m5") || coin.token.stats5m?.priceChange)} tone={(getPairChange(coin.pair, "m5") || 0) >= 0 ? "lime" : "blood"} />
          <MiniStat label="Vol 1h" value={fmtUsd(getPairVolume(coin.pair, "h1"))} tone="cyan" />
          <MiniStat label="Buys/Sells" value={`${fmtNum(coin.pair?.txns?.m5?.buys ?? 0)}/${fmtNum(coin.pair?.txns?.m5?.sells ?? 0)}`} tone="gold" />
          <MiniStat label="DEX" value={dexPaid} tone={dexPaid === "—" ? "muted" : "lime"} />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-3 font-mono text-[9px] uppercase tracking-widest text-white/45">
        <span>MC {fmtUsd(coin.token.mcap ?? coin.token.fdv)} · LQ {fmtUsd(coin.token.liquidity)} · ATH {fmtUsd(coin.token.allTimeHighUsd)} {shortDate(coin.token.allTimeHighAt)} · CA {shortAddr(coin.token.id, 4)}</span>
        <span className="flex flex-wrap items-center gap-2">
          <CoinDetailDialog token={coin.token} onOpenScanner={() => onOpenScanner()} actionLabel="Details" className="px-2 py-1" />
          <CopyMintButton mint={coin.token.id} label="copy" copiedLabel="copied" className="px-2 py-1" iconClassName="h-3 w-3" />
          {coin.token.dexUrl ? (
            <a href={coin.token.dexUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-og-gold transition hover:text-og-lime">
              chart <ExternalLink className="h-3 w-3" />
            </a>
          ) : null}
          <button type="button" onClick={onOpenScanner} className="inline-flex items-center gap-1 text-og-cyan transition hover:text-og-lime">
            scanner <ArrowUpRight className="h-3 w-3" />
          </button>
        </span>
      </div>
    </div>
  );
});
FeedRow.displayName = "FeedRow";

const FeedDetail = ({ coin, devIntel, devIntelLoading, updatedAt, onOpenScanner }: { coin: FeedCoin | null; devIntel?: TokenDevLaunchIntel; devIntelLoading: boolean; updatedAt: number; onOpenScanner: (mint: string) => void }) => {
  if (!coin) {
    return (
      <aside className="rounded-[1.8rem] border border-white/10 bg-white/[0.04] p-5 text-sm text-white/54">
        Waiting for live token feed data.
      </aside>
    );
  }

  const chartUrl: string = dexScreenerChartUrl({ id: coin.token.id, chainId: coin.token.chainId ?? "solana", dexUrl: coin.token.dexUrl, pairAddress: coin.token.pairAddress ?? coin.pair?.pairAddress });
  const embedUrl: string = dexScreenerEmbedUrl(chartUrl);
  const primaryLabel: string = coin.forensic?.classification.primary_label ?? (coin.token.dexCommunityTakeoverPaid ? "CTO SIGNAL" : "LIVE TOKEN");
  const isCto: boolean = primaryLabel.includes("CTO") || devIntel?.launchType === "CTO / community support";

  return (
    <aside className="sticky top-4 space-y-4 self-start">
      <div className="overflow-hidden rounded-[1.8rem] border border-og-cyan/25 bg-[#020917]/88 shadow-[0_30px_120px_-86px_hsl(var(--og-cyan))] backdrop-blur-xl">
        <div className="relative min-h-36 overflow-hidden border-b border-white/10 bg-og-ink">
          {coin.profile?.header ? <img src={coin.profile.header} alt={`${coin.token.symbol} banner`} className="absolute inset-0 h-full w-full object-cover opacity-70" loading="lazy" /> : null}
          <div className="absolute inset-0 bg-gradient-to-t from-[#020917] via-[#020917]/45 to-transparent" />
          <div className="relative flex min-h-36 items-end gap-3 p-4">
            <TokenAvatar token={coin.token} large />
            <div className="min-w-0 flex-1">
              <div className="font-mono text-[9px] uppercase tracking-[0.24em] text-og-cyan">selected feed coin</div>
              <div className="truncate font-display text-3xl font-black uppercase leading-none text-white">${coin.token.symbol}</div>
              <div className="mt-1 truncate text-xs font-semibold text-white/60">{coin.token.name}</div>
            </div>
          </div>
        </div>

        <div className="p-4">
          <div className="mb-4 flex flex-wrap gap-1.5">
            <Tag label={primaryLabel} strong />
            {coin.tags.map((tag: string) => <Tag key={tag} label={tag} />)}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <MiniStat label="rank score" value={fmtNum(coin.rankScore)} tone="lime" />
            <MiniStat label="runner" value={fmtNum(coin.runnerScore)} tone="cyan" />
            <MiniStat label="mcap" value={fmtUsd(coin.token.mcap ?? coin.token.fdv)} tone="gold" />
            <MiniStat label="liquidity" value={fmtUsd(coin.token.liquidity)} tone="cyan" />
          </div>

          <div className="mt-4 rounded-3xl border border-white/10 bg-black/24 p-3">
            <div className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.24em] text-og-lime">
              <Target className="h-3.5 w-3.5" /> why trending
            </div>
            <div className="grid gap-1.5">
              {(coin.reasons.length ? coin.reasons : ["Live feed source detected token in current DEX/Jupiter market stream."]).map((reason: string) => (
                <div key={reason} className="flex items-start gap-2 text-xs text-white/68">
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-og-lime" /> {reason}
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 rounded-3xl border border-white/10 bg-black/24 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.24em] text-og-gold">
                <AlertTriangle className="h-3.5 w-3.5" /> bundle status
              </div>
              <BundleBadge bundle={coin.bundle} />
            </div>
            <div className="text-xs leading-relaxed text-white/58">
              Score {coin.bundle.score}/100 · {coin.bundle.reasons.join(" · ")}. This is an inferred public-signal check from holders, tape, LP, boosts, and authority data.
            </div>
          </div>

          <div className="mt-4 rounded-3xl border border-og-cyan/20 bg-black/24 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.24em] text-og-cyan">
                <Wallet className="h-3.5 w-3.5" /> CTO / dev launch
              </div>
              {devIntelLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin text-og-cyan" /> : <span className={cn("rounded-full border px-2 py-1 font-mono text-[9px] uppercase tracking-widest", isCto ? "border-og-gold/40 bg-og-gold/10 text-og-gold" : "border-og-cyan/35 bg-og-cyan/10 text-og-cyan")}>{devIntel?.launchType ?? "scanning"}</span>}
            </div>
            <div className="grid gap-2">
              <MetaLine label="Creator" value={shortAddr(devIntel?.wallet ?? undefined, 5)} />
              <MetaLine label="Bonded coins" value={fmtNum(devIntel?.bondedCoinCount)} />
              <MetaLine label="Recent mints" value={fmtNum(devIntel?.recentTokenMints)} />
              <MetaLine label="DEX-paid coins" value={fmtNum(devIntel?.dexPaidCoinCount)} />
              <MetaLine label="Boosted coins" value={fmtNum(devIntel?.activeBoostedCoinCount)} />
              <MetaLine label="CTO orders" value={fmtNum(devIntel?.ctoOrderCount)} />
            </div>
          </div>

          <div className="mt-4 overflow-hidden rounded-3xl border border-white/10 bg-black/24">
            <div className="flex items-center justify-between gap-2 border-b border-white/10 px-3 py-2 font-mono text-[9px] uppercase tracking-[0.22em] text-white/50">
              <span className="inline-flex items-center gap-1.5"><BarChart3 className="h-3.5 w-3.5 text-og-cyan" /> DexScreener chart</span>
              <a href={chartUrl} target="_blank" rel="noreferrer" className="text-og-gold hover:text-og-lime">open</a>
            </div>
            <iframe title={`${coin.token.symbol} DexScreener chart`} src={embedUrl} className="h-[260px] w-full border-0" loading="lazy" />
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={() => onOpenScanner(coin.token.id)} className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-og-lime bg-og-lime px-4 py-3 font-display text-sm font-black uppercase text-og-ink transition hover:bg-white">
              Scan <Crosshair className="h-4 w-4" />
            </button>
            <CoinDetailDialog token={coin.token} onOpenScanner={() => onOpenScanner(coin.token.id)} actionLabel="Popup" className="min-h-12 flex-1 justify-center rounded-2xl px-4 py-3" />
            <CopyMintButton mint={coin.token.id} label="Copy CA" copiedLabel="Copied" className="min-h-12 flex-1 justify-center rounded-2xl px-4 py-3" />
          </div>

          <div className="mt-3 font-mono text-[9px] uppercase tracking-widest text-white/38">
            Updated {updatedAt ? timeAgo(Math.floor(updatedAt / 1000)) : "—"} ago · ATH {fmtUsd(coin.token.allTimeHighUsd)} {shortDate(coin.token.allTimeHighAt)} · ATL {fmtUsd(coin.token.allTimeLowUsd)} {shortDate(coin.token.allTimeLowAt)}
          </div>
        </div>
      </div>
    </aside>
  );
};

const PanelHeader = ({ Icon, eyebrow, title, right }: { Icon: LucideIcon; eyebrow: string; title: string; right: string }) => (
  <div className="flex flex-wrap items-end justify-between gap-3">
    <div>
      <div className="mb-1 flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.26em] text-og-cyan">
        <Icon className="h-3.5 w-3.5" /> {eyebrow}
      </div>
      <h3 className="font-display text-2xl font-black uppercase tracking-tight text-white">{title}</h3>
    </div>
    <div className="rounded-full border border-white/10 bg-white/[0.055] px-3 py-1.5 font-mono text-[9px] uppercase tracking-widest text-white/50">{right}</div>
  </div>
);

const TokenAvatar = ({ token, small = false, large = false }: { token: JupTokenInfo; small?: boolean; large?: boolean }) => (
  <div className={cn("relative shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.06]", large ? "h-16 w-16" : small ? "h-9 w-9" : "h-12 w-12")}>
    {token.icon ? <img src={token.icon} alt={token.symbol} className="h-full w-full object-cover" loading="lazy" /> : <div className="grid h-full w-full place-items-center font-display text-sm font-black text-og-cyan">{token.symbol?.[0] ?? "?"}</div>}
  </div>
);

const BundleBadge = ({ bundle, compact = false }: { bundle: BundleSignal; compact?: boolean }) => {
  const toneClass: string = bundle.tone === "blood" ? "border-og-blood/45 bg-og-blood/10 text-og-blood" : bundle.tone === "gold" ? "border-og-gold/45 bg-og-gold/10 text-og-gold" : "border-og-lime/45 bg-og-lime/10 text-og-lime";
  return <span className={cn("inline-flex items-center justify-center rounded-full border font-mono uppercase tracking-widest", compact ? "px-2 py-1 text-[8px]" : "px-2.5 py-1 text-[9px]", toneClass)}>{compact ? bundle.label.replace(" signal", "") : `${bundle.label} · ${bundle.score}`}</span>;
};

const MiniStat = ({ label, value, tone }: { label: string; value: string; tone: "lime" | "cyan" | "gold" | "blood" | "muted" }) => {
  const toneClass: string = tone === "lime" ? "text-og-lime" : tone === "cyan" ? "text-og-cyan" : tone === "gold" ? "text-og-gold" : tone === "blood" ? "text-og-blood" : "text-white/50";
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-2">
      <div className="text-[8px] uppercase tracking-[0.22em] text-white/38">{label}</div>
      <div className={cn("mt-1 truncate text-xs font-black", toneClass)}>{value}</div>
    </div>
  );
};

const Tag = ({ label, strong = false }: { label: string; strong?: boolean }) => (
  <span className={cn("rounded-full border px-2 py-1 font-mono text-[8px] uppercase tracking-widest", strong ? "border-og-lime/45 bg-og-lime/10 text-og-lime" : "border-white/10 bg-white/[0.04] text-white/58")}>{label}</span>
);

const ReasonChip = ({ label }: { label: string }) => (
  <span className="rounded-full border border-og-cyan/20 bg-og-cyan/10 px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-og-cyan">{label}</span>
);

const MetaLine = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.035] px-3 py-2 font-mono text-[10px] uppercase tracking-widest">
    <span className="shrink-0 text-white/42">{label}</span>
    <span className="min-w-0 truncate text-right text-white/82">{value}</span>
  </div>
);

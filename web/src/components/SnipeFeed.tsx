import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle,
  Bell,
  Check,
  Copy,
  Crosshair,
  ExternalLink,
  Eye,
  Flame,
  Gauge,
  Loader2,
  Pause,
  Play,
  Radar,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Skull,
  Sparkles,
  Star,
  Target,
  TrendingUp,
  UserSearch,
  Wallet,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { CoinDetailDialog } from "@/components/CoinDetailDialog";
import { cn } from "@/lib/utils";
import {
  fmtNum,
  fmtPct,
  fmtUsd,
  heliusTxs,
  jupGetTokens,
  enrichTokensWithMarketIntel,
  OGSCAN_DEV_WALLET,
  OGSCAN_TOKEN_MINT,
  copyTextToClipboard,
  shortAddr,
  shortDate,
  timeAgo,
  tokenDexPaidLabel,
  type HeliusTx,
  type JupTokenInfo,
} from "@/lib/og";

type Props = {
  onSelect: (mint: string) => void;
};

type DexTokenProfile = {
  chainId?: string;
  tokenAddress?: string;
  url?: string;
  icon?: string;
  header?: string | null;
  description?: string | null;
  links?: { type?: string | null; label?: string | null; url?: string }[] | null;
};

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
  chainId?: string;
  dexId?: string;
  url?: string;
  pairAddress?: string;
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

type RiskLevel = "clean" | "watch" | "risky" | "danger";

type DevIntel = {
  wallet: string | null;
  confidence: "high" | "medium" | "low";
  launches: number;
  wins: number;
  rugs: number;
  avgLiquidity: number;
  score: number;
  lastSeenMs: number | null;
};

type SnipeLaunch = {
  mint: string;
  name: string;
  symbol: string;
  icon?: string;
  dexUrl: string;
  pairAddress?: string;
  createdAtMs: number;
  priceUsd?: number;
  liquidity: number;
  marketCap?: number;
  fdv?: number;
  volume5m: number;
  volume1h: number;
  txns5m: number;
  buys5m: number;
  sells5m: number;
  priceChange5m: number;
  priceChange1h: number;
  boostAmount: number;
  dexPaidAmount?: number;
  dexBoostTotalAmount?: number;
  dexBoostActive?: number;
  dexPaidOrderCount?: number;
  dexApprovedOrderCount?: number;
  dexProfilePaid?: boolean;
  dexCommunityTakeoverPaid?: boolean;
  dexAdsPaid?: boolean;
  dexFirstPaidAt?: string;
  dexLastPaidAt?: string;
  allTimeHighUsd?: number;
  allTimeHighAt?: string;
  allTimeLowUsd?: number;
  allTimeLowAt?: string;
  migrationCreatedAt?: string;
  hasSocials: boolean;
  verified: boolean;
  audit?: JupTokenInfo["audit"];
  holderCount?: number;
  organicScore?: number;
  devWallet: string | null;
  devConfidence: DevIntel["confidence"];
  riskLevel: RiskLevel;
  riskFlags: string[];
  launchScore: number;
  heatScore: number;
  copycatSignal: boolean;
  profile?: DexTokenProfile;
};

type SnipePayload = {
  launches: SnipeLaunch[];
  devs: DevIntel[];
};

const WATCHED_DEVS_STORAGE = "og_scanner.v2.watched_devs";
const WATCHED_MINTS_STORAGE = "og_scanner.v2.watched_mints";
const DEFAULT_WATCHED_DEVS: string[] = [OGSCAN_DEV_WALLET];
const DEFAULT_WATCHED_MINTS: string[] = [OGSCAN_TOKEN_MINT];
const MAJOR_TICKERS = new Set<string>([
  "BONK",
  "WIF",
  "POPCAT",
  "MOG",
  "PEPE",
  "JUP",
  "PYTH",
  "WEN",
  "BOME",
  "FARTCOIN",
  "TRUMP",
  "MEW",
]);

function loadStringList(key: string): string[] {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function mergeDefaultWatchList(saved: string[], defaults: string[]): string[] {
  return Array.from(new Set([...defaults, ...saved])).slice(0, 80);
}

function saveStringList(key: string, value: string[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(value.slice(0, 80)));
  } catch {
    /* noop */
  }
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return (await response.json()) as T;
}

async function fetchProfilesAndBoosts(): Promise<{ profiles: DexTokenProfile[]; boosts: DexBoost[] }> {
  const [profilesResult, latestBoostsResult, topBoostsResult] = await Promise.allSettled([
    fetchJson<DexTokenProfile[]>("https://api.dexscreener.com/token-profiles/latest/v1"),
    fetchJson<DexBoost[]>("https://api.dexscreener.com/token-boosts/latest/v1"),
    fetchJson<DexBoost[]>("https://api.dexscreener.com/token-boosts/top/v1"),
  ]);

  const profiles = profilesResult.status === "fulfilled" ? profilesResult.value : [];
  const boosts = [
    ...(latestBoostsResult.status === "fulfilled" ? latestBoostsResult.value : []),
    ...(topBoostsResult.status === "fulfilled" ? topBoostsResult.value : []),
  ];

  return {
    profiles: profiles.filter((item) => item.chainId === "solana" && Boolean(item.tokenAddress)).slice(0, 80),
    boosts: boosts.filter((item) => item.chainId === "solana" && Boolean(item.tokenAddress)).slice(0, 80),
  };
}

async function fetchPairsForMints(mints: string[]): Promise<DexPair[]> {
  const chunks: string[][] = [];
  for (let index = 0; index < mints.length; index += 30) chunks.push(mints.slice(index, index + 30));

  const responses = await Promise.allSettled(
    chunks.map((chunk) => fetchJson<DexPair[]>(`https://api.dexscreener.com/tokens/v1/solana/${chunk.join(",")}`))
  );

  return responses.flatMap((response) => (response.status === "fulfilled" ? response.value : []));
}

function getTxns(pair: DexPair, bucket: "m5" | "h1" | "h24"): number {
  const value = pair.txns?.[bucket];
  return (value?.buys ?? 0) + (value?.sells ?? 0);
}

function dedupeBestPairs(pairs: DexPair[]): DexPair[] {
  const best = new Map<string, DexPair>();
  for (const pair of pairs) {
    const mint = pair.baseToken?.address;
    if (pair.chainId !== "solana" || !mint) continue;
    const previous = best.get(mint);
    const previousScore = (previous?.liquidity?.usd ?? 0) + (previous?.volume?.h24 ?? 0) * 0.4;
    const nextScore = (pair.liquidity?.usd ?? 0) + (pair.volume?.h24 ?? 0) * 0.4;
    if (!previous || nextScore >= previousScore) best.set(mint, pair);
  }
  return Array.from(best.values());
}

function creatorFromTransactions(txs: HeliusTx[]): { wallet: string | null; confidence: DevIntel["confidence"] } {
  const ordered = [...txs].sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0));
  const creationLike = ordered.find((tx) => /create|initialize|mint|pool|liquidity/i.test(`${tx.type} ${tx.description ?? ""}`));
  const chosen = creationLike ?? ordered[0] ?? txs[0];
  if (!chosen?.feePayer) return { wallet: null, confidence: "low" };
  return {
    wallet: chosen.feePayer,
    confidence: creationLike ? "high" : txs.length >= 3 ? "medium" : "low",
  };
}

async function fetchCreatorWallets(mints: string[]): Promise<Map<string, { wallet: string | null; confidence: DevIntel["confidence"] }>> {
  const targets = mints.slice(0, 12);
  const responses = await Promise.allSettled(
    targets.map(async (mint) => {
      const txs = await heliusTxs(mint, 8);
      return [mint, creatorFromTransactions(txs)] as const;
    })
  );
  const map = new Map<string, { wallet: string | null; confidence: DevIntel["confidence"] }>();
  for (const response of responses) {
    if (response.status === "fulfilled") map.set(response.value[0], response.value[1]);
  }
  return map;
}

function socialCount(profile: DexTokenProfile | undefined, pair: DexPair): number {
  return (profile?.links?.length ?? 0) + (pair.info?.websites?.length ?? 0) + (pair.info?.socials?.length ?? 0);
}

function buildRiskFlags(pair: DexPair, token: JupTokenInfo | undefined, profile: DexTokenProfile | undefined, duplicateSymbol: boolean): string[] {
  const flags: string[] = [];
  const liquidity = pair.liquidity?.usd ?? 0;
  const txns5m = getTxns(pair, "m5");
  const ageMinutes = pair.pairCreatedAt ? (Date.now() - pair.pairCreatedAt) / 60_000 : 999;
  const topHolders = token?.audit?.topHoldersPercentage;

  if (liquidity < 2_500) flags.push("thin liquidity");
  if (liquidity < 500) flags.push("dust pool");
  if (ageMinutes < 20) flags.push("brand new");
  if (txns5m < 3) flags.push("low tape");
  if (!token?.audit?.mintAuthorityDisabled) flags.push("mint auth open");
  if (!token?.audit?.freezeAuthorityDisabled) flags.push("freeze auth open");
  if (typeof topHolders === "number" && topHolders > 55) flags.push("holder concentration");
  if (socialCount(profile, pair) === 0) flags.push("no socials");
  if (duplicateSymbol || MAJOR_TICKERS.has((pair.baseToken?.symbol ?? "").toUpperCase())) flags.push("copycat watch");

  return Array.from(new Set(flags)).slice(0, 6);
}

function riskLevelFromFlags(flags: string[], launchScore: number): RiskLevel {
  if (flags.includes("dust pool") || flags.includes("mint auth open") || flags.includes("freeze auth open")) return "danger";
  if (flags.length >= 4 || launchScore < 35) return "risky";
  if (flags.length >= 2 || launchScore < 62) return "watch";
  return "clean";
}

function launchScore(pair: DexPair, token: JupTokenInfo | undefined, profile: DexTokenProfile | undefined, boost: DexBoost | undefined, duplicateSymbol: boolean): number {
  const liquidity = pair.liquidity?.usd ?? 0;
  const volume5m = pair.volume?.m5 ?? 0;
  const volume1h = pair.volume?.h1 ?? 0;
  const txns5m = getTxns(pair, "m5");
  const buys5m = pair.txns?.m5?.buys ?? 0;
  const sells5m = pair.txns?.m5?.sells ?? 0;
  const buyRatio = txns5m > 0 ? buys5m / Math.max(1, buys5m + sells5m) : 0.5;
  const ageHours = pair.pairCreatedAt ? Math.max(0, (Date.now() - pair.pairCreatedAt) / 3_600_000) : 48;
  const socials = socialCount(profile, pair);
  const boostAmount = boost?.amount ?? boost?.totalAmount ?? pair.boosts?.active ?? 0;

  let score = 36;
  score += Math.min(18, Math.log10(liquidity + 1) * 3.2);
  score += Math.min(16, Math.log10(volume5m + volume1h + 1) * 3.2);
  score += Math.min(13, txns5m * 1.3);
  score += Math.min(8, boostAmount * 0.18);
  score += Math.max(0, 12 - ageHours * 0.4);
  score += Math.min(7, socials * 2.4);
  score += Math.min(7, (token?.organicScore ?? 0) * 0.7);
  if (token?.isVerified) score += 7;
  if (token?.audit?.mintAuthorityDisabled) score += 4;
  if (token?.audit?.freezeAuthorityDisabled) score += 4;
  if (buyRatio > 0.62) score += 5;
  if ((token?.audit?.topHoldersPercentage ?? 0) > 55) score -= 14;
  if (liquidity < 2_500) score -= 16;
  if (!token?.audit?.mintAuthorityDisabled) score -= 12;
  if (!token?.audit?.freezeAuthorityDisabled) score -= 12;
  if (duplicateSymbol) score -= 10;

  return Math.max(0, Math.min(100, Math.round(score)));
}

function heatScore(pair: DexPair, boost: DexBoost | undefined): number {
  const ageHours = pair.pairCreatedAt ? Math.max(0.15, (Date.now() - pair.pairCreatedAt) / 3_600_000) : 12;
  const txns = getTxns(pair, "m5") * 120 + getTxns(pair, "h1") * 18;
  const volume = (pair.volume?.m5 ?? 0) * 0.8 + (pair.volume?.h1 ?? 0) * 0.18;
  const liquidity = (pair.liquidity?.usd ?? 0) * 0.035;
  const boostAmount = (boost?.amount ?? boost?.totalAmount ?? pair.boosts?.active ?? 0) * 40;
  const momentum = Math.max(0, pair.priceChange?.m5 ?? 0) * 150;
  return Math.round((txns + volume + liquidity + boostAmount + momentum) / Math.sqrt(ageHours));
}

function buildDevIntel(launches: SnipeLaunch[]): DevIntel[] {
  const grouped = new Map<string, SnipeLaunch[]>();
  for (const launch of launches) {
    if (!launch.devWallet) continue;
    const existing = grouped.get(launch.devWallet) ?? [];
    existing.push(launch);
    grouped.set(launch.devWallet, existing);
  }

  return Array.from(grouped.entries())
    .map(([wallet, items]) => {
      const wins = items.filter((item) => item.liquidity >= 10_000 && item.priceChange5m >= 0).length;
      const rugs = items.filter((item) => item.riskLevel === "danger" || item.liquidity < 1_000).length;
      const avgLiquidity = items.reduce((sum, item) => sum + item.liquidity, 0) / Math.max(1, items.length);
      const avgScore = items.reduce((sum, item) => sum + item.launchScore, 0) / Math.max(1, items.length);
      const score = Math.max(0, Math.min(100, Math.round(avgScore + wins * 7 - rugs * 12 + Math.log10(avgLiquidity + 1) * 4)));
      return {
        wallet,
        confidence: items.some((item) => item.devConfidence === "high") ? "high" : items.some((item) => item.devConfidence === "medium") ? "medium" : "low",
        launches: items.length,
        wins,
        rugs,
        avgLiquidity,
        score,
        lastSeenMs: Math.max(...items.map((item) => item.createdAtMs)),
      } satisfies DevIntel;
    })
    .sort((a, b) => b.score - a.score || b.launches - a.launches);
}

async function fetchSnipePayload(): Promise<SnipePayload> {
  const { profiles, boosts } = await fetchProfilesAndBoosts();
  const profileByMint = new Map<string, DexTokenProfile>();
  const boostByMint = new Map<string, DexBoost>();

  for (const profile of profiles) {
    if (profile.tokenAddress) profileByMint.set(profile.tokenAddress, profile);
  }
  for (const boost of boosts) {
    if (!boost.tokenAddress) continue;
    const previous = boostByMint.get(boost.tokenAddress);
    const previousAmount = previous?.amount ?? previous?.totalAmount ?? 0;
    const nextAmount = boost.amount ?? boost.totalAmount ?? 0;
    if (!previous || nextAmount >= previousAmount) boostByMint.set(boost.tokenAddress, boost);
  }

  const mints = Array.from(new Set([...profileByMint.keys(), ...boostByMint.keys()])).slice(0, 60);
  const pairs = dedupeBestPairs(await fetchPairsForMints(mints));
  const pairMints = pairs.map((pair) => pair.baseToken?.address).filter((mint): mint is string => Boolean(mint)).slice(0, 30);
  const [tokensResult, creators] = await Promise.allSettled([
    jupGetTokens(pairMints).then((tokens) => enrichTokensWithMarketIntel(tokens, { includeAth: true, maxAth: 12 })),
    fetchCreatorWallets(pairMints.slice(0, 12)),
  ]);

  const tokenByMint = new Map<string, JupTokenInfo>();
  if (tokensResult.status === "fulfilled") {
    for (const token of tokensResult.value) tokenByMint.set(token.id, token);
  }
  const creatorByMint = creators.status === "fulfilled" ? creators.value : new Map<string, { wallet: string | null; confidence: DevIntel["confidence"] }>();
  const symbolCounts = new Map<string, number>();
  for (const pair of pairs) {
    const symbol = (pair.baseToken?.symbol ?? "NEW").toUpperCase();
    symbolCounts.set(symbol, (symbolCounts.get(symbol) ?? 0) + 1);
  }

  const launches = pairs
    .map((pair) => {
      const mint = pair.baseToken?.address;
      if (!mint) return null;
      const profile = profileByMint.get(mint);
      const boost = boostByMint.get(mint);
      const token = tokenByMint.get(mint);
      const symbol = pair.baseToken?.symbol ?? token?.symbol ?? "NEW";
      const duplicateSymbol = (symbolCounts.get(symbol.toUpperCase()) ?? 0) > 1;
      const score = launchScore(pair, token, profile, boost, duplicateSymbol);
      const flags = buildRiskFlags(pair, token, profile, duplicateSymbol);
      const creator = creatorByMint.get(mint) ?? { wallet: null, confidence: "low" as const };
      const migrationCreatedAt = pair.pairCreatedAt ? new Date(pair.pairCreatedAt).toISOString() : token?.migrationCreatedAt ?? token?.firstPool?.createdAt;
      const createdAtMs = pair.pairCreatedAt ?? (migrationCreatedAt ? new Date(migrationCreatedAt).getTime() : Date.now());

      return {
        mint,
        name: pair.baseToken?.name ?? token?.name ?? profile?.description ?? "Fresh Solana token",
        symbol,
        icon: pair.info?.imageUrl ?? profile?.icon ?? token?.icon,
        dexUrl: pair.url ?? profile?.url ?? `https://dexscreener.com/solana/${mint}`,
        pairAddress: pair.pairAddress,
        createdAtMs,
        priceUsd: pair.priceUsd ? Number(pair.priceUsd) : token?.usdPrice,
        liquidity: pair.liquidity?.usd ?? token?.liquidity ?? 0,
        marketCap: pair.marketCap ?? token?.mcap,
        fdv: pair.fdv ?? token?.fdv,
        volume5m: pair.volume?.m5 ?? 0,
        volume1h: pair.volume?.h1 ?? 0,
        txns5m: getTxns(pair, "m5"),
        buys5m: pair.txns?.m5?.buys ?? 0,
        sells5m: pair.txns?.m5?.sells ?? 0,
        priceChange5m: pair.priceChange?.m5 ?? token?.stats5m?.priceChange ?? 0,
        priceChange1h: pair.priceChange?.h1 ?? token?.stats1h?.priceChange ?? 0,
        boostAmount: boost?.amount ?? boost?.totalAmount ?? pair.boosts?.active ?? 0,
        dexPaidAmount: token?.dexPaidAmount ?? boost?.totalAmount ?? boost?.amount,
        dexBoostTotalAmount: token?.dexBoostTotalAmount ?? boost?.totalAmount,
        dexBoostActive: token?.dexBoostActive ?? pair.boosts?.active,
        dexPaidOrderCount: token?.dexPaidOrderCount,
        dexApprovedOrderCount: token?.dexApprovedOrderCount,
        dexProfilePaid: token?.dexProfilePaid,
        dexCommunityTakeoverPaid: token?.dexCommunityTakeoverPaid,
        dexAdsPaid: token?.dexAdsPaid,
        dexFirstPaidAt: token?.dexFirstPaidAt,
        dexLastPaidAt: token?.dexLastPaidAt,
        allTimeHighUsd: token?.allTimeHighUsd,
        allTimeHighAt: token?.allTimeHighAt,
        allTimeLowUsd: token?.allTimeLowUsd,
        allTimeLowAt: token?.allTimeLowAt,
        migrationCreatedAt,
        hasSocials: socialCount(profile, pair) > 0,
        verified: Boolean(token?.isVerified),
        audit: token?.audit,
        holderCount: token?.holderCount,
        organicScore: token?.organicScore,
        devWallet: creator.wallet,
        devConfidence: creator.confidence,
        riskLevel: riskLevelFromFlags(flags, score),
        riskFlags: flags,
        launchScore: score,
        heatScore: heatScore(pair, boost),
        copycatSignal: flags.includes("copycat watch"),
        profile,
      } satisfies SnipeLaunch;
    })
    .filter((item): item is SnipeLaunch => Boolean(item))
    .sort((a, b) => b.heatScore - a.heatScore)
    .slice(0, 24);

  return { launches, devs: buildDevIntel(launches) };
}

function riskStyles(level: RiskLevel): { label: string; Icon: LucideIcon; className: string; bar: string } {
  if (level === "clean") return { label: "Clean", Icon: ShieldCheck, className: "border-og-lime/70 bg-og-lime/10 text-og-lime", bar: "bg-og-lime" };
  if (level === "watch") return { label: "Watch", Icon: Eye, className: "border-og-cyan/70 bg-og-cyan/10 text-og-cyan", bar: "bg-og-cyan" };
  if (level === "risky") return { label: "Risky", Icon: ShieldAlert, className: "border-og-gold/70 bg-og-gold/10 text-og-gold", bar: "bg-og-gold" };
  return { label: "Danger", Icon: Skull, className: "border-og-blood/70 bg-og-blood/10 text-og-blood", bar: "bg-og-blood" };
}

function scoreTone(score: number): string {
  if (score >= 75) return "text-og-lime";
  if (score >= 55) return "text-og-cyan";
  if (score >= 35) return "text-og-gold";
  return "text-og-blood";
}

function launchToToken(launch: SnipeLaunch): JupTokenInfo {
  return {
    id: launch.mint,
    name: launch.name,
    symbol: launch.symbol,
    icon: launch.icon,
    decimals: 0,
    usdPrice: launch.priceUsd,
    mcap: launch.marketCap,
    fdv: launch.fdv,
    liquidity: launch.liquidity,
    holderCount: launch.holderCount,
    organicScore: launch.organicScore,
    isVerified: launch.verified,
    stats24h: {
      priceChange: launch.priceChange1h,
      buyVolume: launch.volume1h > 0 ? launch.volume1h * (launch.buys5m / Math.max(1, launch.buys5m + launch.sells5m)) : undefined,
      sellVolume: launch.volume1h > 0 ? launch.volume1h * (launch.sells5m / Math.max(1, launch.buys5m + launch.sells5m)) : undefined,
      numBuys: launch.buys5m,
      numSells: launch.sells5m,
      numTraders: launch.txns5m,
    },
    stats1h: { priceChange: launch.priceChange1h },
    stats5m: { priceChange: launch.priceChange5m },
    audit: launch.audit,
    firstPool: launch.migrationCreatedAt ? { createdAt: launch.migrationCreatedAt } : undefined,
    allTimeHighUsd: launch.allTimeHighUsd,
    allTimeHighAt: launch.allTimeHighAt,
    allTimeLowUsd: launch.allTimeLowUsd,
    allTimeLowAt: launch.allTimeLowAt,
    migrationCreatedAt: launch.migrationCreatedAt,
    dexPaidAmount: launch.dexPaidAmount,
    dexBoostTotalAmount: launch.dexBoostTotalAmount,
    dexBoostActive: launch.dexBoostActive,
    dexPaidOrderCount: launch.dexPaidOrderCount,
    dexApprovedOrderCount: launch.dexApprovedOrderCount,
    dexProfilePaid: launch.dexProfilePaid,
    dexCommunityTakeoverPaid: launch.dexCommunityTakeoverPaid,
    dexAdsPaid: launch.dexAdsPaid,
    dexFirstPaidAt: launch.dexFirstPaidAt,
    dexLastPaidAt: launch.dexLastPaidAt,
    dexUrl: launch.dexUrl,
    pairAddress: launch.pairAddress,
  };
}

export const SnipeFeed = ({ onSelect }: Props) => {
  const [paused, setPaused] = useState<boolean>(false);
  const [selectedMint, setSelectedMint] = useState<string | null>(null);
  const [selectedDev, setSelectedDev] = useState<string | null>(null);
  const [copiedMint, setCopiedMint] = useState<string | null>(null);
  const [watchedDevs, setWatchedDevs] = useState<string[]>(() => mergeDefaultWatchList(loadStringList(WATCHED_DEVS_STORAGE), DEFAULT_WATCHED_DEVS));
  const [watchedMints, setWatchedMints] = useState<string[]>(() => mergeDefaultWatchList(loadStringList(WATCHED_MINTS_STORAGE), DEFAULT_WATCHED_MINTS));

  const { data, isFetching, error, dataUpdatedAt, refetch } = useQuery({
    queryKey: ["snipe-feed-v2"],
    queryFn: fetchSnipePayload,
    staleTime: 15_000,
    refetchInterval: paused ? false : 20_000,
  });

  const launches = data?.launches ?? [];
  const devs = data?.devs ?? [];
  const selectedLaunch = launches.find((launch) => launch.mint === selectedMint) ?? launches[0] ?? null;
  const selectedDevIntel = devs.find((dev) => dev.wallet === selectedDev) ?? (selectedLaunch?.devWallet ? devs.find((dev) => dev.wallet === selectedLaunch.devWallet) : null) ?? devs[0] ?? null;

  useEffect(() => {
    if (!selectedMint && launches[0]) setSelectedMint(launches[0].mint);
  }, [launches, selectedMint]);

  useEffect(() => {
    saveStringList(WATCHED_DEVS_STORAGE, watchedDevs);
  }, [watchedDevs]);

  useEffect(() => {
    saveStringList(WATCHED_MINTS_STORAGE, watchedMints);
  }, [watchedMints]);

  const summary = useMemo(() => {
    const hot = launches.filter((launch) => launch.launchScore >= 70).length;
    const blocked = launches.filter((launch) => launch.riskLevel === "danger" || launch.riskLevel === "risky").length;
    const avgHeat = launches.reduce((sum, launch) => sum + launch.heatScore, 0) / Math.max(1, launches.length);
    return { hot, blocked, avgHeat };
  }, [launches]);

  const alerts = useMemo(() => {
    const watchedDevSet = new Set(watchedDevs);
    const watchedMintSet = new Set(watchedMints);
    return launches
      .filter((launch) => watchedMintSet.has(launch.mint) || (launch.devWallet ? watchedDevSet.has(launch.devWallet) : false) || launch.launchScore >= 78 || launch.riskLevel === "danger")
      .slice(0, 8);
  }, [launches, watchedDevs, watchedMints]);

  const copyMint = useCallback((mint: string): void => {
    void copyTextToClipboard(mint).then((copied) => {
      if (copied) {
        setCopiedMint(mint);
        toast.success("CA copied", { description: shortAddr(mint, 8) });
        window.setTimeout(() => setCopiedMint(null), 1400);
        return;
      }

      window.prompt("Copy this contract address:", mint);
    });
  }, []);

  const toggleWatchMint = useCallback((mint: string): void => {
    setWatchedMints((current) => (current.includes(mint) ? current.filter((item) => item !== mint) : [mint, ...current].slice(0, 60)));
  }, []);

  const toggleWatchDev = useCallback((wallet: string | null): void => {
    if (!wallet) return;
    setWatchedDevs((current) => (current.includes(wallet) ? current.filter((item) => item !== wallet) : [wallet, ...current].slice(0, 60)));
  }, []);

  return (
    <section className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_0%,hsl(var(--og-cyan)/0.18),transparent_32%),radial-gradient(circle_at_95%_18%,hsl(var(--og-lime)/0.14),transparent_30%)]" />
      <div className="relative">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-2 text-[10px] uppercase tracking-[0.4em] text-og-cyan">
              <span className="h-px w-10 bg-og-cyan" /> /V2 · SNIPE · RADAR
            </div>
            <h2 className="font-display text-3xl font-bold tracking-tight sm:text-5xl">
              <span className="text-foreground">DEV WALLET</span>{" "}
              <span className="text-og-cyan text-glow">SNIPER FEED</span>
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
              Tracks fresh Solana launches, scores the tape, flags danger signals, and groups coins by likely creator wallet. The official OGScan dev wallet and coin are pinned into watch alerts by default.
            </p>
          </div>

          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest">
            <button
              type="button"
              onClick={() => setPaused((value) => !value)}
              className={cn(
                "inline-flex items-center gap-1.5 border px-2.5 py-1.5 transition",
                paused ? "border-og-blood/70 text-og-blood" : "border-og-lime/70 text-og-lime"
              )}
            >
              {paused ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
              {paused ? "Paused" : "Live"}
            </button>
            <button
              type="button"
              onClick={() => void refetch()}
              className="inline-flex items-center gap-1.5 border border-og-grid px-2.5 py-1.5 text-foreground/70 transition hover:border-og-cyan hover:text-og-cyan"
            >
              {isFetching ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
              Refresh
            </button>
          </div>
        </div>

        <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard Icon={Radar} label="Live launches" value={fmtNum(launches.length)} detail="Dex profiles + boosts" tone="cyan" />
          <SummaryCard Icon={Flame} label="Hot opportunities" value={fmtNum(summary.hot)} detail="70+ launch score" tone="lime" />
          <SummaryCard Icon={ShieldAlert} label="Risk blocked" value={fmtNum(summary.blocked)} detail="risky / danger" tone="blood" />
          <SummaryCard Icon={UserSearch} label="Tracked devs" value={fmtNum(watchedDevs.length)} detail={`heat ${fmtNum(summary.avgHeat)}`} tone="gold" />
        </div>

        {error ? (
          <div className="mb-4 border border-og-blood/50 bg-og-blood/10 p-4 text-sm text-og-blood">
            Snipe feed could not load right now. DexScreener or RPC may be rate-limited — tap refresh in a moment.
          </div>
        ) : null}

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.65fr)]">
          <div className="overflow-hidden border border-og-grid bg-og-ink/82 shadow-[0_0_0_1px_hsl(var(--og-cyan)/0.18),0_34px_120px_-70px_hsl(var(--og-cyan))]">
            <div className="flex flex-col gap-3 border-b border-og-grid bg-og-ink/95 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.32em] text-og-cyan">
                <Crosshair className="h-3.5 w-3.5" /> Snipe feed · newest heat first
              </div>
              <div className="font-mono text-[9px] uppercase tracking-[0.24em] text-muted-foreground">
                Updated {dataUpdatedAt ? timeAgo(Math.floor(dataUpdatedAt / 1000)) : "—"} ago
              </div>
            </div>

            <div className="grid gap-2 p-3">
              {isFetching && launches.length === 0 ? (
                <div className="grid min-h-[280px] place-items-center border border-dashed border-og-grid text-og-cyan">
                  <div className="text-center font-mono text-[10px] uppercase tracking-[0.3em]">
                    <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin" /> Loading launch radar
                  </div>
                </div>
              ) : null}

              {launches.map((launch) => (
                <LaunchRow
                  key={launch.mint}
                  launch={launch}
                  selected={selectedLaunch?.mint === launch.mint}
                  watchedMint={watchedMints.includes(launch.mint)}
                  watchedDev={launch.devWallet ? watchedDevs.includes(launch.devWallet) : false}
                  copied={copiedMint === launch.mint}
                  onSelect={() => {
                    setSelectedMint(launch.mint);
                    if (launch.devWallet) setSelectedDev(launch.devWallet);
                  }}
                  onScan={() => onSelect(launch.mint)}
                  onCopy={() => copyMint(launch.mint)}
                  onWatchMint={() => toggleWatchMint(launch.mint)}
                  onWatchDev={() => toggleWatchDev(launch.devWallet)}
                />
              ))}
            </div>
          </div>

          <aside className="grid gap-4 content-start">
            <LaunchAnalyzer launch={selectedLaunch} watched={selectedLaunch ? watchedMints.includes(selectedLaunch.mint) : false} onCopy={copyMint} onScan={onSelect} onWatchMint={toggleWatchMint} />
            <DevIntelPanel dev={selectedDevIntel} launches={launches} watched={selectedDevIntel?.wallet ? watchedDevs.includes(selectedDevIntel.wallet) : false} onWatch={toggleWatchDev} onSelectDev={setSelectedDev} />
            <AlertsPanel alerts={alerts} watchedDevs={watchedDevs} watchedMints={watchedMints} onSelect={(launch) => setSelectedMint(launch.mint)} />
          </aside>
        </div>
      </div>
    </section>
  );
};

const SummaryCard = ({ Icon, label, value, detail, tone }: { Icon: LucideIcon; label: string; value: string; detail: string; tone: "cyan" | "lime" | "gold" | "blood" }) => {
  const toneClass = tone === "lime" ? "text-og-lime border-og-lime/45 bg-og-lime/10" : tone === "gold" ? "text-og-gold border-og-gold/45 bg-og-gold/10" : tone === "blood" ? "text-og-blood border-og-blood/45 bg-og-blood/10" : "text-og-cyan border-og-cyan/45 bg-og-cyan/10";
  return (
    <div className={cn("border bg-og-ink/78 p-4", toneClass)}>
      <div className="flex items-center justify-between gap-2">
        <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-muted-foreground">{label}</div>
        <Icon className="h-4 w-4" />
      </div>
      <div className="mt-3 font-display text-3xl font-black tracking-tight text-foreground">{value}</div>
      <div className="mt-1 font-mono text-[10px] uppercase tracking-widest opacity-80">{detail}</div>
    </div>
  );
};

const LaunchRow = ({
  launch,
  selected,
  watchedMint,
  watchedDev,
  copied,
  onSelect,
  onScan,
  onCopy,
  onWatchMint,
  onWatchDev,
}: {
  launch: SnipeLaunch;
  selected: boolean;
  watchedMint: boolean;
  watchedDev: boolean;
  copied: boolean;
  onSelect: () => void;
  onScan: () => void;
  onCopy: () => void;
  onWatchMint: () => void;
  onWatchDev: () => void;
}) => {
  const risk = riskStyles(launch.riskLevel);
  const RiskIcon = risk.Icon;
  const ageSeconds = Math.floor(launch.createdAtMs / 1000);
  const dexPaid = tokenDexPaidLabel(launch);
  const detailToken: JupTokenInfo = launchToToken(launch);
  return (
    <article
      className={cn(
        "group relative overflow-hidden border bg-background/35 p-3 transition hover:border-og-cyan/70 hover:bg-og-cyan/5",
        selected ? "border-og-cyan/80 shadow-[inset_4px_0_0_hsl(var(--og-cyan))]" : "border-og-grid"
      )}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-og-cyan/70 to-transparent opacity-0 transition group-hover:opacity-100" />
      <button type="button" onClick={onSelect} className="absolute inset-0 z-0 cursor-crosshair" aria-label={`Inspect ${launch.symbol}`} />
      <div className="pointer-events-none relative z-10 grid gap-3 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-center">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden border border-og-grid bg-og-ink text-og-cyan">
              {launch.icon ? <img src={launch.icon} alt="" className="h-full w-full object-cover" /> : <Sparkles className="h-5 w-5" />}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="truncate font-display text-lg font-black uppercase tracking-tight text-foreground">${launch.symbol}</h3>
                <span className={cn("inline-flex items-center gap-1 border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest", risk.className)}>
                  <RiskIcon className="h-3 w-3" /> {risk.label}
                </span>
                {watchedMint ? <span className="border border-og-lime/50 bg-og-lime/10 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest text-og-lime">watched</span> : null}
              </div>
              <div className="mt-1 truncate text-xs text-muted-foreground">{launch.name}</div>
              <div className="mt-2 flex flex-wrap items-center gap-2 font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
                <span className="text-og-cyan">{timeAgo(ageSeconds)} old</span>
                <span>CA {shortAddr(launch.mint, 4)}</span>
                <span>DEV {shortAddr(launch.devWallet ?? undefined, 4)}</span>
                <span>MIGR {shortDate(launch.migrationCreatedAt)}</span>
                <span>DEX {dexPaid}</span>
                {launch.dexCommunityTakeoverPaid ? <span className="text-og-gold">CTO paid</span> : null}
                {watchedDev ? <span className="text-og-lime">dev watched</span> : null}
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <Metric label="Score" value={String(launch.launchScore)} className={scoreTone(launch.launchScore)} />
          <Metric label="ATH" value={fmtUsd(launch.allTimeHighUsd)} className="text-og-gold" />
          <Metric label="ATH Date" value={shortDate(launch.allTimeHighAt)} className="text-og-gold" />
          <Metric label="ATL" value={fmtUsd(launch.allTimeLowUsd)} className="text-og-cyan" />
          <Metric label="Migr" value={shortDate(launch.migrationCreatedAt)} className="text-og-cyan" />
          <Metric label="DEX" value={dexPaid} className={dexPaid === "—" ? "text-foreground" : "text-og-lime"} />
        </div>
      </div>

      <div className="pointer-events-none relative z-10 mt-3 flex flex-wrap items-center gap-2 border-t border-og-grid/80 pt-3">
        {launch.riskFlags.slice(0, 4).map((flag) => (
          <span key={flag} className="border border-og-grid bg-og-ink/75 px-2 py-1 font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
            {flag}
          </span>
        ))}
        <div className="pointer-events-auto ml-auto flex flex-wrap items-center gap-2">
          <button type="button" onClick={(event) => { event.stopPropagation(); onCopy(); }} className="inline-flex min-h-9 items-center gap-1.5 border border-og-gold/55 bg-og-gold/10 px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-widest text-og-gold transition hover:bg-og-gold hover:text-og-ink">
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} {copied ? "copied" : "copy CA"}
          </button>
          <button type="button" onClick={(event) => { event.stopPropagation(); onWatchDev(); }} disabled={!launch.devWallet} className="inline-flex min-h-9 items-center gap-1 border border-og-grid px-3 py-2 font-mono text-[9px] uppercase tracking-widest text-foreground/70 transition enabled:hover:border-og-lime enabled:hover:text-og-lime disabled:opacity-40">
            <UserSearch className="h-3 w-3" /> {watchedDev ? "unwatch dev" : "watch dev"}
          </button>
          <button type="button" onClick={(event) => { event.stopPropagation(); onWatchMint(); }} className="inline-flex min-h-9 items-center gap-1 border border-og-grid px-3 py-2 font-mono text-[9px] uppercase tracking-widest text-foreground/70 transition hover:border-og-lime hover:text-og-lime">
            <Bell className="h-3 w-3" /> {watchedMint ? "unwatch" : "watch"}
          </button>
          <CoinDetailDialog token={detailToken} onOpenScanner={() => onScan()} actionLabel="Scan" className="min-h-9 px-3 py-2" />
          <button type="button" onClick={(event) => { event.stopPropagation(); onScan(); }} className="inline-flex min-h-9 items-center gap-1 border border-og-cyan/60 px-3 py-2 font-mono text-[9px] uppercase tracking-widest text-og-cyan transition hover:bg-og-cyan hover:text-og-ink">
            <Target className="h-3 w-3" /> scan
          </button>
          <a href={launch.dexUrl} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()} className="inline-flex min-h-9 items-center gap-1 border border-og-grid px-3 py-2 font-mono text-[9px] uppercase tracking-widest text-foreground/70 transition hover:border-og-cyan hover:text-og-cyan">
            chart <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>
    </article>
  );
};

const Metric = ({ label, value, className }: { label: string; value: string; className?: string }) => (
  <div className="border border-og-grid bg-og-ink/80 px-2 py-1.5">
    <div className="font-mono text-[8px] uppercase tracking-[0.24em] text-muted-foreground">{label}</div>
    <div className={cn("mt-1 truncate font-mono text-[11px] font-bold", className)}>{value}</div>
  </div>
);

const LaunchAnalyzer = ({ launch, watched, onCopy, onScan, onWatchMint }: { launch: SnipeLaunch | null; watched: boolean; onCopy: (mint: string) => void; onScan: (mint: string) => void; onWatchMint: (mint: string) => void }) => {
  if (!launch) {
    return <div className="border border-og-grid bg-og-ink/78 p-4 text-sm text-muted-foreground">Waiting for launch data…</div>;
  }
  const risk = riskStyles(launch.riskLevel);
  const RiskIcon = risk.Icon;
  const detailToken: JupTokenInfo = launchToToken(launch);
  return (
    <div className="border border-og-cyan/45 bg-og-ink/82 p-4 shadow-[inset_4px_0_0_hsl(var(--og-cyan)/0.55)]">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.28em] text-og-cyan">
          <Gauge className="h-3.5 w-3.5" /> Launch analyzer
        </div>
        <span className={cn("inline-flex items-center gap-1 border px-2 py-1 font-mono text-[9px] uppercase tracking-widest", risk.className)}>
          <RiskIcon className="h-3 w-3" /> {risk.label}
        </span>
      </div>

      <div className="flex items-start gap-3">
        <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden border border-og-grid bg-background text-og-cyan">
          {launch.icon ? <img src={launch.icon} alt="" className="h-full w-full object-cover" /> : <Zap className="h-5 w-5" />}
        </div>
        <div className="min-w-0">
          <h3 className="truncate font-display text-2xl font-black uppercase tracking-tight text-foreground">${launch.symbol}</h3>
          <div className="truncate text-xs text-muted-foreground">{launch.name}</div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Metric label="Launch score" value={`${launch.launchScore}/100`} className={scoreTone(launch.launchScore)} />
        <Metric label="ATH" value={fmtUsd(launch.allTimeHighUsd)} className="text-og-gold" />
        <Metric label="ATH date" value={shortDate(launch.allTimeHighAt)} className="text-og-gold" />
        <Metric label="ATL" value={fmtUsd(launch.allTimeLowUsd)} className="text-og-cyan" />
        <Metric label="Migration" value={shortDate(launch.migrationCreatedAt)} className="text-og-cyan" />
        <Metric label="DEX paid" value={tokenDexPaidLabel(launch)} className={tokenDexPaidLabel(launch) === "—" ? "text-foreground" : "text-og-lime"} />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Metric label="Orders" value={`${fmtNum(launch.dexApprovedOrderCount ?? 0)}/${fmtNum(launch.dexPaidOrderCount ?? 0)}`} className={(launch.dexApprovedOrderCount ?? 0) > 0 ? "text-og-lime" : "text-foreground"} />
        <Metric label="Last paid" value={shortDate(launch.dexLastPaidAt)} className={launch.dexLastPaidAt ? "text-og-gold" : "text-foreground"} />
      </div>

      <div className="mt-4 space-y-2">
        <SignalLine label="Mint authority" ok={Boolean(launch.audit?.mintAuthorityDisabled)} good="disabled" bad="open" />
        <SignalLine label="Freeze authority" ok={Boolean(launch.audit?.freezeAuthorityDisabled)} good="disabled" bad="open" />
        <SignalLine label="Social proof" ok={launch.hasSocials} good="links found" bad="missing" />
        <SignalLine label="Copycat check" ok={!launch.copycatSignal} good="clear" bad="watch" />
        <SignalLine label="DEX boost" ok={tokenDexPaidLabel(launch) !== "—"} good={tokenDexPaidLabel(launch)} bad="none public" />
        <SignalLine label="CTO order" ok={launch.dexCommunityTakeoverPaid === true} good="paid / public" bad="not public" />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={() => onScan(launch.mint)} className="inline-flex flex-1 items-center justify-center gap-1 border border-og-cyan bg-og-cyan px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-widest text-og-ink transition hover:bg-transparent hover:text-og-cyan">
          <Target className="h-3.5 w-3.5" /> scan token
        </button>
        <CoinDetailDialog token={detailToken} onOpenScanner={() => onScan(launch.mint)} actionLabel="Scan" className="px-3 py-2" />
        <button type="button" onClick={() => onWatchMint(launch.mint)} className="inline-flex items-center justify-center gap-1 border border-og-grid px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-foreground/70 transition hover:border-og-lime hover:text-og-lime">
          <Bell className="h-3.5 w-3.5" /> {watched ? "watching" : "watch"}
        </button>
        <button type="button" onClick={() => onCopy(launch.mint)} className="inline-flex items-center justify-center gap-1 border border-og-gold/55 bg-og-gold/10 px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-widest text-og-gold transition hover:bg-og-gold hover:text-og-ink">
          <Copy className="h-3.5 w-3.5" /> copy CA
        </button>
      </div>
    </div>
  );
};

const SignalLine = ({ label, ok, good, bad }: { label: string; ok: boolean; good: string; bad: string }) => (
  <div className="flex items-center justify-between border border-og-grid bg-background/35 px-3 py-2 font-mono text-[10px] uppercase tracking-widest">
    <span className="text-muted-foreground">{label}</span>
    <span className={ok ? "text-og-lime" : "text-og-blood"}>{ok ? good : bad}</span>
  </div>
);

const DevIntelPanel = ({ dev, launches, watched, onWatch, onSelectDev }: { dev: DevIntel | null; launches: SnipeLaunch[]; watched: boolean; onWatch: (wallet: string | null) => void; onSelectDev: (wallet: string | null) => void }) => {
  const devLaunches = dev?.wallet ? launches.filter((launch) => launch.devWallet === dev.wallet).slice(0, 4) : [];
  return (
    <div className="border border-og-lime/40 bg-og-ink/82 p-4 shadow-[inset_4px_0_0_hsl(var(--og-lime)/0.45)]">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.28em] text-og-lime">
          <UserSearch className="h-3.5 w-3.5" /> Dev wallet intel
        </div>
        <button type="button" onClick={() => onWatch(dev?.wallet ?? null)} disabled={!dev?.wallet} className="inline-flex items-center gap-1 border border-og-grid px-2 py-1 font-mono text-[9px] uppercase tracking-widest text-foreground/70 transition enabled:hover:border-og-lime enabled:hover:text-og-lime disabled:opacity-40">
          <Star className="h-3 w-3" /> {watched ? "tracked" : "track"}
        </button>
      </div>

      {dev?.wallet ? (
        <>
          <div className="border border-og-grid bg-background/35 p-3">
            <div className="flex items-center gap-2 text-og-lime">
              <Wallet className="h-4 w-4" />
              <span className="font-mono text-xs font-bold">{shortAddr(dev.wallet, 7)}</span>
            </div>
            <div className="mt-2 grid grid-cols-4 gap-2">
              <Metric label="Score" value={`${dev.score}`} className={scoreTone(dev.score)} />
              <Metric label="Launches" value={fmtNum(dev.launches)} className="text-foreground" />
              <Metric label="Wins" value={fmtNum(dev.wins)} className="text-og-lime" />
              <Metric label="Rugs" value={fmtNum(dev.rugs)} className="text-og-blood" />
            </div>
            <div className="mt-2 font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
              confidence {dev.confidence} · avg liq <span className="text-og-cyan">{fmtUsd(dev.avgLiquidity)}</span>
            </div>
          </div>

          <div className="mt-3 grid gap-2">
            {devLaunches.map((launch) => (
              <button key={launch.mint} type="button" onClick={() => onSelectDev(launch.devWallet)} className="flex items-center justify-between gap-2 border border-og-grid bg-background/35 px-3 py-2 text-left transition hover:border-og-lime/60">
                <span className="min-w-0">
                  <span className="block truncate font-mono text-[11px] font-bold text-foreground">${launch.symbol}</span>
                  <span className="block font-mono text-[9px] uppercase tracking-widest text-muted-foreground">{fmtUsd(launch.liquidity)} · MIGR {shortDate(launch.migrationCreatedAt)} · DEX {tokenDexPaidLabel(launch)}</span>
                </span>
                <span className={cn("font-mono text-[11px] font-bold", scoreTone(launch.launchScore))}>{launch.launchScore}</span>
              </button>
            ))}
          </div>
        </>
      ) : (
        <div className="border border-dashed border-og-grid p-4 text-xs leading-relaxed text-muted-foreground">
          Select a launch with creator data. The app estimates the creator wallet from early mint / pool transactions and groups repeat launches.
        </div>
      )}
    </div>
  );
};

const AlertsPanel = ({ alerts, watchedDevs, watchedMints, onSelect }: { alerts: SnipeLaunch[]; watchedDevs: string[]; watchedMints: string[]; onSelect: (launch: SnipeLaunch) => void }) => (
  <div className="border border-og-gold/40 bg-og-ink/82 p-4 shadow-[inset_4px_0_0_hsl(var(--og-gold)/0.38)]">
    <div className="mb-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.28em] text-og-gold">
      <Bell className="h-3.5 w-3.5" /> Watchlist + alerts
    </div>
    <div className="mb-3 grid grid-cols-2 gap-2">
      <Metric label="Dev wallets" value={fmtNum(watchedDevs.length)} className="text-og-lime" />
      <Metric label="Coins" value={fmtNum(watchedMints.length)} className="text-og-cyan" />
    </div>
    <div className="grid gap-2">
      {alerts.length ? alerts.map((launch) => {
        const isDanger = launch.riskLevel === "danger";
        return (
          <button key={`${launch.mint}-alert`} type="button" onClick={() => onSelect(launch)} className="flex items-center gap-2 border border-og-grid bg-background/35 px-3 py-2 text-left transition hover:border-og-gold/70">
            {isDanger ? <AlertTriangle className="h-4 w-4 shrink-0 text-og-blood" /> : <TrendingUp className="h-4 w-4 shrink-0 text-og-lime" />}
            <span className="min-w-0 flex-1">
              <span className="block truncate font-mono text-[11px] font-bold uppercase text-foreground">${launch.symbol} · {isDanger ? "risk warning" : "hot launch"}</span>
              <span className="block truncate font-mono text-[9px] uppercase tracking-widest text-muted-foreground">score {launch.launchScore} · ATH {fmtUsd(launch.allTimeHighUsd)} {shortDate(launch.allTimeHighAt)} · ATL {fmtUsd(launch.allTimeLowUsd)} · DEX {tokenDexPaidLabel(launch)}</span>
            </span>
          </button>
        );
      }) : (
        <div className="border border-dashed border-og-grid p-4 text-xs leading-relaxed text-muted-foreground">
          Track dev wallets or coins to create a return-worthy alert center. Hot 78+ scores and danger launches also surface here automatically.
        </div>
      )}
    </div>
  </div>
);

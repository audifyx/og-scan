import { memo, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  ArrowUpRight,
  BadgeDollarSign,
  Bell,
  CandlestickChart,
  Coins,
  ExternalLink,
  Flame,
  Layers3,
  Loader2,
  ShieldCheck,
  Sparkles,
  Users,
  Wallet,
} from "lucide-react";
import { CopyMintButton } from "@/components/CopyMintButton";
import { OurCoinBuyFeed } from "@/components/OurCoinBuyFeed";
import { TxFeed } from "@/components/TxFeed";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import {
  OGSCAN_DEXSCREENER_URL,
  OGSCAN_PUMPFUN_URL,
  OGSCAN_SITE_URL,
  OGSCAN_TOKEN_MINT,
  OGSCAN_X_URL,
  OGSCAN_DEV_WALLET,
  dexScreenerChartUrl,
  dexScreenerEmbedUrl,
  enrichTokensWithMarketIntel,
  fmtNum,
  fmtPct,
  fmtUsd,
  hasPulledOrDeadLiquidity,
  HELIUS_API_KEY,
  jupGetTokens,
  shortAddr,
  shortDate,
  tokenDexPaidLabel,
  tokenEffectiveLiquidityUsd,
  tokenMigrationDateIso,
  tokenOgCreatedAtIso,
  type JupTokenInfo,
} from "@/lib/og";
import { cn } from "@/lib/utils";

type DetailDexPair = {
  chainId?: string;
  dexId?: string;
  url?: string;
  pairAddress?: string;
  baseToken?: { address?: string; name?: string; symbol?: string };
  quoteToken?: { address?: string; name?: string; symbol?: string };
  priceUsd?: string;
  priceChange?: { m5?: number; h1?: number; h24?: number };
  liquidity?: { usd?: number; base?: number; quote?: number };
  volume?: { h24?: number };
  txns?: {
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

const BRAND_BANNER = "/ogscan-our-coin-banner.webp";
const BRAND_LOGO = "/ogscan-our-coin-logo.webp";

async function fetchDexPairs(mint: string): Promise<DetailDexPair[]> {
  const response = await fetch(`https://api.dexscreener.com/tokens/v1/solana/${encodeURIComponent(mint)}`);
  if (!response.ok) return [];
  const json = (await response.json()) as DetailDexPair[];
  return Array.isArray(json) ? json : [];
}

function bestPair(pairs: DetailDexPair[]): DetailDexPair | undefined {
  return [...pairs].sort((a, b) => {
    const aScore = (a.liquidity?.usd ?? 0) + (a.volume?.h24 ?? 0) * 0.35 + (a.txns?.h24?.buys ?? 0) * 12;
    const bScore = (b.liquidity?.usd ?? 0) + (b.volume?.h24 ?? 0) * 0.35 + (b.txns?.h24?.buys ?? 0) * 12;
    return bScore - aScore;
  })[0];
}

function websiteLinks(pair: DetailDexPair | undefined): { label: string; url: string }[] {
  const raw = [
    { label: "OG Scan", url: OGSCAN_SITE_URL },
    { label: "DexScreener", url: OGSCAN_DEXSCREENER_URL },
    { label: "Pump.fun", url: OGSCAN_PUMPFUN_URL },
    { label: "Updates", url: OGSCAN_X_URL },
    ...((pair?.info?.websites ?? []).filter((site): site is { url: string; label?: string } => Boolean(site.url)).map((site) => ({ label: site.label ?? "Website", url: site.url }))),
    ...((pair?.info?.socials ?? []).filter((site): site is { url: string; type?: string } => Boolean(site.url)).map((site) => ({ label: site.type ?? "Social", url: site.url }))),
  ];

  const seen = new Set<string>();
  return raw.filter((item) => !seen.has(item.url) && seen.add(item.url)).slice(0, 6);
}

const panelClass = "border border-og-grid bg-black/55 backdrop-blur-sm";

export const OurCoin = memo(() => {
  const { permission, isRegistered, requestPermission, isSyncing } = usePushNotifications();

  const { data: dexPairs = [], isLoading: pairsLoading } = useQuery({
    queryKey: ["our-coin-dex-pairs", OGSCAN_TOKEN_MINT],
    queryFn: () => fetchDexPairs(OGSCAN_TOKEN_MINT),
    refetchInterval: 30_000,
    staleTime: 20_000,
  });

  const pair = useMemo(() => bestPair(dexPairs), [dexPairs]);

  const { data: token, isLoading: tokenLoading } = useQuery({
    queryKey: ["our-coin-token-intel", OGSCAN_TOKEN_MINT, pair?.pairAddress ?? "none"],
    queryFn: async (): Promise<JupTokenInfo | null> => {
      const jupTokens = await jupGetTokens([OGSCAN_TOKEN_MINT]);
      const base = jupTokens[0] ?? {
        id: OGSCAN_TOKEN_MINT,
        chainId: "solana",
        name: pair?.baseToken?.name ?? "OUR COIN",
        symbol: pair?.baseToken?.symbol ?? "OUR",
        decimals: 6,
      };
      const enriched = await enrichTokensWithMarketIntel([base], { includeAth: true, includeOnChainIntel: true, maxOnChain: 1, maxBirdeye: 1 });
      return enriched[0] ?? base;
    },
    enabled: true,
    refetchInterval: 60_000,
    staleTime: 45_000,
  });

  const chartUrl = dexScreenerChartUrl({
    id: OGSCAN_TOKEN_MINT,
    chainId: "solana",
    dexUrl: pair?.url,
    pairAddress: pair?.pairAddress,
  });
  const chartEmbedUrl = dexScreenerEmbedUrl(chartUrl);

  const priceUsd = pair?.priceUsd ? Number(pair.priceUsd) : token?.usdPrice;
  const marketCap = token?.mcap ?? pair?.marketCap;
  const fdv = token?.fdv ?? pair?.fdv;
  const liquidity = token ? tokenEffectiveLiquidityUsd(token) : pair?.liquidity?.usd;
  const change24 = pair?.priceChange?.h24 ?? token?.stats24h?.priceChange ?? 0;
  const change1h = pair?.priceChange?.h1 ?? token?.stats1h?.priceChange ?? 0;
  const volume24 = pair?.volume?.h24 ?? ((token?.stats24h?.buyVolume ?? 0) + (token?.stats24h?.sellVolume ?? 0));
  const buys24 = pair?.txns?.h24?.buys ?? token?.stats24h?.numBuys ?? 0;
  const sells24 = pair?.txns?.h24?.sells ?? token?.stats24h?.numSells ?? 0;
  const total24 = buys24 + sells24;
  const buyPct = total24 > 0 ? Math.round((buys24 / total24) * 100) : 0;
  const athPrice = token?.allTimeHighUsd;
  const athMcap = token?.allTimeHighMarketCap;
  const createdAt = token ? tokenOgCreatedAtIso(token) : undefined;
  const migratedAt = token ? tokenMigrationDateIso(token) : undefined;
  const migrated = Boolean(migratedAt || pair?.pairCreatedAt || token?.pumpFun?.complete);
  const migrationProgress = migrated ? 100 : Math.max(18, Math.min(92, buyPct || 32));
  const lpLooksHealthy = token ? !hasPulledOrDeadLiquidity(token) : (pair?.liquidity?.usd ?? 0) > 1_000;
  const holderCount = token?.holderCount ?? 0;
  const whaleCount = token?.whaleCount ?? 0;
  const dexPaid = token ? tokenDexPaidLabel(token) : "Watching";
  const loading = pairsLoading || tokenLoading;
  const links = websiteLinks(pair);
  const featurePills = ["Launch Tracker", "Smart Scanner", "Trading Tools", "Spaces & Communities", "Real-Time Alpha"];

  return (
    <section className="space-y-5 text-white">
      <div className="overflow-hidden border border-og-lime/35 bg-black shadow-[0_0_40px_rgba(101,255,0,0.08)]">
        <div className="relative isolate overflow-hidden border-b border-og-grid">
          <img src={BRAND_BANNER} alt="OG Scan OUR COIN banner" className="absolute inset-0 h-full w-full object-cover opacity-65" />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(0,0,0,0.88)_0%,rgba(0,0,0,0.55)_38%,rgba(0,0,0,0.76)_100%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_center,rgba(187,79,255,0.22),transparent_34%),radial-gradient(circle_at_right_center,rgba(101,255,0,0.16),transparent_30%)]" />

          <div className="relative grid gap-6 px-4 py-5 sm:px-6 lg:grid-cols-[180px_minmax(0,1fr)_320px] lg:px-8 lg:py-8">
            <div className="flex flex-col gap-3">
              <div className="border border-og-lime/35 bg-black/70 p-2">
                <img src={BRAND_LOGO} alt="OG Scan logo" className="aspect-square w-full object-cover" />
              </div>
              <div className="border border-white/10 bg-black/70 p-3">
                <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-og-lime">Official mint</div>
                <div className="mt-2 font-mono text-[11px] text-white/80">{shortAddr(OGSCAN_TOKEN_MINT, 8)}</div>
                <CopyMintButton mint={OGSCAN_TOKEN_MINT} className="mt-3 h-10 w-full px-3 text-[10px]" />
              </div>
            </div>

            <div>
              <div className="inline-flex items-center gap-2 border border-og-gold/35 bg-black/70 px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.26em] text-og-gold">
                <Flame className="h-3.5 w-3.5" /> Official OUR COIN room
              </div>
              <h1 className="mt-4 font-display text-4xl font-black uppercase leading-none tracking-tight text-white sm:text-6xl lg:text-7xl">
                OUR COIN
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-relaxed text-white/82 sm:text-base">
                Custom OG Scan market room built from your banner and logo art — live price chart, buy and sell flow, token metadata, ATH, migration status, and full scan analysis for the official mint.
              </p>

              <div className="mt-5 flex flex-wrap gap-2">
                {featurePills.map((pill) => (
                  <div key={pill} className="border border-white/10 bg-black/60 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.22em] text-white/80">
                    {pill}
                  </div>
                ))}
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-2">
                <a
                  href={OGSCAN_DEXSCREENER_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-11 items-center gap-2 border border-og-lime bg-og-lime px-4 font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-black transition hover:bg-og-lime/90"
                >
                  Open chart <ExternalLink className="h-3.5 w-3.5" />
                </a>
                <a
                  href={OGSCAN_PUMPFUN_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-11 items-center gap-2 border border-og-gold bg-og-gold px-4 font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-black transition hover:bg-og-gold/90"
                >
                  Pump.fun <ExternalLink className="h-3.5 w-3.5" />
                </a>
                {links.slice(0, 2).map((link) => (
                  <a
                    key={link.url}
                    href={link.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-11 items-center gap-2 border border-white/10 bg-black/65 px-4 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-white/80 transition hover:border-og-cyan hover:text-og-cyan"
                  >
                    {link.label} <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                ))}
              </div>
            </div>

            <div className="grid gap-3 self-end">
              <SignalCard label="Price" value={loading ? "Loading…" : fmtUsd(priceUsd)} Icon={CandlestickChart} tone="lime" />
              <SignalCard label="24h buy pressure" value={loading ? "Loading…" : `${buyPct}% buys`} Icon={Activity} tone="gold" />
              <SignalCard label="Migration" value={migrated ? "DEX live" : "Monitoring"} Icon={Layers3} tone="cyan" />
            </div>
          </div>
        </div>

        <div className="grid gap-3 border-t border-og-grid bg-[linear-gradient(180deg,rgba(130,37,255,0.08),rgba(0,0,0,0.18))] px-4 py-4 sm:px-6 lg:grid-cols-5 lg:px-8">
          <StatCard label="Market cap" value={loading ? "Loading…" : fmtUsd(marketCap)} Icon={BadgeDollarSign} />
          <StatCard label="Liquidity" value={loading ? "Loading…" : fmtUsd(liquidity)} Icon={Coins} />
          <StatCard label="24h volume" value={loading ? "Loading…" : fmtUsd(volume24)} Icon={ArrowUpRight} />
          <StatCard label="ATH" value={loading ? "Loading…" : fmtUsd(athPrice)} Icon={Sparkles} />
          <StatCard label="Holders" value={loading ? "Loading…" : holderCount ? fmtNum(holderCount) : "—"} Icon={Users} />
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_360px]">
        <div className="space-y-5">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className={panelClass}>
              <div className="border-b border-og-grid px-4 py-3">
                <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-og-cyan">Live chart</div>
                <h2 className="mt-1 text-xl font-black uppercase tracking-tight text-white">Price + market view</h2>
              </div>
              <div className="aspect-[16/10] overflow-hidden bg-black">
                <iframe title="OUR COIN chart" src={chartEmbedUrl} className="h-full w-full" loading="lazy" />
              </div>
            </div>

            <div className="grid gap-5">
              <div className={panelClass}>
                <div className="border-b border-og-grid px-4 py-3">
                  <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-og-gold">Metadata + links</div>
                </div>
                <div className="space-y-3 px-4 py-4 text-sm">
                  <AnalysisRow label="Mint" value={shortAddr(OGSCAN_TOKEN_MINT, 7)} />
                  <AnalysisRow label="Dev wallet" value={shortAddr(OGSCAN_DEV_WALLET, 7)} />
                  <AnalysisRow label="Created" value={shortDate(createdAt)} />
                  <AnalysisRow label="Migrated" value={migrated ? shortDate(migratedAt ?? (pair?.pairCreatedAt ? new Date(pair.pairCreatedAt).toISOString() : undefined)) : "Monitoring"} />
                  <AnalysisRow label="Pair" value={pair?.pairAddress ? shortAddr(pair.pairAddress, 6) : "Waiting"} />
                  <AnalysisRow label="Helius" value={HELIUS_API_KEY ? "Live tracking on" : "Unavailable"} tone="good" />
                </div>
                <div className="flex flex-wrap gap-2 border-t border-og-grid px-4 py-4">
                  {links.map((link) => (
                    <a
                      key={link.url}
                      href={link.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 border border-og-grid bg-black/70 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.2em] text-white/75 transition hover:border-og-cyan hover:text-og-cyan"
                    >
                      {link.label} <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  ))}
                </div>
              </div>

            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <div className={panelClass}>
              <div className="border-b border-og-grid px-4 py-3">
                <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-og-gold">Full scan analysis</div>
              </div>
              <div className="space-y-3 px-4 py-4 text-sm">
                <AnalysisRow label="24h change" value={fmtPct(change24)} tone={change24 >= 0 ? "good" : "bad"} />
                <AnalysisRow label="1h change" value={fmtPct(change1h)} tone={change1h >= 0 ? "good" : "bad"} />
                <AnalysisRow label="FDV" value={fmtUsd(fdv)} />
                <AnalysisRow label="ATH market cap" value={fmtUsd(athMcap)} />
                <AnalysisRow label="Holders" value={holderCount ? fmtNum(holderCount) : "—"} />
                <AnalysisRow label="Whales" value={whaleCount ? fmtNum(whaleCount) : "—"} />
                <AnalysisRow label="Dex status" value={dexPaid || "Watching"} tone={dexPaid && dexPaid !== "Watching" ? "good" : "neutral"} />
                <AnalysisRow label="LP status" value={lpLooksHealthy ? "Liquidity active" : "Watch liquidity"} tone={lpLooksHealthy ? "good" : "bad"} />
              </div>
            </div>

            <div className={panelClass}>
              <div className="border-b border-og-grid px-4 py-3">
                <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-og-cyan">Migration bar</div>
                <div className="mt-1 text-xl font-black uppercase tracking-tight text-white">Official launch status</div>
              </div>
              <div className="space-y-4 px-4 py-4 text-sm text-muted-foreground">
                <div className="flex items-center justify-between gap-3 font-mono text-sm font-bold uppercase tracking-[0.18em] text-og-gold">
                  <span>Progress</span>
                  <span>{migrationProgress}%</span>
                </div>
                <div className="h-3 overflow-hidden border border-og-grid bg-black">
                  <div className="h-full bg-[linear-gradient(90deg,hsl(var(--og-gold)),hsl(var(--og-lime)))] transition-all duration-500" style={{ width: `${migrationProgress}%` }} />
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <InfoChip label="Status" value={migrated ? "DEX live" : "Watching curve"} />
                  <InfoChip label="Buys vs sells" value={`${buyPct}% / ${100 - buyPct}%`} />
                  <InfoChip label="24h flow" value={`${fmtNum(total24)} trades`} />
                </div>
              </div>
            </div>
          </div>

          <div className={panelClass}>
            <div className="border-b border-og-grid px-4 py-3">
              <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-og-lime">Buy / sell feed</div>
              <div className="mt-1 text-xl font-black uppercase tracking-tight text-white">Full transaction tape</div>
            </div>
            <div className="p-0">
              <TxFeed mint={OGSCAN_TOKEN_MINT} />
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <OurCoinBuyFeed
            mint={OGSCAN_TOKEN_MINT}
            compact={false}
            buysOnly={false}
            alertOnNewBuys
            title="Sidebar live buy feed"
            subtitle="Fresh OUR COIN activity pulled from the official mint and ready for push alerts."
          />

          <div className={panelClass}>
            <div className="border-b border-og-grid px-4 py-3">
              <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.3em] text-og-gold">
                <Bell className="h-3.5 w-3.5" /> Buy alerts
              </div>
            </div>
            <div className="px-4 py-4">
              <p className="text-sm leading-relaxed text-muted-foreground">
                Turn on push to get a notification whenever the official mint prints a fresh buy while you are away from the tab.
              </p>
              <div className="mt-4 grid gap-2 text-sm">
                <AlertStatus label="Browser permission" value={permission} tone={permission === "granted" ? "good" : permission === "denied" ? "bad" : "neutral"} />
                <AlertStatus label="Push registration" value={isRegistered ? "connected" : "not connected"} tone={isRegistered ? "good" : "neutral"} />
              </div>
              <button
                type="button"
                onClick={() => void requestPermission()}
                disabled={permission === "granted" || isSyncing}
                className={cn(
                  "mt-4 inline-flex min-h-11 items-center justify-center gap-2 border px-4 py-3 font-mono text-[10px] font-bold uppercase tracking-[0.24em] transition",
                  permission === "granted"
                    ? "border-og-lime/40 bg-og-lime/10 text-og-lime"
                    : "border-og-gold bg-og-gold text-og-ink hover:bg-og-gold/90",
                )}
              >
                {isSyncing && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {permission === "granted" ? "Buy alerts enabled" : "Enable buy alerts"}
              </button>
            </div>
          </div>

          <div className={panelClass}>
            <div className="border-b border-og-grid px-4 py-3">
              <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-og-gold">Trust signals</div>
            </div>
            <div className="space-y-3 px-4 py-4 text-sm text-muted-foreground">
              <TrustRow icon={ShieldCheck} title="Official mint pinned" detail="The official mint is hard-coded into the app’s OG token constants and surfaced across this room." />
              <TrustRow icon={Wallet} title="Dev wallet tracked" detail={`Official dev wallet: ${shortAddr(OGSCAN_DEV_WALLET, 6)}.`} />
              <TrustRow icon={Users} title="Holder intelligence" detail={holderCount ? `${fmtNum(holderCount)} holders and ${fmtNum(whaleCount)} whales currently tracked.` : "Holder data is being refreshed from live market intel."} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
});

OurCoin.displayName = "OurCoin";

const StatCard = ({ label, value, Icon }: { label: string; value: string; Icon: typeof Coins }) => (
  <div className="border border-og-grid bg-black/45 p-4">
    <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.24em] text-white/45">
      <Icon className="h-3.5 w-3.5" /> {label}
    </div>
    <div className="mt-2 text-2xl font-black tracking-tight text-white">{value}</div>
  </div>
);

const SignalCard = ({ label, value, Icon, tone }: { label: string; value: string; Icon: typeof Activity; tone: "lime" | "gold" | "cyan" }) => {
  const toneClass = tone === "lime" ? "border-og-lime/40 bg-black/75 text-og-lime" : tone === "gold" ? "border-og-gold/40 bg-black/75 text-og-gold" : "border-og-cyan/40 bg-black/75 text-og-cyan";
  return (
    <div className={cn("border p-4", toneClass)}>
      <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.24em] opacity-80">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className="mt-2 text-2xl font-black tracking-tight text-white">{value}</div>
    </div>
  );
};

const AnalysisRow = ({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "good" | "bad" | "neutral" }) => (
  <div className="flex items-center justify-between gap-4 border-b border-og-grid/70 pb-2 last:border-b-0 last:pb-0">
    <span className="text-white/55">{label}</span>
    <span className={cn(
      "text-right font-mono text-xs uppercase tracking-[0.18em]",
      tone === "good" ? "text-og-lime" : tone === "bad" ? "text-og-blood" : "text-white",
    )}>{value}</span>
  </div>
);

const AlertStatus = ({ label, value, tone }: { label: string; value: string; tone: "good" | "bad" | "neutral" }) => (
  <div className="flex items-center justify-between gap-3 border border-og-grid bg-black/35 px-3 py-2.5 text-sm">
    <span className="text-white/55">{label}</span>
    <span className={cn(
      "font-mono text-[10px] uppercase tracking-[0.22em]",
      tone === "good" ? "text-og-lime" : tone === "bad" ? "text-og-blood" : "text-og-gold",
    )}>{value}</span>
  </div>
);

const TrustRow = ({ icon: Icon, title, detail }: { icon: typeof ShieldCheck; title: string; detail: string }) => (
  <div className="border border-og-grid bg-black/40 p-3">
    <div className="mb-1 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.24em] text-og-cyan">
      <Icon className="h-3.5 w-3.5" /> {title}
    </div>
    <p>{detail}</p>
  </div>
);

const InfoChip = ({ label, value }: { label: string; value: string }) => (
  <div className="border border-og-grid bg-black/40 p-3">
    <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/45">{label}</div>
    <div className="mt-1 text-sm font-semibold text-white">{value}</div>
  </div>
);

import { useEffect, useMemo, useRef, useState, type ComponentType, type ReactNode, lazy, Suspense } from "react";
import { useTheme } from "@/hooks/useTheme";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  Activity,
  ArrowUpRight,
  Bell,
  Bot,
  ChevronLeft,
  ChevronRight,
  Coins,
  Compass,
  Cpu,
  Crown,
  Crosshair,
  Flame,
  Gauge,
  Globe,
  Home,
  Layers3,
  LayoutGrid,
  LineChart,
  Map,
  Menu,
  MessageSquare,
  Radar,
  Radio,
  Rocket,
  Rss,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Target,
  TrendingUp,
  Trophy,
  Users,
  User,
  Wallet,
  Webhook,
  Wrench,
  X,
  Zap,
  Palette,
  Image as ImageIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { DEFAULT_OG_MINT, OGSCAN_TOKEN_MINT, SOL_MINT, STORAGE_OG_MINT, shortAddr, type JupTokenInfo } from "@/lib/og";
import { CoinDetailDialog } from "@/components/CoinDetailDialog";
import { AuthButton } from "@/components/AuthButton";
import { AppTopBar } from "@/components/AppTopBar";
import { AppSidebar } from "@/components/AppSidebar";
import { BottomNav } from "@/components/layout/BottomNav";
import { ToolHeader } from "@/components/ToolPageShell";

/* ─── Standard Feature imports ─── */
const OgStats = lazy(() => import("@/components/OgStats").then(m => ({ default: m.OgStats })));
const Scanner = lazy(() => import("@/components/Scanner").then(m => ({ default: m.Scanner })));
const Trending = lazy(() => import("@/components/Trending").then(m => ({ default: m.Trending })));
const OgFinder = lazy(() => import("@/components/OgFinder").then(m => ({ default: m.OgFinder })));
const PairTracker = lazy(() => import("@/components/PairTracker").then(m => ({ default: m.PairTracker })));
const Migrations = lazy(() => import("@/components/Migrations").then(m => ({ default: m.Migrations })));
const TxFeed = lazy(() => import("@/components/TxFeed").then(m => ({ default: m.TxFeed })));
const Whales = lazy(() => import("@/components/Whales").then(m => ({ default: m.Whales })));
const SwapPanel = lazy(() => import("@/components/SwapPanel").then(m => ({ default: m.SwapPanel })));
const TechStack = lazy(() => import("@/components/TechStack").then(m => ({ default: m.TechStack })));
const OurCoin = lazy(() => import("@/components/OurCoin").then(m => ({ default: m.OurCoin })));
const SnipeFeed = lazy(() => import("@/components/SnipeFeed").then(m => ({ default: m.SnipeFeed })));
const Feed = lazy(() => import("@/components/Feed").then(m => ({ default: m.Feed })));
const NewsSignal = lazy(() => import("@/components/NewsSignal").then(m => ({ default: m.NewsSignal })));
const SolToolsRoadmap = lazy(() => import("@/components/SolToolsRoadmap").then(m => ({ default: m.SolToolsRoadmap })));

/* ─── Merged tool imports ─── */
const AboutOgScan = lazy(() => import("@/components/AboutOgScan").then(m => ({ default: m.AboutOgScan })));
const TokenIntel = lazy(() => import("@/components/TokenIntel").then(m => ({ default: m.TokenIntel })));

/* ─── Page imports ─── */
const CommunitiesPage = lazy(() => import("./Communities"));
const DiscoverPage = lazy(() => import("./Discover"));
const ArtFeed = lazy(() => import("./ArtFeed"));
const SpacesPage = lazy(() => import("./Spaces"));
const SocialHub = lazy(() => import("./SocialHub"));
const CommunityHub = lazy(() => import("./CommunityHub"));
const ToolsHub = lazy(() => import("./ToolsHub"));
const ChartsPage = lazy(() => import("./Charts"));
const LiveTradingPage = lazy(() => import("./LiveTrading"));
const LiveFeedPage = lazy(() => import("./LiveFeed"));

/* ─── 20x Feature imports ─── */
const RugScore = lazy(() => import("@/components/scanner-20x/RugScore").then(m => ({ default: m.RugScore })));
const DevWalletDNA = lazy(() => import("@/components/scanner-20x/DevWalletDNA").then(m => ({ default: m.DevWalletDNA })));
const ScanHistory = lazy(() => import("@/components/scanner-20x/ScanHistory").then(m => ({ default: m.ScanHistory })));
const BundleVisual = lazy(() => import("@/components/scanner-20x/BundleVisual").then(m => ({ default: m.BundleVisual })));
const ComparativeScan = lazy(() => import("@/components/scanner-20x/ComparativeScan").then(m => ({ default: m.ComparativeScan })));
const ScanShare = lazy(() => import("@/components/scanner-20x/ScanShare").then(m => ({ default: m.ScanShare })));
const LaunchQualityScore = lazy(() => import("@/components/launch-radar-20x/LaunchQualityScore").then(m => ({ default: m.LaunchQualityScore })));
const CreatorPatterns = lazy(() => import("@/components/launch-radar-20x/CreatorPatterns").then(m => ({ default: m.CreatorPatterns })));
const MigrationTimer = lazy(() => import("@/components/launch-radar-20x/MigrationTimer").then(m => ({ default: m.MigrationTimer })));
const FirstBuyersForensics = lazy(() => import("@/components/launch-radar-20x/FirstBuyersForensics").then(m => ({ default: m.FirstBuyersForensics })));
const LaunchAlerts = lazy(() => import("@/components/launch-radar-20x/LaunchAlerts").then(m => ({ default: m.LaunchAlerts })));
const MomentumHeatmap = lazy(() => import("@/components/market-feed-20x/MomentumHeatmap").then(m => ({ default: m.MomentumHeatmap })));
const NarrativeClusters = lazy(() => import("@/components/market-feed-20x/NarrativeClusters").then(m => ({ default: m.NarrativeClusters })));
const CrossReferenceCard = lazy(() => import("@/components/market-feed-20x/CrossReferenceCard").then(m => ({ default: m.CrossReferenceCard })));
const CustomFeedBuilder = lazy(() => import("@/components/market-feed-20x/CustomFeedBuilder").then(m => ({ default: m.CustomFeedBuilder })));
const WalletXRay = lazy(() => import("@/components/wallets-20x/WalletXRay").then(m => ({ default: m.WalletXRay })));
const CopyTradingFeed = lazy(() => import("@/components/wallets-20x/CopyTradingFeed").then(m => ({ default: m.CopyTradingFeed })));
const PnLTracker = lazy(() => import("@/components/wallets-20x/PnLTracker").then(m => ({ default: m.PnLTracker })));
const ThreadedDiscussions = lazy(() => import("@/components/alpha-chat-20x/ThreadedDiscussions").then(m => ({ default: m.ThreadedDiscussions })));
const SentimentPulse = lazy(() => import("@/components/alpha-chat-20x/SentimentPulse").then(m => ({ default: m.SentimentPulse })));
const CommunityReputation = lazy(() => import("@/components/communities-20x/CommunityReputation").then(m => ({ default: m.CommunityReputation })));
const MultiChartView = lazy(() => import("@/components/charts-20x/MultiChartView").then(m => ({ default: m.MultiChartView })));
const DrawingTools = lazy(() => import("@/components/charts-20x/DrawingTools").then(m => ({ default: m.DrawingTools })));
const SmartFilters = lazy(() => import("@/components/live-feed-20x/SmartFilters").then(m => ({ default: m.SmartFilters })));
const OGDaily = lazy(() => import("@/components/new-features/OGDaily").then(m => ({ default: m.OGDaily })));
const SmartWatchlist = lazy(() => import("@/components/new-features/SmartWatchlist").then(m => ({ default: m.SmartWatchlist })));
const PaperTrading = lazy(() => import("@/components/new-features/PaperTrading").then(m => ({ default: m.PaperTrading })));
const CryptoCalendar = lazy(() => import("@/components/new-features/CryptoCalendar").then(m => ({ default: m.CryptoCalendar })));

/* ─── Phase 29 imports ─── */
const AlphaCallouts = lazy(() => import("@/components/callouts-20x/AlphaCallouts").then(m => ({ default: m.AlphaCallouts })));
const CalloutLeaderboard = lazy(() => import("@/components/callouts-20x/CalloutLeaderboard").then(m => ({ default: m.CalloutLeaderboard })));
const PlatformLeaderboard = lazy(() => import("@/components/leaderboard-20x/PlatformLeaderboard").then(m => ({ default: m.PlatformLeaderboard })));
const TradingLobbies = lazy(() => import("@/components/lobbies-20x/TradingLobbies").then(m => ({ default: m.TradingLobbies })));
const TokenCompare = lazy(() => import("@/components/advanced-tools-20x/TokenCompare").then(m => ({ default: m.TokenCompare })));
const QuickCalc = lazy(() => import("@/components/advanced-tools-20x/QuickCalc").then(m => ({ default: m.QuickCalc })));
const UserProfile = lazy(() => import("@/components/profile-20x/UserProfile").then(m => ({ default: m.UserProfile })));
const WebhookManager = lazy(() => import("@/components/webhooks-20x/WebhookManager").then(m => ({ default: m.WebhookManager })));

/* ─── Phase 30 imports (Discover / Launchpad) ─── */
const TokenExplorer = lazy(() => import("@/components/discover-20x/TokenExplorer").then(m => ({ default: m.TokenExplorer })));
const ViralFeed = lazy(() => import("@/components/discover-20x/ViralFeed").then(m => ({ default: m.ViralFeed })));
const LaunchpadExplorer = lazy(() => import("@/components/discover-20x/LaunchpadExplorer").then(m => ({ default: m.LaunchpadExplorer })));
const LaunchTracker = lazy(() => import("@/components/launchpad-20x/LaunchTracker").then(m => ({ default: m.LaunchTracker })));
const MemeGallery = lazy(() => import("@/components/memes-20x/MemeGallery").then(m => ({ default: m.MemeGallery })));
const ProDashboard = lazy(() => import("@/components/premium-20x/ProDashboard").then(m => ({ default: m.ProDashboard })));

const LEGACY_DEFAULT_MINT = "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263";
const STORAGE_TAB = "og_scanner.active_site_tab";

type TabId =
  | "overview"
  | "our-coin"
  | "roadmap"
  | "market-pulse"
  | "snipe-feed"
  | "feed"
  | "scanner"
  | "og-finder"
  | "pairs"
  | "migrations"
  | "trending"
  | "whales"
  | "tx-feed"
  | "swap"
  | "tech"
  | "news-signal"
  | "communities"
  | "discover"
  | "memes"
  | "spaces"
  | "social"
  | "community"
  | "tools"
  | "profile"
  | "charts"
  | "live-trading"
  | "live-feed-page";

type TabAccent = "blue" | "white" | "cyan" | "gold" | "lime";
type TabGroup = "Main" | "Forensics" | "Market" | "Project";

type TabConfig = {
  id: TabId;
  label: string;
  slug: string;
  pageNumber: number;
  eyebrow: string;
  description: string;
  Icon: ComponentType<{ className?: string }>;
  accent: TabAccent;
  group: TabGroup;
  showInNav?: boolean;
  mergedInto?: TabId;
};

const TABS: TabConfig[] = [
  {
    id: "overview",
    label: "Home",
    slug: "command",
    pageNumber: 1,
    eyebrow: "Dashboard",
    description: "Launch scanner, OG finder, snipe feed, and every standalone tool from one command hub.",
    Icon: Home,
    accent: "blue",
    group: "Main",
  },
  {
    id: "scanner",
    label: "Truth Scan",
    slug: "scanner",
    pageNumber: 6,
    eyebrow: "Forensics",
    description: "Scanner + OG Finder for mint checks, origin proof, dominance status, LP risk, and holders.",
    Icon: Search,
    accent: "lime",
    group: "Forensics",
    showInNav: false,
    mergedInto: "tools",
  },
  {
    id: "og-finder",
    label: "OG Finder",
    slug: "og-finder",
    pageNumber: 7,
    eyebrow: "Origin Check",
    description: "First-mint proof, lineage, and dominance context for any Solana token.",
    Icon: Crosshair,
    accent: "white",
    group: "Forensics",
    showInNav: false,
    mergedInto: "scanner",
  },
  {
    id: "snipe-feed",
    label: "Launch Radar",
    slug: "snipe-feed",
    pageNumber: 5,
    eyebrow: "Live Launches",
    description: "New coins, repeat creators, watch alerts, migration timing, and launch quality scores.",
    Icon: Target,
    accent: "cyan",
    group: "Forensics",
    showInNav: false,
    mergedInto: "tools",
  },
  {
    id: "migrations",
    label: "Migrations",
    slug: "migrations",
    pageNumber: 9,
    eyebrow: "Pump.fun → DEX",
    description: "Migration timing module for Pump.fun breakout and DEX arrival tracking.",
    Icon: Rocket,
    accent: "gold",
    group: "Forensics",
    showInNav: false,
    mergedInto: "snipe-feed",
  },
  {
    id: "feed",
    label: "Market Feed",
    slug: "feed",
    pageNumber: 15,
    eyebrow: "Live Market",
    description: "Trending coins, pair discovery, whale context, bundle status, boosts, and CTO analytics.",
    Icon: Rss,
    accent: "lime",
    group: "Market",
    showInNav: false,
    mergedInto: "tools",
  },
  {
    id: "market-pulse",
    label: "Market Pulse",
    slug: "market-pulse",
    pageNumber: 4,
    eyebrow: "Token Vitals",
    description: "Fast price, liquidity, holders, and market cap for any active mint.",
    Icon: Activity,
    accent: "blue",
    group: "Market",
    showInNav: false,
    mergedInto: "feed",
  },
  {
    id: "pairs",
    label: "Pairs",
    slug: "pairs",
    pageNumber: 8,
    eyebrow: "New Pair Radar",
    description: "New pool, liquidity, and routing intelligence across Solana DEXes.",
    Icon: Radar,
    accent: "cyan",
    group: "Market",
    showInNav: false,
    mergedInto: "feed",
  },
  {
    id: "trending",
    label: "Trending",
    slug: "trending",
    pageNumber: 10,
    eyebrow: "Market Heat",
    description: "Live token momentum and catalyst discovery.",
    Icon: Flame,
    accent: "cyan",
    group: "Market",
    showInNav: false,
    mergedInto: "feed",
  },
  {
    id: "whales",
    label: "Whales",
    slug: "whales",
    pageNumber: 11,
    eyebrow: "Wallet Radar",
    description: "Holder concentration and whale structure for the selected mint.",
    Icon: Wallet,
    accent: "white",
    group: "Market",
    showInNav: false,
    mergedInto: "feed",
  },
  {
    id: "tx-feed",
    label: "Tx Feed",
    slug: "tx-feed",
    pageNumber: 12,
    eyebrow: "Live Transactions",
    description: "Live buy/sell tape for the currently selected token.",
    Icon: Activity,
    accent: "cyan",
    group: "Market",
    showInNav: false,
    mergedInto: "feed",
  },
  {
    id: "swap",
    label: "Swap",
    slug: "swap",
    pageNumber: 13,
    eyebrow: "Jupiter Route",
    description: "Search coins and quote routes while keeping scanner context on-screen.",
    Icon: Zap,
    accent: "blue",
    group: "Market",
    showInNav: false,
    mergedInto: "tools",
  },
  {
    id: "our-coin",
    label: "Our Token",
    slug: "our-coin",
    pageNumber: 2,
    eyebrow: "Official Token",
    description: "Official OGScan coin CA, dev wallet, chart links, and copy buttons in one verified room.",
    Icon: Coins,
    accent: "gold",
    group: "Project",
    showInNav: false,
    mergedInto: "tools",
  },
  {
    id: "roadmap",
    label: "Roadmap",
    slug: "roadmap",
    pageNumber: 3,
    eyebrow: "Vision",
    description: "The path from OGScan into the crypto-native community layer SolTools is building.",
    Icon: Map,
    accent: "cyan",
    group: "Project",
    showInNav: false,
    mergedInto: "tools",
  },
  {
    id: "tech",
    label: "Tech Stack",
    slug: "tech",
    pageNumber: 14,
    eyebrow: "Data Pipeline",
    description: "The systems powering OG attribution, candles, live tape, and token forensics.",
    Icon: Cpu,
    accent: "white",
    group: "Project",
    showInNav: false,
    mergedInto: "tools",
  },
  {
    id: "news-signal",
    label: "News Signal",
    slug: "news-signal",
    pageNumber: 16,
    eyebrow: "Influencer Intel",
    description: "Elon, Trump, White House & more — find the coins before the market reacts.",
    Icon: Radio,
    accent: "lime",
    group: "Market",
    showInNav: false,
    mergedInto: "tools",
  },
  {
    id: "communities",
    label: "Communities",
    slug: "communities",
    pageNumber: 17,
    eyebrow: "Social Hub",
    description: "Join crypto communities, share alpha, post calls, and chat with fellow traders.",
    Icon: Users,
    accent: "cyan",
    group: "Main",
    showInNav: false,
    mergedInto: "community",
  },
  {
    id: "discover",
    label: "Discover",
    slug: "discover",
    pageNumber: 18,
    eyebrow: "Trending & Traders",
    description: "Trending tokens, top trader leaderboard, whale watch, and live social activity.",
    Icon: Compass,
    accent: "gold",
    group: "Main",
    showInNav: false,
    mergedInto: "community",
  },
  {
    id: "memes",
    label: "Memes",
    slug: "memes",
    pageNumber: 19,
    eyebrow: "Art & Vibes",
    description: "Live meme feed from the OG Memes Room — fresh degens art, memes, and vibes.",
    Icon: Palette,
    accent: "lime",
    group: "Main",
    showInNav: false,
    mergedInto: "tools",
  },
  {
    id: "spaces",
    label: "Spaces",
    slug: "spaces",
    pageNumber: 20,
    eyebrow: "Live Voice",
    description: "Join or start live voice rooms — alpha calls, discussions, and community hangouts.",
    Icon: Radio,
    accent: "cyan",
    group: "Main",
    showInNav: false,
    mergedInto: "community",
  },
  {
    id: "social",
    label: "Social",
    slug: "social",
    pageNumber: 21,
    eyebrow: "Social Hub",
    description: "Discord-style community hub — chat, voice lobby, rooms, and live streams.",
    Icon: MessageSquare,
    accent: "lime",
    group: "Main",
    showInNav: false,
    mergedInto: "community",
  },
  {
    id: "community",
    label: "Community",
    slug: "community",
    pageNumber: 22,
    eyebrow: "Social & Voice",
    description: "Chat, voice spaces, communities, and discovery — all in one hub.",
    Icon: Users,
    accent: "cyan",
    group: "Main",
  },
  {
    id: "tools",
    label: "Tools",
    slug: "tools",
    pageNumber: 23,
    eyebrow: "All Tools",
    description: "Every forensic, market, and trading tool — organized by category.",
    Icon: Wrench,
    accent: "gold",
    group: "Main",
  },
  {
    id: "profile",
    label: "Profile",
    slug: "profile",
    pageNumber: 24,
    eyebrow: "Your Account",
    description: "View your profile, settings, and account preferences.",
    Icon: User,
    accent: "cyan",
    group: "Main",
  },
  {
    id: "charts",
    label: "Charts",
    slug: "charts",
    pageNumber: 25,
    eyebrow: "Live Charts",
    description: "Real-time DEX charts powered by DexScreener with favorites and history.",
    Icon: LineChart,
    accent: "cyan",
    group: "Market",
  },
  {
    id: "live-trading",
    label: "Live Trading",
    slug: "live-trading",
    pageNumber: 26,
    eyebrow: "P&L · Signals",
    description: "Track your trades, watch signals, and manage your portfolio in real-time.",
    Icon: TrendingUp,
    accent: "lime",
    group: "Market",
  },
  {
    id: "live-feed-page",
    label: "Live Feed",
    slug: "live-feed-page",
    pageNumber: 27,
    eyebrow: "Tape stream",
    description: "Real-time transaction feed with smart filters and alerts.",
    Icon: Radio,
    accent: "cyan",
    showInNav: false,
    mergedInto: "community",
    group: "Market",
  },
];

const NAV_TABS: TabConfig[] = TABS.filter((t: TabConfig) => t.showInNav !== false);

const TAB_BY_ID: Record<TabId, TabConfig> = TABS.reduce(
  (acc: Record<TabId, TabConfig>, t: TabConfig): Record<TabId, TabConfig> => {
    acc[t.id] = t;
    return acc;
  },
  {} as Record<TabId, TabConfig>,
);

const ROUTE_ALIASES: Record<string, TabId> = TABS.reduce(
  (acc: Record<string, TabId>, t: TabConfig): Record<string, TabId> => {
    acc[t.slug] = t.id;
    acc[t.id] = t.id;
    acc[`page-${t.pageNumber}`] = t.id;
    acc[`page${t.pageNumber}`] = t.id;
    return acc;
  },
  {
    app: "overview",
    home: "overview",
    market: "feed",
    "market-command": "feed",
    "live-feed": "feed",
    feed: "feed",
    tape: "tx-feed",
    transactions: "tx-feed",
    "transaction-feed": "tx-feed",
    "og-scanner": "scanner",
    "ogscan-scanner": "scanner",
    "dev-wallet": "snipe-feed",
    "dev-wallet-radar": "snipe-feed",
    "migration-tool": "migrations",
    "migration-tracker": "migrations",
    art: "memes",
    memes: "memes",
    "art-feed": "memes",
    spaces: "spaces",
    "voice-rooms": "spaces",
    "live-rooms": "spaces",
    social: "social",
    "social-hub": "social",
    socialhub: "social",
    settings: "profile",
  },
);

const getTabFromSlug = (slug: string | undefined): TabId | null => {
  const s: string = decodeURIComponent(slug ?? "")
    .trim()
    .replace(/^\/+|\/+$/g, "")
    .toLowerCase();
  if (!s) return "overview";
  return ROUTE_ALIASES[s] ?? null;
};

const getTabPath = (id: TabId): string => {
  if (id === "overview") return "/app";
  return `/${TAB_BY_ID[id].slug}`;
};

const renderTool = (tab: TabId, mint: string, updateMint: (m: string) => void, onNavigate?: (t: string) => void, profileViewUserId?: string): ReactNode => {
  /* ─── Consolidated: About OGScan (token + roadmap + tech) ─── */
  if (tab === "our-coin") return <AboutOgScan initialTab="token" />;
  if (tab === "roadmap") return <AboutOgScan initialTab="roadmap" />;
  if (tab === "tech") return <AboutOgScan initialTab="tech" />;

  /* ─── Consolidated: Token Intel (vitals + pairs + whales + tx-feed + charts) ─── */
  if (tab === "market-pulse") return <TokenIntel mint={mint} onSelect={updateMint} initialTab="vitals" />;
  if (tab === "pairs") return <TokenIntel mint={mint} onSelect={updateMint} initialTab="pairs" />;
  if (tab === "whales") return <TokenIntel mint={mint} onSelect={updateMint} initialTab="whales" />;
  if (tab === "tx-feed") return <TokenIntel mint={mint} onSelect={updateMint} initialTab="tx-feed" />;
  if (tab === "charts") return <TokenIntel mint={mint} onSelect={updateMint} initialTab="charts" />;

  /* ─── Consolidated: Truth Scanner suite ─── */
  if (tab === "scanner") return <TruthScanSuite onSelect={updateMint} />;
  if (tab === "og-finder") return <TruthScanSuite onSelect={updateMint} />;

  /* ─── Consolidated: Launch Radar suite ─── */
  if (tab === "snipe-feed") return <LaunchRadarSuite onSelect={updateMint} />;
  if (tab === "migrations") return <LaunchRadarSuite onSelect={updateMint} />;

  /* ─── Consolidated: Market Feed suite ─── */
  if (tab === "feed") return <MarketFeedSuite mint={mint} onSelect={updateMint} />;
  if (tab === "trending") return <MarketFeedSuite mint={mint} onSelect={updateMint} />;
  if (tab === "news-signal") return <MarketFeedSuite mint={mint} onSelect={updateMint} />;

  /* ─── Standalone tools ─── */
  if (tab === "swap") return <SwapPanel ogMint={mint} onSelectMint={updateMint} />;

  /* ─── Social / community pages ─── */
  if (tab === "communities") return <CommunitiesInline />;
  if (tab === "discover") return <DiscoverInline />;
  if (tab === "memes") return <ArtFeed inline />;
  if (tab === "spaces") return <SpacesPage />;
  if (tab === "social") return <SocialHub />;
  if (tab === "tools") return <ToolsHub onNavigate={onNavigate || (() => {})} />;
  if (tab === "profile") return <UserProfile viewUserId={profileViewUserId} />;
  if (tab === "live-trading") return <LiveTradingPage />;
  if (tab === "live-feed-page") return <LiveFeedPage />;
  return null;
};

/* ─── accent helpers ─── */
const accentText = (a: TabAccent): string =>
  a === "gold" ? "text-og-gold" : a === "cyan" ? "text-og-cyan" : a === "white" ? "text-white" : "text-og-lime";

const accentIcon = (a: TabAccent): string =>
  a === "gold"
    ? "border-og-gold/40 bg-og-gold/10 text-og-gold"
    : a === "cyan"
      ? "border-og-cyan/40 bg-og-cyan/10 text-og-cyan"
      : a === "white"
        ? "border-white/20 bg-white/8 text-white"
        : "border-og-lime/40 bg-og-lime/10 text-og-lime";

const accentDot = (a: TabAccent): string =>
  a === "gold" ? "bg-og-gold" : a === "cyan" ? "bg-og-cyan" : a === "white" ? "bg-white" : "bg-og-lime";

/* ─── Main Index component ─── */
const Index = () => {
  const { customWallpaper } = useTheme();
  const { toolSlug, pageNumber } = useParams<{ toolSlug?: string; pageNumber?: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const pathSlug: string = location.pathname.replace(/^\/+|\/+$/g, "").split("/").pop() ?? "";
  /* /profile/:userId → always resolve to "profile" tab regardless of userId segment */
  const isProfileSubRoute = location.pathname.startsWith("/profile");
  const profileViewUserId = isProfileSubRoute ? location.pathname.split("/profile/")[1]?.split(/[?#/]/)[0] || undefined : undefined;
  const routeSlug: string | undefined = isProfileSubRoute ? "profile" : (pageNumber ? `page-${pageNumber}` : toolSlug ?? pathSlug);
  const routeTab: TabId = useMemo<TabId>(() => getTabFromSlug(routeSlug) ?? "overview", [routeSlug]);
  const [mint, setMint] = useState<string>(DEFAULT_OG_MINT);
  const [selectedWallet, setSelectedWallet] = useState<string>("");
  const [tab, setTab] = useState<TabId>(routeTab);
  const [sidebarOpen, setSidebarOpen] = useState(false);


  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_OG_MINT);
      if (saved && saved !== LEGACY_DEFAULT_MINT && saved !== SOL_MINT) setMint(saved);
      else { setMint(DEFAULT_OG_MINT); localStorage.setItem(STORAGE_OG_MINT, DEFAULT_OG_MINT); }
    } catch { /* noop */ }
  }, []);

  useEffect(() => { setTab(routeTab); }, [routeTab]);

  useEffect(() => {
    if (routeSlug && !getTabFromSlug(routeSlug)) navigate("/app", { replace: true });
  }, [navigate, routeSlug]);

  useEffect(() => { window.scrollTo({ top: 0, behavior: "instant" }); }, [location.pathname, tab]);

  const activeTab = useMemo<TabConfig>(() => TABS.find((t) => t.id === tab) ?? TABS[0], [tab]);

  const switchTab = (next: string): void => {
    const safe: TabId = TABS.some((t) => t.id === next) ? (next as TabId) : "overview";
    setTab(safe);
    try { localStorage.setItem(STORAGE_TAB, safe); } catch { /* noop */ }
    navigate(getTabPath(safe));
  };

  const updateMint = (next: string): void => {
    setMint(next);
    try { localStorage.setItem(STORAGE_OG_MINT, next); } catch { /* noop */ }
  };

  const promptMint = (): void => {
    const next = window.prompt("Paste any Solana mint address:", mint);
    if (next && next.trim().length > 20) { updateMint(next.trim()); switchTab("scanner"); }
  };

  return (
    <div className="st-workspace flex min-h-screen bg-background text-foreground relative">
      {/* Wallpaper layer — very subtle, pushed far back */}
      {customWallpaper && (
        <div className="pointer-events-none fixed inset-0 z-0 bg-cover bg-center bg-no-repeat opacity-15" style={{ backgroundImage: `url(${customWallpaper})` }}>
          <div className="absolute inset-0 bg-background/80 backdrop-blur-md" />
        </div>
      )}
      {/* Left sidebar */}
      <AppSidebar
        activeId={tab}
        mint={mint}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onChangeMint={promptMint}
        onNavigate={(t) => { setSidebarOpen(false); switchTab(t); }}
      />

      {/* Overlay for mobile sidebar */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main content */}
      <div className="relative z-10 flex min-w-0 flex-1 flex-col lg:ml-[260px]">
        {/* Top bar + horizontal tab strip */}
        <AppTopBar
          tab={activeTab}
          mint={mint}
          activeId={tab}
          onOpenSidebar={() => setSidebarOpen(true)}
          onChangeMint={promptMint}
          onNavigate={switchTab}
        />

        {/* Page content */}
        {tab === "community" || tab === "social" ? (
          <main className="min-h-0 flex-1 overflow-hidden pb-[4.5rem] lg:pb-0">
            <CommunityHub />
          </main>
        ) : (
          <main className="min-h-0 flex-1 overflow-x-hidden px-3 pb-28 pt-4 sm:px-5 lg:px-6 lg:pb-8">
            {tab === "overview" ? (
              <OverviewPage
                mint={mint}
                onSwitchTab={(t: TabId) => switchTab(t)}
                onScanClick={() => switchTab("scanner")}
                onChangeMint={promptMint}
                onSelectMint={updateMint}
              />
            ) : (
              <ToolShell tab={activeTab} onBack={() => switchTab("tools")}><Suspense fallback={<div className="flex items-center justify-center py-20"><div className="h-6 w-6 border-2 border-[#22d3ee] border-t-transparent rounded-full animate-spin" /></div>}>{renderTool(tab, mint, updateMint, switchTab, profileViewUserId)}</Suspense></ToolShell>
            )}
          </main>
        )}
      </div>

      {/* Shared bottom nav — consistent across all pages */}
      <BottomNav />
    </div>
  );
};

/* ─── External nav placeholder ─── */

/* ─── Sidebar placeholder for old local component ─── */

/* ─── Nav item placeholder ─── */

/* ─── Top bar placeholder ─── */

/* ─── Mobile nav placeholder ─── */

/* ─── Token Detail Popup Wrapper (auto-open on mount, cleans up on close) ─── */
const TokenDetailPopupWrapper = ({ token, onClose, onOpenScanner }: { token: JupTokenInfo; onClose: () => void; onOpenScanner: (m: string) => void }) => {
  const btnRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { btnRef.current?.click(); }, []);
  return (
    <CoinDetailDialog
      token={token}
      onOpenScanner={onOpenScanner}
      actionLabel="Open Scanner"
      trigger={<button ref={btnRef} className="hidden" />}
    />
  );
};

/* ─── Overview / Dashboard ─── */
const OverviewPage = ({
  mint,
  onSwitchTab,
  onScanClick,
  onChangeMint,
  onSelectMint,
}: {
  mint: string;
  onSwitchTab: (t: TabId) => void;
  onScanClick: () => void;
  onChangeMint: () => void;
  onSelectMint: (m: string) => void;
}) => {
  const quickActions = [
    { label: "Scan Token", Icon: Search, accent: "lime" as TabAccent, tab: "scanner" as TabId },
    { label: "Launch Radar", Icon: Target, accent: "cyan" as TabAccent, tab: "snipe-feed" as TabId },
    { label: "Profile", Icon: User, accent: "gold" as TabAccent, tab: "profile" as TabId },
    { label: "Community", Icon: MessageSquare, accent: "cyan" as TabAccent, tab: "community" as TabId },
  ];

  const [popupMint, setPopupMint] = useState<string | null>(null);
  const popupToken: JupTokenInfo | null = popupMint ? { id: popupMint, name: "", symbol: "", decimals: 9 } : null;

  const toolSections = [
    {
      title: "Forensics",
      accent: "lime" as TabAccent,
      items: [
        { ...TAB_BY_ID.scanner, shortDesc: "Rug score, dev wallet, holder risk" },
        { ...TAB_BY_ID["snipe-feed"], shortDesc: "New coins, repeat creators, alerts" },
      ],
    },
    {
      title: "Market",
      accent: "cyan" as TabAccent,
      items: [
        { ...TAB_BY_ID.feed, shortDesc: "Trending, pairs, whale activity" },
        { ...TAB_BY_ID["news-signal"], shortDesc: "Influencer mentions, early signals" },
      ],
    },
    {
      title: "Trading",
      accent: "gold" as TabAccent,
      items: [
        { ...TAB_BY_ID.trending, shortDesc: "Live momentum & catalysts" },
      ],
    },
  ];

  return (
    <div className="space-y-5">
      {/* ─── Hero ─── */}
      <div className="relative overflow-hidden rounded-2xl border border-white/[0.07] bg-gradient-to-br from-og-lime/[0.04] via-white/[0.03] to-og-cyan/[0.03]">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-og-lime/[0.06] blur-[80px]" />
        <div className="pointer-events-none absolute -bottom-12 left-0 h-44 w-44 rounded-full bg-og-cyan/[0.05] blur-[60px]" />
        <div className="relative px-5 py-5 sm:px-7 sm:py-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-og-lime/25 bg-og-lime/[0.08] px-2.5 py-1 text-[9px] font-bold uppercase tracking-widest text-og-lime">
                <div className="h-1.5 w-1.5 rounded-full bg-og-lime animate-pulse" /> Live
              </div>
              <h1 className="text-2xl font-black tracking-tight text-white sm:text-3xl">
                OG Scan
              </h1>
              <p className="mt-1.5 max-w-md text-[13px] leading-relaxed text-white/45">
                Solana token intelligence — forensics, market data, and community in one place.
              </p>
            </div>
            <button
              type="button"
              onClick={onChangeMint}
              className="mt-1 shrink-0 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[11px] font-mono text-white/40 transition hover:bg-white/[0.08] hover:text-white/60"
            >
              {shortAddr(mint, 4)}
            </button>
          </div>

          {/* Quick action buttons */}
          <div className="mt-4 grid grid-cols-4 gap-2 sm:flex sm:gap-3">
            {quickActions.map((action) => (
              <button
                key={action.tab}
                type="button"
                onClick={() => action.tab === "scanner" ? onScanClick() : onSwitchTab(action.tab)}
                className="group flex flex-col items-center gap-1.5 rounded-xl border border-white/[0.06] bg-white/[0.03] px-2 py-3 transition hover:border-white/[0.12] hover:bg-white/[0.06] active:scale-[0.97] sm:flex-row sm:gap-2 sm:px-4 sm:py-2.5"
              >
                <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg border sm:h-7 sm:w-7", accentIcon(action.accent))}>
                  <action.Icon className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
                </div>
                <span className="text-[10px] font-bold text-white/50 group-hover:text-white/80 sm:text-[11px]">{action.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ─── Intelligence Row ─── */}
      <div className="grid gap-3 sm:grid-cols-2">
        <OGDaily onSelectMint={(m: string) => setPopupMint(m)} />
        <SmartWatchlist onSelectMint={(m: string) => setPopupMint(m)} />
      </div>

      {/* ─── Quick Tools Grid ─── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-[15px] font-black text-white">Quick Tools</h2>
          <button
            type="button"
            onClick={() => onSwitchTab("tools")}
            className="flex items-center gap-1 text-[11px] font-semibold text-white/35 transition hover:text-white/60"
          >
            All tools <ChevronRight className="h-3 w-3" />
          </button>
        </div>
        <div className="grid grid-cols-4 sm:grid-cols-5 gap-2.5">
          {toolSections.flatMap(s => s.items).map((tool) => (
            <button
              key={tool.id}
              type="button"
              onClick={() => onSwitchTab(tool.id)}
              className="group flex flex-col items-center gap-2 py-3 px-1 rounded-2xl border border-white/[0.06] bg-white/[0.02] transition-all hover:bg-white/[0.06] hover:border-white/[0.12] hover:scale-[1.04] active:scale-95"
            >
              <div className={cn("flex h-11 w-11 items-center justify-center rounded-xl border", accentIcon(tool.accent))}>
                <tool.Icon className="h-5 w-5" />
              </div>
              <span className="text-[10px] font-bold text-white/60 group-hover:text-white transition-colors text-center leading-tight">{tool.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ─── Community & Activity ─── */}
      <div className="space-y-3">
        <h2 className="text-[15px] font-black text-white">Community & Activity</h2>
        <div className="grid grid-cols-4 sm:grid-cols-5 gap-2.5">
          {[
            { label: "Chat", Icon: MessageSquare, accent: "lime" as TabAccent, tab: "community" as TabId },
            { label: "Spaces", Icon: Radio, accent: "cyan" as TabAccent, tab: "community" as TabId },
            { label: "Alpha", Icon: TrendingUp, accent: "gold" as TabAccent, tab: "community" as TabId },
          ].map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => onSwitchTab(item.tab)}
              className="group flex flex-col items-center gap-2 py-3 px-1 rounded-2xl border border-white/[0.06] bg-white/[0.02] transition-all hover:bg-white/[0.06] hover:border-white/[0.12] hover:scale-[1.04] active:scale-95"
            >
              <div className={cn("flex h-11 w-11 items-center justify-center rounded-xl border", accentIcon(item.accent))}>
                <item.Icon className="h-5 w-5" />
              </div>
              <span className="text-[10px] font-bold text-white/60 group-hover:text-white transition-colors text-center leading-tight">{item.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ─── Advanced: charts, alpha, leaderboard ─── */}
      <MultiChartView onSelectMint={(m: string) => { onSelectMint(m); onSwitchTab("scanner"); }} />

      <div className="grid gap-3 sm:grid-cols-2">
        <AlphaCallouts onSelectMint={(m: string) => { onSelectMint(m); onSwitchTab("scanner"); }} />
        <PlatformLeaderboard />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <PaperTrading onSelectMint={(m: string) => { onSelectMint(m); onSwitchTab("scanner"); }} />
        <CryptoCalendar />
      </div>

      <QuickCalc />

      {/* Token Detail Popup — triggered by clicking tokens in OGDaily/SmartWatchlist */}
      {popupToken && (
        <TokenDetailPopupWrapper
          token={popupToken}
          onClose={() => setPopupMint(null)}
          onOpenScanner={(m) => { setPopupMint(null); onSelectMint(m); onSwitchTab("scanner"); }}
        />
      )}
    </div>
  );
};

const QuickToolCard = ({ tool, onClick }: { tool: TabConfig; onClick: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    className="group relative flex flex-col gap-3 overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4 text-left transition hover:border-white/[0.12] hover:bg-white/[0.05] active:scale-[0.99]"
  >
    <div className="flex items-start justify-between gap-3">
      <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border", accentIcon(tool.accent))}>
        <tool.Icon className="h-5 w-5" />
      </div>
      <ArrowUpRight className={cn("h-4 w-4 opacity-0 transition group-hover:opacity-100", accentText(tool.accent))} />
    </div>
    <div>
      <div className={cn("mb-0.5 text-[9px] font-bold uppercase tracking-widest", accentText(tool.accent))}>{tool.eyebrow}</div>
      <div className="text-[15px] font-black text-white">{tool.label}</div>
      <p className="mt-1.5 line-clamp-2 text-[12px] leading-relaxed text-white/45">{tool.description}</p>
    </div>
  </button>
);

const AllToolRow = ({ tool, onClick }: { tool: TabConfig; onClick: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    className="group flex w-full items-center gap-4 px-4 py-3.5 text-left transition hover:bg-white/[0.035]"
  >
    <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border", accentIcon(tool.accent))}>
      <tool.Icon className="h-4 w-4" />
    </div>
    <div className="min-w-0 flex-1">
      <div className="flex items-center gap-2">
        <span className="text-[13px] font-bold text-white">{tool.label}</span>
        <span className={cn("rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest", accentText(tool.accent),
          tool.accent === "gold" ? "border-og-gold/25 bg-og-gold/[0.08]" : tool.accent === "cyan" ? "border-og-cyan/25 bg-og-cyan/[0.08]" : tool.accent === "white" ? "border-white/15 bg-white/5" : "border-og-lime/25 bg-og-lime/[0.08]"
        )}>
          {tool.group}
        </span>
      </div>
      <p className="truncate text-[11px] text-white/40">{tool.description}</p>
    </div>
    <ChevronRight className="h-4 w-4 shrink-0 text-white/20 transition group-hover:translate-x-0.5 group-hover:text-white/60" />
  </button>
);

/* ─── Tool Shell (wraps each tool) ─── */
const ToolShell = ({ children, tab, onBack }: { tab: TabConfig; children: ReactNode; onBack?: () => void }) => (
  <div className="og-tool-shell og-tool-shell-redesign relative">
    {tab.id !== "tools" && tab.id !== "community" && onBack && (
      <button
        onClick={onBack}
        className="mb-3 inline-flex items-center gap-1.5 rounded-xl bg-white/[0.04] px-3 py-1.5 text-[11px] font-bold text-white/40 transition hover:bg-white/[0.08] hover:text-white/70"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
        Back
      </button>
    )}
    {children}
  </div>
);

/* ─── Suite nav for merged tools ─── */
type SuiteOption<T extends string> = {
  id: T;
  label: string;
  eyebrow: string;
  description: string;
  Icon: ComponentType<{ className?: string }>;
  accent: TabAccent;
};

const SuiteNav = <T extends string>({
  options,
  activeId,
  onChange,
}: {
  options: SuiteOption<T>[];
  activeId: T;
  onChange: (id: T) => void;
}) => (
  <div className="mb-4 flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }} role="tablist">
    {options.map((opt) => {
      const isActive = opt.id === activeId;
      return (
        <button
          key={opt.id}
          type="button"
          role="tab"
          aria-selected={isActive}
          onClick={() => onChange(opt.id)}
          className={cn(
            "flex min-w-[160px] shrink-0 items-center gap-3 rounded-2xl border p-3 text-left transition active:scale-[0.99] sm:min-w-[190px]",
            isActive
              ? "border-og-lime/40 bg-og-lime/10 text-white shadow-[0_0_24px_-12px_hsl(var(--og-lime))]"
              : "border-white/[0.07] bg-white/[0.03] text-white/60 hover:border-white/[0.12] hover:bg-white/[0.05] hover:text-white",
          )}
        >
          <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border", isActive ? "border-og-lime/30 bg-og-lime/15 text-og-lime" : accentIcon(opt.accent))}>
            <opt.Icon className="h-4 w-4" />
          </span>
          <span className="min-w-0">
            <span className={cn("block text-[9px] font-bold uppercase tracking-widest", isActive ? "text-og-lime" : accentText(opt.accent))}>{opt.eyebrow}</span>
            <span className="block text-[13px] font-black leading-tight">{opt.label}</span>
          </span>
        </button>
      );
    })}
  </div>
);

const truthSuiteOptions: SuiteOption<"scanner" | "og-finder">[] = [
  { id: "scanner", label: "Scanner", eyebrow: "Mint scan", description: "Risk, liquidity, holders, dominance.", Icon: Search, accent: "lime" },
  { id: "og-finder", label: "OG Finder", eyebrow: "Origin proof", description: "First mint, lineage, clone check.", Icon: Crosshair, accent: "white" },
];

const launchSuiteOptions: SuiteOption<"snipe-feed" | "migrations">[] = [
  { id: "snipe-feed", label: "Snipe Feed", eyebrow: "Fresh launches", description: "New launches, repeat devs, risk.", Icon: Target, accent: "cyan" },
  { id: "migrations", label: "Migrations", eyebrow: "Pump.fun → DEX", description: "Migration timing and breakouts.", Icon: Rocket, accent: "gold" },
];

const marketSuiteOptions: SuiteOption<"feed" | "trending" | "news-signal">[] = [
  { id: "feed", label: "Live Feed", eyebrow: "Narrative tape", description: "Trending, runners, bundles, boosts.", Icon: Rss, accent: "lime" },
  { id: "trending", label: "Trending", eyebrow: "Market heat", description: "Fastest-moving tokens now.", Icon: Flame, accent: "cyan" },
  { id: "news-signal", label: "News Signal", eyebrow: "Influencer intel", description: "Elon, Trump, White House — find coins early.", Icon: Radio, accent: "lime" },
];

const TruthScanSuite = ({ onSelect }: { onSelect: (m: string) => void }) => {
  const [active, setActive] = useState<"scanner" | "og-finder">("scanner");
  return (
    <section className="space-y-4">
      <ToolHeader
        icon={Crosshair}
        title="Truth Scanner"
        subtitle="Verify any token's origin, detect clones, and surface the real OG with forensic-grade chain analysis."
        gradient="from-emerald-500 to-green-400"
        glowColor="rgba(16,185,129,0.25)"
        badge="FORENSIC"
        badgeColor="lime"
      />
      <SuiteNav options={truthSuiteOptions} activeId={active} onChange={setActive} />
      {active === "scanner" ? <Scanner onSelect={onSelect} /> : <OgFinder onSelect={onSelect} />}
      {/* 20x Features */}
      <div className="space-y-3 mt-4">
        <ScanHistory onSelect={onSelect} />
        <ComparativeScan onSelect={onSelect} />
      </div>
    </section>
  );
};

const LaunchRadarSuite = ({ onSelect }: { onSelect: (m: string) => void }) => {
  const [active, setActive] = useState<"snipe-feed" | "migrations">("snipe-feed");
  return (
    <section className="space-y-4">
      <ToolHeader
        icon={Rocket}
        title="Launch Radar"
        subtitle="Track new token launches from Pump.fun, monitor migrations to DEX, and get early alerts on breakout potential."
        gradient="from-amber-500 to-yellow-400"
        glowColor="rgba(245,158,11,0.25)"
        badge="LIVE"
        badgeColor="gold"
      />
      <SuiteNav options={launchSuiteOptions} activeId={active} onChange={setActive} />
      {active === "snipe-feed" ? <SnipeFeed onSelect={onSelect} /> : <Migrations onSelect={onSelect} />}
      {/* 20x Features */}
      <div className="space-y-3 mt-4">
        <LaunchAlerts />
      </div>
    </section>
  );
};

const MarketFeedSuite = ({ mint, onSelect }: { mint: string; onSelect: (m: string) => void }) => {
  const [active, setActive] = useState<"feed" | "trending" | "news-signal">("feed");
  return (
    <section className="space-y-4">
      <ToolHeader
        icon={Rss}
        title="Market Feed"
        subtitle="Trending tokens, narrative signals, and live market tape — the pulse of Solana in one view."
        gradient="from-cyan-500 to-blue-400"
        glowColor="rgba(6,182,212,0.25)"
        badge="STREAMING"
        badgeColor="cyan"
      />
      <SuiteNav options={marketSuiteOptions} activeId={active} onChange={setActive} />
      {active === "feed" && <Feed onSelect={onSelect} />}
      {active === "trending" && <Trending onSelect={onSelect} />}
      {active === "news-signal" && <NewsSignal onSelect={onSelect} />}
      {/* 20x Features */}
      <div className="space-y-3 mt-4">
        <MomentumHeatmap onSelectMint={onSelect} />
        <NarrativeClusters onSelectMint={onSelect} />
        <TradingLobbies onSelectMint={onSelect} />
        <CalloutLeaderboard />
      </div>
    </section>
  );
};

/* ─── Inline wrappers: render Communities / Discover without their own AppLayout ─── */

/**
 * CommunitiesInline — Communities renders inline (no AppLayout), drop in directly.
 */
const CommunitiesInline = () => <CommunitiesPage />;

const DiscoverInline = () => {
  const [discoverTab, setDiscoverTab] = useState<"explore" | "launchpads" | "viral" | "launches">("explore");
  const discoverTabs = [
    { id: "explore" as const, label: "🔥 Explore", desc: "Trending tokens" },
    { id: "launchpads" as const, label: "🚀 Launchpads", desc: "Pump.fun, Moonshot, Believe" },
    { id: "viral" as const, label: "⚡ Viral", desc: "Going viral" },
    { id: "launches" as const, label: "🆕 Launches", desc: "New tokens" },
  ];
  return (
    <div className="space-y-4">
      {/* Discover sub-nav */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
        {discoverTabs.map(t => (
          <button key={t.id} onClick={() => setDiscoverTab(t.id)}
            className={cn("shrink-0 px-3 py-2 rounded-xl text-[11px] font-bold transition-all whitespace-nowrap",
              discoverTab === t.id
                ? "bg-primary/10 text-primary border border-primary/20"
                : "text-white/25 hover:text-white/40 border border-transparent"
            )}>
            {t.label}
          </button>
        ))}
      </div>
      {discoverTab === "explore" && <TokenExplorer />}
      {discoverTab === "launchpads" && <LaunchpadExplorer />}
      {discoverTab === "viral" && <ViralFeed />}
      {discoverTab === "launches" && <LaunchTracker />}
    </div>
  );
};

export default Index;

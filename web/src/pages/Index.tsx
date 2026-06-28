import React, { useEffect, useMemo, useRef, useState, useTransition, type ComponentType, type ReactNode, lazy, Suspense } from "react";
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
  Hash,
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
  Pencil,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { DEFAULT_OG_MINT, OGSCAN_TOKEN_MINT, SOL_MINT, STORAGE_OG_MINT, shortAddr, type JupTokenInfo } from "@/lib/og";
import { CoinDetailDialog } from "@/components/CoinDetailDialog";
import { AuthButton } from "@/components/AuthButton";
import { AppTopBar } from "@/components/AppTopBar";
import { AppSidebar } from "@/components/AppSidebar";
import { SocialTopBar } from "@/components/layout/SocialTopBar";
import { BottomNav } from "@/components/layout/BottomNav";
import { ToolHeader, EmeraldHeader, SegmentedTabs } from "@/components/ToolPageShell";

/* ─── Standard Feature imports ─── */
const OgStats = lazy(() => import("@/components/OgStats").then(m => ({ default: m.OgStats })));
const Scanner = lazy(() => import("@/components/Scanner").then(m => ({ default: m.Scanner })));
const Trending = lazy(() => import("@/components/Trending").then(m => ({ default: m.Trending })));
const OgFinder = lazy(() => import("@/components/OgFinder").then(m => ({ default: m.OgFinder })));
const PairTracker = lazy(() => import("@/components/PairTracker").then(m => ({ default: m.PairTracker })));
const Migrations = lazy(() => import("@/components/Migrations").then(m => ({ default: m.Migrations })));
const TxFeed = lazy(() => import("@/components/TxFeed").then(m => ({ default: m.TxFeed })));
const Whales = lazy(() => import("@/components/Whales").then(m => ({ default: m.Whales })));
const GamesPage = lazy(() => import("@/pages/Games").then(m => ({ default: m.default })));
const TechStack = lazy(() => import("@/components/TechStack").then(m => ({ default: m.TechStack })));
const OurCoin = lazy(() => import("@/components/OurCoin").then(m => ({ default: m.OurCoin })));
const SnipeFeed = lazy(() => import("@/components/SnipeFeed").then(m => ({ default: m.SnipeFeed })));
const Feed = lazy(() => import("@/components/Feed").then(m => ({ default: m.Feed })));
const NewsSignal = lazy(() => import("@/components/NewsSignal").then(m => ({ default: m.NewsSignal })));
const SolToolsRoadmap = lazy(() => import("@/components/SolToolsRoadmap").then(m => ({ default: m.SolToolsRoadmap })));

/* ─── Merged tool imports ─── */
const importAboutOgScan = () => import("@/components/AboutOgScan");
const importTokenIntel = () => import("@/components/TokenIntel");
const AboutOgScan = lazy(() => importAboutOgScan().then(m => ({ default: m.AboutOgScan })));
const TokenIntel = lazy(() => importTokenIntel().then(m => ({ default: m.TokenIntel })));
const importTokenResearch = () => import("@/components/TokenResearch");
const TokenResearch = lazy(() => importTokenResearch().then(m => ({ default: m.TokenResearch })));

/* ─── Page imports ─── */
const importCommunitiesPage = () => import("./Communities");
const importCoinCommunitiesPage = () => import("./CoinCommunitiesPage");
const importDiscoverPage = () => import("./Discover");
const importDiscoverHub = () => import("./DiscoverHub");
const importArtFeedPage = () => import("./ArtFeed");
const importSpacesPage = () => import("./Spaces");
const importSocialHubPage = () => import("./SocialHub");
const importCommunityHubPage = () => import("./CommunityHub");
const importToolsHubPage = () => import("./ToolsHub");
const importChartsPage = () => import("./Charts");
const importLiveTradingPage = () => import("./LiveTrading");
const importLiveFeedPage = () => import("./LiveFeed");
const importTokenManagerPage = () => import("./TokenManager");
const CommunitiesPage = lazy(importCommunitiesPage);
const CoinCommunitiesPageLazy = lazy(() => importCoinCommunitiesPage().then(m => ({ default: m.CoinCommunitiesPage })));
const DiscoverPage = lazy(importDiscoverPage);
const DiscoverHub = lazy(importDiscoverHub);
const ArtFeed = lazy(importArtFeedPage);
const SpacesPage = lazy(importSpacesPage);
const SocialHub = lazy(importSocialHubPage);
const CommunityHub = lazy(importCommunityHubPage);
const ToolsHub = lazy(importToolsHubPage);
const ChartsPage = lazy(importChartsPage);
const LiveTradingPage = lazy(importLiveTradingPage);
const LiveFeedPage = lazy(importLiveFeedPage);
const TokenManagerPage = lazy(importTokenManagerPage);
const TradingHubContent = lazy(() => import("./TradingHub").then(m => ({ default: m.TradingHubContent })));

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
const CryptoNewsFeed = lazy(() => import("@/components/market-feed-20x/CryptoNewsFeed").then(m => ({ default: m.CryptoNewsFeed })));
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

/* ─── Token Listings ─── */
const TokenListings = lazy(() => import("@/components/TokenListings").then(m => ({ default: m.TokenListings })));

/* ─── Phase 30 imports (Discover / Launchpad) ─── */
const TokenExplorer = lazy(() => import("@/components/discover-20x/TokenExplorer").then(m => ({ default: m.TokenExplorer })));
const ViralFeed = lazy(() => import("@/components/discover-20x/ViralFeed").then(m => ({ default: m.ViralFeed })));
const LaunchpadExplorer = lazy(() => import("@/components/discover-20x/LaunchpadExplorer").then(m => ({ default: m.LaunchpadExplorer })));
const LaunchTracker = lazy(() => import("@/components/launchpad-20x/LaunchTracker").then(m => ({ default: m.LaunchTracker })));

/* ─── Phase 31 imports (Multi-Chain Discover) ─── */
const MultiChainTokenExplorer = lazy(() => import("@/components/multi-chain/MultiChainTokenExplorer").then(m => ({ default: m.MultiChainTokenExplorer })));
const MultiChainLaunchpadExplorer = lazy(() => import("@/components/multi-chain/MultiChainLaunchpadExplorer").then(m => ({ default: m.MultiChainLaunchpadExplorer })));
const MultiChainViralFeed = lazy(() => import("@/components/multi-chain/MultiChainViralFeed").then(m => ({ default: m.MultiChainViralFeed })));
const MultiChainLaunchTracker = lazy(() => import("@/components/multi-chain/MultiChainLaunchTracker").then(m => ({ default: m.MultiChainLaunchTracker })));
const MemeGallery = lazy(() => import("@/components/memes-20x/MemeGallery").then(m => ({ default: m.MemeGallery })));
const ProDashboard = lazy(() => import("@/components/premium-20x/ProDashboard").then(m => ({ default: m.ProDashboard })));

/* ─── Tab Error Boundary — prevents black screen when a tab crashes ─── */
class TabErrorBoundary extends React.Component<
  { children: React.ReactNode; tabKey: string },
  { hasError: boolean; error: string | null }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: any) {
    return { hasError: true, error: error?.message || "Something went wrong." };
  }
  componentDidUpdate(prevProps: any) {
    // Reset when tab changes so switching away and back gives a fresh try
    if (prevProps.tabKey !== this.props.tabKey) {
      this.setState({ hasError: false, error: null });
    }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center gap-4 py-20 px-6 text-center">
          <p className="text-2xl">⚠️</p>
          <p className="text-sm font-bold text-white/60">This tab ran into an error.</p>
          <p className="text-xs text-white/30 max-w-xs">{this.state.error}</p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="mt-2 rounded-xl border border-white/10 bg-white/[0.05] px-5 py-2 text-xs text-white/50 hover:text-white"
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}



const LEGACY_DEFAULT_MINT = "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263";
const STORAGE_TAB = "og_scanner.active_site_tab";
const COMMUNITY_SUB_STORAGE_KEY = "og_community_sub_tab";

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
  | "coin-communities"
  | "tools"
  | "profile"
  | "charts"
  | "live-trading"
  | "live-feed-page"
  | "listings"
  | "token-manager"
  | "trading-hub"
  | "research";

type TabAccent = "blue" | "white" | "cyan" | "gold" | "lime";
type TabGroup = "Main" | "Forensics" | "Market" | "Project";
type CommunitySubTab = "social" | "rooms" | "spaces" | "communities" | "discover";

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
    label: "OFFICIAL OGS",
    slug: "our-coin",
    pageNumber: 2,
    eyebrow: "Official Token Room",
    description: "Custom OG Scan coin tab with branded banner art, live charting, buy flow, ATH, migration bar, and full token scan details.",
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
    id: "listings",
    label: "Listings",
    slug: "listings",
    pageNumber: 28,
    eyebrow: "Token Listings",
    description: "List & promote tokens — paste a CA, Helius pulls all data, analytics, and verdict.",
    Icon: Star,
    accent: "gold",
    group: "Main",
  },
  {
    id: "token-manager",
    label: "Token Manager",
    slug: "token-manager",
    pageNumber: 29,
    eyebrow: "Free On-Chain Update",
    description: "Update your token's image, description & links on-chain — changes show on every platform. Free.",
    Icon: Pencil,
    accent: "lime",
    group: "Main",
  },
  {
    id: "trading-hub",
    label: "Trading Hub",
    slug: "trading-hub",
    pageNumber: 30,
    eyebrow: "Pro Trading Suite",
    description: "Token Launcher, Trading Lobbies, and Alpha Callouts — all in one place.",
    Icon: TrendingUp,
    accent: "lime",
    group: "Main",
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
    id: "coin-communities",
    label: "CC Feed",
    slug: "coin-communities",
    pageNumber: 28,
    eyebrow: "Cross-Coin Feed",
    description: "Live feed and top communities powered by CoinCommunities — real posts from real traders.",
    Icon: Globe,
    accent: "lime",
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
  {
    id: "research",
    label: "Research",
    slug: "research",
    pageNumber: 32,
    eyebrow: "Social · On-Chain · Clones",
    description: "Full token intelligence: X/Twitter mentions, Reddit, on-chain top traders, holders, and clone detection.",
    Icon: Search,
    accent: "lime",
    group: "Forensics",
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
    home: "overview",
    market: "feed",
    "market-command": "feed",
    "live-feed": "feed",
    feed: "feed",
    tape: "tx-feed",
    transactions: "tx-feed",
    "transaction-feed": "tx-feed",
    "orbitx-scanner": "scanner",
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
    "trading-hub": "trading-hub",
    wallets: "live-trading",
    games: "games",
    "phantom-trade": "live-trading",
    "phantom-trading": "live-trading",
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
  if (id === "overview") return "/home";
  return `/${TAB_BY_ID[id].slug}`;
};

const renderTool = (tab: TabId, mint: string, updateMint: (m: string) => void, onNavigate?: (t: string) => void, profileViewUserId?: string, listingMint?: string): ReactNode => {
  /* ─── Consolidated: About OGScan (token + roadmap + tech) ─── */
  if (tab === "our-coin") return <OurCoin />;
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
  if (tab === "games") return <Suspense fallback={<div className="flex items-center justify-center h-48 text-white/30 text-sm">Loading…</div>}><GamesPage /></Suspense>;

  /* ─── Social / community pages ─── */
  if (tab === "communities") return (
    <TabErrorBoundary tabKey="communities">
      <Suspense fallback={<div className="flex items-center justify-center h-48 text-white/30 text-sm">Loading…</div>}>
        <CommunitiesInline />
      </Suspense>
    </TabErrorBoundary>
  );
  if (tab === "coin-communities") return <Suspense fallback={<div className="flex items-center justify-center h-48 text-white/30 text-sm">Loading...</div>}><CoinCommunitiesPageLazy /></Suspense>;
  if (tab === "discover") return null; // rendered separately in JSX tree
  if (tab === "memes") return <ArtFeed inline />;
  if (tab === "spaces") return <SpacesPage />;
  if (tab === "social") return <SocialHub />;
  if (tab === "tools") return <ToolsTabbed mint={mint} onSelectMint={updateMint} />;
  if (tab === "research") return <TokenResearch />;
  if (tab === "listings") return <TokenListings initialMint={listingMint} />;
  if (tab === "profile") return <UserProfile viewUserId={profileViewUserId} />;
  if (tab === "live-trading") return <LiveTradingPage />;
  if (tab === "live-feed-page") return <LiveFeedPage />;
  if (tab === "token-manager") return <TokenManagerPage />;
  if (tab === "trading-hub") return <Suspense fallback={<div className="flex items-center justify-center h-48 text-white/30 text-sm">Loading...</div>}><TradingHubContent onNavigate={onNavigate} /></Suspense>;
  return null;
};

const preloadTab = (tab: TabId): void => {
  switch (tab) {
    case "our-coin":
      void import("@/components/OurCoin");
      return;
    case "roadmap":
    case "tech":
      void importAboutOgScan();
      return;
    case "market-pulse":
    case "pairs":
    case "whales":
    case "tx-feed":
    case "charts":
      void importTokenIntel();
      return;
    case "communities":
      void importCommunitiesPage();
      return;
    case "coin-communities":
      void importCoinCommunitiesPage();
      return;
    case "discover":
      void importDiscoverPage();
      return;
    case "memes":
      void importArtFeedPage();
      return;
    case "spaces":
      void importSpacesPage();
      return;
    case "social":
      void importSocialHubPage();
      return;
    case "community":
      void importCommunityHubPage();
      return;
    case "tools":
      void importToolsHubPage();
      return;
    case "profile":
      void import("@/components/profile-20x/UserProfile");
      return;
    case "listings":
      void import("@/components/TokenListings");
      return;
    case "live-trading":
      void importLiveTradingPage();
      return;
    case "live-feed-page":
      void importLiveFeedPage();
      return;
    case "token-manager":
      void importTokenManagerPage();
      return;
    case "scanner":
    case "og-finder":
      void import("@/components/scanner-20x/RugScore");
      void import("@/components/scanner-20x/DevWalletDNA");
      void import("@/components/scanner-20x/ScanHistory");
      void import("@/components/scanner-20x/BundleVisual");
      void import("@/components/scanner-20x/ComparativeScan");
      void import("@/components/scanner-20x/ScanShare");
      return;
    case "snipe-feed":
    case "migrations":
      void import("@/components/launch-radar-20x/LaunchQualityScore");
      void import("@/components/launch-radar-20x/CreatorPatterns");
      void import("@/components/launch-radar-20x/MigrationTimer");
      void import("@/components/launch-radar-20x/FirstBuyersForensics");
      void import("@/components/launch-radar-20x/LaunchAlerts");
      return;
    case "feed":
    case "trending":
    case "news-signal":
      void import("@/components/Feed");
      void import("@/components/Trending");
      void import("@/components/NewsSignal");
      return;
    default:
      return;
  }
};

const toolFallback = (
  <div className="min-h-[52vh] rounded-[28px] border border-white/[0.06] bg-white/[0.02] px-6 py-16">
    <div className="flex h-full min-h-[32vh] flex-col items-center justify-center gap-4 text-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-og-cyan/40 border-t-og-cyan" />
      <div>
        <p className="text-sm font-bold text-white/75">Loading tab…</p>
        <p className="mt-1 text-xs text-white/35">Keeping navigation warm so switches don’t drop into a blank screen.</p>
      </div>
    </div>
  </div>
);

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
  const { toolSlug, pageNumber, mintAddress: listingMint } = useParams<{ toolSlug?: string; pageNumber?: string; mintAddress?: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const pathSlug: string = location.pathname.replace(/^\/+|\/+$/g, "").split("/").pop() ?? "";
  /* /profile/:userId → always resolve to "profile" tab regardless of userId segment */
  const isProfileSubRoute = location.pathname.startsWith("/profile");
  const profileViewUserId = isProfileSubRoute ? location.pathname.split("/profile/")[1]?.split(/[?#/]/)[0] || undefined : undefined;
  /* /listings/:mintAddress → resolve to "listings" tab with deep-link */
  const isListingSubRoute = location.pathname.startsWith("/listings/") && !!listingMint;
  const routeSlug: string | undefined = isProfileSubRoute ? "profile" : isListingSubRoute ? "listings" : (pageNumber ? `page-${pageNumber}` : toolSlug ?? pathSlug);
  const routeTab: TabId = useMemo<TabId>(() => getTabFromSlug(routeSlug) ?? "overview", [routeSlug]);
  const [mint, setMint] = useState<string>(DEFAULT_OG_MINT);
  const [selectedWallet, setSelectedWallet] = useState<string>("");
  const [tab, setTab] = useState<TabId>(routeTab);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isTabPending, startTabTransition] = useTransition();


  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_OG_MINT);
      if (saved && saved !== LEGACY_DEFAULT_MINT && saved !== SOL_MINT) setMint(saved);
      else { setMint(DEFAULT_OG_MINT); localStorage.setItem(STORAGE_OG_MINT, DEFAULT_OG_MINT); }
    } catch { /* noop */ }
  }, []);

  useEffect(() => {
    preloadTab(routeTab);
    if (routeTab === tab) return;
    startTabTransition(() => setTab(routeTab));
  }, [routeTab, tab]);

  useEffect(() => {
    if (routeSlug && !getTabFromSlug(routeSlug)) navigate("/home", { replace: true });
  }, [navigate, routeSlug]);

  useEffect(() => {
    const preload = () => {
      void importAboutOgScan();
      void importTokenIntel();
      void importCommunitiesPage();
      void importDiscoverPage();
      void importArtFeedPage();
      void importSpacesPage();
      void importSocialHubPage();
      void importCommunityHubPage();
      void importToolsHubPage();
      void importChartsPage();
      void importLiveTradingPage();
      void importLiveFeedPage();
      preloadTab("profile");
      preloadTab("our-coin");
      preloadTab("scanner");
      preloadTab("feed");
    };

    if (typeof window === "undefined") {
      preload();
      return;
    }

    const idleWindow = window as Window & { requestIdleCallback?: (cb: () => void) => number; cancelIdleCallback?: (id: number) => void };
    if (idleWindow.requestIdleCallback) {
      const id = idleWindow.requestIdleCallback(preload);
      return () => idleWindow.cancelIdleCallback?.(id);
    }

    const timeoutId = window.setTimeout(preload, 250);
    return () => window.clearTimeout(timeoutId);
  }, []);

  useEffect(() => { window.scrollTo({ top: 0, behavior: "auto" }); }, [location.pathname, tab]);

  const activeTab = useMemo<TabConfig>(() => TABS.find((t) => t.id === tab) ?? TABS[0], [tab]);

  const switchTab = (next: string): void => {
    const safe: TabId = TABS.some((t) => t.id === next) ? (next as TabId) : "overview";
    const targetPath = getTabPath(safe);

    preloadTab(safe);
    try { localStorage.setItem(STORAGE_TAB, safe); } catch { /* noop */ }

    if (safe === tab && location.pathname === targetPath) return;

    startTabTransition(() => {
      setTab(safe);
      navigate(targetPath);
    });
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
    <div className="st-workspace flex h-screen overflow-hidden bg-background text-foreground relative">
      {/* Wallpaper layer — very subtle, pushed far back */}
      {customWallpaper && (
        <div className="pointer-events-none fixed inset-0 z-0 bg-cover bg-center bg-no-repeat opacity-15" style={{ backgroundImage: `url(${customWallpaper})` }}>
          <div className="absolute inset-0 bg-background/80 backdrop-blur-md" />
        </div>
      )}

      {/* Main content */}
      <div className="relative z-10 flex min-w-0 flex-1 min-h-0 flex-col">
        {/* Top bar + horizontal tab strip */}
        <SocialTopBar activeId={tab} onNavigate={switchTab} />

        {isTabPending && (
          <div className="sticky top-16 z-20 h-1 w-full overflow-hidden bg-white/[0.03]">
            <div className="h-full w-full animate-pulse bg-gradient-to-r from-transparent via-og-cyan/70 to-transparent" />
          </div>
        )}

        {/* Page content */}
        {tab === "community" || tab === "social" ? (
          <main className="min-h-0 flex-1 overflow-hidden pb-[4.5rem] lg:pb-0">
            <Suspense fallback={<div className="flex items-center justify-center h-48 text-white/30 text-sm">Loading Community...</div>}>
              <CommunityHub />
            </Suspense>
          </main>
        ) : tab === "discover" ? (
          <main className="min-h-0 flex-1 overflow-hidden pb-[4.5rem] lg:pb-0">
            <Suspense fallback={<div className="flex items-center justify-center h-48 text-white/30 text-sm">Loading Discover...</div>}>
              <DiscoverHub />
            </Suspense>
          </main>
        ) : tab === "live-trading" ? (
          <main className="min-h-0 flex-1 overflow-hidden pb-[4.5rem] lg:pb-0">
            <Suspense fallback={<div className="flex items-center justify-center h-48 text-white/30 text-sm">Loading...</div>}>
              <LiveTradingPage />
            </Suspense>
          </main>
        ) : tab === "live-feed-page" ? (
          <main className="min-h-0 flex-1 overflow-hidden pb-[4.5rem] lg:pb-0">
            <Suspense fallback={<div className="flex items-center justify-center h-48 text-white/30 text-sm">Loading Streams...</div>}>
              <LiveFeedPage />
            </Suspense>
          </main>
        ) : tab === "coin-communities" ? (
          <main className="min-h-0 flex-1 overflow-hidden pb-[4.5rem] lg:pb-0 flex flex-col">
            <Suspense fallback={<div className="flex items-center justify-center h-48 text-white/30 text-sm">Loading...</div>}>
              <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                <CoinCommunitiesPageLazy />
              </div>
            </Suspense>
          </main>
        ) : (
          <main className={cn(
            "min-h-0 flex-1 overflow-x-hidden pb-28 lg:pb-8",
            tab === "profile" ? "px-0 pt-0" : "px-3 pt-4 sm:px-5 lg:px-6",
          )}>
            {tab === "overview" ? (
              <OverviewPage
                mint={mint}
                onSwitchTab={(t: TabId) => switchTab(t)}
                onScanClick={() => switchTab("scanner")}
                onChangeMint={promptMint}
                onSelectMint={updateMint}
              />
            ) : tab === "profile" ? (
              <Suspense fallback={toolFallback}>
                {renderTool(tab, mint, updateMint, switchTab, profileViewUserId, isListingSubRoute ? listingMint : undefined)}
              </Suspense>
            ) : (
              <ToolShell tab={activeTab} onBack={() => switchTab("tools")}><Suspense fallback={toolFallback}>{renderTool(tab, mint, updateMint, switchTab, profileViewUserId, isListingSubRoute ? listingMint : undefined)}</Suspense></ToolShell>
            )}
          </main>
        )}
      </div>

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
const TOOL_TABS: { id: TabId; label: string }[] = [
  { id: "scanner", label: "Scanner" },
  { id: "snipe-feed", label: "Market Radar" },
  { id: "listings", label: "Listings" },
  // Token Manager hidden from view for now (still routable directly).
];

/* Tools — one page, top tab bar, every tool suite in one place. */
const ToolsTabbed = ({ mint, onSelectMint }: { mint: string; onSelectMint: (m: string) => void }) => {
  const [active, setActive] = useState<TabId>("scanner");
  const fallback = <div className="flex items-center justify-center h-48 text-white/30 text-sm">Loading…</div>;
  return (
    <div className="flex flex-col">
      <div className="mb-3 flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {TOOL_TABS.map((tt) => (
          <button key={tt.id} type="button" onClick={() => setActive(tt.id)}
            className={cn("shrink-0 rounded-full px-3.5 py-1.5 text-[12px] font-bold transition",
              active === tt.id ? "bg-primary text-primary-foreground" : "border border-white/10 bg-white/[0.03] text-white/55 hover:text-white/85")}>
            {tt.label}
          </button>
        ))}
      </div>
      <Suspense fallback={fallback}>
        {active === "scanner" && <TruthScanSuite onSelect={onSelectMint} />}
        {active === "snipe-feed" && <MarketRadarSuite mint={mint} onSelect={onSelectMint} />}
        {active === "listings" && <TokenListings />}
      </Suspense>
    </div>
  );
};

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
  const { user, profile } = useAuth();
  const [popupMint, setPopupMint] = useState<string | null>(null);
  const popupToken: JupTokenInfo | null = popupMint ? { id: popupMint, name: "", symbol: "", decimals: 9 } : null;
  type HomePanel = "watchlist" | "alpha" | "leaders" | "paper" | "calendar" | "calc";
  const [panel, setPanel] = useState<HomePanel>("watchlist");
  const quickActions: { label: string; Icon: ComponentType<{ className?: string }>; accent: TabAccent; onClick: () => void }[] = [
    { label: "Scanner", Icon: Search, accent: "lime", onClick: () => onSwitchTab("scanner") },
    { label: "Launches", Icon: Rocket, accent: "cyan", onClick: () => onSwitchTab("snipe-feed") },
    { label: "Market", Icon: Flame, accent: "gold", onClick: () => onSwitchTab("feed") },
    { label: "Spaces", Icon: Radio, accent: "cyan", onClick: () => openCommunitySub("spaces") },
    { label: "Chat", Icon: MessageSquare, accent: "cyan", onClick: () => openCommunitySub("social") },
    { label: "Dev Radar", Icon: Crosshair, accent: "gold", onClick: () => onSwitchTab("dev-wallet-radar") },
    { label: "Tools", Icon: Wrench, accent: "white", onClick: () => onSwitchTab("tools") },
    { label: "Profile", Icon: User, accent: "lime", onClick: () => onSwitchTab("profile") },
  ];
  const homePanels: { id: HomePanel; label: string }[] = [
    { id: "watchlist", label: "Watchlist" },
    { id: "alpha", label: "Alpha" },
    { id: "leaders", label: "Leaders" },
    { id: "paper", label: "Paper Trade" },
    { id: "calendar", label: "Calendar" },
    { id: "calc", label: "Calc" },
  ];

  const openCommunitySub = (sub: CommunitySubTab) => {
    try {
      localStorage.setItem(COMMUNITY_SUB_STORAGE_KEY, sub);
      window.dispatchEvent(new Event("og:community-sub-tab"));
    } catch { /* noop */ }
    onSwitchTab("community");
  };

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  })();

  const displayName = profile?.display_name || profile?.username || "OG";

  // Feature highlight cards — the 4 main entry points
  const featureCards = [
    {
      eyebrow: "FORENSICS",
      title: "Truth Scanner",
      desc: "Rug score, dev wallet DNA, holder risk, bundle detection",
      Icon: Search,
      accent: "lime" as TabAccent,
      tab: "scanner" as TabId,
      badge: "LIVE",
      gradient: "from-og-lime/10 to-og-lime/[0.02]",
      glow: "shadow-[0_8px_32px_-12px_hsl(var(--og-lime)/0.4)]",
    },
    {
      eyebrow: "LAUNCHES",
      title: "Launch Radar",
      desc: "Fresh mints, migrations, repeat dev flags, snipe alerts",
      Icon: Rocket,
      accent: "cyan" as TabAccent,
      tab: "snipe-feed" as TabId,
      badge: "STREAMING",
      gradient: "from-og-cyan/10 to-og-cyan/[0.02]",
      glow: "shadow-[0_8px_32px_-12px_hsl(var(--og-cyan)/0.4)]",
    },
    {
      eyebrow: "MARKET",
      title: "Market Feed",
      desc: "Trending tokens, whale moves, narratives, news signals",
      Icon: Flame,
      accent: "gold" as TabAccent,
      tab: "feed" as TabId,
      badge: "HOT",
      gradient: "from-og-gold/10 to-og-gold/[0.02]",
      glow: "shadow-[0_8px_32px_-12px_hsl(var(--og-gold)/0.4)]",
    },
    {
      eyebrow: "COMMUNITY",
      title: "OG Spaces",
      desc: "Voice rooms, live alpha calls, trader communities",
      Icon: Radio,
      accent: "cyan" as TabAccent,
      tab: "community" as TabId,
      communitySub: "spaces" as CommunitySubTab,
      badge: "OPEN",
      gradient: "from-purple-500/10 to-purple-500/[0.02]",
      glow: "shadow-[0_8px_32px_-12px_rgba(168,85,247,0.4)]",
    },
  ];

  // Community quick links — compact horizontal strip
  const communityLinks = [
    { label: "Chat", Icon: MessageSquare, sub: "social" as CommunitySubTab, accent: "cyan" as TabAccent },
    { label: "Rooms", Icon: Hash, sub: "rooms" as CommunitySubTab, accent: "cyan" as TabAccent },
    { label: "Spaces", Icon: Radio, sub: "spaces" as CommunitySubTab, accent: "gold" as TabAccent },
    { label: "Groups", Icon: Users, sub: "communities" as CommunitySubTab, accent: "lime" as TabAccent },
    { label: "Discover", Icon: Compass, sub: "discover" as CommunitySubTab, accent: "lime" as TabAccent },
  ];

  // Forensic tools — compact list
  const forensicTools = [
    { label: "Token Scanner", Icon: Search, tab: "scanner" as TabId, accent: "lime" as TabAccent, desc: "Risk & rug analysis" },
    { label: "OG Finder", Icon: Crosshair, tab: "og-finder" as TabId, accent: "white" as TabAccent, desc: "Origin & clone check" },
    { label: "Dev Wallet", Icon: Wallet, tab: "dev-wallet-radar" as TabId, accent: "gold" as TabAccent, desc: "Wallet DNA radar" },
    { label: "Snipe Feed", Icon: Target, tab: "snipe-feed" as TabId, accent: "cyan" as TabAccent, desc: "New launches live" },
  ];

  const spinnerSm = (color: string) => (
    <div className="h-36 rounded-2xl border border-white/[0.07] bg-white/[0.02] flex items-center justify-center">
      <div className={`h-4 w-4 border-2 ${color} border-t-transparent rounded-full animate-spin`} />
    </div>
  );

  return (
    <div className="space-y-5 pb-6">

      {/* ── HERO: greeting + avatar + scan bar ── */}
      <div className="relative overflow-hidden rounded-[1.75rem] border border-white/[0.09] bg-[#080e1a] p-5">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_0%_0%,hsl(var(--primary)/0.12),transparent_55%),radial-gradient(ellipse_at_100%_100%,hsl(var(--secondary)/0.08),transparent_55%)]" />

        <div className="relative flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative shrink-0">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="" className="h-12 w-12 rounded-2xl border border-white/15 object-cover" />
              ) : (
                <div className="h-12 w-12 rounded-2xl border border-white/15 bg-primary/10 flex items-center justify-center text-xl font-black text-primary">
                  {displayName[0]?.toUpperCase()}
                </div>
              )}
              <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-400 border-2 border-[#080e1a]" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold text-white/35 uppercase tracking-widest">{greeting}</p>
              <h1 className="text-[22px] font-black text-white truncate leading-tight">{displayName}</h1>
            </div>
          </div>
          <div className="shrink-0 flex items-center gap-2">
            {profile?.current_level && (
              <div className="flex items-center gap-1.5 rounded-xl border border-primary/25 bg-primary/[0.08] px-3 py-1.5">
                <Trophy className="h-3 w-3 text-primary" />
                <span className="text-[11px] font-black text-primary">LVL {profile.current_level}</span>
              </div>
            )}
          </div>
        </div>

        {/* Scan bar */}
        <div className="relative mt-4 flex items-center gap-2 rounded-2xl border border-white/[0.08] bg-black/20 px-4 py-3">
          <div className="flex-1 min-w-0">
            <p className="text-[9px] font-bold text-white/30 uppercase tracking-widest mb-0.5">Active Mint</p>
            <p className="font-mono text-sm font-black text-white truncate">{shortAddr(mint, 8)}</p>
          </div>
          <button
            type="button"
            onClick={onChangeMint}
            className="h-8 px-3 rounded-xl border border-white/10 bg-white/[0.06] text-[11px] font-bold text-white/50 transition hover:bg-white/[0.1] hover:text-white"
          >
            Change
          </button>
          <button
            type="button"
            onClick={onScanClick}
            className="h-8 px-4 rounded-xl bg-primary text-primary-foreground text-[12px] font-black transition hover:brightness-110 active:scale-95 flex items-center gap-1.5"
          >
            <Search className="h-3.5 w-3.5" />
            Scan
          </button>
        </div>
      </div>

      {/* QUICK ACTIONS */}
      <div>
        <p className="text-[11px] font-black text-white/30 uppercase tracking-widest mb-3">Quick Actions</p>
        <div className="grid grid-cols-4 gap-2.5">
          {quickActions.map((a) => (
            <button key={a.label} type="button" onClick={a.onClick}
              className="group flex flex-col items-center gap-2 rounded-2xl border border-white/[0.07] bg-white/[0.03] px-2 py-3.5 transition hover:border-white/[0.14] hover:bg-white/[0.06] active:scale-95">
              <span className={cn("flex h-11 w-11 items-center justify-center rounded-xl border", accentIcon(a.accent))}>
                <a.Icon className="h-5 w-5" />
              </span>
              <span className="text-[10.5px] font-bold text-white/70 text-center leading-tight">{a.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* SEGMENTED INSIGHTS PANEL — one view at a time to keep the home short */}
      <div>
        <div className="mb-3 flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {homePanels.map((pp) => (
            <button key={pp.id} type="button" onClick={() => setPanel(pp.id)}
              className={cn("shrink-0 rounded-full px-3.5 py-1.5 text-[12px] font-bold transition",
                panel === pp.id ? "bg-primary text-primary-foreground" : "border border-white/10 bg-white/[0.03] text-white/50 hover:text-white/80")}>
              {pp.label}
            </button>
          ))}
        </div>
        {panel === "watchlist" && <Suspense fallback={spinnerSm("border-secondary")}><SmartWatchlist onSelectMint={(m: string) => setPopupMint(m)} /></Suspense>}
        {panel === "alpha" && <Suspense fallback={spinnerSm("border-og-gold")}><AlphaCallouts onSelectMint={(m: string) => { onSelectMint(m); onSwitchTab("scanner"); }} /></Suspense>}
        {panel === "leaders" && <Suspense fallback={spinnerSm("border-primary")}><PlatformLeaderboard /></Suspense>}
        {panel === "paper" && <Suspense fallback={spinnerSm("border-primary")}><PaperTrading onSelectMint={(m: string) => { onSelectMint(m); onSwitchTab("scanner"); }} /></Suspense>}
        {panel === "calendar" && <Suspense fallback={spinnerSm("border-secondary")}><CryptoCalendar /></Suspense>}
        {panel === "calc" && <Suspense fallback={spinnerSm("border-primary")}><QuickCalc /></Suspense>}
      </div>

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
  // Unified OrbitX Scanner — self-contained forensic scanner (header, search, modules, history, compare).
  return <Scanner onSelect={onSelect} />;
};

const LaunchRadarSuite = ({ onSelect }: { onSelect: (m: string) => void }) => {
  const [active, setActive] = useState<"snipe-feed" | "migrations">("snipe-feed");
  const launchTabs = [
    { id: "snipe-feed" as const, label: "Snipe Feed", desc: "Fresh launches", Icon: Target },
    { id: "migrations" as const, label: "Migrations", desc: "Pump.fun \u2192 DEX", Icon: Rocket },
  ];
  return (
    <section className="space-y-4">
      {/* Header */}
      <div className="relative overflow-hidden rounded-3xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/[0.06] via-white/[0.02] to-transparent p-5">
        <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-emerald-500/20 blur-3xl" />
        <div className="relative flex items-start gap-3">
          <div className="grid h-12 w-12 flex-none place-items-center rounded-2xl bg-gradient-to-br from-emerald-500 to-green-400 shadow-lg shadow-emerald-500/30">
            <Rocket className="h-6 w-6 text-white" strokeWidth={2.2} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black tracking-tight text-white">Launch Radar</h2>
              <span className="rounded-full border border-emerald-400/40 bg-emerald-500/15 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-emerald-300">Live</span>
            </div>
            <p className="mt-1 max-w-md text-xs leading-relaxed text-white/45">Fresh Solana launches scored in real time, dev-wallet clustering, risk flags, and Pump.fun migrations to DEX.</p>
          </div>
        </div>
      </div>

      {/* Segmented control */}
      <div className="flex gap-2">
        {launchTabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setActive(t.id)}
            className={cn(
              "flex flex-1 items-center gap-2.5 rounded-2xl border p-3 text-left transition",
              active === t.id ? "border-emerald-400/50 bg-emerald-500/[0.08]" : "border-white/10 bg-white/[0.03] hover:border-emerald-400/30 hover:bg-white/[0.05]"
            )}
          >
            <span className={cn("grid h-9 w-9 flex-none place-items-center rounded-xl", active === t.id ? "bg-emerald-500/20 text-emerald-300" : "bg-white/[0.04] text-white/40")}>
              <t.Icon className="h-4 w-4" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-bold text-white">{t.label}</span>
              <span className="block font-mono text-[9px] uppercase tracking-widest text-white/35">{t.desc}</span>
            </span>
          </button>
        ))}
      </div>

      {active === "snipe-feed" ? <SnipeFeed onSelect={onSelect} /> : <Migrations onSelect={onSelect} />}
      <LaunchAlerts />
    </section>
  );
};

type MarketTab = "feed" | "trending" | "signals";
const MARKET_TABS: { id: MarketTab; label: string; Icon?: ComponentType<{ className?: string }> }[] = [
  { id: "feed", label: "Live Feed", Icon: Rss },
  { id: "trending", label: "Trending", Icon: Flame },
  { id: "signals", label: "News", Icon: Radio },
];
const MarketFeedSuite = ({ mint, onSelect }: { mint: string; onSelect: (m: string) => void }) => {
  void mint;
  const [active, setActive] = useState<MarketTab>("feed");
  return (
    <section className="space-y-4">
      <EmeraldHeader
        icon={Rss}
        title="Market Feed"
        subtitle="The pulse of Solana — live market tape, trending movers with momentum, and narrative + news signals, in three clean views."
        badge="Streaming"
      />
      <SegmentedTabs tabs={MARKET_TABS} active={active} onChange={setActive} />
      {active === "feed" && <Feed onSelect={onSelect} />}
      {active === "trending" && <Trending onSelect={onSelect} />}
      {active === "signals" && <CryptoNewsFeed />}
    </section>
  );
};

/* ─── Market Radar — Launch Radar + Market Feed merged into one tab ─── */
type RadarTab = "launches" | "migrations" | "trending" | "signals";
const RADAR_TABS: { id: RadarTab; label: string; Icon?: ComponentType<{ className?: string }> }[] = [
  { id: "launches", label: "Launches", Icon: Target },
  { id: "migrations", label: "Migrations", Icon: Rocket },
  { id: "trending", label: "Trending", Icon: Flame },
  { id: "signals", label: "News", Icon: Radio },
];
const MarketRadarSuite = ({ mint, onSelect }: { mint: string; onSelect: (m: string) => void }) => {
  void mint;
  const [active, setActive] = useState<RadarTab>("launches");
  return (
    <section className="space-y-4">
      <EmeraldHeader
        icon={Rocket}
        title="Market Radar"
        subtitle="Fresh launches with dev + risk scoring, DEX migrations, trending movers, and live crypto news — every Solana feed in one clean place."
        badge="Live"
      />
      <SegmentedTabs tabs={RADAR_TABS} active={active} onChange={setActive} />
      {active === "launches" && (
        <div className="space-y-3">
          <SnipeFeed onSelect={onSelect} />
          <LaunchAlerts />
        </div>
      )}
      {active === "migrations" && <Migrations onSelect={onSelect} />}
      {active === "trending" && <Trending onSelect={onSelect} />}
      {active === "signals" && <CryptoNewsFeed />}
    </section>
  );
};

/* ─── Inline wrappers: render Communities / Discover without their own AppLayout ─── */

/**
 * CommunitiesInline — Communities renders inline (no AppLayout), drop in directly.
 */
const CommunitiesInline = () => <CommunitiesPage />;

const DiscoverInline = () => {
  const [discoverTab, setDiscoverTab] = useState<"explore" | "launchpads" | "viral" | "launches" | "mc-explore" | "mc-launchpads" | "mc-viral" | "mc-launches">("explore");
  const [discoverMode, setDiscoverMode] = useState<"solana" | "multichain">("solana");

  const solanaTabs = [
    { id: "explore" as const, label: "🔥 Explore", desc: "Trending tokens" },
    { id: "launchpads" as const, label: "🚀 Launchpads", desc: "Pump.fun, Moonshot, Believe" },
    { id: "viral" as const, label: "⚡ Viral", desc: "Going viral" },
    { id: "launches" as const, label: "🆕 Launches", desc: "New tokens" },
  ];

  const multiChainTabs = [
    { id: "mc-explore" as const, label: "🔥 Explore", desc: "All chains" },
    { id: "mc-launchpads" as const, label: "🚀 Launchpads", desc: "All chain launchpads" },
    { id: "mc-viral" as const, label: "⚡ Viral", desc: "Going viral" },
    { id: "mc-launches" as const, label: "🆕 Launches", desc: "New tokens" },
  ];

  const activeTabs = discoverMode === "solana" ? solanaTabs : multiChainTabs;

  // When switching modes, reset to the first tab of that mode
  const handleModeSwitch = (mode: "solana" | "multichain") => {
    setDiscoverMode(mode);
    setDiscoverTab(mode === "solana" ? "explore" : "mc-explore");
  };

  return (
    <div className="space-y-4">
      {/* Mode switcher — Solana vs Multi-Chain */}
      <div className="flex items-center gap-2">
        <div className="flex rounded-xl border border-white/[0.08] bg-white/[0.02] p-0.5">
          <button
            onClick={() => handleModeSwitch("solana")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all",
              discoverMode === "solana"
                ? "bg-[#9945FF]/15 text-[#14F195] border border-[#9945FF]/25"
                : "text-white/25 hover:text-white/40"
            )}
          >
            <span>◎</span> Solana
          </button>
          <button
            onClick={() => handleModeSwitch("multichain")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all",
              discoverMode === "multichain"
                ? "bg-primary/15 text-primary border border-primary/25"
                : "text-white/25 hover:text-white/40"
            )}
          >
            <span>🌐</span> All Chains
          </button>
        </div>
        {discoverMode === "multichain" && (
          <span className="text-[9px] text-white/15 ml-1">16 chains supported</span>
        )}
      </div>

      {/* Discover sub-nav */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
        {activeTabs.map(t => (
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

      {/* Solana mode (original components — untouched) */}
      {discoverTab === "explore" && <TokenExplorer />}
      {discoverTab === "launchpads" && <LaunchpadExplorer />}
      {discoverTab === "viral" && <ViralFeed />}
      {discoverTab === "launches" && <LaunchTracker />}

      {/* Multi-chain mode (new components) */}
      {discoverTab === "mc-explore" && <MultiChainTokenExplorer />}
      {discoverTab === "mc-launchpads" && <MultiChainLaunchpadExplorer />}
      {discoverTab === "mc-viral" && <MultiChainViralFeed />}
      {discoverTab === "mc-launches" && <MultiChainLaunchTracker />}
    </div>
  );
};

export default Index;

import { lazy, Suspense, useEffect } from "react";
import { lazyWithRetry } from "@/lib/lazyWithRetry";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useParams } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ThemeProvider } from "@/hooks/useTheme";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AdminRoute } from "@/components/AdminRoute";
import { MaintenanceLock } from "@/components/MaintenanceLock";
import { IntercomSync } from "@/components/IntercomSync";
import { OnboardingTour } from "@/components/OnboardingTour";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import BetaHome from "./pages/BetaHome";
import Index from "./pages/Index";
import Splash from "./pages/Splash";
import Hub from "./pages/Hub";
import KOLTracker from "./pages/KOLTracker";
import PnlTracker from "./pages/PnlTracker";
import NotFound from "./pages/NotFound";
import Auth from "./pages/Auth";
import AuthWallet from "./pages/AuthWallet";
import Setup from "./pages/Setup";
import Profile from "./pages/Profile";
import Settings from "./pages/Settings";
import Reports from "./pages/Reports";
import ReportView from "./pages/ReportView";
import TokenPublic from "./pages/TokenPublic";
import TrackRecord from "./pages/TrackRecord";
import Alerts from "./pages/Alerts";
import Tokens from "./pages/Tokens";
import Tools from "./pages/Tools";
// AdvancedTools removed
import AlphaChat from "./pages/AlphaChat";
// Credits page removed
// Webhooks removed
import TradingLobbies from "./pages/TradingLobbies";
import Leaderboard from "./pages/Leaderboard";
import Invite from "./pages/Invite";
import DirectMessages from "./pages/DirectMessages";
import Notifications from "./pages/Notifications";
import CommunityClassic from "./pages/CommunityClassic";
// Premium removed
import OfficialToken from "./pages/OfficialToken";
import PumpV5 from "./pages/PumpV5";
import Launch from "./pages/Launch";
import LaunchpadLayout from "./pages/orbitx/LaunchpadLayout";
import LaunchpadHome from "./pages/orbitx/LaunchpadHome";
import LaunchpadCreate from "./pages/orbitx/LaunchpadCreate";
import LaunchpadChoose from "./pages/orbitx/LaunchpadChoose";
// Terminal / Trading Platform UI
import LaunchpadTerminal from "./pages/orbitx/LaunchpadTerminal";
import TerminalHome from "./pages/orbitx/TerminalHome";
import TerminalTrade from "./pages/orbitx/TerminalTrade";
import TerminalPortfolio from "./pages/orbitx/TerminalPortfolio";
import TerminalLaunch from "./pages/orbitx/TerminalLaunch";
const IntelLayout = lazyWithRetry(() => import("./crypto/pages/IntelLayout"));
const IntelHome = lazyWithRetry(() => import("./crypto/pages/IntelHome"));
const TokenScanner = lazyWithRetry(() => import("./crypto/pages/TokenScanner"));
const TradeDesk = lazyWithRetry(() => import("./crypto/pages/TradeDesk"));
const PortfolioDesk = lazyWithRetry(() => import("./crypto/pages/PortfolioDesk"));
const TrendingIntel = lazyWithRetry(() => import("./crypto/pages/TrendingIntel"));
const WhaleIntel = lazyWithRetry(() => import("./crypto/pages/WhaleIntel"));
const SentimentIntel = lazyWithRetry(() => import("./crypto/pages/SentimentIntel"));
const LaunchStudio = lazyWithRetry(() => import("./crypto/pages/LaunchStudio"));
const WalletTracker = lazyWithRetry(() => import("./crypto/pages/WalletTracker"));
const SocialLayout = lazyWithRetry(() => import("./social/pages/SocialLayout"));
const SocialHomeHq = lazyWithRetry(() => import("./social/pages/SocialHome"));
const NetworkFeed = lazyWithRetry(() => import("./social/pages/NetworkFeed"));
const CommunitiesHub = lazyWithRetry(() => import("./social/pages/CommunitiesHub"));
const TradingCommunities = lazyWithRetry(() => import("./social/pages/TradingCommunities"));
const VoiceSpaces = lazyWithRetry(() => import("./social/pages/VoiceSpaces"));
const GrowthCenter = lazyWithRetry(() => import("./social/pages/GrowthCenter"));
const LeaderboardsPage = lazyWithRetry(() => import("./social/pages/LeaderboardsPage"));
const CreatorProgram = lazyWithRetry(() => import("./social/pages/CreatorProgram"));
const NotificationsPage = lazyWithRetry(() => import("./social/pages/NotificationsPage"));
const ProfileView = lazyWithRetry(() => import("./social/pages/ProfileView"));
const ModerationAdmin = lazyWithRetry(() => import("./social/pages/ModerationAdmin"));
const InviteLanding = lazyWithRetry(() => import("./social/pages/InviteLanding"));
const SocialMessagesPage = lazyWithRetry(() => import("./social/pages/SocialMessagesPage"));
const SocialChatPage = lazyWithRetry(() => import("./social/pages/SocialChatPage"));
const SocialRoomsPage = lazyWithRetry(() => import("./social/pages/SocialRoomsPage"));
const SocialSpacesPage = lazyWithRetry(() => import("./social/pages/SocialSpacesPage"));
import LaunchpadPump from "./pages/orbitx/LaunchpadPump";
import LaunchpadToken from "./pages/orbitx/LaunchpadToken";
import LaunchpadAbout from "./pages/orbitx/LaunchpadAbout";
import LaunchpadProfile from "./pages/orbitx/LaunchpadProfile";
import LaunchpadLeaderboard from "./pages/orbitx/LaunchpadLeaderboard";
import LaunchpadCreator from "./pages/orbitx/LaunchpadCreator";
import LaunchpadPortfolio from "./pages/orbitx/LaunchpadPortfolio";
import BagworkLayout from "./pages/bagwork/BagworkLayout";
import BagworkHome from "./pages/bagwork/BagworkHome";
import BagworkMyWork from "./pages/bagwork/BagworkMyWork";
import BagworkAdmin from "./pages/bagwork/BagworkAdmin";
import LaunchpadClaim from "./pages/orbitx/LaunchpadClaim";
import LaunchpadRescue from "./pages/orbitx/LaunchpadRescue";
import LaunchpadAdmin from "./pages/orbitx/LaunchpadAdmin";
import LaunchpadApiLaunch from "./pages/orbitx/LaunchpadApiLaunch";
import LaunchpadCurveEvm from "./pages/orbitx/LaunchpadCurveEvm";
import LaunchpadCurveTrade from "./pages/orbitx/LaunchpadCurveTrade";
import LaunchpadCurveMarkets from "./pages/orbitx/LaunchpadCurveMarkets";
const LaunchpadNftHub = lazyWithRetry(() => import("./pages/orbitx/LaunchpadNftHub"));
const LaunchpadNftCreate = lazyWithRetry(() => import("./pages/orbitx/LaunchpadNftCreate"));
const NftMarketLayout = lazyWithRetry(() => import("./pages/nft/MarketplaceLayout"));
const NftMarketHome = lazyWithRetry(() => import("./pages/nft/MarketplaceHome"));
const NftDrops = lazyWithRetry(() => import("./pages/nft/Drops"));
const NftActivity = lazyWithRetry(() => import("./pages/nft/Activity"));
const NftNotifications = lazyWithRetry(() => import("./pages/nft/Notifications"));
const NftCreatorProfile = lazyWithRetry(() => import("./pages/nft/CreatorProfile"));
const NftCollectionPage = lazyWithRetry(() => import("./pages/nft/CollectionPage"));
const NftCoinTrade = lazyWithRetry(() => import("./pages/nft/CoinTradePage"));
import Callouts from "./pages/Callouts";
import Charts from "./pages/Charts";
import LiveFeed from "./pages/LiveFeed";
import SupportCenter from "./pages/SupportCenter";
import SupportPage from "./pages/SupportPage";
import { SupportNotificationBanner } from "./components/SupportNotificationBanner";
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";
import { CCCallbackPage } from "./pages/CCCallbackPage";
import { SolanaWalletProvider } from "./contexts/SolanaWalletProvider";
import { EvmWalletProvider } from "@/hooks/useEvmWallet";
import { WalletAuthBridge } from "@/components/WalletAuthBridge";
import { UsernameClaimGate } from "@/components/UsernameClaimModal";
import Games from "./pages/Games";
import AdvancedIntelligence from "./pages/AdvancedIntelligence";
import EnhancedAdvancedIntelligence from "./pages/EnhancedAdvancedIntelligence";
import IntelligenceAdmin from "./pages/IntelligenceAdmin";
import AlertSettings from "./pages/AlertSettings";
import { XCallbackPage } from "./pages/XCallbackPage";
import Admin from "./pages/Admin";
import SpaceReplay from "./pages/SpaceReplay";
import PublicSpaceListen from "./pages/PublicSpaceListen";
import UserPublicPage from "./pages/UserPublicPage";
import UserPageWidget from "./pages/UserPageWidget";
import EmbedSpace from "./pages/EmbedSpace";
import EmbedProfile from "./pages/EmbedProfile";
import EmbedSpaces from "./pages/EmbedSpaces";
import EmbedSpacePlayer from "./pages/EmbedSpacePlayer";
import EmbedCombined from "./pages/EmbedCombined";
import DiscoveryFeed from "./pages/DiscoveryFeed";
import SpaceClips from "./pages/SpaceClips";
import SpaceScheduler from "./pages/SpaceScheduler";
import ExternalStreams from "./pages/ExternalStreams";
import HostAnalyticsDashboard from "./pages/HostAnalyticsDashboard";
import CommunityRooms from "./pages/CommunityRooms";
import SpaceShows from "./pages/SpaceShows";
import CoHostingManager from "./pages/CoHostingManager";
import WhiteLabelConfig from "./pages/WhiteLabelConfig";
import DevPortal from "./pages/DevPortal";
import AISpaceAssistant from "./pages/AISpaceAssistant";
import AIHostCopilot from "./pages/AIHostCopilot";
import Simulcast from "./pages/Simulcast";
import EnterpriseDashboard from "./pages/EnterpriseDashboard";
import MobileApp from "./pages/MobileApp";
import SpaceReminders from "./pages/SpaceReminders";
import AutoTweet from "./pages/AutoTweet";
import PodcastPublisher from "./pages/PodcastPublisher";
import ClipVideoExport from "./pages/ClipVideoExport";
import InstallApp from "./pages/InstallApp";
import { AppLayout } from "./components/layout/AppLayout";
import { NotificationListener } from "./components/notifications/NotificationListener";
import { PushNotificationPrompt } from "./components/notifications/PushNotificationPrompt";
import { PresenceHeartbeat } from "./components/PresenceHeartbeat";
import { SecurityTracker } from "./components/SecurityTracker";

const DirectMessagesPage = () => (
  <AppLayout>
    <div className="h-[calc(100vh-68px)] lg:h-screen">
      <DirectMessages />
    </div>
  </AppLayout>
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Retry failed requests up to 2 times before showing error state
      retry: 2,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000),
      // Keep stale data visible while refetching
      staleTime: 30_000,
    },
  },
});
const ArtFeedPage = lazyWithRetry(() => import("./pages/ArtFeed"));
const OrbitxCityPage = lazyWithRetry(() => import("./pages/orbitxcity/OrbitxCityPage"));
const OsApp = lazyWithRetry(() => import("./os/OsApp"));
const PlayApp = lazyWithRetry(() => import("./gaming/PlayApp"));

function RouteFallback({ label }: { label: string }) {
  return (
    <div className="flex min-h-[40vh] items-center justify-center bg-[#05080c] font-mono text-xs uppercase tracking-[0.18em] text-white/45">
      Loading {label}…
    </div>
  );
}


// Redirect legacy crypto/tools/coin routes into the OrbitX DEX app (/ORBITX_DEX).
function OgdexRedirect({ to }: { to: string | ((p: Record<string, string | undefined>) => string) }) {
  const params = useParams();
  useEffect(() => {
    const target = typeof to === "function" ? to(params) : to;
    window.location.replace(target);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

function HqRedirect({ to }: { to: string | ((p: Record<string, string | undefined>) => string) }) {
  const params = useParams();
  const target = typeof to === "function" ? to(params) : to;
  return <Navigate to={target} replace />;
}

const App = () => (
  <ErrorBoundary>
  <MaintenanceLock>
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <SolanaWalletProvider>
      <EvmWalletProvider>
      <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <NotificationListener />
        {/* <BurnAnnouncementListener /> */}
        <PushNotificationPrompt />
        <PresenceHeartbeat />
        <SecurityTracker />
        <IntercomSync />
        <OnboardingTour />
        <BrowserRouter>
          <SupportNotificationBanner />
          <WalletAuthBridge />
          <UsernameClaimGate />
          <Routes>
            {/* ── Public routes (no auth required) ── */}
            <Route path="/" element={<Splash />} />
            <Route path="/beta" element={<BetaHome />} />
            <Route path="/splash" element={<Splash />} />
            <Route path="/waitlist" element={<OgdexRedirect to="/auth?mode=signup" />} />
            <Route path="/auth" element={<AuthWallet />} />
            <Route path="/auth/email" element={<Auth />} />
            <Route path="/setup" element={<Setup />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/r/:id" element={<ReportView />} />
            <Route path="/t/:mint" element={<OgdexRedirect to={(p) => `/ORBITX_DEX/token/${p.mint}`} />} />
            <Route path="/track-record" element={<OgdexRedirect to="/ORBITX_DEX" />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/cc-callback" element={<CCCallbackPage />} />
            <Route path="/x-callback" element={<XCallbackPage />} />

            {/* ── Public: App install page ── */}
            <Route path="/install" element={<InstallApp />} />

            {/* ── OrbitX City (3D world demo) ── */}
            <Route
              path="/Orbitxcity"
              element={
                <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-[#04070f] font-mono text-xs uppercase tracking-[0.2em] text-[#17ff4d]">Loading OrbitX City…</div>}>
                  <OrbitxCityPage />
                </Suspense>
              }
            />
            <Route path="/orbitxcity" element={<Navigate to="/Orbitxcity" replace />} />

            {/* ── OrbitX OS (frontend experience shell) ── */}
            <Route
              path="/os/*"
              element={
                <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-[#05080c] font-mono text-xs uppercase tracking-[0.2em] text-[#17ff4d]">Loading OrbitX OS…</div>}>
                  <OsApp />
                </Suspense>
              }
            />

            {/* ── OrbitX Gaming Studio ── */}
            <Route
              path="/play/*"
              element={
                <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-[#06090f] font-mono text-xs uppercase tracking-[0.2em] text-[#17ff4d]">Loading Play Studio…</div>}>
                  <PlayApp />
                </Suspense>
              }
            />

            {/* ── Custom launchpad (Orbitx Launch Console) ── */}
            <Route path="/orbitxlaunch" element={<LaunchpadLayout />}>
              <Route index element={<LaunchpadHome />} />
              <Route path="create" element={<LaunchpadChoose />} />
              <Route path="create/custom" element={<LaunchpadCreate />} />
              <Route path="create/pump" element={<LaunchpadPump />} />
              <Route path="create/api" element={<LaunchpadApiLaunch />} />
              <Route path="create/curve" element={<LaunchpadCurveEvm />} />
              <Route path="curve/:token" element={<LaunchpadCurveTrade />} />
              <Route path="curves" element={<LaunchpadCurveMarkets />} />
              <Route path="token/:mint" element={<LaunchpadToken />} />
              <Route path="claim" element={<LaunchpadClaim />} />
              <Route path="rescue" element={<LaunchpadRescue />} />
              <Route path="about" element={<LaunchpadAbout />} />
              <Route path="profile" element={<LaunchpadProfile />} />
              <Route path="leaderboard" element={<LaunchpadLeaderboard />} />
              <Route path="creator/:wallet" element={<LaunchpadCreator />} />
              <Route path="portfolio" element={<LaunchpadPortfolio />} />
              <Route path="ox-desk-m4k9q" element={<AdminRoute><LaunchpadAdmin /></AdminRoute>} />
              <Route path="admin" element={<NotFound />} />
            </Route>

            {/* ── Bagwork — earn USDC for tasks ── */}
            <Route path="/bagwork" element={<BagworkLayout />}>
              <Route index element={<BagworkHome />} />
              <Route path="my" element={<BagworkMyWork />} />
              <Route path="admin" element={<AdminRoute><BagworkAdmin /></AdminRoute>} />
            </Route>

            {/* ── Terminal UI: Trading Platform Style ── */}
            {/* ── OrbitX NFT Marketplace (dedicated /nft route) ── */}
            <Route path="/nft" element={<Suspense fallback={null}><NftMarketLayout /></Suspense>}>
              <Route index element={<Suspense fallback={null}><NftMarketHome /></Suspense>} />
              <Route path="explore" element={<Suspense fallback={null}><LaunchpadNftHub /></Suspense>} />
              <Route path="drops" element={<Suspense fallback={null}><NftDrops /></Suspense>} />
              <Route path="activity" element={<Suspense fallback={null}><NftActivity /></Suspense>} />
              <Route path="notifications" element={<Suspense fallback={null}><NftNotifications /></Suspense>} />
              <Route path="create" element={<Suspense fallback={null}><LaunchpadNftCreate /></Suspense>} />
              <Route path="me" element={<Suspense fallback={null}><NftCreatorProfile /></Suspense>} />
              <Route path="profile/:wallet" element={<Suspense fallback={null}><NftCreatorProfile /></Suspense>} />
              <Route path="collection/:id" element={<Suspense fallback={null}><NftCollectionPage /></Suspense>} />
              <Route path="coin/:nftId" element={<Suspense fallback={null}><NftCoinTrade /></Suspense>} />
            </Route>

            <Route path="/terminal" element={<LaunchpadTerminal />}>
              <Route index element={<TerminalHome />} />
              <Route path="trade" element={<TerminalTrade />} />
              <Route path="portfolio" element={<TerminalPortfolio />} />
              <Route path="launch" element={<TerminalLaunch />} />
            </Route>

            {/* ── OrbitX Crypto Intelligence Command Center ── */}
            <Route path="/intel" element={<Suspense fallback={<RouteFallback label="Intel" />}><IntelLayout /></Suspense>}>
              <Route index element={<Suspense fallback={<RouteFallback label="Intel" />}><IntelHome /></Suspense>} />
              <Route path="scan" element={<Suspense fallback={<RouteFallback label="Scanner" />}><TokenScanner /></Suspense>} />
              <Route path="scan/:mint" element={<Suspense fallback={<RouteFallback label="Scanner" />}><TokenScanner /></Suspense>} />
              <Route path="trade" element={<Suspense fallback={<RouteFallback label="Trade" />}><TradeDesk /></Suspense>} />
              <Route path="portfolio" element={<Suspense fallback={<RouteFallback label="Portfolio" />}><PortfolioDesk /></Suspense>} />
              <Route path="trending" element={<Suspense fallback={<RouteFallback label="Trending" />}><TrendingIntel /></Suspense>} />
              <Route path="whales" element={<Suspense fallback={<RouteFallback label="Whales" />}><WhaleIntel /></Suspense>} />
              <Route path="sentiment" element={<Suspense fallback={<RouteFallback label="Sentiment" />}><SentimentIntel /></Suspense>} />
              <Route path="launch" element={<Suspense fallback={<RouteFallback label="Launch" />}><LaunchStudio /></Suspense>} />
              <Route path="wallet/:address" element={<Suspense fallback={<RouteFallback label="Wallet" />}><WalletTracker /></Suspense>} />
            </Route>

            {/* ── OrbitX Social HQ (Social + Growth Team) ── */}
            <Route path="/hq" element={<Suspense fallback={<RouteFallback label="Social HQ" />}><SocialLayout /></Suspense>}>
              <Route index element={<Suspense fallback={<RouteFallback label="HQ" />}><SocialHomeHq /></Suspense>} />
              <Route path="feed" element={<Suspense fallback={<RouteFallback label="Feed" />}><NetworkFeed /></Suspense>} />
              <Route path="communities" element={<Suspense fallback={<RouteFallback label="Communities" />}><CommunitiesHub /></Suspense>} />
              <Route path="trading" element={<Suspense fallback={<RouteFallback label="Trading rooms" />}><TradingCommunities /></Suspense>} />
              <Route path="voice" element={<Suspense fallback={<RouteFallback label="Voice" />}><VoiceSpaces /></Suspense>} />
              <Route path="growth" element={<Suspense fallback={<RouteFallback label="Growth" />}><GrowthCenter /></Suspense>} />
              <Route path="leaderboards" element={<Suspense fallback={<RouteFallback label="Leaderboards" />}><LeaderboardsPage /></Suspense>} />
              <Route path="creators" element={<Suspense fallback={<RouteFallback label="Creators" />}><CreatorProgram /></Suspense>} />
              <Route path="notifications" element={<Suspense fallback={<RouteFallback label="Alerts" />}><NotificationsPage /></Suspense>} />
              <Route path="messages" element={<ProtectedRoute><Suspense fallback={<RouteFallback label="Messages" />}><SocialMessagesPage /></Suspense></ProtectedRoute>} />
              <Route path="chat" element={<ProtectedRoute><Suspense fallback={<RouteFallback label="Channels" />}><SocialChatPage /></Suspense></ProtectedRoute>} />
              <Route path="rooms" element={<ProtectedRoute><Suspense fallback={<RouteFallback label="Rooms" />}><SocialRoomsPage /></Suspense></ProtectedRoute>} />
              <Route path="spaces" element={<ProtectedRoute><Suspense fallback={<RouteFallback label="Spaces" />}><SocialSpacesPage /></Suspense></ProtectedRoute>} />
              <Route path="profile" element={<Suspense fallback={<RouteFallback label="Profile" />}><ProfileView /></Suspense>} />
              <Route path="profile/:userId" element={<Suspense fallback={<RouteFallback label="Profile" />}><ProfileView /></Suspense>} />
              <Route path="ox-desk-m4k9q" element={<AdminRoute><Suspense fallback={<RouteFallback label="Moderation" />}><ModerationAdmin /></Suspense></AdminRoute>} />
              <Route path="admin" element={<NotFound />} />
              <Route path="invite" element={<Suspense fallback={<RouteFallback label="Invite" />}><InviteLanding /></Suspense>} />
            </Route>

            {/* ── Protected: App shell ── */}
            <Route path="/app" element={<ProtectedRoute><Hub /></ProtectedRoute>} />
            <Route path="/koltelebot" element={<ProtectedRoute><KOLTracker /></ProtectedRoute>} />
            <Route path="/kol-tracker" element={<ProtectedRoute><KOLTracker /></ProtectedRoute>} />
            <Route path="/app/kol-tracker" element={<ProtectedRoute><KOLTracker /></ProtectedRoute>} />
            <Route path="/app/pnl-tracker" element={<ProtectedRoute><PnlTracker /></ProtectedRoute>} />
            <Route path="/hub" element={<ProtectedRoute><Hub /></ProtectedRoute>} />
            <Route path="/command" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/home" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/our-coin" element={<OgdexRedirect to="/ORBITX_DEX" />} />
            <Route path="/roadmap" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/market-pulse" element={<OgdexRedirect to="/ORBITX_DEX/pulse" />} />
            <Route path="/market" element={<OgdexRedirect to="/ORBITX_DEX" />} />
            <Route path="/feed" element={<OgdexRedirect to="/ORBITX_DEX" />} />
            <Route path="/live-feed" element={<OgdexRedirect to="/ORBITX_DEX" />} />
            <Route path="/snipe-feed" element={<OgdexRedirect to="/ORBITX_DEX" />} />
            <Route path="/dev-wallet-radar" element={<OgdexRedirect to="/ORBITX_DEX/wallet" />} />
            <Route path="/dev-wallet" element={<OgdexRedirect to="/ORBITX_DEX/wallet" />} />
            <Route path="/scanner" element={<OgdexRedirect to="/ORBITX_DEX/scanner" />} />
            <Route path="/og-finder" element={<OgdexRedirect to="/ORBITX_DEX/scanner" />} />
            <Route path="/orbitx-scanner" element={<OgdexRedirect to="/ORBITX_DEX/scanner" />} />
            <Route path="/ogscan-scanner" element={<OgdexRedirect to="/ORBITX_DEX/scanner" />} />
            <Route path="/pairs" element={<OgdexRedirect to="/ORBITX_DEX" />} />
            <Route path="/migrations" element={<OgdexRedirect to="/ORBITX_DEX" />} />
            <Route path="/migration-tool" element={<OgdexRedirect to="/ORBITX_DEX" />} />
            <Route path="/migration-tracker" element={<OgdexRedirect to="/ORBITX_DEX" />} />
            <Route path="/trending" element={<OgdexRedirect to="/ORBITX_DEX" />} />
            <Route path="/communities" element={<Navigate to="/hq/communities" replace />} />
            <Route path="/discover" element={<OgdexRedirect to="/ORBITX_DEX" />} />
            <Route path="/whales" element={<OgdexRedirect to="/ORBITX_DEX/kol" />} />
            <Route path="/tx-feed" element={<OgdexRedirect to="/ORBITX_DEX" />} />
            <Route path="/tape" element={<OgdexRedirect to="/ORBITX_DEX" />} />
            <Route path="/transactions" element={<OgdexRedirect to="/ORBITX_DEX" />} />
            <Route path="/transaction-feed" element={<OgdexRedirect to="/ORBITX_DEX" />} />
            <Route path="/swap" element={<OgdexRedirect to="/ORBITX_DEX/tools" />} />
            <Route path="/news-signal" element={<OgdexRedirect to="/ORBITX_DEX/pulse" />} />
            <Route path="/memes" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/art-feed" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/spaces" element={<Navigate to="/hq/spaces" replace />} />
            <Route path="/social" element={<Navigate to="/hq" replace />} />
            <Route path="/orbitx-social" element={<Navigate to="/hq" replace />} />
            <Route path="/listings" element={<OgdexRedirect to="/ORBITX_DEX/store" />} />
            <Route path="/listings/:mintAddress" element={<OgdexRedirect to={(p) => `/ORBITX_DEX/token/${p.mintAddress}`} />} />
            <Route path="/token-manager" element={<OgdexRedirect to="/ORBITX_DEX/metadata" />} />
            <Route path="/social-hub" element={<Navigate to="/hq" replace />} />
            <Route path="/community" element={<Navigate to="/hq/chat" replace />} />
            <Route path="/community-classic" element={<Navigate to="/hq/chat" replace />} />
            <Route path="/community-hub" element={<Navigate to="/hq/communities" replace />} />
            <Route path="/voice-rooms" element={<Navigate to="/hq/voice" replace />} />
            <Route path="/tech" element={<OgdexRedirect to="/ORBITX_DEX" />} />
            <Route path="/page/:pageNumber" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/page-:pageNumber" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/app/:toolSlug" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/tool/:toolSlug" element={<OgdexRedirect to="/ORBITX_DEX/tools" />} />
            <Route path="/tools/:toolSlug" element={<OgdexRedirect to="/ORBITX_DEX/tools" />} />

            {/* ── Protected: User pages ── */}
            <Route path="/profile" element={<Navigate to="/hq/profile" replace />} />
            <Route path="/profile/:userId" element={<HqRedirect to={(p) => `/hq/profile/${p.userId}`} />} />
            <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
            <Route path="/reports" element={<OgdexRedirect to="/ORBITX_DEX/alerts" />} />
            <Route path="/alerts" element={<OgdexRedirect to="/ORBITX_DEX/alerts" />} />
            <Route path="/wallets" element={<OgdexRedirect to="/ORBITX_DEX/wallet" />} />
            <Route path="/games" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/notifications" element={<Navigate to="/hq/notifications" replace />} />
            {/* Credits removed */}

            {/* ── Protected: Tools & Features ── */}
            <Route path="/tokens" element={<OgdexRedirect to="/ORBITX_DEX" />} />
            <Route path="/tools" element={<OgdexRedirect to="/ORBITX_DEX/tools" />} />
            <Route path="/research" element={<OgdexRedirect to="/ORBITX_DEX/research" />} />
            {/* AdvancedTools removed */}
            <Route path="/ai-chat" element={<ProtectedRoute><AlphaChat /></ProtectedRoute>} />
            <Route path="/alpha-chat" element={<ProtectedRoute><AlphaChat /></ProtectedRoute>} />
            {/* Webhooks removed */}
            <Route path="/trading-hub" element={<OgdexRedirect to="/ORBITX_DEX" />} />
            <Route path="/callouts" element={<OgdexRedirect to="/ORBITX_DEX/callouts" />} />

            {/* ── Protected: Community ── */}
            <Route path="/coin-communities" element={<Navigate to="/hq/communities" replace />} />
            <Route path="/trading-lobbies" element={<OgdexRedirect to="/ORBITX_DEX" />} />
            <Route path="/leaderboard" element={<OgdexRedirect to="/ORBITX_DEX/leaderboard" />} />
            <Route path="/invite" element={<ProtectedRoute><Invite /></ProtectedRoute>} />
            <Route path="/messages" element={<Navigate to="/hq/messages" replace />} />
            <Route path="/rooms" element={<Navigate to="/hq/rooms" replace />} />
            <Route path="/community-rooms" element={<Navigate to="/hq/rooms" replace />} />

            {/* Premium removed */}

            {/* ── Protected: Market ── */}
            <Route path="/live-trading" element={<OgdexRedirect to="/ORBITX_DEX" />} />
            <Route path="/charts" element={<OgdexRedirect to="/ORBITX_DEX" />} />
            <Route path="/live-feed-page" element={<OgdexRedirect to="/ORBITX_DEX" />} />
            <Route path="/launchpad" element={<OgdexRedirect to="/ORBITX_DEX/launchpad" />} />
            <Route path="/pumpv5" element={<OgdexRedirect to="/ORBITX_DEX/launchpad" />} />
            <Route path="/launch" element={<OgdexRedirect to="/ORBITX_DEX/launchpad" />} />

            {/* ── Owner desk (obscure path; not linked in product chrome) ── */}
            <Route path="/ox-desk-m4k9q" element={<AdminRoute><Admin /></AdminRoute>} />
            {/* Legacy /admin must NOT redirect to the desk */}
            <Route path="/admin" element={<NotFound />} />
            <Route path="/art" element={<ProtectedRoute><Suspense fallback={null}><ArtFeedPage /></Suspense></ProtectedRoute>} />

            {/* ── Public: Project/legal ── */}
            <Route path="/official-token" element={<OgdexRedirect to="/ORBITX_DEX" />} />
            <Route path="/support" element={<ProtectedRoute><SupportPage /></ProtectedRoute>} />
            <Route path="/listen/:spaceId" element={<SpaceReplay />} />
            {/* ── Public: Live space listener (no auth required) ── */}
            <Route path="/space/:spaceId" element={<PublicSpaceListen />} />

            {/* ── Public: User profile pages + widgets (no auth) ── */}
            <Route path="/u/:username" element={<UserPublicPage />} />
            <Route path="/u/:username/widget" element={<UserPageWidget />} />

            {/* ── Public: Embeddable space player (no auth, no chrome) ── */}
            <Route path="/embed/space/:spaceId" element={<EmbedSpace />} />
            {/* ── Public: Advanced full-featured embeddable space player ── */}
            <Route path="/embed/space-player/:spaceId" element={<EmbedSpacePlayer />} />

            {/* ── Public: Embeddable profile & spaces widgets ── */}
            <Route path="/embed/profile/:username" element={<EmbedProfile />} />
            <Route path="/embed/spaces/:username" element={<EmbedSpaces />} />
            {/* ── Public: Combined embed (Spaces + Profile) ── */}
            <Route path="/embed/combined/:username" element={<EmbedCombined />} />
            <Route path="/embed/w/:username" element={<EmbedCombined />} />

            {/* ── Protected: Spaces — advanced features ── */}
            <Route path="/discovery" element={<ProtectedRoute><DiscoveryFeed /></ProtectedRoute>} />
            <Route path="/spaces-discovery" element={<ProtectedRoute><DiscoveryFeed /></ProtectedRoute>} />
            <Route path="/clips" element={<ProtectedRoute><SpaceClips /></ProtectedRoute>} />
            <Route path="/space-clips" element={<ProtectedRoute><SpaceClips /></ProtectedRoute>} />
            <Route path="/schedule" element={<ProtectedRoute><SpaceScheduler /></ProtectedRoute>} />
            <Route path="/spaces-schedule" element={<ProtectedRoute><SpaceScheduler /></ProtectedRoute>} />
            <Route path="/streams" element={<ProtectedRoute><ExternalStreams /></ProtectedRoute>} />
            <Route path="/external-streams" element={<ProtectedRoute><ExternalStreams /></ProtectedRoute>} />

            {/* ── Protected: Spaces — Phase 2: Analytics & Community ── */}
            <Route path="/host-analytics" element={<ProtectedRoute><HostAnalyticsDashboard /></ProtectedRoute>} />
            <Route path="/analytics/spaces" element={<ProtectedRoute><HostAnalyticsDashboard /></ProtectedRoute>} />
            <Route path="/rooms" element={<ProtectedRoute><CommunityRooms /></ProtectedRoute>} />
            <Route path="/community-rooms" element={<ProtectedRoute><CommunityRooms /></ProtectedRoute>} />

            {/* ── Protected: Spaces — Phase 3: Shows + Co-hosting ── */}
            <Route path="/shows" element={<ProtectedRoute><SpaceShows /></ProtectedRoute>} />
            <Route path="/space-shows" element={<ProtectedRoute><SpaceShows /></ProtectedRoute>} />
            <Route path="/spaces/:spaceId/cohosts" element={<ProtectedRoute><CoHostingManager /></ProtectedRoute>} />
            <Route path="/co-hosting/:spaceId" element={<ProtectedRoute><CoHostingManager /></ProtectedRoute>} />

            {/* ── Protected: Platform — Phase 4: White-label & API ── */}
            <Route path="/white-label" element={<AdminRoute><WhiteLabelConfig /></AdminRoute>} />
            <Route path="/brand" element={<AdminRoute><WhiteLabelConfig /></AdminRoute>} />
            <Route path="/developer" element={<ProtectedRoute><DevPortal /></ProtectedRoute>} />
            <Route path="/api-keys" element={<ProtectedRoute><DevPortal /></ProtectedRoute>} />
            <Route path="/dev-portal" element={<ProtectedRoute><DevPortal /></ProtectedRoute>} />
            <Route path="/marketplace" element={<ProtectedRoute><DevPortal /></ProtectedRoute>} />
            <Route path="/ai-assistant" element={<ProtectedRoute><AISpaceAssistant /></ProtectedRoute>} />
            <Route path="/space-assistant" element={<ProtectedRoute><AISpaceAssistant /></ProtectedRoute>} />
            <Route path="/host-copilot" element={<ProtectedRoute><AIHostCopilot /></ProtectedRoute>} />
            <Route path="/ai-copilot" element={<ProtectedRoute><AIHostCopilot /></ProtectedRoute>} />
            <Route path="/simulcast" element={<ProtectedRoute><Simulcast /></ProtectedRoute>} />
            <Route path="/multistream" element={<ProtectedRoute><Simulcast /></ProtectedRoute>} />
            <Route path="/enterprise" element={<AdminRoute><EnterpriseDashboard /></AdminRoute>} />
            <Route path="/compliance" element={<AdminRoute><EnterpriseDashboard /></AdminRoute>} />
            {/* Feature 16 — Native Mobile App */}
            <Route path="/mobile-app" element={<MobileApp />} />
            <Route path="/mobile" element={<MobileApp />} />
            <Route path="/app-download" element={<MobileApp />} />
            {/* Push/Email Reminders */}
            <Route path="/reminders" element={<ProtectedRoute><SpaceReminders /></ProtectedRoute>} />
            <Route path="/space-reminders" element={<ProtectedRoute><SpaceReminders /></ProtectedRoute>} />
            {/* Auto-Tweet */}
            <Route path="/auto-tweet" element={<ProtectedRoute><AutoTweet /></ProtectedRoute>} />
            <Route path="/tweet-settings" element={<ProtectedRoute><AutoTweet /></ProtectedRoute>} />
            {/* Podcast Publisher */}
            <Route path="/podcasts" element={<ProtectedRoute><PodcastPublisher /></ProtectedRoute>} />
            <Route path="/podcast-publisher" element={<ProtectedRoute><PodcastPublisher /></ProtectedRoute>} />
            <Route path="/rss" element={<ProtectedRoute><PodcastPublisher /></ProtectedRoute>} />
            {/* Clip → Video Export */}
            <Route path="/clip-export" element={<ProtectedRoute><ClipVideoExport /></ProtectedRoute>} />
            <Route path="/video-export" element={<ProtectedRoute><ClipVideoExport /></ProtectedRoute>} />
            <Route path="/export-clips" element={<ProtectedRoute><ClipVideoExport /></ProtectedRoute>} />

            {/* ── Catch-all slug handler (must be last) ── */}
            <Route path="/intelligence" element={<OgdexRedirect to="/ORBITX_DEX/tools" />} />
            <Route path="/intelligence/:mint" element={<OgdexRedirect to={(p) => `/ORBITX_DEX/token/${p.mint}`} />} />
            <Route path="/advanced/:mint" element={<OgdexRedirect to={(p) => `/ORBITX_DEX/token/${p.mint}`} />} />
            <Route path="/intelligence-admin" element={<NotFound />} />
            <Route path="/ox-desk-m4k9q/intel" element={<AdminRoute><IntelligenceAdmin /></AdminRoute>} />
            <Route path="/alert-settings" element={<OgdexRedirect to="/ORBITX_DEX/alerts" />} />
            <Route path="/:toolSlug" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
      </ThemeProvider>
      </EvmWalletProvider>
      </SolanaWalletProvider>
    </AuthProvider>
  </QueryClientProvider>
  </MaintenanceLock>
  </ErrorBoundary>
);

export default App;


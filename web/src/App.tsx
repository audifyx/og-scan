import { lazy, Suspense, useEffect } from "react";
import { lazyWithRetry } from "@/lib/lazyWithRetry";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useParams } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ThemeProvider } from "@/hooks/useTheme";
import { OrbitAtmosphereProvider } from "@/hooks/useOrbitAtmosphere";
import { OrbitAtmosphereLayer } from "@/components/theme/OrbitAtmosphereLayer";
import { PlatformDock } from "@/components/theme/PlatformDock";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AdminRoute } from "@/components/AdminRoute";
import { OwnerPreviewRoute } from "@/components/OwnerPreviewRoute";
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
import TradeApp from "./trade/TradeApp";
import TradeHome from "./trade/TradeHome";
import TradeDeskPage from "./trade/TradeDeskPage";
import TradeToken from "./trade/TradeToken";
import TradeLeaderboard from "./trade/TradeLeaderboard";
import TradeProfile from "./trade/TradeProfile";
import TradeWallet from "./trade/TradeWallet";
import TradeNotifications from "./trade/TradeNotifications";
import TradeMore from "./trade/TradeMore";
import TradePortfolio from "./trade/TradePortfolio";
import TradeWalletManager from "./trade/TradeWalletManager";

function TradeMintRedirect() {
  const { mint } = useParams<{ mint: string }>();
  return <Navigate to={`/trade/token/${mint || ""}`} replace />;
}

/** Keep ?code= (and hash) when normalizing /Telegram → /telegram. */
function RedirectPreserveSearch({ to }: { to: string }) {
  const location = useLocation();
  return <Navigate to={{ pathname: to, search: location.search, hash: location.hash }} replace />;
}
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
const SocialAppPage = lazyWithRetry(() => import("./pages/SocialAppPage"));
const ModerationAdmin = lazyWithRetry(() => import("./social/pages/ModerationAdmin"));
const InviteLanding = lazyWithRetry(() => import("./social/pages/InviteLanding"));
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
import OrbitXAI from "./pages/OrbitXAI";
import TelegramOrbitX from "./pages/TelegramOrbitX";
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
import VampPortal from "./pages/VampPortal";
import { SupportNotificationBanner } from "./components/SupportNotificationBanner";
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";
import PlatformWhitepaper from "./pages/platform/Whitepaper";
import PlatformRoadmap from "./pages/platform/Roadmap";
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
import McpSuperComputer from "./pages/McpSuperComputer";
import AgentDetailPage from "./pages/AgentDetail";
import McpAuthPage from "./pages/McpAuthPage";
import XMcpAuthPage from "./pages/XMcpAuthPage";
import XMcpLinkAuthPage from "./pages/XMcpLinkAuthPage";
import AgentLinkAuthPage from "./pages/AgentLinkAuthPage";
import AgentSignPage from "./pages/AgentSignPage";
import AgentCreateTokenPage from "./pages/AgentCreateTokenPage";
import AgentNftMintPage from "./pages/AgentNftMintPage";
import OnChainProofPage from "./pages/OnChainProofPage";
import OnChainWorld from "./pages/OnChainWorld";
import Education from "./pages/Education";
import { AppLayout } from "./components/layout/AppLayout";
import { NotificationListener } from "./components/notifications/NotificationListener";
import { PushNotificationPrompt } from "./components/notifications/PushNotificationPrompt";
import { PresenceHeartbeat } from "./components/PresenceHeartbeat";
import { SecurityTracker } from "./components/SecurityTracker";

const McpVoiceRoom = lazyWithRetry(() => import("./pages/McpVoiceRoom"));
const McpGroupChat = lazyWithRetry(() => import("./pages/McpGroupChat"));
const McpLifeAgents = lazyWithRetry(() => import("./pages/McpLifeAgents"));

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


const SOCIAL_FALLBACK = <RouteFallback label="Social" />;

// Redirect /predictions to the Next.js app (Vercel rewrite in prod; external URL locally).
function PredictionsRedirect() {
  useEffect(() => {
    const target = window.location.pathname + window.location.search + window.location.hash;
    const isLocal =
      window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
    if (isLocal) {
      const rest = window.location.pathname.replace(/^\/predictions\/?/, "");
      const path = rest ? `/${rest}` : "/";
      window.location.replace(`https://orbitx-prediction.fun${path}${window.location.search}${window.location.hash}`);
      return;
    }
    // Full navigation so Vercel edge rewrites proxy to the Next.js app.
    window.location.href = target;
  }, []);
  return (
    <div className="flex min-h-[40vh] items-center justify-center bg-[#05080c] font-mono text-xs uppercase tracking-[0.18em] text-white/45">
      Opening OrbitX Predictions…
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


const App = () => (
  <ErrorBoundary>
  <MaintenanceLock>
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <SolanaWalletProvider>
      <EvmWalletProvider>
      <ThemeProvider>
      <OrbitAtmosphereProvider>
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
          <OrbitAtmosphereLayer />
          <PlatformDock />
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
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/vamp" element={<OwnerPreviewRoute><VampPortal /></OwnerPreviewRoute>} />
            <Route path="/whitepaper" element={<PlatformWhitepaper />} />
            <Route path="/roadmap" element={<PlatformRoadmap />} />
            <Route path="/predictions/*" element={<PredictionsRedirect />} />
            <Route path="/r/:id" element={<ReportView />} />
            <Route path="/t/:mint" element={<OgdexRedirect to={(p) => `/ORBITX_DEX/token/${p.mint}`} />} />
            <Route path="/track-record" element={<OgdexRedirect to="/ORBITX_DEX" />} />
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

            {/* ── OrbitX AI — wallet-authenticated, token-gated super app ── */}
            <Route
              path="/ai"
              caseSensitive
              element={<OrbitXAI />}
            />
            <Route path="/AI" caseSensitive element={<Navigate to="/ai" replace />} />

            {/* ── Official Telegram bot companion ── */}
            <Route path="/telegram" element={<TelegramOrbitX />} />
            <Route path="/Telegram" element={<RedirectPreserveSearch to="/telegram" />} />

            {/* ── Public education hub (must beat /:toolSlug owner-404) ── */}
            <Route path="/education" element={<Education />} />
            <Route path="/education/*" element={<Education />} />

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

            {/* ── OrbitX Trade App (Home · Trade · Leaderboard · Profile) ── */}
            <Route path="/trade" element={<TradeApp />}>
              <Route index element={<TradeHome />} />
              <Route path="home" element={<TradeHome />} />
              <Route path="desk" element={<TradeDeskPage />} />
              <Route path="desk/:mint" element={<TradeDeskPage />} />
              <Route path="leaderboard" element={<TradeLeaderboard />} />
              <Route path="portfolio" element={<TradePortfolio />} />
              <Route path="profile" element={<TradeProfile />} />
              <Route path="wallets" element={<TradeWalletManager />} />
              <Route path="token/:mint" element={<TradeToken />} />
              <Route path="wallet/:address" element={<TradeWallet />} />
              <Route path="notifications" element={<TradeNotifications />} />
              <Route path="more" element={<TradeMore />} />
              <Route path=":mint" element={<TradeMintRedirect />} />
            </Route>

            <Route path="/terminal" element={<OwnerPreviewRoute><LaunchpadTerminal /></OwnerPreviewRoute>}>
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

            {/* ── OrbitX Social (live Supabase feed via XSocialApp) ── */}
            <Route
              path="/orbitx-social"
              element={
                <ProtectedRoute>
                  <Suspense fallback={SOCIAL_FALLBACK}>
                    <SocialAppPage />
                  </Suspense>
                </ProtectedRoute>
              }
            />
            <Route path="/social" element={<Navigate to="/orbitx-social" replace />} />
            <Route path="/social-hub" element={<Navigate to="/orbitx-social" replace />} />
            <Route path="/hq" element={<Navigate to="/orbitx-social" replace />} />
            <Route path="/hq/feed" element={<Navigate to="/orbitx-social" replace />} />
            <Route path="/hq/communities" element={<Navigate to="/orbitx-social" replace />} />
            <Route path="/hq/trading" element={<Navigate to="/orbitx-social" replace />} />
            <Route path="/hq/voice" element={<Navigate to="/orbitx-social" replace />} />
            <Route path="/hq/growth" element={<Navigate to="/orbitx-social" replace />} />
            <Route path="/hq/leaderboards" element={<Navigate to="/orbitx-social" replace />} />
            <Route path="/hq/creators" element={<Navigate to="/orbitx-social" replace />} />
            <Route path="/hq/notifications" element={<Navigate to="/orbitx-social" replace />} />
            <Route path="/hq/messages" element={<Navigate to="/orbitx-social" replace />} />
            <Route path="/hq/chat" element={<Navigate to="/orbitx-social" replace />} />
            <Route path="/hq/rooms" element={<Navigate to="/orbitx-social" replace />} />
            <Route path="/hq/spaces" element={<Navigate to="/orbitx-social" replace />} />
            <Route path="/hq/profile" element={<Navigate to="/orbitx-social" replace />} />
            <Route path="/hq/profile/:userId" element={<Navigate to="/orbitx-social" replace />} />
            <Route path="/hq/ox-desk-m4k9q" element={<AdminRoute><Suspense fallback={<RouteFallback label="Moderation" />}><ModerationAdmin /></Suspense></AdminRoute>} />
            <Route path="/hq/invite" element={<Suspense fallback={<RouteFallback label="Invite" />}><InviteLanding /></Suspense>} />
            <Route path="/hq/*" element={<Navigate to="/orbitx-social" replace />} />

            {/* ── Protected: App shell ── */}
            <Route path="/app" element={<Hub />} />
            <Route path="/koltelebot" element={<OwnerPreviewRoute><ProtectedRoute><KOLTracker /></ProtectedRoute></OwnerPreviewRoute>} />
            <Route path="/kol-tracker" element={<OwnerPreviewRoute><ProtectedRoute><KOLTracker /></ProtectedRoute></OwnerPreviewRoute>} />
            <Route path="/app/kol-tracker" element={<OwnerPreviewRoute><ProtectedRoute><KOLTracker /></ProtectedRoute></OwnerPreviewRoute>} />
            <Route path="/app/pnl-tracker" element={<OwnerPreviewRoute><ProtectedRoute><PnlTracker /></ProtectedRoute></OwnerPreviewRoute>} />
            <Route path="/hub" element={<Hub />} />
            <Route path="/command" element={<OwnerPreviewRoute><ProtectedRoute><Index /></ProtectedRoute></OwnerPreviewRoute>} />
            <Route path="/home" element={<OwnerPreviewRoute><ProtectedRoute><Index /></ProtectedRoute></OwnerPreviewRoute>} />
            <Route path="/our-coin" element={<OgdexRedirect to="/ORBITX_DEX" />} />
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
            <Route path="/communities" element={<OwnerPreviewRoute><ProtectedRoute><Index /></ProtectedRoute></OwnerPreviewRoute>} />
            <Route path="/discover" element={<OgdexRedirect to="/ORBITX_DEX" />} />
            <Route path="/whales" element={<OgdexRedirect to="/ORBITX_DEX/kol" />} />
            <Route path="/tx-feed" element={<OgdexRedirect to="/ORBITX_DEX" />} />
            <Route path="/tape" element={<OgdexRedirect to="/ORBITX_DEX" />} />
            <Route path="/transactions" element={<OgdexRedirect to="/ORBITX_DEX" />} />
            <Route path="/transaction-feed" element={<OgdexRedirect to="/ORBITX_DEX" />} />
            <Route path="/swap" element={<OgdexRedirect to="/ORBITX_DEX/tools" />} />
            <Route path="/news-signal" element={<OgdexRedirect to="/ORBITX_DEX/pulse" />} />
            <Route path="/memes" element={<OwnerPreviewRoute><ProtectedRoute><Index /></ProtectedRoute></OwnerPreviewRoute>} />
            <Route path="/art-feed" element={<OwnerPreviewRoute><ProtectedRoute><Index /></ProtectedRoute></OwnerPreviewRoute>} />
            <Route path="/spaces" element={<OwnerPreviewRoute><ProtectedRoute><Index /></ProtectedRoute></OwnerPreviewRoute>} />
            <Route path="/listings" element={<OgdexRedirect to="/ORBITX_DEX/store" />} />
            <Route path="/listings/:mintAddress" element={<OgdexRedirect to={(p) => `/ORBITX_DEX/token/${p.mintAddress}`} />} />
            <Route path="/token-manager" element={<OgdexRedirect to="/ORBITX_DEX/metadata" />} />
            <Route path="/community" element={<Navigate to="/orbitx-social" replace />} />
            <Route path="/community-classic" element={<OwnerPreviewRoute><ProtectedRoute><CommunityClassic /></ProtectedRoute></OwnerPreviewRoute>} />
            <Route path="/community-hub" element={<OwnerPreviewRoute><ProtectedRoute><CommunityClassic /></ProtectedRoute></OwnerPreviewRoute>} />
            <Route path="/voice-rooms" element={<OwnerPreviewRoute><ProtectedRoute><Index /></ProtectedRoute></OwnerPreviewRoute>} />
            <Route path="/tech" element={<OgdexRedirect to="/ORBITX_DEX" />} />
            <Route path="/page/:pageNumber" element={<OwnerPreviewRoute><ProtectedRoute><Index /></ProtectedRoute></OwnerPreviewRoute>} />
            <Route path="/page-:pageNumber" element={<OwnerPreviewRoute><ProtectedRoute><Index /></ProtectedRoute></OwnerPreviewRoute>} />
            <Route path="/app/:toolSlug" element={<OwnerPreviewRoute><ProtectedRoute><Index /></ProtectedRoute></OwnerPreviewRoute>} />
            <Route path="/tool/:toolSlug" element={<OgdexRedirect to="/ORBITX_DEX/tools" />} />
            <Route path="/tools/:toolSlug" element={<OgdexRedirect to="/ORBITX_DEX/tools" />} />

            {/* ── Protected: User pages ── */}
            <Route path="/profile" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/profile/:userId" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
            <Route path="/reports" element={<OgdexRedirect to="/ORBITX_DEX/alerts" />} />
            <Route path="/alerts" element={<OgdexRedirect to="/ORBITX_DEX/alerts" />} />
            <Route path="/wallets" element={<OgdexRedirect to="/ORBITX_DEX/wallet" />} />
            <Route path="/games" element={<OwnerPreviewRoute><ProtectedRoute><Index /></ProtectedRoute></OwnerPreviewRoute>} />
            <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
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
            <Route path="/coin-communities" element={<OwnerPreviewRoute><ProtectedRoute><Index /></ProtectedRoute></OwnerPreviewRoute>} />
            <Route path="/trading-lobbies" element={<OgdexRedirect to="/ORBITX_DEX" />} />
            <Route path="/leaderboard" element={<OgdexRedirect to="/ORBITX_DEX/leaderboard" />} />
            <Route path="/invite" element={<ProtectedRoute><Invite /></ProtectedRoute>} />
            <Route path="/messages" element={<ProtectedRoute><DirectMessagesPage /></ProtectedRoute>} />
            <Route path="/rooms" element={<OwnerPreviewRoute><ProtectedRoute><CommunityRooms /></ProtectedRoute></OwnerPreviewRoute>} />
            <Route path="/community-rooms" element={<OwnerPreviewRoute><ProtectedRoute><CommunityRooms /></ProtectedRoute></OwnerPreviewRoute>} />

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
            <Route path="/art" element={<OwnerPreviewRoute><ProtectedRoute><Suspense fallback={null}><ArtFeedPage /></Suspense></ProtectedRoute></OwnerPreviewRoute>} />

            {/* ── Public: Project/legal ── */}
            <Route path="/official-token" element={<OgdexRedirect to="/ORBITX_DEX" />} />
            <Route path="/support" element={<SupportCenter />} />
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
            <Route path="/discovery" element={<OwnerPreviewRoute><ProtectedRoute><DiscoveryFeed /></ProtectedRoute></OwnerPreviewRoute>} />
            <Route path="/spaces-discovery" element={<OwnerPreviewRoute><ProtectedRoute><DiscoveryFeed /></ProtectedRoute></OwnerPreviewRoute>} />
            <Route path="/clips" element={<OwnerPreviewRoute><ProtectedRoute><SpaceClips /></ProtectedRoute></OwnerPreviewRoute>} />
            <Route path="/space-clips" element={<OwnerPreviewRoute><ProtectedRoute><SpaceClips /></ProtectedRoute></OwnerPreviewRoute>} />
            <Route path="/schedule" element={<OwnerPreviewRoute><ProtectedRoute><SpaceScheduler /></ProtectedRoute></OwnerPreviewRoute>} />
            <Route path="/spaces-schedule" element={<OwnerPreviewRoute><ProtectedRoute><SpaceScheduler /></ProtectedRoute></OwnerPreviewRoute>} />
            <Route path="/streams" element={<OwnerPreviewRoute><ProtectedRoute><ExternalStreams /></ProtectedRoute></OwnerPreviewRoute>} />
            <Route path="/external-streams" element={<OwnerPreviewRoute><ProtectedRoute><ExternalStreams /></ProtectedRoute></OwnerPreviewRoute>} />

            {/* ── Protected: Spaces — Phase 2: Analytics & Community ── */}
            <Route path="/host-analytics" element={<OwnerPreviewRoute><ProtectedRoute><HostAnalyticsDashboard /></ProtectedRoute></OwnerPreviewRoute>} />
            <Route path="/analytics/spaces" element={<OwnerPreviewRoute><ProtectedRoute><HostAnalyticsDashboard /></ProtectedRoute></OwnerPreviewRoute>} />
            <Route path="/rooms" element={<OwnerPreviewRoute><ProtectedRoute><CommunityRooms /></ProtectedRoute></OwnerPreviewRoute>} />
            <Route path="/community-rooms" element={<OwnerPreviewRoute><ProtectedRoute><CommunityRooms /></ProtectedRoute></OwnerPreviewRoute>} />

            {/* ── Protected: Spaces — Phase 3: Shows + Co-hosting ── */}
            <Route path="/shows" element={<OwnerPreviewRoute><ProtectedRoute><SpaceShows /></ProtectedRoute></OwnerPreviewRoute>} />
            <Route path="/space-shows" element={<OwnerPreviewRoute><ProtectedRoute><SpaceShows /></ProtectedRoute></OwnerPreviewRoute>} />
            <Route path="/spaces/:spaceId/cohosts" element={<OwnerPreviewRoute><ProtectedRoute><CoHostingManager /></ProtectedRoute></OwnerPreviewRoute>} />
            <Route path="/co-hosting/:spaceId" element={<OwnerPreviewRoute><ProtectedRoute><CoHostingManager /></ProtectedRoute></OwnerPreviewRoute>} />

            {/* ── Protected: Platform — Phase 4: White-label & API ── */}
            <Route path="/white-label" element={<AdminRoute><WhiteLabelConfig /></AdminRoute>} />
            <Route path="/brand" element={<AdminRoute><WhiteLabelConfig /></AdminRoute>} />
            <Route path="/developer" element={<OwnerPreviewRoute><ProtectedRoute><DevPortal /></ProtectedRoute></OwnerPreviewRoute>} />
            <Route path="/api-keys" element={<OwnerPreviewRoute><ProtectedRoute><DevPortal /></ProtectedRoute></OwnerPreviewRoute>} />
            <Route path="/dev-portal" element={<OwnerPreviewRoute><ProtectedRoute><DevPortal /></ProtectedRoute></OwnerPreviewRoute>} />
            <Route path="/marketplace" element={<OwnerPreviewRoute><ProtectedRoute><DevPortal /></ProtectedRoute></OwnerPreviewRoute>} />
            <Route path="/ai-assistant" element={<OwnerPreviewRoute><ProtectedRoute><AISpaceAssistant /></ProtectedRoute></OwnerPreviewRoute>} />
            <Route path="/space-assistant" element={<OwnerPreviewRoute><ProtectedRoute><AISpaceAssistant /></ProtectedRoute></OwnerPreviewRoute>} />
            <Route path="/host-copilot" element={<OwnerPreviewRoute><ProtectedRoute><AIHostCopilot /></ProtectedRoute></OwnerPreviewRoute>} />
            <Route path="/ai-copilot" element={<OwnerPreviewRoute><ProtectedRoute><AIHostCopilot /></ProtectedRoute></OwnerPreviewRoute>} />
            <Route path="/simulcast" element={<OwnerPreviewRoute><ProtectedRoute><Simulcast /></ProtectedRoute></OwnerPreviewRoute>} />
            <Route path="/multistream" element={<OwnerPreviewRoute><ProtectedRoute><Simulcast /></ProtectedRoute></OwnerPreviewRoute>} />
            <Route path="/enterprise" element={<AdminRoute><EnterpriseDashboard /></AdminRoute>} />
            <Route path="/compliance" element={<AdminRoute><EnterpriseDashboard /></AdminRoute>} />
            {/* Feature 16 — Native Mobile App */}
            <Route path="/mobile-app" element={<OwnerPreviewRoute><MobileApp /></OwnerPreviewRoute>} />
            <Route path="/mobile" element={<OwnerPreviewRoute><MobileApp /></OwnerPreviewRoute>} />
            <Route path="/app-download" element={<OwnerPreviewRoute><MobileApp /></OwnerPreviewRoute>} />
            {/* Push/Email Reminders */}
            <Route path="/reminders" element={<OwnerPreviewRoute><ProtectedRoute><SpaceReminders /></ProtectedRoute></OwnerPreviewRoute>} />
            <Route path="/space-reminders" element={<OwnerPreviewRoute><ProtectedRoute><SpaceReminders /></ProtectedRoute></OwnerPreviewRoute>} />
            {/* Auto-Tweet */}
            <Route path="/auto-tweet" element={<OwnerPreviewRoute><ProtectedRoute><AutoTweet /></ProtectedRoute></OwnerPreviewRoute>} />
            <Route path="/tweet-settings" element={<OwnerPreviewRoute><ProtectedRoute><AutoTweet /></ProtectedRoute></OwnerPreviewRoute>} />
            {/* Podcast Publisher */}
            <Route path="/podcasts" element={<OwnerPreviewRoute><ProtectedRoute><PodcastPublisher /></ProtectedRoute></OwnerPreviewRoute>} />
            <Route path="/podcast-publisher" element={<OwnerPreviewRoute><ProtectedRoute><PodcastPublisher /></ProtectedRoute></OwnerPreviewRoute>} />
            <Route path="/rss" element={<OwnerPreviewRoute><ProtectedRoute><PodcastPublisher /></ProtectedRoute></OwnerPreviewRoute>} />
            {/* Clip → Video Export */}
            <Route path="/clip-export" element={<OwnerPreviewRoute><ProtectedRoute><ClipVideoExport /></ProtectedRoute></OwnerPreviewRoute>} />
            <Route path="/video-export" element={<OwnerPreviewRoute><ProtectedRoute><ClipVideoExport /></ProtectedRoute></OwnerPreviewRoute>} />
            <Route path="/export-clips" element={<OwnerPreviewRoute><ProtectedRoute><ClipVideoExport /></ProtectedRoute></OwnerPreviewRoute>} />

            {/* ── Catch-all slug handler (must be last) ── */}
            <Route path="/intelligence" element={<OgdexRedirect to="/ORBITX_DEX/tools" />} />
            <Route path="/intelligence/:mint" element={<OgdexRedirect to={(p) => `/ORBITX_DEX/token/${p.mint}`} />} />
            <Route path="/advanced/:mint" element={<OgdexRedirect to={(p) => `/ORBITX_DEX/token/${p.mint}`} />} />
            <Route path="/intelligence-admin" element={<NotFound />} />
            <Route path="/ox-desk-m4k9q/intel" element={<AdminRoute><IntelligenceAdmin /></AdminRoute>} />
            <Route path="/alert-settings" element={<OgdexRedirect to="/ORBITX_DEX/alerts" />} />
            {/* Public shell — page handles wallet sign-in (avoids mobile auth spinner traps) */}
            <Route path="/supercomputer" element={<McpSuperComputer />} />
            <Route path="/mcp" element={<RedirectPreserveSearch to="/supercomputer" />} />
            <Route path="/vc" element={<Suspense fallback={<RouteFallback label="Voice" />}><McpVoiceRoom /></Suspense>} />
            <Route path="/vc/:slug" element={<Suspense fallback={<RouteFallback label="Voice" />}><McpVoiceRoom /></Suspense>} />
            <Route path="/gc" element={<Suspense fallback={<RouteFallback label="Group chat" />}><McpGroupChat /></Suspense>} />
            <Route path="/gc/:slug" element={<Suspense fallback={<RouteFallback label="Group chat" />}><McpGroupChat /></Suspense>} />
            <Route path="/life" element={<Suspense fallback={<RouteFallback label="Life Agents" />}><McpLifeAgents /></Suspense>} />
            <Route path="/life/:slug" element={<Suspense fallback={<RouteFallback label="Life Agents" />}><McpLifeAgents /></Suspense>} />
            <Route path="/shop" element={<Navigate to="/supercomputer?tab=shop" replace />} />
            <Route path="/onchain" element={<OwnerPreviewRoute><OnChainProofPage /></OwnerPreviewRoute>} />
            <Route path="/world" element={<Navigate to="/on-chain" replace />} />
            <Route path="/on-chain" element={<OnChainWorld />} />
            <Route path="/on-chain/wallet/:address" element={<OnChainWorld />} />
            <Route path="/on-chain/token/:address" element={<OnChainWorld />} />
            <Route path="/on-chain/tx/:signature" element={<OnChainWorld />} />
            <Route path="/on-chain/block/:slot" element={<OnChainWorld />} />
            <Route path="/supercomputer/mcp-auth" element={<McpAuthPage />} />
            <Route path="/supercomputer/x-mcp-auth" element={<XMcpAuthPage />} />
            <Route path="/supercomputer/link-auth" element={<AgentLinkAuthPage />} />
            <Route path="/supercomputer/x-link-auth" element={<XMcpLinkAuthPage />} />
            <Route path="/supercomputer/sign" element={<AgentSignPage />} />
            <Route path="/supercomputer/create-token" element={<AgentCreateTokenPage />} />
            <Route path="/supercomputer/nft-mint" element={<AgentNftMintPage />} />
            <Route path="/supercomputer/agent/:id" element={<ProtectedRoute><AgentDetailPage /></ProtectedRoute>} />
            <Route path="/:toolSlug" element={<OwnerPreviewRoute><ProtectedRoute><Index /></ProtectedRoute></OwnerPreviewRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
      </OrbitAtmosphereProvider>
      </ThemeProvider>
      </EvmWalletProvider>
      </SolanaWalletProvider>
    </AuthProvider>
  </QueryClientProvider>
  </MaintenanceLock>
  </ErrorBoundary>
);

export default App;


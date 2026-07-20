import { lazy, Suspense, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useParams } from "react-router-dom";
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
import LaunchpadPump from "./pages/orbitx/LaunchpadPump";
import LaunchpadToken from "./pages/orbitx/LaunchpadToken";
import LaunchpadAbout from "./pages/orbitx/LaunchpadAbout";
import LaunchpadProfile from "./pages/orbitx/LaunchpadProfile";
import LaunchpadClaim from "./pages/orbitx/LaunchpadClaim";
import LaunchpadRescue from "./pages/orbitx/LaunchpadRescue";
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
import { WalletProvider } from "./lib/orbitx/wallet-context";
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
const ArtFeedPage = lazy(() => import("./pages/ArtFeed"));

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
          <Routes>
            {/* ── Public routes (no auth required) ── */}
            <Route path="/" element={<Splash />} />
            <Route path="/beta" element={<BetaHome />} />
            <Route path="/splash" element={<Splash />} />
            <Route path="/waitlist" element={<OgdexRedirect to="/auth?mode=signup" />} />
            <Route path="/auth" element={<Auth />} />
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

            {/* ── Custom launchpad (Orbitx Launch Console) ── */}
            <Route path="/orbitxlaunch" element={<WalletProvider><LaunchpadLayout /></WalletProvider>}>
              <Route index element={<LaunchpadHome />} />
              <Route path="create" element={<LaunchpadChoose />} />
              <Route path="create/custom" element={<LaunchpadCreate />} />
              <Route path="create/pump" element={<LaunchpadPump />} />
              <Route path="token/:mint" element={<LaunchpadToken />} />
              <Route path="claim" element={<LaunchpadClaim />} />
              <Route path="rescue" element={<LaunchpadRescue />} />
              <Route path="about" element={<LaunchpadAbout />} />
              <Route path="profile" element={<LaunchpadProfile />} />
            </Route>

            {/* ── Terminal UI: Trading Platform Style ── */}
            <Route path="/terminal" element={<LaunchpadTerminal />}>
              <Route index element={<TerminalHome />} />
              <Route path="trade" element={<TerminalTrade />} />
              <Route path="portfolio" element={<TerminalPortfolio />} />
              <Route path="launch" element={<TerminalLaunch />} />
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
            <Route path="/communities" element={<ProtectedRoute><Index /></ProtectedRoute>} />
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
            <Route path="/spaces" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/social" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/orbitx-social" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/listings" element={<OgdexRedirect to="/ORBITX_DEX/store" />} />
            <Route path="/listings/:mintAddress" element={<OgdexRedirect to={(p) => `/ORBITX_DEX/token/${p.mintAddress}`} />} />
            <Route path="/token-manager" element={<OgdexRedirect to="/ORBITX_DEX/metadata" />} />
            <Route path="/social-hub" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/community-classic" element={<ProtectedRoute><CommunityClassic /></ProtectedRoute>} />
            <Route path="/community-hub" element={<ProtectedRoute><CommunityClassic /></ProtectedRoute>} />
            <Route path="/voice-rooms" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/tech" element={<OgdexRedirect to="/ORBITX_DEX" />} />
            <Route path="/page/:pageNumber" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/page-:pageNumber" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/app/:toolSlug" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/tool/:toolSlug" element={<OgdexRedirect to="/ORBITX_DEX/tools" />} />
            <Route path="/tools/:toolSlug" element={<OgdexRedirect to="/ORBITX_DEX/tools" />} />

            {/* ── Protected: User pages ── */}
            <Route path="/profile" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/profile/:userId" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
            <Route path="/reports" element={<OgdexRedirect to="/ORBITX_DEX/alerts" />} />
            <Route path="/alerts" element={<OgdexRedirect to="/ORBITX_DEX/alerts" />} />
            <Route path="/wallets" element={<OgdexRedirect to="/ORBITX_DEX/wallet" />} />
            <Route path="/games" element={<ProtectedRoute><Index /></ProtectedRoute>} />
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
            <Route path="/coin-communities" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/trading-lobbies" element={<OgdexRedirect to="/ORBITX_DEX" />} />
            <Route path="/leaderboard" element={<OgdexRedirect to="/ORBITX_DEX/leaderboard" />} />
            <Route path="/invite" element={<ProtectedRoute><Invite /></ProtectedRoute>} />
            <Route path="/messages" element={<ProtectedRoute><DirectMessagesPage /></ProtectedRoute>} />

            {/* Premium removed */}

            {/* ── Protected: Market ── */}
            <Route path="/live-trading" element={<OgdexRedirect to="/ORBITX_DEX" />} />
            <Route path="/charts" element={<OgdexRedirect to="/ORBITX_DEX" />} />
            <Route path="/live-feed-page" element={<OgdexRedirect to="/ORBITX_DEX" />} />
            <Route path="/launchpad" element={<OgdexRedirect to="/ORBITX_DEX/launchpad" />} />
            <Route path="/pumpv5" element={<OgdexRedirect to="/ORBITX_DEX/launchpad" />} />
            <Route path="/launch" element={<OgdexRedirect to="/ORBITX_DEX/launchpad" />} />

            {/* ── Protected: Admin ── */}
            <Route path="/admin" element={<OgdexRedirect to="/ORBITX_DEX/admin" />} />
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
            <Route path="/intelligence-admin" element={<AdminRoute><IntelligenceAdmin /></AdminRoute>} />
            <Route path="/alert-settings" element={<OgdexRedirect to="/ORBITX_DEX/alerts" />} />
            <Route path="/:toolSlug" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
      </ThemeProvider>
      </SolanaWalletProvider>
    </AuthProvider>
  </QueryClientProvider>
  </MaintenanceLock>
  </ErrorBoundary>
);

export default App;


import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ThemeProvider } from "@/hooks/useTheme";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { MaintenanceLock } from "@/components/MaintenanceLock";
import { IntercomSync } from "@/components/IntercomSync";
import { FinLauncher } from "@/components/FinLauncher";
import BetaHome from "./pages/BetaHome";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Auth from "./pages/Auth";
import Setup from "./pages/Setup";
import Profile from "./pages/Profile";
import Settings from "./pages/Settings";
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
// Premium removed
import OfficialToken from "./pages/OfficialToken";
import PumpV5 from "./pages/PumpV5";
import Launch from "./pages/Launch";
import Callouts from "./pages/Callouts";
import Charts from "./pages/Charts";
import LiveFeed from "./pages/LiveFeed";
import SupportCenter from "./pages/SupportCenter";
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";
import { CCCallbackPage } from "./pages/CCCallbackPage";
import { SolanaWalletProvider } from "./contexts/SolanaWalletProvider";
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

const queryClient = new QueryClient();
const ArtFeedPage = lazy(() => import("./pages/ArtFeed"));

const App = () => (
  <MaintenanceLock>
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <SolanaWalletProvider>
      <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <NotificationListener />
        <PushNotificationPrompt />
        <PresenceHeartbeat />
        <SecurityTracker />
        <IntercomSync />
        <FinLauncher />
        <BrowserRouter>
          <Routes>
            {/* ── Public routes (no auth required) ── */}
            <Route path="/" element={<BetaHome />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/setup" element={<Setup />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/cc-callback" element={<CCCallbackPage />} />
            <Route path="/x-callback" element={<XCallbackPage />} />

            {/* ── Public: App install page ── */}
            <Route path="/install" element={<InstallApp />} />

            {/* ── Protected: App shell ── */}
            <Route path="/app" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/command" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/home" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/our-coin" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/roadmap" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/market-pulse" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/market" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/feed" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/live-feed" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/snipe-feed" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/dev-wallet-radar" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/dev-wallet" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/scanner" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/og-finder" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/og-scanner" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/ogscan-scanner" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/pairs" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/migrations" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/migration-tool" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/migration-tracker" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/trending" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/communities" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/discover" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/whales" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/tx-feed" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/tape" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/transactions" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/transaction-feed" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/swap" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/news-signal" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/memes" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/art-feed" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/spaces" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/social" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/listings" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/listings/:mintAddress" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/token-manager" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/social-hub" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/voice-rooms" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/tech" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/page/:pageNumber" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/page-:pageNumber" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/app/:toolSlug" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/tool/:toolSlug" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/tools/:toolSlug" element={<ProtectedRoute><Index /></ProtectedRoute>} />

            {/* ── Protected: User pages ── */}
            <Route path="/profile" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/profile/:userId" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
            <Route path="/wallets" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
            {/* Credits removed */}

            {/* ── Protected: Tools & Features ── */}
            <Route path="/tokens" element={<ProtectedRoute><Tokens /></ProtectedRoute>} />
            <Route path="/tools" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            {/* AdvancedTools removed */}
            <Route path="/ai-chat" element={<ProtectedRoute><AlphaChat /></ProtectedRoute>} />
            <Route path="/alpha-chat" element={<ProtectedRoute><AlphaChat /></ProtectedRoute>} />
            {/* Webhooks removed */}
            <Route path="/trading-hub" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/callouts" element={<ProtectedRoute><Callouts /></ProtectedRoute>} />

            {/* ── Protected: Community ── */}
            <Route path="/coin-communities" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/trading-lobbies" element={<ProtectedRoute><TradingLobbies /></ProtectedRoute>} />
            <Route path="/leaderboard" element={<ProtectedRoute><Leaderboard /></ProtectedRoute>} />
            <Route path="/invite" element={<ProtectedRoute><Invite /></ProtectedRoute>} />
            <Route path="/messages" element={<ProtectedRoute><DirectMessagesPage /></ProtectedRoute>} />

            {/* Premium removed */}

            {/* ── Protected: Market ── */}
            <Route path="/live-trading" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/charts" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/live-feed-page" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/pumpv5" element={<ProtectedRoute><PumpV5 /></ProtectedRoute>} />
            <Route path="/launch" element={<ProtectedRoute><Launch /></ProtectedRoute>} />

            {/* ── Protected: Admin ── */}
            <Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
            <Route path="/art" element={<ProtectedRoute><Suspense fallback={null}><ArtFeedPage /></Suspense></ProtectedRoute>} />

            {/* ── Public: Project/legal ── */}
            <Route path="/official-token" element={<OfficialToken />} />
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
            <Route path="/white-label" element={<ProtectedRoute><WhiteLabelConfig /></ProtectedRoute>} />
            <Route path="/brand" element={<ProtectedRoute><WhiteLabelConfig /></ProtectedRoute>} />
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
            <Route path="/enterprise" element={<ProtectedRoute><EnterpriseDashboard /></ProtectedRoute>} />
            <Route path="/compliance" element={<ProtectedRoute><EnterpriseDashboard /></ProtectedRoute>} />
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
);

export default App;


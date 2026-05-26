import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ThemeProvider } from "@/hooks/useTheme";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { MaintenanceLock } from "@/components/MaintenanceLock";
import BetaHome from "./pages/BetaHome";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Auth from "./pages/Auth";
import Setup from "./pages/Setup";
import Profile from "./pages/Profile";
import Settings from "./pages/Settings";
import Wallets from "./pages/Wallets";
import Tokens from "./pages/Tokens";
import Tools from "./pages/Tools";
// AdvancedTools removed
import AlphaChat from "./pages/AlphaChat";
// Credits page removed
// Webhooks removed
import TradingLobbies from "./pages/TradingLobbies";
import Leaderboard from "./pages/Leaderboard";
import DirectMessages from "./pages/DirectMessages";
import Notifications from "./pages/Notifications";
// Premium removed
import OfficialToken from "./pages/OfficialToken";
import PumpV5 from "./pages/PumpV5";
import Callouts from "./pages/Callouts";
import Charts from "./pages/Charts";
import LiveFeed from "./pages/LiveFeed";
import LiveTrading from "./pages/LiveTrading";
import SupportCenter from "./pages/SupportCenter";
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";
import Admin from "./pages/Admin";
import ArtFeed from "./pages/ArtFeed";
import SpaceReplay from "./pages/SpaceReplay";
import PublicSpaceListen from "./pages/PublicSpaceListen";
import UserPublicPage from "./pages/UserPublicPage";
import UserPageWidget from "./pages/UserPageWidget";
import EmbedSpace from "./pages/EmbedSpace";
import { AppLayout } from "./components/layout/AppLayout";
import { NotificationListener } from "./components/notifications/NotificationListener";
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

const App = () => (
  <MaintenanceLock>
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <NotificationListener />
        <PresenceHeartbeat />
        <SecurityTracker />
        <BrowserRouter>
          <Routes>
            {/* ── Public routes (no auth required) ── */}
            <Route path="/" element={<BetaHome />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/setup" element={<Setup />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/privacy" element={<Privacy />} />

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
            <Route path="/wallets" element={<ProtectedRoute><Wallets /></ProtectedRoute>} />
            <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
            {/* Credits removed */}

            {/* ── Protected: Tools & Features ── */}
            <Route path="/tokens" element={<ProtectedRoute><Tokens /></ProtectedRoute>} />
            <Route path="/tools" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            {/* AdvancedTools removed */}
            <Route path="/ai-chat" element={<ProtectedRoute><AlphaChat /></ProtectedRoute>} />
            <Route path="/alpha-chat" element={<ProtectedRoute><AlphaChat /></ProtectedRoute>} />
            {/* Webhooks removed */}
            <Route path="/callouts" element={<ProtectedRoute><Callouts /></ProtectedRoute>} />

            {/* ── Protected: Community ── */}
            <Route path="/trading-lobbies" element={<ProtectedRoute><TradingLobbies /></ProtectedRoute>} />
            <Route path="/leaderboard" element={<ProtectedRoute><Leaderboard /></ProtectedRoute>} />
            <Route path="/messages" element={<ProtectedRoute><DirectMessagesPage /></ProtectedRoute>} />

            {/* Premium removed */}

            {/* ── Protected: Market ── */}
            <Route path="/live-trading" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/charts" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/live-feed-page" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/pumpv5" element={<ProtectedRoute><PumpV5 /></ProtectedRoute>} />

            {/* ── Protected: Admin ── */}
            <Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
            <Route path="/art" element={<ProtectedRoute><ArtFeed /></ProtectedRoute>} />

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

            {/* ── Catch-all slug handler (must be last) ── */}
            <Route path="/:toolSlug" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
      </ThemeProvider>
    </AuthProvider>
  </QueryClientProvider>
  </MaintenanceLock>
);

export default App;

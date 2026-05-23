import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import BetaHome from "./pages/BetaHome";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Auth from "./pages/Auth";
import Setup from "./pages/Setup";
import Profile from "./pages/Profile";
import Settings from "./pages/Settings";
import Wallets from "./pages/Wallets";
import AdvancedTools from "./pages/AdvancedTools";
import AlphaChat from "./pages/AlphaChat";
import Credits from "./pages/Credits";
import Webhooks from "./pages/Webhooks";
import Communities from "./pages/Communities";
import TradingLobbies from "./pages/TradingLobbies";
import Leaderboard from "./pages/Leaderboard";
import Notifications from "./pages/Notifications";
import Premium from "./pages/Premium";
import OfficialToken from "./pages/OfficialToken";
import PumpV5 from "./pages/PumpV5";
import Callouts from "./pages/Callouts";
import Charts from "./pages/Charts";
import Discover from "./pages/Discover";
import LiveFeed from "./pages/LiveFeed";
import LiveTrading from "./pages/LiveTrading";
import SupportCenter from "./pages/SupportCenter";
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";
import Admin from "./pages/Admin";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Home & App */}
            <Route path="/" element={<BetaHome />} />
            <Route path="/app" element={<Index />} />
            <Route path="/command" element={<Index />} />
            <Route path="/home" element={<Index />} />
            <Route path="/our-coin" element={<Index />} />
            <Route path="/roadmap" element={<Index />} />
            <Route path="/market-pulse" element={<Index />} />
            <Route path="/market" element={<Index />} />
            <Route path="/feed" element={<Index />} />
            <Route path="/live-feed" element={<Index />} />
            <Route path="/snipe-feed" element={<Index />} />
            <Route path="/dev-wallet-radar" element={<Index />} />
            <Route path="/dev-wallet" element={<Index />} />
            <Route path="/scanner" element={<Index />} />
            <Route path="/og-finder" element={<Index />} />
            <Route path="/og-scanner" element={<Index />} />
            <Route path="/ogscan-scanner" element={<Index />} />
            <Route path="/pairs" element={<Index />} />
            <Route path="/migrations" element={<Index />} />
            <Route path="/migration-tool" element={<Index />} />
            <Route path="/migration-tracker" element={<Index />} />
            <Route path="/trending" element={<Index />} />
            <Route path="/whales" element={<Index />} />
            <Route path="/tx-feed" element={<Index />} />
            <Route path="/tape" element={<Index />} />
            <Route path="/transactions" element={<Index />} />
            <Route path="/transaction-feed" element={<Index />} />
            <Route path="/swap" element={<Index />} />
            <Route path="/tech" element={<Index />} />
            <Route path="/page/:pageNumber" element={<Index />} />
            <Route path="/page-:pageNumber" element={<Index />} />
            <Route path="/app/:toolSlug" element={<Index />} />
            <Route path="/tool/:toolSlug" element={<Index />} />
            <Route path="/tools/:toolSlug" element={<Index />} />

            {/* Auth */}
            <Route path="/auth" element={<Auth />} />
            <Route path="/setup" element={<Setup />} />

            {/* User pages */}
            <Route path="/profile" element={<Profile />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/wallets" element={<Wallets />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/credits" element={<Credits />} />

            {/* Tools & Features */}
            <Route path="/advanced-tools" element={<AdvancedTools />} />
            <Route path="/ai-chat" element={<AlphaChat />} />
            <Route path="/alpha-chat" element={<AlphaChat />} />
            <Route path="/webhooks" element={<Webhooks />} />
            <Route path="/callouts" element={<Callouts />} />

            {/* Community */}
            <Route path="/communities" element={<Communities />} />
            <Route path="/trading-lobbies" element={<TradingLobbies />} />
            <Route path="/leaderboard" element={<Leaderboard />} />
            <Route path="/discover" element={<Discover />} />

            {/* Premium */}
            <Route path="/premium" element={<Premium />} />

            {/* Market */}
            <Route path="/live-trading" element={<LiveTrading />} />
            <Route path="/charts" element={<Charts />} />
            <Route path="/live-feed-page" element={<LiveFeed />} />
            <Route path="/pumpv5" element={<PumpV5 />} />

            {/* Project */}
            <Route path="/official-token" element={<OfficialToken />} />
            <Route path="/support" element={<SupportCenter />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/admin" element={<Admin />} />

            {/* Catch-all slug handler (must be last) */}
            <Route path="/:toolSlug" element={<Index />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;

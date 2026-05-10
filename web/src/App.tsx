import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import BetaHome from "./pages/BetaHome";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<BetaHome />} />
          <Route path="/app" element={<Index />} />
          <Route path="/command" element={<Index />} />
          <Route path="/home" element={<Index />} />
          <Route path="/our-coin" element={<Index />} />
          <Route path="/roadmap" element={<Index />} />
          <Route path="/market-pulse" element={<Index />} />
          <Route path="/market" element={<Index />} />
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
          <Route path="/:toolSlug" element={<Index />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

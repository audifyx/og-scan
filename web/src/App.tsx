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
          <Route path="/home" element={<BetaHome />} />
          <Route path="/app" element={<Index />} />
          <Route path="/app/:toolSlug" element={<Index />} />
          <Route path="/page/:pageNumber" element={<Index />} />
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

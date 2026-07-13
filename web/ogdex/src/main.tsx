import React, { Suspense, lazy } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import "./index.css";
import Layout from "./components/Layout";
import { WalletProvider } from "./lib/wallet";
import Screener from "./pages/Screener";
import Tools from "./pages/Tools";
import OgScanner from "./pages/OgScanner";

// Heavy / less-frequent routes are code-split so the Discovery page loads fast.
const Pulse = lazy(() => import("./pages/Pulse"));
const Metadata = lazy(() => import("./pages/Metadata"));
const ApiDocs = lazy(() => import("./pages/ApiDocs"));
const Alerts = lazy(() => import("./pages/Alerts"));
const Callouts = lazy(() => import("./pages/Callouts"));
const TokenDetail = lazy(() => import("./pages/TokenDetail"));
const Submit = lazy(() => import("./pages/Submit"));
const Store = lazy(() => import("./pages/Store"));
const Boost = lazy(() => import("./pages/Boost"));
const Wallet = lazy(() => import("./pages/Wallet"));
const WalletIndex = lazy(() => import("./pages/WalletIndex"));
const KolScanner = lazy(() => import("./pages/KolScanner"));
const KolProfile = lazy(() => import("./pages/KolProfile"));
const Admin = lazy(() => import("./pages/Admin"));
const Launchpad = lazy(() => import("./pages/Launchpad"));
const Robinhood = lazy(() => import("./pages/Robinhood"));
const NewlyListed = lazy(() => import("./pages/NewlyListed"));
const Terms = lazy(() => import("./pages/Terms"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Whitepaper = lazy(() => import("./pages/Whitepaper"));
const Roadmap = lazy(() => import("./pages/Roadmap"));
const Leaderboard = lazy(() => import("./pages/Leaderboard"));
// Phase 2+
const Status = lazy(() => import("./pages/Status"));
// Phase 3: Copy tracking
const CopyTracking = lazy(() => import("./pages/CopyTracking"));
// Phase 4: Community KOL lists, Embed/widget page
const CommunityKols = lazy(() => import("./pages/CommunityKols"));
const Embed = lazy(() => import("./pages/Embed"));
const More = lazy(() => import("./pages/More"));

function PageFallback() {
  return <div className="grid place-items-center py-24 text-muted"><Loader2 className="w-5 h-5 animate-spin" /></div>;
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
      <WalletProvider>
        <BrowserRouter basename="/ORBITX_DEX">
          <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Screener />} />
          <Route path="tools" element={<Tools />} />
          <Route path="scanner" element={<OgScanner />} />
          <Route path="pulse" element={<Suspense fallback={<PageFallback />}><Pulse /></Suspense>} />
          <Route path="research" element={<Suspense fallback={<PageFallback />}><Pulse /></Suspense>} />
          <Route path="token/:mint" element={<Suspense fallback={<PageFallback />}><TokenDetail /></Suspense>} />
          <Route path="store" element={<Suspense fallback={<PageFallback />}><Store /></Suspense>} />
          <Route path="metadata" element={<Suspense fallback={<PageFallback />}><Metadata /></Suspense>} />
          <Route path="api" element={<Suspense fallback={<PageFallback />}><ApiDocs /></Suspense>} />
          <Route path="alerts" element={<Suspense fallback={<PageFallback />}><Alerts /></Suspense>} />
          <Route path="callouts" element={<Suspense fallback={<PageFallback />}><Callouts /></Suspense>} />
          <Route path="submit" element={<Suspense fallback={<PageFallback />}><Submit /></Suspense>} />
          <Route path="boost" element={<Suspense fallback={<PageFallback />}><Boost /></Suspense>} />
          <Route path="launchpad" element={<Suspense fallback={<PageFallback />}><Launchpad /></Suspense>} />
          <Route path="robinhood" element={<Suspense fallback={<PageFallback />}><Robinhood /></Suspense>} />
          {/* Launcher moved into the Launchpad — keep /launch as a redirect. */}
          <Route path="launch" element={<Navigate to="/launchpad" replace />} />
          <Route path="new" element={<Suspense fallback={<PageFallback />}><NewlyListed /></Suspense>} />
          <Route path="wallet" element={<Suspense fallback={<PageFallback />}><WalletIndex /></Suspense>} />
          <Route path="wallet/:address" element={<Suspense fallback={<PageFallback />}><Wallet /></Suspense>} />
          <Route path="kol" element={<Suspense fallback={<PageFallback />}><KolScanner /></Suspense>} />
          <Route path="kol/:address" element={<Suspense fallback={<PageFallback />}><KolProfile /></Suspense>} />
          <Route path="thispageisfordev" element={<Suspense fallback={<PageFallback />}><Admin /></Suspense>} />
          <Route path="admin" element={<Suspense fallback={<PageFallback />}><Admin /></Suspense>} />
          <Route path="terms" element={<Suspense fallback={<PageFallback />}><Terms /></Suspense>} />
          <Route path="privacy" element={<Suspense fallback={<PageFallback />}><Privacy /></Suspense>} />
          <Route path="whitepaper" element={<Suspense fallback={<PageFallback />}><Whitepaper /></Suspense>} />
          <Route path="roadmap" element={<Suspense fallback={<PageFallback />}><Roadmap /></Suspense>} />
          <Route path="leaderboard" element={<Suspense fallback={<PageFallback />}><Leaderboard /></Suspense>} />
          {/* Phase 2: Status page */}
          <Route path="status" element={<Suspense fallback={<PageFallback />}><Status /></Suspense>} />
          {/* Phase 3: Copy tracking */}
          <Route path="copy-trade" element={<Suspense fallback={<PageFallback />}><CopyTracking /></Suspense>} />
          {/* Phase 4: Community KOL lists + embed/widget */}
          <Route path="kol/community" element={<Suspense fallback={<PageFallback />}><CommunityKols /></Suspense>} />
          <Route path="embed" element={<Suspense fallback={<PageFallback />}><Embed /></Suspense>} />
          <Route path="more" element={<Suspense fallback={<PageFallback />}><More /></Suspense>} />
        </Route>
      </Routes>
    </BrowserRouter>
      </WalletProvider>
  </React.StrictMode>
);

// Register the ORBITX_DEX PWA service worker (scope /ORBITX_DEX/). Kept separate from the
// OrbitX root service worker, which intentionally bypasses /ORBITX_DEX.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/ORBITX_DEX/sw.js", { scope: "/ORBITX_DEX/" }).catch(() => {});
  });
}

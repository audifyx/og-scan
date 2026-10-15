import React, { Suspense, lazy, useEffect, Component, type ReactNode } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Loader2, AlertTriangle, RefreshCw } from "lucide-react";
import "./index.css";
import Layout from "./components/Layout";
import { WalletProvider } from "./lib/wallet";
import Screener from "./pages/Screener";
import Tools from "./pages/Tools";
import OgScanner from "./pages/OgScanner";

/** Catches render crashes so a bad deploy/data can never leave a black page. */
class BootBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error) { console.error("[ogdex boot]", error); }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div style={{ minHeight: "100dvh", display: "grid", placeItems: "center", background: "#060609", color: "#fff", padding: 24, textAlign: "center" }}>
        <div>
          <AlertTriangle style={{ width: 40, height: 40, color: "#f0c75e", margin: "0 auto 16px" }} />
          <h1 style={{ fontSize: 20, fontWeight: 800, margin: "0 0 8px" }}>Terminal failed to load</h1>
          <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 14, margin: "0 0 20px", maxWidth: 320 }}>
            {String(this.state.error?.message || "Unexpected error").slice(0, 160)}
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#3b82f6", color: "#fff", border: "none", borderRadius: 12, padding: "12px 24px", fontWeight: 800, fontSize: 15, cursor: "pointer" }}
          >
            <RefreshCw style={{ width: 16, height: 16 }} /> Reload terminal
          </button>
        </div>
      </div>
    );
  }
}

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
const RobinhoodScanner = lazy(() => import("./pages/RobinhoodScanner"));
const Robinhood = lazy(() => import("./pages/Robinhood"));
const Leaderboard = lazy(() => import("./pages/Leaderboard"));
// Phase 2+
const Status = lazy(() => import("./pages/Status"));
// Phase 3: Copy tracking
const CopyTracking = lazy(() => import("./pages/CopyTracking"));
// Phase 4: Community KOL lists, Embed/widget page
const CommunityKols = lazy(() => import("./pages/CommunityKols"));
const Embed = lazy(() => import("./pages/Embed"));
const More = lazy(() => import("./pages/More"));
const OwnerDeskGate = lazy(() => import("./components/OwnerDeskGate"));

function PageFallback() {
  return <div className="grid place-items-center py-24 text-muted"><Loader2 className="w-5 h-5 animate-spin" /></div>;
}

/** Unified platform docs live at ogscan.fun root — not under /ORBITX_DEX. */
function PlatformDocRedirect({ path }: { path: string }) {
  useEffect(() => { window.location.replace(path); }, [path]);
  return <PageFallback />;
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BootBoundary>
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
          <Route path="robinhood/scanner" element={<Suspense fallback={<PageFallback />}><RobinhoodScanner /></Suspense>} />
          {/* Launcher → Tools create; new → real launchpad */}
          <Route path="launch" element={<Navigate to="/tools?tab=create" replace />} />
          <Route path="new" element={<Navigate to="/launchpad" replace />} />
          <Route path="wallet" element={<Suspense fallback={<PageFallback />}><WalletIndex /></Suspense>} />
          <Route path="wallet/:address" element={<Suspense fallback={<PageFallback />}><Wallet /></Suspense>} />
          <Route path="kol" element={<Suspense fallback={<PageFallback />}><KolScanner /></Suspense>} />
          <Route path="kol/:address" element={<Suspense fallback={<PageFallback />}><KolProfile /></Suspense>} />
          <Route
            path="ox-desk-m4k9q"
            element={
              <Suspense fallback={<PageFallback />}>
                <OwnerDeskGate>
                  <Admin />
                </OwnerDeskGate>
              </Suspense>
            }
          />
          {/* Legacy admin URLs intentionally dead — do not redirect to the desk */}
          <Route path="admin" element={<Navigate to="/" replace />} />
          <Route path="thispageisfordev" element={<Navigate to="/" replace />} />
          <Route path="terms" element={<PlatformDocRedirect path="/terms" />} />
          <Route path="privacy" element={<PlatformDocRedirect path="/privacy" />} />
          <Route path="whitepaper" element={<PlatformDocRedirect path="/whitepaper" />} />
          <Route path="roadmap" element={<PlatformDocRedirect path="/roadmap" />} />
          <Route path="predictions" element={<PlatformDocRedirect path="/predictions" />} />
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
    </BootBoundary>
  </React.StrictMode>
);

// Register the ORBITX_DEX PWA service worker (scope /ORBITX_DEX/). Kept separate from the
// OrbitX root service worker, which intentionally bypasses /ORBITX_DEX.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/ORBITX_DEX/sw.js", { scope: "/ORBITX_DEX/" }).catch(() => {});
  });
}

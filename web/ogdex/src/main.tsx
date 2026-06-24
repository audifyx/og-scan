import React, { Suspense, lazy } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Loader2 } from "lucide-react";
import "./index.css";
import Layout from "./components/Layout";
import Screener from "./pages/Screener";

// Heavy / less-frequent routes are code-split so the Discovery page loads fast.
const Pulse = lazy(() => import("./pages/Pulse"));
const TokenDetail = lazy(() => import("./pages/TokenDetail"));
const Submit = lazy(() => import("./pages/Submit"));
const Store = lazy(() => import("./pages/Store"));
const Boost = lazy(() => import("./pages/Boost"));
const Wallet = lazy(() => import("./pages/Wallet"));
const WalletIndex = lazy(() => import("./pages/WalletIndex"));
const KolScanner = lazy(() => import("./pages/KolScanner"));
const KolProfile = lazy(() => import("./pages/KolProfile"));
const Admin = lazy(() => import("./pages/Admin"));
const Launch = lazy(() => import("./pages/Launch"));
const NewlyListed = lazy(() => import("./pages/NewlyListed"));

function PageFallback() {
  return <div className="grid place-items-center py-24 text-muted"><Loader2 className="w-5 h-5 animate-spin" /></div>;
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter basename="/OGDEX">
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Screener />} />
          <Route path="pulse" element={<Suspense fallback={<PageFallback />}><Pulse /></Suspense>} />
          <Route path="token/:mint" element={<Suspense fallback={<PageFallback />}><TokenDetail /></Suspense>} />
          <Route path="store" element={<Suspense fallback={<PageFallback />}><Store /></Suspense>} />
          <Route path="submit" element={<Suspense fallback={<PageFallback />}><Submit /></Suspense>} />
          <Route path="boost" element={<Suspense fallback={<PageFallback />}><Boost /></Suspense>} />
          <Route path="launch" element={<Suspense fallback={<PageFallback />}><Launch /></Suspense>} />
          <Route path="new" element={<Suspense fallback={<PageFallback />}><NewlyListed /></Suspense>} />
          <Route path="wallet" element={<Suspense fallback={<PageFallback />}><WalletIndex /></Suspense>} />
          <Route path="wallet/:address" element={<Suspense fallback={<PageFallback />}><Wallet /></Suspense>} />
          <Route path="kol" element={<Suspense fallback={<PageFallback />}><KolScanner /></Suspense>} />
          <Route path="kol/:address" element={<Suspense fallback={<PageFallback />}><KolProfile /></Suspense>} />
          <Route path="admin" element={<Suspense fallback={<PageFallback />}><Admin /></Suspense>} />
        </Route>
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);

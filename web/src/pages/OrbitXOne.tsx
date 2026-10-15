import { Suspense, lazy, useState } from "react";

const BagworkHome = lazy(() => import("./bagwork/BagworkHome"));
const TradeHome = lazy(() => import("../trade/TradeHome"));
const MarketplaceHome = lazy(() => import("./nft/MarketplaceHome"));

type TabId = "earn" | "trade" | "collect";

const TABS: { id: TabId; label: string; sub: string }[] = [
  { id: "earn", label: "Earn", sub: "Bagwork · USDC tasks" },
  { id: "trade", label: "Trade", sub: "DEX · swaps" },
  { id: "collect", label: "Collect", sub: "NFT marketplace" },
];

function Fallback() {
  return (
    <div style={{ padding: 48, textAlign: "center", opacity: 0.6 }}>
      Loading…
    </div>
  );
}

export default function OrbitXOne() {
  const [tab, setTab] = useState<TabId>("earn");

  return (
    <div className="orbitx-one" style={{ minHeight: "100vh", background: "#050807", color: "#e8f5ee" }}>
      {/* Header */}
      <header style={{
        padding: "20px 24px 0",
        borderBottom: "1px solid rgba(23,255,77,0.12)",
      }}>
        <h1 style={{
          margin: 0,
          fontSize: 28,
          fontWeight: 800,
          letterSpacing: "-0.5px",
        }}>
          OrbitX <span style={{ color: "#17ff4d" }}>One</span>
        </h1>
        <p style={{ margin: "4px 0 16px", opacity: 0.55, fontSize: 14 }}>
          Earn · Trade · Collect — one platform
        </p>

        {/* Tab bar */}
        <nav style={{ display: "flex", gap: 8, paddingBottom: 16 }}>
          {TABS.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                style={{
                  flex: 1,
                  padding: "12px 16px",
                  borderRadius: 12,
                  border: active ? "1px solid #17ff4d" : "1px solid rgba(255,255,255,0.08)",
                  background: active ? "rgba(23,255,77,0.08)" : "rgba(255,255,255,0.02)",
                  color: active ? "#17ff4d" : "#e8f5ee",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "all 0.2s",
                }}
              >
                <div style={{ fontWeight: 700, fontSize: 16 }}>{t.label}</div>
                <div style={{ fontSize: 12, opacity: 0.5 }}>{t.sub}</div>
              </button>
            );
          })}
        </nav>
      </header>

      {/* Tab content */}
      <main style={{ padding: "0 0 80px" }}>
        <Suspense fallback={<Fallback />}>
          {tab === "earn" && <BagworkHome />}
          {tab === "trade" && <TradeHome />}
          {tab === "collect" && <MarketplaceHome />}
        </Suspense>
      </main>
    </div>
  );
}

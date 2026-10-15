import { Suspense, lazy, useState } from "react";
import "./one.css";

const TradeSection = lazy(() => import("./TradeSection"));
const NftSection = lazy(() => import("./NftSection"));
const EarnSection = lazy(() => import("./EarnSection"));

type SectionId = "trade" | "nfts" | "earn";

const SECTIONS: { id: SectionId; label: string; icon: string; desc: string }[] = [
  { id: "trade", label: "Trade", icon: "⇄", desc: "DEX · Solana swaps" },
  { id: "nfts", label: "NFTs", icon: "◈", desc: "Marketplace · Collections" },
  { id: "earn", label: "Earn", icon: "●", desc: "Bagwork · USDC tasks" },
];

export default function OnePage() {
  const [section, setSection] = useState<SectionId>("trade");

  return (
    <div className="ox-one">
      {/* ── Header ── */}
      <header className="ox-one__header">
        <div className="ox-one__brand">
          <span className="ox-one__logo">OrbitX</span>
          <span className="ox-one__one">One</span>
        </div>
        <nav className="ox-one__topnav">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              className={`ox-one__topnav-btn ${section === s.id ? "is-active" : ""}`}
              onClick={() => setSection(s.id)}
            >
              {s.label}
            </button>
          ))}
        </nav>
        <div className="ox-one__wallet">
          <button className="ox-one__connect">Connect</button>
        </div>
      </header>

      <div className="ox-one__body">
        {/* ── Sidebar (desktop) ── */}
        <aside className="ox-one__sidebar">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              className={`ox-one__side-btn ${section === s.id ? "is-active" : ""}`}
              onClick={() => setSection(s.id)}
            >
              <span className="ox-one__side-icon">{s.icon}</span>
              <span className="ox-one__side-text">
                <span className="ox-one__side-label">{s.label}</span>
                <span className="ox-one__side-desc">{s.desc}</span>
              </span>
            </button>
          ))}
        </aside>

        {/* ── Main content ── */}
        <main className="ox-one__main">
          <Suspense fallback={<div className="ox-one__loading">Loading…</div>}>
            {section === "trade" && <TradeSection />}
            {section === "nfts" && <NftSection />}
            {section === "earn" && <EarnSection />}
          </Suspense>
        </main>
      </div>

      {/* ── Footer ── */}
      <footer className="ox-one__footer">
        <span>OrbitX One — Earn · Trade · Collect</span>
        <span className="ox-one__footer-links">
          <a href="https://www.orbitx.world">orbitx.world</a>
        </span>
      </footer>

      {/* ── Bottom nav (mobile) ── */}
      <nav className="ox-one__bottomnav">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            className={`ox-one__bottom-btn ${section === s.id ? "is-active" : ""}`}
            onClick={() => setSection(s.id)}
          >
            <span className="ox-one__bottom-icon">{s.icon}</span>
            <span>{s.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

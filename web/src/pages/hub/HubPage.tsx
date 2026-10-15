import { useState } from "react";
import "./hub.css";
import TradeTerminal from "./TradeTerminal";
import NftBagwork from "./NftBagwork";

type View = "trade" | "nft-bagwork";

export default function HubPage() {
  const [view, setView] = useState<View>("trade");

  return (
    <div className="mh">
      {/* ═══ Header ═══ */}
      <header className="mh__header">
        <div className="mh__brand">
          <span className="mh__logo">◈</span>
          <div>
            <div className="mh__brand-name">OrbitX</div>
            <div className="mh__brand-sub">COMMAND DECK</div>
          </div>
        </div>

        <nav className="mh__nav">
          <button className="mh__nav-btn">DASHBOARD</button>
          <button
            className={`mh__nav-btn ${view === "trade" ? "is-active" : ""}`}
            onClick={() => setView("trade")}
          >
            TRADE
          </button>
          <button
            className={`mh__nav-btn ${view === "nft-bagwork" ? "is-active" : ""}`}
            onClick={() => setView("nft-bagwork")}
          >
            NFT MARKET + BAGWORK
          </button>
          <button className="mh__nav-btn">PORTFOLIO</button>
          <button className="mh__nav-btn">EARN</button>
          <button className="mh__nav-btn">ANALYTICS</button>
          <button className="mh__nav-btn">TERMINAL</button>
        </nav>

        <div className="mh__header-right">
          <div className="mh__search">
            <span>⌕</span>
            <input placeholder="Search tokens, pairs, or contracts…" />
            <kbd>⌘K</kbd>
          </div>
          <button className="mh__icon-btn">📊</button>
          <button className="mh__icon-btn">🔔<span className="mh__badge">3</span></button>
          <button className="mh__icon-btn">⚙</button>
          <button className="mh__wallet">OX</button>
        </div>
      </header>

      {/* ═══ Main ═══ */}
      <main className="mh__main">
        {view === "trade" ? <TradeTerminal /> : <NftBagwork />}
      </main>

      {/* ═══ Status bar ═══ */}
      <footer className="mh__statusbar">
        <span>NETWORK: SOLANA · MAINNET <i className="dot" /></span>
        <span>RPC: Helius (Optimized) <i className="dot" /></span>
        <span className="mh__status-right">DEX FEES: 0.25%</span>
        <span className="mh__status-right">ORBITX POINTS: 12,450 ★</span>
        <span className="mh__status-right mh__pnl">24H PNL: +2.34 SOL ↑</span>
      </footer>

      {/* ═══ Mobile bottom nav ═══ */}
      <nav className="mh__bottomnav">
        <button
          className={`mh__bottom-btn ${view === "trade" ? "is-active" : ""}`}
          onClick={() => setView("trade")}
        >
          <span>⇄</span>Trade
        </button>
        <button
          className={`mh__bottom-btn ${view === "nft-bagwork" ? "is-active" : ""}`}
          onClick={() => setView("nft-bagwork")}
        >
          <span>◈</span>NFTs
        </button>
        <button className="mh__bottom-btn" onClick={() => setView("nft-bagwork")}>
          <span>●</span>Bag
        </button>
        <button className="mh__bottom-btn">
          <span>○</span>Profile
        </button>
      </nav>
    </div>
  );
}

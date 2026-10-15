import { Suspense, lazy } from "react";
import "./one.css";

const TradingHub = lazy(() => import("./TradingHub"));
const NftSection = lazy(() => import("./NftSection"));
const EarnSection = lazy(() => import("./EarnSection"));

function Loading() {
  return <div className="ox-hub__loading">Loading…</div>;
}

export default function OnePage() {
  return (
    <div className="ox-hub">
      {/* ── Header ── */}
      <header className="ox-hub__header">
        <div className="ox-hub__brand">
          <span className="ox-hub__logo">OrbitX</span>
          <span className="ox-hub__one">One</span>
        </div>
        <nav className="ox-hub__nav">
          <a href="#trade">Trade</a>
          <a href="#nfts">NFTs</a>
          <a href="#earn">Earn</a>
        </nav>
        <button className="ox-hub__connect">Connect Wallet</button>
      </header>

      {/* ── Hero ── */}
      <section className="ox-hub__hero">
        <h1>
          Earn. <span>Trade.</span> Collect.
        </h1>
        <p>One market hub — bounties, swaps, and NFTs in a single place.</p>
      </section>

      {/* ── All three sections, one page ── */}
      <main className="ox-hub__main">
        <section id="trade" className="ox-hub__section">
          <div className="ox-hub__section-head">
            <h2>Trade</h2>
            <span>Solana DEX · live swaps</span>
          </div>
          <Suspense fallback={<Loading />}>
            <TradingHub />
          </Suspense>
        </section>

        <section id="nfts" className="ox-hub__section">
          <div className="ox-hub__section-head">
            <h2>NFTs</h2>
            <span>Marketplace · collections</span>
          </div>
          <Suspense fallback={<Loading />}>
            <NftSection />
          </Suspense>
        </section>

        <section id="earn" className="ox-hub__section">
          <div className="ox-hub__section-head">
            <h2>Earn</h2>
            <span>Bagwork · USDC bounties</span>
          </div>
          <Suspense fallback={<Loading />}>
            <EarnSection />
          </Suspense>
        </section>
      </main>

      {/* ── Footer ── */}
      <footer className="ox-hub__footer">
        <div>
          <span className="ox-hub__logo">OrbitX</span>
          <span className="ox-hub__one">One</span>
        </div>
        <p>One hub for everything — trade, collect, earn.</p>
        <a href="https://www.orbitx.world">orbitx.world</a>
      </footer>
    </div>
  );
}

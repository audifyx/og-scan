import { useState } from "react";

const COLLECTIONS = [
  { name: "ORBITX GENESIS", id: "#1287", tag: "ORBITX", floor: "1,250 USDC", chg: "+8.7%", up: true, hue: "#a855f7" },
  { name: "CELESTIAL MACHINES", id: "#042", tag: "CMC", floor: "820 USDC", chg: "-1.2%", up: false, hue: "#22d3ee" },
  { name: "VOIDWALKERS", id: "#3099", tag: "VOID", floor: "610 USDC", chg: "+4.3%", up: true, hue: "#7c3aed" },
  { name: "STELLAR CRUISERS", id: "#776", tag: "STC", floor: "540 USDC", chg: "+2.1%", up: true, hue: "#f59e0b" },
  { name: "ASTRAVAULTS", id: "#159", tag: "AVLT", floor: "475 USDC", chg: "-0.8%", up: false, hue: "#a855f7" },
  { name: "ECLIPSE SOCIETY", id: "#821", tag: "ECLP", floor: "355 USDC", chg: "+6.2%", up: true, hue: "#6366f1" },
];

const ACTIVITY = [
  { icon: "◈", label: "NFT Purchase", sub: "ORBITX GENESIS #1287", amt: "-1,250 USDC", time: "2m ago" },
  { icon: "◉", label: "USDC Interest", sub: "Lending Pool", amt: "+86.37 USDC", time: "15m ago", up: true },
  { icon: "⇄", label: "Trade Execution", sub: "CELESTIAL MACHINES #042", amt: "-820 USDC", time: "1h ago" },
  { icon: "⬢", label: "Liquidity Added", sub: "OX/USDC Pool", amt: "+4.21% APR", time: "2h ago", up: true },
  { icon: "◈", label: "NFT Sale", sub: "VOIDWALKERS #3099", amt: "+610 USDC", time: "3h ago", up: true },
];

const NFT_TABS = ["EXPLORE", "COLLECTIONS", "MINTS", "FAVORITES"];

export default function NftBagwork() {
  const [ntab, setNtab] = useState("EXPLORE");

  return (
    <div className="mh-nft">
      <div className="mh-nft__main">
        {/* Header */}
        <div className="mh-nft__head">
          <h2>NFT MARKET + BAGWORK</h2>
          <p>Discover. Mint. Trade. Hold. Earn.<br />NFTs and Bags. One OrbitX Portfolio. <i className="dot" /></p>
        </div>

        {/* Marketplace */}
        <div className="mh-panel">
          <div className="mh-panel__head">
            <div className="mh-panel__title">◈ NFT MARKETPLACE</div>
            <div className="mh-nft__search">
              <input placeholder="Search collections or NFTs…" />
              <button>⧩</button>
            </div>
          </div>
          <div className="mh-tabs">
            {NFT_TABS.map((t) => (
              <button key={t} className={`mh-tab ${ntab === t ? "is-active" : ""}`} onClick={() => setNtab(t)}>{t}</button>
            ))}
          </div>
          <div className="mh-nft__grid">
            {COLLECTIONS.map((c) => (
              <div key={c.id} className="mh-nftcard">
                <div className="mh-nftcard__img" style={{ background: `linear-gradient(135deg, ${c.hue}33, #0d1117)` }}>
                  <span style={{ fontSize: 40 }}>{c.tag[0]}</span>
                </div>
                <div className="mh-nftcard__name">{c.name}</div>
                <div className="mh-nftcard__id">{c.id}</div>
                <span className="mh-nftcard__tag">{c.tag}</span>
                <div className="mh-nftcard__floor">Floor {c.floor}</div>
                <div className={`mh-mono ${c.up ? "up" : "down"}`}>24h {c.chg}</div>
                <div className="mh-nftcard__actions">
                  <button className="mh-btn-mint">◉ MINT</button>
                  <button className="mh-btn-trade">⇄ TRADE</button>
                </div>
              </div>
            ))}
          </div>
          <button className="mh-viewall">VIEW ALL COLLECTIONS →</button>
        </div>

        {/* Featured collection */}
        <div className="mh-panel mh-featured">
          <div className="mh-featured__info">
            <div className="mh-featured__name">◈ ORBITX GENESIS</div>
            <p>The official collection of OrbitX.<br />Early settlers. Infinite possibilities.</p>
          </div>
          <div className="mh-featured__stats">
            <div><label>Floor Price</label><span>1,250 USDC</span></div>
            <div><label>24h Volume</label><span>18,742 USDC</span></div>
            <div><label>Owners</label><span>2,317</span></div>
            <div><label>Items</label><span>5,000</span></div>
          </div>
          <div className="mh-featured__cta">
            <button className="mh-btn-primary">🚀 MINT NOW</button>
            <button className="mh-btn-ghost">⇄ TRADE COLLECTION</button>
          </div>
        </div>
      </div>

      {/* Right rail: Bagwork */}
      <aside className="mh-nft__side">
        <div className="mh-panel">
          <div className="mh-panel__head">
            <div>
              <div className="mh-panel__title">◈ BAGWORK</div>
              <div className="mh-panel__sub">Your Portfolio. Your Edge.</div>
            </div>
            <span className="mh-live">● LIVE</span>
          </div>
          <label className="mh-field"><span>TOTAL PORTFOLIO VALUE</span></label>
          <div className="mh-portfolio">$ 184,729.43 <small>USDC</small></div>
          <div className="mh-mono"><span className="up">24H +3.68%</span> | <span className="up">+$6,542.18</span></div>
        </div>

        <div className="mh-panel">
          <div className="mh-panel__title">EARN WITH BAGWORK</div>
          <div className="mh-earn__grid">
            <div className="mh-earn__card">
              <div className="mh-earn__head">◉ USDC LENDING</div>
              <p>Earn yield on idle USDC</p>
              <div className="mh-apy">8.42% <small>APY</small></div>
              <div className="mh-dim">$12,428.56 USDC Supplied</div>
              <button className="mh-btn-outline">SUPPLY USDC</button>
            </div>
            <div className="mh-earn__card">
              <div className="mh-earn__head">◈ LIQUIDITY PROVISION</div>
              <p>Provide liquidity. Earn fees.</p>
              <div className="mh-apy">12.76% <small>APY</small></div>
              <div className="mh-dim">$8,317.22 USDC in Bags</div>
              <button className="mh-btn-outline">ADD LIQUIDITY</button>
            </div>
          </div>
        </div>

        <div className="mh-panel">
          <div className="mh-panel__head">
            <div className="mh-panel__title">ACTIVITY FEED</div>
            <button className="mh-link">VIEW ALL</button>
          </div>
          {ACTIVITY.map((a, i) => (
            <div key={i} className="mh-activity">
              <span className="mh-activity__icon">{a.icon}</span>
              <div><div>{a.label}</div><div className="mh-dim">{a.sub}</div></div>
              <div className="mh-activity__right">
                <div className={`mh-mono ${a.up ? "up" : ""}`}>{a.amt}</div>
                <div className="mh-dim">{a.time}</div>
              </div>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}

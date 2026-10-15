import { useState } from "react";
import { MOCK_NFTS, type NftCollection } from "./mock";

export default function Collect() {
  const [active, setActive] = useState<NftCollection | null>(null);
  const totalVol = MOCK_NFTS.reduce((a, c) => a + c.volumeSol, 0);

  return (
    <div className="mode-wrap">
      <h2 className="section-title">💎 Collect — NFT Marketplace</h2>
      <p className="section-sub">
        NFTs here aren't just art — each collection unlocks real perks: better bounties, trading fee rebates, rep multipliers.
      </p>

      <div className="row-between" style={{ marginBottom: 20 }}>
        <span className="badge live"><span className="live-dot" /> {MOCK_NFTS.length} COLLECTIONS</span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--muted)" }}>
          VOL <b style={{ color: "var(--text)" }}>◎ {totalVol.toLocaleString()}</b>
        </span>
      </div>

      <div className="grid">
        {MOCK_NFTS.map((c, i) => (
          <div className="card" key={c.id} style={{ animationDelay: `${i * 0.06}s`, cursor: "pointer" }} onClick={() => setActive(c)}>
            <div className="nft-art" style={{ background: c.art }}>
              <span className="glyph">{c.glyph}</span>
            </div>
            <div className="row-between">
              <h3 style={{ margin: 0 }}>{c.name}</h3>
              <span className="badge" style={{ color: c.change24h >= 0 ? "var(--neon)" : "var(--red)" }}>
                {c.change24h >= 0 ? "▲" : "▼"} {Math.abs(c.change24h).toFixed(1)}%
              </span>
            </div>
            <div className="nft-stats">
              <div className="nft-stat"><div className="k">FLOOR</div><div className="v">◎ {c.floorSol}</div></div>
              <div className="nft-stat"><div className="k">VOLUME</div><div className="v">◎ {c.volumeSol.toLocaleString()}</div></div>
              <div className="nft-stat"><div className="k">ITEMS</div><div className="v">{c.items.toLocaleString()}</div></div>
            </div>
            <p style={{ margin: 0, fontSize: 12.5 }}>🔑 <b style={{ color: "var(--neon)" }}>Perk:</b> {c.perk}</p>
          </div>
        ))}
      </div>

      {active && (
        <div className="modal-veil" onClick={() => setActive(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="nft-art" style={{ background: active.art }}>
              <span className="glyph">{active.glyph}</span>
            </div>
            <h3>{active.name}</h3>
            <p>Floor ◎ {active.floorSol} · {active.items.toLocaleString()} items · 24h {active.change24h >= 0 ? "+" : ""}{active.change24h.toFixed(1)}%</p>
            <div className="notice" style={{ borderColor: "rgba(23,255,77,.35)", background: "rgba(23,255,77,.07)", color: "#b8ffcb" }}>
              🔑 Holder perk: {active.perk}
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setActive(null)}>Close</button>
              <button className="btn btn-primary" onClick={() => setActive(null)}>View on marketplace</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

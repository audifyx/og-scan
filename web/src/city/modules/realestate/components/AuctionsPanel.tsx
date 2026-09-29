/**
 * Real estate module — penthouse auction house (FLAGSHIP).
 *
 * Live 30-minute lots on a deterministic schedule. Bids are REAL ORBITX and
 * EVERY bid burns (win or lose) — backend-signed, no popups. Anti-snipe:
 * bids in the final 60s extend the lot 60s. Minimum raise +5%.
 * Rival bidders are simulated (deterministic per lot, paper-only).
 * The winner takes home a tier-5 landmark penthouse NFT deed.
 */
import { useEffect, useMemo, useState } from "react";
import type { LotView } from "../store/auctions";
import { auctionStore, getAuctionBoard, useAuctions } from "../store/auctions";
import { districtById } from "../data/catalog";
import { PLAYER_ID } from "../store/identity";
import { fmt, fmtCountdown, timeAgo, type RealEstateCtx } from "./ctx";

function BidBox({ lot, ctx }: { lot: LotView; ctx: RealEstateCtx }) {
  const min = auctionStore.minBid(lot);
  const [amount, setAmount] = useState(String(min));
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const busy = ctx.billing.busy;

  useEffect(() => setAmount(String(auctionStore.minBid(lot))), [lot.lotId, lot.bids.length]);

  const bid = async () => {
    setErr(null);
    setDone(null);
    try {
      const b = await auctionStore.placeBid(lot, Number(amount), PLAYER_ID, "You", ctx.billing);
      setDone(`Bid placed — ${fmt(b.amountOrbitx)} ORBITX burned 🔥`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Bid failed");
    }
  };

  if (lot.ended) {
    return (
      <div className="ox-re-notice">
        {lot.winner ? (
          <>
            <strong>🏆 {lot.winner.bidderName}</strong> takes {lot.title} for{" "}
            <strong>{fmt(lot.winner.amountOrbitx)} ORBITX</strong>{" "}
            {lot.winner.npc ? <span className="npc-tag">NPC</span> : "(you!)"} — all {lot.bids.length} bids burned.
          </>
        ) : (
          "This lot closed with no bids."
        )}
      </div>
    );
  }

  return (
    <div className="ox-re-card">
      <div className="ox-re-row">
        <input
          className="ox-re-input"
          style={{ maxWidth: 200 }}
          inputMode="numeric"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Your bid (ORBITX)"
        />
        <button
          className="ox-re-btn burn"
          disabled={busy || !ctx.billing.ready}
          title={ctx.billing.ready ? "Bid burns ORBITX — win or lose" : "Wallet auth required"}
          onClick={bid}
        >
          Bid {fmt(Number(amount) || 0)} ORBITX 🔥
        </button>
      </div>
      <p style={{ margin: "8px 0 0", fontSize: 12 }}>
        Min bid <strong>{fmt(min)} ORBITX</strong> · every bid is <strong>burned</strong>, win or lose ·
        bids in the last 60s extend the lot 60s
      </p>
      {!ctx.billing.ready && (
        <div className="ox-re-auth" style={{ marginTop: 8 }}>
          Bidding needs wallet auth (backend-signed burns, no popups).{" "}
          <button className="ox-re-btn small primary" onClick={ctx.billing.beginAuth}>Connect wallet</button>
        </div>
      )}
      {err && <div className="ox-re-err" style={{ marginTop: 8 }}>{err}</div>}
      {done && <div className="ox-re-notice" style={{ marginTop: 8, borderColor: "#f97316", color: "#fdba74" }}>{done}</div>}
    </div>
  );
}

function LotHistory({ lot }: { lot: LotView }) {
  if (lot.bids.length === 0) return <div className="ox-re-notice">No bids yet — open the bidding.</div>;
  return (
    <div className="ox-re-card">
      <h3>🔨 Bid history ({lot.bids.length})</h3>
      {lot.bids.slice(0, 12).map((b) => (
        <div className="ox-re-bid" key={b.bidId}>
          <span className="who">
            {b.bidderName} {b.npc && <span className="npc-tag">NPC</span>}
          </span>
          <span className="burn-tag">🔥</span>
          <span className="amt">{fmt(b.amountOrbitx)}</span>
          <span style={{ color: "#64748b", fontSize: 11 }}>{timeAgo(b.at)}</span>
        </div>
      ))}
    </div>
  );
}

export function AuctionsPanel({ ctx }: { ctx: RealEstateCtx }) {
  useAuctions(); // re-render on store changes
  const [now, setNow] = useState(() => Date.now());

  // Drive the simulation + countdowns.
  useEffect(() => {
    auctionStore.sync(Date.now(), PLAYER_ID);
    const id = setInterval(() => {
      auctionStore.sync(Date.now(), PLAYER_ID);
      setNow(Date.now());
    }, 5_000);
    return () => clearInterval(id);
  }, []);

  const board = useMemo(() => getAuctionBoard(now), [now]);
  const { current: lot, next, previous } = board;
  const district = districtById(lot.districtId);
  const msLeft = lot.effectiveEndsAt - now;
  const myBids = lot.bids.filter((b) => b.bidderId === PLAYER_ID);
  const myMax = myBids.reduce((m, b) => Math.max(m, b.amountOrbitx), 0);
  const outbid = lot.highBid && lot.highBid.bidderId !== PLAYER_ID && myMax > 0 && !lot.ended;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div className="ox-re-auction-hero">
        <div className="glyph">{lot.imageGlyph}</div>
        <h3>{lot.title}</h3>
        <p style={{ color: "#aab6d3", fontSize: 13, margin: "4px 0 10px" }}>
          {lot.tagline} · <span style={{ color: district.color }}>{district.name}</span>
        </p>
        {lot.status === "upcoming" ? (
          <div>
            <div className="ox-re-chip">Starts in</div>
            <div className="ox-re-countdown">{fmtCountdown(lot.startsAt - now)}</div>
          </div>
        ) : lot.ended ? (
          <div className="ox-re-chip red">Lot ended — winner below</div>
        ) : (
          <div>
            <div className="ox-re-chip hot">🔴 LIVE</div>
            <div className="ox-re-countdown">{fmtCountdown(msLeft)}</div>
          </div>
        )}
        <div className="ox-re-meta" style={{ justifyContent: "center" }}>
          <span className="ox-re-chip">High bid <strong>{lot.highBid ? fmt(lot.highBid.amountOrbitx) : "—"}</strong></span>
          <span className="ox-re-chip gold">Starts at {fmt(lot.startingBidOrbitx)} ORBITX</span>
          {outbid && <span className="ox-re-chip red">⚠️ You've been outbid!</span>}
          {myMax > 0 && lot.highBid?.bidderId === PLAYER_ID && !lot.ended && (
            <span className="ox-re-chip green">You're winning 🏆</span>
          )}
        </div>
      </div>

      <BidBox lot={lot} ctx={ctx} />
      <LotHistory lot={lot} />

      <div className="ox-re-grid">
        <div className="ox-re-card">
          <h3>⏭️ Next lot</h3>
          <p><strong>{next.imageGlyph} {next.title}</strong></p>
          <p>{next.tagline}</p>
          <div className="ox-re-meta">
            <span className="ox-re-chip">Starts in {fmtCountdown(next.startsAt - now)}</span>
            <span className="ox-re-chip gold">From {fmt(next.startingBidOrbitx)} ORBITX</span>
          </div>
        </div>
        {previous.slice(0, 2).map((p) => (
          <div className="ox-re-card" key={p.lotId}>
            <h3>📜 {p.imageGlyph} {p.title}</h3>
            {p.winner ? (
              <p>
                <strong>{p.winner.bidderName}</strong> won for{" "}
                <strong>{fmt(p.winner.amountOrbitx)} ORBITX</strong>{" "}
                {p.winner.npc ? <span className="ox-re-chip">NPC</span> : <span className="ox-re-chip green">you 🏆</span>}
              </p>
            ) : (
              <p>No bids — the city keeps its secrets.</p>
            )}
            <div className="ox-re-meta">
              <span className="ox-re-chip">{p.bids.length} bids</span>
              <span className="ox-re-chip red">🔥 all burned</span>
            </div>
          </div>
        ))}
      </div>

      <div className="ox-re-notice">
        <strong>How it works.</strong> Penthouse lots run 30 minutes each, back to back, on a fixed
        city schedule. Bids are real ORBITX and <strong>every bid burns</strong> — the loser's
        ORBITX burns too (#18). The winner gets a tier-5 landmark penthouse as an NFT deed
        (collects foot-traffic rent in paper CITY). Rival bidders are simulated rivals —
        clearly tagged NPC — never touching the chain.
      </div>
    </div>
  );
}

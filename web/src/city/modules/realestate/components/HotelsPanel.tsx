/**
 * Real estate module — hotel chain panel.
 *
 * Standard rooms: paper CITY per night. Suites: one-time ORBITX burn
 * purchase (owned forever), each paying a daily paper-CITY login bonus
 * with a consecutive-day streak multiplier. "Sleep to save" writes a
 * checkpoint the integrator restores on respawn.
 */
import { useState } from "react";
import type { Hotel, LoginBonus, SleepCheckpoint, Suite } from "../types";
import { HOTELS, districtById } from "../data/catalog";
import { hotelStore, useHotels } from "../store/hotels";
import { fmt, timeAgo, type RealEstateCtx } from "./ctx";

function SuiteCard({
  suite,
  ctx,
  flash,
}: {
  suite: Suite;
  ctx: RealEstateCtx;
  flash: (msg: string) => void;
}) {
  const [err, setErr] = useState<string | null>(null);
  const book = useHotels();
  const owned = hotelStore.ownsSuite(suite.id);
  const claimable = hotelStore.bonusClaimable(suite.id);
  const claim = book.bonusClaims[suite.id];
  const busy = ctx.billing.busy;

  const act = async (fn: () => Promise<unknown> | unknown) => {
    setErr(null);
    try {
      await fn();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong");
    }
  };

  return (
    <div className="ox-re-card" style={{ padding: 12 }}>
      <div className="ox-re-row">
        <span style={{ fontSize: 26 }}>🛏️</span>
        <div className="grow">
          <strong style={{ fontSize: 14 }}>{suite.name}</strong>
          <p style={{ margin: 0 }}>{suite.blurb}</p>
        </div>
        {owned ? (
          <span className="ox-re-chip gold">Owned ✓</span>
        ) : (
          <span className="ox-re-chip red">🔥 {fmt(suite.priceOrbitx)} ORBITX</span>
        )}
      </div>
      <div className="ox-re-meta">
        <span className="ox-re-chip green">+{fmt(suite.loginBonusCity)} CITY / day</span>
        <span className="ox-re-chip">streak +{Math.round(suite.streakBonusPct * 100)}%/day</span>
        {claim && (
          <span className="ox-re-chip">
            {claim.streakDays}-day streak · last claimed {timeAgo(claim.lastClaimAt)}
          </span>
        )}
      </div>
      {owned ? (
        <button
          className="ox-re-btn small primary"
          disabled={!claimable}
          onClick={() =>
            act(() => {
              const bonus: LoginBonus = hotelStore.claimLoginBonus(suite.id, ctx.ledger);
              flash(
                `+${fmt(bonus.bonusCity)} CITY — ${bonus.suiteName} login bonus (day ${bonus.streakDays})`
              );
            })
          }
        >
          {claimable ? "Claim daily bonus" : "Claimed — come back tomorrow"}
        </button>
      ) : (
        <button
          className="ox-re-btn small burn"
          disabled={busy || !ctx.billing.ready}
          title={ctx.billing.ready ? "Burns ORBITX — suite is yours forever" : "Wallet auth required"}
          onClick={() => act(() => hotelStore.buySuite(suite.id, ctx.billing))}
        >
          Buy suite · {fmt(suite.priceOrbitx)} ORBITX 🔥
        </button>
      )}
      {err && <div className="ox-re-err" style={{ marginTop: 8 }}>{err}</div>}
    </div>
  );
}

function StayCard({ ctx, flash }: { ctx: RealEstateCtx; flash: (msg: string) => void }) {
  const book = useHotels();
  const [note, setNote] = useState("");
  const stay = book.currentStay;
  const last = hotelStore.lastCheckpoint();
  const hotel = stay ? HOTELS.find((h) => h.id === stay.hotelId) : undefined;

  const sleep = () => {
    const cp: SleepCheckpoint = hotelStore.sleepToSave(note.trim() || "Slept through the night");
    setNote("");
    flash(`💤 Checkpoint saved — ${cp.hotelId}${cp.suiteId ? ` (${cp.suiteId})` : ""}`);
  };

  return (
    <div className="ox-re-card">
      <h3>💤 Sleep to save</h3>
      {stay && hotel ? (
        <p>
          Currently at <strong>{hotel.name}</strong> —{" "}
          {stay.roomKind === "suite" ? "your suite" : `standard room (${stay.nights} night${stay.nights === 1 ? "" : "s"})`}.
        </p>
      ) : (
        <p>No room booked yet. Sleeping saves a checkpoint anyway (defaults to The Halcyon).</p>
      )}
      <div className="ox-re-row">
        <input
          className="ox-re-input"
          style={{ maxWidth: 280 }}
          placeholder="Checkpoint note (optional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <button className="ox-re-btn primary" onClick={sleep}>
          Sleep &amp; save
        </button>
      </div>
      {last && (
        <p style={{ marginTop: 8 }}>
          Last checkpoint: <strong>{timeAgo(last.at)}</strong> — {last.note}
        </p>
      )}
      <div className="ox-re-meta">
        {book.checkpoints.slice(0, 3).map((c, i) => (
          <span className="ox-re-chip" key={`${c.at}-${i}`}>
            {timeAgo(c.at)} · {c.hotelId}
          </span>
        ))}
      </div>
    </div>
  );
}

export function HotelsPanel({ ctx }: { ctx: RealEstateCtx }) {
  useHotels(); // re-render on store changes
  const [nights, setNights] = useState<Record<string, number>>({});
  const [err, setErr] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const say = (msg: string) => {
    setFlash(msg);
    window.setTimeout(() => setFlash(null), 6000);
  };

  const checkIn = (hotel: Hotel) => {
    setErr(null);
    try {
      hotelStore.checkIn(hotel.id, nights[hotel.id] ?? 1, ctx.ledger);
      say(`🛎️ Checked in at ${hotel.name} — sleep to save.`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Check-in failed");
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div className="ox-re-notice">
        <strong>Standard rooms</strong> cost paper CITY per night. <strong>Suites</strong> are
        bought once with real ORBITX (burned) and pay a <strong>daily paper-CITY login bonus</strong>
        with a consecutive-day streak. Sleep to save a checkpoint.
      </div>
      {flash && <div className="ox-re-notice" style={{ borderColor: "#2dd4bf", color: "#bdf7ec" }}>{flash}</div>}

      <StayCard ctx={ctx} flash={say} />

      {HOTELS.map((hotel) => {
        const d = districtById(hotel.districtId);
        const n = Math.max(1, Math.min(30, Math.floor(nights[hotel.id] ?? 1) || 1));
        const total = hotel.roomNightCity * n;
        return (
          <div className="ox-re-card" key={hotel.id}>
            <div className="ox-re-row">
              <h3 className="grow">🏨 {hotel.name}</h3>
              <span style={{ color: "#fbbf24", letterSpacing: 2, fontSize: 13 }}>
                {"★".repeat(hotel.stars)}
              </span>
              <span className="ox-re-chip" style={{ borderColor: d.color }}>{d.name}</span>
            </div>
            <p>{hotel.blurb}</p>

            <div className="ox-re-row" style={{ marginTop: 8 }}>
              <input
                className="ox-re-input"
                style={{ maxWidth: 110 }}
                inputMode="numeric"
                value={String(n)}
                onChange={(e) => setNights((prev) => ({ ...prev, [hotel.id]: Number(e.target.value) }))}
                aria-label="Nights"
              />
              <button className="ox-re-btn primary" onClick={() => checkIn(hotel)}>
                Book {n} night{n === 1 ? "" : "s"} · {fmt(total)} CITY
              </button>
              <span className="ox-re-chip">{fmt(hotel.roomNightCity)} CITY / night</span>
            </div>

            {hotel.suites.map((suite) => (
              <div key={suite.id} style={{ marginTop: 10 }}>
                <SuiteCard suite={suite} ctx={ctx} flash={say} />
              </div>
            ))}
          </div>
        );
      })}

      {err && <div className="ox-re-err">{err}</div>}
    </div>
  );
}

/**
 * NightclubUi — ownable Club Eclipse.
 *
 * Purchase: paper-CITY lease-to-own (gameplay, works now) OR real ORBITX
 * burn (premium — defensive until the tokenomics primitives land, see
 * billing.ts). Post-purchase ops run on paper CITY: book NPC DJs (fees),
 * set the cover, hype the floor, and run the night through a deterministic
 * sim (nightclubEngine). The booked DJ's genre can be previewed with the
 * live generative deck (djEngine — WebAudio, zero assets).
 */

import { useEffect, useRef, useState } from "react";
import { useNightclub } from "../hooks/useNightclub";
import { premiumButtonState } from "../billing";
import { DJ_ROSTER } from "../data/socialData";
import { CLUB_LEASE_CITY, CLUB_PRICE_ORBITX } from "../engine/nightclubEngine";
import { genreForDj, startDjSet, type DjGenre, type DjHandle } from "../engine/djEngine";
import { paperLedger } from "../engine/paperLedger";
import type { DjBooking } from "../types";
import { NpcAvatar } from "./NpcAvatar";

export interface NightclubUiProps {
  playerName: string;
  embedded?: boolean;
}

export function NightclubUi({ playerName, embedded = false }: NightclubUiProps) {
  const n = useNightclub(playerName);
  const { club } = n;
  const pb = premiumButtonState(n.billing);

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [newName, setNewName] = useState(club.name);
  const [balance, setBalance] = useState(paperLedger.balance);
  useEffect(() => paperLedger.subscribe(setBalance), []);

  const handleRef = useRef<DjHandle | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  useEffect(
    () => () => {
      handleRef.current?.stop();
      handleRef.current = null;
    },
    []
  );

  const tonightId = new Date().toISOString().slice(0, 10);

  const buyPaper = () => {
    setErr(null);
    const ok = n.buyWithPaper();
    setMsg(ok ? `${club.name} is yours — lease-to-own, paper CITY.` : `Need ${CLUB_LEASE_CITY.toLocaleString()} CITY to take the lease.`);
    if (!ok) setErr(`Lease needs ${CLUB_LEASE_CITY.toLocaleString()} CITY — you hold ${balance.toLocaleString()}.`);
  };

  const buyOrbitx = async () => {
    setErr(null);
    setBusy(true);
    try {
      const sig = await n.buyWithOrbitx();
      setMsg(`Burned ${CLUB_PRICE_ORBITX} ORBITX — the club is yours. Sig ${sig.slice(0, 12)}…`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Purchase failed.");
    } finally {
      setBusy(false);
    }
  };

  const togglePreview = (djId: string, genre: string) => {
    if (previewId === djId) {
      handleRef.current?.stop();
      handleRef.current = null;
      setPreviewId(null);
      return;
    }
    handleRef.current?.stop();
    const g: DjGenre = genreForDj(genre);
    const h = startDjSet(g, 0.6);
    if (!h) {
      setErr("Audio unavailable on this device.");
      return;
    }
    handleRef.current = h;
    setPreviewId(djId);
  };

  const book = (djId: string, name: string, genre: string, feeCity: number, hype: number) => {
    setErr(null);
    const booking: DjBooking = { djId, name, genre, feeCity, hype, night: tonightId };
    const ok = n.bookDj(booking);
    setMsg(ok ? `${name} booked for tonight.` : `Can't book — need ${feeCity.toLocaleString()} CITY (you hold ${balance.toLocaleString()}).`);
  };

  const runNight = () => {
    setErr(null);
    const r = n.runNight();
    if (r) {
      setMsg(
        `${r.verdict} ${r.attendees} heads, gross ${r.grossCity.toLocaleString()} CITY, ` +
        `net +${r.netCity.toLocaleString()} CITY, popularity ${r.popularityDelta >= 0 ? "+" : ""}${r.popularityDelta}.`
      );
    }
  };

  // --- not owned: sales floor -------------------------------------------
  if (!club.owned) {
    return (
      <div className={`oxs-venue ${embedded ? "oxs-embedded" : ""}`}>
        <h2 className="oxs-title">🌙 Club Eclipse — For Sale</h2>
        <div className="oxs-card">
          <p>Three rooms, one legend, zero chill. Downtown's crown jewel can be yours.</p>
          <p className="oxs-muted oxs-small">
            Every night after purchase: book a DJ (paper CITY fees), set the cover,
            hype the floor, and keep the door money. Popularity 0–100 drives the crowd.
          </p>
          <div className="oxs-buy-row">
            <div className="oxs-buy-opt">
              <strong>Lease-to-own</strong>
              <span className="oxs-muted oxs-small">{CLUB_LEASE_CITY.toLocaleString()} paper CITY</span>
              <button className="oxs-btn oxs-btn-primary" onClick={buyPaper}>
                Sign the lease
              </button>
            </div>
            <div className="oxs-buy-opt">
              <strong>Buy outright</strong>
              <span className="oxs-muted oxs-small">{CLUB_PRICE_ORBITX} ORBITX (burned)</span>
              <button className="oxs-btn oxs-btn-ghost" disabled={pb.disabled || busy} onClick={buyOrbitx}>
                {busy ? "Burning…" : pb.label}
              </button>
              {pb.hint && <span className="oxs-muted oxs-small">{pb.hint}</span>}
            </div>
          </div>
          {err && <p className="oxs-error">{err}</p>}
          {msg && <p className="oxs-muted oxs-small">{msg}</p>}
        </div>
      </div>
    );
  }

  // --- owned: manager's office -------------------------------------------
  return (
    <div className={`oxs-venue ${embedded ? "oxs-embedded" : ""}`}>
      <div className="oxs-row">
        <h2 className="oxs-title">🌙 {club.name}</h2>
        <span className="oxs-chip">owner ✓</span>
      </div>

      {n.lastReport && (
        <div className="oxs-card oxs-card-live">
          <strong>Last night</strong>
          <p className="oxs-small">
            {n.lastReport.attendees} heads · net +{n.lastReport.netCity.toLocaleString()} CITY ·
            popularity {n.lastReport.popularityDelta >= 0 ? "+" : ""}{n.lastReport.popularityDelta}
          </p>
          <p className="oxs-muted oxs-small">{n.lastReport.verdict}</p>
        </div>
      )}

      <div className="oxs-card">
        <div className="oxs-row">
          <span className="oxs-small">Popularity</span>
          <div className="oxs-pop"><div style={{ width: `${club.popularity}%` }} /></div>
          <strong>{club.popularity}</strong>
        </div>
        <div className="oxs-row">
          <span className="oxs-small">
            Cover: <strong>{club.coverCity}</strong> CITY
          </span>
          <input
            type="range" min={0} max={500} step={5} value={club.coverCity}
            className="oxs-slider"
            onChange={(e) => n.setCover(parseInt(e.target.value, 10))}
            aria-label="Cover charge in paper CITY"
          />
        </div>
        <div className="oxs-row">
          <span className="oxs-small">
            Lifetime: <strong>{club.lifetimeEarningsCity.toLocaleString()}</strong> CITY earned
            {club.lifetimeBurnedOrbitx > 0 && ` · ${club.lifetimeBurnedOrbitx} ORBITX burned`}
          </span>
        </div>
        <div className="oxs-composer-row">
          <input
            className="oxs-input"
            value={newName}
            maxLength={32}
            placeholder="Rename the club…"
            onChange={(e) => setNewName(e.target.value)}
          />
          <button className="oxs-btn oxs-btn-ghost" onClick={() => n.rename(newName)}>Rename</button>
        </div>
      </div>

      <div className="oxs-card">
        <div className="oxs-row">
          <h3 className="oxs-subtitle">🎧 Book tonight's DJ</h3>
          {club.tonight && <span className="oxs-chip">{club.tonight.name} booked ✓</span>}
        </div>
        {DJ_ROSTER.map((d) => {
          const booked = club.tonight?.djId === d.id;
          return (
            <div key={d.id} className="oxs-contact">
              <NpcAvatar initials={d.initials} hue={d.hue} size={32} verified={d.verified} />
              <div>
                <div className="oxs-contact-name">{d.name} <span className="oxs-muted oxs-small">{d.handle}</span></div>
                <div className="oxs-muted oxs-small">
                  {d.genre} · hype {d.hype}/10 · fee {d.feeCity.toLocaleString()} CITY
                </div>
              </div>
              <span className="oxs-row">
                <button
                  className="oxs-btn oxs-btn-ghost oxs-small"
                  onClick={() => togglePreview(d.id, d.genre)}
                >
                  {previewId === d.id ? "⏹" : "▶"}
                </button>
                {!booked && !club.tonight && (
                  <button className="oxs-btn oxs-btn-primary oxs-small" onClick={() => book(d.id, d.name, d.genre, d.feeCity, d.hype)}>
                    Book
                  </button>
                )}
              </span>
            </div>
          );
        })}
        {previewId && <p className="oxs-muted oxs-small">● LIVE preview — synthesized in your browser.</p>}
      </div>

      <div className="oxs-card">
        <h3 className="oxs-subtitle">Tonight's ops</h3>
        <div className="oxs-row">
          <button className="oxs-btn oxs-btn-ghost" onClick={() => { setErr(null); if (!n.hypeFloor()) setErr(`Need ${n.hypePrice.toLocaleString()} CITY to hype the floor.`); }}>
            📣 Hype the floor ({n.hypePrice.toLocaleString()} CITY)
          </button>
          <button className="oxs-btn oxs-btn-primary" disabled={!club.tonight} onClick={runNight}>
            🌃 Run the night
          </button>
        </div>
        {!club.tonight && <p className="oxs-muted oxs-small">Book a DJ first — no headliner, no night.</p>}
        {err && <p className="oxs-error">{err}</p>}
        {msg && <p className="oxs-muted oxs-small">{msg}</p>}
      </div>
    </div>
  );
}

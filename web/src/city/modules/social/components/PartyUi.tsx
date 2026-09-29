/**
 * PartyUi — rooftop parties with LIVE generative DJ audio.
 *
 * Shows live/upcoming rooftop hangouts (hangoutEngine). When a party is
 * live, the player can spin a WebAudio 16-step set (djEngine — zero
 * assets, offline-capable) and pick the genre. Audio requires a user
 * gesture; the start button is the gesture.
 */

import { useEffect, useRef, useState } from "react";
import { DJ_GENRES, genreForDj, startDjSet, type DjGenre, type DjHandle } from "../engine/djEngine";
import { fmtCountdown, getHangoutStatus } from "../engine/hangoutEngine";
import { NPCS, VENUES, venueById } from "../data/socialData";
import type { HangoutEvent } from "../types";

export interface PartyUiProps {
  /** optional pre-selected DJ genre (e.g. from a nightclub booking) */
  defaultGenre?: string;
  embedded?: boolean;
}

export function PartyUi({ defaultGenre, embedded = false }: PartyUiProps) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(iv);
  }, [tick]);

  const status = getHangoutStatus();
  const rooftops = status.live.filter((e) => e.kind === "rooftop");
  const nextRooftop = status.upcoming.find((u) => u.event.kind === "rooftop");

  const [genre, setGenre] = useState<DjGenre>(() =>
    defaultGenre ? genreForDj(defaultGenre) : "synthwave"
  );
  const [volume, setVolume] = useState(0.7);
  const [playing, setPlaying] = useState(false);
  const [audioErr, setAudioErr] = useState<string | null>(null);
  const handleRef = useRef<DjHandle | null>(null);

  useEffect(() => {
    handleRef.current?.setVolume(volume);
  }, [volume]);

  useEffect(
    () => () => {
      handleRef.current?.stop();
      handleRef.current = null;
    },
    []
  );

  const toggle = () => {
    if (playing) {
      handleRef.current?.stop();
      handleRef.current = null;
      setPlaying(false);
      return;
    }
    setAudioErr(null);
    const h = startDjSet(genre, volume);
    if (!h) {
      setAudioErr("Audio unavailable on this device — the party's still on, just quieter.");
      return;
    }
    handleRef.current = h;
    setPlaying(true);
  };

  const djNames = NPCS.filter((n) => n.persona === "dj").map((n) => n.name);

  return (
    <div className={`oxs-venue ${embedded ? "oxs-embedded" : ""}`}>
      <h2 className="oxs-title">🌃 Rooftop Parties</h2>
      {rooftops.length > 0 ? (
        rooftops.map((e: HangoutEvent) => (
          <PartyCard key={e.id} event={e} live />
        ))
      ) : (
        <div className="oxs-card">
          <p className="oxs-muted">No rooftop live right now.</p>
          {nextRooftop && (
            <p>
              Next: <strong>{nextRooftop.event.title}</strong> at{" "}
              {venueById(nextRooftop.event.venueId)?.name} — in{" "}
              <strong>{fmtCountdown(nextRooftop.startsInMs)}</strong>
            </p>
          )}
          <p className="oxs-muted oxs-small">Fridays 21:00 → 02:00 local. Warm up the deck below.</p>
        </div>
      )}

      <div className="oxs-card">
        <h3 className="oxs-subtitle">🎧 Live DJ deck <span className="oxs-chip">generative · no downloads</span></h3>
        <div className="oxs-row oxs-wrap">
          {DJ_GENRES.map((g) => (
            <button
              key={g}
              className={`oxs-btn ${genre === g ? "oxs-btn-primary" : "oxs-btn-ghost"}`}
              onClick={() => {
                setGenre(g);
                if (playing) {
                  handleRef.current?.stop();
                  const h = startDjSet(g, volume);
                  handleRef.current = h;
                  if (!h) setPlaying(false);
                }
              }}
            >
              {g}
            </button>
          ))}
        </div>
        <div className="oxs-row">
          <button className={`oxs-btn ${playing ? "oxs-btn-danger" : "oxs-btn-primary"} oxs-btn-lg`} onClick={toggle}>
            {playing ? "⏹ Stop the set" : "▶ Start live set"}
          </button>
          <label className="oxs-small oxs-muted">
            Vol{" "}
            <input
              type="range" min={0} max={1} step={0.05} value={volume}
              className="oxs-slider"
              onChange={(e) => setVolume(parseFloat(e.target.value))}
            />
          </label>
        </div>
        {playing && <p className="oxs-muted oxs-small">● LIVE — {genre} · WebAudio 16-step sequencer · {djNames[0]}'s deck</p>}
        {audioErr && <p className="oxs-error">{audioErr}</p>}
        <p className="oxs-muted oxs-small">
          Resident DJs: {djNames.join(", ")}. Sets are synthesized live in your browser — works
          offline, phone-friendly (keep the tab awake).
        </p>
      </div>
    </div>
  );
}

function PartyCard({ event, live }: { event: HangoutEvent; live: boolean }) {
  const venue = venueById(event.venueId) ?? VENUES.find((v) => v.kind === "rooftop");
  return (
    <div className="oxs-card oxs-card-live">
      <div className="oxs-row">
        {live && <span className="oxs-live-dot" />}
        <strong>{event.title}</strong>
      </div>
      <p className="oxs-muted oxs-small">
        {venue?.name} · {venue?.district} · {event.attendees} on the deck
      </p>
      <p className="oxs-small">{venue?.blurb}</p>
    </div>
  );
}

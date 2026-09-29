/**
 * BeachUi — Bonfire Point beach parties + firm recruiting.
 *
 * Live/upcoming bonfire schedule (hangoutEngine) plus the recruit board:
 * hire NPC crew with paper CITY (signing bonus), claim daily wages.
 * Recruit earnings are paper gameplay money — never real.
 */

import { useEffect, useState } from "react";
import { fmtCountdown, getHangoutStatus } from "../engine/hangoutEngine";
import { useRecruits } from "../hooks/useRecruits";
import { paperLedger } from "../engine/paperLedger";
import { venueById } from "../data/socialData";
import type { HangoutEvent } from "../types";
import { NpcAvatar } from "./NpcAvatar";
import { npcById } from "../data/socialData";

export interface BeachUiProps {
  embedded?: boolean;
}

export function BeachUi({ embedded = false }: BeachUiProps) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(iv);
  }, [tick]);

  const status = getHangoutStatus();
  const beachLive = status.live.filter((e) => e.kind === "beach");
  const nextBeach = status.upcoming.find((u) => u.event.kind === "beach");
  const r = useRecruits();
  const [balance, setBalance] = useState(paperLedger.balance);
  useEffect(() => paperLedger.subscribe(setBalance), []);
  const [note, setNote] = useState<string | null>(null);

  return (
    <div className={`oxs-venue ${embedded ? "oxs-embedded" : ""}`}>
      <h2 className="oxs-title">🔥 Beach Bonfires</h2>
      {beachLive.length > 0 ? (
        beachLive.map((e: HangoutEvent) => (
          <div key={e.id} className="oxs-card oxs-card-live">
            <div className="oxs-row">
              <span className="oxs-live-dot" />
              <strong>{e.title}</strong>
            </div>
            <p className="oxs-muted oxs-small">
              {venueById(e.venueId)?.name} · {e.attendees} around the fire
            </p>
            <p className="oxs-small">
              Driftwood fires, acoustic-to-electronic sets, and the city's best
              networking — recruiters welcome.
            </p>
          </div>
        ))
      ) : (
        <div className="oxs-card">
          <p className="oxs-muted">The point is quiet right now.</p>
          {nextBeach && (
            <p>
              Next bonfire: <strong>{nextBeach.event.title}</strong> — in{" "}
              <strong>{fmtCountdown(nextBeach.startsInMs)}</strong>
            </p>
          )}
          <p className="oxs-muted oxs-small">Saturdays 19:00 → 23:00 local at Bonfire Point.</p>
        </div>
      )}

      <div className="oxs-card">
        <div className="oxs-row">
          <h3 className="oxs-subtitle">🤝 Firm recruiting</h3>
          <span className="oxs-chip">{balance.toLocaleString()} CITY</span>
        </div>
        <p className="oxs-muted oxs-small">
          Hire crew at the bonfire. Signing bonus {r.signingBonus} CITY each; the crew
          earns daily paper wages you can claim. Paper money only.
        </p>
        {r.recruits.map((rec) => {
          const npc = npcById(rec.npcId);
          return (
            <div key={rec.npcId} className="oxs-contact">
              <NpcAvatar initials={npc?.initials ?? "??"} hue={npc?.hue ?? 0} size={32} />
              <div>
                <div className="oxs-contact-name">
                  {rec.name} <span className="oxs-muted oxs-small">{rec.handle}</span>
                </div>
                <div className="oxs-muted oxs-small">
                  {rec.role} · skill {rec.skill}/10 · {rec.wageCity} CITY/day
                </div>
              </div>
              {rec.hired ? (
                <span className="oxs-chip">hired ✓</span>
              ) : (
                <button
                  className="oxs-btn oxs-btn-primary"
                  onClick={() => {
                    const ok = r.hire(rec.npcId);
                    setNote(ok ? `${rec.name} joined your firm.` : "Not enough CITY — earn more around the city.");
                  }}
                >
                  Hire
                </button>
              )}
            </div>
          );
        })}
        <div className="oxs-row">
          <span className="oxs-small">
            Crew wages: <strong>{r.dailyWage}</strong> CITY/day
          </span>
          <button
            className="oxs-btn oxs-btn-primary"
            disabled={!r.canClaim}
            onClick={() => {
              const got = r.claimWages();
              setNote(got > 0 ? `Claimed ${got} CITY in crew wages.` : "Nothing to claim yet — check back in ~20h.");
            }}
          >
            Claim wages
          </button>
        </div>
        {note && <p className="oxs-muted oxs-small">{note}</p>}
      </div>
    </div>
  );
}

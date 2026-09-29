/**
 * CarMeetUi — weekly docks car meet (Saturdays 21:00 → 01:00 local,
 * East Docks).
 *
 * Entry: paper-CITY fee, one per player per week, picked category.
 * The prize pool is the entry fees; judging is deterministic per meet id
 * (carMeetEngine) against NPC regulars — every client agrees on the
 * winner. Judging is exposed on the UI for the demo loop; in the live
 * game it fires when the window closes.
 */

import { useEffect, useState } from "react";
import { useCarMeet } from "../hooks/useCarMeet";
import { useHangouts } from "../hooks/useHangouts";
import { CAR_MEET_CATEGORIES, CAR_MEET_ENTRY_FEE_CITY } from "../engine/carMeetEngine";
import { paperLedger } from "../engine/paperLedger";
import { NpcAvatar } from "./NpcAvatar";

export interface CarMeetUiProps {
  playerName: string;
  playerHandle: string;
  embedded?: boolean;
}

const HUES: Record<string, number> = { "Turbo Tess": 0, "Vice Vic": 120, "Byte Beat": 340, "Dex Degen": 150, "Chart Chef": 60 };

export function CarMeetUi({ playerName, playerHandle, embedded = false }: CarMeetUiProps) {
  const m = useCarMeet(playerName, playerHandle);
  const { carMeet, fmtCountdown } = useHangouts();
  const [car, setCar] = useState("");
  const [category, setCategory] = useState<string>(CAR_MEET_CATEGORIES[0]);
  const [note, setNote] = useState<string | null>(null);
  const [balance, setBalance] = useState(paperLedger.balance);
  useEffect(() => paperLedger.subscribe(setBalance), []);

  const enter = () => {
    setNote(null);
    if (!car.trim()) {
      setNote("Name your ride first.");
      return;
    }
    const ok = m.enter(car, category);
    setNote(
      ok
        ? `${car.trim()} is in the ${category} class. Good luck.`
        : `Entry failed — ${m.myEntry ? "one entry per player per week." : `need ${CAR_MEET_ENTRY_FEE_CITY} CITY (you hold ${balance.toLocaleString()}).`}`
    );
    if (ok) setCar("");
  };

  const judged = m.judged;
  const pool = (m.entries.length || 5) * CAR_MEET_ENTRY_FEE_CITY;

  return (
    <div className={`oxs-venue ${embedded ? "oxs-embedded" : ""}`}>
      <h2 className="oxs-title">🏁 East Docks Car Meet</h2>

      <div className="oxs-card">
        <div className="oxs-row">
          {carMeet.live ? (
            <span className="oxs-row"><span className="oxs-live-dot" /><strong>LIVE now</strong></span>
          ) : (
            <span className="oxs-chip">next in {fmtCountdown(carMeet.startsAt - Date.now())}</span>
          )}
          <span className="oxs-muted oxs-small">Sat 21:00 → 01:00 local · {m.meetId}</span>
        </div>
        <p className="oxs-muted oxs-small">
          Entry {CAR_MEET_ENTRY_FEE_CITY} CITY · prize pool {pool.toLocaleString()} CITY (all entries) ·
          split 60 / 25 / 15 across the podium. Judging is deterministic — same meet, same scores, every client.
        </p>
      </div>

      {!judged ? (
        <div className="oxs-card">
          <h3 className="oxs-subtitle">Enter your car</h3>
          {!m.myEntry ? (
            <div className="oxs-enter-row">
              <input
                className="oxs-input"
                value={car}
                maxLength={40}
                placeholder="e.g. Slammed Supra 'Paperchaser'"
                onChange={(e) => setCar(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && enter()}
              />
              <select
                className="oxs-input oxs-select"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                aria-label="Category"
              >
                {CAR_MEET_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <button className="oxs-btn oxs-btn-primary" onClick={enter}>
                Enter ({CAR_MEET_ENTRY_FEE_CITY} CITY)
              </button>
            </div>
          ) : (
            <p>
              <strong>{m.myEntry.car}</strong> is entered in the {("category" in m.myEntry && (m.myEntry as { category?: string }).category) || "Speed"} class.{" "}
              <span className="oxs-chip">locked in ✓</span>
            </p>
          )}
          {note && <p className="oxs-muted oxs-small">{note}</p>}
          <div className="oxs-row">
            <span className="oxs-small">Field so far: <strong>{m.entries.length}</strong> entered</span>
            <button
              className="oxs-btn oxs-btn-ghost"
              onClick={() => {
                const j = m.judge();
                const rank = j.findIndex((e) => !e.npc) + 1;
                setNote(rank > 0 ? `Judged! You placed #${rank}.` : "Judged! The NPC regulars took the podium.");
              }}
            >
              Judge the meet
            </button>
          </div>
          <p className="oxs-muted oxs-small">Judging fires when the window closes; the button is here for the demo loop.</p>
        </div>
      ) : (
        <div className="oxs-card">
          <h3 className="oxs-subtitle">🏆 Results — {m.meetId}</h3>
          {judged.map((e, i) => (
            <div key={e.id} className={`oxs-contact ${!e.npc ? "oxs-me" : ""}`}>
              <span className="oxs-rank">#{i + 1}</span>
              <NpcAvatar initials={e.owner.slice(0, 2).toUpperCase()} hue={HUES[e.owner] ?? 265} size={28} />
              <div>
                <div className="oxs-contact-name">{e.car}</div>
                <div className="oxs-muted oxs-small">
                  {e.ownerHandle} · {e.category} · score {e.score}
                </div>
              </div>
              {e.prizeCity > 0 && <span className="oxs-chip oxs-prize">+{e.prizeCity} CITY</span>}
            </div>
          ))}
          {note && <p className="oxs-muted oxs-small">{note}</p>}
        </div>
      )}
    </div>
  );
}

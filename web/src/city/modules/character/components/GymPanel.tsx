/**
 * IRON HOUSE Gym — train strength / stamina / agility for paper CITY.
 * Stats drive real gameplay effects (see getDerivedEffects); outfit buffs
 * stack on top. Sessions cost paper CITY, never ORBITX.
 */
import { useEffect, useState } from "react";
import { statProgressPct, useCharacter } from "../characterStore";
import { GYM_EXERCISES, STORES } from "../data";
import type { TrainableStat } from "../types";

const STAT_META: { id: TrainableStat; name: string; icon: string }[] = [
  { id: "strength", name: "Strength", icon: "💪" },
  { id: "stamina", name: "Stamina", icon: "🫁" },
  { id: "agility", name: "Agility", icon: "⚡" },
];

function useNow(intervalMs: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

export function GymPanel() {
  const { profile, buffs, effects, train } = useCharacter();
  const [msg, setMsg] = useState("");
  const now = useNow(1000);
  const store = STORES.find((s) => s.kind === "gym");

  return (
    <div>
      <div className="ox-ch-shophead">
        <h3>🏋️ {store?.name ?? "IRON HOUSE Gym"}</h3>
        <span className="ox-ch-balance">{profile.cityBalance} CITY</span>
      </div>
      <p style={{ fontSize: 12, color: "#8a9aa8", margin: "0 0 12px" }}>
        Train for paper CITY. 100 progress points = +1 stat point (cap 100). Outfit buffs stack on top.
      </p>

      <div className="ox-ch-section">
        <div className="ox-ch-label">Your stats</div>
        {STAT_META.map((s) => {
          const val = profile.stats[s.id];
          const buff = s.id === "strength" ? buffs.strength ?? 0
            : s.id === "stamina" ? buffs.stamina ?? 0
            : Math.round((buffs.speed ?? 0) * 0.5);
          const pct = statProgressPct(profile, s.id);
          return (
            <div key={s.id} className="ox-ch-stat">
              <div className="ox-ch-stat-head">
                <span>{s.icon} {s.name} <b>{val}</b>{buff > 0 && <span className="ox-ch-buff"> +{buff} gear</span>}</span>
                <span className="ox-ch-cool">{pct}% → next</span>
              </div>
              <div className="ox-ch-bar"><div style={{ width: `${val}%` }} /></div>
              <div className="ox-ch-bar"><div className="xp" style={{ width: `${pct}%` }} /></div>
            </div>
          );
        })}
        <div className="ox-ch-fx">
          <div>Sprint speed <b>×{effects.sprintSpeedMult.toFixed(2)}</b></div>
          <div>Sprint time <b>{effects.sprintStaminaSec.toFixed(0)}s</b></div>
          <div>Melee <b>×{effects.meleeDamageMult.toFixed(2)}</b></div>
          <div>Accel <b>×{effects.accelMult.toFixed(2)}</b></div>
        </div>
      </div>

      <div className="ox-ch-section">
        <div className="ox-ch-label">Train (paper CITY)</div>
        <div className="ox-ch-cards">
          {GYM_EXERCISES.map((ex) => {
            const last = profile.lastTrained[ex.id] ?? 0;
            const waitMs = ex.cooldownMs - (now - last);
            const cooling = waitMs > 0;
            const afford = profile.cityBalance >= ex.cityCost;
            return (
              <div key={ex.id} className="ox-ch-card">
                <h4>{ex.name}</h4>
                <p>{ex.blurb}</p>
                <div className="ox-ch-price">🪙 {ex.cityCost} CITY · +{ex.gain} {ex.stat}</div>
                {cooling && <div className="ox-ch-cool">Rest {Math.ceil(waitMs / 1000)}s</div>}
                <button
                  className="ox-ch-btn"
                  disabled={cooling || !afford}
                  onClick={() => setMsg(train(ex.id).message)}
                >
                  {cooling ? "Resting…" : afford ? "Train" : "Need CITY"}
                </button>
              </div>
            );
          })}
        </div>
        {msg && <div className="ox-ch-toast" style={{ position: "static", transform: "none", margin: "10px auto 0", display: "table" }}>{msg}</div>}
      </div>
    </div>
  );
}

/**
 * Companion bot panel — name your little trade-bot after your favorite
 * OrbitX agent, pick its glow, toggle it on/off.
 * The 3D drone itself is `companion/companionBot.ts` (wired by the integrator).
 */
import { useState } from "react";
import { useCharacter } from "../characterStore";
import { COMPANION_COLORS } from "../companion/companionBot";
import { COMPANION_NAME_PRESETS } from "../data";

const hex = (n: number) => `#${n.toString(16).padStart(6, "0")}`;

export function CompanionPanel() {
  const { profile, renameCompanion, setCompanionColor, setCompanionEnabled } = useCharacter();
  const [name, setName] = useState(profile.companionName);

  return (
    <div>
      <div className="ox-ch-shophead">
        <h3>🤖 Trade-bot companion</h3>
        <button
          className={`ox-ch-btn ${profile.companionEnabled ? "ghost" : ""}`}
          onClick={() => setCompanionEnabled(!profile.companionEnabled)}
        >
          {profile.companionEnabled ? "Disable" : "Enable"}
        </button>
      </div>
      <p style={{ fontSize: 12, color: "#8a9aa8", margin: "0 0 12px" }}>
        Your pocket agent. It hovers behind you everywhere in the city — name it
        after your favorite OrbitX agent and it answers to that name in your head.
      </p>

      <div className="ox-ch-section">
        <div className="ox-ch-label">Bot name</div>
        <input
          className="ox-ch-input"
          value={name}
          maxLength={18}
          onChange={(e) => { setName(e.target.value); renameCompanion(e.target.value); }}
          placeholder="Orbit"
        />
        <div className="ox-ch-row" style={{ marginTop: 8 }}>
          {COMPANION_NAME_PRESETS.map((p) => (
            <button
              key={p}
              className={`ox-ch-pill ${profile.companionName === p ? "on" : ""}`}
              onClick={() => { setName(p); renameCompanion(p); }}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <div className="ox-ch-section">
        <div className="ox-ch-label">Glow color</div>
        <div className="ox-ch-row">
          {COMPANION_COLORS.map((c) => (
            <button
              key={c.hex}
              className={`ox-ch-swatch ${profile.companionColor === c.hex ? "on" : ""}`}
              style={{ background: hex(c.hex) }}
              title={c.name}
              aria-label={c.name}
              onClick={() => setCompanionColor(c.hex)}
            />
          ))}
        </div>
      </div>

      <div className="ox-ch-notice" style={{ background: "#0b1420", borderColor: "#1e2a33", color: "#8a9aa8" }}>
        Cosmetic only — <b>{profile.companionName || "Orbit"}</b> doesn't trade for
        you and never touches funds. Pure vibes, zero custody.
      </div>
    </div>
  );
}

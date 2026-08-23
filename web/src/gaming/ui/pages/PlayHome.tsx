import { Link } from "react-router-dom";
import { ORBITX_PREDICTIONS_URL } from "../../../../shared/orbitx-predictions.js";
import { useGameProfile } from "../../state/useGameProfile";
import { getClass } from "../../catalogs/classesItems";
import { bumpMission } from "../../state/GameProfileStore";
import { useEffect } from "react";

export function PlayHomePage() {
  const { profile, xp, stats, updateProfile } = useGameProfile();
  const cls = getClass(profile.character.classId);

  useEffect(() => {
    updateProfile((p) => bumpMission(p, "daily_login", "open_play", 1));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ display: "grid", gap: "1rem" }}>
      <section>
        <div className="gx-kicker">Gaming ecosystem</div>
        <h1 className="gx-title" style={{ fontSize: "clamp(1.7rem, 5vw, 2.6rem)" }}>
          OrbitX Play Studio
        </h1>
        <p className="gx-lead">
          AAA-style character loadouts, progression loops, multiplayer lobbies, and HUD systems — built for OrbitX City and beyond.
        </p>
      </section>

      <section className="gx-panel" style={{ display: "grid", gap: "0.75rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
          <div>
            <div className="gx-kicker">{profile.progression.title}</div>
            <div className="gx-title" style={{ fontSize: "1.25rem" }}>
              @{profile.character.name} · {cls?.name}
            </div>
          </div>
          <div className="gx-badge">LVL {xp.level}</div>
        </div>
        <div className="gx-stat">
          <span>XP</span>
          <span>
            {xp.into}/{xp.need}
          </span>
        </div>
        <div className="gx-bar" style={{ ["--pct" as string]: `${xp.pct}%` }}>
          <i />
        </div>
        <div className="gx-grid gx-grid-4">
          {Object.entries(stats).map(([k, v]) => (
            <div key={k} className="gx-card" style={{ cursor: "default" }}>
              <strong>{k}</strong>
              <span>{v}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="gx-grid gx-grid-3">
        {[
          { to: "/play/character", t: "Character", d: "Classes, cosmetics, equipment" },
          { to: "/play/progression", t: "Progression", d: "XP, missions, achievements" },
          { to: "/play/inventory", t: "Economy", d: "Shards, items, ownership" },
          { to: "/play/multiplayer", t: "Multiplayer", d: "Lobbies, party, voice, chat" },
          { to: "/play/hud", t: "HUD Lab", d: "Health, energy, minimap, alerts" },
          { to: "/play/pass", t: "Battle Pass", d: "Season track & rewards" },
        ].map((c) => (
          <Link key={c.to} to={c.to} className="gx-card">
            <strong>{c.t}</strong>
            <span>{c.d}</span>
          </Link>
        ))}
      </section>

      <section className="gx-panel">
        <div className="gx-kicker">Drop in</div>
        <p className="gx-lead" style={{ marginBottom: "0.75rem" }}>
          Carry this loadout into OrbitX City. Soft-currency shards and cosmetics stay in the Play profile (local for now).
        </p>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <Link to="/Orbitxcity" className="gx-btn gx-btn-primary">
            Enter OrbitX City
          </Link>
          <a href={ORBITX_PREDICTIONS_URL} target="_blank" rel="noopener noreferrer" className="gx-btn gx-btn-ghost">
            Predictions
          </a>
          <Link to="/games" className="gx-btn gx-btn-ghost">
            Partner games
          </Link>
        </div>
      </section>
    </div>
  );
}

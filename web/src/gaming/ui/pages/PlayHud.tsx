import { Link } from "react-router-dom";
import { useGameProfile } from "../../state/useGameProfile";
import { markNotificationsRead } from "../../state/GameProfileStore";
import { useState } from "react";

export function PlayHudPage() {
  const { hud, profile, notifications } = useGameProfile();
  const [showHud, setShowHud] = useState(true);
  const hpPct = Math.round((hud.health / hud.maxHealth) * 100);
  const enPct = Math.round((hud.energy / hud.maxEnergy) * 100);

  return (
    <div style={{ display: "grid", gap: "1rem" }}>
      <div>
        <div className="gx-kicker">HUD system</div>
        <h1 className="gx-title" style={{ fontSize: "1.7rem" }}>
          Combat & status chrome
        </h1>
        <p className="gx-lead">Health, energy, inventory peek, minimap frame, notifications, and game menus.</p>
      </div>

      <div className="gx-panel" style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        <button type="button" className="gx-btn gx-btn-primary" onClick={() => setShowHud((v) => !v)}>
          {showHud ? "Hide overlay" : "Show overlay"}
        </button>
        <button type="button" className="gx-btn" onClick={() => markNotificationsRead()}>
          Clear notifications
        </button>
        <Link to="/Orbitxcity" className="gx-btn gx-btn-ghost">
          Test in City
        </Link>
      </div>

      {showHud && (
        <div className="gx-hud" aria-hidden>
          <div className="gx-hud-panel gx-hud-tl">
            <div className="gx-kicker">@{profile.character.name}</div>
            <div className="gx-stat"><span>HP</span><span>{hud.health}/{hud.maxHealth}</span></div>
            <div className="gx-bar gx-hp" style={{ ["--pct" as string]: `${hpPct}%` }}><i /></div>
            <div className="gx-stat" style={{ marginTop: 6 }}><span>EN</span><span>{hud.energy}/{hud.maxEnergy}</span></div>
            <div className="gx-bar gx-en" style={{ ["--pct" as string]: `${enPct}%` }}><i /></div>
          </div>

          <div className="gx-hud-panel gx-hud-tr">
            <div className="gx-kicker">Status</div>
            <div className="gx-badge">{hud.status}</div>
            <div style={{ marginTop: 8, fontFamily: "var(--gx-mono)", fontSize: "0.7rem", color: "var(--gx-muted)" }}>
              LVL {hud.level} · {hud.shards} shards
            </div>
          </div>

          <div className="gx-hud-panel gx-hud-bl" style={{ width: 160 }}>
            <div className="gx-kicker">Minimap</div>
            <div style={{
              marginTop: 6,
              height: 110,
              borderRadius: 10,
              border: "1px solid var(--gx-line)",
              background:
                "radial-gradient(circle at 50% 60%, rgba(23,255,77,0.35), transparent 18%), repeating-linear-gradient(0deg, transparent, transparent 9px, rgba(23,255,77,0.08) 10px), #071018",
              position: "relative",
            }}>
              <div style={{ position: "absolute", left: "50%", top: "60%", width: 6, height: 6, borderRadius: 99, background: "#fff", transform: "translate(-50%,-50%)", boxShadow: "0 0 8px #17ff4d" }} />
            </div>
          </div>

          <div className="gx-hud-panel gx-hud-br" style={{ maxWidth: 240 }}>
            <div className="gx-kicker">Alerts</div>
            <div className="gx-chat" style={{ marginTop: 6, maxHeight: 140 }}>
              {(notifications.filter((n) => !n.read).length ? notifications.filter((n) => !n.read) : [{ id: "idle", title: "Systems nominal", body: "No new alerts", kind: "info" as const, at: Date.now() }]).slice(0, 4).map((n) => (
                <div key={n.id}><b>{n.title}</b> — {n.body}</div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="gx-panel">
        <div className="gx-kicker">Game menus</div>
        <div className="gx-grid gx-grid-3" style={{ marginTop: "0.65rem" }}>
          {[
            { t: "Inventory", d: "Quick bag", to: "/play/inventory" },
            { t: "Map", d: "Fast travel / City", to: "/Orbitxcity" },
            { t: "Party", d: "Social panel", to: "/play/multiplayer" },
            { t: "Settings", d: "Quality & controls", to: "/settings" },
            { t: "Leave match", d: "Return to Play home", to: "/play" },
            { t: "Rewards", d: "Battle pass track", to: "/play/pass" },
          ].map((m) => (
            <Link key={m.t} to={m.to} className="gx-card">
              <strong>{m.t}</strong>
              <span>{m.d}</span>
            </Link>
          ))}
        </div>
      </div>

      <div className="gx-panel">
        <div className="gx-kicker">Inventory peek</div>
        <div className="gx-nav" style={{ marginTop: "0.55rem" }}>
          {profile.inventory.slice(0, 8).map((s) => (
            <span key={s.itemId} className="gx-badge">{s.itemId} ×{s.qty}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

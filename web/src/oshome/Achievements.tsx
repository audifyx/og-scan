import { useEffect, useState } from "react";
import {
  ACHIEVEMENTS,
  getUnlockedAchievements,
  totalPoints,
  type AchievementDef,
} from "../themes/achievements";
import "./oshome.css";

/**
 * AchievementHost — Xbox-style unlock pops (idea 28), mounted once in
 * the OS home. Listens for "orbitx:achievement" from anywhere in the
 * platform. AchievementShowcase — profile-ready grid (idea 29).
 */

export function AchievementHost() {
  const [queue, setQueue] = useState<AchievementDef[]>([]);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const fn = (e: Event) => {
      const def = (e as CustomEvent<AchievementDef>).detail;
      if (def) setQueue((q) => [...q, def]);
    };
    window.addEventListener("orbitx:achievement", fn);
    return () => window.removeEventListener("orbitx:achievement", fn);
  }, []);

  useEffect(() => {
    if (queue.length === 0) return;
    const t1 = setTimeout(() => setLeaving(true), 3400);
    const t2 = setTimeout(() => {
      setQueue((q) => q.slice(1));
      setLeaving(false);
    }, 3800);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [queue]);

  const cur = queue[0];
  if (!cur) return null;
  return (
    <div className={`osh-ach-pop${leaving ? " out" : ""}`} role="status" aria-live="polite">
      <span className="osh-ach-glyph">{cur.glyph}</span>
      <span className="osh-ach-meta">
        <b>Achievement unlocked</b>
        <span>
          {cur.name} — {cur.blurb}
        </span>
      </span>
      <span className="osh-ach-pts">+{cur.points}</span>
    </div>
  );
}

const RARITY_COLOR: Record<AchievementDef["rarity"], string> = {
  common: "#8b98ab",
  rare: "#3de7ff",
  epic: "#a78bfa",
  legendary: "#f5c542",
};

/**
 * AchievementShowcase — mount on the profile page (or anywhere) to show
 * unlocked achievements + total gamer score. Pure read of local state.
 */
export function AchievementShowcase({ compact = false }: { compact?: boolean }) {
  const [unlocked, setUnlocked] = useState(getUnlockedAchievements);
  useEffect(() => {
    const fn = () => setUnlocked(getUnlockedAchievements());
    window.addEventListener("orbitx:achievement", fn);
    return () => window.removeEventListener("orbitx:achievement", fn);
  }, []);
  const pts = totalPoints();

  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 10 }}>
        <h3 style={{ margin: 0, fontSize: 15 }}>Achievements</h3>
        <span style={{ fontSize: 12, color: "var(--dt-muted)" }}>
          {unlocked.length}/{ACHIEVEMENTS.length} · {pts} pts
        </span>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: compact ? "repeat(auto-fill, minmax(120px, 1fr))" : "repeat(auto-fill, minmax(150px, 1fr))",
          gap: 8,
        }}
      >
        {ACHIEVEMENTS.map((a) => {
          const got = unlocked.some((u) => u.id === a.id);
          return (
            <div
              key={a.id}
              title={a.blurb}
              style={{
                border: `1px solid ${got ? RARITY_COLOR[a.rarity] : "var(--dt-line)"}`,
                borderRadius: 12,
                padding: "10px 12px",
                opacity: got ? 1 : 0.38,
                background: "var(--dt-surface)",
                filter: got ? "none" : "grayscale(1)",
              }}
            >
              <div style={{ fontSize: 22 }}>{a.glyph}</div>
              <div style={{ fontSize: 12.5, fontWeight: 700, marginTop: 4 }}>{a.name}</div>
              {!compact && (
                <div style={{ fontSize: 11, color: "var(--dt-muted)", marginTop: 2 }}>{a.blurb}</div>
              )}
              <div
                style={{
                  fontSize: 10, fontWeight: 800, letterSpacing: "0.12em",
                  color: RARITY_COLOR[a.rarity], marginTop: 4, textTransform: "uppercase",
                }}
              >
                {a.rarity} · {a.points}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import { Loader2, Volume2 } from "lucide-react";
import { cityAudio } from "@/lib/orbitxcity/cityAudio";

export interface LoadingScreenProps {
  /** Real preload progress 0..1; null/undefined falls back to a staged fake-but-fast bar. */
  progress?: number | null;
  /** Current load step label ("Loading districts…"). */
  status?: string;
  /** True when the world is ready and the player may enter. */
  ready: boolean;
  /** Called when the player taps Enter City. Coordinator navigates to the world. */
  onEnter: () => void;
}

const TIPS = [
  "WASD to move · E to interact · Shift to sprint · Space to jump.",
  "Mute everything anytime from Settings — master mute is one tap.",
  "Mobile? Flip to Lite quality + touch controls for the smoothest streets.",
  "Theme music fades out when you enter the city and a soft street bed fades in.",
  "Enter a car with E and the touch controls swap to steering + pedals.",
];

const STAGES = ["Booting neon grid", "Loading districts", "Placing traffic", "Tuning audio", "Syncing lobby"];

/**
 * LoadingScreen — shown while the world (assets/preload) loads.
 * When real progress is supplied it drives the bar; otherwise a staged
 * fake-but-fast animation runs. The Enter City button unlocks the WebAudio
 * context on click (browser autoplay policy) before handing off to onEnter.
 */
export function LoadingScreen({ progress, status, ready, onEnter }: LoadingScreenProps) {
  const [fake, setFake] = useState(0);
  const [tip, setTip] = useState(0);
  const [entering, setEntering] = useState(false);
  const tipTimer = useRef<number | null>(null);

  // Staged fake progress: climbs fast to ~0.9, then waits for `ready`.
  useEffect(() => {
    if (progress != null || ready) return;
    const id = window.setInterval(() => {
      setFake((f) => {
        if (f >= 0.92) return f;
        return Math.min(0.92, f + 0.02 + Math.random() * 0.05);
      });
    }, 120);
    return () => window.clearInterval(id);
  }, [progress, ready]);

  useEffect(() => {
    tipTimer.current = window.setInterval(() => setTip((t) => (t + 1) % TIPS.length), 4200);
    return () => {
      if (tipTimer.current != null) window.clearInterval(tipTimer.current);
    };
  }, []);

  const shown = progress != null ? Math.min(1, Math.max(0, progress)) : ready ? 1 : fake;
  const stageIdx = Math.min(STAGES.length - 1, Math.floor(shown * STAGES.length));
  const label = status ?? STAGES[stageIdx] ?? "Loading";

  const handleEnter = async () => {
    if (!ready || entering) return;
    setEntering(true);
    try {
      await cityAudio.unlock();
      cityAudio.play("enter");
    } finally {
      onEnter();
    }
  };

  return (
    <div className="oxc-loading" role="status" aria-label="Loading OrbitX City" style={wrapStyle}>
      <style>{`@keyframes oxc-load-spin { to { transform: rotate(360deg); } } .oxc-load-spin { animation: oxc-load-spin 0.9s linear infinite; }`}</style>
      <div style={bgStyle} aria-hidden />
      <div style={cardStyle}>
        <div style={kickerStyle}>OrbitX World · Phase 1</div>
        <h1 style={brandStyle}>
          OrbitX<span style={{ color: "var(--oxc-cyan, #3de7ff)" }}>City</span>
        </h1>

        <div style={barWrapStyle}>
          <div style={{ ...barFillStyle, width: `${Math.round(shown * 100)}%` }} />
        </div>
        <div style={statusRowStyle}>
          <span style={statusStyle}>
            {ready ? "City online" : label}
            {!ready && "…"}
          </span>
          <span style={pctStyle}>{Math.round(shown * 100)}%</span>
        </div>

        <p style={tipStyle}>
          <span style={tipKickerStyle}>TIP</span> {TIPS[tip]}
        </p>

        {ready ? (
          <button type="button" onClick={handleEnter} disabled={entering} style={enterBtnStyle}>
            {entering ? (
              <>
                <Loader2 style={{ width: 18, height: 18 }} className="oxc-load-spin" /> Entering…
              </>
            ) : (
              <>
                <Volume2 style={{ width: 18, height: 18 }} /> Enter City
              </>
            )}
          </button>
        ) : (
          <div style={waitStyle}>
            <Loader2 style={{ width: 16, height: 16 }} className="oxc-load-spin" />
            <span>Warming up the block…</span>
          </div>
        )}
      </div>
    </div>
  );
}

const wrapStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 60,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "#050806",
  color: "var(--oxc-text, #eaf6ee)",
  fontFamily: "inherit",
  overflow: "hidden",
};

const bgStyle: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  background:
    "radial-gradient(60% 45% at 50% 20%, rgba(61,231,255,0.12), transparent 70%), radial-gradient(50% 40% at 80% 90%, rgba(23,255,77,0.10), transparent 70%), #050806",
};

const cardStyle: React.CSSProperties = {
  position: "relative",
  width: "min(420px, 88vw)",
  textAlign: "center",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "0.9rem",
};

const kickerStyle: React.CSSProperties = {
  fontSize: 10,
  letterSpacing: "0.3em",
  textTransform: "uppercase",
  color: "var(--oxc-muted, #8aa392)",
};

const brandStyle: React.CSSProperties = {
  margin: 0,
  fontSize: "clamp(2.4rem, 8vw, 3.6rem)",
  fontWeight: 900,
  letterSpacing: "-0.02em",
  color: "#fff",
};

const barWrapStyle: React.CSSProperties = {
  width: "100%",
  height: 10,
  borderRadius: 999,
  background: "rgba(255,255,255,0.08)",
  border: "1px solid rgba(255,255,255,0.12)",
  overflow: "hidden",
};

const barFillStyle: React.CSSProperties = {
  height: "100%",
  borderRadius: 999,
  background: "linear-gradient(90deg, var(--oxc-lime, #17ff4d), var(--oxc-cyan, #3de7ff))",
  boxShadow: "0 0 18px rgba(61,231,255,0.45)",
  transition: "width 0.18s linear",
};

const statusRowStyle: React.CSSProperties = {
  width: "100%",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  fontSize: 12,
};

const statusStyle: React.CSSProperties = { color: "var(--oxc-muted, #8aa392)" };
const pctStyle: React.CSSProperties = { fontWeight: 800, color: "var(--oxc-cyan, #3de7ff)" };

const tipStyle: React.CSSProperties = {
  margin: "0.2rem 0 0",
  fontSize: 13,
  lineHeight: 1.5,
  color: "var(--oxc-text, #eaf6ee)",
  minHeight: 44,
  opacity: 0.92,
};

const tipKickerStyle: React.CSSProperties = {
  display: "inline-block",
  marginRight: 6,
  fontSize: 9,
  fontWeight: 900,
  letterSpacing: "0.2em",
  color: "var(--oxc-lime, #17ff4d)",
};

const enterBtnStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  marginTop: 4,
  padding: "0.85rem 2.2rem",
  borderRadius: 999,
  border: "none",
  cursor: "pointer",
  fontSize: 15,
  fontWeight: 900,
  letterSpacing: "0.06em",
  color: "#04140a",
  background: "linear-gradient(90deg, var(--oxc-lime, #17ff4d), var(--oxc-cyan, #3de7ff))",
  boxShadow: "0 0 26px rgba(23,255,77,0.35)",
};

const waitStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  fontSize: 13,
  color: "var(--oxc-muted, #8aa392)",
};

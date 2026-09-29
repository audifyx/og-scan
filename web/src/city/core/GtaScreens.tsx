import { Play, Pause, Home, Car, PersonStanding, Moon, Sun, Keyboard, Star } from "lucide-react";
import type { GtaApi } from "./useGtaGame";

/**
 * GtaBootScreen — the stunning boot/loading experience.
 * NOTE (integrator): swap this into the Suspense fallback in
 * pages/orbitxcity/OrbitxCityPage.tsx to replace the plain "Loading the city…" text:
 *   fallback={<GtaBootScreen />}
 */
const BOOT_TIPS = [
  "Walk up to any parked car and press E to take it",
  "Night falls fast — streetlights and billboards glow after dark",
  "Billboards stream live token prices from DexScreener",
  "Hold Shift to sprint · Space to jump · drag to orbit the camera",
];

export function GtaBootScreen() {
  return (
    <div className="ocg-screen ocg-boot">
      <div className="ocg-boot-sky" aria-hidden>
        <div className="ocg-boot-stars" />
        <div className="ocg-boot-glow" />
        <svg className="ocg-boot-skyline" viewBox="0 0 800 220" preserveAspectRatio="xMidYMax slice" aria-hidden>
          <g fill="#0a0f1c">
            <rect x="20" y="80" width="70" height="140" />
            <rect x="110" y="40" width="60" height="180" />
            <rect x="190" y="95" width="80" height="125" />
            <rect x="290" y="25" width="55" height="195" />
            <rect x="365" y="70" width="90" height="150" />
            <rect x="475" y="45" width="65" height="175" />
            <rect x="560" y="90" width="75" height="130" />
            <rect x="655" y="35" width="60" height="185" />
            <rect x="735" y="85" width="50" height="135" />
          </g>
          <g className="ocg-boot-windows" fill="#00ff9f">
            <rect x="125" y="55" width="8" height="6" /><rect x="145" y="55" width="8" height="6" />
            <rect x="125" y="80" width="8" height="6" /><rect x="305" y="40" width="7" height="6" />
            <rect x="305" y="70" width="7" height="6" /><rect x="490" y="60" width="8" height="6" />
            <rect x="510" y="60" width="8" height="6" /><rect x="490" y="95" width="8" height="6" />
            <rect x="670" y="50" width="8" height="6" /><rect x="670" y="90" width="8" height="6" />
            <rect x="380" y="85" width="9" height="6" /><rect x="405" y="85" width="9" height="6" />
          </g>
          <rect x="0" y="218" width="800" height="2" fill="#00ff9f" opacity="0.5" />
        </svg>
      </div>
      <div className="ocg-boot-content">
        <p className="ocg-kicker">OrbitX presents</p>
        <h1 className="ocg-logo ocg-boot-logo">ORBITX<span>CITY</span></h1>
        <div className="ocg-boot-bar" role="progressbar" aria-label="Loading the city">
          <div className="ocg-boot-bar-fill" />
        </div>
        <div className="ocg-boot-tips" aria-hidden>
          {BOOT_TIPS.map((t, i) => (
            <span key={t} className="ocg-boot-tip" style={{ animationDelay: `${i * 4}s` }}>
              <Star size={11} className="ocg-boot-tip-star" /> {t}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export function GtaTitleScreen({ api }: { api: GtaApi }) {
  return (
    <div className="ocg-screen">
      <div className="ocg-screen-bg" />
      <div className="ocg-screen-orbs" aria-hidden>
        <span className="ocg-orb orb-a" />
        <span className="ocg-orb orb-b" />
        <span className="ocg-orb orb-c" />
      </div>
      <div className="ocg-title-wrap">
        <p className="ocg-kicker">OrbitX presents</p>
        <h1 className="ocg-logo">ORBITX<span>CITY</span></h1>
        <p className="ocg-tagline">
          An open-world crypto city. Walk the streets, jack a whip, outrun the night —
          <b> live token prices</b> light up the billboards.
        </p>
        <div className="ocg-menu-actions">
          <button className="ocg-btn primary big" onClick={api.start}>
            <Play size={16} /> Enter the city
          </button>
          <button className="ocg-btn" onClick={() => api.setPhase("howto")}>How to play</button>
        </div>
        <div className="ocg-feat-row">
          <span><PersonStanding size={13} /> Free roam</span>
          <span><Car size={13} /> Drivable cars</span>
          <span><Sun size={13} /><Moon size={13} /> Day / night</span>
        </div>
        <p className="ocg-fineprint">Paper economy in-world · premium spends via in-app wallet (auth once, no popups)</p>
      </div>
    </div>
  );
}

const CONTROLS: [string, string][] = [
  ["W A S D / arrows", "Move / drive"],
  ["Mouse drag", "Orbit camera"],
  ["Shift", "Sprint (on foot)"],
  ["Space", "Jump / handbrake"],
  ["E", "Enter / exit vehicle"],
  ["Esc / P", "Pause"],
];

const TOUCH: [string, string][] = [
  ["Left stick", "Move / drive"],
  ["ACTION", "Enter / exit vehicle"],
  ["RUN", "Toggle sprint"],
  ["Drag screen", "Orbit camera"],
];

export function GtaHowToScreen({ api }: { api: GtaApi }) {
  const inGame = api.paused; // help opened from gameplay pauses first
  return (
    <div className="ocg-screen">
      <div className="ocg-screen-bg" />
      <div className="ocg-modal wide">
        <h2><Keyboard size={18} /> How to play</h2>
        <div className="ocg-howto">
          <section>
            <h4>On foot</h4>
            <p>Explore the city on foot. Walk up to any parked car and press <b>E</b> (or tap <b>ACTION</b>) to take it.</p>
          </section>
          <section>
            <h4>Driving</h4>
            <p>Arcade handling: W accelerates, S brakes/reverses, A/D steer. Traffic follows the road grid — try not to redecorate it.</p>
          </section>
          <section>
            <h4>Controls</h4>
            <ul className="ocg-controls">
              {CONTROLS.map(([k, v]) => <li key={k}><b>{k}</b><span>{v}</span></li>)}
            </ul>
            <h4>Touch</h4>
            <ul className="ocg-controls">
              {TOUCH.map(([k, v]) => <li key={k}><b>{k}</b><span>{v}</span></li>)}
            </ul>
          </section>
          <section>
            <h4>Live city</h4>
            <p>Billboards and the ticker show <b>real live token prices</b> (DexScreener). The city runs a full day/night cycle — streetlights and windows glow after dark.</p>
          </section>
        </div>
        <div className="ocg-modal-actions">
          {inGame ? (
            <>
              <button className="ocg-btn primary" onClick={() => { api.setPhase("playing"); if (api.paused) api.togglePause(); }}>
                <Play size={14} /> Resume
              </button>
              <button className="ocg-btn" onClick={api.toTitle}>Quit to menu</button>
            </>
          ) : (
            <>
              <button className="ocg-btn primary" onClick={api.start}><Play size={14} /> Enter the city</button>
              <button className="ocg-btn" onClick={() => api.setPhase("title")}>Back</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export function GtaPauseOverlay({ api }: { api: GtaApi }) {
  if (!api.paused || api.phase !== "playing") return null;
  return (
    <div className="ocg-overlay">
      <div className="ocg-modal ocg-pause-modal">
        <h2><Pause size={18} /> Paused</h2>
        <p className="ocg-hint">The city keeps breathing. Take your time.</p>
        <div className="ocg-modal-actions">
          <button className="ocg-btn primary" onClick={api.togglePause}><Play size={14} /> Resume</button>
          <button className="ocg-btn" onClick={() => api.setPhase("howto")}>How to play</button>
          <button className="ocg-btn" onClick={() => api.updateSettings({ sound: !api.settings.sound })}>
            Sound: {api.settings.sound ? "on" : "off"}
          </button>
          <button className="ocg-btn danger" onClick={api.toTitle}><Home size={14} /> Quit to menu</button>
        </div>
      </div>
    </div>
  );
}

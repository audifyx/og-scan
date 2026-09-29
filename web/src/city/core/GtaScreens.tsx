import { Play, Pause, Home, Car, PersonStanding, Moon, Sun, Keyboard } from "lucide-react";
import type { GtaApi } from "./useGtaGame";

export function GtaTitleScreen({ api }: { api: GtaApi }) {
  return (
    <div className="ocg-screen">
      <div className="ocg-screen-bg" />
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
      <div className="ocg-modal">
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

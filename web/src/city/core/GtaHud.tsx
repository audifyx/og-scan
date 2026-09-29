import { useEffect, useRef, useState } from "react";
import { Pause, Play, Volume2, VolumeX, HelpCircle, Home, Gauge, Star } from "lucide-react";
import { setTouchMove } from "./input";
import { getPoliceStore } from "../modules/police/store";
import type { WantedStars } from "../modules/police/types";
import type { GtaApi } from "./useGtaGame";

const SYMBOLS = ["SOL", "ORBITX", "BONK", "JUP", "WIF"];

function fmtP(p: number): string {
  if (!(p > 0)) return "—";
  if (p >= 100) return p.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (p >= 1) return p.toFixed(3);
  return p.toPrecision(4);
}

/** Live wanted-level mirror for HUD juice (edge flash + star ping). Display only. */
function useWantedStars(): WantedStars {
  const [stars, setStars] = useState<WantedStars>(() => {
    try { return getPoliceStore().stars; } catch { return 0; }
  });
  useEffect(() => {
    const unsub = getPoliceStore().subscribe(() => {
      try { setStars(getPoliceStore().stars); } catch { /* noop */ }
    });
    return unsub;
  }, []);
  return stars;
}

/** Day phase from the 24h "HH:MM" world clock — drives the atmosphere tint. */
function dayPhase(clock: string | undefined, isNight: boolean | undefined): "night" | "dawn" | "day" | "dusk" {
  if (isNight) return "night";
  const hh = Number((clock ?? "").split(":")[0]);
  if (!Number.isFinite(hh)) return "day";
  if (hh >= 5 && hh < 8) return "dawn";
  if (hh >= 17 && hh < 20) return "dusk";
  return "day";
}

function Ticker({ api }: { api: GtaApi }) {
  const items = SYMBOLS.map((s) => ({ s, q: api.quotes[s] }));
  return (
    <div className="ocg-ticker" data-hud aria-label="Live prices">
      <div className="ocg-ticker-track">
        {[...items, ...items].map((it, i) => (
          <span key={i} className="ocg-tick">
            <b>{it.s}</b>
            <span>${fmtP(it.q?.price ?? 0)}</span>
            <em className={(it.q?.change24h ?? 0) >= 0 ? "up" : "down"}>
              {(it.q?.change24h ?? 0) >= 0 ? "+" : ""}{(it.q?.change24h ?? 0).toFixed(1)}%
            </em>
          </span>
        ))}
      </div>
    </div>
  );
}

function Joystick({ api }: { api: GtaApi }) {
  const baseRef = useRef<HTMLDivElement | null>(null);
  const [nub, setNub] = useState({ x: 0, y: 0 });
  const [active, setActive] = useState(false);
  const pidRef = useRef<number | null>(null);

  const setFromEvent = (clientX: number, clientY: number) => {
    const el = baseRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const R = r.width / 2;
    let dx = (clientX - cx) / R;
    let dy = (clientY - cy) / R;
    const len = Math.hypot(dx, dy);
    if (len > 1) { dx /= len; dy /= len; }
    setNub({ x: dx * 34, y: dy * 34 });
    api.input.moveX = dx;
    api.input.moveY = -dy;
    setTouchMove(dx, -dy);
  };

  const clear = () => {
    pidRef.current = null;
    setActive(false);
    setNub({ x: 0, y: 0 });
    api.input.moveX = 0;
    api.input.moveY = 0;
    setTouchMove(0, 0);
  };

  return (
    <div
      ref={baseRef}
      data-hud
      className={`ocg-stick ${active ? "active" : ""}`}
      onPointerDown={(e) => {
        pidRef.current = e.pointerId;
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        setActive(true);
        setFromEvent(e.clientX, e.clientY);
      }}
      onPointerMove={(e) => {
        if (pidRef.current === e.pointerId) setFromEvent(e.clientX, e.clientY);
      }}
      onPointerUp={clear}
      onPointerCancel={clear}
    >
      <div className="ocg-stick-ring" />
      <div className="ocg-stick-nub" style={{ transform: `translate(calc(-50% + ${nub.x}px), calc(-50% + ${nub.y}px))` }} />
      <span className="ocg-stick-label">MOVE</span>
    </div>
  );
}

/**
 * Cinematic overlay stack — pure presentation, pointer-transparent.
 * - atmosphere tint keyed to day phase (dawn warmth, night blues) + vignette
 * - speed streaks at high velocity
 * - red/blue edge flash while wanted
 */
function JuiceLayers({ api, stars }: { api: GtaApi; stars: WantedStars }) {
  const h = api.hud;
  const phase = dayPhase(h?.clock, h?.isNight);
  const speeding = (h?.inCar ?? false) && (h?.speedKmh ?? 0) > 90;
  return (
    <>
      <div className={`ocg-atmo ocg-atmo-${phase}`} aria-hidden />
      {speeding && <div className="ocg-speedfx" aria-hidden />}
      {stars > 0 && (
        <div className="ocg-copflash" style={{ ["--stars" as string]: stars }} aria-hidden />
      )}
    </>
  );
}

export function GtaHud({ api }: { api: GtaApi }) {
  const h = api.hud;
  const stars = useWantedStars();
  const [sprintOn, setSprintOn] = useState(false);
  return (
    <div className="ocg-hud">
      <JuiceLayers api={api} stars={stars} />
      <Ticker api={api} />

      {stars > 0 && (
        <div className="ocg-wanted-ping" data-hud aria-label={`${stars} star wanted level`}>
          {Array.from({ length: stars }, (_, i) => (
            <Star key={i} size={14} className="ocg-wanted-star" fill="currentColor" />
          ))}
        </div>
      )}

      <div className="ocg-hud-top" data-hud>
        <div className={`ocg-clock ${h?.isNight ? "night" : "day"}`}>
          {h?.clock ?? "--:--"}
          <span className="ocg-clock-ico">{h?.isNight ? "🌙" : "☀️"}</span>
        </div>
        <div className="ocg-hud-btns">
          <button className="ocg-iconbtn" onClick={api.togglePause} aria-label={api.paused ? "Resume" : "Pause"}>
            {api.paused ? <Play size={15} /> : <Pause size={15} />}
          </button>
          <button
            className="ocg-iconbtn"
            onClick={() => api.updateSettings({ sound: !api.settings.sound })}
            aria-label="Toggle sound"
          >
            {api.settings.sound ? <Volume2 size={15} /> : <VolumeX size={15} />}
          </button>
          <button className="ocg-iconbtn" onClick={() => { api.togglePause(); api.setPhase("howto"); }} aria-label="Help">
            <HelpCircle size={15} />
          </button>
          <button className="ocg-iconbtn" onClick={api.toTitle} aria-label="Quit to menu">
            <Home size={15} />
          </button>
        </div>
      </div>

      <canvas ref={api.minimapRef} width={148} height={148} className="ocg-minimap" data-hud aria-label="Minimap" />

      {h?.inCar && (
        <div className="ocg-speedo" data-hud>
          <Gauge size={16} />
          <b>{Math.round(h.speedKmh)}</b><small>km/h</small>
        </div>
      )}

      {h && !h.inCar && h.nearCar && (
        <div className="ocg-prompt" data-hud>
          <span className="ocg-prompt-key">E</span>
          <div><strong>Enter vehicle</strong><span>or tap ACTION</span></div>
        </div>
      )}
      {h?.inCar && (
        <div className="ocg-prompt" data-hud>
          <span className="ocg-prompt-key">E</span>
          <div><strong>Exit vehicle</strong><span>or tap ACTION</span></div>
        </div>
      )}

      <div className="ocg-touch" data-hud>
        <Joystick api={api} />
        <div className="ocg-touch-actions">
          <button
            className="ocg-touch-btn accent"
            onPointerDown={(e) => { e.preventDefault(); api.doAction(); }}
          >
            ACTION
          </button>
          <div className="ocg-touch-row">
            <button
              className={`ocg-touch-btn small ${sprintOn ? "on" : ""}`}
              onPointerDown={(e) => {
                e.preventDefault();
                const v = !sprintOn;
                setSprintOn(v);
                api.setSprintTouch(v);
              }}
            >
              RUN
            </button>
            <button
              className="ocg-touch-btn small jump"
              onPointerDown={(e) => { e.preventDefault(); api.input.jump = true; }}
              onPointerUp={() => { api.input.jump = false; }}
            >
              {h?.inCar ? "STOP" : "JUMP"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

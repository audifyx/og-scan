import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { Pause, Play, Volume2, VolumeX, HelpCircle, Home, Zap, ArrowUp, Crosshair, Wallet } from "lucide-react";
import { useWallet } from "@solana/wallet-adapter-react";
import { setTouchMove } from "./core/input";
import type { GtaApi } from "./core/useGtaGame";

/**
 * City HUD (boards 2/3/4): top ticker chips, minimap + SCAN + HOOK (left),
 * RUN / JUMP / PPS diamond (right), MOVE stick (bottom-center).
 * Live data from api.quotes (ORBITX/SOL); CITY points from api.hud.
 */

function fmtP(p: number): string {
  if (!(p > 0)) return "—";
  if (p >= 100) return p.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (p >= 1) return p.toFixed(3);
  return p.toPrecision(4);
}

function shortAddr(a: string): string {
  return a.length > 9 ? `${a.slice(0, 4)}…${a.slice(-4)}` : a;
}

/** Animated count-up toward the live CITY points total. */
function useCityPoints(api: GtaApi): number {
  const target = api.hud?.cityPoints ?? 0;
  const [shown, setShown] = useState(target);
  const shownRef = useRef(target);
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const cur = shownRef.current;
      if (cur === target) return;
      const next = cur + Math.sign(target - cur) * Math.max(1, Math.ceil(Math.abs(target - cur) / 12));
      shownRef.current = (target > cur && next > target) || (target < cur && next < target) ? target : next;
      setShown(shownRef.current);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return shown;
}

function useClock(): string {
  const [now, setNow] = useState("--:--");
  useEffect(() => {
    const f = () => {
      const d = new Date();
      setNow(`${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`);
    };
    f();
    const id = setInterval(f, 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

function Ticker({ api }: { api: GtaApi }) {
  const clock = useClock();
  const points = useCityPoints(api);
  const { publicKey } = useWallet();
  const addr = publicKey?.toBase58();
  const orx = api.quotes["ORBITX"];
  const sol = api.quotes["SOL"];

  const pct = (q: { change24h: number } | undefined) => {
    const c = q?.change24h ?? 0;
    return (
      <em className={c >= 0 ? "up" : "down"}>
        {c >= 0 ? "▲" : "▼"} {Math.abs(c).toFixed(2)}%
      </em>
    );
  };

  return (
    <div className="oxc-ticker" data-hud>
      <div className="oxc-chip city">
        <span className="oxc-dia" aria-hidden>◆</span>
        <span className="oxc-chip-body">
          <small>CITY</small>
          <b>{points.toLocaleString("en-US")}</b>
        </span>
      </div>
      <div className="oxc-chip">
        <span className="oxc-chip-body">
          <small>ORBITX</small>
          <b className="cyan">{fmtP(orx?.price ?? 0)}</b>
          {pct(orx)}
        </span>
      </div>
      <div className="oxc-chip">
        <span className="oxc-chip-body">
          <small>SOL</small>
          <b className="cyan">{fmtP(sol?.price ?? 0)}</b>
          {pct(sol)}
        </span>
      </div>
      <div className="oxc-chip wallet">
        <Wallet size={15} className="cyan-ico" />
        <span className="oxc-chip-body">
          <small>{addr ? shortAddr(addr) : "—"}</small>
          <b className="dim">—</b>
        </span>
      </div>
      <div className="oxc-chip clock">
        <span className="oxc-clock-ico" aria-hidden>◷</span>
        <b>{clock}</b>
      </div>
      <div className="oxc-iconbtns">
        <button className="oxc-iconbtn" data-hud onClick={api.togglePause} aria-label={api.paused ? "Resume" : "Pause"}>
          {api.paused ? <Play size={15} /> : <Pause size={15} />}
        </button>
        <button
          className="oxc-iconbtn" data-hud
          onClick={() => api.updateSettings({ sound: !api.settings.sound })}
          aria-label="Toggle sound"
        >
          {api.settings.sound ? <Volume2 size={15} /> : <VolumeX size={15} />}
        </button>
        <button className="oxc-iconbtn" data-hud onClick={() => { api.togglePause(); api.setPhase("howto"); }} aria-label="Help">
          <HelpCircle size={15} />
        </button>
        <button className="oxc-iconbtn" data-hud onClick={api.toTitle} aria-label="Quit to menu">
          <Home size={15} />
        </button>
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
    setNub({ x: dx * 32, y: dy * 32 });
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
      className={`oxc-stick ${active ? "active" : ""}`}
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
      aria-label="Move stick"
    >
      <div className="oxc-stick-nub" style={{ transform: `translate(calc(-50% + ${nub.x}px), calc(-50% + ${nub.y}px))` }} />
      <span className="oxc-stick-label">MOVE</span>
    </div>
  );
}

function HookIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
      <path d="M15 3l4 4" />
      <path d="M19 3l-8.5 8.5a5.5 5.5 0 1 0 7.8 7.8" />
    </svg>
  );
}

export function CityHud({ api }: { api: GtaApi }) {
  const [sprintOn, setSprintOn] = useState(false);

  const scan = () => api.getWorld()?.scanPulse();
  const hook = () => {
    const w = api.getWorld();
    if (!w) return;
    const s = w.getPlayerState();
    w.addPlayerVelocity(new THREE.Vector3(Math.sin(s.heading), 0, Math.cos(s.heading)).multiplyScalar(13));
  };

  return (
    <div className="oxc-hud">
      <Ticker api={api} />

      {/* left: minimap + SCAN + HOOK */}
      <div className="oxc-left" data-hud>
        <canvas ref={api.minimapRef} width={148} height={148} className="oxc-minimap" aria-label="Minimap" />
        <button className="oxc-pill" onPointerDown={(e) => { e.preventDefault(); scan(); }}>
          <Crosshair size={16} /> SCAN
        </button>
        <button className="oxc-pill" onPointerDown={(e) => { e.preventDefault(); hook(); }}>
          <HookIcon /> HOOK
        </button>
      </div>

      {/* right: RUN / JUMP / PPS */}
      <div className="oxc-right" data-hud>
        <button
          className={`oxc-ctl${sprintOn ? " on" : ""}`}
          onPointerDown={(e) => {
            e.preventDefault();
            const v = !sprintOn;
            setSprintOn(v);
            api.setSprintTouch(v);
          }}
          aria-label="Toggle run"
        >
          <Zap size={20} />
          <span>RUN</span>
        </button>
        <button
          className="oxc-ctl"
          onPointerDown={(e) => { e.preventDefault(); api.input.jump = true; }}
          onPointerUp={() => { api.input.jump = false; }}
          onPointerCancel={() => { api.input.jump = false; }}
          aria-label="Jump"
        >
          <ArrowUp size={20} />
          <span>JUMP</span>
        </button>
        <button className="oxc-ctl diamond" onPointerDown={(e) => { e.preventDefault(); scan(); }} aria-label="PPS system">
          <Crosshair size={20} />
          <span>PPS</span>
        </button>
      </div>

      <Joystick api={api} />
    </div>
  );
}

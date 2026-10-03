import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { NpcSystem } from "../npcs/NpcAI";
import {
  JOBS, CashierGame, DeliveryJob, PatrolJob, DELIVERY_LEGS,
  PATROL_ROUTE, completeJob, jobDoneToday, makeBeacon, beaconTick, disposeBeacon,
  type JobId,
} from "./Jobs";
import { getTreasuryStatus, shortTreasury, orbitxRewardLabel } from "./treasury";
import { questProgress, claimQuest } from "../quests";

/**
 * OrbitX City — job board UI.
 *
 * Lists the three jobs (cashier / delivery / security patrol) plus the daily
 * quests it EXTENDS from web/src/city/quests.ts. Job completions land in the
 * same per-wallet daily store — no second quest system.
 *
 * Mount next to <GtaHud/> while in-world. The integrating lane passes a tiny
 * api object (see CityJobsApi); the component is otherwise self-contained.
 */

export interface CityJobsApi {
  wallet: string | null;
  onToast: (msg: string) => void;
  getWorld: () => { scene: THREE.Scene; playerPos(): { x: number; z: number } } | null;
  getNpcs: () => NpcSystem | null;
  getSession: () => { dist: number; scanned: string[]; visited: string[] };
}

type View = "board" | "cashier" | "delivery" | "patrol";

const NEON = "#17e6d4";

const sheet: React.CSSProperties = {
  position: "fixed", left: 12, right: 12, bottom: 12, zIndex: 60,
  maxHeight: "46vh", overflowY: "auto",
  background: "rgba(5,10,16,0.94)", border: `1px solid ${NEON}55`,
  borderRadius: 14, padding: 14, color: "#d9fbff",
  fontFamily: "system-ui, sans-serif", backdropFilter: "blur(6px)",
};

const btn: React.CSSProperties = {
  background: `${NEON}22`, border: `1px solid ${NEON}`, color: "#d9fbff",
  borderRadius: 10, padding: "10px 14px", fontSize: 14, fontWeight: 700,
  cursor: "pointer", minHeight: 44,
};

function useNowMs(intervalMs: number, active: boolean): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs, active]);
  return now;
}

export default function JobBoard({ api }: { api: CityJobsApi }) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>("board");
  const [ts, setTs] = useState(getTreasuryStatus());

  useEffect(() => {
    if (open) setTs(getTreasuryStatus());
  }, [open ]);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{ ...btn, position: "fixed", right: 12, bottom: 76, zIndex: 60 }}
        aria-label="Open job board"
      >
        💼 JOBS
      </button>
    );
  }

  return (
    <div style={sheet} data-hud>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ fontWeight: 800, letterSpacing: 2, color: NEON }}>
          {view === "board" ? "💼 JOB BOARD" : view === "cashier" ? "🧾 CASHIER SHIFT" : view === "delivery" ? "📦 DELIVERY RUN" : "🛡 SECURITY PATROL"}
        </div>
        <button onClick={() => { setView("board"); setOpen(false); }} style={{ ...btn, minHeight: 36, padding: "6px 10px" }}>✕</button>
      </div>

      <div style={{ fontSize: 12, opacity: 0.85, marginBottom: 10 }}>
        🏦 Treasury {ts.address ? shortTreasury(ts.address) : "(not set)"} — {ts.funded ? <span style={{ color: NEON }}>funded</span> : <span style={{ color: "#ffb35c" }}>⏸ ORBITX rewards paused — treasury empty</span>}
      </div>

      {view === "board" && <BoardView api={api} setView={setView} />}
      {view === "cashier" && <CashierView api={api} back={() => setView("board")} />}
      {view === "delivery" && <DeliveryView api={api} back={() => setView("board")} />}
      {view === "patrol" && <PatrolView api={api} back={() => setView("board")} />}
    </div>
  );
}

// ── board: job cards + daily quests ─────────────────────────────────

function BoardView({ api, setView }: { api: CityJobsApi; setView: (v: View) => void }) {
  const [claimed, setClaimed] = useState<string[]>([]);
  const session = useMemo(() => { try { return api.getSession(); } catch { return { dist: 0, scanned: [], visited: [] }; } }, [api]);
  const quests = useMemo(() => questProgress(api.wallet, session), [api.wallet, session, claimed]);

  const claim = (id: string) => {
    const paid = claimQuest(api.wallet, id);
    if (paid > 0) {
      api.onToast(`✅ Quest complete — +${paid} CITY`);
      setClaimed((c) => [...c, id]);
    }
  };

  return (
    <div>
      {JOBS.map((j) => {
        const done = jobDoneToday(api.wallet, j.id);
        return (
          <div key={j.id} style={{ border: "1px solid #ffffff22", borderRadius: 10, padding: 10, marginBottom: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontWeight: 700 }}>{j.name}</div>
                <div style={{ fontSize: 12, opacity: 0.75 }}>{j.desc}</div>
                <div style={{ fontSize: 12, opacity: 0.75 }}>📍 {j.location}</div>
                <div style={{ fontSize: 12, marginTop: 4 }}>
                  <span style={{ color: NEON }}>+{j.cityReward} CITY</span>
                  {" · "}
                  <span style={{ opacity: 0.85 }}>{orbitxRewardLabel(j.orbitxReward)}</span>
                  {done && <span style={{ opacity: 0.6 }}> · done today (½ pay on repeat)</span>}
                </div>
              </div>
              <button style={btn} onClick={() => setView(j.id as View)}>START</button>
            </div>
          </div>
        );
      })}

      <div style={{ fontWeight: 800, letterSpacing: 2, color: NEON, margin: "12px 0 6px" }}>📜 DAILY QUESTS</div>
      {quests.map((q) => (
        <div key={q.def.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "1px solid #ffffff11" }}>
          <div style={{ fontSize: 13 }}>
            <b>{q.def.name}</b> <span style={{ opacity: 0.7 }}>— {q.def.desc}</span>
            <div style={{ opacity: 0.7, fontSize: 12 }}>{q.have}/{q.def.target} · +{q.def.reward} CITY</div>
          </div>
          {q.claimed ? <span style={{ fontSize: 12, opacity: 0.6 }}>claimed ✓</span>
            : q.done ? <button style={{ ...btn, minHeight: 36, padding: "6px 10px" }} onClick={() => claim(q.def.id)}>CLAIM</button>
            : <span style={{ fontSize: 12, opacity: 0.6 }}>…</span>}
        </div>
      ))}
    </div>
  );
}

// ── cashier mini-game ───────────────────────────────────────────────

function CashierView({ api, back }: { api: CityJobsApi; back: () => void }) {
  const game = useMemo(() => new CashierGame(), []);
  const [started, setStarted] = useState(false);
  const [round, setRound] = useState(0);
  const [hits, setHits] = useState(0);
  const [lastHit, setLastHit] = useState<boolean | null>(null);
  const markerRef = useRef<HTMLDivElement>(null);
  const raf = useRef(0);
  const lastT = useRef(0);

  const finish = useCallback(() => {
    const bonus = game.accuracyBonus;
    const p = completeJob(api.wallet, "cashier", bonus);
    api.onToast(`🧾 Shift done — ${game.hits}/10 · +${p.cityPaid} CITY${p.orbitxPaused ? " · ⏸ ORBITX paused — treasury empty" : ` · +${p.orbitxQueued} ORBITX queued`}`);
    back();
  }, [api, back, game]);

  useEffect(() => {
    if (!started) return;
    game.start();
    lastT.current = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - lastT.current) / 1000);
      lastT.current = now;
      game.tick(dt);
      if (markerRef.current) markerRef.current.style.left = `${game.marker * 100}%`;
      if (game.done) { finish(); return; }
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf.current);
  }, [started, game, finish]);

  const tap = () => {
    if (!started || game.done) return;
    const hit = game.tap();
    setLastHit(hit);
    setRound(game.round);
    setHits(game.hits);
  };

  if (!started) {
    return (
      <div>
        <p style={{ fontSize: 13, opacity: 0.85 }}>Tap when the marker is inside the <b style={{ color: NEON }}>green zone</b>. 10 rounds — it gets faster. 8+/10 earns +10 CITY bonus.</p>
        <button style={btn} onClick={() => setStarted(true)}>🛎 START SHIFT</button>{" "}
        <button style={{ ...btn, opacity: 0.7 }} onClick={back}>back</button>
      </div>
    );
  }

  return (
    <div>
      <div style={{ fontSize: 13, marginBottom: 6 }}>Round {Math.min(round + 1, 10)}/10 · hits {hits} {lastHit === null ? "" : lastHit ? "✅" : "❌"}</div>
      <div style={{ position: "relative", height: 44, background: "#0a141c", borderRadius: 10, border: "1px solid #ffffff22", marginBottom: 10 }}>
        <div style={{ position: "absolute", left: "39%", width: "22%", top: 0, bottom: 0, background: `${NEON}44`, borderLeft: `1px solid ${NEON}`, borderRight: `1px solid ${NEON}` }} />
        <div ref={markerRef} style={{ position: "absolute", top: 2, bottom: 2, width: 6, background: "#fff", borderRadius: 3, left: "0%" }} />
      </div>
      <button style={{ ...btn, width: "100%", fontSize: 18, padding: 16 }} onClick={tap}>TAP 👆</button>
    </div>
  );
}

// ── delivery run ────────────────────────────────────────────────────

function DeliveryView({ api, back }: { api: CityJobsApi; back: () => void }) {
  const job = useMemo(() => new DeliveryJob(), []);
  const [legIdx] = useState(() => Math.floor(Math.random() * DELIVERY_LEGS.length));
  const [phase, setPhase] = useState(job.phase);
  const [timeLeft, setTimeLeft] = useState(0);
  const [dist, setDist] = useState(0);
  const beacon = useRef<THREE.Group | null>(null);
  useNowMs(500, phase === "toPickup" || phase === "toDropoff");

  useEffect(() => {
    const w = api.getWorld();
    if (!w) { api.onToast("⚠ world not ready"); back(); return; }
    const leg = DELIVERY_LEGS[legIdx];
    job.start(leg);
    setPhase(job.phase);
    const b = makeBeacon(0xffb35c);
    b.position.set(leg.pickup.x, 0, leg.pickup.z);
    w.scene.add(b);
    beacon.current = b;
    api.onToast(`📦 Pick up the package at ${leg.pickup.label}`);
    let last = performance.now();
    const id = setInterval(() => {
      const now = performance.now();
      const dt = Math.min(1, (now - last) / 1000);
      last = now;
      const p = w.playerPos();
      const ev = job.update(dt, p.x, p.z);
      const t = job.target();
      if (t && beacon.current) {
        beacon.current.position.set(t.x, 0, t.z);
        beaconTick(beacon.current, now / 1000);
        setDist(Math.hypot(p.x - t.x, p.z - t.z));
      }
      setTimeLeft(Math.max(0, job.timeLeft));
      if (ev === "picked") {
        api.onToast(`📦 Package secured — deliver to ${job.leg!.dropoff.label}`);
        setPhase(job.phase);
      } else if (ev === "delivered") {
        const p2 = completeJob(api.wallet, "delivery", job.speedBonus);
        api.onToast(`✅ Delivered! +${p2.cityPaid} CITY${p2.orbitxPaused ? " · ⏸ ORBITX paused — treasury empty" : ` · +${p2.orbitxQueued} ORBITX queued`}`);
        setPhase(job.phase);
        back();
      } else if (ev === "failed") {
        api.onToast("⌛ Delivery failed — timer ran out.");
        setPhase(job.phase);
        back();
      }
    }, 120);
    return () => {
      clearInterval(id);
      if (beacon.current) { disposeBeacon(beacon.current); beacon.current = null; }
      job.reset();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const t = job.target();
  return (
    <div>
      <div style={{ fontSize: 13, marginBottom: 6 }}>
        {phase === "toPickup" && <>🟠 Pick up at <b>{t?.label}</b></>}
        {phase === "toDropoff" && <>🟢 Deliver to <b>{t?.label}</b></>}
      </div>
      <div style={{ display: "flex", gap: 16, fontSize: 14, marginBottom: 8 }}>
        <div>⏱ {Math.ceil(timeLeft)}s</div>
        <div>📍 {dist.toFixed(0)}m</div>
      </div>
      <button style={{ ...btn, opacity: 0.7 }} onClick={back}>abandon</button>
    </div>
  );
}

// ── security patrol ─────────────────────────────────────────────────

function PatrolView({ api, back }: { api: CityJobsApi; back: () => void }) {
  const job = useMemo(() => new PatrolJob(), []);
  const [reached, setReached] = useState<number[]>([]);
  const [nearest, setNearest] = useState(0);
  useNowMs(400, job.active);

  useEffect(() => {
    const w = api.getWorld();
    if (!w) { api.onToast("⚠ world not ready"); back(); return; }
    job.start();
    api.onToast("🛡 Patrol started — walk the glowing route");
    const beacons = PATROL_ROUTE.map((c, i) => {
      const b = makeBeacon(i === 0 ? 0x17e6d4 : 0x2a6aff);
      b.position.set(c.x, 0, c.z);
      w.scene.add(b);
      return b;
    });
    const id = setInterval(() => {
      const p = w.playerPos();
      const ev = job.update(p.x, p.z);
      const now = performance.now() / 1000;
      beacons.forEach((b, i) => { if (i >= job.idx) beaconTick(b, now); });
      let nd = Infinity;
      PATROL_ROUTE.forEach((c, i) => {
        if (i < job.idx) return;
        nd = Math.min(nd, Math.hypot(p.x - c.x, p.z - c.z));
      });
      setNearest(nd);
      if (ev && "reached" in ev) {
        api.onToast(`📍 Checkpoint ${ev.reached + 1}/${PATROL_ROUTE.length} — +2 CITY`);
        const done = beacons[ev.reached];
        if (done) { disposeBeacon(done); }
        setReached((r) => [...r, ev.reached]);
      } else if (ev && "routeDone" in ev) {
        const p2 = completeJob(api.wallet, "patrol", 0);
        api.onToast(`✅ Patrol complete! +${p2.cityPaid} CITY${p2.orbitxPaused ? " · ⏸ ORBITX paused — treasury empty" : ` · +${p2.orbitxQueued} ORBITX queued`}`);
        back();
      }
    }, 150);
    return () => {
      clearInterval(id);
      beacons.forEach((b) => { try { disposeBeacon(b); } catch { /* noop */ } });
      job.reset();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <div style={{ fontSize: 13, marginBottom: 8 }}>
        Checkpoints: {reached.length}/{PATROL_ROUTE.length} · nearest {nearest === Infinity ? "—" : `${nearest.toFixed(0)}m`}
      </div>
      <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
        {PATROL_ROUTE.map((_, i) => (
          <div key={i} style={{
            width: 34, height: 34, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center",
            background: reached.includes(i) ? `${NEON}55` : "#ffffff11",
            border: `1px solid ${reached.includes(i) ? NEON : "#ffffff33"}`, fontSize: 14,
          }}>{reached.includes(i) ? "✓" : i + 1}</div>
        ))}
      </div>
      <button style={{ ...btn, opacity: 0.7 }} onClick={back}>abandon</button>
    </div>
  );
}

// ── worker TALK prompt ──────────────────────────────────────────────

/** Floating "TALK" chip when the player stands near a store worker. */
export function TalkPrompt({ api }: { api: CityJobsApi }) {
  const [target, setTarget] = useState<{ storeKey: string; name: string } | null>(null);

  useEffect(() => {
    const id = setInterval(() => {
      try {
        const npc = api.getNpcs();
        const w = api.getWorld();
        if (!npc || !w) { setTarget(null); return; }
        const p = w.playerPos();
        setTarget(npc.getNearbyTalkTarget(p.x, p.z));
      } catch { setTarget(null); }
    }, 250);
    return () => clearInterval(id);
  }, [api]);

  useEffect(() => {
    if (!target) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "KeyE") {
        const npc = api.getNpcs();
        npc?.onTalkToWorker?.(target.storeKey);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [target, api]);

  if (!target) return null;
  return (
    <button
      data-hud
      onClick={() => api.getNpcs()?.onTalkToWorker?.(target.storeKey)}
      style={{
        ...btn, position: "fixed", left: "50%", transform: "translateX(-50%)",
        bottom: 120, zIndex: 60, fontSize: 15,
      }}
    >
      💬 TALK — {target.name} <span style={{ opacity: 0.6 }}>[E]</span>
    </button>
  );
}

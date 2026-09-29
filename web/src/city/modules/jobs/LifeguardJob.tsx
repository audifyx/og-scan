/**
 * Lifeguard — patrol Luna Bay Boardwalk, rescue drowning swimmers.
 * Swimmers bob in the swim zone (translucent blue disc prop). Every
 * 10–20s one starts drowning (red beacon + flailing): reach them within
 * 25s for the rescue payout. Misses just cost you the bonus.
 * Additive only: peds + props, proximity rescue.
 */
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import type { JobMeta, JobProps } from "./types";
import { JobChrome, PremiumButton, StatRow } from "./JobChrome";
import { useWorldTick, dist2, getPlayer } from "./world";
import { makeBeacon, spawnPed, idlePed, type Beacon, type Ped } from "./markers";
import { HALF } from "../../core";
import { earnCity, addXp, jobLevel, levelPayScale, pushToast, fmtCity } from "./wallet";

export const LIFEGUARD_META: JobMeta = {
  id: "lifeguard",
  name: "Lifeguard",
  icon: "🛟",
  tagline: "Patrol Luna Bay. Save swimmers.",
  payInfo: "$150 per rescue · streaks for saves",
  premium: "Jet ski: faster response",
  howTo: "Start patrol at Luna Bay Boardwalk. When a swimmer starts drowning (red beacon), reach them within 25s to pull them out.",
};

const BEACH = { x: HALF - 70, z: 0, r: 28 };
const RESCUE_PAY = 150;
const DROWN_WINDOW = 25;

interface Swimmer {
  ped: Ped;
  drowning: boolean;
  drownT: number;
  beacon: Beacon | null;
}

export default function LifeguardJob({ api, onEndShift }: JobProps) {
  const [patrolling, setPatrolling] = useState(false);
  const [rescues, setRescues] = useState(0);
  const [missed, setMissed] = useState(0);
  const [drowning, setDrowning] = useState(0);
  const swimmersRef = useRef<Swimmer[]>([]);
  const waterRef = useRef<THREE.Mesh | null>(null);
  const towerRef = useRef<Beacon | null>(null);
  const nextEvent = useRef(0);
  const tRef = useRef(0);
  const lastSync = useRef(0);

  const clearAll = () => {
    swimmersRef.current.forEach((s) => {
      s.ped.dispose();
      s.beacon?.dispose();
    });
    swimmersRef.current = [];
    if (waterRef.current) {
      waterRef.current.parent?.remove(waterRef.current);
      (waterRef.current.geometry as THREE.BufferGeometry).dispose();
      (waterRef.current.material as THREE.Material).dispose();
      waterRef.current = null;
    }
    towerRef.current?.dispose();
    towerRef.current = null;
  };

  const startPatrol = (scene: THREE.Scene) => {
    clearAll();
    // water disc prop
    const geo = new THREE.CircleGeometry(BEACH.r, 40);
    const mat = new THREE.MeshBasicMaterial({ color: 0x1e90ff, transparent: true, opacity: 0.3 });
    const water = new THREE.Mesh(geo, mat);
    water.rotation.x = -Math.PI / 2;
    water.position.set(BEACH.x, 0.08, BEACH.z);
    scene.add(water);
    waterRef.current = water;
    // tower marker
    const tb = makeBeacon(0x3a86ff);
    tb.setPos(BEACH.x - BEACH.r - 6, BEACH.z);
    scene.add(tb.group);
    towerRef.current = tb;
    // swimmers
    for (let i = 0; i < 5; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 6 + Math.random() * (BEACH.r - 10);
      const ped = spawnPed(scene, BEACH.x + Math.cos(a) * r, BEACH.z + Math.sin(a) * r, {});
      swimmersRef.current.push({ ped, drowning: false, drownT: 0, beacon: null });
    }
    nextEvent.current = 8 + Math.random() * 8;
    setPatrolling(true);
    pushToast("On duty at Luna Bay 🌊", "info");
  };

  useWorldTick(api, (dt, world) => {
    tRef.current += dt;
    const t = tRef.current;
    towerRef.current?.update(dt);
    if (!world || swimmersRef.current.length === 0) return;
    const p = getPlayer(api);
    if (!p) return;
    const scene = world.sceneRef;
    // drowning events
    nextEvent.current -= dt;
    if (nextEvent.current <= 0) {
      nextEvent.current = 10 + Math.random() * 10;
      const calm = swimmersRef.current.filter((s) => !s.drowning);
      if (calm.length > 0) {
        const s = calm[Math.floor(Math.random() * calm.length)];
        s.drowning = true;
        s.drownT = DROWN_WINDOW;
        const b = makeBeacon(0xff3333);
        b.setPos(s.ped.pos.x, s.ped.pos.z);
        scene.add(b.group);
        s.beacon = b;
        pushToast("🆘 Swimmer in trouble!", "warn");
      }
    }
    swimmersRef.current.forEach((s) => {
      if (s.drowning) {
        s.drownT -= dt;
        s.beacon?.update(dt);
        s.beacon?.setPos(s.ped.pos.x, s.ped.pos.z);
        // flail: spin + bob
        s.ped.h.group.rotation.y += dt * 8;
        s.ped.h.update(dt, 1);
        const d = dist2(p.pos.x, p.pos.z, s.ped.pos.x, s.ped.pos.z);
        if (d < 9) {
          const pay = RESCUE_PAY * levelPayScale("lifeguard");
          earnCity(pay, "Swimmer rescued");
          const { leveled } = addXp("lifeguard", 40);
          setRescues((n) => n + 1);
          pushToast(leveled ? `Rescue! LEVEL UP!` : `Rescue! ${fmtCity(pay)}`, "cash");
          s.drowning = false;
          s.beacon?.dispose();
          s.beacon = null;
          s.ped.h.group.rotation.y = 0;
        } else if (s.drownT <= 0) {
          s.drowning = false;
          s.beacon?.dispose();
          s.beacon = null;
          s.ped.h.group.rotation.y = 0;
          setMissed((n) => n + 1);
          addXp("lifeguard", 5);
          pushToast("Swimmer made it out on their own…", "warn");
        }
      } else {
        idlePed(s.ped, dt, t + s.ped.pos.x);
      }
    });
    const now = performance.now();
    if (now - lastSync.current > 500) {
      lastSync.current = now;
      setDrowning((prev) => {
        const n = swimmersRef.current.filter((s) => s.drowning).length;
        return prev === n ? prev : n;
      });
    }
  });

  useEffect(() => {
    return () => {
      clearAll();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <JobChrome
      meta={LIFEGUARD_META}
      status={!patrolling ? "Off duty" : drowning > 0 ? `🆘 ${drowning} drowning!` : "Patrolling the bay…"}
      onEnd={onEndShift}
    >
      <StatRow label="Rescues" value={rescues} accent={rescues > 0} />
      <StatRow label="Missed" value={missed} />
      <StatRow label="Lifeguard level" value={jobLevel("lifeguard")} />
      {!patrolling && (
        <button
          className="oj-btn primary"
          onClick={() => {
            const w = api.getWorld();
            if (w) startPatrol(w.sceneRef);
            else pushToast("Open the job while in the city", "warn");
          }}
        >
          🛟 Start patrol
        </button>
      )}
      <div className="oj-hint">
        Blue beacon = the lifeguard tower at Luna Bay Boardwalk. Red beacon = drowning swimmer — you have {DROWN_WINDOW}s.
      </div>
      <PremiumButton label="Jet ski" />
    </JobChrome>
  );
}

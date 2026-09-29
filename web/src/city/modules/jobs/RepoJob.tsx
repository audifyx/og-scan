/**
 * Repo man — repossess debtors' cars and tow them to the impound lot.
 * Go to the red beacon, hold position to hook up (6s), then tow the car
 * to the gold depot beacon. Payout scales with tow distance; back-to-back
 * repos build a streak multiplier (cap 1.5×, resets after 90s idle).
 * Additive only: the target car is a prop that follows the player while towing.
 */
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import type { JobMeta, JobProps } from "./types";
import { JobChrome, PremiumButton, StatRow } from "./JobChrome";
import { useWorldTick, dist2, fmtDist, randomSidewalk, districtAt, getPlayer } from "./world";
import { makeBeacon, makeTextSprite, type Beacon } from "./markers";
import { createCarMesh, HALF, type CarMesh } from "../../core";
import { earnCity, addXp, jobLevel, levelPayScale, pushToast } from "./wallet";

export const REPO_META: JobMeta = {
  id: "repo",
  name: "Repo Man",
  icon: "🪝",
  tagline: "Repossess rides for the bank.",
  payInfo: "$120 + $1.2/10m tow · streak bonus up to 1.5×",
  premium: "Hydraulic lift: instant hookup",
  howTo: "Drive or run to the red REPO beacon. Stay close for 6s to hook the car, then tow it to the gold impound beacon. Fast consecutive repos raise your streak.",
};

const HOOK_SEC = 6;
const DEPOT = { x: -HALF + 55, z: HALF - 55, name: "Impound Lot" };
const DEBTS = [4200, 6800, 9100, 12500, 15300, 22750];

interface Target {
  car: CarMesh;
  label: THREE.Sprite;
  beacon: Beacon;
  x: number;
  z: number;
  debt: number;
}

export default function RepoJob({ api, onEndShift }: JobProps) {
  const [phase, setPhase] = useState<"find" | "hook" | "tow">("find");
  const [repos, setRepos] = useState(0);
  const [streak, setStreak] = useState(0);
  const [hookPct, setHookPct] = useState(0);
  const [banner, setBanner] = useState("Scanning for delinquent loans…");
  const targetRef = useRef<Target | null>(null);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const hookT = useRef(0);
  const streakRef = useRef(0);
  const lastRepoAt = useRef(0);
  const depotBeacon = useRef<Beacon | null>(null);

  const clearTarget = () => {
    const t = targetRef.current;
    if (t) {
      t.beacon.dispose();
      t.car.group.parent?.remove(t.car.group);
      t.car.dispose();
      (t.label.material as THREE.Material).dispose();
      (t.label.material as THREE.SpriteMaterial).map?.dispose();
      targetRef.current = null;
    }
  };

  const newTarget = (scene: THREE.Scene) => {
    clearTarget();
    const s = randomSidewalk();
    const car = createCarMesh();
    car.group.position.set(s.x, 0, s.z);
    car.group.rotation.y = Math.random() * Math.PI * 2;
    const label = makeTextSprite("REPO", "#ffffff", "#c22");
    label.position.set(0, 3.2, 0);
    car.group.add(label);
    const beacon = makeBeacon(0xff4444);
    beacon.setPos(s.x, s.z);
    scene.add(car.group);
    scene.add(beacon.group);
    const debt = DEBTS[Math.floor(Math.random() * DEBTS.length)];
    targetRef.current = { car, label, beacon, x: s.x, z: s.z, debt };
    hookT.current = 0;
    setHookPct(0);
    setPhase("find");
    setBanner(`$${debt.toLocaleString()} delinquent in ${districtAt(s.x, s.z)} — go hook it`);
  };

  useWorldTick(api, (dt, world) => {
    if (!world) return;
    const scene = world.sceneRef;
    if (!depotBeacon.current) {
      const b = makeBeacon(0xffd23f);
      b.setPos(DEPOT.x, DEPOT.z);
      scene.add(b.group);
      depotBeacon.current = b;
    }
    depotBeacon.current.update(dt);
    const t = targetRef.current;
    if (!t) {
      newTarget(scene);
      return;
    }
    t.beacon.update(dt);
    const p = getPlayer(api);
    if (!p) return;
    const ph = phaseRef.current;

    if (ph === "find") {
      if (dist2(p.pos.x, p.pos.z, t.x, t.z) < 8) {
        setPhase("hook");
        hookT.current = 0;
        setBanner("Hooking up the tow… stay close!");
      }
    } else if (ph === "hook") {
      if (dist2(p.pos.x, p.pos.z, t.x, t.z) < 10) {
        hookT.current += dt;
        setHookPct(Math.min(1, hookT.current / HOOK_SEC));
        if (hookT.current >= HOOK_SEC) {
          setPhase("tow");
          setBanner(`Hooked! Tow it to the ${DEPOT.name} (${fmtDist(dist2(t.x, t.z, DEPOT.x, DEPOT.z))})`);
          pushToast("Vehicle hooked", "info");
        }
      } else {
        hookT.current = 0;
        setHookPct(0);
        setPhase("find");
        setBanner("Lost the hook — get back to the car");
      }
    } else if (ph === "tow") {
      // tow the prop behind the player
      const fx = Math.sin(p.heading);
      const fz = Math.cos(p.heading);
      const gx = p.pos.x - fx * 8;
      const gz = p.pos.z - fz * 8;
      const g = t.car.group;
      g.position.x += (gx - g.position.x) * Math.min(1, dt * 5);
      g.position.z += (gz - g.position.z) * Math.min(1, dt * 5);
      g.rotation.y = p.heading;
      if (dist2(g.position.x, g.position.z, DEPOT.x, DEPOT.z) < 12) {
        const towDist = dist2(t.x, t.z, DEPOT.x, DEPOT.z);
        const now = Date.now();
        streakRef.current = now - lastRepoAt.current < 90_000 ? Math.min(5, streakRef.current + 1) : 1;
        lastRepoAt.current = now;
        const mult = 1 + 0.1 * (streakRef.current - 1);
        const base = (120 + (towDist / 10) * 1.2) * levelPayScale("repo") * mult;
        earnCity(base, `Repo — $${t.debt.toLocaleString()} debt cleared`);
        const { leveled } = addXp("repo", 30);
        setRepos((n) => n + 1);
        setStreak(streakRef.current);
        setBanner(`Repo complete! Streak ×${mult.toFixed(1)}${leveled ? " · LEVEL UP!" : ""}`);
        clearTarget();
        setTimeout(() => {
          const w = api.getWorld();
          if (w && targetRef.current === null) newTarget(w.sceneRef);
        }, 1500);
        setPhase("find");
      }
    }
  });

  useEffect(() => {
    return () => {
      clearTarget();
      depotBeacon.current?.dispose();
      depotBeacon.current = null;
    };
  }, []);

  return (
    <JobChrome meta={REPO_META} status={banner} onEnd={onEndShift}>
      <StatRow label="Repos done" value={repos} />
      <StatRow label="Repo level" value={jobLevel("repo")} />
      <StatRow label="Streak" value={streak > 0 ? `×${(1 + 0.1 * (streak - 1)).toFixed(1)} (${streak})` : "—"} accent={streak > 1} />
      {phase === "hook" && (
        <div className="oj-progress">
          <div style={{ width: `${Math.round(hookPct * 100)}%` }} />
        </div>
      )}
      <div className="oj-hint">
        {phase === "find"
          ? "🔴 Find the red REPO beacon and get close to the car."
          : phase === "hook"
            ? "⛓ Hooking — don't let the car out of range."
            : `🟡 Tow the car to the gold beacon at the ${DEPOT.name}.`}
      </div>
      <PremiumButton label="Hydraulic lift" />
    </JobChrome>
  );
}

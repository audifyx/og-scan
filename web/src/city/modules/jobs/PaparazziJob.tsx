/**
 * Paparazzi — snap candid shots of roaming celebrities and sell the roll.
 * Celebs wander the sidewalks (gold diamond markers). Get within 35m and
 * hit Snap: closer shots pay more, but inside 10m they spot you and flee.
 * 12 shots per roll; sell the roll to the tabloid for paper CITY.
 * Additive only: peds wander via walkPedTo; fleeing = teleport away.
 */
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import type { JobMeta, JobProps } from "./types";
import { JobChrome, PremiumButton, StatRow } from "./JobChrome";
import { useWorldTick, dist2, fmtDist, randomSidewalk, getPlayer } from "./world";
import { spawnPed, walkPedTo, idlePed, makeDiamond, makeTextSprite, type Ped } from "./markers";
import { earnCity, addXp, jobLevel, levelPayScale, pushToast, fmtCity } from "./wallet";

export const PAPARAZZI_META: JobMeta = {
  id: "paparazzi",
  name: "Paparazzi",
  icon: "📸",
  tagline: "Candid shots of OrbitXCity's finest.",
  payInfo: "Per shot $80–$600 · sell rolls of 12",
  premium: "Telephoto lens: snap from 80m",
  howTo: "Find a celeb (gold diamond). Get within 35m and Snap — closer is worth more. Too close and they spot you and flee. Fill the roll, sell it to the tabloid.",
};

const ROLL_SIZE = 12;
const SPOT_RADIUS = 10;
const SNAP_RADIUS = 35;

const CELEBS = [
  { name: "Nova Starlet", face: "🤩", base: 120 },
  { name: "DJ Volt", face: "🎧", base: 250 },
  { name: "The Mayor's Kid", face: "🕶️", base: 420 },
];

interface Celeb {
  ped: Ped;
  def: (typeof CELEBS)[number];
  tx: number;
  tz: number;
  pauseT: number;
  cooldownUntil: number;
  diamond: THREE.Mesh;
  tag: THREE.Sprite;
}

interface Shot {
  celeb: string;
  value: number;
}

export default function PaparazziJob({ api, onEndShift }: JobProps) {
  const [shots, setShots] = useState<Shot[]>([]);
  const [rolls, setRolls] = useState(0);
  const [inRange, setInRange] = useState(0);
  const celebsRef = useRef<Celeb[]>([]);
  const shotsRef = useRef<Shot[]>([]);
  const tRef = useRef(0);
  const lastRangeSync = useRef(0);

  const spawnCeleb = (scene: THREE.Scene, def: (typeof CELEBS)[number]): Celeb => {
    const s = randomSidewalk();
    const ped = spawnPed(scene, s.x, s.z, {});
    const diamond = makeDiamond(0xffd23f);
    diamond.position.set(s.x, 2.8, s.z);
    scene.add(diamond);
    const tag = makeTextSprite(`${def.face} ${def.name}`, "#fff", "rgba(120,70,0,0.9)");
    tag.position.set(0, 2.2, 0);
    ped.h.group.add(tag);
    const t = randomSidewalk();
    return { ped, def, tx: t.x, tz: t.z, pauseT: 0, cooldownUntil: 0, diamond, tag };
  };

  useWorldTick(api, (dt, world) => {
    tRef.current += dt;
    const t = tRef.current;
    if (!world) return;
    const scene = world.sceneRef;
    if (celebsRef.current.length === 0) {
      celebsRef.current = CELEBS.map((d) => spawnCeleb(scene, d));
    }
    const p = getPlayer(api);
    if (!p) return;
    let range = 0;
    celebsRef.current.forEach((c) => {
      const d = dist2(p.pos.x, p.pos.z, c.ped.pos.x, c.ped.pos.z);
      if (d < SNAP_RADIUS && Date.now() > c.cooldownUntil) range++;
      // spotted → flee
      if (d < SPOT_RADIUS && Date.now() > c.cooldownUntil) {
        const far = randomSidewalk();
        let tries = 0;
        while (dist2(p.pos.x, p.pos.z, far.x, far.z) < 180 && tries++ < 8) {
          const n = randomSidewalk();
          far.x = n.x;
          far.z = n.z;
        }
        c.ped.pos.set(far.x, 0, far.z);
        c.tx = far.x;
        c.tz = far.z;
        c.cooldownUntil = Date.now() + 8000;
        pushToast(`${c.def.name} spotted you and fled!`, "warn");
      }
      // wander
      if (c.pauseT > 0) {
        c.pauseT -= dt;
        idlePed(c.ped, dt, t);
      } else if (walkPedTo(c.ped, c.tx, c.tz, dt, 2.4)) {
        c.pauseT = 1 + Math.random() * 3;
        const n = randomSidewalk();
        c.tx = n.x;
        c.tz = n.z;
      }
      c.diamond.position.set(c.ped.pos.x, 2.8 + Math.sin(t * 3) * 0.3, c.ped.pos.z);
      c.diamond.rotation.y += dt * 2;
    });
    const now = performance.now();
    if (now - lastRangeSync.current > 500) {
      lastRangeSync.current = now;
      setInRange((prev) => (prev === range ? prev : range));
    }
  });

  useEffect(() => {
    return () => {
      celebsRef.current.forEach((c) => {
        c.ped.dispose();
        c.diamond.parent?.remove(c.diamond);
        (c.diamond.geometry as THREE.BufferGeometry).dispose();
        (c.diamond.material as THREE.Material).dispose();
        c.tag.parent?.remove(c.tag);
        (c.tag.material as THREE.Material).dispose();
      });
      celebsRef.current = [];
    };
  }, []);

  const snap = () => {
    const w = api.getWorld();
    if (!w) return;
    if (shotsRef.current.length >= ROLL_SIZE) {
      pushToast("Roll is full — sell it first", "warn");
      return;
    }
    const p = getPlayer(api);
    if (!p) return;
    const cands = celebsRef.current
      .map((c) => ({ c, d: dist2(p.pos.x, p.pos.z, c.ped.pos.x, c.ped.pos.z) }))
      .filter(({ c, d }) => d < SNAP_RADIUS && Date.now() > c.cooldownUntil)
      .sort((a, b) => a.d - b.d);
    if (cands.length === 0) {
      pushToast("No celeb in range", "warn");
      return;
    }
    const { c, d } = cands[0];
    const value = Math.round(c.def.base * (1.8 - d / SNAP_RADIUS) * levelPayScale("paparazzi"));
    const shot: Shot = { celeb: c.def.name, value };
    shotsRef.current = [...shotsRef.current, shot];
    setShots(shotsRef.current);
    addXp("paparazzi", 12);
    pushToast(`📸 ${c.def.name} — ${fmtCity(value)} shot!`, "cash");
  };

  const sell = () => {
    const list = shotsRef.current;
    if (list.length === 0) return;
    const total = list.reduce((s, x) => s + x.value, 0);
    earnCity(total, `Tabloid roll — ${list.length} shots`);
    addXp("paparazzi", 25);
    setRolls((n) => n + 1);
    shotsRef.current = [];
    setShots([]);
  };

  const rollTotal = shots.reduce((s, x) => s + x.value, 0);

  return (
    <JobChrome meta={PAPARAZZI_META} status={inRange > 0 ? `${inRange} celeb${inRange > 1 ? "s" : ""} in range` : "Hunting celebs…"} onEnd={onEndShift}>
      <StatRow label="Shots" value={`${shots.length}/${ROLL_SIZE}`} />
      <StatRow label="Roll value" value={fmtCity(rollTotal)} accent={rollTotal > 0} />
      <StatRow label="Rolls sold" value={rolls} />
      <StatRow label="Paparazzi level" value={jobLevel("paparazzi")} />
      <div className="oj-row">
        <button className="oj-btn primary" onClick={snap} disabled={shots.length >= ROLL_SIZE || inRange === 0}>
          📸 Snap
        </button>
        <button className="oj-btn" onClick={sell} disabled={shots.length === 0}>
          Sell roll · {fmtCity(rollTotal)}
        </button>
      </div>
      {shots.length > 0 && (
        <div className="oj-hint">
          Latest: {shots[shots.length - 1].celeb} ({fmtCity(shots[shots.length - 1].value)})
        </div>
      )}
      <div className="oj-hint">Gold diamonds mark celebs. Closer = richer shot, but inside {SPOT_RADIUS}m they spot you.</div>
      <PremiumButton label="Telephoto lens" />
    </JobChrome>
  );
}

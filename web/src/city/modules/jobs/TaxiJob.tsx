/**
 * Taxi driver — ferry NPC passengers for fares.
 * Drive (or walk) to the pickup beacon, the fare boards, then deliver them
 * to the drop-off beacon. Fare scales with trip distance + driver level;
 * tips land for fast, smooth-ish trips (arrival under par time).
 * Additive only: never touches player/vehicle control.
 */
import { useEffect, useRef, useState } from "react";
import type * as THREE from "three";
import type { JobMeta, JobProps } from "./types";
import { JobChrome, PremiumButton, StatRow } from "./JobChrome";
import { useWorldTick, dist2, fmtDist, randomSidewalk, districtAt, getPlayer } from "./world";
import { makeBeacon, spawnPed, walkPedTo, idlePed, type Beacon, type Ped } from "./markers";
import { earnCity, addXp, jobLevel, levelPayScale } from "./wallet";

export const TAXI_META: JobMeta = {
  id: "taxi",
  name: "Taxi Driver",
  icon: "🚕",
  tagline: "Ferry fares across OrbitXCity.",
  payInfo: "Per fare: $20 + $1.5/10m · tips for fast trips",
  premium: "Golden livery + 2× surge fares",
  howTo: "Drive or run to the green pickup beacon. The passenger boards, then take them to the orange drop-off beacon. Beat the par time for a tip.",
};

interface Fare {
  ped: Ped;
  px: number;
  pz: number;
  dx: number;
  dz: number;
  dist: number;
  parSec: number;
  name: string;
}

const NAMES = ["Mara", "Dext", "Luna", "Kilo", "Priya", "Jax", "Noa", "Vex", "Romy", "Taj"];

export default function TaxiJob({ api, onEndShift }: JobProps) {
  const [phase, setPhase] = useState<"pickup" | "drop" | "none">("none");
  const [fare, setFare] = useState<Fare | null>(null);
  const [eta, setEta] = useState(0);
  const [trips, setTrips] = useState(0);
  const [banner, setBanner] = useState("Looking for a fare…");
  const fareRef = useRef<Fare | null>(null);
  const propsRef = useRef<{ pickup: Beacon | null; drop: Beacon | null }>({ pickup: null, drop: null });
  const clockRef = useRef(0);
  const tRef = useRef(0);

  // spawn the next fare
  const newFare = (scene: THREE.Scene) => {
    propsRef.current.pickup?.dispose();
    propsRef.current.drop?.dispose();
    fareRef.current?.ped.dispose();
    const s = randomSidewalk();
    // drop-off 300–1200m away
    const dest = randomSidewalk();
    const d = dist2(s.x, s.z, dest.x, dest.z);
    const ped = spawnPed(scene, s.x, s.z, {});
    const pickup = makeBeacon(0x00ff9f);
    pickup.setPos(s.x, s.z);
    scene.add(pickup.group);
    const drop = makeBeacon(0xff9500);
    drop.setPos(dest.x, dest.z);
    scene.add(drop.group);
    propsRef.current = { pickup, drop };
    const name = NAMES[Math.floor(Math.random() * NAMES.length)];
    const f: Fare = { ped, px: s.x, pz: s.z, dx: dest.x, dz: dest.z, dist: d, parSec: Math.max(45, d / 12), name };
    fareRef.current = f;
    setFare(f);
    setPhase("pickup");
    clockRef.current = 0;
    setBanner(`${name} needs a ride from ${districtAt(s.x, s.z)}`);
  };

  useWorldTick(api, (dt, world) => {
    tRef.current += dt;
    const t = tRef.current;
    const pickup = propsRef.current.pickup;
    const drop = propsRef.current.drop;
    pickup?.update(dt);
    drop?.update(dt);
    if (!world) return;
    const f = fareRef.current;
    if (!f) {
      // waiting for world + scene → start first fare
      if (world.sceneRef) newFare(world.sceneRef);
      return;
    }
    const p = getPlayer(api);
    if (!p) return;
    if (phase === "pickup") {
      idlePed(f.ped, dt, t);
      if (dist2(p.pos.x, p.pos.z, f.px, f.pz) < 7) {
        // passenger boards (visually: ped fades into vehicle / vanishes with player)
        f.ped.dispose();
        setPhase("drop");
        clockRef.current = 0;
        propsRef.current.pickup?.dispose();
        propsRef.current.pickup = null;
        setBanner(`${f.name} is aboard — head to ${districtAt(f.dx, f.dz)} (${fmtDist(f.dist)})`);
      }
    } else if (phase === "drop") {
      clockRef.current += dt;
      setEta(clockRef.current);
      if (dist2(p.pos.x, p.pos.z, f.dx, f.dz) < 9) {
        const secs = clockRef.current;
        const base = 20 + (f.dist / 10) * 1.5;
        const tip = secs <= f.parSec ? base * 0.4 : 0;
        const total = earnCity(base * levelPayScale("taxi") + tip, `Fare — ${f.name}`);
        const { leveled } = addXp("taxi", 25);
        setTrips((n) => n + 1);
        setBanner(
          tip > 0
            ? `Fare complete! ${f.name} tipped you. Earned $${Math.round(total).toLocaleString()}`
            : `Fare complete! Earned $${Math.round(total).toLocaleString()} (no tip — too slow)`,
        );
        if (leveled) setBanner((b) => `${b} · LEVEL UP!`);
        setPhase("none");
        setFare(null);
        fareRef.current = null;
        propsRef.current.drop?.dispose();
        propsRef.current.drop = null;
        // next fare shortly
        setTimeout(() => {
          const w = api.getWorld();
          if (w && fareRef.current === null) newFare(w.sceneRef);
        }, 1500);
      }
    }
  });

  useEffect(() => {
    return () => {
      propsRef.current.pickup?.dispose();
      propsRef.current.drop?.dispose();
      fareRef.current?.ped.dispose();
    };
  }, []);

  const target = phase === "pickup" ? fare : phase === "drop" ? { dx: fare?.dx ?? 0, dz: fare?.dz ?? 0, dist: fare?.dist ?? 0 } : null;
  const p = getPlayer(api);
  const dist = fare && p ? (phase === "pickup" ? dist2(p.pos.x, p.pos.z, fare.px, fare.pz) : dist2(p.pos.x, p.pos.z, fare.dx, fare.dz)) : 0;

  return (
    <JobChrome meta={TAXI_META} status={banner} onEnd={onEndShift}>
      <StatRow label="Trips done" value={trips} />
      <StatRow label="Driver level" value={jobLevel("taxi")} />
      {fare && phase === "drop" && (
        <StatRow
          label="Trip timer"
          value={`${Math.round(eta)}s / par ${Math.round(fare.parSec)}s`}
          accent={eta <= fare.parSec}
        />
      )}
      {target && <StatRow label="Distance" value={fmtDist(dist)} />}
      <div className="oj-hint">
        {phase === "pickup"
          ? "🟢 Pick up the passenger at the green beacon."
          : phase === "drop"
            ? "🟠 Deliver them to the orange beacon before the par time."
            : "Cruising… next fare incoming."}
      </div>
      <PremiumButton label="Golden livery" />
    </JobChrome>
  );
}

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import * as THREE from "three";
import { useCity } from "@/pages/orbitxcity/CityProvider";
import { getWorldBlock, getWorldStreets } from "@/lib/orbitxcity/worlds";
import { collidesAt } from "@/lib/orbitxcity/collision";
import type { CityId } from "@/lib/orbitxcity/types";
import { currentObjective } from "@/lib/orbitxcity/missions";
import { useMissionStore } from "@/lib/orbitxcity/missionStore";
import { useEconomyStore } from "@/lib/orbitxcity/economyStore";
import {
  RECKLESS_SPEED,
  readVehicleTelemetry,
  useGameStore,
} from "@/lib/orbitxcity/gameStore";
import { getLiveNpcPositions } from "./NPCs";
import { cityAudio } from "@/lib/orbitxcity/cityAudio";
import { CityCarMesh } from "./CityCarMesh";
import { toast } from "sonner";

/**
 * OrbitX City — mission markers + gameplay director (Worker 3).
 *
 * Single exported component mounted inside the R3F canvas by the
 * coordinator (CityShell/WorldCanvas). It renders:
 *  - green start beacons for each available mission (no active run)
 *  - a gold objective beacon for the active mission's current objective
 *  - pursuing cop cars when heat is maxed
 * and runs the per-frame director: motion estimate, crash damage, reckless
 * heat, mission proximity/timers, collector progress, cop chase + busts.
 */

const CRASH_SPEED = 9; // m/s — sudden stop above this = collision damage
const BUST_DIST = 3.4;
const BUST_HOLD = 1.2; // seconds a cop must hold you to bust

function nearestStreetPoint(x: number, z: number, cityId: CityId): { x: number; z: number } {
  const streets = getWorldStreets(cityId);
  let best = { x, z };
  let bestD = Infinity;
  for (const s of streets) {
    const t = Math.max(s.from, Math.min(s.to, s.o === "h" ? x : z));
    const px = s.o === "h" ? t : s.at;
    const pz = s.o === "h" ? s.at : t;
    const d = Math.hypot(px - x, pz - z);
    if (d < bestD) {
      bestD = d;
      best = { x: px, z: pz };
    }
  }
  return best;
}

function BeaconPillar({
  x,
  z,
  color,
  height = 26,
  radius = 1.1,
  pulse = true,
}: {
  x: number;
  z: number;
  color: string;
  height?: number;
  radius?: number;
  pulse?: boolean;
}) {
  const mat = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(({ clock }) => {
    if (!mat.current || !pulse) return;
    const t = clock.elapsedTime;
    mat.current.opacity = 0.28 + Math.sin(t * 3.2) * 0.12;
  });
  return (
    <mesh position={[x, height / 2, z]}>
      <cylinderGeometry args={[radius, radius * 1.6, height, 12, 1, true]} />
      <meshBasicMaterial
        ref={mat}
        color={color}
        transparent
        opacity={0.32}
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  );
}

function FloatingTag({
  x,
  z,
  y = 4.2,
  icon,
  label,
  color,
}: {
  x: number;
  z: number;
  y?: number;
  icon: string;
  label: string;
  color: string;
}) {
  const g = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!g.current) return;
    g.current.position.y = y + Math.sin(clock.elapsedTime * 2.4) * 0.35;
  });
  return (
    <group ref={g} position={[x, y, z]}>
      <Text fontSize={0.9} anchorX="center" anchorY="middle">
        {icon}
      </Text>
      <Text
        position={[0, -0.85, 0]}
        fontSize={0.34}
        color={color}
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.06}
        outlineColor="#04070f"
      >
        {label}
      </Text>
    </group>
  );
}

function StartBeacons() {
  const defs = useMissionStore((s) => s.defs);
  const active = useMissionStore((s) => s.active);
  if (active) return null;
  return (
    <group>
      {defs.map((d) => (
        <group key={d.id}>
          <BeaconPillar x={d.start.x} z={d.start.z} color="#17ff4d" height={18} radius={0.8} />
          <FloatingTag x={d.start.x} z={d.start.z} y={3.4} icon="❗" label={d.name} color="#17ff4d" />
          <mesh position={[d.start.x, 0.06, d.start.z]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[1.2, 1.7, 28]} />
            <meshBasicMaterial color="#17ff4d" transparent opacity={0.8} side={THREE.DoubleSide} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function ObjectiveBeacon() {
  const defs = useMissionStore((s) => s.defs);
  const active = useMissionStore((s) => s.active);
  const ring = useRef<THREE.Mesh>(null);
  const def = defs.find((d) => d.id === active?.defId);
  const obj = def && active ? currentObjective(def, active) : null;
  useFrame(({ clock }) => {
    if (!ring.current) return;
    const t = (clock.elapsedTime * 1.6) % 1;
    const s = 1 + t * 1.6;
    ring.current.scale.set(s, s, 1);
    (ring.current.material as THREE.MeshBasicMaterial).opacity = 0.85 * (1 - t);
  });
  if (!def || !active || !obj) return null;
  const icon = obj.kind === "pickup" ? "🧍" : obj.kind === "collect" ? "💠" : def.icon;
  return (
    <group>
      <BeaconPillar x={obj.x} z={obj.z} color={def.color} />
      <FloatingTag x={obj.x} z={obj.z} icon={icon} label={obj.label} color={def.color} />
      <mesh ref={ring} position={[obj.x, 0.08, obj.z]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[obj.radius * 0.7, obj.radius * 0.7 + 0.5, 32]} />
        <meshBasicMaterial color={def.color} transparent opacity={0.8} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[obj.x, 0.05, obj.z]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[obj.radius * 0.7, 32]} />
        <meshBasicMaterial color={def.color} transparent opacity={0.12} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

interface CopSim {
  id: string;
  x: number;
  z: number;
  yaw: number;
}

function CopCars() {
  const cops = useGameStore((s) => s.cops);
  const sims = useRef<CopSim[]>([]);
  // Keep a render-side copy synced from the sim array each frame.
  useFrame(() => {
    const arr = sims.current;
    while (arr.length < cops.length) {
      const c = cops[arr.length];
      if (c) arr.push({ id: c.id, x: c.x, z: c.z, yaw: 0 });
    }
    if (arr.length > cops.length) arr.length = cops.length;
    for (let i = 0; i < arr.length; i++) {
      const target = cops[i];
      const sim = arr[i];
      if (!target || !sim) continue;
      sim.id = target.id;
      const dx = target.x - sim.x;
      const dz = target.z - sim.z;
      const d = Math.hypot(dx, dz);
      if (d > 0.05) {
        const step = Math.min(d, 16 * 0.016);
        sim.x += (dx / d) * step;
        sim.z += (dz / d) * step;
        sim.yaw = Math.atan2(dx, dz);
      }
    }
  });
  return (
    <group>
      {cops.map((c, i) => {
        const sim = sims.current[i] ?? { x: c.x, z: c.z, yaw: 0 };
        return (
          <group key={c.id} position={[sim.x, 0, sim.z]} rotation={[0, sim.yaw, 0]}>
            <CityCarMesh glow={i % 2 === 0 ? "#ff2d2d" : "#2d7dff"} body="#0d1117" />
            <pointLight color={i % 2 === 0 ? "#ff2d2d" : "#2d7dff"} intensity={6} distance={9} position={[0, 1.6, 0]} />
          </group>
        );
      })}
    </group>
  );
}

/** Per-frame gameplay director — motion, damage, heat, missions, cops. */
function MissionDirector() {
  const { playerPos, selectedCityId, shards, teleport } = useCity();
  const setCity = useMissionStore((s) => s.setCity);
  const playerRef = useRef(playerPos);
  playerRef.current = playerPos;
  const shardsRef = useRef(shards);
  shardsRef.current = shards;

  const motion = useRef({ x: playerPos.x, z: playerPos.z, t: performance.now(), speed: 0 });
  const lastMotionSync = useRef(0);
  const lastCrashAt = useRef(0);
  const lastRecklessAt = useRef(0);
  const copsSim = useRef<CopSim[]>([]);
  const bustHold = useRef(0);
  const lastCopSync = useRef(0);

  useEffect(() => {
    setCity(selectedCityId);
  }, [selectedCityId, setCity]);

  const doBusted = (spawn: { x: number; z: number }) => {
    const econ = useEconomyStore.getState();
    const fine = Math.max(25, Math.round(econ.credits * 0.15));
    econ.spendCredits(fine, "Busted — police impound");
    useMissionStore.getState().abortMission(false);
    useGameStore.getState().respawn();
    copsSim.current = [];
    bustHold.current = 0;
    cityAudio.play("error");
    toast.error("BUSTED", { description: `Cops impounded ${fine} credits. Mission void.` });
    teleport(spawn.x, spawn.z);
  };

  useFrame((_, rawDt) => {
    const dt = Math.min(Math.max(rawDt, 0.0001), 0.1);
    const game = useGameStore.getState();
    if (game.paused || game.gameOver) return;

    const p = playerRef.current;
    const now = performance.now();

    // --- Motion estimate (m/s), smoothed ---
    const m = motion.current;
    const mdt = Math.max((now - m.t) / 1000, 0.001);
    const rawSpeed = Math.hypot(p.x - m.x, p.z - m.z) / mdt;
    const telemetry = readVehicleTelemetry();
    const estSpeed = telemetry.speed ?? rawSpeed;
    const prevSpeed = m.speed;
    m.speed = m.speed + (estSpeed - m.speed) * Math.min(1, dt * 6);
    m.x = p.x;
    m.z = p.z;
    m.t = now;
    const speed = m.speed;
    if (now - lastMotionSync.current > 200) {
      lastMotionSync.current = now;
      useGameStore.getState().setMotion(speed, telemetry.inCar || speed > 13);
    }
    game.tick(dt);

    // --- Crash: fast then sudden stop = collision damage ---
    if (prevSpeed > CRASH_SPEED && speed < 2.5 && now - lastCrashAt.current > 2000) {
      lastCrashAt.current = now;
      const dmg = Math.round(10 + prevSpeed * 0.7);
      useGameStore.getState().damage(dmg);
      useGameStore.getState().addHeat(8);
      cityAudio.play("error");
      toast.warning("Crash!", { description: `-${dmg} HP` });
    }

    // --- Reckless: high speed near a pedestrian ---
    if (speed > RECKLESS_SPEED && now - lastRecklessAt.current > 2500) {
      const npcs = getLiveNpcPositions();
      const near = npcs.some((n) => Math.hypot(n.x - p.x, n.z - p.z) < 7);
      if (near) {
        lastRecklessAt.current = now;
        useGameStore.getState().addHeat(10);
        toast.warning("Reckless driving!", { description: "Slow down near pedestrians." });
      }
    }

    // --- Mission tick ---
    const ms = useMissionStore.getState();
    if (ms.active) {
      const def = ms.defs.find((d) => d.id === ms.active!.defId);
      if (!def) {
        ms.abortMission(false);
      } else {
        if (ms.active.deadline > 0 && Date.now() > ms.active.deadline) {
          ms.abortMission(true);
          toast.error("Mission failed", { description: `${def.name} — out of time.` });
        } else {
          const obj = currentObjective(def, ms.active);
          if (obj) {
            if (obj.kind === "collect" && obj.count) {
              const got = Math.max(0, shardsRef.current - ms.active.shardsAtStart);
              ms.setProgress(got);
            } else {
              const d = Math.hypot(obj.x - p.x, obj.z - p.z);
              if (d <= obj.radius) {
                if (obj.kind === "pickup") {
                  toast.success("Fare picked up", { description: "Now run them to the destination." });
                } else if (obj.kind === "dropoff") {
                  toast.success("Delivered!", { description: def.name });
                }
                ms.advanceObjective();
                // advanceObjective may complete the mission; report payout
                if (!useMissionStore.getState().active) {
                  toast.success("Mission complete", { description: `+${def.payout} credits` });
                }
              }
            }
          }
        }
      }
    }

    // --- Cops ---
    const heat = useGameStore.getState().heat;
    const stars = Math.ceil(heat / 20);
    const block = getWorldBlock(selectedCityId);
    if (stars >= 4) {
      if (copsSim.current.length === 0) {
        for (let i = 0; i < 2; i++) {
          const a = (i / 2) * Math.PI * 2 + 0.7;
          const sx = p.x + Math.cos(a) * 30;
          const sz = p.z + Math.sin(a) * 30;
          const sp = nearestStreetPoint(sx, sz, selectedCityId);
          copsSim.current.push({ id: `cop-${i}`, x: sp.x, z: sp.z, yaw: 0 });
        }
        toast.error("WANTED", { description: "Cops are on your tail — lose them or get busted." });
        cityAudio.play("error");
      }
      let busted = false;
      for (const cop of copsSim.current) {
        const dx = p.x - cop.x;
        const dz = p.z - cop.z;
        const d = Math.hypot(dx, dz) || 1;
        const copSpeed = d > 5 ? 13.5 : 6;
        const nx = cop.x + (dx / d) * copSpeed * dt;
        const nz = cop.z + (dz / d) * copSpeed * dt;
        // Simple obstacle slide: try straight, then angled alternatives.
        const tryMove = (mx: number, mz: number) => !collidesAt(mx, mz, 1, block);
        if (tryMove(nx, nz)) {
          cop.x = nx;
          cop.z = nz;
        } else {
          const ang = Math.atan2(dx, dz);
          for (const off of [0.6, -0.6, 1.2, -1.2]) {
            const ax = cop.x + Math.sin(ang + off) * copSpeed * dt;
            const az = cop.z + Math.cos(ang + off) * copSpeed * dt;
            if (tryMove(ax, az)) {
              cop.x = ax;
              cop.z = az;
              break;
            }
          }
        }
        cop.yaw = Math.atan2(dx, dz);
        if (d < BUST_DIST && speed < 3) busted = true;
      }
      if (busted) {
        bustHold.current += dt;
        if (bustHold.current >= BUST_HOLD) {
          doBusted(block.spawn);
          return;
        }
      } else {
        bustHold.current = Math.max(0, bustHold.current - dt);
      }
      if (now - lastCopSync.current > 250) {
        lastCopSync.current = now;
        useGameStore
          .getState()
          .setCops(copsSim.current.map((c) => ({ id: c.id, x: c.x, z: c.z })));
      }
    } else if (copsSim.current.length > 0 && heat < 30) {
      copsSim.current = [];
      bustHold.current = 0;
      useGameStore.getState().setCops([]);
    }
  });

  return null;
}

/**
 * Mounted once inside the 3D canvas. Renders beacons + cops and runs the
 * gameplay director. Reads missionStore / gameStore / economyStore directly.
 */
export function MissionMarkers() {
  const defs = useMissionStore((s) => s.defs);
  const ready = defs.length > 0;
  // Render nothing until the city-synced defs exist (director sets them).
  void ready;
  return (
    <group>
      <MissionDirector />
      <StartBeacons />
      <ObjectiveBeacon />
      <CopCars />
    </group>
  );
}

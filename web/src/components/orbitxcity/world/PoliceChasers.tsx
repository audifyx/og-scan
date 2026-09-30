/**
 * Police chasers — when the player is wanted, cop cars hunt them down.
 * Spawn near the player, pursue with simple steering, ram on contact.
 * They back off once the heat dies.
 */
import { useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { WorldBlockConfig } from "@/lib/orbitxcity/types";
import { NYC_DEMO_BLOCK } from "@/lib/orbitxcity/demoBlock";
import { useCity } from "@/pages/orbitxcity/CityProvider";
import { collidesAt, mulberry32 } from "@/lib/orbitxcity/collision";
import { CityCarMesh } from "./CityCarMesh";
import { getPoliceStore } from "@/city/modules/police/store";

interface Chaser {
  x: number;
  z: number;
  yaw: number;
  speed: number;
  active: boolean;
}

const MAX_CHASERS = 3;
const CHASE_SPEED = 17;
const RAM_RADIUS = 2.2;

export function PoliceChasers({ block = NYC_DEMO_BLOCK }: { block?: WorldBlockConfig }) {
  const { playerPos } = useCity();
  const playerRef = useRef(playerPos);
  playerRef.current = playerPos;
  const [tick, setTick] = useState(0);
  const chasers = useRef<Chaser[]>([]);
  const groups = useRef<Array<THREE.Group | null>>([]);
  const sirenPhase = useRef(0);

  const rand = useMemo(() => mulberry32(0xc0p), []);

  useFrame(({ clock }, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    let stars = 0;
    try {
      stars = getPoliceStore().stars;
    } catch {
      return;
    }

    const px = playerRef.current.x;
    const pz = playerRef.current.z;
    const want = Math.min(MAX_CHASERS, stars);

    // Spawn / despawn to match wanted level.
    while (chasers.current.filter((c) => c.active).length < want) {
      const a = rand() * Math.PI * 2;
      const d = 28 + rand() * 14;
      const x = px + Math.cos(a) * d;
      const z = pz + Math.sin(a) * d;
      if (collidesAt(x, z, 1.2, block)) continue;
      chasers.current.push({ x, z, yaw: Math.atan2(px - x, pz - z), speed: 0, active: true });
      setTick((t) => t + 1);
    }
    if (want === 0 && chasers.current.some((c) => c.active)) {
      chasers.current.forEach((c) => (c.active = false));
      setTick((t) => t + 1);
    }

    // Siren light flash.
    sirenPhase.current += dt * 10;

    chasers.current.forEach((c, i) => {
      const g = groups.current[i];
      if (!c.active || !g) return;

      // Steer toward the player.
      const dx = px - c.x;
      const dz = pz - c.z;
      const dist = Math.hypot(dx, dz) || 1;
      const targetYaw = Math.atan2(dx, dz);
      let dy = targetYaw - c.yaw;
      while (dy > Math.PI) dy -= Math.PI * 2;
      while (dy < -Math.PI) dy += Math.PI * 2;
      c.yaw += dy * Math.min(1, dt * 3.2);

      // Speed up when far, ease off when close (ramming range).
      const targetSpeed = dist > RAM_RADIUS ? CHASE_SPEED : CHASE_SPEED * 0.5;
      c.speed += Math.sign(targetSpeed - c.speed) * Math.min(Math.abs(targetSpeed - c.speed), 12 * dt);

      const nx = c.x + Math.sin(c.yaw) * c.speed * dt;
      const nz = c.z + Math.cos(c.yaw) * c.speed * dt;
      if (!collidesAt(nx, nz, 1.1, block)) {
        c.x = nx;
        c.z = nz;
      } else {
        // Nudge around obstacles.
        c.yaw += dt * 2.5;
        c.speed *= 0.6;
      }

      g.position.set(c.x, 0, c.z);
      g.rotation.y = c.yaw;
    });
  });

  const active = chasers.current.filter((c) => c.active);
  void tick;

  return (
    <group>
      {active.map((c, i) => (
        <group
          key={i}
          ref={(el) => {
            groups.current[i] = el;
          }}
          position={[c.x, 0, c.z]}
          rotation={[0, c.yaw, 0]}
        >
          <CityCarMesh glow="#ff2a2a" body="#1a2a4a" />
          {/* Siren strobes */}
          <mesh position={[-0.45, 1.05, 0]}>
            <boxGeometry args={[0.28, 0.14, 0.3]} />
            <meshStandardMaterial
              color={Math.sin(sirenPhase.current) > 0 ? "#ff2222" : "#440000"}
              emissive={Math.sin(sirenPhase.current) > 0 ? "#ff2222" : "#220000"}
              emissiveIntensity={2.4}
            />
          </mesh>
          <mesh position={[0.45, 1.05, 0]}>
            <boxGeometry args={[0.28, 0.14, 0.3]} />
            <meshStandardMaterial
              color={Math.sin(sirenPhase.current) > 0 ? "#000044" : "#2244ff"}
              emissive={Math.sin(sirenPhase.current) > 0 ? "#000044" : "#2244ff"}
              emissiveIntensity={2.4}
            />
          </mesh>
          <pointLight
            position={[0, 1.6, 0]}
            color={Math.sin(sirenPhase.current) > 0 ? "#ff3333" : "#3355ff"}
            intensity={6}
            distance={14}
            decay={2}
          />
        </group>
      ))}
    </group>
  );
}

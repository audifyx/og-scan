/**
 * Street-bound traffic — cars drive along getWorldStreets() lanes (no random loops).
 */
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Clone, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import type { StreetSegment, WorldBlockConfig } from "@/lib/orbitxcity/types";
import { getWorldStreets } from "@/lib/orbitxcity/worlds";
import { useCity } from "@/pages/orbitxcity/CityProvider";

interface LaneCar {
  /** Normalized progress along the segment [0,1). */
  phase: number;
  speed: number;
  reverse: boolean;
  glow: string;
  segmentIndex: number;
}

const GLOWS = ["#3de7ff", "#ff4d9a", "#17ff4d", "#f5c542", "#a78bfa", "#ff6b35"];

function segmentLength(s: StreetSegment): number {
  return Math.abs(s.to - s.from);
}

function pointOnSegment(
  s: StreetSegment,
  t: number,
  reverse: boolean,
  laneOffset = 0,
): { x: number; z: number; yaw: number } {
  const u = reverse ? 1 - t : t;
  const a = s.from + (s.to - s.from) * u;
  // Opposite travel sits in the opposite lane half
  const lane = (reverse ? -1 : 1) * Math.min(1.1, s.w * 0.22) + laneOffset;
  if (s.o === "h") {
    return { x: a, z: s.at + lane, yaw: reverse ? -Math.PI / 2 : Math.PI / 2 };
  }
  return { x: s.at + lane, z: a, yaw: reverse ? Math.PI : 0 };
}

function StreetCar({
  segment,
  phase,
  speed,
  reverse,
  glow,
}: {
  segment: StreetSegment;
  phase: number;
  speed: number;
  reverse: boolean;
  glow: string;
}) {
  const group = useRef<THREE.Group>(null);
  const t = useRef(phase);
  const { scene } = useGLTF("/orbitxcity/models/citybits/car_sedan.gltf");
  const len = Math.max(8, segmentLength(segment));

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    t.current = (t.current + (speed * dt) / len) % 1;
    const p = pointOnSegment(segment, t.current, reverse);
    if (!group.current) return;
    // Sit on asphalt — no hover bob
    group.current.position.set(p.x, 0.38, p.z);
    let dy = p.yaw - group.current.rotation.y;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    group.current.rotation.y += dy * Math.min(1, dt * 10);
  });

  return (
    <group ref={group}>
      <Clone object={scene} scale={[14, 7, 14]} position={[0, 0.18, 0]} castShadow receiveShadow />
      <mesh position={[0, 0.02, 1.02]}>
        <boxGeometry args={[0.6, 0.08, 0.05]} />
        <meshBasicMaterial color="#e8f4ff" toneMapped={false} />
      </mesh>
      <mesh position={[0, 0.02, -1.02]}>
        <boxGeometry args={[0.6, 0.08, 0.05]} />
        <meshBasicMaterial color="#ff3b3b" toneMapped={false} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.18, 0]}>
        <planeGeometry args={[1.1, 2.1]} />
        <meshBasicMaterial color={glow} transparent opacity={0.18} toneMapped={false} />
      </mesh>
    </group>
  );
}

useGLTF.preload("/orbitxcity/models/citybits/car_sedan.gltf");

/** Ambient traffic locked to city street segments. */
export function Traffic({ count = 6, block }: { count?: number; block?: WorldBlockConfig }) {
  const { selectedCityId } = useCity();
  const streets = useMemo(
    () => getWorldStreets(block?.cityId ?? selectedCityId).filter((s) => segmentLength(s) >= 12),
    [block?.cityId, selectedCityId],
  );

  const cars = useMemo<LaneCar[]>(() => {
    if (!streets.length) return [];
    const sorted = [...streets].sort((a, b) => segmentLength(b) - segmentLength(a));
    const n = Math.max(1, Math.min(count, sorted.length * 2, 14));
    const out: LaneCar[] = [];
    for (let i = 0; i < n; i++) {
      const segmentIndex = i % sorted.length;
      out.push({
        segmentIndex,
        phase: (i * 0.17) % 1,
        speed: 6.5 + (i % 4) * 1.2,
        reverse: i % 2 === 1,
        glow: GLOWS[i % GLOWS.length]!,
      });
    }
    return out;
  }, [streets, count]);

  if (!cars.length) return null;

  const sorted = [...streets].sort((a, b) => segmentLength(b) - segmentLength(a));

  return (
    <group>
      {cars.map((c, i) => {
        const segment = sorted[c.segmentIndex]!;
        return (
          <StreetCar
            key={i}
            segment={segment}
            phase={c.phase}
            speed={c.speed}
            reverse={c.reverse}
            glow={c.glow}
          />
        );
      })}
    </group>
  );
}

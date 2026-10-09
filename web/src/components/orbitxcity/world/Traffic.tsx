/**
 * Street-bound traffic — procedural cars stay in lanes, avoid buildings and the player.
 */
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { StreetSegment, WorldBlockConfig } from "@/lib/orbitxcity/types";
import { getWorldStreets } from "@/lib/orbitxcity/worlds";
import { collidesAt } from "@/lib/orbitxcity/collision";
import { useCity } from "@/pages/orbitxcity/CityProvider";
import { CITY_CAR_BODIES, CITY_CAR_GLOWS, CityCarMesh } from "./CityCarMesh";

interface LaneCar {
  phase: number;
  speed: number;
  reverse: boolean;
  glow: string;
  segmentIndex: number;
  body: string;
}

function segmentLength(s: StreetSegment): number {
  return Math.abs(s.to - s.from);
}

function pointOnSegment(
  s: StreetSegment,
  t: number,
  reverse: boolean,
): { x: number; z: number; yaw: number } {
  const u = reverse ? 1 - t : t;
  const a = s.from + (s.to - s.from) * u;
  const lane = (reverse ? -1 : 1) * Math.min(1.05, s.w * 0.2);
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
  body,
  block,
  paused,
}: {
  segment: StreetSegment;
  phase: number;
  speed: number;
  reverse: boolean;
  glow: string;
  body: string;
  block: WorldBlockConfig;
  paused: boolean;
}) {
  const group = useRef<THREE.Group>(null);
  const t = useRef(phase);
  const dir = useRef(reverse ? -1 : 1);
  const len = Math.max(10, segmentLength(segment));
  const { playerPos } = useCity();
  const playerRef = useRef(playerPos);
  playerRef.current = playerPos;

  useFrame((_, rawDt) => {
    if (paused || !group.current) return;
    const dt = Math.min(rawDt, 0.05);
    const nextT = (t.current + (dir.current * speed * dt) / len + 1) % 1;
    const p = pointOnSegment(segment, nextT, dir.current < 0);
    const dx = p.x - playerRef.current.x;
    const dz = p.z - playerRef.current.z;
    if (dx * dx + dz * dz < 10) {
      return;
    }
    if (collidesAt(p.x, p.z, 0.85, block)) {
      dir.current *= -1;
      return;
    }
    t.current = nextT;
    group.current.position.set(p.x, 0, p.z);
    let dy = p.yaw - group.current.rotation.y;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    group.current.rotation.y += dy * Math.min(1, dt * 10);
  });

  const start = pointOnSegment(segment, phase, reverse);
  return (
    <group ref={group} position={[start.x, 0, start.z]} rotation={[0, start.yaw, 0]}>
      <CityCarMesh glow={glow} body={body} />
    </group>
  );
}

/** Ambient traffic locked to city street segments. */
export function Traffic({
  count = 6,
  block,
  paused = false,
}: {
  count?: number;
  block?: WorldBlockConfig;
  paused?: boolean;
}) {
  const { selectedCityId, quality } = useCity();
  const streets = useMemo(
    () => getWorldStreets(block?.cityId ?? selectedCityId).filter((s) => segmentLength(s) >= 12),
    [block?.cityId, selectedCityId],
  );

  const cars = useMemo<LaneCar[]>(() => {
    if (!streets.length) return [];
    const sorted = [...streets].sort((a, b) => segmentLength(b) - segmentLength(a));
    const cap = quality === "high" ? 12 : 4;
    const n = Math.max(1, Math.min(count, sorted.length * 2, cap));
    const out: LaneCar[] = [];
    for (let i = 0; i < n; i++) {
      out.push({
        segmentIndex: i % sorted.length,
        phase: (i * 0.19) % 1,
        speed: 5.4 + (i % 4) * 0.9,
        reverse: i % 2 === 1,
        glow: CITY_CAR_GLOWS[i % CITY_CAR_GLOWS.length]!,
        body: CITY_CAR_BODIES[i % CITY_CAR_BODIES.length]!,
      });
    }
    return out;
  }, [streets, count, quality]);

  if (!cars.length || !block) return null;

  const sorted = [...streets].sort((a, b) => segmentLength(b) - segmentLength(a));

  return (
    <group>
      {cars.map((c, i) => {
        const segment = sorted[c.segmentIndex];
        if (!segment) return null;
        return (
          <StreetCar
            key={i}
            segment={segment}
            phase={c.phase}
            speed={c.speed}
            reverse={c.reverse}
            glow={c.glow}
            body={c.body}
            block={block}
            paused={paused}
          />
        );
      })}
    </group>
  );
}

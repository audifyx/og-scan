import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Clone, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import type { CityId, StreetSegment } from "@/lib/orbitxcity/types";
import { getWorldStreets } from "@/lib/orbitxcity/worlds";

interface CarSpec {
  street: StreetSegment;
  speed: number;
  phase: number;
  glow: string;
  reverse: boolean;
  laneOffset: number;
}

const GLOWS = ["#5b8def", "#5bc48a", "#c5a26f", "#f2f5f7"];

function buildCars(cityId: CityId, count: number): CarSpec[] {
  const usable = getWorldStreets(cityId).filter((street) => Math.abs(street.to - street.from) > 20);
  if (!usable.length) return [];
  return Array.from({ length: Math.min(count, usable.length) }, (_, index) => {
    const street = usable[(index * 3) % usable.length]!;
    const lane = Math.max(0.65, Math.min(1.35, street.w * 0.2));
    return {
      street,
      speed: 5.2 + (index % 4) * 0.8,
      phase: (index * 0.173) % 1,
      glow: GLOWS[index % GLOWS.length]!,
      reverse: index % 2 === 1,
      laneOffset: index % 2 === 1 ? -lane : lane,
    };
  });
}

function pointOnStreet(spec: CarSpec, progress: number) {
  const { street, reverse, laneOffset } = spec;
  const t = reverse ? 1 - progress : progress;
  const along = THREE.MathUtils.lerp(street.from, street.to, t);
  if (street.o === "h") {
    return { x: along, z: street.at + laneOffset, yaw: reverse ? -Math.PI / 2 : Math.PI / 2 };
  }
  return { x: street.at + laneOffset, z: along, yaw: reverse ? 0 : Math.PI };
}

function RoadCar({ spec }: { spec: CarSpec }) {
  const group = useRef<THREE.Group>(null);
  const progress = useRef(spec.phase);
  const { scene } = useGLTF("/orbitxcity/models/citybits/car_sedan.gltf");
  const distance = Math.max(1, Math.abs(spec.street.to - spec.street.from));

  useFrame(({ clock }, rawDt) => {
    progress.current = (progress.current + (spec.speed * Math.min(rawDt, 0.05)) / distance) % 1;
    const point = pointOnStreet(spec, progress.current);
    if (!group.current) return;
    group.current.position.set(point.x, 0.42 + Math.sin(clock.elapsedTime * 4 + spec.phase * 8) * 0.025, point.z);
    group.current.rotation.y = point.yaw;
  });

  return (
    <group ref={group}>
      <Clone object={scene} scale={[14, 7, 14]} position={[0, 0.18, 0]} castShadow receiveShadow />
      <mesh position={[0, 0.02, 1.02]}>
        <boxGeometry args={[0.6, 0.08, 0.05]} />
        <meshBasicMaterial color="#f2f5f7" toneMapped={false} />
      </mesh>
      <mesh position={[0, 0.02, -1.02]}>
        <boxGeometry args={[0.6, 0.08, 0.05]} />
        <meshBasicMaterial color="#ff4d6a" toneMapped={false} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.2, 0]}>
        <planeGeometry args={[1.2, 2.3]} />
        <meshBasicMaterial color={spec.glow} transparent opacity={0.22} toneMapped={false} />
      </mesh>
    </group>
  );
}

useGLTF.preload("/orbitxcity/models/citybits/car_sedan.gltf");

/** Road-bound ambient traffic generated from each city's rendered street segments. */
export function Traffic({ cityId, count = 4 }: { cityId: CityId; count?: number }) {
  const cars = useMemo(() => buildCars(cityId, Math.max(1, Math.min(count, 8))), [cityId, count]);
  return (
    <group>
      {cars.map((car, index) => <RoadCar key={`${cityId}-${index}`} spec={car} />)}
    </group>
  );
}

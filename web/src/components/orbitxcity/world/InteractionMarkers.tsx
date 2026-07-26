import { useFrame } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import { useRef } from "react";
import * as THREE from "three";
import type { InteractionZone, Vec3 } from "@/lib/orbitxcity/types";

const KIND_COLOR: Record<string, string> = {
  marketplace: "#c4a574",
  launch: "#b8a878",
  trading: "#7a92a0",
  community: "#8a7a90",
  hq: "#6a8f6e",
  billboard: "#7a92a0",
  token: "#6a8f6e",
};

export function InteractionMarkers({
  zones,
  playerPos,
  activeZoneId,
  onNearest,
}: {
  zones: InteractionZone[];
  playerPos: Vec3;
  activeZoneId: string | null;
  onNearest: (zone: InteractionZone | null) => void;
}) {
  const lastId = useRef<string | null>(null);

  useFrame(() => {
    let best: InteractionZone | null = null;
    let bestDist = Infinity;
    for (const z of zones) {
      const d = Math.hypot(playerPos.x - z.position.x, playerPos.z - z.position.z);
      if (d <= z.radius && d < bestDist) {
        best = z;
        bestDist = d;
      }
    }
    const id = best?.id ?? null;
    if (id !== lastId.current) {
      lastId.current = id;
      onNearest(best);
    }
  });

  return (
    <group>
      {zones.map((z) => (
        <ZoneMarker key={z.id} zone={z} active={activeZoneId === z.id} />
      ))}
    </group>
  );
}

function ZoneMarker({ zone, active }: { zone: InteractionZone; active: boolean }) {
  const color = KIND_COLOR[zone.kind] ?? "#17ff4d";
  const ring = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (!ring.current) return;
    const s = 1 + Math.sin(clock.elapsedTime * 3) * (active ? 0.12 : 0.04);
    ring.current.scale.setScalar(s);
  });

  return (
    <group position={[zone.position.x, 0.05, zone.position.z]}>
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[zone.radius * 0.55, zone.radius * 0.7, 48]} />
        <meshStandardMaterial
          color={color}
          transparent
          opacity={active ? 0.42 : 0.16}
          metalness={0.1}
          roughness={0.65}
        />
      </mesh>
      {active && (
        <>
          <mesh position={[0, 2.55, 0]}>
            <torusGeometry args={[0.55, 0.035, 8, 32]} />
            <meshStandardMaterial color="#8fbf8a" emissive="#6a8f6e" emissiveIntensity={0.4} metalness={0.2} roughness={0.4} />
          </mesh>
          <Text position={[0, 3.15, 0]} fontSize={0.28} color="#d8e8d6" anchorX="center" outlineWidth={0.02} outlineColor="#1a221c">
            SAFE ZONE
          </Text>
          <Text position={[0, 2.15, 0]} fontSize={0.34} color="#eef2f4" anchorX="center" outlineWidth={0.022} outlineColor="#12161a">
            [E] {zone.label}
          </Text>
        </>
      )}
    </group>
  );
}

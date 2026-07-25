import { useFrame } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import { useRef } from "react";
import * as THREE from "three";
import type { InteractionZone, Vec3 } from "@/lib/orbitxcity/types";

const KIND_COLOR: Record<string, string> = {
  marketplace: "#ff4d9a",
  launch: "#f5c542",
  trading: "#3de7ff",
  community: "#a78bfa",
  hq: "#17ff4d",
  billboard: "#17ff4d",
  token: "#17ff4d",
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
        <meshBasicMaterial color={color} transparent opacity={active ? 0.55 : 0.22} />
      </mesh>
      {active && (
        <Text position={[0, 2.2, 0]} fontSize={0.4} color={color} anchorX="center" outlineWidth={0.025} outlineColor="#000">
          [E] {zone.label}
        </Text>
      )}
    </group>
  );
}

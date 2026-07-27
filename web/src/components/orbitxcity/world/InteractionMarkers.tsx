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
  billboard: "#3de7ff",
  token: "#17ff4d",
  voice: "#ff6bcb",
  games: "#a78bfa",
};

const KIND_HINT: Record<string, string> = {
  marketplace: "Shop · memes & buys",
  launch: "Launch arena",
  trading: "Trading floor",
  community: "Social lounge",
  hq: "OrbitX HQ",
  billboard: "Live data wall",
  token: "Token desk",
  voice: "Voice club",
  games: "Games / screen",
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
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.55} metalness={0.2} roughness={0.4} />
          </mesh>
          <Text position={[0, 3.2, 0]} fontSize={0.22} color={color} anchorX="center" outlineWidth={0.018} outlineColor="#0a1014">
            {(KIND_HINT[zone.kind] ?? "Venue").toUpperCase()}
          </Text>
          <Text position={[0, 2.2, 0]} fontSize={0.32} color="#eef2f4" anchorX="center" outlineWidth={0.022} outlineColor="#12161a">
            [E] ENTER · {zone.label}
          </Text>
        </>
      )}
    </group>
  );
}

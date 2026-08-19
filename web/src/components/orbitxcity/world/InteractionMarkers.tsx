import { useFrame } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import { useRef } from "react";
import * as THREE from "three";
import type { InteractionZone, Vec3 } from "@/lib/orbitxcity/types";
import { hasGamerMarkerPerk, hasTraderTerminalPerk } from "@/lib/orbitxcity/characterClasses";
import { useCity } from "@/pages/orbitxcity/CityProvider";

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
  marketplace: "DEX store · meme market",
  launch: "Launchpad · new tokens",
  trading: "DEX trading floor",
  community: "Community · social & chat",
  hq: "OrbitX HQ · command floor",
  billboard: "Burn store · ads & listings",
  token: "Buy desk · Jupiter swap",
  voice: "Voice plaza",
  games: "Games district",
  nft: "NFT gallery",
};

/** Gamer class perk — games + launch markers get priority + stronger glow. */
function isGamerHotZone(kind: string): boolean {
  return kind === "games" || kind === "launch" || kind === "nft";
}

/** Trader class perk — trading floor / tape boards get priority lane. */
function isTraderHotZone(kind: string): boolean {
  return kind === "trading" || kind === "billboard" || kind === "token";
}

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
  const { avatar } = useCity();
  const gamerPerk = hasGamerMarkerPerk(avatar.classId);
  const traderPerk = hasTraderTerminalPerk(avatar.classId);
  const lastId = useRef<string | null>(null);

  useFrame(() => {
    let best: InteractionZone | null = null;
    let bestScore = Infinity;
    for (const z of zones) {
      const d = Math.hypot(playerPos.x - z.position.x, playerPos.z - z.position.z);
      if (d > z.radius) continue;
      let score = d;
      if (gamerPerk && isGamerHotZone(z.kind)) score *= 0.55;
      if (traderPerk && isTraderHotZone(z.kind)) score *= 0.5;
      if (score < bestScore) {
        best = z;
        bestScore = score;
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
      {zones.map((z) => {
        const gamerBoost = gamerPerk && isGamerHotZone(z.kind);
        const traderBoost = traderPerk && isTraderHotZone(z.kind);
        return (
          <ZoneMarker
            key={z.id}
            zone={z}
            active={activeZoneId === z.id}
            boosted={gamerBoost || traderBoost}
            boostLabel={gamerBoost ? " · GAMER HOT" : traderBoost ? " · TRADER LANE" : ""}
          />
        );
      })}
    </group>
  );
}

function ZoneMarker({
  zone,
  active,
  boosted,
  boostLabel,
}: {
  zone: InteractionZone;
  active: boolean;
  boosted: boolean;
  boostLabel: string;
}) {
  const color = KIND_COLOR[zone.kind] ?? "#17ff4d";
  const ring = useRef<THREE.Mesh>(null);
  const walkIn = Boolean(zone.buildingId);
  const promptLine = walkIn ? `WALK IN · ${zone.label}` : `E · ${zone.label}`;

  useFrame(({ clock }) => {
    if (!ring.current) return;
    const pulse = boosted ? 0.18 : active ? 0.12 : 0.04;
    const s = 1 + Math.sin(clock.elapsedTime * (boosted ? 4.2 : 3)) * pulse;
    ring.current.scale.setScalar(s);
  });

  const ringOpacity = boosted ? (active ? 0.62 : 0.32) : active ? 0.42 : 0.16;
  const emissive = boosted ? 0.85 : 0.55;

  return (
    <group position={[zone.position.x, 0.05, zone.position.z]}>
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry
          args={[zone.radius * (boosted ? 0.48 : 0.55), zone.radius * (boosted ? 0.78 : 0.7), 48]}
        />
        <meshStandardMaterial
          color={color}
          emissive={boosted ? color : "#000000"}
          emissiveIntensity={boosted ? 0.35 : 0}
          transparent
          opacity={ringOpacity}
          metalness={0.1}
          roughness={0.65}
          toneMapped={false}
        />
      </mesh>
      {boosted && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
          <ringGeometry args={[zone.radius * 0.3, zone.radius * 0.38, 32]} />
          <meshBasicMaterial color={color} transparent opacity={0.5} toneMapped={false} />
        </mesh>
      )}
      {active && (
        <>
          <mesh position={[0, 4.35, 0]}>
            <torusGeometry args={[boosted ? 0.68 : 0.55, 0.035, 8, 32]} />
            <meshStandardMaterial
              color={color}
              emissive={color}
              emissiveIntensity={emissive}
              metalness={0.2}
              roughness={0.4}
            />
          </mesh>
          <Text
            position={[0, 5.05, 0]}
            fontSize={0.22}
            color={color}
            anchorX="center"
            outlineWidth={0.018}
            outlineColor="#0a1014"
          >
            {(KIND_HINT[zone.kind] ?? "Venue").toUpperCase()}
            {boostLabel}
          </Text>
          <Text
            position={[0, 4.15, 0]}
            fontSize={0.34}
            color="#eef2f4"
            anchorX="center"
            outlineWidth={0.024}
            outlineColor="#12161a"
          >
            {promptLine}
          </Text>
          <Text
            position={[0, 3.62, 0]}
            fontSize={0.16}
            color="#c5d0dc"
            anchorX="center"
            outlineWidth={0.012}
            outlineColor="#0a1014"
          >
            {walkIn ? "Doorway open · E for tools" : "Press E for tools"}
          </Text>
        </>
      )}
    </group>
  );
}

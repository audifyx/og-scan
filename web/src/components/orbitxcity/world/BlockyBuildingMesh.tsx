/**
 * OrbitX City — blocky building adapter.
 *
 * Renders an existing `BuildingDefinition` through the Roblox-style block kit.
 * Position and footprint are preserved exactly, so collision, doorways and
 * interaction zones behave identically to the legacy facade renderer — only
 * the look changes.
 */
import { useMemo } from "react";
import type { BuildingDefinition } from "@/lib/orbitxcity/types";
import { hashSeed, mulberry32 } from "@/lib/orbitxcity/collision";
import { BlockBuilding, type BlockKind } from "./BlockBuilding";

const STOREY_H = 3.2;

/** Map the world's semantic building kinds onto block-kit silhouettes. */
function blockKindFor(b: BuildingDefinition): BlockKind {
  switch (b.kind) {
    case "hq":
    case "ad_tower":
      return "tower";
    case "launch_arena":
    case "launch":
      return "stage";
    case "shop":
    case "market":
    case "marketplace":
      return "shop";
    case "social_hub":
    case "community":
      return "plaza";
    default:
      return b.size.height >= 22 ? "tower" : "midrise";
  }
}

const KIND_SIGN: Partial<Record<string, string>> = {
  hq: "ORBITX",
  trading_floor: "DEX",
  trading: "DEX",
  launch_arena: "PUMP",
  launch: "PUMP",
  market: "SOL",
  marketplace: "SOL",
  social_hub: "SOCIAL",
  community: "SOCIAL",
  shop: "GAMES",
  games: "GAMES",
  ad_tower: "ADS",
};

/** Brighten a hex toward the plastic palette so the city reads as toy-bright. */
function brighten(hex: string, amount = 0.22): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = parseInt(m[1]!, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const lift = (c: number) => Math.round(c + (255 - c) * amount);
  return `#${((lift(r) << 16) | (lift(g) << 8) | lift(b)).toString(16).padStart(6, "0")}`;
}

export function BlockyBuildingMesh({ building }: { building: BuildingDefinition }) {
  const rand = useMemo(() => mulberry32(hashSeed(building.id)), [building.id]);

  const floors = Math.max(1, Math.round(building.size.height / STOREY_H));
  const kind = blockKindFor(building);
  const sign = KIND_SIGN[building.kind] ?? building.label;

  // Slight deterministic rotation jitter keeps the grid from looking stamped.
  const rotationY = useMemo(() => (rand() - 0.5) * 0.03, [rand]);

  const glass = useMemo(() => {
    const options = ["#8fdcff", "#ffe08a", "#a8f0d0", "#cbb6ff"];
    return options[Math.floor(rand() * options.length)] ?? "#8fdcff";
  }, [rand]);

  return (
    <BlockBuilding
      position={[building.position.x, building.position.y, building.position.z]}
      width={building.size.width}
      depth={building.size.depth}
      floors={floors}
      kind={kind}
      color={brighten(building.color, 0.26)}
      trim={brighten(building.accent, 0.1)}
      glass={glass}
      rotationY={rotationY}
      studs={floors <= 8}
      sign={sign}
      signColor={brighten(building.accent, 0.35)}
    />
  );
}

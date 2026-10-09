/**
 * In-world avatar — readable humanoid with synced cosmetics.
 * Character-select still uses CryptoMascotMesh for class identity.
 */
import { HumanoidMesh } from "./HumanoidMesh";
import { BlockCharacter } from "./BlockCharacter";
import type { AvatarAppearance, FaceStyle, HairStyle, OutfitStyle } from "@/lib/orbitxcity/types";
import type { CharacterAnimationState } from "./CryptoMascotMesh";

export type { CharacterAnimationState };

export interface CharacterMeshProps {
  appearance?: Partial<AvatarAppearance> | null;
  bodyColor?: string;
  accentColor?: string;
  skinColor?: string;
  hairStyle?: HairStyle;
  hairColor?: string;
  outfit?: OutfitStyle;
  faceStyle?: FaceStyle;
  dancing?: boolean;
  moving?: boolean;
  time?: number;
  walkIntensity?: number;
  animation?: CharacterAnimationState;
}

/**
 * Blocky (Roblox-style) avatars. Matches the BLOCKY_WORLD flag in
 * CityEnvironment so the world and its inhabitants stay stylistically in sync.
 */
const BLOCKY_AVATARS: boolean =
  (import.meta.env?.VITE_OXC_BLOCKY ?? "1") !== "0";

export function CharacterMesh(props: CharacterMeshProps) {
  const appearance = props.appearance ?? {
    bodyColor: props.bodyColor,
    accentColor: props.accentColor,
    skinColor: props.skinColor,
    hairStyle: props.hairStyle,
    hairColor: props.hairColor,
    outfit: props.outfit,
    faceStyle: props.faceStyle,
  };
  if (BLOCKY_AVATARS) {
    const walk = props.walkIntensity ?? (props.moving ? 1 : 0);
    return (
      <BlockCharacter
        classId={appearance?.classId}
        bodyColor={appearance?.bodyColor ?? undefined}
        skinColor={appearance?.skinColor ?? undefined}
        accentColor={appearance?.accentColor ?? undefined}
        moveAmount={props.dancing ? 1 : Math.min(1, Math.max(0, walk))}
        phase={props.time ?? 0}
      />
    );
  }

  return (
    <HumanoidMesh
      appearance={appearance}
      animation={props.animation}
      moving={props.moving}
      dancing={props.dancing}
      time={props.time}
      walkIntensity={props.walkIntensity}
    />
  );
}

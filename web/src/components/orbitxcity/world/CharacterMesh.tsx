/**
 * In-world avatar — crypto mascots (Pepe, Wojak, Chad, Doge, Anon).
 */
import { CryptoMascotMesh, type CharacterAnimationState } from "./CryptoMascotMesh";
import type { AvatarAppearance, FaceStyle, HairStyle, OutfitStyle } from "@/lib/orbitxcity/types";

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
  return (
    <CryptoMascotMesh
      appearance={appearance}
      animation={props.animation}
      moving={props.moving}
      dancing={props.dancing}
      time={props.time}
      walkIntensity={props.walkIntensity}
    />
  );
}

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useAnimations, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { SkeletonUtils } from "three-stdlib";
import type { AvatarAppearance, FaceStyle, HairStyle, OutfitStyle } from "@/lib/orbitxcity/types";

export interface CharacterAnimationState {
  time?: number;
  moving?: boolean;
  dancing?: boolean;
  walkIntensity?: number;
}

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

const DEFAULTS = {
  bodyColor: "#1a2438",
  accentColor: "#3de7ff",
  skinColor: "#e8d5c0",
  hairStyle: "short" as HairStyle,
  hairColor: "#151018",
  outfit: "street" as OutfitStyle,
  faceStyle: "cool" as FaceStyle,
};

const CHAR_MODELS = {
  rogue: "/orbitxcity/models/characters/Rogue.glb",
  mage: "/orbitxcity/models/characters/Mage.glb",
  knight: "/orbitxcity/models/characters/Knight.glb",
} as const;

useGLTF.preload(CHAR_MODELS.rogue);
useGLTF.preload(CHAR_MODELS.mage);
useGLTF.preload(CHAR_MODELS.knight);

function resolveCharacterProps({
  appearance,
  bodyColor,
  accentColor,
  skinColor,
  hairStyle,
  hairColor,
  outfit,
  faceStyle,
}: CharacterMeshProps) {
  return {
    bodyColor: bodyColor ?? appearance?.bodyColor ?? DEFAULTS.bodyColor,
    accentColor: accentColor ?? appearance?.accentColor ?? DEFAULTS.accentColor,
    skinColor: skinColor ?? appearance?.skinColor ?? DEFAULTS.skinColor,
    hairStyle: hairStyle ?? appearance?.hairStyle ?? DEFAULTS.hairStyle,
    hairColor: hairColor ?? appearance?.hairColor ?? DEFAULTS.hairColor,
    outfit: outfit ?? appearance?.outfit ?? DEFAULTS.outfit,
    faceStyle: faceStyle ?? appearance?.faceStyle ?? DEFAULTS.faceStyle,
    classId: appearance?.classId,
  };
}

function pickModel(classId?: string, outfit?: OutfitStyle): string {
  if (outfit === "suit" || classId === "trader" || classId === "builder") return CHAR_MODELS.knight;
  if (outfit === "neon" || classId === "creator" || classId === "gamer") return CHAR_MODELS.mage;
  return CHAR_MODELS.rogue;
}

function classScale(classId?: string) {
  switch (classId) {
    case "builder":
      return 1.08;
    case "gamer":
      return 0.92;
    case "creator":
      return 0.96;
    case "explorer":
      return 1.04;
    case "trader":
    default:
      return 1;
  }
}

const HIDDEN_NAME = /knife|crossbow|sword|axe|shield|bow|arrow|staff|wand|spell|quiver|throwable|weapon|mug/i;

function prepareCharacter(scene: THREE.Object3D, accent: string, bodyColor: string) {
  const root = SkeletonUtils.clone(scene);
  root.traverse((obj) => {
    if (HIDDEN_NAME.test(obj.name)) {
      obj.visible = false;
      return;
    }
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    mats.forEach((mat) => {
      const m = mat as THREE.MeshStandardMaterial;
      if (!m?.color || !m.isMeshStandardMaterial) return;
      const cloned = m.clone();
      if (/body|chest|leg|arm|cape|cloth|shirt/i.test(mesh.name)) {
        cloned.color.lerp(new THREE.Color(bodyColor), 0.32);
      }
      cloned.emissive = new THREE.Color(accent);
      cloned.emissiveIntensity = 0.06;
      cloned.needsUpdate = true;
      if (Array.isArray(mesh.material)) {
        const idx = mats.indexOf(mat);
        (mesh.material as THREE.Material[])[idx] = cloned;
      } else {
        mesh.material = cloned;
      }
    });
  });
  return root;
}

export function CharacterMesh(props: CharacterMeshProps) {
  const character = useMemo(
    () => resolveCharacterProps(props),
    [
      props.accentColor,
      props.appearance,
      props.bodyColor,
      props.faceStyle,
      props.hairColor,
      props.hairStyle,
      props.outfit,
      props.skinColor,
    ],
  );

  const modelPath = pickModel(character.classId, character.outfit);
  const { scene, animations } = useGLTF(modelPath);
  const clone = useMemo(
    () => prepareCharacter(scene, character.accentColor, character.bodyColor),
    [scene, character.accentColor, character.bodyColor],
  );

  const root = useRef<THREE.Group>(null);
  const modelRef = useRef<THREE.Object3D>(null);
  const { actions } = useAnimations(animations, modelRef);
  const modeRef = useRef<"idle" | "walk" | "run" | "dance" | null>(null);
  const scale = classScale(character.classId);

  useEffect(() => {
    modeRef.current = null;
  }, [modelPath, actions]);

  useFrame(({ clock }) => {
    const animation = props.animation;
    const moving = animation?.moving ?? props.moving ?? false;
    const dancing = animation?.dancing ?? props.dancing ?? false;
    const intensity = animation?.walkIntensity ?? props.walkIntensity ?? 1;
    const t = animation?.time ?? props.time ?? clock.elapsedTime;

    const walk = actions?.Walking_A ?? actions?.Walking_B;
    const run = actions?.Running_A ?? actions?.Running_B;
    const idle = actions?.Idle ?? actions?.Unarmed_Idle;
    const cheer = actions?.Cheer;

    let next: "idle" | "walk" | "run" | "dance" = "idle";
    if (dancing && cheer) next = "dance";
    else if (moving) next = intensity > 1.2 && run ? "run" : "walk";

    if (next !== modeRef.current && actions) {
      const fade = 0.18;
      Object.values(actions).forEach((a) => a?.fadeOut(fade));
      const play =
        next === "dance" ? cheer : next === "run" ? run : next === "walk" ? walk : idle;
      play?.reset().fadeIn(fade).play();
      if (play && (next === "walk" || next === "run")) {
        play.setEffectiveTimeScale(0.95 + intensity * 0.2);
      }
      modeRef.current = next;
    }

    if (root.current) {
      root.current.position.y = dancing ? Math.abs(Math.sin(t * 9)) * 0.05 : 0;
    }
  });

  return (
    <group ref={root} name="characterMesh" scale={scale * 0.95}>
      <primitive ref={modelRef} object={clone} />
      <mesh position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.28, 0.38, 24]} />
        <meshBasicMaterial color={character.accentColor} transparent opacity={0.55} toneMapped={false} />
      </mesh>
    </group>
  );
}

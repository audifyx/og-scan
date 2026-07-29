/**
 * OrbitX hero character GLTF — plays idle / walk / dance when clips exist.
 * Falls back is handled by the parent (CharacterMesh when path is null).
 */
import { Suspense, useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useAnimations, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import type { AvatarAppearance } from "@/lib/orbitxcity/types";
import type { CharacterAnimationState } from "./CharacterMesh";

interface CharacterGltfProps {
  path: string;
  appearance: AvatarAppearance;
  animation?: CharacterAnimationState;
}

function pickClip(names: string[], ...candidates: string[]) {
  const lower = names.map((n) => n.toLowerCase());
  for (const c of candidates) {
    const i = lower.findIndex((n) => n.includes(c));
    if (i >= 0) return names[i]!;
  }
  return names[0] ?? null;
}

function CharacterGltfInner({ path, appearance, animation }: CharacterGltfProps) {
  const group = useRef<THREE.Group>(null);
  const { scene, animations } = useGLTF(path);
  const { actions, names } = useAnimations(animations, group);

  const clips = useMemo(
    () => ({
      idle: pickClip(names, "idle", "stand", "breath"),
      walk: pickClip(names, "walk", "run", "locomotion"),
      dance: pickClip(names, "dance", "emote", "celebrate"),
    }),
    [names],
  );

  useEffect(() => {
    const moving = Boolean(animation?.moving);
    const dancing = Boolean(animation?.dancing);
    const next = dancing ? clips.dance : moving ? clips.walk : clips.idle;
    if (!next) return;
    Object.entries(actions).forEach(([name, action]) => {
      if (!action) return;
      if (name === next) {
        action.reset().fadeIn(0.2).play();
      } else {
        action.fadeOut(0.2);
      }
    });
  }, [actions, clips, animation?.moving, animation?.dancing]);

  useFrame(({ clock }) => {
    const g = group.current;
    if (!g || names.length > 0) return;
    // No clips — light procedural bob so GLB still feels alive.
    const t = animation?.time ?? clock.elapsedTime;
    const moving = Boolean(animation?.moving);
    const dancing = Boolean(animation?.dancing);
    const bob = dancing
      ? Math.abs(Math.sin(t * 9)) * 0.12
      : moving
        ? Math.sin(t * 10) * 0.04 * (animation?.walkIntensity ?? 1)
        : Math.sin(t * 2) * 0.01;
    g.position.y = bob;
  });

  // Tint materials toward avatar accent when meshes share a standard material.
  useEffect(() => {
    scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const m of mats) {
        const std = m as THREE.MeshStandardMaterial;
        if (std?.emissive && mesh.name.toLowerCase().includes("accent")) {
          std.emissive = new THREE.Color(appearance.accentColor);
          std.emissiveIntensity = 0.55;
        }
      }
    });
  }, [scene, appearance.accentColor]);

  return (
    <group ref={group}>
      <primitive object={scene} />
    </group>
  );
}

export function CharacterGltf(props: CharacterGltfProps) {
  return (
    <Suspense fallback={null}>
      <CharacterGltfInner {...props} />
    </Suspense>
  );
}

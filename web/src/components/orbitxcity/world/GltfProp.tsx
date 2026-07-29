/**
 * Generic GLTF prop — loads a path, clones the scene, optionally scales to a target AABB.
 * Used by buildings, furniture, landmarks, and street props.
 */
import { Suspense, useMemo } from "react";
import { Clone, useGLTF } from "@react-three/drei";
import * as THREE from "three";

export interface GltfPropProps {
  path: string;
  position?: [number, number, number];
  rotation?: [number, number, number];
  /** Uniform scale, or [x,y,z]. Ignored when fitTo is set. */
  scale?: number | [number, number, number];
  /** Fit cloned mesh into this width/height/depth box (meters). */
  fitTo?: { width: number; height: number; depth: number };
  castShadow?: boolean;
  receiveShadow?: boolean;
}

function GltfPropInner({
  path,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1,
  fitTo,
  castShadow = true,
  receiveShadow = true,
}: GltfPropProps) {
  const { scene } = useGLTF(path);

  const computedScale = useMemo((): [number, number, number] => {
    if (!fitTo) {
      if (typeof scale === "number") return [scale, scale, scale];
      return scale;
    }
    const box = new THREE.Box3().setFromObject(scene);
    const size = new THREE.Vector3();
    box.getSize(size);
    const sx = size.x > 0.001 ? fitTo.width / size.x : 1;
    const sy = size.y > 0.001 ? fitTo.height / size.y : 1;
    const sz = size.z > 0.001 ? fitTo.depth / size.z : 1;
    const u = Math.min(sx, sy, sz);
    return [u, u, u];
  }, [scene, fitTo, scale]);

  return (
    <Clone
      object={scene}
      position={position}
      rotation={rotation}
      scale={computedScale}
      castShadow={castShadow}
      receiveShadow={receiveShadow}
    />
  );
}

/** Suspense-wrapped GLTF clone. Parent should provide a Suspense boundary for batches. */
export function GltfProp(props: GltfPropProps) {
  return (
    <Suspense fallback={null}>
      <GltfPropInner {...props} />
    </Suspense>
  );
}

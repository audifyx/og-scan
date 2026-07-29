/**
 * Generic GLTF prop — loads a path, clones the scene, optionally scales to a target AABB.
 * Used by buildings, furniture, landmarks, and street props.
 * Gracefully handles missing models by rendering nothing.
 */
import { Suspense, useMemo, Component, ReactNode } from "react";
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

/** Error boundary to catch GLTF loading errors (including Suspense promise rejections) */
class GltfErrorBoundary extends Component<
  { children: ReactNode; path: string },
  { hasError: boolean }
> {
  constructor(props: { children: ReactNode; path: string }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error(`[v0] Failed to load GLTF model at ${this.props.path}:`, error.message);
  }

  render() {
    if (this.state.hasError) {
      return null;
    }
    return this.props.children;
  }
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

/** Suspense-wrapped GLTF clone with error boundary. Silently fails if model is missing. */
export function GltfProp(props: GltfPropProps) {
  return (
    <GltfErrorBoundary path={props.path}>
      <Suspense fallback={null}>
        <GltfPropInner {...props} />
      </Suspense>
    </GltfErrorBoundary>
  );
}

/**
 * Hero preview of the in-world humanoid (same HumanoidMesh as City).
 * 2D mascot portrait is the instant fallback; 3D upgrades when WebGL is free.
 * Never throws to the page error boundary (title-canvas teardown can starve a second context).
 */
import { Component, Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { appearanceFromClass, getCharacterClass, type CharacterClassId } from "@/lib/orbitxcity/characterClasses";
import { HumanoidMesh } from "../world/HumanoidMesh";
import { MascotPortrait } from "./MascotPortrait";

class PreviewBoundary extends Component<{ children: ReactNode; onFail: () => void }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error) {
    console.warn("[CharacterPreview] WebGL preview unavailable", error.message);
    this.props.onFail();
  }

  render() {
    if (this.state.failed) return null;
    return this.props.children;
  }
}

function SpinningHumanoid({ classId }: { classId: CharacterClassId }) {
  const group = useRef<THREE.Group>(null);
  const look = appearanceFromClass(getCharacterClass(classId));
  useFrame(({ clock }) => {
    if (group.current) group.current.rotation.y = Math.sin(clock.elapsedTime * 0.55) * 0.35 + 0.25;
  });
  return (
    <group ref={group} position={[0, -0.05, 0]} scale={1.02}>
      <HumanoidMesh appearance={look} />
    </group>
  );
}

export function CharacterPreview({
  classId,
  className = "",
}: {
  classId: CharacterClassId;
  className?: string;
}) {
  const [live3d, setLive3d] = useState(false);

  useEffect(() => {
    setLive3d(false);
    const timer = window.setTimeout(() => setLive3d(true), 320);
    return () => window.clearTimeout(timer);
  }, [classId]);

  return (
    <div className={`oxc-mascot-preview ${className}`.trim()} aria-hidden>
      <div className={`oxc-mascot-hero-art ${live3d ? "is-behind" : ""}`}>
        <MascotPortrait id={classId} />
      </div>
      {live3d && (
        <PreviewBoundary onFail={() => setLive3d(false)}>
          <div className="oxc-mascot-preview-3d">
            <Canvas
              dpr={[1, 1.25]}
              camera={{ position: [0.2, 1.35, 3.15], fov: 32, near: 0.1, far: 20 }}
              gl={{ antialias: false, alpha: true, stencil: false, powerPreference: "low-power" }}
              onCreated={({ gl }) => {
                gl.setClearColor(0x000000, 0);
              }}
            >
              <ambientLight intensity={0.45} />
              <hemisphereLight args={["#f0e6d4", "#1a2230", 0.4]} />
              <directionalLight position={[2.4, 3.2, 2]} intensity={1.1} color="#f4e6c8" />
              <Suspense fallback={null}>
                <SpinningHumanoid classId={classId} />
              </Suspense>
            </Canvas>
          </div>
        </PreviewBoundary>
      )}
    </div>
  );
}

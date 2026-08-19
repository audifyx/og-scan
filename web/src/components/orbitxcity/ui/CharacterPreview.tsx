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
    const timer = window.setTimeout(() => setLive3d(true), 180);
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
              camera={{ position: [0.32, 1.42, 2.75], fov: 30, near: 0.1, far: 20 }}
              gl={{ antialias: false, alpha: true, stencil: false, powerPreference: "low-power" }}
              onCreated={({ gl }) => {
                gl.setClearColor(0x000000, 0);
              }}
            >
              <ambientLight intensity={0.62} />
              <hemisphereLight args={["#f4ece0", "#1a2434", 0.55]} />
              <directionalLight position={[2.2, 3.4, 2.4]} intensity={1.35} color="#fff4e0" />
              <directionalLight position={[-2, 1.6, 1.2]} intensity={0.4} color="#7ec8ff" />
              <pointLight position={[0, 1.6, 2]} intensity={0.55} color="#00ff9f" distance={6} />
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

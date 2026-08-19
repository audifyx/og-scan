/**
 * Live 3D preview of a playable crypto mascot.
 */
import { Suspense, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { appearanceFromClass, getCharacterClass, type CharacterClassId } from "@/lib/orbitxcity/characterClasses";
import { CryptoMascotMesh } from "../world/CryptoMascotMesh";

function SpinningMascot({ classId }: { classId: CharacterClassId }) {
  const group = useRef<THREE.Group>(null);
  const look = appearanceFromClass(getCharacterClass(classId));
  useFrame(({ clock }) => {
    if (group.current) group.current.rotation.y = Math.sin(clock.elapsedTime * 0.55) * 0.35 + 0.25;
  });
  return (
    <group ref={group} position={[0, -0.15, 0]}>
      <CryptoMascotMesh appearance={look} />
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
  return (
    <div className={`oxc-mascot-preview ${className}`.trim()} aria-hidden>
      <Canvas
        dpr={[1, 1.4]}
        camera={{ position: [0.15, 1.15, 2.7], fov: 34, near: 0.1, far: 20 }}
        gl={{ antialias: true, alpha: true, stencil: false }}
        onCreated={({ gl }) => {
          gl.setClearColor(0x000000, 0);
        }}
      >
        <ambientLight intensity={0.45} />
        <hemisphereLight args={["#f0e6d4", "#1a2230", 0.4]} />
        <directionalLight position={[2.4, 3.2, 2]} intensity={1.1} color="#f4e6c8" />
        <directionalLight position={[-2, 1.4, 1.2]} intensity={0.35} color="#8eb4d8" />
        <Suspense fallback={null}>
          <SpinningMascot classId={classId} />
        </Suspense>
      </Canvas>
    </div>
  );
}

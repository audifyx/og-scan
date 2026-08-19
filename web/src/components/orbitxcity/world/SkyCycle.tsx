import * as THREE from "three";
import type { WorldBlockConfig } from "@/lib/orbitxcity/types";

function skyColor(cityId: WorldBlockConfig["cityId"]): string {
  switch (cityId) {
    case "miami":
      return "#7eb8c8";
    case "la":
      return "#8aa0c0";
    case "boston":
      return "#7a92a8";
    default:
      return "#7eaccc";
  }
}

/** Locked daytime sky — OrbitX City is always day. No night cycle. */
export function SkyCycle({ block }: { block: WorldBlockConfig }) {
  const sky = skyColor(block.cityId);
  return (
    <>
      <color attach="background" args={[sky]} />
      <fog attach="fog" args={["#9bb8c8", 70, 220]} />
      <hemisphereLight args={["#d8e8f4", "#6a8a6a", 0.95]} />
      <directionalLight
        position={[32, 54, 18]}
        intensity={1.55}
        color="#fff4d8"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-70}
        shadow-camera-right={70}
        shadow-camera-top={70}
        shadow-camera-bottom={-70}
        shadow-bias={-0.0002}
      />
      <directionalLight position={[-18, 22, -12]} intensity={0.35} color="#b8d4ff" />
      <mesh position={[38, 62, 22]}>
        <sphereGeometry args={[3.4, 20, 16]} />
        <meshBasicMaterial color="#fff3c4" toneMapped={false} />
      </mesh>
    </>
  );
}

import * as THREE from "three";
import type { WorldBlockConfig } from "@/lib/orbitxcity/types";

function dayPalette(cityId: WorldBlockConfig["cityId"]): {
  sky: string;
  fog: string;
  hemiSky: string;
  hemiGround: string;
  sun: string;
} {
  switch (cityId) {
    case "miami":
      return { sky: "#7ec8e8", fog: "#9ed4e8", hemiSky: "#dff4ff", hemiGround: "#6aaa72", sun: "#fff6c8" };
    case "la":
      return { sky: "#8ab4e0", fog: "#a8c4e8", hemiSky: "#e8f0ff", hemiGround: "#8a7a62", sun: "#ffe8b0" };
    case "boston":
      return { sky: "#7aa0c8", fog: "#98b4d0", hemiSky: "#d8e8f8", hemiGround: "#6a8a62", sun: "#fff4d0" };
    default:
      return { sky: "#7eb6e0", fog: "#9cc8e4", hemiSky: "#e4f2ff", hemiGround: "#6a9a62", sun: "#fff3c0" };
  }
}

/**
 * Bright Roblox-like daylight. Strong sun, readable shadows, warm NYC sky.
 * Night cyber lighting is a later quality toggle — Alpha launches in day.
 */
export function SkyCycle({ block }: { block: WorldBlockConfig }) {
  const pal = dayPalette(block.cityId);
  return (
    <>
      <color attach="background" args={[pal.sky]} />
      <fog attach="fog" args={[pal.fog, 70, 210]} />
      <hemisphereLight args={[pal.hemiSky, pal.hemiGround, 0.95]} />
      <directionalLight
        position={[32, 54, 18]}
        intensity={1.65}
        color={pal.sun}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-70}
        shadow-camera-right={70}
        shadow-camera-top={70}
        shadow-camera-bottom={-70}
        shadow-bias={-0.0002}
      />
      <directionalLight position={[-18, 22, -12]} intensity={0.32} color="#b8d4ff" />
      <mesh position={[38, 62, 22]}>
        <sphereGeometry args={[3.6, 20, 16]} />
        <meshBasicMaterial color="#fff3c4" toneMapped={false} />
      </mesh>
    </>
  );
}

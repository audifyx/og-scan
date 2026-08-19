import * as THREE from "three";
import type { WorldBlockConfig } from "@/lib/orbitxcity/types";

function nightPalette(cityId: WorldBlockConfig["cityId"]): {
  sky: string;
  fog: string;
  hemiSky: string;
  hemiGround: string;
  moon: string;
  fill: string;
} {
  switch (cityId) {
    case "miami":
      return {
        sky: "#0c1c28",
        fog: "#163040",
        hemiSky: "#3a6a78",
        hemiGround: "#1a2a22",
        moon: "#e8f4f0",
        fill: "#5ec4b6",
      };
    case "la":
      return {
        sky: "#14101c",
        fog: "#1c1830",
        hemiSky: "#4a3a68",
        hemiGround: "#221a1c",
        moon: "#f0e4d8",
        fill: "#b388ff",
      };
    case "boston":
      return {
        sky: "#0c1628",
        fog: "#152238",
        hemiSky: "#3a5880",
        hemiGround: "#1a221c",
        moon: "#dce8f8",
        fill: "#5b8def",
      };
    default:
      return {
        sky: "#0c1624",
        fog: "#152030",
        hemiSky: "#3a5a80",
        hemiGround: "#1a2418",
        moon: "#e8eef8",
        fill: "#c5a26f",
      };
  }
}

/**
 * Night cyber-financial district sky.
 * Ground stays readable via street lamps + neon bounce — not a black void,
 * not a daytime suburb.
 */
export function SkyCycle({ block }: { block: WorldBlockConfig }) {
  const pal = nightPalette(block.cityId);
  return (
    <>
      <color attach="background" args={[pal.sky]} />
      <fog attach="fog" args={[pal.fog, 48, 170]} />
      <hemisphereLight args={[pal.hemiSky, pal.hemiGround, 0.42]} />
      <directionalLight position={[28, 44, 16]} intensity={0.32} color="#d8e4f4" />
      <directionalLight position={[-16, 18, -10]} intensity={0.18} color={pal.fill} />
      <mesh position={[36, 58, 20]}>
        <sphereGeometry args={[2.6, 20, 16]} />
        <meshBasicMaterial color={pal.moon} toneMapped={false} />
      </mesh>
      <mesh position={[36, 58, 20]}>
        <sphereGeometry args={[4.2, 16, 12]} />
        <meshBasicMaterial color={pal.moon} transparent opacity={0.08} depthWrite={false} toneMapped={false} />
      </mesh>
    </>
  );
}

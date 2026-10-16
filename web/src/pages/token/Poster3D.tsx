import * as THREE from "three";
import { useMemo } from "react";

function makePosterTexture(draw: (ctx: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 340;
  const ctx = c.getContext("2d")!;
  draw(ctx);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

type PosterProps = {
  position: [number, number, number];
  texture: THREE.CanvasTexture;
  seed: number;
};

function Poster({ position, texture, seed }: PosterProps) {
  const tilt = useMemo(() => ((seed * 9301 + 49297) % 233280) / 233280 * 0.06 - 0.03, [seed]);
  return (
    <group position={position} rotation={[0, 0, tilt]}>
      {/* dark frame behind */}
      <mesh position={[0, 0, -0.02]}>
        <boxGeometry args={[1.18, 1.58, 0.03]} />
        <meshStandardMaterial color="#14171f" roughness={0.55} metalness={0.25} />
      </mesh>
      {/* poster face, facing +z */}
      <mesh>
        <planeGeometry args={[1.1, 1.5]} />
        <meshBasicMaterial map={texture} toneMapped={false} />
      </mesh>
    </group>
  );
}

export function WallPosters() {
  const hodlTex = useMemo(
    () =>
      makePosterTexture((ctx) => {
        // black background
        ctx.fillStyle = "#050505";
        ctx.fillRect(0, 0, 256, 340);
        // thin amber border
        ctx.strokeStyle = "#f5a623";
        ctx.lineWidth = 6;
        ctx.strokeRect(10, 10, 236, 320);
        // huge amber HODL
        ctx.fillStyle = "#ffb020";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = "900 80px Arial, Helvetica, sans-serif";
        ctx.fillText("HODL", 128, 148);
        // teal subtext
        ctx.fillStyle = "#2dd4bf";
        ctx.font = "bold 27px Arial, Helvetica, sans-serif";
        ctx.fillText("ORBITX FOREVER", 128, 232);
      }),
    []
  );

  const logoTex = useMemo(
    () =>
      makePosterTexture((ctx) => {
        // dark background
        ctx.fillStyle = "#0a1424";
        ctx.fillRect(0, 0, 256, 340);
        // subtle inner border
        ctx.strokeStyle = "#1e3a5f";
        ctx.lineWidth = 5;
        ctx.strokeRect(10, 10, 236, 320);
        // teal diamond glyph
        ctx.fillStyle = "#2dd4bf";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = "150px Arial, Helvetica, sans-serif";
        ctx.fillText("◈", 128, 128);
        // ORBITX in white
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 52px Arial, Helvetica, sans-serif";
        ctx.fillText("ORBITX", 128, 248);
        // small subtext
        ctx.fillStyle = "#8fa3b8";
        ctx.font = "17px Arial, Helvetica, sans-serif";
        ctx.fillText("TO THE METROPOLIS", 128, 294);
      }),
    []
  );

  return (
    <group>
      <Poster position={[-3.2, 2.4, -4.1]} texture={hodlTex} seed={1} />
      <Poster position={[3.2, 2.4, -4.1]} texture={logoTex} seed={2} />
    </group>
  );
}

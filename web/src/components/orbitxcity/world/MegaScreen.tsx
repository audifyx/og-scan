import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { ScreenerRow } from "@/lib/orbitxcity/marketData";
import { drawMegaScreen } from "@/lib/orbitxcity/textures";

interface MegaScreenProps {
  rows: ScreenerRow[];
  position: [number, number, number];
  rotationY?: number;
  width?: number;
  height?: number;
}

/** Jumbotron bound to the live OrbitX screener feed. */
export function MegaScreen({ rows, position, rotationY = 0, width = 9, height = 5 }: MegaScreenProps) {
  const canvas = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 1024;
    c.height = 576;
    return c;
  }, []);

  const texture = useMemo(() => {
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  }, [canvas]);

  const blink = useRef(true);
  const acc = useRef(0);
  const rowsRef = useRef(rows);
  rowsRef.current = rows;

  useEffect(() => {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    drawMegaScreen(ctx, rows, blink.current);
    texture.needsUpdate = true;
  }, [canvas, texture, rows]);

  useFrame((_, dt) => {
    acc.current += dt;
    if (acc.current < 1) return;
    acc.current = 0;
    blink.current = !blink.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    drawMegaScreen(ctx, rowsRef.current, blink.current);
    texture.needsUpdate = true;
  });

  return (
    <group position={position} rotation-y={rotationY}>
      {/* Housing */}
      <mesh position={[0, 0, -0.14]}>
        <boxGeometry args={[width + 0.5, height + 0.5, 0.24]} />
        <meshStandardMaterial color="#0b101c" metalness={0.65} roughness={0.3} />
      </mesh>
      {/* Screen */}
      <mesh>
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial map={texture} toneMapped={false} />
      </mesh>
      {/* Neon frame */}
      {[
        [0, height / 2 + 0.18, width + 0.4, 0.08] as const,
        [0, -height / 2 - 0.18, width + 0.4, 0.08] as const,
      ].map(([x, y, w, h], i) => (
        <mesh key={i} position={[x, y, 0.02]}>
          <boxGeometry args={[w, h, 0.06]} />
          <meshBasicMaterial color="#17ff4d" toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";

const HEAD_POSITIONS: [number, number, number][] = [
  [-2.4, 2.3, -0.75],
  [-2.4, 2.3, 0],
  [-2.4, 2.3, 0.75],
];

const CYCLE_MS = 4000;
const MAX_CHARS = 30;

function makeBubbleTexture(line: string): THREE.CanvasTexture {
  const w = 256;
  const h = 128;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    const tex = new THREE.CanvasTexture(canvas);
    return tex;
  }

  // Rounded rect background
  const radius = 18;
  const pad = 6;
  ctx.beginPath();
  ctx.roundRect(pad, pad, w - pad * 2, h - pad * 2, radius);
  ctx.fillStyle = "rgba(10,15,30,0.92)";
  ctx.fill();

  // Colored border
  ctx.strokeStyle = "#7c3aed";
  ctx.lineWidth = 4;
  ctx.stroke();

  // Text (truncate to ~30 chars)
  const text = line.length > MAX_CHARS ? line.slice(0, MAX_CHARS - 1) + "…" : line;
  ctx.fillStyle = "#ffffff";
  ctx.font = "20px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, w / 2, h / 2);

  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 4;
  return tex;
}

export function AgentChatter({ lines }: { lines: string[] }) {
  const [index, setIndex] = useState(0);
  const groupRef = useRef<THREE.Group>(null);

  const count = lines.length;

  useEffect(() => {
    if (count === 0) return;
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % count);
    }, CYCLE_MS);
    return () => window.clearInterval(id);
  }, [count]);

  const safeIndex = count > 0 ? index % count : 0;
  const line = count > 0 ? lines[safeIndex] : "";

  // Redraw texture when the line changes
  const texture = useMemo(() => {
    const tex = makeBubbleTexture(line);
    return tex;
  }, [line]);

  // Dispose old texture when it is replaced
  useEffect(() => {
    return () => {
      texture.dispose();
    };
  }, [texture]);

  const position = count > 0 ? HEAD_POSITIONS[safeIndex % HEAD_POSITIONS.length] : [0, 0, 0] as [number, number, number];

  // Gentle bob
  useFrame(({ clock }) => {
    if (groupRef.current) {
      groupRef.current.position.y = position[1] + Math.sin(clock.elapsedTime * 1.6) * 0.05;
    }
  });

  if (count === 0) return null;

  return (
    <group ref={groupRef} position={[position[0], position[1], position[2]]}>
      {/* Bubble */}
      <mesh>
        <planeGeometry args={[1.1, 0.55]} />
        <meshBasicMaterial map={texture} transparent toneMapped={false} />
      </mesh>
      {/* Tail triangle below the bubble */}
      <mesh position={[0, -0.34, 0]} rotation={[0, 0, Math.PI]}>
        <coneGeometry args={[0.09, 0.14, 3]} />
        <meshBasicMaterial color="rgba(10,15,30,0.92)" transparent toneMapped={false} />
      </mesh>
    </group>
  );
}

import { useMemo } from "react";
import * as THREE from "three";

/**
 * MemoryBoard — a mission-style corkboard mounted on the office back glass wall.
 * Shows the agent's latest on-chain memories as an amber monospace terminal
 * readout, pinned up with two push pins.
 *
 * Props:
 *   memories — chronological list of { text, time }; the 5 latest are drawn.
 */

const BOARD_W = 2.6;
const BOARD_H = 1.5;
const BOARD_D = 0.08;
const CORK = "#4a3423";
const FRAME = "#8a6b4a";
const AMBER = "#ffb000";
const INK = "#e9dfc9";
const MAX_LINE = 38;

type Memory = { text: string; time: number };

function formatClock(t: number): string {
  const d = new Date(t);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function drawBoard(canvas: HTMLCanvasElement, memories: Memory[]): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const W = canvas.width;
  const H = canvas.height;

  // dark board background
  ctx.fillStyle = "#221810";
  ctx.fillRect(0, 0, W, H);

  // subtle paper-grain noise so it reads as cork/felt, not flat black
  ctx.fillStyle = "rgba(255,255,255,0.015)";
  for (let i = 0; i < 400; i++) {
    const x = Math.random() * W;
    const y = Math.random() * H;
    ctx.fillRect(x, y, 1.5, 1.5);
  }

  // header
  ctx.font = "bold 20px 'Courier New', monospace";
  ctx.fillStyle = AMBER;
  ctx.fillText("AGENT MEMORY // ON-CHAIN", 24, 38);
  ctx.fillStyle = "rgba(255,176,0,0.5)";
  ctx.fillRect(24, 50, W - 48, 2);

  const rows = [...memories].slice(-5).reverse();
  if (rows.length === 0) {
    ctx.font = "15px 'Courier New', monospace";
    ctx.fillStyle = "rgba(233,223,201,0.45)";
    ctx.fillText("▸ no memories recorded yet", 24, 92);
    return;
  }

  ctx.font = "15px 'Courier New', monospace";
  rows.forEach((m, i) => {
    const y = 90 + i * 40;
    ctx.fillStyle = "rgba(255,176,0,0.55)";
    ctx.fillText(formatClock(m.time), 24, y);
    ctx.fillStyle = AMBER;
    ctx.fillText("▸", 88, y);
    const line = m.text.length > MAX_LINE ? m.text.slice(0, MAX_LINE - 1) + "…" : m.text;
    ctx.fillStyle = INK;
    ctx.fillText(line, 110, y);
  });
}

export function MemoryBoard({ memories }: { memories: Array<Memory> }) {
  // Redrawn (and re-created) whenever the memories list changes.
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 300;
    drawBoard(canvas, memories);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
  }, [memories]);

  const frontZ = BOARD_D / 2;

  return (
    <group position={[0, 2.2, -4.05]}>
      {/* lighter wooden frame: slightly larger box sitting behind the board */}
      <mesh position={[0, 0, -0.02]}>
        <boxGeometry args={[BOARD_W + 0.12, BOARD_H + 0.12, 0.06]} />
        <meshStandardMaterial color={FRAME} roughness={0.8} />
      </mesh>

      {/* dark cork board */}
      <mesh>
        <boxGeometry args={[BOARD_W, BOARD_H, BOARD_D]} />
        <meshStandardMaterial color={CORK} roughness={0.95} />
      </mesh>

      {/* printed memory sheet on the board's front face, facing +z */}
      <mesh position={[0, 0, frontZ + 0.005]}>
        <planeGeometry args={[2.5, 1.4]} />
        <meshBasicMaterial map={texture} toneMapped={false} />
      </mesh>

      {/* push pins at the top corners */}
      <mesh position={[-BOARD_W / 2 + 0.1, BOARD_H / 2 - 0.07, frontZ + 0.025]}>
        <sphereGeometry args={[0.032, 16, 16]} />
        <meshStandardMaterial color="#ff3b30" roughness={0.3} metalness={0.4} />
      </mesh>
      <mesh position={[BOARD_W / 2 - 0.1, BOARD_H / 2 - 0.07, frontZ + 0.025]}>
        <sphereGeometry args={[0.032, 16, 16]} />
        <meshStandardMaterial color="#ff3b30" roughness={0.3} metalness={0.4} />
      </mesh>
    </group>
  );
}

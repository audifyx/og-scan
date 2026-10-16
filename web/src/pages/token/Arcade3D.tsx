import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

// ---------------------------------------------------------------------------
// ArcadeSection
//
// Two 3D arcade cabinets (back-right corner of the office) with animated
// pixel-game screens and glowing canvas-texture marquees.
//
// NOTE: The marquee/screen textures here are LOCAL canvas textures defined in
// this file. MonitorScreens.tsx was intentionally left untouched — a shared
// ScreenKind wiring will be coordinated separately.
// ---------------------------------------------------------------------------

type GameKind = "invaders" | "runner";

const MARQUEE_W = 256;
const MARQUEE_H = 64;
const SCREEN_W = 128;
const SCREEN_H = 96;

function makeMarqueeTexture(title: string, color: string): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = MARQUEE_W;
  canvas.height = MARQUEE_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2d context unavailable");

  // Dark background with subtle vertical gradient
  const grad = ctx.createLinearGradient(0, 0, 0, MARQUEE_H);
  grad.addColorStop(0, "#0d0d1f");
  grad.addColorStop(1, "#161636");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, MARQUEE_W, MARQUEE_H);

  // Neon glow title
  ctx.font = "bold 26px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = color;
  ctx.shadowBlur = 14;
  ctx.fillStyle = color;
  ctx.fillText(title, MARQUEE_W / 2, MARQUEE_H / 2);
  ctx.shadowBlur = 0;

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeScreenTexture(): { texture: THREE.CanvasTexture; canvas: HTMLCanvasElement } {
  const canvas = document.createElement("canvas");
  canvas.width = SCREEN_W;
  canvas.height = SCREEN_H;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter; // crisp pixels
  texture.minFilter = THREE.NearestFilter;
  return { texture, canvas };
}

function drawInvaders(ctx: CanvasRenderingContext2D, tick: number) {
  // CRT-green background
  ctx.fillStyle = "#031007";
  ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);

  // Scanline flicker
  ctx.fillStyle = "rgba(0,0,0,0.15)";
  for (let y = 0; y < SCREEN_H; y += 3) ctx.fillRect(0, y, SCREEN_W, 1);

  // Rows of pixel invaders drifting side to side
  const offset = Math.round(10 * Math.sin(tick * 0.35));
  const invaderColors = ["#ff2e88", "#00e5ff", "#b6ff00"];
  for (let row = 0; row < 3; row++) {
    for (let i = 0; i < 6; i++) {
      const x = 14 + i * 17 + offset;
      const y = 12 + row * 14;
      const flap = Math.floor(tick / 5) % 2 === 0;
      ctx.fillStyle = invaderColors[row];
      // Simple 5x4 invader sprite
      ctx.fillRect(x, y, 10, 2);
      ctx.fillRect(x + 1, y + 2, 8, 3);
      ctx.fillRect(x + (flap ? 0 : 2), y + 5, 3, 2);
      ctx.fillRect(x + 7 - (flap ? 0 : 2), y + 5, 3, 2);
    }
  }

  // Player triangle at the bottom
  const px = SCREEN_W / 2 + Math.round(14 * Math.sin(tick * 0.5));
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.moveTo(px, 78);
  ctx.lineTo(px - 7, 88);
  ctx.lineTo(px + 7, 88);
  ctx.closePath();
  ctx.fill();

  // Player bullets going up
  ctx.fillStyle = "#fff44d";
  const bulletY = 76 - ((tick * 6) % 40);
  if (bulletY > 10) {
    ctx.fillRect(px - 1, bulletY, 2, 6);
  }

  // Score
  ctx.fillStyle = "#00ff88";
  ctx.font = "8px monospace";
  ctx.fillText(`SCORE ${(tick * 7) % 9999}`.padStart(10, " "), 6, 8);
}

function drawRunner(ctx: CanvasRenderingContext2D, tick: number) {
  // Dark blue night background
  ctx.fillStyle = "#050514";
  ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);

  // Scrolling stars
  ctx.fillStyle = "#ffffff";
  for (let i = 0; i < 12; i++) {
    const x = (i * 23 + tick * 3) % SCREEN_W;
    const y = (i * 17 + 5) % 45;
    ctx.fillRect(x, y, 1, 1);
  }

  // Scrolling ground line
  const groundY = 74;
  ctx.fillStyle = "#ff9f00";
  ctx.fillRect(0, groundY, SCREEN_W, 2);

  // Ground dashes scrolling left
  ctx.fillStyle = "#ff9f00";
  for (let i = 0; i < 8; i++) {
    const x = ((i * 20 - tick * 4) % (SCREEN_W + 20) + SCREEN_W + 20) % (SCREEN_W + 20) - 10;
    ctx.fillRect(x, groundY + 8, 6, 2);
  }

  // Jumping square (player)
  const jumpPhase = (tick % 20) / 20;
  const jumpH = jumpPhase < 0.5 ? Math.sin(jumpPhase * Math.PI) * 28 : 0;
  const py = groundY - 10 - jumpH;
  ctx.fillStyle = "#00e5ff";
  ctx.fillRect(18, py, 10, 10);
  // Eyes
  ctx.fillStyle = "#050514";
  ctx.fillRect(22, py + 3, 2, 2);

  // Obstacles
  ctx.fillStyle = "#ff2e55";
  for (let i = 0; i < 3; i++) {
    const x = ((i * 60 - tick * 4) % (SCREEN_W + 40) + SCREEN_W + 40) % (SCREEN_W + 40) - 20;
    ctx.fillRect(x, groundY - 12, 6, 12);
  }

  // Score
  ctx.fillStyle = "#00ff88";
  ctx.font = "8px monospace";
  ctx.fillText(`DIST ${tick * 3}m`, 6, 8);
}

interface CabinetProps {
  position: [number, number, number];
  title: string;
  neon: string;
  game: GameKind;
}

function ArcadeCabinet({ position, title, neon, game }: CabinetProps) {
  const screenRef = useRef<THREE.CanvasTexture | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const tickRef = useRef(0);

  const marqueeTexture = useMemo(() => makeMarqueeTexture(title, neon), [title, neon]);

  useMemo(() => {
    const { texture, canvas } = makeScreenTexture();
    screenRef.current = texture;
    canvasRef.current = canvas;
    // Paint the first frame immediately
    const ctx = canvas.getContext("2d");
    if (ctx) {
      if (game === "invaders") drawInvaders(ctx, 0);
      else drawRunner(ctx, 0);
      texture.needsUpdate = true;
    }
  }, [game]);

  useFrame((_, delta) => {
    // Throttle to ~10fps
    tickRef.current += delta;
    if (tickRef.current < 0.1) return;
    const tick = Math.floor(tickRef.current * 10);
    const canvas = canvasRef.current;
    const tex = screenRef.current;
    if (!canvas || !tex) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    if (game === "invaders") drawInvaders(ctx, tick);
    else drawRunner(ctx, tick);
    tex.needsUpdate = true;
  });

  const screenTexture = screenRef.current;

  return (
    <group position={position}>
      {/* Cabinet body: 0.8 x 1.9 x 0.7, bottom on floor */}
      <mesh position={[0, 0.95, 0]}>
        <boxGeometry args={[0.8, 1.9, 0.7]} />
        <meshStandardMaterial color="#232345" roughness={0.6} metalness={0.25} />
      </mesh>

      {/* Side trim stripes */}
      <mesh position={[-0.405, 0.95, 0]}>
        <boxGeometry args={[0.02, 1.9, 0.62]} />
        <meshStandardMaterial color={neon} emissive={neon} emissiveIntensity={0.9} />
      </mesh>
      <mesh position={[0.405, 0.95, 0]}>
        <boxGeometry args={[0.02, 1.9, 0.62]} />
        <meshStandardMaterial color={neon} emissive={neon} emissiveIntensity={0.9} />
      </mesh>

      {/* Marquee: glowing title, top front */}
      <mesh position={[0, 1.78, 0.356]}>
        <planeGeometry args={[0.7, 0.25]} />
        <meshBasicMaterial map={marqueeTexture} toneMapped={false} />
      </mesh>
      <mesh position={[0, 1.78, 0.34]}>
        <boxGeometry args={[0.74, 0.29, 0.03]} />
        <meshStandardMaterial color="#14142b" roughness={0.5} metalness={0.3} />
      </mesh>

      {/* Screen: tilted slightly back, front face at y≈1.25 */}
      <group position={[0, 1.25, 0.345]} rotation={[-0.12, 0, 0]}>
        <mesh>
          <planeGeometry args={[0.6, 0.5]} />
          {screenTexture && (
            <meshBasicMaterial map={screenTexture} toneMapped={false} />
          )}
        </mesh>
        {/* Screen bezel */}
        <mesh position={[0, 0, -0.012]}>
          <planeGeometry args={[0.66, 0.56]} />
          <meshStandardMaterial color="#0a0a14" roughness={0.4} metalness={0.4} />
        </mesh>
      </group>

      {/* Control panel: angled box below the screen */}
      <group position={[0, 0.92, 0.32]} rotation={[-0.35, 0, 0]}>
        <mesh>
          <boxGeometry args={[0.7, 0.08, 0.28]} />
          <meshStandardMaterial color="#2e2e52" roughness={0.55} metalness={0.2} />
        </mesh>
        {/* Joystick: red cylinder + sphere */}
        <mesh position={[-0.18, 0.08, 0]}>
          <cylinderGeometry args={[0.02, 0.025, 0.1, 16]} />
          <meshStandardMaterial color="#888899" roughness={0.4} metalness={0.6} />
        </mesh>
        <mesh position={[-0.18, 0.15, 0]}>
          <sphereGeometry args={[0.035, 16, 16]} />
          <meshStandardMaterial color="#ff2222" roughness={0.3} emissive="#ff2222" emissiveIntensity={0.4} />
        </mesh>
        {/* 2 buttons: emissive cylinders */}
        <mesh position={[0.08, 0.055, 0.03]}>
          <cylinderGeometry args={[0.025, 0.025, 0.025, 16]} />
          <meshStandardMaterial color="#00e5ff" emissive="#00e5ff" emissiveIntensity={1.2} />
        </mesh>
        <mesh position={[0.2, 0.055, 0.03]}>
          <cylinderGeometry args={[0.025, 0.025, 0.025, 16]} />
          <meshStandardMaterial color="#ff2e88" emissive="#ff2e88" emissiveIntensity={1.2} />
        </mesh>
      </group>
    </group>
  );
}

export function ArcadeSection() {
  return (
    <group>
      <ArcadeCabinet
        position={[3.0, 0, -3.6]}
        title="ORBIT INVADERS"
        neon="#ff2e88"
        game="invaders"
      />
      <ArcadeCabinet
        position={[4.2, 0, -3.6]}
        title="TOKEN RUNNER"
        neon="#00e5ff"
        game="runner"
      />
    </group>
  );
}

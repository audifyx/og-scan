import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Stars, OrbitControls, Grid } from "@react-three/drei";
import * as THREE from "three";
import { Sparkles } from "lucide-react";
import { stageForMcap, moodForChange, type AvatarStats, type AvatarMood } from "./LivingAvatar";

/**
 * AgentOffice3D — "Orbit" the ORBITX agent as a Roblox-style blocky character
 * living in a 3D office floating in space. Long hair, beard + goatee, sharp suit.
 * He walks between his desk, the viewport window, and his trophy shelf.
 * His energy follows the market: green days = bouncy, red days = sleepy.
 * The office upgrades as market cap grows through evolution stages.
 */

// ── palette ──────────────────────────────────────────────────────────────
const SUIT = "#1b2547";
const SUIT_DARK = "#121a36";
const SHIRT = "#f4f6fb";
const TIE = "#2dd4bf";
const SKIN = "#e6b58c";
const HAIR = "#2a1d12";
const SHOE = "#0b0e18";

// ── waypoints: [x, z, pauseAction] ─────────────────────────────────────────
const WAYPOINTS: Array<[number, number, string]> = [
  [1.6, 1.4, "type"],   // at desk
  [-2.4, -0.6, "gaze"], // viewport window
  [2.6, -1.8, "admire"],// trophy shelf
  [-0.4, 1.8, "idle"],  // rug center
];

// ── Blocky Roblox-style agent ──────────────────────────────────────────────
function BlockyAgent({ mood, stage }: { mood: AvatarMood; stage: number }) {
  const root = useRef<THREE.Group>(null);
  const legL = useRef<THREE.Group>(null);
  const legR = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  const headG = useRef<THREE.Group>(null);
  const bodyG = useRef<THREE.Group>(null);
  const eyeL = useRef<THREE.Mesh>(null);
  const eyeR = useRef<THREE.Mesh>(null);
  const blinkT = useRef(2);
  const blinkP = useRef(0);

  const walk = useRef({
    x: 0, z: 0.6, rotY: 0,
    target: 1, state: "walk" as "walk" | "pause",
    timer: 0, t: 0, hop: 0,
  });

  const speed = mood === "ecstatic" ? 2.2 : mood === "happy" ? 1.4 : mood === "sleepy" ? 0.6 : 0.25;
  const bounce = mood === "ecstatic" ? 0.16 : mood === "happy" ? 0.09 : mood === "sleepy" ? 0.03 : 0.015;

  useFrame((state, delta) => {
    const w = walk.current;
    const g = root.current;
    if (!g) return;
    w.t += delta;
    const t = w.t;

    if (w.state === "walk") {
      const [tx, tz] = WAYPOINTS[w.target];
      const dx = tx - w.x, dz = tz - w.z;
      const dist = Math.hypot(dx, dz);
      const targetRot = Math.atan2(dx, dz);
      // turn toward target
      let dr = targetRot - w.rotY;
      while (dr > Math.PI) dr -= Math.PI * 2;
      while (dr < -Math.PI) dr += Math.PI * 2;
      w.rotY += THREE.MathUtils.clamp(dr, -3 * delta, 3 * delta);
      // move
      const step = Math.min(dist, speed * delta);
      w.x += (dx / (dist || 1)) * step;
      w.z += (dz / (dist || 1)) * step;
      // walk swing
      const sw = Math.sin(t * (6 + speed * 3)) * (0.55 + bounce);
      if (legL.current) legL.current.rotation.x = sw;
      if (legR.current) legR.current.rotation.x = -sw;
      if (armL.current) armL.current.rotation.x = -sw * 0.8;
      if (armR.current) armR.current.rotation.x = sw * 0.8;
      // bounce / hop
      w.hop = Math.abs(Math.sin(t * (6 + speed * 3))) * bounce;
      if (mood === "ecstatic" && Math.sin(t * 0.9) > 0.985) w.hop += 0.35; // happy jump
      if (dist < 0.08) { w.state = "pause"; w.timer = 2.5 + Math.random() * 3.5; w.target = (w.target + 1) % WAYPOINTS.length; }
    } else {
      w.timer -= delta;
      w.hop *= 0.9;
      // idle: ease limbs back, subtle typing at desk
      const act = WAYPOINTS[(w.target + WAYPOINTS.length - 1) % WAYPOINTS.length][2];
      const ease = (r: THREE.Group | null, x: number) => { if (r) r.rotation.x += (x - r.rotation.x) * Math.min(1, delta * 6); };
      if (act === "type") {
        const ty = Math.sin(t * 14) * 0.18 - 0.5;
        ease(armL.current, ty); ease(armR.current, -ty - 0.15);
        ease(legL.current, 0); ease(legR.current, 0);
        if (headG.current) headG.current.rotation.x += (0.18 - headG.current.rotation.x) * Math.min(1, delta * 4);
      } else if (act === "gaze") {
        ease(armL.current, 0); ease(armR.current, 0);
        if (headG.current) { headG.current.rotation.y = Math.sin(t * 0.7) * 0.4; headG.current.rotation.x = -0.08; }
      } else {
        ease(armL.current, Math.sin(t * 1.4) * 0.06); ease(armR.current, -Math.sin(t * 1.4) * 0.06);
        if (headG.current) { headG.current.rotation.y *= 0.95; headG.current.rotation.x += ((mood === "sleepy" || mood === "dormant" ? 0.22 : 0) - headG.current.rotation.x) * Math.min(1, delta * 3); }
      }
      if (w.timer <= 0) w.state = "walk";
    }

    // sleepy head droop / dormant breathing
    if (bodyG.current && (mood === "sleepy" || mood === "dormant")) {
      bodyG.current.scale.y = 1 + Math.sin(t * 1.2) * 0.012;
    }
    g.position.set(w.x, w.hop, w.z);
    g.rotation.y = w.rotY;

    // blinking (skip when sleepy/dormant — eyes already half closed)
    if (eyeL.current && eyeR.current && mood !== "sleepy" && mood !== "dormant") {
      blinkT.current -= delta;
      if (blinkT.current <= 0) {
        blinkT.current = 1.6 + Math.random() * 3.2;
        blinkP.current = 0.22; // blink duration
      }
      if (blinkP.current > 0) {
        blinkP.current -= delta;
        const k = Math.sin((1 - blinkP.current / 0.22) * Math.PI);
        eyeL.current.scale.y = eyeR.current.scale.y = Math.max(0.08, 1 - k * 0.95);
      } else {
        eyeL.current.scale.y = eyeR.current.scale.y = 1;
      }
    }
  });

  const eyeScaleY = mood === "sleepy" || mood === "dormant" ? 0.25 : 1;

  return (
    <group ref={root} position={[0, 0, 0.6]}>
      <group ref={bodyG}>
        {/* legs */}
        <group ref={legL} position={[-0.17, 0.78, 0]}>
          <mesh position={[0, -0.36, 0]}><boxGeometry args={[0.26, 0.72, 0.3]} /><meshStandardMaterial color={SUIT_DARK} /></mesh>
          <mesh position={[0, -0.72, 0.04]}><boxGeometry args={[0.28, 0.14, 0.42]} /><meshStandardMaterial color={SHOE} roughness={0.4} /></mesh>
        </group>
        <group ref={legR} position={[0.17, 0.78, 0]}>
          <mesh position={[0, -0.36, 0]}><boxGeometry args={[0.26, 0.72, 0.3]} /><meshStandardMaterial color={SUIT_DARK} /></mesh>
          <mesh position={[0, -0.72, 0.04]}><boxGeometry args={[0.28, 0.14, 0.42]} /><meshStandardMaterial color={SHOE} roughness={0.4} /></mesh>
        </group>
        {/* torso: suit jacket */}
        <mesh position={[0, 1.18, 0]}>
          <boxGeometry args={[0.72, 0.82, 0.42]} />
          <meshStandardMaterial color={SUIT} roughness={0.7} />
        </mesh>
        {/* shirt + tie */}
        <mesh position={[0, 1.2, 0.215]}><boxGeometry args={[0.26, 0.6, 0.02]} /><meshStandardMaterial color={SHIRT} /></mesh>
        <mesh position={[0, 1.32, 0.23]}><boxGeometry args={[0.09, 0.34, 0.03]} /><meshStandardMaterial color={TIE} emissive={TIE} emissiveIntensity={0.35} /></mesh>
        {/* lapels */}
        <mesh position={[-0.2, 1.3, 0.215]} rotation={[0, 0, 0.35]}><boxGeometry args={[0.1, 0.4, 0.02]} /><meshStandardMaterial color={SUIT_DARK} /></mesh>
        <mesh position={[0.2, 1.3, 0.215]} rotation={[0, 0, -0.35]}><boxGeometry args={[0.1, 0.4, 0.02]} /><meshStandardMaterial color={SUIT_DARK} /></mesh>
        {/* arms */}
        <group ref={armL} position={[-0.47, 1.52, 0]}>
          <mesh position={[0, -0.3, 0]}><boxGeometry args={[0.22, 0.62, 0.26]} /><meshStandardMaterial color={SUIT} roughness={0.7} /></mesh>
          <mesh position={[0, -0.62, 0]}><boxGeometry args={[0.2, 0.14, 0.22]} /><meshStandardMaterial color={SKIN} /></mesh>
        </group>
        <group ref={armR} position={[0.47, 1.52, 0]}>
          <mesh position={[0, -0.3, 0]}><boxGeometry args={[0.22, 0.62, 0.26]} /><meshStandardMaterial color={SUIT} roughness={0.7} /></mesh>
          <mesh position={[0, -0.62, 0]}><boxGeometry args={[0.2, 0.14, 0.22]} /><meshStandardMaterial color={SKIN} /></mesh>
        </group>
        {/* head */}
        <group ref={headG} position={[0, 1.92, 0]}>
          <mesh><boxGeometry args={[0.56, 0.52, 0.5]} /><meshStandardMaterial color={SKIN} roughness={0.6} /></mesh>
          {/* eyes */}
          <mesh ref={eyeL} position={[-0.13, 0.05, 0.26]} scale={[1, eyeScaleY, 1]}><boxGeometry args={[0.09, 0.11, 0.02]} /><meshStandardMaterial color="#10131c" /></mesh>
          <mesh ref={eyeR} position={[0.13, 0.05, 0.26]} scale={[1, eyeScaleY, 1]}><boxGeometry args={[0.09, 0.11, 0.02]} /><meshStandardMaterial color="#10131c" /></mesh>
          {/* brows */}
          <mesh position={[-0.13, 0.17, 0.26]} rotation={[0, 0, mood === "dormant" ? 0.3 : -0.12]}><boxGeometry args={[0.12, 0.03, 0.02]} /><meshStandardMaterial color={HAIR} /></mesh>
          <mesh position={[0.13, 0.17, 0.26]} rotation={[0, 0, mood === "dormant" ? -0.3 : 0.12]}><boxGeometry args={[0.12, 0.03, 0.02]} /><meshStandardMaterial color={HAIR} /></mesh>
          {/* beard + goatee */}
          <mesh position={[0, -0.16, 0.22]}><boxGeometry args={[0.46, 0.2, 0.12]} /><meshStandardMaterial color={HAIR} roughness={0.9} /></mesh>
          <mesh position={[0, -0.3, 0.2]}><boxGeometry args={[0.16, 0.14, 0.1]} /><meshStandardMaterial color={HAIR} roughness={0.9} /></mesh>
          {/* smile / flat */}
          {mood !== "dormant" && mood !== "sleepy" && (
            <mesh position={[0, -0.08, 0.27]}><boxGeometry args={[0.16, 0.035, 0.02]} /><meshStandardMaterial color="#7c4a32" /></mesh>
          )}
          {/* long hair: back + sides */}
          <mesh position={[0, -0.28, -0.28]}><boxGeometry args={[0.6, 0.95, 0.16]} /><meshStandardMaterial color={HAIR} roughness={0.95} /></mesh>
          <mesh position={[-0.32, -0.1, -0.05]}><boxGeometry args={[0.1, 0.6, 0.4]} /><meshStandardMaterial color={HAIR} roughness={0.95} /></mesh>
          <mesh position={[0.32, -0.1, -0.05]}><boxGeometry args={[0.1, 0.6, 0.4]} /><meshStandardMaterial color={HAIR} roughness={0.95} /></mesh>
          <mesh position={[0, 0.3, -0.05]}><boxGeometry args={[0.62, 0.14, 0.56]} /><meshStandardMaterial color={HAIR} roughness={0.95} /></mesh>
          {/* crown at Titan+ */}
          {stage >= 4 && (
            <group position={[0, 0.42, 0]}>
              <mesh><cylinderGeometry args={[0.2, 0.24, 0.16, 6]} /><meshStandardMaterial color="#ffd166" metalness={0.8} roughness={0.25} emissive="#ffd166" emissiveIntensity={0.25} /></mesh>
              {[-0.16, -0.05, 0.06, 0.17].map((x, i) => (
                <mesh key={i} position={[x, 0.14, 0]}><coneGeometry args={[0.045, 0.14, 4]} /><meshStandardMaterial color="#ffd166" metalness={0.8} roughness={0.25} /></mesh>
              ))}
            </group>
          )}
        </group>
      </group>
    </group>
  );
}

// ── Office ─────────────────────────────────────────────────────────────────
import { useScreenTexture, type ScreenKind } from "./MonitorScreens";

function Monitor({ position, rotationY = 0, hue = "#22d3ee", chart = false }: { position: [number, number, number]; rotationY?: number; hue?: string; chart?: boolean }) {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh><boxGeometry args={[0.9, 0.55, 0.06]} /><meshStandardMaterial color="#0d1220" roughness={0.5} /></mesh>
      <mesh position={[0, 0, 0.035]}>
        <planeGeometry args={[0.82, 0.47]} />
        <meshStandardMaterial color="#020610" emissive={hue} emissiveIntensity={0.85} />
      </mesh>
      {chart && (
        <mesh position={[-0.1, -0.02, 0.045]}>
          <planeGeometry args={[0.6, 0.22]} />
          <meshStandardMaterial color="#020610" emissive="#4ade80" emissiveIntensity={1.2} />
        </mesh>
      )}
      <mesh position={[0, -0.38, 0]}><boxGeometry args={[0.08, 0.2, 0.08]} /><meshStandardMaterial color="#1a2138" /></mesh>
    </group>
  );
}

/** Monitor with a LIVE screen: real price, X scanner, build terminal, radar. */
function LiveMonitor({ position, rotationY = 0, screen, stats }: { position: [number, number, number]; rotationY?: number; screen: ScreenKind; stats: AvatarStats }) {
  const tex = useScreenTexture(screen, stats);
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh><boxGeometry args={[1.15, 0.72, 0.07]} /><meshStandardMaterial color="#0d1220" roughness={0.5} /></mesh>
      <mesh position={[0, 0, 0.04]}>
        <planeGeometry args={[1.05, 0.62]} />
        <meshBasicMaterial map={tex} toneMapped={false} />
      </mesh>
      {/* glow spill */}
      <mesh position={[0, 0, -0.02]}><planeGeometry args={[1.3, 0.85]} /><meshBasicMaterial color="#22d3ee" transparent opacity={0.08} /></mesh>
      <mesh position={[0, -0.46, 0]}><boxGeometry args={[0.09, 0.24, 0.09]} /><meshStandardMaterial color="#1a2138" /></mesh>
      <mesh position={[0, -0.58, 0.05]}><boxGeometry args={[0.5, 0.04, 0.3]} /><meshStandardMaterial color="#1a2138" /></mesh>
    </group>
  );
}

// ── world growth: office → city ──────────────────────────────────────────────
const WORLD_NAMES = ["Pod", "Office", "Studio", "Headquarters", "Sky Tower", "Metropolis"];
const AGENTS_PER_STAGE = [0, 0, 1, 3, 5, 7];

function seededRand(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const CITIZEN_COLORS = ["#7c3aed", "#f59e0b", "#ec4899", "#10b981", "#3b82f6", "#ef4444", "#14b8a6"];
const AGENT_ROLES = ["BUILDER", "SCOUT", "TRADER", "GUARD", "MINER", "ORACLE", "PILOT"];

/** A simple AI citizen: blocky body, glowing visor, patrols a small loop. */
function MiniAgent({ seed, center, radius, color, speed = 0.4, role = "AGENT" }: { seed: number; center: [number, number]; radius: number; color: string; speed?: number; role?: string }) {
  const g = useRef<THREE.Group>(null);
  const legL = useRef<THREE.Mesh>(null);
  const legR = useRef<THREE.Mesh>(null);
  const bob = useRef<THREE.Group>(null);
  const tag = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 256; c.height = 64;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "rgba(2,8,16,0.8)";
    ctx.beginPath(); ctx.roundRect(2, 6, 252, 52, 14); ctx.fill();
    ctx.strokeStyle = color; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.roundRect(2, 6, 252, 52, 14); ctx.stroke();
    ctx.fillStyle = "#fff";
    ctx.font = "bold 30px monospace";
    ctx.textAlign = "center";
    ctx.fillText(role, 128, 44);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [role, color]);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime() * speed + seed * 2.4;
    const x = center[0] + Math.cos(t) * radius;
    const z = center[1] + Math.sin(t) * radius;
    if (g.current) {
      g.current.position.set(x, 0, z);
      g.current.rotation.y = -t;
    }
    const sw = Math.sin(clock.getElapsedTime() * 7 + seed * 5) * 0.55;
    if (legL.current) legL.current.rotation.x = sw;
    if (legR.current) legR.current.rotation.x = -sw;
    if (bob.current) bob.current.position.y = Math.abs(Math.sin(clock.getElapsedTime() * 7 + seed * 5)) * 0.05;
  });
  return (
    <group ref={g}>
      <group ref={bob}>
        {/* legs */}
        <mesh ref={legL} position={[-0.11, 0.28, 0]}><boxGeometry args={[0.16, 0.56, 0.2]} /><meshStandardMaterial color="#141a30" roughness={0.7} /></mesh>
        <mesh ref={legR} position={[0.11, 0.28, 0]}><boxGeometry args={[0.16, 0.56, 0.2]} /><meshStandardMaterial color="#141a30" roughness={0.7} /></mesh>
        {/* torso */}
        <mesh position={[0, 0.85, 0]}><boxGeometry args={[0.52, 0.62, 0.32]} /><meshStandardMaterial color={color} roughness={0.5} metalness={0.2} /></mesh>
        <mesh position={[0, 0.85, 0.17]}><boxGeometry args={[0.3, 0.3, 0.02]} /><meshStandardMaterial color="#0b0f1c" emissive={color} emissiveIntensity={0.7} /></mesh>
        {/* head */}
        <mesh position={[0, 1.35, 0]}><boxGeometry args={[0.36, 0.32, 0.34]} /><meshStandardMaterial color="#1c2440" roughness={0.5} /></mesh>
        <mesh position={[0, 1.36, 0.18]}><boxGeometry args={[0.26, 0.1, 0.02]} /><meshStandardMaterial color="#000" emissive="#7df9ff" emissiveIntensity={2} /></mesh>
        {/* antenna */}
        <mesh position={[0.12, 1.6, 0]}><cylinderGeometry args={[0.015, 0.015, 0.18, 6]} /><meshStandardMaterial color="#39415f" /></mesh>
        <mesh position={[0.12, 1.72, 0]}><sphereGeometry args={[0.035, 8, 8]} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={2.5} /></mesh>
        {/* role tag */}
        <mesh position={[0, 2.05, 0]}>
          <planeGeometry args={[0.9, 0.225]} />
          <meshBasicMaterial map={tag} transparent opacity={0.95} side={THREE.DoubleSide} toneMapped={false} />
        </mesh>
        {/* carried data cube */}
        <mesh position={[0.42, 0.85, 0.1]}>
          <boxGeometry args={[0.16, 0.16, 0.16]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.8} transparent opacity={0.92} />
        </mesh>
      </group>
    </group>
  );
}

function Citizens({ stage }: { stage: number }) {
  const spots = useMemo(() => {
    const n = AGENTS_PER_STAGE[stage] ?? 0;
    const base: Array<{ center: [number, number]; radius: number; speed: number }> = [
      { center: [4.6, 0.8], radius: 1.2, speed: 0.45 },
      { center: [-9.5, 2], radius: 1.6, speed: 0.35 },
      { center: [-9.5, 2], radius: 2.2, speed: 0.28 },
      { center: [-1.5, -2.5], radius: 1.8, speed: 0.4 },
      { center: [3.5, 3.2], radius: 1.4, speed: 0.5 },
      { center: [-9.5, 2], radius: 1.0, speed: 0.55 },
      { center: [-4.5, 2.5], radius: 1.5, speed: 0.38 },
    ];
    return base.slice(0, n);
  }, [stage]);
  return (
    <group>
      {spots.map((s, i) => (
        <MiniAgent key={i} seed={i + 1} center={s.center} radius={s.radius} color={CITIZEN_COLORS[i % CITIZEN_COLORS.length]} speed={s.speed} role={AGENT_ROLES[i % AGENT_ROLES.length]} />
      ))}
    </group>
  );
}

function useBuildingTexture() {
  return useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 64; c.height = 128;
    const g = c.getContext("2d")!;
    g.fillStyle = "#0b1120"; g.fillRect(0, 0, 64, 128);
    const rand = seededRand(7);
    for (let y = 6; y < 122; y += 12) {
      for (let x = 6; x < 58; x += 12) {
        const lit = rand() > 0.5;
        g.fillStyle = lit ? ["#5eead4", "#fbbf24", "#7dd3fc"][Math.floor(rand() * 3)] : "#141c30";
        g.fillRect(x, y, 7, 7);
      }
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  }, []);
}

/** Ring of lit towers floating around the office — the growing city. */
function CityBuildings({ stage }: { stage: number }) {
  const tex = useBuildingTexture();
  const buildings = useMemo(() => {
    const rand = seededRand(42);
    const count = stage >= 5 ? 14 : 8;
    return Array.from({ length: count }, (_, i) => {
      const angle = (i / count) * Math.PI * 2 + rand() * 0.5;
      const radius = 12 + rand() * (stage >= 5 ? 9 : 5);
      const w = 1.7 + rand() * 1.5;
      const h = (stage >= 5 ? 5 : 3.5) + rand() * (stage >= 5 ? 10 : 5);
      const d = 1.7 + rand() * 1.5;
      return { x: Math.cos(angle) * radius, z: Math.sin(angle) * radius, w, h, d, rot: rand() * Math.PI, rep: 1 + Math.floor(rand() * 2) };
    });
  }, [stage]);
  return (
    <group>
      {buildings.map((b, i) => (
        <group key={i} position={[b.x, 0, b.z]} rotation={[0, b.rot, 0]}>
          {/* glowing base pad */}
          <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[Math.max(b.w, b.d) * 0.85, 24]} />
            <meshStandardMaterial color="#0a0e1c" emissive="#2dd4bf" emissiveIntensity={0.35} transparent opacity={0.85} />
          </mesh>
          <mesh position={[0, b.h / 2, 0]}>
            <boxGeometry args={[b.w, b.h, b.d]} />
            <meshStandardMaterial color="#0d1428" roughness={0.6} metalness={0.3} emissiveMap={tex} emissive="#ffffff" emissiveIntensity={0.85} />
          </mesh>
          {/* roof beacon */}
          <mesh position={[0, b.h + 0.15, 0]}>
            <sphereGeometry args={[0.09, 8, 8]} />
            <meshStandardMaterial color="#f43f5e" emissive="#f43f5e" emissiveIntensity={2.5} />
          </mesh>
        </group>
      ))}
      {/* central spire at max stage */}
      {stage >= 5 && (
        <group position={[0, 0, -17]}>
          <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[2.6, 32]} />
            <meshStandardMaterial color="#0a0e1c" emissive="#a78bfa" emissiveIntensity={0.5} transparent opacity={0.9} />
          </mesh>
          <mesh position={[0, 8, 0]}>
            <boxGeometry args={[3, 16, 3]} />
            <meshStandardMaterial color="#0d1428" roughness={0.5} metalness={0.4} emissiveMap={tex} emissive="#ffffff" emissiveIntensity={1} />
          </mesh>
          <mesh position={[0, 16.6, 0]} rotation={[0, 0, Math.PI / 4]}>
            <octahedronGeometry args={[0.9]} />
            <meshStandardMaterial color="#2dd4bf" emissive="#2dd4bf" emissiveIntensity={2} />
          </mesh>
        </group>
      )}
    </group>
  );
}

/** Flying vehicles crossing the skyline. */
function SkyTraffic({ stage }: { stage: number }) {
  const count = stage >= 5 ? 7 : 4;
  const ships = useMemo(() => {
    const rand = seededRand(99);
    return Array.from({ length: count }, (_, i) => ({
      y: 5.5 + (i % 3) * 1.8 + rand() * 0.8,
      z: -15 + rand() * 24,
      speed: 2.2 + rand() * 2.4,
      offset: rand() * 44,
      color: ["#22d3ee", "#f472b6", "#a78bfa"][i % 3],
    }));
  }, [count]);
  const refs = useRef<Array<THREE.Group | null>>([]);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    ships.forEach((s, i) => {
      const g = refs.current[i];
      if (!g) return;
      const x = ((t * s.speed + s.offset) % 48) - 24;
      g.position.set(x, s.y, s.z);
    });
  });
  return (
    <group>
      {ships.map((s, i) => (
        <group key={i} ref={(el) => { refs.current[i] = el; }}>
          <mesh><boxGeometry args={[1.15, 0.22, 0.42]} /><meshStandardMaterial color="#0d1326" emissive={s.color} emissiveIntensity={1.4} /></mesh>
          <mesh position={[0.72, 0, 0]}><boxGeometry args={[0.22, 0.1, 0.18]} /><meshStandardMaterial color="#fff" emissive="#ffffff" emissiveIntensity={2.2} /></mesh>
          <mesh position={[-0.75, 0, 0]}><boxGeometry args={[0.3, 0.06, 0.5]} /><meshStandardMaterial color={s.color} emissive={s.color} emissiveIntensity={1} transparent opacity={0.7} /></mesh>
        </group>
      ))}
    </group>
  );
}

/** Second workstation (stage 2+). */
function SecondDesk({ stats }: { stats: AvatarStats }) {
  return (
    <group position={[4.9, 0, 0.9]} rotation={[0, -Math.PI / 2, 0]}>
      <mesh position={[0, 0.72, 0]}><boxGeometry args={[1.9, 0.09, 0.95]} /><meshStandardMaterial color="#182036" roughness={0.4} metalness={0.3} /></mesh>
      {[[-0.85, -0.38], [0.85, -0.38], [-0.85, 0.38], [0.85, 0.38]].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.34, z]}><boxGeometry args={[0.08, 0.68, 0.08]} /><meshStandardMaterial color="#0d1326" /></mesh>
      ))}
      <mesh position={[0, 0.65, 0]}><boxGeometry args={[1.8, 0.02, 0.85]} /><meshStandardMaterial color="#000" emissive="#a78bfa" emissiveIntensity={0.9} /></mesh>
      <LiveMonitor position={[-0.5, 1.3, -0.1]} rotationY={0.18} screen="radar" stats={stats} />
      <LiveMonitor position={[0.5, 1.3, -0.1]} rotationY={-0.18} screen="terminal" stats={stats} />
      <mesh position={[0, 0.45, 0.55]}><boxGeometry args={[0.55, 0.5, 0.1]} /><meshStandardMaterial color="#1e2a4a" roughness={0.6} /></mesh>
    </group>
  );
}

/** Floating plaza disc with meeting table + hologram (stage 3+). */
function Plaza() {
  const holo = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (holo.current) {
      holo.current.rotation.y = clock.getElapsedTime() * 0.8;
      holo.current.position.y = 1.5 + Math.sin(clock.getElapsedTime() * 1.5) * 0.08;
    }
  });
  return (
    <group>
      {/* light bridge from main floor */}
      <mesh position={[-7.6, 0.04, 2]}><boxGeometry args={[2.2, 0.08, 1.2]} /><meshStandardMaterial color="#0d1428" emissive="#2dd4bf" emissiveIntensity={0.5} /></mesh>
      {/* disc */}
      <group position={[-10.5, 0, 2]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}><cylinderGeometry args={[3.4, 3.1, 0.35, 36]} /><meshStandardMaterial color="#0a0e1c" roughness={0.35} metalness={0.6} /></mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.19, 0]}>
          <ringGeometry args={[2.9, 3.25, 40]} />
          <meshStandardMaterial color="#2dd4bf" emissive="#2dd4bf" emissiveIntensity={0.6} />
        </mesh>
        {/* meeting table */}
        <mesh position={[0, 0.75, 0]}><cylinderGeometry args={[1.15, 1.15, 0.09, 24]} /><meshStandardMaterial color="#182036" roughness={0.35} metalness={0.35} /></mesh>
        <mesh position={[0, 0.4, 0]}><cylinderGeometry args={[0.16, 0.3, 0.7, 12]} /><meshStandardMaterial color="#0d1326" metalness={0.6} /></mesh>
        <mesh position={[0, 0.68, 0]}><cylinderGeometry args={[1.05, 1.05, 0.02, 24]} /><meshStandardMaterial color="#000" emissive="#38bdf8" emissiveIntensity={0.7} /></mesh>
        {/* stools */}
        {[0, 1, 2, 3].map((i) => {
          const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
          return (
            <mesh key={i} position={[Math.cos(a) * 1.9, 0.55, Math.sin(a) * 1.9]}>
              <cylinderGeometry args={[0.28, 0.24, 0.5, 12]} />
              <meshStandardMaterial color="#232c4e" roughness={0.7} />
            </mesh>
          );
        })}
        {/* hologram projector */}
        <mesh position={[0, 0.85, 0]}><cylinderGeometry args={[0.12, 0.16, 0.1, 12]} /><meshStandardMaterial color="#39415f" metalness={0.7} /></mesh>
        <group ref={holo}>
          <mesh rotation={[0, 0, Math.PI / 4]}>
            <octahedronGeometry args={[0.42]} />
            <meshStandardMaterial color="#38bdf8" emissive="#38bdf8" emissiveIntensity={1.6} transparent opacity={0.85} wireframe />
          </mesh>
        </group>
      </group>
    </group>
  );
}

/** The AI Core — holographic heart of the office. Pulses with market mood. */
function AICore({ mood, change }: { mood: AvatarMood; change: number | null }) {
  const core = useRef<THREE.Group>(null);
  const ring1 = useRef<THREE.Mesh>(null);
  const ring2 = useRef<THREE.Mesh>(null);
  const color = mood === "ecstatic" ? "#34d399" : mood === "happy" ? "#22d3ee" : mood === "sleepy" ? "#fbbf24" : "#6366f1";
  const energy = Math.min(1.6, 0.7 + Math.abs(change ?? 0) / 12);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (core.current) {
      core.current.rotation.y = t * 0.9;
      core.current.rotation.x = Math.sin(t * 0.6) * 0.25;
      core.current.position.y = 1.9 + Math.sin(t * 2.2) * 0.12;
      const s = 1 + Math.sin(t * 3.5 * energy) * 0.08 * energy;
      core.current.scale.setScalar(s);
    }
    if (ring1.current) ring1.current.rotation.z = t * 0.7;
    if (ring2.current) ring2.current.rotation.z = -t * 0.5;
  });
  return (
    <group position={[-2.1, 0, -3.1]}>
      {/* pedestal */}
      <mesh position={[0, 0.35, 0]}><cylinderGeometry args={[0.5, 0.65, 0.7, 16]} /><meshStandardMaterial color="#10172c" metalness={0.6} roughness={0.35} /></mesh>
      <mesh position={[0, 0.72, 0]}><cylinderGeometry args={[0.52, 0.52, 0.05, 16]} /><meshStandardMaterial color="#000" emissive={color} emissiveIntensity={1.4} /></mesh>
      {/* holo brain */}
      <group ref={core}>
        <mesh>
          <icosahedronGeometry args={[0.42, 1]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.8} wireframe transparent opacity={0.9} />
        </mesh>
        <mesh>
          <icosahedronGeometry args={[0.26, 1]} />
          <meshStandardMaterial color="#ffffff" emissive={color} emissiveIntensity={2.4} transparent opacity={0.95} />
        </mesh>
      </group>
      {/* orbit rings */}
      <mesh ref={ring1} position={[0, 1.9, 0]} rotation={[Math.PI / 2.4, 0, 0]}>
        <torusGeometry args={[0.72, 0.02, 8, 48]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.2} transparent opacity={0.8} />
      </mesh>
      <mesh ref={ring2} position={[0, 1.9, 0]} rotation={[Math.PI / 1.7, 0.4, 0]}>
        <torusGeometry args={[0.9, 0.015, 8, 48]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.9} transparent opacity={0.6} />
      </mesh>
      {/* light beam */}
      <mesh position={[0, 1.3, 0]}>
        <cylinderGeometry args={[0.3, 0.45, 1.1, 16, 1, true]} />
        <meshBasicMaterial color={color} transparent opacity={0.12} side={THREE.DoubleSide} />
      </mesh>
      {/* label */}
      <mesh position={[0, 0.15, 0.62]}>
        <planeGeometry args={[0.9, 0.22]} />
        <meshBasicMaterial color="#04070f" transparent opacity={0.85} />
      </mesh>
    </group>
  );
}

/** Airship with glowing ORBITX banner circling the city (stage 3+). */
function Airship() {
  const g = useRef<THREE.Group>(null);
  const banner = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 512; c.height = 96;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "rgba(2,10,20,0.85)";
    ctx.fillRect(0, 0, 512, 96);
    ctx.strokeStyle = "#5eead4";
    ctx.lineWidth = 4;
    ctx.strokeRect(4, 4, 504, 88);
    ctx.fillStyle = "#5eead4";
    ctx.font = "bold 52px monospace";
    ctx.textAlign = "center";
    ctx.shadowColor = "#5eead4";
    ctx.shadowBlur = 16;
    ctx.fillText("◈ ORBITX ◈", 256, 66);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
  useFrame(({ clock }) => {
    if (!g.current) return;
    const t = clock.getElapsedTime() * 0.12;
    const r = 16;
    g.current.position.set(Math.cos(t) * r, 9.5 + Math.sin(t * 2.3) * 0.5, Math.sin(t) * r - 6);
    g.current.rotation.y = -t - Math.PI / 2;
  });
  return (
    <group ref={g}>
      {/* envelope */}
      <mesh>
        <capsuleGeometry args={[1.1, 3.2, 8, 16]} />
        <meshStandardMaterial color="#1e2a4a" metalness={0.7} roughness={0.35} emissive="#0e3a4a" emissiveIntensity={0.4} />
      </mesh>
      {/* fins */}
      <mesh position={[-2.2, 0.4, 0]} rotation={[0, 0, 0.5]}><boxGeometry args={[1.2, 0.12, 0.9]} /><meshStandardMaterial color="#141c36" metalness={0.6} roughness={0.4} /></mesh>
      {/* gondola */}
      <mesh position={[0, -1.35, 0]}><boxGeometry args={[1.6, 0.5, 0.8]} /><meshStandardMaterial color="#0f1528" metalness={0.5} roughness={0.5} /></mesh>
      <mesh position={[0, -1.35, 0.42]}><boxGeometry args={[1.2, 0.2, 0.04]} /><meshStandardMaterial color="#000" emissive="#fbbf24" emissiveIntensity={1.6} /></mesh>
      {/* banner */}
      <mesh position={[0, -2.3, 0]}>
        <planeGeometry args={[4.4, 0.82]} />
        <meshBasicMaterial map={banner} transparent side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
      {/* nav lights */}
      <mesh position={[2.3, 0, 0]}><sphereGeometry args={[0.09, 8, 8]} /><meshBasicMaterial color="#ff5555" /></mesh>
      <mesh position={[-2.3, 0, 0]}><sphereGeometry args={[0.09, 8, 8]} /><meshBasicMaterial color="#55ff88" /></mesh>
    </group>
  );
}

/** Firework bursts in the city sky (stage 4+). */
function Fireworks({ count = 5 }: { count?: number }) {
  const ref = useRef<THREE.Points>(null);
  const data = useMemo(() => {
    const bursts: Array<{ cx: number; cy: number; cz: number; color: string }> = [];
    const colors = ["#5eead4", "#a78bfa", "#fbbf24", "#f472b6", "#38bdf8"];
    for (let i = 0; i < count; i++) {
      bursts.push({
        cx: (Math.random() - 0.5) * 30,
        cy: 7 + Math.random() * 5,
        cz: -8 - Math.random() * 14,
        color: colors[i % colors.length],
      });
    }
    const per = 60;
    const pos = new Float32Array(count * per * 3);
    const vel: number[] = [];
    for (let b = 0; b < count; b++) {
      for (let i = 0; i < per; i++) {
        const th = Math.random() * Math.PI * 2;
        const ph = Math.acos(2 * Math.random() - 1);
        const sp = 1.5 + Math.random() * 2;
        vel.push(Math.sin(ph) * Math.cos(th) * sp, Math.cos(ph) * sp, Math.sin(ph) * Math.sin(th) * sp);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    return { geo: g, bursts, vel, per };
  }, [count]);
  const t0 = useRef(0);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.getElapsedTime();
    const cycle = 4.5;
    const local = (t + t0.current) % cycle;
    const p = ref.current.geometry.attributes.position as THREE.BufferAttribute;
    const { bursts, vel, per } = data;
    for (let b = 0; b < bursts.length; b++) {
      const { cx, cy, cz } = bursts[b];
      const delay = b * 0.7;
      const lt = Math.max(0, local - delay);
      for (let i = 0; i < per; i++) {
        const idx = b * per + i;
        const k = Math.min(1, lt / 1.6);
        const fade = 1 - k;
        p.setXYZ(
          idx,
          cx + vel[idx * 3] * lt * fade + vel[idx * 3] * 0.4,
          cy + vel[idx * 3 + 1] * lt - 1.2 * lt * lt,
          cz + vel[idx * 3 + 2] * lt * fade + vel[idx * 3 + 2] * 0.4,
        );
      }
    }
    p.needsUpdate = true;
    (ref.current.material as THREE.PointsMaterial).opacity = local < 3.4 ? 0.9 : Math.max(0, 0.9 - (local - 3.4) * 2);
  });
  return (
    <points ref={ref} geometry={data.geo}>
      <pointsMaterial color="#a5f3fc" size={0.14} transparent opacity={0.9} blending={THREE.AdditiveBlending} depthWrite={false} />
    </points>
  );
}

/** Street lamps ringing the city (stage 4+). */
function StreetLamps() {
  const lamps = useMemo(() => {
    const arr: Array<[number, number]> = [];
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      arr.push([Math.cos(a) * 10.5, Math.sin(a) * 10.5]);
    }
    return arr;
  }, []);
  return (
    <group>
      {lamps.map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh position={[0, 1.5, 0]}><cylinderGeometry args={[0.06, 0.09, 3, 8]} /><meshStandardMaterial color="#141a30" metalness={0.6} roughness={0.4} /></mesh>
          <mesh position={[0, 3.05, 0]}><sphereGeometry args={[0.16, 12, 12]} /><meshStandardMaterial color="#fef9c3" emissive="#fde68a" emissiveIntensity={2.2} /></mesh>
          <mesh position={[0, 3.05, 0]}><sphereGeometry args={[0.3, 12, 12]} /><meshBasicMaterial color="#fde68a" transparent opacity={0.18} /></mesh>
        </group>
      ))}
    </group>
  );
}

/** Floating holographic live price above the office. */
function PriceHologram({ stats, stage }: { stats: AvatarStats; stage: number }) {
  const tex = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 512; c.height = 160;
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
  const ref = useRef<THREE.Group>(null);

  useEffect(() => {
    let alive = true;
    const draw = () => {
      if (!alive) return;
      const c = tex.image as HTMLCanvasElement;
      const g = c.getContext("2d")!;
      const up = (stats.change24h ?? 0) >= 0;
      g.clearRect(0, 0, 512, 160);
      g.fillStyle = "rgba(2,10,18,0.72)";
      g.beginPath(); g.roundRect(4, 4, 504, 152, 24); g.fill();
      g.strokeStyle = up ? "rgba(52,211,153,0.6)" : "rgba(251,113,133,0.6)";
      g.lineWidth = 3;
      g.beginPath(); g.roundRect(4, 4, 504, 152, 24); g.stroke();
      g.textAlign = "center";
      g.fillStyle = "#5eead4";
      g.font = "bold 30px monospace";
      g.fillText("ORBITX / USD", 256, 48);
      const p = stats.price;
      g.fillStyle = up ? "#34d399" : "#fb7185";
      g.font = "bold 56px monospace";
      g.shadowColor = g.fillStyle as string;
      g.shadowBlur = 18;
      g.fillText(p != null && p > 0 ? (p < 0.0001 ? p.toExponential(2) : `$${p.toFixed(6)}`) : "—", 256, 112);
      g.shadowBlur = 0;
      g.fillStyle = "rgba(255,255,255,0.55)";
      g.font = "bold 24px monospace";
      const chg = stats.change24h;
      g.fillText(chg != null ? `${up ? "▲" : "▼"} ${Math.abs(chg).toFixed(1)}%` : "", 256, 144);
      tex.needsUpdate = true;
    };
    draw();
    const id = setInterval(draw, 4000);
    return () => { alive = false; clearInterval(id); };
  }, [tex, stats.price, stats.change24h]);

  useFrame(({ clock }) => {
    if (ref.current) ref.current.position.y = (stage >= 4 ? 8.2 : 5.6) + Math.sin(clock.getElapsedTime() * 1.1) * 0.18;
  });

  return (
    <group ref={ref} position={[0, stage >= 4 ? 8.2 : 5.6, -3.5]}>
      <mesh>
        <planeGeometry args={[4.6, 1.44]} />
        <meshBasicMaterial map={tex} transparent opacity={0.95} side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
    </group>
  );
}

/** Giant holographic ORBITX billboard (stage 3+). */
function HoloBillboard() {
  const tex = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 512; c.height = 128;
    const g = c.getContext("2d")!;
    g.fillStyle = "rgba(2,8,16,0.85)";
    g.fillRect(0, 0, 512, 128);
    g.font = "bold 72px monospace";
    g.textAlign = "center";
    g.fillStyle = "#5eead4";
    g.shadowColor = "#2dd4bf";
    g.shadowBlur = 24;
    g.fillText("ORBITX", 256, 82);
    g.font = "bold 20px monospace";
    g.fillStyle = "#a5b4fc";
    g.fillText("· TO THE STARS ·", 256, 112);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (ref.current) ref.current.position.y = 6.4 + Math.sin(clock.getElapsedTime() * 0.8) * 0.15;
  });
  return (
    <group ref={ref} position={[-7.5, 6.4, -14]}>
      <mesh>
        <planeGeometry args={[7, 1.75]} />
        <meshBasicMaterial map={tex} transparent opacity={0.92} side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
      {/* support poles */}
      {[-3.2, 3.2].map((x, i) => (
        <mesh key={i} position={[x, -3.4, 0]}>
          <cylinderGeometry args={[0.09, 0.09, 5.2, 8]} />
          <meshStandardMaterial color="#1a2138" metalness={0.6} roughness={0.4} />
        </mesh>
      ))}
    </group>
  );
}

/** Rising ember particles. */
function Embers({ count = 90, area = 16 }: { count?: number; area?: number }) {
  const ref = useRef<THREE.Points>(null);
  const { geo, speeds } = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const spd: number[] = [];
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * area;
      pos[i * 3 + 1] = Math.random() * 9;
      pos[i * 3 + 2] = (Math.random() - 0.5) * area;
      spd.push(0.25 + Math.random() * 0.7);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    return { geo: g, speeds: spd };
  }, [count, area]);
  useFrame((_, dt) => {
    if (!ref.current) return;
    const p = ref.current.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < count; i++) {
      let y = p.getY(i) + speeds[i] * dt;
      if (y > 9.5) y = 0;
      p.setY(i, y);
      p.setX(i, p.getX(i) + Math.sin(y * 2 + i) * dt * 0.25);
    }
    p.needsUpdate = true;
  });
  return (
    <points ref={ref} geometry={geo}>
      <pointsMaterial color="#5eead4" size={0.09} transparent opacity={0.75} blending={THREE.AdditiveBlending} depthWrite={false} />
    </points>
  );
}

/** Rocket on a launch pad (stage 4+). */
function RocketPad() {
  const rocket = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (rocket.current) rocket.current.position.y = Math.sin(clock.getElapsedTime() * 1.4) * 0.06;
  });
  return (
    <group position={[9.5, 0, -9]}>
      {/* pad */}
      <mesh position={[0, 0.15, 0]}><cylinderGeometry args={[1.6, 1.9, 0.3, 20]} /><meshStandardMaterial color="#1a2138" metalness={0.5} roughness={0.5} /></mesh>
      <mesh position={[0, 0.32, 0]}><cylinderGeometry args={[1.62, 1.62, 0.04, 20]} /><meshStandardMaterial color="#000" emissive="#22d3ee" emissiveIntensity={1.1} /></mesh>
      {/* rocket */}
      <group ref={rocket} position={[0, 0.35, 0]}>
        <mesh position={[0, 1.1, 0]}><cylinderGeometry args={[0.42, 0.42, 1.7, 16]} /><meshStandardMaterial color="#e2e8f0" metalness={0.7} roughness={0.3} /></mesh>
        <mesh position={[0, 2.25, 0]}><coneGeometry args={[0.42, 0.8, 16]} /><meshStandardMaterial color="#f43f5e" metalness={0.5} roughness={0.4} /></mesh>
        <mesh position={[0, 0.35, 0]}><cylinderGeometry args={[0.3, 0.42, 0.35, 16]} /><meshStandardMaterial color="#0d1220" /></mesh>
        {/* fins */}
        {[0, 1.4, 2.8, 4.2].map((a, i) => (
          <mesh key={i} position={[Math.cos(a) * 0.5, 0.55, Math.sin(a) * 0.5]} rotation={[0, -a, 0]}>
            <boxGeometry args={[0.08, 0.7, 0.4]} /><meshStandardMaterial color="#f43f5e" metalness={0.5} roughness={0.4} />
          </mesh>
        ))}
        {/* engine glow */}
        <mesh position={[0, 0.12, 0]}><coneGeometry args={[0.22, 0.5, 12]} /><meshBasicMaterial color="#5eead4" transparent opacity={0.85} /></mesh>
        {/* window */}
        <mesh position={[0, 1.5, 0.4]}><circleGeometry args={[0.14, 16]} /><meshStandardMaterial color="#0ea5e9" emissive="#38bdf8" emissiveIntensity={1.6} /></mesh>
      </group>
    </group>
  );
}

function Office({ stage, mood, stats }: { stage: number; mood: AvatarMood; stats: AvatarStats }) {
  const crystal = useRef<THREE.Group>(null);
  useFrame((s) => {
    if (crystal.current) {
      crystal.current.rotation.y = s.clock.elapsedTime * 0.5;
      crystal.current.position.y = 2.6 + Math.sin(s.clock.elapsedTime * 1.2) * 0.15;
    }
  });
  return (
    <group>
      {/* floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[14, 14]} />
        <meshStandardMaterial color="#0a0e1c" roughness={0.35} metalness={0.6} />
      </mesh>
      <Grid position={[0, 0.01, 0]} args={[14, 14]} cellSize={0.7} cellThickness={0.6} cellColor="#1c2947" sectionSize={2.8} sectionThickness={1} sectionColor="#2dd4bf" fadeDistance={13} fadeStrength={2} infiniteGrid={false} />
      {/* rug */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-0.4, 0.02, 1.8]}>
        <circleGeometry args={[1.5, 40]} />
        <meshStandardMaterial color="#134e4a" roughness={0.9} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-0.4, 0.025, 1.8]}>
        <ringGeometry args={[1.1, 1.35, 40]} />
        <meshStandardMaterial color="#2dd4bf" emissive="#2dd4bf" emissiveIntensity={0.5} />
      </mesh>

      {/* back glass wall w/ viewport frames */}
      <mesh position={[0, 2.5, -4.2]}><boxGeometry args={[14, 5, 0.15]} /><meshStandardMaterial color="#060a16" roughness={0.2} metalness={0.4} transparent opacity={0.92} /></mesh>
      {[-3.5, 0, 3.5].map((x) => (
        <group key={x} position={[x, 2.5, -4.1]}>
          <mesh><boxGeometry args={[2.6, 3.2, 0.06]} /><meshStandardMaterial color="#02040c" emissive="#0ea5e9" emissiveIntensity={0.12} /></mesh>
          <mesh><boxGeometry args={[2.8, 0.12, 0.1]} /><meshStandardMaterial color="#1e2a4a" metalness={0.7} roughness={0.3} /></mesh>
          <mesh position={[0, -1.65, 0]}><boxGeometry args={[2.8, 0.12, 0.1]} /><meshStandardMaterial color="#1e2a4a" metalness={0.7} roughness={0.3} /></mesh>
        </group>
      ))}

      {/* desk */}
      <group position={[1.6, 0, 0.2]}>
        <mesh position={[0, 0.75, 0]}><boxGeometry args={[2.6, 0.1, 1.1]} /><meshStandardMaterial color="#182036" roughness={0.4} metalness={0.3} /></mesh>
        {[[-1.2, -0.45], [1.2, -0.45], [-1.2, 0.45], [1.2, 0.45]].map(([x, z], i) => (
          <mesh key={i} position={[x, 0.35, z]}><boxGeometry args={[0.09, 0.7, 0.09]} /><meshStandardMaterial color="#0d1326" /></mesh>
        ))}
        <mesh position={[0, 0.82, 0.15]}><boxGeometry args={[0.9, 0.04, 0.35]} /><meshStandardMaterial color="#0d1326" /></mesh>
        {/* under-glow */}
        <mesh position={[0, 0.68, 0]}><boxGeometry args={[2.5, 0.02, 1.0]} /><meshStandardMaterial color="#000" emissive="#2dd4bf" emissiveIntensity={0.9} /></mesh>
        <LiveMonitor position={[-0.62, 1.32, -0.12]} rotationY={0.22} screen="orbitx" stats={stats} />
        <LiveMonitor position={[0.62, 1.32, -0.18]} rotationY={-0.22} screen="xscan" stats={stats} />
        {stage >= 2 && <LiveMonitor position={[1.55, 1.28, 0.05]} rotationY={-0.5} screen="terminal" stats={stats} />}
        {/* mug */}
        <mesh position={[1.05, 0.88, 0.3]}><cylinderGeometry args={[0.07, 0.06, 0.14, 12]} /><meshStandardMaterial color="#f43f5e" /></mesh>
      </group>
      {/* chair */}
      <group position={[1.6, 0, 1.5]} rotation={[0, Math.PI, 0]}>
        <mesh position={[0, 0.55, 0]}><boxGeometry args={[0.6, 0.1, 0.6]} /><meshStandardMaterial color="#1e2a4a" roughness={0.6} /></mesh>
        <mesh position={[0, 1.0, -0.28]}><boxGeometry args={[0.6, 0.8, 0.12]} /><meshStandardMaterial color="#1e2a4a" roughness={0.6} /></mesh>
        <mesh position={[0, 0.28, 0]}><cylinderGeometry args={[0.05, 0.05, 0.5, 8]} /><meshStandardMaterial color="#0d1326" metalness={0.6} /></mesh>
      </group>

      {/* team workstation (stage 2+) */}
      {stage >= 2 && <SecondDesk stats={stats} />}
      {/* meeting plaza (stage 3+) */}
      {stage >= 3 && <Plaza />}
      {/* AI core — always on, grows brighter with stage */}
      <AICore mood={mood} change={stats.change24h} />
      {/* hologram billboard (stage 3+) */}
      {stage >= 3 && <HoloBillboard />}
      {/* rocket pad (stage 4+) */}
      {stage >= 4 && <RocketPad />}
      {/* rising embers */}
      <Embers count={stage >= 4 ? 130 : 70} area={stage >= 4 ? 24 : 14} />
      {/* floating live price hologram */}
      <PriceHologram stats={stats} stage={stage} />
      {/* city dressing (stage 4+) */}
      {stage >= 4 && <StreetLamps />}
      {stage >= 4 && <Fireworks />}
      {/* airship (stage 3+) */}
      {stage >= 3 && <Airship />}

      {/* trophy shelf */}
      <group position={[2.9, 0, -2.6]} rotation={[0, -0.5, 0]}>
        <mesh position={[0, 1.5, 0]}><boxGeometry args={[1.8, 0.08, 0.5]} /><meshStandardMaterial color="#182036" /></mesh>
        <mesh position={[0, 0.9, 0]}><boxGeometry args={[1.8, 0.08, 0.5]} /><meshStandardMaterial color="#182036" /></mesh>
        {[[-0.8], [0.8]].map(([x], i) => (
          <mesh key={i} position={[x, 0.75, 0]}><boxGeometry args={[0.08, 1.5, 0.45]} /><meshStandardMaterial color="#10172c" /></mesh>
        ))}
        {/* books */}
        {[0, 1, 2, 3, 4].map((i) => (
          <mesh key={i} position={[-0.6 + i * 0.14, 1.08, 0]} rotation={[0, 0, i === 4 ? -0.25 : 0]}>
            <boxGeometry args={[0.11, 0.34, 0.3]} />
            <meshStandardMaterial color={["#2dd4bf", "#f43f5e", "#a78bfa", "#fbbf24", "#38bdf8"][i]} roughness={0.7} />
          </mesh>
        ))}
        {/* trophies (stage 3+) */}
        {stage >= 3 && (
          <group>
            <mesh position={[-0.4, 1.68, 0]}><cylinderGeometry args={[0.09, 0.13, 0.3, 12]} /><meshStandardMaterial color="#ffd166" metalness={0.85} roughness={0.2} emissive="#ffd166" emissiveIntensity={0.3} /></mesh>
            <mesh position={[0.3, 1.66, 0]}><boxGeometry args={[0.16, 0.24, 0.16]} /><meshStandardMaterial color="#ffd166" metalness={0.85} roughness={0.2} emissive="#ffd166" emissiveIntensity={0.3} /></mesh>
            <mesh position={[0.3, 1.5, 0]}><boxGeometry args={[0.24, 0.05, 0.24]} /><meshStandardMaterial color="#3a2c12" /></mesh>
          </group>
        )}
      </group>

      {/* plant */}
      <group position={[-3.2, 0, 1.6]}>
        <mesh position={[0, 0.25, 0]}><cylinderGeometry args={[0.28, 0.22, 0.5, 12]} /><meshStandardMaterial color="#7c2d12" roughness={0.8} /></mesh>
        <mesh position={[0, 0.9, 0]}><coneGeometry args={[0.45, 1.1, 8]} /><meshStandardMaterial color="#16a34a" roughness={0.8} /></mesh>
        <mesh position={[0, 1.5, 0]}><coneGeometry args={[0.32, 0.8, 8]} /><meshStandardMaterial color="#22c55e" roughness={0.8} /></mesh>
      </group>

      {/* couch (dormant rest spot) */}
      <group position={[-2.8, 0, -2.4]} rotation={[0, 0.6, 0]}>
        <mesh position={[0, 0.3, 0]}><boxGeometry args={[1.9, 0.35, 0.85]} /><meshStandardMaterial color="#232c4e" roughness={0.8} /></mesh>
        <mesh position={[0, 0.65, -0.38]}><boxGeometry args={[1.9, 0.6, 0.2]} /><meshStandardMaterial color="#232c4e" roughness={0.8} /></mesh>
        {[[-0.9], [0.9]].map(([x], i) => (
          <mesh key={i} position={[x, 0.62, 0]}><boxGeometry args={[0.14, 0.5, 0.8]} /><meshStandardMaterial color="#1b2547" roughness={0.8} /></mesh>
        ))}
      </group>

      {/* OX diamond wall emblem */}
      <group position={[0, 3.1, -4.05]}>
        <mesh rotation={[0, 0, Math.PI / 4]}>
          <octahedronGeometry args={[0.45]} />
          <meshStandardMaterial color="#2dd4bf" emissive="#2dd4bf" emissiveIntensity={1.4} metalness={0.6} roughness={0.2} />
        </mesh>
      </group>

      {/* ceiling light panels */}
      {[[-2.5, -1.5], [2.5, -1.5], [-2.5, 2], [2.5, 2]].map(([x, z], i) => (
        <mesh key={i} position={[x, 4.6, z]} rotation={[Math.PI / 2, 0, 0]}>
          <planeGeometry args={[1.6, 0.8]} />
          <meshStandardMaterial color="#0b1020" emissive={mood === "dormant" ? "#1e2a4a" : "#bfe9ff"} emissiveIntensity={mood === "dormant" ? 0.25 : 1.1} />
        </mesh>
      ))}

      {/* cosmic crystals (stage 5) — flanking the office */}
      {stage >= 5 && (
        <group ref={crystal}>
          {[[-5.2, 2.2], [5.4, 1.4]].map(([x, z], i) => (
            <mesh key={i} position={[x, 0, z]}>
              <octahedronGeometry args={[0.34]} />
              <meshStandardMaterial color="#a78bfa" emissive="#a78bfa" emissiveIntensity={1.2} transparent opacity={0.9} />
            </mesh>
          ))}
        </group>
      )}
    </group>
  );
}

// ── main ───────────────────────────────────────────────────────────────────
const STAGE_NAMES = ["Egg", "Sprout", "Whelp", "Guardian", "Titan", "Cosmic"];

function fmtUsd(n: number | null): string {
  if (n == null || !isFinite(n)) return "—";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}k`;
  return `$${n.toFixed(0)}`;
}

const THOUGHTS: Array<(s: AvatarStats) => string | null> = [
  (s) => s.mcap != null ? `MCap ${fmtUsd(s.mcap)} — my world gets bigger as we grow.` : null,
  (s) => s.change24h != null && s.change24h >= 0 ? `Up ${s.change24h.toFixed(1)}% today. I'm pacing — can't sit still.` : null,
  (s) => s.change24h != null && s.change24h < 0 ? `Down ${Math.abs(s.change24h).toFixed(1)}%. I'll be at my desk, watching the charts.` : null,
  (s) => s.burned != null && s.burned > 0 ? `${Math.round(s.burned).toLocaleString()} ORBITX burned. My shelves feel lighter.` : null,
  () => "This office floats in deep space. Best commute in crypto.",
  (s) => s.liquidity != null ? `Liquidity ${fmtUsd(s.liquidity)} — the lights stay on.` : null,
  (s) => (s.mcap ?? 0) >= 10_000 ? "Hired my first AI agent. We're a team now — say hi." : null,
  (s) => (s.mcap ?? 0) >= 1_000_000 ? "Look outside — that's all us. The towers keep rising." : null,
  (s) => (s.mcap ?? 0) >= 10_000_000 ? "From one desk to a whole metropolis. This community built it." : null,
];

export function AgentOffice3D({ stats }: { stats: AvatarStats }) {
  const stage = stageForMcap(stats.mcap);
  const mood = moodForChange(stats.change24h);
  const [thoughtIdx, setThoughtIdx] = useState(0);

  const thought = useMemo(() => {
    const pool = THOUGHTS.map((f) => f(stats)).filter(Boolean) as string[];
    return pool[thoughtIdx % pool.length] ?? pool[0];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thoughtIdx, stats.mcap, stats.change24h]);

  useEffect(() => {
    const id = setInterval(() => setThoughtIdx((i) => i + 1), 9000);
    return () => clearInterval(id);
  }, []);

  const nextAt = [10_000, 25_000, 100_000, 500_000, 2_000_000][stage];
  const isCity = stage >= 4;
  const agentCount = AGENTS_PER_STAGE[stage] ?? 0;

  return (
    <div>
      {/* thought bubble */}
      <div className="relative mx-auto mb-3 max-w-[300px] rounded-2xl rounded-bl-sm border border-white/10 bg-white/[0.06] px-4 py-2.5 text-center backdrop-blur-md">
        <p key={thoughtIdx} className="text-[13px] leading-snug text-white/85">“{thought}”</p>
        <div className="absolute -bottom-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 border-b border-r border-white/10 bg-[#0b0f1a]" />
      </div>

      <div className="relative overflow-hidden rounded-3xl border border-white/10" style={{ height: 420 }}>
        <Canvas
          dpr={[1, 1.75]}
          camera={{ position: isCity ? [0, 6, 14.5] : [0, 3.6, 8.6], fov: 46 }}
          gl={{ antialias: true, alpha: false }}
          onCreated={({ gl }) => gl.setClearColor("#02040c")}
        >
          <Suspense fallback={null}>
            <fog attach="fog" args={["#02040c", isCity ? 15 : 12, isCity ? 38 : 26]} />
            <ambientLight intensity={0.55} />
            <directionalLight position={[5, 8, 4]} intensity={1.1} color="#dbeafe" />
            <pointLight position={[-3, 3, 2]} intensity={12} color="#2dd4bf" distance={12} />
            <pointLight position={[3, 2.5, -2]} intensity={8} color="#3b82f6" distance={12} />
            {mood === "dormant" && <pointLight position={[0, 2, 0]} intensity={4} color="#1e2a4a" distance={10} />}
            <Stars radius={60} depth={30} count={2200} factor={3.5} saturation={0} fade speed={0.6} />
            <Office stage={stage} mood={mood} stats={stats} />
            <BlockyAgent mood={mood} stage={stage} />
            <Citizens stage={stage} />
            {isCity && <CityBuildings stage={stage} />}
            {isCity && <SkyTraffic stage={stage} />}
            <OrbitControls
              enablePan={false}
              minDistance={5} maxDistance={isCity ? 20 : 13}
              minPolarAngle={Math.PI / 5} maxPolarAngle={Math.PI / 2.15}
              target={isCity ? [0, 2.2, -2] : [0, 1.3, 0]}
            />
          </Suspense>
        </Canvas>
        <div className="pointer-events-none absolute left-3 top-3 rounded-full border border-white/15 bg-black/50 px-3 py-1 text-[11px] font-semibold text-white/75 backdrop-blur">
          {isCity ? "🌆 Orbit's city · drag to look around" : "🛰️ Orbit's office · drag to look around"}
        </div>
        <div className="pointer-events-none absolute bottom-3 right-3 rounded-full border border-white/15 bg-black/50 px-3 py-1 text-[11px] text-white/60 backdrop-blur">
          {mood === "ecstatic" ? "⚡ feeling electric" : mood === "happy" ? "😊 in good spirits" : mood === "sleepy" ? "😴 taking it slow" : "💤 resting"}
          {agentCount > 0 && <span className="ml-1 text-teal-300">· {agentCount} agent{agentCount > 1 ? "s" : ""} on duty</span>}
        </div>
      </div>

      {/* stage + progress */}
      <div className="mx-auto mt-4 max-w-[320px] text-center">
        <div className="flex items-center justify-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-teal-300" />
          <span className="text-sm font-bold uppercase tracking-[0.18em] text-white">{STAGE_NAMES[stage]}</span>
          <span className="text-[11px] text-white/40">· {WORLD_NAMES[stage]} · {stage + 1}/6</span>
        </div>
        {nextAt != null ? (
          <div className="mt-2">
            <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-gradient-to-r from-teal-400 to-amber-300 transition-all duration-1000"
                style={{ width: `${Math.min(100, Math.max(2, ((stats.mcap ?? 0) / nextAt) * 100))}%` }} />
            </div>
            <p className="mt-1 text-[11px] text-white/40">{fmtUsd(nextAt - (stats.mcap ?? 0))} to {WORLD_NAMES[stage + 1]} → {STAGE_NAMES[stage + 1]}</p>
          </div>
        ) : (
          <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-300">👑 Metropolis achieved — the city is yours</p>
        )}
      </div>
    </div>
  );
}

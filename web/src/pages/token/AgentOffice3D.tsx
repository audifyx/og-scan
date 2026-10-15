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
          <mesh position={[-0.13, 0.05, 0.26]} scale={[1, eyeScaleY, 1]}><boxGeometry args={[0.09, 0.11, 0.02]} /><meshStandardMaterial color="#10131c" /></mesh>
          <mesh position={[0.13, 0.05, 0.26]} scale={[1, eyeScaleY, 1]}><boxGeometry args={[0.09, 0.11, 0.02]} /><meshStandardMaterial color="#10131c" /></mesh>
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

function Office({ stage, mood }: { stage: number; mood: AvatarMood }) {
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
        <Monitor position={[-0.7, 1.25, -0.15]} rotationY={0.25} hue="#22d3ee" chart />
        <Monitor position={[0.1, 1.28, -0.25]} hue="#4ade80" chart />
        {stage >= 2 && <Monitor position={[0.9, 1.25, -0.15]} rotationY={-0.25} hue="#a78bfa" />}
        {/* mug */}
        <mesh position={[1.05, 0.88, 0.3]}><cylinderGeometry args={[0.07, 0.06, 0.14, 12]} /><meshStandardMaterial color="#f43f5e" /></mesh>
      </group>
      {/* chair */}
      <group position={[1.6, 0, 1.5]} rotation={[0, Math.PI, 0]}>
        <mesh position={[0, 0.55, 0]}><boxGeometry args={[0.6, 0.1, 0.6]} /><meshStandardMaterial color="#1e2a4a" roughness={0.6} /></mesh>
        <mesh position={[0, 1.0, -0.28]}><boxGeometry args={[0.6, 0.8, 0.12]} /><meshStandardMaterial color="#1e2a4a" roughness={0.6} /></mesh>
        <mesh position={[0, 0.28, 0]}><cylinderGeometry args={[0.05, 0.05, 0.5, 8]} /><meshStandardMaterial color="#0d1326" metalness={0.6} /></mesh>
      </group>

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

      {/* cosmic crystals (stage 5) */}
      {stage >= 5 && (
        <group ref={crystal}>
          {[[-1.5, 0.5], [1.8, -0.6]].map(([x, z], i) => (
            <mesh key={i} position={[x, 0, z]}>
              <octahedronGeometry args={[0.28]} />
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
  (s) => s.mcap != null ? `MCap ${fmtUsd(s.mcap)} — my office gets nicer as we grow.` : null,
  (s) => s.change24h != null && s.change24h >= 0 ? `Up ${s.change24h.toFixed(1)}% today. I'm pacing — can't sit still.` : null,
  (s) => s.change24h != null && s.change24h < 0 ? `Down ${Math.abs(s.change24h).toFixed(1)}%. I'll be at my desk, watching the charts.` : null,
  (s) => s.burned != null && s.burned > 0 ? `${Math.round(s.burned).toLocaleString()} ORBITX burned. My shelves feel lighter.` : null,
  () => "This office floats in deep space. Best commute in crypto.",
  (s) => s.liquidity != null ? `Liquidity ${fmtUsd(s.liquidity)} — the lights stay on.` : null,
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
          camera={{ position: [0, 3.6, 8.6], fov: 46 }}
          gl={{ antialias: true, alpha: false }}
          onCreated={({ gl }) => gl.setClearColor("#02040c")}
        >
          <Suspense fallback={null}>
            <fog attach="fog" args={["#02040c", 12, 26]} />
            <ambientLight intensity={0.55} />
            <directionalLight position={[5, 8, 4]} intensity={1.1} color="#dbeafe" />
            <pointLight position={[-3, 3, 2]} intensity={12} color="#2dd4bf" distance={12} />
            <pointLight position={[3, 2.5, -2]} intensity={8} color="#3b82f6" distance={12} />
            {mood === "dormant" && <pointLight position={[0, 2, 0]} intensity={4} color="#1e2a4a" distance={10} />}
            <Stars radius={60} depth={30} count={2200} factor={3.5} saturation={0} fade speed={0.6} />
            <Office stage={stage} mood={mood} />
            <BlockyAgent mood={mood} stage={stage} />
            <OrbitControls
              enablePan={false}
              minDistance={5} maxDistance={13}
              minPolarAngle={Math.PI / 5} maxPolarAngle={Math.PI / 2.15}
              target={[0, 1.3, 0]}
            />
          </Suspense>
        </Canvas>
        <div className="pointer-events-none absolute left-3 top-3 rounded-full border border-white/15 bg-black/50 px-3 py-1 text-[11px] font-semibold text-white/75 backdrop-blur">
          🛰️ Orbit's office · drag to look around
        </div>
        <div className="pointer-events-none absolute bottom-3 right-3 rounded-full border border-white/15 bg-black/50 px-3 py-1 text-[11px] text-white/60 backdrop-blur">
          {mood === "ecstatic" ? "⚡ feeling electric" : mood === "happy" ? "😊 in good spirits" : mood === "sleepy" ? "😴 taking it slow" : "💤 resting"}
        </div>
      </div>

      {/* stage + progress */}
      <div className="mx-auto mt-4 max-w-[320px] text-center">
        <div className="flex items-center justify-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-teal-300" />
          <span className="text-sm font-bold uppercase tracking-[0.18em] text-white">{STAGE_NAMES[stage]}</span>
          <span className="text-[11px] text-white/40">Stage {stage + 1}/6</span>
        </div>
        {nextAt != null ? (
          <div className="mt-2">
            <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-gradient-to-r from-teal-400 to-amber-300 transition-all duration-1000"
                style={{ width: `${Math.min(100, Math.max(2, ((stats.mcap ?? 0) / nextAt) * 100))}%` }} />
            </div>
            <p className="mt-1 text-[11px] text-white/40">{fmtUsd(nextAt - (stats.mcap ?? 0))} to next office upgrade → {STAGE_NAMES[stage + 1]}</p>
          </div>
        ) : (
          <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-300">Penthouse achieved</p>
        )}
      </div>
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Billboard, Text } from "@react-three/drei";
import * as THREE from "three";
import type { AvatarAppearance, Vec3 } from "@/lib/orbitxcity/types";
import { NYC_DEMO_BLOCK } from "@/lib/orbitxcity/demoBlock";
import { collidesAt, pointInBuilding } from "@/lib/orbitxcity/collision";
import type { CityRealtimeClient } from "@/lib/orbitxcity/realtime";

const WALK_SPEED = 7.5;
const SPRINT_SPEED = 11.8;
const JUMP_VELOCITY = 7.4;
const GRAVITY = 18;

const keys = new Set<string>();

function useKeyboard() {
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      keys.add(e.code);
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.code)) {
        e.preventDefault();
      }
    };
    const up = (e: KeyboardEvent) => keys.delete(e.code);
    const blur = () => keys.clear();
    window.addEventListener("keydown", down, { passive: false });
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
      keys.clear();
    };
  }, []);
}

interface PlayerAvatarProps {
  appearance: AvatarAppearance;
  onMove: (pos: Vec3, yaw: number) => void;
  realtime?: CityRealtimeClient | null;
}

export function PlayerAvatar({ appearance, onMove, realtime }: PlayerAvatarProps) {
  const group = useRef<THREE.Group>(null);
  const flame = useRef<THREE.Mesh>(null);
  const bob = useRef(0);
  const { camera } = useThree();
  useKeyboard();

  const spawn = NYC_DEMO_BLOCK.spawn;
  const pos = useRef(new THREE.Vector3(spawn.x, 0, spawn.z));
  const yaw = useRef(0);
  const vy = useRef(0);
  const yPos = useRef(0);
  const camDist = useRef(9);
  const reportAcc = useRef(0);
  const lastReported = useRef({ x: spawn.x, z: spawn.z, yaw: 0 });
  const [chat, setChat] = useState<string | null>(null);

  // Mouse-wheel camera zoom
  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      camDist.current = Math.min(14, Math.max(5, camDist.current + e.deltaY * 0.008));
    };
    window.addEventListener("wheel", onWheel, { passive: true });
    return () => window.removeEventListener("wheel", onWheel);
  }, []);

  useFrame((_, rawDt) => {
    const t = Math.min(rawDt, 0.05);
    let inputX = 0;
    let inputZ = 0;
    if (keys.has("KeyW") || keys.has("ArrowUp")) inputZ -= 1;
    if (keys.has("KeyS") || keys.has("ArrowDown")) inputZ += 1;
    if (keys.has("KeyA") || keys.has("ArrowLeft")) inputX -= 1;
    if (keys.has("KeyD") || keys.has("ArrowRight")) inputX += 1;

    const sprinting = keys.has("ShiftLeft") || keys.has("ShiftRight");
    const speed = sprinting ? SPRINT_SPEED : WALK_SPEED;
    const moving = inputX !== 0 || inputZ !== 0;

    if (moving) {
      const len = Math.hypot(inputX, inputZ) || 1;
      const nx = (inputX / len) * speed;
      const nz = (inputZ / len) * speed;
      yaw.current = Math.atan2(nx, nz);

      const nextX = pos.current.x + nx * t;
      const nextZ = pos.current.z + nz * t;
      if (!collidesAt(nextX, pos.current.z)) pos.current.x = nextX;
      if (!collidesAt(pos.current.x, nextZ)) pos.current.z = nextZ;
      bob.current += t * (sprinting ? 14 : 10);
    } else {
      bob.current *= 0.9;
    }

    // Jump / gravity
    const grounded = yPos.current <= 0.001;
    if (keys.has("Space") && grounded) vy.current = JUMP_VELOCITY;
    vy.current -= GRAVITY * t;
    yPos.current = Math.max(0, yPos.current + vy.current * t);
    if (yPos.current === 0 && vy.current < 0) vy.current = 0;
    const airborne = yPos.current > 0.05;

    if (group.current) {
      group.current.position.set(pos.current.x, yPos.current, pos.current.z);
      group.current.rotation.y = yaw.current;
      const leg = group.current.getObjectByName("legL");
      const legR = group.current.getObjectByName("legR");
      const swing = moving && !airborne ? Math.sin(bob.current) * (sprinting ? 0.6 : 0.45) : 0;
      if (leg) leg.rotation.x = swing;
      if (legR) legR.rotation.x = -swing;
    }

    if (flame.current) {
      flame.current.visible = airborne;
      if (airborne) {
        const s = 0.7 + Math.random() * 0.5;
        flame.current.scale.set(s, 1 + Math.random() * 0.5, s);
      }
    }

    // Third-person chase cam with zoom + building occlusion
    const dist = camDist.current;
    const camOffset = new THREE.Vector3(0, dist * 0.62, dist * 0.85);
    const target = new THREE.Vector3(pos.current.x, 1.4 + yPos.current * 0.6, pos.current.z);
    const desired = target.clone().add(camOffset);

    // March from the player toward the desired camera spot; stop before
    // the segment enters a building so structures never swallow the view.
    let tMax = 1;
    const STEPS = 20;
    for (let i = 1; i <= STEPS; i++) {
      const s = i / STEPS;
      const px = target.x + (desired.x - target.x) * s;
      const py = target.y + (desired.y - target.y) * s;
      const pz = target.z + (desired.z - target.z) * s;
      if (pointInBuilding(px, py, pz)) {
        tMax = Math.max((i - 1) / STEPS, 0.16);
        break;
      }
    }
    const camGoal = target.clone().lerp(desired, tMax);
    camera.position.lerp(camGoal, 1 - Math.pow(0.001, t));
    camera.lookAt(target);

    // Throttled position reporting (~10Hz, only on real movement)
    reportAcc.current += t;
    if (reportAcc.current >= 0.1) {
      reportAcc.current = 0;
      const dx = pos.current.x - lastReported.current.x;
      const dz = pos.current.z - lastReported.current.z;
      const dyaw = Math.abs(yaw.current - lastReported.current.yaw);
      if (dx * dx + dz * dz > 0.0025 || dyaw > 0.05) {
        lastReported.current = { x: pos.current.x, z: pos.current.z, yaw: yaw.current };
        onMove({ x: pos.current.x, y: 0, z: pos.current.z }, yaw.current);
      }
    }

    const lc = realtime?.localChat;
    const show = lc && Date.now() - lc.at < 4500 ? lc.text : null;
    if (show !== chat) setChat(show);
  });

  return (
    <group ref={group} position={[spawn.x, 0, spawn.z]}>
      {/* Body */}
      <mesh position={[0, 1.15, 0]} castShadow>
        <capsuleGeometry args={[0.35, 0.7, 6, 12]} />
        <meshStandardMaterial color={appearance.bodyColor} metalness={0.35} roughness={0.45} />
      </mesh>
      {/* Head */}
      <mesh position={[0, 2.05, 0]} castShadow>
        <sphereGeometry args={[0.32, 16, 16]} />
        <meshStandardMaterial color={appearance.skinColor ?? "#e8d5c0"} metalness={0.1} roughness={0.65} />
      </mesh>
      {/* Visor */}
      <mesh position={[0, 2.08, 0.22]}>
        <boxGeometry args={[0.38, 0.12, 0.08]} />
        <meshBasicMaterial color={appearance.accentColor} toneMapped={false} />
      </mesh>
      {/* Jetpack */}
      <mesh position={[0, 1.45, -0.22]}>
        <boxGeometry args={[0.55, 0.35, 0.2]} />
        <meshStandardMaterial color={appearance.accentColor} emissive={appearance.accentColor} emissiveIntensity={0.25} />
      </mesh>
      <mesh ref={flame} position={[0, 1.05, -0.28]} rotation-x={Math.PI} visible={false}>
        <coneGeometry args={[0.14, 0.6, 10]} />
        <meshBasicMaterial color="#ffb054" transparent opacity={0.9} toneMapped={false} />
      </mesh>
      {/* Legs */}
      <mesh name="legL" position={[-0.16, 0.45, 0]}>
        <capsuleGeometry args={[0.12, 0.35, 4, 8]} />
        <meshStandardMaterial color="#0d121c" />
      </mesh>
      <mesh name="legR" position={[0.16, 0.45, 0]}>
        <capsuleGeometry args={[0.12, 0.35, 4, 8]} />
        <meshStandardMaterial color="#0d121c" />
      </mesh>
      {/* Ground ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
        <ringGeometry args={[0.45, 0.55, 32]} />
        <meshBasicMaterial color={appearance.accentColor} transparent opacity={0.55} toneMapped={false} />
      </mesh>

      {chat && (
        <Billboard position={[0, 2.9, 0]}>
          <Text fontSize={0.26} color="#e8f1ff" anchorX="center" maxWidth={3.2} outlineWidth={0.04} outlineColor="#04070f">
            {chat}
          </Text>
        </Billboard>
      )}
    </group>
  );
}

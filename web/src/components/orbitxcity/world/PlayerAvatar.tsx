import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { AvatarAppearance, Vec3 } from "@/lib/orbitxcity/types";
import { NYC_DEMO_BLOCK, buildingColliders } from "@/lib/orbitxcity/demoBlock";

const SPEED = 7.5;
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

function collides(x: number, z: number, radius = 0.45): boolean {
  const boxes = buildingColliders(NYC_DEMO_BLOCK);
  for (const b of boxes) {
    if (x + radius > b.minX && x - radius < b.maxX && z + radius > b.minZ && z - radius < b.maxZ) {
      return true;
    }
  }
  const { bounds } = NYC_DEMO_BLOCK;
  if (x < bounds.minX || x > bounds.maxX || z < bounds.minZ || z > bounds.maxZ) return true;
  return false;
}

interface PlayerAvatarProps {
  appearance: AvatarAppearance;
  onMove: (pos: Vec3) => void;
}

export function PlayerAvatar({ appearance, onMove }: PlayerAvatarProps) {
  const group = useRef<THREE.Group>(null);
  const bob = useRef(0);
  const { camera } = useThree();
  useKeyboard();

  const spawn = NYC_DEMO_BLOCK.spawn;
  const pos = useRef(new THREE.Vector3(spawn.x, 0, spawn.z));
  const yaw = useRef(0);
  const vel = useRef(new THREE.Vector3());
  const reportAcc = useRef(0);
  const lastReported = useRef({ x: spawn.x, z: spawn.z });

  useFrame((_, dt) => {
    const t = Math.min(dt, 0.05);
    let inputX = 0;
    let inputZ = 0;
    if (keys.has("KeyW") || keys.has("ArrowUp")) inputZ -= 1;
    if (keys.has("KeyS") || keys.has("ArrowDown")) inputZ += 1;
    if (keys.has("KeyA") || keys.has("ArrowLeft")) inputX -= 1;
    if (keys.has("KeyD") || keys.has("ArrowRight")) inputX += 1;

    const moving = inputX !== 0 || inputZ !== 0;
    if (moving) {
      const len = Math.hypot(inputX, inputZ) || 1;
      const nx = (inputX / len) * SPEED;
      const nz = (inputZ / len) * SPEED;
      vel.current.set(nx, 0, nz);
      yaw.current = Math.atan2(nx, nz);

      const nextX = pos.current.x + nx * t;
      const nextZ = pos.current.z + nz * t;
      if (!collides(nextX, pos.current.z)) pos.current.x = nextX;
      if (!collides(pos.current.x, nextZ)) pos.current.z = nextZ;
      bob.current += t * 10;
    } else {
      vel.current.multiplyScalar(0.8);
      bob.current *= 0.9;
    }

    if (group.current) {
      group.current.position.set(pos.current.x, 0, pos.current.z);
      group.current.rotation.y = yaw.current;
      const leg = group.current.getObjectByName("legL");
      const legR = group.current.getObjectByName("legR");
      const swing = moving ? Math.sin(bob.current) * 0.45 : 0;
      if (leg) leg.rotation.x = swing;
      if (legR) legR.rotation.x = -swing;
    }

    // Third-person chase cam
    const camOffset = new THREE.Vector3(0, 5.2, 7.5);
    const target = new THREE.Vector3(pos.current.x, 1.4, pos.current.z);
    const desired = target.clone().add(camOffset);
    camera.position.lerp(desired, 1 - Math.pow(0.001, t));
    camera.lookAt(target);

    reportAcc.current += t;
    if (reportAcc.current >= 0.1) {
      reportAcc.current = 0;
      const dx = pos.current.x - lastReported.current.x;
      const dz = pos.current.z - lastReported.current.z;
      if (dx * dx + dz * dz > 0.0025) {
        lastReported.current = { x: pos.current.x, z: pos.current.z };
        onMove({ x: pos.current.x, y: 0, z: pos.current.z });
      }
    }
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
        <meshStandardMaterial color="#e8d5c0" metalness={0.1} roughness={0.65} />
      </mesh>
      {/* Visor */}
      <mesh position={[0, 2.08, 0.22]}>
        <boxGeometry args={[0.38, 0.12, 0.08]} />
        <meshStandardMaterial color={appearance.accentColor} emissive={appearance.accentColor} emissiveIntensity={0.8} />
      </mesh>
      {/* Shoulders / pack */}
      <mesh position={[0, 1.45, -0.22]}>
        <boxGeometry args={[0.55, 0.35, 0.2]} />
        <meshStandardMaterial color={appearance.accentColor} emissive={appearance.accentColor} emissiveIntensity={0.25} />
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
        <meshBasicMaterial color={appearance.accentColor} transparent opacity={0.55} />
      </mesh>
    </group>
  );
}

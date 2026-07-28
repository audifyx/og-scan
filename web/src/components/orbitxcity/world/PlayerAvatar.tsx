import { useEffect, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Billboard, Text } from "@react-three/drei";
import * as THREE from "three";
import type { AvatarAppearance, BuildingDefinition, Vec3, WorldBlockConfig } from "@/lib/orbitxcity/types";
import { NYC_DEMO_BLOCK } from "@/lib/orbitxcity/demoBlock";
import { collidesAt, collidesInInterior, pointInBuilding } from "@/lib/orbitxcity/collision";
import { consumeZoom, virtualInput } from "@/lib/orbitxcity/input";
import type { CityRealtimeClient } from "@/lib/orbitxcity/realtime";
import { CharacterMesh, type CharacterAnimationState } from "./CharacterMesh";

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
  teleportTarget?: { x: number; z: number; seq: number } | null;
  emoteAt?: number;
  /** Active city block — spawn, collision, and camera occlusion. */
  block?: WorldBlockConfig;
  /** Ignore this building's collider (player is inside). */
  ignoreBuildingId?: string | null;
  /** Active interior receives its own walls and furniture collision. */
  interiorBuilding?: BuildingDefinition | null;
  /** Prevent world movement while a focused HUD or venue overlay is open. */
  inputLocked?: boolean;
}

export function PlayerAvatar({
  appearance,
  onMove,
  realtime,
  teleportTarget,
  emoteAt = 0,
  block = NYC_DEMO_BLOCK,
  ignoreBuildingId = null,
  interiorBuilding = null,
  inputLocked = false,
}: PlayerAvatarProps) {
  const group = useRef<THREE.Group>(null);
  const flame = useRef<THREE.Mesh>(null);
  const bob = useRef(0);
  const { camera } = useThree();
  useKeyboard();

  const spawn = block.spawn;
  const blockRef = useRef(block);
  blockRef.current = block;
  const ignoreRef = useRef(ignoreBuildingId);
  ignoreRef.current = ignoreBuildingId;
  const interiorRef = useRef(interiorBuilding);
  interiorRef.current = interiorBuilding;
  const pos = useRef(new THREE.Vector3(spawn.x, 0, spawn.z));
  const yaw = useRef(0);
  const vy = useRef(0);
  const yPos = useRef(0);
  const camDist = useRef(9);
  const characterAnimation = useRef<CharacterAnimationState>({});
  const reportAcc = useRef(0);
  const lastReported = useRef({ x: spawn.x, z: spawn.z, yaw: 0 });
  const [chat, setChat] = useState<string | null>(null);

  // Respawn when the selected city block changes
  useEffect(() => {
    pos.current.set(spawn.x, 0, spawn.z);
    yPos.current = 0;
    vy.current = 0;
    lastReported.current = { x: spawn.x, z: spawn.z, yaw: yaw.current };
    onMove({ x: spawn.x, y: 0, z: spawn.z }, yaw.current);
  }, [block.cityId, spawn.x, spawn.z, onMove]);

  // Mouse-wheel camera zoom
  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      camDist.current = Math.min(14, Math.max(5, camDist.current + e.deltaY * 0.008));
    };
    window.addEventListener("wheel", onWheel, { passive: true });
    return () => window.removeEventListener("wheel", onWheel);
  }, []);

  // Fast travel — snap position + report immediately
  const lastTeleportSeq = useRef(0);
  useEffect(() => {
    if (!teleportTarget || teleportTarget.seq === lastTeleportSeq.current) return;
    lastTeleportSeq.current = teleportTarget.seq;
    pos.current.set(teleportTarget.x, 0, teleportTarget.z);
    yPos.current = 0;
    vy.current = 0;
    lastReported.current = { x: teleportTarget.x, z: teleportTarget.z, yaw: yaw.current };
    onMove({ x: teleportTarget.x, y: 0, z: teleportTarget.z }, yaw.current);
  }, [teleportTarget, onMove]);

  useFrame(({ clock }, rawDt) => {
    // Allow up to 120ms steps so low-FPS devices keep full movement speed
    const t = Math.min(rawDt, 0.12);
    let inputX = 0;
    let inputZ = 0;
    if (keys.has("KeyW") || keys.has("ArrowUp")) inputZ -= 1;
    if (keys.has("KeyS") || keys.has("ArrowDown")) inputZ += 1;
    if (keys.has("KeyA") || keys.has("ArrowLeft")) inputX -= 1;
    if (keys.has("KeyD") || keys.has("ArrowRight")) inputX += 1;

    // Merge touch joystick (analog) with keyboard (digital)
    inputX += virtualInput.axisX;
    inputZ += virtualInput.axisZ;
    if (inputLocked) {
      inputX = 0;
      inputZ = 0;
      keys.clear();
    }
    inputX = Math.max(-1, Math.min(1, inputX));
    inputZ = Math.max(-1, Math.min(1, inputZ));

    const sprinting = keys.has("ShiftLeft") || keys.has("ShiftRight") || virtualInput.sprint;
    const speed = sprinting ? SPRINT_SPEED : WALK_SPEED;
    const moving = Math.abs(inputX) > 0.08 || Math.abs(inputZ) > 0.08;

    if (moving) {
      const len = Math.hypot(inputX, inputZ) || 1;
      const nx = (inputX / len) * speed;
      const nz = (inputZ / len) * speed;
      yaw.current = Math.atan2(nx, nz);

      const nextX = pos.current.x + nx * t;
      const nextZ = pos.current.z + nz * t;
      const world = blockRef.current;
      const ignore = ignoreRef.current;
      const interior = interiorRef.current;
      if (
        !collidesAt(nextX, pos.current.z, 0.45, world, ignore) &&
        (!interior || !collidesInInterior(nextX, pos.current.z, 0.45, interior))
      ) {
        pos.current.x = nextX;
      }
      if (
        !collidesAt(pos.current.x, nextZ, 0.45, world, ignore) &&
        (!interior || !collidesInInterior(pos.current.x, nextZ, 0.45, interior))
      ) {
        pos.current.z = nextZ;
      }
      bob.current += t * (sprinting ? 14 : 10);
    } else {
      bob.current *= 0.9;
    }

    // Jump / gravity (touch jumps are buffered until grounded)
    const grounded = yPos.current <= 0.001;
    if ((keys.has("Space") || virtualInput.jumpQueued) && grounded) {
      vy.current = JUMP_VELOCITY;
      virtualInput.jumpQueued = false;
    }
    vy.current -= GRAVITY * t;
    yPos.current = Math.max(0, yPos.current + vy.current * t);
    if (yPos.current === 0 && vy.current < 0) vy.current = 0;
    const airborne = yPos.current > 0.05;

    // Dance emote: spin + hop for a short window
    const dancing = emoteAt > 0 && Date.now() - emoteAt < 2600;
    characterAnimation.current.time = moving && !dancing ? bob.current / 8.8 : clock.elapsedTime;
    characterAnimation.current.moving = moving && !airborne;
    characterAnimation.current.dancing = dancing;
    characterAnimation.current.walkIntensity = sprinting ? 1.3 : 1;

    if (group.current) {
      const hop = dancing && grounded ? Math.abs(Math.sin(clock.elapsedTime * 9)) * 0.28 : 0;
      group.current.position.set(pos.current.x, yPos.current + hop, pos.current.z);
      group.current.rotation.y = dancing ? clock.elapsedTime * 9 : yaw.current;
    }

    if (flame.current) {
      flame.current.visible = airborne;
      if (airborne) {
        const s = 0.7 + Math.random() * 0.5;
        flame.current.scale.set(s, 1 + Math.random() * 0.5, s);
      }
    }

    // Third-person chase cam with zoom + building occlusion
    camDist.current = Math.min(14, Math.max(5, camDist.current + consumeZoom()));
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
      if (pointInBuilding(px, py, pz, blockRef.current, ignoreRef.current)) {
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
      <CharacterMesh appearance={appearance} animation={characterAnimation.current} />
      <mesh ref={flame} position={[0, 1.05, -0.28]} rotation-x={Math.PI} visible={false}>
        <coneGeometry args={[0.14, 0.6, 10]} />
        <meshBasicMaterial color="#ffb054" transparent opacity={0.9} toneMapped={false} />
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

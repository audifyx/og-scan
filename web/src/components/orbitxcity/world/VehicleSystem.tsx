/**
 * OrbitX City — vehicle system (WORKER 2).
 *
 * Single integration surface for the coordinator:
 *   <VehicleSystem block={block} onMove={onMove} />
 * mounted inside <Canvas> under CityProvider.
 *
 * Renders the parked fleet (DrivableCar), runs the driving physics loop,
 * owns the camera while driving, and handles enter/exit (E key + touch).
 * Reads block + quality from useCity() (block prop optional override).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useFrame, useThree } from "@react-three/fiber";
import { Billboard, Text } from "@react-three/drei";
import * as THREE from "three";
import type { Vec3, WorldBlockConfig } from "@/lib/orbitxcity/types";
import { getWorldBlock, getWorldStreets } from "@/lib/orbitxcity/worlds";
import { collidesAt, pointInBuilding } from "@/lib/orbitxcity/collision";
import { consumeZoom, virtualInput } from "@/lib/orbitxcity/input";
import { isNight } from "@/lib/orbitxcity/dayNight";
import {
  useVehicleStore,
  type CarBody,
  type CarSpec,
} from "@/lib/orbitxcity/vehicleStore";
import { DrivableCar } from "./DrivableCar";
import { useCity } from "@/pages/orbitxcity/CityProvider";

/* ------------------------------------------------------------------ */
/* Fleet                                                               */
/* ------------------------------------------------------------------ */

const FLEET: CarSpec[] = [
  {
    id: "car-sedan", kind: "sedan", label: "Comet S",
    body: "#2e4a68", glow: "#3de7ff",
    topSpeed: 26, accel: 11, brake: 22, turn: 2.0, grip: 0.9,
    length: 4.4, width: 1.85, height: 1.35, wheelRadius: 0.34,
  },
  {
    id: "car-sports", kind: "sports", label: "Velocity GT",
    body: "#8c1f2e", glow: "#ff6b35",
    topSpeed: 34, accel: 17, brake: 26, turn: 2.4, grip: 0.95,
    length: 4.2, width: 1.8, height: 1.28, wheelRadius: 0.33,
  },
  {
    id: "car-suv", kind: "suv", label: "Atlas X",
    body: "#2c3a2e", glow: "#00ff9f",
    topSpeed: 21, accel: 8.5, brake: 18, turn: 1.6, grip: 1.0,
    length: 4.7, width: 2.0, height: 1.5, wheelRadius: 0.38,
  },
  {
    id: "car-van", kind: "van", label: "Metro Van",
    body: "#8a6d1f", glow: "#f5c542",
    topSpeed: 19, accel: 7.5, brake: 16, turn: 1.5, grip: 1.0,
    length: 4.9, width: 2.0, height: 1.55, wheelRadius: 0.38,
  },
];

/** Curbside parking spots near spawn: offset to the street edge, off the lane. */
function findParkingSpots(block: WorldBlockConfig, count: number): { x: number; z: number; yaw: number }[] {
  const streets = getWorldStreets(block.cityId).filter((s) => s.to - s.from >= 16);
  const spots: { x: number; z: number; yaw: number }[] = [];
  const sx = block.spawn.x;
  const sz = block.spawn.z;
  const ok = (x: number, z: number) =>
    x > block.bounds.minX + 3 &&
    x < block.bounds.maxX - 3 &&
    z > block.bounds.minZ + 3 &&
    z < block.bounds.maxZ - 3 &&
    !collidesAt(x, z, 1.7, block) &&
    spots.every((s) => Math.hypot(s.x - x, s.z - z) > 7);

  // Streets nearest the spawn first.
  const ranked = streets
    .map((s) => {
      const cx = s.o === "v" ? s.at : Math.min(Math.max(sx, s.from), s.to);
      const cz = s.o === "h" ? s.at : Math.min(Math.max(sz, s.from), s.to);
      return { s, d: Math.hypot(cx - sx, cz - sz) };
    })
    .sort((a, b) => a.d - b.d);

  for (const { s } of ranked) {
    if (spots.length >= count) break;
    const side = s.o === "v" ? 1 : -1;
    for (let k = 0; k < 3 && spots.length < count; k++) {
      const along = k === 0 ? 0 : k === 1 ? 9 : -9;
      let x: number, z: number, yaw: number;
      if (s.o === "v") {
        x = s.at + side * (s.w / 2 + 1.7);
        z = Math.min(Math.max(sz + along, s.from + 8), s.to - 8);
        yaw = along >= 0 ? 0 : Math.PI;
      } else {
        z = s.at + side * (s.w / 2 + 1.7);
        x = Math.min(Math.max(sx + along, s.from + 8), s.to - 8);
        yaw = along >= 0 ? Math.PI / 2 : -Math.PI / 2;
      }
      if (ok(x, z)) spots.push({ x, z, yaw });
    }
  }
  // Fallback: ring around spawn.
  for (let i = 0; spots.length < count && i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const x = sx + Math.cos(a) * 11;
    const z = sz + Math.sin(a) * 11;
    if (ok(x, z)) spots.push({ x, z, yaw: a + Math.PI / 2 });
  }
  return spots;
}

/** Block the driving controller is colliding against (set by VehicleController). */
export const vehicleBlockRef: { current: WorldBlockConfig | null } = { current: null };

/** Nearest car to a point, within maxD meters. Non-reactive. */
export function findNearestCar(x: number, z: number, maxD = 3.4): string | null {
  const cars = useVehicleStore.getState().cars;
  let best: string | null = null;
  let bd = maxD;
  for (const id of Object.keys(cars)) {
    const c = cars[id]!;
    const d = Math.hypot(c.pos.x - x, c.pos.z - z);
    if (d < bd) {
      bd = d;
      best = id;
    }
  }
  return best;
}

/* ------------------------------------------------------------------ */
/* Driving controller: physics + camera + enter/exit                   */
/* ------------------------------------------------------------------ */

const CAR_RADIUS = 1.35;

function VehicleController({ block, onMove }: { block: WorldBlockConfig; onMove?: (pos: Vec3, yaw: number) => void }) {
  const { camera } = useThree();
  const { playerPos, setPlayerPos, setPlayerYaw, prompt, panel, teleport } = useCity();
  const keys = useRef(new Set<string>());
  const camDist = useRef(9.5);
  const reportAcc = useRef(0);

  const playerPosRef = useRef(playerPos);
  playerPosRef.current = playerPos;
  const promptRef = useRef(prompt);
  promptRef.current = prompt;
  const panelRef = useRef(panel);
  panelRef.current = panel;
  vehicleBlockRef.current = block;

  const tryEnter = () => {
    const s = useVehicleStore.getState();
    if (s.mode !== "foot" || s.enteringCarId) return;
    if (promptRef.current || panelRef.current !== "none") return; // venue owns E
    const p = playerPosRef.current;
    const id = findNearestCar(p.x, p.z);
    if (id) s.enterCar(id);
  };

  const doExit = () => {
    const s = useVehicleStore.getState();
    if (s.mode !== "driving" || !s.activeCarId) return;
    const car = s.cars[s.activeCarId];
    if (!car) {
      s.exitCar();
      return;
    }
    // Driver side (left of forward).
    const lx = Math.cos(car.yaw);
    const lz = -Math.sin(car.yaw);
    let ex = car.pos.x + lx * 2.1;
    let ez = car.pos.z + lz * 2.1;
    if (collidesAt(ex, ez, 0.5, block)) {
      ex = car.pos.x - lx * 2.1;
      ez = car.pos.z - lz * 2.1;
    }
    s.exitCar();
    teleport(ex, ez); // clamped to bounds; PlayerAvatar snaps via teleportTarget
    keys.current.clear();
  };

  // E key: enter on foot, exit while driving. Own listener (CityHUD's E
  // handler is venue-only and untouched; we yield to it when a venue prompt
  // or panel is active).
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.code === "KeyE") {
        e.preventDefault();
        const s = useVehicleStore.getState();
        if (s.mode === "driving") doExit();
        else tryEnter();
        return;
      }
      keys.current.add(e.code);
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.code)) e.preventDefault();
    };
    const up = (e: KeyboardEvent) => keys.current.delete(e.code);
    const blur = () => keys.current.clear();
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
      keys.current.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [block]);

  useFrame(({ clock }, rawDt) => {
    const s = useVehicleStore.getState();

    // Touch / external interact trigger (virtualInput-compatible).
    if (virtualInput.interactQueued) {
      virtualInput.interactQueued = false;
      if (s.mode === "driving") doExit();
      else tryEnter();
    }

    if (s.mode !== "driving" || !s.activeCarId) return;
    const car = s.cars[s.activeCarId];
    const spec = s.specs[s.activeCarId];
    if (!car || !spec) return;

    const t = Math.min(rawDt, 0.12);
    const k = keys.current;
    let ix = 0;
    let iz = 0;
    if (k.has("KeyW") || k.has("ArrowUp")) iz -= 1;
    if (k.has("KeyS") || k.has("ArrowDown")) iz += 1;
    if (k.has("KeyA") || k.has("ArrowLeft")) ix -= 1;
    if (k.has("KeyD") || k.has("ArrowRight")) ix += 1;
    ix += virtualInput.axisX;
    iz += virtualInput.axisZ;
    ix = Math.max(-1, Math.min(1, ix));
    iz = Math.max(-1, Math.min(1, iz));
    // Same convention as PlayerAvatar: W/joystick-up = iz -1 = forward.
    // Touch pedals / steering wheel write virtualInput.throttle/brake/steer
    // (0..1 / 0..1 / -1..1) and merge with keyboard + joystick here.
    const fwdIn = Math.min(1, Math.max(0, -iz) + virtualInput.throttle);
    const revIn = Math.min(1, Math.max(0, iz) + virtualInput.brake);
    const steerIn = Math.max(-1, Math.min(1, ix + virtualInput.steer));

    // Arcade speed model: throttle / brake-reverse / rolling drag + Space handbrake.
    let speed = car.speed;
    if (fwdIn > 0.05 && fwdIn >= revIn) {
      const tgt = spec.topSpeed * fwdIn;
      speed = Math.min(tgt, speed + spec.accel * t);
    } else if (revIn > 0.05) {
      const tgt = -spec.topSpeed * 0.38 * revIn;
      speed = Math.max(tgt, speed - spec.brake * t);
    } else {
      const drag = (k.has("Space") ? spec.brake : 7) * t;
      speed = Math.abs(speed) <= drag ? 0 : speed - Math.sign(speed) * drag;
    }

    // Steering: authority scales with speed, fades at top speed; flips in reverse.
    const steerTarget = steerIn * 0.5;
    const steer = car.steer + (steerTarget - car.steer) * Math.min(1, t * 10);
    const spdF = Math.min(1, Math.abs(speed) / 6) * (1 - 0.45 * Math.min(1, Math.abs(speed) / spec.topSpeed));
    const dir = speed >= 0 ? 1 : -1;
    let yaw = car.yaw;
    if (Math.abs(speed) > 0.3) yaw -= steerIn * spec.turn * spec.grip * spdF * dir * t;

    // Move with per-axis slide against building colliders + world bounds.
    const fx = Math.sin(yaw);
    const fz = Math.cos(yaw);
    const nx = car.pos.x + fx * speed * t;
    const nz = car.pos.z + fz * speed * t;
    let hit = false;
    if (!collidesAt(nx, car.pos.z, CAR_RADIUS, block)) car.pos.x = nx;
    else hit = true;
    if (!collidesAt(car.pos.x, nz, CAR_RADIUS, block)) car.pos.z = nz;
    else hit = true;
    if (hit) speed *= 0.55; // scrape, don't stop dead

    s.updateCar(s.activeCarId, { yaw, speed, steer });

    // Telemetry bridge for gameplay systems (HUD speed, crash/heat logic).
    window.__oxc_vehicle = { inCar: true, speed };

    // Third-person follow cam: behind + above, zoomable, occlusion-marched.
    camDist.current = Math.min(15, Math.max(6, camDist.current + consumeZoom()));
    const dist = camDist.current + Math.abs(speed) * 0.05;
    const target = new THREE.Vector3(car.pos.x + fx * 2, 1.7, car.pos.z + fz * 2);
    const desired = new THREE.Vector3(car.pos.x - fx * dist, 1.7 + dist * 0.52, car.pos.z - fz * dist);
    let tMax = 1;
    for (let i = 1; i <= 16; i++) {
      const f = i / 16;
      const px = target.x + (desired.x - target.x) * f;
      const py = target.y + (desired.y - target.y) * f;
      const pz = target.z + (desired.z - target.z) * f;
      if (pointInBuilding(px, py, pz, block, null)) {
        tMax = Math.max((i - 1) / 16, 0.16);
        break;
      }
    }
    const camGoal = target.clone().lerp(desired, tMax);
    camera.position.lerp(camGoal, 1 - Math.pow(0.0008, t));
    camera.lookAt(target);

    // Report the car as the player position (~8Hz) so prompts, NPCs,
    // minimap and remote avatars follow the driver.
    reportAcc.current += t;
    if (reportAcc.current >= 0.12) {
      reportAcc.current = 0;
      onMove?.({ x: car.pos.x, y: 0, z: car.pos.z }, yaw);
      setPlayerPos({ x: car.pos.x, y: 0, z: car.pos.z });
      setPlayerYaw(yaw);
    }
    void clock;
  });

  return null;
}

/* ------------------------------------------------------------------ */
/* "E · DRIVE" prompt marker over the nearest car                       */
/* ------------------------------------------------------------------ */

function CarPromptMarker() {
  const group = useRef<THREE.Group>(null);
  const { playerPos, prompt, panel, touchControls } = useCity();
  const mode = useVehicleStore((s) => s.mode);
  const enteringCarId = useVehicleStore((s) => s.enteringCarId);

  useFrame(() => {
    const g = group.current;
    if (!g) return;
    const s = useVehicleStore.getState();
    let show: string | null = null;
    if (s.mode === "foot" && !s.enteringCarId && !prompt && panel === "none") {
      const id = findNearestCar(playerPos.x, playerPos.z);
      if (id) {
        const car = s.cars[id]!;
        g.position.set(car.pos.x, 2.9, car.pos.z);
        show = touchControls ? "TAP DRIVE" : "E · DRIVE";
      }
    }
    g.visible = show !== null;
    const label = g.children[0] as unknown as { text?: string } | undefined;
    if (show && label && "text" in (label as object)) (label as { text: string }).text = show;
  });

  if (mode !== "foot" || enteringCarId) return null;
  return (
    <group ref={group} visible={false}>
      <Billboard>
        <Text fontSize={0.34} color="#eaf6ff" anchorX="center" outlineWidth={0.03} outlineColor="#0a1014">
          E · DRIVE
        </Text>
      </Billboard>
      <mesh position={[0, -0.45, 0]}>
        <torusGeometry args={[0.5, 0.035, 8, 32]} />
        <meshBasicMaterial color="#3de7ff" toneMapped={false} />
      </mesh>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Driven-car headlight throw at night                                  */
/* ------------------------------------------------------------------ */

function DrivenHeadlight() {
  const activeCarId = useVehicleStore((s) => (s.mode === "driving" ? s.activeCarId : null));
  const light = useRef<THREE.SpotLight>(null);
  const targetObj = useMemo(() => new THREE.Object3D(), []);
  const night = useMemo(() => isNight(), []);

  useFrame(() => {
    if (!light.current || !activeCarId) return;
    const car = useVehicleStore.getState().cars[activeCarId];
    if (!car) return;
    const fx = Math.sin(car.yaw);
    const fz = Math.cos(car.yaw);
    light.current.position.set(car.pos.x + fx * 2, 1.1, car.pos.z + fz * 2);
    targetObj.position.set(car.pos.x + fx * 14, 0.4, car.pos.z + fz * 14);
    light.current.target = targetObj;
  });

  if (!night || !activeCarId) return null;
  return (
    <>
      <spotLight
        ref={light}
        angle={0.5}
        penumbra={0.5}
        distance={26}
        intensity={60}
        color="#d8ecff"
        decay={1.6}
      />
      <primitive object={targetObj} />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Touch DRIVE / EXIT button (DOM overlay via portal)                   */
/* ------------------------------------------------------------------ */

function TouchDriveButton() {
  const { playerPos, prompt, panel, teleport, touchControls } = useCity();
  const mode = useVehicleStore((s) => s.mode);
  const [coarse] = useState(
    () => typeof window !== "undefined" && !!window.matchMedia?.("(pointer: coarse)").matches,
  );
  if (!touchControls && !coarse) return null;

  const st = useVehicleStore.getState();
  const nearId = mode === "foot" && !st.enteringCarId ? findNearestCar(playerPos.x, playerPos.z) : null;
  const showDrive = mode === "foot" && nearId && !prompt && panel === "none";
  const showExit = mode === "driving";
  if (!showDrive && !showExit) return null;

  const onPress = () => {
    const s = useVehicleStore.getState();
    if (s.mode === "driving") {
      const car = s.activeCarId ? s.cars[s.activeCarId] : undefined;
      const block = vehicleBlockRef.current;
      let ex = playerPos.x;
      let ez = playerPos.z;
      if (car && block) {
        const lx = Math.cos(car.yaw);
        const lz = -Math.sin(car.yaw);
        ex = car.pos.x + lx * 2.1;
        ez = car.pos.z + lz * 2.1;
        if (collidesAt(ex, ez, 0.5, block)) {
          ex = car.pos.x - lx * 2.1;
          ez = car.pos.z - lz * 2.1;
        }
      }
      s.exitCar();
      teleport(ex, ez);
    } else if (nearId) {
      s.enterCar(nearId);
    }
  };

  return createPortal(
    <button
      onPointerDown={(e) => {
        e.preventDefault();
        onPress();
      }}
      aria-label={showExit ? "Exit car" : "Drive car"}
      style={{
        position: "fixed",
        right: 18,
        bottom: 118,
        zIndex: 60,
        width: 76,
        height: 76,
        borderRadius: "50%",
        border: "2px solid #3de7ff",
        background: "rgba(6,12,18,0.72)",
        color: "#eaf6ff",
        fontSize: 13,
        fontWeight: 700,
        letterSpacing: 0.5,
        touchAction: "none",
      }}
    >
      {showExit ? "EXIT" : "DRIVE"}
    </button>,
    document.body,
  );
}

/* ------------------------------------------------------------------ */
/* Public export — mounted once by the coordinator in WorldCanvas       */
/* ------------------------------------------------------------------ */

export function VehicleSystem({ block, onMove }: { block?: WorldBlockConfig; onMove?: (pos: Vec3, yaw: number) => void }) {
  const { selectedCityId, quality } = useCity();
  const resolvedBlock = block ?? getWorldBlock(selectedCityId);

  const bodies = useMemo<Record<string, CarBody>>(() => {
    const spots = findParkingSpots(resolvedBlock, FLEET.length);
    const out: Record<string, CarBody> = {};
    FLEET.forEach((spec, i) => {
      const spot = spots[i % Math.max(1, spots.length)] ?? {
        x: resolvedBlock.spawn.x + 6 + i * 6,
        z: resolvedBlock.spawn.z + 4,
        yaw: 0,
      };
      out[spec.id] = { pos: { x: spot.x, z: spot.z }, yaw: spot.yaw, speed: 0, steer: 0 };
    });
    return out;
  }, [resolvedBlock]);

  useEffect(() => {
    useVehicleStore.getState().resetVehicles();
    useVehicleStore.getState().registerCars(FLEET, bodies);
  }, [resolvedBlock.cityId]); // eslint-disable-line react-hooks/exhaustive-deps

  const specs = useVehicleStore((s) => s.specs);
  const carIds = Object.keys(specs);

  return (
    <>
      {carIds.map((id) => (
        <DrivableCar key={id} carId={id} spec={specs[id]!} />
      ))}
      <VehicleController block={resolvedBlock} onMove={onMove} />
      <CarPromptMarker />
      {quality === "high" && <DrivenHeadlight />}
      <TouchDriveButton />
    </>
  );
}

export { FLEET as VEHICLE_FLEET };

/**
 * Drivable parked cars — GTA-style grand theft auto.
 * Walk up to a parked car, press E (or tap the prompt) to steal it,
 * drive with WASD/arrows/joystick, press E again to bail out.
 * Stealing reports a grand_theft_auto crime to the police module.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Billboard, Text } from "@react-three/drei";
import * as THREE from "three";
import type { WorldBlockConfig } from "@/lib/orbitxcity/types";
import { NYC_DEMO_BLOCK } from "@/lib/orbitxcity/demoBlock";
import { useCity } from "@/pages/orbitxcity/CityProvider";
import { virtualInput } from "@/lib/orbitxcity/input";
import { collidesAt, mulberry32 } from "@/lib/orbitxcity/collision";
import { CITY_CAR_BODIES, CITY_CAR_GLOWS, CityCarMesh } from "./CityCarMesh";
import { getPoliceStore } from "@/city/modules/police/store";

interface ParkedCar {
  x: number;
  z: number;
  yaw: number;
  body: string;
  glow: string;
}

const DRIVE_KEYS = new Set<string>();
const ENTER_RADIUS = 3.2;
const TOP_SPEED = 22;
const ACCEL = 14;
const BRAKE = 26;
const TURN_RATE = 2.4;

function useDriveKeys() {
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      DRIVE_KEYS.add(e.code);
    };
    const up = (e: KeyboardEvent) => DRIVE_KEYS.delete(e.code);
    const blur = () => DRIVE_KEYS.clear();
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
      DRIVE_KEYS.clear();
    };
  }, []);
}

export function DrivableCars({ block = NYC_DEMO_BLOCK }: { block?: WorldBlockConfig }) {
  const { playerPos, setPlayerPos, playerHidden, setPlayerHidden } = useCity();
  const [driving, setDriving] = useState<number | null>(null);
  const [nearCar, setNearCar] = useState<number | null>(null);
  const carState = useRef(
    [] as Array<{ x: number; z: number; yaw: number; speed: number }>
  );
  const groups = useRef<Array<THREE.Group | null>>([]);
  const playerRef = useRef(playerPos);
  playerRef.current = playerPos;
  const drivingRef = useRef<number | null>(null);
  drivingRef.current = driving;

  useDriveKeys();

  const cars = useMemo<ParkedCar[]>(() => {
    const rand = mulberry32(0xd21e);
    const spawn = block.spawn;
    const out: ParkedCar[] = [];
    // Park a few cars on the streets near spawn, offset to the curb lane.
    const spots: Array<[number, number, number]> = [
      [spawn.x + 14, spawn.z + 6, Math.PI / 2],
      [spawn.x - 12, spawn.z + 18, -Math.PI / 2],
      [spawn.x + 22, spawn.z - 14, 0],
      [spawn.x - 20, spawn.z - 8, Math.PI],
      [spawn.x + 6, spawn.z + 26, Math.PI / 2],
    ];
    for (let i = 0; i < spots.length; i++) {
      const [sx, sz, yaw] = spots[i]!;
      let x = sx;
      let z = sz;
      if (collidesAt(x, z, 1.2, block)) {
        x = spawn.x + (rand() - 0.5) * 40;
        z = spawn.z + (rand() - 0.5) * 40;
      }
      out.push({
        x,
        z,
        yaw,
        body: CITY_CAR_BODIES[i % CITY_CAR_BODIES.length]!,
        glow: CITY_CAR_GLOWS[i % CITY_CAR_GLOWS.length]!,
      });
    }
    return out;
  }, [block]);

  // Sync mutable car state once cars are laid out.
  useEffect(() => {
    carState.current = cars.map((c) => ({ x: c.x, z: c.z, yaw: c.yaw, speed: 0 }));
  }, [cars]);

  // Enter / exit on KeyE or mobile car button (oxc:car-interact event).
  useEffect(() => {
    const doInteract = () => {
      if (drivingRef.current !== null) {
        // Bail out — drop the player beside the car.
        const c = carState.current[drivingRef.current];
        if (c) {
          setPlayerPos({ x: c.x + Math.cos(c.yaw) * 2.2, y: 0, z: c.z - Math.sin(c.yaw) * 2.2 });
        }
        setPlayerHidden(false);
        setDriving(null);
      } else if (nearCar !== null) {
        const idx = nearCar;
        setDriving(idx);
        setPlayerHidden(true);
        carState.current[idx]!.speed = 0;
        // Grand theft auto — the cops now care.
        try {
          getPoliceStore().reportCrime({
            kind: "grand_theft_auto",
            witnessed: true,
            label: "Grand theft auto",
          });
        } catch {
          /* police module optional */
        }
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "KeyE") return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      doInteract();
    };
    const onMobile = () => doInteract();
    window.addEventListener("keydown", onKey);
    window.addEventListener("oxc:car-interact", onMobile);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("oxc:car-interact", onMobile);
    };
  }, [nearCar, setPlayerPos, setPlayerHidden]);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const px = playerRef.current.x;
    const pz = playerRef.current.z;

    // Proximity check when on foot.
    if (drivingRef.current === null) {
      let best: number | null = null;
      let bestD = ENTER_RADIUS * ENTER_RADIUS;
      carState.current.forEach((c, i) => {
        const dx = c.x - px;
        const dz = c.z - pz;
        const d = dx * dx + dz * dz;
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      });
      if (best !== nearCar) setNearCar(best);
    } else if (nearCar !== null) {
      setNearCar(null);
    }

    // Driving physics — fully analog: stick tilt = pedal/steering amount.
    const di = drivingRef.current;
    if (di !== null) {
      const c = carState.current[di];
      const g = groups.current[di];
      if (c && g) {
        // Throttle: -1 (full reverse) .. +1 (full gas). Keyboard is digital, stick is analog.
        let throttle = 0;
        if (DRIVE_KEYS.has("KeyW") || DRIVE_KEYS.has("ArrowUp")) throttle += 1;
        if (DRIVE_KEYS.has("KeyS") || DRIVE_KEYS.has("ArrowDown")) throttle -= 1;
        throttle += -virtualInput.axisZ; // stick up (axisZ<0) = gas
        throttle = Math.max(-1, Math.min(1, throttle));
        // Steering: -1 (left) .. +1 (right).
        let steerInput = 0;
        if (DRIVE_KEYS.has("KeyA") || DRIVE_KEYS.has("ArrowLeft")) steerInput -= 1;
        if (DRIVE_KEYS.has("KeyD") || DRIVE_KEYS.has("ArrowRight")) steerInput += 1;
        steerInput += virtualInput.axisX;
        steerInput = Math.max(-1, Math.min(1, steerInput));

        if (throttle > 0.05) {
          c.speed = Math.min(TOP_SPEED, c.speed + ACCEL * throttle * dt);
        } else if (throttle < -0.05) {
          c.speed =
            c.speed > 0.5
              ? c.speed + BRAKE * throttle * dt // braking (throttle negative)
              : Math.max(-TOP_SPEED * 0.4, c.speed + ACCEL * 0.6 * throttle * dt); // reverse
        } else {
          // Coast: gentle friction.
          c.speed -= Math.sign(c.speed) * Math.min(Math.abs(c.speed), 6 * dt);
        }

        // Steering scales with speed so the car doesn't spin in place, and
        // fades at very high speed for stability.
        const speedFactor = Math.min(1, Math.abs(c.speed) / 6) * (1 - Math.min(0.4, Math.abs(c.speed) / TOP_SPEED * 0.4));
        c.yaw += steerInput * TURN_RATE * dt * speedFactor * Math.sign(c.speed || 1);

        const nx = c.x + Math.sin(c.yaw) * c.speed * dt;
        const nz = c.z + Math.cos(c.yaw) * c.speed * dt;
        if (!collidesAt(nx, nz, 1.1, block)) {
          c.x = nx;
          c.z = nz;
        } else {
          c.speed *= 0.3;
        }

        g.position.set(c.x, 0, c.z);
        g.rotation.y = c.yaw;
        // Drag the player (and camera) along with the car.
        setPlayerPos({ x: c.x, y: 0, z: c.z });
      }
    }
  });

  return (
    <group>
      {cars.map((c, i) => (
        <group key={i}>
          <group
            ref={(el) => {
              groups.current[i] = el;
            }}
            position={[c.x, 0, c.z]}
            rotation={[0, c.yaw, 0]}
          >
            <CityCarMesh glow={c.glow} body={c.body} />
          </group>
          {nearCar === i && driving === null && (
            <Billboard position={[c.x, 2.6, c.z]}>
              <Text fontSize={0.55} color="#ffd54a" anchorX="center" anchorY="middle" outlineWidth={0.04} outlineColor="#000">
                Press E to steal
              </Text>
            </Billboard>
          )}
          {driving === i && (
            <Billboard position={[c.x, 2.6, c.z]}>
              <Text fontSize={0.45} color="#ff8a8a" anchorX="center" anchorY="middle" outlineWidth={0.04} outlineColor="#000">
                E to bail
              </Text>
            </Billboard>
          )}
        </group>
      ))}
    </group>
  );
}

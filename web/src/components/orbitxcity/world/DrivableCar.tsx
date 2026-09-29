/**
 * OrbitX City — realistic drivable car (WORKER 2).
 *
 * Built from three.js primitives with believable proportions: sculpted body,
 * glass cabin, spinning wheels, steering front wheels, subtle body lean on
 * turns / pitch under throttle, seated driver, lit headlights at night.
 *
 * The physics body is read non-reactively every frame from vehicleStore
 * (getCarBody) so the 60Hz loop never re-renders React.
 */
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { isNight } from "@/lib/orbitxcity/dayNight";
import { getCarBody, type CarSpec } from "@/lib/orbitxcity/vehicleStore";

const GLASS = "#0f1a26";

function AnimWheel({
  x,
  z,
  radius,
  steerRef,
  spinRef,
}: {
  x: number;
  z: number;
  radius: number;
  steerRef?: (g: THREE.Group | null) => void;
  spinRef: (g: THREE.Group | null) => void;
}) {
  return (
    <group position={[x, radius, z]} ref={steerRef}>
      <group ref={spinRef}>
        <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[radius, radius, 0.26, 16]} />
          <meshStandardMaterial color="#0b0d10" roughness={0.85} />
        </mesh>
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[radius * 0.58, radius * 0.58, 0.27, 10]} />
          <meshStandardMaterial color="#a8b2bc" metalness={0.9} roughness={0.28} />
        </mesh>
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[radius * 0.2, radius * 0.2, 0.28, 8]} />
          <meshStandardMaterial color="#23282e" metalness={0.6} roughness={0.5} />
        </mesh>
        {/* 5 spokes */}
        {[0, 1, 2, 3, 4].map((i) => (
          <mesh key={i} rotation={[0, 0, Math.PI / 2]} position={[0, 0, 0]}>
            <group rotation={[0, 0, (i / 5) * Math.PI * 2]}>
              <mesh position={[0, radius * 0.32, 0]}>
                <boxGeometry args={[0.29, radius * 0.42, 0.07]} />
                <meshStandardMaterial color="#7c868f" metalness={0.85} roughness={0.35} />
              </mesh>
            </group>
          </mesh>
        ))}
      </group>
    </group>
  );
}

/** Simple seated driver — reads as intentional, not a mannequin glitch. */
function Driver({ shirt }: { shirt: string }) {
  return (
    <group position={[-0.42, 0, 0.1]}>
      {/* hips/seat */}
      <mesh position={[0, 0.86, 0]} castShadow>
        <boxGeometry args={[0.34, 0.3, 0.3]} />
        <meshStandardMaterial color="#1c2127" roughness={0.8} />
      </mesh>
      {/* torso leaning slightly to wheel */}
      <mesh position={[0, 1.2, 0.08]} rotation={[0.18, 0, 0]} castShadow>
        <boxGeometry args={[0.36, 0.52, 0.26]} />
        <meshStandardMaterial color={shirt} roughness={0.7} />
      </mesh>
      {/* head */}
      <mesh position={[0, 1.62, 0.14]} castShadow>
        <sphereGeometry args={[0.15, 14, 12]} />
        <meshStandardMaterial color="#d9a077" roughness={0.6} />
      </mesh>
      {/* arms to steering wheel */}
      {[-0.14, 0.14].map((x) => (
        <mesh key={x} position={[x, 1.28, 0.32]} rotation={[0.9, 0, 0]}>
          <boxGeometry args={[0.09, 0.42, 0.09]} />
          <meshStandardMaterial color={shirt} roughness={0.7} />
        </mesh>
      ))}
      {/* legs */}
      {[-0.12, 0.12].map((x) => (
        <mesh key={x} position={[x, 0.78, 0.28]} rotation={[0.5, 0, 0]}>
          <boxGeometry args={[0.11, 0.4, 0.11]} />
          <meshStandardMaterial color="#232a33" roughness={0.8} />
        </mesh>
      ))}
    </group>
  );
}

function SteeringWheel() {
  return (
    <group position={[-0.42, 1.18, 0.62]} rotation={[0.5, 0, 0]}>
      <mesh>
        <torusGeometry args={[0.17, 0.028, 8, 20]} />
        <meshStandardMaterial color="#14171b" roughness={0.6} />
      </mesh>
      <mesh rotation={[0, 0, Math.PI / 2]} position={[0, 0, 0]}>
        <cylinderGeometry args={[0.025, 0.025, 0.1, 8]} />
        <meshStandardMaterial color="#2b3138" metalness={0.5} roughness={0.5} />
      </mesh>
    </group>
  );
}

export function DrivableCar({ carId, spec }: { carId: string; spec: CarSpec }) {
  const root = useRef<THREE.Group>(null);
  const bodyG = useRef<THREE.Group>(null);
  const night = useMemo(() => isNight(), []);
  const L = spec.length;
  const W = spec.width;
  const R = spec.wheelRadius;
  const track = W / 2 - 0.06;
  const axleF = L / 2 - 0.95;
  const axleR = -(L / 2 - 0.95);

  const spinRefs = useRef<(THREE.Group | null)[]>([null, null, null, null]);
  const steerRefs = useRef<(THREE.Group | null)[]>([null, null]);
  const spinAngle = useRef(0);
  const lastYaw = useRef(0);
  const smoothYaw = useRef(0);
  const initialized = useRef(false);

  useFrame((_, rawDt) => {
    const body = getCarBody(carId);
    const g = root.current;
    if (!body || !g) return;
    const dt = Math.min(rawDt, 0.1);

    if (!initialized.current) {
      smoothYaw.current = body.yaw;
      lastYaw.current = body.yaw;
      initialized.current = true;
    }
    // Shortest-arc yaw smoothing so 60Hz physics never snaps the mesh.
    let d = body.yaw - smoothYaw.current;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    smoothYaw.current += d * Math.min(1, dt * 18);

    g.position.set(body.pos.x, 0, body.pos.z);
    g.rotation.y = smoothYaw.current;

    // Wheel spin + front steering
    spinAngle.current += (body.speed / R) * dt;
    for (const s of spinRefs.current) if (s) s.rotation.x = spinAngle.current;
    const steerVis = THREE.MathUtils.clamp(body.steer, -0.55, 0.55);
    for (const s of steerRefs.current) if (s) s.rotation.y = steerVis;

    // Body lean: roll into turns, pitch under throttle/brake
    if (bodyG.current) {
      const speedF = THREE.MathUtils.clamp(Math.abs(body.speed) / spec.topSpeed, 0, 1);
      bodyG.current.rotation.z = -steerVis * speedF * 0.16;
      bodyG.current.rotation.x = THREE.MathUtils.clamp(-body.speed * 0.0016, -0.045, 0.045);
      bodyG.current.position.y = 0.02 * Math.sin(performance.now() * 0.012) * speedF;
    }
    lastYaw.current = body.yaw;
  });

  const cabinL = L * 0.42;
  const cabinZ = -L * 0.04;

  return (
    <group ref={root}>
      <group ref={bodyG}>
        {/* main hull */}
        <mesh position={[0, 0.52, 0]} castShadow>
          <boxGeometry args={[W, 0.52, L]} />
          <meshStandardMaterial color={spec.body} metalness={0.65} roughness={0.3} />
        </mesh>
        {/* nose taper */}
        <mesh position={[0, 0.62, L / 2 - 0.62]} castShadow>
          <boxGeometry args={[W * 0.94, 0.34, 1.15]} />
          <meshStandardMaterial color={spec.body} metalness={0.65} roughness={0.3} />
        </mesh>
        {/* tail deck */}
        <mesh position={[0, 0.64, -(L / 2 - 0.55)]} castShadow>
          <boxGeometry args={[W * 0.96, 0.36, 1.0]} />
          <meshStandardMaterial color={spec.body} metalness={0.65} roughness={0.3} />
        </mesh>
        {/* glass cabin */}
        <mesh position={[0, 1.0, cabinZ]} castShadow>
          <boxGeometry args={[W * 0.86, 0.48, cabinL]} />
          <meshStandardMaterial
            color={GLASS}
            metalness={0.35}
            roughness={0.12}
            emissive={spec.glow}
            emissiveIntensity={0.12}
          />
        </mesh>
        {/* windshield */}
        <mesh position={[0, 0.94, cabinZ + cabinL / 2 + 0.28]} rotation={[0.5, 0, 0]}>
          <boxGeometry args={[W * 0.84, 0.05, 0.85]} />
          <meshStandardMaterial color={GLASS} metalness={0.35} roughness={0.1} />
        </mesh>
        {/* rear glass */}
        <mesh position={[0, 0.94, cabinZ - cabinL / 2 - 0.28]} rotation={[-0.5, 0, 0]}>
          <boxGeometry args={[W * 0.84, 0.05, 0.85]} />
          <meshStandardMaterial color={GLASS} metalness={0.35} roughness={0.1} />
        </mesh>
        {/* roof */}
        <mesh position={[0, 1.24, cabinZ]}>
          <boxGeometry args={[W * 0.8, 0.06, cabinL * 0.52]} />
          <meshStandardMaterial color={spec.body} metalness={0.65} roughness={0.3} />
        </mesh>

        {/* headlights */}
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * (W / 2 - 0.32), 0.62, L / 2 + 0.01]}>
            <boxGeometry args={[0.4, 0.13, 0.06]} />
            <meshStandardMaterial
              color="#e8f4ff"
              emissive="#eaf6ff"
              emissiveIntensity={night ? 2.6 : 0.8}
              toneMapped={false}
            />
          </mesh>
        ))}
        {/* headlight beams at night (driven car only gets a real spotlight; parked cars fake it) */}
        {night &&
          [-1, 1].map((s) => (
            <mesh key={`beam${s}`} position={[s * (W / 2 - 0.32), 0.5, L / 2 + 2.2]} rotation={[Math.PI / 2.4, 0, 0]}>
              <coneGeometry args={[0.55, 4.2, 12, 1, true]} />
              <meshBasicMaterial color="#cfe8ff" transparent opacity={0.07} side={THREE.DoubleSide} depthWrite={false} />
            </mesh>
          ))}
        {/* taillight bar */}
        <mesh position={[0, 0.64, -(L / 2 + 0.01)]}>
          <boxGeometry args={[W * 0.72, 0.11, 0.06]} />
          <meshStandardMaterial
            color="#ff3b3b"
            emissive="#ff2b2b"
            emissiveIntensity={night ? 1.8 : 0.7}
            toneMapped={false}
          />
        </mesh>
        {/* grille + plate */}
        <mesh position={[0, 0.42, L / 2 + 0.01]}>
          <boxGeometry args={[W * 0.5, 0.16, 0.05]} />
          <meshStandardMaterial color="#0d1013" roughness={0.7} />
        </mesh>
        {/* mirrors */}
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * (W / 2 + 0.06), 0.98, cabinZ + cabinL / 2 - 0.1]}>
            <boxGeometry args={[0.14, 0.1, 0.2]} />
            <meshStandardMaterial color={spec.body} metalness={0.6} roughness={0.35} />
          </mesh>
        ))}

        <Driver shirt={spec.glow} />
        <SteeringWheel />

        <AnimWheel x={-track} z={axleF} radius={R} steerRef={(g) => (steerRefs.current[0] = g)} spinRef={(g) => (spinRefs.current[0] = g)} />
        <AnimWheel x={track} z={axleF} radius={R} steerRef={(g) => (steerRefs.current[1] = g)} spinRef={(g) => (spinRefs.current[1] = g)} />
        <AnimWheel x={-track} z={axleR} radius={R} spinRef={(g) => (spinRefs.current[2] = g)} />
        <AnimWheel x={track} z={axleR} radius={R} spinRef={(g) => (spinRefs.current[3] = g)} />

        {/* underglow */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
          <planeGeometry args={[W + 0.2, L + 0.2]} />
          <meshBasicMaterial color={spec.glow} transparent opacity={0.13} toneMapped={false} />
        </mesh>
      </group>
    </group>
  );
}

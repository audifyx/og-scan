import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/**
 * RockBandDrums — a Rock Band-style 4-pad drum kit in a music corner of the
 * 3D office. Placed around (x=4.2, z=-2.5), facing into the room (toward -x).
 *
 *  - 4 pads (radius 0.22, h 0.08) in Rock Band colors — red, yellow, blue,
 *    green — arranged in an arc, each on a dark stand pole (h 0.7) with a
 *    small disc base. Pad tops glow slightly in their color.
 *  - Kick pedal: small angled box on the floor in front center.
 *  - Two drumsticks (0.45 long) resting crossed on the yellow pad.
 *  - A small stool (cylinder seat + pole) behind the kit at z=-2.9.
 */

const PAD_RADIUS = 0.22;
const PAD_HEIGHT = 0.08;
const STAND_HEIGHT = 0.7;
const KIT_X = 4.2;
const KIT_Z = -2.5;

// Rock Band pad colors, ordered left → right
const PAD_COLORS = ["#e0352b", "#e8c02a", "#2a6fe0", "#2fa84f"] as const;

interface PadDef {
  color: string;
  offset: [number, number]; // local (x, z) offset from kit center
}

/** Arc arrangement: pads fan out along a shallow curve facing -x. */
const PADS: PadDef[] = [
  { color: PAD_COLORS[0], offset: [0.18, 0.55] }, // red — left
  { color: PAD_COLORS[1], offset: [0.0, 0.2] }, // yellow — mid-left
  { color: PAD_COLORS[2], offset: [0.0, -0.2] }, // blue — mid-right
  { color: PAD_COLORS[3], offset: [0.18, -0.55] }, // green — right
];

function Pad({ color, offset }: PadDef) {
  const [ox, oz] = offset;
  const x = KIT_X + ox;
  const z = KIT_Z + oz;
  const padY = STAND_HEIGHT + PAD_HEIGHT / 2;
  const emissive = new THREE.Color(color).multiplyScalar(0.35);

  return (
    <group position={[x, 0, z]}>
      {/* stand pole */}
      <mesh position={[0, STAND_HEIGHT / 2, 0]} castShadow>
        <cylinderGeometry args={[0.025, 0.025, STAND_HEIGHT, 12]} />
        <meshStandardMaterial color="#1a1d24" roughness={0.6} metalness={0.4} />
      </mesh>
      {/* base disc */}
      <mesh position={[0, 0.02, 0]} receiveShadow>
        <cylinderGeometry args={[0.14, 0.16, 0.04, 16]} />
        <meshStandardMaterial color="#22262e" roughness={0.8} />
      </mesh>
      {/* pad body */}
      <mesh position={[0, padY, 0]} castShadow>
        <cylinderGeometry args={[PAD_RADIUS, PAD_RADIUS * 0.96, PAD_HEIGHT, 24]} />
        <meshStandardMaterial color="#101216" roughness={0.55} />
      </mesh>
      {/* glowing pad top */}
      <mesh position={[0, padY + PAD_HEIGHT / 2 - 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[PAD_RADIUS * 0.92, 24]} />
        <meshStandardMaterial color={color} emissive={emissive} roughness={0.35} />
      </mesh>
    </group>
  );
}

function KickPedal() {
  return (
    <group position={[KIT_X - 0.15, 0, KIT_Z]} rotation={[0, 0, 0]}>
      {/* angled pedal plate */}
      <mesh position={[0, 0.06, 0]} rotation={[0.5, 0, 0]} castShadow>
        <boxGeometry args={[0.22, 0.04, 0.34]} />
        <meshStandardMaterial color="#1a1d24" roughness={0.6} metalness={0.3} />
      </mesh>
      {/* hinge base */}
      <mesh position={[0, 0.02, -0.14]}>
        <boxGeometry args={[0.24, 0.04, 0.08]} />
        <meshStandardMaterial color="#2a2e36" roughness={0.7} />
      </mesh>
    </group>
  );
}

function Drumsticks() {
  // Rest crossed on the yellow pad (mid-left), tilted slightly
  const yellowX = KIT_X + PADS[1].offset[0];
  const yellowZ = KIT_Z + PADS[1].offset[1];
  const stickY = STAND_HEIGHT + PAD_HEIGHT + 0.015;

  return (
    <group position={[yellowX, stickY, yellowZ]} rotation={[0, 0.6, 0]}>
      {/* stick 1 */}
      <mesh position={[0.02, 0, 0.03]} rotation={[Math.PI / 2 + 0.06, 0, 0.5]} castShadow>
        <cylinderGeometry args={[0.012, 0.012, 0.45, 10]} />
        <meshStandardMaterial color="#d9b382" roughness={0.7} />
      </mesh>
      {/* stick 2 */}
      <mesh position={[-0.02, 0.012, -0.03]} rotation={[Math.PI / 2 - 0.06, 0, -0.55]} castShadow>
        <cylinderGeometry args={[0.012, 0.012, 0.45, 10]} />
        <meshStandardMaterial color="#d9b382" roughness={0.7} />
      </mesh>
    </group>
  );
}

function Stool() {
  const x = KIT_X;
  const z = -2.9;
  const seatY = 0.42;

  return (
    <group position={[x, 0, z]}>
      {/* seat */}
      <mesh position={[0, seatY, 0]} castShadow>
        <cylinderGeometry args={[0.19, 0.17, 0.07, 20]} />
        <meshStandardMaterial color="#3a2233" roughness={0.55} />
      </mesh>
      {/* pole */}
      <mesh position={[0, seatY / 2, 0]} castShadow>
        <cylinderGeometry args={[0.03, 0.03, seatY, 12]} />
        <meshStandardMaterial color="#1a1d24" roughness={0.6} metalness={0.4} />
      </mesh>
      {/* base disc */}
      <mesh position={[0, 0.025, 0]} receiveShadow>
        <cylinderGeometry args={[0.2, 0.22, 0.05, 20]} />
        <meshStandardMaterial color="#22262e" roughness={0.8} />
      </mesh>
    </group>
  );
}

/** exported for use inside an existing <Canvas> in the /token scene. */
export function RockBandDrums() {
  const glow = useRef<THREE.PointLight>(null);

  useFrame((state) => {
    // gentle pulse on the accent light so the kit feels alive
    if (glow.current) {
      glow.current.intensity = 0.55 + Math.sin(state.clock.elapsedTime * 1.8) * 0.12;
    }
  });

  return (
    <group>
      {PADS.map((p) => (
        <Pad key={p.color} color={p.color} offset={p.offset} />
      ))}
      <KickPedal />
      <Drumsticks />
      <Stool />
      {/* warm accent light over the kit */}
      <pointLight ref={glow} position={[KIT_X, 1.6, KIT_Z]} color="#ffd166" intensity={0.55} distance={4} />
    </group>
  );
}

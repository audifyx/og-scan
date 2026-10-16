/**
 * EnergyDrinks — a small cluster of drink props for the 3D office kitchen
 * countertop. Built centered at local origin (0, 0, 0); the parent places it
 * so the base sits on the counter (counter top at y ≈ 0.94).
 *
 * - 3 energy drink cans (cyan #22d3ee, magenta #ec4899, lime #a3e635) in a
 *   triangle, each with a silver top disc.
 * - 1 boba tea cup (milky tan, slightly transparent) with 6 black pearls
 *   settled at the bottom, a cream lid, and a tilted pink straw.
 */

const CAN_RADIUS = 0.05;
const CAN_HEIGHT = 0.16;
const CAN_TOP_RADIUS = 0.045;
const CAN_TOP_HEIGHT = 0.015;

const CAN_COLORS = ["#22d3ee", "#ec4899", "#a3e635"] as const;

type Vec3 = [number, number, number];

interface CanDef {
  color: string;
  position: Vec3; // base center of the can
}

/** Triangle arrangement of the three cans. */
const CANS: CanDef[] = [
  { color: CAN_COLORS[0], position: [-0.09, CAN_HEIGHT / 2, 0] },
  { color: CAN_COLORS[1], position: [0.09, CAN_HEIGHT / 2, 0.02] },
  { color: CAN_COLORS[2], position: [0, CAN_HEIGHT / 2, -0.1] },
];

function EnergyCan({ color, position }: CanDef) {
  const [x, y, z] = position;
  const topY = y + CAN_HEIGHT / 2 + CAN_TOP_HEIGHT / 2;
  return (
    <group position={[x, 0, z]}>
      {/* can body */}
      <mesh position={[0, y, 0]} castShadow>
        <cylinderGeometry args={[CAN_RADIUS, CAN_RADIUS, CAN_HEIGHT, 24]} />
        <meshStandardMaterial color={color} roughness={0.3} metalness={0.45} />
      </mesh>
      {/* silver top */}
      <mesh position={[0, topY, 0]} castShadow>
        <cylinderGeometry
          args={[CAN_TOP_RADIUS, CAN_TOP_RADIUS, CAN_TOP_HEIGHT, 24]}
        />
        <meshStandardMaterial
          color="#d7dde6"
          roughness={0.25}
          metalness={0.85}
        />
      </mesh>
    </group>
  );
}

const BOBA_BASE: Vec3 = [0.18, 0, 0.08];
const CUP_TOP_RADIUS = 0.07;
const CUP_BOTTOM_RADIUS = 0.05;
const CUP_HEIGHT = 0.16;
const PEARL_RADIUS = 0.012;

/** (x, z) offsets for the 6 boba pearls inside the cup, relative to cup base. */
const PEARL_OFFSETS: Array<[number, number, number]> = [
  [0.02, 0.02, 0.018],
  [-0.02, 0.01, 0.014],
  [0.01, -0.02, 0.026],
  [-0.015, -0.015, 0.03],
  [0.03, -0.005, 0.012],
  [-0.03, 0.025, 0.022],
];

function BobaTea() {
  const [bx, , bz] = BOBA_BASE;
  const cupY = CUP_HEIGHT / 2;
  const lidY = CUP_HEIGHT + 0.01;
  return (
    <group position={[bx, 0, bz]}>
      {/* cup */}
      <mesh position={[0, cupY, 0]} castShadow>
        <cylinderGeometry
          args={[CUP_TOP_RADIUS, CUP_BOTTOM_RADIUS, CUP_HEIGHT, 24]}
        />
        <meshStandardMaterial
          color="#d9b98f"
          transparent
          opacity={0.85}
          roughness={0.5}
          metalness={0}
        />
      </mesh>
      {/* boba pearls settled at the bottom */}
      {PEARL_OFFSETS.map(([ox, oz, oy], i) => (
        <mesh key={i} position={[ox, oy, oz]}>
          <sphereGeometry args={[PEARL_RADIUS, 12, 12]} />
          <meshStandardMaterial color="#141210" roughness={0.4} metalness={0} />
        </mesh>
      ))}
      {/* cream lid */}
      <mesh position={[0, lidY, 0]} castShadow>
        <cylinderGeometry args={[0.075, 0.075, 0.02, 24]} />
        <meshStandardMaterial color="#f5f0e6" roughness={0.6} metalness={0} />
      </mesh>
      {/* tilted pink straw sticking out of the lid */}
      <mesh position={[0.03, lidY + 0.12, 0.01]} rotation={[0.1, 0, -0.35]}>
        <cylinderGeometry args={[0.008, 0.008, 0.24, 12]} />
        <meshStandardMaterial color="#f472b6" roughness={0.45} metalness={0} />
      </mesh>
    </group>
  );
}

/**
 * EnergyDrinks — drink props for the kitchen countertop.
 */
export function EnergyDrinks() {
  return (
    <group>
      {CANS.map((can) => (
        <EnergyCan
          key={can.color}
          color={can.color}
          position={can.position}
        />
      ))}
      <BobaTea />
    </group>
  );
}

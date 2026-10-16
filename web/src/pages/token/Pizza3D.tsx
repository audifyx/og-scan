/**
 * PizzaBox — open pizza box with a whole pepperoni pizza inside.
 *
 * Local scene, centered at origin (0,0,0). Meant to sit on a kitchen
 * countertop at y≈0.94 (see Meals3D: `<PizzaBox position={[4.25, 0.94, 3.15]} />`).
 * Box + pizza stack is ~0.12 tall; the open lid stands up behind it.
 */

const KRAFT_BROWN = "#b08954";
const KRAFT_DARK = "#9a7443";
const PIZZA_GOLD = "#d99a4e";
const CRUST_DARK = "#b07a35";
const PEPPERONI = "#8f2b1f";
const LOGO_ORANGE = "#ff7a1a";

const LID_OPEN_ANGLE = (100 * Math.PI) / 180; // ~100°, tilted back past vertical
const BACK_EDGE_Z = -0.275; // back edge of the 0.55-wide box
const BOX_TOP_Y = 0.04;

// Pepperoni scatter: (x, z) offsets from pizza center, all inside radius 0.18
const PEPPERONI_SPOTS: Array<[number, number]> = [
  [0.08, 0.02],
  [-0.09, 0.06],
  [0.02, -0.1],
  [0.12, -0.06],
  [-0.05, 0.12],
  [-0.13, -0.05],
];

export function PizzaBox() {
  return (
    <group>
      {/* Box base: 0.55 x 0.04 x 0.55 kraft cardboard, top at y=0.04 */}
      <mesh position={[0, 0.02, 0]}>
        <boxGeometry args={[0.55, 0.04, 0.55]} />
        <meshStandardMaterial color={KRAFT_BROWN} roughness={0.9} />
      </mesh>
      {/* Box base inner shadow rim (thin darker lip so the pizza sits "in" it) */}
      <mesh position={[0, 0.041, 0]}>
        <boxGeometry args={[0.51, 0.004, 0.51]} />
        <meshStandardMaterial color={KRAFT_DARK} roughness={0.95} />
      </mesh>

      {/* Lid: hinged at the back edge, tilted back ~100° so it stands behind the box */}
      <group position={[0, BOX_TOP_Y, BACK_EDGE_Z]} rotation-x={-LID_OPEN_ANGLE}>
        <mesh position={[0, 0.015, 0.275]}>
          <boxGeometry args={[0.55, 0.03, 0.55]} />
          <meshStandardMaterial color={KRAFT_BROWN} roughness={0.9} />
        </mesh>
        {/* Canvas-free logo: emissive orange circle on the lid's outer (front-facing) face */}
        <mesh position={[0, -0.001, 0.275]} rotation-x={Math.PI / 2}>
          <circleGeometry args={[0.08, 32]} />
          <meshStandardMaterial
            color={LOGO_ORANGE}
            emissive={LOGO_ORANGE}
            emissiveIntensity={1.4}
            roughness={0.4}
          />
        </mesh>
      </group>

      {/* Pizza: golden-brown cylinder sitting in the box */}
      <mesh position={[0, 0.075, 0]}>
        <cylinderGeometry args={[0.22, 0.22, 0.03, 40]} />
        <meshStandardMaterial color={PIZZA_GOLD} roughness={0.7} />
      </mesh>

      {/* Crust: slightly darker torus hugging the pizza edge */}
      <mesh position={[0, 0.075, 0]} rotation-x={Math.PI / 2}>
        <torusGeometry args={[0.2, 0.025, 16, 48]} />
        <meshStandardMaterial color={CRUST_DARK} roughness={0.75} />
      </mesh>

      {/* Pepperoni: 6 dark-red slices scattered on top */}
      {PEPPERONI_SPOTS.map(([x, z], i) => (
        <mesh key={i} position={[x, 0.095, z]}>
          <cylinderGeometry args={[0.035, 0.035, 0.035, 24]} />
          <meshStandardMaterial color={PEPPERONI} roughness={0.55} />
        </mesh>
      ))}
    </group>
  );
}

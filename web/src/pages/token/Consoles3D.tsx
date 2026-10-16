import * as THREE from "three";

/**
 * GameConsoles — a media shelf under the wall-mounted BigTV with four game
 * consoles and their glow lights. Positioned left of x=-4.8 to avoid
 * collisions with the desk (x=1.6), couch (x=-2.4) and AI core (0,0,0).
 */
export function GameConsoles() {
  const SHELF_X = -5.3;
  const SHELF_TOP = 0.49; // shelf center y=0.45, thickness 0.08

  return (
    <group>
      {/* ── Media shelf: dark wood box ── */}
      <mesh position={[SHELF_X, 0.45, 0]}>
        <boxGeometry args={[0.5, 0.08, 2.6]} />
        <meshStandardMaterial color="#3a2417" roughness={0.75} metalness={0.05} />
      </mesh>
      {/* Shelf legs */}
      {[-1.1, 1.1].map((z) => (
        <mesh key={z} position={[SHELF_X, 0.205, z]}>
          <boxGeometry args={[0.08, 0.41, 0.08]} />
          <meshStandardMaterial color="#241610" roughness={0.8} />
        </mesh>
      ))}

      {/* ── 1. Xbox (z=-0.9): black box + green glowing ring on top ── */}
      <group position={[SHELF_X, SHELF_TOP, -0.9]}>
        <mesh position={[0, 0.06, 0]}>
          <boxGeometry args={[0.35, 0.12, 0.5]} />
          <meshStandardMaterial color="#0d0d0d" roughness={0.4} metalness={0.3} />
        </mesh>
        <mesh position={[0, 0.125, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.08, 0.012, 12, 32]} />
          <meshStandardMaterial
            color="#0a2b0a"
            emissive="#22ff44"
            emissiveIntensity={2.2}
            toneMapped={false}
          />
        </mesh>
      </group>

      {/* ── 2. PS4 (z=-0.3): slanted via two stacked offset boxes + blue strip ── */}
      <group position={[SHELF_X, SHELF_TOP, -0.3]}>
        <mesh position={[0, 0.025, 0]}>
          <boxGeometry args={[0.33, 0.05, 0.46]} />
          <meshStandardMaterial color="#111111" roughness={0.35} metalness={0.35} />
        </mesh>
        <mesh position={[0.035, 0.075, 0]}>
          <boxGeometry args={[0.33, 0.05, 0.46]} />
          <meshStandardMaterial color="#141414" roughness={0.35} metalness={0.35} />
        </mesh>
        {/* thin blue light strip across the front (+x side) */}
        <mesh position={[0.172, 0.055, 0]}>
          <boxGeometry args={[0.006, 0.014, 0.42]} />
          <meshStandardMaterial
            color="#0a1a3a"
            emissive="#3a8bff"
            emissiveIntensity={2.4}
            toneMapped={false}
          />
        </mesh>
      </group>

      {/* ── 3. Apple TV (z=0.3): small black box + white LED dot ── */}
      <group position={[SHELF_X, SHELF_TOP, 0.3]}>
        <mesh position={[0, 0.03, 0]}>
          <boxGeometry args={[0.25, 0.06, 0.25]} />
          <meshStandardMaterial color="#080808" roughness={0.5} metalness={0.2} />
        </mesh>
        <mesh position={[0.1, 0.045, 0.02]}>
          <sphereGeometry args={[0.011, 12, 12]} />
          <meshStandardMaterial
            color="#ffffff"
            emissive="#ffffff"
            emissiveIntensity={2}
            toneMapped={false}
          />
        </mesh>
      </group>

      {/* ── 4. Wii (z=0.9): white vertical console on a stand disc + blue LED ── */}
      <group position={[SHELF_X, SHELF_TOP, 0.9]}>
        <mesh position={[0, 0.01, 0]}>
          <cylinderGeometry args={[0.16, 0.16, 0.02, 24]} />
          <meshStandardMaterial color="#f2f2f2" roughness={0.5} />
        </mesh>
        <mesh position={[0, 0.245, 0]}>
          <boxGeometry args={[0.12, 0.45, 0.3]} />
          <meshStandardMaterial color="#f5f5f5" roughness={0.45} metalness={0.05} />
        </mesh>
        <mesh position={[0.062, 0.06, 0.1]}>
          <sphereGeometry args={[0.009, 12, 12]} />
          <meshStandardMaterial
            color="#0a2a5a"
            emissive="#4a9bff"
            emissiveIntensity={2}
            toneMapped={false}
          />
        </mesh>
      </group>

      {/* ── Small cable boxes behind the consoles (optional detail) ── */}
      <mesh position={[SHELF_X - 0.02, SHELF_TOP + 0.04, -1.18]}>
        <boxGeometry args={[0.2, 0.08, 0.14]} />
        <meshStandardMaterial color="#151515" roughness={0.7} />
      </mesh>
      <mesh position={[SHELF_X - 0.02, SHELF_TOP + 0.03, 1.18]}>
        <boxGeometry args={[0.18, 0.06, 0.12]} />
        <meshStandardMaterial color="#181818" roughness={0.7} />
      </mesh>
    </group>
  );
}

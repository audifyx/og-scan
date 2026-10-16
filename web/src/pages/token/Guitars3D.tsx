/**
 * HeroGuitars — two Guitar Hero guitars leaning against the right wall
 * of the 3D office/music corner. No audio, no interaction — pure decor.
 */

// ── fret button colors, top (near headstock) to bottom ────────────────────
const FRET_COLORS = ["#22c55e", "#ef4444", "#eab308", "#3b82f6", "#f97316"];

interface GuitarProps {
  position: [number, number, number];
  bodyColor: string;
  tiltZ: number; // lean sideways
  tiltY: number; // face into room
}

function GuitarHero({ position, bodyColor, tiltZ, tiltY }: GuitarProps) {
  // Build the neck in local space: body centered at y≈0.35, neck rising to ~1.75.
  // A group tilt (rotation.z / rotation.y) gives the lean against the wall.
  const fretButtons = FRET_COLORS.map((color, i) => (
    <mesh
      key={color}
      position={[0, 1.32 - i * 0.085, 0.045]}
      rotation={[Math.PI / 2, 0, 0]}
    >
      <cylinderGeometry args={[0.032, 0.032, 0.03, 16]} />
      <meshStandardMaterial color={color} roughness={0.35} metalness={0.1} />
    </mesh>
  ));

  return (
    <group position={position} rotation={[0.12, tiltY, tiltZ]}>
      {/* ── body: lower bout (flattened cylinder) ── */}
      <mesh position={[0, 0.38, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.27, 0.27, 0.12, 24]} />
        <meshStandardMaterial color={bodyColor} roughness={0.45} metalness={0.15} />
      </mesh>
      {/* ── body: upper bout (smaller, offset up-left) ── */}
      <mesh position={[-0.06, 0.62, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.17, 0.17, 0.12, 24]} />
        <meshStandardMaterial color={bodyColor} roughness={0.45} metalness={0.15} />
      </mesh>
      {/* ── neck ── */}
      <mesh position={[0, 1.15, 0]}>
        <boxGeometry args={[0.08, 1.1, 0.06]} />
        <meshStandardMaterial color="#1c1c22" roughness={0.5} metalness={0.1} />
      </mesh>
      {/* ── fret buttons (green/red/yellow/blue/orange, top→bottom) ── */}
      {fretButtons}
      {/* ── headstock ── */}
      <mesh position={[0, 1.78, 0]}>
        <boxGeometry args={[0.14, 0.22, 0.07]} />
        <meshStandardMaterial color="#111114" roughness={0.5} metalness={0.2} />
      </mesh>
      {/* ── whammy bar: thin angled cylinder off the body ── */}
      <mesh
        position={[0.18, 0.5, 0.1]}
        rotation={[0.5, 0, -1.0]}
      >
        <cylinderGeometry args={[0.012, 0.012, 0.28, 8]} />
        <meshStandardMaterial color="#c8ccd4" roughness={0.25} metalness={0.85} />
      </mesh>
    </group>
  );
}

/**
 * HeroGuitars — two Guitar Hero guitars leaning back against the right wall
 * (wall plane ~x=5.9). Renders into the office scene alongside desk/TV/AI core.
 */
export function HeroGuitars() {
  return (
    <group>
      {/* Guitar 1: sunburst orange at (5.4, 0, -1.6) */}
      <GuitarHero
        position={[5.4, 0, -1.6]}
        bodyColor="#e06a1b"
        tiltZ={0.18}
        tiltY={-0.5}
      />
      {/* Guitar 2: black at (5.5, 0, -2.4) */}
      <GuitarHero
        position={[5.5, 0, -2.4]}
        bodyColor="#141417"
        tiltZ={0.15}
        tiltY={-0.65}
      />
    </group>
  );
}

// Kitchen corner (front-right of office): fridge + counter/cabinets.
// A sibling component (ViralMeals) places food on the countertop at y≈0.94,
// so the countertop surface must stay clear.
export function KitchenCorner() {
  return (
    <group>
      {/* ---------- Fridge ---------- */}
      <group position={[4.8, 0, 3.2]}>
        {/* body */}
        <mesh position={[0, 0.95, 0]}>
          <boxGeometry args={[0.9, 1.9, 0.8]} />
          <meshStandardMaterial color="#9aa3b2" metalness={0.8} roughness={0.35} />
        </mesh>
        {/* door seams: vertical split + horizontal freezer line (front face z = +0.4) */}
        <mesh position={[0, 0.95, 0.402]}>
          <boxGeometry args={[0.015, 1.86, 0.005]} />
          <meshStandardMaterial color="#3a3f4a" roughness={0.6} />
        </mesh>
        <mesh position={[0, 1.28, 0.402]}>
          <boxGeometry args={[0.88, 0.015, 0.005]} />
          <meshStandardMaterial color="#3a3f4a" roughness={0.6} />
        </mesh>
        {/* handles: two vertical boxes */}
        <mesh position={[-0.28, 1.0, 0.45]}>
          <boxGeometry args={[0.03, 0.5, 0.03]} />
          <meshStandardMaterial color="#c9d1dc" metalness={0.9} roughness={0.25} />
        </mesh>
        <mesh position={[0.28, 1.45, 0.45]}>
          <boxGeometry args={[0.03, 0.28, 0.03]} />
          <meshStandardMaterial color="#c9d1dc" metalness={0.9} roughness={0.25} />
        </mesh>
        {/* magnet notes: tiny colored planes on the front face */}
        {[
          { c: "#ffd94a", p: [-0.28, 1.55, 0.406] as const, r: 0.1 },
          { c: "#ff8fb3", p: [0.18, 1.62, 0.406] as const, r: -0.15 },
          { c: "#7fe7ff", p: [0.02, 1.1, 0.406] as const, r: 0.22 },
          { c: "#9dff8a", p: [-0.15, 0.75, 0.406] as const, r: -0.08 },
          { c: "#ffb84d", p: [0.3, 0.62, 0.406] as const, r: 0.3 },
        ].map((m, i) => (
          <mesh key={i} position={[m.p[0], m.p[1], m.p[2]]} rotation={[0, 0, m.r]}>
            <planeGeometry args={[0.09, 0.09]} />
            <meshStandardMaterial color={m.c} roughness={0.8} side={2} />
          </mesh>
        ))}
        {/* soft cool-white glow leaking from the door seam */}
        <mesh position={[0, 0.95, 0.42]}>
          <planeGeometry args={[0.06, 1.7]} />
          <meshBasicMaterial
            color="#eaf6ff"
            transparent
            opacity={0.12}
            depthWrite={false}
          />
        </mesh>
      </group>

      {/* ---------- Counter with cabinets ---------- */}
      <group position={[3.9, 0, 3.0]}>
        {/* base cabinet */}
        <mesh position={[0, 0.425, 0]}>
          <boxGeometry args={[1.4, 0.85, 0.7]} />
          <meshStandardMaterial color="#164e52" roughness={0.7} />
        </mesh>
        {/* 3 cabinet door lines on the front face (z = +0.35) */}
        {[-0.46, 0, 0.46].map((x, i) => (
          <mesh key={i} position={[x, 0.42, 0.352]}>
            <boxGeometry args={[0.012, 0.78, 0.004]} />
            <meshStandardMaterial color="#0b2628" roughness={0.7} />
          </mesh>
        ))}
        {/* 2 small drawer handles */}
        {[-0.23, 0.23].map((x, i) => (
          <mesh key={i} position={[x, 0.72, 0.38]}>
            <boxGeometry args={[0.14, 0.025, 0.03]} />
            <meshStandardMaterial color="#c9d1dc" metalness={0.9} roughness={0.3} />
          </mesh>
        ))}
        {/* countertop — keep surface clear for ViralMeals (food at y≈0.94) */}
        <mesh position={[0, 0.88, 0]}>
          <boxGeometry args={[1.5, 0.06, 0.78]} />
          <meshStandardMaterial color="#d6dbe2" roughness={0.4} />
        </mesh>
      </group>
    </group>
  );
}

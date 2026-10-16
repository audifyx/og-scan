import type { GroupProps } from '@react-three/fiber';

/**
 * RockBandMic — a microphone stand for the office/music corner.
 * Place at approx (x=5.0, z=-1.2), near the guitars.
 * Mic head sits at about y=1.55.
 */
export function RockBandMic(props: GroupProps) {
  return (
    <group position={[5.0, 0, -1.2]} {...props}>
      {/* Weighted round base on the floor */}
      <mesh position={[0, 0.025, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.18, 0.2, 0.05, 32]} />
        <meshStandardMaterial color="#232326" metalness={0.85} roughness={0.35} />
      </mesh>

      {/* Stand pole with slight tilt (rotation z ~0.08) */}
      <group position={[0, 0.05, 0]} rotation={[0, 0, 0.08]}>
        <mesh position={[0, 0.675, 0]} castShadow>
          <cylinderGeometry args={[0.022, 0.022, 1.35, 16]} />
          <meshStandardMaterial color="#3a3a40" metalness={0.9} roughness={0.3} />
        </mesh>

        {/* Boom arm angled from the top of the pole */}
        {/* Pole top ≈ (0.108, 1.396) after the 0.08 tilt */}
        <group position={[0.108, 1.346, 0]} rotation={[0, 0, -1.1]}>
          <mesh position={[0, 0.125, 0]} castShadow>
            <cylinderGeometry args={[0.015, 0.015, 0.25, 12]} />
            <meshStandardMaterial color="#3a3a40" metalness={0.9} roughness={0.3} />
          </mesh>

          {/* Mic clip */}
          <mesh position={[0, 0.24, 0]} castShadow>
            <cylinderGeometry args={[0.035, 0.035, 0.04, 12]} />
            <meshStandardMaterial color="#17171a" metalness={0.4} roughness={0.6} />
          </mesh>

          {/* Subtle emissive ring where the mic meets the clip */}
          <mesh position={[0, 0.262, 0]}>
            <cylinderGeometry args={[0.037, 0.037, 0.015, 24]} />
            <meshStandardMaterial
              color="#0a0a0c"
              emissive="#5aa2ff"
              emissiveIntensity={0.9}
              metalness={0.6}
              roughness={0.4}
            />
          </mesh>

          {/* Mic capsule body — dark metallic */}
          <mesh position={[0, 0.36, 0]} castShadow>
            <cylinderGeometry args={[0.05, 0.05, 0.18, 20]} />
            <meshStandardMaterial color="#1c1c20" metalness={0.95} roughness={0.25} />
          </mesh>

          {/* Mic sphere head — dark metallic wrap */}
          <mesh position={[0, 0.48, 0]} castShadow>
            <sphereGeometry args={[0.07, 24, 18]} />
            <meshStandardMaterial color="#26262b" metalness={0.9} roughness={0.35} />
          </mesh>
        </group>
      </group>
    </group>
  );
}

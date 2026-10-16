import { useMemo } from "react";

import * as THREE from "three";

/**
 * ArcadeRug — a neon gaming rug placed under the arcade cabinets
 * (cabinets sit at x=3.0 and x=4.2, z=-3.6; rug centered at x=3.6, z=-2.9).
 *
 * Layers (bottom → top):
 *  - dark purple round rug base
 *  - magenta neon outer ring
 *  - cyan neon inner ring
 *  - slightly lighter purple center emblem disc
 */
export function ArcadeRug(): React.JSX.Element {
  const rugGeometry = useMemo(() => new THREE.CircleGeometry(1.4, 64), []);
  const outerRingGeometry = useMemo(
    () => new THREE.RingGeometry(1.15, 1.3, 64),
    []
  );
  const innerRingGeometry = useMemo(
    () => new THREE.RingGeometry(0.5, 0.56, 64),
    []
  );
  const emblemGeometry = useMemo(() => new THREE.CircleGeometry(0.3, 48), []);

  return (
    <group position={[3.6, 0.015, -2.9]} rotation-x={-Math.PI / 2}>
      {/* Rug base */}
      <mesh geometry={rugGeometry} receiveShadow>
        <meshStandardMaterial color="#2a1a4a" roughness={0.95} metalness={0} />
      </mesh>

      {/* Neon outer ring */}
      <mesh geometry={outerRingGeometry} position={[0, 0, 0.005]}>
        <meshStandardMaterial
          color="#ec4899"
          emissive="#ec4899"
          emissiveIntensity={0.6}
          roughness={0.4}
          metalness={0}
        />
      </mesh>

      {/* Neon inner ring */}
      <mesh geometry={innerRingGeometry} position={[0, 0, 0.005]}>
        <meshStandardMaterial
          color="#22d3ee"
          emissive="#22d3ee"
          emissiveIntensity={0.6}
          roughness={0.4}
          metalness={0}
        />
      </mesh>

      {/* Center emblem */}
      <mesh geometry={emblemGeometry} position={[0, 0, 0.006]}>
        <meshStandardMaterial color="#4a2a7a" roughness={0.9} metalness={0} />
      </mesh>
    </group>
  );
}

export default ArcadeRug;

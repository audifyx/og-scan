import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { Text } from "@react-three/drei";
import { mulberry32 } from "@/lib/orbitxcity/collision";

const CENTER = { x: -42, z: -42 };
const TREE_COUNT = 42;

/** City Park — grassy clearing with tall pine-like trees and a quiet pond. */
export function Park() {
  const { trunks, canopies } = useMemo(() => {
    const rand = mulberry32(0x9a7c);
    const spots: Array<{ x: number; z: number; s: number }> = [];
    for (let i = 0; i < TREE_COUNT; i++) {
      const a = rand() * Math.PI * 2;
      const r = 4.2 + rand() * 9.2;
      const x = CENTER.x + Math.cos(a) * r;
      const z = CENTER.z + Math.sin(a) * r * 0.92;
      spots.push({ x, z, s: 0.85 + rand() * 1.15 });
    }

    const trunkGeo = new THREE.CylinderGeometry(0.12, 0.22, 2.4, 7);
    const trunkMat = new THREE.MeshStandardMaterial({ color: "#3a2c22", roughness: 0.95, metalness: 0.02 });
    const trunksMesh = new THREE.InstancedMesh(trunkGeo, trunkMat, spots.length);

    // Layered cones read as evergreen / pine silhouettes in fog
    const canopyGeo = new THREE.ConeGeometry(1.15, 2.6, 7);
    const canopyMat = new THREE.MeshStandardMaterial({
      color: "#2f4a32",
      roughness: 0.92,
      metalness: 0,
      flatShading: true,
    });
    const canopiesMesh = new THREE.InstancedMesh(canopyGeo, canopyMat, spots.length * 2);

    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    spots.forEach(({ x, z, s }, i) => {
      m.compose(new THREE.Vector3(x, 1.2 * s, z), q, new THREE.Vector3(s, s, s));
      trunksMesh.setMatrixAt(i, m);

      m.compose(
        new THREE.Vector3(x, 2.5 * s + 0.4, z),
        q.setFromEuler(new THREE.Euler(0, i * 1.3, 0)),
        new THREE.Vector3(s * 1.05, s * 1.2, s * 1.05),
      );
      canopiesMesh.setMatrixAt(i * 2, m);

      m.compose(
        new THREE.Vector3(x, 3.6 * s + 0.2, z),
        q.setFromEuler(new THREE.Euler(0, i * 0.7, 0)),
        new THREE.Vector3(s * 0.72, s * 0.95, s * 0.72),
      );
      canopiesMesh.setMatrixAt(i * 2 + 1, m);
    });
    trunksMesh.instanceMatrix.needsUpdate = true;
    canopiesMesh.instanceMatrix.needsUpdate = true;
    trunksMesh.castShadow = true;
    canopiesMesh.castShadow = true;
    trunksMesh.receiveShadow = true;
    canopiesMesh.receiveShadow = true;
    return { trunks: trunksMesh, canopies: canopiesMesh };
  }, []);

  const pond = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!pond.current) return;
    const mat = pond.current.material as THREE.MeshStandardMaterial;
    mat.roughness = 0.18 + Math.sin(clock.elapsedTime * 0.5) * 0.04;
  });

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[CENTER.x, 0.04, CENTER.z]} receiveShadow>
        <circleGeometry args={[14.2, 48]} />
        <meshStandardMaterial color="#3f5c3a" roughness={0.97} metalness={0} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[CENTER.x + 1.2, 0.05, CENTER.z - 0.8]} receiveShadow>
        <circleGeometry args={[6.5, 32]} />
        <meshStandardMaterial color="#4a6a44" roughness={0.98} metalness={0} />
      </mesh>

      <mesh ref={pond} rotation={[-Math.PI / 2, 0, 0]} position={[CENTER.x, 0.07, CENTER.z]} receiveShadow>
        <circleGeometry args={[4.2, 40]} />
        <meshStandardMaterial color="#3a5560" metalness={0.45} roughness={0.2} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[CENTER.x, 0.08, CENTER.z]}>
        <ringGeometry args={[4.2, 4.55, 40]} />
        <meshStandardMaterial color="#5a6468" roughness={0.85} metalness={0.1} />
      </mesh>

      <primitive object={trunks} />
      <primitive object={canopies} />

      {[0, 1.2, 2.4, 3.7, 4.9].map((a) => {
        const bx = CENTER.x + Math.cos(a) * 6.5;
        const bz = CENTER.z + Math.sin(a) * 6.5;
        return (
          <group key={a} position={[bx, 0, bz]} rotation-y={-a + Math.PI / 2}>
            <mesh position={[0, 0.42, 0]} castShadow receiveShadow>
              <boxGeometry args={[1.7, 0.09, 0.5]} />
              <meshStandardMaterial color="#4a433a" metalness={0.15} roughness={0.8} />
            </mesh>
            {[-0.7, 0.7].map((lx) => (
              <mesh key={lx} position={[lx, 0.2, 0]} castShadow>
                <boxGeometry args={[0.09, 0.4, 0.45]} />
                <meshStandardMaterial color="#2e2a24" metalness={0.2} roughness={0.75} />
              </mesh>
            ))}
          </group>
        );
      })}

      <Text
        position={[CENTER.x, 4.6, CENTER.z + 2]}
        fontSize={0.7}
        color="#e6ebe8"
        anchorX="center"
        outlineWidth={0.04}
        outlineColor="#1a221c"
      >
        CITY PARK
      </Text>
    </group>
  );
}

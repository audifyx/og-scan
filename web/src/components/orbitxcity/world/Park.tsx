import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { Text } from "@react-three/drei";
import { mulberry32 } from "@/lib/orbitxcity/collision";

const CENTER = { x: -42, z: -42 };
const TREE_COUNT = 34;

/** City Park — instanced low-poly trees, glowing pond, benches. */
export function Park() {
  const { trunks, canopies } = useMemo(() => {
    const rand = mulberry32(0x9a7c);
    const spots: Array<{ x: number; z: number; s: number }> = [];
    for (let i = 0; i < TREE_COUNT; i++) {
      const a = rand() * Math.PI * 2;
      const r = 4.5 + rand() * 8.5;
      const x = CENTER.x + Math.cos(a) * r;
      const z = CENTER.z + Math.sin(a) * r * 0.9;
      spots.push({ x, z, s: 0.7 + rand() * 0.8 });
    }

    const trunkGeo = new THREE.CylinderGeometry(0.14, 0.2, 1.6, 6);
    const trunkMat = new THREE.MeshStandardMaterial({ color: "#3a2a1c", roughness: 0.9 });
    const trunksMesh = new THREE.InstancedMesh(trunkGeo, trunkMat, spots.length);

    const canopyGeo = new THREE.IcosahedronGeometry(1.1, 0);
    const canopyMat = new THREE.MeshStandardMaterial({
      color: "#0f3d24",
      emissive: "#17ff4d",
      emissiveIntensity: 0.08,
      roughness: 0.8,
      flatShading: true,
    });
    const canopiesMesh = new THREE.InstancedMesh(canopyGeo, canopyMat, spots.length);

    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    spots.forEach(({ x, z, s }, i) => {
      m.compose(new THREE.Vector3(x, 0.8 * s, z), q, new THREE.Vector3(s, s, s));
      trunksMesh.setMatrixAt(i, m);
      m.compose(
        new THREE.Vector3(x, 1.6 * s + 0.8 * s, z),
        q.setFromEuler(new THREE.Euler(0, i * 1.7, 0)),
        new THREE.Vector3(s * 1.2, s * 1.35, s * 1.2),
      );
      canopiesMesh.setMatrixAt(i, m);
    });
    trunksMesh.instanceMatrix.needsUpdate = true;
    canopiesMesh.instanceMatrix.needsUpdate = true;
    trunksMesh.castShadow = true;
    canopiesMesh.castShadow = true;
    return { trunks: trunksMesh, canopies: canopiesMesh };
  }, []);

  const pond = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!pond.current) return;
    const mat = pond.current.material as THREE.MeshStandardMaterial;
    mat.emissiveIntensity = 0.18 + Math.sin(clock.elapsedTime * 0.8) * 0.06;
  });

  return (
    <group>
      {/* Grass pad */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[CENTER.x, 0.04, CENTER.z]} receiveShadow>
        <circleGeometry args={[13.5, 36]} />
        <meshStandardMaterial color="#0c2417" roughness={0.9} />
      </mesh>

      {/* Pond */}
      <mesh ref={pond} rotation={[-Math.PI / 2, 0, 0]} position={[CENTER.x, 0.07, CENTER.z]}>
        <circleGeometry args={[4.4, 32]} />
        <meshStandardMaterial color="#07253a" emissive="#3de7ff" emissiveIntensity={0.18} metalness={0.7} roughness={0.15} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[CENTER.x, 0.085, CENTER.z]}>
        <ringGeometry args={[4.4, 4.7, 32]} />
        <meshBasicMaterial color="#3de7ff" transparent opacity={0.35} toneMapped={false} />
      </mesh>

      <primitive object={trunks} />
      <primitive object={canopies} />

      {/* Benches */}
      {[0, 1.2, 2.4, 3.7, 4.9].map((a) => {
        const bx = CENTER.x + Math.cos(a) * 6.4;
        const bz = CENTER.z + Math.sin(a) * 6.4;
        return (
          <group key={a} position={[bx, 0, bz]} rotation-y={-a + Math.PI / 2}>
            <mesh position={[0, 0.42, 0]} castShadow>
              <boxGeometry args={[1.7, 0.09, 0.5]} />
              <meshStandardMaterial color="#233046" metalness={0.4} roughness={0.6} />
            </mesh>
            {[-0.7, 0.7].map((lx) => (
              <mesh key={lx} position={[lx, 0.2, 0]}>
                <boxGeometry args={[0.09, 0.4, 0.45]} />
                <meshStandardMaterial color="#141c2c" metalness={0.5} roughness={0.5} />
              </mesh>
            ))}
          </group>
        );
      })}

      <Text
        position={[CENTER.x, 5.4, CENTER.z + 2]}
        fontSize={1}
        color="#17ff4d"
        anchorX="center"
        material-toneMapped={false}
        outlineWidth={0.06}
        outlineColor="#04140a"
      >
        CITY PARK
      </Text>
    </group>
  );
}

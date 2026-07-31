import { useEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Billboard, Text } from "@react-three/drei";
import * as THREE from "three";
import type { Vec3 } from "@/lib/orbitxcity/types";

const TIPS = [
  "Welcome to OrbitX City. I'm OXI, your guide.",
  "Walk through open doorways to enter venues.",
  "E opens tools and talks to vendors — it does not teleport.",
  "Billboards are LIVE — tap one to buy the token.",
  "Enter opens world chat. Say gm.",
  "Fast travel from the Map panel.",
  "Collect gold OBX shards on the streets.",
  "The Trading Floor streams the real screener.",
  "Launch Arena connects to the OrbitX Launchpad.",
];

/** OXI — holographic AI guide NPC near the active city spawn. */
export function OxiGuide({ spawn }: { spawn: Vec3 }) {
  const core = useRef<THREE.Mesh>(null);
  const ringA = useRef<THREE.Mesh>(null);
  const ringB = useRef<THREE.Mesh>(null);
  const [tip, setTip] = useState(0);
  // Offset so OXI stands just off the spawn pad, visible on load.
  const position: [number, number, number] = [spawn.x + 2.4, 0, spawn.z + 3.1];

  useEffect(() => {
    const id = setInterval(() => setTip((t) => (t + 1) % TIPS.length), 6000);
    return () => clearInterval(id);
  }, []);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (core.current) {
      core.current.position.y = 1.6 + Math.sin(t * 1.4) * 0.12;
      core.current.rotation.y = t * 0.8;
      const mat = core.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = 0.9 + Math.sin(t * 3) * 0.25;
    }
    if (ringA.current) {
      ringA.current.rotation.z = t * 1.1;
      ringA.current.position.y = 1.6 + Math.sin(t * 1.4) * 0.12;
    }
    if (ringB.current) {
      ringB.current.rotation.z = -t * 0.7;
      ringB.current.position.y = 1.6 + Math.sin(t * 1.4) * 0.12;
    }
  });

  return (
    <group position={position}>
      {/* Pedestal */}
      <mesh position={[0, 0.1, 0]}>
        <cylinderGeometry args={[0.65, 0.75, 0.2, 24]} />
        <meshStandardMaterial color="#0c1424" metalness={0.6} roughness={0.35} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.21, 0]}>
        <ringGeometry args={[0.5, 0.62, 32]} />
        <meshBasicMaterial color="#3de7ff" transparent opacity={0.6} toneMapped={false} />
      </mesh>

      {/* Holo core */}
      <mesh ref={core} position={[0, 1.6, 0]}>
        <icosahedronGeometry args={[0.34, 1]} />
        <meshStandardMaterial
          color="#0a2a33"
          emissive="#3de7ff"
          emissiveIntensity={0.9}
          metalness={0.4}
          roughness={0.25}
          transparent
          opacity={0.92}
        />
      </mesh>
      <mesh ref={ringA} position={[0, 1.6, 0]}>
        <torusGeometry args={[0.55, 0.025, 8, 40]} />
        <meshBasicMaterial color="#3de7ff" transparent opacity={0.7} toneMapped={false} />
      </mesh>
      <mesh ref={ringB} position={[0, 1.6, 0]} rotation-x={Math.PI / 2.6}>
        <torusGeometry args={[0.72, 0.02, 8, 40]} />
        <meshBasicMaterial color="#17ff4d" transparent opacity={0.45} toneMapped={false} />
      </mesh>

      {/* Name + rotating tips */}
      <Billboard position={[0, 2.6, 0]}>
        <Text fontSize={0.3} color="#3de7ff" anchorX="center" material-toneMapped={false} outlineWidth={0.04} outlineColor="#03131a">
          OXI · AI GUIDE
        </Text>
      </Billboard>
      <Billboard position={[0, 3.1, 0]}>
        <Text fontSize={0.24} color="#e8f1ff" anchorX="center" maxWidth={4.4} outlineWidth={0.04} outlineColor="#04070f" textAlign="center">
          {TIPS[tip]}
        </Text>
      </Billboard>
    </group>
  );
}

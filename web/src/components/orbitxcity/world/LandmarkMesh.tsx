/**
 * City landmark — OrbitX hero GLB when available; otherwise a skyline beacon.
 */
import { Suspense } from "react";
import { Text } from "@react-three/drei";
import type { LandmarkDefinition } from "@/lib/orbitxcity/types";
import { resolveModelPath } from "@/lib/orbitxcity/assets/catalog";
import { GltfProp } from "./GltfProp";

function LandmarkPlaceholder({ landmark }: { landmark: LandmarkDefinition }) {
  const { width, height, depth } = landmark.size;
  const accent = "#00ff9f";
  const gold = "#c5a26f";
  const coreW = Math.max(1.2, width * 0.28);
  const coreD = Math.max(1.2, depth * 0.28);

  return (
    <group position={[landmark.position.x, 0, landmark.position.z]} rotation={[0, landmark.rotationY ?? 0, 0]}>
      {/* Podium */}
      <mesh position={[0, 0.25, 0]} castShadow receiveShadow>
        <boxGeometry args={[width * 0.85, 0.5, depth * 0.85]} />
        <meshStandardMaterial color="#1a2028" metalness={0.35} roughness={0.55} />
      </mesh>
      <mesh position={[0, 0.55, 0]} castShadow>
        <boxGeometry args={[width * 0.62, 0.18, depth * 0.62]} />
        <meshStandardMaterial color={gold} metalness={0.55} roughness={0.35} emissive={gold} emissiveIntensity={0.15} />
      </mesh>

      {/* Tower core */}
      <mesh position={[0, height * 0.42, 0]} castShadow>
        <boxGeometry args={[coreW, height * 0.78, coreD]} />
        <meshStandardMaterial color="#141a22" metalness={0.5} roughness={0.38} />
      </mesh>

      {/* Glass faces */}
      <mesh position={[0, height * 0.45, coreD / 2 + 0.04]}>
        <planeGeometry args={[coreW * 0.85, height * 0.55]} />
        <meshStandardMaterial
          color="#0a1218"
          emissive={accent}
          emissiveIntensity={0.35}
          transparent
          opacity={0.9}
          toneMapped={false}
        />
      </mesh>

      {/* Mid ring */}
      <mesh position={[0, height * 0.55, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[Math.max(coreW, coreD) * 0.72, 0.08, 8, 36]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.75} toneMapped={false} />
      </mesh>

      {/* Crown screen — offset from tower face */}
      <mesh position={[0, height * 0.82, coreD * 0.35]} castShadow>
        <boxGeometry args={[width * 0.95, height * 0.22, 0.14]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.55} toneMapped={false} />
      </mesh>

      {/* Antenna / beacon */}
      <mesh position={[0, height + 0.15, 0]} castShadow>
        <cylinderGeometry args={[0.08, 0.14, height * 0.18, 8]} />
        <meshStandardMaterial color="#2a323c" metalness={0.6} roughness={0.3} />
      </mesh>
      <mesh position={[0, height + height * 0.12, 0]}>
        <sphereGeometry args={[0.32, 14, 12]} />
        <meshStandardMaterial color={gold} emissive={gold} emissiveIntensity={0.85} toneMapped={false} />
      </mesh>
      <pointLight position={[0, height + 0.4, 0]} intensity={1.1} distance={18} color={accent} />

      {landmark.label && (
        <Text
          position={[0, height + height * 0.22, 0]}
          fontSize={0.38}
          color="#e8eef2"
          anchorX="center"
          outlineWidth={0.02}
          outlineColor="#05080c"
        >
          {landmark.label}
        </Text>
      )}
    </group>
  );
}

export function LandmarkMesh({ landmark }: { landmark: LandmarkDefinition }) {
  const path = resolveModelPath(landmark.modelId);
  if (!path) return <LandmarkPlaceholder landmark={landmark} />;

  return (
    <Suspense fallback={<LandmarkPlaceholder landmark={landmark} />}>
      <group position={[landmark.position.x, 0, landmark.position.z]} rotation={[0, landmark.rotationY ?? 0, 0]}>
        <GltfProp path={path} fitTo={landmark.size} position={[0, 0, 0]} />
        {landmark.label && (
          <Text
            position={[0, landmark.size.height + 1.2, 0]}
            fontSize={0.35}
            color="#e8eef2"
            anchorX="center"
            outlineWidth={0.02}
            outlineColor="#05080c"
          >
            {landmark.label}
          </Text>
        )}
      </group>
    </Suspense>
  );
}

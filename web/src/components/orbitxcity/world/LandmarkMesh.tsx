/**
 * City landmark — renders OrbitX hero GLB when available; otherwise a procedural beacon placeholder.
 */
import { Suspense } from "react";
import { Text } from "@react-three/drei";
import type { LandmarkDefinition } from "@/lib/orbitxcity/types";
import { resolveModelPath } from "@/lib/orbitxcity/assets/catalog";
import { GltfProp } from "./GltfProp";

function LandmarkPlaceholder({ landmark }: { landmark: LandmarkDefinition }) {
  const { width, height, depth } = landmark.size;
  return (
    <group position={[landmark.position.x, 0, landmark.position.z]} rotation={[0, landmark.rotationY ?? 0, 0]}>
      <mesh position={[0, height / 2, 0]} castShadow>
        <boxGeometry args={[width * 0.35, height, depth * 0.35]} />
        <meshStandardMaterial color="#1a222c" metalness={0.45} roughness={0.4} />
      </mesh>
      <mesh position={[0, height * 0.72, depth * 0.2]}>
        <boxGeometry args={[width * 0.9, height * 0.45, 0.12]} />
        <meshStandardMaterial color="#00ff9f" emissive="#00ff9f" emissiveIntensity={0.55} toneMapped={false} />
      </mesh>
      <mesh position={[0, height + 0.4, 0]}>
        <sphereGeometry args={[0.35, 12, 12]} />
        <meshStandardMaterial color="#c5a26f" emissive="#c5a26f" emissiveIntensity={0.7} toneMapped={false} />
      </mesh>
      {landmark.label && (
        <Text
          position={[0, height + 1.1, 0]}
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
  );
}

export function LandmarkMesh({ landmark }: { landmark: LandmarkDefinition }) {
  const path = resolveModelPath(landmark.modelId);
  if (!path) return <LandmarkPlaceholder landmark={landmark} />;

  return (
    <Suspense fallback={<LandmarkPlaceholder landmark={landmark} />}>
      <group position={[landmark.position.x, 0, landmark.position.z]} rotation={[0, landmark.rotationY ?? 0, 0]}>
        <GltfProp
          path={path}
          fitTo={landmark.size}
          position={[0, 0, 0]}
        />
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

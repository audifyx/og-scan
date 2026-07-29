/**
 * City-themed procedural props — palms, neon signs, lab pylons, stage lights, parked cars.
 * Rules from assets/catalog CITY_PROP_RULES.
 */
import { useMemo } from "react";
import { Clone, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { collidesAt, hashSeed, mulberry32 } from "@/lib/orbitxcity/collision";
import { CITY_STREET_MODELS, getPropRules, type PropKind } from "@/lib/orbitxcity/assets/catalog";
import { getWorldTheme } from "@/lib/orbitxcity/assets/worldThemes";
import type { WorldBlockConfig } from "@/lib/orbitxcity/types";
import { getWorldStreets } from "@/lib/orbitxcity/worlds";

useGLTF.preload(CITY_STREET_MODELS.carSedan);

function PalmTree({ x, z, accent }: { x: number; z: number; accent: string }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 1.6, 0]} castShadow>
        <cylinderGeometry args={[0.14, 0.2, 3.2, 8]} />
        <meshStandardMaterial color="#4a3528" roughness={0.85} />
      </mesh>
      {[0, 1, 2, 3, 4].map((i) => (
        <mesh
          key={i}
          position={[Math.cos(i * 1.25) * 0.5, 3.1, Math.sin(i * 1.25) * 0.5]}
          rotation={[0.4, i * 1.25, 0.2]}
          castShadow
        >
          <boxGeometry args={[0.12, 1.4, 0.35]} />
          <meshStandardMaterial color="#2d6a4a" roughness={0.7} />
        </mesh>
      ))}
      <mesh position={[0, 3.05, 0]}>
        <sphereGeometry args={[0.08, 8, 8]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.35} toneMapped={false} />
      </mesh>
    </group>
  );
}

function NeonSign({ x, z, accent, label }: { x: number; z: number; accent: string; label: string }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 2.8, 0]} castShadow>
        <boxGeometry args={[0.08, 5.2, 0.08]} />
        <meshStandardMaterial color="#2a3038" metalness={0.5} roughness={0.45} />
      </mesh>
      <mesh position={[0, 4.2, 0.12]}>
        <boxGeometry args={[2.4, 0.55, 0.12]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.85} toneMapped={false} />
      </mesh>
      <mesh position={[0, 3.5, 0.12]}>
        <boxGeometry args={[1.8, 0.35, 0.1]} />
        <meshStandardMaterial color="#00ff9f" emissive="#00ff9f" emissiveIntensity={0.55} toneMapped={false} />
      </mesh>
      {/* Simple readable block — full Text would need drei in every instance */}
      <mesh position={[0, 4.2, 0.2]}>
        <planeGeometry args={[2.2, 0.4]} />
        <meshBasicMaterial color="#061018" transparent opacity={0.85} />
      </mesh>
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[0.6, 12]} />
        <meshStandardMaterial color="#3a4048" roughness={0.9} />
      </mesh>
      {/* label stored for a11y via userData */}
      <group userData={{ label }} />
    </group>
  );
}

function LabPylon({ x, z, accent }: { x: number; z: number; accent: string }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 1.5, 0]} castShadow>
        <cylinderGeometry args={[0.25, 0.35, 3, 6]} />
        <meshStandardMaterial color="#1a2430" metalness={0.55} roughness={0.4} />
      </mesh>
      <mesh position={[0, 3.2, 0]}>
        <octahedronGeometry args={[0.35, 0]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.7} toneMapped={false} wireframe />
      </mesh>
      <mesh position={[0, 2.2, 0]}>
        <torusGeometry args={[0.45, 0.04, 8, 16]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.45} toneMapped={false} />
      </mesh>
    </group>
  );
}

function StageLight({ x, z, accent, rot }: { x: number; z: number; accent: string; rot: number }) {
  return (
    <group position={[x, 0, z]} rotation={[0, rot, 0]}>
      <mesh position={[0, 0.4, 0]} castShadow>
        <cylinderGeometry args={[0.35, 0.45, 0.8, 8]} />
        <meshStandardMaterial color="#1a1824" metalness={0.4} roughness={0.55} />
      </mesh>
      <mesh position={[0, 1.1, 0]} rotation={[0.35, 0, 0]}>
        <cylinderGeometry args={[0.12, 0.18, 1.2, 8]} />
        <meshStandardMaterial color="#242030" metalness={0.45} roughness={0.5} />
      </mesh>
      <mesh position={[0, 1.65, 0.35]} rotation={[0.5, 0, 0]}>
        <coneGeometry args={[0.35, 0.5, 8, 1, true]} />
        <meshStandardMaterial
          color={accent}
          emissive={accent}
          emissiveIntensity={0.6}
          transparent
          opacity={0.35}
          side={THREE.DoubleSide}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

function ParkedCars({ spots }: { spots: Array<[number, number, number]> }) {
  const { scene } = useGLTF(CITY_STREET_MODELS.carSedan);
  return (
    <group>
      {spots.map(([x, z, rot], i) => (
        <Clone
          key={`car-${i}-${x}-${z}`}
          object={scene}
          position={[x, 0, z]}
          rotation={[0, rot, 0]}
          scale={1.1}
          castShadow
          receiveShadow
        />
      ))}
    </group>
  );
}

function Hydrant({ x, z, accent }: { x: number; z: number; accent: string }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.35, 0]} castShadow>
        <cylinderGeometry args={[0.18, 0.22, 0.7, 8]} />
        <meshStandardMaterial color="#8b1e1e" metalness={0.4} roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.75, 0]}>
        <sphereGeometry args={[0.16, 10, 10]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.25} />
      </mesh>
      <mesh position={[0.22, 0.55, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.05, 0.05, 0.28, 6]} />
        <meshStandardMaterial color="#6a1515" metalness={0.45} roughness={0.45} />
      </mesh>
    </group>
  );
}

function NewsKiosk({ x, z, accent }: { x: number; z: number; accent: string }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.9, 0]} castShadow>
        <boxGeometry args={[1.1, 1.8, 0.7]} />
        <meshStandardMaterial color="#1a222c" metalness={0.3} roughness={0.55} />
      </mesh>
      <mesh position={[0, 1.4, 0.37]}>
        <planeGeometry args={[0.9, 0.55]} />
        <meshStandardMaterial color="#061018" emissive={accent} emissiveIntensity={0.4} />
      </mesh>
      <mesh position={[0, 1.95, 0]}>
        <boxGeometry args={[1.2, 0.08, 0.8]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.5} toneMapped={false} />
      </mesh>
    </group>
  );
}

function NeonBlade({ x, z, accent, rot = 0 }: { x: number; z: number; accent: string; rot?: number }) {
  return (
    <group position={[x, 0, z]} rotation={[0, rot, 0]}>
      <mesh position={[0, 2.2, 0]} castShadow>
        <boxGeometry args={[0.12, 4.2, 0.55]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.85} toneMapped={false} />
      </mesh>
      <mesh position={[0, 2.2, 0.08]}>
        <boxGeometry args={[0.06, 3.6, 0.35]} />
        <meshStandardMaterial color="#00ff9f" emissive="#00ff9f" emissiveIntensity={0.65} toneMapped={false} />
      </mesh>
    </group>
  );
}

function LifeguardTower({ x, z, accent }: { x: number; z: number; accent: string }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[-0.45, 1.2, -0.45]} castShadow>
        <boxGeometry args={[0.12, 2.4, 0.12]} />
        <meshStandardMaterial color="#c5a26f" />
      </mesh>
      <mesh position={[0.45, 1.2, -0.45]} castShadow>
        <boxGeometry args={[0.12, 2.4, 0.12]} />
        <meshStandardMaterial color="#c5a26f" />
      </mesh>
      <mesh position={[-0.45, 1.2, 0.45]} castShadow>
        <boxGeometry args={[0.12, 2.4, 0.12]} />
        <meshStandardMaterial color="#c5a26f" />
      </mesh>
      <mesh position={[0.45, 1.2, 0.45]} castShadow>
        <boxGeometry args={[0.12, 2.4, 0.12]} />
        <meshStandardMaterial color="#c5a26f" />
      </mesh>
      <mesh position={[0, 2.6, 0]} castShadow>
        <boxGeometry args={[1.4, 0.9, 1.2]} />
        <meshStandardMaterial color="#f0e6d2" roughness={0.7} />
      </mesh>
      <mesh position={[0, 3.2, 0]}>
        <coneGeometry args={[1.0, 0.55, 4]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.35} />
      </mesh>
    </group>
  );
}

function StageTruss({ x, z, accent, rot = 0 }: { x: number; z: number; accent: string; rot?: number }) {
  return (
    <group position={[x, 0, z]} rotation={[0, rot, 0]}>
      <mesh position={[0, 2.5, 0]} castShadow>
        <boxGeometry args={[2.8, 0.12, 0.12]} />
        <meshStandardMaterial color="#2a2a32" metalness={0.6} roughness={0.35} />
      </mesh>
      <mesh position={[-1.3, 1.25, 0]} castShadow>
        <boxGeometry args={[0.1, 2.5, 0.1]} />
        <meshStandardMaterial color="#2a2a32" metalness={0.55} roughness={0.4} />
      </mesh>
      <mesh position={[1.3, 1.25, 0]} castShadow>
        <boxGeometry args={[0.1, 2.5, 0.1]} />
        <meshStandardMaterial color="#2a2a32" metalness={0.55} roughness={0.4} />
      </mesh>
      {[-0.8, 0, 0.8].map((ox) => (
        <mesh key={ox} position={[ox, 2.35, 0.2]} rotation={[0.4, 0, 0]}>
          <cylinderGeometry args={[0.08, 0.12, 0.35, 8]} />
          <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.7} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

function AntennaArray({ x, z, accent }: { x: number; z: number; accent: string }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 1.8, 0]} castShadow>
        <cylinderGeometry args={[0.08, 0.12, 3.6, 8]} />
        <meshStandardMaterial color="#1a2430" metalness={0.55} roughness={0.4} />
      </mesh>
      <mesh position={[0, 3.5, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.03, 0.03, 1.4, 6]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.5} toneMapped={false} />
      </mesh>
      <mesh position={[0, 3.8, 0]}>
        <octahedronGeometry args={[0.2, 0]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.65} toneMapped={false} />
      </mesh>
    </group>
  );
}

function PalmCluster({ x, z, accent }: { x: number; z: number; accent: string }) {
  return (
    <group position={[x, 0, z]}>
      <PalmTree x={-0.6} z={0.3} accent={accent} />
      <PalmTree x={0.55} z={-0.2} accent={accent} />
      <PalmTree x={0.1} z={0.7} accent={accent} />
    </group>
  );
}

function PropMesh({
  kind,
  x,
  z,
  accent,
  rot = 0,
}: {
  kind: PropKind;
  x: number;
  z: number;
  accent: string;
  rot?: number;
}) {
  switch (kind) {
    case "palm":
      return <PalmTree x={x} z={z} accent={accent} />;
    case "palm-cluster":
      return <PalmCluster x={x} z={z} accent={accent} />;
    case "neon-sign":
      return <NeonSign x={x} z={z} accent={accent} label="ORBITX" />;
    case "neon-blade":
      return <NeonBlade x={x} z={z} accent={accent} rot={rot} />;
    case "hydrant":
      return <Hydrant x={x} z={z} accent={accent} />;
    case "news-kiosk":
      return <NewsKiosk x={x} z={z} accent={accent} />;
    case "lab-pylon":
      return <LabPylon x={x} z={z} accent={accent} />;
    case "antenna":
      return <AntennaArray x={x} z={z} accent={accent} />;
    case "stage-light":
      return <StageLight x={x} z={z} accent={accent} rot={rot} />;
    case "stage-truss":
      return <StageTruss x={x} z={z} accent={accent} rot={rot} />;
    case "lifeguard":
      return <LifeguardTower x={x} z={z} accent={accent} />;
    default:
      return null;
  }
}

export function PropScatter({ block }: { block: WorldBlockConfig }) {
  const theme = getWorldTheme(block.cityId);
  const rules = getPropRules(block.cityId);
  const streets = getWorldStreets(block.cityId);

  const { props, carSpots } = useMemo(() => {
    const propList: Array<{ kind: PropKind; x: number; z: number; rot?: number }> = [];
    const cars: Array<[number, number, number]> = [];
    const seed = hashSeed(`props-${block.cityId}`);

    for (const rule of rules) {
      const r = mulberry32(seed ^ rule.kind.length);
      for (const s of streets) {
        const step = Math.max(10, Math.floor(18 / (rule.density + 0.05)));
        for (let t = s.from + 8; t <= s.to - 6; t += step) {
          if (r() > rule.density + 0.15) continue;
          const off = s.w / 2 + 2.5 + r() * 2;
          const positions: [number, number][] =
            s.o === "h"
              ? [
                  [t, s.at + off],
                  [t + step * 0.4, s.at - off],
                ]
              : [
                  [s.at + off, t],
                  [s.at - off, t + step * 0.4],
                ];
          for (const [x, z] of positions) {
            if (collidesAt(x, z, 0.6, block)) continue;
            if (rule.kind === "parked-car") {
              cars.push([x, z, r() * Math.PI * 2]);
            } else {
              propList.push({ kind: rule.kind, x, z, rot: r() * Math.PI * 2 });
            }
          }
        }
      }
    }
    return { props: propList.slice(0, 48), carSpots: cars.slice(0, 12) };
  }, [block, rules, streets]);

  return (
    <group>
      {props.map((p, i) => (
        <PropMesh key={`${p.kind}-${i}`} kind={p.kind} x={p.x} z={p.z} accent={theme.primary} rot={p.rot} />
      ))}
      {carSpots.length > 0 && <ParkedCars spots={carSpots} />}
    </group>
  );
}

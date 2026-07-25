import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Text, Billboard } from "@react-three/drei";
import * as THREE from "three";
import type { BuildingDefinition } from "@/lib/orbitxcity/types";
import { hashSeed, mulberry32 } from "@/lib/orbitxcity/collision";
import { createFacadeTexture } from "@/lib/orbitxcity/textures";

const ROOF_MAT = new THREE.MeshStandardMaterial({ color: "#0a0e16", metalness: 0.5, roughness: 0.6 });

interface Tier {
  w: number;
  h: number;
  d: number;
  yBase: number;
  ground: boolean;
}

function buildTiers(b: BuildingDefinition, rand: () => number): Tier[] {
  const { width: w, height: h, depth: d } = b.size;
  if (h < 10) return [{ w, h, d, yBase: 0, ground: true }];
  if (h < 15) {
    const h0 = h * (0.55 + rand() * 0.1);
    return [
      { w, h: h0, d, yBase: 0, ground: true },
      { w: w * 0.74, h: h - h0, d: d * 0.74, yBase: h0, ground: false },
    ];
  }
  const h0 = h * 0.45;
  const h1 = h * 0.32;
  return [
    { w, h: h0, d, yBase: 0, ground: true },
    { w: w * 0.8, h: h1, d: d * 0.8, yBase: h0, ground: false },
    { w: w * 0.58, h: h - h0 - h1, d: d * 0.58, yBase: h0 + h1, ground: false },
  ];
}

function BlinkingBeacon({ height, accent }: { height: number; accent: string }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const mat = ref.current.material as THREE.MeshBasicMaterial;
    mat.opacity = 0.35 + Math.abs(Math.sin(clock.elapsedTime * 2.6)) * 0.65;
  });
  return (
    <group position={[0, height, 0]}>
      <mesh position={[0, 0.7, 0]}>
        <cylinderGeometry args={[0.03, 0.05, 1.4, 6]} />
        <meshStandardMaterial color="#1a2232" metalness={0.7} roughness={0.35} />
      </mesh>
      <mesh ref={ref} position={[0, 1.5, 0]}>
        <sphereGeometry args={[0.12, 10, 10]} />
        <meshBasicMaterial color={accent} transparent toneMapped={false} />
      </mesh>
    </group>
  );
}

function FacadeTier({
  tier,
  building,
  index,
}: {
  tier: Tier;
  building: BuildingDefinition;
  index: number;
}) {
  const materials = useMemo(() => {
    const tex = createFacadeTexture(
      hashSeed(`${building.id}-tier-${index}`),
      Math.max(tier.w, tier.d),
      tier.h,
      building.color,
      building.accent,
      tier.ground,
    );
    const side = new THREE.MeshStandardMaterial({
      map: tex,
      emissiveMap: tex,
      emissive: new THREE.Color("#ffffff"),
      emissiveIntensity: 0.75,
      metalness: 0.35,
      roughness: 0.55,
    });
    // Box material order: +x, -x, +y, -y, +z, -z
    return [side, side, ROOF_MAT, ROOF_MAT, side, side];
  }, [building.id, building.color, building.accent, tier.w, tier.d, tier.h, tier.ground, index]);

  return (
    <mesh position={[0, tier.yBase + tier.h / 2, 0]} castShadow receiveShadow material={materials}>
      <boxGeometry args={[tier.w, tier.h, tier.d]} />
    </mesh>
  );
}

export function BuildingMesh({ building }: { building: BuildingDefinition }) {
  const { position, size, accent, label, name } = building;
  const rand = useMemo(() => mulberry32(hashSeed(`bld-${building.id}`)), [building.id]);
  const tiers = useMemo(() => buildTiers(building, rand), [building, rand]);
  const top = tiers[tiers.length - 1];
  const roofY = top.yBase + top.h;

  const roofProps = useMemo(() => {
    const r = mulberry32(hashSeed(`roof-${building.id}`));
    return {
      tank: r() > 0.5,
      ac: r() > 0.35,
      tankX: (r() - 0.5) * top.w * 0.4,
      tankZ: (r() - 0.5) * top.d * 0.4,
      acX: (r() - 0.5) * top.w * 0.5,
      acZ: (r() - 0.5) * top.d * 0.5,
    };
  }, [building.id, top.w, top.d]);

  return (
    <group position={[position.x, 0, position.z]}>
      {tiers.map((t, i) => (
        <FacadeTier key={i} tier={t} building={building} index={i} />
      ))}

      {/* Accent crown on the top tier */}
      <mesh position={[0, roofY + 0.15, 0]}>
        <boxGeometry args={[top.w * 0.92, 0.3, top.d * 0.92]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.7} metalness={0.6} roughness={0.25} />
      </mesh>

      {/* Vertical neon corner tubes on the base tier */}
      {[
        [-size.width / 2, -size.depth / 2],
        [size.width / 2, -size.depth / 2],
        [-size.width / 2, size.depth / 2],
        [size.width / 2, size.depth / 2],
      ].map(([cx, cz], i) => (
        <mesh key={`tube-${i}`} position={[cx, tiers[0].h / 2, cz]}>
          <boxGeometry args={[0.09, tiers[0].h, 0.09]} />
          <meshBasicMaterial color={accent} transparent opacity={0.85} toneMapped={false} />
        </mesh>
      ))}

      {/* Entrance glow */}
      <mesh position={[0, 1.1, size.depth / 2 + 0.06]}>
        <planeGeometry args={[1.3, 2.1]} />
        <meshBasicMaterial color={accent} transparent opacity={0.4} toneMapped={false} />
      </mesh>

      {/* Rooftop clutter */}
      {roofProps.tank && (
        <mesh position={[roofProps.tankX, roofY + 0.8, roofProps.tankZ]} castShadow>
          <cylinderGeometry args={[0.6, 0.7, 1.6, 10]} />
          <meshStandardMaterial color="#131a28" metalness={0.55} roughness={0.5} />
        </mesh>
      )}
      {roofProps.ac && (
        <mesh position={[roofProps.acX, roofY + 0.35, roofProps.acZ]} castShadow>
          <boxGeometry args={[1.1, 0.7, 0.9]} />
          <meshStandardMaterial color="#1a2334" metalness={0.5} roughness={0.55} />
        </mesh>
      )}
      {size.height >= 8 && <BlinkingBeacon height={roofY} accent={accent} />}

      <Billboard position={[0, roofY + 1.6, 0]}>
        <Text
          fontSize={0.55}
          color={accent}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.03}
          outlineColor="#000000"
          maxWidth={8}
          material-toneMapped={false}
        >
          {label ?? name}
        </Text>
      </Billboard>
    </group>
  );
}

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Text, Billboard, Clone, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import type { BuildingDefinition } from "@/lib/orbitxcity/types";
import { hashSeed, mulberry32 } from "@/lib/orbitxcity/collision";
import { createFacadeTexture } from "@/lib/orbitxcity/textures";
import { useCity } from "@/pages/orbitxcity/CityProvider";

const ROOF_MAT = new THREE.MeshStandardMaterial({ color: "#4a5158", metalness: 0.22, roughness: 0.78 });
const CITY_MODEL_PATHS = [
  "/orbitxcity/models/citybits/building_A.gltf",
  "/orbitxcity/models/citybits/building_B.gltf",
  "/orbitxcity/models/citybits/building_C.gltf",
  "/orbitxcity/models/citybits/building_D.gltf",
] as const;

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
        <meshBasicMaterial color={accent} transparent opacity={0.55} toneMapped={false} />
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
      emissiveIntensity: 0.12,
      metalness: 0.18,
      roughness: 0.78,
    });
    return [side, side, ROOF_MAT, ROOF_MAT, side, side];
  }, [building.id, building.color, building.accent, tier.w, tier.d, tier.h, tier.ground, index]);

  return (
    <mesh position={[0, tier.yBase + tier.h / 2, 0]} castShadow receiveShadow material={materials}>
      <boxGeometry args={[tier.w, tier.h, tier.d]} />
    </mesh>
  );
}

/** Extrude a real OSM footprint into a textured midtown massing. */
function FootprintShell({ building }: { building: BuildingDefinition }) {
  const footprint = building.footprint!;
  const height = building.size.height;

  const geometry = useMemo(() => {
    const shape = new THREE.Shape();
    footprint.forEach((p, i) => {
      if (i === 0) shape.moveTo(p.x, p.z);
      else shape.lineTo(p.x, p.z);
    });
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: height,
      bevelEnabled: false,
      curveSegments: 1,
      steps: 1,
    });
    geo.rotateX(-Math.PI / 2);
    geo.computeVertexNormals();
    return geo;
  }, [footprint, height]);

  const material = useMemo(() => {
    const tex = createFacadeTexture(
      hashSeed(`${building.id}-footprint`),
      Math.max(building.size.width, building.size.depth),
      height,
      building.color,
      building.accent,
      true,
    );
    return new THREE.MeshStandardMaterial({
      map: tex,
      emissiveMap: tex,
      emissive: new THREE.Color("#ffffff"),
      emissiveIntensity: 0.14,
      metalness: 0.22,
      roughness: 0.72,
    });
  }, [building.id, building.color, building.accent, building.size.width, building.size.depth, height]);

  return (
    <>
      <mesh geometry={geometry} material={material} castShadow receiveShadow />
      <mesh position={[0, height + 0.08, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <shapeGeometry
          args={[
            (() => {
              const s = new THREE.Shape();
              footprint.forEach((p, i) => {
                if (i === 0) s.moveTo(p.x, p.z);
                else s.lineTo(p.x, p.z);
              });
              s.closePath();
              return s;
            })(),
          ]}
        />
        <meshStandardMaterial color="#4e555c" metalness={0.2} roughness={0.78} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, height + 0.14, 0]}>
        <boxGeometry args={[Math.max(1.2, building.size.width * 0.18), 0.12, Math.max(1.2, building.size.depth * 0.18)]} />
        <meshStandardMaterial
          color={building.accent}
          emissive={building.accent}
          emissiveIntensity={0.18}
          metalness={0.35}
          roughness={0.5}
        />
      </mesh>
    </>
  );
}

export function BuildingMesh({ building }: { building: BuildingDefinition }) {
  const { enterBuilding, quality } = useCity();
  const { position, size, accent, label, name } = building;
  const rand = useMemo(() => mulberry32(hashSeed(`bld-${building.id}`)), [building.id]);
  const modelPath = CITY_MODEL_PATHS[hashSeed(building.id) % CITY_MODEL_PATHS.length]!;
  const { scene } = useGLTF(modelPath);
  const hasFootprint = Boolean(building.footprint && building.footprint.length >= 3);
  const useAssetShell = !hasFootprint && quality === "high";
  const tiers = useMemo(() => buildTiers(building, rand), [building, rand]);
  const top = tiers[tiers.length - 1]!;
  const roofY = hasFootprint ? size.height : top.yBase + top.h;
  const doorW = Math.min(2.2, size.width * 0.28);

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
      {hasFootprint ? (
        <FootprintShell building={building} />
      ) : useAssetShell ? (
        <Clone
          object={scene}
          scale={[size.width / 2, size.height / 1.65, size.depth / 2]}
          castShadow
          receiveShadow
        />
      ) : (
        <>
          {tiers.map((t, i) => (
            <FacadeTier key={i} tier={t} building={building} index={i} />
          ))}
          <mesh position={[0, roofY + 0.12, 0]} castShadow>
            <boxGeometry args={[top.w * 0.94, 0.28, top.d * 0.94]} />
            <meshStandardMaterial color="#5a6168" metalness={0.2} roughness={0.75} />
          </mesh>
          <mesh position={[0, roofY + 0.28, 0]}>
            <boxGeometry args={[top.w * 0.88, 0.08, top.d * 0.88]} />
            <meshStandardMaterial
              color={accent}
              emissive={accent}
              emissiveIntensity={0.08}
              metalness={0.35}
              roughness={0.55}
            />
          </mesh>
          {[
            [-size.width / 2, -size.depth / 2],
            [size.width / 2, -size.depth / 2],
            [-size.width / 2, size.depth / 2],
            [size.width / 2, size.depth / 2],
          ].map(([cx, cz], i) => (
            <mesh key={`trim-${i}`} position={[cx!, tiers[0]!.h / 2, cz!]} castShadow>
              <boxGeometry args={[0.12, tiers[0]!.h, 0.12]} />
              <meshStandardMaterial color="#4e555c" metalness={0.25} roughness={0.7} />
            </mesh>
          ))}
        </>
      )}

      {/* Ground-floor storefront glass + neon marquee so venues read as enterable shops */}
      <mesh position={[0, 1.55, size.depth / 2 + 0.02]} castShadow>
        <boxGeometry args={[Math.min(size.width * 0.92, size.width - 0.4), 3.0, 0.12]} />
        <meshStandardMaterial color="#12171d" metalness={0.35} roughness={0.45} />
      </mesh>
      <mesh position={[0, 1.55, size.depth / 2 + 0.09]}>
        <planeGeometry args={[Math.min(size.width * 0.85, size.width - 0.8), 2.55]} />
        <meshStandardMaterial
          color="#0a121c"
          emissive={accent}
          emissiveIntensity={building.interaction ? 0.16 : 0.05}
          metalness={0.2}
          roughness={0.35}
          transparent
          opacity={0.92}
        />
      </mesh>
      <mesh position={[0, 3.25, size.depth / 2 + 0.18]} castShadow>
        <boxGeometry args={[Math.min(size.width * 0.78, 6.5), 0.45, 0.28]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.55} toneMapped={false} />
      </mesh>
      <Text
        position={[0, 3.25, size.depth / 2 + 0.34]}
        fontSize={0.22}
        color="#061018"
        anchorX="center"
        anchorY="middle"
        maxWidth={Math.min(size.width * 0.7, 6)}
      >
        {(label ?? name).toUpperCase()}
      </Text>

      {/* Recessed entrance with awning + sidewalk apron */}
      <mesh position={[0, 1.05, size.depth / 2 + 0.12]} castShadow>
        <boxGeometry args={[doorW + 0.35, 2.4, 0.16]} />
        <meshStandardMaterial color="#1a1e22" metalness={0.3} roughness={0.55} />
      </mesh>
      <mesh
        position={[0, 1.05, size.depth / 2 + 0.2]}
        onClick={(e) => {
          e.stopPropagation();
          enterBuilding(building.id);
        }}
      >
        <planeGeometry args={[doorW, 2.05]} />
        <meshStandardMaterial color="#0c1014" emissive={accent} emissiveIntensity={0.18} metalness={0.15} roughness={0.45} />
      </mesh>
      <Text
        position={[0, 0.35, size.depth / 2 + 0.22]}
        fontSize={0.16}
        color={accent}
        anchorX="center"
        outlineWidth={0.01}
        outlineColor="#05080c"
        onClick={(e) => {
          e.stopPropagation();
          enterBuilding(building.id);
        }}
      >
        {building.interaction ? "CLICK · ENTER" : "ENTER"}
      </Text>
      <mesh position={[0, 2.35, size.depth / 2 + 0.38]} castShadow>
        <boxGeometry args={[doorW + 0.7, 0.12, 0.55]} />
        <meshStandardMaterial color="#3a4046" metalness={0.25} roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.02, size.depth / 2 + 1.1]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[doorW + 2.4, 2.2]} />
        <meshStandardMaterial color="#6a7178" roughness={0.92} metalness={0.05} />
      </mesh>

      {!hasFootprint && !useAssetShell && roofProps.tank && (
        <mesh position={[roofProps.tankX, roofY + 0.8, roofProps.tankZ]} castShadow>
          <cylinderGeometry args={[0.6, 0.7, 1.6, 10]} />
          <meshStandardMaterial color="#131a28" metalness={0.55} roughness={0.5} />
        </mesh>
      )}
      {!hasFootprint && !useAssetShell && roofProps.ac && (
        <mesh position={[roofProps.acX, roofY + 0.35, roofProps.acZ]} castShadow>
          <boxGeometry args={[1.1, 0.7, 0.9]} />
          <meshStandardMaterial color="#1a2334" metalness={0.5} roughness={0.55} />
        </mesh>
      )}
      {!hasFootprint && !useAssetShell && size.height >= 8 && <BlinkingBeacon height={roofY} accent={accent} />}

      <Billboard position={[0, roofY + 1.5, 0]}>
        <Text
          fontSize={0.42}
          color="#e8eef2"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.025}
          outlineColor="#12161a"
          maxWidth={8}
        >
          {label ?? name}
        </Text>
      </Billboard>
    </group>
  );
}

CITY_MODEL_PATHS.forEach((path) => useGLTF.preload(path));

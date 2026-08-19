/**
 * Modular building massing — stacked boxes/cylinders, neon strips, roof props, enterable doors.
 * Prefer procedural shells (AI-buildable) over GLTF; OSM footprints still extrude when present.
 */
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Text, Billboard } from "@react-three/drei";
import * as THREE from "three";
import type { BuildingDefinition } from "@/lib/orbitxcity/types";
import { hashSeed, mulberry32, isWalkInBuilding, buildingDoorWidth } from "@/lib/orbitxcity/collision";
import { createFacadeTexture } from "@/lib/orbitxcity/textures";
import { getBuildingKit, gltfPathForBuilding } from "@/lib/orbitxcity/assets/buildingKits";
import { GltfProp } from "./GltfProp";
import { useCity } from "@/pages/orbitxcity/CityProvider";

const ROOF_MAT = new THREE.MeshStandardMaterial({ color: "#3e464e", metalness: 0.28, roughness: 0.72 });

/** Manhattan-inspired facade family from massing + venue role. */
export type FacadeFamily = "brick" | "limestone" | "glass" | "retail";

export function facadeFamily(b: BuildingDefinition): FacadeFamily {
  const { height, width } = b.size;
  if (b.interaction || b.kind === "shop") return "retail";
  if (height >= 20) return "glass";
  if (height >= 11 && width >= 9) return "limestone";
  return "brick";
}

const FAMILY_TRIM: Record<FacadeFamily, string> = {
  brick: "#6a4a3a",
  limestone: "#b9b2a0",
  glass: "#3a4652",
  retail: "#2a3038",
};

const FAMILY_WALL: Record<FacadeFamily, string> = {
  brick: "#8a5344",
  limestone: "#d4c8b0",
  glass: "#2a3848",
  retail: "#4a4440",
};

const KIND_SIGN: Partial<Record<BuildingDefinition["kind"] | NonNullable<BuildingDefinition["interaction"]>, string>> = {
  hq: "ORBITX",
  trading_floor: "DEX",
  trading: "DEX",
  launch_arena: "PUMP",
  launch: "PUMP",
  market: "SOL",
  marketplace: "SOL",
  social_hub: "COMMUNITY",
  community: "COMMUNITY",
  shop: "GAMES",
  games: "GAMES",
  ad_tower: "ADS",
};

function buildingSign(b: BuildingDefinition): string {
  return (
    KIND_SIGN[b.kind] ??
    (b.interaction ? KIND_SIGN[b.interaction] : undefined) ??
    (b.label ?? b.name).slice(0, 10).toUpperCase()
  );
}

function Cornice({ w, d, y, color }: { w: number; d: number; y: number; color: string }) {
  return (
    <group position={[0, y, 0]}>
      <mesh castShadow>
        <boxGeometry args={[w + 0.5, 0.5, d + 0.5]} />
        <meshStandardMaterial color={color} metalness={0.14} roughness={0.82} />
      </mesh>
      <mesh position={[0, -0.36, 0]}>
        <boxGeometry args={[w + 0.24, 0.26, d + 0.24]} />
        <meshStandardMaterial color={color} metalness={0.1} roughness={0.86} />
      </mesh>
    </group>
  );
}

function Awning({ w, z, accent }: { w: number; z: number; accent: string }) {
  return (
    <group position={[0, 2.8, z + 0.55]}>
      <mesh rotation={[-0.34, 0, 0]} castShadow>
        <boxGeometry args={[w, 0.08, 1.15]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.16} metalness={0.2} roughness={0.6} />
      </mesh>
      <mesh position={[0, -0.24, 0.04]}>
        <boxGeometry args={[w, 0.22, 0.05]} />
        <meshStandardMaterial color="#0a1016" emissive={accent} emissiveIntensity={0.3} toneMapped={false} />
      </mesh>
    </group>
  );
}

function RoofCrown({ y, radius, accent }: { y: number; radius: number; accent: string }) {
  return (
    <mesh position={[0, y + 0.55, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <torusGeometry args={[Math.max(1, radius), 0.12, 8, 40]} />
      <meshStandardMaterial
        color={accent}
        emissive={accent}
        emissiveIntensity={0.9}
        toneMapped={false}
        metalness={0.4}
        roughness={0.3}
      />
    </mesh>
  );
}

interface Tier {
  w: number;
  h: number;
  d: number;
  yBase: number;
  ground: boolean;
}

function buildTiers(b: BuildingDefinition, rand: () => number): Tier[] {
  const { width: w, height: h, depth: d } = b.size;
  if (h < 8) return [{ w, h, d, yBase: 0, ground: true }];
  if (h < 14) {
    const h0 = h * (0.52 + rand() * 0.12);
    return [
      { w, h: h0, d, yBase: 0, ground: true },
      { w: w * (0.7 + rand() * 0.08), h: h - h0, d: d * (0.7 + rand() * 0.08), yBase: h0, ground: false },
    ];
  }
  if (h < 22) {
    const h0 = h * 0.42;
    const h1 = h * 0.3;
    return [
      { w, h: h0, d, yBase: 0, ground: true },
      { w: w * 0.82, h: h1, d: d * 0.82, yBase: h0, ground: false },
      { w: w * 0.58, h: h - h0 - h1, d: d * 0.58, yBase: h0 + h1, ground: false },
    ];
  }
  const h0 = h * 0.36;
  const h1 = h * 0.26;
  const h2 = h * 0.22;
  return [
    { w, h: h0, d, yBase: 0, ground: true },
    { w: w * 0.86, h: h1, d: d * 0.86, yBase: h0, ground: false },
    { w: w * 0.68, h: h2, d: d * 0.68, yBase: h0 + h1, ground: false },
    { w: w * 0.48, h: h - h0 - h1 - h2, d: d * 0.48, yBase: h0 + h1 + h2, ground: false },
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

function NeonWindowStrips({
  w,
  h,
  d,
  yBase,
  accent,
  seed,
}: {
  w: number;
  h: number;
  d: number;
  yBase: number;
  accent: string;
  seed: number;
}) {
  const strips = useMemo(() => {
    const r = mulberry32(seed);
    const rows = Math.max(2, Math.floor(h / 1.9));
    const out: Array<{ x: number; y: number; z: number; ww: number; side: 0 | 1 | 2 | 3 }> = [];
    for (let row = 0; row < rows; row++) {
      const y = yBase + 1.1 + row * (h / (rows + 0.4));
      if (y > yBase + h - 0.6) continue;
      for (const side of [0, 1, 2, 3] as const) {
        if (r() > 0.58) continue;
        const ww = Math.min(w, d) * (0.28 + r() * 0.42);
        out.push({ x: 0, y, z: 0, ww, side });
      }
    }
    return out;
  }, [w, h, d, yBase, seed]);

  return (
    <group>
      {strips.map((s, i) => {
        const isZ = s.side < 2;
        const sign = s.side % 2 === 0 ? 1 : -1;
        const pos: [number, number, number] = isZ
          ? [0, s.y, sign * (d / 2 + 0.04)]
          : [sign * (w / 2 + 0.04), s.y, 0];
        const args: [number, number] = isZ ? [s.ww, 0.28] : [0.28, s.ww];
        return (
          <mesh key={i} position={pos} rotation={isZ ? [0, 0, 0] : [0, Math.PI / 2, 0]}>
            <planeGeometry args={args} />
            <meshStandardMaterial
              color="#0a1018"
              emissive={accent}
              emissiveIntensity={0.55 + (i % 3) * 0.12}
              toneMapped={false}
              transparent
              opacity={0.92}
              side={THREE.DoubleSide}
            />
          </mesh>
        );
      })}
    </group>
  );
}

function WallGraffiti({
  w,
  d,
  accent,
  seed,
}: {
  w: number;
  d: number;
  accent: string;
  seed: number;
}) {
  const tags = useMemo(() => {
    const r = mulberry32(seed ^ 0x91a);
    const n = 1 + Math.floor(r() * 2);
    return Array.from({ length: n }, (_, i) => ({
      side: Math.floor(r() * 4) as 0 | 1 | 2 | 3,
      y: 1.2 + r() * 1.4,
      off: (r() - 0.5) * 0.4,
      width: 1.1 + r() * 1.6,
      height: 0.55 + r() * 0.55,
      hue: i % 2 === 0 ? accent : "#ff4d6a",
    }));
  }, [seed, accent]);

  return (
    <group>
      {tags.map((t, i) => {
        const isZ = t.side < 2;
        const sign = t.side % 2 === 0 ? 1 : -1;
        const pos: [number, number, number] = isZ
          ? [t.off * w, t.y, sign * (d / 2 + 0.05)]
          : [sign * (w / 2 + 0.05), t.y, t.off * d];
        return (
          <mesh key={i} position={pos} rotation={isZ ? [0, 0, 0] : [0, Math.PI / 2, 0]}>
            <planeGeometry args={[t.width, t.height]} />
            <meshStandardMaterial
              color={t.hue}
              emissive={t.hue}
              emissiveIntensity={0.22}
              transparent
              opacity={0.78}
              side={THREE.DoubleSide}
              roughness={0.85}
            />
          </mesh>
        );
      })}
    </group>
  );
}

function RoofProps({
  roofY,
  topW,
  topD,
  accent,
  seed,
  showBeacon,
}: {
  roofY: number;
  topW: number;
  topD: number;
  accent: string;
  seed: number;
  showBeacon: boolean;
}) {
  const props = useMemo(() => {
    const r = mulberry32(seed);
    return {
      tank: r() > 0.28,
      tank2: r() > 0.62,
      ac: r() > 0.22,
      ac2: r() > 0.55,
      vent: r() > 0.4,
      tankX: (r() - 0.5) * topW * 0.35,
      tankZ: (r() - 0.5) * topD * 0.35,
      tank2X: (r() - 0.5) * topW * 0.4,
      tank2Z: (r() - 0.5) * topD * 0.4,
      acX: (r() - 0.5) * topW * 0.45,
      acZ: (r() - 0.5) * topD * 0.45,
      ac2X: (r() - 0.5) * topW * 0.4,
      ac2Z: (r() - 0.5) * topD * 0.4,
      ventX: (r() - 0.5) * topW * 0.3,
      ventZ: (r() - 0.5) * topD * 0.3,
    };
  }, [seed, topW, topD]);

  return (
    <group>
      <mesh position={[0, roofY + 0.14, 0]} castShadow>
        <boxGeometry args={[topW * 0.94, 0.28, topD * 0.94]} />
        <meshStandardMaterial color="#4a5158" metalness={0.25} roughness={0.72} />
      </mesh>
      <mesh position={[0, roofY + 0.32, 0]}>
        <boxGeometry args={[topW * 0.88, 0.08, topD * 0.88]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.12} metalness={0.4} roughness={0.5} />
      </mesh>
      {props.tank && (
        <mesh position={[props.tankX, roofY + 0.95, props.tankZ]} castShadow>
          <cylinderGeometry args={[0.55, 0.65, 1.5, 10]} />
          <meshStandardMaterial color="#1a2330" metalness={0.6} roughness={0.42} />
        </mesh>
      )}
      {props.tank2 && (
        <mesh position={[props.tank2X, roofY + 0.75, props.tank2Z]} castShadow>
          <cylinderGeometry args={[0.35, 0.4, 1.1, 8]} />
          <meshStandardMaterial color="#222b38" metalness={0.55} roughness={0.48} />
        </mesh>
      )}
      {props.ac && (
        <mesh position={[props.acX, roofY + 0.42, props.acZ]} castShadow>
          <boxGeometry args={[1.15, 0.72, 0.95]} />
          <meshStandardMaterial color="#1c2534" metalness={0.5} roughness={0.55} />
        </mesh>
      )}
      {props.ac2 && (
        <mesh position={[props.ac2X, roofY + 0.38, props.ac2Z]} castShadow>
          <boxGeometry args={[0.85, 0.55, 0.7]} />
          <meshStandardMaterial color="#243040" metalness={0.45} roughness={0.58} />
        </mesh>
      )}
      {props.vent && (
        <mesh position={[props.ventX, roofY + 0.55, props.ventZ]} castShadow>
          <cylinderGeometry args={[0.18, 0.22, 0.7, 8]} />
          <meshStandardMaterial color="#2a3340" metalness={0.5} roughness={0.5} />
        </mesh>
      )}
      {showBeacon && <BlinkingBeacon height={roofY} accent={accent} />}
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
    const family = facadeFamily(building);
    const tex = createFacadeTexture(
      hashSeed(`${building.id}-tier-${index}`),
      Math.max(tier.w, tier.d),
      tier.h,
      FAMILY_WALL[family],
      building.accent,
      tier.ground,
    );
    const side = new THREE.MeshStandardMaterial({
      map: tex,
      emissiveMap: tex,
      emissive: new THREE.Color("#ffffff"),
      emissiveIntensity: family === "glass" ? 0.48 : 0.32,
      metalness: family === "glass" ? 0.45 : 0.18,
      roughness: family === "glass" ? 0.35 : 0.78,
    });
    return [side, side, ROOF_MAT, ROOF_MAT, side, side];
  }, [building, tier.w, tier.d, tier.h, tier.ground, index]);

  return (
    <group>
      <mesh position={[0, tier.yBase + tier.h / 2, 0]} castShadow receiveShadow material={materials}>
        <boxGeometry args={[tier.w, tier.h, tier.d]} />
      </mesh>
      <NeonWindowStrips
        w={tier.w}
        h={tier.h}
        d={tier.d}
        yBase={tier.yBase}
        accent={building.accent}
        seed={hashSeed(`${building.id}-neon-${index}`)}
      />
    </group>
  );
}

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
    const family = facadeFamily(building);
    const tex = createFacadeTexture(
      hashSeed(`${building.id}-footprint`),
      Math.max(building.size.width, building.size.depth),
      height,
      FAMILY_WALL[family],
      building.accent,
      true,
    );
    return new THREE.MeshStandardMaterial({
      map: tex,
      emissiveMap: tex,
      emissive: new THREE.Color("#ffffff"),
      emissiveIntensity: family === "glass" ? 0.48 : 0.32,
      metalness: family === "glass" ? 0.42 : 0.2,
      roughness: family === "glass" ? 0.38 : 0.72,
    });
  }, [building, height]);

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
        <meshStandardMaterial color="#4e555c" metalness={0.22} roughness={0.76} side={THREE.DoubleSide} />
      </mesh>
      <NeonWindowStrips
        w={building.size.width}
        h={height}
        d={building.size.depth}
        yBase={0}
        accent={building.accent}
        seed={hashSeed(`${building.id}-fp-neon`)}
      />
    </>
  );
}

export function BuildingMesh({ building }: { building: BuildingDefinition }) {
  const { openVenue, quality } = useCity();
  const { position, size, accent, label, name } = building;
  const rand = useMemo(() => mulberry32(hashSeed(`bld-${building.id}`)), [building.id]);
  const kit = useMemo(() => getBuildingKit(building.kind), [building.kind]);
  const modelPath = useMemo(() => gltfPathForBuilding(building.id, building.kind), [building.id, building.kind]);
  const hasFootprint = Boolean(building.footprint && building.footprint.length >= 3);
  // Prefer OrbitX custom shell when available; else Kenney hash sample on high quality.
  const useAssetShell = !hasFootprint && quality === "high" && Boolean(modelPath) && kit.isOrbitx;
  const marqueeIntensity = kit.marqueeIntensity;
  const tiers = useMemo(() => buildTiers(building, rand), [building, rand]);
  const top = tiers[tiers.length - 1]!;
  const roofY = hasFootprint ? size.height : top.yBase + top.h;
  const walkIn = isWalkInBuilding(building);
  const doorW = buildingDoorWidth(building);
  const isHq = building.kind === "hq" || building.interaction === "hq";
  const family = facadeFamily(building);
  const showCornice = quality === "high" && (family === "brick" || family === "limestone");

  return (
    <group position={[position.x, 0, position.z]}>
      {hasFootprint ? (
        <FootprintShell building={building} />
      ) : useAssetShell && modelPath ? (
        <GltfProp
          path={modelPath}
          scale={[size.width / 2, size.height / 1.65, size.depth / 2]}
          castShadow
          receiveShadow
        />
      ) : (
        <>
          {tiers.map((t, i) => (
            <FacadeTier key={i} tier={t} building={building} index={i} />
          ))}
          {[
            [-size.width / 2, -size.depth / 2],
            [size.width / 2, -size.depth / 2],
            [-size.width / 2, size.depth / 2],
            [size.width / 2, size.depth / 2],
          ].map(([cx, cz], i) => (
            <mesh key={`trim-${i}`} position={[cx!, tiers[0]!.h / 2, cz!]} castShadow>
              <boxGeometry args={[0.14, tiers[0]!.h, 0.14]} />
              <meshStandardMaterial color="#4e555c" metalness={0.28} roughness={0.68} />
            </mesh>
          ))}
        </>
      )}

      <RoofProps
        roofY={roofY}
        topW={hasFootprint ? size.width * 0.35 : top.w}
        topD={hasFootprint ? size.depth * 0.35 : top.d}
        accent={accent}
        seed={hashSeed(`roof-${building.id}`)}
        showBeacon={size.height >= 8 && kit.beacon}
      />

      <WallGraffiti
        w={size.width}
        d={size.depth}
        accent={accent}
        seed={hashSeed(`graf-${building.id}`)}
      />

      {showCornice && <Cornice w={hasFootprint ? size.width * 0.92 : top.w} d={hasFootprint ? size.depth * 0.92 : top.d} y={roofY} color={FAMILY_TRIM[family]} />}

      {/* Generic fill: solid base band only — no fake doors on every OSM box */}
      {!walkIn && (
        <mesh position={[0, 1.35, size.depth / 2 + 0.02]} castShadow>
          <boxGeometry args={[Math.min(size.width * 0.96, size.width - 0.2), 2.7, 0.1]} />
          <meshStandardMaterial color={FAMILY_TRIM[family]} metalness={0.22} roughness={0.72} />
        </mesh>
      )}

      {!walkIn && size.height >= 6 && (
        <mesh position={[0, Math.min(size.height * 0.42, 5.2), size.depth / 2 + 0.12]} castShadow>
          <boxGeometry args={[Math.min(size.width * 0.72, 5.6), 0.55, 0.16]} />
          <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.7} toneMapped={false} />
        </mesh>
      )}
      {!walkIn && size.height >= 6 && (
        <Text
          position={[0, Math.min(size.height * 0.42, 5.2), size.depth / 2 + 0.24]}
          fontSize={0.22}
          color="#061018"
          anchorX="center"
          anchorY="middle"
          maxWidth={Math.min(size.width * 0.68, 5.2)}
        >
          {buildingSign(building)}
        </Text>
      )}

      {walkIn && (
        <>
          <Awning w={Math.min(doorW + 1.6, size.width - 0.6)} z={size.depth / 2} accent={accent} />
          <RoofCrown y={roofY} radius={Math.min(size.width, size.depth) * 0.32} accent={accent} />

          {/* Storefront split around open doorway */}
          {([-1, 1] as const).map((s) => {
            const totalW = Math.min(size.width * 0.92, size.width - 0.4);
            const glassW = Math.min(size.width * 0.85, size.width - 0.8);
            const openW = doorW + 0.9;
            const segFrame = Math.max(0, (totalW - openW) / 2);
            const segGlass = Math.max(0, (glassW - openW) / 2);
            const cx = s * (openW / 2 + segFrame / 2);
            if (segFrame <= 0.05) return null;
            return (
              <group key={`store-${s}`}>
                <mesh position={[cx, 1.55, size.depth / 2 + 0.02]} castShadow>
                  <boxGeometry args={[segFrame, 3.0, 0.12]} />
                  <meshStandardMaterial color={FAMILY_WALL[family]} metalness={0.28} roughness={0.55} />
                </mesh>
                {segGlass > 0.05 && (
                  <mesh position={[cx, 1.55, size.depth / 2 + 0.09]}>
                    <planeGeometry args={[segGlass, 2.55]} />
                    <meshStandardMaterial
                      color="#0a121c"
                      emissive={accent}
                      emissiveIntensity={marqueeIntensity * 0.38}
                      metalness={0.2}
                      roughness={0.32}
                      transparent
                      opacity={0.92}
                    />
                  </mesh>
                )}
              </group>
            );
          })}

          {/* Marquee + blade sign */}
          <mesh position={[0, 3.35, size.depth / 2 + 0.2]} castShadow>
            <boxGeometry args={[Math.min(size.width * 0.78, isHq ? 7.4 : 6.5), isHq ? 0.68 : 0.48, 0.3]} />
            <meshStandardMaterial
              color={accent}
              emissive={accent}
              emissiveIntensity={isHq ? marqueeIntensity : marqueeIntensity * 0.72}
              toneMapped={false}
            />
          </mesh>
          <mesh position={[size.width / 2 + 0.12, 2.4, size.depth / 2 - 0.4]} castShadow>
            <boxGeometry args={[0.12, 1.8, 0.55]} />
            <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.7} toneMapped={false} />
          </mesh>
          <Text
            position={[0, 3.35, size.depth / 2 + 0.38]}
            fontSize={isHq ? 0.3 : 0.22}
            color="#061018"
            anchorX="center"
            anchorY="middle"
            maxWidth={Math.min(size.width * 0.7, 6)}
          >
            {isHq ? "ORBITX HQ" : (label ?? name).toUpperCase()}
          </Text>
          {isHq && (
            <Text position={[0, 2.92, size.depth / 2 + 0.38]} fontSize={0.14} color="#061018" anchorX="center" maxWidth={6}>
              DEX · LAUNCHPAD · SOCIAL
            </Text>
          )}

          {/* Open doorway — walk through to enter; E / click opens venue tools */}
          <mesh position={[-doorW / 2 - 0.12, 1.15, size.depth / 2 + 0.1]} castShadow>
            <boxGeometry args={[0.22, 2.5, 0.22]} />
            <meshStandardMaterial color="#1a1e22" metalness={0.3} roughness={0.55} />
          </mesh>
          <mesh position={[doorW / 2 + 0.12, 1.15, size.depth / 2 + 0.1]} castShadow>
            <boxGeometry args={[0.22, 2.5, 0.22]} />
            <meshStandardMaterial color="#1a1e22" metalness={0.3} roughness={0.55} />
          </mesh>
          <mesh position={[0, 2.4, size.depth / 2 + 0.12]} castShadow>
            <boxGeometry args={[doorW + 0.55, 0.18, 0.28]} />
            <meshStandardMaterial color="#2a3036" metalness={0.25} roughness={0.65} />
          </mesh>
          <mesh position={[0, 1.05, size.depth / 2 - 0.05]}>
            <planeGeometry args={[doorW * 0.92, 2.05]} />
            <meshStandardMaterial color="#080c10" transparent opacity={0.35} depthWrite={false} />
          </mesh>
          <Text
            position={[0, 2.82, size.depth / 2 + 0.42]}
            fontSize={0.2}
            color="#e8fff4"
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.018}
            outlineColor="#05080c"
            onClick={(e) => {
              e.stopPropagation();
              openVenue(building.id);
            }}
          >
            {`WALK IN · ${(label ?? name).toUpperCase()}`}
          </Text>
          <Text
            position={[0, 2.52, size.depth / 2 + 0.42]}
            fontSize={0.13}
            color={accent}
            anchorX="center"
            outlineWidth={0.012}
            outlineColor="#05080c"
          >
            Doorway open · E for tools
          </Text>
          <mesh position={[0, 0.02, size.depth / 2 + 1.15]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <planeGeometry args={[doorW + 2.6, 2.4]} />
            <meshStandardMaterial color="#6a7178" roughness={0.9} metalness={0.06} />
          </mesh>

          <Billboard position={[0, roofY + 1.7, 0]}>
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
        </>
      )}
    </group>
  );
}

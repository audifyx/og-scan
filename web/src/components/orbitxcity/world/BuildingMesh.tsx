/**
 * Modular building massing — stacked boxes/cylinders, neon strips, roof props, enterable doors.
 * Prefer procedural shells (AI-buildable) over GLTF; OSM footprints still extrude when present.
 */
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Text, Billboard, Clone, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import type { BuildingDefinition } from "@/lib/orbitxcity/types";
import { hashSeed, mulberry32, isWalkInBuilding, buildingDoorWidth } from "@/lib/orbitxcity/collision";
import { createFacadeTexture, createAdTexture } from "@/lib/orbitxcity/textures";
import { useCity } from "@/pages/orbitxcity/CityProvider";

/** Manhattan-inspired facade family, chosen from massing + venue role. */
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

const ROOF_MAT = new THREE.MeshStandardMaterial({ color: "#3e464e", metalness: 0.28, roughness: 0.72 });
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
    const rows = Math.max(2, Math.floor(h / 2.4));
    const out: Array<{ x: number; y: number; z: number; ww: number; side: 0 | 1 | 2 | 3 }> = [];
    for (let row = 0; row < rows; row++) {
      const y = yBase + 1.1 + row * (h / (rows + 0.4));
      if (y > yBase + h - 0.6) continue;
      for (const side of [0, 1, 2, 3] as const) {
        if (r() > 0.72) continue;
        const ww = Math.min(w, d) * (0.35 + r() * 0.35);
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
      emissiveIntensity: 0.16,
      metalness: 0.2,
      roughness: 0.74,
    });
    return [side, side, ROOF_MAT, ROOF_MAT, side, side];
  }, [building.id, building.color, building.accent, tier.w, tier.d, tier.h, tier.ground, index]);

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
      emissiveIntensity: 0.16,
      metalness: 0.24,
      roughness: 0.7,
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

/** Overhanging cornice band for brick / limestone prewar massing. */
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

/** Retail entrance awning over the storefront (street-level identity). */
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

/** Illuminated roof crown that marks OrbitX venue buildings from a distance. */
function RoofCrown({ y, radius, accent }: { y: number; radius: number; accent: string }) {
  return (
    <mesh position={[0, y + 0.55, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <torusGeometry args={[Math.max(1, radius), 0.12, 8, 40]} />
      <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.9} toneMapped={false} metalness={0.4} roughness={0.3} />
    </mesh>
  );
}

/** Local, procedurally-drawn poster panel (no remote assets) on the facade. */
function FacadePoster({
  w,
  z,
  y,
  seed,
  title,
  subtitle,
  accent,
}: {
  w: number;
  z: number;
  y: number;
  seed: number;
  title: string;
  subtitle: string;
  accent: string;
}) {
  const tex = useMemo(() => createAdTexture(title, subtitle, accent, seed), [title, subtitle, accent, seed]);
  const pw = Math.min(2.2, Math.max(1.2, w * 0.34));
  return (
    <group position={[w * 0.3, y, z + 0.06]}>
      <mesh>
        <planeGeometry args={[pw, pw * 0.62]} />
        <meshStandardMaterial
          map={tex}
          emissiveMap={tex}
          emissive="#ffffff"
          emissiveIntensity={0.24}
          toneMapped={false}
          roughness={0.62}
          metalness={0.1}
        />
      </mesh>
      {/* Thin frame */}
      <mesh position={[0, 0, -0.02]}>
        <planeGeometry args={[pw + 0.12, pw * 0.62 + 0.12]} />
        <meshStandardMaterial color="#0b0f14" metalness={0.3} roughness={0.6} />
      </mesh>
    </group>
  );
}

export function BuildingMesh({ building }: { building: BuildingDefinition }) {
  const { quality } = useCity();
  const { position, size, accent, label, name } = building;
  const rand = useMemo(() => mulberry32(hashSeed(`bld-${building.id}`)), [building.id]);
  const modelPath = CITY_MODEL_PATHS[hashSeed(building.id) % CITY_MODEL_PATHS.length]!;
  const { scene } = useGLTF(modelPath);
  const hasFootprint = Boolean(building.footprint && building.footprint.length >= 3);
  // Prefer modular procedural massing for game-like readability; GLTF only rare high-quality spice.
  const useAssetShell = !hasFootprint && quality === "high" && hashSeed(building.id) % 5 === 0;
  const tiers = useMemo(() => buildTiers(building, rand), [building, rand]);
  const top = tiers[tiers.length - 1]!;
  const roofY = hasFootprint ? size.height : top.yBase + top.h;
  // Door width matches the passable collision gap so the visible opening and the
  // walk-through threshold line up exactly.
  const walkIn = isWalkInBuilding(building);
  const doorW = buildingDoorWidth(building);
  const isHq = building.kind === "hq" || building.interaction === "hq";
  // Manhattan facade family + quality-gated ornament flags (capped so detail
  // never reintroduces lag on lite / lots of buildings).
  const family = facadeFamily(building);
  const showCornice = !hasFootprint && quality === "high" && (family === "brick" || family === "limestone");
  const showPoster = quality === "high" && !isHq && !hasFootprint && hashSeed(`poster-${building.id}`) % 3 === 0;

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
        showBeacon={size.height >= 8}
      />

      <WallGraffiti
        w={size.width}
        d={size.depth}
        accent={accent}
        seed={hashSeed(`graf-${building.id}`)}
      />

      {/* Manhattan facade ornament (family-aware, quality-gated) */}
      {showCornice && <Cornice w={top.w} d={top.d} y={roofY} color={FAMILY_TRIM[family]} />}
      {walkIn && (
        <>
          <Awning w={Math.min(doorW + 1.6, size.width - 0.6)} z={size.depth / 2} accent={accent} />
          <RoofCrown y={roofY} radius={Math.min(size.width, size.depth) * 0.32} accent={accent} />
        </>
      )}
      {showPoster && (
        <FacadePoster
          w={size.width}
          z={size.depth / 2}
          y={Math.min(roofY - 1.4, 5.2)}
          seed={hashSeed(`ad-${building.id}`)}
          title={(building.label ?? building.name).slice(0, 10).toUpperCase()}
          subtitle="ORBITX ADNET"
          accent={accent}
        />
      )}

      {/* Ground-floor storefront glazing — split around the doorway for walk-in
          venues so the opening stays clear, otherwise a full-width shopfront. */}
      {(() => {
        const totalW = Math.min(size.width * 0.92, size.width - 0.4);
        const glassW = Math.min(size.width * 0.85, size.width - 0.8);
        const openW = walkIn ? doorW + 0.9 : 0;
        const segFrame = walkIn ? Math.max(0, (totalW - openW) / 2) : totalW;
        const segGlass = walkIn ? Math.max(0, (glassW - openW) / 2) : glassW;
        const sides = walkIn ? [-1, 1] : [0];
        return sides.map((s) => {
          const cx = walkIn ? s * (openW / 2 + segFrame / 2) : 0;
          if (walkIn && segFrame <= 0.05) return null;
          return (
            <group key={`store-${s}`}>
              <mesh position={[cx, 1.55, size.depth / 2 + 0.02]} castShadow>
                <boxGeometry args={[segFrame, 3.0, 0.12]} />
                <meshStandardMaterial color="#12171d" metalness={0.35} roughness={0.45} />
              </mesh>
              {segGlass > 0.05 && (
                <mesh position={[cx, 1.55, size.depth / 2 + 0.09]}>
                  <planeGeometry args={[segGlass, 2.55]} />
                  <meshStandardMaterial
                    color="#0a121c"
                    emissive={accent}
                    emissiveIntensity={building.interaction ? 0.22 : 0.08}
                    metalness={0.2}
                    roughness={0.32}
                    transparent
                    opacity={0.92}
                  />
                </mesh>
              )}
            </group>
          );
        });
      })()}
      <mesh position={[0, 3.35, size.depth / 2 + 0.2]} castShadow>
        <boxGeometry
          args={[
            Math.min(size.width * 0.78, isHq ? 7.4 : 6.5),
            isHq ? 0.68 : 0.48,
            0.3,
          ]}
        />
        <meshStandardMaterial
          color={accent}
          emissive={accent}
          emissiveIntensity={isHq ? 0.85 : 0.62}
          toneMapped={false}
        />
      </mesh>
      {/* Side neon blade signs */}
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

      {/* Open, walk-through doorway (entry is by physically crossing it — never
          a click). The jambs/lintel frame a dark recess so the opening reads as
          a real hole in the facade that lines up with the collision gap. */}
      {walkIn ? (
        <group>
          {/* Left + right jambs flanking the opening */}
          {[-1, 1].map((s) => (
            <mesh key={`jamb-${s}`} position={[s * (doorW / 2 + 0.16), 1.2, size.depth / 2 + 0.12]} castShadow>
              <boxGeometry args={[0.32, 2.7, 0.34]} />
              <meshStandardMaterial color="#1a1e22" metalness={0.3} roughness={0.55} />
            </mesh>
          ))}
          {/* Lintel */}
          <mesh position={[0, 2.62, size.depth / 2 + 0.12]} castShadow>
            <boxGeometry args={[doorW + 0.64, 0.34, 0.34]} />
            <meshStandardMaterial color="#20252b" metalness={0.32} roughness={0.5} />
          </mesh>
          {/* Dark interior recess seen through the opening */}
          <mesh position={[0, 1.2, size.depth / 2 - 0.25]}>
            <planeGeometry args={[doorW, 2.4]} />
            <meshStandardMaterial color="#05070a" roughness={0.95} metalness={0} />
          </mesh>
          {/* Warm threshold glow so the entrance reads as "open" */}
          <mesh position={[0, 0.06, size.depth / 2 + 0.02]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[doorW, 1.4]} />
            <meshBasicMaterial color={accent} transparent opacity={0.28} toneMapped={false} />
          </mesh>
          <Text
            position={[0, 0.34, size.depth / 2 + 0.26]}
            fontSize={0.16}
            color={accent}
            anchorX="center"
            outlineWidth={0.01}
            outlineColor="#05080c"
          >
            OPEN · WALK IN
          </Text>
          {/* Entrance canopy */}
          <mesh position={[0, 2.9, size.depth / 2 + 0.5]} castShadow>
            <boxGeometry args={[doorW + 0.95, 0.14, 0.8]} />
            <meshStandardMaterial color="#3a4046" metalness={0.25} roughness={0.7} />
          </mesh>
          <mesh position={[0, 0.02, size.depth / 2 + 1.2]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <planeGeometry args={[doorW + 2.6, 2.6]} />
            <meshStandardMaterial color="#6a7178" roughness={0.9} metalness={0.06} />
          </mesh>
        </group>
      ) : (
        // Non-walk-in structures keep a plain closed storefront door.
        <mesh position={[0, 1.05, size.depth / 2 + 0.12]} castShadow>
          <boxGeometry args={[doorW + 0.4, 2.45, 0.16]} />
          <meshStandardMaterial color="#1a1e22" metalness={0.3} roughness={0.55} />
        </mesh>
      )}

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
    </group>
  );
}

CITY_MODEL_PATHS.forEach((path) => useGLTF.preload(path));

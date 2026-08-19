/**
 * Scenic city root — soft fog, neon accent lights, glass shards, HQ beacon plaza.
 */
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import * as THREE from "three";
import { NYC_DEMO_BLOCK } from "@/lib/orbitxcity/demoBlock";
import type { ScreenerRow } from "@/lib/orbitxcity/marketData";
import type { CityId, WorldBlockConfig } from "@/lib/orbitxcity/types";
import { getWorldTheme, getMarketScreenPlacements } from "@/lib/orbitxcity/assets/worldThemes";
import { useCity } from "@/pages/orbitxcity/CityProvider";
import { mulberry32, hashSeed } from "@/lib/orbitxcity/collision";
import { Ground } from "./Ground";
import { BuildingMesh } from "./BuildingMesh";
import { BillboardMesh } from "./BillboardMesh";
import { GraffitiLayer } from "./GraffitiLayer";
import { Skyline } from "./Skyline";
import { StreetProps } from "./StreetProps";
import { NPCs } from "./NPCs";
import { Drones } from "./Drones";
import { RocketShow } from "./RocketShow";
import { MegaScreen } from "./MegaScreen";
import { OxiGuide } from "./OxiGuide";
import { Park } from "./Park";
import { Traffic } from "./Traffic";
import { SkyCycle } from "./SkyCycle";
import { UrbanNature } from "./UrbanNature";
import { PropScatter } from "./PropScatter";
import { LandmarkMesh } from "./LandmarkMesh";
import { landmarkModelId } from "@/lib/orbitxcity/assets/catalog";
import type { LandmarkDefinition } from "@/lib/orbitxcity/types";

function cityTheme(cityId: CityId) {
  return getWorldTheme(cityId);
}

function marketScreensFor(cityId: CityId) {
  return getMarketScreenPlacements(cityId);
}

/** Floating translucent glass shards near plaza / HQ. */
function GlassShards({ origin, count }: { origin: { x: number; z: number }; count: number }) {
  const group = useRef<THREE.Group>(null);
  const shards = useMemo(() => {
    const r = mulberry32(hashSeed(`glass-${origin.x}-${origin.z}`));
    return Array.from({ length: count }, (_, i) => ({
      x: origin.x + (r() - 0.5) * 10,
      y: 1.2 + r() * 5.5,
      z: origin.z + (r() - 0.5) * 10,
      sx: 0.15 + r() * 0.45,
      sy: 0.02 + r() * 0.04,
      sz: 0.25 + r() * 0.55,
      rx: r() * Math.PI,
      ry: r() * Math.PI,
      rz: r() * Math.PI,
      speed: 0.15 + r() * 0.35,
      phase: r() * Math.PI * 2,
      tint: i % 3 === 0 ? "#00ff9f" : i % 3 === 1 ? "#c5a26f" : "#ff4d6a",
    }));
  }, [origin.x, origin.z, count]);

  useFrame(({ clock }) => {
    const g = group.current;
    if (!g) return;
    const t = clock.elapsedTime;
    g.children.forEach((child, i) => {
      const s = shards[i];
      if (!s) return;
      child.position.y = s.y + Math.sin(t * s.speed + s.phase) * 0.35;
      child.rotation.x = s.rx + t * 0.12;
      child.rotation.y = s.ry + t * 0.18;
    });
  });

  return (
    <group ref={group}>
      {shards.map((s, i) => (
        <mesh key={i} position={[s.x, s.y, s.z]} rotation={[s.rx, s.ry, s.rz]}>
          <boxGeometry args={[s.sx, s.sy, s.sz]} />
          <meshStandardMaterial
            color={s.tint}
            emissive={s.tint}
            emissiveIntensity={0.25}
            transparent
            opacity={0.28}
            metalness={0.7}
            roughness={0.15}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
    </group>
  );
}

function HqBeacon({ block }: { block: WorldBlockConfig }) {
  const ring = useRef<THREE.Mesh>(null);
  const hq = block.buildings.find((b) => b.kind === "hq") ?? block.buildings[0];
  const position = hq?.position ?? block.spawn;
  const height = (hq?.size.height ?? 14) + 3.2;

  useFrame(({ clock }) => {
    if (!ring.current) return;
    ring.current.rotation.y = clock.elapsedTime * 0.55;
    const mat = ring.current.material as THREE.MeshStandardMaterial;
    mat.emissiveIntensity = 0.55 + Math.sin(clock.elapsedTime * 2.2) * 0.35;
  });

  return (
    <group position={[position.x, 0, position.z]}>
      {/* Mast */}
      <mesh position={[0, height * 0.55, 0]} castShadow>
        <cylinderGeometry args={[0.14, 0.22, height * 1.1, 10]} />
        <meshStandardMaterial color="#2a3340" metalness={0.65} roughness={0.35} />
      </mesh>
      {/* Glowing ring */}
      <mesh ref={ring} position={[0, height, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.35, 0.06, 10, 48]} />
        <meshStandardMaterial
          color="#c5a26f"
          emissive="#c5a26f"
          emissiveIntensity={0.8}
          metalness={0.4}
          roughness={0.25}
          toneMapped={false}
        />
      </mesh>
      <mesh position={[0, height, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.65, 0.03, 8, 40]} />
        <meshStandardMaterial
          color="#3de7ff"
          emissive="#3de7ff"
          emissiveIntensity={0.7}
          toneMapped={false}
          transparent
          opacity={0.85}
        />
      </mesh>
      {/* Beacon core */}
      <mesh position={[0, height + 0.15, 0]}>
        <sphereGeometry args={[0.28, 16, 14]} />
        <meshStandardMaterial
          color="#e8eef2"
          emissive="#c5a26f"
          emissiveIntensity={0.9}
          metalness={0.2}
          roughness={0.25}
          toneMapped={false}
        />
      </mesh>
      <pointLight position={[0, height, 0]} intensity={1.4} color="#c5a26f" distance={22} />
      <Text
        position={[0, height + 1.35, 0]}
        fontSize={0.72}
        color="#e8eef2"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.04}
        outlineColor="#0a1018"
        letterSpacing={0.08}
      >
        ORBITX
      </Text>
      <Text
        position={[0, height + 0.75, 0]}
        fontSize={0.22}
        color="#c5a26f"
        anchorX="center"
        outlineWidth={0.01}
        outlineColor="#0a1018"
      >
        HQ BEACON
      </Text>
    </group>
  );
}

function CentralPlaza({ block }: { block: WorldBlockConfig }) {
  const spawn = block.spawn;
  const hq = block.buildings.find((b) => b.kind === "hq");
  const cx = hq ? (hq.position.x + spawn.x) / 2 : spawn.x;
  const cz = hq ? (hq.position.z + spawn.z) / 2 : spawn.z;

  return (
    <group>
      {/* Wide plaza disc */}
      <mesh position={[cx, 0.05, cz]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[5.2, 64]} />
        <meshStandardMaterial color="#3a424c" metalness={0.28} roughness={0.55} />
      </mesh>
      <mesh position={[cx, 0.07, cz]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[4.7, 5.2, 64]} />
        <meshStandardMaterial
          color="#c5a26f"
          emissive="#c5a26f"
          emissiveIntensity={0.35}
          metalness={0.4}
          roughness={0.4}
          toneMapped={false}
        />
      </mesh>
      <mesh position={[cx, 0.08, cz]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[2.4, 2.65, 48]} />
        <meshStandardMaterial color="#3de7ff" emissive="#3de7ff" emissiveIntensity={0.45} toneMapped={false} />
      </mesh>
      {/* Spawn pad */}
      <mesh position={[spawn.x, 0.09, spawn.z]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[2.2, 40]} />
        <meshStandardMaterial color="#4a545e" metalness={0.2} roughness={0.7} />
      </mesh>
      {/* Plaza neon bollards */}
      {[0, 1, 2, 3, 4, 5].map((i) => {
        const a = (i / 6) * Math.PI * 2;
        return (
          <mesh key={i} position={[cx + Math.cos(a) * 4.9, 0.55, cz + Math.sin(a) * 4.9]} castShadow>
            <cylinderGeometry args={[0.08, 0.1, 1.1, 8]} />
            <meshStandardMaterial
              color={i % 2 === 0 ? "#c5a26f" : "#3de7ff"}
              emissive={i % 2 === 0 ? "#c5a26f" : "#3de7ff"}
              emissiveIntensity={0.55}
              toneMapped={false}
            />
          </mesh>
        );
      })}
    </group>
  );
}

function defaultLandmark(block: WorldBlockConfig): LandmarkDefinition {
  const hq = block.buildings.find((b) => b.kind === "hq");
  const pos = hq?.position ?? block.spawn;
  return {
    id: `landmark-${block.cityId}`,
    modelId: landmarkModelId(block.cityId),
    position: { x: pos.x + 6, y: 0, z: pos.z - 8 },
    rotationY: Math.PI * 0.15,
    size: { width: 8, height: 12, depth: 4 },
    label: `${block.cityId.toUpperCase()} LANDMARK`,
  };
}

/** Full scenic layer — env, districts, graffiti, screens, ambient life. */
function DistrictBanners({ block }: { block: WorldBlockConfig }) {
  return (
    <group>
      {(block.districts ?? []).map((d) => (
        <group key={d.id} position={[d.center.x, 6.4, d.center.z]}>
          <mesh position={[0, 0.55, 0]}>
            <boxGeometry args={[Math.min(8.4, d.name.length * 0.42 + 1.6), 1.05, 0.18]} />
            <meshStandardMaterial
              color="#0a1016"
              emissive="#00ff9f"
              emissiveIntensity={0.22}
              metalness={0.35}
              roughness={0.4}
            />
          </mesh>
          <Text
            position={[0, 0.55, 0.12]}
            fontSize={0.42}
            color="#e8fff4"
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.03}
            outlineColor="#05080c"
            maxWidth={8}
          >
            {d.name.toUpperCase()}
          </Text>
        </group>
      ))}
    </group>
  );
}

export function CityEnvironment({ tickerRows, block = NYC_DEMO_BLOCK }: { tickerRows: ScreenerRow[]; block?: WorldBlockConfig }) {
  const theme = cityTheme(block.cityId);
  const { quality, panel } = useCity();
  const high = quality === "high";
  const paused = panel !== "none";
  const screens = high ? marketScreensFor(block.cityId) : marketScreensFor(block.cityId).slice(0, 1);
  const hq = block.buildings.find((b) => b.kind === "hq");
  const shardOrigin = hq?.position ?? block.spawn;
  const landmarks = block.landmarks?.length ? block.landmarks : [defaultLandmark(block)];

  return (
    <group>
      <color attach="background" args={[theme.background]} />
      <fog attach="fog" args={[theme.fog, high ? 55 : 40, high ? 175 : 120]} />

      <SkyCycle block={block} />
      <ambientLight intensity={high ? 0.42 : 0.36} color="#c8d4de" />
      <hemisphereLight args={[theme.hemiSky, theme.hemiGround, high ? 0.55 : 0.42]} />
      <directionalLight position={[-22, 28, 12]} intensity={high ? 0.62 : 0.48} color="#e8d8b0" />
      {high && <directionalLight position={[18, 16, -10]} intensity={0.28} color="#8eb8ff" />}

      {/* Neon atmosphere lights — cyan / gold / magenta / lime */}
      <pointLight position={[block.spawn.x, 8, block.spawn.z]} intensity={1.05} color={theme.secondary} distance={38} />
      <pointLight
        position={[shardOrigin.x + 8, 9, shardOrigin.z - 4]}
        intensity={1.15}
        color={theme.warm}
        distance={40}
      />
      <pointLight
        position={[shardOrigin.x - 10, 8, shardOrigin.z + 6]}
        intensity={0.85}
        color={theme.magenta}
        distance={34}
      />
      {high && (
        <pointLight
          position={[block.bounds.maxX * 0.35, 12, block.bounds.minZ * 0.2]}
          intensity={0.7}
          color={theme.primary}
          distance={44}
        />
      )}
      <pointLight position={[block.spawn.x - 4, 5, block.spawn.z + 4]} intensity={0.7} color={theme.neon} distance={28} />

      <Ground block={block} />
      <UrbanNature block={block} lite={!high} />
      {high && <Skyline block={block} />}
      <StreetProps block={block} />
      <DistrictBanners block={block} />
      <PropScatter block={block} />
      {high && <GraffitiLayer block={block} />}

      {block.buildings.map((b) => (
        <BuildingMesh key={b.id} building={b} />
      ))}

      {landmarks.map((lm) => (
        <LandmarkMesh key={lm.id} landmark={lm} />
      ))}

      {block.billboards.map((bb) => (
        <BillboardMesh key={bb.id} board={bb} />
      ))}

      {screens.map((screen, index) => (
        <MegaScreen key={`screen-${index}`} rows={tickerRows} {...screen} />
      ))}

      <CentralPlaza block={block} />
      <HqBeacon block={block} />
      <GlassShards origin={shardOrigin} count={high ? 18 : 8} />

      {high && !paused && <RocketShow />}
      <NPCs block={block} count={high ? 9 : 4} />
      {high && !paused && <Drones />}
      {high && <OxiGuide spawn={block.spawn} />}
      {high && block.cityId === "nyc" && <Park />}
      <Traffic count={high ? 10 : 3} block={block} paused={paused} />
    </group>
  );
}

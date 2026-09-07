import { Canvas, useFrame } from "@react-three/fiber";
import { Billboard, OrbitControls, Stars, Text } from "@react-three/drei";
import { Bloom, EffectComposer, Vignette } from "@react-three/postprocessing";
import { Component, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Group, InstancedMesh, Mesh } from "three";
import { Color, DoubleSide, Object3D } from "three";
import type { LiveDeskPayload } from "@/pages/onchain-world/api";
import { LIVE_AGENTS, LIVE_WALLET_PUBKEY, buildLiveWorld } from "../../../../../shared/orbitx-live-desk.js";
import { liveCityClimate } from "../../../../../shared/orbitx-live-city.js";
import { HuntWatchBar } from "./LiveAgentFeed";
import { CopyMintButton } from "@/components/CopyMintButton";
import { useLiveDesk } from "../useLiveDesk";

type WorldSnap = NonNullable<LiveDeskPayload["world"]>;
type Building = NonNullable<WorldSnap["buildings"]>[number];
type Character = NonNullable<WorldSnap["characters"]>[number] & {
  path?: Array<{ x: number; z: number }>;
  loop?: boolean;
};
type Climate = NonNullable<WorldSnap["climate"]> & {
  snow?: boolean;
  storm?: boolean;
  weather?: string;
};

class FxCatch extends Component<{ children: ReactNode }, { fail: boolean }> {
  state = { fail: false };
  static getDerivedStateFromError() {
    return { fail: true };
  }
  render() {
    return this.state.fail ? null : this.props.children;
  }
}

export function LiveAgentCity({ snap: snapProp }: { snap?: LiveDeskPayload | null } = {}) {
  const hooked = useLiveDesk();
  const snap = snapProp ?? hooked.snap;
  const [webgl, setWebgl] = useState(true);
  const world = useMemo(() => {
    return buildLiveWorld({
      wallet: snap?.wallet || LIVE_WALLET_PUBKEY,
      agents: snap?.agents?.length ? snap.agents : LIVE_AGENTS,
      open: snap?.open || [],
      feed: snap?.feed || [],
      fills: snap?.fills || [],
      ledger: snap?.ledger || null,
    }) as WorldSnap;
  }, [snap]);
  const climate = (world.climate || liveCityClimate()) as Climate;

  if (!webgl) return <CityFallback world={world} />;

  return (
    <div className="absolute inset-0 h-full min-h-0 w-full overflow-hidden bg-black">
      <Canvas
        className="absolute inset-0 h-full w-full"
        style={{ width: "100%", height: "100%", display: "block" }}
        shadows
        camera={{ position: [38, 24, 46], fov: 40, near: 0.1, far: 420 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
        onCreated={({ gl }) => {
          gl.shadowMap.enabled = true;
          gl.domElement.addEventListener("webglcontextlost", () => setWebgl(false), { once: true });
        }}
      >
        <SkyRig climate={climate} />
        <fog
          attach="fog"
          args={[
            climate.phase === "day" ? "#9bb7c9" : "#070b10",
            climate.fog || climate.snow ? 16 : 48,
            climate.rain || climate.storm ? 78 : 140,
          ]}
        />
        <Stars radius={160} depth={60} count={climate.phase === "night" ? 2200 : climate.phase === "dusk" ? 900 : 280} factor={3.2} fade speed={0.22} />
        <Terrain world={world} climate={climate} />
        {world.buildings?.map((b) => (
          <CoinBuilding key={b.id} building={b} night={climate.phase === "night" || climate.phase === "dusk"} />
        ))}
        {(world.props || []).map((p: any) => (
          <CityProp key={p.id} prop={p} climate={climate} />
        ))}
        {world.characters?.map((c) => (
          <AgentBody key={c.id} agent={c} />
        ))}
        <Clouds climate={climate} />
        <Birds />
        {climate.rain || climate.storm ? <Rain storm={Boolean(climate.storm)} /> : null}
        {climate.snow ? <Snow /> : null}
        <FxCatch>
          <EffectComposer disableNormalPass>
            <Bloom intensity={climate.phase === "night" ? 0.78 : 0.3} luminanceThreshold={0.2} mipmapBlur />
            <Vignette eskil={false} offset={0.18} darkness={0.52} />
          </EffectComposer>
        </FxCatch>
        <OrbitControls enableDamping dampingFactor={0.08} minDistance={12} maxDistance={120} maxPolarAngle={Math.PI / 2.05} target={[0, 4, 0]} />
      </Canvas>
      <Hud world={world} climate={climate} hunts={snap?.hunt} />
    </div>
  );
}

function SkyRig({ climate }: { climate: Climate }) {
  const sun = useRef<any>(null);
  const disk = useRef<Mesh>(null);
  const moon = useRef<Group>(null);
  const hemi = useRef<any>(null);
  const flash = useRef(0);
  const DAY = 88;
  useFrame(({ clock, scene }) => {
    const phaseClock = (clock.elapsedTime % DAY) / DAY;
    const named = climate.phase || "day";
    const base = named === "day" ? 0.28 : named === "dusk" ? 0.62 : named === "dawn" ? 0.08 : 0.82;
    const t = (base + phaseClock * 0.08) % 1;
    const arc = t * Math.PI * 2 - Math.PI / 2;
    const daylight = Math.max(0, Math.sin(arc));
    const twilight = Math.max(0, 1 - Math.abs(Math.sin(arc)) * 2);
    const night = new Color(climate.rain || climate.storm ? "#0b1016" : climate.snow ? "#10151c" : "#071018");
    const dusk = new Color("#c45c32");
    const day = new Color(climate.rain || climate.storm ? "#6d7f8c" : climate.fog ? "#8aa0b0" : "#7ea8c9");
    const sky = night.clone().lerp(dusk, twilight).lerp(day, daylight);
    scene.background = sky;
    if (scene.fog) (scene.fog as any).color.copy(sky).lerp(new Color("#121820"), 0.35);
    if (climate.storm && Math.random() > 0.992) flash.current = 1;
    flash.current *= 0.86;
    const bolt = flash.current;
    if (sun.current) {
      sun.current.position.set(Math.cos(arc) * 70, 10 + daylight * 58, Math.sin(arc) * 48);
      sun.current.intensity = 0.22 + daylight * 1.2 + bolt * 2.4;
      sun.current.color.set(bolt > 0.2 ? "#e0eeff" : daylight > 0.3 ? "#fff1c9" : "#9bb4cc");
    }
    if (disk.current) {
      disk.current.position.set(Math.cos(arc) * 72, 12 + daylight * 60, Math.sin(arc) * 50);
      disk.current.visible = daylight > 0.05;
    }
    if (moon.current) {
      moon.current.position.set(-Math.cos(arc) * 68, 12 + (1 - daylight) * 44, -Math.sin(arc) * 52);
      moon.current.visible = daylight < 0.42;
    }
    if (hemi.current) hemi.current.intensity = (climate.phase === "night" ? 0.32 : 0.68) + bolt * 1.6;
  });
  return (
    <>
      <hemisphereLight
        ref={hemi}
        args={[climate.phase === "night" ? "#1b2838" : "#cfe6ff", "#1a2a1a", climate.phase === "night" ? 0.35 : 0.7]}
      />
      <directionalLight
        ref={sun}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-far={160}
        shadow-camera-left={-70}
        shadow-camera-right={70}
        shadow-camera-top={70}
        shadow-camera-bottom={-70}
      />
      <mesh ref={disk}>
        <sphereGeometry args={[3.4, 16, 12]} />
        <meshBasicMaterial color="#ffe9a8" />
      </mesh>
      <mesh ref={moon as any}>
        <sphereGeometry args={[2.3, 16, 12]} />
        <meshBasicMaterial color="#e8edf0" />
      </mesh>
    </>
  );
}

function Terrain({ world, climate }: { world: WorldSnap; climate: Climate }) {
  const grass = climate.phase === "night" ? "#1c2a1c" : climate.rain || climate.storm ? "#3a5a38" : climate.snow ? "#d7e3dc" : "#4f7a45";
  const span = Math.max(4, Number(world.span) || 4);
  const size = (span * 2 + 4) * 8.2;
  const night = climate.phase !== "day";
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.06, 0]} receiveShadow>
        <circleGeometry args={[size * 0.92, 72]} />
        <meshStandardMaterial color={grass} roughness={0.96} metalness={0.02} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]} receiveShadow>
        <circleGeometry args={[8.4, 40]} />
        <meshStandardMaterial color="#7b828c" roughness={0.62} metalness={0.18} />
      </mesh>
      {(world.walks || []).map((r: any) => (
        <mesh key={r.id} rotation={[-Math.PI / 2, 0, 0]} position={[r.x, 0.02, r.z]} receiveShadow>
          <planeGeometry args={[r.w, r.d]} />
          <meshStandardMaterial color="#6b7280" roughness={0.92} />
        </mesh>
      ))}
      {(world.roads || []).map((r: any) => (
        <mesh key={r.id} rotation={[-Math.PI / 2, 0, 0]} position={[r.x, 0.035, r.z]} receiveShadow>
          <planeGeometry args={[r.w, r.d]} />
          <meshStandardMaterial color="#1f2428" roughness={0.88} metalness={0.08} />
        </mesh>
      ))}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.045, 0]} receiveShadow>
        <planeGeometry args={[0.12, size]} />
        <meshStandardMaterial color="#eab308" roughness={0.6} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.046, 0]} receiveShadow>
        <planeGeometry args={[size, 0.12]} />
        <meshStandardMaterial color="#eab308" roughness={0.6} />
      </mesh>
      {(world.parks || []).map((p: any) => (
        <mesh key={p.id} rotation={[-Math.PI / 2, 0, 0]} position={[p.x, 0.05, p.z]} receiveShadow>
          <planeGeometry args={[p.w || 5, p.d || 5]} />
          <meshStandardMaterial color={climate.snow ? "#c5d5c8" : climate.phase === "night" ? "#243528" : "#5c8a4e"} roughness={1} />
        </mesh>
      ))}
      {(world.water || []).map((w: any) => (
        <River key={w.id} water={w} />
      ))}
      {(world.hills || []).map((h: any) => (
        <mesh key={h.id} position={[h.x, h.h * 0.35, h.z]} castShadow receiveShadow>
          <coneGeometry args={[h.r, h.h, 7]} />
          <meshStandardMaterial color={climate.snow ? "#dbe4ea" : "#3d4a3c"} roughness={0.95} flatShading />
        </mesh>
      ))}
      <GrassField count={climate.phase === "night" ? 420 : 780} radius={size * 0.72} color={grass} wind={climate.wind || 0.4} />
      {(world.trees || []).map((t: any) => (
        <Tree key={t.id} x={t.x} z={t.z} h={t.h} form={t.form} wind={climate.wind || 0.3} snow={Boolean(climate.snow)} />
      ))}
      {(world.lamps || []).slice(0, 28).map((l: any, i: number) => (
        <Lamp key={l.id} x={l.x} z={l.z} on={night} lit={night && i < 10} />
      ))}
    </group>
  );
}

function River({ water }: { water: { x: number; z: number; w: number; d: number; rot?: number } }) {
  const ref = useRef<Mesh>(null);
  useFrame((state) => {
    if (!ref.current) return;
    const mat = ref.current.material as any;
    mat.emissiveIntensity = 0.18 + Math.sin(state.clock.elapsedTime * 1.4) * 0.06;
  });
  return (
    <mesh ref={ref} rotation={[-Math.PI / 2, 0, water.rot || 0]} position={[water.x, 0.028, water.z]} receiveShadow>
      <planeGeometry args={[water.w, water.d]} />
      <meshStandardMaterial color="#1d4f72" roughness={0.18} metalness={0.45} emissive="#16324a" transparent opacity={0.92} />
    </mesh>
  );
}

function GrassField({ count, radius, color, wind }: { count: number; radius: number; color: string; wind: number }) {
  const ref = useRef<InstancedMesh>(null);
  const group = useRef<Group>(null);
  const dummy = useMemo(() => new Object3D(), []);
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + (i % 7) * 0.17;
      const r = 9 + (i % 113) * (radius / 113);
      dummy.position.set(Math.cos(a) * r, 0.22, Math.sin(a) * r);
      dummy.rotation.set(0, (i * 0.7) % 6, 0.12);
      dummy.scale.set(0.75, 0.55 + (i % 5) * 0.2, 0.75);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  }, [count, dummy, radius]);
  useFrame((state) => {
    if (group.current) group.current.rotation.z = Math.sin(state.clock.elapsedTime * 1.3) * 0.018 * wind;
  });
  return (
    <group ref={group}>
      <instancedMesh ref={ref} args={[undefined, undefined, count]}>
        <planeGeometry args={[0.12, 0.58]} />
        <meshStandardMaterial color={color} side={DoubleSide} roughness={1} />
      </instancedMesh>
    </group>
  );
}

function Tree({ x, z, h, form, wind, snow }: { x: number; z: number; h: number; form?: string; wind: number; snow: boolean }) {
  const ref = useRef<Group>(null);
  useFrame((state) => {
    if (ref.current) ref.current.rotation.z = Math.sin(state.clock.elapsedTime * 1.1 + x) * 0.04 * wind;
  });
  const leaf = snow ? "#d5e4d8" : form === "pine" ? "#234a2c" : "#2f5c34";
  return (
    <group ref={ref} position={[x, 0, z]}>
      <mesh position={[0, h * 0.28, 0]} castShadow>
        <cylinderGeometry args={[0.12, 0.18, h * 0.55, 6]} />
        <meshStandardMaterial color="#4a3428" roughness={0.9} />
      </mesh>
      {form === "round" ? (
        <>
          <mesh position={[0, h * 0.78, 0]} castShadow>
            <sphereGeometry args={[0.72 + h * 0.1, 8, 6]} />
            <meshStandardMaterial color={leaf} roughness={0.88} flatShading />
          </mesh>
          <mesh position={[0.28, h * 0.95, -0.12]} castShadow>
            <sphereGeometry args={[0.48 + h * 0.06, 7, 5]} />
            <meshStandardMaterial color={snow ? "#e8f0ea" : "#3f6e3c"} roughness={0.9} flatShading />
          </mesh>
        </>
      ) : (
        <>
          <mesh position={[0, h * 0.62, 0]} castShadow>
            <coneGeometry args={[0.85 + h * 0.08, h * 0.7, 7]} />
            <meshStandardMaterial color={leaf} roughness={0.85} />
          </mesh>
          <mesh position={[0, h * 0.95, 0]} castShadow>
            <coneGeometry args={[0.55 + h * 0.05, h * 0.55, 7]} />
            <meshStandardMaterial color={leaf} roughness={0.85} />
          </mesh>
        </>
      )}
    </group>
  );
}

function Lamp({ x, z, on, lit }: { x: number; z: number; on: boolean; lit: boolean }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 1.3, 0]}>
        <cylinderGeometry args={[0.06, 0.08, 2.6, 6]} />
        <meshStandardMaterial color="#9ca3af" metalness={0.6} roughness={0.3} />
      </mesh>
      <mesh position={[0, 2.7, 0]}>
        <sphereGeometry args={[0.16, 8, 8]} />
        <meshStandardMaterial color={on ? "#ffe9a8" : "#d6d3d1"} emissive={on ? "#ffe9a8" : "#000"} emissiveIntensity={on ? 1.4 : 0} />
      </mesh>
      {lit ? <pointLight position={[0, 2.6, 0]} intensity={1.05} distance={8} color="#ffe9a8" /> : null}
    </group>
  );
}

function CityProp({ prop, climate }: { prop: any; climate: Climate }) {
  if (prop.kind === "fountain") {
    return (
      <group position={[prop.x, 0, prop.z]}>
        <mesh position={[0, 0.18, 0]}>
          <cylinderGeometry args={[1.35, 1.5, 0.36, 12]} />
          <meshStandardMaterial color="#9ca3af" roughness={0.4} metalness={0.35} />
        </mesh>
        <mesh position={[0, 0.72, 0]}>
          <cylinderGeometry args={[0.18, 0.22, 1.1, 8]} />
          <meshStandardMaterial color="#d1d5db" metalness={0.5} roughness={0.3} />
        </mesh>
        <mesh position={[0, 1.15, 0]}>
          <sphereGeometry args={[0.22, 8, 8]} />
          <meshStandardMaterial color="#38bdf8" emissive="#0ea5e9" emissiveIntensity={climate.phase === "night" ? 0.6 : 0.25} />
        </mesh>
      </group>
    );
  }
  if (prop.kind === "bridge") {
    return (
      <group position={[prop.x, 0, prop.z]} rotation={[0, prop.rot || 0, 0]}>
        <mesh position={[0, 0.55, 0]} castShadow>
          <boxGeometry args={[prop.w || 8, 0.22, prop.d || 3.2]} />
          <meshStandardMaterial color="#57534e" roughness={0.7} />
        </mesh>
        <mesh position={[-(prop.w || 8) * 0.42, 1.1, (prop.d || 3) * 0.4]}>
          <boxGeometry args={[0.16, 1.4, 0.16]} />
          <meshStandardMaterial color="#a8a29e" />
        </mesh>
        <mesh position={[(prop.w || 8) * 0.42, 1.1, -(prop.d || 3) * 0.4]}>
          <boxGeometry args={[0.16, 1.4, 0.16]} />
          <meshStandardMaterial color="#a8a29e" />
        </mesh>
      </group>
    );
  }
  if (prop.kind === "stall") {
    return (
      <group position={[prop.x, 0, prop.z]} rotation={[0, prop.rot || 0, 0]}>
        <mesh position={[0, 0.55, 0]} castShadow>
          <boxGeometry args={[2.2, 1.1, 1.4]} />
          <meshStandardMaterial color="#b45309" />
        </mesh>
        <mesh position={[0, 1.35, 0]} rotation={[0, 0, 0.08]}>
          <boxGeometry args={[2.5, 0.08, 1.7]} />
          <meshStandardMaterial color="#f59e0b" />
        </mesh>
      </group>
    );
  }
  if (prop.kind === "bench") {
    return (
      <group position={[prop.x, 0, prop.z]} rotation={[0, prop.rot || 0, 0]}>
        <mesh position={[0, 0.42, 0]}>
          <boxGeometry args={[1.6, 0.12, 0.42]} />
          <meshStandardMaterial color="#78716c" />
        </mesh>
      </group>
    );
  }
  if (prop.kind === "crates") {
    return (
      <group position={[prop.x, 0, prop.z]}>
        <mesh position={[0, 0.32, 0]} castShadow>
          <boxGeometry args={[0.7, 0.64, 0.7]} />
          <meshStandardMaterial color="#92400e" />
        </mesh>
        <mesh position={[0.5, 0.22, 0.2]} castShadow>
          <boxGeometry args={[0.5, 0.44, 0.5]} />
          <meshStandardMaterial color="#a16207" />
        </mesh>
      </group>
    );
  }
  return null;
}

function CoinBuilding({ building, night }: { building: Building; night: boolean }) {
  const h = Math.max(2.2, Number(building.height) || 4);
  const isScan = building.kind === "solscan";
  const isDesk = building.kind === "desk";
  const isMarket = building.kind === "market";
  const isLoft = building.kind === "loft";
  const color = building.color || (isScan ? "#e5e7eb" : isDesk ? "#d6d3d1" : "#6b7280");
  const w = isScan ? 3.8 : isDesk ? 4 : isMarket ? 3.6 : isLoft ? 1.9 : 2.45;
  const d = isScan ? 3.8 : isDesk ? 3 : isMarket ? 3.1 : isLoft ? 1.9 : 2.45;
  const stories = Math.max(2, Number(building.stories) || Math.floor(h / 1.3));
  const growRef = useRef<Group>(null);
  useFrame((state) => {
    if (!growRef.current || !building.construction) return;
    const pulse = 0.72 + Math.sin(state.clock.elapsedTime * 1.6) * 0.08;
    growRef.current.scale.y = pulse;
  });
  return (
    <group position={[Number(building.x) || 0, 0, Number(building.z) || 0]}>
      <group ref={growRef}>
        <mesh
          position={[0, h / 2, 0]}
          castShadow
          receiveShadow
          onClick={() => {
            if (building.url || building.solscan) window.open(String(building.url || building.solscan), "_blank", "noreferrer");
          }}
        >
          <boxGeometry args={[w, h, d]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={night ? 0.18 : 0.04} metalness={0.28} roughness={0.42} />
        </mesh>
        {isLoft || isScan ? (
          <mesh position={[0, h * 0.72, 0]} castShadow>
            <boxGeometry args={[w * 0.72, h * 0.42, d * 0.72]} />
            <meshStandardMaterial color={color} metalness={0.32} roughness={0.4} />
          </mesh>
        ) : null}
        {Array.from({ length: Math.min(10, stories) }).map((_, i) =>
          [-1, 1].map((side) => (
            <mesh key={`${i}-${side}`} position={[(w / 2 + 0.03) * side, 0.55 + i * (h / stories), 0]}>
              <boxGeometry args={[0.05, 0.28, d * 0.62]} />
              <meshStandardMaterial color={night ? "#ffe9a8" : "#93c5fd"} emissive={night ? "#fbbf24" : "#1e3a5f"} emissiveIntensity={night ? 0.9 : 0.15} />
            </mesh>
          )),
        )}
        {isMarket ? (
          <mesh position={[0, h + 0.35, 0]} rotation={[0, 0, 0]} castShadow>
            <coneGeometry args={[Math.max(w, d) * 0.72, 1.1, 4]} />
            <meshStandardMaterial color="#b45309" roughness={0.7} />
          </mesh>
        ) : (
          <mesh position={[0, h + 0.08, 0]}>
            <boxGeometry args={[w + 0.28, 0.16, d + 0.28]} />
            <meshStandardMaterial color="#111827" metalness={0.4} roughness={0.5} />
          </mesh>
        )}
        {isDesk ? (
          <mesh position={[0, h + 0.7, 0]} castShadow>
            <coneGeometry args={[2.2, 1.3, 4]} />
            <meshStandardMaterial color="#78716c" />
          </mesh>
        ) : null}
      </group>
      {isScan ? (
        <mesh position={[0, h + 1.6, 0]}>
          <octahedronGeometry args={[0.95, 0]} />
          <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.95} />
        </mesh>
      ) : null}
      {building.construction ? <Crane h={h} /> : null}
      <Billboard position={[0, h + (isScan ? 2.7 : 1.25), 0]}>
        <Text fontSize={isScan ? 0.55 : 0.32} color="#f8fafc" anchorX="center" outlineWidth={0.02} outlineColor="#000">
          {building.label || (building.symbol ? `$${building.symbol}` : "")}
        </Text>
      </Billboard>
    </group>
  );
}

function Crane({ h }: { h: number }) {
  const arm = useRef<Group>(null);
  useFrame((state) => {
    if (arm.current) arm.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.6) * 0.7;
  });
  return (
    <group position={[1.7, 0, 1.7]}>
      <mesh position={[0, h * 0.6, 0]}>
        <boxGeometry args={[0.14, h * 1.2, 0.14]} />
        <meshStandardMaterial color="#f59e0b" />
      </mesh>
      <group ref={arm} position={[0, h * 1.15, 0]}>
        <mesh position={[1.2, 0, 0]}>
          <boxGeometry args={[2.5, 0.1, 0.1]} />
          <meshStandardMaterial color="#f59e0b" />
        </mesh>
        <mesh position={[2.2, -0.7, 0]}>
          <boxGeometry args={[0.08, 1.4, 0.08]} />
          <meshStandardMaterial color="#e5e7eb" />
        </mesh>
      </group>
    </group>
  );
}

function pointOnPath(path: Array<{ x: number; z: number }>, dist: number) {
  if (!path.length) return { x: 0, z: 0, yaw: 0 };
  let remain = dist;
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i];
    const b = path[i + 1];
    const len = Math.hypot(b.x - a.x, b.z - a.z) || 0.001;
    if (remain <= len) {
      const t = remain / len;
      return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, yaw: Math.atan2(b.x - a.x, b.z - a.z) };
    }
    remain -= len;
  }
  const last = path[path.length - 1];
  const prev = path[path.length - 2] || last;
  return { x: last.x, z: last.z, yaw: Math.atan2(last.x - prev.x, last.z - prev.z) };
}

function pathLength(path: Array<{ x: number; z: number }>) {
  let n = 0;
  for (let i = 0; i < path.length - 1; i++) n += Math.hypot(path[i + 1].x - path[i].x, path[i + 1].z - path[i].z);
  return Math.max(0.01, n);
}

function AgentBody({ agent }: { agent: Character }) {
  const ref = useRef<Group>(null);
  const left = useRef<Group>(null);
  const right = useRef<Group>(null);
  const color = agent.color || "#a3e635";
  const path = (agent.path && agent.path.length ? agent.path : [{ x: Number(agent.x) || 0, z: Number(agent.z) || 0 }]) as Array<{
    x: number;
    z: number;
  }>;
  const building = agent.action === "buy" || agent.action === "sell" || agent.action === "build";
  const loop = Boolean(agent.loop) || agent.action === "patrol" || agent.action === "idle";
  const total = pathLength(path);
  useFrame((state) => {
    const g = ref.current;
    if (!g) return;
    const speed = building ? 2.6 : 3.4;
    let dist = state.clock.elapsedTime * speed;
    if (loop) dist %= total;
    else dist = Math.min(total, dist);
    const at = pointOnPath(path, dist);
    const arrived = !loop && dist >= total - 0.05;
    g.position.x = at.x;
    g.position.z = at.z;
    g.rotation.y = at.yaw;
    const walk = !arrived || loop;
    const hammer = arrived && building;
    const swing = hammer
      ? Math.sin(state.clock.elapsedTime * 10) * 1.1
      : walk
        ? Math.sin(state.clock.elapsedTime * 8) * 0.55
        : Math.sin(state.clock.elapsedTime * 2) * 0.08;
    if (left.current) left.current.rotation.x = hammer ? 0.2 : swing;
    if (right.current) right.current.rotation.x = hammer ? -0.9 + swing : -swing;
    g.position.y = walk && !hammer ? Math.abs(Math.sin(state.clock.elapsedTime * 8)) * 0.08 : 0.02;
  });
  return (
    <group ref={ref} position={[Number(agent.x) || 0, 0, Number(agent.z) || 0]}>
      <mesh position={[0, 1.05, 0]} castShadow>
        <boxGeometry args={[0.52, 0.72, 0.32]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.35} />
      </mesh>
      <mesh position={[0, 1.58, 0]} castShadow>
        <boxGeometry args={[0.36, 0.36, 0.36]} />
        <meshStandardMaterial color="#f5e6d3" />
      </mesh>
      {building ? (
        <mesh position={[0, 1.84, 0]}>
          <boxGeometry args={[0.4, 0.16, 0.4]} />
          <meshStandardMaterial color="#f59e0b" />
        </mesh>
      ) : null}
      <group ref={left} position={[-0.38, 1.15, 0]}>
        <mesh position={[0, -0.28, 0]}>
          <boxGeometry args={[0.16, 0.58, 0.16]} />
          <meshStandardMaterial color={color} />
        </mesh>
      </group>
      <group ref={right} position={[0.38, 1.15, 0]}>
        <mesh position={[0, -0.28, 0]}>
          <boxGeometry args={[0.16, 0.58, 0.16]} />
          <meshStandardMaterial color={color} />
        </mesh>
        {building ? (
          <mesh position={[0, -0.62, 0.12]}>
            <boxGeometry args={[0.08, 0.34, 0.08]} />
            <meshStandardMaterial color="#78716c" />
          </mesh>
        ) : null}
      </group>
      <mesh position={[-0.14, 0.38, 0]}>
        <boxGeometry args={[0.18, 0.7, 0.18]} />
        <meshStandardMaterial color="#1f2937" />
      </mesh>
      <mesh position={[0.14, 0.38, 0]}>
        <boxGeometry args={[0.18, 0.7, 0.18]} />
        <meshStandardMaterial color="#1f2937" />
      </mesh>
      <Billboard position={[0, 2.28, 0]}>
        <Text fontSize={0.28} color={color} anchorX="center" outlineWidth={0.014} outlineColor="#000">
          {agent.handle || agent.first || agent.name}
        </Text>
      </Billboard>
    </group>
  );
}

function Clouds({ climate }: { climate: Climate }) {
  const ref = useRef<Group>(null);
  useFrame((_, dt) => {
    if (!ref.current) return;
    ref.current.rotation.y += dt * 0.016 * (climate.wind || 0.4);
  });
  const n = climate.rain || climate.storm || climate.snow ? 14 : 7;
  return (
    <group ref={ref} position={[0, 24, 0]}>
      {Array.from({ length: n }).map((_, i) => (
        <mesh key={i} position={[Math.cos(i * 0.9) * (20 + i * 2.2), (i % 4) * 1.5, Math.sin(i * 1.3) * 22]} scale={[1.8, 0.45, 1.4]}>
          <sphereGeometry args={[2.6 + (i % 3) * 0.55, 10, 8]} />
          <meshStandardMaterial color={climate.rain || climate.storm ? "#6b7280" : climate.snow ? "#cbd5e1" : "#e5e7eb"} transparent opacity={0.58} />
        </mesh>
      ))}
    </group>
  );
}

function Birds() {
  const ref = useRef<Group>(null);
  useFrame((state) => {
    if (ref.current) ref.current.rotation.y = state.clock.elapsedTime * 0.18;
  });
  return (
    <group ref={ref} position={[0, 16, 0]}>
      {Array.from({ length: 8 }).map((_, i) => (
        <mesh key={i} position={[Math.cos(i) * 18, 2 + (i % 3), Math.sin(i * 1.4) * 16]} rotation={[0, i, 0.4]}>
          <coneGeometry args={[0.12, 0.55, 3]} />
          <meshBasicMaterial color="#111827" />
        </mesh>
      ))}
    </group>
  );
}

function Rain({ storm = false }: { storm?: boolean }) {
  const ref = useRef<InstancedMesh>(null);
  const dummy = useMemo(() => new Object3D(), []);
  const n = storm ? 380 : 240;
  useFrame((state) => {
    const m = ref.current;
    if (!m) return;
    for (let i = 0; i < n; i++) {
      const x = ((i * 17) % 90) - 45;
      const z = ((i * 29) % 90) - 45;
      const y = 20 - ((state.clock.elapsedTime * (storm ? 22 : 14) + i) % 22);
      dummy.position.set(x, y, z);
      dummy.scale.set(0.035, storm ? 0.8 : 0.55, 0.035);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, n]}>
      <boxGeometry args={[1, 1, 1]} />
      <meshBasicMaterial color="#93c5fd" transparent opacity={0.42} />
    </instancedMesh>
  );
}

function Snow() {
  const ref = useRef<InstancedMesh>(null);
  const dummy = useMemo(() => new Object3D(), []);
  useFrame((state) => {
    const m = ref.current;
    if (!m) return;
    for (let i = 0; i < 220; i++) {
      const x = ((i * 13) % 90) - 45 + Math.sin(state.clock.elapsedTime * 0.6 + i) * 1.4;
      const z = ((i * 23) % 90) - 45;
      const y = 18 - ((state.clock.elapsedTime * 3.2 + i) % 20);
      dummy.position.set(x, y, z);
      dummy.scale.set(0.12, 0.12, 0.12);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, 220]}>
      <boxGeometry args={[1, 1, 1]} />
      <meshBasicMaterial color="#f8fafc" transparent opacity={0.7} />
    </instancedMesh>
  );
}

function Hud({ world, climate, hunts }: { world: WorldSnap; climate: Climate; hunts?: LiveDeskPayload["hunt"] }) {
  return (
    <>
      <div className="pointer-events-none absolute inset-x-0 top-0 p-3">
        <p className="ox-kicker text-accent">Live city</p>
        <p className="font-display text-sm text-fg">The books raise this town as they trade — Solscan is the tower.</p>
        <p className="mt-1 text-[10px] uppercase tracking-wide text-dim">
          {climate.weather || climate.phase}
          {climate.rain ? " · rain" : ""}
          {climate.snow ? " · snow" : ""}
          {climate.storm ? " · storm" : ""} · day {world.age_days ?? 1} · gen {world.generation ?? 1} ·{" "}
          {world.buildings?.length || 0} buildings · {world.built ?? 0} coin towers
        </p>
      </div>
      <div className="pointer-events-auto absolute inset-x-0 top-16 px-3">
        <div className="rounded-md border border-line bg-black/75 backdrop-blur-md">
          <HuntWatchBar hunts={hunts} />
        </div>
      </div>
      <aside className="absolute bottom-3 left-3 right-3 max-h-40 overflow-auto rounded-md border border-line bg-black/75 p-2 backdrop-blur-md sm:right-auto sm:w-96">
        <p className="ox-kicker mb-1">On the floor</p>
        <ul className="space-y-1">
          {(world.characters || []).map((c) => (
            <li key={c.id} className="flex items-start gap-2 text-2xs">
              <span className="mt-1 size-2 shrink-0 rounded-full" style={{ background: c.color }} />
              <span className="text-muted">
                <span className="text-fg">{c.first || c.name}</span> · {c.holding} · {c.action}
                {c.text ? ` — ${c.text}` : ""}
              </span>
            </li>
          ))}
        </ul>
      </aside>
    </>
  );
}

function CityFallback({ world }: { world: WorldSnap }) {
  return (
    <div className="ox-scroll absolute inset-0 h-full overflow-auto bg-black p-4">
      <p className="ox-kicker text-accent">Live city · map</p>
      <h2 className="font-display text-lg text-fg">Growing street grid</h2>
      <p className="mt-1 text-2xs text-dim">
        Gen {world.generation} · day {world.age_days} · {world.buildings?.length} buildings · {world.climate?.phase}
        {world.climate?.rain ? " rain" : ""}
      </p>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {(world.buildings || []).slice(0, 24).map((b) => (
          <li key={b.id} className="rounded-md border border-line bg-bg-sunken p-3">
            <p className="text-xs text-fg">{b.label || (b.symbol ? `$${b.symbol}` : b.id)}</p>
            <p className="mt-1 text-2xs text-dim">{b.meta || b.kind}</p>
            {b.mint ? <CopyMintButton mint={b.mint} label="CA" copiedLabel="copied" className="mt-2 rounded-full border-line px-2 py-0.5 text-[10px] text-dim" iconClassName="h-3 w-3" /> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

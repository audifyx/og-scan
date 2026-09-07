import { Canvas, useFrame } from "@react-three/fiber";
import { Billboard, OrbitControls, Stars, Text } from "@react-three/drei";
import { Bloom, EffectComposer, Vignette } from "@react-three/postprocessing";
import { Component, useMemo, useRef, useState, type ReactNode } from "react";
import type { Group, InstancedMesh } from "three";
import { Color, DoubleSide, Object3D } from "three";
import type { LiveDeskPayload } from "@/pages/onchain-world/api";
import { LIVE_AGENTS, LIVE_WALLET_PUBKEY, buildLiveWorld } from "../../../../../shared/orbitx-live-desk.js";
import { liveCityClimate } from "../../../../../shared/orbitx-live-city.js";
import { useLiveDesk } from "../useLiveDesk";

type WorldSnap = NonNullable<LiveDeskPayload["world"]>;
type Building = NonNullable<WorldSnap["buildings"]>[number];
type Character = NonNullable<WorldSnap["characters"]>[number];

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
  const climate = world.climate || liveCityClimate();

  if (!webgl) return <CityFallback world={world} />;

  return (
    <div className="relative min-h-0 flex-1 bg-black">
      <Canvas
        shadows
        camera={{ position: [32, 22, 38], fov: 42, near: 0.1, far: 280 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
        onCreated={({ gl }) => {
          gl.shadowMap.enabled = true;
          gl.domElement.addEventListener("webglcontextlost", () => setWebgl(false), { once: true });
        }}
      >
        <SkyRig climate={climate} />
        <fog attach="fog" args={[climate.phase === "day" ? "#9bb7c9" : "#070b10", climate.fog ? 18 : 42, climate.rain ? 70 : 110]} />
        <Stars radius={120} depth={50} count={climate.phase === "night" ? 1800 : 400} factor={3} fade speed={0.25} />
        <hemisphereLight args={[climate.phase === "night" ? "#1b2838" : "#cfe6ff", "#1a2a1a", climate.phase === "night" ? 0.35 : 0.7]} />
        <Terrain world={world} climate={climate} />
        {world.buildings?.map((b) => (
          <CoinBuilding key={b.id} building={b} night={climate.phase === "night" || climate.phase === "dusk"} />
        ))}
        {world.characters?.map((c) => (
          <AgentBody key={c.id} agent={c} />
        ))}
        <Clouds climate={climate} />
        {climate.rain ? <Rain /> : null}
        <FxCatch>
          <EffectComposer disableNormalPass>
            <Bloom intensity={climate.phase === "night" ? 0.7 : 0.28} luminanceThreshold={0.22} mipmapBlur />
            <Vignette eskil={false} offset={0.2} darkness={0.55} />
          </EffectComposer>
        </FxCatch>
        <OrbitControls enableDamping dampingFactor={0.08} minDistance={10} maxDistance={90} maxPolarAngle={Math.PI / 2.08} target={[0, 3, 0]} />
      </Canvas>
      <Hud world={world} climate={climate} />
    </div>
  );
}

function SkyRig({ climate }: { climate: { phase?: string; rain?: boolean } }) {
  const sun = useRef<any>(null);
  const moon = useRef<Group>(null);
  const DAY = 90;
  useFrame(({ clock, scene }) => {
    const phaseClock = (clock.elapsedTime % DAY) / DAY;
    const named = climate.phase || "day";
    const base =
      named === "day" ? 0.28 : named === "dusk" ? 0.62 : named === "dawn" ? 0.08 : 0.82;
    const t = (base + phaseClock * 0.08) % 1;
    const arc = t * Math.PI * 2 - Math.PI / 2;
    const daylight = Math.max(0, Math.sin(arc));
    const twilight = Math.max(0, 1 - Math.abs(Math.sin(arc)) * 2);
    const night = new Color(climate.rain ? "#0b1016" : "#071018");
    const dusk = new Color("#c45c32");
    const day = new Color(climate.rain ? "#6d7f8c" : "#7ea8c9");
    const sky = night.clone().lerp(dusk, twilight).lerp(day, daylight);
    scene.background = sky;
    if (scene.fog) (scene.fog as any).color.copy(sky).lerp(new Color("#121820"), 0.35);
    if (sun.current) {
      sun.current.position.set(Math.cos(arc) * 55, 8 + daylight * 52, Math.sin(arc) * 40);
      sun.current.intensity = 0.25 + daylight * 1.15;
      sun.current.color.set(daylight > 0.3 ? "#fff1c9" : "#9bb4cc");
    }
    if (moon.current) {
      moon.current.position.set(-Math.cos(arc) * 60, 10 + (1 - daylight) * 40, -Math.sin(arc) * 48);
      moon.current.visible = daylight < 0.4;
    }
  });
  return (
    <>
      <directionalLight ref={sun} castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024} shadow-camera-far={120} shadow-camera-left={-50} shadow-camera-right={50} shadow-camera-top={50} shadow-camera-bottom={-50} />
      <mesh ref={moon as any}>
        <sphereGeometry args={[2.2, 16, 12]} />
        <meshBasicMaterial color="#e8edf0" />
      </mesh>
    </>
  );
}

function Terrain({ world, climate }: { world: WorldSnap; climate: { phase?: string; rain?: boolean } }) {
  const grass = climate.phase === "night" ? "#1c2a1c" : climate.rain ? "#3a5a38" : "#4f7a45";
  const span = Math.max(3, Number(world.span) || 3);
  const size = (span * 2 + 3) * 8.2;
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.04, 0]} receiveShadow>
        <circleGeometry args={[size * 0.85, 64]} />
        <meshStandardMaterial color={grass} roughness={0.95} metalness={0.02} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} receiveShadow>
        <circleGeometry args={[7.2, 36]} />
        <meshStandardMaterial color="#6b7280" roughness={0.7} metalness={0.15} />
      </mesh>
      {(world.roads || []).map((r: any) => (
        <mesh key={r.id} rotation={[-Math.PI / 2, 0, 0]} position={[r.x, 0.03, r.z]} receiveShadow>
          <planeGeometry args={[r.w, r.d]} />
          <meshStandardMaterial color="#1f2428" roughness={0.88} metalness={0.08} />
        </mesh>
      ))}
      {(world.parks || []).map((p: any) => (
        <mesh key={p.id} rotation={[-Math.PI / 2, 0, 0]} position={[p.x, 0.05, p.z]} receiveShadow>
          <planeGeometry args={[p.w || 5, p.d || 5]} />
          <meshStandardMaterial color={climate.phase === "night" ? "#243528" : "#5c8a4e"} roughness={1} />
        </mesh>
      ))}
      <GrassField count={climate.phase === "night" ? 280 : 520} radius={size * 0.7} color={grass} />
      {(world.trees || []).map((t: any) => (
        <Tree key={t.id} x={t.x} z={t.z} h={t.h} />
      ))}
      {(world.lamps || []).map((l: any) => (
        <Lamp key={l.id} x={l.x} z={l.z} on={climate.phase !== "day"} />
      ))}
    </group>
  );
}

function GrassField({ count, radius, color }: { count: number; radius: number; color: string }) {
  const mesh = useMemo(() => {
    const geo = { dummy: true };
    return geo;
  }, []);
  const ref = useRef<InstancedMesh>(null);
  useMemo(() => mesh, [mesh]);
  const dummy = useMemo(() => new Object3D(), []);
  useFrame(() => {
    const m = ref.current;
    if (!m || m.userData.placed) return;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + (i % 7) * 0.17;
      const r = 8 + (i % 97) * (radius / 97);
      dummy.position.set(Math.cos(a) * r, 0.2, Math.sin(a) * r);
      dummy.rotation.set(0, (i * 0.7) % 6, 0.15);
      dummy.scale.set(0.7, 0.5 + (i % 5) * 0.18, 0.7);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
    m.userData.placed = true;
  });
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]}>
      <planeGeometry args={[0.12, 0.55]} />
      <meshStandardMaterial color={color} side={DoubleSide} roughness={1} />
    </instancedMesh>
  );
}

function Tree({ x, z, h }: { x: number; z: number; h: number }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, h * 0.28, 0]} castShadow>
        <cylinderGeometry args={[0.12, 0.18, h * 0.55, 6]} />
        <meshStandardMaterial color="#4a3428" roughness={0.9} />
      </mesh>
      <mesh position={[0, h * 0.75, 0]} castShadow>
        <coneGeometry args={[0.7 + h * 0.12, h * 0.9, 7]} />
        <meshStandardMaterial color="#2f5c34" roughness={0.85} />
      </mesh>
    </group>
  );
}

function Lamp({ x, z, on }: { x: number; z: number; on: boolean }) {
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
      {on ? <pointLight position={[0, 2.6, 0]} intensity={1.1} distance={8} color="#ffe9a8" /> : null}
    </group>
  );
}

function CoinBuilding({ building, night }: { building: Building; night: boolean }) {
  const h = Math.max(2.2, Number(building.height) || 4);
  const isScan = building.kind === "solscan";
  const isDesk = building.kind === "desk";
  const color = building.color || (isScan ? "#e5e7eb" : isDesk ? "#d6d3d1" : "#6b7280");
  const w = isScan ? 3.6 : isDesk ? 3.8 : 2.4;
  const d = isScan ? 3.6 : isDesk ? 2.8 : 2.4;
  const stories = Math.max(2, Number(building.stories) || Math.floor(h / 1.3));
  return (
    <group position={[Number(building.x) || 0, 0, Number(building.z) || 0]}>
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
      {Array.from({ length: stories }).map((_, i) =>
        [ -1, 1 ].map((side) => (
          <mesh key={`${i}-${side}`} position={[(w / 2 + 0.03) * side, 0.55 + i * (h / stories), 0]}>
            <boxGeometry args={[0.05, 0.28, d * 0.62]} />
            <meshStandardMaterial color={night ? "#ffe9a8" : "#93c5fd"} emissive={night ? "#fbbf24" : "#1e3a5f"} emissiveIntensity={night ? 0.9 : 0.15} />
          </mesh>
        )),
      )}
      <mesh position={[0, h + 0.08, 0]}>
        <boxGeometry args={[w + 0.25, 0.16, d + 0.25]} />
        <meshStandardMaterial color="#111827" metalness={0.4} roughness={0.5} />
      </mesh>
      {isScan ? (
        <mesh position={[0, h + 1.4, 0]}>
          <octahedronGeometry args={[0.85, 0]} />
          <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.9} />
        </mesh>
      ) : null}
      {building.construction ? <Crane h={h} /> : null}
      <Billboard position={[0, h + (isScan ? 2.4 : 1.15), 0]}>
        <Text fontSize={isScan ? 0.55 : 0.32} color="#f8fafc" anchorX="center" outlineWidth={0.02} outlineColor="#000">
          {building.label || (building.symbol ? `$${building.symbol}` : "")}
        </Text>
      </Billboard>
    </group>
  );
}

function Crane({ h }: { h: number }) {
  return (
    <group position={[1.6, 0, 1.6]}>
      <mesh position={[0, h * 0.55, 0]}>
        <boxGeometry args={[0.12, h * 1.1, 0.12]} />
        <meshStandardMaterial color="#f59e0b" />
      </mesh>
      <mesh position={[1.1, h * 1.05, 0]}>
        <boxGeometry args={[2.2, 0.1, 0.1]} />
        <meshStandardMaterial color="#f59e0b" />
      </mesh>
    </group>
  );
}

function AgentBody({ agent }: { agent: Character }) {
  const ref = useRef<Group>(null);
  const left = useRef<Group>(null);
  const right = useRef<Group>(null);
  const color = agent.color || "#a3e635";
  const moving = agent.action === "buy" || agent.action === "sell" || agent.action === "build";
  useFrame((state) => {
    const g = ref.current;
    if (!g) return;
    const targetX = Number(agent.x) || 0;
    const targetZ = Number(agent.z) || 0;
    const dx = targetX - g.position.x;
    const dz = targetZ - g.position.z;
    const dist = Math.hypot(dx, dz);
    const walk = dist > 0.35 || moving;
    g.position.x += dx * 0.045;
    g.position.z += dz * 0.045;
    if (dist > 0.05) g.rotation.y = Math.atan2(dx, dz);
    const swing = walk ? Math.sin(state.clock.elapsedTime * 8) * 0.55 : Math.sin(state.clock.elapsedTime * 2) * 0.08;
    if (left.current) left.current.rotation.x = swing;
    if (right.current) right.current.rotation.x = -swing;
    g.position.y = walk ? Math.abs(Math.sin(state.clock.elapsedTime * 8)) * 0.08 : 0.02;
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
      </group>
      <mesh position={[-0.14, 0.38, 0]}>
        <boxGeometry args={[0.18, 0.7, 0.18]} />
        <meshStandardMaterial color="#1f2937" />
      </mesh>
      <mesh position={[0.14, 0.38, 0]}>
        <boxGeometry args={[0.18, 0.7, 0.18]} />
        <meshStandardMaterial color="#1f2937" />
      </mesh>
      <Billboard position={[0, 2.2, 0]}>
        <Text fontSize={0.28} color={color} anchorX="center" outlineWidth={0.014} outlineColor="#000">
          {agent.handle || agent.first || agent.name}
        </Text>
      </Billboard>
    </group>
  );
}

function Clouds({ climate }: { climate: { wind?: number; rain?: boolean; phase?: string } }) {
  const ref = useRef<Group>(null);
  useFrame((_, dt) => {
    if (!ref.current) return;
    ref.current.rotation.y += dt * 0.015 * (climate.wind || 0.4);
  });
  const n = climate.rain ? 10 : 6;
  return (
    <group ref={ref} position={[0, 22, 0]}>
      {Array.from({ length: n }).map((_, i) => (
        <mesh key={i} position={[Math.cos(i) * (18 + i * 2), (i % 3) * 1.4, Math.sin(i * 1.3) * 20]}>
          <sphereGeometry args={[2.4 + (i % 3) * 0.6, 10, 8]} />
          <meshStandardMaterial color={climate.rain ? "#6b7280" : "#e5e7eb"} transparent opacity={0.55} />
        </mesh>
      ))}
    </group>
  );
}

function Rain() {
  const ref = useRef<InstancedMesh>(null);
  const dummy = useMemo(() => new Object3D(), []);
  useFrame((state) => {
    const m = ref.current;
    if (!m) return;
    for (let i = 0; i < 220; i++) {
      const x = ((i * 17) % 80) - 40;
      const z = ((i * 29) % 80) - 40;
      const y = 18 - ((state.clock.elapsedTime * 14 + i) % 20);
      dummy.position.set(x, y, z);
      dummy.scale.set(0.04, 0.55, 0.04);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, 220]}>
      <boxGeometry args={[1, 1, 1]} />
      <meshBasicMaterial color="#93c5fd" transparent opacity={0.45} />
    </instancedMesh>
  );
}

function Hud({ world, climate }: { world: WorldSnap; climate: { phase?: string; rain?: boolean; hour?: number } }) {
  return (
    <>
      <div className="pointer-events-none absolute inset-x-0 top-0 p-3">
        <p className="ox-kicker text-accent">Live city</p>
        <p className="font-display text-sm text-fg">The books raise this town as they trade — Solscan is the tower.</p>
        <p className="mt-1 text-[10px] uppercase tracking-wide text-dim">
          {climate.phase}
          {climate.rain ? " · rain" : ""} · gen {world.generation ?? 1} · {world.buildings?.length || 0} buildings ·{" "}
          {world.built ?? 0} coin towers
        </p>
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
    <div className="ox-scroll min-h-0 flex-1 overflow-auto bg-black p-4">
      <p className="ox-kicker text-accent">Live city · map</p>
      <h2 className="font-display text-lg text-fg">Growing street grid</h2>
      <p className="mt-1 text-2xs text-dim">
        Gen {world.generation} · {world.buildings?.length} buildings · {world.climate?.phase}
        {world.climate?.rain ? " rain" : ""}
      </p>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {(world.buildings || []).slice(0, 24).map((b) => (
          <li key={b.id} className="rounded-md border border-line bg-bg-sunken p-3">
            <p className="text-xs text-fg">{b.label || (b.symbol ? `$${b.symbol}` : b.id)}</p>
            <p className="mt-1 text-2xs text-dim">{b.meta || b.kind}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

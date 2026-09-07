import { Canvas, useFrame } from "@react-three/fiber";
import { Billboard, OrbitControls, Sparkles, Stars, Text } from "@react-three/drei";
import { Bloom, EffectComposer, Vignette } from "@react-three/postprocessing";
import { Component, useMemo, useRef, useState, type ReactNode } from "react";
import type { Group } from "three";
import { Color, DoubleSide } from "three";
import type { LiveDeskPayload } from "@/pages/onchain-world/api";
import { LIVE_AGENTS, LIVE_WALLET_PUBKEY, buildLiveWorld } from "../../../../../shared/orbitx-live-desk.js";
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
    if (snap?.world?.buildings?.length) return snap.world as WorldSnap;
    return buildLiveWorld({
      wallet: snap?.wallet || LIVE_WALLET_PUBKEY,
      agents: snap?.agents?.length ? snap.agents : LIVE_AGENTS,
      open: snap?.open || [],
      feed: snap?.feed || [],
      ledger: snap?.ledger || null,
    }) as WorldSnap;
  }, [snap]);

  if (!webgl) return <CityFallback world={world} />;

  return (
    <div className="relative min-h-0 flex-1 bg-black">
      <Canvas
        camera={{ position: [18, 14, 22], fov: 42, near: 0.1, far: 200 }}
        dpr={[1, 1.6]}
        gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
        onCreated={({ gl }) => {
          gl.setClearColor(new Color("#000000"), 1);
          gl.domElement.addEventListener("webglcontextlost", () => setWebgl(false), { once: true });
        }}
      >
        <fog attach="fog" args={["#000000", 28, 70]} />
        <ambientLight intensity={0.35} />
        <directionalLight position={[8, 18, 6]} intensity={1.1} color="#f5f5f5" />
        <pointLight position={[0, 12, 0]} intensity={2.4} color="#ffffff" distance={40} />
        {LIVE_AGENTS.map((a, i) => (
          <pointLight key={a.id} position={[Math.cos(i) * 10, 4, Math.sin(i) * 10]} intensity={1.2} color={a.color} distance={16} />
        ))}
        <Stars radius={80} depth={40} count={1200} factor={3} fade speed={0.4} />
        <Sparkles count={40} scale={28} size={3} speed={0.3} color="#ffffff" />
        <Ground />
        {world.buildings.map((b) => (
          <CoinBuilding key={b.id} building={b} />
        ))}
        {world.characters.map((c) => (
          <AgentBody key={c.id} agent={c} />
        ))}
        <FxCatch>
          <EffectComposer disableNormalPass>
            <Bloom intensity={0.55} luminanceThreshold={0.2} mipmapBlur />
            <Vignette eskil={false} offset={0.25} darkness={0.7} />
          </EffectComposer>
        </FxCatch>
        <OrbitControls enableDamping dampingFactor={0.08} minDistance={8} maxDistance={48} maxPolarAngle={Math.PI / 2.05} target={[0, 2, 0]} />
      </Canvas>
      <div className="pointer-events-none absolute inset-x-0 top-0 p-3">
        <p className="ox-kicker text-accent">Live city</p>
        <p className="font-display text-sm text-fg">Solscan is the tower. Every coin is a building. The three books walk the floor.</p>
      </div>
      <Legend world={world} />
    </div>
  );
}

function Ground() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
        <circleGeometry args={[42, 64]} />
        <meshStandardMaterial color="#050505" metalness={0.4} roughness={0.55} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <ringGeometry args={[10.2, 10.35, 80]} />
        <meshBasicMaterial color="#f5f5f5" transparent opacity={0.18} side={DoubleSide} />
      </mesh>
      <gridHelper args={[48, 48, "#222", "#111"]} position={[0, 0.02, 0]} />
    </group>
  );
}

function CoinBuilding({ building }: { building: Building }) {
  const h = Math.max(2.2, Number(building.height) || 4);
  const isScan = building.kind === "solscan";
  const isDesk = building.kind === "desk";
  const color = isScan ? "#f5f5f5" : isDesk ? "#d4d4d4" : building.holding ? "#e5e5e5" : "#737373";
  const w = isScan ? 3.2 : isDesk ? 3.6 : 1.8;
  const d = isScan ? 3.2 : isDesk ? 2.4 : 1.8;
  return (
    <group position={[Number(building.x) || 0, 0, Number(building.z) || 0]}>
      <mesh position={[0, h / 2, 0]}
        onClick={() => {
          if (building.url || building.solscan) window.open(String(building.url || building.solscan), "_blank", "noreferrer");
        }}
      >
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={isScan ? 0.35 : 0.12} metalness={0.55} roughness={0.28} />
      </mesh>
      {Array.from({ length: Math.max(3, Math.floor(h / 1.4)) }).map((_, i) => (
        <mesh key={i} position={[w / 2 + 0.02, 0.6 + i * 1.2, 0]}>
          <boxGeometry args={[0.04, 0.35, d * 0.7]} />
          <meshBasicMaterial color={isScan ? "#ffffff" : "#a3a3a3"} />
        </mesh>
      ))}
      {isScan ? (
        <mesh position={[0, h + 1.1, 0]}>
          <octahedronGeometry args={[0.7, 0]} />
          <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.8} />
        </mesh>
      ) : null}
      <Billboard position={[0, h + 1.8, 0]}>
        <Text fontSize={0.42} color="#f5f5f5" anchorX="center" anchorY="middle" outlineWidth={0.02} outlineColor="#000">
          {building.label || (building.symbol ? `$${building.symbol}` : building.id)}
        </Text>
      </Billboard>
    </group>
  );
}

function AgentBody({ agent }: { agent: Character }) {
  const ref = useRef<Group>(null);
  const color = agent.color || "#a3e635";
  useFrame((state) => {
    const g = ref.current;
    if (!g) return;
    const bounce = agent.action === "idle" || agent.action === "hold" ? 0.04 : 0.12;
    g.position.y = 0.05 + Math.abs(Math.sin(state.clock.elapsedTime * 6 + Number(agent.x || 0))) * bounce;
    const targetX = Number(agent.x) || 0;
    const targetZ = Number(agent.z) || 0;
    g.position.x += (targetX - g.position.x) * 0.04;
    g.position.z += (targetZ - g.position.z) * 0.04;
    g.rotation.y = Math.atan2(targetX - g.position.x, targetZ - g.position.z) || g.rotation.y;
  });
  return (
    <group ref={ref} position={[Number(agent.x) || 0, 0, Number(agent.z) || 0]}>
      <mesh position={[0, 0.95, 0]}>
        <boxGeometry args={[0.48, 0.78, 0.3]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.45} />
      </mesh>
      <mesh position={[0, 1.5, 0]}>
        <boxGeometry args={[0.34, 0.34, 0.34]} />
        <meshStandardMaterial color="#f5f5f5" />
      </mesh>
      <mesh position={[-0.16, 0.35, 0]}>
        <boxGeometry args={[0.16, 0.5, 0.16]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[0.16, 0.35, 0]}>
        <boxGeometry args={[0.16, 0.5, 0.16]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <Billboard position={[0, 2.15, 0]}>
        <Text fontSize={0.32} color={color} anchorX="center" outlineWidth={0.015} outlineColor="#000">
          {agent.handle || agent.first || agent.name}
        </Text>
      </Billboard>
      <Billboard position={[0, 2.5, 0]}>
        <Text fontSize={0.22} color="#a3a3a3" anchorX="center" maxWidth={4} overflowWrap="break-word">
          {agent.holding === "cash" ? `${agent.action || "idle"}` : `holds ${agent.holding}`}
        </Text>
      </Billboard>
    </group>
  );
}

function Legend({ world }: { world: WorldSnap }) {
  return (
    <aside className="absolute bottom-3 left-3 right-3 max-h-36 overflow-auto rounded-md border border-line bg-black/75 p-2 backdrop-blur-md sm:right-auto sm:w-80">
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
  );
}

function CityFallback({ world }: { world: WorldSnap }) {
  return (
    <div className="ox-scroll min-h-0 flex-1 overflow-auto bg-black p-4">
      <p className="ox-kicker text-accent">Live city · map</p>
      <h2 className="font-display text-lg text-fg">Solscan tower + coin buildings</h2>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {(world.buildings || []).map((b) => (
          <li key={b.id} className="rounded-md border border-line bg-bg-sunken p-3">
            <p className="text-xs text-fg">{b.label || (b.symbol ? `$${b.symbol}` : b.id)}</p>
            <p className="mt-1 text-2xs text-dim">{b.meta || b.kind}</p>
            {b.url || b.solscan ? (
              <a className="mt-2 inline-block text-2xs text-muted hover:text-fg" href={String(b.url || b.solscan)} target="_blank" rel="noreferrer">
                Open Solscan
              </a>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

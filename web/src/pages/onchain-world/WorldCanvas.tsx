import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Sparkles, Stars, Text } from "@react-three/drei";
import { Bloom, EffectComposer, Vignette } from "@react-three/postprocessing";
import { Component, useEffect, useLayoutEffect, useMemo, useRef, type ReactNode, type RefObject } from "react";
import type { InstancedMesh, Mesh } from "three";
import { Color, Object3D, QuadraticBezierCurve3, TubeGeometry, Vector3 } from "three";
import type { ChainEvent, CityDistricts, FlowRow, KolCard, TokenDistrict } from "./api";
import { fmtNum, fmtUsd } from "./format";
import { isOrbitxMint, ORBITX_MINT } from "../../../shared/orbitx-chain-intel.js";
import { DEX_HUBS } from "../../../shared/orbitx-chain-districts.js";
import { activeOrbitxKols } from "../../../shared/orbitx-kol-directory.js";

export type WorldPick =
  | { kind: "event"; event: ChainEvent }
  | { kind: "wallet"; address: string }
  | { kind: "token"; mint: string }
  | { kind: "hub"; id: string };

export type CamCommand =
  | { kind: "reset" }
  | { kind: "orbitx" }
  | { kind: "wallet"; address: string }
  | { kind: "token"; mint: string }
  | { kind: "follow" }
  | null;

type Props = {
  events: ChainEvent[];
  kols?: KolCard[];
  flows?: FlowRow[];
  districts?: CityDistricts | null;
  followId?: string | null;
  followWallet?: string | null;
  cinematic?: boolean;
  cam?: CamCommand;
  onPick: (pick: WorldPick) => void;
  onReady?: () => void;
};

const SEED_TOKENS: TokenDistrict[] = [
  { mint: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN", symbol: "JUP", name: "Jupiter", kind: "token" },
  { mint: "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R", symbol: "RAY", name: "Raydium", kind: "token" },
  { mint: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263", symbol: "BONK", name: "Bonk", kind: "token" },
  { mint: "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm", symbol: "WIF", name: "dogwifhat", kind: "token" },
  { mint: "2zMMhcVQEXDtdE6vsFS7S7D5oUodfJHE8vd1gnBouauv", symbol: "PENGU", name: "Pudgy Penguins", kind: "token" },
  { mint: "6p6xgHyF7AeE6TZkSmFsko444wqoP15icUSqi2jfGiPN", symbol: "TRUMP", name: "Official Trump", kind: "token" },
];

const HUB_POS: Record<string, [number, number, number]> = {
  jupiter: [14.2, 0, 4.1],
  raydium: [-12.6, 0, 7.8],
  pumpfun: [8.4, 0, -13.6],
};

class FxCatch extends Component<{ children: ReactNode }, { fail: boolean }> {
  state = { fail: false };
  static getDerivedStateFromError() { return { fail: true }; }
  render() { return this.state.fail ? null : this.props.children; }
}

function hash(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return h >>> 0;
}

function ring(index: number, count: number, radius: number, y = 0): [number, number, number] {
  const a = (index / Math.max(count, 1)) * Math.PI * 2 - Math.PI / 2;
  return [Math.cos(a) * radius, y, Math.sin(a) * radius];
}

function tokenPos(mint: string, index: number, total: number): [number, number, number] {
  if (isOrbitxMint(mint)) return [0, 0, 0];
  const a = (index / Math.max(total, 1)) * Math.PI * 2 + 0.55;
  const r = 9.6 + (hash(mint) % 46) / 12;
  return [Math.cos(a) * r, 0, Math.sin(a) * r];
}

function walletPos(address: string, kolIndex: number, kolCount: number, isKol: boolean): [number, number, number] {
  if (isKol && kolIndex >= 0) return ring(kolIndex, kolCount, 6.2, 0.18);
  const h = hash(address);
  const a = (h % 360) * (Math.PI / 180);
  const r = 17.2 + (h % 28) / 12;
  return [Math.cos(a) * r, 0.18, Math.sin(a) * r];
}

function eventColor(type: string): string {
  if (type.includes("BURN")) return "#f59e0b";
  if (type.includes("BUY")) return "#34d399";
  if (type.includes("SELL")) return "#fb7185";
  if (type.includes("SOL")) return "#38bdf8";
  if (type.includes("ORBITX")) return "#c084fc";
  return "#67e8f9";
}

function Glow() {
  return (
    <FxCatch>
      <EffectComposer multisampling={0} disableNormalPass>
        <Bloom intensity={0.72} luminanceThreshold={0.22} luminanceSmoothing={0.38} mipmapBlur />
        <Vignette offset={0.18} darkness={0.62} />
      </EffectComposer>
    </FxCatch>
  );
}

function Ground() {
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[52, 96]} />
        <meshStandardMaterial color="#060412" metalness={0.58} roughness={0.42} />
      </mesh>
      {[5.4, 8.8, 13.2, 18.4, 24.2].map((r, i) => (
        <mesh key={r} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03 + i * 0.002, 0]}>
          <ringGeometry args={[r, r + 0.11, 96]} />
          <meshBasicMaterial color={i % 2 ? "#22d3ee" : "#c084fc"} transparent opacity={0.22 - i * 0.02} />
        </mesh>
      ))}
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * Math.PI * 2;
        return (
          <mesh key={`rd-${i}`} position={[Math.cos(a) * 15, 0.025, Math.sin(a) * 15]} rotation={[-Math.PI / 2, 0, a]}>
            <planeGeometry args={[30, 0.12]} />
            <meshBasicMaterial color="#7c3aed" transparent opacity={0.16} />
          </mesh>
        );
      })}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}>
        <circleGeometry args={[4.4, 64]} />
        <meshStandardMaterial color="#14081f" emissive="#4c1d95" emissiveIntensity={0.35} metalness={0.4} roughness={0.3} />
      </mesh>
    </>
  );
}

function CityFill() {
  const ref = useRef<InstancedMesh>(null);
  const glowRef = useRef<InstancedMesh>(null);
  const blocks = useMemo(() => {
    const out: { x: number; z: number; h: number; w: number; d: number }[] = [];
    for (let gx = -20; gx <= 20; gx += 1) {
      for (let gz = -20; gz <= 20; gz += 1) {
        const x = gx * 1.28;
        const z = gz * 1.28;
        const r = Math.hypot(x, z);
        if (r < 5.1 || r > 26.5) continue;
        const ringGap = [8.8, 13.2, 18.4].some((band) => Math.abs(r - band) < 0.42);
        if (ringGap) continue;
        const ang = Math.atan2(z, x);
        const spoke = ((ang % (Math.PI / 6)) + Math.PI / 6) % (Math.PI / 6);
        if (Math.abs(spoke - Math.PI / 12) < 0.05) continue;
        const n = Math.abs(gx * 19 + gz * 37);
        out.push({
          x,
          z,
          h: 0.48 + (n % 13) * 0.34 + (r > 20 ? 0.8 : 0),
          w: 0.62 + (n % 4) * 0.08,
          d: 0.62 + ((n + 2) % 4) * 0.08,
        });
      }
    }
    return out.slice(0, 320);
  }, []);

  useLayoutEffect(() => {
    const mesh = ref.current;
    const glow = glowRef.current;
    if (!mesh) return;
    const dummy = new Object3D();
    blocks.forEach((b, i) => {
      dummy.position.set(b.x, b.h / 2, b.z);
      dummy.scale.set(b.w, b.h, b.d);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      dummy.position.set(b.x, b.h + 0.03, b.z);
      dummy.scale.set(b.w * 0.92, 0.06, b.d * 0.92);
      dummy.updateMatrix();
      glow?.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (glow) glow.instanceMatrix.needsUpdate = true;
  }, [blocks]);

  return (
    <>
      <instancedMesh ref={ref} args={[undefined, undefined, blocks.length]} castShadow receiveShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#10101c" emissive="#2e1064" emissiveIntensity={0.22} metalness={0.46} roughness={0.44} />
      </instancedMesh>
      <instancedMesh ref={glowRef} args={[undefined, undefined, blocks.length]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial color="#7c3aed" transparent opacity={0.35} />
      </instancedMesh>
    </>
  );
}

function OrbitXTower({ district, pulsing, onPick }: { district?: TokenDistrict; pulsing: boolean; onPick: () => void }) {
  const glow = useRef<Mesh>(null);
  useFrame(({ clock }) => {
    if (!glow.current) return;
    const s = 1 + Math.sin(clock.elapsedTime * 2.2) * (pulsing ? 0.22 : 0.08);
    glow.current.scale.setScalar(s);
  });
  const cap = district?.market_cap != null ? fmtUsd(district.market_cap) : null;
  return (
    <group onClick={(e) => { e.stopPropagation(); onPick(); }}>
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
        const [x, , z] = ring(i, 8, 2.35, 0);
        return (
          <mesh key={i} position={[x, 0.55, z]}>
            <boxGeometry args={[0.22, 1.1, 0.22]} />
            <meshStandardMaterial color="#1e1533" emissive="#c084fc" emissiveIntensity={0.45} />
          </mesh>
        );
      })}
      <mesh position={[0, 0.7, 0]}>
        <cylinderGeometry args={[1.7, 2.05, 1.4, 8]} />
        <meshStandardMaterial color="#2e1064" emissive="#6d28d9" emissiveIntensity={0.4} metalness={0.55} roughness={0.22} />
      </mesh>
      <mesh position={[0, 3.5, 0]} castShadow>
        <cylinderGeometry args={[0.52, 1.28, 4.6, 8]} />
        <meshStandardMaterial color="#7c3aed" emissive="#6d28d9" emissiveIntensity={0.95} metalness={0.6} roughness={0.16} />
      </mesh>
      <mesh position={[0, 6.4, 0]}>
        <cylinderGeometry args={[0.12, 0.38, 1.6, 8]} />
        <meshStandardMaterial color="#e9d5ff" emissive="#c084fc" emissiveIntensity={1.2} />
      </mesh>
      <mesh ref={glow} position={[0, 7.45, 0]}>
        <octahedronGeometry args={[0.78, 0]} />
        <meshStandardMaterial color="#f5d0fe" emissive="#c084fc" emissiveIntensity={1.6} />
      </mesh>
      <mesh position={[0, 4.2, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 8.2, 6]} />
        <meshBasicMaterial color="#e879f9" transparent opacity={0.35} />
      </mesh>
      <pointLight position={[0, 7.6, 0]} intensity={pulsing ? 64 : 40} distance={26} color="#c084fc" />
      <Text position={[0, 8.55, 0]} fontSize={0.42} color="#f5d0fe" anchorX="center" anchorY="middle" outlineWidth={0.03} outlineColor="#12081c">
        {cap ? `ORBITX  ${cap}` : "ORBITX"}
      </Text>
    </group>
  );
}

function DexBuilding({ id, label, onPick }: { id: string; label: string; onPick: () => void }) {
  const pos = HUB_POS[id] || [12, 0, 0];
  const color = id === "jupiter" ? "#22d3ee" : id === "raydium" ? "#a78bfa" : "#fb923c";
  return (
    <group position={pos} onClick={(e) => { e.stopPropagation(); onPick(); }}>
      <mesh position={[0, 0.18, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[2.15, 24]} />
        <meshBasicMaterial color={color} transparent opacity={0.12} />
      </mesh>
      {id === "jupiter" ? (
        <mesh position={[0, 2.1, 0]}>
          <cylinderGeometry args={[0.85, 1.35, 4.2, 6]} />
          <meshStandardMaterial color="#10212a" emissive={new Color(color)} emissiveIntensity={0.42} metalness={0.5} roughness={0.28} />
        </mesh>
      ) : id === "raydium" ? (
        <>
          <mesh position={[0, 0.7, 0]}><boxGeometry args={[2.8, 1.4, 2.8]} /><meshStandardMaterial color="#161325" emissive={new Color(color)} emissiveIntensity={0.3} /></mesh>
          <mesh position={[0, 1.9, 0]}><boxGeometry args={[1.9, 1.1, 1.9]} /><meshStandardMaterial color="#161325" emissive={new Color(color)} emissiveIntensity={0.38} /></mesh>
          <mesh position={[0, 2.95, 0]}><boxGeometry args={[1.15, 1.0, 1.15]} /><meshStandardMaterial color="#161325" emissive={new Color(color)} emissiveIntensity={0.5} /></mesh>
        </>
      ) : (
        <>
          <mesh position={[0, 1.05, 0]}><boxGeometry args={[3.1, 2.1, 2.4]} /><meshStandardMaterial color="#23140c" emissive={new Color(color)} emissiveIntensity={0.32} /></mesh>
          <mesh position={[-0.8, 2.6, 0]}><cylinderGeometry args={[0.18, 0.22, 1.2, 8]} /><meshStandardMaterial color="#fb923c" emissive="#fb923c" emissiveIntensity={0.7} /></mesh>
          <mesh position={[0.8, 2.6, 0]}><cylinderGeometry args={[0.18, 0.22, 1.2, 8]} /><meshStandardMaterial color="#fb923c" emissive="#fb923c" emissiveIntensity={0.7} /></mesh>
        </>
      )}
      <Text position={[0, id === "jupiter" ? 4.55 : 3.85, 0]} fontSize={0.32} color={color} anchorX="center" outlineWidth={0.02} outlineColor="#05030c">
        {label}
      </Text>
    </group>
  );
}

function TokenBuilding({ district, index, total, onPick }: { district: TokenDistrict; index: number; total: number; onPick: () => void }) {
  const pos = useMemo(() => tokenPos(district.mint, index, total), [district.mint, index, total]);
  const h = 1.35 + Math.min(5.4, Math.log10(Math.max(district.market_cap || district.volume_24h || 12, 12)) * 0.72);
  const tone = district.source === "pumpfun" ? "#fb923c" : "#67e8f9";
  const sub = district.market_cap != null ? fmtUsd(district.market_cap) : district.volume_24h != null ? `${fmtNum(district.volume_24h)} VOL` : "";
  const label = `$${district.symbol || district.mint.slice(0, 4)}${sub ? ` (${sub})` : ""}`;
  return (
    <group position={pos} onClick={(e) => { e.stopPropagation(); onPick(); }}>
      <mesh position={[0, h / 2, 0]} castShadow>
        <boxGeometry args={[1.18, h, 1.18]} />
        <meshStandardMaterial color="#151226" emissive={tone} emissiveIntensity={0.28} metalness={0.46} roughness={0.34} />
      </mesh>
      <mesh position={[0, h + 0.06, 0]}>
        <boxGeometry args={[1.22, 0.12, 1.22]} />
        <meshBasicMaterial color={tone} />
      </mesh>
      <mesh position={[0, h * 0.62, 0.6]}>
        <boxGeometry args={[0.7, h * 0.18, 0.04]} />
        <meshBasicMaterial color={tone} transparent opacity={0.45} />
      </mesh>
      <Text position={[0, h + 0.55, 0]} fontSize={0.26} color="#e9d5ff" anchorX="center" outlineWidth={0.018} outlineColor="#05030c">
        {label}
      </Text>
    </group>
  );
}

function Agent({
  label,
  kol,
  whale,
  followed,
  pos,
  onPick,
}: {
  label: string;
  kol: boolean;
  whale: boolean;
  followed: boolean;
  pos: [number, number, number];
  onPick: () => void;
}) {
  const ref = useRef<Mesh>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.position.y = 0.28 + Math.sin(clock.elapsedTime * 2.15 + pos[0]) * 0.07;
    ref.current.rotation.y += 0.012;
  });
  const color = followed ? "#f0abfc" : kol ? "#e879f9" : whale ? "#fbbf24" : "#38bdf8";
  const s = whale ? 0.3 : kol ? 0.22 : 0.15;
  return (
    <group position={pos} onClick={(e) => { e.stopPropagation(); onPick(); }}>
      <mesh ref={ref}>
        <octahedronGeometry args={[s, 0]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={followed ? 1.4 : 0.95} metalness={0.28} roughness={0.2} />
      </mesh>
      {(kol || followed) && (
        <Text position={[0, 0.72, 0]} fontSize={0.22} color={color} anchorX="center" outlineWidth={0.016} outlineColor="#05030c">
          {label}
        </Text>
      )}
    </group>
  );
}

function Transit({
  event,
  from,
  to,
  highlight,
  onPick,
}: {
  event: ChainEvent;
  from: [number, number, number];
  to: [number, number, number];
  highlight: boolean;
  onPick: () => void;
}) {
  const ref = useRef<Mesh>(null);
  const start = useMemo(() => new Vector3(from[0], from[1] + 0.7, from[2]), [from]);
  const end = useMemo(() => new Vector3(to[0], to[1] + 1.4, to[2]), [to]);
  const mid = useMemo(
    () => new Vector3((start.x + end.x) / 2, Math.max(start.y, end.y) + 2.4, (start.z + end.z) / 2),
    [start, end],
  );
  const color = eventColor(event.event_type);
  const geom = useMemo(() => new TubeGeometry(new QuadraticBezierCurve3(start, mid, end), 18, highlight ? 0.045 : 0.022, 6, false), [start, mid, end, highlight]);
  const scale = highlight || event.whale_related || event.orbitx_related ? 0.2 : 0.1;
  useFrame(({ clock }) => {
    const t = (clock.elapsedTime * (0.22 + Math.min(event.importance, 50) / 90) + hash(event.event_id) / 1e9) % 1;
    const u = 1 - t;
    if (!ref.current) return;
    ref.current.position.set(
      u * u * start.x + 2 * u * t * mid.x + t * t * end.x,
      u * u * start.y + 2 * u * t * mid.y + t * t * end.y,
      u * u * start.z + 2 * u * t * mid.z + t * t * end.z,
    );
  });
  return (
    <group>
      <mesh geometry={geom}>
        <meshBasicMaterial color={color} transparent opacity={highlight ? 0.7 : 0.28} />
      </mesh>
      <mesh ref={ref} onClick={(e) => { e.stopPropagation(); onPick(); }}>
        <sphereGeometry args={[scale, 10, 10]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.2} />
      </mesh>
    </group>
  );
}

function Callout({ event, pos, onPick }: { event: ChainEvent; pos: [number, number, number]; onPick: () => void }) {
  const title = event.event_type.replace(/_/g, " ");
  const amt = event.token_symbol ? `$${event.token_symbol} ${event.amount != null ? fmtNum(event.amount) : ""}` : event.amount != null ? fmtNum(event.amount) : "";
  return (
    <group position={[pos[0], 3.55, pos[2]]} onClick={(e) => { e.stopPropagation(); onPick(); }}>
      <mesh>
        <planeGeometry args={[2.6, 0.72]} />
        <meshBasicMaterial color="#0b0818" transparent opacity={0.78} />
      </mesh>
      <Text position={[0, 0.12, 0.02]} fontSize={0.18} color="#f5d0fe" anchorX="center">
        {title}
      </Text>
      <Text position={[0, -0.14, 0.02]} fontSize={0.14} color="#a5b4fc" anchorX="center">
        {amt}
      </Text>
    </group>
  );
}

function CameraRig({
  target,
  controls,
  cam,
}: {
  target: [number, number, number] | null;
  controls: RefObject<{ target: Vector3 } | null>;
  cam: CamCommand;
}) {
  const { camera } = useThree();
  const goal = useRef(new Vector3(16.5, 11.5, 18.5));
  useEffect(() => {
    if (cam?.kind === "reset") goal.current.set(16.5, 11.5, 18.5);
    if (cam?.kind === "orbitx") goal.current.set(7.4, 7.6, 9.2);
    if (target && (cam?.kind === "follow" || cam?.kind === "wallet" || cam?.kind === "token")) {
      goal.current.set(target[0] + 6.2, 7.0, target[2] + 7.1);
    }
  }, [cam, target]);
  useFrame(() => {
    camera.position.lerp(goal.current, 0.035);
    if (target && controls.current && cam && cam.kind !== "reset") {
      controls.current.target.lerp(new Vector3(target[0], 1.15, target[2]), 0.055);
    }
  });
  return null;
}

function mergeTokens(live?: TokenDistrict[]): TokenDistrict[] {
  const byMint = new Map<string, TokenDistrict>();
  for (const t of SEED_TOKENS) byMint.set(t.mint, t);
  for (const t of live || []) {
    if (!t?.mint || isOrbitxMint(t.mint)) continue;
    byMint.set(t.mint, { ...byMint.get(t.mint), ...t });
  }
  return [...byMint.values()].slice(0, 22);
}

function Scene({ events, kols, districts, followId, followWallet, cinematic, cam, onPick }: Props) {
  const controls = useRef<{ target: Vector3 } | null>(null);
  const assigned = useMemo(() => (kols?.length ? kols.filter((k) => k.status !== "disputed") : activeOrbitxKols()), [kols]);
  const kolIndex = useMemo(() => {
    const m = new Map<string, number>();
    assigned.forEach((k, i) => m.set(k.address, i));
    return m;
  }, [assigned]);
  const tokens = useMemo(() => mergeTokens(districts?.tokens), [districts?.tokens]);
  const hubs = districts?.hubs?.length ? districts.hubs : DEX_HUBS;
  const tokenIndex = useMemo(() => {
    const m = new Map<string, [number, number, number]>();
    tokens.forEach((t, i) => m.set(t.mint, tokenPos(t.mint, i, tokens.length)));
    m.set(ORBITX_MINT, [0, 0, 0]);
    return m;
  }, [tokens]);

  const extraWallets = useMemo(() => {
    const set = new Set<string>();
    for (const e of events) {
      const addr = e.wallet || e.source_wallet;
      if (addr && !kolIndex.has(addr)) set.add(addr);
    }
    return [...set].slice(0, 12);
  }, [events, kolIndex]);

  const vis = events.filter((e) => e.importance >= 6 || e.orbitx_related || e.kol_related).slice(0, 28);
  const burns = events.filter((e) => e.event_type.includes("BURN") && e.orbitx_related);
  const callouts = vis.filter((e) => e.importance >= 18 || e.orbitx_related).slice(0, 5);

  const follow = followWallet
    ? walletPos(followWallet, kolIndex.get(followWallet) ?? -1, assigned.length, kolIndex.has(followWallet))
    : cam?.kind === "token" && cam.mint
      ? tokenIndex.get(cam.mint) || [0, 0, 0]
      : cam?.kind === "orbitx"
        ? [0, 0, 0] as [number, number, number]
        : null;

  return (
    <>
      <color attach="background" args={["#04020a"]} />
      <fog attach="fog" args={["#04020a", 16, 52]} />
      <ambientLight intensity={0.22} />
      <directionalLight position={[10, 18, 7]} intensity={0.95} color="#ddd6fe" castShadow />
      <pointLight position={[14, 6, 4]} intensity={18} distance={18} color="#22d3ee" />
      <pointLight position={[-12, 6, 8]} intensity={16} distance={16} color="#a78bfa" />
      <pointLight position={[8, 6, -13]} intensity={16} distance={16} color="#fb923c" />
      <Stars radius={80} depth={36} count={2200} factor={2.2} fade speed={0.28} />
      <Ground />
      <CityFill />
      <OrbitXTower district={districts?.orbitx} pulsing={burns.length > 0} onPick={() => onPick({ kind: "token", mint: ORBITX_MINT })} />
      {burns.length > 0 ? <Sparkles count={64} scale={[3.8, 5.4, 3.8]} size={4} color="#f59e0b" position={[0, 3.8, 0]} /> : null}
      {hubs.map((h) => (
        <DexBuilding key={h.id} id={h.id} label={h.label} onPick={() => onPick({ kind: "hub", id: h.id })} />
      ))}
      {tokens.map((t, i) => (
        <TokenBuilding key={t.mint} district={t} index={i} total={tokens.length} onPick={() => onPick({ kind: "token", mint: t.mint })} />
      ))}
      {assigned.map((k, i) => (
        <Agent
          key={k.address}
          label={k.name}
          kol
          whale={false}
          followed={followWallet === k.address}
          pos={walletPos(k.address, i, assigned.length, true)}
          onPick={() => onPick({ kind: "wallet", address: k.address })}
        />
      ))}
      {extraWallets.map((addr) => (
        <Agent
          key={addr}
          label={addr.slice(0, 4)}
          kol={false}
          whale={events.some((e) => e.wallet === addr && e.whale_related)}
          followed={followWallet === addr}
          pos={walletPos(addr, -1, assigned.length, false)}
          onPick={() => onPick({ kind: "wallet", address: addr })}
        />
      ))}
      {vis.map((event) => {
        const fromAddr = event.source_wallet || event.wallet || event.signature;
        const from = walletPos(fromAddr, kolIndex.get(fromAddr) ?? -1, assigned.length, kolIndex.has(fromAddr));
        const dest = event.destination_wallet;
        const to = dest
          ? walletPos(dest, kolIndex.get(dest) ?? -1, assigned.length, kolIndex.has(dest))
          : event.token_ca && tokenIndex.get(event.token_ca)
            ? tokenIndex.get(event.token_ca)!
            : HUB_POS.jupiter;
        return (
          <Transit
            key={event.event_id}
            event={event}
            from={from}
            to={to}
            highlight={followId === event.event_id}
            onPick={() => onPick({ kind: "event", event })}
          />
        );
      })}
      {callouts.map((event) => {
        const addr = event.wallet || event.source_wallet || event.signature;
        return (
          <Callout
            key={`c-${event.event_id}`}
            event={event}
            pos={walletPos(addr, kolIndex.get(addr) ?? -1, assigned.length, kolIndex.has(addr))}
            onPick={() => onPick({ kind: "event", event })}
          />
        );
      })}
      <CameraRig target={follow} controls={controls} cam={cam || null} />
      <OrbitControls
        ref={controls}
        enablePan
        enableZoom
        maxDistance={46}
        minDistance={5}
        autoRotate={Boolean(cinematic) && !followWallet}
        autoRotateSpeed={0.28}
      />
      <Glow />
    </>
  );
}

export default function WorldCanvas(props: Props) {
  return (
    <Canvas
      camera={{ position: [16.5, 11.5, 18.5], fov: 44 }}
      dpr={1}
      gl={{ antialias: false, alpha: false, powerPreference: "default", failIfMajorPerformanceCaveat: false, stencil: false }}
      onCreated={() => props.onReady?.()}
    >
      <Scene {...props} />
    </Canvas>
  );
}

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Sparkles, Stars, Text } from "@react-three/drei";
import { Bloom, EffectComposer, Vignette } from "@react-three/postprocessing";
import { Component, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import type { Group, Mesh, Points } from "three";
import {
  AdditiveBlending,
  ACESFilmicToneMapping,
  BackSide,
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  PolarGridHelper,
  QuadraticBezierCurve3,
  TubeGeometry,
  Vector3,
} from "three";
import type { ChainEvent, CityDistricts, FlowRow, KolCard, TokenDistrict } from "./api";
import { fmtNum, fmtUsd } from "./format";
import { isOrbitxMint, ORBITX_MINT } from "../../../shared/orbitx-chain-intel.js";
import { DEX_HUBS, tokenLabel, tokenTicker } from "../../../shared/orbitx-chain-districts.js";
import { activeOrbitxKols } from "../../../shared/orbitx-kol-directory.js";
import { usePlanetTexture } from "./planetTexture";
import type { FlightStick } from "./dashboard/WorldJoystick";
import type { ViewOptions } from "./lib/orbitx/types";
import {
  CLUSTER_META,
  CLUSTER_ORDER,
  galaxyPos,
  hashMint,
  layoutUniverse,
  type ClusterId,
  type UniverseNode,
} from "./universeLayout";

export { galaxyPos };

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
  selectedMint?: string | null;
  cinematic?: boolean;
  spin?: boolean;
  cam?: CamCommand;
  paused?: boolean;
  speed?: number;
  viewOptions?: ViewOptions;
  stick?: FlightStick;
  onPick: (pick: WorldPick) => void;
  onReady?: () => void;
  onCamConsumed?: () => void;
};

const DEFAULT_VIEW: ViewOptions = { labels: true, trails: true, figures: true, grid: false };
const ORBITX_MARK = "/orbitx-on-chain.svg";

class FxCatch extends Component<{ children: ReactNode }, { fail: boolean }> {
  state = { fail: false };
  static getDerivedStateFromError() {
    return { fail: true };
  }
  render() {
    return this.state.fail ? null : this.props.children;
  }
}

function hash(id: string): number {
  return hashMint(id);
}

function ring(index: number, count: number, radius: number, y = 0.4): [number, number, number] {
  const a = (index / Math.max(count, 1)) * Math.PI * 2 - Math.PI / 2;
  return [Math.cos(a) * radius, y, Math.sin(a) * radius];
}

function walletPos(address: string, kolIndex: number, kolCount: number, isKol: boolean): [number, number, number] {
  if (isKol && kolIndex >= 0) return ring(kolIndex, kolCount, 3.4, 0.55);
  const h = hash(address);
  const a = (h % 360) * (Math.PI / 180);
  const r = 31 + (h % 20) / 8;
  return [Math.cos(a) * r, ((h % 13) - 6) * 0.2, Math.sin(a) * r];
}

function holderPos(mint: string, index: number, around: [number, number, number]): [number, number, number] {
  const h = hash(`${mint}:${index}`);
  const a = (index / 12) * Math.PI * 2 + (h % 20) / 30;
  const r = 1.15 + (h % 10) / 14 + Math.floor(index / 12) * 0.45;
  return [around[0] + Math.cos(a) * r, around[1] + ((h % 9) - 4) * 0.08, around[2] + Math.sin(a) * r];
}

function eventColor(type: string): string {
  const t = String(type || "").toUpperCase();
  if (t.includes("LAUNCH")) return "#a3e635";
  if (t.includes("LIQUIDITY")) return "#2dd4bf";
  if (t.includes("BURN")) return "#f59e0b";
  if (t.includes("BUY")) return "#34d399";
  if (t.includes("SELL")) return "#fb7185";
  if (t.includes("SWAP")) return "#22d3ee";
  if (t.includes("TRANSFER") || t.includes("SOL")) return "#38bdf8";
  if (t.includes("ORBITX")) return "#c084fc";
  return "#67e8f9";
}

function nodeColor(mint: string, volume: number): string {
  if (isOrbitxMint(mint)) return "#e9d5ff";
  const h = hash(mint);
  if (volume >= 1_000_000) return h % 2 ? "#67e8f9" : "#c4b5fd";
  if (volume >= 100_000) return h % 2 ? "#38bdf8" : "#a78bfa";
  return h % 3 === 0 ? "#818cf8" : h % 3 === 1 ? "#22d3ee" : "#c084fc";
}

function Glow() {
  return (
    <FxCatch>
      <EffectComposer multisampling={2} disableNormalPass>
        <Bloom intensity={0.72} luminanceThreshold={0.22} luminanceSmoothing={0.48} mipmapBlur />
        <Vignette offset={0.28} darkness={0.62} />
      </EffectComposer>
    </FxCatch>
  );
}

function NebulaField() {
  const group = useRef<Group>(null);
  const clouds = useMemo(
    () =>
      CLUSTER_ORDER.filter((id) => id !== "orbitx").map((id, i) => {
        const meta = CLUSTER_META[id];
        return {
          position: meta.center,
          scale: meta.spread * 1.55,
          color: meta.color,
          opacity: 0.028 + (i % 3) * 0.008,
        };
      }),
    [],
  );
  useFrame(() => {
    /* Cluster clouds stay fixed so the camera never drifts on its own. */
  });
  return (
    <group ref={group}>
      {clouds.map((c) => (
        <mesh key={c.color + c.position.join(",")} position={c.position} scale={c.scale}>
          <sphereGeometry args={[1, 24, 24]} />
          <meshBasicMaterial
            color={c.color}
            transparent
            opacity={c.opacity}
            depthWrite={false}
            blending={AdditiveBlending}
          />
        </mesh>
      ))}
    </group>
  );
}

function DustField() {
  const points = useRef<Points>(null);
  const buffer = useMemo(() => {
    const positions = new Float32Array(1800 * 3);
    for (let i = 0; i < 1800; i++) {
      const h = hash(`dust:${i}`);
      positions[i * 3] = ((h % 3600) - 1800) / 10;
      positions[i * 3 + 1] = (((h >> 8) % 480) - 240) / 12;
      positions[i * 3 + 2] = (((h >> 16) % 3600) - 1800) / 10;
    }
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(positions, 3));
    return g;
  }, []);
  useEffect(() => () => buffer.dispose(), [buffer]);
  useFrame(() => {
    /* Dust stays still unless the user flies. */
  });
  return (
    <points ref={points} geometry={buffer}>
      <pointsMaterial color="#c4b5fd" size={0.032} sizeAttenuation transparent opacity={0.42} depthWrite={false} />
    </points>
  );
}

function StarGrid({ on }: { on: boolean }) {
  const helper = useMemo(() => {
    const g = new PolarGridHelper(180, 16, 8, 64, "#1e1b4b", "#312e81");
    g.position.y = -3.2;
    return g;
  }, []);
  if (!on) return null;
  return <primitive object={helper} />;
}

function OrbitXCore({
  district,
  pulsing,
  paused,
  showLabel,
  onPick,
}: {
  district?: TokenDistrict;
  pulsing: boolean;
  paused: boolean;
  spin?: boolean;
  showLabel: boolean;
  onPick: () => void;
}) {
  const body = useRef<Mesh>(null);
  const glow = useRef<Mesh>(null);
  const map = usePlanetTexture(district?.image || ORBITX_MARK, "#c084fc", "ORBITX", ORBITX_MINT, true, 10);
  useFrame((_, dt) => {
    if (paused || !spin) return;
    if (body.current) body.current.rotation.y += dt * 0.08;
    if (!glow.current) return;
    const s = 1 + Math.sin(performance.now() / 550) * (pulsing ? 0.16 : 0.06);
    glow.current.scale.setScalar(s);
  });
  const cap = district?.market_cap != null ? fmtUsd(district.market_cap) : null;
  return (
    <group onClick={(e) => { e.stopPropagation(); onPick(); }}>
      <mesh ref={body}>
        <sphereGeometry args={[1.22, 64, 64]} />
        <meshStandardMaterial
          map={map}
          roughness={0.48}
          metalness={0.12}
          emissive="#6d28d9"
          emissiveIntensity={0.22}
          emissiveMap={map}
        />
      </mesh>
      <mesh scale={1.08}>
        <sphereGeometry args={[1.22, 40, 40]} />
        <meshBasicMaterial color="#c084fc" transparent opacity={0.16} side={BackSide} blending={AdditiveBlending} depthWrite={false} />
      </mesh>
      <mesh ref={glow}>
        <sphereGeometry args={[1.62, 32, 32]} />
        <meshBasicMaterial color="#a78bfa" transparent opacity={0.1} blending={AdditiveBlending} depthWrite={false} />
      </mesh>
      <Sparkles count={64} scale={[3.6, 3.6, 3.6]} size={3.2} color="#e9d5ff" />
      <pointLight position={[0, 0.4, 0]} intensity={pulsing ? 62 : 40} distance={30} color="#c084fc" />
      {showLabel ? (
        <Text position={[0, 2.28, 0]} fontSize={0.36} color="#f5d0fe" anchorX="center" outlineWidth={0.025} outlineColor="#12081c">
          {cap ? `OrbitX  ${cap}` : "OrbitX"}
        </Text>
      ) : null}
    </group>
  );
}

function TokenStar({
  district,
  node,
  labeled,
  selected,
  paused,
  spin,
  lod,
  activity,
  onPick,
}: {
  district: TokenDistrict;
  node: UniverseNode;
  labeled: boolean;
  selected: boolean;
  paused: boolean;
  spin?: boolean;
  lod: "galaxy" | "cluster" | "local" | "inspect";
  activity: number;
  onPick: () => void;
}) {
  const body = useRef<Mesh>(null);
  const pos = node.pos;
  const volume = district.volume_24h || district.market_cap || 12;
  const r = selected ? Math.max(node.radius, 0.55) : node.radius;
  const color = nodeColor(district.mint, volume);
  const name = tokenLabel(district);
  const ticker = tokenTicker(district);
  const hi = selected || lod === "inspect" || lod === "local";
  const map = usePlanetTexture(
    district.image,
    color,
    ticker || name.slice(0, 4),
    district.mint,
    selected,
    selected ? 9 : labeled ? 6 : node.rank === "planet" ? 5 : 3,
  );
  const sub = district.volume_24h != null ? `${fmtNum(district.volume_24h)} VOL` : district.market_cap != null ? fmtUsd(district.market_cap) : "";
  useFrame((_, dt) => {
    if (paused || !spin || !body.current) return;
    body.current.rotation.y += dt * (selected ? 0.22 : 0.09 + (hash(district.mint) % 8) / 120);
  });
  const segs = hi ? (selected ? 48 : 28) : 12;
  return (
    <group position={pos} onClick={(e) => { e.stopPropagation(); onPick(); }}>
      <mesh ref={body} scale={r}>
        <sphereGeometry args={[1, segs, segs]} />
        <meshStandardMaterial
          map={map}
          roughness={0.52}
          metalness={0.1}
          emissive={color}
          emissiveIntensity={selected ? 0.28 : 0.12}
          emissiveMap={map}
        />
      </mesh>
      <mesh scale={r * 1.16}>
        <sphereGeometry args={[1, hi ? 20 : 10, hi ? 20 : 10]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={selected ? 0.2 : 0.1}
          side={BackSide}
          blending={AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      {selected ? (
        <mesh rotation={[1.15, 0.2, 0.18]}>
          <ringGeometry args={[r + 0.18, r + 0.32, 48]} />
          <meshBasicMaterial color={color} transparent opacity={0.78} side={DoubleSide} depthWrite={false} blending={AdditiveBlending} />
        </mesh>
      ) : activity > 0 && lod !== "galaxy" ? (
        <mesh rotation={[1.2, 0.15, 0.1]}>
          <ringGeometry args={[r + 0.08, r + 0.12 + Math.min(activity, 24) * 0.008, 24]} />
          <meshBasicMaterial color={color} transparent opacity={0.42} side={DoubleSide} depthWrite={false} blending={AdditiveBlending} />
        </mesh>
      ) : null}
      {labeled ? (
        <Text position={[0, r + 0.46, 0]} fontSize={selected ? 0.22 : 0.16} color="#eef2ff" anchorX="center" outlineWidth={0.014} outlineColor="#05030c">
          {name}
        </Text>
      ) : null}
      {selected && ticker ? (
        <Text position={[0, r + 0.78, 0]} fontSize={0.14} color="#a5b4fc" anchorX="center" outlineWidth={0.01} outlineColor="#05030c">
          {`$${ticker}${sub ? ` · ${sub}` : ""}`}
        </Text>
      ) : null}
    </group>
  );
}

function Agent({
  label,
  kol,
  whale,
  followed,
  pos,
  paused,
  spin,
  onPick,
}: {
  label: string;
  kol: boolean;
  whale: boolean;
  followed: boolean;
  pos: [number, number, number];
  paused: boolean;
  spin?: boolean;
  onPick: () => void;
}) {
  const ref = useRef<Mesh>(null);
  useFrame(({ clock }) => {
    if (!ref.current || paused || !spin) return;
    ref.current.position.y = pos[1] + Math.sin(clock.elapsedTime * 2.1 + pos[0]) * 0.08;
    ref.current.rotation.y += 0.014;
  });
  const color = followed ? "#f0abfc" : kol ? "#e879f9" : whale ? "#fbbf24" : "#38bdf8";
  const s = whale ? 0.22 : kol ? 0.16 : 0.09;
  return (
    <group position={[pos[0], 0, pos[2]]} onClick={(e) => { e.stopPropagation(); onPick(); }}>
      <mesh ref={ref} position={[0, pos[1], 0]}>
        <octahedronGeometry args={[s, 0]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={followed ? 1.5 : 1} metalness={0.25} roughness={0.18} />
      </mesh>
      {(kol || followed) && (
        <Text position={[0, pos[1] + 0.42, 0]} fontSize={0.16} color={color} anchorX="center" outlineWidth={0.012} outlineColor="#05030c">
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
  paused,
  speed,
  onPick,
}: {
  event: ChainEvent;
  from: [number, number, number];
  to: [number, number, number];
  highlight: boolean;
  paused: boolean;
  speed: number;
  onPick: () => void;
}) {
  const ref = useRef<Mesh>(null);
  const start = useMemo(() => new Vector3(from[0], from[1] + 0.2, from[2]), [from]);
  const end = useMemo(() => new Vector3(to[0], to[1] + 0.2, to[2]), [to]);
  const mid = useMemo(
    () => new Vector3((start.x + end.x) / 2, Math.max(start.y, end.y) + 2.1, (start.z + end.z) / 2),
    [start, end],
  );
  const color = eventColor(event.event_type);
  const geom = useMemo(
    () => new TubeGeometry(new QuadraticBezierCurve3(start, mid, end), 16, highlight ? 0.03 : 0.012, 5, false),
    [start, mid, end, highlight],
  );
  const scale = highlight || event.whale_related || event.kol_related || event.orbitx_related ? 0.14 : 0.07;
  useFrame(({ clock }) => {
    if (!ref.current || paused) return;
    const t = (clock.elapsedTime * (0.28 + Math.min(event.importance, 50) / 90) * Math.max(speed, 1) + hash(event.event_id) / 1e9) % 1;
    const u = 1 - t;
    ref.current.position.set(
      u * u * start.x + 2 * u * t * mid.x + t * t * end.x,
      u * u * start.y + 2 * u * t * mid.y + t * t * end.y,
      u * u * start.z + 2 * u * t * mid.z + t * t * end.z,
    );
  });
  return (
    <group>
      <mesh geometry={geom}>
        <meshBasicMaterial color={color} transparent opacity={highlight ? 0.72 : 0.22} />
      </mesh>
      <mesh ref={ref} onClick={(e) => { e.stopPropagation(); onPick(); }}>
        <sphereGeometry args={[scale, 10, 10]} />
        <meshStandardMaterial color={color} emissive={new Color(color)} emissiveIntensity={1.35} />
      </mesh>
    </group>
  );
}

function CameraRig({
  flyTo,
  controls,
  cam,
  stick,
  speed,
  onConsumed,
}: {
  flyTo: [number, number, number] | null;
  controls: RefObject<{ target: Vector3 } | null>;
  cam: CamCommand;
  stick: FlightStick;
  speed: number;
  onConsumed?: () => void;
}) {
  const { camera } = useThree();
  const vel = useRef(new Vector3());
  const dir = useRef(new Vector3());
  const right = useRef(new Vector3());
  const up = useRef(new Vector3(0, 1, 0));
  const flyingTo = useRef<Vector3 | null>(null);
  const lastKey = useRef("");
  useEffect(() => {
    if (!cam) {
      lastKey.current = "";
      return;
    }
    const dest =
      cam.kind === "reset"
        ? "reset"
        : cam.kind === "orbitx"
          ? "orbitx"
          : flyTo
            ? `${cam.kind}:${flyTo.join(",")}`
            : "";
    if (!dest || dest === lastKey.current) return;
    lastKey.current = dest;
    if (cam.kind === "reset") {
      flyingTo.current = new Vector3(0, 48, 168);
      if (controls.current) controls.current.target.set(0, 0, 0);
      return;
    }
    if (cam.kind === "orbitx") {
      flyingTo.current = new Vector3(6, 8, 14);
      if (controls.current) controls.current.target.set(0, 0, 0);
      return;
    }
    flyingTo.current = new Vector3(flyTo![0] + 7.4, flyTo![1] + 4.2, flyTo![2] + 9.5);
    if (controls.current) controls.current.target.set(flyTo![0], flyTo![1], flyTo![2]);
  }, [cam, flyTo, controls]);
  useFrame((_, dt) => {
    const stickFly =
      Math.abs(stick.x) > 0.08 || Math.abs(stick.y) > 0.08 || Math.abs(stick.z) > 0.08;
    if (stickFly) {
      if (flyingTo.current) {
        flyingTo.current = null;
        onConsumed?.();
      }
      camera.getWorldDirection(dir.current);
      right.current.crossVectors(dir.current, camera.up).normalize();
      const step = 42 * dt * Math.max(speed, 1) * (stick.boost ? 3.1 : 1);
      vel.current.addScaledVector(dir.current, -stick.y * step * 3.2);
      vel.current.addScaledVector(right.current, stick.x * step * 3.2);
      vel.current.addScaledVector(up.current, stick.z * step * 2.6);
      camera.position.addScaledVector(vel.current, dt * 18);
      vel.current.multiplyScalar(0.86);
      if (controls.current) {
        controls.current.target.addScaledVector(dir.current, -stick.y * step);
        controls.current.target.addScaledVector(right.current, stick.x * step);
        controls.current.target.addScaledVector(up.current, stick.z * step * 0.85);
      }
      return;
    }
    vel.current.multiplyScalar(0.9);
    if (vel.current.lengthSq() > 0.0004) {
      camera.position.add(vel.current);
    }
    if (flyingTo.current) {
      camera.position.lerp(flyingTo.current, 0.09);
      if (camera.position.distanceTo(flyingTo.current) < 0.55) {
        flyingTo.current = null;
        onConsumed?.();
      }
    }
  });
  return null;
}

function ClusterBeacon({
  id,
  count,
  visible,
}: {
  id: ClusterId;
  count: number;
  visible: boolean;
}) {
  const meta = CLUSTER_META[id];
  if (!visible || id === "orbitx" || count <= 0) return null;
  return (
    <group position={meta.center}>
      <mesh>
        <sphereGeometry args={[meta.spread * 0.42, 24, 24]} />
        <meshBasicMaterial color={meta.color} transparent opacity={0.045} depthWrite={false} blending={AdditiveBlending} />
      </mesh>
      <Text position={[0, meta.spread * 0.22, 0]} fontSize={1.15} color={meta.color} anchorX="center" outlineWidth={0.04} outlineColor="#05030c">
        {meta.label}
      </Text>
      <Text position={[0, meta.spread * 0.22 - 1.4, 0]} fontSize={0.55} color="#cbd5e1" anchorX="center" outlineWidth={0.02} outlineColor="#05030c">
        {`${count} worlds`}
      </Text>
    </group>
  );
}

function LodSampler({ onLod }: { onLod: (lod: "galaxy" | "cluster" | "local" | "inspect") => void }) {
  const { camera } = useThree();
  const last = useRef("");
  useFrame(() => {
    const d = camera.position.length();
    const next = d > 210 ? "galaxy" : d > 110 ? "cluster" : d > 36 ? "local" : "inspect";
    if (next !== last.current) {
      last.current = next;
      onLod(next);
    }
  });
  return null;
}

function Scene({
  events,
  kols,
  districts,
  followId,
  followWallet,
  selectedMint,
  spin,
  cam,
  paused = false,
  speed = 1,
  viewOptions = DEFAULT_VIEW,
  stick = { x: 0, y: 0, z: 0, boost: false },
  onPick,
  onCamConsumed,
}: Props) {
  const controls = useRef<{ target: Vector3 } | null>(null);
  const [lod, setLod] = useState<"galaxy" | "cluster" | "local" | "inspect">("cluster");
  const assigned = useMemo(
    () => (kols?.length ? kols.filter((k) => k.status !== "disputed") : activeOrbitxKols()),
    [kols],
  );
  const kolIndex = useMemo(() => {
    const m = new Map<string, number>();
    assigned.forEach((k, i) => m.set(k.address, i));
    return m;
  }, [assigned]);
  const tokens = useMemo(() => (districts?.tokens || []).slice(0, 250), [districts?.tokens]);
  const layout = useMemo(() => layoutUniverse(tokens), [tokens]);
  const tokenIndex = useMemo(() => {
    const m = new Map<string, [number, number, number]>();
    for (const node of layout.values()) m.set(node.mint, node.pos);
    m.set(ORBITX_MINT, [0, 0, 0]);
    return m;
  }, [layout]);
  const clusterSize = useMemo(() => {
    const out: Record<string, number> = {};
    for (const node of layout.values()) out[node.cluster] = (out[node.cluster] || 0) + 1;
    return out;
  }, [layout]);
  const activityMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of events) {
      if (e.token_ca) m.set(e.token_ca, (m.get(e.token_ca) || 0) + 1);
    }
    return m;
  }, [events]);

  const labeled = useMemo(() => {
    const set = new Set<string>();
    if (viewOptions.labels) {
      for (const node of layout.values()) {
        if (node.rank === "planet" || node.rank === "core" || node.cluster === "big_dawgs") set.add(node.mint);
      }
    }
    if (selectedMint) set.add(selectedMint);
    return set;
  }, [layout, selectedMint, viewOptions.labels]);

  const visibleTokens = useMemo(() => {
    if (lod === "galaxy") {
      return tokens.filter((t) => {
        const n = layout.get(t.mint);
        return n && (n.cluster === "big_dawgs" || n.cluster === "high_cap" || n.rank === "planet");
      });
    }
    if (lod === "cluster") {
      return tokens.filter((t) => {
        const n = layout.get(t.mint);
        return n && n.cluster !== "dormant";
      });
    }
    return tokens;
  }, [tokens, layout, lod]);

  const extraWallets = useMemo(() => {
    if (lod === "galaxy") return [];
    const set = new Set<string>();
    for (const e of events) {
      const addr = e.wallet || e.source_wallet;
      if (addr && !kolIndex.has(addr)) set.add(addr);
    }
    return [...set].slice(0, lod === "inspect" ? 36 : 12);
  }, [events, kolIndex, lod]);

  const holders = useMemo(() => {
    if (lod === "galaxy" || lod === "cluster" || !selectedMint) return [];
    const around = tokenIndex.get(selectedMint);
    if (!around) return [];
    const seen = new Set<string>();
    const out: { address: string; kol: boolean }[] = [];
    for (const e of events) {
      if (e.token_ca !== selectedMint) continue;
      for (const addr of [e.wallet, e.source_wallet, e.destination_wallet]) {
        if (!addr || seen.has(addr)) continue;
        seen.add(addr);
        out.push({ address: addr, kol: kolIndex.has(addr) });
      }
    }
    return out.slice(0, 80);
  }, [events, selectedMint, tokenIndex, kolIndex, lod]);

  const visCap = lod === "galaxy" ? 18 : lod === "cluster" ? 48 : lod === "local" ? 90 : 140;
  const vis = viewOptions.trails
    ? events
        .filter((e) => e.importance >= 3 || e.orbitx_related || e.kol_related || /SWAP|BUY|SELL|TRANSFER|BURN|LAUNCH|LIQUIDITY/i.test(e.event_type || ""))
        .slice(0, visCap)
    : [];
  const burns = events.filter((e) => e.event_type.includes("BURN") && e.orbitx_related);

  const flyTo =
    cam?.kind === "wallet" && followWallet
      ? walletPos(followWallet, kolIndex.get(followWallet) ?? -1, assigned.length, kolIndex.has(followWallet))
      : cam?.kind === "token" && cam.mint && tokenIndex.get(cam.mint)
        ? tokenIndex.get(cam.mint)!
        : cam?.kind === "orbitx"
          ? ([0, 0, 0] as [number, number, number])
          : cam?.kind === "reset"
            ? ([0, 0, 0] as [number, number, number])
            : null;

  const stickBusy = Math.abs(stick.x) > 0.08 || Math.abs(stick.y) > 0.08 || Math.abs(stick.z) > 0.08;
  const planetSpin = Boolean(spin) && !paused;

  return (
    <>
      <color attach="background" args={["#02010a"]} />
      <fog attach="fog" args={["#070314", 80, 520]} />
      <ambientLight intensity={0.22} color="#9bb6ff" />
      <directionalLight position={[40, 48, 22]} intensity={1.55} color="#fff4e0" />
      <directionalLight position={[-28, 12, -24]} intensity={0.28} color="#67e8f9" />
      <pointLight position={[0, 2, 0]} intensity={22} distance={36} color="#c084fc" />
      <pointLight position={[40, -8, 24]} intensity={10} distance={54} color="#22d3ee" />
      <Stars radius={380} depth={120} count={lod === "galaxy" ? 14000 : 9000} factor={3.4} saturation={0.18} fade speed={0} />
      <NebulaField />
      <DustField />
      <StarGrid on={viewOptions.grid} />
      <LodSampler onLod={setLod} />
      {CLUSTER_ORDER.map((id) => (
        <ClusterBeacon key={id} id={id} count={clusterSize[id] || 0} visible={lod === "galaxy" || lod === "cluster"} />
      ))}
      <OrbitXCore
        district={districts?.orbitx}
        pulsing={burns.length > 0}
        paused={paused}
        spin={planetSpin}
        showLabel={viewOptions.labels}
        onPick={() => onPick({ kind: "token", mint: ORBITX_MINT })}
      />
      {(districts?.hubs?.length ? districts.hubs : DEX_HUBS).map((hub, i) => {
        const a = (i / 3) * Math.PI * 2;
        const pos: [number, number, number] = [Math.cos(a) * 22, 1.8, Math.sin(a) * 22];
        const color = hub.id === "jupiter" ? "#22d3ee" : hub.id === "raydium" ? "#a78bfa" : "#fb923c";
        return (
          <group key={hub.id} position={pos} onClick={(e) => { e.stopPropagation(); onPick({ kind: "hub", id: hub.id }); }}>
            <mesh>
              <octahedronGeometry args={[0.55, 0]} />
              <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.1} />
            </mesh>
            {viewOptions.labels ? (
              <Text position={[0, 1.05, 0]} fontSize={0.24} color={color} anchorX="center" outlineWidth={0.012} outlineColor="#05030c">
                {hub.label}
              </Text>
            ) : null}
          </group>
        );
      })}
      {visibleTokens.map((t) => {
        const node = layout.get(t.mint);
        if (!node) return null;
        return (
          <TokenStar
            key={t.mint}
            district={t}
            node={node}
            labeled={labeled.has(t.mint) && lod !== "galaxy"}
            selected={selectedMint === t.mint}
            paused={paused}
            spin={planetSpin}
            lod={lod}
            activity={activityMap.get(t.mint) || 0}
            onPick={() => onPick({ kind: "token", mint: t.mint })}
          />
        );
      })}
      {viewOptions.figures && lod !== "galaxy"
        ? assigned.map((k, i) => {
            const around = k.last_mint && tokenIndex.get(k.last_mint);
            const pos = around
              ? ([around[0] + Math.cos((i / Math.max(assigned.length, 1)) * Math.PI * 2) * 2.6, around[1] + 0.7, around[2] + Math.sin((i / Math.max(assigned.length, 1)) * Math.PI * 2) * 2.6] as [number, number, number])
              : walletPos(k.address, i, assigned.length, true);
            return (
              <Agent
                key={k.address}
                label={k.name}
                kol
                whale={false}
                followed={followWallet === k.address}
                pos={pos}
                paused={paused}
                spin={planetSpin}
                onPick={() => onPick({ kind: "wallet", address: k.address })}
              />
            );
          })
        : null}
      {viewOptions.figures
        ? extraWallets.map((addr) => (
            <Agent
              key={addr}
              label={addr.slice(0, 4)}
              kol={false}
              whale={events.some((e) => e.wallet === addr && e.whale_related)}
              followed={followWallet === addr}
              pos={walletPos(addr, -1, assigned.length, false)}
              paused={paused}
              spin={planetSpin}
              onPick={() => onPick({ kind: "wallet", address: addr })}
            />
          ))
        : null}
      {viewOptions.figures
        ? holders.map((h, i) => {
            const around = tokenIndex.get(selectedMint || "") || [0, 0, 0];
            const pos = holderPos(selectedMint || "", i, around);
            return (
              <Agent
                key={`h-${h.address}`}
                label={h.kol ? assigned.find((k) => k.address === h.address)?.name || "KOL" : "Holder"}
                kol={h.kol}
                whale={false}
                followed={followWallet === h.address}
                pos={pos}
                paused={paused}
                spin={planetSpin}
                onPick={() => onPick({ kind: "wallet", address: h.address })}
              />
            );
          })
        : null}
      {vis.map((event) => {
        const fromAddr = event.source_wallet || event.wallet || event.signature;
        const from = walletPos(fromAddr, kolIndex.get(fromAddr) ?? -1, assigned.length, kolIndex.has(fromAddr));
        const dest = event.destination_wallet;
        const to = dest
          ? walletPos(dest, kolIndex.get(dest) ?? -1, assigned.length, kolIndex.has(dest))
          : event.token_ca && tokenIndex.get(event.token_ca)
            ? tokenIndex.get(event.token_ca)!
            : ([0, 0, 0] as [number, number, number]);
        return (
          <Transit
            key={event.event_id}
            event={event}
            from={from}
            to={to}
            highlight={followId === event.event_id}
            paused={paused}
            speed={speed}
            onPick={() => onPick({ kind: "event", event })}
          />
        );
      })}
      <CameraRig flyTo={flyTo} controls={controls} cam={cam || null} stick={stick} speed={speed} onConsumed={onCamConsumed} />
      <OrbitControls
        ref={controls}
        enablePan
        enableZoom
        enableDamping={false}
        zoomSpeed={1.35}
        panSpeed={1.15}
        rotateSpeed={0.72}
        enableRotate={!stickBusy}
        maxDistance={420}
        minDistance={1.6}
        autoRotate={false}
        screenSpacePanning
      />
      <Glow />
    </>
  );
}

export default function WorldCanvas(props: Props) {
  return (
    <Canvas
      camera={{ position: [0, 48, 168], fov: 50, near: 0.2, far: 900 }}
      dpr={[1, 1.75]}
      gl={{
        antialias: true,
        alpha: false,
        powerPreference: "high-performance",
        failIfMajorPerformanceCaveat: false,
        stencil: false,
        toneMapping: ACESFilmicToneMapping,
        toneMappingExposure: 1.12,
      }}
      onCreated={() => props.onReady?.()}
    >
      <Scene {...props} />
    </Canvas>
  );
}

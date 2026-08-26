import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Sparkles, Stars, Text } from "@react-three/drei";
import { Bloom, EffectComposer, Vignette } from "@react-three/postprocessing";
import { Component, useEffect, useMemo, useRef, type ReactNode, type RefObject } from "react";
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
  cam?: CamCommand;
  paused?: boolean;
  speed?: number;
  viewOptions?: ViewOptions;
  stick?: FlightStick;
  onPick: (pick: WorldPick) => void;
  onReady?: () => void;
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
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return h >>> 0;
}

export function galaxyPos(mint: string, _index = 0, _total = 1): [number, number, number] {
  if (isOrbitxMint(mint)) return [0, 0, 0];
  const h = hash(mint);
  const arm = h % 4;
  const t = ((h >>> 8) % 10_000) / 10_000;
  const spiral = t * Math.PI * 3.8 + arm * (Math.PI / 2);
  const r = 6.2 + t * 28 + ((h >> 4) % 18) / 12;
  const y = ((h % 21) - 10) * 0.32;
  return [Math.cos(spiral) * r, y, Math.sin(spiral) * r];
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
  if (type.includes("BURN")) return "#f59e0b";
  if (type.includes("BUY")) return "#34d399";
  if (type.includes("SELL")) return "#fb7185";
  if (type.includes("SOL")) return "#38bdf8";
  if (type.includes("ORBITX")) return "#c084fc";
  if (type.includes("SWAP")) return "#22d3ee";
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
      Array.from({ length: 7 }, (_, i) => {
        const a = (i / 7) * Math.PI * 2;
        return {
          position: [Math.cos(a) * (18 + i), (i % 3) * 4 - 3, Math.sin(a) * (16 + i * 0.6)] as [number, number, number],
          scale: 7 + (i % 4) * 2.4,
          color: ["#4c1d95", "#0e7490", "#6d28d9", "#155e75", "#7c3aed", "#164e63", "#5b21b6"][i],
          opacity: 0.045 + (i % 3) * 0.012,
        };
      }),
    [],
  );
  useFrame((_, dt) => {
    if (!group.current) return;
    group.current.rotation.y += dt * 0.008;
  });
  return (
    <group ref={group}>
      {clouds.map((c) => (
        <mesh key={c.color} position={c.position} scale={c.scale}>
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
      positions[i * 3] = ((h % 900) - 450) / 10;
      positions[i * 3 + 1] = (((h >> 8) % 280) - 140) / 12;
      positions[i * 3 + 2] = (((h >> 16) % 900) - 450) / 10;
    }
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(positions, 3));
    return g;
  }, []);
  useEffect(() => () => buffer.dispose(), [buffer]);
  useFrame((_, dt) => {
    if (!points.current) return;
    points.current.rotation.y += dt * 0.01;
  });
  return (
    <points ref={points} geometry={buffer}>
      <pointsMaterial color="#c4b5fd" size={0.032} sizeAttenuation transparent opacity={0.42} depthWrite={false} />
    </points>
  );
}

function StarGrid({ on }: { on: boolean }) {
  const helper = useMemo(() => {
    const g = new PolarGridHelper(42, 16, 8, 64, "#1e1b4b", "#312e81");
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
  showLabel: boolean;
  onPick: () => void;
}) {
  const body = useRef<Mesh>(null);
  const glow = useRef<Mesh>(null);
  const map = usePlanetTexture(district?.image || ORBITX_MARK, "#c084fc", "ORBITX", ORBITX_MINT, true, 10);
  useFrame((_, dt) => {
    if (paused) return;
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
  index,
  total,
  labeled,
  selected,
  paused,
  onPick,
}: {
  district: TokenDistrict;
  index: number;
  total: number;
  labeled: boolean;
  selected: boolean;
  paused: boolean;
  onPick: () => void;
}) {
  const body = useRef<Mesh>(null);
  const pos = useMemo(() => galaxyPos(district.mint, index, total), [district.mint, index, total]);
  const volume = district.volume_24h || district.market_cap || 12;
  const r = selected ? 0.52 : Math.min(0.4, 0.13 + Math.log10(Math.max(volume, 12)) * 0.048);
  const color = nodeColor(district.mint, volume);
  const name = tokenLabel(district);
  const ticker = tokenTicker(district);
  const map = usePlanetTexture(
    district.image,
    color,
    ticker || name.slice(0, 4),
    district.mint,
    selected,
    selected ? 9 : labeled ? 6 : Math.max(0, 4 - Math.floor(index / 40)),
  );
  const sub = district.volume_24h != null ? `${fmtNum(district.volume_24h)} VOL` : district.market_cap != null ? fmtUsd(district.market_cap) : "";
  useFrame((_, dt) => {
    if (paused || !body.current) return;
    body.current.rotation.y += dt * (selected ? 0.22 : 0.09 + (hash(district.mint) % 8) / 120);
  });
  return (
    <group position={pos} onClick={(e) => { e.stopPropagation(); onPick(); }}>
      <mesh ref={body} scale={r}>
        <sphereGeometry args={[1, selected ? 48 : 28, selected ? 48 : 28]} />
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
        <sphereGeometry args={[1, 20, 20]} />
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
      ) : null}
      {labeled ? (
        <Text position={[0, r + 0.46, 0]} fontSize={selected ? 0.2 : 0.15} color="#eef2ff" anchorX="center" outlineWidth={0.014} outlineColor="#05030c">
          {name}
        </Text>
      ) : null}
      {selected && ticker ? (
        <Text position={[0, r + 0.72, 0]} fontSize={0.13} color="#a5b4fc" anchorX="center" outlineWidth={0.01} outlineColor="#05030c">
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
  onPick,
}: {
  label: string;
  kol: boolean;
  whale: boolean;
  followed: boolean;
  pos: [number, number, number];
  paused: boolean;
  onPick: () => void;
}) {
  const ref = useRef<Mesh>(null);
  useFrame(({ clock }) => {
    if (!ref.current || paused) return;
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
  target,
  controls,
  cam,
  stick,
  speed,
}: {
  target: [number, number, number] | null;
  controls: RefObject<{ target: Vector3 } | null>;
  cam: CamCommand;
  stick: FlightStick;
  speed: number;
}) {
  const { camera } = useThree();
  const goal = useRef(new Vector3(0, 18, 48));
  const dir = useRef(new Vector3());
  const right = useRef(new Vector3());
  const up = useRef(new Vector3(0, 1, 0));
  const piloting = useRef(false);
  useEffect(() => {
    piloting.current = false;
    if (cam?.kind === "reset") {
      goal.current.set(0, 18, 48);
      return;
    }
    if (cam?.kind === "orbitx") {
      goal.current.set(4.2, 5.4, 8.6);
      return;
    }
    if (target) {
      goal.current.set(target[0] + 5.4, target[1] + 3.6, target[2] + 7.2);
    }
  }, [cam, target]);
  useFrame((_, dt) => {
    const flying =
      Math.abs(stick.x) > 0.04 || Math.abs(stick.y) > 0.04 || Math.abs(stick.z) > 0.04;
    if (flying) {
      piloting.current = true;
      camera.getWorldDirection(dir.current);
      right.current.crossVectors(dir.current, camera.up).normalize();
      const step = 28 * dt * Math.max(speed, 1) * (stick.boost ? 2.4 : 1);
      camera.position.addScaledVector(dir.current, -stick.y * step);
      camera.position.addScaledVector(right.current, stick.x * step);
      camera.position.addScaledVector(up.current, stick.z * step * 0.85);
      goal.current.copy(camera.position);
      if (controls.current) {
        controls.current.target.addScaledVector(dir.current, -stick.y * step);
        controls.current.target.addScaledVector(right.current, stick.x * step);
        controls.current.target.addScaledVector(up.current, stick.z * step * 0.85);
      }
      return;
    }
    if (piloting.current) return;
    camera.position.lerp(goal.current, 0.045);
    if (target && controls.current && cam?.kind !== "reset") {
      controls.current.target.lerp(new Vector3(target[0], target[1], target[2]), 0.07);
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
  cinematic,
  cam,
  paused = false,
  speed = 1,
  viewOptions = DEFAULT_VIEW,
  stick = { x: 0, y: 0, z: 0, boost: false },
  onPick,
}: Props) {
  const controls = useRef<{ target: Vector3 } | null>(null);
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
  const tokenIndex = useMemo(() => {
    const m = new Map<string, [number, number, number]>();
    tokens.forEach((t, i) => m.set(t.mint, galaxyPos(t.mint, i, tokens.length)));
    m.set(ORBITX_MINT, [0, 0, 0]);
    return m;
  }, [tokens]);

  const labeled = useMemo(() => {
    const set = new Set<string>();
    if (viewOptions.labels) {
      [...tokens]
        .sort((a, b) => (b.volume_24h || 0) - (a.volume_24h || 0))
        .slice(0, 28)
        .forEach((t) => set.add(t.mint));
    }
    if (selectedMint) set.add(selectedMint);
    return set;
  }, [tokens, selectedMint, viewOptions.labels]);

  const extraWallets = useMemo(() => {
    const set = new Set<string>();
    for (const e of events) {
      const addr = e.wallet || e.source_wallet;
      if (addr && !kolIndex.has(addr)) set.add(addr);
    }
    return [...set].slice(0, 36);
  }, [events, kolIndex]);

  const holders = useMemo(() => {
    if (!selectedMint) return [];
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
  }, [events, selectedMint, tokenIndex, kolIndex]);

  const vis = viewOptions.trails
    ? events
        .filter((e) => e.importance >= 4 || e.orbitx_related || e.kol_related || e.event_type.includes("SWAP") || e.event_type.includes("BUY") || e.event_type.includes("SELL"))
        .slice(0, 140)
    : [];
  const burns = events.filter((e) => e.event_type.includes("BURN") && e.orbitx_related);

  const follow = followWallet
    ? walletPos(followWallet, kolIndex.get(followWallet) ?? -1, assigned.length, kolIndex.has(followWallet))
    : selectedMint && tokenIndex.get(selectedMint)
      ? tokenIndex.get(selectedMint)!
      : cam?.kind === "token" && cam.mint
        ? tokenIndex.get(cam.mint) || [0, 0, 0]
        : cam?.kind === "orbitx"
          ? ([0, 0, 0] as [number, number, number])
          : null;

  return (
    <>
      <color attach="background" args={["#02010a"]} />
      <fog attach="fog" args={["#070314", 28, 140]} />
      <ambientLight intensity={0.22} color="#9bb6ff" />
      <directionalLight position={[18, 22, 12]} intensity={1.55} color="#fff4e0" />
      <directionalLight position={[-12, 6, -10]} intensity={0.28} color="#67e8f9" />
      <pointLight position={[0, 2, 0]} intensity={22} distance={26} color="#c084fc" />
      <pointLight position={[16, -4, 10]} intensity={10} distance={34} color="#22d3ee" />
      <Stars radius={220} depth={90} count={11000} factor={3.2} saturation={0.18} fade speed={paused ? 0 : 0.12} />
      <NebulaField />
      <DustField />
      <StarGrid on={viewOptions.grid} />
      <OrbitXCore
        district={districts?.orbitx}
        pulsing={burns.length > 0}
        paused={paused}
        showLabel={viewOptions.labels}
        onPick={() => onPick({ kind: "token", mint: ORBITX_MINT })}
      />
      {(districts?.hubs?.length ? districts.hubs : DEX_HUBS).map((hub, i) => {
        const a = (i / 3) * Math.PI * 2;
        const pos: [number, number, number] = [Math.cos(a) * 18.5, 1.4, Math.sin(a) * 18.5];
        const color = hub.id === "jupiter" ? "#22d3ee" : hub.id === "raydium" ? "#a78bfa" : "#fb923c";
        return (
          <group key={hub.id} position={pos} onClick={(e) => { e.stopPropagation(); onPick({ kind: "hub", id: hub.id }); }}>
            <mesh>
              <octahedronGeometry args={[0.42, 0]} />
              <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.1} />
            </mesh>
            {viewOptions.labels ? (
              <Text position={[0, 0.82, 0]} fontSize={0.2} color={color} anchorX="center" outlineWidth={0.012} outlineColor="#05030c">
                {hub.label}
              </Text>
            ) : null}
          </group>
        );
      })}
      {tokens.map((t, i) => (
        <TokenStar
          key={t.mint}
          district={t}
          index={i}
          total={tokens.length}
          labeled={labeled.has(t.mint)}
          selected={selectedMint === t.mint}
          paused={paused}
          onPick={() => onPick({ kind: "token", mint: t.mint })}
        />
      ))}
      {viewOptions.figures
        ? assigned.map((k, i) => (
            <Agent
              key={k.address}
              label={k.name}
              kol
              whale={false}
              followed={followWallet === k.address}
              pos={walletPos(k.address, i, assigned.length, true)}
              paused={paused}
              onPick={() => onPick({ kind: "wallet", address: k.address })}
            />
          ))
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
      <CameraRig target={follow} controls={controls} cam={cam || null} stick={stick} speed={speed} />
      <OrbitControls
        ref={controls}
        enablePan
        enableZoom
        enableRotate={Math.abs(stick.x) < 0.04 && Math.abs(stick.y) < 0.04}
        maxDistance={180}
        minDistance={2.4}
        autoRotate={Boolean(cinematic) && !followWallet && !selectedMint && !paused && Math.abs(stick.x) < 0.04 && Math.abs(stick.y) < 0.04 && Math.abs(stick.z) < 0.04}
        autoRotateSpeed={0.18 * Math.max(speed, 1)}
      />
      <Glow />
    </>
  );
}

export default function WorldCanvas(props: Props) {
  return (
    <Canvas
      camera={{ position: [0, 18, 48], fov: 50, near: 0.1, far: 420 }}
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

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Sparkles, Stars, Text } from "@react-three/drei";
import { Bloom, EffectComposer, Vignette } from "@react-three/postprocessing";
import { Component, useEffect, useMemo, useRef, type ReactNode, type RefObject } from "react";
import type { Mesh } from "three";
import { Color, QuadraticBezierCurve3, TubeGeometry, Vector3 } from "three";
import type { ChainEvent, CityDistricts, FlowRow, KolCard, TokenDistrict } from "./api";
import { fmtNum, fmtUsd } from "./format";
import { isOrbitxMint, ORBITX_MINT } from "../../../shared/orbitx-chain-intel.js";
import { DEX_HUBS, tokenLabel, tokenTicker } from "../../../shared/orbitx-chain-districts.js";
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
  selectedMint?: string | null;
  cinematic?: boolean;
  cam?: CamCommand;
  onPick: (pick: WorldPick) => void;
  onReady?: () => void;
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

function hash(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return h >>> 0;
}

export function galaxyPos(mint: string, index: number, total: number): [number, number, number] {
  if (isOrbitxMint(mint)) return [0, 0, 0];
  const h = hash(mint);
  const arm = h % 4;
  const t = (index + 1) / Math.max(total, 1);
  const spiral = t * Math.PI * 3.6 + arm * (Math.PI / 2) + (h % 40) / 80;
  const r = 5.2 + t * 26 + (h % 18) / 14;
  const y = ((h % 21) - 10) * 0.28;
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
      <EffectComposer multisampling={0} disableNormalPass>
        <Bloom intensity={0.86} luminanceThreshold={0.18} luminanceSmoothing={0.42} mipmapBlur />
        <Vignette offset={0.22} darkness={0.7} />
      </EffectComposer>
    </FxCatch>
  );
}

function OrbitXCore({ district, pulsing, onPick }: { district?: TokenDistrict; pulsing: boolean; onPick: () => void }) {
  const glow = useRef<Mesh>(null);
  useFrame(({ clock }) => {
    if (!glow.current) return;
    const s = 1 + Math.sin(clock.elapsedTime * 1.8) * (pulsing ? 0.2 : 0.08);
    glow.current.scale.setScalar(s);
  });
  const cap = district?.market_cap != null ? fmtUsd(district.market_cap) : null;
  return (
    <group onClick={(e) => { e.stopPropagation(); onPick(); }}>
      <mesh>
        <sphereGeometry args={[1.15, 32, 32]} />
        <meshStandardMaterial color="#2e1064" emissive="#7c3aed" emissiveIntensity={1.15} metalness={0.35} roughness={0.2} />
      </mesh>
      <mesh ref={glow}>
        <sphereGeometry args={[1.55, 24, 24]} />
        <meshBasicMaterial color="#c084fc" transparent opacity={0.16} />
      </mesh>
      <Sparkles count={48} scale={[3.2, 3.2, 3.2]} size={3.4} color="#e9d5ff" />
      <pointLight position={[0, 0.4, 0]} intensity={pulsing ? 70 : 46} distance={28} color="#c084fc" />
      <Text position={[0, 2.15, 0]} fontSize={0.38} color="#f5d0fe" anchorX="center" outlineWidth={0.025} outlineColor="#12081c">
        {cap ? `OrbitX  ${cap}` : "OrbitX"}
      </Text>
    </group>
  );
}

function TokenStar({
  district,
  index,
  total,
  labeled,
  selected,
  onPick,
}: {
  district: TokenDistrict;
  index: number;
  total: number;
  labeled: boolean;
  selected: boolean;
  onPick: () => void;
}) {
  const pos = useMemo(() => galaxyPos(district.mint, index, total), [district.mint, index, total]);
  const volume = district.volume_24h || district.market_cap || 12;
  const r = selected ? 0.38 : Math.min(0.28, 0.07 + Math.log10(Math.max(volume, 12)) * 0.035);
  const color = nodeColor(district.mint, volume);
  const name = tokenLabel(district);
  const ticker = tokenTicker(district);
  const sub = district.volume_24h != null ? `${fmtNum(district.volume_24h)} VOL` : district.market_cap != null ? fmtUsd(district.market_cap) : "";
  return (
    <group position={pos} onClick={(e) => { e.stopPropagation(); onPick(); }}>
      <mesh>
        <sphereGeometry args={[r, selected ? 18 : 10, selected ? 18 : 10]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={selected ? 1.6 : 0.85} metalness={0.2} roughness={0.28} />
      </mesh>
      {selected ? (
        <mesh>
          <ringGeometry args={[r + 0.18, r + 0.26, 24]} />
          <meshBasicMaterial color={color} transparent opacity={0.7} side={2} />
        </mesh>
      ) : null}
      {labeled ? (
        <Text position={[0, r + 0.42, 0]} fontSize={selected ? 0.22 : 0.16} color="#eef2ff" anchorX="center" outlineWidth={0.014} outlineColor="#05030c">
          {name}
        </Text>
      ) : null}
      {selected && ticker ? (
        <Text position={[0, r + 0.68, 0]} fontSize={0.13} color="#a5b4fc" anchorX="center" outlineWidth={0.01} outlineColor="#05030c">
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
  onPick,
}: {
  event: ChainEvent;
  from: [number, number, number];
  to: [number, number, number];
  highlight: boolean;
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
    const t = (clock.elapsedTime * (0.28 + Math.min(event.importance, 50) / 90) + hash(event.event_id) / 1e9) % 1;
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
}: {
  target: [number, number, number] | null;
  controls: RefObject<{ target: Vector3 } | null>;
  cam: CamCommand;
}) {
  const { camera } = useThree();
  const goal = useRef(new Vector3(0, 12, 34));
  useEffect(() => {
    if (cam?.kind === "reset") goal.current.set(0, 12, 34);
    if (cam?.kind === "orbitx") goal.current.set(4.2, 5.4, 8.6);
    if (target && (cam?.kind === "follow" || cam?.kind === "wallet" || cam?.kind === "token")) {
      goal.current.set(target[0] + 4.6, target[1] + 3.8, target[2] + 6.4);
    }
  }, [cam, target]);
  useFrame(() => {
    camera.position.lerp(goal.current, 0.04);
    if (target && controls.current && cam && cam.kind !== "reset") {
      controls.current.target.lerp(new Vector3(target[0], target[1], target[2]), 0.06);
    }
  });
  return null;
}

function Scene({ events, kols, districts, followId, followWallet, selectedMint, cinematic, cam, onPick }: Props) {
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
    tokens.slice(0, 12).forEach((t) => set.add(t.mint));
    if (selectedMint) set.add(selectedMint);
    return set;
  }, [tokens, selectedMint]);

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

  const vis = events
    .filter((e) => e.importance >= 4 || e.orbitx_related || e.kol_related || e.event_type.includes("SWAP") || e.event_type.includes("BUY") || e.event_type.includes("SELL"))
    .slice(0, 64);
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
      <fog attach="fog" args={["#02010a", 18, 70]} />
      <ambientLight intensity={0.18} />
      <directionalLight position={[8, 16, 10]} intensity={0.55} color="#ddd6fe" />
      <pointLight position={[0, 2, 0]} intensity={28} distance={22} color="#c084fc" />
      <Stars radius={120} depth={50} count={4200} factor={2.6} fade speed={0.22} />
      <OrbitXCore district={districts?.orbitx} pulsing={burns.length > 0} onPick={() => onPick({ kind: "token", mint: ORBITX_MINT })} />
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
            <Text position={[0, 0.82, 0]} fontSize={0.2} color={color} anchorX="center" outlineWidth={0.012} outlineColor="#05030c">
              {hub.label}
            </Text>
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
          onPick={() => onPick({ kind: "token", mint: t.mint })}
        />
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
      {holders.map((h, i) => {
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
            onPick={() => onPick({ kind: "wallet", address: h.address })}
          />
        );
      })}
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
            onPick={() => onPick({ kind: "event", event })}
          />
        );
      })}
      <CameraRig target={follow} controls={controls} cam={cam || null} />
      <OrbitControls
        ref={controls}
        enablePan
        enableZoom
        maxDistance={62}
        minDistance={4}
        autoRotate={Boolean(cinematic) && !followWallet && !selectedMint}
        autoRotateSpeed={0.22}
      />
      <Glow />
    </>
  );
}

export default function WorldCanvas(props: Props) {
  return (
    <Canvas
      camera={{ position: [0, 12, 34], fov: 46 }}
      dpr={1}
      gl={{ antialias: false, alpha: false, powerPreference: "default", failIfMajorPerformanceCaveat: false, stencil: false }}
      onCreated={() => props.onReady?.()}
    >
      <Scene {...props} />
    </Canvas>
  );
}

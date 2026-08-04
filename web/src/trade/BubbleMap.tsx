/**
 * Full-quality 3D holder / cluster bubble map for /trade token pages.
 * Merges ogdex xray (early buyers, snipers, bundles, insiders) + top holders.
 */

import {
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
  type MutableRefObject,
} from "react";
import { Canvas, useFrame, type ThreeEvent } from "@react-three/fiber";
import { OrbitControls, Html, Stars, ContactShadows, Line } from "@react-three/drei";
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";
import * as THREE from "three";
import {
  ExternalLink, Loader2, Maximize2, Minimize2, Crosshair, RefreshCw, Users,
} from "lucide-react";
import { Link } from "react-router-dom";
import { shortAddr } from "./tradeFmt";

export type BubbleXray = {
  ok?: boolean;
  traced?: boolean;
  verdict?: string;
  tone?: "red" | "yellow" | "green";
  score?: number;
  summary?: string;
  note?: string | null;
  earlyBuyers?: Array<{
    wallet: string;
    tokenAmount?: number;
    solSpent?: number;
    txHash?: string | null;
    slot?: number;
    time?: number;
    funder?: string | null;
  }>;
  snipers?: {
    pct?: number | null;
    count?: number | null;
    wallets?: Array<{
      wallet: string;
      solSpent?: number;
      secondsAfterLaunch?: number | null;
      txHash?: string | null;
      bundled?: boolean;
    }>;
  };
  bundles?: {
    pct?: number | null;
    count?: number | null;
    clusters?: Array<{ slot?: number; size?: number; wallets: string[] }>;
  };
  insiders?: {
    pct?: number | null;
    count?: number | null;
    clusters?: Array<{ funder: string; size?: number; wallets: string[] }>;
  };
  concentration?: {
    top10Pct?: number | null;
    whales?: number;
    totalHolders?: number | null;
  };
  dev?: { wallet?: string; pct?: number | null; sold?: boolean | null } | null;
};

export type BubbleHolder = {
  owner?: string;
  wallet?: string;
  address?: string;
  pct?: number | null;
  uiAmount?: number;
  amount?: number;
  usdValue?: number | null;
};

type Tag = "dev" | "insider" | "bundle" | "sniper" | "whale" | "holder" | "funder";

type BubbleNode = {
  id: string;
  wallet: string;
  tag: Tag;
  label: string;
  size: number;
  pct: number;
  solSpent: number;
  tokens: number;
  usd: number;
  degree: number;
  funder: string | null;
  txHash: string | null;
  color: string;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
};

type BubbleLink = { a: number; b: number; color: string };

const COLORS: Record<Tag, string> = {
  dev: "#c084fc",
  insider: "#ff5c5c",
  bundle: "#ff9f1c",
  sniper: "#ffd60a",
  whale: "#f0abfc",
  holder: "#2dd4bf",
  funder: "#fb7185",
};

const FILTERS: { id: Tag | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "whale", label: "Whale" },
  { id: "sniper", label: "Sniper" },
  { id: "bundle", label: "Bundle" },
  { id: "insider", label: "Insider" },
  { id: "dev", label: "Dev" },
  { id: "holder", label: "Holder" },
];

function walletOf(h: BubbleHolder): string | null {
  const w = h.owner || h.wallet || h.address;
  return w ? String(w) : null;
}

function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function rng(seed: number) {
  let s = seed || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Build graph from xray + holders — prefers fuller of the two. */
export function buildBubbleGraph(
  xray: BubbleXray | null | undefined,
  holders: BubbleHolder[] | null | undefined,
): { nodes: BubbleNode[]; links: BubbleLink[]; stats: Record<string, number | string | null> } {
  const x = xray?.ok !== false ? xray || {} : {};
  const holderList = Array.isArray(holders) ? holders : [];
  const sniperMap = new Map((x.snipers?.wallets || []).map((w) => [w.wallet, w]));
  const bundleSet = new Set((x.bundles?.clusters || []).flatMap((c) => c.wallets || []));
  const insiderSet = new Set((x.insiders?.clusters || []).flatMap((c) => c.wallets || []));
  const funderOf = new Map<string, string>();
  for (const cl of x.insiders?.clusters || []) {
    for (const w of cl.wallets || []) funderOf.set(w, cl.funder);
  }
  const degree = new Map<string, number>();
  const bump = (w: string, n = 1) => degree.set(w, (degree.get(w) || 0) + n);
  for (const cl of x.insiders?.clusters || []) {
    bump(cl.funder, (cl.wallets || []).length);
    for (const w of cl.wallets || []) bump(w);
  }
  for (const bd of x.bundles?.clusters || []) {
    for (const w of bd.wallets || []) bump(w, Math.max(1, (bd.wallets || []).length - 1));
  }

  const byWallet = new Map<string, Partial<BubbleNode> & { wallet: string }>();
  const upsert = (wallet: string, patch: Partial<BubbleNode>) => {
    const cur = byWallet.get(wallet) || { wallet };
    byWallet.set(wallet, { ...cur, ...patch, wallet });
  };

  for (const b of x.earlyBuyers || []) {
    if (!b?.wallet) continue;
    const tag: Tag =
      x.dev?.wallet && b.wallet === x.dev.wallet
        ? "dev"
        : insiderSet.has(b.wallet)
          ? "insider"
          : bundleSet.has(b.wallet)
            ? "bundle"
            : sniperMap.has(b.wallet)
              ? "sniper"
              : "holder";
    upsert(b.wallet, {
      tag,
      solSpent: b.solSpent ?? sniperMap.get(b.wallet)?.solSpent ?? 0,
      tokens: b.tokenAmount ?? 0,
      funder: b.funder ?? funderOf.get(b.wallet) ?? null,
      txHash: b.txHash ?? sniperMap.get(b.wallet)?.txHash ?? null,
      degree: degree.get(b.wallet) || 0,
    });
  }

  for (const s of x.snipers?.wallets || []) {
    if (!s?.wallet) continue;
    const prev = byWallet.get(s.wallet);
    upsert(s.wallet, {
      tag: prev?.tag === "dev" || prev?.tag === "insider" || prev?.tag === "bundle" ? prev.tag : "sniper",
      solSpent: Math.max(prev?.solSpent || 0, s.solSpent || 0),
      txHash: prev?.txHash || s.txHash || null,
      degree: degree.get(s.wallet) || prev?.degree || 0,
      funder: prev?.funder || funderOf.get(s.wallet) || null,
    });
  }

  if (x.dev?.wallet) {
    upsert(x.dev.wallet, {
      tag: "dev",
      pct: x.dev.pct ?? byWallet.get(x.dev.wallet)?.pct ?? 0,
      degree: degree.get(x.dev.wallet) || 0,
    });
  }

  for (const h of holderList) {
    const w = walletOf(h);
    if (!w) continue;
    const prev = byWallet.get(w);
    const pct = Number(h.pct) || 0;
    const tokens = Number(h.uiAmount ?? h.amount) || 0;
    const usd = Number(h.usdValue) || 0;
    let tag: Tag = prev?.tag || "holder";
    if (tag === "holder" && pct >= 1) tag = "whale";
    if (x.dev?.wallet === w) tag = "dev";
    else if (insiderSet.has(w)) tag = "insider";
    else if (bundleSet.has(w)) tag = "bundle";
    else if (sniperMap.has(w)) tag = "sniper";
    upsert(w, {
      tag,
      pct: Math.max(prev?.pct || 0, pct),
      tokens: Math.max(prev?.tokens || 0, tokens),
      usd: Math.max(prev?.usd || 0, usd),
      degree: Math.max(prev?.degree || 0, degree.get(w) || 0),
      funder: prev?.funder || funderOf.get(w) || null,
    });
  }

  // Ensure funders appear
  for (const cl of x.insiders?.clusters || []) {
    if (!cl.funder) continue;
    if (!byWallet.has(cl.funder)) {
      upsert(cl.funder, {
        tag: "funder",
        degree: (cl.wallets || []).length,
        pct: 0,
        tokens: 0,
        solSpent: 0,
        usd: 0,
      });
    } else if (byWallet.get(cl.funder)?.tag === "holder") {
      upsert(cl.funder, { tag: "funder" });
    }
  }

  const rows = [...byWallet.values()]
    .filter((r) => r.wallet)
    .sort((a, b) => {
      const sa = (a.pct || 0) * 1000 + (a.solSpent || 0) * 10 + (a.tokens || 0);
      const sb = (b.pct || 0) * 1000 + (b.solSpent || 0) * 10 + (b.tokens || 0);
      return sb - sa;
    })
    .slice(0, 120);

  const maxPct = Math.max(...rows.map((r) => r.pct || 0), 0.01);
  const maxSol = Math.max(...rows.map((r) => r.solSpent || 0), 0.01);
  const maxTok = Math.max(...rows.map((r) => r.tokens || 0), 0.01);
  const rand = rng(hashSeed(rows.map((r) => r.wallet).join("|").slice(0, 80)) || 1);

  const nodes: BubbleNode[] = rows.map((r) => {
    const tag = (r.tag || "holder") as Tag;
    const strength = Math.max(
      (r.pct || 0) / maxPct,
      Math.sqrt((r.solSpent || 0) / maxSol) * 0.85,
      Math.sqrt((r.tokens || 0) / maxTok) * 0.55,
    );
    const size = 0.28 + 1.35 * Math.max(0.12, strength);
    const u = rand();
    const v = rand();
    const theta = u * Math.PI * 2;
    const phi = Math.acos(2 * v - 1);
    const rad = 3.2 + rand() * 4.8;
    const pos = new THREE.Vector3(
      rad * Math.sin(phi) * Math.cos(theta),
      rad * Math.cos(phi) * 0.75,
      rad * Math.sin(phi) * Math.sin(theta),
    );
    return {
      id: r.wallet,
      wallet: r.wallet,
      tag,
      label: tag === "dev" ? `DEV ${shortAddr(r.wallet, 4)}` : shortAddr(r.wallet, 4),
      size,
      pct: r.pct || 0,
      solSpent: r.solSpent || 0,
      tokens: r.tokens || 0,
      usd: r.usd || 0,
      degree: r.degree || 0,
      funder: r.funder || null,
      txHash: r.txHash || null,
      color: COLORS[tag],
      pos,
      vel: new THREE.Vector3((rand() - 0.5) * 0.02, (rand() - 0.5) * 0.02, (rand() - 0.5) * 0.02),
    };
  });

  const idx = new Map(nodes.map((n, i) => [n.wallet, i]));
  const links: BubbleLink[] = [];
  const addLink = (a?: string | null, b?: string | null, color = COLORS.insider) => {
    if (!a || !b || a === b) return;
    const ia = idx.get(a);
    const ib = idx.get(b);
    if (ia == null || ib == null) return;
    links.push({ a: ia, b: ib, color });
  };
  for (const cl of x.insiders?.clusters || []) {
    for (const w of cl.wallets || []) addLink(cl.funder, w, COLORS.insider);
  }
  for (const bd of x.bundles?.clusters || []) {
    const ws = bd.wallets || [];
    for (let i = 1; i < ws.length; i++) addLink(ws[0], ws[i], COLORS.bundle);
  }

  const stats = {
    nodes: nodes.length,
    links: links.length,
    top10: x.concentration?.top10Pct ?? null,
    snipers: x.snipers?.pct ?? null,
    bundles: x.bundles?.pct ?? null,
    insiders: x.insiders?.pct ?? null,
    holders: x.concentration?.totalHolders ?? holderList.length,
    score: x.score ?? null,
    verdict: x.verdict ?? null,
  };

  return { nodes, links, stats };
}

function LinkLines({
  links,
  positions,
}: {
  links: BubbleLink[];
  positions: MutableRefObject<THREE.Vector3[]>;
}) {
  return (
    <group>
      {links.slice(0, 80).map((L, i) => {
        const a = positions.current[L.a];
        const b = positions.current[L.b];
        if (!a || !b) return null;
        return (
          <Line
            key={`l-${i}`}
            points={[a.clone(), b.clone()]}
            color={L.color}
            transparent
            opacity={0.32}
            lineWidth={1}
          />
        );
      })}
    </group>
  );
}

function ForceSim({
  nodes,
  links,
  filter,
  selected,
  onSelect,
}: {
  nodes: BubbleNode[];
  links: BubbleLink[];
  filter: Tag | "all";
  selected: string | null;
  onSelect: (wallet: string | null) => void;
}) {
  const meshRefs = useRef<(THREE.Mesh | null)[]>([]);
  const positions = useRef(nodes.map((n) => n.pos.clone()));
  const velocities = useRef(nodes.map((n) => n.vel.clone()));
  const tick = useRef(0);
  const [, bump] = useState(0);

  useEffect(() => {
    positions.current = nodes.map((n) => n.pos.clone());
    velocities.current = nodes.map((n) => n.vel.clone());
    meshRefs.current = meshRefs.current.slice(0, nodes.length);
  }, [nodes]);

  useFrame((_, dt) => {
    const t = Math.min(0.033, dt);
    const pos = positions.current;
    const vel = velocities.current;
    const n = nodes.length;
    if (!n) return;

    for (let i = 0; i < n; i++) {
      vel[i].x -= pos[i].x * 0.012 * t * 60;
      vel[i].y -= pos[i].y * 0.014 * t * 60;
      vel[i].z -= pos[i].z * 0.012 * t * 60;
    }

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const dx = pos[i].x - pos[j].x;
        const dy = pos[i].y - pos[j].y;
        const dz = pos[i].z - pos[j].z;
        const dist2 = dx * dx + dy * dy + dz * dz + 0.05;
        const dist = Math.sqrt(dist2);
        const minD = (nodes[i].size + nodes[j].size) * 1.35 + 0.35;
        if (dist < minD * 3) {
          const f = ((minD - dist) / dist) * 0.08;
          vel[i].x += dx * f;
          vel[i].y += dy * f;
          vel[i].z += dz * f;
          vel[j].x -= dx * f;
          vel[j].y -= dy * f;
          vel[j].z -= dz * f;
        }
      }
    }

    for (const L of links) {
      const a = pos[L.a];
      const b = pos[L.b];
      if (!a || !b) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dz = b.z - a.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) + 0.001;
      const f = (dist - 1.6) * 0.02;
      const fx = (dx / dist) * f;
      const fy = (dy / dist) * f;
      const fz = (dz / dist) * f;
      vel[L.a].x += fx;
      vel[L.a].y += fy;
      vel[L.a].z += fz;
      vel[L.b].x -= fx;
      vel[L.b].y -= fy;
      vel[L.b].z -= fz;
    }

    for (let i = 0; i < n; i++) {
      vel[i].multiplyScalar(0.92);
      pos[i].addScaledVector(vel[i], t * 60);
      const m = meshRefs.current[i];
      if (m) m.position.copy(pos[i]);
    }

    tick.current += 1;
    if (tick.current % 3 === 0) bump((x) => (x + 1) % 1000);
  });

  return (
    <group>
      <LinkLines links={links} positions={positions} />
      {nodes.map((n, i) => {
        const dim = filter !== "all" && n.tag !== filter && !(filter === "whale" && n.pct >= 1);
        const isSel = selected === n.wallet;
        return (
          <mesh
            key={n.id}
            ref={(el) => {
              meshRefs.current[i] = el;
            }}
            position={n.pos}
            scale={isSel ? n.size * 1.18 : n.size}
            onClick={(e: ThreeEvent<MouseEvent>) => {
              e.stopPropagation();
              onSelect(n.wallet);
            }}
            onPointerOver={(e) => {
              e.stopPropagation();
              document.body.style.cursor = "pointer";
            }}
            onPointerOut={() => {
              document.body.style.cursor = "default";
            }}
          >
            <sphereGeometry args={[1, 28, 28]} />
            <meshStandardMaterial
              color={n.color}
              emissive={n.color}
              emissiveIntensity={isSel ? 0.85 : 0.35}
              roughness={0.28}
              metalness={0.35}
              transparent
              opacity={dim ? 0.14 : 0.92}
            />
            {(isSel || n.tag === "dev" || n.pct >= 2) && (
              <Html distanceFactor={14} position={[0, 1.35, 0]} center style={{ pointerEvents: "none" }}>
                <div className="whitespace-nowrap rounded bg-black/70 px-1.5 py-0.5 font-mono text-[9px] text-white/90">
                  {n.label}
                  {n.pct > 0 ? ` · ${n.pct.toFixed(1)}%` : ""}
                </div>
              </Html>
            )}
          </mesh>
        );
      })}
    </group>
  );
}

function Scene({
  nodes,
  links,
  filter,
  selected,
  onSelect,
}: {
  nodes: BubbleNode[];
  links: BubbleLink[];
  filter: Tag | "all";
  selected: string | null;
  onSelect: (w: string | null) => void;
}) {
  return (
    <>
      <color attach="background" args={["#050508"]} />
      <ambientLight intensity={0.35} />
      <pointLight position={[8, 10, 6]} intensity={1.2} color="#a5f3fc" />
      <pointLight position={[-8, -4, -6]} intensity={0.7} color="#c084fc" />
      <spotLight position={[0, 12, 0]} intensity={0.5} angle={0.6} penumbra={0.8} />
      <Stars radius={60} depth={40} count={1200} factor={3} saturation={0} fade speed={0.4} />
      <ForceSim nodes={nodes} links={links} filter={filter} selected={selected} onSelect={onSelect} />
      <ContactShadows position={[0, -6.2, 0]} opacity={0.35} scale={28} blur={2.5} far={12} />
      <OrbitControls
        makeDefault
        enablePan
        enableDamping
        dampingFactor={0.08}
        minDistance={4}
        maxDistance={28}
        autoRotate
        autoRotateSpeed={0.45}
      />
      <EffectComposer multisampling={0}>
        <Bloom luminanceThreshold={0.35} luminanceSmoothing={0.7} intensity={0.85} mipmapBlur />
        <Vignette eskil={false} offset={0.15} darkness={0.55} />
      </EffectComposer>
    </>
  );
}

const PARTNER =
  (typeof import.meta !== "undefined" &&
    (import.meta as ImportMeta & { env?: Record<string, string> }).env?.VITE_BUBBLEMAPS_PARTNER_ID) ||
  "demo";

function externalBubblemapsUrl(address: string, chain = "solana") {
  const raw = String(chain || "solana").toLowerCase();
  const chainId =
    raw === "sol" || raw === "solana"
      ? "solana"
      : raw === "ethereum" || raw === "eth"
        ? "eth"
        : raw === "bnb"
          ? "bsc"
          : raw;
  return `https://iframe.bubblemaps.io/map?chain=${encodeURIComponent(chainId)}&address=${encodeURIComponent(address)}&partnerId=${encodeURIComponent(PARTNER)}`;
}

export function BubbleMap({
  address,
  chain = "solana",
  xray,
  holders,
  holderCount,
  height = 640,
  onRefresh,
  refreshing,
}: {
  address: string;
  chain?: string;
  xray?: BubbleXray | null;
  holders?: BubbleHolder[] | null;
  holderCount?: number | null;
  height?: number;
  onRefresh?: () => void;
  refreshing?: boolean;
}) {
  const [filter, setFilter] = useState<Tag | "all">("all");
  const [selected, setSelected] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const graph = useMemo(() => buildBubbleGraph(xray, holders), [xray, holders]);
  const selectedNode = graph.nodes.find((n) => n.wallet === selected) || null;
  const ext = address ? externalBubblemapsUrl(address, chain) : "";

  const onSelect = useCallback((w: string | null) => setSelected(w), []);

  if (!address) {
    return <p className="py-10 text-center text-xs text-white/35">No token address for map</p>;
  }

  const shell = (
    <div
      className={`flex flex-col overflow-hidden rounded-xl border border-white/10 bg-[#050508] ${
        fullscreen ? "fixed inset-3 z-[80]" : ""
      }`}
      style={fullscreen ? undefined : { minHeight: height }}
    >
      {/* toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-white/10 px-3 py-2">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-white/55">
          <Crosshair className="h-3.5 w-3.5 text-cyan-300/80" />
          3D Cluster Map
        </div>
        <div className="flex flex-wrap gap-1">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={`rounded-full px-2 py-0.5 text-[10px] ${
                filter === f.id ? "bg-white/15 text-white" : "text-white/40 hover:text-white/70"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={refreshing}
              className="inline-flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-[10px] text-white/55 hover:text-white"
            >
              <RefreshCw className={`h-3 w-3 ${refreshing ? "animate-spin" : ""}`} />
              Refresh data
            </button>
          )}
          <a
            href={ext}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-[10px] text-white/40 hover:text-white"
          >
            Bubblemaps <ExternalLink className="h-3 w-3" />
          </a>
          <button
            type="button"
            onClick={() => setFullscreen((v) => !v)}
            className="rounded-md border border-white/10 p-1 text-white/50 hover:text-white"
            title={fullscreen ? "Exit fullscreen" : "Fullscreen"}
          >
            {fullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      {/* stats */}
      <div className="grid grid-cols-2 gap-2 border-b border-white/10 px-3 py-2 sm:grid-cols-4 lg:grid-cols-7">
        {[
          ["Nodes", graph.stats.nodes],
          ["Links", graph.stats.links],
          ["Holders", holderCount ?? graph.stats.holders ?? "—"],
          ["Top10", graph.stats.top10 != null ? `${Number(graph.stats.top10).toFixed(1)}%` : "—"],
          ["Snipers", graph.stats.snipers != null ? `${Number(graph.stats.snipers).toFixed(1)}%` : "—"],
          ["Bundles", graph.stats.bundles != null ? `${Number(graph.stats.bundles).toFixed(1)}%` : "—"],
          ["Score", graph.stats.score ?? "—"],
        ].map(([k, v]) => (
          <div key={String(k)} className="rounded-lg bg-white/[0.03] px-2 py-1.5">
            <p className="text-[9px] uppercase tracking-wide text-white/30">{k}</p>
            <p className="font-mono text-xs text-white/85">{v as any}</p>
          </div>
        ))}
      </div>

      <div className={`relative flex-1 ${fullscreen ? "min-h-0" : ""}`} style={fullscreen ? undefined : { height }}>
        {!graph.nodes.length ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-4 text-center">
            <Users className="h-7 w-7 text-white/20" />
            <p className="text-xs text-white/40">
              {xray?.note || "Waiting on holder / x-ray data for this mint…"}
            </p>
            {onRefresh && (
              <button
                type="button"
                onClick={onRefresh}
                className="mt-1 rounded-md border border-white/15 px-3 py-1.5 text-[11px] text-white/70 hover:bg-white/5"
              >
                Pull latest data
              </button>
            )}
          </div>
        ) : (
          <Suspense
            fallback={
              <div className="absolute inset-0 flex items-center justify-center gap-2 text-xs text-white/35">
                <Loader2 className="h-5 w-5 animate-spin" /> Loading 3D map…
              </div>
            }
          >
            <Canvas
              dpr={[1, 1.75]}
              camera={{ position: [0, 2.5, 11], fov: 50, near: 0.1, far: 200 }}
              gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
              onPointerMissed={() => setSelected(null)}
            >
              <Scene
                nodes={graph.nodes}
                links={graph.links}
                filter={filter}
                selected={selected}
                onSelect={onSelect}
              />
            </Canvas>
          </Suspense>
        )}

        {selectedNode && (
          <div className="absolute bottom-3 left-3 right-3 z-10 max-w-md rounded-xl border border-white/15 bg-black/80 p-3 backdrop-blur sm:right-auto">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-mono text-sm text-white">{shortAddr(selectedNode.wallet, 6)}</p>
                <p className="mt-0.5 text-[10px] uppercase tracking-wide" style={{ color: selectedNode.color }}>
                  {selectedNode.tag}
                  {selectedNode.degree ? ` · ${selectedNode.degree} links` : ""}
                </p>
              </div>
              <Link
                to={`/trade/wallet/${selectedNode.wallet}`}
                className="text-[10px] text-cyan-300/80 hover:text-cyan-200"
              >
                Open wallet →
              </Link>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2 text-[10px]">
              <div>
                <p className="text-white/30">Share</p>
                <p className="font-mono text-white/85">
                  {selectedNode.pct ? `${selectedNode.pct.toFixed(2)}%` : "—"}
                </p>
              </div>
              <div>
                <p className="text-white/30">Tokens</p>
                <p className="font-mono text-white/85">
                  {selectedNode.tokens ? selectedNode.tokens.toLocaleString(undefined, { maximumFractionDigits: 0 }) : "—"}
                </p>
              </div>
              <div>
                <p className="text-white/30">SOL spent</p>
                <p className="font-mono text-white/85">
                  {selectedNode.solSpent ? selectedNode.solSpent.toFixed(2) : "—"}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {(xray?.verdict || xray?.summary) && (
        <div className="border-t border-white/10 px-3 py-2 text-[11px] text-white/45">
          <span className="font-semibold text-white/70">{xray.verdict}</span>
          {xray.summary ? ` — ${xray.summary}` : ""}
        </div>
      )}
    </div>
  );

  return shell;
}

export default BubbleMap;

import { useRef, useEffect, useState, useCallback, useMemo } from "react";
import {
  ExternalLink, ZoomIn, ZoomOut, Maximize2, Crosshair, Search,
  Play, Pause, Download, Copy, Check, Focus, Layers, Clock,
  Network, Sparkles, Pin, X, Minimize2,
} from "lucide-react";

/** Minimal X-ray shape needed by the bubble graph (from /api/ogdex/xray). */
export interface XrayReport {
  ok: boolean;
  mint?: string;
  traced?: boolean;
  verdict?: string;
  tone?: "red" | "yellow" | "green";
  score?: number;
  summary?: string;
  earlyBuyers?: Array<{
    wallet: string;
    tokenAmount?: number;
    solSpent?: number;
    txHash?: string | null;
    slot?: number;
    time?: number;
    funder?: string | null;
    rank?: number;
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
    clusters?: Array<{ slot: number; size?: number; wallets: string[] }>;
  };
  insiders?: {
    pct?: number | null;
    count?: number | null;
    clusters?: Array<{ funder: string; size?: number; wallets: string[] }>;
  };
  concentration?: { top10Pct?: number | null; whales?: number; totalHolders?: number | null };
  dev?: { wallet?: string; pct?: number | null; sold?: boolean | null } | null;
  note?: string | null;
}

function short(addr?: string | null): string {
  if (!addr) return "—";
  return addr.slice(0, 4) + "…" + addr.slice(-4);
}

type RiskTag = "insider" | "bundle" | "sniper" | "clean" | "dev";
type LayoutMode = "force" | "radial" | "timeline" | "cluster";
type SizeMode = "sol" | "tokens" | "equal";
type FilterTag = RiskTag | "all" | "whale" | "linked";

interface RichBuyer {
  wallet: string;
  tokenAmount: number;
  solSpent: number;
  txHash: string | null;
  slot: number;
  time: number;
  tag: RiskTag;
  secondsAfterLaunch: number | null;
  funder: string | null;
  degree: number;
  whaleRank: number | null;
  sharePct: number;
}

interface Node {
  id: string;
  kind: "wallet" | "funder" | "bundleHub" | "dev";
  wallet?: string;
  label: string;
  r: number;
  baseR: number;
  color: string;
  x: number; y: number;
  vx: number; vy: number;
  tx: number; ty: number;
  z: number;
  mass: number;
  phase: number;
  tag?: RiskTag;
  solSpent: number;
  tokenAmount?: number;
  txHash?: string | null;
  slot?: number;
  secondsAfterLaunch?: number | null;
  funder?: string | null;
  degree: number;
  whaleRank: number | null;
  sharePct: number;
  visible: boolean;
  pinned: boolean;
}

interface Link {
  a: number; b: number;
  pt: number;
  pt2: number;
  color: string;
  kind: "funder" | "bundle" | "dev";
  strength: number;
}

interface Graph {
  nodes: Node[];
  links: Link[];
  adj: Record<number, Set<number>>;
}

const C = {
  insider: "#FF5C5C",
  bundle: "#ff9f1c",
  sniper: "#ffd60a",
  clean: "#2dd4bf",
  dev: "#c084fc",
  funder: "#FF5C5C",
  bundleHub: "#ff9f1c",
  accent: "#22d3ee",
  whale: "#f0abfc",
} as const;

const TAG_ORDER: RiskTag[] = ["dev", "insider", "bundle", "sniper", "clean"];
const RADIAL_R: Record<RiskTag, number> = { dev: 0, insider: 70, bundle: 130, sniper: 190, clean: 250 };

function hexRgb(hex: string): string {
  const n = parseInt(hex.replace("#", ""), 16);
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
}

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function gini(values: number[]): number {
  const v = values.filter((x) => x > 0).sort((a, b) => a - b);
  if (v.length < 2) return 0;
  const n = v.length;
  let num = 0;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    num += (2 * (i + 1) - n - 1) * v[i];
    sum += v[i];
  }
  return sum > 0 ? num / (n * sum) : 0;
}

function enrichBuyers(x: XrayReport): RichBuyer[] {
  const sniperMap = new Map((x.snipers?.wallets || []).map((w) => [w.wallet, w]));
  const bundleSet = new Set((x.bundles?.clusters || []).flatMap((c) => c.wallets));
  const insiderSet = new Set((x.insiders?.clusters || []).flatMap((c) => c.wallets));
  const funderOf = new Map<string, string>();
  for (const cl of x.insiders?.clusters || []) for (const w of cl.wallets) funderOf.set(w, cl.funder);
  const degree = new Map<string, number>();
  const bump = (w: string, n = 1) => degree.set(w, (degree.get(w) || 0) + n);
  for (const cl of x.insiders?.clusters || []) {
    bump(cl.funder, cl.wallets.length);
    for (const w of cl.wallets) bump(w);
  }
  for (const bd of x.bundles?.clusters || []) for (const w of bd.wallets) bump(w, Math.max(1, bd.wallets.length - 1));

  const times = (x.earlyBuyers || []).map((b) => b.time || 0).filter(Boolean);
  const firstTime = times.length ? Math.min(...times) : 0;
  const devWallet = x.dev?.wallet || null;

  const raw: RichBuyer[] = (x.earlyBuyers || []).map((b) => {
    const tag: RiskTag =
      devWallet && b.wallet === devWallet ? "dev" :
      insiderSet.has(b.wallet) ? "insider" :
      bundleSet.has(b.wallet) ? "bundle" :
      sniperMap.has(b.wallet) ? "sniper" : "clean";
    const snap = sniperMap.get(b.wallet);
    return {
      wallet: b.wallet,
      tokenAmount: b.tokenAmount ?? 0,
      solSpent: b.solSpent ?? snap?.solSpent ?? 0,
      txHash: b.txHash ?? snap?.txHash ?? null,
      slot: b.slot ?? 0,
      time: b.time ?? 0,
      tag,
      secondsAfterLaunch: snap?.secondsAfterLaunch ?? (b.time && firstTime ? Math.round((b.time - firstTime) / 1000) : null),
      funder: b.funder ?? funderOf.get(b.wallet) ?? null,
      degree: degree.get(b.wallet) || 0,
      whaleRank: null,
      sharePct: 0,
    };
  });

  for (const s of x.snipers?.wallets || []) {
    if (raw.some((b) => b.wallet === s.wallet)) continue;
    raw.push({
      wallet: s.wallet, tokenAmount: 0, solSpent: s.solSpent ?? 0, txHash: s.txHash ?? null,
      slot: 0, time: 0, tag: bundleSet.has(s.wallet) ? "bundle" : "sniper",
      secondsAfterLaunch: s.secondsAfterLaunch ?? null, funder: funderOf.get(s.wallet) ?? null,
      degree: degree.get(s.wallet) || 0, whaleRank: null, sharePct: 0,
    });
  }
  if (devWallet && !raw.some((b) => b.wallet === devWallet)) {
    raw.unshift({
      wallet: devWallet, tokenAmount: 0, solSpent: 0, txHash: null, slot: 0, time: firstTime || 0,
      tag: "dev", secondsAfterLaunch: 0, funder: null, degree: degree.get(devWallet) || 0, whaleRank: null, sharePct: 0,
    });
  }

  const totalSol = raw.reduce((s, b) => s + b.solSpent, 0) || 1;
  [...raw].sort((a, b) => b.solSpent - a.solSpent).forEach((b, i) => { if (i < 5 && b.solSpent > 0) b.whaleRank = i + 1; });
  for (const b of raw) b.sharePct = (b.solSpent / totalSol) * 100;
  return raw.slice(0, 100);
}

function computeAnalytics(buyers: RichBuyer[], report: XrayReport) {
  const totalSol = buyers.reduce((s, b) => s + b.solSpent, 0);
  const riskSol = buyers.filter((b) => b.tag !== "clean" && b.tag !== "dev").reduce((s, b) => s + b.solSpent, 0);
  const linked = buyers.filter((b) => b.degree > 0).length;
  const maxSec = Math.max(0, ...buyers.map((b) => b.secondsAfterLaunch ?? 0));
  return {
    totalSol, buyerCount: buyers.length,
    riskSolPct: totalSol > 0 ? (riskSol / totalSol) * 100 : 0,
    gini: gini(buyers.map((b) => b.solSpent)),
    linkedPct: buyers.length ? (linked / buyers.length) * 100 : 0,
    sniperPct: report.snipers?.pct ?? null,
    bundlePct: report.bundles?.pct ?? null,
    clusterCount: (report.bundles?.clusters?.length || 0) + (report.insiders?.clusters?.length || 0),
    maxSec,
    verdict: report.verdict || null,
    tone: report.tone || ("yellow" as const),
    score: report.score ?? null,
  };
}

function nodeRadius(b: RichBuyer, sizeMode: SizeMode, maxSol: number, maxTok: number): number {
  if (sizeMode === "equal") return 14;
  const szSol = b.solSpent ? Math.sqrt(b.solSpent / maxSol) : 0;
  const szTok = b.tokenAmount ? Math.sqrt(b.tokenAmount / maxTok) : 0;
  const sz = sizeMode === "tokens" ? szTok : Math.max(szSol, szTok * 0.6);
  return 9 + 24 * Math.max(0.15, sz);
}

function buildGraph(report: XrayReport, W: number, H: number, sizeMode: SizeMode): Graph | null {
  const buyers = enrichBuyers(report);
  if (!buyers.length) return null;

  const maxSol = Math.max(...buyers.map((b) => b.solSpent), 0.001);
  const maxTok = Math.max(...buyers.map((b) => b.tokenAmount), 0.001);
  const rand = rng(buyers.length * 97 + 13);
  const nodes: Node[] = [];
  const idx: Record<string, number> = {};

  const push = (n: Omit<Node, "x" | "y" | "vx" | "vy" | "tx" | "ty" | "phase" | "visible" | "z" | "mass" | "pinned">) => {
    idx[n.id] = nodes.length;
    const z = rand() * 2 - 1;
    const x = W / 2 + (rand() - 0.5) * W * 0.5;
    const y = H / 2 + (rand() - 0.5) * H * 0.45;
    nodes.push({
      ...n, x, y, tx: x, ty: y, vx: (rand() - 0.5) * 1.2, vy: (rand() - 0.5) * 1.2,
      z, mass: Math.max(1, n.baseR / 10), phase: rand() * Math.PI * 2, visible: true, pinned: false,
    });
    return nodes.length - 1;
  };

  for (const b of buyers) {
    const r = nodeRadius(b, sizeMode, maxSol, maxTok);
    const isDev = b.tag === "dev";
    push({
      id: isDev ? "dev:" + b.wallet : "w:" + b.wallet,
      kind: isDev ? "dev" : "wallet",
      wallet: b.wallet,
      label: isDev ? "DEV " + short(b.wallet) : short(b.wallet),
      r, baseR: r,
      color: isDev ? C.dev : C[b.tag],
      tag: b.tag,
      solSpent: b.solSpent, tokenAmount: b.tokenAmount,
      txHash: b.txHash, slot: b.slot,
      secondsAfterLaunch: b.secondsAfterLaunch,
      funder: b.funder, degree: b.degree, whaleRank: b.whaleRank, sharePct: b.sharePct,
    });
  }

  for (const cl of report.insiders?.clusters || []) {
    push({
      id: "f:" + cl.funder, kind: "funder", wallet: cl.funder,
      label: "funder " + short(cl.funder), r: 13, baseR: 13,
      color: C.funder, solSpent: 0, degree: cl.wallets.length, whaleRank: null, sharePct: 0,
    });
  }

  (report.bundles?.clusters || []).forEach((bd, i) => {
    push({
      id: "bh:" + i, kind: "bundleHub",
      label: "slot " + bd.slot, r: 12, baseR: 12,
      color: C.bundleHub, solSpent: 0, degree: bd.wallets.length, whaleRank: null, sharePct: 0,
    });
  });

  const links: Link[] = [];
  for (const cl of report.insiders?.clusters || []) {
    const fi = idx["f:" + cl.funder];
    if (fi == null) continue;
    for (const w of cl.wallets) {
      const wi = idx["w:" + w] ?? idx["dev:" + w];
      if (wi != null) links.push({ a: wi, b: fi, pt: rand(), pt2: rand(), color: C.insider, kind: "funder", strength: 0.7 });
    }
  }
  (report.bundles?.clusters || []).forEach((bd, i) => {
    const bi = idx["bh:" + i];
    if (bi == null) return;
    for (const w of [...new Set(bd.wallets)]) {
      const wi = idx["w:" + w] ?? idx["dev:" + w];
      if (wi != null) links.push({ a: wi, b: bi, pt: rand(), pt2: rand(), color: C.bundleHub, kind: "bundle", strength: 0.85 });
    }
  });

  const adj: Record<number, Set<number>> = {};
  links.forEach((l) => {
    (adj[l.a] ??= new Set()).add(l.b);
    (adj[l.b] ??= new Set()).add(l.a);
  });

  return { nodes, links, adj };
}

function applyLayoutTargets(g: Graph, layout: LayoutMode, W: number, H: number, maxSec: number) {
  const cx = W / 2, cy = H / 2;
  const rand = rng(g.nodes.length * 31 + 7);

  if (layout === "radial") {
    const byTag: Record<string, number> = {};
    for (const n of g.nodes) {
      if (n.kind === "funder" || n.kind === "bundleHub") continue;
      const tag = n.tag || "clean";
      const i = byTag[tag] ?? 0;
      byTag[tag] = i + 1;
      const ring = RADIAL_R[tag as RiskTag] ?? 200;
      const ang = (i / Math.max(1, byTag[tag])) * Math.PI * 2 + rand() * 0.3;
      n.tx = cx + Math.cos(ang) * (ring + rand() * 20);
      n.ty = cy + Math.sin(ang) * (ring + rand() * 20);
    }
    let fi = 0;
    for (const n of g.nodes) {
      if (n.kind === "funder" || n.kind === "bundleHub") {
        const ang = (fi++ / 8) * Math.PI * 2;
        n.tx = cx + Math.cos(ang) * 300;
        n.ty = cy + Math.sin(ang) * 300;
      }
    }
  } else if (layout === "timeline") {
    const margin = 60;
    const span = W - margin * 2;
    for (const n of g.nodes) {
      if (n.kind !== "wallet" && n.kind !== "dev") {
        n.tx = cx; n.ty = cy + (rand() - 0.5) * 40;
        continue;
      }
      const sec = n.secondsAfterLaunch ?? 0;
      const t = maxSec > 0 ? sec / maxSec : 0;
      n.tx = margin + t * span;
      const tagIdx = TAG_ORDER.indexOf(n.tag || "clean");
      n.ty = cy + (tagIdx - 2) * 55 + (rand() - 0.5) * 30;
    }
  } else if (layout === "cluster") {
    const hubs = g.nodes.filter((n) => n.kind === "funder" || n.kind === "bundleHub");
    const grid = Math.ceil(Math.sqrt(hubs.length + 1));
    hubs.forEach((h, i) => {
      const col = i % grid, row = Math.floor(i / grid);
      h.tx = marginX(W, grid, col);
      h.ty = marginY(H, grid, row);
    });
    const orphan: Node[] = [];
    for (let ni = 0; ni < g.nodes.length; ni++) {
      const n = g.nodes[ni];
      if (n.kind === "funder" || n.kind === "bundleHub") continue;
      let hubIdx = -1;
      for (const l of g.links) {
        if (l.a === ni) { hubIdx = l.b; break; }
        if (l.b === ni) { hubIdx = l.a; break; }
      }
      if (hubIdx >= 0) {
        const hub = g.nodes[hubIdx];
        const members = g.links.filter((l) => l.a === hubIdx || l.b === hubIdx).length;
        const ang = rand() * Math.PI * 2;
        const dist = 45 + members * 4;
        n.tx = hub.tx + Math.cos(ang) * dist;
        n.ty = hub.ty + Math.sin(ang) * dist;
      } else {
        orphan.push(n);
      }
    }
    orphan.forEach((n, i) => {
      const ang = (i / Math.max(1, orphan.length)) * Math.PI * 2;
      n.tx = cx + Math.cos(ang) * 180;
      n.ty = cy + Math.sin(ang) * 180;
    });
  } else {
    for (const n of g.nodes) { n.tx = n.x; n.ty = n.y; }
  }
}

function marginX(W: number, grid: number, col: number) {
  const pad = 80;
  return pad + (col + 0.5) * ((W - pad * 2) / grid);
}
function marginY(H: number, grid: number, row: number) {
  const pad = 70;
  return pad + (row + 0.5) * ((H - pad * 2) / grid);
}

function tagCentroids(nodes: Node[]): Record<string, { x: number; y: number; n: number }> {
  const c: Record<string, { x: number; y: number; n: number }> = {};
  for (const n of nodes) {
    if (n.kind !== "wallet" && n.kind !== "dev") continue;
    const t = n.tag || "clean";
    (c[t] ??= { x: 0, y: 0, n: 0 });
    c[t].x += n.x; c[t].y += n.y; c[t].n++;
  }
  for (const k of Object.keys(c)) { c[k].x /= c[k].n; c[k].y /= c[k].n; }
  return c;
}

function stepPhysics(
  nodes: Node[], links: Link[], W: number, H: number, maxR: number,
  layout: LayoutMode, pinned: Set<number>,
) {
  const margin = maxR + 14;
  const useForce = layout === "force";
  const centroids = useForce ? tagCentroids(nodes) : null;

  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i], b = nodes[j];
      const dx = a.x - b.x, dy = a.y - b.y;
      const d2 = dx * dx + dy * dy || 0.01, d = Math.sqrt(d2);
      const minD = a.r + b.r + 14;
      const rep = 3400 / d2;
      const ux = dx / d, uy = dy / d;
      if (!pinned.has(i)) { a.vx += (ux * rep) / a.mass; a.vy += (uy * rep) / a.mass; }
      if (!pinned.has(j)) { b.vx -= (ux * rep) / b.mass; b.vy -= (uy * rep) / b.mass; }
      if (d < minD) {
        const p = (minD - d) * 0.5;
        if (!pinned.has(i)) { a.vx += ux * p; a.vy += uy * p; }
        if (!pinned.has(j)) { b.vx -= ux * p; b.vy -= uy * p; }
      }
    }
  }

  for (const l of links) {
    const a = nodes[l.a], b = nodes[l.b];
    const dx = b.x - a.x, dy = b.y - a.y;
    const d = Math.sqrt(dx * dx + dy * dy) || 0.01;
    const target = l.kind === "funder" ? 90 : 70;
    const f = (d - target) * 0.05 * l.strength;
    const ux = dx / d, uy = dy / d;
    if (!pinned.has(l.a)) { a.vx += ux * f; a.vy += uy * f; }
    if (!pinned.has(l.b)) { b.vx -= ux * f; b.vy -= uy * f; }
  }

  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    if (pinned.has(i)) { n.vx = 0; n.vy = 0; continue; }

    if (!useForce) {
      const pull = 0.08;
      n.vx += (n.tx - n.x) * pull;
      n.vy += (n.ty - n.y) * pull;
    } else if (centroids && n.tag && centroids[n.tag]) {
      const c = centroids[n.tag];
      n.vx += (c.x - n.x) * 0.0012;
      n.vy += (c.y - n.y) * 0.0012;
    }

    const g = 0.0026 + (n.mass - 1) * 0.0006;
    n.vx += (W / 2 - n.x) * g;
    n.vy += (H / 2 - n.y) * g;
    n.vx *= useForce ? 0.9 : 0.82;
    n.vy *= useForce ? 0.9 : 0.82;
    n.x += n.vx;
    n.y += n.vy;
    n.x = Math.max(margin, Math.min(W - margin, n.x));
    n.y = Math.max(margin, Math.min(H - margin, n.y));
  }
}

function convexHull(pts: { x: number; y: number }[]): { x: number; y: number }[] {
  if (pts.length < 3) return pts;
  const p = [...pts].sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (o: typeof p[0], a: typeof p[0], b: typeof p[0]) =>
    (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower: typeof p = [];
  for (const pt of p) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], pt) <= 0) lower.pop();
    lower.push(pt);
  }
  const upper: typeof p = [];
  for (let i = p.length - 1; i >= 0; i--) {
    const pt = p[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], pt) <= 0) upper.pop();
    upper.push(pt);
  }
  upper.pop(); lower.pop();
  return lower.concat(upper);
}

function drawStarfield(ctx: CanvasRenderingContext2D, W: number, H: number, t: number, seed: number) {
  const rand = rng(seed);
  for (let i = 0; i < 120; i++) {
    const x = rand() * W, y = rand() * H;
    const tw = 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(t * 1.1 + rand() * 20));
    ctx.fillStyle = `rgba(200,230,255,${tw * 0.35})`;
    ctx.beginPath();
    ctx.arc(x, y, rand() * 1.2 + 0.3, 0, Math.PI * 2);
    ctx.fill();
  }
}

interface DrawOpts {
  filter: FilterTag;
  timelineGate: number | null;
  selectedIdx: number | null;
  showHulls: boolean;
  zoom: number;
  panX: number;
  panY: number;
}

function passesFilter(n: Node, filter: FilterTag): boolean {
  if (n.kind === "funder" || n.kind === "bundleHub") return filter === "all" || filter === "linked";
  if (filter === "all") return true;
  if (filter === "whale") return n.whaleRank != null;
  if (filter === "linked") return n.degree > 0;
  return n.tag === filter;
}

function passesTimeline(n: Node, gate: number | null): boolean {
  if (gate == null) return true;
  if (n.kind === "funder" || n.kind === "bundleHub") return true;
  const sec = n.secondsAfterLaunch;
  if (sec == null) return true;
  return sec <= gate;
}

function drawFrame(
  ctx: CanvasRenderingContext2D,
  g: Graph,
  W: number, H: number,
  t: number,
  opts: DrawOpts,
) {
  const { nodes, links, adj } = g;
  const { filter, timelineGate, selectedIdx, showHulls, zoom, panX, panY } = opts;

  ctx.clearRect(0, 0, W, H);

  const bg = ctx.createRadialGradient(W / 2, H * 0.42, 0, W / 2, H / 2, Math.max(W, H) * 0.85);
  bg.addColorStop(0, "rgba(34,211,238,0.06)");
  bg.addColorStop(0.5, "rgba(8,8,18,0)");
  bg.addColorStop(1, "rgba(0,0,0,0.55)");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  drawStarfield(ctx, W, H, t, nodes.length);

  ctx.save();
  ctx.strokeStyle = "rgba(34,211,238,0.025)";
  ctx.lineWidth = 1;
  const gs = 44;
  for (let x = 0; x <= W; x += gs) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = 0; y <= H; y += gs) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  ctx.restore();

  ctx.save();
  ctx.translate(W / 2 + panX, H / 2 + panY);
  ctx.scale(zoom, zoom);
  ctx.translate(-W / 2, -H / 2);

  for (const n of nodes) {
    n.visible = passesFilter(n, filter) && passesTimeline(n, timelineGate);
  }

  const selAdj = selectedIdx != null ? (adj[selectedIdx] ?? new Set<number>()) : null;
  const isConnected = (i: number) =>
    selectedIdx == null || i === selectedIdx || (selAdj?.has(i) ?? false);

  if (showHulls) {
    for (const tag of ["insider", "bundle", "sniper"] as RiskTag[]) {
      const pts = nodes.filter((n) => n.visible && n.tag === tag).map((n) => ({ x: n.x, y: n.y }));
      if (pts.length < 3) continue;
      const hull = convexHull(pts);
      const col = C[tag];
      ctx.fillStyle = `rgba(${hexRgb(col)},0.08)`;
      ctx.strokeStyle = `rgba(${hexRgb(col)},0.22)`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      hull.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  }

  for (const l of links) {
    const na = nodes[l.a], nb = nodes[l.b];
    if (!na.visible && !nb.visible) continue;
    const live = na.visible && nb.visible;
    const hot = selectedIdx == null || l.a === selectedIdx || l.b === selectedIdx;
    const soft = l.kind === "funder";
    const alpha = live ? (hot ? (soft ? 0.35 : 0.55) : (selectedIdx != null ? 0.04 : soft ? 0.12 : 0.26)) : 0.04;

    const grad = ctx.createLinearGradient(na.x, na.y, nb.x, nb.y);
    grad.addColorStop(0, `rgba(${hexRgb(na.color)},${alpha})`);
    grad.addColorStop(1, `rgba(${hexRgb(nb.color)},${alpha})`);
    ctx.strokeStyle = grad;
    ctx.lineWidth = hot && selectedIdx != null ? 2 : soft ? 1 : 1.4;
    ctx.setLineDash(soft ? [3, 8] : [5, 6]);
    ctx.lineDashOffset = -t * (soft ? 8 : 14);
    ctx.beginPath();
    ctx.moveTo(na.x, na.y);
    ctx.lineTo(nb.x, nb.y);
    ctx.stroke();
    ctx.setLineDash([]);

    if (live && (selectedIdx == null || hot)) {
      l.pt = (l.pt + 0.007) % 1;
      l.pt2 = (l.pt2 + 0.005) % 1;
      for (const pt of [l.pt, l.pt2]) {
        const px = na.x + (nb.x - na.x) * pt;
        const py = na.y + (nb.y - na.y) * pt;
        ctx.shadowColor = l.color;
        ctx.shadowBlur = 10;
        ctx.fillStyle = l.color;
        ctx.beginPath();
        ctx.arc(px, py, pt === l.pt ? 2.6 : 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    }
  }

  const order = nodes.map((_, i) => i).filter((i) => nodes[i].visible).sort((a, b) => nodes[a].z - nodes[b].z);
  for (const ni of order) {
    const n = nodes[ni];
    const isSel = ni === selectedIdx;
    const dimmed = selectedIdx != null && !isConnected(ni);
    const depth = 0.72 + 0.28 * ((n.z + 1) / 2);
    const pulse = isSel ? 1.18 : 1 + 0.05 * Math.sin(t * 1.4 + n.phase);
    const r = n.baseR * pulse * depth;
    const rgb = hexRgb(n.color);
    const op = dimmed ? 0.15 : 1;
    ctx.globalAlpha = op;

    if (isSel || n.kind !== "wallet") {
      ctx.shadowColor = n.color;
      ctx.shadowBlur = r * 2.4;
      ctx.strokeStyle = `rgba(${rgb},${isSel ? 0.85 : 0.4})`;
      ctx.lineWidth = isSel ? 2.8 : 1.6;
      ctx.beginPath();
      ctx.arc(n.x, n.y, r + 6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    if ((n.tag === "insider" || n.tag === "bundle") && !dimmed) {
      const ringR = r + 7 + 4 * Math.sin(t * 2.2 + n.phase);
      ctx.strokeStyle = `rgba(${rgb},${0.18 + 0.12 * Math.sin(t * 2.2 + n.phase)})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(n.x, n.y, ringR, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (n.kind === "dev") {
      ctx.strokeStyle = `rgba(${hexRgb(C.dev)},0.9)`;
      ctx.lineWidth = 2.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(n.x, n.y, r + 10, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    const g2 = ctx.createRadialGradient(n.x - r * 0.36, n.y - r * 0.42, r * 0.05, n.x, n.y, r);
    g2.addColorStop(0, `rgba(${rgb},1)`);
    g2.addColorStop(0.45, `rgba(${rgb},0.78)`);
    g2.addColorStop(0.82, `rgba(${rgb},0.34)`);
    g2.addColorStop(1, `rgba(${rgb},0.10)`);
    ctx.shadowColor = n.color;
    ctx.shadowBlur = dimmed ? 0 : r * 1.5;
    ctx.fillStyle = g2;
    ctx.beginPath();
    ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    if (n.whaleRank != null && !dimmed) {
      ctx.font = "bold 9px ui-monospace, monospace";
      ctx.fillStyle = C.whale;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("W" + n.whaleRank, n.x, n.y - r - 10);
    }

    if (n.pinned) {
      ctx.fillStyle = C.accent;
      ctx.beginPath();
      ctx.arc(n.x + r * 0.65, n.y - r * 0.65, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalAlpha = 1;
  }

  ctx.restore();

  const vig = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.25, W / 2, H / 2, Math.max(W, H) * 0.65);
  vig.addColorStop(0, "rgba(0,0,0,0)");
  vig.addColorStop(1, "rgba(0,0,0,0.45)");
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, W, H);
}

const LAYOUT_BTNS: { id: LayoutMode; label: string; I: typeof Network }[] = [
  { id: "force", label: "Force", I: Sparkles },
  { id: "radial", label: "Radial", I: Layers },
  { id: "timeline", label: "Timeline", I: Clock },
  { id: "cluster", label: "Cluster", I: Network },
];

const FILTER_BTNS: { id: FilterTag; label: string; color: string }[] = [
  { id: "all", label: "All", color: C.accent },
  { id: "insider", label: "Insider", color: C.insider },
  { id: "bundle", label: "Bundle", color: C.bundle },
  { id: "sniper", label: "Sniper", color: C.sniper },
  { id: "clean", label: "Clean", color: C.clean },
  { id: "dev", label: "Dev", color: C.dev },
  { id: "whale", label: "Whale", color: C.whale },
  { id: "linked", label: "Linked", color: C.accent },
];

const TONE_COL: Record<string, string> = { red: "#FF5C5C", yellow: "#ffd60a", green: "#2dd4bf" };

export default function BubbleMap({ report }: { report: XrayReport }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<Graph | null>(null);
  const animRef = useRef(0);
  const stateRef = useRef({
    zoom: 1, panX: 0, panY: 0, drag: false, moved: false, lastX: 0, lastY: 0,
    pinchDist: 0, pinchZoom: 1,
  });
  const pinnedRef = useRef<Set<number>>(new Set());
  const dprRef = useRef(1);

  const [layout, setLayout] = useState<LayoutMode>("force");
  const [sizeMode, setSizeMode] = useState<SizeMode>("sol");
  const [filter, setFilter] = useState<FilterTag>("all");
  const [showHulls, setShowHulls] = useState(true);
  const [timelineGate, setTimelineGate] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [copied, setCopied] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [dims, setDims] = useState({ W: 760, H: 480 });

  const layoutRef = useRef(layout);
  const filterRef = useRef(filter);
  const sizeModeRef = useRef(sizeMode);
  const timelineRef = useRef(timelineGate);
  const selectedRef = useRef(selectedIdx);
  const showHullsRef = useRef(showHulls);
  layoutRef.current = layout;
  filterRef.current = filter;
  sizeModeRef.current = sizeMode;
  timelineRef.current = timelineGate;
  selectedRef.current = selectedIdx;
  showHullsRef.current = showHulls;

  const buyers = useMemo(() => enrichBuyers(report), [report]);
  const analytics = useMemo(() => computeAnalytics(buyers, report), [buyers, report]);

  const filterCounts = useMemo(() => ({
    all: buyers.length,
    insider: buyers.filter((b) => b.tag === "insider").length,
    bundle: buyers.filter((b) => b.tag === "bundle").length,
    sniper: buyers.filter((b) => b.tag === "sniper").length,
    clean: buyers.filter((b) => b.tag === "clean").length,
    dev: buyers.filter((b) => b.tag === "dev").length,
    whale: buyers.filter((b) => b.whaleRank != null).length,
    linked: buyers.filter((b) => b.degree > 0).length,
  }), [buyers]);

  const maxR = useMemo(() => {
    const g = buildGraph(report, dims.W, dims.H, sizeMode);
    return g ? Math.max(...g.nodes.map((n) => n.baseR)) * 1.2 + 12 : 40;
  }, [report, dims.W, dims.H, sizeMode]);

  useEffect(() => {
    const g = buildGraph(report, dims.W, dims.H, sizeMode);
    if (g) applyLayoutTargets(g, layout, dims.W, dims.H, analytics.maxSec);
    graphRef.current = g;
    pinnedRef.current = new Set();
    setSelectedIdx(null);
    stateRef.current.zoom = 1;
    stateRef.current.panX = 0;
    stateRef.current.panY = 0;
  }, [report, dims.W, dims.H, sizeMode, layout, analytics.maxSec]);

  useEffect(() => {
    const g = graphRef.current;
    if (g) applyLayoutTargets(g, layout, dims.W, dims.H, analytics.maxSec);
  }, [layout, dims.W, dims.H, analytics.maxSec]);

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((e) => {
      const w = e[0].contentRect.width;
      if (w > 10) setDims({ W: Math.floor(w), H: Math.max(380, Math.min(560, Math.floor(w * 0.58))) });
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => {
      setTimelineGate((g) => {
        const next = (g ?? -1) + 0.25;
        if (next > analytics.maxSec) { setPlaying(false); return analytics.maxSec; }
        return next;
      });
    }, 120);
    return () => clearInterval(id);
  }, [playing, analytics.maxSec]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    dprRef.current = dpr;
    canvas.width = dims.W * dpr;
    canvas.height = dims.H * dpr;
    let t = 0;
    const loop = (ts: number) => {
      t = ts * 0.001;
      const g = graphRef.current;
      const s = stateRef.current;
      const { W, H } = dims;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (g) {
        stepPhysics(g.nodes, g.links, W, H, maxR, layoutRef.current, pinnedRef.current);
        drawFrame(ctx, g, W, H, t, {
          filter: filterRef.current,
          timelineGate: timelineRef.current,
          selectedIdx: selectedRef.current,
          showHulls: showHullsRef.current,
          zoom: s.zoom, panX: s.panX, panY: s.panY,
        });
      } else {
        ctx.clearRect(0, 0, W, H);
      }
      animRef.current = requestAnimationFrame(loop);
    };
    animRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animRef.current);
  }, [dims, maxR]);

  const screenToGraph = useCallback((sx: number, sy: number) => {
    const s = stateRef.current;
    const { W, H } = dims;
    const gx = (sx - W / 2 - s.panX) / s.zoom + W / 2;
    const gy = (sy - H / 2 - s.panY) / s.zoom + H / 2;
    return { gx, gy };
  }, [dims]);

  const hitTest = useCallback((sx: number, sy: number) => {
    const { gx, gy } = screenToGraph(sx, sy);
    const g = graphRef.current;
    if (!g) return null;
    const order = g.nodes.map((_, i) => i).filter((i) => g.nodes[i].visible).sort((a, b) => g.nodes[b].z - g.nodes[a].z);
    for (const i of order) {
      const n = g.nodes[i];
      if (Math.sqrt((n.x - gx) ** 2 + (n.y - gy) ** 2) <= n.baseR + 8) return { idx: i, node: n, sx, sy };
    }
    return null;
  }, [screenToGraph]);

  const canvasCoords = useCallback((e: React.MouseEvent | React.TouchEvent, touchIdx = 0) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const { W, H } = dims;
    let cx: number, cy: number;
    if ("touches" in e) {
      const t = e.touches[touchIdx] || e.changedTouches[0];
      cx = t.clientX; cy = t.clientY;
    } else {
      cx = e.clientX; cy = e.clientY;
    }
    return { sx: (cx - rect.left) * (W / rect.width), sy: (cy - rect.top) * (H / rect.height) };
  }, [dims]);

  const focusNode = useCallback((idx: number) => {
    const g = graphRef.current;
    if (!g || idx < 0) return;
    const n = g.nodes[idx];
    const s = stateRef.current;
    s.panX = dims.W / 2 - n.x * s.zoom;
    s.panY = dims.H / 2 - n.y * s.zoom;
    setSelectedIdx(idx);
    selectedRef.current = idx;
  }, [dims]);

  const onSearch = useCallback(() => {
    const q = search.trim().toLowerCase();
    if (!q) return;
    const g = graphRef.current;
    if (!g) return;
    const idx = g.nodes.findIndex((n) => n.wallet?.toLowerCase().includes(q));
    if (idx >= 0) focusNode(idx);
  }, [search, focusNode]);

  const onMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const s = stateRef.current;
    if (s.drag) {
      s.panX += e.clientX - s.lastX;
      s.panY += e.clientY - s.lastY;
      s.lastX = e.clientX; s.lastY = e.clientY;
      s.moved = true;
      return;
    }
  }, []);

  const onMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const s = stateRef.current;
    s.drag = true; s.moved = false; s.lastX = e.clientX; s.lastY = e.clientY;
  }, []);

  const onMouseUp = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const s = stateRef.current;
    if (s.drag && !s.moved) {
      const { sx, sy } = canvasCoords(e);
      const hit = hitTest(sx, sy);
      setSelectedIdx(hit?.idx ?? null);
      selectedRef.current = hit?.idx ?? null;
    }
    s.drag = false;
  }, [canvasCoords, hitTest]);

  const onDblClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const { sx, sy } = canvasCoords(e);
    const hit = hitTest(sx, sy);
    if (hit?.node.wallet) window.open("https://solscan.io/account/" + hit.node.wallet, "_blank");
  }, [canvasCoords, hitTest]);

  const onWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const s = stateRef.current;
    s.zoom = Math.max(0.4, Math.min(5, s.zoom * (e.deltaY < 0 ? 1.12 : 0.9)));
  }, []);

  const onTouchStart = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    const s = stateRef.current;
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      s.pinchDist = Math.hypot(dx, dy);
      s.pinchZoom = s.zoom;
    } else if (e.touches.length === 1) {
      s.drag = true; s.moved = false;
      s.lastX = e.touches[0].clientX; s.lastY = e.touches[0].clientY;
    }
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    const s = stateRef.current;
    if (e.touches.length === 2 && s.pinchDist > 0) {
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      s.zoom = Math.max(0.4, Math.min(5, s.pinchZoom * (dist / s.pinchDist)));
    } else if (e.touches.length === 1 && s.drag) {
      s.panX += e.touches[0].clientX - s.lastX;
      s.panY += e.touches[0].clientY - s.lastY;
      s.lastX = e.touches[0].clientX; s.lastY = e.touches[0].clientY;
      s.moved = true;
    }
  }, []);

  const onTouchEnd = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    const s = stateRef.current;
    if (e.changedTouches.length === 1 && !s.moved) {
      const { sx, sy } = canvasCoords(e);
      const hit = hitTest(sx, sy);
      setSelectedIdx(hit?.idx ?? null);
      selectedRef.current = hit?.idx ?? null;
    }
    s.drag = false;
    s.pinchDist = 0;
  }, [canvasCoords, hitTest]);

  const zoomBy = (f: number) => { const s = stateRef.current; s.zoom = Math.max(0.4, Math.min(5, s.zoom * f)); };
  const resetView = () => { const s = stateRef.current; s.zoom = 1; s.panX = 0; s.panY = 0; };

  const exportPng = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const a = document.createElement("a");
    a.download = "bubble-map-" + (report.mint?.slice(0, 8) || "xray") + ".png";
    a.href = canvas.toDataURL("image/png");
    a.click();
  };

  const toggleFullscreen = async () => {
    const el = containerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      await el.requestFullscreen();
      setFullscreen(true);
    } else {
      await document.exitFullscreen();
      setFullscreen(false);
    }
  };

  const togglePin = (idx: number) => {
    const g = graphRef.current;
    if (!g) return;
    const set = pinnedRef.current;
    if (set.has(idx)) set.delete(idx); else set.add(idx);
    g.nodes[idx].pinned = set.has(idx);
  };

  const copyWallet = async (w: string) => {
    await navigator.clipboard.writeText(w);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const selected = selectedIdx != null ? graphRef.current?.nodes[selectedIdx] ?? null : null;
  const neighbors = useMemo(() => {
    if (selectedIdx == null || !graphRef.current) return [];
    const adj = graphRef.current.adj[selectedIdx];
    if (!adj) return [];
    return [...adj].map((i) => graphRef.current!.nodes[i]).filter(Boolean);
  }, [selectedIdx, selected]);

  if (!buyers.length) {
    return (
      <div className="rounded-2xl p-8 text-center text-white/40 text-sm"
        style={{ background: "rgba(8,10,20,0.6)", border: "1px solid rgba(34,211,238,0.12)" }}>
        No early buyer data to visualize.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: "rgba(34,211,238,0.08)", border: "1px solid rgba(34,211,238,0.18)" }}>
              <Crosshair className="w-4.5 h-4.5 text-cyan-400" />
            </div>
            <div>
              <div className="text-sm font-bold text-white/85 leading-tight">Wallet Relationship Bubble Map</div>
              <div className="text-[11px] text-white/30 mt-0.5">Advanced graph · up to 100 buyers · click select · double-click Solscan</div>
            </div>
          </div>
          <div className="flex gap-1 flex-wrap">
            {LAYOUT_BTNS.map(({ id, label, I }) => {
              const on = layout === id;
              return (
                <button key={id} onClick={() => setLayout(id)}
                  className="text-[10px] px-2 py-1.5 rounded-lg font-bold flex items-center gap-1 transition-all"
                  style={{
                    background: on ? "rgba(34,211,238,0.15)" : "rgba(255,255,255,0.03)",
                    border: `1px solid ${on ? "rgba(34,211,238,0.45)" : "rgba(255,255,255,0.07)"}`,
                    color: on ? C.accent : "rgba(255,255,255,0.45)",
                  }}>
                  <I className="w-3 h-3" /> {label}
                </button>
              );
            })}
            <select value={sizeMode} onChange={(e) => setSizeMode(e.target.value as SizeMode)}
              className="text-[10px] px-2 py-1.5 rounded-lg font-bold bg-transparent"
              style={{ border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.55)" }}>
              <option value="sol">Size: SOL</option>
              <option value="tokens">Size: Tokens</option>
              <option value="equal">Size: Equal</option>
            </select>
            <button onClick={() => setShowHulls((v) => !v)}
              className="text-[10px] px-2 py-1.5 rounded-lg font-bold"
              style={{
                background: showHulls ? "rgba(255,255,255,0.06)" : "transparent",
                border: "1px solid rgba(255,255,255,0.1)",
                color: showHulls ? C.accent : "rgba(255,255,255,0.4)",
              }}>
              Hulls
            </button>
          </div>
        </div>

        <div className="flex gap-1.5 flex-wrap">
          {FILTER_BTNS.map((f) => {
            const on = filter === f.id;
            return (
              <button key={f.id} onClick={() => setFilter(f.id)}
                className="text-[10px] px-2.5 py-1.5 rounded-full font-bold transition-all flex items-center gap-1.5"
                style={{
                  background: on ? f.color + "1f" : "rgba(255,255,255,0.03)",
                  border: `1px solid ${on ? f.color + "66" : "rgba(255,255,255,0.07)"}`,
                  color: on ? f.color : "rgba(255,255,255,0.4)",
                }}>
                {f.id !== "all" && f.id !== "linked" && f.id !== "whale" && (
                  <span className="w-2 h-2 rounded-full" style={{ background: f.color }} />
                )}
                {f.label} <span style={{ opacity: 0.55 }}>{filterCounts[f.id]}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Analytics strip */}
      <div className="flex flex-wrap gap-2 text-[10px] font-mono px-1">
        {[
          { l: "Buyers", v: analytics.buyerCount },
          { l: "SOL", v: analytics.totalSol.toFixed(2) },
          { l: "Risk SOL", v: analytics.riskSolPct.toFixed(0) + "%" },
          { l: "Gini", v: analytics.gini.toFixed(2) },
          { l: "Linked", v: analytics.linkedPct.toFixed(0) + "%" },
          { l: "Clusters", v: analytics.clusterCount },
          { l: "Sniper", v: analytics.sniperPct != null ? analytics.sniperPct.toFixed(0) + "%" : "—" },
          { l: "Bundle", v: analytics.bundlePct != null ? analytics.bundlePct.toFixed(0) + "%" : "—" },
        ].map(({ l, v }) => (
          <span key={l} className="px-2 py-1 rounded-lg"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.55)" }}>
            {l}: <span className="text-white/80 font-bold">{v}</span>
          </span>
        ))}
        {analytics.verdict && (
          <span className="px-2.5 py-1 rounded-lg font-bold ml-auto"
            style={{
              background: (TONE_COL[analytics.tone] || TONE_COL.yellow) + "22",
              border: `1px solid ${(TONE_COL[analytics.tone] || TONE_COL.yellow)}66`,
              color: TONE_COL[analytics.tone] || TONE_COL.yellow,
            }}>
            {analytics.verdict}
          </span>
        )}
      </div>

      {/* Timeline controls */}
      <div className="flex items-center gap-2 px-1">
        <button onClick={() => {
          if (playing) { setPlaying(false); return; }
          setTimelineGate(-1);
          setPlaying(true);
        }}
          className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: "rgba(34,211,238,0.1)", border: "1px solid rgba(34,211,238,0.25)" }}>
          {playing ? <Pause className="w-3.5 h-3.5 text-cyan-300" /> : <Play className="w-3.5 h-3.5 text-cyan-300" />}
        </button>
        <input type="range" min={-1} max={analytics.maxSec} step={0.5}
          value={timelineGate ?? analytics.maxSec}
          onChange={(e) => { setTimelineGate(Number(e.target.value)); setPlaying(false); }}
          className="flex-1 accent-cyan-400 h-1"
        />
        <span className="text-[10px] font-mono text-white/40 w-16 text-right">
          {timelineGate != null && timelineGate >= 0 ? "+" + timelineGate.toFixed(0) + "s" : "all"}
        </span>
        <button onClick={() => { setTimelineGate(null); setPlaying(false); }}
          className="text-[10px] px-2 py-1 rounded text-white/35 hover:text-white/60">Reset</button>
      </div>

      {/* Search */}
      <div className="flex gap-2 px-1">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/25" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onSearch()}
            placeholder="Search wallet address…"
            className="w-full pl-8 pr-3 py-1.5 rounded-lg text-xs font-mono bg-transparent text-white/70"
            style={{ border: "1px solid rgba(255,255,255,0.08)" }}
          />
        </div>
        <button onClick={onSearch}
          className="px-3 py-1.5 rounded-lg text-[10px] font-bold flex items-center gap-1"
          style={{ background: "rgba(34,211,238,0.12)", border: "1px solid rgba(34,211,238,0.3)", color: C.accent }}>
          <Focus className="w-3 h-3" /> Focus
        </button>
      </div>

      {/* Canvas + inspector */}
      <div className="flex gap-3 flex-col lg:flex-row">
        <div ref={containerRef} className="relative flex-1 rounded-2xl overflow-hidden"
          style={{
            background: "radial-gradient(ellipse at 50% 42%, rgba(34,211,238,0.06) 0%, #06060f 72%)",
            border: "1px solid rgba(34,211,238,0.12)",
            boxShadow: "inset 0 0 60px rgba(0,0,0,0.5)",
          }}>
          <canvas
            ref={canvasRef}
            className="w-full block touch-none"
            style={{ height: dims.H, cursor: stateRef.current.drag ? "grabbing" : "grab" }}
            onMouseMove={onMouseMove}
            onMouseDown={onMouseDown}
            onMouseUp={onMouseUp}
            onMouseLeave={() => { stateRef.current.drag = false; }}
            onWheel={onWheel}
            onDoubleClick={onDblClick}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
          />

          <div className="absolute bottom-3 left-3 flex flex-col gap-1.5">
            {[
              { I: ZoomIn, fn: () => zoomBy(1.2), t: "Zoom in" },
              { I: ZoomOut, fn: () => zoomBy(0.83), t: "Zoom out" },
              { I: Maximize2, fn: resetView, t: "Reset view" },
              { I: Download, fn: exportPng, t: "Export PNG" },
              { I: fullscreen ? Minimize2 : Maximize2, fn: toggleFullscreen, t: "Fullscreen" },
            ].map(({ I, fn, t }, i) => (
              <button key={i} onClick={fn} title={t}
                className="h-8 w-8 rounded-lg flex items-center justify-center transition-all hover:scale-105"
                style={{ background: "rgba(8,10,20,0.7)", border: "1px solid rgba(34,211,238,0.18)", backdropFilter: "blur(8px)" }}>
                <I className="w-3.5 h-3.5 text-cyan-300/80" />
              </button>
            ))}
          </div>
        </div>

        {/* Inspector sidebar */}
        <div className="w-full lg:w-56 shrink-0 rounded-2xl p-3 space-y-2.5"
          style={{ background: "rgba(6,8,16,0.85)", border: "1px solid rgba(34,211,238,0.12)" }}>
          <div className="text-[10px] font-bold text-white/40 uppercase tracking-wider">Inspector</div>
          {selected ? (
            <>
              <div className="font-mono text-xs text-white/85 break-all">{selected.wallet || selected.label}</div>
              {selected.tag && (
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ background: selected.color }} />
                  <span className="text-xs font-bold capitalize" style={{ color: selected.color }}>{selected.tag}</span>
                </div>
              )}
              <div className="space-y-1 text-[11px] text-white/45">
                <div>SOL: <span className="text-white/75 font-bold">{selected.solSpent.toFixed(4)}</span></div>
                <div>Share: <span className="text-white/75 font-bold">{selected.sharePct.toFixed(1)}%</span></div>
                {selected.tokenAmount != null && selected.tokenAmount > 0 && (
                  <div>Tokens: <span className="text-white/70">{selected.tokenAmount > 1e3 ? (selected.tokenAmount / 1e3).toFixed(1) + "K" : selected.tokenAmount.toFixed(2)}</span></div>
                )}
                <div>Degree: <span className="text-white/70">{selected.degree}</span></div>
                {selected.slot ? <div>Slot: <span className="text-white/70">{selected.slot}</span></div> : null}
                {selected.funder && <div>Funder: <span className="font-mono text-white/55">{short(selected.funder)}</span></div>}
                {selected.secondsAfterLaunch != null && (
                  <div>Launch: <span className="text-white/70">+{selected.secondsAfterLaunch}s</span></div>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {selected.wallet && (
                  <>
                    <button onClick={() => copyWallet(selected.wallet!)}
                      className="text-[10px] px-2 py-1 rounded flex items-center gap-1"
                      style={{ border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.55)" }}>
                      {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />} Copy
                    </button>
                    <a href={"https://solscan.io/account/" + selected.wallet} target="_blank" rel="noreferrer"
                      className="text-[10px] px-2 py-1 rounded flex items-center gap-1"
                      style={{ border: "1px solid rgba(34,211,238,0.25)", color: C.accent }}>
                      <ExternalLink className="w-3 h-3" /> Solscan
                    </a>
                    <button onClick={() => selectedIdx != null && togglePin(selectedIdx)}
                      className="text-[10px] px-2 py-1 rounded flex items-center gap-1"
                      style={{
                        border: `1px solid ${selected.pinned ? C.accent + "66" : "rgba(255,255,255,0.1)"}`,
                        color: selected.pinned ? C.accent : "rgba(255,255,255,0.55)",
                      }}>
                      <Pin className="w-3 h-3" /> {selected.pinned ? "Unpin" : "Pin"}
                    </button>
                  </>
                )}
              </div>
              {neighbors.length > 0 && (
                <div className="pt-2 border-t border-white/5">
                  <div className="text-[10px] text-white/35 mb-1.5">Neighbors ({neighbors.length})</div>
                  <div className="space-y-1 max-h-28 overflow-y-auto">
                    {neighbors.map((n, i) => (
                      <button key={i} onClick={() => {
                        const idx = graphRef.current?.nodes.indexOf(n);
                        if (idx != null && idx >= 0) focusNode(idx);
                      }}
                        className="block w-full text-left text-[10px] font-mono truncate px-1.5 py-0.5 rounded hover:bg-white/5"
                        style={{ color: n.color }}>
                        {n.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-[11px] text-white/30">Click a node to inspect wallet details, neighbors, and links.</div>
          )}
          {selectedIdx != null && (
            <button onClick={() => { setSelectedIdx(null); selectedRef.current = null; }}
              className="text-[10px] flex items-center gap-1 text-white/30 hover:text-white/50 pt-1">
              <X className="w-3 h-3" /> Clear selection
            </button>
          )}
        </div>
      </div>

      <div className="text-[11px] text-white/30 px-1">
        Scroll/pinch zoom · drag pan · timeline replay · hull toggle · export PNG
      </div>
    </div>
  );
}

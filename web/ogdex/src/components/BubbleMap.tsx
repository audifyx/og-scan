import { useRef, useEffect, useState, useCallback, useMemo } from "react";
import { XrayReport, short } from "../lib/api";
import { ExternalLink, ZoomIn, ZoomOut, Maximize2, Crosshair } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────
type RiskTag = "insider" | "bundle" | "sniper" | "clean";

interface RichBuyer {
  wallet: string;
  tokenAmount: number;
  solSpent: number;
  txHash: string | null;
  slot: number;
  time: number;
  tag: RiskTag;
  secondsAfterLaunch: number | null;
}

interface Node {
  id: string;
  kind: "wallet" | "funder" | "bundleHub";
  wallet?: string;
  label: string;
  r: number;
  baseR: number;
  color: string;
  x: number; y: number;
  vx: number; vy: number;
  z: number;          // depth [-1..1] for 3D layering & parallax
  mass: number;
  phase: number;
  tag?: RiskTag;
  solSpent: number;
  tokenAmount?: number;
  txHash?: string | null;
  slot?: number;
  visible: boolean;
}

interface Link {
  a: number; b: number;
  pt: number; // particle position [0..1]
  color: string;
}

// ── Palette ───────────────────────────────────────────────────────────
const C = {
  insider:   "#ff4d6d",
  bundle:    "#ff9f1c",
  sniper:    "#ffd60a",
  clean:     "#2dd4bf",
  funder:    "#ff4d6d",
  bundleHub: "#ff9f1c",
  accent:    "#22d3ee",
} as const;

function hexRgb(hex: string): string {
  const n = parseInt(hex.replace("#",""), 16);
  return `${(n>>16)&255},${(n>>8)&255},${n&255}`;
}

function rng(seed: number) {
  let s = seed >>> 0;
  return () => { s=(s*1664525+1013904223)>>>0; return s/4294967296; };
}

// ── Enrich early buyers with risk tags ───────────────────────────────
function enrichBuyers(x: XrayReport): RichBuyer[] {
  const sniperMap = new Map((x.snipers?.wallets || []).map(w => [w.wallet, w]));
  const bundleSet = new Set((x.bundles?.clusters || []).flatMap(c => c.wallets));
  const insiderSet = new Set((x.insiders?.clusters || []).flatMap(c => c.wallets));

  const firstTime = Math.min(...(x.earlyBuyers||[]).map((b:any) => b.time || Infinity));

  return (x.earlyBuyers || []).map((b: any) => {
    const tag: RiskTag =
      insiderSet.has(b.wallet) ? "insider" :
      bundleSet.has(b.wallet)  ? "bundle"  :
      sniperMap.has(b.wallet)  ? "sniper"  : "clean";
    const snap = sniperMap.get(b.wallet);
    return {
      wallet: b.wallet,
      tokenAmount: b.tokenAmount ?? 0,
      solSpent: b.solSpent ?? snap?.solSpent ?? 0,
      txHash: b.txHash ?? snap?.txHash ?? null,
      slot: b.slot ?? 0,
      time: b.time ?? 0,
      tag,
      secondsAfterLaunch: snap?.secondsAfterLaunch ?? (b.time && firstTime ? Math.round((b.time - firstTime)/1000) : null),
    };
  });
}

// ── Build force graph ─────────────────────────────────────────────────
function buildGraph(report: XrayReport, W: number, H: number) {
  const buyers = enrichBuyers(report).slice(0, 60);
  if (!buyers.length) return null;

  const maxSol  = Math.max(...buyers.map(b => b.solSpent), 0.001);
  const maxTok  = Math.max(...buyers.map(b => b.tokenAmount), 0.001);
  const rand    = rng(buyers.length * 97 + 13);

  const nodes: Node[] = [];
  const idx:   Record<string, number> = {};

  const push = (n: Omit<Node,"x"|"y"|"vx"|"vy"|"phase"|"visible"|"z"|"mass">) => {
    idx[n.id] = nodes.length;
    const z = rand()*2 - 1;
    nodes.push({
      ...n,
      x: W/2 + (rand()-.5)*W*.5,
      y: H/2 + (rand()-.5)*H*.45,
      vx: (rand()-.5)*1.2,
      vy: (rand()-.5)*1.2,
      z,
      mass: Math.max(1, n.baseR / 10),
      phase: rand()*Math.PI*2,
      visible: true,
    });
    return nodes.length-1;
  };

  // Wallet nodes — sized by solSpent (with tokenAmount fallback)
  for (const b of buyers) {
    const szSol  = b.solSpent   ? Math.sqrt(b.solSpent / maxSol) : 0;
    const szTok  = b.tokenAmount ? Math.sqrt(b.tokenAmount / maxTok) : 0;
    const sz     = Math.max(szSol, szTok * 0.6);
    const r      = 9 + 24 * sz;
    push({
      id: "w:"+b.wallet, kind: "wallet", wallet: b.wallet,
      label: short(b.wallet), r, baseR: r,
      color: C[b.tag], tag: b.tag,
      solSpent: b.solSpent, tokenAmount: b.tokenAmount,
      txHash: b.txHash, slot: b.slot,
    });
  }

  // Insider funder hubs
  for (const cl of report.insiders?.clusters||[]) {
    push({
      id: "f:"+cl.funder, kind: "funder", wallet: cl.funder,
      label: "funder " + short(cl.funder), r: 13, baseR: 13,
      color: C.funder, solSpent: 0,
    });
  }

  // Bundle hubs
  (report.bundles?.clusters||[]).forEach((bd, i) => {
    push({
      id: "bh:"+i, kind: "bundleHub",
      label: `slot ${bd.slot}`, r: 12, baseR: 12,
      color: C.bundleHub, solSpent: 0,
    });
  });

  const links: Link[] = [];
  for (const cl of report.insiders?.clusters||[]) {
    const fi = idx["f:"+cl.funder];
    if (fi==null) continue;
    for (const w of cl.wallets) {
      const wi = idx["w:"+w];
      if (wi!=null) links.push({ a: wi, b: fi, pt: rand(), color: C.insider });
    }
  }
  (report.bundles?.clusters||[]).forEach((bd, i) => {
    const bi = idx["bh:"+i];
    if (bi==null) return;
    for (const w of [...new Set(bd.wallets)]) {
      const wi = idx["w:"+w];
      if (wi!=null) links.push({ a: wi, b: bi, pt: rand(), color: C.bundleHub });
    }
  });

  // adjacency for hover-highlight
  const adj: Record<number, Set<number>> = {};
  links.forEach(l => {
    (adj[l.a] ??= new Set()).add(l.b);
    (adj[l.b] ??= new Set()).add(l.a);
  });

  return { nodes, links, adj };
}

// ── Physics ───────────────────────────────────────────────────────────
function stepPhysics(nodes: Node[], links: Link[], W: number, H: number, maxR: number) {
  const margin = maxR + 14;
  // Repulsion (mass-weighted)
  for (let i=0;i<nodes.length;i++) {
    for (let j=i+1;j<nodes.length;j++) {
      const a=nodes[i], b=nodes[j];
      const dx=a.x-b.x, dy=a.y-b.y;
      const d2=dx*dx+dy*dy||0.01, d=Math.sqrt(d2);
      const minD=a.r+b.r+14;
      const rep=3400/d2;
      const ux=dx/d, uy=dy/d;
      a.vx+=ux*rep/a.mass; a.vy+=uy*rep/a.mass;
      b.vx-=ux*rep/b.mass; b.vy-=uy*rep/b.mass;
      if (d<minD) { const p=(minD-d)*.5; a.vx+=ux*p; a.vy+=uy*p; b.vx-=ux*p; b.vy-=uy*p; }
    }
  }
  // Springs
  for (const l of links) {
    const a=nodes[l.a], b=nodes[l.b];
    const dx=b.x-a.x, dy=b.y-a.y;
    const d=Math.sqrt(dx*dx+dy*dy)||0.01;
    const target = 70;
    const f=(d-target)*.05;
    const ux=dx/d, uy=dy/d;
    a.vx+=ux*f; a.vy+=uy*f;
    b.vx-=ux*f; b.vy-=uy*f;
  }
  // Center gravity (stronger for big nodes so the whale settles centrally) + integrate
  for (const n of nodes) {
    const g = 0.0026 + (n.mass-1) * 0.0006;
    n.vx+=(W/2-n.x)*g; n.vy+=(H/2-n.y)*g;
    n.vx*=.9; n.vy*=.9;
    n.x+=n.vx; n.y+=n.vy;
    n.x=Math.max(margin, Math.min(W-margin, n.x));
    n.y=Math.max(margin, Math.min(H-margin, n.y));
  }
}

// ── Canvas renderer ───────────────────────────────────────────────────
function drawFrame(
  ctx: CanvasRenderingContext2D,
  g: { nodes: Node[]; links: Link[]; adj: Record<number, Set<number>> },
  W: number, H: number,
  t: number,
  hoverIdx: number | null,
  zoom: number, panX: number, panY: number,
  filterTag: RiskTag | "all",
) {
  const { nodes, links, adj } = g;
  ctx.clearRect(0,0,W,H);

  // Vignette / radial wash
  const bg = ctx.createRadialGradient(W/2, H*0.42, 0, W/2, H/2, Math.max(W,H)*0.75);
  bg.addColorStop(0, "rgba(34,211,238,0.05)");
  bg.addColorStop(0.55, "rgba(8,8,18,0)");
  bg.addColorStop(1, "rgba(0,0,0,0.35)");
  ctx.fillStyle = bg;
  ctx.fillRect(0,0,W,H);

  // BG grid (subtle, perspective-ish fade toward edges)
  ctx.save();
  ctx.strokeStyle = "rgba(34,211,238,0.035)";
  ctx.lineWidth = 1;
  const gs = 44;
  for (let x=0;x<=W;x+=gs) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
  for (let y=0;y<=H;y+=gs) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }
  ctx.restore();

  ctx.save();
  ctx.translate(W/2+panX, H/2+panY);
  ctx.scale(zoom, zoom);
  ctx.translate(-W/2, -H/2);

  // Visibility
  for (const n of nodes) {
    n.visible = n.kind !== "wallet" ? true : (filterTag === "all" || n.tag === filterTag);
  }

  const hoverNode = hoverIdx!=null ? nodes[hoverIdx] : null;
  const hoverAdj  = hoverIdx!=null ? (adj[hoverIdx] ?? new Set<number>()) : null;
  const isConnected = (i:number) => hoverIdx==null || i===hoverIdx || (hoverAdj?.has(i) ?? false);

  // Links
  for (const l of links) {
    const na=nodes[l.a], nb=nodes[l.b];
    if (!na.visible && !nb.visible) continue;
    const live = na.visible && nb.visible;
    const hot  = hoverIdx==null || l.a===hoverIdx || l.b===hoverIdx;
    const alpha = live ? (hot ? 0.55 : (hoverIdx!=null ? 0.05 : 0.26)) : 0.05;

    const grad = ctx.createLinearGradient(na.x,na.y,nb.x,nb.y);
    grad.addColorStop(0, `rgba(${hexRgb(na.color)},${alpha})`);
    grad.addColorStop(1, `rgba(${hexRgb(nb.color)},${alpha})`);
    ctx.strokeStyle = grad;
    ctx.lineWidth = hot && hoverIdx!=null ? 2 : 1.4;
    ctx.setLineDash([5,6]);
    ctx.lineDashOffset = -t * 14;
    ctx.beginPath(); ctx.moveTo(na.x,na.y); ctx.lineTo(nb.x,nb.y); ctx.stroke();
    ctx.setLineDash([]);

    if (live && (hoverIdx==null || hot)) {
      l.pt = (l.pt + 0.008) % 1;
      const px = na.x + (nb.x-na.x)*l.pt;
      const py = na.y + (nb.y-na.y)*l.pt;
      ctx.shadowColor = l.color;
      ctx.shadowBlur = 12;
      ctx.fillStyle = l.color;
      ctx.beginPath(); ctx.arc(px,py,2.6,0,Math.PI*2); ctx.fill();
      ctx.shadowBlur = 0;
    }
  }

  // Nodes — painter's algorithm by depth (far → near)
  const order = nodes.map((_,i)=>i).filter(i=>nodes[i].visible).sort((a,b)=>nodes[a].z-nodes[b].z);
  for (const ni of order) {
    const n = nodes[ni];
    const isHover = ni === hoverIdx;
    const dimmed  = hoverIdx!=null && !isConnected(ni);
    const depth   = 0.72 + 0.28 * ((n.z+1)/2);  // far nodes smaller/dimmer
    const pulse   = isHover ? 1.16 : (1 + 0.05 * Math.sin(t * 1.4 + n.phase));
    const r       = n.baseR * pulse * depth;
    const rgb     = hexRgb(n.color);
    const op      = dimmed ? 0.18 : 1;

    ctx.globalAlpha = op;

    // Hover halo / hub ring
    if (isHover || n.kind !== "wallet") {
      ctx.shadowColor = n.color;
      ctx.shadowBlur = r * 2.6;
      ctx.strokeStyle = `rgba(${rgb},${isHover?0.7:0.4})`;
      ctx.lineWidth = isHover ? 2.4 : 1.6;
      ctx.beginPath(); ctx.arc(n.x, n.y, r+6, 0, Math.PI*2); ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // Pulsing danger ring for high-risk wallets
    if ((n.tag === "insider" || n.tag === "bundle") && !dimmed) {
      const ringR = r + 7 + 4 * Math.sin(t * 2.2 + n.phase);
      ctx.strokeStyle = `rgba(${rgb},${0.18 + 0.12 * Math.sin(t * 2.2 + n.phase)})`;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(n.x, n.y, ringR, 0, Math.PI*2); ctx.stroke();
    }

    // Sphere body — radial gradient + rim light
    const g2 = ctx.createRadialGradient(n.x-r*.36, n.y-r*.42, r*0.05, n.x, n.y, r);
    g2.addColorStop(0,    `rgba(${rgb},1)`);
    g2.addColorStop(0.45, `rgba(${rgb},0.78)`);
    g2.addColorStop(0.82, `rgba(${rgb},0.34)`);
    g2.addColorStop(1,    `rgba(${rgb},0.10)`);
    ctx.shadowColor = n.color;
    ctx.shadowBlur = dimmed ? 0 : r * 1.5;
    ctx.fillStyle = g2;
    ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, Math.PI*2); ctx.fill();
    ctx.shadowBlur = 0;

    // Rim light (bottom-right edge)
    ctx.strokeStyle = `rgba(${rgb},${dimmed?0.1:0.55})`;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(n.x, n.y, r-0.5, Math.PI*0.05, Math.PI*0.75); ctx.stroke();

    // Specular highlight
    const hl = ctx.createRadialGradient(n.x-r*.38, n.y-r*.44, 0, n.x-r*.38, n.y-r*.44, r*.8);
    hl.addColorStop(0, `rgba(255,255,255,${dimmed?0.12:0.45})`);
    hl.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = hl;
    ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, Math.PI*2); ctx.fill();

    ctx.globalAlpha = 1;
  }

  // Hover label — drawn last so it's never occluded; pill background, edge-clamped
  if (hoverNode) {
    const depth = 0.72 + 0.28 * ((hoverNode.z+1)/2);
    const r = hoverNode.baseR * 1.16 * depth;
    const label = hoverNode.label;
    ctx.font = "bold 12px ui-monospace, monospace";
    const tw = ctx.measureText(label).width;
    const padX = 8, padY = 5, lh = 22;
    let lx = hoverNode.x - tw/2 - padX;
    let ly = hoverNode.y - r - lh - 8;
    lx = Math.max(6, Math.min(W - tw - padX*2 - 6, lx));
    if (ly < 6) ly = hoverNode.y + r + 8;
    const rgb = hexRgb(hoverNode.color);
    ctx.fillStyle = "rgba(6,8,16,0.92)";
    ctx.strokeStyle = `rgba(${rgb},0.6)`;
    ctx.lineWidth = 1;
    const rw = tw + padX*2, rr = 7;
    ctx.beginPath();
    if (typeof (ctx as any).roundRect === "function") {
      (ctx as any).roundRect(lx, ly, rw, lh, rr);
    } else {
      ctx.rect(lx, ly, rw, lh);
    }
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = `rgba(${rgb},1)`;
    ctx.textAlign = "left"; ctx.textBaseline = "middle";
    ctx.fillText(label, lx + padX, ly + lh/2 + 0.5);
  }

  ctx.restore();
}

// ── Component ─────────────────────────────────────────────────────────
type FilterTag = RiskTag | "all";

export default function BubbleMap({ report }: { report: XrayReport }) {
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef     = useRef<ReturnType<typeof buildGraph>>(null);
  const animRef      = useRef(0);
  const stateRef     = useRef({ zoom: 1, panX: 0, panY: 0, drag: false, moved: false, lastX: 0, lastY: 0 });
  const hoverIdxRef  = useRef<number | null>(null);
  const dprRef       = useRef(1);

  const [hover,     setHover]     = useState<Node|null>(null);
  const [hoverPos,  setHoverPos]  = useState({ x: 0, y: 0 });
  const [filter,    setFilter]    = useState<FilterTag>("all");
  const [dims,      setDims]      = useState({ W: 760, H: 440 });
  const filterRef = useRef<FilterTag>("all");
  filterRef.current = filter;

  const buyers = useMemo(() => enrichBuyers(report), [report]);

  const maxR = useMemo(() => {
    const g = buildGraph(report, dims.W, dims.H);
    return g ? Math.max(...g.nodes.map(n=>n.baseR)) * 1.16 + 10 : 40;
  }, [report, dims.W, dims.H]);

  // Build graph
  useEffect(() => {
    graphRef.current = buildGraph(report, dims.W, dims.H);
    stateRef.current.zoom = 1; stateRef.current.panX = 0; stateRef.current.panY = 0;
  }, [report, dims.W, dims.H]);

  // ResizeObserver — clamp height to a comfortable band so bubbles never feel cramped
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(e => {
      const w = e[0].contentRect.width;
      if (w > 10) setDims({ W: Math.floor(w), H: Math.max(360, Math.min(520, Math.floor(w * 0.56))) });
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // Animation loop (HiDPI aware)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    dprRef.current = dpr;
    canvas.width  = dims.W * dpr;
    canvas.height = dims.H * dpr;
    let t = 0;
    const loop = (ts: number) => {
      t = ts * 0.001;
      const g = graphRef.current;
      const s = stateRef.current;
      const { W, H } = dims;
      ctx.setTransform(dpr,0,0,dpr,0,0);
      if (g) {
        stepPhysics(g.nodes, g.links, W, H, maxR);
        drawFrame(ctx, g, W, H, t, hoverIdxRef.current, s.zoom, s.panX, s.panY, filterRef.current);
      } else {
        ctx.clearRect(0,0,W,H);
      }
      animRef.current = requestAnimationFrame(loop);
    };
    animRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animRef.current);
  }, [dims, maxR]);

  // Hit test → node index
  const hitTest = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect   = canvas.getBoundingClientRect();
    const s      = stateRef.current;
    const { W, H } = dims;
    const sx = (e.clientX - rect.left) * (W / rect.width);
    const sy = (e.clientY - rect.top)  * (H / rect.height);
    const gx = (sx - W/2 - s.panX) / s.zoom + W/2;
    const gy = (sy - H/2 - s.panY) / s.zoom + H/2;
    const g  = graphRef.current;
    if (!g) return null;
    // nearest hit (prefer top/near nodes)
    const order = g.nodes.map((_,i)=>i).filter(i=>g.nodes[i].visible).sort((a,b)=>g.nodes[b].z-g.nodes[a].z);
    for (const i of order) {
      const n = g.nodes[i];
      if (Math.sqrt((n.x-gx)**2+(n.y-gy)**2) <= n.baseR+8) return { idx: i, node: n, sx, sy };
    }
    return null;
  }, [dims]);

  const onMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const s = stateRef.current;
    if (s.drag) {
      s.panX += e.clientX - s.lastX;
      s.panY += e.clientY - s.lastY;
      s.lastX = e.clientX; s.lastY = e.clientY;
      s.moved = true;
      hoverIdxRef.current = null; setHover(null);
      return;
    }
    const hit = hitTest(e);
    hoverIdxRef.current = hit?.idx ?? null;
    setHover(hit?.node ?? null);
    if (hit) setHoverPos({ x: hit.sx, y: hit.sy });
  }, [hitTest]);

  const onMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const s = stateRef.current;
    s.drag = true; s.moved = false; s.lastX = e.clientX; s.lastY = e.clientY;
  }, []);
  const onMouseUp = useCallback(() => { stateRef.current.drag = false; }, []);

  const onWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const s = stateRef.current;
    s.zoom = Math.max(0.5, Math.min(4, s.zoom * (e.deltaY < 0 ? 1.12 : 0.9)));
  }, []);

  const onClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (stateRef.current.moved) return;       // was a drag, not a click
    const hit = hitTest(e);
    if (hit?.node.wallet) window.open(`https://solscan.io/account/${hit.node.wallet}`, "_blank");
  }, [hitTest]);

  const zoomBy = (f:number) => { const s=stateRef.current; s.zoom=Math.max(0.5,Math.min(4,s.zoom*f)); };
  const resetView = () => { const s=stateRef.current; s.zoom=1; s.panX=0; s.panY=0; };

  const counts = useMemo(() => ({
    all:     buyers.length,
    insider: buyers.filter(b=>b.tag==="insider").length,
    bundle:  buyers.filter(b=>b.tag==="bundle").length,
    sniper:  buyers.filter(b=>b.tag==="sniper").length,
    clean:   buyers.filter(b=>b.tag==="clean").length,
  }), [buyers]);

  const totalSol = useMemo(() => buyers.reduce((s,b)=>s+(b.solSpent||0),0), [buyers]);
  const biggest  = useMemo(() => buyers.reduce((m,b)=>b.solSpent>(m?.solSpent??-1)?b:m, null as RichBuyer|null), [buyers]);

  const filterBtns: { id: FilterTag; label: string; color: string }[] = [
    { id:"all",     label:"All",     color: C.accent   },
    { id:"insider", label:"Insider", color: C.insider  },
    { id:"bundle",  label:"Bundle",  color: C.bundle   },
    { id:"sniper",  label:"Sniper",  color: C.sniper   },
    { id:"clean",   label:"Clean",   color: C.clean    },
  ];

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0"
              style={{ background:"rgba(34,211,238,0.08)", border:"1px solid rgba(34,211,238,0.18)" }}>
              <Crosshair className="w-4.5 h-4.5 text-cyan-400" />
            </div>
            <div>
              <div className="text-sm font-bold text-white/85 leading-tight">Wallet Relationship Graph</div>
              <div className="text-[11px] text-white/30 mt-0.5">Bubble size = SOL spent · lines = shared funder / same-block bundle</div>
            </div>
          </div>
          {/* Filter pills double as legend */}
          <div className="flex gap-1.5 flex-wrap">
            {filterBtns.map(f => {
              const on = filter===f.id;
              return (
                <button key={f.id} onClick={() => setFilter(f.id)}
                  className="text-[10px] px-2.5 py-1.5 rounded-full font-bold transition-all flex items-center gap-1.5"
                  style={{
                    background: on ? `${f.color}1f` : "rgba(255,255,255,0.03)",
                    border: `1px solid ${on ? f.color+"66" : "rgba(255,255,255,0.07)"}`,
                    color: on ? f.color : "rgba(255,255,255,0.4)",
                    boxShadow: on ? `0 0 14px ${f.color}33` : "none",
                  }}>
                  {f.id!=="all" && <span className="w-2 h-2 rounded-full" style={{ background:f.color, boxShadow:`0 0 6px ${f.color}` }} />}
                  {f.label} <span style={{ opacity:.55 }}>{(counts as any)[f.id]}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Canvas */}
      <div ref={containerRef} className="relative w-full rounded-2xl overflow-hidden"
        style={{
          background: "radial-gradient(ellipse at 50% 42%, rgba(34,211,238,0.06) 0%, #06060f 72%)",
          border: "1px solid rgba(34,211,238,0.12)",
          boxShadow: "inset 0 0 60px rgba(0,0,0,0.5)",
        }}>
        <canvas
          ref={canvasRef}
          className="w-full block"
          style={{ height: dims.H, cursor: hover?.wallet ? "pointer" : stateRef.current.drag ? "grabbing" : "grab" }}
          onMouseMove={onMouseMove}
          onMouseDown={onMouseDown}
          onMouseUp={onMouseUp}
          onMouseLeave={() => { setHover(null); hoverIdxRef.current=null; stateRef.current.drag = false; }}
          onWheel={onWheel}
          onClick={onClick}
        />

        {/* Zoom controls — bottom-left glass buttons */}
        <div className="absolute bottom-3 left-3 flex flex-col gap-1.5">
          {[
            { I: ZoomIn,     fn: () => zoomBy(1.2), t:"Zoom in" },
            { I: ZoomOut,    fn: () => zoomBy(0.83), t:"Zoom out" },
            { I: Maximize2,  fn: resetView, t:"Reset view" },
          ].map(({I,fn,t},i) => (
            <button key={i} onClick={fn} title={t}
              className="h-8 w-8 rounded-lg flex items-center justify-center transition-all hover:scale-105"
              style={{ background:"rgba(8,10,20,0.7)", border:"1px solid rgba(34,211,238,0.18)", backdropFilter:"blur(8px)" }}>
              <I className="w-3.5 h-3.5 text-cyan-300/80" />
            </button>
          ))}
        </div>

        {/* Summary chips — top-left glass, won't collide with nodes (small + backdrop) */}
        <div className="absolute top-3 left-3 flex gap-1.5 pointer-events-none">
          <span className="text-[10px] px-2 py-1 rounded-lg font-mono"
            style={{ background:"rgba(8,10,20,0.7)", border:"1px solid rgba(255,255,255,0.08)", color:"rgba(255,255,255,0.6)", backdropFilter:"blur(8px)" }}>
            {buyers.length} buyers · {totalSol.toFixed(2)} SOL
          </span>
        </div>

        {/* Hover tooltip (DOM, edge-clamped) */}
        {hover && (
          <div
            className="pointer-events-none absolute z-10 rounded-xl px-3 py-2.5 text-xs"
            style={{
              left: Math.min(hoverPos.x + 14, dims.W - 210),
              top:  Math.min(Math.max(hoverPos.y - 10, 6), dims.H - 120),
              background: "rgba(6,8,16,0.95)",
              border: `1px solid ${hover.color}66`,
              boxShadow: `0 8px 30px rgba(0,0,0,0.6), 0 0 20px ${hover.color}22`,
              maxWidth: 210, backdropFilter:"blur(10px)",
            }}>
            <div className="font-mono font-bold text-white mb-1 break-all">{hover.label}</div>
            {hover.tag && (
              <div className="flex items-center gap-1.5 mb-1">
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: hover.color, boxShadow:`0 0 6px ${hover.color}` }} />
                <span className="capitalize font-bold" style={{ color: hover.color }}>{hover.tag}</span>
              </div>
            )}
            {hover.solSpent > 0 && (
              <div className="text-white/50"><span className="text-white/85 font-bold">{hover.solSpent.toFixed(4)}</span> SOL</div>
            )}
            {hover.tokenAmount != null && hover.tokenAmount > 0 && (
              <div className="text-white/50">
                <span className="text-white/70 font-bold">{hover.tokenAmount > 1000 ? (hover.tokenAmount/1000).toFixed(1)+"K" : hover.tokenAmount.toFixed(2)}</span> tokens
              </div>
            )}
            {hover.slot ? <div className="text-white/30 text-[10px] mt-1">slot {hover.slot}</div> : null}
            {hover.wallet && (
              <div className="flex items-center gap-1 mt-1.5" style={{ color: C.accent, opacity: .75 }}>
                <ExternalLink className="w-2.5 h-2.5" /> click to open Solscan
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer stat strip */}
      <div className="flex items-center gap-4 text-[11px] text-white/35 px-1 flex-wrap">
        <span>Scroll to zoom · drag to pan · click a node for Solscan</span>
        {biggest && (
          <span className="ml-auto flex items-center gap-1.5">
            Biggest buyer: <span className="font-mono text-white/55">{short(biggest.wallet)}</span>
            <span className="text-white/45 font-bold">{biggest.solSpent.toFixed(3)} SOL</span>
          </span>
        )}
      </div>
    </div>
  );
}

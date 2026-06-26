import { useRef, useEffect, useState, useCallback, useMemo } from "react";
import { XrayReport, short } from "../lib/api";
import { ExternalLink } from "lucide-react";

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
  phase: number;
  tag?: RiskTag;
  solSpent: number;
  tokenAmount?: number;
  txHash?: string | null;
  slot?: number;
  visible: boolean;
  pinned?: boolean;
}

interface Link {
  a: number; b: number;
  pt: number; // particle position [0..1]
  color: string;
}

// ── Palette ───────────────────────────────────────────────────────────
const C = {
  insider:   "#ef4444",
  bundle:    "#f59e0b",
  sniper:    "#eab308",
  clean:     "#22c55e",
  funder:    "#ef4444",
  bundleHub: "#f59e0b",
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
  const sniperMap = new Map(
    (x.snipers?.wallets || []).map(w => [w.wallet, w])
  );
  const bundleSet = new Set(
    (x.bundles?.clusters || []).flatMap(c => c.wallets)
  );
  const insiderSet = new Set(
    (x.insiders?.clusters || []).flatMap(c => c.wallets)
  );

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

  const push = (n: Omit<Node,"x"|"y"|"vx"|"vy"|"phase"|"visible">) => {
    idx[n.id] = nodes.length;
    nodes.push({
      ...n,
      x: W/2 + (rand()-.5)*W*.65,
      y: H/2 + (rand()-.5)*H*.55,
      vx: (rand()-.5)*1.5,
      vy: (rand()-.5)*1.5,
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
    const r      = 8 + 22 * sz;
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
      label: "funder", r: 11, baseR: 11,
      color: C.funder, solSpent: 0,
    });
  }

  // Bundle hubs
  (report.bundles?.clusters||[]).forEach((bd, i) => {
    push({
      id: "bh:"+i, kind: "bundleHub",
      label: `slot ${bd.slot}`, r: 10, baseR: 10,
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
    for (const w of bd.wallets) {
      const wi = idx["w:"+w];
      if (wi!=null) links.push({ a: wi, b: bi, pt: rand(), color: C.bundleHub });
    }
  });

  return { nodes, links };
}

// ── Physics ───────────────────────────────────────────────────────────
function stepPhysics(nodes: Node[], links: Link[], W: number, H: number) {
  // Repulsion
  for (let i=0;i<nodes.length;i++) {
    for (let j=i+1;j<nodes.length;j++) {
      const a=nodes[i], b=nodes[j];
      const dx=a.x-b.x, dy=a.y-b.y;
      const d2=dx*dx+dy*dy||0.01, d=Math.sqrt(d2);
      const minD=a.r+b.r+12;
      const rep=2800/d2;
      const ux=dx/d, uy=dy/d;
      a.vx+=ux*rep; a.vy+=uy*rep;
      b.vx-=ux*rep; b.vy-=uy*rep;
      if (d<minD) { const p=(minD-d)*.5; a.vx+=ux*p; a.vy+=uy*p; b.vx-=ux*p; b.vy-=uy*p; }
    }
  }
  // Springs
  for (const l of links) {
    const a=nodes[l.a], b=nodes[l.b];
    const dx=b.x-a.x, dy=b.y-a.y;
    const d=Math.sqrt(dx*dx+dy*dy)||0.01;
    const target = 60;
    const f=(d-target)*.06;
    const ux=dx/d, uy=dy/d;
    a.vx+=ux*f; a.vy+=uy*f;
    b.vx-=ux*f; b.vy-=uy*f;
  }
  // Center gravity + integrate
  for (const n of nodes) {
    if (n.pinned) continue;
    n.vx+=(W/2-n.x)*.003; n.vy+=(H/2-n.y)*.003;
    n.vx*=.88; n.vy*=.88;
    n.x+=n.vx; n.y+=n.vy;
    n.x=Math.max(n.r+4, Math.min(W-n.r-4, n.x));
    n.y=Math.max(n.r+4, Math.min(H-n.r-4, n.y));
  }
}

// ── Canvas renderer ───────────────────────────────────────────────────
function drawFrame(
  ctx: CanvasRenderingContext2D,
  nodes: Node[], links: Link[],
  W: number, H: number,
  t: number,
  hover: Node | null,
  zoom: number, panX: number, panY: number,
  filterTag: RiskTag | "all",
) {
  ctx.clearRect(0,0,W,H);

  // BG grid
  ctx.save();
  ctx.strokeStyle = "rgba(34,211,238,0.04)";
  ctx.lineWidth = 1;
  const gs = 40;
  for (let x=0;x<W;x+=gs) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
  for (let y=0;y<H;y+=gs) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }
  ctx.restore();

  ctx.save();
  ctx.translate(W/2+panX, H/2+panY);
  ctx.scale(zoom, zoom);
  ctx.translate(-W/2, -H/2);

  // Update visibility
  for (const n of nodes) {
    if (n.kind !== "wallet") { n.visible = true; continue; }
    n.visible = filterTag === "all" || n.tag === filterTag;
  }

  // Links
  for (const l of links) {
    const na=nodes[l.a], nb=nodes[l.b];
    if (!na.visible && !nb.visible) continue;
    const alpha = (na.visible && nb.visible) ? 0.3 : 0.07;

    const grad = ctx.createLinearGradient(na.x,na.y,nb.x,nb.y);
    grad.addColorStop(0, `rgba(${hexRgb(na.color)},${alpha})`);
    grad.addColorStop(1, `rgba(${hexRgb(nb.color)},${alpha})`);
    ctx.strokeStyle = grad;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5,5]);
    ctx.beginPath(); ctx.moveTo(na.x,na.y); ctx.lineTo(nb.x,nb.y); ctx.stroke();
    ctx.setLineDash([]);

    if (na.visible && nb.visible) {
      l.pt = (l.pt + 0.009) % 1;
      const px = na.x + (nb.x-na.x)*l.pt;
      const py = na.y + (nb.y-na.y)*l.pt;
      ctx.shadowColor = l.color;
      ctx.shadowBlur = 12;
      ctx.fillStyle = l.color;
      ctx.beginPath(); ctx.arc(px,py,3,0,Math.PI*2); ctx.fill();
      ctx.shadowBlur = 0;
    }
  }

  // Nodes
  for (const n of nodes) {
    if (!n.visible) continue;
    const isHover = hover?.id === n.id;
    const pulse = isHover ? 1.18 : (1 + 0.07 * Math.sin(t * 1.4 + n.phase));
    const r = n.baseR * pulse;
    const rgb = hexRgb(n.color);

    // Outer glow rings
    if (isHover || n.kind !== "wallet") {
      ctx.shadowColor = n.color;
      ctx.shadowBlur = r * 3;
      ctx.strokeStyle = `rgba(${rgb},0.5)`;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(n.x, n.y, r+5, 0, Math.PI*2); ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // Pulsing danger ring for high-risk nodes
    if (n.tag === "insider" || n.tag === "bundle") {
      const ringR = n.baseR + 6 + 4 * Math.sin(t * 2.2 + n.phase);
      ctx.strokeStyle = `rgba(${rgb},${0.15 + 0.1 * Math.sin(t * 2.2 + n.phase)})`;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(n.x, n.y, ringR, 0, Math.PI*2); ctx.stroke();
    }

    // Sphere — radial gradient fill
    const g = ctx.createRadialGradient(n.x-r*.35, n.y-r*.4, 0, n.x, n.y, r);
    g.addColorStop(0,   `rgba(${rgb},1)`);
    g.addColorStop(0.5, `rgba(${rgb},0.72)`);
    g.addColorStop(1,   `rgba(${rgb},0.12)`);
    ctx.shadowColor = n.color;
    ctx.shadowBlur = r * 1.8;
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, Math.PI*2); ctx.fill();
    ctx.shadowBlur = 0;

    // Specular highlight
    const hl = ctx.createRadialGradient(n.x-r*.38, n.y-r*.42, 0, n.x-r*.38, n.y-r*.42, r*.75);
    hl.addColorStop(0, "rgba(255,255,255,0.38)");
    hl.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = hl;
    ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, Math.PI*2); ctx.fill();

    // Label under hub nodes
    if (n.kind !== "wallet" || r > 16 || isHover) {
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      ctx.font = `bold ${Math.max(9,Math.min(11,r*.5))}px monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText(n.label, n.x, n.y + r + 4);
    }
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
  const stateRef     = useRef({ zoom: 1, panX: 0, panY: 0, drag: false, lastX: 0, lastY: 0 });

  const [hover,     setHover]     = useState<Node|null>(null);
  const [hoverPos,  setHoverPos]  = useState({ x: 0, y: 0 });
  const [filter,    setFilter]    = useState<FilterTag>("all");
  const [dims,      setDims]      = useState({ W: 700, H: 390 });
  const filterRef = useRef<FilterTag>("all");
  filterRef.current = filter;

  const buyers = useMemo(() => enrichBuyers(report), [report]);

  // Build graph
  useEffect(() => {
    graphRef.current = buildGraph(report, dims.W, dims.H);
  }, [report, dims.W, dims.H]);

  // ResizeObserver
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(e => {
      const w = e[0].contentRect.width;
      if (w > 10) setDims({ W: Math.floor(w), H: Math.floor(w * 0.52) });
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // Animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let t = 0;
    const loop = (ts: number) => {
      t = ts * 0.001;
      const g = graphRef.current;
      const s = stateRef.current;
      const { W, H } = dims;
      if (g) {
        stepPhysics(g.nodes, g.links, W, H);
        drawFrame(ctx, g.nodes, g.links, W, H, t, null, s.zoom, s.panX, s.panY, filterRef.current);
      } else {
        ctx.clearRect(0,0,W,H);
      }
      animRef.current = requestAnimationFrame(loop);
    };
    animRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animRef.current);
  }, [dims]);

  // Hit test
  const hitTest = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect   = canvas.getBoundingClientRect();
    const s      = stateRef.current;
    const { W, H } = dims;
    const cx = dims.W/2, cy = dims.H/2;
    // screen → graph coords
    const sx = (e.clientX - rect.left) * (W / rect.width);
    const sy = (e.clientY - rect.top)  * (H / rect.height);
    const gx = (sx - W/2 - s.panX) / s.zoom + cx;
    const gy = (sy - H/2 - s.panY) / s.zoom + cy;
    const g  = graphRef.current;
    if (!g) return null;
    for (const n of g.nodes) {
      if (!n.visible) continue;
      if (Math.sqrt((n.x-gx)**2+(n.y-gy)**2) <= n.baseR+8) return { node: n, sx, sy };
    }
    return null;
  }, [dims]);

  const onMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const s = stateRef.current;
    if (s.drag) {
      s.panX += e.clientX - s.lastX;
      s.panY += e.clientY - s.lastY;
      s.lastX = e.clientX;
      s.lastY = e.clientY;
      setHover(null);
      return;
    }
    const hit = hitTest(e);
    setHover(hit?.node ?? null);
    if (hit) setHoverPos({ x: hit.sx, y: hit.sy });
  }, [hitTest]);

  const onMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    stateRef.current = { ...stateRef.current, drag: true, lastX: e.clientX, lastY: e.clientY };
  }, []);

  const onMouseUp = useCallback(() => { stateRef.current.drag = false; }, []);

  const onWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const s = stateRef.current;
    s.zoom = Math.max(0.4, Math.min(4, s.zoom * (e.deltaY < 0 ? 1.12 : 0.9)));
  }, []);

  const onClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const hit = hitTest(e);
    if (hit?.node.wallet) window.open(`https://solscan.io/account/${hit.node.wallet}`, "_blank");
  }, [hitTest]);

  const counts = useMemo(() => ({
    all:     buyers.length,
    insider: buyers.filter(b=>b.tag==="insider").length,
    bundle:  buyers.filter(b=>b.tag==="bundle").length,
    sniper:  buyers.filter(b=>b.tag==="sniper").length,
    clean:   buyers.filter(b=>b.tag==="clean").length,
  }), [buyers]);

  const filterBtns: { id: FilterTag; label: string; color: string }[] = [
    { id:"all",     label:"All",     color: C.accent   },
    { id:"insider", label:"Insider", color: C.insider  },
    { id:"bundle",  label:"Bundle",  color: C.bundle   },
    { id:"sniper",  label:"Sniper",  color: C.sniper   },
    { id:"clean",   label:"Clean",   color: C.clean    },
  ];

  return (
    <div className="space-y-3">
      {/* Header row */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-bold text-white/80">Wallet Relationship Graph</div>
          <div className="text-[11px] text-white/30 mt-0.5">
            Bubble size = SOL spent · Lines = shared funder or same-block bundle ·{" "}
            <span className="text-white/20">scroll to zoom · drag to pan · click = Solscan</span>
          </div>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {filterBtns.map(f => (
            <button key={f.id} onClick={() => setFilter(f.id)}
              className="text-[10px] px-2.5 py-1 rounded-full font-bold transition-all"
              style={{
                background: filter===f.id ? `${f.color}22` : "rgba(255,255,255,0.03)",
                border: `1px solid ${filter===f.id ? f.color+"55" : "rgba(255,255,255,0.07)"}`,
                color: filter===f.id ? f.color : "rgba(255,255,255,0.3)",
                boxShadow: filter===f.id ? `0 0 12px ${f.color}28` : "none",
              }}>
              {f.label} <span style={{ opacity:.55 }}>{(counts as any)[f.id]}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Canvas */}
      <div ref={containerRef} className="relative w-full rounded-2xl overflow-hidden"
        style={{
          background: "radial-gradient(ellipse at 50% 50%, rgba(34,211,238,0.05) 0%, #080810 70%)",
          border: "1px solid rgba(34,211,238,0.1)",
        }}>
        <canvas
          ref={canvasRef}
          width={dims.W}
          height={dims.H}
          className="w-full block"
          style={{ cursor: hover?.wallet ? "pointer" : stateRef.current.drag ? "grabbing" : "grab" }}
          onMouseMove={onMouseMove}
          onMouseDown={onMouseDown}
          onMouseUp={onMouseUp}
          onMouseLeave={() => { setHover(null); stateRef.current.drag = false; }}
          onWheel={onWheel}
          onClick={onClick}
        />

        {/* Zoom hint */}
        <div className="absolute top-2.5 right-2.5 text-[9px] text-white/15 tracking-wider">
          ⌨ scroll zoom · drag pan
        </div>

        {/* Legend */}
        <div className="absolute bottom-2.5 right-2.5 flex flex-col gap-1">
          {[
            { c: C.insider, l: "insider" },
            { c: C.bundle,  l: "bundle"  },
            { c: C.sniper,  l: "sniper"  },
            { c: C.clean,   l: "clean"   },
          ].map(x => (
            <span key={x.l} className="flex items-center gap-1.5 text-[9px] text-white/35">
              <span className="w-2 h-2 rounded-full" style={{ background:x.c, boxShadow:`0 0 5px ${x.c}` }} />
              {x.l}
            </span>
          ))}
        </div>

        {/* Hover tooltip */}
        {hover && (
          <div
            className="pointer-events-none absolute z-10 rounded-xl px-3 py-2.5 text-xs"
            style={{
              left: Math.min(hoverPos.x + 12, dims.W - 200),
              top:  Math.max(hoverPos.y - 60, 4),
              background: "rgba(8,8,16,0.95)",
              border: `1px solid ${hover.color}55`,
              boxShadow: `0 0 20px ${hover.color}22`,
              maxWidth: 200,
            }}>
            <div className="font-mono font-bold text-white mb-1 break-all">{hover.label}</div>
            {hover.tag && (
              <div className="flex items-center gap-1.5 mb-1">
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: hover.color }} />
                <span className="capitalize font-bold" style={{ color: hover.color }}>{hover.tag}</span>
              </div>
            )}
            {hover.solSpent > 0 && (
              <div className="text-white/50">
                <span className="text-white/80 font-bold">{hover.solSpent.toFixed(4)}</span> SOL
              </div>
            )}
            {hover.tokenAmount != null && hover.tokenAmount > 0 && (
              <div className="text-white/50">
                <span className="text-white/70 font-bold">{hover.tokenAmount > 1000 ? (hover.tokenAmount/1000).toFixed(1)+"K" : hover.tokenAmount.toFixed(2)}</span> tokens
              </div>
            )}
            {hover.slot && (
              <div className="text-white/30 text-[10px] mt-1">slot {hover.slot}</div>
            )}
            {hover.wallet && (
              <div className="flex items-center gap-1 mt-1.5" style={{ color: C.accent, opacity: .7 }}>
                <ExternalLink className="w-2.5 h-2.5" /> view on Solscan
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

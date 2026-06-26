import { useRef, useEffect, useState, useCallback } from "react";
import { XrayReport, short } from "../lib/api";

type Node = {
  id: string; kind: "wallet" | "funder" | "bundle";
  label: string; r: number; baseR: number;
  color: string; glowColor: string;
  x: number; y: number; vx: number; vy: number;
  tag?: string; wallet?: string; phase: number; visible: boolean;
};
type Link = { a: number; b: number; len: number; pt: number; };

const COLORS = {
  insider:   "#ef4444",
  bundle:    "#f59e0b",
  sniper:    "#eab308",
  clean:     "#22c55e",
  funderHub: "#ef4444",
  bundleHub: "#f59e0b",
};

function rng(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

function hexRgb(hex: string) {
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  return `${r},${g},${b}`;
}

function buildGraph(report: XrayReport, W: number, H: number) {
  const eb = (report.earlyBuyers || []).slice(0, 60);
  if (!eb.length) return null;
  const maxSol = Math.max(...eb.map(b => b.solSpent || 0), 0.001);
  const rand = rng(eb.length * 97 + 13);
  const nodes: Node[] = [];
  const idx: Record<string, number> = {};
  const push = (n: Omit<Node,"x"|"y"|"vx"|"vy"|"phase"|"visible">) => {
    idx[n.id] = nodes.length;
    nodes.push({ ...n, x: W/2+(rand()-.5)*W*.6, y: H/2+(rand()-.5)*H*.5, vx:(rand()-.5)*2, vy:(rand()-.5)*2, phase: rand()*Math.PI*2, visible: true });
    return nodes.length-1;
  };
  for (const b of eb) {
    const tag = b.insider?"insider":b.bundled?"bundle":b.sniper?"sniper":"clean";
    const r = 7 + 20 * Math.sqrt((b.solSpent||0)/maxSol);
    const c = (COLORS as any)[tag];
    push({ id:"w:"+b.wallet, kind:"wallet", label:short(b.wallet), r, baseR:r, color:c, glowColor:c, tag, wallet:b.wallet });
  }
  for (const cl of report.insiders?.clusters||[]) {
    push({ id:"f:"+cl.funder, kind:"funder", label:"funder "+short(cl.funder), r:10, baseR:10, color:COLORS.funderHub, glowColor:COLORS.funderHub, wallet:cl.funder });
  }
  (report.bundles?.clusters||[]).forEach((bd,i) => {
    push({ id:"b:"+i, kind:"bundle", label:`bundle(${bd.size})`, r:10, baseR:10, color:COLORS.bundleHub, glowColor:COLORS.bundleHub });
  });
  const links: Link[] = [];
  for (const cl of report.insiders?.clusters||[]) {
    const fi = idx["f:"+cl.funder]; if (fi==null) continue;
    for (const w of cl.wallets) { const wi=idx["w:"+w]; if (wi!=null) links.push({a:wi,b:fi,len:55,pt:Math.random()}); }
  }
  (report.bundles?.clusters||[]).forEach((bd,i) => {
    const bi=idx["b:"+i]; if (bi==null) return;
    for (const w of bd.wallets) { const wi=idx["w:"+w]; if (wi!=null) links.push({a:wi,b:bi,len:44,pt:Math.random()}); }
  });
  return { nodes, links };
}

function stepPhysics(nodes: Node[], links: Link[], W: number, H: number) {
  for (let i=0;i<nodes.length;i++) {
    for (let j=i+1;j<nodes.length;j++) {
      const a=nodes[i], b=nodes[j];
      let dx=a.x-b.x, dy=a.y-b.y;
      const d2=dx*dx+dy*dy||0.01, d=Math.sqrt(d2);
      const minD=a.r+b.r+10;
      const rep=2200/d2;
      const ux=dx/d, uy=dy/d;
      a.vx+=ux*rep; a.vy+=uy*rep;
      b.vx-=ux*rep; b.vy-=uy*rep;
      if (d<minD) { const p=(minD-d)*.4; a.vx+=ux*p; a.vy+=uy*p; b.vx-=ux*p; b.vy-=uy*p; }
    }
  }
  for (const l of links) {
    const a=nodes[l.a], b=nodes[l.b];
    const dx=b.x-a.x, dy=b.y-a.y;
    const d=Math.sqrt(dx*dx+dy*dy)||0.01;
    const f=(d-l.len)*.06;
    const ux=dx/d, uy=dy/d;
    a.vx+=ux*f; a.vy+=uy*f;
    b.vx-=ux*f; b.vy-=uy*f;
  }
  for (const n of nodes) {
    n.vx+=(W/2-n.x)*.004; n.vy+=(H/2-n.y)*.004;
    n.vx*=.88; n.vy*=.88;
    n.x+=n.vx; n.y+=n.vy;
    n.x=Math.max(n.r+4,Math.min(W-n.r-4,n.x));
    n.y=Math.max(n.r+4,Math.min(H-n.r-4,n.y));
  }
}

type Filter = "all"|"insider"|"bundle"|"sniper"|"clean";

export default function BubbleMap({ report }: { report: XrayReport }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<{ nodes: Node[]; links: Link[] } | null>(null);
  const animRef = useRef<number>(0);
  const timeRef = useRef(0);
  const [hover, setHover] = useState<Node|null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [dims, setDims] = useState({ W: 680, H: 420 });
  const filterRef = useRef<Filter>("all");
  filterRef.current = filter;

  // Build graph once
  useEffect(() => {
    graphRef.current = buildGraph(report, dims.W, dims.H);
  }, [report, dims.W, dims.H]);

  // Resize observer
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(entries => {
      const w = entries[0].contentRect.width;
      if (w > 0) setDims({ W: Math.floor(w), H: Math.floor(w * 0.55) });
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

    const draw = (ts: number) => {
      timeRef.current = ts * 0.001;
      const t = timeRef.current;
      const g = graphRef.current;
      const { W, H } = dims;

      ctx.clearRect(0,0,W,H);

      // Background grid
      ctx.strokeStyle = "rgba(34,211,238,0.04)";
      ctx.lineWidth = 1;
      const gridSize = 40;
      for (let x=0;x<W;x+=gridSize) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
      for (let y=0;y<H;y+=gridSize) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }

      if (!g) { animRef.current = requestAnimationFrame(draw); return; }

      const activeFilter = filterRef.current;

      // Update visibility
      for (const n of g.nodes) {
        if (n.kind !== "wallet") { n.visible = true; continue; }
        n.visible = activeFilter === "all"
          || (activeFilter === "insider" && n.tag === "insider")
          || (activeFilter === "bundle"  && n.tag === "bundle")
          || (activeFilter === "sniper"  && n.tag === "sniper")
          || (activeFilter === "clean"   && n.tag === "clean");
      }

      // Step physics
      stepPhysics(g.nodes, g.links, W, H);

      // Draw links
      for (const l of g.links) {
        const na=g.nodes[l.a], nb=g.nodes[l.b];
        if (!na.visible && !nb.visible) continue;
        const alpha = (na.visible && nb.visible) ? 0.25 : 0.08;

        // Gradient line
        const grad = ctx.createLinearGradient(na.x,na.y,nb.x,nb.y);
        grad.addColorStop(0, `rgba(${hexRgb(na.color)},${alpha})`);
        grad.addColorStop(1, `rgba(${hexRgb(nb.color)},${alpha})`);
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1;
        ctx.setLineDash([4,4]);
        ctx.beginPath(); ctx.moveTo(na.x,na.y); ctx.lineTo(nb.x,nb.y); ctx.stroke();
        ctx.setLineDash([]);

        // Flowing particle
        if (na.visible && nb.visible) {
          l.pt = (l.pt + 0.008) % 1;
          const px = na.x + (nb.x-na.x)*l.pt;
          const py = na.y + (nb.y-na.y)*l.pt;
          ctx.shadowColor = na.color;
          ctx.shadowBlur = 10;
          ctx.fillStyle = na.color;
          ctx.beginPath(); ctx.arc(px,py,2.5,0,Math.PI*2); ctx.fill();
          ctx.shadowBlur = 0;
        }
      }

      // Draw nodes
      for (const n of g.nodes) {
        if (!n.visible) continue;
        const pulse = n.kind === "wallet" ? 1 + 0.07 * Math.sin(t * 1.4 + n.phase) : 1 + 0.12 * Math.sin(t * 1.8 + n.phase);
        const r = n.baseR * pulse;
        const rgb = hexRgb(n.color);

        // Outer glow ring
        ctx.shadowColor = n.color;
        ctx.shadowBlur = r * 2.2;
        ctx.strokeStyle = `rgba(${rgb},0.6)`;
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(n.x, n.y, r+3, 0, Math.PI*2); ctx.stroke();
        ctx.shadowBlur = 0;

        // Sphere-like gradient fill
        const radGrad = ctx.createRadialGradient(n.x-r*.3, n.y-r*.3, r*.05, n.x, n.y, r);
        radGrad.addColorStop(0, `rgba(${rgb},1)`);
        radGrad.addColorStop(0.5, `rgba(${rgb},0.7)`);
        radGrad.addColorStop(1, `rgba(${rgb},0.15)`);
        ctx.shadowColor = n.color;
        ctx.shadowBlur = r * 1.5;
        ctx.fillStyle = radGrad;
        ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, Math.PI*2); ctx.fill();

        // Specular highlight
        ctx.shadowBlur = 0;
        const hlGrad = ctx.createRadialGradient(n.x-r*.35, n.y-r*.4, 0, n.x-r*.35, n.y-r*.4, r*.7);
        hlGrad.addColorStop(0, "rgba(255,255,255,0.35)");
        hlGrad.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = hlGrad;
        ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, Math.PI*2); ctx.fill();

        // Label (always show for hubs, show for wallet on hover)
        if (n.kind !== "wallet" || r > 14) {
          ctx.fillStyle = "rgba(255,255,255,0.7)";
          ctx.font = `bold ${Math.max(9, Math.min(11, r*.55))}px monospace`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(n.label, n.x, n.y + r + 10);
        }
      }

      animRef.current = requestAnimationFrame(draw);
    };

    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, [dims]);

  // Mouse hover
  const onMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const scaleX = dims.W / rect.width;
    const scaleY = dims.H / rect.height;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;
    const g = graphRef.current;
    if (!g) { setHover(null); return; }
    let found: Node | null = null;
    for (const n of g.nodes) {
      if (!n.visible) continue;
      const d = Math.sqrt((n.x-mx)**2 + (n.y-my)**2);
      if (d <= n.r + 6) { found = n; break; }
    }
    setHover(found);
  }, [dims]);

  const onClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (hover?.wallet) window.open(`https://solscan.io/account/${hover.wallet}`, "_blank");
  }, [hover]);

  const filters: { id: Filter; label: string; color: string; count: number }[] = [
    { id:"all",     label:"All",     color:"#22d3ee", count: report.earlyBuyers?.length||0 },
    { id:"insider", label:"Insider", color:"#ef4444", count: report.earlyBuyers?.filter(b=>b.insider).length||0 },
    { id:"bundle",  label:"Bundle",  color:"#f59e0b", count: report.earlyBuyers?.filter(b=>b.bundled).length||0 },
    { id:"sniper",  label:"Sniper",  color:"#eab308", count: report.earlyBuyers?.filter(b=>b.sniper).length||0 },
    { id:"clean",   label:"Clean",   color:"#22c55e", count: report.earlyBuyers?.filter(b=>!b.insider&&!b.bundled&&!b.sniper).length||0 },
  ];

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <div className="text-sm font-bold text-white/80">Wallet Relationship Graph</div>
          <div className="text-[11px] text-white/35 mt-0.5">Bubble size = SOL spent · Lines connect shared funders & same-block bundles</div>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {filters.map(f => (
            <button key={f.id} onClick={() => setFilter(f.id)}
              className="text-[10px] px-2.5 py-1 rounded-full font-bold transition-all"
              style={{
                background: filter===f.id ? `${f.color}25` : "rgba(255,255,255,0.04)",
                border: `1px solid ${filter===f.id ? f.color+"60" : "rgba(255,255,255,0.08)"}`,
                color: filter===f.id ? f.color : "rgba(255,255,255,0.35)",
                boxShadow: filter===f.id ? `0 0 10px ${f.color}25` : "none",
              }}>
              {f.label} <span className="opacity-60">{f.count}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Canvas */}
      <div ref={containerRef} className="relative w-full rounded-2xl overflow-hidden"
        style={{ background: "radial-gradient(ellipse at 50% 50%, rgba(34,211,238,0.04) 0%, #0a0a0f 70%)", border: "1px solid rgba(34,211,238,0.1)" }}>
        <canvas
          ref={canvasRef}
          width={dims.W}
          height={dims.H}
          className="w-full block"
          style={{ cursor: hover?.wallet ? "pointer" : "crosshair" }}
          onMouseMove={onMouseMove}
          onMouseLeave={() => setHover(null)}
          onClick={onClick}
        />
        {/* Hover tooltip */}
        {hover && (
          <div className="pointer-events-none absolute left-3 top-3 rounded-xl px-3 py-2 text-xs"
            style={{ background: "rgba(10,10,15,0.92)", border: `1px solid ${hover.color}50`, boxShadow: `0 0 20px ${hover.color}20` }}>
            <div className="font-mono font-bold text-white">{hover.label}</div>
            {hover.tag && <div className="capitalize mt-0.5" style={{ color: hover.color }}>{hover.tag}</div>}
            {hover.wallet && <div className="text-white/40 mt-0.5 flex items-center gap-1">view on Solscan ↗</div>}
          </div>
        )}
        {/* Legend */}
        <div className="absolute bottom-3 right-3 flex flex-col gap-1">
          {[
            { color: COLORS.insider, label: "insider" },
            { color: COLORS.bundle,  label: "bundle" },
            { color: COLORS.sniper,  label: "sniper" },
            { color: COLORS.clean,   label: "clean" },
          ].map(l => (
            <span key={l.label} className="flex items-center gap-1.5 text-[10px] text-white/40">
              <span className="w-2 h-2 rounded-full" style={{ background: l.color, boxShadow: `0 0 5px ${l.color}` }} />
              {l.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

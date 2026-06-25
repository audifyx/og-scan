import { useMemo, useState } from "react";
import { XrayReport, short } from "../lib/api";

// Dependency-free force-directed bubble map of a token's early buyers.
// Nodes = early-buyer wallets (sized by SOL spent), colored by risk tag.
// Hub nodes group insider clusters (shared funder) and same-block bundles, so
// coordinated wallets visually clump together. Layout is a small deterministic
// force simulation computed once — no external graph library.

type Node = { id: string; kind: "wallet" | "funder" | "bundle"; label: string; r: number; color: string; x: number; y: number; vx: number; vy: number; tag?: string; wallet?: string };
type Link = { a: number; b: number; len: number };

const COLORS = {
  insider: "#ef4444",
  bundle: "#f59e0b",
  sniper: "#eab308",
  clean: "#22c55e",
  hub: "#64748b",
  bundleHub: "#f59e0b",
  funderHub: "#ef4444",
};

// tiny seeded RNG so the layout is stable across renders
function rng(seed: number) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

function simulate(report: XrayReport) {
  const W = 640, H = 420;
  const eb = (report.earlyBuyers || []).slice(0, 30);
  if (!eb.length) return null;
  const maxSol = Math.max(...eb.map((b) => b.solSpent || 0), 0.001);
  const rand = rng(eb.length * 97 + 13);

  const nodes: Node[] = [];
  const idx: Record<string, number> = {};
  const push = (n: Omit<Node, "x" | "y" | "vx" | "vy">) => { const node = { ...n, x: W / 2 + (rand() - 0.5) * 200, y: H / 2 + (rand() - 0.5) * 160, vx: 0, vy: 0 }; idx[n.id] = nodes.length; nodes.push(node); return nodes.length - 1; };

  // wallet nodes
  for (const b of eb) {
    const tag = b.insider ? "insider" : b.bundled ? "bundle" : b.sniper ? "sniper" : "clean";
    const r = 7 + 16 * Math.sqrt((b.solSpent || 0) / maxSol);
    push({ id: "w:" + b.wallet, kind: "wallet", label: short(b.wallet), r, color: (COLORS as any)[tag], tag, wallet: b.wallet });
  }
  // insider funder hubs
  for (const cl of report.insiders?.clusters || []) {
    push({ id: "f:" + cl.funder, kind: "funder", label: "funder " + short(cl.funder), r: 6, color: COLORS.funderHub, wallet: cl.funder });
  }
  // bundle hubs
  (report.bundles?.clusters || []).forEach((bd, i) => {
    push({ id: "b:" + i, kind: "bundle", label: `bundle (${bd.size})`, r: 6, color: COLORS.bundleHub });
  });

  const links: Link[] = [];
  for (const cl of report.insiders?.clusters || []) {
    const fi = idx["f:" + cl.funder]; if (fi == null) continue;
    for (const w of cl.wallets) { const wi = idx["w:" + w]; if (wi != null) links.push({ a: wi, b: fi, len: 46 }); }
  }
  (report.bundles?.clusters || []).forEach((bd, i) => {
    const bi = idx["b:" + i]; if (bi == null) return;
    for (const w of bd.wallets) { const wi = idx["w:" + w]; if (wi != null) links.push({ a: wi, b: bi, len: 40 }); }
  });

  // force simulation
  const ITER = 160;
  for (let it = 0; it < ITER; it++) {
    const k = 1 - it / ITER; // cooling
    // repulsion
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        let dx = nodes[i].x - nodes[j].x, dy = nodes[i].y - nodes[j].y;
        let d2 = dx * dx + dy * dy || 0.01; let d = Math.sqrt(d2);
        const minD = nodes[i].r + nodes[j].r + 6;
        const rep = (1800) / d2;
        const ux = dx / d, uy = dy / d;
        nodes[i].vx += ux * rep; nodes[i].vy += uy * rep;
        nodes[j].vx -= ux * rep; nodes[j].vy -= uy * rep;
        // hard separation to avoid overlap
        if (d < minD) { const push2 = (minD - d) * 0.5; nodes[i].vx += ux * push2; nodes[i].vy += uy * push2; nodes[j].vx -= ux * push2; nodes[j].vy -= uy * push2; }
      }
    }
    // springs
    for (const l of links) {
      const a = nodes[l.a], b = nodes[l.b];
      let dx = b.x - a.x, dy = b.y - a.y; let d = Math.sqrt(dx * dx + dy * dy) || 0.01;
      const f = (d - l.len) * 0.08; const ux = dx / d, uy = dy / d;
      a.vx += ux * f; a.vy += uy * f; b.vx -= ux * f; b.vy -= uy * f;
    }
    // centering + integrate
    for (const n of nodes) {
      n.vx += (W / 2 - n.x) * 0.008; n.vy += (H / 2 - n.y) * 0.008;
      n.vx *= 0.85; n.vy *= 0.85;
      n.x += n.vx * k * 1.4; n.y += n.vy * k * 1.4;
      n.x = Math.max(n.r + 2, Math.min(W - n.r - 2, n.x));
      n.y = Math.max(n.r + 2, Math.min(H - n.r - 2, n.y));
    }
  }
  return { W, H, nodes, links };
}

export default function BubbleMap({ report }: { report: XrayReport }) {
  const [hover, setHover] = useState<Node | null>(null);
  const sim = useMemo(() => simulate(report), [report]);
  if (!sim) return null;
  const { W, H, nodes, links } = sim;

  return (
    <div className="card p-4">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-sm font-semibold">Bubble map</div>
        <div className="flex flex-wrap items-center gap-2 text-[10px] text-muted">
          <Legend c={COLORS.insider} label="insider" />
          <Legend c={COLORS.bundle} label="bundle" />
          <Legend c={COLORS.sniper} label="sniper" />
          <Legend c={COLORS.clean} label="clean" />
        </div>
      </div>
      <div className="text-[11px] text-muted mb-2">Each bubble is an early-buyer wallet, sized by SOL spent. Lines link wallets that share a funding source (insider) or bought in the same block (bundle).</div>
      <div className="relative w-full overflow-hidden rounded-xl bg-panel2/30">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ aspectRatio: `${W}/${H}` }}>
          {links.map((l, i) => (
            <line key={i} x1={nodes[l.a].x} y1={nodes[l.a].y} x2={nodes[l.b].x} y2={nodes[l.b].y} stroke="#ffffff" strokeOpacity={0.12} strokeWidth={1} />
          ))}
          {nodes.map((n, i) => (
            <g key={i} onMouseEnter={() => setHover(n)} onMouseLeave={() => setHover(null)} style={{ cursor: n.wallet ? "pointer" : "default" }}
              onClick={() => n.wallet && window.open(`https://solscan.io/account/${n.wallet}`, "_blank")}>
              <circle cx={n.x} cy={n.y} r={n.r} fill={n.color} fillOpacity={n.kind === "wallet" ? 0.85 : 0.4} stroke={n.color} strokeOpacity={0.9} strokeWidth={n.kind === "wallet" ? 0 : 1.5} />
            </g>
          ))}
        </svg>
        {hover && (
          <div className="pointer-events-none absolute left-2 top-2 rounded-lg bg-black/80 px-2.5 py-1.5 text-[11px]">
            <div className="font-mono text-white">{hover.label}</div>
            {hover.tag && <div className="text-muted capitalize">{hover.tag}</div>}
            {hover.wallet && <div className="text-accent/80">click to open on Solscan</div>}
          </div>
        )}
      </div>
    </div>
  );
}

function Legend({ c, label }: { c: string; label: string }) {
  return <span className="inline-flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: c }} />{label}</span>;
}

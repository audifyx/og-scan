import { useEffect, useMemo, useRef, type PointerEvent } from "react";
import type { ChainEvent, CityDistricts, KolCard, TokenDistrict } from "./api";
import { fmtNum, fmtUsd } from "./format";
import { ORBITX_MINT } from "../../../shared/orbitx-chain-intel.js";

type Props = {
  kols: KolCard[];
  districts?: CityDistricts | null;
  events?: ChainEvent[];
  followWallet?: string | null;
  cinematic?: boolean;
  paused?: boolean;
  onWallet: (address: string) => void;
  onToken: (mint: string) => void;
};

const SEED: TokenDistrict[] = [
  { mint: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN", symbol: "JUP", name: "Jupiter", kind: "token" },
  { mint: "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R", symbol: "RAY", name: "Raydium", kind: "token" },
  { mint: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263", symbol: "BONK", name: "Bonk", kind: "token" },
  { mint: "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm", symbol: "WIF", name: "dogwifhat", kind: "token" },
  { mint: "2zMMhcVQEXDtdE6vsFS7S7D5oUodfJHE8vd1gnBouauv", symbol: "PENGU", name: "Pudgy Penguins", kind: "token" },
  { mint: "6p6xgHyF7AeE6TZkSmFsko444wqoP15icUSqi2jfGiPN", symbol: "TRUMP", name: "Official Trump", kind: "token" },
];

type Hit = { kind: "wallet" | "token" | "hub"; id: string; x: number; y: number; r: number };
type Block = { x: number; z: number; w: number; d: number; h: number; left: string; right: string; top: string };

function hash(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return h >>> 0;
}

function fillCity(): Block[] {
  const out: Block[] = [];
  for (let gx = -16; gx <= 16; gx++) {
    for (let gz = -16; gz <= 16; gz++) {
      const x = gx * 1.15;
      const z = gz * 1.15;
      const r = Math.hypot(x, z);
      if (r < 3.4 || r > 17.8) continue;
      if (Math.abs(r - 6.2) < 0.38 || Math.abs(r - 9.4) < 0.38 || Math.abs(r - 13.2) < 0.38) continue;
      const n = Math.abs(gx * 17 + gz * 41);
      const cool = n % 5 === 0;
      out.push({
        x,
        z,
        w: 0.72 + (n % 3) * 0.12,
        d: 0.72 + ((n + 1) % 3) * 0.12,
        h: 1.1 + (n % 11) * 0.42 + (r > 14 ? 1.1 : 0),
        left: cool ? "#123044" : "#1a1233",
        right: cool ? "#1d4e5f" : "#2a1a4a",
        top: cool ? "#2dd4bf" : "#7c3aed",
      });
    }
  }
  return out.slice(0, 240);
}

function project(x: number, z: number, y: number, az: number, scale: number, cx: number, cy: number): [number, number] {
  const c = Math.cos(az);
  const s = Math.sin(az);
  const rx = x * c - z * s;
  const rz = x * s + z * c;
  return [cx + (rx - rz) * scale, cy + (rx + rz) * scale * 0.5 - y * scale];
}

function face(ctx: CanvasRenderingContext2D, pts: [number, number][], fill: string, stroke?: string) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }
}

function drawBox(
  ctx: CanvasRenderingContext2D,
  x: number,
  z: number,
  w: number,
  d: number,
  h: number,
  az: number,
  scale: number,
  cx: number,
  cy: number,
  left: string,
  right: string,
  top: string,
) {
  const hw = w / 2;
  const hd = d / 2;
  const g = [
    project(x - hw, z - hd, 0, az, scale, cx, cy),
    project(x + hw, z - hd, 0, az, scale, cx, cy),
    project(x + hw, z + hd, 0, az, scale, cx, cy),
    project(x - hw, z + hd, 0, az, scale, cx, cy),
  ];
  const t = [
    project(x - hw, z - hd, h, az, scale, cx, cy),
    project(x + hw, z - hd, h, az, scale, cx, cy),
    project(x + hw, z + hd, h, az, scale, cx, cy),
    project(x - hw, z + hd, h, az, scale, cx, cy),
  ];
  const mid = Math.cos(az);
  if (mid >= 0) face(ctx, [g[3], g[2], t[2], t[3]], left);
  else face(ctx, [g[0], g[1], t[1], t[0]], left);
  if (Math.sin(az) >= 0) face(ctx, [g[2], g[1], t[1], t[2]], right);
  else face(ctx, [g[3], g[0], t[0], t[3]], right);
  face(ctx, [t[0], t[1], t[2], t[3]], top, "rgba(245,208,254,0.18)");
}

function pill(ctx: CanvasRenderingContext2D, x: number, y: number, text: string, color: string) {
  ctx.font = "600 11px 'IBM Plex Mono', monospace";
  const tw = ctx.measureText(text).width;
  ctx.fillStyle = "rgba(8,6,18,0.82)";
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  const bx = x - tw / 2 - 6;
  const by = y - 10;
  ctx.beginPath();
  ctx.rect(bx, by, tw + 12, 16);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.fillText(text, x - tw / 2, y + 2);
}

export default function CssCity({ kols, districts, events, followWallet, cinematic = true, paused = false, onWallet, onToken }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const hits = useRef<Hit[]>([]);
  const az = useRef(0.72);
  const drag = useRef({ on: false, x: 0, base: 0.72, moved: false });
  const blocks = useMemo(fillCity, []);
  const tokens = useMemo(() => {
    const byMint = new Map<string, TokenDistrict>();
    for (const s of SEED) byMint.set(s.mint, s);
    for (const t of districts?.tokens || []) if (t?.mint) byMint.set(t.mint, { ...byMint.get(t.mint), ...t });
    return [...byMint.values()].slice(0, 16);
  }, [districts?.tokens]);

  useEffect(() => {
    if (paused) return undefined;
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    const t0 = performance.now();

    const resize = () => {
      const r = canvas.parentElement?.getBoundingClientRect();
      const w = Math.max(320, r?.width || 800);
      const h = Math.max(240, r?.height || 520);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    if (canvas.parentElement) ro.observe(canvas.parentElement);

    const loop = (now: number) => {
      const t = (now - t0) / 1000;
      if (cinematic && !drag.current.on) az.current += 0.0032;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      const cx = w / 2;
      const cy = h * 0.62;
      const scale = Math.min(w, h) * 0.028;
      const angle = az.current;
      hits.current = [];

      const sky = ctx.createRadialGradient(cx, h * 0.18, 20, cx, cy, Math.max(w, h) * 0.7);
      sky.addColorStop(0, "#1a0b33");
      sky.addColorStop(0.45, "#0a0618");
      sky.addColorStop(1, "#04020a");
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, h);

      ctx.fillStyle = "rgba(255,255,255,0.55)";
      for (let i = 0; i < 70; i++) {
        const sx = (hash(`s${i}`) % 1000) / 1000 * w;
        const sy = (hash(`y${i}`) % 1000) / 1000 * h * 0.42;
        ctx.fillRect(sx, sy, i % 7 === 0 ? 2 : 1, i % 7 === 0 ? 2 : 1);
      }

      ctx.save();
      ctx.shadowColor = "#c084fc";
      ctx.shadowBlur = 28;
      ctx.beginPath();
      ctx.ellipse(cx, cy + 8, scale * 18, scale * 9, 0, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(88, 28, 135, 0.35)";
      ctx.fill();
      ctx.restore();

      for (const ringR of [6.2, 9.4, 13.2, 16.6]) {
        ctx.beginPath();
        for (let i = 0; i <= 64; i++) {
          const a = (i / 64) * Math.PI * 2;
          const [px, py] = project(Math.cos(a) * ringR, Math.sin(a) * ringR, 0.02, angle, scale, cx, cy);
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.strokeStyle = ringR === 6.2 ? "rgba(192,132,252,0.45)" : ringR === 9.4 ? "rgba(34,211,238,0.28)" : "rgba(251,146,60,0.2)";
        ctx.lineWidth = 1.4;
        ctx.stroke();
      }

      const drawables: { depth: number; draw: () => void }[] = [];
      for (const b of blocks) {
        const c = Math.cos(angle);
        const s = Math.sin(angle);
        const depth = b.x * s + b.z * c;
        drawables.push({
          depth,
          draw: () => drawBox(ctx, b.x, b.z, b.w, b.d, b.h, angle, scale, cx, cy, b.left, b.right, b.top + "99"),
        });
      }

      const hubs = [
        { id: "jupiter", label: "JUPITER DEX", x: 8.8, z: 3.2, color: "#22d3ee" },
        { id: "raydium", label: "RAYDIUM DEX", x: -8.2, z: 5.1, color: "#a78bfa" },
        { id: "pumpfun", label: "PUMP.FUN", x: 5.4, z: -8.6, color: "#fb923c" },
      ];
      for (const hub of hubs) {
        const depth = hub.x * Math.sin(angle) + hub.z * Math.cos(angle);
        drawables.push({
          depth,
          draw: () => {
            drawBox(ctx, hub.x, hub.z, 2.1, 2.1, 3.4, angle, scale, cx, cy, "#101018", "#1c1630", hub.color);
            const [lx, ly] = project(hub.x, hub.z, 4.1, angle, scale, cx, cy);
            pill(ctx, lx, ly, hub.label, hub.color);
            hits.current.push({ kind: "hub", id: hub.id, x: lx, y: ly, r: 28 });
          },
        });
      }

      tokens.forEach((tok, i) => {
        const a = (i / Math.max(tokens.length, 1)) * Math.PI * 2 + 0.5;
        const r = 9.8 + (hash(tok.mint) % 40) / 18;
        const x = Math.cos(a) * r;
        const z = Math.sin(a) * r;
        const hh = 2.2 + Math.min(4.2, Math.log10(Math.max(tok.market_cap || tok.volume_24h || 12, 12)) * 0.55);
        const cap = tok.market_cap != null ? fmtUsd(tok.market_cap) : tok.volume_24h != null ? `${fmtNum(tok.volume_24h)} VOL` : "";
        const label = cap ? `$${tok.symbol} (${cap})` : `$${tok.symbol}`;
        drawables.push({
          depth: x * Math.sin(angle) + z * Math.cos(angle),
          draw: () => {
            drawBox(ctx, x, z, 1.15, 1.15, hh, angle, scale, cx, cy, "#151226", "#24183c", tok.source === "pumpfun" ? "#fb923c" : "#67e8f9");
            const [lx, ly] = project(x, z, hh + 0.55, angle, scale, cx, cy);
            pill(ctx, lx, ly, label, "#e9d5ff");
            hits.current.push({ kind: "token", id: tok.mint, x: lx, y: ly, r: 26 });
          },
        });
      });

      drawables.sort((a, b) => a.depth - b.depth);
      for (const d of drawables) d.draw();

      drawBox(ctx, 0, 0, 2.4, 2.4, 1.1, angle, scale, cx, cy, "#2e1064", "#4c1d95", "#c084fc");
      drawBox(ctx, 0, 0, 1.35, 1.35, 6.4, angle, scale, cx, cy, "#5b21b6", "#7c3aed", "#f5d0fe");
      const [ox, oy] = project(0, 0, 7.3, angle, scale, cx, cy);
      ctx.save();
      ctx.translate(ox, oy);
      ctx.rotate(t * 0.6);
      ctx.shadowColor = "#c084fc";
      ctx.shadowBlur = 22;
      ctx.fillStyle = "#f5d0fe";
      ctx.beginPath();
      ctx.moveTo(0, -14);
      ctx.lineTo(10, 0);
      ctx.lineTo(0, 14);
      ctx.lineTo(-10, 0);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      const oxCap = districts?.orbitx?.market_cap != null ? `ORBITX (${fmtUsd(districts.orbitx.market_cap)})` : "ORBITX";
      pill(ctx, ox, oy - 28, oxCap, "#f5d0fe");
      hits.current.push({ kind: "token", id: ORBITX_MINT, x: ox, y: oy - 20, r: 36 });

      kols.slice(0, 28).forEach((k, i) => {
        const a = (i / Math.max(kols.length, 1)) * Math.PI * 2 - Math.PI / 2;
        const r = 6.2;
        const x = Math.cos(a) * r;
        const z = Math.sin(a) * r;
        const bob = 0.35 + Math.sin(t * 2.2 + i) * 0.08;
        const [px, py] = project(x, z, bob, angle, scale, cx, cy);
        const on = followWallet === k.address;
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(Math.PI / 4);
        ctx.shadowColor = on ? "#f0abfc" : "#e879f9";
        ctx.shadowBlur = on ? 16 : 8;
        ctx.fillStyle = on ? "#f0abfc" : "#e879f9";
        ctx.fillRect(-5, -5, 10, 10);
        ctx.restore();
        if (on || i < 8) pill(ctx, px, py - 16, k.name, "#f9a8d4");
        hits.current.push({ kind: "wallet", id: k.address, x: px, y: py, r: 16 });
      });

      (events || []).filter((e) => e.orbitx_related || e.kol_related || e.importance >= 12).slice(0, 10).forEach((e, i) => {
        const [ex, ey] = project(Math.cos(i) * 6.2, Math.sin(i) * 6.2, 1.4, angle, scale, cx, cy);
        ctx.strokeStyle = e.event_type.includes("SELL") ? "rgba(251,113,133,0.55)" : e.event_type.includes("BURN") ? "rgba(245,158,11,0.55)" : "rgba(52,211,153,0.5)";
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(ex, ey);
        ctx.quadraticCurveTo((ex + ox) / 2, Math.min(ey, oy) - 40, ox, oy);
        ctx.stroke();
      });

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [blocks, cinematic, districts?.orbitx?.market_cap, events, followWallet, kols, paused, tokens]);

  function pick(ev: PointerEvent<HTMLCanvasElement>) {
    if (drag.current.moved) return;
    const box = ev.currentTarget.getBoundingClientRect();
    const x = ev.clientX - box.left;
    const y = ev.clientY - box.top;
    let best: Hit | null = null;
    let bestD = 40;
    for (const h of hits.current) {
      const d = Math.hypot(h.x - x, h.y - y);
      if (d < h.r && d < bestD) {
        best = h;
        bestD = d;
      }
    }
    if (!best) return;
    if (best.kind === "wallet") onWallet(best.id);
    else onToken(best.id);
  }

  return (
    <canvas
      ref={ref}
      className="oxw-iso"
      aria-label="OrbitX 3D city"
      onClick={pick}
      onPointerDown={(e) => {
        drag.current = { on: true, x: e.clientX, base: az.current, moved: false };
        (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (!drag.current.on) return;
        if (Math.abs(e.clientX - drag.current.x) > 4) drag.current.moved = true;
        az.current = drag.current.base + (e.clientX - drag.current.x) * 0.008;
      }}
      onPointerUp={() => { drag.current.on = false; }}
    />
  );
}

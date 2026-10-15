import { useEffect, useMemo } from "react";
import * as THREE from "three";
import type { AvatarStats } from "./LivingAvatar";

export type ScreenKind = "orbitx" | "xscan" | "terminal" | "radar";

function fmtPrice(p: number | null | undefined): string {
  if (p == null || !isFinite(p) || p <= 0) return "—";
  if (p < 0.0001) return `$${p.toExponential(2)}`;
  return `$${p.toFixed(6)}`;
}
function fmtUsd(n: number | null | undefined): string {
  if (n == null || !isFinite(n)) return "—";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}k`;
  return `$${n.toFixed(0)}`;
}

// deterministic pseudo-random walk for the sparkline, seeded by price
function sparkPoints(price: number, change: number, n = 40): number[] {
  let seed = Math.floor(Math.abs(price * 1e9)) || 12345;
  const rand = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const pts: number[] = [0];
  const drift = change / 100 / n;
  for (let i = 1; i < n; i++) pts.push(pts[i - 1] + drift + (rand() - 0.5) * 0.012);
  return pts;
}

const X_LINES = [
  "@orbitx_wrld: ORBITX just burned 🔥",
  "whale alert: +2.1M ORBITX bought",
  "new holder ATH — 1,042 wallets",
  "LP depth up 12% this week",
  "city district 3 now online 🌆",
  "agent #4 just came alive",
  "burn bot: 500k ORBITX → incinerator",
];

const TERM_LINES = [
  "$ orbitx build --city",
  "✓ compiling agent-core…",
  "✓ linking 7 AI citizens",
  "✓ raising tower district",
  "✓ syncing on-chain state",
  "$ orbitx deploy --mainnet",
  "→ live at orbitx.world/token",
  "$ orbitx scan --x --mentions",
];

function drawScreen(g: CanvasRenderingContext2D, kind: ScreenKind, stats: AvatarStats, frame: number) {
  const W = 256, H = 160;
  // bg
  g.fillStyle = "#04070f";
  g.fillRect(0, 0, W, H);
  g.strokeStyle = "rgba(45,212,191,0.25)";
  g.lineWidth = 2;
  g.strokeRect(1, 1, W - 2, H - 2);

  if (kind === "orbitx") {
    const up = (stats.change24h ?? 0) >= 0;
    const col = up ? "#34d399" : "#fb7185";
    g.fillStyle = "#5eead4";
    g.font = "bold 13px monospace";
    g.fillText("◈ ORBITX COMMAND", 10, 20);
    g.fillStyle = "#fff";
    g.font = "bold 26px monospace";
    g.fillText(fmtPrice(stats.price), 10, 50);
    g.fillStyle = col;
    g.font = "bold 14px monospace";
    const chg = stats.change24h;
    g.fillText(chg != null ? `${up ? "▲" : "▼"} ${Math.abs(chg).toFixed(2)}% 24h` : "—", 10, 72);
    g.fillStyle = "rgba(255,255,255,0.55)";
    g.font = "11px monospace";
    g.fillText(`MCAP ${fmtUsd(stats.mcap)}`, 10, 90);
    g.fillText(`LIQ  ${fmtUsd(stats.liquidity)}`, 10, 106);
    // sparkline
    const pts = sparkPoints(stats.price ?? 0.00001, stats.change24h ?? 0);
    const min = Math.min(...pts), max = Math.max(...pts);
    g.strokeStyle = col;
    g.lineWidth = 2;
    g.beginPath();
    pts.forEach((p, i) => {
      const x = 10 + (i / (pts.length - 1)) * (W - 20);
      const y = 150 - ((p - min) / (max - min || 1)) * 34;
      i === 0 ? g.moveTo(x, y) : g.lineTo(x, y);
    });
    g.stroke();
    // live dot
    if (frame % 2 === 0) { g.fillStyle = "#34d399"; g.beginPath(); g.arc(W - 14, 16, 4, 0, 7); g.fill(); }
    g.fillStyle = "rgba(255,255,255,0.4)";
    g.font = "9px monospace";
    g.fillText("LIVE", W - 44, 20);
  }

  if (kind === "xscan") {
    g.fillStyle = "#7dd3fc";
    g.font = "bold 13px monospace";
    g.fillText("𝕏 SCANNER", 10, 20);
    const pct = 12 + ((frame * 7) % 88);
    g.fillStyle = "rgba(255,255,255,0.12)";
    g.fillRect(10, 28, W - 20, 8);
    g.fillStyle = "#7dd3fc";
    g.fillRect(10, 28, (W - 20) * (pct / 100), 8);
    g.fillStyle = "rgba(255,255,255,0.6)";
    g.font = "10px monospace";
    g.fillText(`scanning mentions… ${pct}%`, 10, 50);
    g.font = "10px monospace";
    const off = frame % X_LINES.length;
    for (let i = 0; i < 5; i++) {
      const line = X_LINES[(off + i) % X_LINES.length];
      g.fillStyle = i === 0 ? "#e0f2fe" : "rgba(224,242,254,0.45)";
      g.fillText(line.slice(0, 34), 10, 68 + i * 17);
    }
  }

  if (kind === "terminal") {
    g.fillStyle = "#a78bfa";
    g.font = "bold 13px monospace";
    g.fillText("▊ BUILD TERMINAL", 10, 20);
    g.font = "10px monospace";
    const count = 6;
    const off = frame % TERM_LINES.length;
    for (let i = 0; i < count; i++) {
      const line = TERM_LINES[(off + i) % TERM_LINES.length];
      g.fillStyle = line.startsWith("$") ? "#5eead4" : line.startsWith("✓") ? "#34d399" : line.startsWith("→") ? "#fbbf24" : "rgba(255,255,255,0.6)";
      g.fillText(line.slice(0, 36), 10, 40 + i * 18);
    }
    if (frame % 2 === 0) {
      g.fillStyle = "#5eead4";
      g.fillRect(10, 40 + count * 18, 8, 12);
    }
  }

  if (kind === "radar") {
    const cx = W / 2, cy = H / 2 + 6, R = 58;
    g.strokeStyle = "rgba(52,211,153,0.5)";
    g.lineWidth = 1;
    for (const r of [R, R * 0.66, R * 0.33]) { g.beginPath(); g.arc(cx, cy, r, 0, 7); g.stroke(); }
    g.beginPath(); g.moveTo(cx - R, cy); g.lineTo(cx + R, cy); g.stroke();
    g.beginPath(); g.moveTo(cx, cy - R); g.lineTo(cx, cy + R); g.stroke();
    // sweep
    const a = (frame * 0.5) % (Math.PI * 2);
    const grad = g.createLinearGradient(cx, cy, cx + Math.cos(a) * R, cy + Math.sin(a) * R);
    grad.addColorStop(0, "rgba(52,211,153,0.7)");
    grad.addColorStop(1, "rgba(52,211,153,0)");
    g.strokeStyle = grad;
    g.lineWidth = 3;
    g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); g.stroke();
    // blips
    const blips: Array<[number, number]> = [[0.5, 1.1], [2.4, 0.4], [4.1, 2.2], [1.2, 3.6], [5.3, 4.4]];
    blips.forEach(([ba, br], i) => {
      const bx = cx + Math.cos(ba) * R * (br / 5.5);
      const by = cy + Math.sin(ba) * R * (br / 5.5);
      const on = ((a - ba) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) < 2.2;
      g.fillStyle = on ? "#34d399" : "rgba(52,211,153,0.35)";
      g.beginPath(); g.arc(bx, by, on ? 4 : 2.5, 0, 7); g.fill();
      if (on && i === 1) { g.fillStyle = "#fff"; g.font = "9px monospace"; g.fillText("WHALE", bx + 6, by); }
    });
    g.fillStyle = "#5eead4";
    g.font = "bold 11px monospace";
    g.fillText("TOKEN SCAN", 10, 18);
  }
}

/** Live canvas texture for a monitor screen. Redraws on an interval. */
export function useScreenTexture(kind: ScreenKind, stats: AvatarStats): THREE.CanvasTexture {
  const tex = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 256; c.height = 160;
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);

  useEffect(() => {
    let frame = 0;
    let alive = true;
    const speed = kind === "radar" ? 350 : 2800;
    const draw = () => {
      if (!alive) return;
      const c = tex.image as HTMLCanvasElement;
      const g = c.getContext("2d")!;
      drawScreen(g, kind, stats, frame++);
      tex.needsUpdate = true;
    };
    draw();
    const id = setInterval(draw, speed);
    return () => { alive = false; clearInterval(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tex, kind, stats.price, stats.change24h, stats.mcap, stats.liquidity]);

  return tex;
}

/**
 * OrbitX City — live token chart board.
 *
 * Facade-mounted screen bound to the real OrbitX screener feed. Renders a
 * sparkline plus price and 24h change for one token, so the Meme Market and
 * trading venues show actual market data rather than dressing.
 *
 * Price history accumulates from successive polls; until enough samples exist
 * the board shows a flat baseline and says so rather than drawing a fake curve.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import {
  fmtUsd,
  num,
  type ScreenerRow,
} from "@/lib/orbitxcity/marketData";

export interface ChartBoardProps {
  row?: ScreenerRow;
  position: [number, number, number];
  rotationY?: number;
  width?: number;
  height?: number;
  /** Poll-driven history injected by the parent, newest last. */
  history?: number[];
}

const W = 512;
const H = 320;

function drawBoard(
  ctx: CanvasRenderingContext2D,
  row: ScreenerRow | undefined,
  history: number[],
  t: number,
) {
  // Panel
  ctx.fillStyle = "#0b0e14";
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "rgba(255,255,255,0.09)";
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, W - 2, H - 2);

  if (!row) {
    ctx.fillStyle = "rgba(255,255,255,0.34)";
    ctx.font = "500 20px Inter, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Connecting to feed…", W / 2, H / 2);
    return;
  }

  const change = num(row.change24h) ?? 0;
  const up = change >= 0;
  const accent = up ? "#3ddc84" : "#ff5c5c";

  // Header
  ctx.textAlign = "left";
  ctx.fillStyle = "#f2f5f9";
  ctx.font = "700 34px Inter, system-ui, sans-serif";
  ctx.fillText((row.symbol ?? "—").toUpperCase().slice(0, 10), 22, 50);

  ctx.fillStyle = "rgba(242,245,249,0.44)";
  ctx.font = "500 16px Inter, system-ui, sans-serif";
  ctx.fillText((row.name ?? "").slice(0, 26), 22, 74);

  // Price + change
  ctx.textAlign = "right";
  ctx.fillStyle = "#f2f5f9";
  ctx.font = "700 30px Inter, system-ui, sans-serif";
  ctx.fillText(fmtUsd(row.priceUsd), W - 22, 50);

  ctx.fillStyle = accent;
  ctx.font = "600 19px Inter, system-ui, sans-serif";
  ctx.fillText(`${up ? "+" : ""}${change.toFixed(2)}%`, W - 22, 76);

  // Chart frame
  const cx = 22;
  const cy = 104;
  const cw = W - 44;
  const ch = 150;

  ctx.strokeStyle = "rgba(255,255,255,0.07)";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 3; i += 1) {
    const y = cy + (ch / 3) * i;
    ctx.beginPath();
    ctx.moveTo(cx, y);
    ctx.lineTo(cx + cw, y);
    ctx.stroke();
  }

  if (history.length < 2) {
    ctx.fillStyle = "rgba(255,255,255,0.26)";
    ctx.font = "500 15px Inter, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Building price history…", cx + cw / 2, cy + ch / 2);
  } else {
    const min = Math.min(...history);
    const max = Math.max(...history);
    const range = max - min || 1;
    const step = cw / (history.length - 1);

    // Fill under the curve
    ctx.beginPath();
    ctx.moveTo(cx, cy + ch);
    history.forEach((v, i) => {
      const x = cx + i * step;
      const y = cy + ch - ((v - min) / range) * ch;
      ctx.lineTo(x, y);
    });
    ctx.lineTo(cx + cw, cy + ch);
    ctx.closePath();
    ctx.fillStyle = up ? "rgba(61,220,132,0.16)" : "rgba(255,92,92,0.16)";
    ctx.fill();

    // Curve
    ctx.beginPath();
    history.forEach((v, i) => {
      const x = cx + i * step;
      const y = cy + ch - ((v - min) / range) * ch;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = accent;
    ctx.lineWidth = 3;
    ctx.stroke();

    // Live head dot
    const lastX = cx + cw;
    const lastY =
      cy + ch - ((history[history.length - 1]! - min) / range) * ch;
    ctx.beginPath();
    ctx.arc(lastX, lastY, 4 + Math.sin(t * 3) * 1.2, 0, Math.PI * 2);
    ctx.fillStyle = accent;
    ctx.fill();
  }

  // Footer stats
  ctx.textAlign = "left";
  ctx.fillStyle = "rgba(242,245,249,0.38)";
  ctx.font = "500 14px Inter, system-ui, sans-serif";
  ctx.fillText(`VOL ${fmtUsd(row.volume24h)}`, 22, H - 22);
  ctx.textAlign = "right";
  ctx.fillText(`LIQ ${fmtUsd(row.liquidity)}`, W - 22, H - 22);

  // Live pip
  ctx.beginPath();
  ctx.arc(W / 2, H - 27, 3.4, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(61,220,132,${0.45 + Math.sin(t * 2.4) * 0.35})`;
  ctx.fill();
}

export function ChartBoard({
  row,
  position,
  rotationY = 0,
  width = 8,
  height = 5,
  history = [],
}: ChartBoardProps) {
  const canvas = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    return c;
  }, []);

  const texture = useMemo(() => {
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  }, [canvas]);

  useEffect(() => () => texture.dispose(), [texture]);

  const acc = useRef(0);
  const rowRef = useRef(row);
  const histRef = useRef(history);
  rowRef.current = row;
  histRef.current = history;

  useFrame((state, delta) => {
    acc.current += delta;
    // Repaint at ~6fps: enough for the pulse, cheap on mobile.
    if (acc.current < 0.16) return;
    acc.current = 0;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    drawBoard(ctx, rowRef.current, histRef.current, state.clock.elapsedTime);
    texture.needsUpdate = true;
  });

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {/* Bezel */}
      <mesh castShadow>
        <boxGeometry args={[width + 0.4, height + 0.4, 0.3]} />
        <meshStandardMaterial color="#14181f" roughness={0.8} flatShading />
      </mesh>
      {/* Screen */}
      <mesh position={[0, 0, 0.17]}>
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial map={texture} toneMapped={false} />
      </mesh>
    </group>
  );
}

/**
 * Accumulates a rolling price series per mint from successive feed polls.
 * Returns real observed samples only — no synthetic points.
 */
export function usePriceHistory(rows: ScreenerRow[], cap = 40) {
  const [history, setHistory] = useState<Record<string, number[]>>({});

  useEffect(() => {
    if (!rows.length) return;
    setHistory((prev) => {
      const next = { ...prev };
      for (const r of rows) {
        const key = r.mint ?? r.address ?? r.symbol;
        const price = num(r.priceUsd);
        if (!key || price === undefined) continue;
        const series = next[key] ? [...next[key]!] : [];
        if (series[series.length - 1] !== price) series.push(price);
        next[key] = series.slice(-cap);
      }
      return next;
    });
  }, [rows, cap]);

  return history;
}

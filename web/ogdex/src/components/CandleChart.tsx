import { useEffect, useRef, useState, useCallback } from "react";
import { getChart, Candle, fmtUsd, compact } from "../lib/api";
import { Loader2, CandlestickChart } from "lucide-react";

const IVLS = [
  { l: "5m", v: "5m" },
  { l: "15m", v: "15m" },
  { l: "1h", v: "1h" },
  { l: "4h", v: "4h" },
  { l: "1D", v: "1d" },
];

function renderChart(canvas: HTMLCanvasElement, candles: Candle[]) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const rect = canvas.getBoundingClientRect();
  const W = rect.width;
  const H = rect.height;
  if (!W || !H) return;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, W, H);

  const PAD = { top: 10, right: 6, bottom: 48, left: 62 };
  const VOL_H = 44;
  const chartH = H - PAD.top - PAD.bottom - VOL_H - 6;
  const chartW = W - PAD.left - PAD.right;
  const volTop = H - PAD.bottom - VOL_H;
  const n = candles.length;
  if (!n || chartH < 10 || chartW < 10) return;

  const highs = candles.map((c) => c.high);
  const lows = candles.map((c) => c.low);
  const maxP = Math.max(...highs);
  const minP = Math.min(...lows);
  const span = maxP - minP || maxP * 0.002 || 0.000001;
  const pY = (p: number) => PAD.top + (1 - (p - minP) / span) * chartH;

  const maxV = Math.max(...candles.map((c) => c.volume)) || 1;
  const cw = Math.max(1, Math.floor(chartW / n) - 1);

  // Grid
  ctx.lineWidth = 0.5;
  ctx.setLineDash([2, 3]);
  for (let i = 0; i <= 4; i++) {
    const y = PAD.top + (i / 4) * chartH;
    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    ctx.beginPath();
    ctx.moveTo(PAD.left, y);
    ctx.lineTo(PAD.left + chartW, y);
    ctx.stroke();
    const price = maxP - (i / 4) * span;
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.font = "9px monospace";
    ctx.textAlign = "right";
    const label = price < 0.000001 ? price.toExponential(2) : price < 0.001 ? price.toFixed(8) : price < 1 ? price.toFixed(5) : price.toLocaleString(undefined, { maximumFractionDigits: 2 });
    ctx.fillText(label, PAD.left - 3, y + 3);
  }
  ctx.setLineDash([]);

  // Candles
  candles.forEach((c, i) => {
    const x = PAD.left + (i / n) * chartW;
    const cx = x + cw / 2;
    const isUp = c.close >= c.open;
    const col = isUp ? "#22c55e" : "#ef4444";
    const openY = pY(c.open);
    const closeY = pY(c.close);
    const highY = pY(c.high);
    const lowY = pY(c.low);
    ctx.strokeStyle = col;
    ctx.fillStyle = col;
    ctx.lineWidth = 1;
    // Wick
    ctx.beginPath();
    ctx.moveTo(cx, highY);
    ctx.lineTo(cx, lowY);
    ctx.stroke();
    // Body
    const top = Math.min(openY, closeY);
    const bh = Math.max(1, Math.abs(closeY - openY));
    if (bh <= 1) {
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, cx);
      ctx.lineTo(x + cw, cx);
      ctx.stroke();
    } else {
      ctx.fillRect(x, top, cw, bh);
    }
    // Volume
    const vH = Math.max(1, (c.volume / maxV) * VOL_H);
    ctx.fillStyle = isUp ? "rgba(34,197,94,0.35)" : "rgba(239,68,68,0.35)";
    ctx.fillRect(x, volTop + VOL_H - vH, cw, vH);
  });

  // Vol label
  ctx.fillStyle = "rgba(255,255,255,0.25)";
  ctx.font = "8px sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("VOL", PAD.left + 2, volTop + 9);
}

export default function CandleChart({
  mint, chain = "solana", symbol,
}: {
  mint: string; chain?: string; symbol?: string;
}) {
  const [candles, setCandles] = useState<Candle[]>([]);
  const [ivl, setIvl] = useState("1h");
  const [loading, setLoading] = useState(true);
  const [noData, setNoData] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const load = useCallback(() => {
    setLoading(true);
    setNoData(false);
    getChart(mint, ivl, 200, chain)
      .then((d) => {
        if (d?.ok && d.candles?.length > 4) {
          setCandles(d.candles);
          setNoData(false);
        } else {
          setNoData(true);
        }
      })
      .catch(() => setNoData(true))
      .finally(() => setLoading(false));
  }, [mint, ivl, chain]);

  useEffect(() => { load(); }, [load]);

  const redraw = useCallback(() => {
    if (canvasRef.current && candles.length) renderChart(canvasRef.current, candles);
  }, [candles]);

  useEffect(() => { redraw(); }, [redraw]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const obs = new ResizeObserver(redraw);
    obs.observe(el);
    return () => obs.disconnect();
  }, [redraw]);

  const last = candles[candles.length - 1];
  const prev = candles[0];
  const pct = last && prev ? ((last.close - prev.open) / (prev.open || 1)) * 100 : null;

  // Fallback: DexScreener embed when no native data
  if (noData) {
    return (
      <div className="rounded-xl overflow-hidden border border-line bg-panel" style={{ height: 340 }}>
        <iframe
          src={`https://dexscreener.com/${chain}/${mint}?embed=1&theme=dark&trades=0&info=0`}
          className="w-full h-full border-0"
          title={`${symbol || "Token"} chart`}
        />
      </div>
    );
  }

  return (
    <div className="card p-0 overflow-hidden">
      <div className="flex items-center justify-between px-3.5 pt-2.5 pb-2 border-b border-line">
        <div className="flex items-center gap-2">
          <CandlestickChart className="w-3.5 h-3.5 text-accent shrink-0" />
          <span className="text-xs font-semibold text-white/80">{symbol || "Chart"}</span>
          {last && <span className="text-sm font-bold text-white">{fmtUsd(last.close)}</span>}
          {pct != null && (
            <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-lg ${pct >= 0 ? "text-up bg-up/10" : "text-down bg-down/10"}`}>
              {pct >= 0 ? "▲" : "▼"}{Math.abs(pct).toFixed(2)}%
            </span>
          )}
        </div>
        <div className="flex items-center gap-0.5">
          {IVLS.map((iv) => (
            <button
              key={iv.v}
              onClick={() => setIvl(iv.v)}
              className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-all ${
                ivl === iv.v ? "bg-accent/20 text-accent" : "text-muted hover:text-white"
              }`}
            >
              {iv.l}
            </button>
          ))}
        </div>
      </div>

      <div ref={wrapRef} className="relative" style={{ height: 310 }}>
        {loading && (
          <div className="absolute inset-0 grid place-items-center bg-panel/60 z-10">
            <Loader2 className="w-5 h-5 animate-spin text-muted" />
          </div>
        )}
        <canvas ref={canvasRef} className="w-full h-full block" />
      </div>

      {last && (
        <div className="flex items-center gap-3 px-3.5 py-1.5 border-t border-line text-[10px] text-muted/70 flex-wrap">
          <span>O <b className="text-white/60">{fmtUsd(last.open)}</b></span>
          <span>H <b className="text-up">{fmtUsd(last.high)}</b></span>
          <span>L <b className="text-down">{fmtUsd(last.low)}</b></span>
          <span>C <b className="text-white/60">{fmtUsd(last.close)}</b></span>
          <span>Vol <b className="text-white/60">{compact(last.volume)}</b></span>
        </div>
      )}
    </div>
  );
}

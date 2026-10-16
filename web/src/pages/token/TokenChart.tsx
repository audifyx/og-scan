import { useEffect, useMemo, useRef, useState } from "react";
import { CandlestickChart } from "lucide-react";
import { cn } from "@/lib/utils";

interface Candle { t: number; o: number; h: number; l: number; c: number; v: number }

const TFS = [
  { id: "minute", agg: 15, label: "15M" },
  { id: "hour", agg: 1, label: "1H" },
  { id: "hour", agg: 4, label: "4H" },
  { id: "day", agg: 1, label: "1D" },
] as const;

async function fetchOhlc(pool: string, tf: (typeof TFS)[number]): Promise<Candle[]> {
  const url = `https://api.geckoterminal.com/api/v2/networks/solana/pools/${pool}/ohlcv/${tf.id}?aggregate=${tf.agg}&limit=120`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`chart ${r.status}`);
  const j = await r.json();
  const list: number[][] = j?.data?.attributes?.ohlcv_list ?? [];
  return list
    .map(([t, o, h, l, c, v]) => ({ t, o, h, l, c, v }))
    .filter((c) => c.h > 0 && c.l > 0)
    .sort((a, b) => a.t - b.t);
}

function fmtP(p: number): string {
  if (!isFinite(p) || p <= 0) return "—";
  if (p >= 1) return p.toFixed(4);
  if (p >= 0.01) return p.toFixed(6);
  return p.toFixed(10).replace(/0+$/, "");
}

export function TokenChart({ pool, fallbackMint }: { pool: string | null; fallbackMint: string }) {
  const [tfIdx, setTfIdx] = useState(1);
  const [candles, setCandles] = useState<Candle[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cross, setCross] = useState<{ x: number; candle: Candle } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const tf = TFS[tfIdx];

  useEffect(() => {
    let alive = true;
    setCandles(null);
    setError(null);
    if (!pool) { setError("Pair not resolved yet"); return; }
    fetchOhlc(pool, tf)
      .then((c) => { if (alive) { setCandles(c.length ? c : null); if (!c.length) setError("No chart data for this range"); } })
      .catch((e) => { if (alive) setError(e instanceof Error ? e.message : "Chart failed to load"); });
    return () => { alive = false; };
  }, [pool, tfIdx]); // eslint-disable-line react-hooks/exhaustive-deps

  const stats = useMemo(() => {
    if (!candles?.length) return null;
    const last = candles[candles.length - 1];
    const first = candles[0];
    const chg = ((last.c - first.o) / first.o) * 100;
    const hi = Math.max(...candles.map((c) => c.h));
    const lo = Math.min(...candles.map((c) => c.l));
    const vol = candles.reduce((a, c) => a + c.v, 0);
    return { last: last.c, chg, hi, lo, vol };
  }, [candles]);

  // draw
  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap || !candles?.length) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = wrap.clientWidth;
    const H = 340;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    const g = canvas.getContext("2d")!;
    g.scale(dpr, dpr);
    g.clearRect(0, 0, W, H);

    const padR = 64, padT = 12, padB = 34, padL = 8;
    const cw = W - padL - padR;
    const ch = H - padT - padB;
    const volH = ch * 0.18;
    const priceH = ch - volH - 8;

    let hi = -Infinity, lo = Infinity, vMax = 0;
    for (const c of candles) { hi = Math.max(hi, c.h); lo = Math.min(lo, c.l); vMax = Math.max(vMax, c.v); }
    const span = hi - lo || hi || 1;
    hi += span * 0.06; lo -= span * 0.06;
    const py = (p: number) => padT + (1 - (p - lo) / (hi - lo)) * priceH;

    // grid + price labels
    g.font = "10px ui-monospace, monospace";
    g.textBaseline = "middle";
    for (let i = 0; i <= 4; i++) {
      const p = lo + ((hi - lo) * i) / 4;
      const y = py(p);
      g.strokeStyle = "rgba(255,255,255,0.06)";
      g.beginPath(); g.moveTo(padL, y); g.lineTo(W - padR, y); g.stroke();
      g.fillStyle = "rgba(255,255,255,0.4)";
      g.fillText(fmtP(p), W - padR + 8, y);
    }

    const n = candles.length;
    const slot = cw / n;
    const bw = Math.max(2, Math.min(14, slot * 0.62));
    const up = "#34d399", dn = "#fb7185";

    // volume
    for (let i = 0; i < n; i++) {
      const c = candles[i];
      const x = padL + i * slot + slot / 2;
      const vh = vMax > 0 ? (c.v / vMax) * volH : 0;
      g.fillStyle = c.c >= c.o ? "rgba(52,211,153,0.28)" : "rgba(251,113,133,0.28)";
      g.fillRect(x - bw / 2, padT + priceH + 8 + (volH - vh), bw, vh);
    }

    // candles
    for (let i = 0; i < n; i++) {
      const c = candles[i];
      const x = padL + i * slot + slot / 2;
      const col = c.c >= c.o ? up : dn;
      g.strokeStyle = col; g.lineWidth = 1;
      g.beginPath(); g.moveTo(x, py(c.h)); g.lineTo(x, py(c.l)); g.stroke();
      const yO = py(c.o), yC = py(c.c);
      g.fillStyle = col;
      g.fillRect(x - bw / 2, Math.min(yO, yC), bw, Math.max(1.5, Math.abs(yC - yO)));
    }

    // last price line
    const lp = candles[n - 1].c;
    const ly = py(lp);
    const lcol = candles[n - 1].c >= candles[n - 1].o ? up : dn;
    g.setLineDash([4, 4]);
    g.strokeStyle = lcol + "aa";
    g.beginPath(); g.moveTo(padL, ly); g.lineTo(W - padR, ly); g.stroke();
    g.setLineDash([]);
    g.fillStyle = lcol;
    const label = fmtP(lp);
    const tw = g.measureText(label).width + 12;
    g.beginPath();
    g.roundRect(W - padR + 4, ly - 10, Math.max(tw, 56), 20, 6);
    g.fill();
    g.fillStyle = "#04121a";
    g.fillText(label, W - padR + 10, ly);

    // crosshair
    if (cross) {
      const i = Math.min(n - 1, Math.max(0, Math.floor((cross.x - padL) / slot)));
      const c = candles[i];
      const x = padL + i * slot + slot / 2;
      g.strokeStyle = "rgba(255,255,255,0.25)";
      g.setLineDash([3, 3]);
      g.beginPath(); g.moveTo(x, padT); g.lineTo(x, padT + priceH); g.stroke();
      g.setLineDash([]);
      const d = new Date(c.t * 1000);
      const ts = `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
      g.fillStyle = "rgba(0,0,0,0.75)";
      const bx = Math.min(Math.max(x - 60, padL), W - 130);
      g.beginPath(); g.roundRect(bx, H - 24, 124, 20, 6); g.fill();
      g.fillStyle = "#fff";
      const col = c.c >= c.o ? up : dn;
      g.fillStyle = col;
      g.fillText(`${ts}  ${fmtP(c.c)}`, bx + 8, H - 14);
    }

    // time labels
    g.fillStyle = "rgba(255,255,255,0.35)";
    for (let i = 0; i < n; i += Math.ceil(n / 4)) {
      const d = new Date(candles[i].t * 1000);
      const x = padL + i * slot;
      g.fillText(`${d.getMonth() + 1}/${d.getDate()}`, x, H - 8);
    }
  }, [candles, cross]);

  const onMove = (e: React.MouseEvent | React.TouchEvent) => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const r = wrap.getBoundingClientRect();
    const x = ("touches" in e ? e.touches[0].clientX : e.clientX) - r.left;
    setCross({ x, candle: candles![0] });
  };

  const up = (stats?.chg ?? 0) >= 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CandlestickChart className="h-4 w-4 text-teal-300" />
          <h3 className="text-base font-extrabold">ORBITX chart</h3>
        </div>
        <div className="flex gap-1 rounded-full border border-white/10 bg-white/[0.04] p-1">
          {TFS.map((t, i) => (
            <button
              key={t.label}
              onClick={() => { setTfIdx(i); setCross(null); }}
              className={cn(
                "rounded-full px-3 py-1 text-[11px] font-bold transition",
                i === tfIdx ? "bg-teal-400/20 text-teal-200" : "text-white/45 hover:text-white/75",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {stats && (
        <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1 px-1">
          <span className={cn("text-2xl font-extrabold tracking-tight", up ? "text-emerald-300" : "text-rose-300")}>
            ${fmtP(stats.last)}
          </span>
          <span className={cn("text-sm font-bold", up ? "text-emerald-300" : "text-rose-300")}>
            {up ? "+" : ""}{stats.chg.toFixed(2)}%
          </span>
          <span className="text-[11px] text-white/40">H <span className="text-white/70">${fmtP(stats.hi)}</span></span>
          <span className="text-[11px] text-white/40">L <span className="text-white/70">${fmtP(stats.lo)}</span></span>
          <span className="text-[11px] text-white/40">Vol <span className="text-white/70">${stats.vol >= 1000 ? `${(stats.vol / 1000).toFixed(1)}k` : stats.vol.toFixed(0)}</span></span>
        </div>
      )}

      <div
        ref={wrapRef}
        className="relative overflow-hidden rounded-3xl border border-white/10 bg-black/40"
        onMouseMove={onMove}
        onMouseLeave={() => setCross(null)}
        onTouchMove={onMove}
        onTouchEnd={() => setCross(null)}
      >
        {!candles && !error && (
          <div className="flex h-[340px] items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-teal-400/30 border-t-teal-300" />
          </div>
        )}
        {error && (
          <div className="flex h-[340px] flex-col items-center justify-center gap-2 p-6 text-center">
            <p className="text-sm font-semibold text-white/60">Chart unavailable</p>
            <p className="text-xs text-white/35">{error}</p>
            <a
              href={`https://dexscreener.com/solana/${pool ?? fallbackMint}`}
              target="_blank" rel="noreferrer"
              className="mt-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-bold text-teal-200"
            >
              Open on DexScreener
            </a>
          </div>
        )}
        <canvas ref={canvasRef} className={cn(!candles && "hidden")} />
      </div>
      <p className="text-center text-xs text-white/35">Live candles via GeckoTerminal · tap the chart to inspect</p>
    </div>
  );
}

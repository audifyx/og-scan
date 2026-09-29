/**
 * Samples `useLivePrices` into an OHLC candle series for the minigames.
 * Real data only — no synthetic price generation. When the feed has no data
 * yet (or drops), the hook reports `live: false` and games must wait, never
 * fabricate candles.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useLivePrices } from "@/hooks/useLivePrices";

export interface Candle {
  t: number; // candle open time (epoch ms)
  open: number;
  high: number;
  low: number;
  close: number;
}

export function usePriceCandles(mint: string, candleMs: number, maxCandles = 40) {
  const { prices, connected } = useLivePrices([mint], 10_000);
  const [candles, setCandles] = useState<Candle[]>([]);
  const bucketRef = useRef<{ t: number; open: number; high: number; low: number; close: number } | null>(
    null
  );

  const price = prices[mint]?.price ?? 0;

  useEffect(() => {
    if (!price || price <= 0) return;
    const bucketT = Math.floor(Date.now() / candleMs) * candleMs;
    const b = bucketRef.current;
    if (!b || b.t !== bucketT) {
      // close the previous bucket into history
      if (b) {
        setCandles((prev) => [...prev.slice(-(maxCandles - 1)), { t: b.t, open: b.open, high: b.high, low: b.low, close: b.close }]);
      }
      bucketRef.current = { t: bucketT, open: price, high: price, low: price, close: price };
    } else {
      b.high = Math.max(b.high, price);
      b.low = Math.min(b.low, price);
      b.close = price;
    }
  }, [price, candleMs, maxCandles]);

  const liveCandle = bucketRef.current
    ? { t: bucketRef.current.t, open: bucketRef.current.open, high: bucketRef.current.high, low: bucketRef.current.low, close: bucketRef.current.close }
    : null;

  return useMemo(
    () => ({
      candles,
      liveCandle,
      price,
      connected,
      live: connected && price > 0,
      lastUpdated: prices[mint]?.lastUpdated ?? 0,
    }),
    [candles, liveCandle, price, connected, prices, mint]
  );
}

/** Lightweight SVG sparkline/candlestick renderer (no chart lib needed). */
export function CandlestickChart({
  candles,
  width = 320,
  height = 140,
  highlight,
}: {
  candles: Candle[];
  width?: number;
  height?: number;
  /** Index of a candle to outline (e.g. the one being bet on). */
  highlight?: number;
}) {
  if (candles.length === 0) {
    return (
      <div className="ox-eco-chart-empty" style={{ width, height }}>
        waiting for live prices…
      </div>
    );
  }
  const all = candles.flatMap((c) => [c.high, c.low]);
  const min = Math.min(...all);
  const max = Math.max(...all);
  const span = max - min || 1;
  const pad = 8;
  const y = (v: number) => pad + (1 - (v - min) / span) * (height - pad * 2);
  const bw = width / candles.length;
  return (
    <svg width={width} height={height} className="ox-eco-chart" viewBox={`0 0 ${width} ${height}`}>
      {candles.map((c, i) => {
        const up = c.close >= c.open;
        const x = i * bw + bw * 0.22;
        const w = Math.max(1.5, bw * 0.56);
        const col = up ? "#22e58a" : "#ff4d6d";
        return (
          <g key={c.t} opacity={highlight === i ? 1 : 0.9}>
            <line x1={x + w / 2} x2={x + w / 2} y1={y(c.high)} y2={y(c.low)} stroke={col} strokeWidth={1.2} />
            <rect
              x={x}
              y={y(Math.max(c.open, c.close))}
              width={w}
              height={Math.max(1.5, Math.abs(y(c.open) - y(c.close)))}
              fill={col}
            />
            {highlight === i && (
              <rect x={i * bw + 1} y={1} width={bw - 2} height={height - 2} fill="none" stroke="#fff" strokeWidth={1} strokeDasharray="3 2" rx={2} />
            )}
          </g>
        );
      })}
    </svg>
  );
}

/** Format a USD price compactly. */
export function formatUsd(p: number): string {
  if (!p || p <= 0) return "—";
  if (p < 0.000001) return `$${p.toExponential(2)}`;
  if (p < 0.01) return `$${p.toFixed(6)}`;
  if (p < 1) return `$${p.toFixed(4)}`;
  if (p < 1000) return `$${p.toFixed(2)}`;
  return `$${p.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

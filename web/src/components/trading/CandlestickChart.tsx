/**
 * CandlestickChart — Native TradingView-quality candlestick chart.
 * Uses lightweight-charts for high-performance canvas rendering.
 * Styled for OG Scan dark theme.
 */
import { useEffect, useRef, memo } from "react";
import { createChart, ColorType, CrosshairMode } from "lightweight-charts";
import type { IChartApi, ISeriesApi, Time } from "lightweight-charts";

export interface CandleDataPoint {
  time: number; // Unix seconds (UTC)
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

interface Props {
  data: CandleDataPoint[];
  height?: number;
  showVolume?: boolean;
}

const CandlestickChartInner = ({ data, height = 400, showVolume = true }: Props) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volRef = useRef<ISeriesApi<"Histogram"> | null>(null);

  /* ── Create chart instance ────────────────────────────────── */
  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;

    const chart = createChart(el, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "rgba(255,255,255,0.35)",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.04)" },
        horzLines: { color: "rgba(255,255,255,0.04)" },
      },
      width: el.clientWidth,
      height,
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: "rgba(255,255,255,0.12)", labelBackgroundColor: "#1a1a2e" },
        horzLine: { color: "rgba(255,255,255,0.12)", labelBackgroundColor: "#1a1a2e" },
      },
      timeScale: {
        borderColor: "rgba(255,255,255,0.07)",
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 4,
      },
      rightPriceScale: {
        borderColor: "rgba(255,255,255,0.07)",
        scaleMargins: { top: 0.08, bottom: showVolume ? 0.22 : 0.04 },
      },
    });

    const candles = chart.addCandlestickSeries({
      upColor: "#4ade80",
      downColor: "#ef4444",
      borderDownColor: "#ef4444",
      borderUpColor: "#4ade80",
      wickDownColor: "#ef4444",
      wickUpColor: "#4ade80",
    });

    let vol: ISeriesApi<"Histogram"> | null = null;
    if (showVolume) {
      vol = chart.addHistogramSeries({
        color: "#4ade80",
        priceFormat: { type: "volume" },
        priceScaleId: "",
      });
      vol.priceScale().applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
    }

    chartRef.current = chart;
    candleRef.current = candles;
    volRef.current = vol;

    const ro = new ResizeObserver(() => {
      chart.applyOptions({ width: el.clientWidth });
    });
    ro.observe(el);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
    };
  }, [height, showVolume]);

  /* ── Update data ──────────────────────────────────────────── */
  useEffect(() => {
    if (!candleRef.current || !data.length) return;
    const sorted = [...data].sort((a, b) => a.time - b.time);

    candleRef.current.setData(
      sorted.map((d) => ({
        time: d.time as Time,
        open: d.open,
        high: d.high,
        low: d.low,
        close: d.close,
      }))
    );

    if (volRef.current) {
      volRef.current.setData(
        sorted.map((d) => ({
          time: d.time as Time,
          value: d.volume ?? 0,
          color: d.close >= d.open ? "rgba(74,222,128,0.25)" : "rgba(239,68,68,0.25)",
        }))
      );
    }

    chartRef.current?.timeScale().fitContent();
  }, [data]);

  return <div ref={containerRef} className="w-full" />;
};

export const CandlestickChart = memo(CandlestickChartInner);

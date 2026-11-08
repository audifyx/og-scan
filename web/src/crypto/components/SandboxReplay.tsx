/**
 * SandboxReplay — Sandbox launch replay (Team F, OG Scanner v2).
 *
 * Imported by Team B's TokenScanner page. Self-contained: takes a mint plus
 * optional scanner intel and replays the launch minute by minute.
 *
 * Data honesty: the chart draws ONLY real fetched candles. Minutes with no
 * candle are gaps — the line breaks there and the gap is listed, never
 * interpolated. Market cap is an estimate (price × implied supply from the
 * current DexScreener snapshot) and is labelled "est." everywhere it appears.
 *
 * Design (standing user rule): black panel, white text, gold/blue accents.
 * Never light-on-light or dark-on-dark. No rainbow colors. SVG icons only.
 */
import { useMemo, useState } from "react";
import {
  useLaunchReplay,
  type ReplayMarker,
  type ReplayMinute,
} from "../hooks/useLaunchReplay";

export type SandboxReplayIntel = {
  /** Dev/creator wallet — used only to flag dev sells. */
  devWallet?: string | null;
  /** Whether the dev has exited (scanner intel) — shown as context, not a marker. */
  devSold?: boolean | null;
  /** LP lock % (scanner intel) — shown as context. */
  lpLockedPct?: number | null;
};

export type SandboxReplayProps = {
  /** Token mint address (base58, 32–44 chars). */
  mint: string;
  /** Dev/creator wallet. Takes precedence over `intel.devWallet`. */
  devWallet?: string | null;
  /** Pin the replay to one pair address; otherwise the highest-liquidity Solana pair is used. */
  pairAddress?: string | null;
  /** Token symbol for the header (optional). */
  symbol?: string | null;
  /** Optional scanner intel (dev wallet / dev-sold / LP lock). */
  intel?: SandboxReplayIntel | null;
  className?: string;
};

// ── Formatting ───────────────────────────────────────────────────────────────

function fmtUsd(v: number | null | undefined, digits = 2): string {
  if (v == null || !Number.isFinite(v)) return "—";
  if (v === 0) return "$0";
  if (v < 0.0001) return `$${v.toExponential(1)}`;
  if (v < 1) return `$${v.toFixed(4)}`;
  if (v < 1000) return `$${v.toFixed(digits)}`;
  if (v < 1_000_000) return `$${(v / 1000).toFixed(1)}K`;
  if (v < 1_000_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  return `$${(v / 1_000_000_000).toFixed(2)}B`;
}

function fmtElapsed(minutes: number): string {
  if (minutes < 60) return `T+${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h < 48) return `T+${h}h ${m}m`;
  const d = Math.floor(h / 24);
  return `T+${d}d ${h % 24}h`;
}

function fmtClock(ms: number): string {
  const d = new Date(ms);
  return `${d.toISOString().slice(0, 10)} ${d.toISOString().slice(11, 16)} UTC`;
}

function shortAddr(a: string): string {
  return a.length > 12 ? `${a.slice(0, 4)}…${a.slice(-4)}` : a;
}

// ── Chart geometry ───────────────────────────────────────────────────────────

const CHART_W = 600;
const CHART_H = 200;
const PAD_L = 8;
const PAD_R = 8;
const PAD_T = 14;
const PAD_B = 22;

function chartPoints(
  minutes: ReplayMinute[],
  upTo: number,
  value: (m: ReplayMinute) => number | null,
): Array<Array<{ x: number; y: number }>> {
  const total = minutes.length;
  if (total === 0) return [];
  const vals = minutes
    .map((m) => value(m))
    .filter((v): v is number => v != null && Number.isFinite(v) && v > 0);
  if (vals.length === 0) return [];
  let min = Math.min(...vals);
  let max = Math.max(...vals);
  if (max <= min) {
    max = min * 1.1 + 1e-12;
    min = min * 0.9;
  }
  const pad = (max - min) * 0.08;
  min -= pad;
  max += pad;
  const xFor = (i: number) =>
    PAD_L + (total <= 1 ? 0 : (i / (total - 1)) * (CHART_W - PAD_L - PAD_R));
  const yFor = (v: number) =>
    PAD_T + (1 - (v - min) / (max - min)) * (CHART_H - PAD_T - PAD_B);
  // Split into contiguous segments wherever a minute has no value (gap).
  const segments: Array<Array<{ x: number; y: number }>> = [];
  let seg: Array<{ x: number; y: number }> = [];
  minutes.forEach((m, i) => {
    const v = value(m);
    if (v == null || !Number.isFinite(v) || v <= 0 || i > upTo) {
      if (seg.length > 1) segments.push(seg);
      else if (seg.length === 1) segments.push(seg);
      seg = [];
      return;
    }
    seg.push({ x: xFor(i), y: yFor(v) });
  });
  if (seg.length > 0) segments.push(seg);
  return segments;
}

function markerStyle(kind: ReplayMarker["kind"]): { fill: string; stroke: string; r: number } {
  switch (kind) {
    case "first-buy":
      return { fill: "#3b82f6", stroke: "#ffffff", r: 5 };
    case "big-buy":
      return { fill: "#f0b429", stroke: "#0a0a0a", r: 4 };
    case "dev-sell":
      return { fill: "#ffffff", stroke: "#f0b429", r: 5 };
    case "pair-created":
      return { fill: "#0a0a0a", stroke: "#ffffff", r: 4 };
    default:
      return { fill: "#ffffff", stroke: "#ffffff", r: 4 };
  }
}

// ── Styles (inline — this component owns no stylesheet) ──────────────────────

const panel: React.CSSProperties = {
  background: "#070b10",
  color: "#ffffff",
  border: "1px solid #1e2a35",
  borderRadius: 12,
  padding: 14,
  width: "100%",
  boxSizing: "border-box",
  fontFamily: "ui-sans-serif, system-ui, sans-serif",
};

const muted: React.CSSProperties = { color: "#aebfce", fontSize: 12, lineHeight: 1.5 };
const chip: React.CSSProperties = {
  display: "inline-block",
  border: "1px solid #2a3a49",
  borderRadius: 999,
  padding: "2px 8px",
  fontSize: 11,
  color: "#ffffff",
  background: "#0d141c",
  whiteSpace: "nowrap",
};
const goldChip: React.CSSProperties = { ...chip, borderColor: "#f0b429", color: "#f0b429" };
const controlBtn: React.CSSProperties = {
  background: "#0d141c",
  color: "#ffffff",
  border: "1px solid #2a3a49",
  borderRadius: 8,
  padding: "6px 10px",
  fontSize: 12,
  cursor: "pointer",
  whiteSpace: "nowrap",
};
const activeBtn: React.CSSProperties = { ...controlBtn, borderColor: "#f0b429", color: "#f0b429" };

// ── Component ────────────────────────────────────────────────────────────────

export function SandboxReplay({
  mint,
  devWallet,
  pairAddress,
  symbol,
  intel,
  className,
}: SandboxReplayProps) {
  const effectiveDev = devWallet ?? intel?.devWallet ?? null;
  const [metric, setMetric] = useState<"price" | "mcap">("price");
  const replay = useLaunchReplay({
    mint,
    pairAddress,
    devWallet: effectiveDev,
  });

  const { minutes, totalMinutes, cursor, playing } = replay;

  const valueFn = useMemo(() => {
    if (metric === "mcap") {
      return (m: ReplayMinute) =>
        m.candle ? replay.mcapAt(m.candle.close) : null;
    }
    return (m: ReplayMinute) => (m.candle ? m.candle.close : null);
  }, [metric, replay]);

  // Full series (dim, context) + up-to-cursor series (bright, the replay).
  const fullSegments = useMemo(
    () => chartPoints(minutes, totalMinutes - 1, valueFn),
    [minutes, totalMinutes, valueFn],
  );
  const playedSegments = useMemo(
    () => chartPoints(minutes, cursor, valueFn),
    [minutes, cursor, valueFn],
  );

  const xFor = (i: number) =>
    PAD_L + (totalMinutes <= 1 ? 0 : (i / (totalMinutes - 1)) * (CHART_W - PAD_L - PAD_R));

  const markerXY = (m: ReplayMarker) => {
    const idx = Math.max(
      0,
      Math.min(totalMinutes - 1, Math.round((m.timeMs - (replay.startMs ?? m.timeMs)) / 60_000)),
    );
    const minute = minutes[idx];
    const v = minute?.candle ? valueFn(minute) : null;
    if (v == null) return null;
    const vals = minutes
      .map((mm) => valueFn(mm))
      .filter((vv): vv is number => vv != null && Number.isFinite(vv) && vv > 0);
    if (!vals.length) return null;
    let min = Math.min(...vals);
    let max = Math.max(...vals);
    if (max <= min) {
      max = min * 1.1 + 1e-12;
      min = min * 0.9;
    }
    const pad = (max - min) * 0.08;
    min -= pad;
    max += pad;
    return {
      x: xFor(idx),
      y: PAD_T + (1 - (v - min) / (max - min)) * (CHART_H - PAD_T - PAD_B),
    };
  };

  // Cumulative tape up to the cursor.
  const tape = useMemo(() => {
    let buys = 0;
    let sells = 0;
    let buyVol = 0;
    let sellVol = 0;
    for (let i = 0; i <= cursor && i < minutes.length; i++) {
      buys += minutes[i].buys;
      sells += minutes[i].sells;
      buyVol += minutes[i].buyVolumeUsd;
      sellVol += minutes[i].sellVolumeUsd;
    }
    return { buys, sells, buyVol, sellVol };
  }, [minutes, cursor]);

  const currentPrice = replay.current?.candle?.close ?? null;
  const currentMcap = currentPrice != null ? replay.mcapAt(currentPrice) : null;
  const gapMinutes = replay.gaps.reduce((s, g) => s + g.minutes, 0);

  const segToPath = (seg: Array<{ x: number; y: number }>) =>
    seg.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");

  return (
    <section aria-label="Sandbox launch replay" style={panel} className={className}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "baseline" }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#ffffff" }}>
          Sandbox launch replay{symbol ? ` — ${symbol}` : ""}
        </h3>
        <span style={muted}>{mint ? shortAddr(mint) : ""}</span>
      </div>
      <p style={{ ...muted, margin: "6px 0 0" }}>
        Minute-by-minute replay from pair creation. Gaps are minutes with no trade data — shown as breaks, never filled in.
      </p>

      {/* Status */}
      {replay.status === "loading" && (
        <p style={{ ...muted, margin: "14px 0 0" }}>Loading launch history…</p>
      )}
      {(replay.status === "error" || replay.status === "no-data") && (
        <div style={{ marginTop: 14, border: "1px solid #2a3a49", borderRadius: 8, padding: 10 }}>
          <p style={{ margin: 0, fontSize: 13, color: "#ffffff" }}>
            {replay.status === "no-data" ? "No replay data available" : "Replay failed to load"}
          </p>
          <p style={{ ...muted, margin: "4px 0 0" }}>{replay.error ?? "No candle or trade history was returned for this pair."}</p>
          <button type="button" style={{ ...controlBtn, marginTop: 8 }} onClick={replay.reload}>
            Retry
          </button>
        </div>
      )}

      {replay.status === "ready" && (
        <>
          {/* Pair + coverage line */}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 12 }}>
            <span style={chip}>{replay.pair?.dexId ?? "DEX"} · {replay.pair ? shortAddr(replay.pair.pairAddress) : ""}</span>
            {replay.startMs != null && <span style={chip}>Starts {fmtClock(replay.startMs)}</span>}
            {replay.coversLaunch ? (
              <span style={goldChip}>Covers launch</span>
            ) : (
              <span style={chip}>History starts after launch — earlier minutes unavailable</span>
            )}
            {replay.gaps.length > 0 && (
              <span style={chip}>{replay.gaps.length} gap{replay.gaps.length === 1 ? "" : "s"} · {gapMinutes} min with no trade data</span>
            )}
          </div>

          {/* Metric toggle */}
          <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
            <button type="button" style={metric === "price" ? activeBtn : controlBtn} onClick={() => setMetric("price")}>
              Price (USD)
            </button>
            <button
              type="button"
              style={metric === "mcap" ? activeBtn : controlBtn}
              onClick={() => setMetric("mcap")}
              disabled={replay.impliedSupply == null}
              title={replay.impliedSupply == null ? "Market cap unavailable — no current price/mcap snapshot" : "Estimated from current implied supply"}
            >
              Market cap (est.)
            </button>
          </div>

          {/* Chart */}
          <svg
            viewBox={`0 0 ${CHART_W} ${CHART_H}`}
            width="100%"
            role="img"
            aria-label={`${metric === "price" ? "Price" : "Estimated market cap"} replay chart`}
            style={{ display: "block", marginTop: 8, background: "#0a0f15", borderRadius: 8 }}
          >
            {fullSegments.map((seg, i) => (
              <path key={`full-${i}`} d={segToPath(seg)} fill="none" stroke="#f0b429" strokeOpacity={0.25} strokeWidth={1.5} />
            ))}
            {playedSegments.map((seg, i) => (
              <path key={`played-${i}`} d={segToPath(seg)} fill="none" stroke="#f0b429" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            ))}
            {/* Cursor line */}
            {totalMinutes > 0 && (
              <line
                x1={xFor(cursor)}
                x2={xFor(cursor)}
                y1={PAD_T - 6}
                y2={CHART_H - PAD_B + 6}
                stroke="#ffffff"
                strokeWidth={1}
                strokeDasharray="3 3"
              />
            )}
            {/* Markers */}
            {replay.markers.map((m, i) => {
              const xy = markerXY(m);
              if (!xy) return null;
              const s = markerStyle(m.kind);
              const seen = m.timeMs <= (replay.current?.timeMs ?? 0) + 60_000;
              return (
                <circle
                  key={`${m.kind}-${i}`}
                  cx={xy.x}
                  cy={xy.y}
                  r={s.r}
                  fill={seen ? s.fill : "#0a0a0a"}
                  stroke={s.stroke}
                  strokeWidth={1.5}
                  opacity={seen ? 1 : 0.55}
                >
                  <title>{`${m.label} — ${fmtClock(m.timeMs)} — ${m.detail}`}</title>
                </circle>
              );
            })}
            <text x={PAD_L} y={CHART_H - 6} fill="#aebfce" fontSize={10}>
              {replay.startMs != null ? fmtClock(replay.startMs) : ""}
            </text>
            <text x={CHART_W - PAD_R} y={CHART_H - 6} fill="#aebfce" fontSize={10} textAnchor="end">
              {replay.endMs != null ? fmtClock(replay.endMs) : ""}
            </text>
          </svg>

          {/* Readout */}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 10, fontSize: 13 }}>
            <span style={{ color: "#ffffff" }}><strong>{fmtElapsed(cursor)}</strong></span>
            <span style={{ color: "#ffffff" }}>Price {fmtUsd(currentPrice)}</span>
            <span style={{ color: "#ffffff" }}>Mcap {currentMcap != null ? `${fmtUsd(currentMcap)} est.` : "—"}</span>
            <span style={{ color: "#aebfce" }}>
              {tape.buys} buys ({fmtUsd(tape.buyVol, 0)}) · {tape.sells} sells ({fmtUsd(tape.sellVol, 0)}) so far
            </span>
          </div>

          {/* Transport controls */}
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 12 }}>
            <button
              type="button"
              aria-label={playing ? "Pause replay" : "Play replay"}
              style={{ ...controlBtn, display: "inline-flex", alignItems: "center", gap: 6 }}
              onClick={() => (playing ? replay.setPlaying(false) : cursor >= totalMinutes - 1 ? replay.restart() : replay.setPlaying(true))}
              disabled={totalMinutes === 0}
            >
              {playing ? (
                <svg width="10" height="12" viewBox="0 0 10 12" aria-hidden="true"><rect x="0" y="0" width="3.5" height="12" fill="#f0b429" /><rect x="6.5" y="0" width="3.5" height="12" fill="#f0b429" /></svg>
              ) : (
                <svg width="10" height="12" viewBox="0 0 10 12" aria-hidden="true"><path d="M0 0 L10 6 L0 12 Z" fill="#f0b429" /></svg>
              )}
              {playing ? "Pause" : cursor >= totalMinutes - 1 ? "Replay" : "Play"}
            </button>
            <button type="button" style={controlBtn} onClick={replay.restart} disabled={totalMinutes === 0}>
              Restart
            </button>
            <label style={{ ...muted, display: "inline-flex", alignItems: "center", gap: 6 }}>
              Speed
              <span style={{ display: "inline-flex", gap: 4 }}>
                {replay.speedOptions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    style={replay.speed === s ? activeBtn : controlBtn}
                    onClick={() => replay.setSpeed(s)}
                  >
                    {s}x
                  </button>
                ))}
              </span>
            </label>
          </div>

          {/* Scrubber */}
          <label style={{ display: "block", marginTop: 12 }}>
            <span style={{ ...muted, display: "block", marginBottom: 4 }}>
              Scrub timeline — {fmtElapsed(cursor)} of {fmtElapsed(Math.max(0, totalMinutes - 1))}
            </span>
            <input
              type="range"
              min={0}
              max={Math.max(0, totalMinutes - 1)}
              value={cursor}
              onChange={(e) => {
                replay.setPlaying(false);
                replay.setCursor(Number(e.target.value));
              }}
              aria-label="Scrub replay timeline"
              style={{ width: "100%", accentColor: "#f0b429" }}
            />
          </label>

          {/* Markers so far */}
          <div style={{ marginTop: 12 }}>
            <h4 style={{ margin: "0 0 6px", fontSize: 12, color: "#aebfce", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Events up to {fmtElapsed(cursor)}
            </h4>
            {replay.markersUpToCursor.length === 0 ? (
              <p style={{ ...muted, margin: 0 }}>No flagged events yet in this replay.</p>
            ) : (
              <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 6 }}>
                {replay.markersUpToCursor.map((m, i) => (
                  <li key={`${m.kind}-${i}`} style={{ display: "flex", gap: 8, alignItems: "baseline", fontSize: 13 }}>
                    <span
                      aria-hidden="true"
                      style={{
                        width: 9,
                        height: 9,
                        borderRadius: "50%",
                        flexShrink: 0,
                        background: markerStyle(m.kind).fill,
                        border: `1.5px solid ${markerStyle(m.kind).stroke}`,
                        display: "inline-block",
                        transform: "translateY(-1px)",
                      }}
                    />
                    <span style={{ color: "#ffffff" }}>
                      <strong>{m.label}</strong> · {fmtElapsed(Math.max(0, Math.round((m.timeMs - (replay.startMs ?? m.timeMs)) / 60_000)))}
                      <span style={{ color: "#aebfce" }}> — {m.detail}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Gaps */}
          {replay.gaps.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <h4 style={{ margin: "0 0 6px", fontSize: 12, color: "#aebfce", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Data gaps — no trade data for these windows
              </h4>
              <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 4 }}>
                {replay.gaps.slice(0, 8).map((g, i) => (
                  <li key={i} style={{ ...muted }}>
                    {fmtClock(g.startMs)} → {fmtClock(g.endMs)} ({g.minutes} min)
                  </li>
                ))}
                {replay.gaps.length > 8 && (
                  <li style={muted}>+ {replay.gaps.length - 8} more gap{replay.gaps.length - 8 === 1 ? "" : "s"}</li>
                )}
              </ul>
            </div>
          )}

          {/* Context + sources */}
          <div style={{ ...muted, marginTop: 14, borderTop: "1px solid #1e2a35", paddingTop: 10 }}>
            {effectiveDev && (
              <p style={{ margin: "0 0 4px" }}>
                Dev wallet {shortAddr(effectiveDev)}
                {intel?.devSold === true ? " — scanner intel: dev has exited." : intel?.devSold === false ? " — scanner intel: dev still holding." : ""}
                {replay.markers.some((m) => m.kind === "dev-sell")
                  ? " Dev sells in the fetched trades are flagged above."
                  : " No dev sells in the fetched trades."}
              </p>
            )}
            {!effectiveDev && (
              <p style={{ margin: "0 0 4px" }}>No dev wallet supplied — dev sells cannot be flagged.</p>
            )}
            {intel?.lpLockedPct != null && (
              <p style={{ margin: "0 0 4px" }}>LP lock (scanner intel): {Math.round(intel.lpLockedPct)}%. LP lock/burn events are not in the candle/trade feeds, so none are plotted.</p>
            )}
            {!replay.tradesCoverLaunch && replay.markers.some((m) => m.kind === "first-buy") && (
              <p style={{ margin: "0 0 4px" }}>Trade history does not reach launch, so the first-buy marker is the first buy in available data, not necessarily the first buy ever.</p>
            )}
            <p style={{ margin: "4px 0 0" }}>
              Sources: DexScreener public API (pair, launch time, current price/mcap) + GeckoTerminal public API (minute candles, trades). No key. No interpolated points.
            </p>
          </div>
        </>
      )}
    </section>
  );
}

export default SandboxReplay;

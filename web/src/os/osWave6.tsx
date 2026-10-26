/**
 * OrbitX OS wave 6 — home look & feel helpers: live price hooks, the live
 * chart wallpaper, the window options menu (accent / opacity / tab groups),
 * the desktop right-click menu, theme preview mocks, and tiny UI audio.
 * Pure UI + public DexScreener data; no new backend.
 */
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { OS_ACCENTS } from "./osStore";

export const ORBITX_MINT = "13H4WJvGEg4xrrBwWn2vsQgz7xhmhxgNdw19i1QsxPX9";

export interface TokenQuote {
  price: number;
  change24h: number;
  symbol: string;
}

/** One public DexScreener tokens call, best-liquidity pair wins. */
export async function fetchTokenQuote(mint: string): Promise<TokenQuote | null> {
  try {
    const res = await fetch(`https://api.dexscreener.com/tokens/v1/solana/${mint}`);
    if (!res.ok) return null;
    const pairs = (await res.json()) as any[];
    if (!Array.isArray(pairs) || !pairs.length) return null;
    const best = pairs.reduce((a, b) =>
      (b.liquidity?.usd ?? 0) > (a.liquidity?.usd ?? 0) ? b : a,
    );
    const price = Number(best.priceUsd);
    if (!Number.isFinite(price)) return null;
    return {
      price,
      change24h: Number(best.priceChange?.h24 ?? 0) || 0,
      symbol: best.baseToken?.symbol ?? "",
    };
  } catch {
    return null;
  }
}

/** Live quote for a mint, refreshed every 30s. Null = unreachable. */
export function useTokenPrice(mint: string | undefined): TokenQuote | null {
  const [quote, setQuote] = useState<TokenQuote | null>(null);
  useEffect(() => {
    if (!mint) {
      setQuote(null);
      return;
    }
    let live = true;
    const tick = async () => {
      const q = await fetchTokenQuote(mint);
      if (live && q) setQuote(q);
    };
    void tick();
    const id = setInterval(() => void tick(), 30000);
    return () => {
      live = false;
      clearInterval(id);
    };
  }, [mint]);
  return quote;
}

export interface PriceSample {
  t: number;
  price: number;
}

function samplesKey(mint: string) {
  return `orbitxos:price-samples:${mint}`;
}

function loadSamples(mint: string): PriceSample[] {
  try {
    const raw = localStorage.getItem(samplesKey(mint));
    const arr = raw ? (JSON.parse(raw) as PriceSample[]) : [];
    return Array.isArray(arr) ? arr.filter((s) => Number.isFinite(s.price)) : [];
  } catch {
    return [];
  }
}

/**
 * Price history sampled from live quotes (idea bank #13/#1004 need a chart
 * but no free no-key feed carries history, so the OS samples it itself:
 * one point per quote tick, capped at 60, persisted per mint).
 */
export function useSampledHistory(mint: string | undefined): PriceSample[] {
  const [samples, setSamples] = useState<PriceSample[]>(() =>
    mint ? loadSamples(mint) : [],
  );
  const quote = useTokenPrice(mint);
  const lastT = useRef(0);
  useEffect(() => {
    if (!mint || !quote) return;
    const now = Date.now();
    if (now - lastT.current < 25000) return;
    lastT.current = now;
    setSamples((prev) => {
      const next = [...prev, { t: now, price: quote.price }].slice(-60);
      try {
        localStorage.setItem(samplesKey(mint), JSON.stringify(next));
      } catch {
        /* storage unavailable */
      }
      return next;
    });
  }, [mint, quote]);
  return samples;
}

/** Minimal SVG sparkline from samples. */
export function Sparkline({
  samples,
  width = 200,
  height = 60,
}: {
  samples: PriceSample[];
  width?: number;
  height?: number;
}) {
  if (samples.length < 2) return null;
  const prices = samples.map((s) => s.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const span = max - min || 1;
  const pts = samples
    .map((s, i) => {
      const x = (i / (samples.length - 1)) * width;
      const y = height - 4 - ((s.price - min) / span) * (height - 8);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const up = prices[prices.length - 1] >= prices[0];
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden>
      <polyline
        points={pts}
        fill="none"
        stroke={up ? "#34d399" : "#f87171"}
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Live chart wallpaper (idea bank #13): ORBITX sparkline + price. */
export function LiveWallpaper() {
  const samples = useSampledHistory(ORBITX_MINT);
  const quote = useTokenPrice(ORBITX_MINT);
  return (
    <div className="oxos-livewall">
      <div className="oxos-livewall__chart">
        {samples.length >= 2 ? (
          <Sparkline samples={samples} width={900} height={320} />
        ) : (
          <p className="oxos-hint">Sampling the live $ORBITX chart — it draws as prices arrive…</p>
        )}
      </div>
      <div className="oxos-livewall__meta">
        <span className="oxos-livewall__live">● LIVE</span>
        <span className="oxos-livewall__price">
          $ORBITX {quote ? `$${quote.price < 0.01 ? quote.price.toFixed(6) : quote.price.toFixed(4)}` : "—"}
        </span>
        {quote && (
          <span className={quote.change24h >= 0 ? "up" : "down"}>
            {quote.change24h >= 0 ? "+" : ""}
            {quote.change24h.toFixed(1)}%
          </span>
        )}
      </div>
    </div>
  );
}

/** Season → wallpaper mapping (idea bank #946). */
export function wallpaperForSeason(d: Date): "midnight" | "ocean" | "gold" | "space" {
  const m = d.getMonth();
  if (m === 11 || m <= 1) return "midnight";
  if (m <= 4) return "ocean";
  if (m <= 7) return "gold";
  return "space";
}

/* ------------------------------ tiny audio ------------------------------ */

let audioCtx: AudioContext | null = null;

function ctx(): AudioContext | null {
  try {
    if (!audioCtx) {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      if (!AC) return null;
      audioCtx = new AC();
    }
    if (audioCtx.state === "suspended") void audioCtx.resume();
    return audioCtx;
  } catch {
    return null;
  }
}

function tone(freq: number, at: number, dur: number, vol: number) {
  const c = ctx();
  if (!c) return;
  try {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = "sine";
    o.frequency.value = freq;
    g.gain.setValueAtTime(0, c.currentTime + at);
    g.gain.linearRampToValueAtTime(vol, c.currentTime + at + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + at + dur);
    o.connect(g);
    g.connect(c.destination);
    o.start(c.currentTime + at);
    o.stop(c.currentTime + at + dur + 0.05);
  } catch {
    /* audio unavailable */
  }
}

/** Two-note boot chime (idea bank #84). */
export function playBootChime() {
  tone(523.25, 0, 0.35, 0.08);
  tone(783.99, 0.18, 0.5, 0.08);
}

/** One soft UI click (idea bank #939, v1: a single blip). */
export function playUiBlip() {
  tone(880, 0, 0.06, 0.03);
}

/* --------------------------- window options menu --------------------------- */

export interface WinMenuTarget {
  id: string;
  title: string;
  accent?: string | null;
  opacity?: number;
  tabGroupId?: string | null;
}

export function WindowOptionsMenu({
  w,
  others,
  onAccent,
  onOpacity,
  onGroup,
  onUngroup,
  onClose,
}: {
  w: WinMenuTarget;
  others: { id: string; title: string; tabGroupId?: string | null }[];
  onAccent: (accent: string | null) => void;
  onOpacity: (opacity: number) => void;
  onGroup: (otherId: string) => void;
  onUngroup: () => void;
  onClose: () => void;
}) {
  return (
    <div className="oxos-winmenu">
      <div className="oxos-winmenu__label">Accent</div>
      <div className="oxos-accentrow">
        <button
          type="button"
          className={`oxos-accent${!w.accent ? " is-on" : ""}`}
          style={{ background: "rgba(255,255,255,0.15)" }}
          title="OS default"
          aria-label="OS default accent"
          onClick={() => {
            onAccent(null);
            onClose();
          }}
        />
        {OS_ACCENTS.map((a) => (
          <button
            key={a.id}
            type="button"
            className={`oxos-accent${w.accent === a.hex ? " is-on" : ""}`}
            style={{ background: a.hex }}
            title={a.label}
            aria-label={a.label}
            onClick={() => {
              onAccent(a.hex);
              onClose();
            }}
          />
        ))}
      </div>
      <div className="oxos-winmenu__label">Transparency: {Math.round((w.opacity ?? 1) * 100)}%</div>
      <input
        type="range"
        min={30}
        max={100}
        step={5}
        value={Math.round((w.opacity ?? 1) * 100)}
        onChange={(e) => onOpacity(Number(e.target.value) / 100)}
      />
      <div className="oxos-winmenu__label">Tabs</div>
      {w.tabGroupId ? (
        <button type="button" className="oxos-btn oxos-btn--ghost" onClick={() => { onUngroup(); onClose(); }}>
          Ungroup this tab
        </button>
      ) : (
        others
          .filter((o) => o.id !== w.id)
          .slice(0, 6)
          .map((o) => (
            <button
              key={o.id}
              type="button"
              className="oxos-btn oxos-btn--ghost"
              onClick={() => {
                onGroup(o.id);
                onClose();
              }}
            >
              Group with {o.title}
            </button>
          ))
      )}
      {(!w.tabGroupId && others.filter((o) => o.id !== w.id).length === 0) && (
        <p className="oxos-hint">No other windows to group with.</p>
      )}
    </div>
  );
}

/* ---------------------------- desktop context menu ---------------------------- */

export function DesktopCtxMenu({
  x,
  y,
  onNewNote,
  onNewFolder,
  onWallpaper,
  onSettings,
  onClose,
}: {
  x: number;
  y: number;
  onNewNote: () => void;
  onNewFolder: () => void;
  onWallpaper: () => void;
  onSettings: () => void;
  onClose: () => void;
}) {
  return (
    <>
      <div className="oxos-ctxmenu__backdrop" onPointerDown={onClose} onContextMenu={(e) => e.preventDefault()} />
      <div className="oxos-ctxmenu" style={{ left: Math.min(x, window.innerWidth - 220), top: Math.min(y, window.innerHeight - 220) }}>
        <button type="button" onClick={() => { onNewNote(); onClose(); }}>＋ New note</button>
        <button type="button" onClick={() => { onNewFolder(); onClose(); }}>＋ New folder</button>
        <button type="button" onClick={() => { onWallpaper(); onClose(); }}>Change wallpaper…</button>
        <button type="button" onClick={() => { onSettings(); onClose(); }}>Settings…</button>
      </div>
    </>
  );
}

/* ------------------------------ theme preview ------------------------------ */

/** Mini mock desktop for a pack (idea bank #949: see it before applying). */
export function ThemeMock({
  wallpaper,
  accent,
  radius,
  shape,
}: {
  wallpaper: string;
  accent: string;
  radius: number;
  shape?: "rounded" | "circle" | "hex";
}) {
  const shapeStyle: CSSProperties =
    shape === "circle"
      ? { borderRadius: "50%" }
      : shape === "hex"
        ? { borderRadius: 4, clipPath: "polygon(25% 0, 75% 0, 100% 50%, 75% 100%, 25% 100%, 0 50%)" }
        : { borderRadius: radius };
  // "space" renders a component (not a CSS class) and "live" is a canvas —
  // both fall back to a dark mock background.
  const wallClass =
    wallpaper === "space" || wallpaper === "live" ? "" : `oxos-wallpaper--${wallpaper}`;
  return (
    <div
      className={`oxos-thememock ${wallClass}`}
      style={wallClass ? undefined : { background: "#0b0d1a" }}
    >
      <div className="oxos-thememock__icons">
        {[0, 1, 2].map((i) => (
          <span key={i} className="oxos-thememock__icon" style={{ ...shapeStyle, background: i === 0 ? accent : "rgba(255,255,255,0.25)" }} />
        ))}
      </div>
      <div className="oxos-thememock__bar" style={{ background: accent }} />
    </div>
  );
}

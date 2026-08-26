import { useEffect, useMemo, useState } from "react";
import { CanvasTexture, SRGBColorSpace, Texture } from "three";

const MAX_INFLIGHT = 8;
const cache = new Map<string, Texture | null>();
const inflight = new Map<string, Promise<Texture | null>>();
const fallbackCache = new Map<string, CanvasTexture>();

type Job = {
  url: string;
  size: number;
  tint: string;
  ticker: string;
  resolve: (tex: Texture | null) => void;
};

const queue: Job[] = [];
let running = 0;

export function planetMediaSrc(url: string | null | undefined): string | null {
  const src = String(url || "").trim();
  if (!src) return null;
  if (src.startsWith("/") || src.startsWith("data:") || src.startsWith("blob:")) return src;
  try {
    const parsed = new URL(src);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
  } catch {
    return null;
  }
  return `/api/on-chain/media?u=${encodeURIComponent(src)}`;
}

function hashHue(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return (h >>> 0) % 360;
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function finishCanvas(canvas: HTMLCanvasElement): CanvasTexture {
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

export function makeFallbackPlanetTexture(tint: string, ticker: string, seed = "x"): CanvasTexture {
  const key = `${tint}|${ticker}|${seed}`;
  const hit = fallbackCache.get(key);
  if (hit) return hit;
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return finishCanvas(canvas);

  const hue = hashHue(seed + tint);
  const g = ctx.createRadialGradient(size * 0.34, size * 0.3, 8, size * 0.5, size * 0.5, size * 0.72);
  g.addColorStop(0, tint);
  g.addColorStop(0.45, `hsl(${hue} 42% 18%)`);
  g.addColorStop(1, "#05030c");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 28; i++) {
    const x = ((hashHue(`${seed}:${i}`) * 17) % size);
    const y = ((hashHue(`${seed}*${i}`) * 13) % size);
    const r = 10 + (i % 9) * 6;
    const blob = ctx.createRadialGradient(x, y, 1, x, y, r);
    blob.addColorStop(0, `hsla(${(hue + i * 9) % 360} 50% 48% / 0.38)`);
    blob.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = blob;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const poles = ctx.createLinearGradient(0, 0, 0, size);
  poles.addColorStop(0, "rgba(8,6,18,0.72)");
  poles.addColorStop(0.16, "rgba(8,6,18,0)");
  poles.addColorStop(0.84, "rgba(8,6,18,0)");
  poles.addColorStop(1, "rgba(8,6,18,0.72)");
  ctx.fillStyle = poles;
  ctx.fillRect(0, 0, size, size);

  const label = String(ticker || "").slice(0, 6).toUpperCase();
  if (label) {
    ctx.font = "700 42px ui-sans-serif, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "rgba(255,255,255,0.82)";
    ctx.fillText(label, size / 2, size / 2);
  }

  const tex = finishCanvas(canvas);
  fallbackCache.set(key, tex);
  return tex;
}

function paintCoinPlanet(img: HTMLImageElement, tint: string, size: number): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return finishCanvas(canvas);

  ctx.fillStyle = "#07040f";
  ctx.fillRect(0, 0, size, size);
  ctx.drawImage(img, 0, 0, size, size);

  const shade = ctx.createLinearGradient(0, 0, size, size);
  shade.addColorStop(0, "rgba(255,255,255,0.08)");
  shade.addColorStop(0.45, "rgba(0,0,0,0)");
  shade.addColorStop(1, "rgba(0,0,0,0.28)");
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, size, size);

  const poles = ctx.createLinearGradient(0, 0, 0, size);
  poles.addColorStop(0, "rgba(5,3,12,0.55)");
  poles.addColorStop(0.14, "rgba(5,3,12,0)");
  poles.addColorStop(0.86, "rgba(5,3,12,0)");
  poles.addColorStop(1, "rgba(5,3,12,0.62)");
  ctx.fillStyle = poles;
  ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle = tint;
  ctx.globalAlpha = 0.18;
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.ellipse(size / 2, size / 2, size * 0.46, size * 0.14, -0.4, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;

  return finishCanvas(canvas);
}

async function actuallyLoad(url: string, size: number, tint: string): Promise<Texture | null> {
  const proxied = planetMediaSrc(url);
  const candidates = proxied && proxied !== url ? [proxied, url] : [url];
  for (const src of candidates) {
    const img = await loadImage(src);
    if (img && img.naturalWidth > 0) return paintCoinPlanet(img, tint, size);
  }
  return null;
}

function pump(): void {
  while (running < MAX_INFLIGHT && queue.length) {
    const job = queue.shift();
    if (!job) break;
    running += 1;
    void actuallyLoad(job.url, job.size, job.tint).then((tex) => {
      cache.set(job.url, tex);
      job.resolve(tex);
      running -= 1;
      pump();
    });
  }
}

function requestPlanetTexture(url: string, size: number, tint: string, ticker: string, priority: number): Promise<Texture | null> {
  if (cache.has(url)) return Promise.resolve(cache.get(url) || null);
  const pending = inflight.get(url);
  if (pending) return pending;
  const work = new Promise<Texture | null>((resolve) => {
    queue.push({ url, size, tint, ticker, resolve });
    if (priority >= 8) {
      const last = queue.pop();
      if (last) queue.unshift(last);
    }
    pump();
  });
  inflight.set(url, work);
  void work.finally(() => inflight.delete(url));
  return work;
}

export function usePlanetTexture(
  url: string | null | undefined,
  tint: string,
  ticker: string,
  seed: string,
  hi = false,
  priority = 0,
): Texture {
  const fallback = useMemo(
    () => makeFallbackPlanetTexture(tint, ticker, seed),
    [tint, ticker, seed],
  );
  const [tex, setTex] = useState<Texture>(fallback);

  useEffect(() => {
    setTex(fallback);
    if (!url) return undefined;
    let cancelled = false;
    void requestPlanetTexture(url, hi ? 512 : 256, tint, ticker, priority).then((loaded) => {
      if (!cancelled && loaded) setTex(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, [url, tint, ticker, fallback, hi, priority]);

  return tex;
}

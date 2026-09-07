import { useEffect, useMemo, useState } from "react";
import { CanvasTexture, SRGBColorSpace, Texture } from "three";

const MAX_INFLIGHT = 12;
const MAX_ATTEMPTS = 3;
const cache = new Map<string, Texture>();
const misses = new Map<string, number>();
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
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

export function makeFallbackPlanetTexture(tint: string, ticker: string, seed = "x"): CanvasTexture {
  const key = `${tint}|${ticker}|${seed}|hi512`;
  const hit = fallbackCache.get(key);
  if (hit) return hit;
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return finishCanvas(canvas);

  const hue = hashHue(seed + tint);
  const light = 18 + (hue % 22);
  const g = ctx.createRadialGradient(size * 0.32, size * 0.28, 12, size * 0.5, size * 0.5, size * 0.74);
  g.addColorStop(0, `hsl(${hue} 62% ${Math.min(72, light + 38)}%)`);
  g.addColorStop(0.42, `hsl(${hue} 48% ${light + 8}%)`);
  g.addColorStop(1, "#050505");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 48; i++) {
    const x = ((hashHue(`${seed}:${i}`) * 17) % size);
    const y = ((hashHue(`${seed}*${i}`) * 13) % size);
    const r = 14 + (i % 11) * 8;
    const blob = ctx.createRadialGradient(x, y, 1, x, y, r);
    blob.addColorStop(0, `hsla(${(hue + i * 7) % 360} 50% ${30 + (i % 40)}% / 0.42)`);
    blob.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = blob;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const poles = ctx.createLinearGradient(0, 0, 0, size);
  poles.addColorStop(0, "rgba(0,0,0,0.72)");
  poles.addColorStop(0.16, "rgba(0,0,0,0)");
  poles.addColorStop(0.84, "rgba(0,0,0,0)");
  poles.addColorStop(1, "rgba(0,0,0,0.78)");
  ctx.fillStyle = poles;
  ctx.fillRect(0, 0, size, size);

  const spec = ctx.createRadialGradient(size * 0.34, size * 0.3, 4, size * 0.34, size * 0.3, size * 0.38);
  spec.addColorStop(0, "rgba(255,255,255,0.22)");
  spec.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = spec;
  ctx.fillRect(0, 0, size, size);

  const tex = finishCanvas(canvas);
  fallbackCache.set(key, tex);
  return tex;
}

function paintCoinPlanet(img: HTMLImageElement, tint: string, size: number): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return finishCanvas(canvas);

  ctx.fillStyle = "#050505";
  ctx.fillRect(0, 0, size, size);
  ctx.drawImage(img, 0, 0, size, size);

  const shade = ctx.createLinearGradient(0, 0, size, size);
  shade.addColorStop(0, "rgba(255,255,255,0.16)");
  shade.addColorStop(0.45, "rgba(0,0,0,0)");
  shade.addColorStop(1, "rgba(0,0,0,0.42)");
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, size, size);

  const poles = ctx.createLinearGradient(0, 0, 0, size);
  poles.addColorStop(0, "rgba(0,0,0,0.58)");
  poles.addColorStop(0.14, "rgba(0,0,0,0)");
  poles.addColorStop(0.86, "rgba(0,0,0,0)");
  poles.addColorStop(1, "rgba(0,0,0,0.66)");
  ctx.fillStyle = poles;
  ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle = "#f5f5f5";
  ctx.globalAlpha = 0.14;
  ctx.lineWidth = 10;
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
    void actuallyLoad(job.url, job.size, job.tint)
      .catch(() => null)
      .then((tex) => {
        if (tex) {
          cache.set(job.url, tex);
          misses.delete(job.url);
        } else {
          misses.set(job.url, (misses.get(job.url) || 0) + 1);
        }
        job.resolve(tex);
      })
      .finally(() => {
        running -= 1;
        pump();
      });
  }
}

function requestPlanetTexture(url: string, size: number, tint: string, ticker: string, priority: number): Promise<Texture | null> {
  const hit = cache.get(url);
  if (hit) return Promise.resolve(hit);
  if ((misses.get(url) || 0) >= MAX_ATTEMPTS) return Promise.resolve(null);
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
    void requestPlanetTexture(url, hi ? 768 : 512, tint, ticker, priority).then((loaded) => {
      if (!cancelled && loaded) setTex(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, [url, tint, ticker, fallback, hi, priority]);

  return tex;
}

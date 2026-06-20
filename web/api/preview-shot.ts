/**
 * Vercel Serverless Function: /api/preview-shot
 *
 * Returns a PNG screenshot of any OG Scan page rendered in read-only PREVIEW
 * MODE (no account, no real data). Lets a non-browsing AI "see" the UI.
 *
 * Auth: requires the server-side key `PREVIEW_SHOT_KEY` (Vercel env). It is a
 * TRUE secret (never shipped to the browser). Pass it as ?key= or X-Shot-Key.
 *
 * Read-only by nature — it only screenshots; the rendered page is itself in
 * preview mode (all backend reads stubbed, all writes blocked).
 *
 * Query params:
 *   path     - site path to capture, e.g. /scanner  (default /app)
 *   w, h     - viewport size (default 1280x900; clamped)
 *   full=1   - capture full scrollable page
 *   format=json - return { url, image: dataURL } instead of raw PNG
 *
 * Requires deps: puppeteer-core, @sparticuz/chromium
 * Configure in vercel.json: functions["api/preview-shot.ts"] = { memory: 1024, maxDuration: 60 }
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";

const SITE = process.env.PREVIEW_SITE_ORIGIN || "https://www.ogscan.fun";
// Frontend preview key (unlocks the empty UI shell). Keep in sync with VITE_PREVIEW_KEY.
const PREVIEW_KEY =
  process.env.VITE_PREVIEW_KEY || "ogscan_ui_preview_7Qx2v9Lm4Kd8Rn3Tb6Wp1Zc5Hf0Jg2Ss";
// Server secret to call THIS endpoint. Defaults to the preview key if unset.
const SHOT_KEY = process.env.PREVIEW_SHOT_KEY || PREVIEW_KEY;

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "content-type,x-shot-key");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "GET only (read-only)" });

  const key = String(req.query.key || req.headers["x-shot-key"] || "");
  if (!key || key !== SHOT_KEY) return res.status(401).json({ error: "invalid or missing key" });

  // Only allow same-site relative paths (prevents SSRF to arbitrary URLs).
  let path = String(req.query.path || "/app").trim();
  if (!path.startsWith("/")) path = "/" + path;
  path = path.split("#")[0].split("?")[0];
  if (!/^\/[A-Za-z0-9\-\/_:.]*$/.test(path)) return res.status(400).json({ error: "invalid path" });

  const w = clamp(parseInt(String(req.query.w || "1280"), 10) || 1280, 320, 1920);
  const h = clamp(parseInt(String(req.query.h || "900"), 10) || 900, 320, 3000);
  const fullPage = ["1", "true", "yes"].includes(String(req.query.full || "").toLowerCase());
  const target = `${SITE}${path}?agent=${encodeURIComponent(PREVIEW_KEY)}`;

  let browser: any;
  try {
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: { width: w, height: h, deviceScaleFactor: 1 },
      executablePath: await chromium.executablePath(),
      headless: true,
    });
    const page = await browser.newPage();
    await page.goto(target, { waitUntil: "networkidle2", timeout: 45000 });
    await new Promise((r) => setTimeout(r, 1600)); // let UI settle
    const buf = (await page.screenshot({ type: "png", fullPage })) as Buffer;

    if (String(req.query.format || "").toLowerCase() === "json") {
      return res.status(200).json({
        url: target,
        width: w,
        height: h,
        image: `data:image/png;base64,${Buffer.from(buf).toString("base64")}`,
      });
    }
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).send(Buffer.from(buf));
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "screenshot failed", target });
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}

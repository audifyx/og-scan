/**
 * Capture product screenshots for the splash page.
 *
 *   npm i -D playwright
 *   npx playwright install chromium
 *   node scripts/capture-splash-shots.mjs
 */
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "..", "public", "splash");

async function dismiss(page) {
  for (const sel of [
    "button:has-text('Accept')",
    "button:has-text('Got it')",
    "button:has-text('Close')",
    "[aria-label='Close']",
  ]) {
    try {
      const el = page.locator(sel).first();
      if (await el.isVisible({ timeout: 400 })) await el.click({ timeout: 800 });
    } catch {}
  }
}

async function shot(page, file, opts = {}) {
  const dest = path.join(outDir, file);
  if (opts.scrollY) {
    await page.evaluate((y) => window.scrollTo(0, y), opts.scrollY);
    await page.waitForTimeout(700);
  }
  await page.screenshot({ path: dest, type: "jpeg", quality: 84, fullPage: false });
  console.log(`  saved ${file}`);
}

async function open(context, url, wait = 5000) {
  const page = await context.newPage();
  console.log(`→ ${url}`);
  await page.goto(url, { waitUntil: "networkidle", timeout: 90000 }).catch(async () => {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
  });
  await page.waitForTimeout(wait);
  await dismiss(page);
  return page;
}

await mkdir(outDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
});

// ── DEX: home + tab clicks ──
{
  const page = await open(context, "https://orbitx.world/ORBITX_DEX", 5500);
  await shot(page, "dex-01.jpg");
  for (const [file, label] of [
    ["dex-02.jpg", "Scanner"],
    ["dex-03.jpg", "Pulse"],
    ["dex-04.jpg", "Wallets"],
  ]) {
    try {
      await page.getByRole("link", { name: label, exact: false }).first().click({ timeout: 2500 });
    } catch {
      try {
        await page.getByText(label, { exact: true }).first().click({ timeout: 2000 });
      } catch {
        console.log(`  skip click ${label}`);
      }
    }
    await page.waitForTimeout(2800);
    await shot(page, file);
  }
  await page.close();
}

// ── Launchpad ──
{
  const page = await open(context, "https://orbitx.world/orbitxlaunch", 7000);
  await shot(page, "launch-01.jpg");
  await page.close();
}
{
  const page = await open(context, "https://orbitx.world/orbitxlaunch/create", 5000);
  await shot(page, "launch-02.jpg");
  await page.close();
}
{
  const page = await open(context, "https://orbitx.world/orbitxlaunch/leaderboard", 4500);
  await shot(page, "launch-03.jpg");
  await page.close();
}
{
  const page = await open(context, "https://orbitx.world/orbitxlaunch/claim", 4500);
  await shot(page, "launch-04.jpg");
  await page.close();
}

// ── Prediction ──
{
  const page = await open(context, "https://solno.fun", 5000);
  await shot(page, "predict-01.jpg");
  await shot(page, "predict-02.jpg", { scrollY: 520 });
  await shot(page, "predict-03.jpg", { scrollY: 1100 });
  try {
    await page.getByRole("link", { name: /Games/i }).first().click({ timeout: 2500 });
    await page.waitForTimeout(3000);
  } catch {
    try {
      await page.getByRole("link", { name: /Markets/i }).first().click({ timeout: 2500 });
      await page.waitForTimeout(3000);
    } catch {}
  }
  await shot(page, "predict-04.jpg");
  await page.close();
}

await browser.close();
console.log("done");

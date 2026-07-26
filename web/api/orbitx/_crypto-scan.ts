/**
 * OrbitX Crypto Scan — one-shot aggregator for token intelligence.
 * Composes OG DEX safety + forensics + token into a single payload.
 * Falls back gracefully if any upstream fails.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";

const MINT_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

function originFromReq(req: VercelRequest): string {
  const proto = (req.headers["x-forwarded-proto"] as string) || "https";
  const host = (req.headers["x-forwarded-host"] as string) || req.headers.host || "localhost";
  return `${proto}://${host}`;
}

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return res.json();
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Cache-Control", "s-maxage=20, stale-while-revalidate=60");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ ok: false, error: "GET only" });

  const mint = String(req.query.mint || "");
  if (!MINT_RE.test(mint)) return res.status(400).json({ ok: false, error: "valid mint required" });

  const base = originFromReq(req);
  const [safety, forensics, token] = await Promise.all([
    fetchJson(`${base}/api/ogdex/safety?mint=${encodeURIComponent(mint)}`).catch((e) => ({
      ok: false,
      error: String(e?.message || e),
    })),
    fetchJson(`${base}/api/ogdex/forensics?mint=${encodeURIComponent(mint)}&first=0`).catch((e) => ({
      ok: false,
      error: String(e?.message || e),
    })),
    fetchJson(`${base}/api/ogdex/token?mint=${encodeURIComponent(mint)}`).catch((e) => ({
      ok: false,
      error: String(e?.message || e),
    })),
  ]);

  return res.status(200).json({
    ok: true,
    mint,
    safety,
    forensics,
    token,
    source: "orbitx-crypto-scan",
    ts: Date.now(),
  });
}

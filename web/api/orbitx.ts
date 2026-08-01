/**
 * OrbitX API router — keeps Hobby plan ≤12 serverless functions.
 *
 * Mounted via vercel rewrite:
 *   /api/orbitx/(.*) → /api/orbitx?path=$1
 *
 * Routes:
 *   GET  /api/orbitx/crypto-scan?mint=...
 *   POST /api/orbitx/anti-vamp-check
 *
 * Agent + MCP live in standalone plain-JS functions:
 *   /api/orbitx-agent, /api/orbitx-mcp
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import antiVamp from "./orbitx/_anti-vamp-check";
import cryptoScan from "./orbitx/_crypto-scan";

function routePath(req: VercelRequest): string {
  const q = req.query.path;
  if (typeof q === "string" && q.length) return q.split("/").filter(Boolean)[0] || "";
  if (Array.isArray(q) && q[0]) return String(q[0]).split("/").filter(Boolean)[0] || "";
  const url = req.url || "";
  const after = url.split("/api/orbitx")[1] || url.split("/orbitx")[1] || "";
  return after.replace(/^\//, "").split("?")[0]!.split("/").filter(Boolean)[0] || "";
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const route = routePath(req);

  if (route === "crypto-scan") return cryptoScan(req, res);
  if (route === "anti-vamp-check") return antiVamp(req, res);

  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(204).end();
  return res.status(404).json({
    ok: false,
    error: "unknown_orbitx_route",
    routes: ["crypto-scan", "anti-vamp-check"],
    agent: "/api/orbitx-agent",
    mcp: "/api/orbitx-mcp",
  });
}

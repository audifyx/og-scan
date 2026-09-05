import type { VercelRequest, VercelResponse } from "@vercel/node";
import { clientIp, hitAuthLimit } from "./_authLimit.js";

/**
 * Same-origin Web3 (SIWS) grant for /auth.
 *
 * The browser must NOT call public GoTrue (`/auth/v1/token?grant_type=web3`) —
 * that path hangs from client networks the same way password grant did.
 * Import helpers with a `.js` specifier so Vercel ESM/NFT can bundle them.
 */
export const config = { maxDuration: 25 };

const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
const ANON = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
const GOTRUE_TIMEOUT_MS = Number(process.env.AUTH_LOGIN_TIMEOUT_MS || 12_000) || 12_000;
const WEB3_MAX = 10;
const WEB3_WINDOW_MS = 15 * 60 * 1000;

const AUTH_ORIGINS = new Set([
  "https://orbitx.world",
  "https://www.orbitx.world",
  "https://ogscan.fun",
  "https://www.ogscan.fun",
  "https://orbitxcity.vercel.app",
]);

function originAllowed(origin: string | undefined): boolean {
  if (!origin) return true;
  if (AUTH_ORIGINS.has(origin)) return true;
  try {
    const host = new URL(origin).hostname;
    if (host === "localhost" || host === "127.0.0.1") return true;
    if (host.endsWith(".vercel.app")) return true;
  } catch {
    return false;
  }
  return false;
}

function send(res: VercelResponse, status: number, body: Record<string, unknown>) {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.status(status).json(body);
}

function readJson(req: VercelRequest): { chain?: string; message?: string; signature?: string } {
  const raw = req.body;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw || "{}") as { chain?: string; message?: string; signature?: string };
    } catch {
      return {};
    }
  }
  if (raw && typeof raw === "object") return raw as { chain?: string; message?: string; signature?: string };
  return {};
}

async function timedFetch(url: string, init: RequestInit, ms: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const origin = typeof req.headers?.origin === "string" ? req.headers.origin : "";
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", originAllowed(origin) ? (origin || "*") : "https://www.orbitx.world");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.status(200).end();
    return;
  }
  if (req.method !== "POST") {
    send(res, 405, { error: "Method not allowed" });
    return;
  }
  if (origin && !originAllowed(origin)) {
    send(res, 403, { error: "origin_not_allowed" });
    return;
  }
  if (!SUPABASE_URL || !ANON) {
    send(res, 500, { error: "Auth is not configured" });
    return;
  }

  const body = readJson(req);
  const chain = body.chain === "ethereum" ? "ethereum" : "solana";
  const message = typeof body.message === "string" ? body.message.trim() : "";
  const signature = typeof body.signature === "string" ? body.signature.trim() : "";
  if (!message || !signature) {
    send(res, 400, { error: "message and signature are required" });
    return;
  }

  const ip = clientIp(req);
  const limited = hitAuthLimit(`web3:${ip}`, WEB3_MAX, WEB3_WINDOW_MS);
  if (limited.limited) {
    res.setHeader("Retry-After", String(limited.retrySec));
    send(res, 429, { error: "Too many wallet login attempts. Try again in 15 minutes.", retryAfter: limited.retrySec });
    return;
  }

  try {
    const gotrue = await timedFetch(
      `${SUPABASE_URL}/auth/v1/token?grant_type=web3`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: ANON,
          Authorization: `Bearer ${ANON}`,
        },
        body: JSON.stringify({ chain, message, signature }),
      },
      GOTRUE_TIMEOUT_MS,
    );
    const json = (await gotrue.json().catch(() => ({}))) as Record<string, unknown>;
    if (!gotrue.ok) {
      const msg = String(json.msg || json.error_description || json.error || json.message || "Wallet sign-in failed");
      if (gotrue.status === 504 || gotrue.status === 502 || gotrue.status === 503) {
        send(res, 503, { error: "Wallet login timed out. Please try again." });
        return;
      }
      send(res, gotrue.status >= 400 && gotrue.status < 500 ? gotrue.status : 400, { error: msg });
      return;
    }
    send(res, 200, json);
  } catch {
    send(res, 503, { error: "Wallet login timed out. Please try again." });
  }
}

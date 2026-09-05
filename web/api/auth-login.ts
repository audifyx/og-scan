import type { VercelRequest, VercelResponse } from "@vercel/node";

/**
 * Same-origin email login for /auth.
 *
 * The browser must NOT call public GoTrue (`/auth/v1/token`) — that path 504s
 * for ~43s from client networks and locks supabase-js. This function talks to
 * GoTrue from Vercel's network instead. Do not proxy through auth-signin: that
 * edge function is the same password grant plus a cold-start that previously
 * outlived the client abort.
 */
export const config = { maxDuration: 25 };

const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
const ANON = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
const GOTRUE_TIMEOUT_MS = Number(process.env.AUTH_LOGIN_TIMEOUT_MS || 12_000) || 12_000;

function send(res: VercelResponse, status: number, body: Record<string, unknown>) {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.status(status).json(body);
}

function readJson(req: VercelRequest): { email?: string; password?: string } {
  const raw = req.body;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw || "{}") as { email?: string; password?: string };
    } catch {
      return {};
    }
  }
  if (raw && typeof raw === "object") return raw as { email?: string; password?: string };
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
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.status(200).end();
    return;
  }
  if (req.method !== "POST") {
    send(res, 405, { error: "Method not allowed" });
    return;
  }
  if (!SUPABASE_URL || !ANON) {
    send(res, 500, { error: "Auth is not configured" });
    return;
  }

  const { email, password } = readJson(req);
  const cleanEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
  if (!cleanEmail || typeof password !== "string" || !password) {
    send(res, 400, { error: "Email and password are required" });
    return;
  }

  try {
    const gotrue = await timedFetch(
      `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: ANON,
          Authorization: `Bearer ${ANON}`,
        },
        body: JSON.stringify({ email: cleanEmail, password }),
      },
      GOTRUE_TIMEOUT_MS,
    );
    const json = (await gotrue.json().catch(() => ({}))) as Record<string, unknown>;
    if (!gotrue.ok) {
      const msg = String(json.msg || json.error_description || json.error || "Sign-in failed");
      if (gotrue.status === 504 || gotrue.status === 502 || gotrue.status === 503) {
        send(res, 503, { error: "Login service timed out. Please try again." });
        return;
      }
      send(res, gotrue.status >= 400 && gotrue.status < 500 ? gotrue.status : 400, { error: msg });
      return;
    }
    send(res, 200, json);
  } catch {
    send(res, 503, { error: "Login service timed out. Please try again." });
  }
}

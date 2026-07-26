/**
 * OrbitX World API — shared backend helpers (no UI).
 * Used by /api/orbitx-world serverless routes.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { VercelRequest, VercelResponse } from "@vercel/node";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
const SUPABASE_ANON = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

export const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-orbitx-client",
  "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
  "Content-Type": "application/json",
};

export function json(res: VercelResponse, body: unknown, status = 200) {
  res.status(status);
  for (const [k, v] of Object.entries(CORS_HEADERS)) res.setHeader(k, v);
  return res.json(body);
}

export function handleOptions(req: VercelRequest, res: VercelResponse): boolean {
  if (req.method === "OPTIONS") {
    for (const [k, v] of Object.entries(CORS_HEADERS)) res.setHeader(k, v);
    res.status(204).end();
    return true;
  }
  return false;
}

export function adminClient(): SupabaseClient {
  if (!SUPABASE_URL || !SERVICE_ROLE) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
}

export function userClient(authHeader?: string): SupabaseClient {
  if (!SUPABASE_URL || !SUPABASE_ANON) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_ANON_KEY");
  }
  return createClient(SUPABASE_URL, SUPABASE_ANON, {
    global: { headers: authHeader ? { Authorization: authHeader } : {} },
    auth: { persistSession: false },
  });
}

export function bearer(req: VercelRequest): string | undefined {
  const h = req.headers.authorization || req.headers.Authorization;
  return typeof h === "string" ? h : undefined;
}

export async function requireUser(req: VercelRequest): Promise<{ id: string; client: SupabaseClient }> {
  const auth = bearer(req);
  if (!auth) throw Object.assign(new Error("unauthorized"), { status: 401 });
  const client = userClient(auth);
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw Object.assign(new Error("unauthorized"), { status: 401 });
  return { id: data.user.id, client };
}

/** In-memory sliding window (per-instance). Prefer Upstash in production via /api/rate-limit. */
const buckets = new Map<string, { count: number; reset: number }>();

export function memoryRateLimit(key: string, max: number, windowMs: number): { limited: boolean; retryAfter: number } {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || now > b.reset) {
    buckets.set(key, { count: 1, reset: now + windowMs });
    return { limited: false, retryAfter: 0 };
  }
  b.count += 1;
  if (b.count > max) {
    return { limited: true, retryAfter: Math.ceil((b.reset - now) / 1000) };
  }
  return { limited: false, retryAfter: 0 };
}

export function clientIp(req: VercelRequest): string {
  const xf = req.headers["x-forwarded-for"];
  if (typeof xf === "string" && xf.length) return xf.split(",")[0]!.trim();
  return req.socket?.remoteAddress || "unknown";
}

export type OxwRouteContext = {
  req: VercelRequest;
  res: VercelResponse;
  path: string[];
  query: Record<string, string | string[] | undefined>;
};

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { clientIp, hitAuthLimit } from "../_authLimit.js";

/**
 * Signup proxy — never create users here. Forwards to signup-guard
 * (device + IP limits). Direct admin.createUser is closed.
 */
export const config = { maxDuration: 25 };

const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
const ANON = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";

function send(res: VercelResponse, status: number, body: Record<string, unknown>) {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.status(status).json(body);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "OPTIONS") {
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

  let raw: Record<string, any> = {};
  try {
    raw = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
  } catch {
    send(res, 400, { error: "Invalid JSON" });
    return;
  }
  const email = typeof raw.email === "string" ? raw.email.trim().toLowerCase() : "";
  const password = typeof raw.password === "string" ? raw.password : "";
  const username = typeof raw.username === "string" ? raw.username : raw.metadata?.username;
  const fingerprint = typeof raw.fingerprint === "string" && raw.fingerprint
    ? raw.fingerprint
    : "";
  if (!email || !password) {
    send(res, 400, { error: "Email and password required" });
    return;
  }
  if (!fingerprint) {
    send(res, 400, { error: "device_fingerprint_required", code: "DEVICE_REQUIRED" });
    return;
  }

  const limited = hitAuthLimit(`signup:${email}:${clientIp(req)}`, 3, 60 * 60 * 1000);
  if (limited.limited) {
    res.setHeader("Retry-After", String(limited.retrySec));
    send(res, 429, { error: "Too many signup attempts. Try again later.", retryAfter: limited.retrySec });
    return;
  }

  const ip = clientIp(req);
  const origin = String(req.headers?.origin || "https://www.orbitx.world");
  try {
    const upstream = await fetch(`${SUPABASE_URL}/functions/v1/signup-guard`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: ANON,
        Authorization: `Bearer ${ANON}`,
        Origin: origin,
        ...(ip ? { "x-forwarded-for": ip } : {}),
      },
      body: JSON.stringify({ email, password, username, fingerprint }),
    });
    const json = (await upstream.json().catch(() => ({}))) as Record<string, unknown>;
    send(res, upstream.status, json);
  } catch {
    send(res, 503, { error: "Signup service timed out. Please try again." });
  }
}

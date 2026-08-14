import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
const SUPABASE_ANON =
  process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, content-type, apikey, x-orbitx-client, mcp-session-id, last-event-id, accept",
  "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
  "Content-Type": "application/json",
};

export function json(res, body, status = 200) {
  res.status(status);
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    res.setHeader(key, value);
  }
  return res.json(body);
}

export function handleOptions(req, res) {
  if (req.method !== "OPTIONS") return false;
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    res.setHeader(key, value);
  }
  res.status(204).end();
  return true;
}

export function adminClient() {
  if (!SUPABASE_URL || !SERVICE_ROLE) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false },
  });
}

function userClient(authHeader) {
  if (!SUPABASE_URL || !SUPABASE_ANON) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_ANON_KEY");
  }
  return createClient(SUPABASE_URL, SUPABASE_ANON, {
    global: { headers: authHeader ? { Authorization: authHeader } : {} },
    auth: { persistSession: false },
  });
}

export async function requireUser(req) {
  const raw = req.headers.authorization || req.headers.Authorization;
  const auth = typeof raw === "string" ? raw : undefined;
  if (!auth) throw Object.assign(new Error("unauthorized"), { status: 401 });
  const client = userClient(auth);
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) {
    throw Object.assign(new Error("unauthorized"), { status: 401 });
  }
  return { id: data.user.id, client };
}

const buckets = new Map();

export function memoryRateLimit(key, max, windowMs) {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || now > bucket.reset) {
    buckets.set(key, { count: 1, reset: now + windowMs });
    return { limited: false, retryAfter: 0 };
  }
  bucket.count += 1;
  if (bucket.count > max) {
    return {
      limited: true,
      retryAfter: Math.ceil((bucket.reset - now) / 1000),
    };
  }
  return { limited: false, retryAfter: 0 };
}

export function clientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length) {
    return forwarded.split(",")[0].trim();
  }
  return req.socket?.remoteAddress || "unknown";
}

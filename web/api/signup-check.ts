import type { VercelRequest, VercelResponse } from "@vercel/node";

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
const SUPABASE_ANON_KEY =
  process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";

const YEAR_MS = 365 * 24 * 60 * 60 * 1000;
const HUMAN_CODE = "OGSCAN";
const MIN_FORM_TIME_MS = 4_000;

const baseHeaders = {
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  "Content-Type": "application/json",
};

function setCors(res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function getClientIp(req: VercelRequest): string {
  const forwarded = req.headers["x-forwarded-for"];
  const forwardedValue = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  if (forwardedValue) return forwardedValue.split(",")[0].trim();

  const realIp = req.headers["x-real-ip"];
  if (typeof realIp === "string" && realIp.trim()) return realIp.trim();

  return "unknown";
}

async function fetchFirstProfileMatch(field: string, value: string, sinceIso: string) {
  const params = new URLSearchParams();
  params.set("select", "user_id,username,created_at");
  params.set(field, `eq.${value}`);
  params.set("created_at", `gte.${sinceIso}`);
  params.set("order", "created_at.desc");
  params.set("limit", "1");

  const response = await fetch(`${SUPABASE_URL}/rest/v1/profiles?${params.toString()}`, {
    headers: baseHeaders,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`profiles lookup failed (${field}): ${response.status} ${text}`);
  }

  const rows = (await response.json()) as Array<{
    user_id: string;
    username: string | null;
    created_at: string;
  }>;

  return rows[0] ?? null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ allowed: false, message: "Method not allowed" });
    return;
  }

  try {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      res.status(500).json({
        allowed: false,
        code: "signup_guard_not_configured",
        message: "Signup security is not configured. Please contact support.",
      });
      return;
    }

    const { email, username, fingerprint, honeypot, humanCode, elapsedMs } = req.body ?? {};

    if (!email || !username || !fingerprint) {
      res.status(400).json({ allowed: false, code: "missing_fields", message: "Missing signup guard fields" });
      return;
    }

    if (typeof honeypot === "string" && honeypot.trim()) {
      res.status(200).json({ allowed: false, code: "bot_honeypot", message: "Verification failed. Please try again." });
      return;
    }

    if (typeof humanCode !== "string" || humanCode.trim().toUpperCase() !== HUMAN_CODE) {
      res.status(200).json({ allowed: false, code: "human_check", message: "Type OGSCAN in the human verification box to continue." });
      return;
    }

    if (typeof elapsedMs !== "number" || elapsedMs < MIN_FORM_TIME_MS) {
      res.status(200).json({ allowed: false, code: "too_fast", message: "Please take a moment to complete the verification and try again." });
      return;
    }

    const sinceIso = new Date(Date.now() - YEAR_MS).toISOString();
    const clientIp = getClientIp(req);

    const [deviceMatch, usernameMatch, lastIpMatch, firstIpMatch] = await Promise.all([
      fetchFirstProfileMatch("last_fingerprint", fingerprint, sinceIso),
      fetchFirstProfileMatch("username", username, "1970-01-01T00:00:00.000Z"),
      clientIp !== "unknown" ? fetchFirstProfileMatch("last_ip", clientIp, sinceIso) : Promise.resolve(null),
      clientIp !== "unknown" ? fetchFirstProfileMatch("first_seen_ip", clientIp, sinceIso) : Promise.resolve(null),
    ]);

    if (deviceMatch) {
      res.status(200).json({
        allowed: false,
        code: "device_limit",
        message: "This device already created an account in the last year.",
      });
      return;
    }

    if (usernameMatch) {
      res.status(200).json({
        allowed: false,
        code: "username_taken",
        message: "That username is already taken.",
      });
      return;
    }

    res.status(200).json({
      allowed: true,
      rules: {
        oneAccountPerDevicePerYear: true,
        oneAccountPerIpPerYear: false,
        humanVerificationRequired: true,
      },
      ipSignals: {
        detected: clientIp !== "unknown",
        recentLastIpMatch: Boolean(lastIpMatch),
        recentFirstSeenIpMatch: Boolean(firstIpMatch),
      },
    });
  } catch (error) {
    console.error("[signup-check]", error);
    res.status(500).json({
      allowed: false,
      code: "guard_error",
      message: "Security verification is temporarily unavailable. Please try again.",
    });
  }
}

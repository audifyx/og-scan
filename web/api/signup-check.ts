import type { VercelRequest, VercelResponse } from "@vercel/node";

const RESERVED_OWNER_EMAILS = ["audifyx@gmail.com"] as const;
const RESERVED_SUBSTRINGS = [
  "admin",
  "administrator",
  "owner",
  "founder",
  "cofounder",
  "official",
  "staff",
  "support",
  "root",
  "sysadmin",
] as const;

function normalizeUsernameForPolicy(username: string) {
  return username.trim().replace(/^@/, "").toLowerCase();
}

function collapseUsername(username: string) {
  return normalizeUsernameForPolicy(username).replace(/[^a-z0-9]/g, "");
}

function canUseReservedUsername(email?: string | null) {
  const cleanEmail = email?.trim().toLowerCase();
  return Boolean(cleanEmail && RESERVED_OWNER_EMAILS.includes(cleanEmail as (typeof RESERVED_OWNER_EMAILS)[number]));
}

function isReservedUsername(username: string) {
  const raw = normalizeUsernameForPolicy(username);
  const collapsed = collapseUsername(username);

  if (!raw) return false;

  if (RESERVED_SUBSTRINGS.some((term) => collapsed.includes(term))) {
    return true;
  }

  if (
    collapsed.startsWith("dev") ||
    collapsed.endsWith("dev") ||
    collapsed.includes("developer") ||
    raw.startsWith("dev_") ||
    raw.endsWith("_dev") ||
    raw.includes("_dev_")
  ) {
    return true;
  }

  return false;
}

function getReservedUsernameMessage() {
  return "This username is reserved. Only the authorized owner account can use admin/dev-style usernames.";
}

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
const SUPABASE_ANON_KEY =
  process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";

const YEAR_MS = 365 * 24 * 60 * 60 * 1000;
const MIN_FORM_TIME_MS = 4_000;

// Cloudflare Turnstile secret key (test key — always passes)
// For production, replace with your real secret from:
// https://dash.cloudflare.com → Turnstile → Your widget → Secret Key
const TURNSTILE_SECRET = process.env.TURNSTILE_SECRET || "1x0000000000000000000000000000000AA";
const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

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

    const { email, username, fingerprint, honeypot, captchaToken, elapsedMs } = req.body ?? {};
    const cleanUsername = typeof username === "string" ? normalizeUsernameForPolicy(username) : "";
    const cleanEmail = typeof email === "string" ? email.trim().toLowerCase() : "";

    if (!cleanEmail || !cleanUsername || !fingerprint) {
      res.status(400).json({ allowed: false, code: "missing_fields", message: "Missing signup guard fields" });
      return;
    }

    if (typeof honeypot === "string" && honeypot.trim()) {
      res.status(200).json({ allowed: false, code: "bot_honeypot", message: "Verification failed. Please try again." });
      return;
    }

    // Verify Cloudflare Turnstile CAPTCHA
    if (!captchaToken) {
      res.status(200).json({ allowed: false, code: "captcha_missing", message: "Please complete the human verification." });
      return;
    }

    try {
      const turnstileRes = await fetch(TURNSTILE_VERIFY_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          secret: TURNSTILE_SECRET,
          response: captchaToken,
          remoteip: getClientIp(req),
        }),
      });
      const turnstileData = await turnstileRes.json() as { success: boolean };
      if (!turnstileData.success) {
        res.status(200).json({ allowed: false, code: "captcha_failed", message: "Human verification failed. Please try again." });
        return;
      }
    } catch {
      res.status(200).json({ allowed: false, code: "captcha_error", message: "Verification service unavailable. Please try again." });
      return;
    }

    if (typeof elapsedMs !== "number" || elapsedMs < MIN_FORM_TIME_MS) {
      res.status(200).json({ allowed: false, code: "too_fast", message: "Please take a moment to complete the verification and try again." });
      return;
    }

    if (isReservedUsername(cleanUsername) && !canUseReservedUsername(cleanEmail)) {
      res.status(200).json({
        allowed: false,
        code: "username_reserved",
        message: getReservedUsernameMessage(),
      });
      return;
    }

    const sinceIso = new Date(Date.now() - YEAR_MS).toISOString();
    const clientIp = getClientIp(req);

    const [deviceMatch, usernameMatch, lastIpMatch, firstIpMatch] = await Promise.all([
      fetchFirstProfileMatch("last_fingerprint", fingerprint, sinceIso),
      fetchFirstProfileMatch("username", cleanUsername, "1970-01-01T00:00:00.000Z"),
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

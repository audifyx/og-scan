/**
 * Auth + payload guards for X reply bots.
 * TWITTER_ACCESS_TOKEN must never be used unless authorizeXReplyRequest() passed.
 */

const TWEET_ID_RE = /^\d{5,32}$/;
const MAX_TEXT = 560;
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 8;

function safeEqual(a, b) {
  const left = String(a);
  const right = String(b);
  if (left.length !== right.length) return false;
  let out = 0;
  for (let i = 0; i < left.length; i++) out |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return out === 0;
}

/** Secrets that may unlock the reply bot. Empty = fail closed. */
export function xReplySecrets(env = {}) {
  const out = [];
  for (const key of ["X_REPLY_BOT_SECRET", "OXW_WORKER_SECRET"]) {
    const s = String(env[key] || "").trim();
    if (s && !out.includes(s)) out.push(s);
  }
  return out;
}

export function bearerToken(req) {
  const h = req?.headers?.get?.("authorization") || req?.headers?.authorization || "";
  const m = String(h).match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : "";
}

export function providedReplySecret(req) {
  const header =
    req?.headers?.get?.("x-orbitx-reply-secret") ||
    req?.headers?.["x-orbitx-reply-secret"] ||
    "";
  return String(header || bearerToken(req) || "").trim();
}

/**
 * AUTH: reject before Gemini or Twitter.
 * Accept Authorization: Bearer <X_REPLY_BOT_SECRET|OXW_WORKER_SECRET>
 * or x-orbitx-reply-secret: <same>.
 * Fail closed when no secret is configured.
 */
export function authorizeXReplyRequest(req, env = {}) {
  const secrets = xReplySecrets(env);
  if (!secrets.length) return { ok: false, status: 401, error: "not_configured" };
  const provided = providedReplySecret(req);
  if (!provided) return { ok: false, status: 401, error: "unauthorized" };
  if (!secrets.some((secret) => safeEqual(secret, provided))) {
    return { ok: false, status: 401, error: "unauthorized" };
  }
  return { ok: true };
}

export function clientIp(req) {
  const h = (name) => req?.headers?.get?.(name) || req?.headers?.[name] || "";
  const forwarded = String(h("x-forwarded-for") || "").split(",")[0].trim();
  return forwarded || String(h("cf-connecting-ip") || h("x-real-ip") || "unknown");
}

export function validateMentionPayload(body) {
  if (!body || typeof body !== "object") return { ok: false, error: "invalid_body" };
  const type = String(body.type || "").trim();
  const tweet = body.tweet && typeof body.tweet === "object" ? body.tweet : null;
  const mentionId = tweet?.id ?? body.mention_id;
  const text = tweet?.text ?? body.tweet_text;
  if (type && type !== "mention") return { ok: false, error: "invalid_type" };
  if (mentionId == null || text == null) return { ok: false, error: "invalid_payload" };
  const id = String(mentionId).trim();
  const raw = String(text);
  if (!TWEET_ID_RE.test(id)) return { ok: false, error: "invalid_tweet_id" };
  if (!raw.trim() || raw.length > MAX_TEXT) return { ok: false, error: "invalid_tweet_text" };
  const replyCount = Number(tweet?.public_metrics?.reply_count || 0);
  return {
    ok: true,
    tweet: {
      id,
      text: raw.trim(),
      public_metrics: { reply_count: Number.isFinite(replyCount) ? replyCount : 0 },
    },
  };
}

export function createRateLimiter({ windowMs = RATE_WINDOW_MS, max = RATE_MAX } = {}) {
  const hits = new Map();
  return {
    allow(key) {
      const now = Date.now();
      const bucket = (hits.get(key) || []).filter((t) => now - t < windowMs);
      if (bucket.length >= max) {
        hits.set(key, bucket);
        return false;
      }
      bucket.push(now);
      hits.set(key, bucket);
      return true;
    },
  };
}

export const X_REPLY_RATE = { windowMs: RATE_WINDOW_MS, max: RATE_MAX };

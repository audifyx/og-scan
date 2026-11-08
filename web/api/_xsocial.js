/**
 * _xsocial — X profile enrichment proxy for the OG scanner (W2).
 *
 * Underscore-prefixed: NOT a Vercel function on its own. Wire it into an
 * existing connector — see hookup note at the bottom. The client calls it
 * as /api/web?path=xsocial&handle=<handle> (after the coordinator adds the
 * LAZY entry + vercel.json rewrite).
 *
 *   GET ?handle=orbitx_wrld
 *     -> { ok: true, status: "available", source: "x_api_v2",
 *          fetchedAt, profile: { handle, name, description, followers,
 *          following, tweetCount, listed, createdAt, verified, protected,
 *          profileImageUrl } }
 *     -> { ok: false, status: "unavailable", reason, detail, fetchedAt }
 *        when enrichment is not possible (no bearer token, rate limit, …).
 *        HTTP 200 in both cases: "unavailable" is data, not an error.
 *
 * Auth: X API v2 app-only Bearer token from env TWITTER_BEARER_TOKEN
 * (or X_BEARER_TOKEN). No token is stored in code. If the env var is
 * missing the route honestly reports reason "no_bearer_token" — it never
 * guesses a follower count. The per-user OAuth2 tokens used by x-mcp.js
 * are NOT usable here: scanner lookups are anonymous.
 *
 * Timeline (dev's past posts): GET ?handle=<h>&include=timeline also
 * fetches GET /2/users/by/username/:handle/tweets (max 10, newest first)
 * and returns it as `timeline: { status, posts? }`. The timeline is a
 * SEPARATE X call from the profile lookup, so it can fail on its own
 * (e.g. tier 403) while the profile still succeeds — the response then
 * carries profile available + timeline unavailable with its own reason.
 * Without include=timeline the response is profile-only (the W2 shape).
 *
 * NOTE: the free X API tier may not include user lookup at all; if the
 * app is on free tier the route reports the 403 it gets back verbatim
 * (reason "forbidden"). The same applies to the timeline endpoint.
 */

const USER_FIELDS = "created_at,public_metrics,verified,description,profile_image_url,protected";
const TWEET_FIELDS = "created_at,public_metrics";
const HANDLE_RE = /^[A-Za-z0-9_]{1,15}$/;

/** Normalize one X API v2 user object. Returns null when unusable. */
export function normalizeXUserResponse(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const u = data;
  if (typeof u.username !== "string" || !u.username) return null;
  const m = (u.public_metrics && typeof u.public_metrics === "object" ? u.public_metrics : {});
  const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  return {
    handle: u.username,
    name: typeof u.name === "string" ? u.name : null,
    description: typeof u.description === "string" ? u.description : null,
    followers: num(m.followers_count),
    following: num(m.following_count),
    tweetCount: num(m.tweet_count),
    listed: num(m.listed_count),
    createdAt: typeof u.created_at === "string" ? u.created_at : null,
    verified: u.verified === true,
    protected: u.protected === true,
    profileImageUrl: typeof u.profile_image_url === "string" ? u.profile_image_url : null,
  };
}

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

/** Normalize one X API v2 tweet object. Returns null when unusable. */
export function normalizeXTweetResponse(t) {
  if (!t || typeof t !== "object" || Array.isArray(t)) return null;
  if (typeof t.id !== "string" || !t.id) return null;
  if (typeof t.text !== "string") return null;
  const m = (t.public_metrics && typeof t.public_metrics === "object" ? t.public_metrics : {});
  const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  return {
    id: t.id,
    text: t.text,
    createdAt: typeof t.created_at === "string" ? t.created_at : null,
    likeCount: num(m.like_count),
    repostCount: num(m.retweet_count),
    replyCount: num(m.reply_count),
  };
}

/**
 * Normalize an X API v2 user-tweets response ({ data: [...] }) into an
 * array of posts. Returns null when the payload has no usable data array.
 * An empty array is a REAL state (account with no recent tweets) — it is
 * returned as [], not null. Never invents a count.
 */
export function normalizeXTweetsResponse(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  if (!Array.isArray(data.data)) return null;
  return data.data.map(normalizeXTweetResponse).filter(Boolean);
}

function unavailable(res, reason, detail, extra = {}) {
  return send(res, 200, {
    ok: false,
    status: "unavailable",
    source: "x_api_v2",
    reason,
    detail,
    fetchedAt: new Date().toISOString(),
    ...extra,
  });
}

export default async function handler(req, res) {
  const handle = String(req.query?.handle || req.query?.username || "").replace(/^@/, "").trim();
  const wantTimeline = String(req.query?.include || "") === "timeline";
  if (!HANDLE_RE.test(handle)) {
    return send(res, 400, {
      ok: false,
      status: "unavailable",
      reason: "invalid_handle",
      detail: "Pass ?handle=<x-handle> (1-15 chars, letters/numbers/underscore).",
      fetchedAt: new Date().toISOString(),
    });
  }

  const bearer = process.env.TWITTER_BEARER_TOKEN || process.env.X_BEARER_TOKEN || "";
  if (!bearer) {
    const body = {
      ok: false,
      status: "unavailable",
      source: "x_api_v2",
      reason: "no_bearer_token",
      detail:
        "No X app Bearer token is configured on the server (env TWITTER_BEARER_TOKEN). " +
        "Follower counts and account age need the X API v2 user lookup, which requires one. " +
        "Set the token in Vercel env vars — never in code.",
      fetchedAt: new Date().toISOString(),
    };
    if (wantTimeline) {
      body.timeline = {
        status: "unavailable",
        reason: "no_bearer_token",
        detail:
          "The linked account's past posts need the same X Bearer token as the profile lookup — it is not configured.",
      };
    }
    return send(res, 200, body);
  }

  let apiRes;
  try {
    // AbortSignal.timeout is missing in some test runtimes (jsdom) — guard it.
    const signal =
      typeof AbortSignal.timeout === "function" ? AbortSignal.timeout(10000) : undefined;
    apiRes = await fetch(
      `https://api.twitter.com/2/users/by/username/${encodeURIComponent(handle)}?user.fields=${USER_FIELDS}`,
      {
        headers: { Authorization: `Bearer ${bearer}` },
        signal,
      },
    );
  } catch (e) {
    return unavailable(res, "proxy_error", `X API request failed: ${String((e && e.message) || e).slice(0, 120)}`);
  }

  if (!apiRes.ok) {
    if (apiRes.status === 404) {
      return unavailable(res, "account_not_found", `No X account exists for @${handle}.`);
    }
    if (apiRes.status === 401) {
      return unavailable(res, "bearer_invalid", "The configured X Bearer token was rejected (401). Check TWITTER_BEARER_TOKEN in Vercel env.");
    }
    if (apiRes.status === 403) {
      return unavailable(
        res,
        "forbidden",
        "X API returned 403 — this usually means the app tier does not include user lookup, or the token lacks access.",
      );
    }
    if (apiRes.status === 429) {
      return unavailable(res, "rate_limited", "X API rate limit hit (429). Try again shortly.");
    }
    return unavailable(res, "proxy_error", `X API returned HTTP ${apiRes.status}.`);
  }

  let body = null;
  try {
    body = await apiRes.json();
  } catch {
    return unavailable(res, "proxy_error", "X API returned a response that could not be parsed.");
  }
  const profile = normalizeXUserResponse(body && body.data);
  if (!profile) {
    return unavailable(res, "proxy_error", "X API returned no user for this handle.");
  }
  const out = {
    ok: true,
    status: "available",
    source: "x_api_v2",
    fetchedAt: new Date().toISOString(),
    profile,
  };
  if (!wantTimeline) return send(res, 200, out);

  // Timeline: a second, independent X call. Its failure never takes the
  // profile down with it — it is reported as its own unavailable state.
  let tlRes;
  try {
    const signal =
      typeof AbortSignal.timeout === "function" ? AbortSignal.timeout(10000) : undefined;
    tlRes = await fetch(
      `https://api.twitter.com/2/users/by/username/${encodeURIComponent(handle)}/tweets?max_results=10&tweet.fields=${TWEET_FIELDS}`,
      { headers: { Authorization: `Bearer ${bearer}` }, signal },
    );
  } catch (e) {
    out.timeline = {
      status: "unavailable",
      reason: "proxy_error",
      detail: `X timeline request failed: ${String((e && e.message) || e).slice(0, 120)}`,
    };
    return send(res, 200, out);
  }
  if (!tlRes.ok) {
    out.timeline = {
      status: "unavailable",
      reason:
        tlRes.status === 404
          ? "account_not_found"
          : tlRes.status === 401
            ? "bearer_invalid"
            : tlRes.status === 403
              ? "forbidden"
              : tlRes.status === 429
                ? "rate_limited"
                : "proxy_error",
      detail:
        tlRes.status === 403
          ? "X API returned 403 for the timeline lookup — this usually means the app tier does not include user tweet timelines, or the token lacks access."
          : `X timeline lookup returned HTTP ${tlRes.status}.`,
    };
    return send(res, 200, out);
  }
  let tlBody = null;
  try {
    tlBody = await tlRes.json();
  } catch {
    out.timeline = {
      status: "unavailable",
      reason: "proxy_error",
      detail: "X API returned a timeline response that could not be parsed.",
    };
    return send(res, 200, out);
  }
  const posts = normalizeXTweetsResponse(tlBody);
  if (posts === null) {
    out.timeline = {
      status: "unavailable",
      reason: "proxy_error",
      detail: "X API returned a timeline payload with no usable tweets array.",
    };
    return send(res, 200, out);
  }
  out.timeline = { status: "available", handle, posts };
  return send(res, 200, out);
}

/**
 * HOOKUP (coordinator — do NOT add a standalone api/ file; Vercel Hobby
 * caps at 12 functions, currently 8/12):
 *   1. web/api/web.js — add to LAZY:
 *        "xsocial": () => import("./_xsocial.js"),
 *   2. web/vercel.json — add a rewrite (near the other /api/web rewrites):
 *        { "source": "/api/xsocial", "destination": "/api/web?path=xsocial" }
 *      The client calls /api/web?path=xsocial&handle=... directly, so the
 *      rewrite is optional convenience; the LAZY entry is required.
 *   2b. Timeline: the client asks for past posts with
 *        /api/web?path=xsocial&handle=<h>&include=timeline
 *      (adds a second X call for the user's 10 most recent tweets).
 *   3. Vercel env (Production + Preview): TWITTER_BEARER_TOKEN = the X
 *      app's Bearer token (X developer portal > app > Keys and tokens).
 *      Without it the route returns reason "no_bearer_token" and the UI
 *      shows the profile signals as Unavailable.
 */

/**
 * post-to-x — Supabase Edge Function
 * Posts a tweet on behalf of an authenticated OG Scan user.
 *
 * Priority:
 *  1. User has OAuth 2.0 token in profiles → tweets as themselves
 *  2. Fallback: OAuth 1.0a app-owner tokens → from OG Scan official account
 *
 * Body: {
 *   text: string;
 *   imageUrl?: string | null;      -- direct image URL to upload & attach
 *   videoUrl?: string | null;      -- direct video URL to upload & attach (chunked)
 *   linkUrl?: string | null;       -- link to append to tweet text
 *   youtubeUrl?: string | null;    -- YouTube link to append
 *   chartUrl?: string | null;      -- chart/DexScreener link to append
 * }
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const TWITTER_CLIENT_ID = Deno.env.get("TWITTER_CLIENT_ID") ?? "";
const TWITTER_CLIENT_SECRET = Deno.env.get("TWITTER_CLIENT_SECRET") ?? "";
const TWITTER_ACCESS_TOKEN = Deno.env.get("TWITTER_ACCESS_TOKEN") ?? "";
const TWITTER_ACCESS_TOKEN_SECRET = Deno.env.get("TWITTER_ACCESS_TOKEN_SECRET") ?? "";
const TWITTER_CONSUMER_KEY = Deno.env.get("TWITTER_CONSUMER_KEY") ?? "";
const TWITTER_CONSUMER_SECRET = Deno.env.get("TWITTER_CONSUMER_SECRET") ?? "";

const CORS = {
  "Access-Control-Allow-Origin": "https://ogscan.fun",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    // Verify JWT
    const supabaseAnon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data: { user }, error: authErr } = await supabaseAnon.auth.getUser(
      authHeader.replace("Bearer ", ""),
    );
    if (authErr || !user) return json({ error: "Invalid token" }, 401);

    const body = await req.json();
    const rawText: string = body.text?.trim() ?? "";
    const imageUrl: string | null = body.imageUrl ?? null;
    const videoUrl: string | null = body.videoUrl ?? null;
    const linkUrl: string | null = body.linkUrl ?? null;
    const youtubeUrl: string | null = body.youtubeUrl ?? null;
    const chartUrl: string | null = body.chartUrl ?? null;

    if (!rawText) return json({ error: "No text provided" }, 400);

    // Build full tweet text: body + appended links (max 280 chars, links ~23 chars each per Twitter t.co)
    const appendLinks: string[] = [];
    if (linkUrl) appendLinks.push(linkUrl);
    if (youtubeUrl) appendLinks.push(youtubeUrl);
    if (chartUrl) appendLinks.push(chartUrl);

    // Reserve ~24 chars per link URL (t.co wraps all URLs to ~23 chars)
    const reservedForLinks = appendLinks.length * 24;
    const maxBodyLen = 280 - reservedForLinks - (appendLinks.length > 0 ? appendLinks.length : 0);
    let tweetText = rawText.slice(0, Math.max(maxBodyLen, 50));
    if (appendLinks.length > 0) {
      tweetText = tweetText + "\n" + appendLinks.join("\n");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // ── Path 1: user has their own X OAuth2 token ─────────────────────────────
    const { data: profile } = await supabase
      .from("profiles")
      .select("twitter_access_token, twitter_refresh_token, twitter_token_expires_at, username")
      .eq("user_id", user.id)
      .maybeSingle();

    if (profile?.twitter_access_token) {
      let accessToken = profile.twitter_access_token as string;

      // Refresh if expired
      const expiresAt = profile.twitter_token_expires_at as string | null;
      if (expiresAt && new Date(expiresAt) < new Date()) {
        const refreshToken = profile.twitter_refresh_token as string | null;
        if (!refreshToken) return json({ error: "X token expired. Reconnect in Settings." }, 403);

        const refreshed = await refreshOAuth2Token(refreshToken);
        if (!refreshed) return json({ error: "Could not refresh X token." }, 403);

        accessToken = refreshed.access_token;
        await supabase.from("profiles").update({
          twitter_access_token: refreshed.access_token,
          twitter_refresh_token: refreshed.refresh_token ?? refreshToken,
          twitter_token_expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
        }).eq("user_id", user.id);
      }

      // Upload media (image or video) using OAuth1a app credentials (v1.1 media upload requires user context or app-level OAuth1a)
      // We use app OAuth1a for media upload, then attach the media_id to the OAuth2 user tweet
      let mediaId: string | null = null;
      if (imageUrl || videoUrl) {
        try {
          if (imageUrl) {
            mediaId = await uploadImageOAuth1a(imageUrl);
          } else if (videoUrl) {
            mediaId = await uploadVideoOAuth1a(videoUrl);
          }
        } catch (mediaErr) {
          console.error("Media upload failed:", mediaErr);
          // Continue without media rather than failing the whole tweet
        }
      }

      const result = await postTweetOAuth2(accessToken, tweetText, mediaId);
      return json(result);
    }

    // ── Path 2: fallback — OAuth 1.0a from OG Scan official account ───────────
    if (TWITTER_ACCESS_TOKEN && TWITTER_ACCESS_TOKEN_SECRET) {
      const displayName = (profile?.username as string) ?? "an OG Scan user";
      // For fallback account, truncate text to fit attribution
      const attribution = `\n\n— @${displayName} on ogscan.fun`;
      const reservedForAttr = attribution.length;
      const reservedTotal = reservedForLinks + reservedForAttr;
      const maxBody = 280 - reservedTotal - (appendLinks.length > 0 ? appendLinks.length : 0);
      let fallbackText = rawText.slice(0, Math.max(maxBody, 30)) + attribution;
      if (appendLinks.length > 0) {
        fallbackText = fallbackText + "\n" + appendLinks.join("\n");
      }

      // Upload media if provided
      let mediaId: string | null = null;
      if (imageUrl || videoUrl) {
        try {
          if (imageUrl) {
            mediaId = await uploadImageOAuth1a(imageUrl);
          } else if (videoUrl) {
            mediaId = await uploadVideoOAuth1a(videoUrl);
          }
        } catch (mediaErr) {
          console.error("Media upload failed (fallback):", mediaErr);
        }
      }

      const result = await postTweetOAuth1a(fallbackText, mediaId);
      return json({ ...result, mode: "official_account" });
    }

    return json({ error: "X not connected. Go to Settings → Connections." }, 403);

  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("post-to-x error:", msg);
    return json({ error: msg }, 500);
  }
});

// ── OAuth 2.0 tweet ────────────────────────────────────────────────────────────

async function postTweetOAuth2(accessToken: string, text: string, mediaId: string | null) {
  const body: Record<string, unknown> = { text };
  if (mediaId) {
    body.media = { media_ids: [mediaId] };
  }

  const res = await fetch("https://api.twitter.com/2/tweets", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Twitter API: ${JSON.stringify(err)}`);
  }

  const data = await res.json();
  const tweetId = data?.data?.id as string | undefined;
  return {
    ok: true,
    tweetId: tweetId ?? null,
    tweetUrl: tweetId ? `https://x.com/i/web/status/${tweetId}` : null,
  };
}

// ── OAuth 1.0a tweet ───────────────────────────────────────────────────────────

async function postTweetOAuth1a(text: string, mediaId: string | null) {
  const method = "POST";
  const url = "https://api.twitter.com/2/tweets";

  const oauthParams: Record<string, string> = {
    oauth_consumer_key: TWITTER_CONSUMER_KEY,
    oauth_nonce: crypto.randomUUID().replace(/-/g, ""),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: TWITTER_ACCESS_TOKEN,
    oauth_version: "1.0",
  };

  const signature = await buildHMACSHA1Signature(method, url, oauthParams, {}, TWITTER_CONSUMER_SECRET, TWITTER_ACCESS_TOKEN_SECRET);
  oauthParams.oauth_signature = signature;

  const authHeader =
    "OAuth " +
    Object.entries(oauthParams)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${pct(k)}="${pct(v)}"`)
      .join(", ");

  const tweetBody: Record<string, unknown> = { text };
  if (mediaId) {
    tweetBody.media = { media_ids: [mediaId] };
  }

  const res = await fetch(url, {
    method,
    headers: {
      Authorization: authHeader,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(tweetBody),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Twitter 1.0a: ${JSON.stringify(err)}`);
  }

  const data = await res.json();
  const tweetId = data?.data?.id as string | undefined;
  return {
    ok: true,
    tweetId: tweetId ?? null,
    tweetUrl: tweetId ? `https://x.com/i/web/status/${tweetId}` : null,
  };
}

// ── Media upload (image) via OAuth 1.0a ────────────────────────────────────────
// Uses Twitter v1.1 media/upload — SIMPLE upload for images <5MB

async function uploadImageOAuth1a(imageUrl: string): Promise<string> {
  // Download the image
  const imgRes = await fetch(imageUrl);
  if (!imgRes.ok) throw new Error(`Could not fetch image: ${imgRes.status}`);
  const imgBuffer = await imgRes.arrayBuffer();
  const contentType = imgRes.headers.get("content-type") || "image/jpeg";

  // Check size — Twitter image limit is 5MB
  if (imgBuffer.byteLength > 5 * 1024 * 1024) {
    throw new Error("Image exceeds 5MB Twitter limit");
  }

  const url = "https://upload.twitter.com/1.1/media/upload.json";
  const method = "POST";

  // Build multipart form
  const formData = new FormData();
  formData.append("media", new Blob([imgBuffer], { type: contentType }), "media");
  formData.append("media_category", "tweet_image");

  const oauthParams = buildOAuthParams();
  const signature = await buildHMACSHA1Signature(method, url, oauthParams, {}, TWITTER_CONSUMER_SECRET, TWITTER_ACCESS_TOKEN_SECRET);
  oauthParams.oauth_signature = signature;

  const res = await fetch(url, {
    method,
    headers: { Authorization: buildOAuthHeader(oauthParams) },
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Media upload failed: ${JSON.stringify(err)}`);
  }

  const data = await res.json();
  const mediaId = data?.media_id_string as string | undefined;
  if (!mediaId) throw new Error("No media_id returned from Twitter");
  return mediaId;
}

// ── Media upload (video) via OAuth 1.0a ────────────────────────────────────────
// Uses Twitter v1.1 chunked upload (INIT → APPEND → FINALIZE → STATUS poll)

async function uploadVideoOAuth1a(videoUrl: string): Promise<string> {
  // Download the video
  const vidRes = await fetch(videoUrl);
  if (!vidRes.ok) throw new Error(`Could not fetch video: ${vidRes.status}`);
  const vidBuffer = await vidRes.arrayBuffer();
  const contentType = vidRes.headers.get("content-type") || "video/mp4";

  // Twitter video limit: 512MB for async, 15MB for sync — we'll use async chunked
  const totalBytes = vidBuffer.byteLength;
  const uploadUrl = "https://upload.twitter.com/1.1/media/upload.json";

  // Helper to make OAuth1a signed request
  const signedRequest = async (method: string, url: string, params: Record<string, string>, body?: BodyInit, bodyContentType?: string) => {
    const oauthParams = buildOAuthParams();
    const signature = await buildHMACSHA1Signature(method, url, oauthParams, {}, TWITTER_CONSUMER_SECRET, TWITTER_ACCESS_TOKEN_SECRET);
    oauthParams.oauth_signature = signature;
    return fetch(url, {
      method,
      headers: {
        Authorization: buildOAuthHeader(oauthParams),
        ...(bodyContentType ? { "Content-Type": bodyContentType } : {}),
      },
      body,
    });
  };

  // INIT
  const initRes = await signedRequest(
    "POST",
    uploadUrl,
    {},
    new URLSearchParams({
      command: "INIT",
      total_bytes: totalBytes.toString(),
      media_type: contentType,
      media_category: "tweet_video",
    }).toString(),
    "application/x-www-form-urlencoded",
  );
  if (!initRes.ok) {
    const err = await initRes.json().catch(() => ({}));
    throw new Error(`Video INIT failed: ${JSON.stringify(err)}`);
  }
  const initData = await initRes.json();
  const mediaId = initData?.media_id_string as string;
  if (!mediaId) throw new Error("No media_id from INIT");

  // APPEND — 5MB chunks
  const CHUNK_SIZE = 5 * 1024 * 1024;
  let segmentIndex = 0;
  let offset = 0;
  while (offset < totalBytes) {
    const chunk = vidBuffer.slice(offset, offset + CHUNK_SIZE);
    const formData = new FormData();
    formData.append("command", "APPEND");
    formData.append("media_id", mediaId);
    formData.append("segment_index", segmentIndex.toString());
    formData.append("media", new Blob([chunk], { type: contentType }), "chunk");

    const appendRes = await signedRequest("POST", uploadUrl, {}, formData);
    if (!appendRes.ok) {
      const err = await appendRes.json().catch(() => ({}));
      throw new Error(`Video APPEND failed (segment ${segmentIndex}): ${JSON.stringify(err)}`);
    }
    offset += CHUNK_SIZE;
    segmentIndex++;
  }

  // FINALIZE
  const finalizeRes = await signedRequest(
    "POST",
    uploadUrl,
    {},
    new URLSearchParams({ command: "FINALIZE", media_id: mediaId }).toString(),
    "application/x-www-form-urlencoded",
  );
  if (!finalizeRes.ok) {
    const err = await finalizeRes.json().catch(() => ({}));
    throw new Error(`Video FINALIZE failed: ${JSON.stringify(err)}`);
  }
  const finalizeData = await finalizeRes.json();

  // Poll STATUS if processing is pending
  if (finalizeData?.processing_info?.state === "pending" || finalizeData?.processing_info?.state === "in_progress") {
    await pollMediaStatus(mediaId, signedRequest, uploadUrl);
  }

  return mediaId;
}

async function pollMediaStatus(
  mediaId: string,
  signedRequest: (method: string, url: string, params: Record<string, string>, body?: BodyInit, bodyContentType?: string) => Promise<Response>,
  uploadUrl: string,
  maxAttempts = 20,
): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    await sleep(3000);
    const statusUrl = `${uploadUrl}?command=STATUS&media_id=${mediaId}`;
    const oauthParams = buildOAuthParams();
    const signature = await buildHMACSHA1Signature("GET", uploadUrl, { ...oauthParams, command: "STATUS", media_id: mediaId }, {}, TWITTER_CONSUMER_SECRET, TWITTER_ACCESS_TOKEN_SECRET);
    oauthParams.oauth_signature = signature;

    const statusRes = await fetch(statusUrl, {
      headers: { Authorization: buildOAuthHeader(oauthParams) },
    });
    if (!statusRes.ok) continue;

    const statusData = await statusRes.json();
    const state = statusData?.processing_info?.state;
    if (state === "succeeded") return;
    if (state === "failed") {
      throw new Error(`Video processing failed: ${JSON.stringify(statusData?.processing_info?.error)}`);
    }
    // state === "in_progress" → keep polling
  }
  throw new Error("Video processing timed out");
}

// ── OAuth 1.0a helpers ─────────────────────────────────────────────────────────

function buildOAuthParams(): Record<string, string> {
  return {
    oauth_consumer_key: TWITTER_CONSUMER_KEY,
    oauth_nonce: crypto.randomUUID().replace(/-/g, ""),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: TWITTER_ACCESS_TOKEN,
    oauth_version: "1.0",
  };
}

function buildOAuthHeader(oauthParams: Record<string, string>): string {
  return (
    "OAuth " +
    Object.entries(oauthParams)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${pct(k)}="${pct(v)}"`)
      .join(", ")
  );
}

async function buildHMACSHA1Signature(
  method: string,
  url: string,
  oauthParams: Record<string, string>,
  bodyParams: Record<string, string>,
  consumerSecret: string,
  tokenSecret: string,
): Promise<string> {
  const allParams = { ...oauthParams, ...bodyParams };
  const sortedParams = Object.entries(allParams)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${pct(k)}=${pct(v)}`)
    .join("&");

  const base = `${method.toUpperCase()}&${pct(url)}&${pct(sortedParams)}`;
  const signingKey = `${pct(consumerSecret)}&${pct(tokenSecret)}`;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(signingKey),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(base));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

function pct(s: string) {
  return encodeURIComponent(s);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── OAuth 2.0 token refresh ────────────────────────────────────────────────────

async function refreshOAuth2Token(refreshToken: string) {
  const res = await fetch("https://api.twitter.com/2/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${btoa(`${TWITTER_CLIENT_ID}:${TWITTER_CLIENT_SECRET}`)}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: TWITTER_CLIENT_ID,
    }),
  });
  if (!res.ok) return null;
  return res.json() as Promise<{ access_token: string; refresh_token?: string; expires_in: number }>;
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

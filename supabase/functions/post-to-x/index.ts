/**
 * post-to-x — Supabase Edge Function
 * Posts a tweet on behalf of an authenticated OG Scan user.
 *
 * Posts ONLY as the authenticated user's connected X account.
 * Never falls back to the platform TWITTER_ACCESS_TOKEN.
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

const ALLOWED_ORIGINS = ["https://ogscan.fun", "https://www.ogscan.fun", "https://orbitx.world", "https://www.orbitx.world"];
function corsFor(origin: string | null) {
  const o = origin && ALLOWED_ORIGINS.includes(origin) ? origin : "https://ogscan.fun";
  return {
    "Access-Control-Allow-Origin": o,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Vary": "Origin",
  };
}

serve(async (req) => {
  const cors = corsFor(req.headers.get("origin"));
  const json = makeJson(cors);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

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

      let mediaId: string | null = null;
      if (imageUrl || videoUrl) {
        try {
          if (imageUrl) {
            mediaId = await uploadImageOAuth2(accessToken, imageUrl);
          } else if (videoUrl) {
            mediaId = await uploadVideoOAuth2(accessToken, videoUrl);
          }
        } catch (mediaErr) {
          console.error("Media upload failed:", mediaErr);
        }
      }

      const result = await postTweetOAuth2(accessToken, tweetText, mediaId);
      return json(result);
    }

    return json({ error: "Connect your own X account. OrbitX will not post as the platform account." }, 403);

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

// ── Media upload with the caller's OAuth 2.0 user token ───────────────────────

function userAuth(accessToken: string) {
  if (!accessToken?.trim()) throw new Error("Connect your own X account. OrbitX will not post as the platform account.");
  return { Authorization: `Bearer ${accessToken}` };
}

async function uploadImageOAuth2(accessToken: string, imageUrl: string): Promise<string> {
  const imgRes = await fetch(imageUrl);
  if (!imgRes.ok) throw new Error(`Could not fetch image: ${imgRes.status}`);
  const imgBuffer = await imgRes.arrayBuffer();
  const contentType = imgRes.headers.get("content-type") || "image/jpeg";
  if (imgBuffer.byteLength > 5 * 1024 * 1024) throw new Error("Image exceeds 5MB Twitter limit");

  const formData = new FormData();
  formData.append("media", new Blob([imgBuffer], { type: contentType }), "media");
  formData.append("media_category", "tweet_image");
  const res = await fetch("https://upload.twitter.com/1.1/media/upload.json", {
    method: "POST",
    headers: userAuth(accessToken),
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

async function uploadVideoOAuth2(accessToken: string, videoUrl: string): Promise<string> {
  const vidRes = await fetch(videoUrl);
  if (!vidRes.ok) throw new Error(`Could not fetch video: ${vidRes.status}`);
  const vidBuffer = await vidRes.arrayBuffer();
  const contentType = vidRes.headers.get("content-type") || "video/mp4";
  const totalBytes = vidBuffer.byteLength;
  const uploadUrl = "https://upload.twitter.com/1.1/media/upload.json";
  const auth = userAuth(accessToken);

  const initRes = await fetch(uploadUrl, {
    method: "POST",
    headers: { ...auth, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      command: "INIT",
      total_bytes: totalBytes.toString(),
      media_type: contentType,
      media_category: "tweet_video",
    }).toString(),
  });
  if (!initRes.ok) {
    const err = await initRes.json().catch(() => ({}));
    throw new Error(`Video INIT failed: ${JSON.stringify(err)}`);
  }
  const mediaId = (await initRes.json())?.media_id_string as string;
  if (!mediaId) throw new Error("No media_id from INIT");

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
    const appendRes = await fetch(uploadUrl, { method: "POST", headers: auth, body: formData });
    if (!appendRes.ok) {
      const err = await appendRes.json().catch(() => ({}));
      throw new Error(`Video APPEND failed (segment ${segmentIndex}): ${JSON.stringify(err)}`);
    }
    offset += CHUNK_SIZE;
    segmentIndex++;
  }

  const finalizeRes = await fetch(uploadUrl, {
    method: "POST",
    headers: { ...auth, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ command: "FINALIZE", media_id: mediaId }).toString(),
  });
  if (!finalizeRes.ok) {
    const err = await finalizeRes.json().catch(() => ({}));
    throw new Error(`Video FINALIZE failed: ${JSON.stringify(err)}`);
  }
  const finalizeData = await finalizeRes.json();
  if (finalizeData?.processing_info?.state === "pending" || finalizeData?.processing_info?.state === "in_progress") {
    await pollMediaStatusOAuth2(accessToken, mediaId, uploadUrl);
  }
  return mediaId;
}

async function pollMediaStatusOAuth2(accessToken: string, mediaId: string, uploadUrl: string, maxAttempts = 20) {
  for (let i = 0; i < maxAttempts; i++) {
    await sleep(3000);
    const statusRes = await fetch(`${uploadUrl}?command=STATUS&media_id=${mediaId}`, {
      headers: userAuth(accessToken),
    });
    if (!statusRes.ok) continue;
    const statusData = await statusRes.json();
    const state = statusData?.processing_info?.state;
    if (state === "succeeded") return;
    if (state === "failed") {
      throw new Error(`Video processing failed: ${JSON.stringify(statusData?.processing_info?.error)}`);
    }
  }
  throw new Error("Video processing timed out");
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

const makeJson = (cors: Record<string, string>) => (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

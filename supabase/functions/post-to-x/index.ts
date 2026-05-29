/**
 * post-to-x — Supabase Edge Function
 * Posts a tweet on behalf of an authenticated OG Scan user.
 *
 * Priority order for auth:
 *  1. User has completed X OAuth 2.0 PKCE flow → posts AS that user on their timeline
 *  2. Fallback: OAuth 1.0a app-owner tokens → posts from the OG Scan official account
 *     mentioning the user (until they connect their personal X account)
 *
 * Body: { text: string; imageUrl?: string; username?: string }
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { HmacSha256 } from "https://deno.land/std@0.177.0/hash/sha256.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const TWITTER_CLIENT_ID = Deno.env.get("TWITTER_CLIENT_ID")!;
const TWITTER_CLIENT_SECRET = Deno.env.get("TWITTER_CLIENT_SECRET")!;
// OAuth 1.0a app-owner tokens (fallback — posts from official OG Scan account)
const TWITTER_CONSUMER_KEY = Deno.env.get("TWITTER_CONSUMER_KEY") || "";
const TWITTER_CONSUMER_SECRET = Deno.env.get("TWITTER_CONSUMER_SECRET") || "";
const TWITTER_ACCESS_TOKEN = Deno.env.get("TWITTER_ACCESS_TOKEN") || "";
const TWITTER_ACCESS_TOKEN_SECRET = Deno.env.get("TWITTER_ACCESS_TOKEN_SECRET") || "";
// App-level bearer for read ops
const X_BEARER_TOKEN = Deno.env.get("X_BEARER_TOKEN") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    // Verify JWT and get user
    const supabaseAnon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data: { user }, error: authErr } = await supabaseAnon.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authErr || !user) return json({ error: "Invalid token" }, 401);

    const { text, imageUrl, username } = await req.json();
    if (!text?.trim()) return json({ error: "No text provided" }, 400);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // ── Path 1: user has their own X OAuth2 token → post as THEM ──────────────
    const { data: profile } = await supabase
      .from("profiles")
      .select("twitter_access_token, twitter_refresh_token, twitter_token_expires_at, username")
      .eq("user_id", user.id)
      .maybeSingle();

    if (profile?.twitter_access_token) {
      let accessToken = profile.twitter_access_token;

      // Refresh if expired
      if (profile.twitter_token_expires_at && new Date(profile.twitter_token_expires_at) < new Date()) {
        if (!profile.twitter_refresh_token) {
          return json({ error: "X token expired. Reconnect in Settings." }, 403);
        }
        const refreshed = await refreshOAuth2Token(profile.twitter_refresh_token);
        if (!refreshed) return json({ error: "Could not refresh X token." }, 403);
        accessToken = refreshed.access_token;
        const expiresAt = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
        await supabase.from("profiles").update({
          twitter_access_token: refreshed.access_token,
          twitter_refresh_token: refreshed.refresh_token ?? profile.twitter_refresh_token,
          twitter_token_expires_at: expiresAt,
        }).eq("user_id", user.id);
      }

      const result = await postTweetOAuth2(accessToken, text.trim().slice(0, 280), imageUrl);
      return json(result);
    }

    // ── Path 2: fallback — post from official OG Scan account ─────────────────
    if (TWITTER_ACCESS_TOKEN && TWITTER_ACCESS_TOKEN_SECRET) {
      const displayName = profile?.username || username || "an OG Scan user";
      const tweetText = `${text.trim().slice(0, 230)}\n\n— @${displayName} on https://ogscan.fun`;
      const result = await postTweetOAuth1a(tweetText.slice(0, 280), imageUrl);
      return json({ ...result, mode: "official_account" });
    }

    return json({ error: "X not connected. Connect your X account in Settings → Connections." }, 403);

  } catch (e: any) {
    console.error("post-to-x error:", e);
    return json({ error: e.message }, 500);
  }
});

// ── OAuth 2.0 tweet ───────────────────────────────────────────────────────────

async function postTweetOAuth2(accessToken: string, text: string, imageUrl?: string) {
  const body: Record<string, unknown> = { text };

  if (imageUrl) {
    try {
      const mediaId = await uploadMediaV1(accessToken, imageUrl, "oauth2");
      if (mediaId) body.media = { media_ids: [mediaId] };
    } catch (e) {
      console.warn("Media upload failed:", e);
    }
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
    throw new Error(`Twitter API error: ${JSON.stringify(err)}`);
  }

  const data = await res.json();
  const tweetId = data?.data?.id;
  return { ok: true, tweetId, tweetUrl: tweetId ? `https://x.com/i/web/status/${tweetId}` : null };
}

// ── OAuth 1.0a tweet ──────────────────────────────────────────────────────────

async function postTweetOAuth1a(text: string, imageUrl?: string) {
  const url = "https://api.twitter.com/2/tweets";
  const method = "POST";

  const oauthParams: Record<string, string> = {
    oauth_consumer_key: TWITTER_CONSUMER_KEY || TWITTER_ACCESS_TOKEN.split("-")[0] || "",
    oauth_nonce: crypto.randomUUID().replace(/-/g, ""),
    oauth_signature_method: "HMAC-SHA256",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: TWITTER_ACCESS_TOKEN,
    oauth_version: "1.0",
  };

  const signature = await buildOAuth1Signature(method, url, oauthParams, {});
  oauthParams.oauth_signature = signature;

  const authHeader = "OAuth " + Object.entries(oauthParams)
    .map(([k, v]) => `${encodeURIComponent(k)}="${encodeURIComponent(v)}"`)
    .join(", ");

  const res = await fetch(url, {
    method,
    headers: {
      Authorization: authHeader,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    console.error("OAuth1a tweet error:", err);
    throw new Error(`Twitter 1.0a error: ${JSON.stringify(err)}`);
  }

  const data = await res.json();
  const tweetId = data?.data?.id;
  return { ok: true, tweetId, tweetUrl: tweetId ? `https://x.com/i/web/status/${tweetId}` : null };
}

async function buildOAuth1Signature(
  method: string,
  url: string,
  oauthParams: Record<string, string>,
  bodyParams: Record<string, string>,
): Promise<string> {
  const allParams = { ...oauthParams, ...bodyParams };
  const sortedParams = Object.entries(allParams)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");

  const signatureBase = [
    method.toUpperCase(),
    encodeURIComponent(url),
    encodeURIComponent(sortedParams),
  ].join("&");

  const signingKey = `${encodeURIComponent(TWITTER_CONSUMER_SECRET || "")}&${encodeURIComponent(TWITTER_ACCESS_TOKEN_SECRET)}`;

  const keyData = new TextEncoder().encode(signingKey);
  const msgData = new TextEncoder().encode(signatureBase);

  const cryptoKey = await crypto.subtle.importKey(
    "raw", keyData, { name: "HMAC", hash: "SHA-1" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, msgData);
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

// ── OAuth 2.0 token refresh ───────────────────────────────────────────────────

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
  return res.json();
}

// ── Media upload helper ───────────────────────────────────────────────────────

async function uploadMediaV1(token: string, imageUrl: string, _mode: string): Promise<string | null> {
  const imgRes = await fetch(imageUrl);
  if (!imgRes.ok) return null;
  const blob = await imgRes.blob();
  const form = new FormData();
  form.append("media", blob);
  const res = await fetch("https://upload.twitter.com/1.1/media/upload.json", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.media_id_string ?? null;
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

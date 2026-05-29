/**
 * post-to-x — Supabase Edge Function
 * Posts a tweet on behalf of an authenticated OG Scan user.
 *
 * Priority:
 *  1. User has OAuth 2.0 token in profiles → tweets as themselves
 *  2. Fallback: OAuth 1.0a app-owner tokens → from OG Scan official account
 *
 * Body: { text: string; imageUrl?: string }
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

const CORS = {
  "Access-Control-Allow-Origin": "*",
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
    const text: string = body.text?.trim() ?? "";
    const imageUrl: string | null = body.imageUrl ?? null;

    if (!text) return json({ error: "No text provided" }, 400);

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

      const result = await postTweetOAuth2(accessToken, text.slice(0, 280));
      return json(result);
    }

    // ── Path 2: fallback — OAuth 1.0a from OG Scan official account ───────────
    if (TWITTER_ACCESS_TOKEN && TWITTER_ACCESS_TOKEN_SECRET) {
      const displayName = (profile?.username as string) ?? "an OG Scan user";
      const fallbackText = `${text.slice(0, 230)}\n\n— @${displayName} on ogscan.fun`.slice(0, 280);
      const result = await postTweetOAuth1a(fallbackText);
      return json({ ...result, mode: "official_account" });
    }

    return json({ error: "X not connected. Go to Settings → Connections." }, 403);

  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("post-to-x error:", msg);
    return json({ error: msg }, 500);
  }
});

// ── OAuth 2.0 ──────────────────────────────────────────────────────────────────

async function postTweetOAuth2(accessToken: string, text: string) {
  const res = await fetch("https://api.twitter.com/2/tweets", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text }),
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

// ── OAuth 1.0a ─────────────────────────────────────────────────────────────────

async function postTweetOAuth1a(text: string) {
  const method = "POST";
  const url = "https://api.twitter.com/2/tweets";

  // Consumer key is embedded in the access token for OAuth1a user-context
  // Twitter's v2 with OAuth1a user context requires consumer key/secret separately
  // We use the access token itself as identification
  const oauthParams: Record<string, string> = {
    oauth_consumer_key: Deno.env.get("TWITTER_CONSUMER_KEY") ?? TWITTER_ACCESS_TOKEN.split("-")[0] ?? "",
    oauth_nonce: crypto.randomUUID().replace(/-/g, ""),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: TWITTER_ACCESS_TOKEN,
    oauth_version: "1.0",
  };

  const consumerSecret = Deno.env.get("TWITTER_CONSUMER_SECRET") ?? "";
  const signature = await buildHMACSHA1Signature(method, url, oauthParams, {}, consumerSecret, TWITTER_ACCESS_TOKEN_SECRET);
  oauthParams.oauth_signature = signature;

  const authHeader =
    "OAuth " +
    Object.entries(oauthParams)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${pct(k)}="${pct(v)}"`)
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

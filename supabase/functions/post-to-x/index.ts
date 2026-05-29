/**
 * post-to-x — Supabase Edge Function
 * Posts a tweet on behalf of an authenticated OG Scan user.
 *
 * Requires the user to have completed the X OAuth 2.0 PKCE flow
 * (stored as twitter_access_token + twitter_refresh_token in the profiles table).
 *
 * Body: { text: string; imageUrl?: string }
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TWITTER_CLIENT_ID = Deno.env.get("TWITTER_CLIENT_ID")!;
const TWITTER_CLIENT_SECRET = Deno.env.get("TWITTER_CLIENT_SECRET")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // Verify Supabase JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: { user }, error: authErr } = await createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!).auth.getUser(authHeader.replace("Bearer ", ""));
    if (authErr || !user) return new Response(JSON.stringify({ error: "Invalid token" }), { status: 401, headers: corsHeaders });

    // Get stored Twitter token for this user
    const { data: profile } = await supabase
      .from("profiles")
      .select("twitter_access_token, twitter_refresh_token, twitter_token_expires_at")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!profile?.twitter_access_token) {
      return new Response(JSON.stringify({ error: "X not connected. Please connect X in Settings." }), { status: 403, headers: corsHeaders });
    }

    let accessToken = profile.twitter_access_token;

    // Refresh token if expired
    if (profile.twitter_token_expires_at && new Date(profile.twitter_token_expires_at) < new Date()) {
      if (!profile.twitter_refresh_token) {
        return new Response(JSON.stringify({ error: "X token expired. Please reconnect X in Settings." }), { status: 403, headers: corsHeaders });
      }
      const refreshed = await refreshTwitterToken(profile.twitter_refresh_token);
      if (!refreshed) {
        return new Response(JSON.stringify({ error: "Could not refresh X token. Please reconnect in Settings." }), { status: 403, headers: corsHeaders });
      }
      accessToken = refreshed.access_token;
      const expiresAt = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
      await supabase.from("profiles").update({
        twitter_access_token: refreshed.access_token,
        twitter_refresh_token: refreshed.refresh_token ?? profile.twitter_refresh_token,
        twitter_token_expires_at: expiresAt,
      }).eq("user_id", user.id);
    }

    const { text, imageUrl } = await req.json();
    if (!text?.trim()) return new Response(JSON.stringify({ error: "No text provided" }), { status: 400, headers: corsHeaders });

    // Post tweet via Twitter API v2
    const tweetBody: Record<string, unknown> = { text: text.trim().slice(0, 280) };

    // Upload image media if provided (Twitter v1.1 media upload — still required even with v2 tweets)
    if (imageUrl) {
      try {
        const mediaId = await uploadTwitterMedia(accessToken, imageUrl);
        if (mediaId) tweetBody.media = { media_ids: [mediaId] };
      } catch (e) {
        console.warn("Media upload failed, posting without image:", e);
      }
    }

    const tweetRes = await fetch("https://api.twitter.com/2/tweets", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(tweetBody),
    });

    if (!tweetRes.ok) {
      const err = await tweetRes.json();
      console.error("Twitter post error:", err);
      return new Response(JSON.stringify({ error: "Failed to post to X", details: err }), { status: 502, headers: corsHeaders });
    }

    const tweet = await tweetRes.json();
    const tweetId = tweet?.data?.id;
    const tweetUrl = tweetId ? `https://x.com/i/web/status/${tweetId}` : null;

    return new Response(JSON.stringify({ ok: true, tweetId, tweetUrl }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e: any) {
    console.error("post-to-x error:", e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
  }
});

async function refreshTwitterToken(refreshToken: string): Promise<{ access_token: string; refresh_token?: string; expires_in: number } | null> {
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

async function uploadTwitterMedia(accessToken: string, imageUrl: string): Promise<string | null> {
  const imgRes = await fetch(imageUrl);
  if (!imgRes.ok) return null;
  const blob = await imgRes.blob();
  const form = new FormData();
  form.append("media", blob);
  const res = await fetch("https://upload.twitter.com/1.1/media/upload.json", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    body: form,
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.media_id_string ?? null;
}

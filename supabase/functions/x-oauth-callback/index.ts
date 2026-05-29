/**
 * x-oauth-callback — Supabase Edge Function
 * Exchanges Twitter OAuth 2.0 PKCE authorization code for access + refresh tokens.
 * Also fetches the user's Twitter profile and stores tokens in the profiles table.
 *
 * Required Supabase secrets:
 *   TWITTER_CLIENT_ID     — OAuth 2.0 Client ID from developer.x.com
 *   TWITTER_CLIENT_SECRET — OAuth 2.0 Client Secret from developer.x.com
 *
 * Body: { code: string; verifier: string; redirectUri: string }
 * Response: { access_token, refresh_token, expires_in, twitter_id, twitter_username, twitter_name, twitter_avatar }
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const TWITTER_CLIENT_ID = Deno.env.get("TWITTER_CLIENT_ID")!;
const TWITTER_CLIENT_SECRET = Deno.env.get("TWITTER_CLIENT_SECRET")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // Optionally verify user JWT (some callers may be unauthenticated at callback time)
    const authHeader = req.headers.get("Authorization");
    let userId: string | null = null;

    if (authHeader) {
      const { data: { user } } = await createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
        .auth.getUser(authHeader.replace("Bearer ", ""));
      userId = user?.id ?? null;
    }

    const { code, verifier, redirectUri } = await req.json();
    if (!code || !verifier || !redirectUri) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400, headers: corsHeaders });
    }

    // Exchange code for tokens
    const tokenRes = await fetch("https://api.twitter.com/2/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${btoa(`${TWITTER_CLIENT_ID}:${TWITTER_CLIENT_SECRET}`)}`,
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        code_verifier: verifier,
        client_id: TWITTER_CLIENT_ID,
      }),
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.json();
      console.error("Twitter token exchange error:", err);
      return new Response(JSON.stringify({ error: "Token exchange failed", details: err }), { status: 502, headers: corsHeaders });
    }

    const tokens = await tokenRes.json();
    const { access_token, refresh_token, expires_in } = tokens;

    // Fetch Twitter user profile
    const userRes = await fetch("https://api.twitter.com/2/users/me?user.fields=profile_image_url,name,username", {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    let twitterId = "", twitterUsername = "", twitterName = "", twitterAvatar = "";
    if (userRes.ok) {
      const ud = await userRes.json();
      twitterId = ud.data?.id ?? "";
      twitterUsername = ud.data?.username ?? "";
      twitterName = ud.data?.name ?? "";
      twitterAvatar = ud.data?.profile_image_url?.replace("_normal", "") ?? "";
    }

    // Save tokens to profiles table if we have a user
    if (userId) {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      const expiresAt = expires_in ? new Date(Date.now() + expires_in * 1000).toISOString() : null;
      await supabase.from("profiles").update({
        twitter_access_token: access_token,
        twitter_refresh_token: refresh_token ?? null,
        twitter_token_expires_at: expiresAt,
        twitter_id: twitterId || null,
        twitter_username: twitterUsername || null,
        twitter_name: twitterName || null,
        twitter_avatar: twitterAvatar || null,
      }).eq("user_id", userId);
    }

    return new Response(JSON.stringify({
      access_token,
      refresh_token,
      expires_in,
      twitter_id: twitterId,
      twitter_username: twitterUsername,
      twitter_name: twitterName,
      twitter_avatar: twitterAvatar,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e: any) {
    console.error("x-oauth-callback error:", e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
  }
});

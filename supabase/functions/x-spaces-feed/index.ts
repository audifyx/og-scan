/**
 * x-spaces-feed — Supabase Edge Function
 * Returns live/upcoming X (Twitter) Spaces from accounts the authenticated user follows.
 *
 * Flow:
 *  1. Get user's twitter_id + twitter_access_token from profiles table
 *  2. Fetch who they follow via GET /2/users/:id/following
 *  3. Fetch live/upcoming spaces by those user IDs via GET /2/spaces/by/creator_ids
 *  4. Return enriched space objects with title, state, creator, listeners, join URL
 *
 * Required Supabase secrets:
 *   X_BEARER_TOKEN   — App-only bearer token for fallback/enrichment
 *   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / SUPABASE_ANON_KEY
 *
 * Response: { spaces: XSpace[] }
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const X_BEARER_TOKEN = Deno.env.get("X_BEARER_TOKEN") ?? "";

const CORS = {
  "Access-Control-Allow-Origin": "https://ogscan.fun",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    // ── 1. Authenticate user ─────────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const supabaseAnon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data: { user }, error: authErr } = await supabaseAnon.auth.getUser(
      authHeader.replace("Bearer ", ""),
    );
    if (authErr || !user) return json({ error: "Invalid token" }, 401);

    // ── 2. Get user's Twitter credentials from profiles ───────────────────────
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: profile } = await supabase
      .from("profiles")
      .select("twitter_id, twitter_access_token, twitter_username")
      .eq("user_id", user.id)
      .single();

    if (!profile?.twitter_id || !profile?.twitter_access_token) {
      return json({ spaces: [], requiresAuth: true, message: "Connect your X account to see X Spaces from people you follow." });
    }

    const userToken = profile.twitter_access_token;
    const twitterId = profile.twitter_id;

    // ── 3. Fetch who this user follows (up to 1000) ───────────────────────────
    // Use user's own OAuth 2.0 token so we see their personal follow list
    const followsRes = await fetch(
      `https://api.twitter.com/2/users/${twitterId}/following?max_results=1000&user.fields=id,username,name,profile_image_url`,
      { headers: { Authorization: `Bearer ${userToken}` } },
    );

    if (!followsRes.ok) {
      const errBody = await followsRes.json().catch(() => ({}));
      console.error("follows fetch error:", followsRes.status, errBody);
      // 403 = missing scope, return helpful message
      if (followsRes.status === 403) {
        return json({
          spaces: [],
          requiresReauth: true,
          message: "Re-connect your X account to grant the follows.read permission.",
        });
      }
      return json({ spaces: [], error: "Failed to fetch follows" }, 502);
    }

    const followsData = await followsRes.json();
    const followedUsers: { id: string; username: string; name: string; profile_image_url?: string }[] =
      followsData.data ?? [];

    if (!followedUsers.length) {
      return json({ spaces: [], message: "You don't follow anyone on X yet." });
    }

    // ── 4. Fetch live/upcoming spaces by those creator IDs ─────────────────────
    // X API allows up to 100 user IDs per request
    const creatorIds = followedUsers.map((u) => u.id).slice(0, 100);
    const spacesRes = await fetch(
      `https://api.twitter.com/2/spaces/by/creator_ids?user_ids=${creatorIds.join(",")}&space.fields=id,title,state,created_at,started_at,scheduled_start,creator_id,host_ids,speaker_ids,participant_count,topic_ids,lang,is_ticketed&expansions=creator_id,host_ids&user.fields=id,username,name,profile_image_url`,
      {
        // Prefer user token; fall back to app bearer for richer access
        headers: { Authorization: `Bearer ${userToken}` },
      },
    );

    if (!spacesRes.ok) {
      const errBody = await spacesRes.json().catch(() => ({}));
      console.error("spaces fetch error:", spacesRes.status, errBody);
      return json({ spaces: [], error: "Failed to fetch X Spaces" }, 502);
    }

    const spacesData = await spacesRes.json();
    const rawSpaces: {
      id: string;
      title?: string;
      state: "live" | "scheduled" | "ended";
      created_at: string;
      started_at?: string;
      scheduled_start?: string;
      creator_id: string;
      host_ids?: string[];
      participant_count?: number;
      lang?: string;
      is_ticketed?: boolean;
    }[] = spacesData.data ?? [];

    // Build creator lookup from expansions
    const userMap: Record<string, { id: string; username: string; name: string; profile_image_url?: string }> = {};
    const includes = spacesData.includes ?? {};
    const includeUsers: { id: string; username: string; name: string; profile_image_url?: string }[] =
      includes.users ?? [];
    for (const u of includeUsers) userMap[u.id] = u;
    // Also add followed users we already fetched
    for (const u of followedUsers) userMap[u.id] = u;

    // ── 5. Enrich and return ──────────────────────────────────────────────────
    const spaces = rawSpaces
      .filter((s) => s.state === "live" || s.state === "scheduled")
      .map((s) => {
        const creator = userMap[s.creator_id] ?? { id: s.creator_id, username: "unknown", name: "Unknown" };
        return {
          id: s.id,
          title: s.title ?? `${creator.name}'s Space`,
          state: s.state,
          creator_id: s.creator_id,
          creator_username: creator.username,
          creator_name: creator.name,
          creator_avatar: creator.profile_image_url?.replace("_normal", "") ?? null,
          participant_count: s.participant_count ?? 0,
          lang: s.lang ?? "en",
          is_ticketed: s.is_ticketed ?? false,
          started_at: s.started_at ?? null,
          scheduled_start: s.scheduled_start ?? null,
          created_at: s.created_at,
          // Direct join URL — opens the X Space in the X app / web
          join_url: `https://twitter.com/i/spaces/${s.id}`,
          x_url: `https://x.com/i/spaces/${s.id}`,
        };
      });

    return json({ spaces });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("x-spaces-feed error:", msg);
    return json({ error: msg }, 500);
  }
});

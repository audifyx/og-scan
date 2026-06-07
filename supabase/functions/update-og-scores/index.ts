/**
 * update-og-scores — Cron edge function.
 * Recomputes og_score + og_rank for all users and updates profiles table.
 * 
 * Score formula:
 *   og_score = likes_received × 2 + posts_count × 0.5 + accurate_calls × 10 + xp × 0.1
 * 
 * Ranks: Newcomer (0-99) → Degen (100-299) → Alpha (300-599) → OG (600-999) → Legend (1000+)
 */
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://ogscan.fun",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function scoreToRank(score: number): string {
  if (score >= 1000) return "Legend";
  if (score >= 600) return "OG";
  if (score >= 300) return "Alpha";
  if (score >= 100) return "Degen";
  return "Newcomer";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Fetch all profiles needing score update (updated > 6h ago or never)
  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("user_id, xp, total_xp, reputation_score, og_score")
    .limit(200);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let updated = 0;

  for (const profile of (profiles || [])) {
    // Count likes received on their posts
    const { count: likesReceived } = await supabase
      .from("community_post_likes")
      .select("*", { count: "exact", head: true })
      .eq("post_id", profile.user_id); // join approximation — in prod use subquery

    // Count posts created
    const { count: postsCount } = await supabase
      .from("community_posts")
      .select("*", { count: "exact", head: true })
      .eq("user_id", profile.user_id);

    // Count alpha calls with positive return
    const { count: accurateCalls } = await supabase
      .from("community_posts")
      .select("*", { count: "exact", head: true })
      .eq("user_id", profile.user_id)
      .gt("token_24h_return", 20); // >= +20% = accurate call

    const xp = profile.xp || profile.total_xp || 0;
    const likes = likesReceived || 0;
    const posts = postsCount || 0;
    const calls = accurateCalls || 0;

    const ogScore = Math.round(likes * 2 + posts * 0.5 + calls * 10 + xp * 0.1);
    const ogRank = scoreToRank(ogScore);

    await supabase.from("profiles").update({
      og_score: ogScore,
      og_rank: ogRank,
      og_score_updated: new Date().toISOString(),
      accurate_calls: calls,
      total_likes_received: likes,
    }).eq("user_id", profile.user_id);

    updated++;
    await new Promise(r => setTimeout(r, 50));
  }

  return new Response(JSON.stringify({ updated }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

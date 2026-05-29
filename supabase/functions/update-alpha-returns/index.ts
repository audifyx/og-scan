/**
 * update-alpha-returns — Cron edge function.
 * Finds community_posts with token_address set but no token_24h_return yet,
 * fetches current price from DexScreener, computes return vs price_at_post.
 * Run every hour via pg_cron or Supabase scheduled jobs.
 */
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function fetchTokenPrice(ca: string): Promise<number | null> {
  try {
    const r = await fetch(`https://api.dexscreener.com/tokens/v1/solana/${ca}`, {
      headers: { "User-Agent": "OGScan/1.0" },
    });
    if (!r.ok) return null;
    const pairs = await r.json();
    if (!Array.isArray(pairs) || pairs.length === 0) return null;
    const best = pairs.sort((a: any, b: any) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0))[0];
    return best.priceUsd ? parseFloat(best.priceUsd) : null;
  } catch {
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Find posts with a token_address that haven't been tracked yet (within last 8 days)
  const cutoff = new Date(Date.now() - 8 * 24 * 3600 * 1000).toISOString();
  const { data: posts, error } = await supabase
    .from("community_posts")
    .select("id, token_address, token_price_usd, token_price_at_post, token_24h_return, token_7d_return, created_at, alpha_tracked_at")
    .not("token_address", "is", null)
    .gt("created_at", cutoff)
    .limit(50);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let updated = 0;
  const now = Date.now();

  for (const post of (posts || [])) {
    const priceNow = await fetchTokenPrice(post.token_address);
    if (priceNow == null) continue;

    const postTime = new Date(post.created_at).getTime();
    const ageHours = (now - postTime) / 3600000;
    const priceAtPost = post.token_price_at_post ?? post.token_price_usd;

    const updates: Record<string, any> = { alpha_tracked_at: new Date().toISOString() };

    // Store entry price if not set
    if (!priceAtPost && ageHours < 1) {
      updates.token_price_at_post = priceNow;
    } else if (priceAtPost) {
      const returnPct = ((priceNow - priceAtPost) / priceAtPost) * 100;

      if (ageHours >= 24 && post.token_24h_return == null) {
        updates.token_24h_return = returnPct;
      }
      if (ageHours >= 168 && post.token_7d_return == null) {
        updates.token_7d_return = returnPct;
      }
      // Always update 24h return if within 48h window  
      if (ageHours < 48) {
        updates.token_24h_return = returnPct;
      }
    }

    if (Object.keys(updates).length > 1) {
      await supabase.from("community_posts").update(updates).eq("id", post.id);
      updated++;
    }

    // Small delay to avoid DexScreener rate limit
    await new Promise(r => setTimeout(r, 200));
  }

  return new Response(JSON.stringify({ updated, total: (posts || []).length }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

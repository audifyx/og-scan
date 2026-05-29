/**
 * check-price-alerts — Cron edge function (run every 5-15 minutes).
 * Fetches active price alerts, checks current price from DexScreener,
 * fires a notification when the target condition is met, marks alert as triggered.
 */
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function getDexPrice(ca: string): Promise<number | null> {
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

  const { data: alerts } = await supabase
    .from("price_alerts")
    .select("*")
    .eq("is_active", true)
    .is("triggered_at", null)
    .limit(100);

  let fired = 0;

  for (const alert of (alerts || [])) {
    const ca = alert.token_address || alert.token_ca;
    if (!ca) continue;

    const price = await getDexPrice(ca);
    if (price == null) continue;

    const dir = alert.direction || alert.condition || "above";
    const target = alert.target_price;
    const triggered = dir === "above" ? price >= target : price <= target;

    if (!triggered) {
      await new Promise(r => setTimeout(r, 150));
      continue;
    }

    const symbol = alert.symbol || alert.token_symbol || ca.slice(0, 8);
    const direction = dir === "above" ? "🚀 hit" : "📉 dropped to";

    // Insert notification for the user
    await supabase.from("notifications").insert({
      user_id: alert.user_id,
      type: "price_alert",
      title: `${symbol} ${direction} $${price.toFixed(8)}`,
      message: `Your price alert triggered: ${symbol} is now $${price.toFixed(8)} (target: $${target})`,
      body: `Your price alert triggered: ${symbol} is now $${price.toFixed(8)} (target: $${target})`,
      is_read: false,
    });

    // Mark alert as fired
    await supabase.from("price_alerts").update({
      is_active: false,
      triggered_at: new Date().toISOString(),
    }).eq("id", alert.id);

    fired++;
    await new Promise(r => setTimeout(r, 200));
  }

  return new Response(JSON.stringify({ checked: (alerts || []).length, fired }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

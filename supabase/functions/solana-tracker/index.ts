import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const HELIUS_API_KEY = Deno.env.get("HELIUS_API_KEY");
Deno.serve(async (req)=>{
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*"
      }
    });
  }
  try {
    const { wallet_address } = await req.json();
    const supabase = createClient(SUPABASE_URL || "", SUPABASE_SERVICE_ROLE_KEY || "");
    // Get transaction history from Helius
    const response = await fetch(`https://api.helius.xyz/v0/addresses/${wallet_address}/transactions?api-key=${HELIUS_API_KEY}`);
    const transactions = await response.json();
    // Insert events into live_feed
    for (const tx of transactions.slice(0, 10)){
      await supabase.from("live_feed_events").insert({
        event_type: "transaction",
        wallet_address,
        signature: tx.signature,
        metadata: tx
      });
    }
    return new Response(JSON.stringify({
      success: true,
      events: transactions.length
    }), {
      headers: {
        "Content-Type": "application/json"
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: error.message
    }), {
      status: 400
    });
  }
});

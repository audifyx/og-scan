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
    const { action, wallet_address, user_id } = await req.json();
    const supabase = createClient(SUPABASE_URL || "", SUPABASE_SERVICE_ROLE_KEY || "");
    if (action === "get_balance") {
      // Fetch wallet balance from Helius
      const response = await fetch(`https://api.helius.xyz/v0/addresses/${wallet_address}?api-key=${HELIUS_API_KEY}`);
      const data = await response.json();
      return new Response(JSON.stringify({
        success: true,
        balance: data
      }), {
        headers: {
          "Content-Type": "application/json"
        }
      });
    }
    if (action === "track_wallet") {
      const { data, error } = await supabase.from("tracked_wallets").insert({
        user_id,
        wallet_address
      }).select();
      if (error) throw error;
      return new Response(JSON.stringify({
        success: true,
        data
      }), {
        headers: {
          "Content-Type": "application/json"
        }
      });
    }
    if (action === "get_tracked_wallets") {
      const { data, error } = await supabase.from("tracked_wallets").select("*").eq("user_id", user_id);
      if (error) throw error;
      return new Response(JSON.stringify({
        success: true,
        wallets: data
      }), {
        headers: {
          "Content-Type": "application/json"
        }
      });
    }
    return new Response(JSON.stringify({
      error: "Unknown action"
    }), {
      status: 400
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: error.message
    }), {
      status: 400
    });
  }
});

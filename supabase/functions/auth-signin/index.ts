import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }
  try {
    const { email, password } = await req.json();
    if (!email || !password) {
      throw new Error("Email and password are required");
    }
    const supabase = createClient(SUPABASE_URL || "", SUPABASE_ANON_KEY || "", {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      throw new Error(error.message);
    }
    if (!data.session) {
      throw new Error("No session created");
    }
    const { data: profile } = await supabase
      .from("profiles")
      .select("username")
      .eq("user_id", data.user.id)
      .maybeSingle();
    return new Response(JSON.stringify({
      success: true,
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_in: data.session.expires_in,
        expires_at: data.session.expires_at,
      },
      user: {
        id: data.user.id,
        email: data.user.email,
        username: profile?.username || String(email).split("@")[0],
      },
    }), { headers: cors });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({
      success: false,
      error: message,
    }), {
      status: 400,
      headers: cors,
    });
  }
});

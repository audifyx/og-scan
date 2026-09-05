import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { authCors } from "../_shared/auth_cors.ts";

/** Closed. Unauthenticated createUser here bypassed device/IP limits. Use signup-guard. */
Deno.serve(async (req) => {
  const headers = authCors(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  return new Response(JSON.stringify({
    error: "use_signup_guard",
    message: "Signup is only available through the OrbitX app.",
  }), { status: 410, headers });
});

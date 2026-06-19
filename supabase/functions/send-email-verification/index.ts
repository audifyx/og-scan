/**
 * send-email-verification — Edge Function
 * Sends a verification email to the authenticated user.
 * User must be logged in (requires valid access token).
 */
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const cors = {
  "Access-Control-Allow-Origin": "https://ogscan.fun",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors, status: 204 });
  }

  try {
    // Get auth token from header
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "missing_auth", message: "Authorization header required" }),
        { status: 401, headers: cors }
      );
    }

    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) {
      return new Response(
        JSON.stringify({ error: "invalid_auth", message: "Invalid authorization token" }),
        { status: 401, headers: cors }
      );
    }

    // Verify token and get current user
    const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data: sessionData, error: sessionError } = await sb.auth.getUser(token);

    if (sessionError || !sessionData.user) {
      return new Response(
        JSON.stringify({ error: "invalid_auth", message: "Failed to verify token" }),
        { status: 401, headers: cors }
      );
    }

    const user = sessionData.user;
    const userEmail = user.email;

    if (!userEmail) {
      return new Response(
        JSON.stringify({ error: "no_email", message: "User account has no email" }),
        { status: 400, headers: cors }
      );
    }

    if (user.email_confirmed_at) {
      return new Response(
        JSON.stringify({
          ok: true,
          message: "Email already verified",
          already_verified: true,
        }),
        { status: 200, headers: cors }
      );
    }

    // Send verification email using Supabase Auth
    const { error: resendError } = await sb.auth.resend({
      type: "signup",
      email: userEmail,
      options: {
        emailRedirectTo: `${new URL(req.url).origin}/auth/verify-email`,
      },
    });

    if (resendError) {
      console.error("[send-email-verification] Resend error:", resendError);
      return new Response(
        JSON.stringify({
          error: "send_failed",
          message: resendError.message,
        }),
        { status: 500, headers: cors }
      );
    }

    console.log(`[send-email-verification] Verification email sent to ${userEmail}`);

    return new Response(
      JSON.stringify({
        ok: true,
        message: "Verification email sent",
        email: userEmail,
      }),
      { status: 200, headers: cors }
    );
  } catch (err) {
    console.error("[send-email-verification] Unhandled error:", err);
    return new Response(
      JSON.stringify({
        error: "internal_error",
        message: err instanceof Error ? err.message : "Unknown error",
      }),
      { status: 500, headers: cors }
    );
  }
});

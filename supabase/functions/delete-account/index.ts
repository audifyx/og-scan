/**
 * delete-account — Edge Function
 * Allows authenticated users to delete their own account.
 * Requires valid access token (user must be logged in).
 * Deletes auth.users record + profiles + related personal data.
 */
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
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

    const userId = sessionData.user.id;
    const userEmail = sessionData.user.email;

    console.log(`[delete-account] User ${userId} (${userEmail}) requesting account deletion`);

    // Use service role for actual deletion
    const sbAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Track deletion in audit log BEFORE deletion
    try {
      await sbAdmin.from("admin_audit_log").insert({
        admin_user_id: userId,
        action: "delete_own_account",
        target_type: "user",
        target_id: userId,
        new_values: { email: userEmail, deleted_at: new Date().toISOString() },
      });
    } catch (auditErr) {
      console.warn("[delete-account] Failed to write audit log:", auditErr);
      // Don't fail deletion for audit log errors
    }

    // Personal data cleanup (these belong to the user, delete them)
    const personalDataTables = [
      "user_activity",
      "user_devices",
      "auth_events",
      "price_alerts",
      "tracked_tokens",
      "tracked_wallets",
      "user_credits",
      "credit_transactions",
      "push_tokens",
      "user_webhooks",
      "wallet_alerts",
      "user_wallets",
      "wallet_holdings",
      "user_rate_limits",
      "ogscan_watched_mints",
      "ogscan_watched_devs",
    ];

    const cleanupResults: Record<string, string> = {};

    for (const table of personalDataTables) {
      try {
        const { error } = await sbAdmin.from(table).delete().eq("user_id", userId);
        cleanupResults[table] = error ? `error: ${error.message}` : "deleted";
      } catch (err) {
        console.warn(`[delete-account] Error deleting from ${table}:`, err);
        cleanupResults[table] = `skipped: ${err instanceof Error ? err.message : "unknown"}`;
      }
    }

    // Delete relationships
    try {
      await sbAdmin.from("followers").delete().or(`follower_id.eq.${userId},followee_id.eq.${userId}`);
      cleanupResults["followers"] = "deleted";
    } catch (err) {
      cleanupResults["followers"] = "skipped";
    }

    try {
      await sbAdmin.from("dm_participants").delete().eq("user_id", userId);
      cleanupResults["dm_participants"] = "deleted";
    } catch (err) {
      cleanupResults["dm_participants"] = "skipped";
    }

    try {
      await sbAdmin.from("referrals").delete().or(`inviter_id.eq.${userId},invitee_id.eq.${userId}`);
      cleanupResults["referrals"] = "deleted";
    } catch (err) {
      cleanupResults["referrals"] = "skipped";
    }

    try {
      await sbAdmin.from("support_tickets").delete().eq("user_id", userId);
      cleanupResults["support_tickets"] = "deleted";
    } catch (err) {
      cleanupResults["support_tickets"] = "skipped";
    }

    try {
      await sbAdmin.from("invite_codes").delete().eq("owner_id", userId);
      cleanupResults["invite_codes"] = "deleted";
    } catch (err) {
      cleanupResults["invite_codes"] = "skipped";
    }

    // Delete profile
    try {
      const { error: profileError } = await sbAdmin.from("profiles").delete().eq("user_id", userId);
      cleanupResults["profiles"] = profileError ? `error: ${profileError.message}` : "deleted";

      if (profileError) {
        console.error("[delete-account] Failed to delete profile:", profileError);
        return new Response(
          JSON.stringify({
            error: "profile_delete_failed",
            message: profileError.message,
            cleanupResults,
          }),
          { status: 500, headers: cors }
        );
      }
    } catch (err) {
      console.error("[delete-account] Exception deleting profile:", err);
      return new Response(
        JSON.stringify({
          error: "profile_delete_failed",
          message: err instanceof Error ? err.message : "unknown error",
          cleanupResults,
        }),
        { status: 500, headers: cors }
      );
    }

    // Finally, delete auth user
    let authDeleteSuccess = false;
    try {
      const { error: authDeleteError } = await sbAdmin.auth.admin.deleteUser(userId);
      if (authDeleteError) {
        console.error("[delete-account] Failed to delete auth user:", authDeleteError);
        return new Response(
          JSON.stringify({
            error: "auth_delete_failed",
            message: authDeleteError.message,
            cleanupResults,
          }),
          { status: 500, headers: cors }
        );
      }
      authDeleteSuccess = true;
      cleanupResults["auth.users"] = "deleted";
    } catch (err) {
      console.error("[delete-account] Exception deleting auth user:", err);
      return new Response(
        JSON.stringify({
          error: "auth_delete_failed",
          message: err instanceof Error ? err.message : "unknown error",
          cleanupResults,
        }),
        { status: 500, headers: cors }
      );
    }

    console.log(`[delete-account] Successfully deleted user ${userId}`, cleanupResults);

    return new Response(
      JSON.stringify({
        ok: true,
        message: "Account deleted successfully",
        cleanupResults,
      }),
      { status: 200, headers: cors }
    );
  } catch (err) {
    console.error("[delete-account] Unhandled error:", err);
    return new Response(
      JSON.stringify({
        error: "internal_error",
        message: err instanceof Error ? err.message : "Unknown error",
      }),
      { status: 500, headers: cors }
    );
  }
});

/**
 * delete-user — Edge Function
 * Deletes a user completely: auth record + related public data.
 * Requires authenticated owner/admin access.
 */
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OWNER_EMAIL = "audifyx@gmail.com";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "missing_auth" }), {
        status: 401,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: authData, error: authError } = await sb.auth.getUser(token);
    const caller = authData.user;

    if (authError || !caller) {
      return new Response(JSON.stringify({ error: "invalid_auth" }), {
        status: 401,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const { userId } = await req.json();
    if (!userId) {
      return new Response(JSON.stringify({ error: "userId required" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const [adminRoleRes, adminProfileRes] = await Promise.all([
      sb.from("admin_roles").select("role").eq("user_id", caller.id).maybeSingle(),
      sb.from("profiles").select("role, is_official_account").eq("user_id", caller.id).maybeSingle(),
    ]);

    const role = adminRoleRes.data?.role || adminProfileRes.data?.role || null;
    const isAuthorized =
      caller.email === OWNER_EMAIL ||
      role === "admin" ||
      role === "owner";

    if (!isAuthorized) {
      return new Response(JSON.stringify({ error: "not_admin" }), {
        status: 403,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    if (caller.id === userId) {
      return new Response(JSON.stringify({ error: "cannot_delete_self" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const cleanupResults: Record<string, string> = {};

    const deleteEq = async (table: string, column: string, value: string) => {
      try {
        const { error } = await sb.from(table).delete().eq(column, value);
        cleanupResults[`${table}.${column}`] = error ? `error: ${error.message}` : "ok";
      } catch (error) {
        cleanupResults[`${table}.${column}`] = `skipped: ${error instanceof Error ? error.message : String(error)}`;
      }
    };

    const userIdTables = [
      "admin_roles",
      "auth_events",
      "community_members",
      "community_post_replies",
      "community_posts",
      "credit_transactions",
      "dm_participants",
      "lobby_members",
      "notifications",
      "price_alerts",
      "profile_badges",
      "push_tokens",
      "space_messages",
      "support_tickets",
      "tracked_tokens",
      "tracked_wallets",
      "trade_history",
      "user_activity",
      "user_badges",
      "user_credits",
      "user_devices",
      "watchlist_tokens",
      "ogscan_watched_mints",
      "ogscan_watched_devs",
    ];

    for (const table of userIdTables) {
      await deleteEq(table, "user_id", userId);
    }

    const extraDeletes: Array<[string, string]> = [
      ["followers", "follower_id"],
      ["followers", "followee_id"],
      ["dm_messages", "sender_id"],
      ["dm_conversations", "user_a"],
      ["dm_conversations", "user_b"],
      ["referrals", "inviter_id"],
      ["referrals", "invitee_id"],
      ["invite_codes", "owner_id"],
      ["support_messages", "sender_id"],
      ["support_tickets", "assigned_agent_id"],
    ];

    for (const [table, column] of extraDeletes) {
      await deleteEq(table, column, userId);
    }

    const { error: profileError } = await sb.from("profiles").delete().eq("user_id", userId);
    cleanupResults["profiles.user_id"] = profileError ? `error: ${profileError.message}` : "ok";
    if (profileError) {
      return new Response(JSON.stringify({ error: `profile_delete_failed: ${profileError.message}`, cleanupResults }), {
        status: 500,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const { error: authDeleteError } = await sb.auth.admin.deleteUser(userId);
    if (authDeleteError) {
      return new Response(JSON.stringify({ error: `auth_delete_failed: ${authDeleteError.message}`, cleanupResults }), {
        status: 500,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    await sb.from("admin_audit_log").insert({
      admin_user_id: caller.id,
      action: "delete_user",
      target_type: "user",
      target_id: userId,
      new_values: { cleanup: cleanupResults },
    }).then(() => {});

    return new Response(JSON.stringify({ ok: true, cleanupResults }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("delete-user error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});

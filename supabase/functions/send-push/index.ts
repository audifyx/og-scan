/**
 * send-push — Supabase Edge Function
 *
 * 1. Inserts into `notifications` table (using service role, bypasses RLS)
 * 2. Sends Web Push to all registered devices for the user
 *
 * Request body:
 *   { userId, type?, title, body, url?, tag?, data? }
 */
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import webpush from "npm:web-push@3.6.7";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:audifyx@gmail.com";

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { userId, type, title, body, url, tag, data } = await req.json();

    if (!userId || !title) {
      return new Response(JSON.stringify({ error: "userId and title required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1. Insert into notifications table (service role bypasses RLS)
    const { error: dbErr } = await supabase.from("notifications").insert({
      user_id: userId,
      type: type || "general",
      title,
      message: body || "",
      body: body || "",
      data: { ...data, url: url || "/app" },
      is_read: false,
      read: false,
    });
    if (dbErr) console.error("Notification insert failed:", dbErr);

    // 2. Get all active push tokens for this user
    const { data: tokens, error: tokErr } = await supabase
      .from("push_tokens")
      .select("id, token")
      .eq("user_id", userId)
      .eq("platform", "web")
      .is("disabled_at", null);

    if (tokErr) {
      console.error("Failed to fetch tokens:", tokErr);
      return new Response(JSON.stringify({ db: !dbErr, sent: 0, error: "token_fetch_failed" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!tokens || tokens.length === 0) {
      return new Response(JSON.stringify({ db: !dbErr, sent: 0, reason: "no_tokens" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = JSON.stringify({
      title: title || "OG Scan",
      body: body || "",
      icon: "/icon-192x192.png",
      badge: "/favicon.png",
      url: url || "/app",
      tag: tag || `push-${Date.now()}`,
    });

    let sent = 0;
    const staleIds: string[] = [];

    for (const row of tokens) {
      try {
        const subscription = JSON.parse(row.token);
        await webpush.sendNotification(subscription, payload);
        sent++;
      } catch (err: any) {
        if (err.statusCode === 404 || err.statusCode === 410) {
          staleIds.push(row.id);
        } else {
          console.error(`Push failed for token ${row.id}:`, err.message || err);
        }
      }
    }

    // Clean up stale subscriptions
    if (staleIds.length > 0) {
      await supabase.from("push_tokens").update({ disabled_at: new Date().toISOString() }).in("id", staleIds);
    }

    return new Response(JSON.stringify({ db: !dbErr, sent, total: tokens.length, stale: staleIds.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("send-push error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

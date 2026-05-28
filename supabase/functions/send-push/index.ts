/**
 * send-push — Supabase Edge Function
 *
 * 1. Inserts into `notifications` table (using service role, bypasses RLS)
 * 2. Applies per-category preferences + quiet hours for push delivery
 * 3. Sends rich Web Push to all registered devices for the user
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

type NotificationPreferenceKey =
  | "directMessages"
  | "support"
  | "spaces"
  | "priceAlerts"
  | "whaleAlerts"
  | "walletActivity"
  | "communityPosts"
  | "newFollowers"
  | "tradeSignals"
  | "lobbyInvites"
  | "ourCoin"
  | "system";

type NotificationAction = {
  action: string;
  title: string;
  url?: string;
};

const DEFAULT_NOTIFICATION_PREFERENCES: Record<NotificationPreferenceKey, boolean> = {
  directMessages: true,
  support: true,
  spaces: true,
  priceAlerts: true,
  whaleAlerts: true,
  walletActivity: true,
  communityPosts: true,
  newFollowers: true,
  tradeSignals: true,
  lobbyInvites: true,
  ourCoin: true,
  system: true,
};

function notificationTypeToPreference(type?: string | null): NotificationPreferenceKey {
  switch (type) {
    case "dm":
      return "directMessages";
    case "support_ticket":
    case "support_reply":
      return "support";
    case "space_live":
    case "space_reminder":
    case "promoted":
    case "mentioned":
    case "space_ending":
    case "reminder":
      return "spaces";
    case "price_alert":
      return "priceAlerts";
    case "whale_alert":
      return "whaleAlerts";
    case "wallet_alert":
    case "wallet_buy":
    case "wallet_sell":
      return "walletActivity";
    case "community_post":
      return "communityPosts";
    case "new_follower":
      return "newFollowers";
    case "trade_signal":
    case "token_callout":
      return "tradeSignals";
    case "lobby_invite":
      return "lobbyInvites";
    case "our_coin_buy":
      return "ourCoin";
    default:
      return "system";
  }
}

function getDefaultTag(type?: string | null) {
  return `group-${notificationTypeToPreference(type)}`;
}

function toMinutes(value?: string | null) {
  if (!value || !/^\d{2}:\d{2}$/.test(value)) return null;
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function isInQuietHours(now: Date, start?: string | null, end?: string | null) {
  const startMinutes = toMinutes(start);
  const endMinutes = toMinutes(end);

  if (startMinutes === null || endMinutes === null) return false;
  if (startMinutes === endMinutes) return false;

  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  if (startMinutes < endMinutes) {
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  }

  return currentMinutes >= startMinutes || currentMinutes < endMinutes;
}

function normalizePreferences(value: Record<string, boolean> | null | undefined) {
  return {
    ...DEFAULT_NOTIFICATION_PREFERENCES,
    ...(value || {}),
  };
}

function buildActions(type?: string | null, url?: string | null, actions?: NotificationAction[]) {
  if (Array.isArray(actions) && actions.length > 0) return actions.slice(0, 2);

  const primaryUrl = url || "/app";

  if (type === "dm") {
    return [
      { action: "open_dm", title: "Open chat", url: primaryUrl },
      { action: "view_inbox", title: "Inbox", url: "/messages" },
    ];
  }

  if (type === "support_ticket" || type === "support_reply") {
    return [
      { action: "open_support", title: "Open ticket", url: primaryUrl },
      { action: "view_support", title: "Support", url: "/support" },
    ];
  }

  if (type === "space_live") {
    return [
      { action: "join_space", title: "Join live", url: primaryUrl },
      { action: "view_spaces", title: "Spaces", url: "/spaces" },
    ];
  }

  return [{ action: "open_app", title: "Open", url: primaryUrl }];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const {
      userId,
      type,
      title,
      body,
      url,
      tag,
      data,
      image,
      actions,
      requireInteraction,
      renotify,
    } = await req.json();

    if (!userId || !title) {
      return new Response(JSON.stringify({ error: "userId and title required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: profile } = await supabase
      .from("profiles")
      .select("notification_preferences, quiet_hours_start, quiet_hours_end")
      .eq("user_id", userId)
      .maybeSingle();

    const preferenceKey = notificationTypeToPreference(type);
    const notificationPreferences = normalizePreferences(profile?.notification_preferences as Record<string, boolean> | null | undefined);
    const quietHoursActive = isInQuietHours(new Date(), profile?.quiet_hours_start, profile?.quiet_hours_end);
    const preferenceEnabled = notificationPreferences[preferenceKey] !== false;

    const notificationData = {
      ...(data || {}),
      url: url || "/app",
      image: image || null,
      actions: buildActions(type, url, actions),
      preferenceKey,
    };

    const { error: dbErr } = await supabase.from("notifications").insert({
      user_id: userId,
      type: type || "general",
      title,
      message: body || "",
      body: body || "",
      data: notificationData,
      is_read: false,
      read: false,
    });
    if (dbErr) console.error("Notification insert failed:", dbErr);

    const { count: unreadCount } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("is_read", false);

    if (!preferenceEnabled) {
      return new Response(JSON.stringify({
        db: !dbErr,
        sent: 0,
        reason: "preference_disabled",
        category: preferenceKey,
        unread: unreadCount || 0,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (quietHoursActive) {
      return new Response(JSON.stringify({
        db: !dbErr,
        sent: 0,
        reason: "quiet_hours",
        category: preferenceKey,
        unread: unreadCount || 0,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
      return new Response(JSON.stringify({ db: !dbErr, sent: 0, reason: "no_tokens", unread: unreadCount || 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = JSON.stringify({
      title: title || "OG Scan",
      body: body || "",
      icon: "/icon-192x192.png",
      badge: "/favicon.png",
      image: image || undefined,
      url: url || "/app",
      tag: tag || getDefaultTag(type),
      group: preferenceKey,
      badgeCount: unreadCount || 0,
      renotify: typeof renotify === "boolean" ? renotify : false,
      requireInteraction: Boolean(requireInteraction),
      actions: buildActions(type, url, actions),
      data: notificationData,
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

    if (staleIds.length > 0) {
      await supabase.from("push_tokens").update({ disabled_at: new Date().toISOString() }).in("id", staleIds);
    }

    return new Response(JSON.stringify({
      db: !dbErr,
      sent,
      total: tokens.length,
      stale: staleIds.length,
      category: preferenceKey,
      unread: unreadCount || 0,
    }), {
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

import { useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { usePushNotifications } from "@/hooks/usePushNotifications";

const NOTIFICATION_ICONS: Record<string, string> = {
  price_alert: "📈",
  whale_alert: "🐋",
  wallet_buy: "🟢",
  wallet_sell: "🔴",
  new_token: "🪙",
};

export const NotificationListener = () => {
  const { user } = useAuth();
  const { sendNotification, permission } = usePushNotifications();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!user || permission !== "granted") return;

    // Subscribe to new notifications for this user
    const channel = supabase
      .channel("push-notifications")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const n = payload.new as {
            type: string;
            title: string;
            message: string;
          };
          const icon = NOTIFICATION_ICONS[n.type] || "🔔";
          sendNotification(`${icon} ${n.title}`, {
            body: n.message,
            tag: `notification-${Date.now()}`,
            silent: false,
          });
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [user, permission, sendNotification]);

  // Also listen to live_feed_events for whale activity
  useEffect(() => {
    if (permission !== "granted") return;

    const channel = supabase
      .channel("whale-push-alerts")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "live_feed_events",
          filter: "is_whale=eq.true",
        },
        (payload) => {
          const e = payload.new as {
            event_type: string;
            token_symbol: string | null;
            amount_usd: number | null;
            wallet_address: string;
          };
          const amountStr = e.amount_usd
            ? `$${(e.amount_usd / 1000).toFixed(1)}K`
            : "";
          sendNotification(`🐋 Whale ${e.event_type}`, {
            body: `${e.token_symbol || "Unknown"} ${amountStr} — ${e.wallet_address.slice(0, 6)}...`,
            tag: `whale-${Date.now()}`,
            silent: false,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [permission, sendNotification]);

  return null; // Invisible component
};

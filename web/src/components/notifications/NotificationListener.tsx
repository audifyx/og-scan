import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { updateAppBadge } from "@/lib/appBadge";

/**
 * Bridge from realtime social notifications into the OrbitX OS notification
 * center (Desktop.tsx). Desktop's notification state lives in-memory, so a
 * plain localStorage write would be invisible until the next mount — the
 * window event covers a mounted Desktop, and the localStorage mirror
 * (same key/shape as osStore's loadOsNotifications) covers a Desktop that
 * mounts later. Both paths share the stable id `social-<notification id>`
 * so Desktop can dedupe.
 */
export const OS_SOCIAL_NOTIFICATION_EVENT = "orbitx:os-notification";
const OS_NOTIFICATIONS_KEY = "orbitxos:notifications:v1";

export interface OsSocialNotification {
  id: string;
  title: string;
  body: string;
}

export function pushOsSocialNotification(n: OsSocialNotification) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(OS_SOCIAL_NOTIFICATION_EVENT, { detail: n }));
  }
  try {
    const raw = localStorage.getItem(OS_NOTIFICATIONS_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    const list = Array.isArray(parsed) ? parsed : [];
    if (!list.some((x) => x && typeof x === "object" && (x as { id?: unknown }).id === n.id)) {
      list.unshift({ id: n.id, title: n.title, body: n.body, kind: "social", at: Date.now(), read: false });
      localStorage.setItem(OS_NOTIFICATIONS_KEY, JSON.stringify(list.slice(0, 100)));
    }
  } catch {
    /* storage unavailable — the live event above still covers a mounted Desktop */
  }
}

export const NotificationListener = () => {
  const { user } = useAuth();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!user) return;

    const syncUnreadBadge = async () => {
      const { count } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("is_read", false);

      await updateAppBadge(count || 0);
    };

    void syncUnreadBadge();

    const channel = supabase
      .channel(`notifications-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        async (payload) => {
          const notification = payload.new as {
            id: string;
            title: string;
            message: string;
          };

          const { count } = await supabase
            .from("notifications")
            .select("id", { count: "exact", head: true })
            .eq("user_id", user.id)
            .eq("is_read", false);

          await updateAppBadge(count || 0);

          // Also land in the OS notification center (Desktop listens for
          // this event; the localStorage mirror covers a not-yet-mounted
          // Desktop). Fires regardless of tab visibility — unlike the
          // sonner toast below, the center is meant to collect while away.
          pushOsSocialNotification({
            id: `social-${notification.id}`,
            title: notification.title,
            body: notification.message,
          });

          if (typeof document !== "undefined" && document.visibilityState === "visible") {
            toast.info(notification.title, {
              description: notification.message,
              duration: 6000,
            });
          }
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [user]);

  return null;
};

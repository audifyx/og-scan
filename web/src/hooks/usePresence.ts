/**
 * usePresence — Global online presence heartbeat.
 * Updates `is_online = true` + `last_seen_at = now()` every 15s.
 * Sets `is_online = false` on page hide/unload.
 * Also recalculates `current_level` from `xp` on each heartbeat.
 */
import { useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "./useAuth";

const HEARTBEAT_MS = 15_000; // 15 seconds

/** XP thresholds: level N requires N*N*100 XP */
function levelFromXp(xp: number): number {
  if (xp <= 0) return 1;
  return Math.max(1, Math.floor(Math.sqrt(xp / 100)));
}

export function usePresence() {
  const { user } = useAuth();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!user) return;

    const heartbeat = async () => {
      // Update online + last_seen + recalculate level
      const { data } = await supabase
        .from("profiles")
        .select("xp, current_level")
        .eq("user_id", user.id)
        .single();

      const updates: Record<string, unknown> = {
        is_online: true,
        last_seen_at: new Date().toISOString(),
        last_active_at: new Date().toISOString(),
      };

      if (data) {
        const correctLevel = levelFromXp(data.xp || 0);
        if (correctLevel !== (data.current_level || 0)) {
          updates.current_level = correctLevel;
        }
      }

      await supabase
        .from("profiles")
        .update(updates)
        .eq("user_id", user.id);
    };

    const goOffline = () => {
      // Fire-and-forget: mark offline
      supabase
        .from("profiles")
        .update({ is_online: false, last_seen_at: new Date().toISOString() })
        .eq("user_id", user.id)
        .then(() => {});
    };

    // Initial heartbeat
    heartbeat();

    // Periodic heartbeat
    intervalRef.current = setInterval(heartbeat, HEARTBEAT_MS);

    // Visibility change
    const onVisChange = () => {
      if (document.hidden) goOffline();
      else heartbeat();
    };
    document.addEventListener("visibilitychange", onVisChange);

    // Before unload
    const onUnload = () => goOffline();
    window.addEventListener("beforeunload", onUnload);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      document.removeEventListener("visibilitychange", onVisChange);
      window.removeEventListener("beforeunload", onUnload);
      goOffline();
    };
  }, [user]);
}

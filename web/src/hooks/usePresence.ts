/**
 * usePresence — Global online presence heartbeat (single writer).
 * - Heartbeats `is_online = true` + `last_seen_at`/`last_active_at` every 15s
 *   while the tab is visible. Skips beats while hidden.
 * - Marks offline on tab hide / page unload using fetch({ keepalive: true })
 *   straight to PostgREST, so the write survives navigation (supabase-js XHRs
 *   get cancelled during unload).
 * - No blur/focus flapping: switching monitors or brief app switches no longer
 *   toggle status; the staleness window in lib/presence.ts covers hard crashes.
 * - Also recalculates `current_level` from `xp` on each heartbeat.
 * - Logs one session_start activity event per mount.
 */
import { useEffect, useRef } from "react";
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase";
import { trackActivity } from "@/lib/trackActivity";
import { useAuth } from "./useAuth";
import { PRESENCE_HEARTBEAT_MS } from "@/lib/presence";

/** XP thresholds: level N requires N*N*100 XP */
function levelFromXp(xp: number): number {
  if (xp <= 0) return 1;
  return Math.max(1, Math.floor(Math.sqrt(xp / 100)));
}

export function usePresence() {
  const { user } = useAuth();
  const tokenRef = useRef<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let stopped = false;

    const cacheToken = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        tokenRef.current = data.session?.access_token ?? null;
      } catch { /* noop */ }
    };

    const heartbeat = async () => {
      if (stopped || document.hidden) return;
      void cacheToken(); // keep a fresh token around for the unload beacon
      const nowIso = new Date().toISOString();
      const updates: Record<string, unknown> = {
        is_online: true,
        last_seen_at: nowIso,
        last_active_at: nowIso,
      };
      try {
        const { data } = await supabase
          .from("profiles")
          .select("xp, current_level")
          .eq("user_id", user.id)
          .single();
        if (data) {
          const correctLevel = levelFromXp(data.xp || 0);
          if (correctLevel !== (data.current_level || 0)) updates.current_level = correctLevel;
        }
        await supabase.from("profiles").update(updates).eq("user_id", user.id);
      } catch { /* transient network issue — the staleness window covers us */ }
    };

    /** Offline write that survives page unload. */
    const goOffline = () => {
      const token = tokenRef.current;
      if (!token) return;
      const nowIso = new Date().toISOString();
      try {
        void fetch(`${SUPABASE_URL}/rest/v1/profiles?user_id=eq.${user.id}`, {
          method: "PATCH",
          keepalive: true,
          headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            Prefer: "return=minimal",
          },
          body: JSON.stringify({ is_online: false, last_seen_at: nowIso, last_active_at: nowIso }),
        });
      } catch { /* noop */ }
    };

    // Log session start once per mount (fire-and-forget)
    trackActivity({
      user_id: user.id,
      activity_type: "session.start",
      title: "Session started",
      data: { path: window.location.pathname },
      is_public: false,
    });

    void cacheToken().then(heartbeat);
    const interval = setInterval(heartbeat, PRESENCE_HEARTBEAT_MS);

    // Hidden tab -> offline immediately; visible again -> instant heartbeat.
    const onVisChange = () => {
      if (document.hidden) goOffline();
      else void heartbeat();
    };
    document.addEventListener("visibilitychange", onVisChange);

    // pagehide is the reliable unload signal (esp. iOS Safari); keep
    // beforeunload as a desktop fallback.
    const onPageHide = () => goOffline();
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("beforeunload", onPageHide);

    return () => {
      stopped = true;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisChange);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("beforeunload", onPageHide);
      goOffline();
    };
  }, [user]);
}

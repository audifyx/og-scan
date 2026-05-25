/**
 * Security tracker — records device fingerprint + IP on login/signup.
 * Mounts once in App.tsx; fires on auth state changes.
 */
import { useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { getDeviceInfo } from "@/hooks/useDeviceFingerprint";

const TRACK_COOLDOWN_MS = 5 * 60 * 1000; // Don't re-track within 5 min
const LAST_TRACK_KEY = "og_last_device_track";

export function useSecurityTracker() {
  const tracked = useRef(false);

  useEffect(() => {
    // Skip if already tracked this session
    if (tracked.current) return;

    const lastTrack = parseInt(localStorage.getItem(LAST_TRACK_KEY) ?? "0", 10);
    if (Date.now() - lastTrack < TRACK_COOLDOWN_MS) {
      tracked.current = true;
      return;
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!session?.access_token) return;
      if (tracked.current) return;
      if (event !== "SIGNED_IN" && event !== "TOKEN_REFRESHED" && event !== "INITIAL_SESSION") return;

      tracked.current = true;
      try {
        const info = getDeviceInfo();
        const eventType = event === "SIGNED_IN" ? "login" : "session";

        const res = await supabase.functions.invoke("track-device", {
          body: { ...info, event_type: eventType },
        });

        if (res.data) {
          // If user is banned/suspended, sign them out
          if (res.data.is_banned || res.data.is_suspended) {
            const reason = res.data.ban_reason || res.data.suspension_reason || "Account restricted";
            alert(`Your account has been ${res.data.is_banned ? "banned" : "suspended"}: ${reason}`);
            await supabase.auth.signOut();
            return;
          }
        }

        localStorage.setItem(LAST_TRACK_KEY, String(Date.now()));
      } catch (err) {
        console.error("[security] track-device failed:", err);
      }
    });

    return () => subscription.unsubscribe();
  }, []);
}

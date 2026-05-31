import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";

declare global {
  interface Window {
    Intercom: (...args: unknown[]) => void;
    intercomSettings: Record<string, unknown>;
  }
}

const APP_ID = "wlc3xyxr";

/**
 * Keeps the Intercom / Fin messenger in sync with the current auth state.
 * Call once near the app root (e.g. inside App or Index).
 */
export function useIntercom() {
  const { user, profile } = useAuth();

  useEffect(() => {
    if (typeof window.Intercom !== "function") return;

    if (user) {
      window.Intercom("update", {
        app_id: APP_ID,
        user_id: user.id,
        email: user.email,
        name:
          profile?.display_name ??
          profile?.username ??
          user.email?.split("@")[0] ??
          undefined,
        created_at: user.created_at
          ? Math.floor(new Date(user.created_at).getTime() / 1000)
          : undefined,
      });
    } else {
      // Visitor mode — no user data
      window.Intercom("update", { app_id: APP_ID });
    }
  }, [user, profile]);

  // Shutdown on unmount (SPA teardown)
  useEffect(() => {
    return () => {
      if (typeof window.Intercom === "function") {
        window.Intercom("shutdown");
      }
    };
  }, []);
}

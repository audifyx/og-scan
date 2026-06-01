import { useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";

declare global {
  interface Window {
    Intercom: (...args: unknown[]) => void;
    intercomSettings: Record<string, unknown>;
  }
}

const APP_ID = "wlc3xyxr";

/**
 * Keeps Intercom / Fin in sync with auth state.
 *
 * - index.html handles the initial visitor boot via window.intercomSettings
 * - On login  → fetches a signed JWT from the intercom-token edge function
 *               (secret never leaves the server) then calls Intercom("update")
 * - On logout → shutdown + re-boot as anonymous visitor
 */
export function useIntercom() {
  const { user, profile } = useAuth();
  const identifiedRef = useRef<string | null>(null);

  useEffect(() => {
    if (typeof window.Intercom !== "function") return;
    let cancelled = false;

    async function identify() {
      if (user) {
        // Already identified this user — nothing to do
        if (identifiedRef.current === user.id) return;

        // Fetch server-signed JWT — secret stays server-side
        let jwt: string | null = null;
        try {
          const { data, error } = await supabase.functions.invoke(
            "intercom-token",
            { method: "POST" },
          );
          if (!error && data?.token) jwt = data.token;
        } catch {
          // Edge function unreachable — fall back to unverified identity
        }

        if (cancelled) return;

        window.Intercom("update", {
          app_id: APP_ID,
          ...(jwt
            ? { intercom_user_jwt: jwt }
            : { user_id: user.id, email: user.email ?? undefined }),
          name:
            profile?.display_name ??
            profile?.username ??
            user.email?.split("@")[0] ??
            undefined,
        });
        identifiedRef.current = user.id;
      } else {
        // Logged out — reset to anonymous visitor
        if (identifiedRef.current !== null) {
          window.Intercom("shutdown");
          window.Intercom("boot", {
            api_base: "https://api-iam.intercom.io",
            app_id: APP_ID,
          });
          identifiedRef.current = null;
        }
      }
    }

    identify();
    return () => { cancelled = true; };
  }, [user, profile]);
}

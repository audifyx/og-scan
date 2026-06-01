import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";

declare global {
  interface Window {
    Intercom?: (...args: any[]) => void;
    intercomSettings?: Record<string, any>;
  }
}

const APP_ID = "wlc3xyxr";

// Load the Intercom widget script once
function loadIntercomScript() {
  if (typeof window === "undefined") return;
  const w = window as any;
  const ic = w.Intercom;
  if (typeof ic === "function") {
    ic("reattach_activator");
    ic("update", w.intercomSettings);
  } else {
    const i: any = function (...args: any[]) { i.c(args); };
    i.q = [] as any[];
    i.c = (args: any) => { i.q.push(args); };
    w.Intercom = i;
    const l = () => {
      const s = document.createElement("script");
      s.type = "text/javascript";
      s.async = true;
      s.src = `https://widget.intercom.io/widget/${APP_ID}`;
      const x = document.getElementsByTagName("script")[0];
      x.parentNode?.insertBefore(s, x);
    };
    if (document.readyState === "complete") l();
    else window.addEventListener("load", l, false);
  }
}

export function IntercomSync() {
  const { user, profile } = useAuth();

  useEffect(() => {
    loadIntercomScript();
  }, []);

  useEffect(() => {
    if (!window.Intercom) return;

    if (!user) {
      // Logged-out visitor
      window.Intercom("boot", {
        api_base: "https://api-iam.intercom.io",
        app_id: APP_ID,
      });
      return;
    }

    // Fetch JWT from edge function, then boot with identity
    supabase.functions
      .invoke("intercom-token")
      .then(({ data, error }) => {
        if (error || !data?.token) {
          // Fall back to boot without JWT (non-verified identity)
          window.Intercom?.("boot", {
            api_base: "https://api-iam.intercom.io",
            app_id: APP_ID,
            user_id: user.id,
            email: user.email,
            name: profile?.display_name || profile?.username || user.email,
            session_duration: 86400000,
          });
          return;
        }
        window.Intercom?.("boot", {
          api_base: "https://api-iam.intercom.io",
          app_id: APP_ID,
          intercom_user_jwt: data.token,
          name: profile?.display_name || profile?.username || user.email,
          session_duration: 86400000,
        });
      });
  }, [user?.id, profile?.id]);

  // Shutdown on logout
  useEffect(() => {
    if (!user && window.Intercom) {
      window.Intercom("shutdown");
      window.Intercom("boot", {
        api_base: "https://api-iam.intercom.io",
        app_id: APP_ID,
      });
    }
  }, [user]);

  return null;
}

import { useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";

declare global {
  interface Window {
    Intercom?: (...args: any[]) => void;
    intercomSettings?: Record<string, any>;
  }
}

const APP_ID = "wlc3xyxr";

let scriptLoaded = false;

function injectScript(): Promise<void> {
  if (scriptLoaded) return Promise.resolve();
  return new Promise((resolve) => {
    const w = window as any;
    // Set up stub queue so calls before load are buffered
    const i: any = function (...args: any[]) { i.c(args); };
    i.q = [] as any[];
    i.c = (args: any) => { i.q.push(args); };
    if (typeof w.Intercom !== "function") w.Intercom = i;

    const s = document.createElement("script");
    s.type = "text/javascript";
    s.async = true;
    s.src = `https://widget.intercom.io/widget/${APP_ID}`;
    s.onload = () => { scriptLoaded = true; resolve(); };
    document.head.appendChild(s);
  });
}

export function IntercomSync() {
  const { user, profile } = useAuth();
  const bootedRef = useRef(false);

  useEffect(() => {
    injectScript().then(() => {
      if (bootedRef.current) return;
      bootedRef.current = true;

      if (!user) {
        window.Intercom?.("boot", {
          api_base: "https://api-iam.intercom.io",
          app_id: APP_ID,
          hide_default_launcher: true, // we use our own button
        });
        return;
      }

      // Try JWT first, fall back to plain boot
      supabase.functions.invoke("intercom-token").then(({ data, error }) => {
        const base = {
          api_base: "https://api-iam.intercom.io",
          app_id: APP_ID,
          hide_default_launcher: true,
          name: profile?.display_name || profile?.username || user.email,
          session_duration: 86400000,
        };

        if (!error && data?.token) {
          window.Intercom?.("boot", { ...base, intercom_user_jwt: data.token });
        } else {
          window.Intercom?.("boot", { ...base, user_id: user.id, email: user.email });
        }
      });
    });
  }, [user?.id, profile?.id]);

  // Re-boot on logout
  useEffect(() => {
    if (!user && bootedRef.current) {
      window.Intercom?.("shutdown");
      bootedRef.current = false;
      window.Intercom?.("boot", {
        api_base: "https://api-iam.intercom.io",
        app_id: APP_ID,
        hide_default_launcher: true,
      });
    }
  }, [user]);

  return null;
}

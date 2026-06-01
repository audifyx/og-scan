import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";

const APP_ID = "wlc3xyxr";

// Inject the Intercom snippet exactly as Intercom provides it
function injectIntercom() {
  const w = window as any;
  if (w.Intercom) return; // already loaded
  const i: any = (...args: any[]) => { i.c(args); };
  i.q = [] as any[];
  i.c = (args: any[]) => { i.q.push(args); };
  w.Intercom = i;
  const s = document.createElement("script");
  s.type = "text/javascript";
  s.async = true;
  s.src = `https://widget.intercom.io/widget/${APP_ID}`;
  document.head.appendChild(s);
}

async function bootIntercom(user: any, profile: any) {
  const w = window as any;
  // Ensure script is injected
  injectIntercom();

  const base = {
    api_base: "https://api-iam.intercom.io",
    app_id: APP_ID,
    session_duration: 86400000,
  };

  if (!user) {
    w.Intercom("boot", base);
    return;
  }

  const name = profile?.display_name || profile?.username || user.email || undefined;

  // Try JWT first
  try {
    const { data } = await supabase.functions.invoke("intercom-token");
    if (data?.token) {
      w.Intercom("boot", { ...base, intercom_user_jwt: data.token, name });
      return;
    }
  } catch (_) {}

  // Fallback — boot without verified JWT
  w.Intercom("boot", { ...base, user_id: user.id, email: user.email, name });
}

export function IntercomSync() {
  const { user, profile } = useAuth();

  useEffect(() => {
    injectIntercom();
  }, []);

  useEffect(() => {
    bootIntercom(user, profile);
    return () => {
      if (!user) {
        (window as any).Intercom?.("shutdown");
      }
    };
  }, [user?.id, profile?.id]);

  return null;
}

import { useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";

declare global {
  interface Window {
    Intercom: (...args: unknown[]) => void;
    intercomSettings: Record<string, unknown>;
  }
}

const APP_ID = "wlc3xyxr";
const API_SECRET = "fH_Du3SxV-661q0cmStXwMH7BuAyOOveIrvqhkdpDY0";

/* ── Minimal JWT (HMAC-SHA256) using Web Crypto ── */

function base64url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let str = "";
  for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i]);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function encodeUtf8(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

async function signJwt(
  payload: Record<string, unknown>,
  secret: string,
): Promise<string> {
  const header = { alg: "HS256", typ: "JWT" };
  const segments = [
    base64url(encodeUtf8(JSON.stringify(header)).buffer),
    base64url(encodeUtf8(JSON.stringify(payload)).buffer),
  ];
  const signingInput = segments.join(".");

  const padded = secret.replace(/-/g, "+").replace(/_/g, "/");
  const rawSecret = Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));

  const key = await crypto.subtle.importKey(
    "raw",
    rawSecret,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, encodeUtf8(signingInput));
  return `${signingInput}.${base64url(sig)}`;
}

/**
 * Keeps Intercom / Fin in sync with auth state.
 * index.html handles the initial boot via window.intercomSettings.
 * This hook only updates identity when a user logs in/out.
 */
export function useIntercom() {
  const { user, profile } = useAuth();
  const identifiedRef = useRef<string | null>(null);

  useEffect(() => {
    if (typeof window.Intercom !== "function") return;
    let cancelled = false;

    async function identify() {
      if (user) {
        // Already identified this user — skip
        if (identifiedRef.current === user.id) return;

        const now = Math.floor(Date.now() / 1000);
        const jwt = await signJwt(
          {
            user_id: user.id,
            email: user.email ?? undefined,
            iat: now,
            exp: now + 3600,
          },
          API_SECRET,
        );

        if (cancelled) return;

        // Update Intercom with the logged-in user's identity
        window.Intercom("update", {
          app_id: APP_ID,
          intercom_user_jwt: jwt,
          name:
            profile?.display_name ??
            profile?.username ??
            user.email?.split("@")[0] ??
            undefined,
        });
        identifiedRef.current = user.id;
      } else {
        // User logged out — reset to visitor
        if (identifiedRef.current !== null) {
          window.Intercom("shutdown");
          // Re-boot as visitor so launcher stays visible
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

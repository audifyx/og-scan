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

  // Decode the base64url-encoded secret
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
 * Keeps the Intercom / Fin messenger in sync with the current auth state,
 * using JWT identity verification for logged-in users.
 */
export function useIntercom() {
  const { user, profile } = useAuth();
  const bootedRef = useRef<string | null>(null); // tracks which user we've booted for

  useEffect(() => {
    if (typeof window.Intercom !== "function") return;
    let cancelled = false;

    async function boot() {
      if (user) {
        // Skip if already booted for this user
        if (bootedRef.current === user.id) return;

        const now = Math.floor(Date.now() / 1000);
        const jwt = await signJwt(
          {
            user_id: user.id,
            email: user.email ?? undefined,
            iat: now,
            exp: now + 3600, // 1 hour
          },
          API_SECRET,
        );

        if (cancelled) return;

        window.Intercom("boot", {
          api_base: "https://api-iam.intercom.io",
          app_id: APP_ID,
          intercom_user_jwt: jwt,
          name:
            profile?.display_name ??
            profile?.username ??
            user.email?.split("@")[0] ??
            undefined,
          session_duration: 86400000, // 1 day
          vertical_padding: 80, // push above mobile bottom nav
        });
        bootedRef.current = user.id;
      } else {
        // Visitor mode
        if (bootedRef.current !== null) {
          window.Intercom("shutdown");
        }
        window.Intercom("boot", {
          api_base: "https://api-iam.intercom.io",
          app_id: APP_ID,
          vertical_padding: 80, // push above mobile bottom nav
        });
        bootedRef.current = null;
      }
    }

    boot();

    return () => {
      cancelled = true;
    };
  }, [user, profile]);

  // Shutdown on unmount
  useEffect(() => {
    return () => {
      if (typeof window.Intercom === "function") {
        window.Intercom("shutdown");
      }
    };
  }, []);
}

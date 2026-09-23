import { createClient } from "@supabase/supabase-js";
import { supabaseAwareFetch } from "@/lib/fetchTimeout";

// Shared Supabase project — syncs data across web + mobile
// Project: ffjipnkhcebjvttliptb
const env = import.meta.env as Record<string, string | undefined>;

export const SUPABASE_URL =
  env.VITE_SUPABASE_URL || env.REACT_APP_SUPABASE_URL || "";

export const SUPABASE_ANON_KEY =
  env.VITE_SUPABASE_ANON_KEY || env.REACT_APP_SUPABASE_ANON_KEY || "";

// Guard: when env vars are missing (e.g. not set in the deployment), createClient
// throws "supabaseUrl is required" at import time, which white-screens the ENTIRE
// app and every route. Fall back to harmless placeholders so the app shell + routing
// still render; auth/data calls will fail gracefully instead of crashing the SPA.
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  // eslint-disable-next-line no-console
  console.error(
    "[supabase] Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. " +
      "Auth and data features are disabled. Set them in your Vercel project env."
  );
}

if (typeof window !== "undefined") {
  try {
    const next = "orbitx-auth";
    const prev = "sol-tools-auth";
    if (!window.localStorage.getItem(next) && window.localStorage.getItem(prev)) {
      window.localStorage.setItem(next, window.localStorage.getItem(prev) || "");
    }
  } catch {
    /* ignore */
  }
}

export const supabase = createClient(
  SUPABASE_URL || "https://placeholder.supabase.co",
  SUPABASE_ANON_KEY || "placeholder-anon-key",
  {
  global: {
    fetch: supabaseAwareFetch,
  },
  auth: {
    storage: localStorage,
    storageKey: "orbitx-auth",
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  realtime: {
    params: { eventsPerSecond: 10 },
  },
  }
);

import { createClient } from "@supabase/supabase-js";

// Shared Supabase project — syncs data across web + mobile
// Project: ffjipnkhcebjvttliptb
export const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || "";

export const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY || "";

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

export const supabase = createClient(
  SUPABASE_URL || "https://placeholder.supabase.co",
  SUPABASE_ANON_KEY || "placeholder-anon-key",
  {
  auth: {
    storage: localStorage,
    storageKey: "sol-tools-auth",
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  realtime: {
    params: { eventsPerSecond: 10 },
  },
  }
);

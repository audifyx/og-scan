import { createClient } from "@supabase/supabase-js";

// Shared Supabase project — syncs data across web + mobile
// Project: ffjipnkhcebjvttliptb
export const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || "";

export const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY || "";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
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
});

import { createClient } from "@supabase/supabase-js";

// Shared Supabase project — syncs data across web + mobile
// Project: ffjipnkhcebjvttliptb
export const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ?? "https://ffjipnkhcebjvttliptb.supabase.co";

export const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZmamlwbmtoY2ViandqdHRsaXB0YiIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNjk0Nzc2OTY3LCJleHAiOjE5MTAzNTI5Njd9.mB9HXVL-pLJQl2Y9KXzI8_8_K8X9L7M0N1O2P3Q4R5S";

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

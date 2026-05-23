import { createClient } from "@supabase/supabase-js";

// Shared Supabase project — syncs data across web + mobile
// Project: ffjipnkhcebjvttliptb
export const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ?? "https://ffjipnkhcebjvttliptb.supabase.co";

export const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZmamlwbmtoY2VianZ0dGxpcHRiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1Mjc5NDgsImV4cCI6MjA5MzEwMzk0OH0.***REMOVED_ANON_SIG***";

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

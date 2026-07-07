import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";

const STORAGE_KEY = "og-onboarding-seen-v1";

/**
 * Gates the welcome tour to first-time logged-in users only.
 * Purely additive: reads/writes a single localStorage key, touches no
 * existing app state, and fails silently if localStorage is unavailable.
 */
export function useOnboardingTour() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    try {
      const seen = localStorage.getItem(STORAGE_KEY);
      if (!seen) setOpen(true);
    } catch {
      // localStorage unavailable (private mode, etc.) - skip tour, never throw
    }
  }, [user]);

  const dismiss = () => {
    setOpen(false);
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // best-effort only
    }
  };

  return { open, dismiss };
}

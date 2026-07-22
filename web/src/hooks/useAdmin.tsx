import { useEffect, useState } from "react";
import { useAuth } from "./useAuth";

const OWNER_EMAILS = ["audifyx@gmail.com", "beatsbyaid3n@gmail.com"];
const OWNER_EMAIL = OWNER_EMAILS[0];

/** ── Admin passcode unlock (same pattern as the DEX admin) ────────────────
 * Entering the passcode on any admin surface unlocks every admin dashboard
 * for the browser session — no wallet / login required. Owner emails still
 * unlock automatically when signed in. */
export const ADMIN_UNLOCK_KEY = "orbitx_admin_unlocked";
export const ADMIN_UNLOCK_EVENT = "orbitx-admin-unlock";

export function isAdminUnlocked(): boolean {
  try { return sessionStorage.getItem(ADMIN_UNLOCK_KEY) === "true"; } catch { return false; }
}

export function setAdminUnlocked(unlocked: boolean): void {
  try {
    if (unlocked) sessionStorage.setItem(ADMIN_UNLOCK_KEY, "true");
    else sessionStorage.removeItem(ADMIN_UNLOCK_KEY);
    window.dispatchEvent(new Event(ADMIN_UNLOCK_EVENT));
  } catch { /* storage unavailable — ignore */ }
}

export const useAdmin = () => {
  const { user, profile, loading: authLoading } = useAuth();
  const [unlocked, setUnlocked] = useState<boolean>(isAdminUnlocked());

  useEffect(() => {
    const sync = () => setUnlocked(isAdminUnlocked());
    window.addEventListener(ADMIN_UNLOCK_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(ADMIN_UNLOCK_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const ownerMatch = !!user?.email && OWNER_EMAILS.includes(user.email.toLowerCase());
  const officialTeamMatch = Boolean(profile?.is_official_account || profile?.affiliate_org_id);
  const isOwner = ownerMatch || unlocked;

  return {
    isAdmin: isOwner,
    isOwner,
    isSupportAgent: isOwner || officialTeamMatch,
    loading: authLoading && !unlocked,
    ownerEmail: OWNER_EMAIL,
  };
};

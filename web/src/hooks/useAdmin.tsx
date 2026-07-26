import { useEffect, useState } from "react";
import { useAuth } from "./useAuth";
import {
  OWNER_DESK_UNLOCK_EVENT,
  OWNER_DESK_UNLOCK_KEY,
  OWNER_EMAIL,
  OWNER_EMAILS,
} from "@/lib/ownerDesk";

/** @deprecated use OWNER_DESK_UNLOCK_KEY — kept so old session keys clear cleanly */
export const ADMIN_UNLOCK_KEY = OWNER_DESK_UNLOCK_KEY;
export const ADMIN_UNLOCK_EVENT = OWNER_DESK_UNLOCK_EVENT;

export function isAdminUnlocked(): boolean {
  try {
    return sessionStorage.getItem(OWNER_DESK_UNLOCK_KEY) === "true";
  } catch {
    return false;
  }
}

export function setAdminUnlocked(unlocked: boolean): void {
  try {
    if (unlocked) sessionStorage.setItem(OWNER_DESK_UNLOCK_KEY, "true");
    else sessionStorage.removeItem(OWNER_DESK_UNLOCK_KEY);
    // Clear legacy key from older soft-gate
    sessionStorage.removeItem("orbitx_admin_unlocked");
    window.dispatchEvent(new Event(OWNER_DESK_UNLOCK_EVENT));
  } catch {
    /* storage unavailable */
  }
}

export const useAdmin = () => {
  const { user, profile, loading: authLoading } = useAuth();
  const [unlocked, setUnlocked] = useState<boolean>(isAdminUnlocked());

  useEffect(() => {
    const sync = () => setUnlocked(isAdminUnlocked());
    window.addEventListener(OWNER_DESK_UNLOCK_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(OWNER_DESK_UNLOCK_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const email = (user?.email || "").toLowerCase();
  const ownerMatch = !!email && (OWNER_EMAILS as readonly string[]).includes(email);
  const officialTeamMatch = Boolean(profile?.is_official_account || profile?.affiliate_org_id);

  // Desk requires BOTH the manual code unlock and the owner account.
  const isOwner = ownerMatch && unlocked;

  return {
    isAdmin: isOwner,
    isOwner,
    deskUnlocked: unlocked,
    isSupportAgent: isOwner || officialTeamMatch,
    loading: authLoading && !unlocked,
    ownerEmail: OWNER_EMAIL,
  };
};

import { useEffect, useState } from "react";
import { useAuth } from "./useAuth";
import { isOwnerEmail } from "@/lib/ownerDesk";
import {
  DESK_UNLOCK_EVENT,
  clearDeskUnlock,
  hasDeskSession,
} from "../../shared/desk-unlock-client.js";

/** @deprecated use hasDeskSession — kept so old session keys clear cleanly */
export const ADMIN_UNLOCK_KEY = "ox_desk_sess_v2";
export const ADMIN_UNLOCK_EVENT = DESK_UNLOCK_EVENT;

export function isAdminUnlocked(): boolean {
  return hasDeskSession();
}

export function setAdminUnlocked(unlocked: boolean): void {
  if (!unlocked) clearDeskUnlock();
}

export const useAdmin = () => {
  const { user, profile, loading: authLoading } = useAuth();
  const [unlocked, setUnlocked] = useState<boolean>(isAdminUnlocked());

  useEffect(() => {
    const sync = () => setUnlocked(isAdminUnlocked());
    window.addEventListener(DESK_UNLOCK_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(DESK_UNLOCK_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const ownerMatch = isOwnerEmail(user?.email);
  const isOwner = ownerMatch && unlocked;

  return {
    isAdmin: isOwner,
    isOwner,
    /** True when signed in with the owner email account (ignores desk code and wallet). */
    isOwnerIdentity: ownerMatch,
    deskUnlocked: unlocked,
    isSupportAgent: isOwner || Boolean(profile?.is_official_account || profile?.affiliate_org_id),
    loading: authLoading && !unlocked,
    ownerEmail: "",
    ownerWallet: null,
  };
};

import { useEffect, useState } from "react";
import { useAuth } from "./useAuth";
import { useWallet } from "@solana/wallet-adapter-react";
import {
  OWNER_DESK_UNLOCK_EVENT,
  OWNER_DESK_UNLOCK_KEY,
  OWNER_EMAIL,
  isOwnerIdentity,
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
    sessionStorage.removeItem("orbitx_admin_unlocked");
    window.dispatchEvent(new Event(OWNER_DESK_UNLOCK_EVENT));
  } catch {
    /* storage unavailable */
  }
}

function walletFromUser(user: { email?: string | null; user_metadata?: Record<string, unknown> } | null, profile: { sol_wallet?: string | null } | null, connectedPk?: string | null): string | null {
  if (connectedPk) return connectedPk;
  const meta = user?.user_metadata?.wallet;
  if (typeof meta === "string" && meta.length > 20) return meta;
  if (profile?.sol_wallet) return profile.sol_wallet;
  const email = (user?.email || "").toLowerCase();
  const m = email.match(/^([1-9a-zA-Z]{32,44})@wallet\.orbitx\.app$/i);
  return m?.[1] ?? null;
}

export const useAdmin = () => {
  const { user, profile, loading: authLoading } = useAuth();
  const { publicKey } = useWallet();
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

  const connectedPk = publicKey?.toBase58() ?? null;
  const wallet = walletFromUser(
    user,
    profile as { sol_wallet?: string | null } | null,
    connectedPk,
  );

  const ownerMatch = isOwnerIdentity({ email: user?.email, wallet });
  // Desk requires BOTH the manual code unlock and owner identity (email or wallet).
  const isOwner = ownerMatch && unlocked;

  return {
    isAdmin: isOwner,
    isOwner,
    deskUnlocked: unlocked,
    isSupportAgent: isOwner || Boolean(profile?.is_official_account || profile?.affiliate_org_id),
    loading: authLoading && !unlocked,
    ownerEmail: OWNER_EMAIL,
    ownerWallet: wallet,
  };
};

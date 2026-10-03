import { useCallback, useEffect, useState } from "react";
import { useAdmin } from "@/hooks/useAdmin";

const KEY = "ox_stealth_admin_visible";
const EVT = "ox:stealth-admin-toggle";

function read(): boolean {
  try {
    return sessionStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * Stealth admin visibility toggle.
 *
 * Default is HIDDEN — even for the owner — so screenshots and demo videos
 * are clean out of the box. A secret in-app gesture (see the app wheel's
 * orbit core) flips it; the choice lives in sessionStorage so a fresh
 * load/tab always starts clean.
 *
 * `stealthAdminVisible` is true only when the viewer is the owner identity
 * AND the toggle is on. Gate admin-only UI (Coming Soon button, admin
 * badges/panels) on this, not on bare isOwnerIdentity.
 */
export function useStealthAdmin() {
  const { isOwnerIdentity } = useAdmin();
  const [visible, setVisible] = useState<boolean>(read);

  useEffect(() => {
    const sync = () => setVisible(read());
    window.addEventListener(EVT, sync);
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) sync();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(EVT, sync);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const toggleStealthAdmin = useCallback(() => {
    // Silently ignore for non-owners: discovering the gesture reveals nothing.
    if (!isOwnerIdentity) return;
    const next = !read();
    try {
      if (next) sessionStorage.setItem(KEY, "1");
      else sessionStorage.removeItem(KEY);
    } catch {
      /* storage may be unavailable */
    }
    setVisible(next);
    window.dispatchEvent(new Event(EVT));
  }, [isOwnerIdentity]);

  return {
    /** True only for the owner with the stealth toggle on. Gate admin UI on this. */
    stealthAdminVisible: Boolean(isOwnerIdentity) && visible,
    toggleStealthAdmin,
  };
}

/**
 * Guest mode + streamer mode (ideas 35 + 36).
 *
 * Guest mode: demo the platform without an account. Launches are
 * intercepted with a demo notice; a banner marks the session.
 *   data-guest-mode="on" on <html>
 *
 * Streamer mode: hides balances for screenshots/streams. Sets
 *   data-streamer-mode="on" on <html>
 * and CSS masks any element matching STREAMER_SENSITIVE_SELECTORS
 * (platform components opt in by adding `data-sensitive` — the
 * selector list below covers the common cases).
 */

export const GUEST_KEY = "orbitx-guest-mode";
export const STREAMER_KEY = "orbitx-streamer-mode";

/**
 * Selectors masked while streamer mode is on.
 * Add your component's balance selector here (or just add
 * data-sensitive to the element) and it hides platform-wide.
 */
export const STREAMER_SENSITIVE_SELECTORS = [
  "[data-sensitive]",
  ".dt-balance",
  ".balance-amount",
  ".wallet-balance",
  ".pnl-value",
  ".portfolio-value",
].join(", ");

function flag(key: string): boolean {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function setFlag(key: string, v: boolean) {
  try {
    localStorage.setItem(key, v ? "1" : "0");
  } catch {
    /* ignore */
  }
}

export function isGuestMode(): boolean {
  return flag(GUEST_KEY);
}
export function isStreamerMode(): boolean {
  return flag(STREAMER_KEY);
}

/** Apply both mode flags to <html> (call on boot + on change). */
export function applyModes() {
  if (typeof document === "undefined") return;
  const el = document.documentElement;
  if (isGuestMode()) el.dataset.guestMode = "on";
  else delete el.dataset.guestMode;
  if (isStreamerMode()) el.dataset.streamerMode = "on";
  else delete el.dataset.streamerMode;
  try {
    window.dispatchEvent(
      new CustomEvent("orbitx:modes", {
        detail: { guest: isGuestMode(), streamer: isStreamerMode() },
      })
    );
  } catch {
    /* ignore */
  }
}

export function setGuestMode(v: boolean) {
  setFlag(GUEST_KEY, v);
  applyModes();
}

export function setStreamerMode(v: boolean) {
  setFlag(STREAMER_KEY, v);
  applyModes();
}

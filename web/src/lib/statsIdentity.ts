// Stable, privacy-preserving visitor identity for live stats.
//
// Signed-in users are counted ONCE across devices/browsers: the tracker sends
// a one-way hash of the account ID instead of a per-browser random UUID, so
// the same person on desktop + phone counts as one visitor (one live row).
// The RAW user ID is never sent to the stats backend and never stored here —
// only the first 32 hex chars of SHA-256("orbitx-stats:" + userId).

export const STATS_UID_KEY = "orbitx_uid";

const SALT = "orbitx-stats:";

function hex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Store the hashed identity for the signed-in user. Fire-and-forget: never breaks auth. */
export async function setStatsIdentity(userId: string): Promise<void> {
  if (!userId || typeof window === "undefined") return;
  try {
    const subtle = window.crypto?.subtle;
    if (!subtle) return; // non-secure context: stay anonymous, tracker falls back
    const digest = await subtle.digest("SHA-256", new TextEncoder().encode(SALT + userId));
    const id = hex(digest).slice(0, 32);
    try {
      window.localStorage.setItem(STATS_UID_KEY, id);
    } catch {
      /* private mode / storage blocked */
    }
  } catch {
    /* never break auth for stats */
  }
}

/** Drop the hashed identity (sign-out). The tracker falls back to the anonymous ID. */
export function clearStatsIdentity(): void {
  try {
    window.localStorage.removeItem(STATS_UID_KEY);
  } catch {
    /* noop */
  }
}

export function getStatsIdentity(): string | null {
  try {
    return window.localStorage.getItem(STATS_UID_KEY);
  } catch {
    return null;
  }
}

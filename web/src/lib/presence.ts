import { useEffect, useState } from "react";

/**
 * Single source of truth for user online status.
 *
 * Writer: usePresence() heartbeats profiles.is_online + last_seen_at/last_active_at
 * every PRESENCE_HEARTBEAT_MS while the tab is visible, and marks offline via a
 * keepalive request on hide/unload.
 *
 * Readers: NEVER trust profiles.is_online alone — a crashed browser or killed
 * mobile app leaves it stuck at true. Always call isUserOnline(), which also
 * requires a fresh heartbeat timestamp within PRESENCE_STALE_MS.
 */

export const PRESENCE_HEARTBEAT_MS = 15_000;
/** 4 missed heartbeats ⇒ offline, even if is_online was left stuck at true. */
export const PRESENCE_STALE_MS = 60_000;

export interface PresenceLike {
  is_online?: boolean | null;
  last_active_at?: string | null;
  last_seen_at?: string | null;
}

export function presenceTimestamp(p?: PresenceLike | null): string | null {
  return p?.last_active_at || p?.last_seen_at || null;
}

export function isUserOnline(p?: PresenceLike | null, now: number = Date.now()): boolean {
  if (!p) return false;
  if (p.is_online === false) return false;
  const ts = presenceTimestamp(p);
  if (!ts) return Boolean(p.is_online); // legacy rows without timestamps
  const seenAt = new Date(ts).getTime();
  if (Number.isNaN(seenAt)) return Boolean(p.is_online);
  return now - seenAt <= PRESENCE_STALE_MS;
}

/** Re-render helper so "online" dots go stale in real time without new data. */
export function usePresenceTick(intervalMs: number = 30_000): number {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return tick;
}

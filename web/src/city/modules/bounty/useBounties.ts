import { useMemo, useSyncExternalStore } from "react";
import { getBountyStore } from "./store";
import type { BountyStore } from "./store";

/**
 * Binds the shared BountyStore to React. Snapshot is the store's monotonic
 * revision, so re-renders only happen on real mutations (never on reads).
 */
export function useBountyStore(): BountyStore {
  const store = useMemo(() => getBountyStore(), []);
  useSyncExternalStore(
    (onChange) => store.subscribe(onChange),
    () => store.getRevision(),
    () => store.getRevision()
  );
  return store;
}

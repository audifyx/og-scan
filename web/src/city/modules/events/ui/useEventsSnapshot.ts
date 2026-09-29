/**
 * OrbitXCity — Events module: React binding for the EventsSystem.
 *
 * Subscribes to the system's pub/sub and re-renders on snapshot changes.
 * Self-contained: no imports outside this module.
 */

import { useEffect, useState } from "react";
import type { EventsSnapshot, EventsSystem } from "../system";

export function useEventsSnapshot(system: EventsSystem): EventsSnapshot {
  const [snapshot, setSnapshot] = useState<EventsSnapshot>(() => system.getSnapshot());
  useEffect(() => {
    setSnapshot(system.getSnapshot());
    return system.subscribe(() => setSnapshot(system.getSnapshot()));
  }, [system]);
  return snapshot;
}

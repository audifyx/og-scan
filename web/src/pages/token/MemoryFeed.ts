import { useEffect, useRef, useState } from "react";

export interface BurnMilestoneState {
  milestone: number;
  isNew: boolean;
}

const STEP = 5_000_000;
const NEW_WINDOW_MS = 8_000;

/**
 * Tracks ORBITX burn milestones: every 5M tokens burned.
 *
 * - `milestone` is the largest 5M multiple at or below `burned`.
 * - `isNew` is true for ~8s right after `milestone` increases.
 * - On first mount the hook initializes silently (isNew=false).
 */
export function useBurnMilestones(
  burned: number | null | undefined,
): BurnMilestoneState {
  const milestone = Math.floor((burned ?? 0) / STEP) * STEP;
  const prevRef = useRef<number | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isNew, setIsNew] = useState(false);

  useEffect(() => {
    if (prevRef.current === null) {
      // First mount: initialize silently.
      prevRef.current = milestone;
      return;
    }
    if (milestone > prevRef.current) {
      prevRef.current = milestone;
      setIsNew(true);
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        timeoutRef.current = null;
        setIsNew(false);
      }, NEW_WINDOW_MS);
    }
    // Intentionally not reacting to decreases; milestone is the floor,
    // so a decrease below the current multiple already changes milestone.
  }, [milestone]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, []);

  return { milestone, isNew };
}

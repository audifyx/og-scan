/**
 * useCarMeet — weekly docks car-meet entries (paper CITY). One entry per
 * player per week; prize pool = entry fees; judging deterministic.
 */

import { useCallback, useState } from "react";
import { paperLedger } from "../engine/paperLedger";
import {
  CAR_MEET_ENTRY_FEE_CITY,
  NPC_MEET_ENTRIES,
  currentMeetId,
  judgeMeet,
  type JudgedEntry,
} from "../engine/carMeetEngine";
import type { CarMeetEntry } from "../types";

const KEY = "orbitxcity.social.carmeet.v1";

interface Persist {
  [meetId: string]: { entries: CarMeetEntry[]; judged: JudgedEntry[] | null };
}

function load(): Persist {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as Persist;
  } catch {
    /* fresh */
  }
  return {};
}

function save(p: Persist) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* blocked */
  }
}

export function useCarMeet(playerName: string, playerHandle: string) {
  const meetId = currentMeetId();
  const [persist, setPersist] = useState<Persist>(load);

  const slot = persist[meetId] ?? { entries: [], judged: null };

  const enter = useCallback(
    (car: string, category: string): boolean => {
      const name = car.trim().slice(0, 40);
      if (!name) return false;
      const mine = (persist[meetId]?.entries ?? []).some((e) => !e.npc);
      if (mine) return false; // one entry per player per week
      if (!paperLedger.spend(CAR_MEET_ENTRY_FEE_CITY, `Car meet entry — ${name}`)) return false;
      const entry: CarMeetEntry & { category: string } = {
        id: crypto.randomUUID(),
        owner: playerName,
        ownerHandle: playerHandle,
        car: name,
        npc: false,
        category,
      };
      const next = {
        ...persist,
        [meetId]: {
          entries: [...(persist[meetId]?.entries ?? []), entry],
          judged: null,
        },
      };
      setPersist(next);
      save(next);
      return true;
    },
    [persist, meetId, playerName, playerHandle]
  );

  /** Seed NPC regulars + judge. Called when the meet window closes (or by UI). */
  const judge = useCallback((): JudgedEntry[] => {
    const existing = persist[meetId]?.entries ?? [];
    const npcs: CarMeetEntry[] = NPC_MEET_ENTRIES.map((n, i) => ({
      id: `npc-${meetId}-${i}`,
      owner: n.owner,
      ownerHandle: n.ownerHandle,
      car: n.car,
      npc: true,
      category: n.category,
    })) as CarMeetEntry[];
    const all = [...existing, ...npcs];
    const judged = judgeMeet(meetId, all);
    // pay the player's prize if they placed
    const mine = judged.find((j) => !j.npc);
    if (mine && mine.prizeCity > 0) {
      paperLedger.earn(mine.prizeCity, `Car meet prize — ${mine.car} (#${judged.indexOf(mine) + 1})`);
    }
    const next = { ...persist, [meetId]: { entries: all, judged } };
    setPersist(next);
    save(next);
    return judged;
  }, [persist, meetId]);

  const myEntry = slot.entries.find((e) => !e.npc) ?? null;

  return {
    meetId,
    entries: slot.entries,
    judged: slot.judged,
    myEntry,
    enter,
    judge,
    entryFee: CAR_MEET_ENTRY_FEE_CITY,
  };
}

/**
 * useComedy — comedy club: NPC sets + player open-mic signup/recording.
 * Slots persist per week; recordings are session-scoped blob URLs
 * (persistence gap documented in MODULE.md).
 */

import { useCallback, useState } from "react";
import { COMEDY_SETS, npcById } from "../data/socialData";
import { npcCrowdScore, playerCrowdScore, startSetRecording, type RecordedSet } from "../engine/comedyEngine";
import { currentMeetId } from "../engine/carMeetEngine"; // weekly-id math reused
import type { ComedySet, OpenMicSlot } from "../types";

const SLOTS_KEY = "orbitxcity.social.openmic.v1";

function loadSlots(): Record<string, OpenMicSlot[]> {
  try {
    const raw = localStorage.getItem(SLOTS_KEY);
    if (raw) return JSON.parse(raw) as Record<string, OpenMicSlot[]>;
  } catch {
    /* fresh */
  }
  return {};
}

function saveSlots(s: Record<string, OpenMicSlot[]>) {
  try {
    localStorage.setItem(SLOTS_KEY, JSON.stringify(s));
  } catch {
    /* blocked */
  }
}

export interface NpcSetView extends ComedySet {
  comicHandle: string;
  comicInitials: string;
  comicHue: number;
}

export function useComedy(playerName: string) {
  const weekId = currentMeetId(); // weekly bucket, same math
  const [slotsByWeek, setSlotsByWeek] = useState<Record<string, OpenMicSlot[]>>(loadSlots);
  const [recording, setRecording] = useState(false);
  const [recElapsed, setRecElapsed] = useState(0);
  const [recError, setRecError] = useState<string | null>(null);

  const npcSets: NpcSetView[] = COMEDY_SETS.map((s, i) => {
    const npc = npcById(s.comicId);
    return {
      id: `npcset-${i}`,
      comicId: s.comicId,
      comicName: npc?.name ?? s.comicId,
      title: s.title,
      lines: s.lines,
      crowdRating: npcCrowdScore(`npcset-${i}`),
      ts: Date.now() - i * 3600_000,
      comicHandle: npc?.handle ?? "",
      comicInitials: npc?.initials ?? "??",
      comicHue: npc?.hue ?? 0,
    };
  });

  const slots = slotsByWeek[weekId] ?? [];

  const signUp = useCallback(
    (title: string): boolean => {
      const t = title.trim().slice(0, 60);
      if (!t) return false;
      if (slots.some((s) => s.playerName === playerName)) return false;
      const slot: OpenMicSlot = { id: crypto.randomUUID(), playerName, title: t, ts: Date.now() };
      const next = { ...slotsByWeek, [weekId]: [...slots, slot] };
      setSlotsByWeek(next);
      saveSlots(next);
      return true;
    },
    [slots, slotsByWeek, weekId, playerName]
  );

  const attachRecording = useCallback(
    (slotId: string, rec: RecordedSet, crowdRating: number) => {
      const next: Record<string, OpenMicSlot[]> = {
        ...slotsByWeek,
        [weekId]: (slotsByWeek[weekId] ?? []).map((s) =>
          s.id === slotId ? { ...s, audioUrl: rec.blobUrl } : s
        ),
      };
      void crowdRating;
      setSlotsByWeek(next);
      saveSlots(next);
    },
    [slotsByWeek, weekId]
  );

  const recordForSlot = useCallback(
    async (slotId: string) => {
      setRecError(null);
      setRecording(true);
      setRecElapsed(0);
      try {
        const h = await startSetRecording(300);
        h.onTick((ms) => setRecElapsed(ms));
        const done = h.done.then((rec) => {
          const score = playerCrowdScore(rec.durationMs);
          attachRecording(slotId, rec, score);
          setRecording(false);
          return { rec, score };
        });
        return { stop: h.stop, done };
      } catch (e) {
        setRecError(e instanceof Error ? e.message : "Mic unavailable.");
        setRecording(false);
        return null;
      }
    },
    [attachRecording]
  );

  const mySlot = slots.find((s) => s.playerName === playerName) ?? null;

  return {
    npcSets,
    slots,
    mySlot,
    signUp,
    recordForSlot,
    recording,
    recElapsed,
    recError,
  };
}

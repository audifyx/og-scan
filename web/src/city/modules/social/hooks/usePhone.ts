/**
 * usePhone — in-game phone state: contacts, threads, calls, photos.
 * Persisted to localStorage (per-device). NPC text replies are scripted
 * canned lines delivered after a delay (no LLM — this is a game phone).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CALL_SCRIPTS, PHONE_CONTACTS, npcById } from "../data/socialData";
import type { PhoneCall, PhoneContact, PhoneMessage, PhonePhoto } from "../types";

const KEY = "orbitxcity.social.phone.v1";

const NPC_TEXT_REPLIES: Record<string, string[]> = {
  dexdegen: [
    "bro the chart is literally talking to me rn",
    "paper hands could never. anyway wassup",
    "meet me at the docks saturday, bring opinions",
  ],
  nia_kade: [
    "On air in 10 — make it quick, citizen.",
    "That's a great tip. Channel 6 may run it. Anonymously, obviously.",
  ],
  dj_neon: [
    "NEON VICE CANNOT COME TO THE PHONE RN (dj emoji) but text me",
    "rooftop friday. be there. that's the whole text.",
  ],
  vice_vic: [
    "vic here. what's the word",
    "i know a guy. i always know a guy.",
  ],
  turbo_tess: [
    "TESS. if this is about my car the answer is yes it's fast",
    "docks saturday. don't be slow.",
  ],
  lou_laughs: [
    "lol. that's going in the set.",
    "open mic tuesday. come heckle, i need material",
  ],
};
const GENERIC_REPLIES = ["lol noted", "say less", "copy that", "bet"];

interface Persist {
  threads: Record<string, PhoneMessage[]>;
  photos: PhonePhoto[];
}

function load(): Persist {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw) as Persist;
      if (s.threads && Array.isArray(s.photos)) return s;
    }
  } catch {
    /* fresh phone */
  }
  return { threads: {}, photos: [] };
}

export function usePhone(playerName: string) {
  const [persist, setPersist] = useState<Persist>(load);
  const [activeCall, setActiveCall] = useState<PhoneCall | null>(null);
  const [callScriptIdx, setCallScriptIdx] = useState(0);
  const [incoming, setIncoming] = useState<PhoneCall | null>(null);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(persist));
    } catch {
      /* storage blocked */
    }
  }, [persist]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const contacts: PhoneContact[] = useMemo(
    () =>
      PHONE_CONTACTS.map((c, i) => ({
        id: c.id,
        name: c.name,
        npcId: c.npcId,
        number: c.number,
        online: (Date.now() / 60000 + i * 37) % 3 !== 0,
      })),
    []
  );

  const sendText = useCallback(
    (contactId: string, text: string) => {
      const t = text.trim();
      if (!t) return;
      const mine: PhoneMessage = {
        id: crypto.randomUUID(),
        contactId,
        fromMe: true,
        text: t.slice(0, 280),
        ts: Date.now(),
      };
      setPersist((p) => ({
        ...p,
        threads: { ...p.threads, [contactId]: [...(p.threads[contactId] ?? []), mine] },
      }));
      // scripted NPC reply
      const npcId = PHONE_CONTACTS.find((c) => c.id === contactId)?.npcId ?? "";
      const pool = NPC_TEXT_REPLIES[npcId] ?? GENERIC_REPLIES;
      const reply = pool[Math.floor(Math.random() * pool.length)];
      const npc = npcById(npcId);
      const timer = window.setTimeout(() => {
        setPersist((p) => ({
          ...p,
          threads: {
            ...p.threads,
            [contactId]: [
              ...(p.threads[contactId] ?? []),
              {
                id: crypto.randomUUID(),
                contactId,
                fromMe: false,
                text: reply,
                ts: Date.now(),
              },
            ],
          },
        }));
        void npc;
      }, 1800 + Math.random() * 2600);
      timers.current.push(timer);
    },
    []
  );

  const startCall = useCallback((contactId: string) => {
    const call: PhoneCall = {
      id: crypto.randomUUID(),
      contactId,
      direction: "out",
      status: "ringing",
      startedAt: Date.now(),
    };
    setActiveCall(call);
    setCallScriptIdx(0);
    const npcId = PHONE_CONTACTS.find((c) => c.id === contactId)?.npcId ?? "";
    const t1 = window.setTimeout(() => {
      setActiveCall((c) => (c && c.id === call.id ? { ...c, status: "active" } : c));
    }, 2200);
    timers.current.push(t1);
    void npcId;
    void playerName;
  }, [playerName]);

  const advanceCallScript = useCallback(() => {
    setCallScriptIdx((i) => i + 1);
  }, []);

  const endCall = useCallback(() => {
    setActiveCall((c) =>
      c ? { ...c, status: c.status === "active" ? "ended" : "missed", endedAt: Date.now() } : c
    );
    const t = window.setTimeout(() => setActiveCall(null), 1200);
    timers.current.push(t);
  }, []);

  /** Simulate an incoming NPC call (triggered by the phone UI on a timer). */
  const simulateIncoming = useCallback(() => {
    if (activeCall || incoming) return;
    const c = PHONE_CONTACTS[Math.floor(Math.random() * PHONE_CONTACTS.length)];
    setIncoming({
      id: crypto.randomUUID(),
      contactId: c.id,
      direction: "in",
      status: "ringing",
      startedAt: Date.now(),
    });
  }, [activeCall, incoming]);

  const answerIncoming = useCallback(() => {
    if (!incoming) return;
    setActiveCall({ ...incoming, status: "active" });
    setCallScriptIdx(0);
    setIncoming(null);
  }, [incoming]);

  const declineIncoming = useCallback(() => {
    setIncoming((c) => (c ? { ...c, status: "missed", endedAt: Date.now() } : c));
    const t = window.setTimeout(() => setIncoming(null), 1500);
    timers.current.push(t);
  }, []);

  const callScript = useMemo(() => {
    if (!activeCall || activeCall.status !== "active") return [];
    const npcId = PHONE_CONTACTS.find((c) => c.id === activeCall.contactId)?.npcId ?? "";
    return CALL_SCRIPTS[npcId] ?? ["..."];
  }, [activeCall]);

  const addPhoto = useCallback((dataUrl: string, caption: string) => {
    const photo: PhonePhoto = { id: crypto.randomUUID(), dataUrl, caption, ts: Date.now() };
    setPersist((p) => ({ ...p, photos: [photo, ...p.photos].slice(0, 60) }));
    return photo;
  }, []);

  const deletePhoto = useCallback((id: string) => {
    setPersist((p) => ({ ...p, photos: p.photos.filter((x) => x.id !== id) }));
  }, []);

  return {
    contacts,
    threads: persist.threads,
    photos: persist.photos,
    sendText,
    activeCall,
    callScript,
    callScriptIdx,
    advanceCallScript,
    startCall,
    endCall,
    incoming,
    simulateIncoming,
    answerIncoming,
    declineIncoming,
    addPhoto,
    deletePhoto,
  };
}

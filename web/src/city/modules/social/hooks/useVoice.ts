/**
 * useVoice — UI state for voice channels (campfire, open mic, party).
 * Wraps the VoiceProvider seam from engine/voiceArchitecture.ts.
 * Defaults to LocalVoiceStub; the integrator can inject LiveKit later.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  createVoiceProvider,
  type VoiceParticipant,
  type VoiceProvider,
} from "../engine/voiceArchitecture";
import type { VoiceChannelKind } from "../types";

export interface UseVoiceOpts {
  makeProvider?: () => VoiceProvider;
}

export function useVoice(opts: UseVoiceOpts = {}) {
  const providerRef = useRef<VoiceProvider | null>(null);
  const [channelId, setChannelId] = useState<string | null>(null);
  const [kind, setKind] = useState<VoiceChannelKind>("campfire");
  const [participants, setParticipants] = useState<VoiceParticipant[]>([]);
  const [level, setLevel] = useState(0);
  const [muted, setMuted] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(
    () => () => {
      providerRef.current?.leave().catch(() => undefined);
    },
    []
  );

  const join = useCallback(
    async (id: string, k: VoiceChannelKind, identity: string) => {
      if (channelId) return;
      setJoining(true);
      setError(null);
      try {
        const p = (opts.makeProvider ?? createVoiceProvider)();
        providerRef.current = p;
        p.onParticipants(setParticipants);
        p.onLevel(setLevel);
        await p.join(id, identity);
        p.setMuted(true); // mute-by-default (GAP-3 consent posture)
        setMuted(true);
        setChannelId(id);
        setKind(k);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not join voice.");
        providerRef.current = null;
      } finally {
        setJoining(false);
      }
    },
    [channelId, opts]
  );

  const leave = useCallback(async () => {
    await providerRef.current?.leave().catch(() => undefined);
    providerRef.current = null;
    setChannelId(null);
    setParticipants([]);
    setLevel(0);
  }, []);

  const setMutedState = useCallback((m: boolean) => {
    setMuted(m);
    providerRef.current?.setMuted(m);
  }, []);

  /** Push-to-talk: UI holds this while the talk button is pressed. */
  const setTalking = useCallback((talking: boolean) => {
    providerRef.current?.setTalking(talking);
  }, []);

  return {
    joined: channelId !== null,
    channelId,
    kind,
    participants,
    level,
    muted,
    joining,
    error,
    providerKind: providerRef.current?.kind ?? "local",
    join,
    leave,
    setMuted: setMutedState,
    setTalking,
  };
}

/**
 * useProximityVoice — LiveKit proximity voice for OrbitX City.
 *
 * One shared LiveKit room (`orbitx-city-voice`). Every client publishes its
 * 3D position over a LiveKit data channel a few times per second; each
 * client sets per-speaker volume from distance (see ./proximity.ts).
 * Out of range = silent. Speaking state comes from LiveKit audio levels.
 *
 * Requires a Supabase auth session (token endpoint). Without one, the hook
 * stays idle and exposes `needsAuth` so the UI can prompt sign-in.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Room,
  RoomEvent,
  RemoteParticipant,
  Track,
  ConnectionState,
} from "livekit-client";
import { fetchLiveKitToken, CITY_VOICE_ROOM } from "./livekitToken";
import {
  dist2D,
  gainForDistance,
  PROXIMITY_MAX_RANGE,
  PROXIMITY_PUBLISH_MS,
  PROXIMITY_HEARTBEAT_MS,
  type Vec2,
} from "./proximity";

export interface ProximitySpeaker {
  identity: string;
  name: string;
  speaking: boolean;
  distance: number; // world units, Infinity if unknown
  gain: number; // 0..1 applied volume
  audible: boolean;
}

interface RemoteState {
  pos: Vec2 | null;
  name: string;
  el: HTMLAudioElement | null;
}

const enc = new TextEncoder();
const dec = new TextDecoder();

export function useProximityVoice(opts: {
  /** Called each tick for the local player's position. Return null when unknown. */
  getLocalPos: () => Vec2 | null;
  displayName: string;
  identity: string;
  enabled?: boolean;
}) {
  const { getLocalPos, displayName, identity, enabled = true } = opts;
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [muted, setMuted] = useState(true);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [speakers, setSpeakers] = useState<ProximitySpeaker[]>([]);

  const roomRef = useRef<Room | null>(null);
  const remotesRef = useRef(new Map<string, RemoteState>());
  const localPosRef = useRef<Vec2 | null>(null);
  const getLocalPosRef = useRef(getLocalPos);
  getLocalPosRef.current = getLocalPos;
  const mountedRef = useRef(true);

  const applyGains = useCallback(() => {
    const room = roomRef.current;
    if (!room) return;
    const me = localPosRef.current;
    const list: ProximitySpeaker[] = [];
    room.remoteParticipants.forEach((p: RemoteParticipant) => {
      const st = remotesRef.current.get(p.identity);
      const dist = me && st?.pos ? dist2D(me, st.pos) : Infinity;
      const gain = dist === Infinity ? 0 : gainForDistance(dist);
      if (st?.el) st.el.volume = gain;
      const hasAudio = Array.from(p.audioTrackPublications.values()).some(
        (pub) => pub.isSubscribed && pub.track && !pub.isMuted
      );
      list.push({
        identity: p.identity,
        name: st?.name || p.name || p.identity.slice(0, 8),
        speaking: p.isSpeaking,
        distance: dist,
        gain,
        audible: gain > 0.01 && hasAudio,
      });
    });
    if (mountedRef.current) setSpeakers(list);
  }, []);

  const publishPos = useCallback(() => {
    const room = roomRef.current;
    const pos = getLocalPosRef.current();
    localPosRef.current = pos;
    if (!room || room.state !== ConnectionState.Connected || !pos) return;
    try {
      room.localParticipant.publishData(
        enc.encode(
          JSON.stringify({ t: "pos", x: Math.round(pos.x * 10) / 10, z: Math.round(pos.z * 10) / 10, n: displayName })
        ),
        { reliable: true }
      );
    } catch {
      /* noop */
    }
    applyGains();
  }, [displayName, applyGains]);

  const join = useCallback(async () => {
    if (roomRef.current?.state === ConnectionState.Connected || connecting) return;
    setConnecting(true);
    setError(null);
    setNeedsAuth(false);
    try {
      const { token, url } = await fetchLiveKitToken(CITY_VOICE_ROOM, identity, displayName);
      const room = new Room({ adaptiveStream: true, dynacast: true });
      roomRef.current = room;

      room.on(RoomEvent.DataReceived, (payload: Uint8Array, participant?: RemoteParticipant) => {
        if (!participant) return;
        try {
          const msg = JSON.parse(dec.decode(payload));
          if (msg?.t === "pos" && typeof msg.x === "number" && typeof msg.z === "number") {
            const st = remotesRef.current.get(participant.identity) || { pos: null, name: "", el: null };
            st.pos = { x: msg.x, z: msg.z };
            if (typeof msg.n === "string") st.name = msg.n.slice(0, 32);
            remotesRef.current.set(participant.identity, st);
            applyGains();
          }
        } catch {
          /* ignore malformed */
        }
      });

      const attachAudio = (track: any, participant: RemoteParticipant) => {
        if (track.kind !== Track.Kind.Audio) return;
        const el = track.attach() as HTMLAudioElement;
        el.style.display = "none";
        document.body.appendChild(el);
        const st = remotesRef.current.get(participant.identity) || { pos: null, name: "", el: null };
        st.el = el;
        if (!st.name) st.name = participant.name || participant.identity.slice(0, 8);
        remotesRef.current.set(participant.identity, st);
        applyGains();
      };

      room.on(RoomEvent.TrackSubscribed, (track: any, _pub: any, participant: RemoteParticipant) => {
        attachAudio(track, participant);
        applyGains();
      });
      room.on(RoomEvent.TrackUnsubscribed, (track: any) => {
        track.detach().forEach((el: HTMLMediaElement) => el.remove());
        // clear element refs pointing at removed nodes
        remotesRef.current.forEach((st) => {
          if (st.el && !st.el.isConnected) st.el = null;
        });
      });
      room.on(RoomEvent.ParticipantDisconnected, (p: RemoteParticipant) => {
        const st = remotesRef.current.get(p.identity);
        st?.el?.remove();
        remotesRef.current.delete(p.identity);
        applyGains();
      });
      room.on(RoomEvent.ActiveSpeakersChanged, () => applyGains());
      room.on(RoomEvent.Disconnected, () => {
        if (!mountedRef.current) return;
        setConnected(false);
        setSpeakers([]);
      });

      await room.connect(url, token);
      try {
        await room.startAudio();
      } catch {
        /* autoplay policy — user gesture needed */
      }
      try {
        await room.localParticipant.setMicrophoneEnabled(false);
      } catch {
        /* mic unavailable — listen-only */
      }
      setMuted(true);
      if (mountedRef.current) {
        setConnected(true);
        setConnecting(false);
      }
    } catch (e: any) {
      const msg = e instanceof Error ? e.message : String(e);
      if (mountedRef.current) {
        if (msg === "sign_in_required") setNeedsAuth(true);
        else setError(msg);
        setConnecting(false);
      }
      roomRef.current = null;
    }
  }, [identity, displayName, connecting, applyGains]);

  const leave = useCallback(async () => {
    const room = roomRef.current;
    roomRef.current = null;
    remotesRef.current.forEach((st) => st.el?.remove());
    remotesRef.current.clear();
    if (room) await room.disconnect(true).catch(() => undefined);
    if (mountedRef.current) {
      setConnected(false);
      setSpeakers([]);
    }
  }, []);

  const toggleMute = useCallback(async () => {
    const room = roomRef.current;
    if (!room?.localParticipant) return;
    const next = !muted;
    try {
      await room.localParticipant.setMicrophoneEnabled(!next);
      setMuted(next);
    } catch (e: any) {
      setError(e instanceof Error ? e.message : "mic_error");
    }
  }, [muted]);

  // position publish loop
  useEffect(() => {
    if (!enabled) return;
    let lastSent = 0;
    let lastPos: Vec2 | null = null;
    const iv = window.setInterval(() => {
      const pos = getLocalPosRef.current();
      const now = Date.now();
      const moved =
        pos && lastPos && Math.hypot(pos.x - lastPos.x, pos.z - lastPos.z) > 0.5;
      if (pos && (moved || now - lastSent > PROXIMITY_HEARTBEAT_MS)) {
        lastSent = now;
        lastPos = pos;
        publishPos();
      }
      applyGains();
    }, PROXIMITY_PUBLISH_MS);
    return () => window.clearInterval(iv);
  }, [enabled, publishPos, applyGains]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      roomRef.current?.disconnect(true);
      roomRef.current = null;
      remotesRef.current.forEach((st) => st.el?.remove());
      remotesRef.current.clear();
    };
  }, []);

  return {
    connected,
    connecting,
    muted,
    needsAuth,
    error,
    speakers,
    maxRange: PROXIMITY_MAX_RANGE,
    join,
    leave,
    toggleMute,
  };
}

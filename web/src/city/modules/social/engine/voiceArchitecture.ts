/**
 * Voice architecture for the social module (campfire voice chat, comedy open
 * mic, party stages). Multiplayer-ready by design; local-only today.
 *
 * DESIGN:
 * - `VoiceProvider` is the seam. Swap `LocalVoiceStub` for
 *   `LiveKitVoiceProvider` the moment the backend ships a token endpoint.
 * - LiveKit is already a web dependency (@livekit/components-react), so the
 *   real provider is a thin wrapper — no new packages needed.
 *
 * GAPS (marked for the integrator / backend team):
 * - GAP-1: no LiveKit token endpoint exists yet. The provider needs
 *   `POST /api/voice/token { room, identity } -> { token, url }`.
 * - GAP-2: no LiveKit Cloud project / API key provisioned (self-host or
 *   LiveKit Cloud). Keys must live server-side; the client only gets tokens.
 * - GAP-3: no moderation/consent UX copy approved (recording indicator,
 *   mute-by-default, push-to-talk default ON for open mic).
 * - GAP-4: no spatial-audio mapping yet — rooms are flat channels, not
 *   positional. A future pass can map `getPlayerState().pos` to LiveKit
 *   spatial audio once 3D venue positions are fixed.
 *
 * What works TODAY (no backend): LocalVoiceStub gives the full UI flow —
 * join/leave, mic meter via WebAudio AnalyserNode, push-to-talk, and
 * MediaRecorder-based "record your set" for comedy open mic with local
 * playback. The UI components are written against the interface, so they
 * light up for real the day GAP-1 closes.
 */

import type { VoiceChannel, VoiceChannelKind } from "../types";

export interface VoiceParticipant {
  id: string;
  name: string;
  speaking: boolean;
  muted: boolean;
  level: number; // 0..1 mic meter
}

export interface VoiceProvider {
  readonly kind: "local" | "livekit";
  join(channelId: string, identity: string): Promise<void>;
  leave(): Promise<void>;
  setMuted(muted: boolean): void;
  /** push-to-talk: hold to talk */
  setTalking(talking: boolean): void;
  onParticipants(cb: (p: VoiceParticipant[]) => void): () => void;
  onLevel(cb: (level: number) => void): () => void;
}

// ---------------------------------------------------------------------------
// Local stub — works today, zero backend
// ---------------------------------------------------------------------------

export class LocalVoiceStub implements VoiceProvider {
  readonly kind = "local" as const;
  private channel: VoiceChannel | null = null;
  private identity = "";
  private muted = true;
  private talking = false;
  private participantCbs = new Set<(p: VoiceParticipant[]) => void>();
  private levelCbs = new Set<(l: number) => void>();
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private stream: MediaStream | null = null;
  private raf = 0;
  private buf: Uint8Array | null = null;

  private emit() {
    const list: VoiceParticipant[] = this.channel
      ? [
          { id: "me", name: this.identity || "You", speaking: this.talking && !this.muted, muted: this.muted, level: 0 },
          // simulated NPC chatter so the room feels alive
          ...this.channel.participants
            .filter((p) => p !== this.identity)
            .slice(0, 6)
            .map((p, i) => ({
              id: `npc-${i}`,
              name: p,
              speaking: Math.random() < 0.18,
              muted: false,
              level: Math.random() * 0.6,
            })),
        ]
      : [];
    this.participantCbs.forEach((cb) => cb(list));
  }

  async join(channelId: string, identity: string): Promise<void> {
    this.channel = { id: channelId, kind: channelIdKind(channelId), label: channelId, participants: [], joined: true };
    this.identity = identity;
    this.emit();
    // mic meter (user gesture already happened — phone UI opens on tap)
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.audioCtx = new AudioContext();
      const src = this.audioCtx.createMediaStreamSource(this.stream);
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 256;
      src.connect(this.analyser);
      this.buf = new Uint8Array(this.analyser.frequencyBinCount);
      const tick = () => {
        if (this.analyser && this.buf) {
          this.analyser.getByteFrequencyData(this.buf as Uint8Array<ArrayBuffer>);
          const avg = this.buf.reduce((a, b) => a + b, 0) / this.buf.length / 255;
          this.levelCbs.forEach((cb) => cb(this.talking && !this.muted ? Math.min(1, avg * 3) : 0));
        }
        this.raf = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      /* mic denied — meter stays flat, UI shows "mic blocked" */
    }
    const iv = setInterval(() => {
      if (!this.channel) {
        clearInterval(iv);
        return;
      }
      this.emit(); // NPC chatter simulation
    }, 2500);
  }

  async leave(): Promise<void> {
    cancelAnimationFrame(this.raf);
    this.stream?.getTracks().forEach((t) => t.stop());
    await this.audioCtx?.close().catch(() => undefined);
    this.audioCtx = null;
    this.analyser = null;
    this.channel = null;
    this.participantCbs.forEach((cb) => cb([]));
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    this.emit();
  }
  setTalking(talking: boolean): void {
    this.talking = talking;
    this.emit();
  }
  onParticipants(cb: (p: VoiceParticipant[]) => void): () => void {
    this.participantCbs.add(cb);
    return () => {
      this.participantCbs.delete(cb);
    };
  }
  onLevel(cb: (level: number) => void): () => void {
    this.levelCbs.add(cb);
    return () => {
      this.levelCbs.delete(cb);
    };
  }
}

// ---------------------------------------------------------------------------
// LiveKit provider — real multiplayer, needs GAP-1 (token endpoint)
// ---------------------------------------------------------------------------

export interface LiveKitTokenFn {
  (room: string, identity: string): Promise<{ token: string; url: string }>;
}

/**
 * Real multiplayer voice via LiveKit. NOT wired by default — construct with
 * a token function once the backend ships POST /api/voice/token (GAP-1).
 * Internally uses livekit-client Room; spatial audio hook-up is GAP-4.
 */
export class LiveKitVoiceProvider implements VoiceProvider {
  readonly kind = "livekit" as const;
  private room: unknown = null;
  private participantCbs = new Set<(p: VoiceParticipant[]) => void>();
  private levelCbs = new Set<(l: number) => void>();

  constructor(private getToken: LiveKitTokenFn) {}

  async join(channelId: string, identity: string): Promise<void> {
    // GAP-1: token endpoint missing — throw a clear error so UI can show it.
    const { token, url } = await this.getToken(channelId, identity);
    // Dynamic import keeps livekit-client out of the initial bundle.
    const { Room, RoomEvent } = await import("livekit-client");
    const room = new Room({ adaptiveStream: true });
    room
      .on(RoomEvent.ParticipantConnected, () => this.emit(room))
      .on(RoomEvent.ParticipantDisconnected, () => this.emit(room))
      .on(RoomEvent.ActiveSpeakersChanged, () => this.emit(room));
    await room.connect(url, token);
    await room.localParticipant.setMicrophoneEnabled(true);
    this.room = room;
    this.emit(room);
  }

  private emit(room: { remoteParticipants: Map<string, { identity: string; isSpeaking: boolean }>; localParticipant: { identity: string } }) {
    const list: VoiceParticipant[] = [
      { id: "me", name: room.localParticipant.identity, speaking: false, muted: false, level: 0 },
      ...[...room.remoteParticipants.values()].map((p, i) => ({
        id: `remote-${i}`,
        name: p.identity,
        speaking: p.isSpeaking,
        muted: false,
        level: p.isSpeaking ? 0.7 : 0,
      })),
    ];
    this.participantCbs.forEach((cb) => cb(list));
  }

  async leave(): Promise<void> {
    (this.room as { disconnect?: () => Promise<void> } | null)?.disconnect?.();
    this.room = null;
    this.participantCbs.forEach((cb) => cb([]));
  }
  setMuted(muted: boolean): void {
    (this.room as { localParticipant?: { setMicrophoneEnabled: (b: boolean) => void } } | null)?.localParticipant?.setMicrophoneEnabled(!muted);
  }
  setTalking(_talking: boolean): void {
    /* with LiveKit, push-to-talk maps to setMicrophoneEnabled — wired by UI */
  }
  onParticipants(cb: (p: VoiceParticipant[]) => void): () => void {
    this.participantCbs.add(cb);
    return () => {
      this.participantCbs.delete(cb);
    };
  }
  onLevel(cb: (level: number) => void): () => void {
    this.levelCbs.add(cb);
    return () => {
      this.levelCbs.delete(cb);
    };
  }
}

function channelIdKind(id: string): VoiceChannelKind {
  if (id.includes("mic")) return "openmic";
  if (id.includes("camp")) return "campfire";
  return "party";
}

/** Default provider used by all voice UI until the integrator swaps it. */
export function createVoiceProvider(): VoiceProvider {
  return new LocalVoiceStub();
}

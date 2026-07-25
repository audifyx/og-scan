/**
 * OrbitX City — multiplayer presence + world chat over Supabase Realtime.
 *
 * One channel per city block. Presence tracks who's online (identity +
 * cosmetics); broadcast fans out position updates and chat lines. The players
 * map is intentionally mutable so the R3F loop can read it every frame without
 * React churn; HUD widgets subscribe via `subscribe()` (external-store style)
 * and are only notified on roster/chat changes.
 */
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase";

export const REALTIME_ENABLED = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

export interface CityIdentity {
  id: string;
  name: string;
  accentColor: string;
  bodyColor: string;
  skinColor: string;
}

export interface RemotePlayerState {
  id: string;
  name: string;
  accentColor: string;
  bodyColor: string;
  skinColor: string;
  x: number;
  z: number;
  yaw: number;
  updatedAt: number;
  chatText: string | null;
  chatAt: number;
  emoteAt: number;
}

export interface WorldChatMessage {
  id: string;
  senderId: string;
  name: string;
  accentColor: string;
  text: string;
  at: number;
}

const MAX_CHAT_LOG = 120;
const MAX_CHAT_LENGTH = 280;

export class CityRealtimeClient {
  /** Mutable — read from the render loop, never from React state. */
  readonly players = new Map<string, RemotePlayerState>();
  /** Latest chat line from the local player (for overhead bubble). */
  localChat: { text: string; at: number } | null = null;

  private channel: RealtimeChannel | null = null;
  private listeners = new Set<() => void>();
  private chatLog: WorldChatMessage[] = [];
  private snapshot: { online: number; chat: WorldChatMessage[]; connected: boolean } = {
    online: 1,
    chat: [],
    connected: false,
  };

  constructor(
    private readonly identity: CityIdentity,
    private readonly room = "oxc-world-nyc",
  ) {}

  connect(): void {
    if (this.channel) return;
    if (!REALTIME_ENABLED) {
      // Local-only mode — chat + presence still work for solo demos
      this.publish({ connected: false, online: 1 });
      return;
    }

    const ch = supabase.channel(this.room, {
      config: { presence: { key: this.identity.id }, broadcast: { self: false } },
    });

    ch.on("presence", { event: "sync" }, () => {
      const state = ch.presenceState<{
        name?: string;
        accentColor?: string;
        bodyColor?: string;
        skinColor?: string;
      }>();
      const ids = new Set(Object.keys(state));

      for (const id of this.players.keys()) {
        if (!ids.has(id)) this.players.delete(id);
      }
      for (const [id, metas] of Object.entries(state)) {
        if (id === this.identity.id) continue;
        const meta = (metas[0] ?? {}) as {
          name?: string;
          accentColor?: string;
          bodyColor?: string;
          skinColor?: string;
        };
        const existing = this.players.get(id);
        if (existing) {
          existing.name = meta.name ?? existing.name;
          existing.accentColor = meta.accentColor ?? existing.accentColor;
          existing.bodyColor = meta.bodyColor ?? existing.bodyColor;
          existing.skinColor = meta.skinColor ?? existing.skinColor;
        } else {
          this.players.set(id, {
            id,
            name: meta.name ?? "Traveler",
            accentColor: meta.accentColor ?? "#3de7ff",
            bodyColor: meta.bodyColor ?? "#1a2438",
            skinColor: meta.skinColor ?? "#e8d5c0",
            // Spawn plaza until their first position packet lands
            x: 0,
            z: 8,
            yaw: 0,
            updatedAt: Date.now(),
            chatText: null,
            chatAt: 0,
            emoteAt: 0,
          });
        }
      }
      this.publish({ online: ids.size || 1 });
    });

    ch.on("broadcast", { event: "pos" }, ({ payload }) => {
      const p = payload as { id?: string; x?: number; z?: number; yaw?: number };
      if (!p?.id || p.id === this.identity.id) return;
      const player = this.players.get(p.id);
      if (!player) return;
      if (typeof p.x === "number") player.x = p.x;
      if (typeof p.z === "number") player.z = p.z;
      if (typeof p.yaw === "number") player.yaw = p.yaw;
      player.updatedAt = Date.now();
    });

    ch.on("broadcast", { event: "emote" }, ({ payload }) => {
      const p = payload as { id?: string; at?: number };
      if (!p?.id || p.id === this.identity.id) return;
      const player = this.players.get(p.id);
      if (player) player.emoteAt = p.at ?? Date.now();
    });

    ch.on("broadcast", { event: "chat" }, ({ payload }) => {
      const m = payload as Partial<WorldChatMessage>;
      if (!m?.senderId || typeof m.text !== "string") return;
      this.pushChat({
        id: m.id ?? `${m.senderId}-${Date.now()}`,
        senderId: m.senderId,
        name: m.name ?? "Traveler",
        accentColor: m.accentColor ?? "#3de7ff",
        text: m.text.slice(0, MAX_CHAT_LENGTH),
        at: m.at ?? Date.now(),
      });
    });

    ch.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await ch.track({
          name: this.identity.name,
          accentColor: this.identity.accentColor,
          bodyColor: this.identity.bodyColor,
          skinColor: this.identity.skinColor,
        });
        this.publish({ connected: true });
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
        this.publish({ connected: false });
      }
    });

    this.channel = ch;
  }

  disconnect(): void {
    if (this.channel) {
      supabase.removeChannel(this.channel);
      this.channel = null;
    }
    this.players.clear();
    this.publish({ online: 1, connected: false });
  }

  sendPosition(x: number, z: number, yaw: number): void {
    this.channel?.send({
      type: "broadcast",
      event: "pos",
      payload: { id: this.identity.id, x: round2(x), z: round2(z), yaw: round2(yaw) },
    });
  }

  sendEmote(): void {
    this.channel?.send({
      type: "broadcast",
      event: "emote",
      payload: { id: this.identity.id, at: Date.now() },
    });
  }

  sendChat(text: string): void {
    const trimmed = text.trim().slice(0, MAX_CHAT_LENGTH);
    if (!trimmed) return;
    const msg: WorldChatMessage = {
      id: `${this.identity.id}-${Date.now()}`,
      senderId: this.identity.id,
      name: this.identity.name,
      accentColor: this.identity.accentColor,
      text: trimmed,
      at: Date.now(),
    };
    // broadcast.self is false — echo locally
    this.pushChat(msg);
    this.channel?.send({ type: "broadcast", event: "chat", payload: msg });
  }

  /** External-store subscription for HUD widgets (online count, chat log). */
  subscribe = (cb: () => void): (() => void) => {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  };

  getSnapshot = () => this.snapshot;

  private pushChat(msg: WorldChatMessage): void {
    this.chatLog = [...this.chatLog.slice(-(MAX_CHAT_LOG - 1)), msg];
    if (msg.senderId === this.identity.id) {
      this.localChat = { text: msg.text, at: msg.at };
    } else {
      const player = this.players.get(msg.senderId);
      if (player) {
        player.chatText = msg.text;
        player.chatAt = msg.at;
      }
    }
    this.publish({ chat: this.chatLog });
  }

  private publish(patch: Partial<typeof this.snapshot>): void {
    this.snapshot = { ...this.snapshot, ...patch };
    for (const cb of this.listeners) cb();
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Stable fallbacks for useSyncExternalStore when the client isn't ready. */
export const EMPTY_REALTIME_SNAPSHOT: { online: number; chat: WorldChatMessage[]; connected: boolean } = {
  online: 1,
  chat: [],
  connected: false,
};
export const noopSubscribe = (): (() => void) => () => {};
export const emptySnapshotGetter = () => EMPTY_REALTIME_SNAPSHOT;

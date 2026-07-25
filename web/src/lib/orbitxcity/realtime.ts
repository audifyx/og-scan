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

export interface LobbyDescriptor {
  /** Realtime channel id (already includes the password hash for private lobbies). */
  id: string;
  /** Human-readable name shown in the directory and HUD. */
  label: string;
  isPrivate: boolean;
}

export const MAIN_LOBBY: LobbyDescriptor = {
  id: "oxc-world-nyc",
  label: "Main Lobby · NYC",
  isPrivate: false,
};

function slugify(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 32) || "lobby";
}

function tinyHash(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

/**
 * Build a lobby descriptor. Private lobbies mix the password into the channel
 * id, so only players who know name+password land in the same room — no
 * server-side gate needed for a social lobby.
 */
export function makeLobby(name: string, password?: string): LobbyDescriptor {
  const slug = slugify(name);
  const isPrivate = Boolean(password && password.trim());
  const id = isPrivate
    ? `oxc-lobby-${slug}-${tinyHash(`${slug}:${password!.trim()}`)}`
    : `oxc-lobby-${slug}-open`;
  return { id, label: name.trim().slice(0, 32) || "Custom Lobby", isPrivate };
}

export interface DirectoryLobby {
  id: string;
  label: string;
  isPrivate: boolean;
  count: number;
}

/**
 * Live lobby directory: every connected player also tracks presence on a
 * shared directory channel carrying their lobby's metadata. Aggregating that
 * presence state yields the public lobby list with player counts.
 */
export function watchLobbyDirectory(cb: (lobbies: DirectoryLobby[]) => void): () => void {
  if (!REALTIME_ENABLED) {
    cb([{ ...MAIN_LOBBY, count: 0 }]);
    return () => {};
  }
  const ch = supabase.channel("oxc-lobby-directory", {
    config: { presence: { key: `watch-${Math.random().toString(36).slice(2, 10)}` } },
  });
  ch.on("presence", { event: "sync" }, () => {
    const state = ch.presenceState<{ lobbyId?: string; label?: string; isPrivate?: boolean }>();
    const byId = new Map<string, DirectoryLobby>();
    byId.set(MAIN_LOBBY.id, { ...MAIN_LOBBY, count: 0 });
    for (const metas of Object.values(state)) {
      const meta = metas[0] as { lobbyId?: string; label?: string; isPrivate?: boolean } | undefined;
      if (!meta?.lobbyId) continue;
      const existing = byId.get(meta.lobbyId);
      if (existing) {
        existing.count += 1;
      } else {
        byId.set(meta.lobbyId, {
          id: meta.lobbyId,
          label: meta.label ?? "Custom Lobby",
          isPrivate: Boolean(meta.isPrivate),
          count: 1,
        });
      }
    }
    cb(Array.from(byId.values()).sort((a, b) => b.count - a.count));
  });
  ch.subscribe();
  return () => {
    supabase.removeChannel(ch);
  };
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

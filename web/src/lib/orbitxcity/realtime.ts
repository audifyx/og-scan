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
import type { AvatarAppearance, BeardStyle, BodyType, FaceStyle, HairStyle, OutfitStyle } from "@/lib/orbitxcity/types";

export const REALTIME_ENABLED = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

export interface CityIdentity {
  id: string;
  name: string;
  accentColor: string;
  bodyColor: string;
  skinColor: string;
  hairStyle?: HairStyle;
  hairColor?: string;
  outfit?: OutfitStyle;
  faceStyle?: FaceStyle;
  classId?: AvatarAppearance["classId"];
  beardStyle?: BeardStyle;
  bodyType?: BodyType;
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

/** Public per-district rooms (`oxc-world-nyc` …). Custom/private use `oxc-lobby-`. */
export function isDistrictLobby(id: string): boolean {
  return typeof id === "string" && id.startsWith("oxc-world-");
}

export function districtLobby(cityId: string): LobbyDescriptor {
  const id = cityId && cityId !== "nyc" ? `oxc-world-${cityId}` : MAIN_LOBBY.id;
  if (id === MAIN_LOBBY.id) return MAIN_LOBBY;
  return { id, label: `Main Lobby · ${cityId.toUpperCase()}`, isPrivate: false };
}

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

export type CityLobbyInput = LobbyDescriptor | string;
export type CityLobbyMeta = Partial<Pick<LobbyDescriptor, "label" | "isPrivate">>;

type PlayerPresenceMeta = Pick<CityIdentity, "name" | "accentColor" | "bodyColor" | "skinColor"> &
  Partial<Pick<CityIdentity, "hairStyle" | "hairColor" | "outfit" | "faceStyle" | "classId" | "beardStyle" | "bodyType">> & {
    x?: number;
    z?: number;
    yaw?: number;
  };

type DirectoryPresenceMeta = {
  lobbyId?: string;
  label?: string;
  isPrivate?: boolean;
};

/**
 * Live lobby directory: every connected player also tracks presence on a
 * shared directory channel carrying their lobby's metadata. Aggregating that
 * presence state yields the public lobby list with player counts.
 */
export function watchLobbyDirectory(cb: (lobbies: DirectoryLobby[]) => void): () => void {
  const fallback: DirectoryLobby[] = [{ ...MAIN_LOBBY, count: 0 }];
  cb(fallback);
  if (!REALTIME_ENABLED) return () => {};

  let ch: RealtimeChannel | null = null;
  try {
    ch = supabase.channel("oxc-lobby-directory", {
      config: { presence: { key: `watch-${Math.random().toString(36).slice(2, 10)}` } },
    });
    ch.on("presence", { event: "sync" }, () => {
      try {
        const state = ch!.presenceState<DirectoryPresenceMeta>();
        const byId = new Map<string, DirectoryLobby>();
        byId.set(MAIN_LOBBY.id, { ...MAIN_LOBBY, count: 0 });
        for (const metas of Object.values(state)) {
          for (const meta of metas) {
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
        }
        cb(Array.from(byId.values()).sort((a, b) => b.count - a.count));
      } catch {
        cb(fallback);
      }
    });
    ch.subscribe((status) => {
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") cb(fallback);
    });
  } catch {
    cb(fallback);
    return () => {};
  }

  return () => {
    if (!ch) return;
    try {
      supabase.removeChannel(ch);
    } catch {
      /* already gone */
    }
  };
}

export interface RemotePlayerState {
  id: string;
  name: string;
  accentColor: string;
  bodyColor: string;
  skinColor: string;
  hairStyle?: HairStyle;
  hairColor?: string;
  outfit?: OutfitStyle;
  faceStyle?: FaceStyle;
  classId?: AvatarAppearance["classId"];
  beardStyle?: BeardStyle;
  bodyType?: BodyType;
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
  private directoryChannel: RealtimeChannel | null = null;
  private readonly lobby: LobbyDescriptor;
  private listeners = new Set<() => void>();
  private chatLog: WorldChatMessage[] = [];
  private seenChat = new Set<string>();
  private lastEmoteAt = 0;
  private lastPosSend = 0;
  private lastPos = { x: 0, z: 8, yaw: 0 };
  private dead = false;
  private snapshot: { online: number; chat: WorldChatMessage[]; connected: boolean } = {
    online: 1,
    chat: [],
    connected: false,
  };

  constructor(
    private identity: CityIdentity,
    lobby: CityLobbyInput = MAIN_LOBBY,
    lobbyMeta: CityLobbyMeta = {},
  ) {
    this.lobby = normalizeLobby(lobby, lobbyMeta);
  }

  connect(): void {
    if (this.dead) this.dead = false;
    if (this.channel) return;
    if (!REALTIME_ENABLED) {
      // Local-only mode — chat + presence still work for solo demos
      this.publish({ connected: false, online: 1 });
      return;
    }

    const directoryCh = supabase.channel("oxc-lobby-directory", {
      config: { presence: { key: this.identity.id } },
    });

    directoryCh.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await directoryCh.track({
          lobbyId: this.lobby.id,
          label: this.lobby.label,
          isPrivate: this.lobby.isPrivate,
        });
      }
    });

    const ch = supabase.channel(this.lobby.id, {
      config: { presence: { key: this.identity.id }, broadcast: { self: false } },
    });

    ch.on("presence", { event: "sync" }, () => {
      const state = ch.presenceState<PlayerPresenceMeta>();
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
          hairStyle?: HairStyle;
          hairColor?: string;
          outfit?: OutfitStyle;
          faceStyle?: FaceStyle;
          classId?: AvatarAppearance["classId"];
          beardStyle?: BeardStyle;
          bodyType?: BodyType;
          x?: number;
          z?: number;
          yaw?: number;
        };
        const existing = this.players.get(id);
        if (existing) {
          existing.name = meta.name ?? existing.name;
          existing.accentColor = meta.accentColor ?? existing.accentColor;
          existing.bodyColor = meta.bodyColor ?? existing.bodyColor;
          existing.skinColor = meta.skinColor ?? existing.skinColor;
          existing.hairStyle = meta.hairStyle ?? existing.hairStyle;
          existing.hairColor = meta.hairColor ?? existing.hairColor;
          existing.outfit = meta.outfit ?? existing.outfit;
          existing.faceStyle = meta.faceStyle ?? existing.faceStyle;
          existing.classId = meta.classId ?? existing.classId;
          existing.beardStyle = meta.beardStyle ?? existing.beardStyle;
          existing.bodyType = meta.bodyType ?? existing.bodyType;
          if (typeof meta.x === "number" && typeof meta.z === "number") {
            existing.x = meta.x;
            existing.z = meta.z;
            if (typeof meta.yaw === "number") existing.yaw = meta.yaw;
          }
        } else {
          this.players.set(id, {
            id,
            name: meta.name ?? "Traveler",
            accentColor: meta.accentColor ?? "#3de7ff",
            bodyColor: meta.bodyColor ?? "#1a2438",
            skinColor: meta.skinColor ?? "#e8d5c0",
            hairStyle: meta.hairStyle,
            hairColor: meta.hairColor,
            outfit: meta.outfit,
            faceStyle: meta.faceStyle,
            classId: meta.classId,
            beardStyle: meta.beardStyle,
            bodyType: meta.bodyType,
            x: typeof meta.x === "number" ? meta.x : 0,
            z: typeof meta.z === "number" ? meta.z : 8,
            yaw: typeof meta.yaw === "number" ? meta.yaw : 0,
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
      let player = this.players.get(p.id);
      if (!player) {
        player = {
          id: p.id,
          name: "Traveler",
          accentColor: "#3de7ff",
          bodyColor: "#1a2438",
          skinColor: "#e8d5c0",
          x: typeof p.x === "number" ? p.x : 0,
          z: typeof p.z === "number" ? p.z : 8,
          yaw: typeof p.yaw === "number" ? p.yaw : 0,
          updatedAt: Date.now(),
          chatText: null,
          chatAt: 0,
          emoteAt: 0,
        };
        this.players.set(p.id, player);
        this.publish({ online: this.players.size + 1 });
      } else {
        if (typeof p.x === "number") player.x = p.x;
        if (typeof p.z === "number") player.z = p.z;
        if (typeof p.yaw === "number") player.yaw = p.yaw;
        player.updatedAt = Date.now();
      }
    });

    ch.on("broadcast", { event: "hello" }, ({ payload }) => {
      const p = payload as { id?: string };
      if (!p?.id || p.id === this.identity.id) return;
      this.sendPosition(this.lastPos.x, this.lastPos.z, this.lastPos.yaw, true);
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
        await ch.track(this.playerPresence());
        this.publish({ connected: true });
        this.sendPosition(this.lastPos.x, this.lastPos.z, this.lastPos.yaw, true);
        void ch.send({ type: "broadcast", event: "hello", payload: { id: this.identity.id } });
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
        this.publish({ connected: false });
      }
    });

    this.channel = ch;
    this.directoryChannel = directoryCh;
  }

  disconnect(): void {
    if (this.dead && !this.channel && !this.directoryChannel) return;
    this.dead = true;
    const world = this.channel;
    const dir = this.directoryChannel;
    this.channel = null;
    this.directoryChannel = null;
    this.players.clear();
    this.publish({ online: 1, connected: false });
    if (world) {
      try {
        void world.untrack();
        supabase.removeChannel(world);
      } catch {
        /* already removed */
      }
    }
    if (dir) {
      try {
        void dir.untrack();
        supabase.removeChannel(dir);
      } catch {
        /* already removed */
      }
    }
  }

  /** Push latest cosmetics without tearing down the channel. */
  setCosmetics(next: Partial<CityIdentity>): void {
    this.identity = { ...this.identity, ...next };
    if (!this.channel) return;
    void this.channel.track(this.playerPresence());
  }

  sendPosition(x: number, z: number, yaw: number, force = false): void {
    if (!Number.isFinite(x) || !Number.isFinite(z) || !Number.isFinite(yaw)) return;
    this.lastPos = { x, z, yaw };
    const now = typeof performance !== "undefined" ? performance.now() : Date.now();
    if (!force && now - this.lastPosSend < 140) return;
    this.lastPosSend = now;
    this.channel?.send({
      type: "broadcast",
      event: "pos",
      payload: { id: this.identity.id, x: round2(x), z: round2(z), yaw: round2(yaw) },
    });
  }

  sendEmote(): void {
    const now = Date.now();
    if (now - this.lastEmoteAt < 450) return;
    this.lastEmoteAt = now;
    this.channel?.send({
      type: "broadcast",
      event: "emote",
      payload: { id: this.identity.id, at: now },
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

  private playerPresence(): PlayerPresenceMeta {
    return {
      name: this.identity.name,
      accentColor: this.identity.accentColor,
      bodyColor: this.identity.bodyColor,
      skinColor: this.identity.skinColor,
      hairStyle: this.identity.hairStyle,
      hairColor: this.identity.hairColor,
      outfit: this.identity.outfit,
      faceStyle: this.identity.faceStyle,
      classId: this.identity.classId,
      beardStyle: this.identity.beardStyle,
      bodyType: this.identity.bodyType,
      x: round2(this.lastPos.x),
      z: round2(this.lastPos.z),
      yaw: round2(this.lastPos.yaw),
    };
  }

  private pushChat(msg: WorldChatMessage): void {
    if (this.seenChat.has(msg.id)) return;
    this.seenChat.add(msg.id);
    if (this.seenChat.size > 400) {
      const drop = [...this.seenChat].slice(0, 200);
      for (const id of drop) this.seenChat.delete(id);
    }
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

function normalizeLobby(lobby: CityLobbyInput, meta: CityLobbyMeta): LobbyDescriptor {
  if (typeof lobby !== "string") return lobby;
  if (lobby === MAIN_LOBBY.id && !meta.label && meta.isPrivate === undefined) return MAIN_LOBBY;
  return {
    id: lobby,
    label: meta.label ?? (lobby === MAIN_LOBBY.id ? MAIN_LOBBY.label : lobby),
    isPrivate: meta.isPrivate ?? false,
  };
}

/** Stable fallbacks for useSyncExternalStore when the client isn't ready. */
export const EMPTY_REALTIME_SNAPSHOT: { online: number; chat: WorldChatMessage[]; connected: boolean } = {
  online: 1,
  chat: [],
  connected: false,
};
export const noopSubscribe = (): (() => void) => () => {};
export const emptySnapshotGetter = () => EMPTY_REALTIME_SNAPSHOT;

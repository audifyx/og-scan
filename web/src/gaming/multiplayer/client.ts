/**
 * Multiplayer client architecture — interfaces + in-memory implementations.
 * Designed to swap onto Supabase Realtime / LiveKit later without UI rewrites.
 * Gaming Studio owns these contracts; Backend Team owns server persistence.
 */
import type { LobbyDescriptor, PartyMember, PresencePeer, PresenceStatus } from "../types";

export interface MatchmakingTicket {
  id: string;
  mode: string;
  createdAt: number;
  status: "queued" | "matched" | "cancelled";
  lobbyId?: string;
}

export interface MatchmakingService {
  enqueue(mode: string): Promise<MatchmakingTicket>;
  cancel(ticketId: string): Promise<void>;
  getTicket(ticketId: string): MatchmakingTicket | null;
}

export interface LobbyService {
  list(): Promise<LobbyDescriptor[]>;
  create(input: { label: string; mode: string; visibility: LobbyDescriptor["visibility"]; maxPlayers?: number; password?: string }): Promise<LobbyDescriptor>;
  join(lobbyId: string, password?: string): Promise<LobbyDescriptor>;
}

export interface PartyService {
  create(leader: PartyMember): Promise<{ partyId: string; members: PartyMember[] }>;
  invite(partyId: string, member: PartyMember): Promise<PartyMember[]>;
  setReady(partyId: string, memberId: string, ready: boolean): Promise<PartyMember[]>;
  leave(partyId: string, memberId: string): Promise<void>;
  getMembers(partyId: string): PartyMember[];
}

export interface PresenceService {
  setStatus(peer: PresencePeer): void;
  list(): PresencePeer[];
  subscribe(cb: (peers: PresencePeer[]) => void): () => void;
}

export interface ChatMessage {
  id: string;
  channel: "party" | "lobby" | "world";
  senderId: string;
  name: string;
  text: string;
  at: number;
}

export interface ChatService {
  send(channel: ChatMessage["channel"], senderId: string, name: string, text: string): ChatMessage;
  history(channel: ChatMessage["channel"], limit?: number): ChatMessage[];
  subscribe(channel: ChatMessage["channel"], cb: (msgs: ChatMessage[]) => void): () => void;
}

export interface VoiceSession {
  roomId: string;
  connected: boolean;
}

export interface VoiceService {
  join(roomId: string): Promise<VoiceSession>;
  leave(): Promise<void>;
  getSession(): VoiceSession | null;
}

function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

/** Local demo matchmaking — resolves after a short delay. */
export class LocalMatchmaking implements MatchmakingService {
  private tickets = new Map<string, MatchmakingTicket>();
  async enqueue(mode: string): Promise<MatchmakingTicket> {
    const ticket: MatchmakingTicket = { id: uid("mm"), mode, createdAt: Date.now(), status: "queued" };
    this.tickets.set(ticket.id, ticket);
    setTimeout(() => {
      const t = this.tickets.get(ticket.id);
      if (t && t.status === "queued") {
        t.status = "matched";
        t.lobbyId = `lobby_${mode}_main`;
      }
    }, 1600);
    return ticket;
  }
  async cancel(ticketId: string) {
    const t = this.tickets.get(ticketId);
    if (t) t.status = "cancelled";
  }
  getTicket(ticketId: string) {
    return this.tickets.get(ticketId) ?? null;
  }
}

export class LocalLobbyService implements LobbyService {
  private lobbies: LobbyDescriptor[] = [
    { id: "lobby_city_main", label: "Main Lobby · NYC", mode: "city", visibility: "public", players: 48, maxPlayers: 256, hostName: "OrbitX", passwordRequired: false, region: "na-east" },
    { id: "lobby_arena_1", label: "Neon Arena #1", mode: "arena", visibility: "public", players: 6, maxPlayers: 12, hostName: "ShardQueen", passwordRequired: false, region: "na-east" },
    { id: "lobby_social", label: "Voice Plaza Hangout", mode: "social", visibility: "public", players: 14, maxPlayers: 40, hostName: "PlazaKid", passwordRequired: false, region: "eu-west" },
    { id: "lobby_private_demo", label: "Private Ops Room", mode: "ops", visibility: "private", players: 2, maxPlayers: 8, hostName: "You", passwordRequired: true, region: "na-east" },
  ];
  private passwords = new Map<string, string>([["lobby_private_demo", "orbitx"]]);

  async list() {
    return this.lobbies.map((l) => ({ ...l }));
  }
  async create(input: { label: string; mode: string; visibility: LobbyDescriptor["visibility"]; maxPlayers?: number; password?: string }) {
    const lobby: LobbyDescriptor = {
      id: uid("lobby"),
      label: input.label.slice(0, 48) || "Custom Lobby",
      mode: input.mode,
      visibility: input.visibility,
      players: 1,
      maxPlayers: Math.min(input.maxPlayers ?? 16, 64),
      hostName: "You",
      passwordRequired: Boolean(input.password),
      region: "na-east",
    };
    if (input.password) this.passwords.set(lobby.id, input.password);
    this.lobbies.unshift(lobby);
    return lobby;
  }
  async join(lobbyId: string, password?: string) {
    const lobby = this.lobbies.find((l) => l.id === lobbyId);
    if (!lobby) throw new Error("Lobby not found");
    if (lobby.passwordRequired && this.passwords.get(lobbyId) !== password) throw new Error("Invalid password");
    if (lobby.players >= lobby.maxPlayers) throw new Error("Lobby full");
    lobby.players += 1;
    return { ...lobby };
  }
}

export class LocalPartyService implements PartyService {
  private parties = new Map<string, PartyMember[]>();
  async create(leader: PartyMember) {
    const partyId = uid("party");
    const members = [{ ...leader, leader: true, ready: false }];
    this.parties.set(partyId, members);
    return { partyId, members };
  }
  async invite(partyId: string, member: PartyMember) {
    const members = this.parties.get(partyId) ?? [];
    if (!members.find((m) => m.id === member.id)) members.push({ ...member, leader: false });
    this.parties.set(partyId, members);
    return [...members];
  }
  async setReady(partyId: string, memberId: string, ready: boolean) {
    const members = this.parties.get(partyId) ?? [];
    for (const m of members) if (m.id === memberId) m.ready = ready;
    return [...members];
  }
  async leave(partyId: string, memberId: string) {
    const members = (this.parties.get(partyId) ?? []).filter((m) => m.id !== memberId);
    if (members.length === 0) this.parties.delete(partyId);
    else this.parties.set(partyId, members);
  }
  getMembers(partyId: string) {
    return [...(this.parties.get(partyId) ?? [])];
  }
}

export class LocalPresenceService implements PresenceService {
  private peers = new Map<string, PresencePeer>();
  private listeners = new Set<(peers: PresencePeer[]) => void>();
  setStatus(peer: PresencePeer) {
    this.peers.set(peer.id, peer);
    this.emit();
  }
  list() {
    return Array.from(this.peers.values());
  }
  subscribe(cb: (peers: PresencePeer[]) => void) {
    this.listeners.add(cb);
    cb(this.list());
    return () => this.listeners.delete(cb);
  }
  private emit() {
    const snapshot = this.list();
    for (const cb of this.listeners) cb(snapshot);
  }
}

export class LocalChatService implements ChatService {
  private logs = new Map<ChatMessage["channel"], ChatMessage[]>();
  private listeners = new Map<ChatMessage["channel"], Set<(msgs: ChatMessage[]) => void>>();
  send(channel: ChatMessage["channel"], senderId: string, name: string, text: string) {
    const msg: ChatMessage = {
      id: uid("chat"),
      channel,
      senderId,
      name,
      text: text.trim().slice(0, 280),
      at: Date.now(),
    };
    const list = this.logs.get(channel) ?? [];
    list.push(msg);
    this.logs.set(channel, list.slice(-100));
    for (const cb of this.listeners.get(channel) ?? []) cb(this.history(channel));
    return msg;
  }
  history(channel: ChatMessage["channel"], limit = 50) {
    return (this.logs.get(channel) ?? []).slice(-limit);
  }
  subscribe(channel: ChatMessage["channel"], cb: (msgs: ChatMessage[]) => void) {
    const set = this.listeners.get(channel) ?? new Set();
    set.add(cb);
    this.listeners.set(channel, set);
    cb(this.history(channel));
    return () => set.delete(cb);
  }
}

export class LocalVoiceService implements VoiceService {
  private session: VoiceSession | null = null;
  async join(roomId: string) {
    this.session = { roomId, connected: true };
    return this.session;
  }
  async leave() {
    this.session = null;
  }
  getSession() {
    return this.session;
  }
}

export type MultiplayerKit = {
  matchmaking: MatchmakingService;
  lobbies: LobbyService;
  parties: PartyService;
  presence: PresenceService;
  chat: ChatService;
  voice: VoiceService;
};

let singleton: MultiplayerKit | null = null;

export function getMultiplayerKit(): MultiplayerKit {
  if (!singleton) {
    singleton = {
      matchmaking: new LocalMatchmaking(),
      lobbies: new LocalLobbyService(),
      parties: new LocalPartyService(),
      presence: new LocalPresenceService(),
      chat: new LocalChatService(),
      voice: new LocalVoiceService(),
    };
  }
  return singleton;
}

export function seedPresence(selfName: string, status: PresenceStatus = "online") {
  const kit = getMultiplayerKit();
  kit.presence.setStatus({ id: "self", name: selfName, status, activity: "OrbitX Play" });
  kit.presence.setStatus({ id: "p2", name: "ShardQueen", status: "in_lobby", activity: "Neon Arena" });
  kit.presence.setStatus({ id: "p3", name: "JupPilot", status: "in_voice", activity: "Voice Plaza" });
  kit.presence.setStatus({ id: "p4", name: "LimeFox", status: "online", activity: "Battle Pass" });
}

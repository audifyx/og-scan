/**
 * Crew roles, NPC crew generation, and the co-op lobby session manager.
 * The lobby runs on any NetAdapter (LocalNet for v1 simulation).
 */
import { LocalNet } from "./net";
import type {
  Approach,
  CoopSnapshot,
  CrewMember,
  CrewRole,
  HeistTemplate,
  NetAdapter,
  NetMessage,
  RoleMeta,
} from "./types";

export const ROLE_META: Record<CrewRole, RoleMeta> = {
  leader: {
    role: "leader",
    label: "Leader",
    icon: "🎯",
    blurb: "Calls the shots. Boosts the whole crew's cut efficiency.",
    stat: "charisma",
  },
  driver: {
    role: "driver",
    label: "Driver",
    icon: "🏎️",
    blurb: "Getaway wheelman. Faster, cleaner escapes.",
    stat: "driving",
  },
  hacker: {
    role: "hacker",
    label: "Hacker",
    icon: "💻",
    blurb: "Kills cameras, alarms and vault timers.",
    stat: "tech",
  },
  muscle: {
    role: "muscle",
    label: "Muscle",
    icon: "💪",
    blurb: "Handles guards and heavy lifting. Breaches trucks.",
    stat: "strength",
  },
  lookout: {
    role: "lookout",
    label: "Lookout",
    icon: "👁️",
    blurb: "Spots patrols early. Slows heat gain.",
    stat: "awareness",
  },
  ghost: {
    role: "ghost",
    label: "Ghost",
    icon: "🥷",
    blurb: "Silent entry specialist. Keeps the alarm down.",
    stat: "stealth",
  },
};

const NPC_NAMES = [
  "Vex",
  "Marisol",
  "Dre",
  "Kaito",
  "Rook",
  "Sable",
  "Nyx",
  "Toro",
  "Ivy",
  "Sol",
  "Jax",
  "Lena",
];

function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

/** build NPC crewmates to fill a lobby (solo crew planning) */
export function makeNpcCrew(count: number, difficulty: number): CrewMember[] {
  const names = [...NPC_NAMES].sort(() => Math.random() - 0.5).slice(0, count);
  return names.map((name) => ({
    id: uid("npc"),
    name,
    isPlayer: false,
    role: null as CrewRole | null,
    skill: Math.max(1, Math.min(5, Math.round(difficulty / 2 + Math.random() * 2))),
    cut: 0,
    ready: true,
  }));
}

/** default loot cuts: equal shares; leader takes a 5% premium off the top */
export function defaultCuts(members: CrewMember[]): CrewMember[] {
  const n = members.length;
  if (n === 0) return members;
  const leaderBonus = members.some((m) => m.role === "leader") ? 5 : 0;
  const rest = 100 - leaderBonus;
  const share = rest / n;
  return members.map((m) => ({
    ...m,
    cut: Math.round(((m.role === "leader" ? share + leaderBonus : share) + Number.EPSILON) * 10) / 10,
  }));
}

/** normalize an arbitrary cut map so it sums to 100 */
export function normalizeCuts(members: CrewMember[]): CrewMember[] {
  const total = members.reduce((s, m) => s + m.cut, 0);
  if (total <= 0) return defaultCuts(members);
  return members.map((m) => ({ ...m, cut: Math.round((m.cut / total) * 1000) / 10 }));
}

/* ---------------- co-op lobby ---------------- */

export type CoopEvent =
  | { type: "members"; snapshot: CoopSnapshot }
  | { type: "start"; templateId: string; approach: Approach };

/**
 * Lobby state machine. The host creates a code, members join, claim roles,
 * ready up; when everyone is ready the host starts and every client receives
 * the start event with the agreed plan seed.
 */
export class CoopSession {
  private net: NetAdapter;
  private members: CrewMember[] = [];
  private code: string | null = null;
  private isHost = false;
  private started = false;
  private listeners = new Set<(e: CoopEvent) => void>();
  private unsubNet: (() => void) | null = null;
  private pendingTemplate = "vice-vault";
  private pendingApproach: Approach = "smart";

  constructor(net?: NetAdapter) {
    this.net = net ?? new LocalNet();
  }

  onEvent(cb: (e: CoopEvent) => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private pushMembers() {
    const snapshot: CoopSnapshot = {
      code: this.code,
      isHost: this.isHost,
      members: this.members.map((m) => ({ ...m })),
      started: this.started,
      simulated: this.net.simulated,
    };
    this.listeners.forEach((cb) => cb({ type: "members", snapshot }));
  }

  private handleNet = (msg: { kind: string; from: string; fromName: string; payload: Record<string, unknown> }) => {
    const p = msg.payload;
    if (msg.kind === "peer-joined") {
      const peerId = String(p.peerId ?? msg.from);
      if (!this.members.some((m) => m.id === peerId)) {
        this.members.push({
          id: peerId,
          name: String(p.name ?? msg.fromName ?? "Crew"),
          isPlayer: false,
          simulated: p.simulated === true,
          role: null,
          skill: 2 + Math.floor(Math.random() * 3),
          cut: 0,
          ready: false,
        });
        this.pushMembers();
      }
    } else if (msg.kind === "peer-ready") {
      const m = this.members.find((x) => x.id === String(p.peerId ?? msg.from));
      if (m) {
        m.ready = p.ready === true;
        this.pushMembers();
      }
    } else if (msg.kind === "role-claim") {
      const peerId = String(p.peerId ?? msg.from);
      const role = p.role as CrewRole | null;
      // one crew per role — first claim wins
      if (role && !this.members.some((m) => m.role === role && m.id !== peerId)) {
        const m = this.members.find((x) => x.id === peerId);
        if (m) {
          m.role = role;
          this.pushMembers();
        }
      }
    } else if (msg.kind === "heist-start") {
      this.started = true;
      const templateId = String(p.templateId ?? this.pendingTemplate);
      const approach = (p.approach as Approach) ?? this.pendingApproach;
      this.pendingTemplate = templateId;
      this.pendingApproach = approach;
      this.listeners.forEach((cb) => cb({ type: "start", templateId, approach }));
      this.pushMembers();
    }
  };

  private attach() {
    this.unsubNet?.();
    this.unsubNet = this.net.onMessage(this.handleNet as (m: NetMessage) => void);
  }

  get me(): CrewMember | undefined {
    return this.members.find((m) => m.isPlayer);
  }

  async host(playerName = "You"): Promise<string> {
    this.reset();
    this.attach();
    this.isHost = true;
    this.code = await this.net.host();
    this.members = [
      { id: this.net.peerId, name: playerName, isPlayer: true, role: "leader", skill: 3, cut: 0, ready: true },
    ];
    this.pushMembers();
    return this.code;
  }

  async join(code: string, playerName = "You"): Promise<void> {
    this.reset();
    this.attach();
    this.isHost = false;
    await this.net.join(code);
    this.code = code.trim().toUpperCase();
    this.members = [
      { id: this.net.peerId, name: playerName, isPlayer: true, role: null, skill: 3, cut: 0, ready: false },
    ];
    this.pushMembers();
  }

  claimRole(role: CrewRole | null): void {
    const me = this.me;
    if (!me || this.started) return;
    if (role && this.members.some((m) => m.role === role && m.id !== me.id)) return;
    me.role = role;
    this.net.send("role-claim", { peerId: me.id, role });
    this.pushMembers();
  }

  setReady(ready: boolean): void {
    const me = this.me;
    if (!me || this.started) return;
    me.ready = ready;
    this.net.send("peer-ready", { peerId: me.id, ready });
    this.pushMembers();
  }

  /** everyone has a role and is ready, crew size fits the template */
  canStart(template: HeistTemplate): boolean {
    if (!this.isHost || this.started || this.members.length === 0) return false;
    if (this.members.length < template.minCrew || this.members.length > template.maxCrew) return false;
    return this.members.every((m) => m.ready && m.role);
  }

  start(templateId: string, approach: Approach): boolean {
    if (this.started) return false;
    this.pendingTemplate = templateId;
    this.pendingApproach = approach;
    this.started = true;
    this.net.send("heist-start", { templateId, approach });
    this.listeners.forEach((cb) => cb({ type: "start", templateId, approach }));
    this.pushMembers();
    return true;
  }

  snapshot(): CoopSnapshot {
    return {
      code: this.code,
      isHost: this.isHost,
      members: this.members.map((m) => ({ ...m })),
      started: this.started,
      simulated: this.net.simulated,
    };
  }

  reset(): void {
    this.net.leave();
    this.members = [];
    this.code = null;
    this.isHost = false;
    this.started = false;
  }

  dispose(): void {
    this.unsubNet?.();
    this.net.dispose();
    this.listeners.clear();
  }
}

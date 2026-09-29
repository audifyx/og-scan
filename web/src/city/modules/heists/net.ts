/**
 * Multiplayer-ready networking seam for co-op heists.
 *
 * `NetAdapter` is the transport contract. v1 ships `LocalNet`, which
 * simulates remote crew members locally (bots that join, pick roles and
 * ready-up) so the full co-op flow — lobby codes, role assignment, ready
 * check, synchronized start, loot split — is playable and testable today.
 *
 * MULTIPLAYER GAPS (documented for the netcode team, see MODULE.md):
 *  - no real transport: needs WebSocket / Supabase Realtime / LiveKit room
 *  - no host migration, no reconnection, no anti-cheat / authoritative sim
 *  - message schema is versioned (`v: 1`) so a real adapter can swap in
 *    without touching crew/UI code: just implement NetAdapter.
 */
import type { NetAdapter, NetMessage } from "./types";

const BOT_NAMES = ["Vex", "Marisol", "Dre", "Kaito", "Rook", "Sable", "Nyx", "Toro"];

function makeCode(): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

/** roles bots claim on their own (host player is always the leader) */
const BOT_ROLE_CLAIMS = ["driver", "hacker", "muscle", "lookout", "ghost"];

export class LocalNet implements NetAdapter {
  readonly peerId = uid("peer");
  readonly simulated = true;

  private listeners = new Set<(m: NetMessage) => void>();
  private code: string | null = null;
  private timers: Array<ReturnType<typeof setTimeout>> = [];
  private botPeers: Array<{ id: string; name: string }> = [];

  private emit(kind: string, payload: Record<string, unknown>, from?: { id: string; name: string }) {
    const msg: NetMessage = {
      v: 1,
      kind,
      from: from?.id ?? this.peerId,
      fromName: from?.name ?? "You",
      at: Date.now(),
      payload,
    };
    this.listeners.forEach((cb) => cb(msg));
  }

  private later(ms: number, fn: () => void) {
    this.timers.push(setTimeout(fn, ms));
  }

  async host(): Promise<string> {
    this.leave();
    this.code = makeCode();
    const botCount = 1 + Math.floor(Math.random() * 2); // 1-2 simulated crewmates
    const names = [...BOT_NAMES].sort(() => Math.random() - 0.5).slice(0, botCount);
    names.forEach((name, i) => {
      const bot = { id: uid("sim"), name };
      this.botPeers.push(bot);
      this.later(900 + i * 1100, () => {
        if (!this.code) return;
        this.emit("peer-joined", { peerId: bot.id, name: bot.name, simulated: true }, bot);
        this.later(1200 + Math.random() * 1500, () => {
          if (!this.code) return;
          // bot claims a crew role, then readies up — keeps the v1 lobby playable solo
          this.emit("role-claim", { peerId: bot.id, role: BOT_ROLE_CLAIMS[i % BOT_ROLE_CLAIMS.length] }, bot);
          this.later(800 + Math.random() * 800, () => {
            if (!this.code) return;
            this.emit("peer-ready", { peerId: bot.id, ready: true }, bot);
          });
        });
      });
    });
    return this.code;
  }

  async join(code: string): Promise<void> {
    this.leave();
    const clean = code.trim().toUpperCase();
    if (!/^[A-Z0-9]{6}$/.test(clean)) throw new Error("Invalid crew code — codes are 6 characters.");
    this.code = clean;
    // simulated host + one bot crewmate so join flow is exercisable solo
    const hostBot = { id: uid("sim"), name: "Vex" };
    this.botPeers.push(hostBot);
    this.later(700, () => {
      if (!this.code) return;
      this.emit("peer-joined", { peerId: hostBot.id, name: hostBot.name, simulated: true, host: true }, hostBot);
    });
  }

  send(kind: string, payload: Record<string, unknown>): void {
    if (!this.code) return;
    // loop back to self so the local client processes its own intents uniformly
    this.emit(kind, payload);
    // simulated peers react to a few key intents
    if (kind === "role-claim") {
      const bot = this.botPeers[0];
      if (bot && Math.random() < 0.8) {
        const roles = ["driver", "hacker", "muscle", "lookout", "ghost"];
        const pick = roles[Math.floor(Math.random() * roles.length)];
        this.later(900, () => {
          if (!this.code) return;
          this.emit("role-claim", { peerId: bot.id, role: pick }, bot);
        });
      }
    }
    if (kind === "heist-start") {
      this.botPeers.forEach((bot, i) =>
        this.later(600 + i * 400, () => {
          if (!this.code) return;
          this.emit("heist-start-ack", { peerId: bot.id }, bot);
        }),
      );
    }
  }

  onMessage(cb: (m: NetMessage) => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  leave(): void {
    this.code = null;
    this.botPeers = [];
    this.timers.forEach(clearTimeout);
    this.timers = [];
  }

  dispose(): void {
    this.leave();
    this.listeners.clear();
  }
}

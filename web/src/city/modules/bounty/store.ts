/**
 * OrbitXCity — Bounty module store.
 *
 * Framework-agnostic class (no React import). Owns:
 *  - posting: validates → debits paper CITY locally OR fires a backend-signed
 *    ORBITX burn spend → records the escrow entry → persists.
 *  - claiming: paper claims pay out of the local escrow record immediately;
 *    ORBITX claims call the backend claim route (backend-signed, no popup);
 *    if the backend route is unavailable the claim is rejected and the bounty
 *    stays OPEN (fail-closed, no phantom payouts).
 *  - expiry sweep: open bounties past expiresAt are expired; paper bounties
 *    auto-refund to the poster; ORBITX bounties attempt the backend expire
 *    route and, if it is missing, stay flagged for a later sweep.
 *  - cancellation: poster-only, open bounties only; paper refunds; ORBITX
 *    requests backend refund.
 *
 * Persistence: localStorage (paper state + ORBITX escrow refs/signatures;
 * never keys). The game never custodies funds — for ORBITX the ledger of
 * truth lives in the backend escrow service; local state is a mirror keyed
 * by escrowRef.
 */

import type {
  Bounty,
  BountyCurrency,
  BountyEvent,
  BountyPlayer,
  CancelBountyResult,
  ClaimBountyResult,
  EscrowRecord,
  OrbitxBillingProvider,
  PaperLedgerPort,
  PostBountyError,
  PostBountyResult,
} from "./types";
import { burnPurchase } from "@/tokenomics/burnFlow";

export const BOUNTY_STORAGE_KEY = "orbitxcity:bounties:v1";

export const MIN_CITY_BOUNTY = 10;
export const MIN_ORBITX_BOUNTY = 1;
export const MAX_CITY_BOUNTY = 1_000_000;
export const MAX_ORBITX_BOUNTY = 10_000;
/** Safety cap on simultaneously open bounties (single client mirror). */
export const MAX_OPEN_BOUNTIES = 200;

/** Allowed expiry windows, in ms. */
export const BOUNTY_DURATIONS = [
  { id: "6h", label: "6 hours", ms: 6 * 3600_000 },
  { id: "24h", label: "24 hours", ms: 24 * 3600_000 },
  { id: "3d", label: "3 days", ms: 3 * 24 * 3600_000 },
  { id: "7d", label: "7 days", ms: 7 * 24 * 3600_000 },
] as const;

export type BountyDurationId = (typeof BOUNTY_DURATIONS)[number]["id"];

export interface PostBountyInput {
  targetDisplayName: string;
  targetPlayerId?: string;
  currency: BountyCurrency;
  amount: number; // whole units (CITY coins / ORBITX tokens)
  note?: string;
  durationId: BountyDurationId;
}

export interface BountyPorts {
  /** Current signed-in player (the poster / hunter). */
  me: BountyPlayer;
  /** Paper-CITY ledger; required for CITY bounties. */
  paper: PaperLedgerPort;
  /** ORBITX billing; required for ORBITX bounties. */
  billing?: OrbitxBillingProvider;
  /**
   * Optional resolver: display name → player id, supplied by the integrator
   * once a player directory exists. Defaults to a slug of the display name.
   */
  resolvePlayerId?: (displayName: string) => Promise<string | null>;
}

/** Backend route paths (assumption — see MODULE.md). Relative to the app origin. */
const BACKEND_CLAIM_PATH = "/api/city/bounties/claim";
const BACKEND_EXPIRE_PATH = "/api/city/bounties/expire";
const BACKEND_CANCEL_PATH = "/api/city/bounties/cancel";

interface StoreShape {
  bounties: Bounty[];
  escrow: EscrowRecord[];
  events: BountyEvent[];
}

type Listener = () => void;

function uid(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return `${prefix}_${crypto.randomUUID()}`;
  return `${prefix}_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e9).toString(36)}`;
}

function slugify(name: string): string {
  return (
    "player_" +
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 48)
  );
}

function load(): StoreShape {
  try {
    const raw = localStorage.getItem(BOUNTY_STORAGE_KEY);
    if (!raw) return { bounties: [], escrow: [], events: [] };
    const parsed = JSON.parse(raw) as StoreShape;
    if (!Array.isArray(parsed.bounties)) return { bounties: [], escrow: [], events: [] };
    return {
      bounties: parsed.bounties,
      escrow: Array.isArray(parsed.escrow) ? parsed.escrow : [],
      events: Array.isArray(parsed.events) ? parsed.events : [],
    };
  } catch {
    return { bounties: [], escrow: [], events: [] };
  }
}

export class BountyStore {
  private bounties: Bounty[];
  private escrow: EscrowRecord[];
  private events: BountyEvent[];
  private listeners = new Set<Listener>();
  private sweepTimer: ReturnType<typeof setInterval> | null = null;
  /** Monotonic revision bumped on every mutation — safe getSnapshot for React. */
  private revision = 0;

  constructor() {
    const s = load();
    this.bounties = s.bounties;
    this.escrow = s.escrow;
    this.events = s.events;
  }

  // ── subscriptions ─────────────────────────────────────────────
  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  private emit(): void {
    this.persist();
    this.revision += 1;
    for (const fn of this.listeners) {
      try {
        fn();
      } catch {
        /* listener failure must never break the store */
      }
    }
  }

  /** Current revision — use with useSyncExternalStore. */
  getRevision(): number {
    return this.revision;
  }

  private persist(): void {
    try {
      const shape: StoreShape = {
        bounties: this.bounties,
        escrow: this.escrow,
        events: this.events.slice(-300), // keep the log bounded
      };
      localStorage.setItem(BOUNTY_STORAGE_KEY, JSON.stringify(shape));
    } catch {
      /* storage full/blocked — game keeps running on memory */
    }
  }

  private log(bountyId: string, kind: BountyEvent["kind"], actorName: string, detail: string): void {
    this.events.push({ id: uid("evt"), bountyId, at: Date.now(), kind, actorName, detail });
    this.events = this.events.slice(-300);
  }

  // ── reads ─────────────────────────────────────────────────────
  list(): Bounty[] {
    return [...this.bounties].sort((a, b) => b.createdAt - a.createdAt);
  }

  open(): Bounty[] {
    const now = Date.now();
    return this.bounties
      .filter((b) => b.status === "open" && b.expiresAt > now)
      .sort((a, b) => b.amount - a.amount || b.expiresAt - a.expiresAt);
  }

  mine(playerId: string): Bounty[] {
    return this.bounties.filter((b) => b.posterId === playerId);
  }

  get(id: string): Bounty | undefined {
    return this.bounties.find((b) => b.id === id);
  }

  eventsFor(bountyId: string): BountyEvent[] {
    return this.events.filter((e) => e.bountyId === bountyId).sort((a, b) => a.at - b.at);
  }

  escrowFor(bountyId: string): EscrowRecord | undefined {
    return this.escrow.find((e) => e.bountyId === bountyId);
  }

  stats(): { open: number; claimed: number; totalCityPaid: number; totalOrbitxPosted: number } {
    let totalCityPaid = 0;
    let totalOrbitxPosted = 0;
    let open = 0;
    let claimed = 0;
    for (const b of this.bounties) {
      if (b.status === "open") open += 1;
      if (b.status === "claimed") {
        claimed += 1;
        if (b.currency === "CITY") totalCityPaid += b.amount;
      }
      if (b.currency === "ORBITX" && b.status !== "cancelled") totalOrbitxPosted += b.amount;
    }
    return { open, claimed, totalCityPaid, totalOrbitxPosted };
  }

  // ── lifecycle: posting ────────────────────────────────────────
  async post(input: PostBountyInput, ports: BountyPorts): Promise<PostBountyResult> {
    const err = this.validatePost(input, ports);
    if (err) return { ok: false, error: err };

    const openCount = this.bounties.filter((b) => b.status === "open").length;
    if (openCount >= MAX_OPEN_BOUNTIES) return { ok: false, error: "store_full" };

    const name = input.targetDisplayName.trim();
    const targetId =
      input.targetPlayerId?.trim() ||
      (ports.resolvePlayerId ? await ports.resolvePlayerId(name) : null) ||
      slugify(name);

    const now = Date.now();
    const duration = BOUNTY_DURATIONS.find((d) => d.id === input.durationId)!;
    const bounty: Bounty = {
      id: uid("bty"),
      target: { playerId: targetId, displayName: name },
      posterId: ports.me.playerId,
      posterName: ports.me.displayName,
      currency: input.currency,
      amount: Math.floor(input.amount),
      note: (input.note ?? "").trim().slice(0, 140),
      createdAt: now,
      expiresAt: now + duration.ms,
      status: "open",
      escrowRef: uid("esc"),
    };

    if (input.currency === "CITY") {
      const debited = await ports.paper.debit(bounty.amount, `bounty:posted:${bounty.id}`);
      if (!debited) return { ok: false, error: "insufficient_paper" };
      this.escrow.push({
        bountyId: bounty.id,
        currency: "CITY",
        amount: bounty.amount,
        ref: bounty.escrowRef,
        heldAt: now,
      });
    } else {
      // ORBITX: backend-signed burn. The burn tx IS the escrow funding —
      // the backend escrow service indexes by escrowRef and holds the value.
      const billing = ports.billing;
      if (!billing || !billing.ready) return { ok: false, error: "billing_not_ready" };
      try {
        // Canonical buy-and-burn — the burn tx IS the escrow funding; the
        // backend escrow service indexes by escrowRef and holds the value.
        // Dry-run safe: records the would-be call without touching the chain.
        const res = await burnPurchase(billing, {
          amount: bounty.amount,
          itemId: bounty.id,
          label: `Bounty escrow: ${bounty.id}`,
          reason: `city:bounty:${bounty.id}`,
          ref: bounty.escrowRef,
          module: "bounty",
        });
        if (!res.ok) throw new Error(res.message);
        const { signature } = res;
        bounty.burnSignature = signature;
        this.escrow.push({
          bountyId: bounty.id,
          currency: "ORBITX",
          amount: bounty.amount,
          ref: bounty.escrowRef,
          burnSignature: signature,
          heldAt: now,
        });
      } catch {
        return { ok: false, error: "billing_failed" };
      }
    }

    this.bounties.push(bounty);
    this.log(bounty.id, "posted", ports.me.displayName, `${bounty.amount} ${bounty.currency} on ${name}`);
    this.emit();
    return { ok: true, bounty };
  }

  private validatePost(input: PostBountyInput, ports: BountyPorts): PostBountyError | null {
    const name = input.targetDisplayName.trim();
    if (!name) return "bad_target";
    const normalizedTarget = name.toLowerCase();
    if (
      normalizedTarget === ports.me.displayName.trim().toLowerCase() ||
      (input.targetPlayerId && input.targetPlayerId === ports.me.playerId)
    ) {
      return "self_target";
    }
    if (!Number.isFinite(input.amount) || input.amount <= 0 || !Number.isInteger(input.amount)) {
      return "bad_amount";
    }
    if (input.currency === "CITY" && (input.amount < MIN_CITY_BOUNTY || input.amount > MAX_CITY_BOUNTY)) {
      return "bad_amount";
    }
    if (input.currency === "ORBITX" && (input.amount < MIN_ORBITX_BOUNTY || input.amount > MAX_ORBITX_BOUNTY)) {
      return "bad_amount";
    }
    if (!BOUNTY_DURATIONS.some((d) => d.id === input.durationId)) return "bad_duration";
    return null;
  }

  // ── lifecycle: claiming ───────────────────────────────────────
  /**
   * Claim a bounty as the hunter. The hunter must be a different player than
   * the poster. For CITY the payout credits immediately from the local escrow
   * record. For ORBITX the backend claim route performs the backend-signed
   * payout; if it fails the bounty stays OPEN and the hunter gets a typed
   * error (fail-closed: never credit without a confirmed backend payout).
   */
  async claim(bountyId: string, ports: BountyPorts): Promise<ClaimBountyResult> {
    const bounty = this.get(bountyId);
    if (!bounty) return { ok: false, error: "not_found" };
    if (bounty.status !== "open" || bounty.expiresAt <= Date.now()) {
      this.sweepExpired(ports).catch(() => undefined);
      return { ok: false, error: "not_open" };
    }
    if (bounty.posterId === ports.me.playerId) return { ok: false, error: "self_claim" };

    if (bounty.currency === "CITY") {
      const rec = this.escrowFor(bounty.id);
      if (!rec) return { ok: false, error: "store_error" };
      try {
        await ports.paper.credit(bounty.amount, `bounty:claimed:${bounty.id}`);
      } catch {
        return { ok: false, error: "store_error" };
      }
      rec.releasedAt = Date.now();
      bounty.status = "claimed";
      bounty.claimedBy = ports.me.playerId;
      bounty.claimedByName = ports.me.displayName;
      bounty.claimedAt = Date.now();
      this.log(bounty.id, "claimed", ports.me.displayName, `took the ${bounty.amount} CITY bounty on ${bounty.target.displayName}`);
      this.emit();
      return { ok: true, bounty };
    }

    // ORBITX: backend-signed payout route. Never mark claimed without it.
    try {
      const res = await fetch(BACKEND_CLAIM_PATH, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bountyId: bounty.id,
          escrowRef: bounty.escrowRef,
          hunterPlayerId: ports.me.playerId,
          hunterName: ports.me.displayName,
          amount: bounty.amount,
        }),
      });
      if (!res.ok) return { ok: false, error: "backend_pending" };
      const data = (await res.json()) as { signature?: string };
      bounty.status = "claimed";
      bounty.claimedBy = ports.me.playerId;
      bounty.claimedByName = ports.me.displayName;
      bounty.claimedAt = Date.now();
      if (data.signature) bounty.payoutSignature = data.signature;
      const rec = this.escrowFor(bounty.id);
      if (rec) rec.releasedAt = Date.now();
      this.log(bounty.id, "claimed", ports.me.displayName, `took the ${bounty.amount} ORBITX bounty on ${bounty.target.displayName}`);
      this.emit();
      return { ok: true, bounty };
    } catch {
      return { ok: false, error: "backend_pending" };
    }
  }

  // ── lifecycle: cancellation (poster only) ─────────────────────
  async cancel(bountyId: string, ports: BountyPorts): Promise<CancelBountyResult> {
    const bounty = this.get(bountyId);
    if (!bounty) return { ok: false, error: "not_found" };
    if (bounty.status !== "open" || bounty.expiresAt <= Date.now()) {
      this.sweepExpired(ports).catch(() => undefined);
      return { ok: false, error: "not_open" };
    }
    if (bounty.posterId !== ports.me.playerId) return { ok: false, error: "not_owner" };

    if (bounty.currency === "CITY") {
      try {
        await ports.paper.credit(bounty.amount, `bounty:cancel-refund:${bounty.id}`);
      } catch {
        return { ok: false, error: "not_open" };
      }
      const rec = this.escrowFor(bounty.id);
      if (rec) rec.refundedAt = Date.now();
      bounty.status = "cancelled";
      bounty.cancelledAt = Date.now();
      this.log(bounty.id, "cancelled", ports.me.displayName, `cancelled — ${bounty.amount} CITY refunded`);
      this.log(bounty.id, "refund", ports.me.displayName, `${bounty.amount} CITY returned to poster`);
      this.emit();
      return { ok: true, bounty };
    }

    // ORBITX: backend refund route.
    try {
      const res = await fetch(BACKEND_CANCEL_PATH, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bountyId: bounty.id, escrowRef: bounty.escrowRef }),
      });
      if (!res.ok) return { ok: false, error: "backend_pending" };
      const rec = this.escrowFor(bounty.id);
      if (rec) rec.refundedAt = Date.now();
      bounty.status = "cancelled";
      bounty.cancelledAt = Date.now();
      this.log(bounty.id, "cancelled", ports.me.displayName, `cancelled — backend refunded ${bounty.amount} ORBITX`);
      this.log(bounty.id, "refund", ports.me.displayName, `${bounty.amount} ORBITX refund requested to poster`);
      this.emit();
      return { ok: true, bounty };
    } catch {
      return { ok: false, error: "backend_pending" };
    }
  }

  // ── lifecycle: expiry sweep ───────────────────────────────────
  /**
   * Expire every open bounty past its expiry. Paper bounties auto-refund to
   * the poster; ORBITX bounties ask the backend expire route (backend-signed
   * refund or re-burn per tokenomics policy). If the backend route is missing
   * the bounty is still marked expired locally so it leaves the board — the
   * escrow record keeps escrowRef + burnSignature so the backend can settle
   * out of band. Start with `startSweep()` on mount, `stopSweep()` on unmount.
   */
  async sweepExpired(ports: { paper: PaperLedgerPort }): Promise<number> {
    const now = Date.now();
    let changed = 0;
    for (const bounty of this.bounties) {
      if (bounty.status !== "open" || bounty.expiresAt > now) continue;
      bounty.status = "expired";
      bounty.expiredAt = now;
      const rec = this.escrowFor(bounty.id);
      if (bounty.currency === "CITY") {
        try {
          await ports.paper.credit(bounty.amount, `bounty:expired-refund:${bounty.id}`);
          if (rec) rec.refundedAt = now;
          this.log(bounty.id, "expired", "system", `expired — ${bounty.amount} CITY refunded to poster`);
          this.log(bounty.id, "refund", "system", `${bounty.amount} CITY returned to ${bounty.posterName}`);
        } catch {
          this.log(bounty.id, "escrow_failed", "system", `expired but paper refund failed — needs retry`);
        }
      } else {
        try {
          const res = await fetch(BACKEND_EXPIRE_PATH, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ bountyId: bounty.id, escrowRef: bounty.escrowRef }),
          });
          if (res.ok) {
            if (rec) rec.refundedAt = now;
            this.log(bounty.id, "expired", "system", `expired — backend settled ${bounty.amount} ORBITX`);
          } else {
            this.log(bounty.id, "escrow_failed", "system", `expired — backend expire route unavailable, escrowRef ${bounty.escrowRef} needs settlement`);
          }
        } catch {
          this.log(bounty.id, "escrow_failed", "system", `expired — backend unreachable, escrowRef ${bounty.escrowRef} needs settlement`);
        }
      }
      changed += 1;
    }
    if (changed > 0) this.emit();
    return changed;
  }

  /** Start the periodic expiry sweep. Returns a stop function. */
  startSweep(ports: { paper: PaperLedgerPort }, intervalMs = 60_000): () => void {
    this.stopSweep();
    this.sweepTimer = setInterval(() => {
      this.sweepExpired(ports).catch(() => undefined);
    }, intervalMs);
    if (typeof this.sweepTimer === "object" && "unref" in this.sweepTimer) {
      (this.sweepTimer as { unref?: () => void }).unref?.();
    }
    return () => this.stopSweep();
  }

  stopSweep(): void {
    if (this.sweepTimer) {
      clearInterval(this.sweepTimer);
      this.sweepTimer = null;
    }
  }
}

// ── React binding (single shared instance) ─────────────────────
let shared: BountyStore | null = null;

/** Shared store instance — created once per page load. */
export function getBountyStore(): BountyStore {
  if (!shared) shared = new BountyStore();
  return shared;
}

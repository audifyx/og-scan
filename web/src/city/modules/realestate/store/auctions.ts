/**
 * Real estate module — penthouse auction store (FLAGSHIP).
 *
 * Lots run on a deterministic schedule (`lotForSlot` / `currentSlot` in the
 * catalog), so every client agrees which lot is live without a server.
 *
 * Rules (locked by the user):
 *  - Bids are in real ORBITX. EVERY bid burns — winner or loser — via the
 *    backend-signed billing adapter. No wallet popups.
 *  - Anti-snipe: a bid inside the last 60s extends the lot by 60s.
 *  - Minimum raise: +5% over the current high.
 *  - The winner receives a tier-5 landmark penthouse deed (an NFT deed in
 *    the deed store, with a metadata payload for the platform's NFT infra).
 *
 * Rival bidders are simulated deterministically per lot (seeded from the
 * lot id) — clearly marked `npc: true`, paper-only, never touching the
 * chain. They exist to make the auction feel alive without a backend.
 */
import { useSyncExternalStore } from "react";
import type { AuctionLot, Bid } from "../types";
import {
  ANTI_SNIPE_MS,
  ANTI_SNIPE_WINDOW_MS,
  auctionDurationMs,
  currentSlot,
  lotForSlot,
} from "../data/catalog";
import { PLAYER_ID } from "./identity";
import type { RealEstateBilling } from "../billing";
import { deedStore } from "./deeds";

const STORAGE_KEY = "orbitxcity:realestate-auctions:v1";
const MAX_BIDS_PER_LOT = 60;

interface AuctionState {
  bids: Record<string, Bid[]>; // lotId → bids (newest first)
  extensions: Record<string, number>; // lotId → extra ms added by anti-snipe
  resolved: Record<string, string>; // lotId → winning bidId
}

function load(): AuctionState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AuctionState;
      if (parsed && typeof parsed === "object") {
        return {
          bids: parsed.bids ?? {},
          extensions: parsed.extensions ?? {},
          resolved: parsed.resolved ?? {},
        };
      }
    }
  } catch {
    /* corrupted storage — start fresh */
  }
  return { bids: {}, extensions: {}, resolved: {} };
}

let state: AuctionState = load();
const listeners = new Set<() => void>();

function emit() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* storage blocked — keep in memory */
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): AuctionState {
  return state;
}

/* ── Deterministic NPC simulation ────────────────────────────────── */

const NPC_NAMES = [
  "NeonKing", "BayWhale", "ClocktowerFan", "OrbitLord", "VistaVue",
  "HelipadHank", "BrickBaron", "LoftLurker", "PaperHandsPete", "GtaGhost",
  "MarinaMogul", "FoundryFox",
];

function xfnv1a(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface NpcBidPlan {
  at: number; // ms offset into the lot
  bidderName: string;
  amount: number;
}

/** Deterministic rival-bid plan for a lot. Pure function of (lotId, duration). */
function npcPlan(lot: AuctionLot): NpcBidPlan[] {
  const rand = mulberry32(xfnv1a(lot.lotId));
  const duration = auctionDurationMs();
  const count = 6 + Math.floor(rand() * 7); // 6..12 NPC bids
  const finalMult = 1.35 + rand() * 0.9; // hammer lands 1.35x–2.25x the start
  const plan: NpcBidPlan[] = [];
  let amount = lot.startingBidOrbitx;
  for (let i = 0; i < count; i++) {
    const progress = (i + 1) / count;
    // Bid timing: cluster toward the end (drama), deterministic jitter.
    const at = duration * Math.min(0.98, 0.08 + 0.9 * Math.pow(progress, 1.6) + (rand() - 0.5) * 0.05);
    const target = lot.startingBidOrbitx * (1 + (finalMult - 1) * Math.pow(progress, 1.3));
    amount = Math.max(Math.ceil(target), Math.ceil(amount * (1 + lot.minIncrementPct)));
    plan.push({
      at: Math.max(0, at),
      bidderName: NPC_NAMES[Math.floor(rand() * NPC_NAMES.length)],
      amount,
    });
  }
  plan.sort((a, b) => a.at - b.at);
  return plan;
}

/* ── Lot views ───────────────────────────────────────────────────── */

export interface LotView extends AuctionLot {
  bids: Bid[];
  highBid?: Bid;
  effectiveEndsAt: number;
  ended: boolean;
  resolved: boolean;
  winner?: Bid;
}

function buildLotView(slot: number, now: number): LotView {
  const lot = lotForSlot(slot);
  const ext = state.extensions[lot.lotId] ?? 0;
  const effectiveEndsAt = lot.endsAt + ext;
  const bids = (state.bids[lot.lotId] ?? []).slice().sort((a, b) => b.amountOrbitx - a.amountOrbitx);
  const status: AuctionLot["status"] = now < lot.startsAt ? "upcoming" : now < effectiveEndsAt ? "live" : "ended";
  const resolved = !!state.resolved[lot.lotId];
  const winnerBidId = state.resolved[lot.lotId];
  const winner = bids.find((b) => b.bidId === winnerBidId);
  return {
    ...lot,
    status,
    bids,
    highBid: bids[0],
    effectiveEndsAt,
    ended: status === "ended",
    resolved,
    winner,
    winningBidderId: winner?.bidderId,
    winningBidderName: winner?.bidderName,
    winningAmountOrbitx: winner?.amountOrbitx,
    winnerBidId: winner?.bidId,
    wonByPlayer: resolved && !!winner && !winner.npc && winner.bidderId === PLAYER_ID,
  };
}

export interface AuctionBoard {
  current: LotView;
  next: LotView;
  previous: LotView[];
}

/** The live board: current lot, next lot, and the last 3 finished lots. */
export function getAuctionBoard(now: number = Date.now()): AuctionBoard {
  const slot = currentSlot(now);
  return {
    current: buildLotView(slot, now),
    next: buildLotView(slot + 1, now),
    previous: [slot - 1, slot - 2, slot - 3].map((s) => buildLotView(s, now)),
  };
}

/* ── Store ───────────────────────────────────────────────────────── */

export const auctionStore = {
  get: getSnapshot,
  subscribe,

  /** Minimum acceptable bid for a lot (current high × 1.05, or the start). */
  minBid(lot: LotView): number {
    if (lot.highBid) return Math.ceil(lot.highBid.amountOrbitx * (1 + lot.minIncrementPct));
    return lot.startingBidOrbitx;
  },

  /**
   * Place a REAL bid — burns the full amount of ORBITX (win or lose),
   * backend-signed, no popup. Extends the lot if inside the anti-snipe window.
   */
  async placeBid(lot: LotView, amount: number, bidderId: string, bidderName: string, billing: RealEstateBilling): Promise<Bid> {
    const now = Date.now();
    if (lot.ended) throw new Error("This lot has ended");
    if (!Number.isFinite(amount) || amount <= 0) throw new Error("Invalid bid");
    const min = this.minBid(lot);
    if (amount < min) throw new Error(`Bid must be at least ${min.toLocaleString()} ORBITX`);
    const whole = Math.ceil(amount);
    const { signature } = await billing.buyPremium(
      `auction:${lot.lotId}:bid`,
      `Penthouse bid — ${lot.title} (${whole.toLocaleString()} ORBITX)`,
      whole
    );
    const bid: Bid = {
      bidId: crypto.randomUUID(),
      lotId: lot.lotId,
      bidderId,
      bidderName,
      amountOrbitx: whole,
      at: now,
      signature,
      npc: false,
    };
    const bids = [bid, ...(state.bids[lot.lotId] ?? [])].slice(0, MAX_BIDS_PER_LOT);
    let extensions = state.extensions;
    // Anti-snipe: bids inside the final window extend the lot.
    const currentEnd = lot.effectiveEndsAt;
    if (currentEnd - now < ANTI_SNIPE_WINDOW_MS) {
      extensions = { ...extensions, [lot.lotId]: (extensions[lot.lotId] ?? 0) + ANTI_SNIPE_MS };
    }
    state = { ...state, bids: { ...state.bids, [lot.lotId]: bids }, extensions };
    emit();
    return bid;
  },

  /**
   * Drive the simulation forward: materialize due NPC bids and resolve
   * finished lots. Call from a UI interval while the auction tab is open.
   */
  sync(now: number = Date.now(), playerId?: string) {
    const slot = currentSlot(now);
    let changed = false;
    const bids = { ...state.bids };

    // Materialize NPC bids for the current (and recently live) lots.
    for (let s = slot - 2; s <= slot; s++) {
      const lot = lotForSlot(s);
      const ext = state.extensions[lot.lotId] ?? 0;
      const effectiveEnd = lot.endsAt + ext;
      if (now < lot.startsAt || now >= effectiveEnd) continue;
      const existing = bids[lot.lotId] ?? [];
      const plan = npcPlan(lot);
      const due = plan.filter((p) => lot.startsAt + p.at <= now);
      // Only add NPC bids that don't already exist (compare by plan index).
      const npcCount = existing.filter((b) => b.npc).length;
      const missing = due.slice(npcCount);
      if (missing.length === 0) continue;
      const fresh: Bid[] = missing.map((p, i) => ({
        bidId: `${lot.lotId}-npc-${npcCount + i}`,
        lotId: lot.lotId,
        bidderId: `npc:${p.bidderName.toLowerCase()}`,
        bidderName: p.bidderName,
        amountOrbitx: p.amount,
        at: lot.startsAt + p.at,
        npc: true,
      }));
      bids[lot.lotId] = [...fresh, ...existing].slice(0, MAX_BIDS_PER_LOT);
      changed = true;
    }

    // Resolve lots that have ended.
    const resolved = { ...state.resolved };
    for (let s = slot - 3; s <= slot; s++) {
      const lot = lotForSlot(s);
      const ext = state.extensions[lot.lotId] ?? 0;
      if (now < lot.endsAt + ext) continue;
      if (resolved[lot.lotId]) continue;
      const lotBids = (bids[lot.lotId] ?? []).slice().sort((a, b) => b.amountOrbitx - a.amountOrbitx);
      if (lotBids.length === 0) {
        resolved[lot.lotId] = "no-bids";
      } else {
        const winner = lotBids[0];
        resolved[lot.lotId] = winner.bidId;
        // Player win → mint the landmark penthouse deed.
        if (!winner.npc && playerId && winner.bidderId === playerId && winner.signature) {
          deedStore.awardPenthouseDeed(
            lot.lotId,
            lot.title,
            lot.districtId,
            playerId,
            winner.amountOrbitx,
            winner.signature
          );
        }
      }
      changed = true;
    }

    if (changed) {
      state = { ...state, bids, resolved };
      emit();
    }
  },

  /** Bid history for a lot (highest first), NPC bids flagged. */
  bidHistory(lotId: string): Bid[] {
    return (state.bids[lotId] ?? []).slice().sort((a, b) => b.amountOrbitx - a.amountOrbitx);
  },
};

export function useAuctions() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

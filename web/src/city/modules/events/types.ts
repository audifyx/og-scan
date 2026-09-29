/**
 * OrbitXCity — Events module: shared types.
 *
 * Self-contained: this file imports NOTHING from other modules. It only
 * declares interfaces. The integrator (game shell) supplies implementations
 * of the injected host interfaces; the economy/tokenomics teams supply the
 * wallet + billing providers when they land. Until then, UI renders
 * "coming soon / auth required" states per web/src/city/BILLING_CONTRACT.md.
 */

import type * as THREE from "three";

/* ------------------------------------------------------------------ */
/* Event kinds                                                         */
/* ------------------------------------------------------------------ */

/** Server-wide timed events managed by the CityEventDirector. */
export type TimedEventKind =
  | "airdrop"
  | "earthquake"
  | "fireworks"
  | "parade"
  | "protest";

/** Persistent/ambient event features (not started by the director). */
export type FeatureKind = "weathermachine" | "nightmarket" | "blackmarket";

export type EventKind = TimedEventKind | FeatureKind;

/* ------------------------------------------------------------------ */
/* Market data (real-data only — no mock triggers)                     */
/* ------------------------------------------------------------------ */

/**
 * One token's live market snapshot. Structurally identical to the value
 * objects returned by `web/src/hooks/useLivePrices.ts` — the integrator
 * passes the real hook output straight into `evaluateMarketTriggers`.
 * No mock data is ever fabricated inside this module.
 */
export interface MarketQuote {
  price: number;
  priceChange24h: number; // percent, e.g. -18.4
  volume24h: number; // USD
  liquidity: number; // USD
  marketCap: number; // USD
  lastUpdated: number; // epoch ms
}

/** Map of token mint address → live quote. */
export type MarketSnapshot = Record<string, MarketQuote>;

/* ------------------------------------------------------------------ */
/* CityEvent lifecycle                                                 */
/* ------------------------------------------------------------------ */

/** Payload carried by a live event instance. */
export type EventPayload =
  | AirdropPayload
  | EarthquakePayload
  | FireworksPayload
  | ParadePayload
  | ProtestPayload;

export interface CityEvent {
  /** Stable id for this run: `${kind}:${startedAt}`. */
  id: string;
  kind: TimedEventKind;
  /** Human-readable headline for HUD banners. */
  title: string;
  /** Sub-headline / detail line for HUD banners. */
  subtitle: string;
  payload: EventPayload;
  startedAt: number; // epoch ms
  /** When the event naturally ends (Infinity = host-ended). */
  endsAt: number;
  /** Whether players should be notified with a full-screen banner. */
  banner: boolean;
}

export type EventListener = (event: CityEvent) => void;
export type EventEndListener = (event: CityEvent, reason: string) => void;

/* ------------------------------------------------------------------ */
/* Timed-event payloads                                                */
/* ------------------------------------------------------------------ */

export interface AirdropPayload {
  dropZones: { x: number; z: number }[];
  crateCount: number;
  /** Tier rolls at claim time; see scenes/airdropCrates.ts. */
  seed: number;
}

export interface EarthquakePayload {
  tokenSymbol: string;
  dropPct24h: number; // negative number, e.g. -23.5
  magnitude: number; // 1..10 derived from the crash depth
}

export interface FireworksPayload {
  milestoneLabel: string; // e.g. "ORBITX $0.10"
  price: number; // price that crossed the milestone
}

export interface ParadePayload {
  title: string;
  goalLabel: string; // e.g. "Community hit $1M 24h volume"
  route: { x: number; z: number }[]; // waypoints, integrator-supplied
}

export interface ProtestPayload {
  tokenSymbol: string;
  reason: "rug" | "crash" | "scam";
  hq: { x: number; z: number }; // HQ building position (integrator)
  crowdSize: number;
  chant: string;
}

/* ------------------------------------------------------------------ */
/* Scene host — injected by the integrator (core owns the world)       */
/* ------------------------------------------------------------------ */

export type SoundName =
  | "airdrop-plane"
  | "crate-land"
  | "crate-open"
  | "quake-rumble"
  | "firework-launch"
  | "firework-burst"
  | "crowd-cheer"
  | "protest-chant"
  | "weather-switch"
  | "purchase"
  | "market-open";

/**
 * Minimal bridge into the core world. The events module never touches the
 * core loop, camera rig, or player controller directly — every effect goes
 * through these additive hooks.
 */
export interface EventsSceneHost {
  scene: THREE.Scene;
  camera: THREE.Camera;
  /** Current player world position (for proximity / claim checks). */
  getPlayerPosition(out: THREE.Vector3): THREE.Vector3;
  /** Integrator-owned camera shake; core keeps camera authority. */
  shakeCamera(intensity: number, durationMs: number): void;
  /** Name-based sound cue; integrator maps to the game's audio engine. */
  playSound(name: SoundName, volume?: number): void;
  /** True when the game clock is in night hours (drives black market). */
  isNight: boolean;
  /** Half the playable world span in world units. */
  worldHalfSpan: number;
}

/**
 * Per-frame effect handle returned by every scene starter.
 * The integrator ticks `update(dt)` each frame and calls `dispose()`
 * when it returns false (finished) or on teardown.
 */
export interface CityEffectHandle {
  update(dt: number): boolean; // false = finished
  dispose(): void;
}

/* ------------------------------------------------------------------ */
/* Injected providers (economy / tokenomics — defensive, may be absent) */
/* ------------------------------------------------------------------ */

/**
 * Paper-CITY wallet for gameplay earnings (loot, rewards, purchases).
 * Matches the economy module's paper wallet contract; injected by the
 * integrator. If absent, events that need money degrade gracefully
 * (rewards are logged as pending, never fabricated on-chain).
 */
export interface EventsWallet {
  getBalance(): number;
  /** Earn paper CITY. Returns the new balance. */
  earn(amount: number, label: string, source: string): number;
  /** Spend paper CITY. Returns false when funds are insufficient. */
  spend(amount: number, label: string, source: string): boolean;
}

/**
 * Expected shape of the tokenomics billing primitive
 * (`web/src/tokenomics/useOrbitxBilling` — see
 * `web/src/city/BILLING_CONTRACT.md`). The events module NEVER imports
 * `@/tokenomics/*` directly; the integrator injects a provider implementing
 * this interface once tokenomics lands. Null = "auth required / coming
 * soon" UI state.
 */
export interface OrbitxBillingProvider {
  ready: boolean;
  balance: number | null;
  spend: (opts: {
    amount: number;
    reason: string;
    ref?: string;
  }) => Promise<{ signature: string }>;
  beginAuth: () => void;
}

/**
 * Everything the events module needs from the outside world, bundled for
 * the integrator. All fields optional except `host` — the module degrades
 * feature-by-feature when providers are missing.
 */
export interface EventsContext {
  host: EventsSceneHost;
  wallet: EventsWallet | null;
  billing: OrbitxBillingProvider | null;
  /** Firm id that currently controls the weather machine (turf wars). */
  weatherFirmId: string | null;
  /** True when the local player is a member of the controlling firm. */
  playerInWeatherFirm: boolean;
  /** Community 24h trading volume (USD) — real data, integrator-supplied. */
  communityVolume24h: number;
  /** Rugged/scam token HQs to protest outside (real registry data). */
  ruggedHqs: { symbol: string; position: { x: number; z: number } }[];
  /** Called when the player claims an airdrop crate / buys an item. */
  onReward?: (reward: EventReward) => void;
  /** Called when the player joins or counters a protest. */
  onProtestChoice?: (choice: "join" | "counter", payload: ProtestPayload) => void;
}

/** A reward granted to the player by an event. */
export interface EventReward {
  kind: "city" | "cosmetic" | "gadget";
  amount?: number; // paper CITY when kind === "city"
  itemId?: string; // cosmetic/gadget id
  label: string;
}

/* ------------------------------------------------------------------ */
/* UI mount points                                                     */
/* ------------------------------------------------------------------ */

/**
 * Where the integrator mounts event UI. All components are self-contained
 * React components with inline styles (no global CSS dependency).
 *
 * - `hud`      → inside the game HUD layer (above the 3D canvas, below
 *                modal dialogs). Renders the active-event banner queue,
 *                the event ticker feed, and contextual action prompts
 *                (claim crate / join protest / etc.).
 * - `marketPanels` → the night/black market panels render as modals when
 *                the player opens a stall. The integrator wires the "open
 *                stall" interaction and mounts the panel component.
 * - `weatherPanel` → the weather machine control panel, mounted wherever
 *                the integrator puts the turf-war HQ UI (or a standalone
 *                button for the controlling firm).
 */
export type EventUiMount = "hud" | "marketPanels" | "weatherPanel";

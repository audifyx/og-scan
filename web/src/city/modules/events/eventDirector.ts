/**
 * OrbitXCity — Events module: the city-wide event director.
 *
 * One director instance owns the lifecycle of every timed server event
 * (airdrop, earthquake, fireworks, parade, protest): starting, stacking,
 * expiring, and notifying HUD listeners. It knows NOTHING about three.js —
 * scene work happens in `scenes/*`, driven by the integrator from the
 * `onEvent`/`onEventEnd` callbacks below.
 *
 * The director is deliberately "server-shaped": in the multiplayer design
 * the server would broadcast events to all clients; here it runs locally
 * with the same API so the networking team can swap the transport later.
 */

import type {
  CityEffectHandle,
  CityEvent,
  EventEndListener,
  EventListener,
  EventPayload,
  EventsSceneHost,
  TimedEventKind,
} from "./types";

export interface DirectorOptions {
  host: EventsSceneHost;
  /** Max simultaneous timed events. Default 3 (parades yield to quakes). */
  maxConcurrent?: number;
  /** Cooldown between two events of the same kind. Default 5 min. */
  sameKindCooldownMs?: number;
}

const DEFAULT_DURATION_MS: Record<TimedEventKind, number> = {
  airdrop: 10 * 60 * 1000,
  earthquake: 45 * 1000,
  fireworks: 120 * 1000,
  parade: 8 * 60 * 1000,
  protest: 15 * 60 * 1000,
};

const DEFAULT_BANNER: Record<TimedEventKind, boolean> = {
  airdrop: true,
  earthquake: true,
  fireworks: true,
  parade: true,
  protest: false, // protests get a ticker entry, not a full banner
};

export class CityEventDirector {
  private host: EventsSceneHost;
  private maxConcurrent: number;
  private sameKindCooldownMs: number;
  private active = new Map<string, CityEvent>();
  private lastStarted: Record<string, number> = {};
  private startListeners = new Set<EventListener>();
  private endListeners = new Set<EventEndListener>();
  private effects = new Map<string, CityEffectHandle>();
  private lastTick = 0;

  constructor(opts: DirectorOptions) {
    this.host = opts.host;
    this.maxConcurrent = opts.maxConcurrent ?? 3;
    this.sameKindCooldownMs = opts.sameKindCooldownMs ?? 5 * 60 * 1000;
  }

  /* ---------------- listeners ---------------- */

  onEvent(fn: EventListener): () => void {
    this.startListeners.add(fn);
    return () => this.startListeners.delete(fn);
  }

  onEventEnd(fn: EventEndListener): () => void {
    this.endListeners.add(fn);
    return () => this.endListeners.delete(fn);
  }

  /* ---------------- queries ---------------- */

  getActiveEvents(): CityEvent[] {
    return [...this.active.values()].sort((a, b) => a.startedAt - b.startedAt);
  }

  isActive(kind: TimedEventKind): boolean {
    for (const e of this.active.values()) if (e.kind === kind) return true;
    return false;
  }

  /* ---------------- lifecycle ---------------- */

  /**
   * Attempt to start an event. Returns the event, or null when blocked
   * (cooldown, capacity, or an identical event already running).
   * Pass `force = true` for host-driven manual starts (weather/parades).
   */
  start(
    kind: TimedEventKind,
    payload: EventPayload,
    opts?: { title?: string; subtitle?: string; durationMs?: number; banner?: boolean; force?: boolean },
    now: number = Date.now()
  ): CityEvent | null {
    if (!opts?.force) {
      const since = now - (this.lastStarted[kind] ?? 0);
      if (since < this.sameKindCooldownMs) return null;
      if (this.active.size >= this.maxConcurrent && !this.isActive(kind)) return null;
    }
    for (const e of this.active.values()) {
      if (e.kind === kind && e.endsAt === Infinity) return null; // persistent twin already running
    }

    const event: CityEvent = {
      id: `${kind}:${now}`,
      kind,
      title: opts?.title ?? defaultTitle(kind, payload),
      subtitle: opts?.subtitle ?? defaultSubtitle(kind, payload),
      payload,
      startedAt: now,
      endsAt: now + (opts?.durationMs ?? DEFAULT_DURATION_MS[kind]),
      banner: opts?.banner ?? DEFAULT_BANNER[kind],
    };

    this.active.set(event.id, event);
    this.lastStarted[kind] = now;
    for (const fn of this.startListeners) {
      try {
        fn(event);
      } catch {
        /* listener errors must never kill the director */
      }
    }
    return event;
  }

  /**
   * Attach a per-frame scene handle to an event (created by scenes/*).
   * The integrator ticks `tick(dt)` from the render loop; finished
   * handles are disposed automatically.
   */
  attachEffect(eventId: string, handle: CityEffectHandle): void {
    const prev = this.effects.get(eventId);
    if (prev) prev.dispose();
    this.effects.set(eventId, handle);
  }

  /** Advance effects; expire finished events. Call from the render loop. */
  tick(dt: number, now: number = Date.now()): void {
    this.lastTick = now;
    for (const [id, handle] of this.effects) {
      let alive = true;
      try {
        alive = handle.update(dt);
      } catch {
        alive = false;
      }
      if (!alive) {
        handle.dispose();
        this.effects.delete(id);
      }
    }
    for (const [id, event] of this.active) {
      if (now >= event.endsAt) this.end(id, "expired");
    }
  }

  end(eventId: string, reason: string = "ended"): void {
    const event = this.active.get(eventId);
    if (!event) return;
    this.active.delete(eventId);
    const handle = this.effects.get(eventId);
    if (handle) {
      try {
        handle.dispose();
      } catch {
        /* ignore */
      }
      this.effects.delete(eventId);
    }
    for (const fn of this.endListeners) {
      try {
        fn(event, reason);
      } catch {
        /* ignore */
      }
    }
  }

  /** Host accessor for scenes that need it (kept off the public contract). */
  getHost(): EventsSceneHost {
    return this.host;
  }

  getLastTick(): number {
    return this.lastTick;
  }
}

/* ------------------------------------------------------------------ */

function defaultTitle(kind: TimedEventKind, payload: EventPayload): string {
  switch (kind) {
    case "airdrop":
      return "✈️ AIRDROP INCOMING";
    case "earthquake":
      return `🌐 EARTHQUAKE — ${(payload as { tokenSymbol: string }).tokenSymbol} CRASHED`;
    case "fireworks":
      return `🎆 ${(payload as { milestoneLabel: string }).milestoneLabel}`;
    case "parade":
      return `🎺 ${(payload as { title: string }).title.toUpperCase()}`;
    case "protest":
      return `📢 PROTEST — ${(payload as { tokenSymbol: string }).tokenSymbol}`;
  }
}

function defaultSubtitle(kind: TimedEventKind, payload: EventPayload): string {
  switch (kind) {
    case "airdrop":
      return "Supply crates falling across the city — first come, first served.";
    case "earthquake": {
      const p = payload as { dropPct24h: number; magnitude: number };
      return `Magnitude ${p.magnitude.toFixed(1)} — the ground shakes with the market (${p.dropPct24h.toFixed(1)}% / 24h).`;
    }
    case "fireworks":
      return "The whole city celebrates over the bay.";
    case "parade": {
      const p = payload as { goalLabel: string };
      return `${p.goalLabel} — floats rolling downtown.`;
    }
    case "protest": {
      const p = payload as { tokenSymbol: string; chant: string };
      return `$${p.tokenSymbol} holders march on HQ — join or counter-protest.`;
    }
  }
}

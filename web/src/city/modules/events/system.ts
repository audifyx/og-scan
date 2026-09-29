/**
 * OrbitXCity — Events module: the unified event runtime.
 *
 * This is the glue the integrator constructs ONCE: it owns the
 * `CityEventDirector`, maps every timed event to its scene starter
 * (`scenes/*`), runs the real-data trigger evaluation
 * (`evaluateMarketTriggers` / `evaluateParadeTrigger`), keeps the
 * persistent features alive (weather controller, night market,
 * black market), and schedules server-wide airdrops.
 *
 * "Server-shaped": the director API mirrors what a multiplayer server
 * broadcast would look like, so the networking team can swap the
 * transport later without touching scenes.
 *
 * REAL DATA ONLY for market-driven events: `pollMarket()` and
 * `pollVolume()` take integrator-supplied live data (e.g. the output of
 * `web/src/hooks/useLivePrices`) — this module never fabricates prices,
 * volume figures, or crashes.
 */

import * as THREE from "three";
import { CityEventDirector } from "./eventDirector";
import {
  createTriggerMemory,
  evaluateMarketTriggers,
  evaluateParadeTrigger,
  DEFAULT_PARADE_GOALS,
  DEFAULT_TRIGGER_CONFIG,
  type MarketTriggerConfig,
  type ParadeGoalTier,
  type TriggerMemory,
} from "./triggers";
import {
  startAirdropRun,
  type AirdropHandle,
} from "./scenes/airdropCrates";
import { startEarthquake } from "./scenes/earthquake";
import {
  startFireworks,
  type FireworkBarge,
} from "./scenes/fireworks";
import {
  startNightMarket,
  tonightSpot,
  tonightStock,
  NIGHT_MARKET_CATALOG,
  type MarketItem,
  type NightMarketSpot,
  type PurchaseContext,
} from "./scenes/nightMarket";
import {
  startBlackMarket,
  BLACK_MARKET_CATALOG,
  checkCode,
} from "./scenes/blackMarket";
import { startParade } from "./scenes/parade";
import {
  startProtest,
  type ProtestHandle,
} from "./scenes/protests";
import {
  startWeatherController,
  WEATHER_INFO,
  WEATHER_DURATION_MS,
  canControlWeather,
  type WeatherController,
  type WeatherState,
} from "./scenes/weatherMachine";
import type {
  AirdropPayload,
  CityEffectHandle,
  CityEvent,
  EventReward,
  EventsContext,
  MarketSnapshot,
  ProtestPayload,
} from "./types";

/* ------------------------------------------------------------------ */
/* Options                                                             */
/* ------------------------------------------------------------------ */

export interface EventsSystemOptions {
  /** Market trigger tuning (watchlist, thresholds, ORBITX milestones). */
  triggerConfig?: Partial<MarketTriggerConfig>;
  /** Interval between automatic server-wide airdrops. Default 45 min. Set <= 0 to disable. */
  airdropIntervalMs?: number;
  /** Crate count range per scheduled airdrop. Default [6, 10]. */
  airdropCrateCount?: [number, number];
  /** Barge anchor points over the bay for fireworks (integrator-supplied). */
  fireworksBarges?: FireworkBarge[];
  /** Parade waypoint route built from core road data (integrator-supplied). */
  paradeRoute?: { x: number; z: number }[];
  /** Volume goal tiers for parades. */
  paradeGoals?: ParadeGoalTier[];
  /** Max simultaneous timed events. Default 3. */
  maxConcurrent?: number;
}

export interface RugReport {
  symbol: string;
  reason: "rug" | "crash" | "scam";
  /** HQ position; falls back to `ctx.ruggedHqs` lookup. */
  hq?: { x: number; z: number };
  crowdSize?: number;
  chant?: string;
}

/* ------------------------------------------------------------------ */
/* UI snapshot — everything the React UI needs, in one object          */
/* ------------------------------------------------------------------ */

export interface TickerItem {
  id: string;
  text: string;
  at: number;
}

export interface EventsSnapshot {
  active: CityEvent[];
  /** Banner-worthy events fired in the last ~25s (EventHud auto-dismisses). */
  banners: CityEvent[];
  ticker: TickerItem[];
  weather: {
    current: WeatherState;
    target: WeatherState;
    info: (typeof WEATHER_INFO)[WeatherState];
    firmId: string | null;
    canControl: boolean;
    controlReason: string;
  };
  nightMarket: { open: boolean; spot: NightMarketSpot | null; stock: MarketItem[] };
  blackMarket: { open: boolean; codeHint: string };
  airdrop: { active: boolean; landed: number; claimed: number };
  protest: { active: boolean; chosen: "join" | "counter" | null; crowdSize: number };
}

/* ------------------------------------------------------------------ */
/* System                                                              */
/* ------------------------------------------------------------------ */

const DEFAULT_CHANTS: Record<RugReport["reason"], string> = {
  rug: "GIVE US OUR MONEY BACK!",
  crash: "WE WANT ANSWERS!",
  scam: "DEV DOXX NOW!",
};

export class EventsSystem {
  readonly director: CityEventDirector;
  readonly weather: WeatherController;
  readonly ctx: EventsContext;

  private opts: Required<
    Pick<
      EventsSystemOptions,
      "airdropIntervalMs" | "airdropCrateCount" | "fireworksBarges" | "paradeRoute" | "paradeGoals" | "maxConcurrent"
    >
  > & { triggerConfig: MarketTriggerConfig };

  private triggerMem: TriggerMemory = createTriggerMemory();
  private paradeCelebrated: string[] = [];
  private ruggedSeen = new Set<string>();

  private airdropHandle: AirdropHandle | null = null;
  private protestHandle: ProtestHandle | null = null;
  private nightMarketHandle: CityEffectHandle | null = null;
  private blackMarketHandle: CityEffectHandle | null = null;
  private nightMarketSpot: NightMarketSpot | null = null;
  private nightMarketStock: MarketItem[] = [];

  private weatherLastChangeAt = 0;
  private weatherSetAt = 0;
  private lastAirdropAt = 0;
  private wasNight: boolean | null = null;

  private ticker: TickerItem[] = [];
  private listeners = new Set<() => void>();
  private disposed = false;
  private playerPos = new THREE.Vector3();

  constructor(ctx: EventsContext, opts: EventsSystemOptions = {}) {
    this.ctx = ctx;
    this.opts = {
      triggerConfig: { ...DEFAULT_TRIGGER_CONFIG, ...(opts.triggerConfig ?? {}) },
      airdropIntervalMs: opts.airdropIntervalMs ?? 45 * 60 * 1000,
      airdropCrateCount: opts.airdropCrateCount ?? [6, 10],
      fireworksBarges: opts.fireworksBarges ?? [],
      paradeRoute: opts.paradeRoute ?? [],
      paradeGoals: opts.paradeGoals ?? DEFAULT_PARADE_GOALS,
      maxConcurrent: opts.maxConcurrent ?? 3,
    };
    this.director = new CityEventDirector({
      host: ctx.host,
      maxConcurrent: this.opts.maxConcurrent,
    });
    this.weather = startWeatherController(ctx.host);
    // First scheduled airdrop lands ~90s after boot so the world feels alive.
    this.lastAirdropAt =
      this.opts.airdropIntervalMs > 0 ? Date.now() - this.opts.airdropIntervalMs + 90_000 : 0;

    this.director.onEvent((event) => this.onEventStarted(event));
    this.director.onEventEnd((event, reason) => this.onEventEnded(event, reason));
  }

  /* ---------------- subscriptions ---------------- */

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private notify(): void {
    for (const fn of this.listeners) {
      try {
        fn();
      } catch {
        /* UI listener errors must never kill the world */
      }
    }
  }

  /* ---------------- real-data polling (integrator calls these) ---------------- */

  /**
   * Feed the REAL output of `useLivePrices` (DexScreener-backed) into the
   * trigger evaluator. Fires earthquakes (crashing majors) and fireworks
   * (ORBITX milestones) from live data only — never from mocks.
   */
  pollMarket(snapshot: MarketSnapshot): void {
    if (this.disposed) return;
    const results = evaluateMarketTriggers(snapshot, this.triggerMem, this.opts.triggerConfig);
    for (const r of results) this.director.start(r.kind, r.payload);
  }

  /**
   * Feed the community's REAL 24h trading volume (integrator-supplied).
   * Fires parades when a goal tier is crossed — once per tier per session.
   */
  pollVolume(communityVolume24h: number): void {
    if (this.disposed) return;
    const hit = evaluateParadeTrigger(communityVolume24h, this.opts.paradeGoals, this.paradeCelebrated);
    if (hit) this.director.start("parade", { ...hit.payload, route: this.opts.paradeRoute });
  }

  /**
   * Scan the integrator's REAL rugged-token registry (`ctx.ruggedHqs`)
   * and start protest marches for newly seen rugs.
   */
  pollRuggedHqs(): void {
    if (this.disposed) return;
    for (const hq of this.ctx.ruggedHqs) {
      if (this.ruggedSeen.has(hq.symbol)) continue;
      this.ruggedSeen.add(hq.symbol);
      this.announceRug({ symbol: hq.symbol, reason: "rug", hq: hq.position });
    }
  }

  /** Manual/host-driven protest (e.g. a fresh rug detected out-of-band). */
  announceRug(report: RugReport): CityEvent | null {
    if (this.disposed) return null;
    const hq =
      report.hq ??
      this.ctx.ruggedHqs.find((h) => h.symbol === report.symbol)?.position ??
      { x: 0, z: 0 };
    const payload: ProtestPayload = {
      tokenSymbol: report.symbol,
      reason: report.reason,
      hq,
      crowdSize: report.crowdSize ?? 24,
      chant: report.chant ?? DEFAULT_CHANTS[report.reason],
    };
    return this.director.start("protest", payload);
  }

  /** Manual/host-driven airdrop (integrator can also rely on the scheduler). */
  startAirdrop(dropZones?: { x: number; z: number }[], crateCount?: number): CityEvent | null {
    if (this.disposed) return null;
    const span = this.ctx.host.worldHalfSpan;
    const [lo, hi] = this.opts.airdropCrateCount;
    const payload: AirdropPayload = {
      dropZones: dropZones ?? rollDropZones(span, 3),
      crateCount: crateCount ?? Math.round(lo + Math.random() * (hi - lo)),
      seed: (Date.now() % 2147483647) >>> 0,
    };
    return this.director.start("airdrop", payload);
  }

  /* ---------------- event → scene wiring ---------------- */

  private onEventStarted(event: CityEvent): void {
    const host = this.ctx.host;
    this.pushTicker(`${event.title} — ${event.subtitle}`);
    switch (event.kind) {
      case "airdrop": {
        const handle = startAirdropRun(
          host,
          event.payload as AirdropPayload,
          this.ctx.wallet,
          (r) => this.ctx.onReward?.(r)
        );
        this.airdropHandle = handle;
        this.director.attachEffect(event.id, handle);
        break;
      }
      case "earthquake":
        this.director.attachEffect(
          event.id,
          startEarthquake(host, event.payload as import("./types").EarthquakePayload)
        );
        break;
      case "fireworks":
        this.director.attachEffect(
          event.id,
          startFireworks(host, event.payload as import("./types").FireworksPayload, {
            barges: this.opts.fireworksBarges,
          })
        );
        break;
      case "parade":
        this.director.attachEffect(
          event.id,
          startParade(host, event.payload as import("./types").ParadePayload, {
            route: this.opts.paradeRoute,
          })
        );
        break;
      case "protest": {
        const handle = startProtest(host, event.payload as ProtestPayload, {
          wallet: this.ctx.wallet,
          onReward: (r) => this.ctx.onReward?.(r),
        });
        this.protestHandle = handle;
        this.director.attachEffect(event.id, handle);
        break;
      }
    }
    this.notify();
  }

  private onEventEnded(event: CityEvent, reason: string): void {
    if (event.kind === "airdrop") this.airdropHandle = null;
    if (event.kind === "protest") this.protestHandle = null;
    this.pushTicker(`✅ ${event.title} — ended (${reason})`);
    this.notify();
  }

  private pushTicker(text: string): void {
    this.ticker.unshift({ id: `t${Date.now()}-${Math.random().toString(36).slice(2)}`, text, at: Date.now() });
    if (this.ticker.length > 24) this.ticker.length = 24;
  }

  /* ---------------- frame loop ---------------- */

  update(dt: number, now: number = Date.now()): void {
    if (this.disposed) return;
    this.director.tick(dt, now);
    this.weather.update(dt);

    // Weather duration: the machine's hold expires → drift back to clear.
    if (
      this.weather.getCurrent() !== "clear" &&
      this.weatherSetAt > 0 &&
      now - this.weatherSetAt > WEATHER_DURATION_MS
    ) {
      this.weather.setWeather("clear");
      this.pushTicker("🌤️ Weather machine hold expired — skies clearing.");
    }

    // Scheduled server-wide airdrops (time-based, not market-driven).
    if (
      this.opts.airdropIntervalMs > 0 &&
      now - this.lastAirdropAt >= this.opts.airdropIntervalMs &&
      !this.director.isActive("airdrop")
    ) {
      this.lastAirdropAt = now;
      this.startAirdrop();
    }

    // Night features follow the world clock.
    const isNight = this.ctx.host.isNight;
    if (this.wasNight === null) this.wasNight = isNight;
    if (isNight && !this.wasNight) {
      // nightfall: open both markets
      this.nightMarketSpot = tonightSpot(now);
      this.nightMarketStock = tonightStock(now, NIGHT_MARKET_CATALOG);
      this.nightMarketHandle = startNightMarket(this.ctx.host, this.nightMarketSpot, this.nightMarketStock);
      this.blackMarketHandle = startBlackMarket(this.ctx.host);
      this.pushTicker(`🌙 Night market open at ${this.nightMarketSpot.label} — rare cosmetics in stock.`);
      this.pushTicker("🕶️ Word on the street: the dock black market is open. Ask the fixer for tonight's code.");
      this.notify();
    }
    if (!isNight && this.wasNight) {
      this.closeNightFeatures("dawn");
    }
    this.wasNight = isNight;
    if (this.nightMarketHandle && !this.nightMarketHandle.update(dt)) {
      this.closeNightFeatures("packed-up");
    } else if (this.blackMarketHandle && !this.blackMarketHandle.update(dt)) {
      this.closeNightFeatures("packed-up");
    }
  }

  private closeNightFeatures(reason: string): void {
    if (this.nightMarketHandle) {
      try {
        this.nightMarketHandle.dispose();
      } catch {
        /* ignore */
      }
      this.nightMarketHandle = null;
    }
    if (this.blackMarketHandle) {
      try {
        this.blackMarketHandle.dispose();
      } catch {
        /* ignore */
      }
      this.blackMarketHandle = null;
    }
    this.nightMarketSpot = null;
    this.nightMarketStock = [];
    this.pushTicker(`🌅 Markets ${reason === "dawn" ? "packed up at dawn" : "closed"}.`);
    this.notify();
  }

  /* ---------------- player actions ---------------- */

  /** Claim the nearest landed airdrop crate within `radius` of the player. */
  claimNearbyCrate(radius = 6): EventReward | null {
    if (!this.airdropHandle) return null;
    this.ctx.host.getPlayerPosition(this.playerPos);
    const reward = this.airdropHandle.claimCrate(this.playerPos, radius);
    if (reward) this.notify();
    return reward;
  }

  /** Player joins the active protest. */
  joinProtest(): EventReward | null {
    if (!this.protestHandle) return null;
    const reward = this.protestHandle.join();
    const event = this.director.getActiveEvents().find((e) => e.kind === "protest");
    if (event) this.ctx.onProtestChoice?.("join", event.payload as ProtestPayload);
    this.notify();
    return reward;
  }

  /** Player counter-protests the active protest. */
  counterProtest(): EventReward | null {
    if (!this.protestHandle) return null;
    const reward = this.protestHandle.counterProtest();
    const event = this.director.getActiveEvents().find((e) => e.kind === "protest");
    if (event) this.ctx.onProtestChoice?.("counter", event.payload as ProtestPayload);
    this.notify();
    return reward;
  }

  /** Purchase context for the market panels (wallet + defensive billing). */
  getPurchaseContext(): PurchaseContext {
    return {
      wallet: this.ctx.wallet,
      billing: this.ctx.billing,
      onReward: (r) => this.ctx.onReward?.(r),
    };
  }

  /** Tonight's black-market stock (static catalog; UI gates entry by code). */
  getBlackMarketStock(): MarketItem[] {
    return BLACK_MARKET_CATALOG;
  }

  /** Validate tonight's rotating access code word. */
  checkMarketCode(input: string, now: number = Date.now()): boolean {
    return checkCode(input, now);
  }

  /* ---------------- weather machine ---------------- */

  /** Attempt a weather change. Only the turf-war winner's firm may do this. */
  trySetWeather(next: WeatherState, now: number = Date.now()): { ok: boolean; reason: string } {
    const gate = canControlWeather(
      this.ctx.weatherFirmId,
      this.ctx.playerInWeatherFirm,
      this.weatherLastChangeAt,
      now
    );
    if (!gate.ok) return gate;
    this.weather.setWeather(next);
    this.weatherLastChangeAt = now;
    this.weatherSetAt = now;
    this.pushTicker(`🌦️ ${this.ctx.weatherFirmId} set the weather: ${WEATHER_INFO[next].label}.`);
    this.notify();
    return { ok: true, reason: "" };
  }

  /* ---------------- snapshot ---------------- */

  getSnapshot(now: number = Date.now()): EventsSnapshot {
    const active = this.director.getActiveEvents();
    const gate = canControlWeather(
      this.ctx.weatherFirmId,
      this.ctx.playerInWeatherFirm,
      this.weatherLastChangeAt,
      now
    );
    const current = this.weather.getCurrent();
    return {
      active,
      banners: active.filter((e) => e.banner && now - e.startedAt < 25_000),
      ticker: this.ticker,
      weather: {
        current,
        target: this.weather.getTarget(),
        info: WEATHER_INFO[this.weather.getTarget()],
        firmId: this.ctx.weatherFirmId,
        canControl: gate.ok,
        controlReason: gate.reason,
      },
      nightMarket: {
        open: this.nightMarketHandle !== null,
        spot: this.nightMarketSpot,
        stock: this.nightMarketStock,
      },
      blackMarket: {
        open: this.blackMarketHandle !== null,
        codeHint: "Ask the fixer NPC for tonight's code word.",
      },
      airdrop: {
        active: this.airdropHandle !== null,
        landed: this.airdropHandle?.landedCount() ?? 0,
        claimed: this.airdropHandle?.claimedCount() ?? 0,
      },
      protest: {
        active: this.protestHandle !== null,
        chosen: this.protestHandle?.getChoice() ?? null,
        crowdSize: this.protestHandle?.protesterCount() ?? 0,
      },
    };
  }

  /* ---------------- teardown ---------------- */

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.closeNightFeatures("closed");
    for (const event of this.director.getActiveEvents()) this.director.end(event.id, "disposed");
    this.weather.dispose();
    this.listeners.clear();
  }
}

/** Factory — the integrator constructs the system once the host exists. */
export function createEventsSystem(ctx: EventsContext, opts: EventsSystemOptions = {}): EventsSystem {
  return new EventsSystem(ctx, opts);
}

/* ------------------------------------------------------------------ */

function rollDropZones(span: number, count: number): { x: number; z: number }[] {
  const r = span * 0.55;
  const zones: { x: number; z: number }[] = [];
  for (let i = 0; i < count; i++) {
    zones.push({ x: (Math.random() - 0.5) * 2 * r, z: (Math.random() - 0.5) * 2 * r });
  }
  return zones;
}

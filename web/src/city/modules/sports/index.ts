/**
 * ORBITXCITY sports — module entry point.
 *
 * GTA-style sports for the open world: skate, sponsors, parkour,
 * base jump, wingsuit, fight tournaments, dojo, surf, golf, fishing.
 *
 * Integrator usage:
 * ```ts
 * import { createSports } from "@/city/modules/sports";
 * const sports = createSports();          // all 10 sims registered
 * sports.mount(ctx);                      // builds venues, needs SportsContext
 * // per frame: sports.update(dt);
 * // proximity UI: sports.distanceTo("skate") < 6 → prompt "press E"
 * sports.start("surf");                   // enter a sport (exclusive camera/input)
 * sports.stop();                          // hand control back to core
 * sports.bus.on((e) => { ... });          // HUD: paper/style/toast/activity/tick
 * ```
 *
 * Self-contained: imports ONLY `three` + relative files. Never imports
 * core (`../core`) or `@/tokenomics/*` (see BILLING_CONTRACT.md — the
 * premium adapter codes against a `window.__orbitxBilling` injection
 * until the tokenomics primitive lands).
 */
import { SportsManager, createSportsManager } from "./manager";
import type { SportDeps } from "./base";
import { getSponsorTracker } from "./skate/Sponsors";
import { SkatePark } from "./skate/SkatePark";
import { Sponsors } from "./skate/Sponsors";
import { Parkour } from "./parkour/Parkour";
import { BaseJump } from "./air/BaseJump";
import { Wingsuit } from "./air/Wingsuit";
import { Tournament } from "./combat/Tournament";
import { Dojo } from "./combat/Dojo";
import { Surf } from "./surf/Surf";
import { Golf } from "./golf/Golf";
import { Fishing } from "./fishing/Fishing";
import type { SportsContext, VenueAnchors } from "./types";

// --- core wiring -----------------------------------------------------------
export { SportsManager, createSportsManager };
export { SportsBus } from "./types";
export type {
  SportId, SportInput, SportMeta, SportSim, SportsContext, SportsEvent,
  SportsListener, PlayerSnapshot, VenueAnchors, PremiumResult,
} from "./types";
export type { SportDeps };
export type { VenuePositions } from "./venues";
export { resolveVenues, VENUE_POSITIONS } from "./venues";

// --- economy + billing ------------------------------------------------------
export { PaperLedger, STYLE_TO_PAPER_RATE } from "./economy";
export type { LedgerEntry } from "./economy";
export { premiumBilling, PREMIUM_CATALOG } from "./billing";
export type { PremiumBilling, PremiumItemId } from "./billing";

// --- the 10 sports ----------------------------------------------------------
export { SkatePark } from "./skate/SkatePark";
export { Sponsors, getSponsorTracker, SPONSOR_BRANDS, SPONSOR_CHALLENGES, SPONSOR_STYLE_BONUS } from "./skate/Sponsors";
export type { SponsorBrand, SponsorTier, SponsorChallenge } from "./skate/Sponsors";
export { Parkour } from "./parkour/Parkour";
export { BaseJump } from "./air/BaseJump";
export { Wingsuit } from "./air/Wingsuit";
export { Tournament } from "./combat/Tournament";
export { Dojo } from "./combat/Dojo";
export {
  FIGHT_STYLES, fightStyle, loadDojoState, saveDojoState, masteryBonus,
  getPlayerFighterSpec, Combatant, resolveStrike, aiDecide, Duel,
  simulateAiFight, buildAiOpponents, AI_FIGHTER_NAMES, DUEL_ROUND_TIME,
} from "./combat/Fighter";
export type {
  FightStyleId, FightStyle, DojoState, FighterSpec, StrikeResult,
  AiMove, DuelCommand, DuelEvent,
} from "./combat/Fighter";
export { Surf } from "./surf/Surf";
export { Golf } from "./golf/Golf";
export { Fishing } from "./fishing/Fishing";

/**
 * Build a SportsManager with all 10 sport sims registered.
 * The integrator then calls `manager.mount(ctx)` once with the live
 * SportsContext (scene/camera/player hooks), drives `update(dt)` per
 * frame, and calls `start(id)` / `stop()` from proximity prompts or HUD.
 * Also wires the persistent sponsor tracker so skate challenges progress
 * even when the Sponsors sim is idle.
 */
export function createSports(anchors?: VenueAnchors): SportsManager {
  const mgr = createSportsManager(anchors);
  const deps: SportDeps = {
    bus: mgr.bus,
    ledger: mgr.ledger,
    venues: mgr.venues,
    getCtx: () => mgr.context,
  };
  mgr.register(new SkatePark(deps));
  mgr.register(new Sponsors(deps));
  mgr.register(new Parkour(deps));
  mgr.register(new BaseJump(deps));
  mgr.register(new Wingsuit(deps));
  mgr.register(new Tournament(deps));
  mgr.register(new Dojo(deps));
  mgr.register(new Surf(deps));
  mgr.register(new Golf(deps));
  mgr.register(new Fishing(deps));
  // persistent: sponsor challenges track skate sessions even when idle
  getSponsorTracker(mgr.bus, mgr.ledger);
  return mgr;
}

/** Re-export the manager factory under a mount-flavoured alias. */
export const mountSports = createSports;

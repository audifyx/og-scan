/**
 * OrbitXCity — Social module public API.
 *
 * GTA-style social life: in-game phone (calls, texts, camera, in-world
 * web), LifeInvasion feed (NPCs + players, live token drama), Channel 6
 * news (REAL market events), rooftop parties with live generative DJ
 * audio, beach bonfires + firm recruiting, camping with campfire voice,
 * comedy club open mic, the ownable nightclub, and weekly docks car meets.
 *
 * Self-contained: no imports from other city modules. Only external deps:
 *  - react
 *  - (integrator-fed) live price data via `dramaFromPrices` — real only
 *  - `livekit-client` via dynamic import, ONLY if the integrator constructs
 *    LiveKitVoiceProvider (never in the initial bundle)
 *
 * Styles: this barrel imports `./styles.css` (all `oxs-*` classes).
 *
 * Billing: paper CITY for gameplay; real ORBITX premium via the injected
 * implementation (see injectSocialBilling / MODULE.md). NEVER imports
 * `@/tokenomics/*`.
 */
import "./styles.css";

// --- mounts ------------------------------------------------------------
export { SocialHub } from "./components/SocialHub";
export type { SocialHubProps, SocialTab } from "./components/SocialHub";
export { PhoneUi } from "./components/PhoneUi";
export type { PhoneUiProps, TeleportFn } from "./components/PhoneUi";

// --- UI surfaces ---------------------------------------------------------
export { FeedUi } from "./components/FeedUi";
export { NewsUi } from "./components/NewsUi";
export { PartyUi } from "./components/PartyUi";
export { BeachUi } from "./components/BeachUi";
export { CampUi } from "./components/CampUi";
export { ComedyUi } from "./components/ComedyUi";
export { NightclubUi } from "./components/NightclubUi";
export { CarMeetUi } from "./components/CarMeetUi";
export { VoiceChannelPanel } from "./components/VoiceChannelPanel";
export { NpcAvatar } from "./components/NpcAvatar";

// --- hooks ---------------------------------------------------------------
export { useSocialFeed } from "./hooks/useSocialFeed";
export { useNews } from "./hooks/useNews";
export { usePhone } from "./hooks/usePhone";
export { useHangouts } from "./hooks/useHangouts";
export { useNightclub } from "./hooks/useNightclub";
export { useCarMeet } from "./hooks/useCarMeet";
export { useComedy, type NpcSetView } from "./hooks/useComedy";
export { useRecruits } from "./hooks/useRecruits";
export { useVoice, type UseVoiceOpts } from "./hooks/useVoice";

// --- engines (pure logic) -------------------------------------------------
export { buildFeed, trendingFromDrama } from "./engine/feedEngine";
export { buildNews } from "./engine/newsEngine";
export {
  getHangoutStatus,
  getCarMeetWindow,
  getOpenMicWindow,
  fmtCountdown,
  type HangoutStatus,
} from "./engine/hangoutEngine";
export {
  startDjSet,
  genreForDj,
  DJ_GENRES,
  type DjGenre,
  type DjHandle,
} from "./engine/djEngine";
export {
  simulateNight,
  hypeCost,
  defaultClubState,
  CLUB_PRICE_ORBITX,
  CLUB_LEASE_CITY,
  type NightResult,
} from "./engine/nightclubEngine";
export {
  scoreEntry,
  judgeMeet,
  currentMeetId,
  CAR_MEET_CATEGORIES,
  CAR_MEET_ENTRY_FEE_CITY,
  NPC_MEET_ENTRIES,
  type CarMeetCategory,
  type JudgedEntry,
} from "./engine/carMeetEngine";
export { dramaFromPrices, ORBITX_MINT, type DramaMeta, type LivePriceLike } from "./engine/dramaAdapter";
export { paperLedger, type PaperTx } from "./engine/paperLedger";
export { startSetRecording, npcCrowdScore, playerCrowdScore, type RecordedSet } from "./engine/comedyEngine";
export {
  createVoiceProvider,
  LocalVoiceStub,
  LiveKitVoiceProvider,
  type VoiceProvider,
  type VoiceParticipant,
  type LiveKitTokenFn,
} from "./engine/voiceArchitecture";

// --- billing (defensive) ---------------------------------------------------
export { injectSocialBilling, useSocialBilling, premiumButtonState } from "./billing";

// --- static content --------------------------------------------------------
export {
  NPCS,
  VENUES,
  DJ_ROSTER,
  COMEDY_SETS,
  RECRUIT_POOL,
  PHONE_CONTACTS,
  CALL_SCRIPTS,
  IN_WORLD_SITES,
  npcById,
  venueById,
} from "./data/socialData";
export { VENUE_COORDS, venueCoord, type VenueCoord } from "./data/venueCoords";

// --- shared types -----------------------------------------------------------
export type * from "./types";

/**
 * OrbitXCity social module — shared types.
 * Self-contained: no imports from other city modules.
 */

// ---------------------------------------------------------------------------
// Live token data (real only — fed from @/hooks/useLivePrices via wrapper)
// ---------------------------------------------------------------------------

export interface TokenDrama {
  symbol: string;
  mint: string;
  price: number;
  change24h: number;
  volume24h: number;
  marketCap: number;
}

// ---------------------------------------------------------------------------
// NPC personas
// ---------------------------------------------------------------------------

export type NpcPersona = "trader" | "dj" | "comic" | "anchor" | "local" | "dev";

export interface NpcProfile {
  id: string;
  name: string;
  handle: string;
  bio: string;
  persona: NpcPersona;
  /** avatar fallback: initials + hue, rendered as a gradient disc */
  initials: string;
  hue: number;
  followers: number;
  verified: boolean;
}

// ---------------------------------------------------------------------------
// LifeInvasion feed
// ---------------------------------------------------------------------------

export type FeedPostKind = "drama" | "banter" | "player" | "ad";

export interface FeedPost {
  id: string;
  authorId: string;
  authorName: string;
  authorHandle: string;
  authorInitials: string;
  authorHue: number;
  npc: boolean;
  verified: boolean;
  text: string;
  tokens: string[];
  kind: FeedPostKind;
  likes: number;
  reposts: number;
  ts: number;
}

// ---------------------------------------------------------------------------
// In-game news channel
// ---------------------------------------------------------------------------

export type NewsSeverity = "breaking" | "developing" | "recap";

export interface NewsItem {
  id: string;
  headline: string;
  summary: string;
  body: string[];
  severity: NewsSeverity;
  tokens: string[];
  anchor: string;
  ts: number;
}

// ---------------------------------------------------------------------------
// In-game phone (GTA-style)
// ---------------------------------------------------------------------------

export type PhoneAppId = "calls" | "texts" | "camera" | "web" | "feed" | "news" | "maps" | "settings";

export interface PhoneContact {
  id: string;
  name: string;
  npcId?: string;
  number: string;
  online: boolean;
}

export interface PhoneMessage {
  id: string;
  contactId: string;
  fromMe: boolean;
  text: string;
  ts: number;
}

export interface PhoneCall {
  id: string;
  contactId: string;
  direction: "in" | "out";
  status: "ringing" | "active" | "ended" | "missed";
  startedAt: number;
  endedAt?: number;
  /** NPC scripted lines shown as subtitles while the call is active */
  script?: string[];
}

export interface PhonePhoto {
  id: string;
  dataUrl: string;
  caption: string;
  ts: number;
}

/** Integration hook: the integrator passes a snapshot fn wired to the game canvas. */
export type PhoneSnapshotFn = () => string | null;

// ---------------------------------------------------------------------------
// Venues + hangouts (rooftop parties, beach parties, camping)
// ---------------------------------------------------------------------------

export type VenueKind = "rooftop" | "beach" | "club" | "dock" | "campsite" | "comedy";

export interface Venue {
  id: string;
  name: string;
  kind: VenueKind;
  district: string;
  blurb: string;
}

export type HangoutKind = "rooftop" | "beach" | "camp";

export interface HangoutEvent {
  id: string;
  kind: HangoutKind;
  venueId: string;
  title: string;
  startsAt: number;
  endsAt: number;
  recurring: string;
  live: boolean;
  attendees: number;
}

export interface FirmRecruit {
  npcId: string;
  name: string;
  handle: string;
  role: string;
  skill: number; // 1-10, drives passive paper CITY income
  wageCity: number; // paper CITY per day
  hired: boolean;
}

// ---------------------------------------------------------------------------
// Ownable nightclub
// ---------------------------------------------------------------------------

export interface DjProfile extends NpcProfile {
  genre: string;
  feeCity: number;
  hype: number; // 1-10
}

export interface DjBooking {
  djId: string;
  name: string;
  genre: string;
  feeCity: number;
  hype: number;
  night: string;
}

export interface NightclubState {
  owned: boolean;
  name: string;
  /** 0-100; drives nightly earnings and floor density */
  popularity: number;
  coverCity: number;
  tonight: DjBooking | null;
  lifetimeEarningsCity: number;
  lifetimeBurnedOrbitx: number;
}

// ---------------------------------------------------------------------------
// Comedy club
// ---------------------------------------------------------------------------

export interface ComedySet {
  id: string;
  comicId: string;
  comicName: string;
  title: string;
  lines: string[];
  crowdRating: number; // 0-100
  ts: number;
}

export interface OpenMicSlot {
  id: string;
  playerName: string;
  title: string;
  ts: number;
  /** set when the player records their set locally */
  audioUrl?: string;
}

// ---------------------------------------------------------------------------
// Weekly car meets
// ---------------------------------------------------------------------------

export interface CarMeetEntry {
  id: string;
  owner: string;
  ownerHandle: string;
  car: string;
  npc: boolean;
  score?: number;
}

export interface CarMeetEvent {
  id: string;
  title: string;
  venueId: string;
  startsAt: number;
  endsAt: number;
  categories: string[];
  entries: CarMeetEntry[];
  prizeCity: number;
}

// ---------------------------------------------------------------------------
// Voice (multiplayer-ready architecture)
// ---------------------------------------------------------------------------

export type VoiceChannelKind = "campfire" | "openmic" | "party";

export interface VoiceChannel {
  id: string;
  kind: VoiceChannelKind;
  label: string;
  participants: string[];
  joined: boolean;
}

// ---------------------------------------------------------------------------
// Billing (defensive adapter — tokenomics primitives may not exist yet)
// ---------------------------------------------------------------------------

export interface SocialBilling {
  /** tokenomics useOrbitxBilling primitive detected and loaded */
  premium: boolean;
  /** auth-once complete, backend spendable */
  ready: boolean;
  balance: number | null;
  burnForPremium: (opts: {
    amount: number; // whole ORBITX
    reason: string;
    ref?: string;
  }) => Promise<{ signature: string }>;
}

export interface SocialModuleProps {
  /** live token drama, fed by the integrator from useLivePrices */
  drama: TokenDrama[];
  /** paper CITY balance (gameplay money) */
  cityBalance: number;
  playerName: string;
  playerHandle: string;
  /** game canvas snapshot for the phone camera app */
  takeSnapshot?: PhoneSnapshotFn;
  /** called when paper CITY changes so the integrator can sync its ledger */
  onCitySpend?: (delta: number, reason: string) => void;
}

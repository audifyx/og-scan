/**
 * MEDIA MODULE — shared types.
 *
 * Photo mode, gallery, radio, drive-in theater, share-to-X.
 * No imports from other city modules. No `@/tokenomics/*` imports (breaks build).
 */

/** Billing provider shape — mirrors the contract in web/src/city/BILLING_CONTRACT.md. */
export interface MediaBillingProvider {
  ready: boolean;
  balance: number | null;
  spend: (opts: { amount: number; reason: string; ref?: string }) => Promise<{ signature: string }>;
  beginAuth: () => void;
}

/** Adapter the integrator supplies so media can touch the running world. */
export interface MediaWorldAdapter {
  /** The canvas the world renders into. */
  getCanvas: () => HTMLCanvasElement | null;
  /**
   * Synchronously capture the current frame as a PNG/JPEG data URL.
   * Must be called inside the same rAF frame as the world's render (or the
   * world's renderer must use preserveDrawingBuffer). Return null if unsafe.
   */
  captureFrame: () => string | null;
  /** Freeze/unfreeze the world (pauses gameplay loop, traffic, peds). */
  setPaused: (paused: boolean) => void;
  /** Teleport the player (used by the drive-in "take me there" button). */
  teleport: (x: number, z: number, heading?: number) => void;
  /** World position + heading of the player, for caption/location stamps. */
  getPlayerSnapshot: () => { pos: { x: number; y: number; z: number }; heading: number; speedKmh: number; isNight: boolean } | null;
}

/* ---------------------------------- photo ---------------------------------- */

export type PhotoFilterId =
  | "none"
  | "noir"
  | "vice"
  | "golden"
  | "chrome"
  | "nightops";

export interface PhotoFilter {
  id: PhotoFilterId;
  name: string;
  /** CSS filter string applied to the preview AND baked into exports. */
  css: string;
  premium: boolean;
}

export interface PhotoView {
  /** Pan offset in fractions of frame width/height (-0.5..0.5). */
  x: number;
  y: number;
  /** Digital zoom 1..4. */
  zoom: number;
  /** Rotation in degrees (-15..15). */
  rot: number;
}

export interface GalleryShot {
  id: string;
  /** JPEG data URL, downscaled to <= 1280px wide at save time. */
  dataUrl: string;
  width: number;
  height: number;
  filter: PhotoFilterId;
  caption: string;
  createdAt: number;
  location?: string;
}

/* ---------------------------------- radio ---------------------------------- */

export type RadioStationId = "neon" | "lofi" | "bass" | "chatter";

export interface RadioStation {
  id: RadioStationId;
  name: string;
  tagline: string;
  /** "music" = generative Web Audio (royalty-free, no files) · "chatter" = speech. */
  kind: "music" | "chatter";
}

export interface MarketQuoteLite {
  symbol: string;
  price: number;
  change24h: number;
}

/* --------------------------------- drive-in -------------------------------- */

export interface MovieClip {
  id: string;
  title: string;
  by: string;
  /** Direct video URL (mp4/webm). Community submissions go here. */
  src: string;
  poster?: string;
  durationSec?: number;
}

export interface DriveInSpot {
  x: number;
  z: number;
  heading: number;
  name: string;
}

/* --------------------------------- settings -------------------------------- */

export interface MediaSettings {
  radioStation: RadioStationId;
  radioVolume: number; // 0..1
  radioOn: boolean;
  chatterVoice: boolean;
  unlockedFilterPacks: string[];
  photoCount: number;
}

/**
 * OrbitXCity — jobs module shared types.
 * Self-contained: no imports from other modules. Core imports only.
 */
import type { GtaApi } from "../../core";

export type JobId =
  | "taxi"
  | "trader"
  | "detective"
  | "repo"
  | "paparazzi"
  | "critic"
  | "realestate"
  | "instructor"
  | "lifeguard"
  | "foodtruck"
  | "restaurant";

export interface JobMeta {
  id: JobId;
  name: string;
  /** emoji icon for the board */
  icon: string;
  tagline: string;
  /** how this job pays, shown on the board */
  payInfo: string;
  /** premium upsell copy (real ORBITX — billing not landed yet, renders "coming soon") */
  premium?: string;
  /** short how-to-play blurb */
  howTo: string;
}

export interface JobProps {
  api: GtaApi;
  /** called by the job when the shift should end (job finished / player quit) */
  onEndShift: () => void;
}

export interface Buff {
  id: string;
  label: string;
  /** unix ms when it expires */
  until: number;
  /** payout multiplier, e.g. 1.1 = +10% */
  payMult: number;
  /** xp multiplier */
  xpMult: number;
}

export interface Toast {
  id: number;
  text: string;
  kind: "cash" | "info" | "warn";
}

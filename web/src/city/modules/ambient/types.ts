import type * as THREE from "three";
import type { Collider } from "../../core/index";
import type { ChaosBus, ChaosEvent } from "./chaos";
import type { AmbientAudio } from "./audio";

/** Live market quote (mirrors core's Quote shape). */
export interface MarketQuote {
  price: number;
  change24h: number;
}

/** Gameplay buff granted by ambient NPCs. Flavor + paper-CITY only;
 *  movement-speed buffs need a core hook (see MODULE.md). */
export interface Buff {
  id: string;
  label: string;
  icon: string;
  endsAt: number; // performance.now() ms
  note?: string;
}

export interface Toast {
  id: number;
  text: string;
  expiresAt: number; // performance.now() ms
}

export interface FortuneCard {
  title: string;
  body: string;
  symbol: string;
  price: string;
  change: string;
  lucky: string;
}

export interface BuskState {
  active: boolean;
  earned: number;
  timeLeft: number;
}

export interface UiState {
  prompt: string | null;
  toasts: Toast[];
  buffs: Buff[];
  radioLines: string[];
  fortune: FortuneCard | null;
  busk: BuskState;
  /** Paper CITY balance (local gameplay ledger — no chain, per BILLING_CONTRACT). */
  balance: number;
}

/** Something the player can trigger with the interact key (F) / HUD button. */
export interface Interactable {
  x: number;
  z: number;
  radius: number;
  label: string;
  act: () => void;
}

/**
 * Everything the ambient module needs from the host game.
 * The integrator builds this from the core world (getPlayerState, sceneRef…)
 * so ambient stays decoupled — it never imports core classes itself.
 */
export interface AmbientCtx {
  scene: THREE.Scene;
  colliders: Collider[];
  audio: AmbientAudio;
  bus: ChaosBus;
  playerPos: () => THREE.Vector3;
  playerOnFoot: () => boolean;
  isNight: () => boolean;
  getQuotes: () => Record<string, MarketQuote>;
  /** Called whenever UiState changes (prompt, toasts, buffs…). */
  onUi: (ui: UiState) => void;
  /** Half-extent of the playable area in meters (default 90). */
  bounds?: number;
}

export type { ChaosBus, ChaosEvent };

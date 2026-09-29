/**
 * Premium bank catalog — paid in REAL ORBITX, every purchase auto-burns
 * (buy-and-burn per transaction). Prices are whole ORBITX tokens.
 */
import type { BankItem, PredictorConfig } from "../types";
import { ORBITX_MINT } from "./mints";

export const BANK_CATALOG: BankItem[] = [
  {
    id: "neon-underglow",
    label: "Neon Underglow",
    description: "Under-body neon kit for your current ride. Visible city-wide at night.",
    priceOrbitx: 25,
    icon: "💡",
    tag: "vehicle",
  },
  {
    id: "chrome-wrap",
    label: "Chrome Wrap",
    description: "Mirror-chrome vehicle wrap. Applied to your active vehicle.",
    priceOrbitx: 60,
    icon: "🪞",
    tag: "vehicle",
  },
  {
    id: "nitro-tune",
    label: "Nitro Tune",
    description: "Engine remap: +15% top speed and faster nitro recharge.",
    priceOrbitx: 100,
    icon: "🔥",
    tag: "vehicle",
  },
  {
    id: "skyline-loft",
    label: "Skyline Loft",
    description: "Penthouse fast-travel point with skyline view. Spawn there anytime.",
    priceOrbitx: 250,
    icon: "🏙️",
    tag: "property",
  },
  {
    id: "billboard-slot",
    label: "Billboard Slot",
    description: "Your message on the downtown billboard for 24h. Burns on bid win.",
    priceOrbitx: 150,
    icon: "📢",
    tag: "event",
  },
  {
    id: "gold-tattoo",
    label: "Gold Tattoo",
    description: "Exclusive gold-ink character tattoo. Permanent cosmetic.",
    priceOrbitx: 40,
    icon: "✒️",
    tag: "cosmetic",
  },
  {
    id: "heist-priority",
    label: "Heist Priority Pass",
    description: "Skip heist queues for 7 days. Stack with the paper-CITY economy.",
    priceOrbitx: 120,
    icon: "🎫",
    tag: "utility",
  },
  {
    id: "founder-plaque",
    label: "Founder Plaque",
    description: "Your name etched on the OrbitX Tower founders wall. Forever.",
    priceOrbitx: 500,
    icon: "🏆",
    tag: "cosmetic",
  },
];

export const CANDLE_PREDICTOR: PredictorConfig = {
  mint: ORBITX_MINT,
  label: "ORBITX",
  candleMs: 20_000, // 20s candles (keeps the game snappy; live price polls every 10s)
  payoutMultiplier: 1.9,
  maxStake: 500, // paper CITY
};

export const SPEEDRUN_DURATION_MS = 60_000;
export const SPEEDRUN_START_CITY = 1_000; // virtual trading stake, paper

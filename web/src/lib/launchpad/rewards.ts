import { PAD_PARAMS } from "./params";
import type { RewardsTrack } from "./types";

export type ClaimSnap = {
  ownerBal: bigint;
  supply: bigint;
  pot: bigint;
  claimed: bigint;
};

/** Spec 07.5 — pro-rata claim. Exclude curve vault from supply before calling. */
export function claimable(snap: ClaimSnap): bigint {
  if (snap.supply <= 0n) return 0n;
  const raw = (snap.pot * snap.ownerBal) / snap.supply;
  if (raw <= snap.claimed) return 0n;
  return raw - snap.claimed;
}

/** Insurance buffer is never paid as boost (F0226 / 1471). */
export function boostablePot(pot: bigint, buffer = PAD_PARAMS.insuranceBuffer): bigint {
  const keep = BigInt(Math.floor(Number(pot) * buffer));
  if (keep >= pot) return 0n;
  return pot - keep;
}

export function clampPredictBoost(mult: number, cap = PAD_PARAMS.predictBoostCap): number {
  if (!Number.isFinite(mult) || mult < 1) return 1;
  return Math.min(mult, cap);
}

export function lockBoostForDays(days: number): number {
  const tiers = PAD_PARAMS.lockTiersDays;
  const boosts = PAD_PARAMS.lockBoost;
  let i = 0;
  for (let t = 0; t < tiers.length; t++) {
    if (days >= tiers[t]) i = t;
  }
  return boosts[i];
}

export function trackCopy(track: RewardsTrack): { title: string; body: string; cta: "history" | "claim" | "hidden" } {
  if (track === "pump_holder") {
    return {
      title: "Track A · Pump holder rewards",
      body: "You receive automatically when Pump pays (several times per hour, holders above ~$20). This page is a history viewer — there is no fake claim button.",
      cta: "history",
    };
  }
  if (track === "epoch_vault") {
    return {
      title: "Track B · Epoch vault",
      body: "Claim anytime against a snapshot. Not live until the vault is audited. Button stays disabled so we never custody rewards in a team wallet.",
      cta: "claim",
    };
  }
  return {
    title: "No holder rewards",
    body: "Creator vault only. Anyone can still sweep leftover dust to the registered wallet.",
    cta: "hidden",
  };
}

export function nextEpochEnd(nowMs: number, epochSeconds = PAD_PARAMS.epochDefaultSec): number {
  const sec = Math.max(epochSeconds, PAD_PARAMS.epochMinSec);
  const now = Math.floor(nowMs / 1000);
  return (Math.floor(now / sec) + 1) * sec * 1000;
}

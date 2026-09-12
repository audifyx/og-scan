import { DEFAULT_PAD_FLAGS, predictBlockedForCountry, type PadFlags } from "./flags";
import { PAD_PARAMS } from "./params";
import { lintMarketQuestion } from "./market";
import { styleMeta } from "./styles";
import type { IntentIssue, LaunchIntent } from "./types";

export function assertCombo(
  intent: LaunchIntent,
  opts?: { flags?: PadFlags; nowUnix?: number; country?: string },
): IntentIssue[] {
  const flags = opts?.flags ?? DEFAULT_PAD_FLAGS;
  const now = opts?.nowUnix ?? Math.floor(Date.now() / 1000);
  const issues: IntentIssue[] = [];

  if (flags.kill_create) {
    issues.push({ field: "create", message: "Create is paused (kill switch)" });
  }

  if (intent.market || intent.type === "predict") {
    if (!flags.predict_markets) {
      issues.push({ field: "market", message: "predict disabled" });
    }
    const country = (opts?.country || intent.geoCountry || "").toUpperCase();
    if (predictBlockedForCountry(country, flags)) {
      issues.push({ field: "market", message: "Predict markets are off in this region until legal review" });
    }
    if (!intent.geoAttest) {
      issues.push({ field: "geoAttest", message: "Self-attest 18+ is required to attach a Yes/No market" });
    }
    const q = lintMarketQuestion(intent.market?.question || "");
    if (q) issues.push({ field: "market.question", message: q });
    const deadline = intent.market?.deadlineUnix ?? 0;
    if (deadline && deadline < now + 60) {
      issues.push({ field: "market.deadlineUnix", message: "Deadline must be at least a minute out" });
    }
    if (intent.market?.resolver === "pyth" && !intent.market.feedId) {
      issues.push({ field: "market.feedId", message: "Pyth resolver needs a feed id" });
    }
    if (intent.market?.resolver === "pyth" && !intent.market.threshold) {
      issues.push({ field: "market.threshold", message: "Pyth resolver needs a threshold" });
    }
  }

  if (intent.style === "delay") {
    const t = intent.delayOpenUnix ?? 0;
    if (t && t < now + PAD_PARAMS.delayOpenMinLeadSec) {
      issues.push({ field: "delayOpenUnix", message: "delay too soon" });
    }
    if (t && t > now + PAD_PARAMS.delayOpenMaxSec) {
      issues.push({ field: "delayOpenUnix", message: `Delay open max ${PAD_PARAMS.delayOpenMaxSec / 60} minutes` });
    }
  }

  if (intent.antiSnipeBlocks > PAD_PARAMS.antiSnipeMax) {
    issues.push({ field: "antiSnipeBlocks", message: `Anti-snipe max ${PAD_PARAMS.antiSnipeMax} blocks` });
  }

  if (intent.rewards.track === "epoch_vault" && !flags.track_b_vault) {
    issues.push({ field: "rewards", message: "vault not live" });
  }

  if (intent.type === "bagwork" && !flags.bagwork) {
    issues.push({ field: "bagwork", message: "Bagwork is flagged off" });
  }

  if (intent.mayhem && /x$/i.test(intent.quoteSymbol) && intent.quoteSymbol !== "USDC") {
    // extra mayhem+stock guard for agent API (F0742)
    issues.push({ field: "mayhem", message: "Mayhem + stock quote refused" });
  }

  return issues;
}

export function comboHidden(intent: LaunchIntent, flags: PadFlags = DEFAULT_PAD_FLAGS): {
  predict: boolean;
  epochVault: boolean;
  bagwork: boolean;
  stocks: boolean;
} {
  return {
    predict: !flags.predict_markets,
    epochVault: !flags.track_b_vault,
    bagwork: !flags.bagwork,
    stocks: !flags.stocks,
  };
}

export function styleLiveNote(intent: LaunchIntent): string | null {
  const meta = styleMeta(intent.style);
  return meta.live ? null : meta.refuse ?? null;
}

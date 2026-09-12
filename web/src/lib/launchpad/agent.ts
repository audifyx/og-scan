import { defaultIntent, type LaunchIntent } from "./intent";
import { validateLaunchIntent } from "./intent";
import { DEFAULT_PAD_FLAGS, type PadFlags } from "./flags";
import type { LaunchIntentV2 } from "./types";
import { defaultMarketSpec } from "./market";

export function intentFromV2(v2: LaunchIntentV2): LaunchIntent {
  return defaultIntent({
    type: v2.launchType,
    name: v2.name,
    symbol: v2.symbol,
    quoteMint: v2.quoteMint,
    vanityPrefix: v2.vanity?.prefix ?? "",
    vanitySuffix: v2.vanity?.suffix ?? (v2.launchType === "vanity" ? "obx" : ""),
    customMintSecret: v2.mintSecretB58,
    firstBuySol: v2.firstBuyQuoteAmount ? Number(v2.firstBuyQuoteAmount) : 0,
    graduationDest: v2.graduationDest,
    style: v2.style,
    delayOpenUnix: v2.delayOpenUnix,
    rewards: v2.rewards,
    market: v2.market,
    holderRewards: v2.rewards.track === "pump_holder" || v2.launchType === "rewards" || v2.launchType === "bagwork",
    bagwork: v2.launchType === "bagwork",
  });
}

export function v2FromIntent(intent: LaunchIntent, uri = ""): LaunchIntentV2 {
  return {
    name: intent.name,
    symbol: intent.symbol,
    uri,
    launchType: intent.type,
    quoteMint: intent.quoteMint,
    vanity: intent.type === "vanity" ? { prefix: intent.vanityPrefix, suffix: intent.vanitySuffix } : undefined,
    firstBuyQuoteAmount: intent.firstBuySol ? String(intent.firstBuySol) : undefined,
    graduationDest: intent.graduationDest,
    style: intent.style,
    delayOpenUnix: intent.delayOpenUnix,
    rewards: intent.rewards,
    market: intent.market ?? (intent.type === "predict" ? defaultMarketSpec(intent.symbol) : undefined),
  };
}

export type AgentSafetyHit = { code: string; message: string };

/** F0739–F0742 — refuse hidden mint authority, ToCreator LP default, cashback, mayhem+stock. */
export function agentSafety(intent: LaunchIntent, extra?: { cashback?: boolean; lpToCreator?: boolean; mintAuthorityKept?: boolean }): AgentSafetyHit[] {
  const hits: AgentSafetyHit[] = [];
  if (extra?.mintAuthorityKept) hits.push({ code: "hidden_mint_authority", message: "Refuse hidden mint authority" });
  if (extra?.lpToCreator) hits.push({ code: "lp_to_creator", message: "Refuse ToCreator LP default" });
  if (extra?.cashback) hits.push({ code: "cashback", message: "Refuse cashback flag — use holderReward" });
  if (intent.mayhem && /x$/i.test(intent.quoteSymbol) && intent.quoteSymbol !== "USDC") {
    hits.push({ code: "mayhem_stock", message: "Refuse mayhem + stock" });
  }
  return hits;
}

export function dryRunLaunch(intent: LaunchIntent, flags: PadFlags = DEFAULT_PAD_FLAGS): {
  ok: boolean;
  issues: ReturnType<typeof validateLaunchIntent>;
  safety: AgentSafetyHit[];
  ixs: string[];
  signatures: 1 | 2;
  notes: string[];
} {
  const issues = validateLaunchIntent(intent, { flags });
  const safety = agentSafety(intent);
  const notes: string[] = [];
  const ixs = ["ComputeBudgetProgram.setComputeUnitLimit(1200000)"];
  if (intent.quoteMint !== "So11111111111111111111111111111111111111112" && intent.firstBuySol > 0) {
    ixs.push("jupiterHop SOL→quote");
    notes.push("Non-SOL first buy needs a Jupiter hop. create_v2 quoted is not live — launch on SOL.");
  }
  ixs.push("pump create(+buy) via /api/pump-create");
  if (intent.market || intent.type === "predict") {
    ixs.push("init_market (indexed; on-chain program not live)");
    notes.push("Market is indexed. Unsigned init_market tx returns 501 until pm-core is deployed.");
  }
  if (intent.rewards.track === "pump_holder") {
    notes.push("holderReward:true on create body. Cashback is rejected.");
  }
  if (intent.rewards.track === "epoch_vault") {
    notes.push("Track B vault not live.");
  }
  const cu = intent.market ? 1_200_000 : 500_000;
  const signatures: 1 | 2 = cu > 1_400_000 ? 2 : 1;
  if (signatures === 2) notes.push("Two signatures: CreatePack then SeedPack.");
  return {
    ok: issues.length === 0 && safety.length === 0,
    issues,
    safety,
    ixs,
    signatures,
    notes,
  };
}

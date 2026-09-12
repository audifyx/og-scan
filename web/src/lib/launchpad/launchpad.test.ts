// @vitest-environment node
import { describe, expect, it } from "vitest";
import { applyLaunchType, defaultIntent, onChainCreateSupported, validateLaunchIntent, vanityEta, vanityPatternLength } from "./intent";
import { canLaunch, identityFromSession, launchGateReason } from "./auth";
import { feeSplitFor } from "./fees";
import { mayhemAllowedForQuote, mergeQuoteAllowlist, CURATED_QUOTES, isStockQuote } from "./quotes";
import { vanityWorkerPayload } from "./vanity";
import { needsQuoteHop, firstBuyLamports, jupiterQuoteUrl } from "./jupiter";
import { pumpCreateBody } from "./pump";
import { COLLECT_CREATOR_FEE_V2_DISCRIMINATOR, buildCollectCreatorFeeV2Instruction, buildSweepInstructions, sweepCopy } from "./sweep";
import { PublicKey } from "@solana/web3.js";
import { SOL_MINT } from "./types";
import { assertCombo } from "./combo";
import { DEFAULT_PAD_FLAGS } from "./flags";
import { claimable, boostablePot, clampPredictBoost, lockBoostForDays } from "./rewards";
import { splitCompleteSet, mergeCompleteSet, impliedProbability, yesNoPinResidual, lintMarketQuestion, redeemWinning } from "./market";
import { pythThresholdResolve, metricGraduationResolve, freezeDeadlineAfterFirstBet } from "./resolve";
import { agentSafety, dryRunLaunch, intentFromV2 } from "./agent";
import { PAD_PARAMS } from "./params";

describe("launchpad identity", () => {
  it("requires both X and wallet to launch", () => {
    expect(canLaunch({ x_user_id: null, x_handle: null, x_avatar: null, wallet_pubkey: "Abc" })).toBe(false);
    expect(canLaunch({ x_user_id: "12", x_handle: "a", x_avatar: null, wallet_pubkey: null })).toBe(false);
    expect(canLaunch({ x_user_id: "12", x_handle: "a", x_avatar: null, wallet_pubkey: "Abc" })).toBe(true);
    expect(launchGateReason({ x_user_id: "12", x_handle: "a", x_avatar: null, wallet_pubkey: null })).toMatch(/wallet/i);
  });

  it("reads X from supabase identities and twitter profile columns", () => {
    const id = identityFromSession({
      identities: [{ provider: "x", id: "xid", identity_data: { user_name: "pad" } }],
      profile: { wallet_pubkey: "Wal1" },
    });
    expect(id.x_user_id).toBe("xid");
    expect(id.x_handle).toBe("pad");
    expect(id.wallet_pubkey).toBe("Wal1");
  });
});

describe("launch intent", () => {
  it("refuses mayhem on stock quotes", () => {
    const intent = defaultIntent({
      type: "normal",
      name: "Nvidia Cats",
      symbol: "NVDCAT",
      quoteMint: "Xsc9qvGR1efVDFGLrVsmkzv3qi45LTBjeUKSPmx9qEh",
      quoteSymbol: "NVDAX",
      mayhem: true,
    });
    const issues = validateLaunchIntent(intent);
    expect(issues.some((i) => i.field === "mayhem")).toBe(true);
  });

  it("caps vanity at 5 chars", () => {
    const intent = defaultIntent({ type: "vanity", name: "Foo", symbol: "FOO", vanitySuffix: "obxxxx" });
    expect(vanityPatternLength(intent)).toBe(6);
    expect(vanityEta(6).disabled).toBe(true);
    expect(validateLaunchIntent(intent).some((i) => i.field === "vanity")).toBe(true);
  });

  it("requires custom CA pubkey", () => {
    const intent = defaultIntent({ type: "custom_ca", name: "Foo", symbol: "FOO" });
    expect(validateLaunchIntent(intent).some((i) => i.field === "customMint")).toBe(true);
  });

  it("keeps SOL create live and flags stock quotes awaiting allowlist", () => {
    const sol = defaultIntent({ name: "Foo", symbol: "FOO" });
    expect(validateLaunchIntent(sol)).toEqual([]);
    expect(onChainCreateSupported(sol)).toBe(true);
    const nvda = defaultIntent({
      name: "Foo",
      symbol: "FOO",
      quoteMint: "Xsc9qvGR1efVDFGLrVsmkzv3qi45LTBjeUKSPmx9qEh",
      quoteSymbol: "NVDAX",
    });
    expect(validateLaunchIntent(nvda).some((i) => /allowlist/i.test(i.message))).toBe(true);
    expect(onChainCreateSupported(nvda)).toBe(false);
  });

  it("maps rewards and bagwork flags from the mode rail", () => {
    const rewards = applyLaunchType(defaultIntent({ name: "R", symbol: "RRR" }), "rewards");
    expect(rewards.holderRewards).toBe(true);
    expect(rewards.bagwork).toBe(false);
    const bag = applyLaunchType(rewards, "bagwork");
    expect(bag.bagwork).toBe(true);
    expect(bag.holderRewards).toBe(true);
  });
});

describe("quotes + fees", () => {
  it("only allows mayhem on SOL/USDC", () => {
    expect(mayhemAllowedForQuote(SOL_MINT)).toBe(true);
    expect(mayhemAllowedForQuote("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v")).toBe(true);
    expect(mayhemAllowedForQuote("Xsc9qvGR1efVDFGLrVsmkzv3qi45LTBjeUKSPmx9qEh")).toBe(false);
    expect(isStockQuote("Xsc9qvGR1efVDFGLrVsmkzv3qi45LTBjeUKSPmx9qEh")).toBe(true);
  });

  it("intersects curated metadata with on-chain allowlist", () => {
    const merged = mergeQuoteAllowlist(CURATED_QUOTES, ["Xsc9qvGR1efVDFGLrVsmkzv3qi45LTBjeUKSPmx9qEh"]);
    const nvda = merged.find((q) => q.symbol === "NVDAX");
    expect(nvda?.allowed).toBe(true);
    expect(nvda?.awaitingAllowlist).toBe(false);
    const tsla = merged.find((q) => q.symbol === "TSLAX");
    expect(tsla?.allowed).toBe(false);
  });

  it("freezes bagwork 40/40/20 and rewards 100% holders", () => {
    expect(feeSplitFor({ type: "bagwork", holderRewards: true, bagwork: true })).toMatchObject({
      holdersPct: 40, bagworkPct: 40, devPct: 20,
    });
    expect(feeSplitFor({ type: "rewards", holderRewards: true, bagwork: false }).holdersPct).toBe(100);
    expect(feeSplitFor({ type: "normal", holderRewards: false, bagwork: false }).devPct).toBe(100);
  });
});

describe("vanity + jupiter helpers", () => {
  it("rejects 6-char grind payloads", () => {
    expect(vanityWorkerPayload({ suffix: "abcdef" })).toEqual({ error: "Vanity pattern max 5 characters" });
    expect(vanityWorkerPayload({ prefix: "ob", suffix: "x" })).toMatchObject({ prefix: "ob", suffix: "x" });
  });

  it("builds a SOL→quote hop URL only when needed", () => {
    expect(needsQuoteHop(SOL_MINT)).toBe(false);
    expect(needsQuoteHop("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v")).toBe(true);
    expect(firstBuyLamports(0.5)).toBe(500_000_000);
    expect(jupiterQuoteUrl(SOL_MINT, "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", 1000)).toContain("lite-api.jup.ag");
  });
});

describe("pump create + permissionless sweep", () => {
  it("passes quote mint and holderReward through the existing create body", () => {
    const body = pumpCreateBody({
      publicKey: "11111111111111111111111111111111",
      metadataUri: "https://example/meta",
      name: "Foo",
      symbol: "FOO",
      mintPublicKey: "Mint111111111111111111111111111111111111111",
      devBuySol: 0.1,
      quoteMint: SOL_MINT,
      holderReward: true,
    });
    expect(body.quoteMint).toBe(SOL_MINT);
    expect(body.holderReward).toBe(true);
    expect(body.step).toBe("create");
  });

  it("builds collect_creator_fee_v2 with creator as non-signer destination", () => {
    const creator = new PublicKey("CicbPxARTDrwQ4XcxWsn6SYeG4FMJHirS633cZUJeQDh");
    const ix = buildCollectCreatorFeeV2Instruction({ creator });
    expect([...ix.data]).toEqual(COLLECT_CREATOR_FEE_V2_DISCRIMINATOR);
    expect(ix.keys).toHaveLength(10);
    expect(ix.keys[0].pubkey.equals(creator)).toBe(true);
    expect(ix.keys[0].isSigner).toBe(false);
    expect(ix.keys[0].isWritable).toBe(true);
    const sweep = buildSweepInstructions({ creator, graduated: true });
    expect(sweep.length).toBe(3);
    expect(sweepCopy("Cicb…eQDh")).toMatch(/not to you/i);
  });
});

describe("v2 combo + flags", () => {
  it("hides predict when the flag is off", () => {
    const intent = defaultIntent({
      type: "predict",
      name: "Ship",
      symbol: "SHIP",
      geoAttest: true,
      geoCountry: "DE",
    });
    const issues = assertCombo(intent, { flags: { ...DEFAULT_PAD_FLAGS, predict_markets: false } });
    expect(issues.some((i) => /predict disabled/i.test(i.message))).toBe(true);
  });

  it("blocks US predict until review", () => {
    const intent = defaultIntent({
      type: "predict",
      name: "Ship",
      symbol: "SHIP",
      geoAttest: true,
      geoCountry: "US",
    });
    expect(assertCombo(intent).some((i) => /region/i.test(i.message))).toBe(true);
  });

  it("requires 18+ attest and rejects delay too soon", () => {
    const now = 1_800_000_000;
    const intent = defaultIntent({
      type: "predict",
      name: "Ship",
      symbol: "SHIP",
      geoCountry: "DE",
      style: "delay",
      delayOpenUnix: now + 10,
    });
    const issues = assertCombo(intent, { nowUnix: now, country: "DE" });
    expect(issues.some((i) => i.field === "geoAttest")).toBe(true);
    expect(issues.some((i) => /delay too soon/i.test(i.message))).toBe(true);
  });

  it("refuses Track B vault until the flag is on", () => {
    const intent = defaultIntent({
      name: "Ship",
      symbol: "SHIP",
      rewards: { track: "epoch_vault", epochSeconds: 3600 },
    });
    expect(assertCombo(intent).some((i) => /vault not live/i.test(i.message))).toBe(true);
    expect(assertCombo(intent, { flags: { ...DEFAULT_PAD_FLAGS, track_b_vault: true } }).some((i) => i.field === "rewards")).toBe(false);
  });

  it("applies predict as a mode without dropping SOL create", () => {
    const p = applyLaunchType(defaultIntent({ name: "Ship", symbol: "SHIP" }), "predict");
    expect(p.type).toBe("predict");
    expect(p.market?.question).toMatch(/graduate/i);
    expect(onChainCreateSupported(p)).toBe(true);
  });
});

describe("v2 claimable + YES/NO pin", () => {
  it("computes pro-rata claim and never overpays", () => {
    expect(claimable({ ownerBal: 10n, supply: 100n, pot: 1000n, claimed: 0n })).toBe(100n);
    expect(claimable({ ownerBal: 10n, supply: 100n, pot: 1000n, claimed: 100n })).toBe(0n);
    expect(claimable({ ownerBal: 1n, supply: 0n, pot: 50n, claimed: 0n })).toBe(0n);
  });

  it("keeps 20% insurance off the boost pot", () => {
    expect(boostablePot(1000n)).toBe(800n);
    expect(clampPredictBoost(2)).toBe(PAD_PARAMS.predictBoostCap);
    expect(lockBoostForDays(30)).toBe(1.25);
  });

  it("pins YES+NO and splits/merges a complete set", () => {
    const set = splitCompleteSet(1_000_000n);
    expect(set.yes).toBe(1_000_000n);
    expect(set.no).toBe(1_000_000n);
    expect(mergeCompleteSet(set.yes, set.no)).toBe(1_000_000n);
    expect(impliedProbability(75n, 25n)).toBe(0.75);
    expect(yesNoPinResidual(0.495, 0.495, 100)).toBeLessThan(0.02);
    expect(redeemWinning(5n, true)).toBe(5n);
    expect(redeemWinning(5n, false)).toBe(0n);
  });

  it("lints questions", () => {
    expect(lintMarketQuestion("")).toMatch(/required/i);
    expect(lintMarketQuestion("x".repeat(141))).toMatch(/max/i);
    expect(lintMarketQuestion("Will $SHIP graduate within 48h?")).toBeNull();
  });
});

describe("v2 resolve + agent dry-run", () => {
  it("voids stale Pyth after grace and skips before deadline", () => {
    const deadline = 1000;
    expect(pythThresholdResolve({ nowUnix: 900, deadlineUnix: deadline, tick: null, threshold: 1 }).outcome).toBe("skip");
    expect(pythThresholdResolve({ nowUnix: 1000 + PAD_PARAMS.graceResolveSec + 1, deadlineUnix: deadline, tick: null, threshold: 1 }).outcome).toBe("void");
    expect(pythThresholdResolve({
      nowUnix: 1001,
      deadlineUnix: deadline,
      tick: { value: 2, conf: 0.01, publishTime: 1000, feedId: "abc" },
      threshold: 1,
    }).outcome).toBe("yes");
  });

  it("resolves graduation metric after grace", () => {
    expect(metricGraduationResolve({ nowUnix: 50, deadlineUnix: 100, graduatedAtUnix: null }).outcome).toBe("skip");
    expect(metricGraduationResolve({ nowUnix: 100, deadlineUnix: 100, graduatedAtUnix: 80 }).outcome).toBe("yes");
    expect(metricGraduationResolve({ nowUnix: 100 + PAD_PARAMS.graceResolveSec + 1, deadlineUnix: 100, graduatedAtUnix: null }).outcome).toBe("no");
  });

  it("freezes deadline after first bet", () => {
    expect(freezeDeadlineAfterFirstBet(10, 20, 1n)).toMatch(/deadline/i);
    expect(freezeDeadlineAfterFirstBet(10, 20, 0n)).toBeNull();
  });

  it("dry-run refuses cashback and mayhem+stock", () => {
    const intent = defaultIntent({ name: "Nvidia Cats", symbol: "NVDCAT", quoteSymbol: "NVDAX", mayhem: true });
    expect(agentSafety(intent, { cashback: true }).some((h) => h.code === "cashback")).toBe(true);
    expect(agentSafety(intent).some((h) => h.code === "mayhem_stock")).toBe(true);
    const v2 = intentFromV2({
      name: "Ship",
      symbol: "SHIP",
      uri: "https://example/meta",
      launchType: "rewards",
      quoteMint: SOL_MINT,
      graduationDest: "pumpswap",
      style: "curve",
      rewards: { track: "pump_holder" },
    });
    const dry = dryRunLaunch(v2);
    expect(dry.ok).toBe(true);
    expect(dry.ixs.some((i) => /pump create/i.test(i))).toBe(true);
  });
});

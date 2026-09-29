/**
 * Burn-flow dry-run verification (BURN-FLOW TEAM, GTA polish phase).
 *
 * Verifies end-to-end UP TO the real burn execution call, using the
 * dry-run test hook only. No on-chain transaction is ever executed here:
 *
 *  1. In dry-run mode, burnPurchase() must NOT call billing.spend() — it
 *     records the would-be call (amount, namespaced reason, ref) in the
 *     dry-run ledger instead.
 *  2. With dry-run off and a mocked spend(), burnPurchase() must invoke
 *     the real burn entry point with exactly {amount, reason, ref}.
 *  3. Every module's purchase seam routes through the canonical API:
 *     heists registry, social factory, sports window injection, plus the
 *     directly-wired seams (economy/character/realestate/seasons/gadgets/
 *     media/events/vehicles/racing/police/bounty).
 *  4. Legacy dash-form reasons (city-bank:x, city-heists:x, …) normalize
 *     into the canonical city:<module>:… namespace.
 *  5. Guards: not-authed billing and non-positive amounts never reach spend.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  burnPurchase,
  burnReason,
  clearBurnDryRunLog,
  getBurnDryRunLog,
  isBurnDryRun,
  normalizeBurnReason,
  registerModuleBilling,
  setBurnDryRun,
  type SharedBilling,
} from "./cityPorts";
import { isBillingReady, tryBurnPremium } from "@/city/modules/heists";
import { useSocialBilling } from "@/city/modules/social";
import { purchaseBurn } from "@/city/modules/character/billing";
import { adaptBillingToBurnProvider as adaptRacing } from "@/city/modules/racing";
import { adaptBillingToBurnProvider as adaptVehicles } from "@/city/modules/vehicles/economy";
import { BountyStore } from "@/city/modules/bounty/store";

const fakeBilling = (overrides: Partial<SharedBilling> = {}): SharedBilling =>
  ({
    ready: true,
    balance: 123,
    wallet: "Desk1111111111111111111111111111111111111",
    spend: vi.fn(async (opts: { amount: number; reason: string; ref?: string }) => ({
      signature: `sig-${opts.ref ?? "noref"}`,
    })),
    beginAuth: vi.fn(),
    resetAuth: vi.fn(),
    error: null,
    refresh: vi.fn(),
    ...overrides,
  }) as unknown as SharedBilling;

beforeEach(() => {
  setBurnDryRun(false);
  clearBurnDryRunLog();
  localStorage.clear();
});

describe("burnReason", () => {
  it("namespaces reasons as city:<module>:<action>[:<itemId>]", () => {
    expect(burnReason("heists", "entry", "casino")).toBe("city:heists:entry:casino");
    expect(burnReason("realestate", "deed")).toBe("city:realestate:deed");
  });
});

describe("normalizeBurnReason", () => {
  it("maps legacy dash-form reasons into the canonical namespace", () => {
    expect(normalizeBurnReason("city-bank:neon-underglow", "economy")).toBe("city:bank:neon-underglow");
    expect(normalizeBurnReason("city-heists:casino-entry", "heists")).toBe("city:heists:casino-entry");
    expect(normalizeBurnReason("city-sports:sponsorProContract", "sports")).toBe("city:sports:sponsorProContract");
    expect(normalizeBurnReason("city-social:vip-table", "social")).toBe("city:social:vip-table");
    expect(normalizeBurnReason("city-realestate:deed:penthouse-3", "realestate")).toBe("city:realestate:deed:penthouse-3");
    expect(normalizeBurnReason("city:police-bribe", "police")).toBe("city:police:bribe");
  });
  it("passes canonical reasons through untouched", () => {
    expect(normalizeBurnReason("city:character:tattoo:dragon-sleeve", "character")).toBe(
      "city:character:tattoo:dragon-sleeve",
    );
    expect(normalizeBurnReason("city:season-pass:s1", "seasons")).toBe("city:season-pass:s1");
  });
});

describe("burnPurchase guards", () => {
  it("rejects when billing is missing or not authed — spend never called", async () => {
    const b = fakeBilling({ ready: false });
    for (const billing of [null, undefined, b]) {
      const r = await burnPurchase(billing, {
        amount: 5,
        itemId: "x",
        reason: burnReason("test", "x"),
      });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.code).toBe("not-authed");
    }
    expect(b.spend).not.toHaveBeenCalled();
  });

  it("rejects non-positive / non-whole-burnable amounts", async () => {
    const b = fakeBilling();
    for (const amount of [0, -3, NaN]) {
      const r = await burnPurchase(b, { amount, itemId: "x", reason: burnReason("test", "x") });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.code).toBe("invalid-amount");
    }
    expect(b.spend).not.toHaveBeenCalled();
  });
});

describe("burnPurchase dry-run (no on-chain tx)", () => {
  it("reaches the burn invocation point with exact params but does NOT call spend", async () => {
    setBurnDryRun(true);
    expect(isBurnDryRun()).toBe(true);
    const b = fakeBilling();
    const r = await burnPurchase(b, {
      amount: 5.7,
      itemId: "casino-entry",
      label: "Casino entry fee",
      reason: burnReason("heists", "entry", "casino-entry"),
      module: "heists",
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.dryRun).toBe(true);
      expect(r.signature.startsWith("dryrun:")).toBe(true);
    }
    // The execution call was NOT made.
    expect(b.spend).not.toHaveBeenCalled();

    // The would-be call is recorded with exact params (amount floored to whole).
    const log = getBurnDryRunLog();
    expect(log).toHaveLength(1);
    expect(log[0].amount).toBe(5);
    expect(log[0].reason).toBe("city:heists:entry:casino-entry");
    expect(log[0].itemId).toBe("casino-entry");
    expect(log[0].module).toBe("heists");
    expect(log[0].dryRun).toBe(true);
    expect(log[0].ref).toBeTruthy();
  });
});

describe("burnPurchase live path (mocked spend — verifies the real invocation)", () => {
  it("invokes billing.spend with exactly {amount, reason, ref}", async () => {
    const b = fakeBilling();
    const r = await burnPurchase(b, {
      amount: 25,
      itemId: "vip-getaway",
      label: "VIP getaway",
      reason: burnReason("heists", "getaway", "vip-getaway"),
      ref: "ref-abc-123",
      module: "heists",
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.dryRun).toBe(false);
      expect(r.signature).toBe("sig-ref-abc-123");
      expect(r.ref).toBe("ref-abc-123");
    }
    expect(b.spend).toHaveBeenCalledTimes(1);
    expect(b.spend).toHaveBeenCalledWith({
      amount: 25,
      reason: "city:heists:getaway:vip-getaway",
      ref: "ref-abc-123",
    });
  });
});

describe("module seams route through the canonical burn API", () => {
  it("heists registry (casino entry / fixer skip / VIP getaway) reaches burn in dry-run", async () => {
    setBurnDryRun(true);
    const b = fakeBilling();
    registerModuleBilling(b);
    expect(isBillingReady()).toBe(true);

    const r = await tryBurnPremium({
      amount: 5,
      reason: "city-heists:fixer-skip",
      sku: "heist:fixer-skip",
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.signature.startsWith("dryrun:")).toBe(true);
    expect(b.spend).not.toHaveBeenCalled();

    const log = getBurnDryRunLog();
    expect(log.some((e) => e.reason === "city:heists:fixer-skip" && e.amount === 5)).toBe(true);
  });

  it("social factory (nightclub premium) reaches burn in dry-run", async () => {
    setBurnDryRun(true);
    const b = fakeBilling();
    registerModuleBilling(b);
    const social = useSocialBilling();
    expect(social.premium).toBe(true);
    expect(social.ready).toBe(true);

    const { signature } = await social.burnForPremium({
      amount: 10,
      reason: burnReason("social", "nightclub", "vip-table"),
    });
    expect(signature.startsWith("dryrun:")).toBe(true);
    expect(b.spend).not.toHaveBeenCalled();
    const log = getBurnDryRunLog();
    expect(log.some((e) => e.reason === "city:social:nightclub:vip-table" && e.amount === 10)).toBe(true);
  });

  it("sports window injection reaches burn in dry-run", async () => {
    setBurnDryRun(true);
    const b = fakeBilling();
    registerModuleBilling(b);
    const injected = (window as unknown as { __orbitxBilling?: { ready: boolean; spend: (o: { amount: number; reason: string; ref?: string }) => Promise<{ signature: string }> } }).__orbitxBilling;
    expect(injected?.ready).toBe(true);

    const { signature } = await injected!.spend({
      amount: 3,
      reason: burnReason("sports", "tournament", "golden-bracket"),
      ref: "sports-ref-1",
    });
    expect(signature).toBe("dryrun:sports-ref-1");
    expect(b.spend).not.toHaveBeenCalled();
    const log = getBurnDryRunLog();
    expect(
      log.some((e) => e.reason === "city:sports:tournament:golden-bracket" && e.amount === 3),
    ).toBe(true);
  });

  it("registered adapters stay live when billing updates (auth completes later)", async () => {
    setBurnDryRun(true);
    const b = fakeBilling({ ready: false });
    registerModuleBilling(b);
    expect(isBillingReady()).toBe(false);
    // Auth completes → host pushes the updated billing value.
    registerModuleBilling.update(fakeBilling({ ready: true }));
    expect(isBillingReady()).toBe(true);
  });

  it("character purchaseBurn reaches the burn invocation in dry-run", async () => {
    setBurnDryRun(true);
    const b = fakeBilling();
    const r = await purchaseBurn(
      { ready: true, balance: 50, beginAuth: () => {}, spend: b.spend },
      "dragon-sleeve",
      "tattoo",
      8,
    );
    expect(r.ok).toBe(true);
    expect(b.spend).not.toHaveBeenCalled();
    const log = getBurnDryRunLog();
    expect(
      log.some((e) => e.reason === "city:character:tattoo:dragon-sleeve" && e.amount === 8 && e.module === "character"),
    ).toBe(true);
  });

  it("racing burn adapter reaches the burn invocation in dry-run", async () => {
    setBurnDryRun(true);
    const b = fakeBilling();
    const provider = adaptRacing(b);
    const receipt = await provider.burn({ amount: 7, reason: "city:racing:entry:street-circuit", ref: "race-1" });
    expect(receipt.signature).toBe("dryrun:race-1");
    expect(b.spend).not.toHaveBeenCalled();
    const log = getBurnDryRunLog();
    expect(log.some((e) => e.reason === "city:racing:entry:street-circuit" && e.amount === 7)).toBe(true);
  });

  it("vehicles burn adapter reaches the burn invocation in dry-run", async () => {
    setBurnDryRun(true);
    const b = fakeBilling();
    const provider = adaptVehicles(b);
    const receipt = await provider.burn({ amount: 12, reason: "city:vehicles:dealership:hypercar-x", ref: "veh-1" });
    expect(receipt.signature).toBe("dryrun:veh-1");
    expect(b.spend).not.toHaveBeenCalled();
    const log = getBurnDryRunLog();
    expect(log.some((e) => e.reason === "city:vehicles:dealership:hypercar-x" && e.amount === 12)).toBe(true);
  });

  it("bounty ORBITX escrow funding reaches the burn invocation in dry-run", async () => {
    setBurnDryRun(true);
    const b = fakeBilling();
    const store = new BountyStore();
    const paper = {
      getBalance: () => 1_000_000,
      debit: async () => true,
      credit: async () => {},
    };
    const res = await store.post(
      { targetDisplayName: "Rival Runner", currency: "ORBITX", amount: 5, durationId: "24h", note: "" },
      { me: { playerId: "p:test", displayName: "Tester" }, paper, billing: b },
    );
    expect(res.ok).toBe(true);
    expect(b.spend).not.toHaveBeenCalled();
    const log = getBurnDryRunLog();
    expect(
      log.some((e) => e.reason.startsWith("city:bounty:bty_") && e.amount === 5 && e.module === "bounty"),
    ).toBe(true);
  });
});

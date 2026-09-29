/**
 * OrbitXCity — Police module tests (heat model, bribes, prison, court).
 * Run: npx vitest run src/city/modules/police/police.test.ts
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  PoliceStore,
  heatToStars,
  repeatOffenderFactor,
  courtThreshold,
  BRIBE_PRICE,
  FINE_PER_STAR,
} from "./store";
import type { OrbitxBillingProvider, PaperLedgerPort } from "./types";

function makeStore(): PoliceStore {
  const s = new PoliceStore();
  s.clearRecord();
  return s;
}

function fakePaper(balance = 10_000): PaperLedgerPort {
  let b = balance;
  return {
    getBalance: () => b,
    debit: async (amount) => {
      if (b < amount) return false;
      b -= amount;
      return true;
    },
    credit: async (amount) => {
      b += amount;
      return true;
    },
  };
}

function fakeBilling(ready = true): OrbitxBillingProvider {
  return {
    ready,
    balance: 1000,
    spend: vi.fn(async () => ({ signature: "sig_test_123" })),
    beginAuth: vi.fn(),
  };
}

describe("heat model", () => {
  let store: PoliceStore;
  beforeEach(() => {
    store = makeStore();
  });

  it("maps heat to stars", () => {
    expect(heatToStars(0)).toBe(0);
    expect(heatToStars(1)).toBe(1);
    expect(heatToStars(20)).toBe(1);
    expect(heatToStars(21)).toBe(2);
    expect(heatToStars(99)).toBe(5);
    expect(heatToStars(100)).toBe(5);
  });

  it("reports a witnessed crime at full heat", () => {
    const r = store.reportCrime({ kind: "grand_theft_auto", witnessed: true });
    expect(r.heat).toBe(18);
    expect(r.stars).toBe(1);
    expect(store.rapSheet.offenses).toBe(1);
  });

  it("unwitnessed crimes add suspicion (25% heat)", () => {
    const r = store.reportCrime({ kind: "grand_theft_auto", witnessed: false });
    expect(r.heat).toBe(4.5);
  });

  it("repeat offenders heat up faster", () => {
    expect(repeatOffenderFactor(0)).toBe(1);
    expect(repeatOffenderFactor(2)).toBe(1.5);
    expect(repeatOffenderFactor(99)).toBe(2); // capped
    const s2 = makeStore();
    s2.reportCrime({ kind: "petty_theft", witnessed: true });
    s2.reportCrime({ kind: "petty_theft", witnessed: true });
    s2.reportCrime({ kind: "petty_theft", witnessed: true });
    s2.reportCrime({ kind: "petty_theft", witnessed: true });
    const r = s2.reportCrime({ kind: "petty_theft", witnessed: true });
    // 4 prior offenses → ×2 multiplier
    expect(r.record.heatAdded).toBe(16);
  });

  it("heat decays and clears wanted state", () => {
    store.reportCrime({ kind: "heist_offense", witnessed: true });
    expect(store.wanted).toBe(true);
    store.tick(100, false); // evaded — fast decay
    expect(store.wanted).toBe(false);
    expect(store.stars).toBe(0);
  });
});

describe("bribes", () => {
  let store: PoliceStore;
  beforeEach(() => {
    store = makeStore();
    store.reportCrime({ kind: "heist_offense", witnessed: true }); // 35 heat → 2 stars
  });

  it("fails closed when billing is not ready", async () => {
    const r = await store.bribe(fakeBilling(false));
    expect(r.ok).toBe(false);
    expect(r.error).toBe("billing_not_ready");
    expect(store.wanted).toBe(true);
  });

  it("burns ORBITX and wipes heat", async () => {
    const billing = fakeBilling();
    const r = await store.bribe(billing);
    expect(r.ok).toBe(true);
    expect(r.amount).toBe(BRIBE_PRICE[2]);
    expect(billing.spend).toHaveBeenCalledWith(
      expect.objectContaining({ amount: BRIBE_PRICE[2], reason: "city:police-bribe" }),
    );
    expect(store.stars).toBe(0);
    expect(store.rapSheet.bribes).toBe(1);
    expect(store.rapSheet.orbitxBurnedOnBribes).toBe(BRIBE_PRICE[2]);
  });

  it("refuses when the wallet can't cover the bribe", async () => {
    const billing = fakeBilling();
    billing.balance = 1;
    const r = await store.bribe(billing);
    expect(r.ok).toBe(false);
    expect(r.error).toBe("insufficient_balance");
    expect(billing.spend).not.toHaveBeenCalled();
  });
});

describe("prison", () => {
  let store: PoliceStore;
  beforeEach(() => {
    store = makeStore();
    store.reportCrime({ kind: "assault_officer", witnessed: true }); // 25 heat → 2 stars
  });

  it("bust() resets heat, starts a sentence, schedules court", () => {
    const s = store.bust("Downtown");
    expect(store.stars).toBe(0);
    expect(s.status).toBe("serving");
    expect(s.stars).toBe(2);
    expect(store.rapSheet.convictions).toBe(1);
    expect(store.court?.status).toBe("pending");
    expect(store.court?.fineCity).toBe(2 * FINE_PER_STAR);
  });

  it("serving the sentence frees the player", () => {
    store.bust();
    store.tickSentence(1000);
    expect(store.sentence?.status).toBe("served");
    expect(store.servingTime).toBe(false);
  });

  it("crew bail costs paper CITY and re-adds heat", async () => {
    const paper = fakePaper(1000);
    store.bust();
    const r = await store.crewBail(paper);
    expect(r.ok).toBe(true);
    expect(paper.getBalance()).toBe(1000 - 2 * 250);
    expect(store.sentence?.status).toBe("escaped");
    expect(store.stars).toBe(2);
  });
});

describe("court", () => {
  let store: PoliceStore;
  beforeEach(() => {
    store = makeStore();
    store.reportCrime({ kind: "grand_theft_auto", witnessed: true });
    store.bust();
  });

  it("threshold rises with convictions", () => {
    expect(courtThreshold(0)).toBe(8);
    expect(courtThreshold(5)).toBe(11);
  });

  it("paying the fine settles the case in paper CITY", async () => {
    const paper = fakePaper(5000);
    const r = await store.payFine(paper);
    expect(r.ok).toBe(true);
    expect(store.court?.status).toBe("paid");
    expect(paper.getBalance()).toBe(5000 - store.court!.fineCity);
  });

  it("perfect answers acquit the player", () => {
    // 0 convictions → threshold 8; best answers score 4+4+4 = 12.
    store.playCourtRound(0, "d");
    store.playCourtRound(1, "a");
    const r = store.playCourtRound(2, "a");
    expect(r.done).toBe(true);
    expect(r.acquitted).toBe(true);
    expect(store.court?.status).toBe("acquitted");
    expect(store.rapSheet.acquittals).toBe(1);
  });

  it("bad answers convict and raise the fine", () => {
    store.playCourtRound(0, "b");
    store.playCourtRound(1, "b");
    const r = store.playCourtRound(2, "b");
    expect(r.acquitted).toBe(false);
    expect(store.court?.status).toBe("convicted");
    expect(store.court?.fineCity).toBe(Math.round(FINE_PER_STAR * 1.5));
  });
});

/**
 * Focused tests for the Pulse feed's pure logic (src/trade/pulseApi.ts).
 * Covers: signal type → label/icon, tone mapping, filtering/sorting,
 * mood math, KOL row merging/dedup, and buy/sell pressure.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  buySellPressure,
  fetchKolFeed,
  fetchSignals,
  filterSignals,
  mergeKolRows,
  moodOf,
  signalCounts,
  sortSignals,
  toneFor,
  typeMetaFor,
  type KolFeedRow,
  type PulseSignal,
} from "./pulseApi";

const sig = (over: Partial<PulseSignal> & { mint: string }): PulseSignal => ({
  type: "momentum",
  label: "Momentum",
  tone: "lime",
  ...over,
});

describe("typeMetaFor — signal type → label/icon", () => {
  it("maps every known type", () => {
    expect(typeMetaFor("graduating")).toEqual({ label: "Graduating", icon: "rocket" });
    expect(typeMetaFor("graduated")).toEqual({ label: "Graduated", icon: "badge" });
    expect(typeMetaFor("volume_surge")).toEqual({ label: "Volume Surge", icon: "waves" });
    expect(typeMetaFor("buyer_surge")).toEqual({ label: "Buyer Surge", icon: "users" });
    expect(typeMetaFor("momentum")).toEqual({ label: "Momentum", icon: "trending" });
    expect(typeMetaFor("velocity_spike")).toEqual({ label: "Velocity", icon: "gauge" });
    expect(typeMetaFor("fresh_runner")).toEqual({ label: "Fresh", icon: "sparkles" });
    expect(typeMetaFor("selloff")).toEqual({ label: "Sell-Off", icon: "alert" });
  });

  it("falls back to the raw label + zap icon for unknown types", () => {
    expect(typeMetaFor("mystery", "Mystery Signal")).toEqual({ label: "Mystery Signal", icon: "zap" });
    expect(typeMetaFor("")).toEqual({ label: "Signal", icon: "zap" });
  });
});

describe("toneFor — tone mapping", () => {
  it("passes known tones through", () => {
    for (const t of ["lime", "cyan", "violet", "gold", "red"] as const) {
      expect(toneFor(t)).toBe(t);
    }
  });

  it("falls back to lime for unknown / missing tones", () => {
    expect(toneFor("pink")).toBe("lime");
    expect(toneFor(undefined)).toBe("lime");
    expect(toneFor(null)).toBe("lime");
  });
});

describe("filterSignals / sortSignals", () => {
  const rows: PulseSignal[] = [
    sig({ mint: "A", type: "momentum", strength: 40, mcap: 100_000, ch24h: 5 }),
    sig({ mint: "B", type: "selloff", strength: 90, mcap: 50_000, ch24h: -20 }),
    sig({ mint: "C", type: "momentum", strength: 70, mcap: 500_000, ch24h: 12 }),
  ];

  it("returns all rows for 'all'", () => {
    expect(filterSignals(rows, "all")).toHaveLength(3);
  });

  it("filters by type", () => {
    expect(filterSignals(rows, "momentum").map((s) => s.mint)).toEqual(["A", "C"]);
    expect(filterSignals(rows, "graduating")).toHaveLength(0);
  });

  it("sorts by strength desc", () => {
    expect(sortSignals(rows, "strength").map((s) => s.mint)).toEqual(["B", "C", "A"]);
  });

  it("sorts by mcap desc", () => {
    expect(sortSignals(rows, "mcap").map((s) => s.mint)).toEqual(["C", "A", "B"]);
  });

  it("sorts by 24h change desc", () => {
    expect(sortSignals(rows, "change").map((s) => s.mint)).toEqual(["C", "A", "B"]);
  });

  it("treats missing strength/mcap as 0 and missing change as worst", () => {
    const sparse = [
      sig({ mint: "X", type: "momentum" }),
      sig({ mint: "Y", type: "momentum", strength: 1, mcap: 1, ch24h: 0 }),
    ];
    expect(sortSignals(sparse, "strength")[0].mint).toBe("Y");
    expect(sortSignals(sparse, "change")[0].mint).toBe("Y");
  });
});

describe("moodOf / signalCounts", () => {
  it("computes bullish share from live signals only", () => {
    const rows = [
      sig({ mint: "A", type: "momentum" }),
      sig({ mint: "B", type: "buyer_surge" }),
      sig({ mint: "C", type: "selloff" }),
      sig({ mint: "D", type: "graduated" }),
    ];
    // bull = momentum + buyer_surge = 2; bear = selloff = 1 → 67%
    expect(moodOf(rows)).toEqual({ bull: 2, bear: 1, pct: 67 });
  });

  it("returns 0% mood for an empty feed (never invents sentiment)", () => {
    expect(moodOf([])).toEqual({ bull: 0, bear: 0, pct: 0 });
  });

  it("counts per type", () => {
    const rows = [
      sig({ mint: "A", type: "momentum" }),
      sig({ mint: "B", type: "momentum" }),
      sig({ mint: "C", type: "selloff" }),
    ];
    expect(signalCounts(rows)).toEqual({ momentum: 2, selloff: 1 });
  });
});

describe("mergeKolRows — dedupe + newest first", () => {
  const row = (over: Partial<KolFeedRow>): KolFeedRow => ({
    side: "buy",
    ...over,
  });

  it("dedupes by txHash, live feed first", () => {
    const a = row({ txHash: "tx1", time: 100, kolAddress: "W1" });
    const b = row({ txHash: "tx1", time: 100, kolAddress: "W1" });
    const c = row({ txHash: "tx2", time: 200, kolAddress: "W2" });
    expect(mergeKolRows([a, c], [b])).toEqual([c, a]);
  });

  it("falls back to owner+time+side when txHash is missing", () => {
    const a = row({ time: 100, kolAddress: "W1", side: "buy" });
    const b = row({ time: 100, kolAddress: "W1", side: "buy" });
    const c = row({ time: 100, kolAddress: "W1", side: "sell" });
    expect(mergeKolRows([a, b, c])).toHaveLength(2);
  });

  it("sorts newest first and tolerates null lists", () => {
    const rows = mergeKolRows(null, undefined, [
      row({ txHash: "old", time: 10 }),
      row({ txHash: "new", time: 999 }),
    ]);
    expect(rows.map((r) => r.txHash)).toEqual(["new", "old"]);
  });
});

describe("buySellPressure", () => {
  it("sums buys/sells and USD from real rows only", () => {
    const rows: KolFeedRow[] = [
      { side: "buy", usdValue: 1000 },
      { side: "buy", usdValue: 500 },
      { side: "sell", usdValue: 200 },
      { side: "trade", usdValue: 9999 },
    ];
    expect(buySellPressure(rows)).toEqual({ buys: 2, sells: 1, buyUsd: 1500, sellUsd: 200, total: 3 });
  });

  it("returns zeros for an empty feed", () => {
    expect(buySellPressure([])).toEqual({ buys: 0, sells: 0, buyUsd: 0, sellUsd: 0, total: 0 });
  });
});

describe("fetchSignals / fetchKolFeed — endpoint behavior with stubbed fetch", () => {
  const realFetch = globalThis.fetch;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    globalThis.fetch = realFetch;
  });

  it("fetchSignals returns signals + counts from /api/ogdex/signals", async () => {
    const payload = {
      ok: true,
      counts: { momentum: 1 },
      signals: [sig({ mint: "A", type: "momentum" })],
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ json: async () => payload }));
    const out = await fetchSignals();
    expect(out.signals).toHaveLength(1);
    expect(out.counts).toEqual({ momentum: 1 });
    expect(fetch).toHaveBeenCalledWith("/api/ogdex/signals");
  });

  it("fetchSignals returns an empty list (never fake signals) when the endpoint fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("down")));
    const promise = fetchSignals();
    // retries use 900ms / 1800ms backoff — run all timers to completion
    await vi.runAllTimersAsync();
    const out = await promise;
    expect(out).toEqual({ signals: [], counts: {} });
  });

  it("fetchKolFeed hits /api/ogdex/kols with feed=1 and the token filter", async () => {
    const payload = { ok: true, feed: [{ side: "buy", txHash: "t1", mint: "M1" }] };
    const fetchMock = vi.fn().mockResolvedValue({ json: async () => payload });
    vi.stubGlobal("fetch", fetchMock);
    const rows = await fetchKolFeed({ token: "M1", limit: 50 });
    expect(rows).toHaveLength(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain("/api/ogdex/kols?feed=1");
    expect(String(fetchMock.mock.calls[0][0])).toContain("token=M1");
  });

  it("fetchKolFeed returns [] when the feed errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("down")));
    await expect(fetchKolFeed({})).resolves.toEqual([]);
  });
});

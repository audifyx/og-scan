/**
 * Tests for web/src/crypto/xintel.ts (W2).
 * Covers normalization, handle merging, availability states, and the
 * fetchXIntel flow with a mocked fetch — including every unavailable path.
 * No live network is used here; the live check is a separate probe script.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  extractTwitterHandle,
  normalizeDexScreenerSocials,
  normalizeGeckoInfo,
  normalizeXUser,
  normalizeXPost,
  normalizeXTweets,
  detectShillSpike,
  accountAgeDays,
  mergeLinkedHandles,
  unavailableIntel,
  fetchXIntel,
  isValidMint,
  evaluateCallerAccuracy,
  auditFromProfile,
  computeSocialVelocity,
  computeMemberGrowth,
  normalizeDexScreenerOtherSocials,
  normalizeGeckoOtherSocials,
  mergeOtherSocials,
  linkStatusFromHttp,
  checkLinkLive,
  extractAmaMentions,
} from "./xintel";

const ORBITX_MINT = "13H4WJvGEg4xrrBwWn2vsQgz7xhmhxgNdw19i1QsxPX9";
const NOW = Date.parse("2026-11-08T06:00:00Z");

/** DexScreener /tokens/v1 shape, trimmed from the live ORBITX response. */
const DEX_ORBITX = [
  {
    chainId: "solana",
    dexId: "pumpswap",
    baseToken: { address: ORBITX_MINT, name: "ORBITX", symbol: "ORBITX" },
    info: {
      websites: [
        { url: "http://orbitx.world", label: "Website" },
        { url: "http://orbitx.world/whitepaper", label: "Whitepaper" },
      ],
      socials: [
        { url: "https://x.com/orbitx_wrld", type: "twitter" },
        { url: "https://t.me/orbitxwrld", type: "telegram" },
      ],
    },
  },
];

/** GeckoTerminal /tokens/{mint}/info shape, trimmed from the live response. */
const GECKO_ORBITX = {
  data: {
    id: `solana_${ORBITX_MINT}`,
    type: "token",
    attributes: {
      address: ORBITX_MINT,
      name: "ORBITX",
      symbol: "ORBITX",
      twitter_handle: "orbitx_wrld",
      telegram_handle: "OrbitXupdates",
    },
  },
};

const X_USER_ORBITX = {
  id: "123456789",
  username: "orbitx_wrld",
  name: "OrbitX",
  description: "Trading ecosystem",
  created_at: "2024-01-15T00:00:00.000Z",
  verified: false,
  protected: false,
  profile_image_url: "https://example.com/img.jpg",
  public_metrics: {
    followers_count: 646,
    following_count: 120,
    tweet_count: 900,
    listed_count: 3,
  },
};

/** _xsocial ?include=timeline shape: already-normalized posts. */
const X_TIMELINE_ORBITX = {
  status: "available",
  handle: "orbitx_wrld",
  posts: [
    {
      id: "1850000000000000001",
      text: "gm OrbitX",
      createdAt: "2026-11-07T12:00:00.000Z",
      likeCount: 42,
      repostCount: 5,
      replyCount: 2,
    },
    {
      id: "1850000000000000002",
      text: "ship it",
      createdAt: "2026-11-06T12:00:00.000Z",
      likeCount: null,
      repostCount: null,
      replyCount: null,
    },
  ],
};

/** Raw X API v2 user-tweets shape ({ data: [...] }). */
const X_TWEETS_RAW = {
  data: [
    {
      id: "1850000000000000001",
      text: "gm OrbitX",
      created_at: "2026-11-07T12:00:00.000Z",
      public_metrics: { like_count: 42, retweet_count: 5, reply_count: 2 },
    },
    { id: "bad-no-text" },
  ],
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("isValidMint", () => {
  it("accepts a real Solana mint", () => {
    expect(isValidMint(ORBITX_MINT)).toBe(true);
  });
  it("rejects junk", () => {
    expect(isValidMint("")).toBe(false);
    expect(isValidMint("not-a-mint")).toBe(false);
    expect(isValidMint("0".repeat(44))).toBe(false); // 0 is not base58
  });
});

describe("extractTwitterHandle", () => {
  it.each([
    ["https://x.com/orbitx_wrld", "orbitx_wrld"],
    ["https://twitter.com/orbitx_wrld", "orbitx_wrld"],
    ["https://x.com/orbitx_wrld/status/123", "orbitx_wrld"],
    ["@orbitx_wrld", "orbitx_wrld"],
    ["orbitx_wrld", "orbitx_wrld"],
    ["http://www.x.com/OrbitX_Wrld", "OrbitX_Wrld"],
  ])("extracts %s -> %s", (input, expected) => {
    expect(extractTwitterHandle(input)).toBe(expected);
  });
  it.each([
    ["https://t.me/orbitxwrld", null],
    ["https://x.com/", null],
    ["", null],
    [null, null],
    [42, null],
    ["toolonghandle123456", null],
  ])("rejects %s", (input, expected) => {
    expect(extractTwitterHandle(input)).toBe(expected);
  });
});

describe("normalizeDexScreenerSocials", () => {
  it("finds the twitter social in a live-shaped payload", () => {
    expect(normalizeDexScreenerSocials(DEX_ORBITX)).toEqual({
      handle: "orbitx_wrld",
      url: "https://x.com/orbitx_wrld",
    });
  });
  it("returns null when there is no twitter social", () => {
    expect(
      normalizeDexScreenerSocials([{ info: { socials: [{ url: "https://t.me/x", type: "telegram" }] } }]),
    ).toBeNull();
  });
  it("returns null for empty / malformed payloads", () => {
    expect(normalizeDexScreenerSocials([])).toBeNull();
    expect(normalizeDexScreenerSocials(null)).toBeNull();
    expect(normalizeDexScreenerSocials({})).toBeNull();
    expect(normalizeDexScreenerSocials("nope")).toBeNull();
  });
});

describe("normalizeGeckoInfo", () => {
  it("reads twitter_handle from a live-shaped payload", () => {
    expect(normalizeGeckoInfo(GECKO_ORBITX)).toEqual({
      handle: "orbitx_wrld",
      url: "https://x.com/orbitx_wrld",
    });
  });
  it("returns null when twitter_handle is absent", () => {
    expect(normalizeGeckoInfo({ data: { attributes: { twitter_handle: null } } })).toBeNull();
    expect(normalizeGeckoInfo({ data: { attributes: {} } })).toBeNull();
    expect(normalizeGeckoInfo(null)).toBeNull();
  });
});

describe("normalizeXUser", () => {
  it("normalizes a full X API v2 user", () => {
    const p = normalizeXUser(X_USER_ORBITX, NOW);
    expect(p).toMatchObject({
      handle: "orbitx_wrld",
      name: "OrbitX",
      followers: 646,
      following: 120,
      tweetCount: 900,
      verified: false,
    });
    expect(p?.accountAgeDays).toBeGreaterThan(600);
    expect(p?.createdAt).toBe("2024-01-15T00:00:00.000Z");
  });
  it("never invents a count — missing metrics stay null", () => {
    const p = normalizeXUser({ username: "someone" }, NOW);
    expect(p).toMatchObject({ handle: "someone", followers: null, tweetCount: null, accountAgeDays: null });
  });
  it("returns null for unusable payloads", () => {
    expect(normalizeXUser(null)).toBeNull();
    expect(normalizeXUser({})).toBeNull();
    expect(normalizeXUser({ username: "" })).toBeNull();
  });
});

describe("normalizeXPost / normalizeXTweets", () => {
  it("normalizes a raw X API v2 tweet", () => {
    expect(normalizeXPost(X_TWEETS_RAW.data[0])).toEqual({
      id: "1850000000000000001",
      text: "gm OrbitX",
      createdAt: "2026-11-07T12:00:00.000Z",
      likeCount: 42,
      repostCount: 5,
      replyCount: 2,
    });
  });
  it("normalizes an already-normalized _xsocial post", () => {
    expect(normalizeXPost(X_TIMELINE_ORBITX.posts[1])).toMatchObject({
      id: "1850000000000000002",
      text: "ship it",
      likeCount: null,
    });
  });
  it("never invents counts — missing metrics stay null", () => {
    expect(normalizeXPost({ id: "9", text: "hi" })).toMatchObject({
      id: "9",
      likeCount: null,
      repostCount: null,
      replyCount: null,
      createdAt: null,
    });
  });
  it("returns null for unusable entries", () => {
    expect(normalizeXPost(null)).toBeNull();
    expect(normalizeXPost({})).toBeNull();
    expect(normalizeXPost({ id: "1" })).toBeNull(); // no text
    expect(normalizeXPost({ text: "no id" })).toBeNull();
  });
  it("normalizeXTweets accepts a bare array and a { data } payload", () => {
    expect(normalizeXTweets(X_TIMELINE_ORBITX.posts)?.length).toBe(2);
    expect(normalizeXTweets(X_TWEETS_RAW)?.length).toBe(1); // bad entry dropped
    expect(normalizeXTweets({ data: [] })).toEqual([]); // empty is a real state
    expect(normalizeXTweets(null)).toBeNull();
    expect(normalizeXTweets({})).toBeNull();
  });
});

describe("detectShillSpike", () => {
  function series(hours: number[], counts: number[]) {
    return hours.flatMap((h, i) =>
      Array.from({ length: counts[i] }, (_, j) => ({
        t: `2026-11-08T${String(h).padStart(2, "0")}:${String(j % 60).padStart(2, "0")}:00Z`,
        mentions: 1,
      })),
    );
  }
  it("flags a spike when one hour dwarfs the baseline", () => {
    const s = detectShillSpike(series([0, 1, 2, 3, 4], [2, 3, 2, 30, 2]));
    expect(s).not.toBeNull();
    expect(s?.spike).toBe(true);
    expect(s?.peakPerHour).toBe(30);
    expect(s?.baselinePerHour).toBe(2);
    expect(s?.spikeRatio).toBe(15);
    expect(s?.windowHours).toBe(5);
    expect(s?.peakHour).toContain("2026-11-08T03");
  });
  it("no spike when mentions are flat", () => {
    const s = detectShillSpike(series([0, 1, 2, 3], [5, 5, 5, 5]));
    expect(s?.spike).toBe(false);
    expect(s?.spikeRatio).toBe(1);
  });
  it("no spike when the peak is below the minimum mentions", () => {
    const s = detectShillSpike(series([0, 1, 2], [1, 1, 8]));
    expect(s?.spike).toBe(false); // ratio 8x but only 8 mentions in the peak hour
    expect(s?.peakPerHour).toBe(8);
  });
  it("returns null when the series cannot support a verdict", () => {
    expect(detectShillSpike([])).toBeNull();
    expect(detectShillSpike(series([0], [50]))).toBeNull(); // single hour
    expect(detectShillSpike(series([0, 1], [0, 0]))).toBeNull(); // zero mentions
    expect(detectShillSpike([{ t: "garbage", mentions: 5 }])).toBeNull();
  });
  it("ignores negative / non-numeric samples instead of crashing", () => {
    const s = detectShillSpike([
      { t: "2026-11-08T00:00:00Z", mentions: 2 },
      { t: "2026-11-08T01:00:00Z", mentions: -5 },
      { t: "2026-11-08T02:00:00Z", mentions: 3 },
    ]);
    expect(s?.windowHours).toBe(2);
  });
});

describe("evaluateCallerAccuracy", () => {
  it("scores bullish calls right when the later price is higher", () => {
    const out = evaluateCallerAccuracy([
      { handle: "alice", calledAt: "2026-11-01T00:00:00Z", priceAtCallUsd: 1, priceLaterUsd: 2 },
      { handle: "alice", calledAt: "2026-11-02T00:00:00Z", priceAtCallUsd: 2, priceLaterUsd: 1 },
      { handle: "Bob", calledAt: "2026-11-01T00:00:00Z", priceAtCallUsd: 1, priceLaterUsd: 1.5 },
    ]);
    expect(out).toHaveLength(2);
    expect(out.find((r) => r.handle === "alice")).toMatchObject({
      callsTracked: 2,
      correctCalls: 1,
      accuracyPct: 50,
    });
    expect(out.find((r) => r.handle === "Bob")).toMatchObject({
      callsTracked: 1,
      correctCalls: 1,
      accuracyPct: 100,
    });
  });
  it("scores bearish calls the other way round", () => {
    const out = evaluateCallerAccuracy([
      { handle: "bear", calledAt: "2026-11-01T00:00:00Z", priceAtCallUsd: 2, priceLaterUsd: 1, direction: "bearish" },
      { handle: "bear", calledAt: "2026-11-02T00:00:00Z", priceAtCallUsd: 1, priceLaterUsd: 2, direction: "bearish" },
    ]);
    expect(out[0]).toMatchObject({ callsTracked: 2, correctCalls: 1, accuracyPct: 50 });
  });
  it("groups handles case-insensitively and skips invalid entries", () => {
    const out = evaluateCallerAccuracy([
      { handle: "Alice", calledAt: "2026-11-01T00:00:00Z", priceAtCallUsd: 1, priceLaterUsd: 2 },
      { handle: "alice", calledAt: "2026-11-02T00:00:00Z", priceAtCallUsd: 1, priceLaterUsd: 2 },
      { handle: "", calledAt: "2026-11-01T00:00:00Z", priceAtCallUsd: 1, priceLaterUsd: 2 },
      { handle: "bad", calledAt: "not-a-date", priceAtCallUsd: 1, priceLaterUsd: 2 },
      { handle: "zero", calledAt: "2026-11-01T00:00:00Z", priceAtCallUsd: 0, priceLaterUsd: 2 },
      { handle: "nan", calledAt: "2026-11-01T00:00:00Z", priceAtCallUsd: NaN, priceLaterUsd: 2 },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ handle: "Alice", callsTracked: 2, correctCalls: 2 });
  });
  it("returns [] for no usable calls", () => {
    expect(evaluateCallerAccuracy([])).toEqual([]);
    expect(evaluateCallerAccuracy(null as never)).toEqual([]);
  });
});

describe("auditFromProfile", () => {
  it("maps age/verified from the profile and never invents a bot %", () => {
    const a = auditFromProfile({
      handle: "orbitx_wrld",
      createdAt: "2024-01-15T00:00:00.000Z",
      accountAgeDays: 663,
      verified: false,
      protected: false,
      followers: 646,
      following: 120,
      tweetCount: 900,
    });
    expect(a).toMatchObject({
      handle: "orbitx_wrld",
      accountAgeDays: 663,
      verified: false,
      followers: 646,
    });
    expect(a.botFollowerPct).toBeNull();
    expect(a.botFollowerNote).toContain("Never estimated");
  });
});

describe("computeSocialVelocity", () => {
  it("computes hour-over-hour growth", () => {
    const v = computeSocialVelocity([
      { hour: "2026-11-08T00:15:00Z", mentions: 10 },
      { hour: "2026-11-08T01:30:00Z", mentions: 15 },
    ]);
    expect(v).toMatchObject({
      latestMentions: 15,
      previousMentions: 10,
      growthPct: 50,
      windowHours: 2,
    });
    expect(v?.latestHour).toContain("2026-11-08T01");
  });
  it("growth is null when the previous hour had 0 mentions — never Infinity", () => {
    const v = computeSocialVelocity([
      { hour: "2026-11-08T00:00:00Z", mentions: 0 },
      { hour: "2026-11-08T01:00:00Z", mentions: 5 },
    ]);
    expect(v?.growthPct).toBeNull();
    expect(v?.latestMentions).toBe(5);
  });
  it("returns null when the series cannot support a verdict", () => {
    expect(computeSocialVelocity([])).toBeNull();
    expect(computeSocialVelocity([{ hour: "2026-11-08T00:00:00Z", mentions: 50 }])).toBeNull();
    expect(computeSocialVelocity([{ hour: "garbage", mentions: 5 }])).toBeNull();
  });
  it("buckets samples into hours before comparing", () => {
    const v = computeSocialVelocity([
      { hour: "2026-11-08T00:10:00Z", mentions: 4 },
      { hour: "2026-11-08T00:50:00Z", mentions: 6 },
      { hour: "2026-11-08T01:05:00Z", mentions: 5 },
    ]);
    expect(v).toMatchObject({ previousMentions: 10, latestMentions: 5, growthPct: -50 });
  });
});

describe("computeMemberGrowth", () => {
  it("computes growth between two real snapshots", () => {
    expect(computeMemberGrowth(100, 125)).toBe(25);
    expect(computeMemberGrowth(200, 150)).toBe(-25);
    expect(computeMemberGrowth(100, 100)).toBe(0);
  });
  it("returns null without two usable snapshots", () => {
    expect(computeMemberGrowth(null, 125)).toBeNull();
    expect(computeMemberGrowth(100, null)).toBeNull();
    expect(computeMemberGrowth(0, 125)).toBeNull(); // no divisor
    expect(computeMemberGrowth(-5, 125)).toBeNull();
  });
});

describe("normalizeDexScreenerOtherSocials / normalizeGeckoOtherSocials / mergeOtherSocials", () => {
  it("dex: picks non-twitter socials + websites, skips twitter", () => {
    const out = normalizeDexScreenerOtherSocials(DEX_ORBITX);
    expect(out).toEqual([
      { kind: "telegram", label: "telegram", url: "https://t.me/orbitxwrld" },
      { kind: "website", label: "Website", url: "http://orbitx.world" },
      { kind: "website", label: "Whitepaper", url: "http://orbitx.world/whitepaper" },
    ]);
  });
  it("dex: returns [] when nothing non-X is listed, null when unusable", () => {
    expect(normalizeDexScreenerOtherSocials([{ info: { socials: [{ url: "https://x.com/a", type: "twitter" }] } }])).toEqual([]);
    expect(normalizeDexScreenerOtherSocials(null)).toBeNull();
    expect(normalizeDexScreenerOtherSocials({})).toBeNull();
  });
  it("gecko: telegram_handle -> t.me URL, discord null skipped", () => {
    const out = normalizeGeckoOtherSocials(GECKO_ORBITX);
    expect(out).toEqual([{ kind: "telegram", label: "@OrbitXupdates", url: "https://t.me/OrbitXupdates" }]);
  });
  it("gecko: invalid telegram handle and non-http discord are skipped", () => {
    expect(
      normalizeGeckoOtherSocials({ data: { attributes: { telegram_handle: "ab", discord_url: "not-a-url" } } }),
    ).toEqual([]);
    expect(normalizeGeckoOtherSocials(null)).toBeNull();
  });
  it("merge: same URL from both sources agrees; different telegram handles conflict", () => {
    const merged = mergeOtherSocials(normalizeDexScreenerOtherSocials(DEX_ORBITX), normalizeGeckoOtherSocials(GECKO_ORBITX));
    expect(merged.links).toHaveLength(4);
    expect(merged.links.filter((l) => l.kind === "telegram")).toHaveLength(2);
    expect(merged.note).toContain("disagree");
    expect(merged.note).toContain("t.me/orbitxwrld");
    expect(merged.note).toContain("t.me/OrbitXupdates");
  });
  it("merge: one URL listed by both sources agrees with both sources named", () => {
    const merged = mergeOtherSocials(
      [{ kind: "telegram", label: "telegram", url: "https://t.me/shared" }],
      [{ kind: "telegram", label: "@shared", url: "https://t.me/shared" }],
    );
    expect(merged.links).toHaveLength(1);
    expect(merged.links[0].agreement).toBe("agree");
    expect(merged.links[0].sources).toEqual(["dexscreener", "geckoterminal"]);
    expect(merged.note).toBeUndefined();
  });
  it("merge: null inputs give no links", () => {
    expect(mergeOtherSocials(null, null).links).toEqual([]);
  });
});

describe("linkStatusFromHttp / checkLinkLive", () => {
  it("classifies HTTP statuses honestly", () => {
    expect(linkStatusFromHttp(200)).toBe("reachable");
    expect(linkStatusFromHttp(301)).toBe("reachable");
    expect(linkStatusFromHttp(404)).toBe("dead");
    expect(linkStatusFromHttp(410)).toBe("dead");
    expect(linkStatusFromHttp(500)).toBe("unknown");
    expect(linkStatusFromHttp(null)).toBe("unknown");
  });
  it("checkLinkLive maps a fetch result, never throws", async () => {
    const ok = await checkLinkLive(async () => new Response("", { status: 200 }), "https://example.com");
    expect(ok).toEqual({ liveStatus: "reachable", httpStatus: 200 });
    const dead = await checkLinkLive(async () => new Response("", { status: 404 }), "https://example.com");
    expect(dead).toEqual({ liveStatus: "dead", httpStatus: 404 });
    const failed = await checkLinkLive(async () => {
      throw new Error("blocked");
    }, "https://example.com");
    expect(failed).toEqual({ liveStatus: "unknown", httpStatus: null });
  });
});

describe("extractAmaMentions", () => {
  const posts = [
    { id: "1", text: "Join our AMA Friday 6pm", createdAt: "2026-11-07T12:00:00.000Z" },
    { id: "2", text: "gm OrbitX" },
    { id: "3", text: "We are live on Spaces now", createdAt: null },
    { id: "4", text: "there is space in the market for us" },
    { id: "5", text: "x space with the team tonight" },
  ];
  it("finds AMA/Space mentions and only those", () => {
    const out = extractAmaMentions(posts);
    expect(out.map((m) => m.tweetId)).toEqual(["1", "3", "5"]);
    expect(out[0]).toMatchObject({ tweetId: "1", text: "Join our AMA Friday 6pm" });
  });
  it("returns [] for no mentions and for bad input", () => {
    expect(extractAmaMentions([{ id: "9", text: "gm" }])).toEqual([]);
    expect(extractAmaMentions([])).toEqual([]);
    expect(extractAmaMentions(null as never)).toEqual([]);
  });
});

describe("accountAgeDays", () => {
  it("computes whole days", () => {
    expect(accountAgeDays("2026-11-07T06:00:00Z", NOW)).toBe(1);
    expect(accountAgeDays("2026-11-08T05:00:00Z", NOW)).toBe(0);
  });
  it("returns null for missing / bad input", () => {
    expect(accountAgeDays(null)).toBeNull();
    expect(accountAgeDays("not-a-date")).toBeNull();
  });
});

describe("mergeLinkedHandles", () => {
  const t = "2026-11-08T06:00:00.000Z";
  it("agrees when both sources name the same handle", () => {
    const s = mergeLinkedHandles(
      { handle: "orbitx_wrld", url: "https://x.com/orbitx_wrld" },
      { handle: "orbitx_wrld", url: "https://x.com/orbitx_wrld" },
      t,
    );
    expect(s.status).toBe("available");
    expect(s.value?.agreement).toBe("agree");
    expect(s.value?.sources).toEqual(["dexscreener", "geckoterminal"]);
  });
  it("flags conflict and keeps the DexScreener handle", () => {
    const s = mergeLinkedHandles(
      { handle: "aaa", url: "https://x.com/aaa" },
      { handle: "bbb", url: "https://x.com/bbb" },
      t,
    );
    expect(s.status).toBe("available");
    expect(s.value?.agreement).toBe("conflict");
    expect(s.value?.handle).toBe("aaa");
    expect(s.value?.note).toContain("@bbb");
  });
  it("is single-source when only one source reports", () => {
    const s = mergeLinkedHandles(null, { handle: "orbitx_wrld", url: "https://x.com/orbitx_wrld" }, t);
    expect(s.value?.agreement).toBe("single");
    expect(s.value?.sources).toEqual(["geckoterminal"]);
  });
  it("is unavailable with a reason when neither source reports", () => {
    const s = mergeLinkedHandles(null, null, t);
    expect(s.status).toBe("unavailable");
    expect(s.reason).toBe("no_twitter_link");
    expect(s.value).toBeUndefined();
  });
});

describe("unavailableIntel", () => {
  it("marks every signal unavailable, never zero", () => {
    const intel = unavailableIntel(ORBITX_MINT, "all_sources_failed", "both upstreams down");
    expect(intel.linkedAccount.status).toBe("unavailable");
    expect(intel.profile.status).toBe("unavailable");
    expect(intel.mentions.status).toBe("unavailable");
    expect(intel.kolActivity.status).toBe("unavailable");
    expect(intel.kolTracking.status).toBe("unavailable");
    expect(intel.devPosts.status).toBe("unavailable");
    expect(intel.shillSpike.status).toBe("unavailable");
    expect(intel.shillSpike.reason).toBe("no_mention_time_series");
    expect(intel.sentiment.status).toBe("unavailable");
    // Batches 2-5: structural signals keep their own reasons.
    expect(intel.callerRecords.status).toBe("unavailable");
    expect(intel.callerRecords.reason).toBe("no_caller_source");
    expect(intel.accountAudit.status).toBe("unavailable");
    expect(intel.socialVelocity.status).toBe("unavailable");
    expect(intel.socialVelocity.reason).toBe("no_mention_source");
    expect(intel.devOtherSocials.status).toBe("unavailable");
    expect(intel.communitySentiment.status).toBe("unavailable");
    expect(intel.communitySentiment.reason).toBe("no_community_source");
    expect(intel.devAmaTracker.status).toBe("unavailable");
    expect(JSON.stringify(intel)).not.toContain('"followers":0');
  });
});

describe("fetchXIntel (mocked fetch)", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function routeMock(dex: unknown, gecko: unknown, proxy?: unknown, proxyStatus = 200) {
    fetchMock.mockImplementation((url: string) => {
      if (String(url).includes("dexscreener")) {
        return dex instanceof Error ? Promise.reject(dex) : Promise.resolve(jsonResponse(dex));
      }
      if (String(url).includes("geckoterminal")) {
        return gecko instanceof Error ? Promise.reject(gecko) : Promise.resolve(jsonResponse(gecko));
      }
      // Absolute http(s) URLs here are devOtherSocials liveness checks
      // (t.me / orbitx.world) — the proxy URL is a relative /api/web path.
      if (/^https?:\/\//.test(String(url))) {
        return Promise.resolve(new Response("", { status: 200 }));
      }
      if (proxy === undefined) return Promise.resolve(new Response("Not found", { status: 404 }));
      return Promise.resolve(jsonResponse(proxy, proxyStatus));
    });
  }

  it("full path: linked handle agrees, proxy enriches profile + timeline", async () => {
    routeMock(DEX_ORBITX, GECKO_ORBITX, {
      ok: true,
      status: "available",
      source: "x_api_v2",
      profile: X_USER_ORBITX,
      timeline: X_TIMELINE_ORBITX,
    });
    const intel = await fetchXIntel(ORBITX_MINT, { nowMs: NOW });
    expect(intel.symbol).toBe("ORBITX");
    expect(intel.linkedAccount.status).toBe("available");
    expect(intel.linkedAccount.value?.handle).toBe("orbitx_wrld");
    expect(intel.linkedAccount.value?.agreement).toBe("agree");
    expect(intel.profile.status).toBe("available");
    expect(intel.profile.value?.followers).toBe(646);
    // KOL tracking: the linked account only, from the same profile call.
    expect(intel.kolTracking.status).toBe("available");
    expect(intel.kolTracking.value?.accounts).toHaveLength(1);
    expect(intel.kolTracking.value?.accounts[0]).toMatchObject({
      handle: "orbitx_wrld",
      followers: 646,
      tweetCount: 900,
    });
    expect(intel.kolTracking.value?.accounts[0].accountAgeDays).toBeGreaterThan(600);
    // Dev posts: the timeline from the same proxy call.
    expect(intel.devPosts.status).toBe("available");
    expect(intel.devPosts.value?.handle).toBe("orbitx_wrld");
    expect(intel.devPosts.value?.posts).toHaveLength(2);
    expect(intel.devPosts.value?.posts[0]).toMatchObject({ id: "1850000000000000001", likeCount: 42 });
    // The proxy was asked for the timeline.
    expect(fetchMock.mock.calls.some((c: unknown[]) => String(c[0]).includes("include=timeline"))).toBe(true);
    // Shill spike is ALWAYS unavailable — no mention time series exists.
    expect(intel.shillSpike.status).toBe("unavailable");
    expect(intel.shillSpike.reason).toBe("no_mention_time_series");
    // Mentions / KOL activity / sentiment are ALWAYS unavailable — no real source.
    expect(intel.mentions.status).toBe("unavailable");
    expect(intel.mentions.reason).toBe("no_search_source");
    expect(intel.kolActivity.reason).toBe("no_kol_source");
    expect(intel.sentiment.reason).toBe("no_text_source");
    // Batch 2: caller records are ALWAYS unavailable — no search source.
    expect(intel.callerRecords.status).toBe("unavailable");
    expect(intel.callerRecords.reason).toBe("no_caller_source");
    // Batch 3: account audit derives from the profile; bot % is always null.
    expect(intel.accountAudit.status).toBe("available");
    expect(intel.accountAudit.value).toMatchObject({ handle: "orbitx_wrld", followers: 646, verified: false });
    expect(intel.accountAudit.value?.accountAgeDays).toBeGreaterThan(600);
    expect(intel.accountAudit.value?.botFollowerPct).toBeNull();
    // Batch 4: social velocity ALWAYS unavailable; other socials are
    // available from DexScreener + GeckoTerminal (live-shaped fixtures).
    expect(intel.socialVelocity.status).toBe("unavailable");
    expect(intel.socialVelocity.reason).toBe("no_mention_source");
    expect(intel.devOtherSocials.status).toBe("available");
    expect(intel.devOtherSocials.value?.links).toHaveLength(4);
    expect(intel.devOtherSocials.value?.links.filter((l) => l.kind === "telegram")).toHaveLength(2);
    expect(intel.devOtherSocials.value?.note).toContain("disagree");
    expect(intel.devOtherSocials.value?.links.every((l) => l.liveStatus === "reachable")).toBe(true);
    // Batch 5: community sentiment ALWAYS unavailable; AMA tracker
    // derives from devPosts (no AMA mention in these two tweets).
    expect(intel.communitySentiment.status).toBe("unavailable");
    expect(intel.communitySentiment.reason).toBe("no_community_source");
    expect(intel.devAmaTracker.status).toBe("available");
    expect(intel.devAmaTracker.value?.handle).toBe("orbitx_wrld");
    expect(intel.devAmaTracker.value?.amaMentions).toEqual([]);
    expect(intel.devAmaTracker.value?.identityStatus).toBe("unverifiable");
    expect(intel.devAmaTracker.value?.promisesStatus).toBe("unverifiable");
  });

  it("timeline fails on its own (403) while the profile still succeeds", async () => {
    routeMock(DEX_ORBITX, GECKO_ORBITX, {
      ok: true,
      status: "available",
      source: "x_api_v2",
      profile: X_USER_ORBITX,
      timeline: {
        status: "unavailable",
        reason: "forbidden",
        detail: "X API returned 403 for the timeline lookup.",
      },
    });
    const intel = await fetchXIntel(ORBITX_MINT, { nowMs: NOW });
    expect(intel.profile.status).toBe("available");
    expect(intel.kolTracking.status).toBe("available");
    expect(intel.devPosts.status).toBe("unavailable");
    expect(intel.devPosts.reason).toBe("forbidden");
    expect(intel.accountAudit.status).toBe("available"); // audit follows the profile, not the timeline
    expect(intel.devAmaTracker.status).toBe("unavailable");
    expect(intel.devAmaTracker.reason).toBe("forbidden");
    expect(intel.callerRecords.reason).toBe("no_caller_source");
    expect(intel.socialVelocity.reason).toBe("no_mention_source");
    expect(intel.communitySentiment.reason).toBe("no_community_source");
  });

  it("timeline mentions an AMA -> devAmaTracker lists it", async () => {
    routeMock(DEX_ORBITX, GECKO_ORBITX, {
      ok: true,
      status: "available",
      source: "x_api_v2",
      profile: X_USER_ORBITX,
      timeline: {
        status: "available",
        handle: "orbitx_wrld",
        posts: [
          { id: "1", text: "Join our AMA Friday", createdAt: "2026-11-07T12:00:00.000Z" },
          { id: "2", text: "gm" },
        ],
      },
    });
    const intel = await fetchXIntel(ORBITX_MINT, { nowMs: NOW });
    expect(intel.devPosts.status).toBe("available");
    expect(intel.devAmaTracker.status).toBe("available");
    expect(intel.devAmaTracker.value?.amaMentions).toHaveLength(1);
    expect(intel.devAmaTracker.value?.amaMentions[0]).toMatchObject({ tweetId: "1" });
    // Identity/promises are still unverifiable even with an AMA mention.
    expect(intel.devAmaTracker.value?.identityStatus).toBe("unverifiable");
    expect(intel.devAmaTracker.value?.promisesStatus).toBe("unverifiable");
  });

  it("dead + unreachable links are reported honestly, never as alive", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (String(url).includes("dexscreener")) return Promise.resolve(jsonResponse(DEX_ORBITX));
      if (String(url).includes("geckoterminal")) return Promise.resolve(jsonResponse(GECKO_ORBITX));
      if (String(url).includes("xsocial")) {
        return Promise.resolve(
          jsonResponse({ ok: true, status: "available", profile: X_USER_ORBITX, timeline: X_TIMELINE_ORBITX }),
        );
      }
      if (String(url).includes("t.me/orbitxwrld")) {
        return Promise.resolve(new Response("", { status: 404 }));
      }
      if (String(url).includes("whitepaper")) {
        return Promise.reject(new Error("blocked"));
      }
      return Promise.resolve(new Response("", { status: 200 }));
    });
    const intel = await fetchXIntel(ORBITX_MINT, { nowMs: NOW });
    expect(intel.devOtherSocials.status).toBe("available");
    const byUrl = new Map(intel.devOtherSocials.value?.links.map((l) => [l.url, l]));
    expect(byUrl.get("https://t.me/orbitxwrld")?.liveStatus).toBe("dead");
    expect(byUrl.get("https://t.me/orbitxwrld")?.httpStatus).toBe(404);
    expect(byUrl.get("http://orbitx.world/whitepaper")?.liveStatus).toBe("unknown");
    expect(byUrl.get("http://orbitx.world")?.liveStatus).toBe("reachable");
  });

  it("proxy without a timeline field -> devPosts proxy_error, profile still fine", async () => {
    routeMock(DEX_ORBITX, GECKO_ORBITX, {
      ok: true,
      status: "available",
      source: "x_api_v2",
      profile: X_USER_ORBITX,
    });
    const intel = await fetchXIntel(ORBITX_MINT, { nowMs: NOW });
    expect(intel.profile.status).toBe("available");
    expect(intel.devPosts.status).toBe("unavailable");
    expect(intel.devPosts.reason).toBe("proxy_error");
    expect(intel.devAmaTracker.status).toBe("unavailable");
    expect(intel.devAmaTracker.reason).toBe("proxy_error");
  });

  it("proxy missing (404) -> profile unavailable, linked handle still available", async () => {
    routeMock(DEX_ORBITX, GECKO_ORBITX, undefined);
    const intel = await fetchXIntel(ORBITX_MINT, { nowMs: NOW });
    expect(intel.linkedAccount.status).toBe("available");
    expect(intel.profile.status).toBe("unavailable");
    expect(intel.profile.reason).toBe("proxy_not_configured");
    expect(intel.accountAudit.status).toBe("unavailable");
    expect(intel.accountAudit.reason).toBe("proxy_not_configured");
    expect(intel.devAmaTracker.status).toBe("unavailable");
    expect(intel.devAmaTracker.reason).toBe("proxy_not_configured");
    // Other socials do NOT need the proxy — still available.
    expect(intel.devOtherSocials.status).toBe("available");
  });

  it("proxy reports no_bearer_token -> profile, KOL tracking and dev posts all unavailable with that reason", async () => {
    routeMock(DEX_ORBITX, GECKO_ORBITX, {
      ok: false,
      status: "unavailable",
      reason: "no_bearer_token",
      detail: "No X app Bearer token is configured.",
      timeline: {
        status: "unavailable",
        reason: "no_bearer_token",
        detail: "The linked account's past posts need the same X Bearer token.",
      },
    });
    const intel = await fetchXIntel(ORBITX_MINT, { nowMs: NOW });
    expect(intel.linkedAccount.value?.handle).toBe("orbitx_wrld");
    expect(intel.profile.status).toBe("unavailable");
    expect(intel.profile.reason).toBe("no_bearer_token");
    expect(intel.kolTracking.status).toBe("unavailable");
    expect(intel.kolTracking.reason).toBe("no_bearer_token");
    expect(intel.kolTracking.detail).toContain("Bearer token");
    expect(intel.devPosts.status).toBe("unavailable");
    expect(intel.devPosts.reason).toBe("no_bearer_token");
    // Shill spike stays unavailable for its own reason, not the bearer's.
    expect(intel.shillSpike.reason).toBe("no_mention_time_series");
    // Batch 2/3/4/5 structural reasons are independent of the bearer.
    expect(intel.callerRecords.reason).toBe("no_caller_source");
    expect(intel.accountAudit.reason).toBe("no_bearer_token");
    expect(intel.socialVelocity.reason).toBe("no_mention_source");
    expect(intel.communitySentiment.reason).toBe("no_community_source");
    expect(intel.devAmaTracker.reason).toBe("no_bearer_token");
    // Other socials are keyless — unaffected by the missing bearer token.
    expect(intel.devOtherSocials.status).toBe("available");
  });

  it("no linked handle anywhere -> profile, KOL tracking and dev posts unavailable too (no_twitter_link)", async () => {
    routeMock([{ info: { socials: [] } }], { data: { attributes: {} } });
    const intel = await fetchXIntel(ORBITX_MINT, { nowMs: NOW });
    expect(intel.linkedAccount.status).toBe("unavailable");
    expect(intel.linkedAccount.reason).toBe("no_twitter_link");
    expect(intel.profile.reason).toBe("no_twitter_link");
    expect(intel.kolTracking.reason).toBe("no_twitter_link");
    expect(intel.devPosts.reason).toBe("no_twitter_link");
    expect(intel.shillSpike.reason).toBe("no_mention_time_series");
    expect(intel.accountAudit.reason).toBe("no_twitter_link");
    expect(intel.devAmaTracker.reason).toBe("no_twitter_link");
    expect(intel.devOtherSocials.status).toBe("unavailable");
    expect(intel.devOtherSocials.reason).toBe("no_other_socials");
    expect(fetchMock.mock.calls.some((c: unknown[]) => String(c[0]).includes("xsocial"))).toBe(false);
  });

  it("both upstreams down -> all_sources_failed, nothing invented", async () => {
    routeMock(new Error("down"), new Error("down"));
    const intel = await fetchXIntel(ORBITX_MINT, { nowMs: NOW });
    expect(intel.linkedAccount.reason).toBe("all_sources_failed");
    expect(intel.profile.status).toBe("unavailable");
    expect(intel.devOtherSocials.reason).toBe("all_sources_failed");
    expect(intel.callerRecords.reason).toBe("no_caller_source");
    expect(intel.socialVelocity.reason).toBe("no_mention_source");
    expect(intel.communitySentiment.reason).toBe("no_community_source");
  });

  it("one upstream down -> the other still serves the handle", async () => {
    routeMock(new Error("down"), GECKO_ORBITX, undefined);
    const intel = await fetchXIntel(ORBITX_MINT, { nowMs: NOW });
    expect(intel.linkedAccount.status).toBe("available");
    expect(intel.linkedAccount.value?.agreement).toBe("single");
    // Other socials from Gecko only: one telegram link, single-source.
    expect(intel.devOtherSocials.status).toBe("available");
    expect(intel.devOtherSocials.value?.links).toHaveLength(1);
    expect(intel.devOtherSocials.value?.links[0]).toMatchObject({
      kind: "telegram",
      url: "https://t.me/OrbitXupdates",
      agreement: "single",
    });
    expect(intel.devOtherSocials.value?.note).toBeUndefined();
  });

  it("invalid mint -> everything unavailable, no fetch attempted", async () => {
    const intel = await fetchXIntel("not-a-mint", { nowMs: NOW });
    expect(intel.linkedAccount.reason).toBe("invalid_mint");
    expect(intel.profile.status).toBe("unavailable");
    expect(intel.callerRecords.reason).toBe("no_caller_source");
    expect(intel.accountAudit.status).toBe("unavailable");
    expect(intel.socialVelocity.reason).toBe("no_mention_source");
    expect(intel.devOtherSocials.status).toBe("unavailable");
    expect(intel.communitySentiment.reason).toBe("no_community_source");
    expect(intel.devAmaTracker.status).toBe("unavailable");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("proxyUrl null skips the proxy call", async () => {
    routeMock(DEX_ORBITX, GECKO_ORBITX);
    const intel = await fetchXIntel(ORBITX_MINT, { nowMs: NOW, proxyUrl: null });
    expect(intel.profile.reason).toBe("proxy_not_configured");
    expect(intel.kolTracking.reason).toBe("proxy_not_configured");
    expect(intel.devPosts.reason).toBe("proxy_not_configured");
    expect(intel.accountAudit.reason).toBe("proxy_not_configured");
    expect(intel.devAmaTracker.reason).toBe("proxy_not_configured");
    expect(fetchMock.mock.calls.some((c: unknown[]) => String(c[0]).includes("xsocial"))).toBe(false);
  });
});

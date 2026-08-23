import { describe, expect, it } from "vitest";
import {
  BAGWORKING_DEFAULTS,
  campaignRemaining,
  classifyPost,
  dailyLimitReached,
  defaultFlywheel,
  extractTweetId,
  resolveLaunchKind,
  shouldAttachFlywheel,
  FEE_THRESHOLD_USD,
  feeReady,
  progressToThreshold,
  referencedTweetDisallowed,
  validateFlywheel,
  validateQualifyingText,
} from "./launchpad-v2.js";

describe("resolveLaunchKind — pump.fun-style uses flywheel", () => {
  it("defaults pump launches to flywheel when kind is missing", () => {
    expect(resolveLaunchKind(null, "pump")).toBe("flywheel");
    expect(resolveLaunchKind("", "pump")).toBe("flywheel");
    expect(resolveLaunchKind("standard", "pump")).toBe("flywheel");
  });

  it("keeps bagworking as the campaign kind while still attaching flywheel", () => {
    expect(resolveLaunchKind("bagworking", "pump")).toBe("bagworking");
    expect(shouldAttachFlywheel("bagworking", "pump")).toBe(true);
    expect(shouldAttachFlywheel("flywheel", "pump")).toBe(true);
  });

  it("does not force flywheel on the custom lane unless asked", () => {
    expect(resolveLaunchKind(null, "custom")).toBe("standard");
    expect(resolveLaunchKind("standard", "custom")).toBe("standard");
    expect(shouldAttachFlywheel("standard", "custom")).toBe(false);
    expect(shouldAttachFlywheel("flywheel", "custom")).toBe(true);
  });
});

describe("validateFlywheel", () => {
  it("accepts allocations that sum to 100%", () => {
    expect(validateFlywheel(defaultFlywheel()).ok).toBe(true);
  });

  it("rejects allocations that do not sum to 100%", () => {
    const bad = { ...defaultFlywheel(), community: 50 };
    expect(validateFlywheel(bad).ok).toBe(false);
  });

  it("rejects a single slice over 100%", () => {
    expect(validateFlywheel({ community: 101, buyBurn: 0, creator: 0, rewards: 0 }).ok).toBe(false);
  });
});

describe("extractTweetId", () => {
  it("extracts from x.com and twitter.com status URLs", () => {
    expect(extractTweetId("https://x.com/orbitx/status/1234567890123456789")).toBe("1234567890123456789");
    expect(extractTweetId("https://twitter.com/foo/status/9876543210987654321?s=20")).toBe("9876543210987654321");
  });

  it("accepts a bare tweet id", () => {
    expect(extractTweetId("1234567890123456789")).toBe("1234567890123456789");
  });

  it("rejects junk", () => {
    expect(extractTweetId("not-a-tweet")).toBe("");
    expect(extractTweetId("https://x.com/home")).toBe("");
  });
});

describe("classifyPost", () => {
  it("classifies short vs long by long_min_chars", () => {
    const rules = { min_short_chars: 20, long_min_chars: 140 };
    expect(classifyPost("x".repeat(50), rules)).toBe("short");
    expect(classifyPost("x".repeat(140), rules)).toBe("long");
    expect(classifyPost("tiny", rules)).toBe("too_short");
  });
});

describe("validateQualifyingText", () => {
  it("requires ticker mention", () => {
    const rules = { ...BAGWORKING_DEFAULTS, require_ticker: true, require_ca: false, require_hashtag: false };
    expect(validateQualifyingText("love this $ORBITX launch", { required_ticker: "ORBITX" }, rules).ok).toBe(true);
    expect(validateQualifyingText("love this launch", { required_ticker: "ORBITX" }, rules).ok).toBe(false);
  });

  it("requires contract when configured", () => {
    const mint = "So11111111111111111111111111111111111111112";
    const rules = { ...BAGWORKING_DEFAULTS, require_ticker: false, require_ca: true };
    expect(validateQualifyingText(`check ${mint}`, { mint }, rules).ok).toBe(true);
    expect(validateQualifyingText("no contract here", { mint }, rules).ok).toBe(false);
  });
});

describe("referencedTweetDisallowed", () => {
  it("blocks replies/quotes/reposts when rules say so", () => {
    const rules = { replies_count: false, quotes_count: false, reposts_count: false };
    expect(referencedTweetDisallowed({ referenced_tweets: [{ type: "replied_to" }] }, rules)).toBeTruthy();
    expect(referencedTweetDisallowed({ referenced_tweets: [{ type: "quoted" }] }, rules)).toBeTruthy();
    expect(referencedTweetDisallowed({ referenced_tweets: [{ type: "retweeted" }] }, rules)).toBeTruthy();
    expect(referencedTweetDisallowed({ referenced_tweets: [] }, rules)).toBeNull();
  });
});

describe("dailyLimitReached", () => {
  it("caps at 10 posts per UTC day", () => {
    expect(dailyLimitReached(9)).toBe(false);
    expect(dailyLimitReached(10)).toBe(true);
    expect(dailyLimitReached(11)).toBe(true);
  });
});

describe("campaignRemaining / fee threshold", () => {
  it("stops rewards when budget is exhausted", () => {
    expect(campaignRemaining({ budget_usd: 10, spent_usd: 10 })).toBe(0);
    expect(campaignRemaining({ budget_usd: 10, spent_usd: 7 })).toBe(3);
  });

  it("computes $25 fee threshold progress", () => {
    expect(FEE_THRESHOLD_USD).toBe(25);
    expect(feeReady(24.99)).toBe(false);
    expect(feeReady(25)).toBe(true);
    expect(progressToThreshold(18.42).current).toBeCloseTo(18.42);
    expect(progressToThreshold(40).current).toBe(40);
    expect(progressToThreshold(40).ready).toBe(true);
  });
});

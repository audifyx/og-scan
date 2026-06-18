import { describe, it, expect } from "vitest";
import { buildTweet, buildXShareUrl, buildScanCard, buildTelegramAlert, shouldAutoPost, normalizeHandle } from "./social";
import type { OgClassification } from "./classification";

const result: OgClassification = {
  tier: "OG_TOKEN", tierLabel: "OG TOKEN", confidence: 88, riskScore: 12,
  rationale: "Verified originality with low risk.",
  signals: [{ id: "first_mint", label: "First known deployment", direction: "positive", weight: 35, detail: "Earliest instance." }],
  dataCompleteness: 80,
};

describe("social distribution", () => {
  it("builds a tweet with verdict, CA and attribution", () => {
    const t = buildTweet({ mint: "So111111111111111111111111111111111111111x", symbol: "OG", handle: "alex", result });
    expect(t).toContain("$OG");
    expect(t).toContain("@alex");
    expect(t).toContain("OG TOKEN");
    expect(t).toContain("88%");
  });
  it("builds an encoded X intent url", () => {
    const u = buildXShareUrl({ mint: "abc", symbol: "OG", result });
    expect(u).toContain("twitter.com/intent/tweet");
    expect(u).toContain("text=");
  });
  it("builds a scan card payload with top signals", () => {
    const c = buildScanCard({ mint: "abcd1234efgh5678", symbol: "OG", handle: "@alex", result });
    expect(c.tierLabel).toBe("OG TOKEN");
    expect(c.attribution).toBe("@alex");
    expect(c.topSignals.length).toBeGreaterThan(0);
  });
  it("auto-posts OG tokens and velocity spikes", () => {
    expect(shouldAutoPost({ tier: "OG_TOKEN" }).trigger).toBe("og_identified");
    expect(shouldAutoPost({ tier: "SAFE_CLONE", velocity: 80 }).trigger).toBe("velocity_spike");
    expect(shouldAutoPost({ tier: "SAFE_CLONE", velocity: 10 }).post).toBe(false);
  });
  it("formats telegram alerts", () => {
    expect(buildTelegramAlert("og_identified", { mint: "abc", symbol: "OG", result })).toContain("OG IDENTIFIED");
  });
  it("normalizes handles", () => {
    expect(normalizeHandle("@Alex!")).toBe("Alex");
    expect(normalizeHandle("  ")).toBeNull();
  });
});

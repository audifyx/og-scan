import { beforeEach, describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { clearStatsIdentity, getStatsIdentity, setStatsIdentity, STATS_UID_KEY } from "./statsIdentity";

describe("statsIdentity", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("stores the first 32 hex chars of SHA-256('orbitx-stats:' + userId)", async () => {
    await setStatsIdentity("user-123");
    const expected = createHash("sha256").update("orbitx-stats:user-123").digest("hex").slice(0, 32);
    expect(localStorage.getItem(STATS_UID_KEY)).toBe(expected);
    expect(getStatsIdentity()).toBe(expected);
  });

  it("is deterministic and differs per user", async () => {
    await setStatsIdentity("user-123");
    const first = localStorage.getItem(STATS_UID_KEY);
    await setStatsIdentity("user-123");
    expect(localStorage.getItem(STATS_UID_KEY)).toBe(first);
    await setStatsIdentity("user-456");
    expect(localStorage.getItem(STATS_UID_KEY)).not.toBe(first);
  });

  it("never stores the raw user ID", async () => {
    await setStatsIdentity("secret-user-id-999");
    const stored = localStorage.getItem(STATS_UID_KEY) ?? "";
    expect(stored).not.toContain("secret-user-id-999");
    expect(stored).toMatch(/^[0-9a-f]{32}$/);
  });

  it("clearStatsIdentity removes it", async () => {
    await setStatsIdentity("user-123");
    expect(getStatsIdentity()).not.toBeNull();
    clearStatsIdentity();
    expect(getStatsIdentity()).toBeNull();
  });

  it("ignores an empty user id", async () => {
    await setStatsIdentity("");
    expect(getStatsIdentity()).toBeNull();
  });
});

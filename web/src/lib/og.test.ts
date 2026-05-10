import { afterEach, describe, expect, it, vi } from "vitest";
import { jupOgCopycats, type JupTokenInfo } from "./og";

const daysAgoIso = (days: number): string => new Date(Date.now() - days * 86_400_000).toISOString();

const makeToken = (overrides: Partial<JupTokenInfo>): JupTokenInfo => ({
  id: "token-default",
  name: "WOJAK",
  symbol: "WOJAK",
  decimals: 6,
  liquidity: 0,
  holderCount: 0,
  isVerified: false,
  firstPool: { createdAt: daysAgoIso(1) },
  audit: {
    mintAuthorityDisabled: true,
    freezeAuthorityDisabled: true,
    topHoldersPercentage: 20,
  },
  ...overrides,
});

describe("jupOgCopycats", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uses the oldest dated token as the original before ranking copycats by trust", async () => {
    const newerTrusted = makeToken({
      id: "newer-trusted-token",
      liquidity: 5_000_000,
      holderCount: 25_000,
      organicScore: 8,
      isVerified: true,
      firstPool: { createdAt: daysAgoIso(188) },
    });
    const olderLowTrust = makeToken({
      id: "older-low-trust-token",
      liquidity: 95_000,
      holderCount: 5_000,
      isVerified: false,
      firstPool: { createdAt: daysAgoIso(699) },
    });

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => [newerTrusted, olderLowTrust],
      }))
    );

    const result = await jupOgCopycats("WOJAK");

    expect(result.og?.id).toBe("older-low-trust-token");
    expect(result.copycats.map((token: JupTokenInfo) => token.id)).toContain("newer-trusted-token");
  });
});

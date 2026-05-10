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
  onChainCreatedAt: daysAgoIso(1),
  creationSource: "chain",
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

  it("uses the oldest on-chain mint date as the original, regardless of price or trust", async () => {
    const newerTrusted = makeToken({
      id: "newer-trusted-token",
      liquidity: 5_000_000,
      holderCount: 25_000,
      organicScore: 8,
      isVerified: true,
      firstPool: { createdAt: daysAgoIso(650) },
      onChainCreatedAt: daysAgoIso(188),
    });
    const olderLowTrust = makeToken({
      id: "older-low-trust-token",
      liquidity: 95,
      holderCount: 5,
      isVerified: false,
      firstPool: { createdAt: daysAgoIso(2) },
      onChainCreatedAt: daysAgoIso(699),
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

  it("does not treat an older migrated pool as OG when the mint was created later", async () => {
    const olderMigratedPool = makeToken({
      id: "older-migrated-pool-token",
      firstPool: { createdAt: daysAgoIso(800) },
      onChainCreatedAt: daysAgoIso(20),
    });
    const originalMint = makeToken({
      id: "original-mint-token",
      firstPool: { createdAt: daysAgoIso(3) },
      onChainCreatedAt: daysAgoIso(200),
    });

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => [olderMigratedPool, originalMint],
      }))
    );

    const result = await jupOgCopycats("WOJAK");

    expect(result.og?.id).toBe("original-mint-token");
    expect(result.copycats.map((token: JupTokenInfo) => token.id)).toContain("older-migrated-pool-token");
  });
});

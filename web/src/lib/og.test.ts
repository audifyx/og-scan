import { afterEach, describe, expect, it, vi } from "vitest";
import { FARTCOIN_CANONICAL_MINT, USDC_MINT, forensicOgAttribution, hasPulledOrDeadLiquidity, jupOgCopycats, type JupTokenInfo } from "./og";

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

  it("excludes dead low-liquidity contracts before choosing the original", async () => {
    const newerLiquid = makeToken({
      id: "newer-liquid-token",
      liquidity: 5_000_000,
      holderCount: 25_000,
      organicScore: 8,
      isVerified: true,
      firstPool: { createdAt: daysAgoIso(650) },
      onChainCreatedAt: daysAgoIso(188),
    });
    const olderDeadFake = makeToken({
      id: "older-dead-fake-token",
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
        json: async () => [newerLiquid, olderDeadFake],
      }))
    );

    const result = await jupOgCopycats("WOJAK");

    expect(result.og?.id).toBe("newer-liquid-token");
    expect(result.copycats.map((token: JupTokenInfo) => token.id)).not.toContain("older-dead-fake-token");
  });

  it("blocks unsafe scam copies from being crowned or shown as OG candidates", async () => {
    const originalFartcoin = makeToken({
      id: "real-fartcoin-origin",
      name: "$Fartcoin",
      symbol: "FARTCOIN",
      liquidity: 7_230_000,
      holderCount: 120_000,
      organicScore: 9,
      isVerified: true,
      firstPool: { createdAt: "2024-10-18T00:00:00.000Z" },
      onChainCreatedAt: undefined,
      audit: {
        mintAuthorityDisabled: true,
        freezeAuthorityDisabled: true,
        topHoldersPercentage: 18,
      },
    });
    const scamCornCopy = makeToken({
      id: "scam-corn-copy",
      name: "$FARTCOIN",
      symbol: "FARTCOIN",
      liquidity: 1_170_000_000,
      holderCount: 5,
      isVerified: false,
      firstPool: { createdAt: "2025-01-14T00:00:00.000Z" },
      onChainCreatedAt: "2025-01-14T00:00:00.000Z",
      audit: {
        mintAuthorityDisabled: false,
        freezeAuthorityDisabled: false,
        topHoldersPercentage: 72,
      },
    });

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => [scamCornCopy, originalFartcoin],
      }))
    );

    const report = await forensicOgAttribution("FARTCOIN");

    expect(report.og?.id).toBe("real-fartcoin-origin");
    expect(report.candidates.map((token: JupTokenInfo) => token.id)).not.toContain("scam-corn-copy");
    expect(report.tokenScores["solana:real-fartcoin-origin"]?.classification.primary_label).toBe("TRUE OG");
  });

  it("selects the canonical Solana Fartcoin pump mint as OG over scam/cross-chain copies", async () => {
    const canonicalFartcoin = makeToken({
      id: FARTCOIN_CANONICAL_MINT,
      chainId: "solana",
      name: "Fartcoin",
      symbol: "FARTCOIN",
      liquidity: 7_230_000,
      holderCount: 120_000,
      organicScore: 9,
      isVerified: true,
      firstPool: { createdAt: "2024-10-18T00:00:00.000Z" },
      onChainCreatedAt: undefined,
      audit: {
        mintAuthorityDisabled: true,
        freezeAuthorityDisabled: true,
        topHoldersPercentage: 18,
      },
    });
    const scamCornCopy = makeToken({
      id: "scam-corn-copy",
      chainId: "solana",
      name: "$FARTCOIN CORN",
      symbol: "FARTCOIN",
      liquidity: 1_170_000_000,
      holderCount: 12,
      isVerified: false,
      firstPool: { createdAt: "2023-01-14T00:00:00.000Z" },
      onChainCreatedAt: "2023-01-14T00:00:00.000Z",
      audit: {
        mintAuthorityDisabled: false,
        freezeAuthorityDisabled: false,
        topHoldersPercentage: 88,
      },
    });
    const ethereumCopy = makeToken({
      id: "0xnot-solana-fartcoin",
      chainId: "ethereum",
      name: "Fartcoin",
      symbol: "FARTCOIN",
      liquidity: 9_000_000,
      firstPool: { createdAt: "2022-01-01T00:00:00.000Z" },
      onChainCreatedAt: "2022-01-01T00:00:00.000Z",
    });

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/latest/dex/search")) {
          return {
            ok: true,
            json: async () => ({
              pairs: [
                {
                  chainId: "ethereum",
                  baseToken: { address: "0xnot-solana-fartcoin", name: "Fartcoin", symbol: "FARTCOIN" },
                  liquidity: { usd: 9_000_000 },
                  pairCreatedAt: 1640995200000,
                },
              ],
            }),
          };
        }
        if (url.includes("/tokens/v1/solana/")) {
          return { ok: true, json: async () => [] };
        }
        return { ok: true, json: async () => [scamCornCopy, ethereumCopy, canonicalFartcoin] };
      })
    );

    const report = await forensicOgAttribution("FARTCOIN");

    expect(report.og?.id).toBe(FARTCOIN_CANONICAL_MINT);
    expect(report.summary.chainCount).toBe(1);
    expect(report.candidates.map((token: JupTokenInfo) => token.id)).not.toContain("0xnot-solana-fartcoin");
    expect(report.candidates.map((token: JupTokenInfo) => token.id)).not.toContain("scam-corn-copy");
    expect(report.tokenScores[`solana:${FARTCOIN_CANONICAL_MINT}`]?.classification.primary_label).toBe("TRUE OG");
  });

  it("blocks LP-pulled tokens with inflated reported liquidity from TRUE OG selection", async () => {
    const lpPulledScam = makeToken({
      id: "5sNU6g1qVji5dEBnb6SWSX2Gu2rtDvvk7khKyujj6cuU",
      name: "MAGA (magamemecoin.com)",
      symbol: "TRUMP",
      liquidity: 122_064_005,
      mcap: 123_183_921,
      fdv: 123_183_921,
      holderCount: 10,
      isVerified: false,
      firstPool: { createdAt: "2025-01-10T11:15:36.000Z" },
      onChainCreatedAt: "2024-01-01T00:00:00.000Z",
      audit: {
        mintAuthorityDisabled: true,
        freezeAuthorityDisabled: true,
        topHoldersPercentage: 72,
      },
    });
    const firstCredibleTrump = makeToken({
      id: "first-credible-trump",
      name: "Trump",
      symbol: "TRUMP",
      liquidity: 25_000,
      holderCount: 1_400,
      isVerified: false,
      firstPool: { createdAt: "2024-02-01T00:00:00.000Z" },
      onChainCreatedAt: "2024-02-01T00:00:00.000Z",
      audit: {
        mintAuthorityDisabled: true,
        freezeAuthorityDisabled: true,
        topHoldersPercentage: 24,
      },
    });

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/latest/dex/search")) {
          return {
            ok: true,
            json: async () => ({
              pairs: [
                {
                  chainId: "solana",
                  dexId: "raydium",
                  url: "https://dexscreener.com/solana/lp-pulled-pair",
                  pairAddress: "lp-pulled-pair",
                  baseToken: { address: "5sNU6g1qVji5dEBnb6SWSX2Gu2rtDvvk7khKyujj6cuU", name: "MAGA (magamemecoin.com)", symbol: "TRUMP" },
                  quoteToken: { address: USDC_MINT, name: "USD Coin", symbol: "USDC" },
                  liquidity: { usd: 122_064_005.84, base: 43_597_358, quote: 3.2588 },
                  marketCap: 123_183_921,
                  fdv: 123_183_921,
                  volume: { h24: 3.99 },
                  txns: { h24: { buys: 1, sells: 1 } },
                  pairCreatedAt: 1736498136000,
                },
              ],
            }),
          };
        }
        if (url.includes("/tokens/v1/solana/")) {
          return {
            ok: true,
            json: async () => [
              {
                chainId: "solana",
                dexId: "raydium",
                url: "https://dexscreener.com/solana/lp-pulled-pair",
                pairAddress: "lp-pulled-pair",
                baseToken: { address: "5sNU6g1qVji5dEBnb6SWSX2Gu2rtDvvk7khKyujj6cuU", name: "MAGA (magamemecoin.com)", symbol: "TRUMP" },
                quoteToken: { address: USDC_MINT, name: "USD Coin", symbol: "USDC" },
                liquidity: { usd: 122_064_005.84, base: 43_597_358, quote: 3.2588 },
                marketCap: 123_183_921,
                fdv: 123_183_921,
                volume: { h24: 3.99 },
                txns: { h24: { buys: 1, sells: 1 } },
                pairCreatedAt: 1736498136000,
              },
            ],
          };
        }
        if (url.includes("/orders/v1/")) return { ok: true, json: async () => [] };
        if (url.includes("/token-boosts/")) return { ok: true, json: async () => [] };
        if (url.includes("/defi/token_overview") || url.includes("/defi/ohlcv")) return { ok: false, json: async () => ({}) };
        return { ok: true, json: async () => [lpPulledScam, firstCredibleTrump] };
      })
    );

    const report = await forensicOgAttribution("TRUMP");

    expect(hasPulledOrDeadLiquidity({ ...lpPulledScam, effectiveLiquidityUsd: 6.5176, quoteLiquidityUsd: 3.2588, reportedLiquidity: 122_064_005.84 })).toBe(true);
    expect(report.og?.id).toBe("first-credible-trump");
    expect(report.candidates.map((token: JupTokenInfo) => token.id)).not.toContain("5sNU6g1qVji5dEBnb6SWSX2Gu2rtDvvk7khKyujj6cuU");
  });

  it("does not treat an older migrated pool as OG when the mint was created later", async () => {
    const olderMigratedPool = makeToken({
      id: "older-migrated-pool-token",
      liquidity: 3_500,
      firstPool: { createdAt: daysAgoIso(800) },
      onChainCreatedAt: daysAgoIso(20),
    });
    const originalMint = makeToken({
      id: "original-mint-token",
      liquidity: 8_000,
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

  it("labels the original contract under community control as TRUE OG CTO instead of REVIVAL", async () => {
    const trueOgCto = makeToken({
      id: "true-og-cto-token",
      liquidity: 120_000,
      holderCount: 12_000,
      organicScore: 10,
      ctLikes: 240,
      smartCtLikes: 80,
      dexUrl: "https://dexscreener.com/solana/true-og-cto-token",
      stats24h: { numBuys: 1_200, numSells: 900, numTraders: 1_800 },
      firstPool: { createdAt: daysAgoIso(1) },
      onChainCreatedAt: daysAgoIso(800),
      audit: {
        mintAuthorityDisabled: true,
        freezeAuthorityDisabled: true,
        topHoldersPercentage: 62,
      },
    });
    const laterRecreated = makeToken({
      id: "later-recreated-token",
      liquidity: 2_000_000,
      holderCount: 50_000,
      organicScore: 9,
      isVerified: true,
      firstPool: { createdAt: daysAgoIso(20) },
      onChainCreatedAt: daysAgoIso(20),
    });

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => [laterRecreated, trueOgCto],
      }))
    );

    const report = await forensicOgAttribution("WOJAK");
    const score = report.tokenScores["solana:true-og-cto-token"];

    expect(report.og?.id).toBe("true-og-cto-token");
    expect(score.classification.primary_label).toBe("TRUE OG CTO");
    expect(score.classification.secondary_labels).toContain("Original Contract");
    expect(score.classification.secondary_labels).toContain("Community Takeover");
    expect(score.classification.secondary_labels).toContain("Same CA Continued");
  });

  it("uses REVIVAL only for a later new contract that restarts an older narrative", async () => {
    const original = makeToken({
      id: "original-narrative-token",
      firstPool: { createdAt: daysAgoIso(700) },
      onChainCreatedAt: daysAgoIso(700),
      liquidity: 14_000,
      holderCount: 1_000,
      isVerified: true,
    });
    const revival = makeToken({
      id: "later-revival-token",
      firstPool: { createdAt: daysAgoIso(30) },
      onChainCreatedAt: daysAgoIso(30),
      liquidity: 900_000,
      holderCount: 30_000,
      organicScore: 10,
      isVerified: false,
      stats24h: { numBuys: 900, numSells: 850, numTraders: 1_000 },
    });

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => [revival, original],
      }))
    );

    const report = await forensicOgAttribution("WOJAK");
    const revivalScore = report.tokenScores["solana:later-revival-token"];

    expect(report.og?.id).toBe("original-narrative-token");
    expect(revivalScore.classification.primary_label).toBe("REVIVAL");
    expect(revivalScore.classification.secondary_labels).toContain("New Contract");
    expect(revivalScore.classification.secondary_labels).toContain("Recreated Narrative");
  });

  it("keeps the first credible Trump mint as OG while labeling a later verified official token separately", async () => {
    const firstTrumpMint = makeToken({
      id: "first-trump-mint",
      name: "Trump",
      symbol: "TRUMP",
      firstPool: { createdAt: "2024-02-01T00:00:00.000Z" },
      onChainCreatedAt: "2024-02-01T00:00:00.000Z",
      liquidity: 25_000,
      holderCount: 1_400,
      isVerified: false,
      organicScore: 6,
    });
    const laterOfficialTrump = makeToken({
      id: "later-official-trump",
      name: "Official Trump",
      symbol: "TRUMP",
      firstPool: { createdAt: "2025-01-18T00:00:00.000Z" },
      onChainCreatedAt: "2025-01-18T00:00:00.000Z",
      liquidity: 125_000_000,
      holderCount: 720_000,
      isVerified: true,
      organicScore: 10,
      dexProfilePaid: true,
      dexUrl: "https://dexscreener.com/solana/later-official-trump",
      stats24h: { numBuys: 35_000, numSells: 30_000, numTraders: 80_000 },
    });

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => [laterOfficialTrump, firstTrumpMint],
      }))
    );

    const report = await forensicOgAttribution("TRUMP");
    const officialScore = report.tokenScores["solana:later-official-trump"];

    expect(report.og?.id).toBe("first-trump-mint");
    expect(report.tokenScores["solana:first-trump-mint"]?.classification.primary_label).toBe("TRUE OG");
    expect(officialScore.classification.primary_label).toBe("LATER OFFICIAL");
    expect(officialScore.reasons.join(" ")).toContain("Official/verified status is detected");
    expect(officialScore.warnings.join(" ")).toContain("Official does not mean OG");
  });

  it("keeps a first YE narrative mint as OG even when a later Kanye-linked token is verified", async () => {
    const firstYeMint = makeToken({
      id: "first-ye-mint",
      name: "Ye",
      symbol: "YE",
      firstPool: { createdAt: "2023-08-12T00:00:00.000Z" },
      onChainCreatedAt: "2023-08-12T00:00:00.000Z",
      liquidity: 12_500,
      holderCount: 900,
      isVerified: false,
      organicScore: 5,
    });
    const laterOfficialYe = makeToken({
      id: "later-official-ye",
      name: "Kanye West Ye",
      symbol: "YE",
      firstPool: { createdAt: "2026-02-01T00:00:00.000Z" },
      onChainCreatedAt: "2026-02-01T00:00:00.000Z",
      liquidity: 8_500_000,
      holderCount: 110_000,
      isVerified: true,
      dexProfilePaid: true,
      dexUrl: "https://dexscreener.com/solana/later-official-ye",
      stats24h: { numBuys: 9_500, numSells: 8_200, numTraders: 22_000 },
    });

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => [laterOfficialYe, firstYeMint],
      }))
    );

    const report = await forensicOgAttribution("YE");

    expect(report.og?.id).toBe("first-ye-mint");
    expect(report.tokenScores["solana:first-ye-mint"]?.classification.primary_label).toBe("TRUE OG");
    expect(report.tokenScores["solana:later-official-ye"]?.classification.primary_label).toBe("LATER OFFICIAL");
    expect(report.familyTree.find((node) => node.token.id === "later-official-ye")?.relationship).toBe("later official");
  });
});

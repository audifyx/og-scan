import { describe, expect, it } from "vitest";
import { extractMintFromText, parseIntelIntent, stripGmgnPrefix } from "./full-report-parse.js";
import {
  assertNeverCleanIfUntraced,
  bundledZeroAllowed,
  classifyWalletExit,
  clusterReport,
  computeVerdict,
  DISCLAIMER,
  formatBundleLine,
  TRACE_INCOMPLETE,
} from "./full-report-verdict.js";
import { formatFullReportMarkdown } from "./full-report-markdown.js";
import { runFullReport } from "./full-report.js";

const CA = "13H4WJvGEg4xrrBwWn2vsQgz7xhmhxgNdw19i1QsxPX9";

describe("full-report parse", () => {
  it("strips GMGN prefixes", () => {
    expect(stripGmgnPrefix(`M5SopoUM_${CA}`)).toBe(CA);
    expect(extractMintFromText(`M5SopoUM_${CA}`)).toBe(CA);
    expect(extractMintFromText(`https://gmgn.ai/sol/token/M5SopoUM_${CA}`)).toBe(CA);
    expect(extractMintFromText(`https://dexscreener.com/solana/${CA}`)).toBe(CA);
    expect(extractMintFromText(`https://pump.fun/${CA}`)).toBe(CA);
    expect(extractMintFromText(`https://solscan.io/token/${CA}`)).toBe(CA);
    expect(extractMintFromText(CA)).toBe(CA);
  });

  it("parses intent", () => {
    expect(parseIntelIntent("quick xray")).toMatchObject({ depth: "quick" });
    expect(parseIntelIntent("full report pdf")).toMatchObject({ pdf: true, full: true });
  });
});

describe("cluster language", () => {
  it("does not say 0% bundled when untraced and empty", () => {
    const c = clusterReport({ pct: 0, count: 0, clusters: [], traced: false, kind: "bundled" });
    expect(c.display).toBe(TRACE_INCOMPLETE);
    expect(c.pct).toBeNull();
    expect(formatBundleLine(c)).toBe(TRACE_INCOMPLETE);
    expect(formatBundleLine(c)).not.toMatch(/0% bundled/i);
    expect(bundledZeroAllowed(c)).toBe(false);
  });

  it("allows 0% only when traced and pct is 0", () => {
    const c = clusterReport({ pct: 0, count: 0, clusters: [], traced: true, kind: "bundled" });
    expect(c.pct).toBe(0);
    expect(c.traced).toBe(true);
    expect(formatBundleLine(c)).toMatch(/0%/);
    expect(bundledZeroAllowed(c)).toBe(true);
  });
});

describe("verdict", () => {
  it("never outputs CLEAN when traced is false", () => {
    const v = computeVerdict({
      tokenOk: true,
      traced: false,
      canSell: true,
      authoritiesOff: true,
      lpLocked: true,
      bundlePct: 0,
      devKnown: true,
      devDumped: false,
    });
    expect(v.verdict).not.toBe("CLEAN");
    expect(assertNeverCleanIfUntraced("CLEAN", false)).toBe("CAUTION");
  });

  it("returns CLEAN only when traced 0% bundle + authorities off + LP locked + known dev", () => {
    const v = computeVerdict({
      tokenOk: true,
      traced: true,
      canSell: true,
      authoritiesOff: true,
      mintOpen: false,
      freezeOpen: false,
      lpLocked: true,
      lpUnlocked: false,
      bundlePct: 0,
      insiderPct: 0,
      devKnown: true,
      devDumped: false,
      silentDev: false,
    });
    expect(v.verdict).toBe("CLEAN");
  });

  it("AVOID when cannot sell", () => {
    const v = computeVerdict({ tokenOk: true, traced: true, canSell: false });
    expect(v.verdict).toBe("AVOID");
  });

  it("HIGH RISK when traced bundle > 20%", () => {
    const v = computeVerdict({
      tokenOk: true,
      traced: true,
      canSell: true,
      authoritiesOff: true,
      bundlePct: 35,
    });
    expect(v.verdict).toBe("HIGH RISK");
  });
});

describe("wallet exit labels", () => {
  it("classifies holding and exits", () => {
    expect(classifyWalletExit({ remaining: 10, soldSol: 0 })).toBe("STILL HOLDING");
    expect(classifyWalletExit({ remaining: 5, soldSol: 1 })).toBe("PARTIAL EXIT");
    expect(classifyWalletExit({ remaining: 0, soldSol: 1, realizedUsd: 20 })).toBe("EXITED PROFIT");
    expect(classifyWalletExit({ remaining: 0, sells: 2, realizedUsd: -4 })).toBe("EXITED LOSS");
  });
});

describe("markdown dossier", () => {
  it("ends with the desk disclaimer and never invents 0% untraced bundles", () => {
    const md = formatFullReportMarkdown({
      cover: { name: "Demo", ticker: "DEMO", ca: CA, verdict: "CAUTION", confidence: "low", age: "2h" },
      bundles: clusterReport({ traced: false, kind: "bundled" }),
      snipers: clusterReport({ traced: false, kind: "snipers" }),
      insiders: clusterReport({ traced: false, kind: "insiders" }),
      whatYouShouldKnow: ["One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight"],
      sources: ["xray: PARTIAL"],
      gaps: ["Early-buyer xray not traced."],
    });
    expect(md).toContain(DISCLAIMER);
    expect(md).toContain(TRACE_INCOMPLETE);
    expect(md).not.toMatch(/0% bundled/i);
    expect(md.endsWith(DISCLAIMER)).toBe(true);
  });
});

describe("runFullReport", () => {
  it("composes a dossier from in-process mocks without inventing bundle zeros", async () => {
    const invoke = async (_handler, path) => {
      const p = String(path);
      if (p.includes("/token")) {
        return {
          status: 200,
          body: {
            mint: CA,
            token: {
              name: "OrbitX",
              symbol: "ORBITX",
              priceUsd: 0.01,
              mcap: 100000,
              fdv: 120000,
              liquidity: 20000,
              holderCount: 80,
              volume: 5000,
              change5m: 1,
              change1h: 2,
              change6h: 3,
              change24h: 4,
              createdAt: new Date(Date.now() - 3600e3 * 10).toISOString(),
            },
            pairs: [{ dex: "raydium", address: "pair", liquidity: 20000 }],
          },
        };
      }
      if (p.includes("/metadata")) {
        return { status: 200, body: { ok: true, mint: CA, symbol: "ORBITX", isToken2022: false, updateAuthority: null } };
      }
      if (p.includes("/ath")) {
        return { status: 200, body: { athPrice: 0.02, athMcap: 200000, source: "geckoterminal" } };
      }
      if (p.includes("/xray")) {
        return {
          status: 200,
          body: {
            traced: false,
            bundles: { pct: null, count: null, clusters: [] },
            snipers: { pct: null, count: null, wallets: [] },
            insiders: { pct: null, count: null, clusters: [] },
            concentration: { top10Pct: 12, whales: 2, totalHolders: 80 },
            safety: { mintRenounced: true, freezeRenounced: true, lpLockedPct: 100 },
            dev: { wallet: "Dev111111111111111111111111111111111111111", pct: 1, sold: false, serial: false },
          },
        };
      }
      if (p.includes("/forensics")) {
        return {
          status: 200,
          body: {
            ok: true,
            dev: { wallet: "Dev111111111111111111111111111111111111111", sold: false, tokensCreated: 1 },
            dexPaid: { paid: false },
            launchpad: "pump.fun",
            firstBuyer: { traced: false },
            safetyFlags: { mintRenounced: true, freezeRenounced: true, lpLockedPct: 100 },
          },
        };
      }
      if (p.includes("/safety")) {
        return { status: 200, body: { ok: true, canBuy: true, canSell: true, roundTripLossPct: 2.5 } };
      }
      if (p.includes("/chart")) {
        return { status: 200, body: { ok: true, candles: [{ time: 1, open: 1, high: 2, low: 0.5, close: 1 }] } };
      }
      if (p.includes("/research")) {
        return { status: 200, body: { ok: true, meta: { name: "OrbitX", symbol: "ORBITX" }, social: { twitter: { posts: [] } } } };
      }
      return { status: 200, body: { ok: true } };
    };

    const d = await runFullReport(
      { mint: `M5SopoUM_${CA}`, depth: "quick", includeWallets: false, format: "json" },
      { invoke },
    );
    expect(d.ok).toBe(true);
    expect(d.cover.ca).toBe(CA);
    expect(d.cover.verdict).not.toBe("CLEAN");
    expect(d.traced).toBe(false);
    expect(d.bundles.display).toBe(TRACE_INCOMPLETE);
    expect(d.markdown).toContain(DISCLAIMER);
    expect(d.markdown).not.toMatch(/0% bundled/i);
    expect(d.whatYouShouldKnow.length).toBeGreaterThanOrEqual(8);
  });
});

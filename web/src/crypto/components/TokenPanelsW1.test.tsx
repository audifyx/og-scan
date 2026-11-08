import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  ChartPatternPanel,
  DevWalletAgePanel,
  ExitLiquidityPanel,
  HolderConvictionPanel,
  HolderOverlapPanel,
  RugCheckPanel,
  SameDevPanel,
  SocialScanPanel,
  Token2022Panel,
  TokenDnaPanel,
  WashTradingPanel,
  WhaleLabelsPanel,
} from "./TokenPanels";

/** W1 — panel↔hook wiring: every panel renders real data when its hook
 *  output is present, and an honest Unavailable (never a fake value, never
 *  a stale "not landed yet") when it is absent. */

const WALLET_A = "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU";
const WALLET_B = "9xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsV";
const OTHER_MINT = "So11111111111111111111111111111111111111112";

describe("W1 holder overlap", () => {
  it("renders the graph from real holder-overlap entries", () => {
    render(
      <HolderOverlapPanel
        token={{ holders: [{ owner: WALLET_A, pct: 5 }, { owner: WALLET_B, pct: 3 }] }}
        holderOverlap={[
          { wallet: WALLET_A, otherHoldings: [{ mint: OTHER_MINT, symbol: "SOL", pctOfWallet: 40 }] },
          { wallet: WALLET_B, otherHoldings: [{ mint: OTHER_MINT, symbol: "SOL", pctOfWallet: 10 }] },
        ]}
      />,
    );
    expect(screen.getByText("Holder overlap")).toBeTruthy();
    expect(screen.getByText("SOL")).toBeTruthy();
    expect(screen.queryByText(/not wired/)).toBeNull();
  });
  it("is honestly unavailable when the feed returned nothing", () => {
    render(<HolderOverlapPanel token={{ holders: [{ owner: WALLET_A, pct: 5 }] }} holderOverlap={null} />);
    expect(screen.getByText(/returned nothing for this scan/)).toBeTruthy();
  });
});

describe("W1 wash trading", () => {
  it("renders the detector verdict and round-trip pairs", () => {
    render(
      <WashTradingPanel
        dexPairs={[{ txnsH24Buys: 100, txnsH24Sells: 90, volumeH24: 50000, liquidityUsd: 10000 }]}
        washTrading={{ score: 60, pairs: [{ a: WALLET_A, b: WALLET_A, roundTrips: 3, volumeUsd: 12000 }], verdict: "strong wash pattern — most tape volume is round-trips" }}
        tapeLoaded
      />,
    );
    expect(screen.getByText(/strong wash pattern/)).toBeTruthy();
    expect(screen.getByText("60/100")).toBeTruthy();
    expect(screen.getByText(/3 round-trips/)).toBeTruthy();
  });
  it("renders 'no wash pattern observed' on a clean tape", () => {
    render(
      <WashTradingPanel
        dexPairs={[{ txnsH24Buys: 10, txnsH24Sells: 2, volumeH24: 1000, liquidityUsd: 10000 }]}
        washTrading={{ score: 0, pairs: [], verdict: "no wash pattern observed" }}
        tapeLoaded
      />,
    );
    expect(screen.getByText("no wash pattern observed")).toBeTruthy();
  });
  it("says the tape is not loaded yet instead of guessing", () => {
    render(
      <WashTradingPanel
        dexPairs={[{ txnsH24Buys: 10, txnsH24Sells: 2, volumeH24: 1000, liquidityUsd: 10000 }]}
        washTrading={{ score: 0, pairs: [], verdict: "no wash pattern observed" }}
        tapeLoaded={false}
      />,
    );
    expect(screen.getByText(/Trade tape not loaded yet/)).toBeTruthy();
  });
});

describe("W1 chart patterns", () => {
  it("renders detected patterns from real daily candles", () => {
    render(
      <ChartPatternPanel
        dexPairs={[{ changeM5: 1, changeH1: 2, changeH6: 3, changeH24: 5 }]}
        chartPatterns={[{ type: "hammer", detectedAt: Date.now(), confidence: "high", detail: "Long lower shadow with a small body near the high — buyers stepped in below." }]}
      />,
    );
    expect(screen.getByText("hammer")).toBeTruthy();
    expect(screen.getByText(/buyers stepped in below/)).toBeTruthy();
  });
  it("is honest when no pattern fired", () => {
    render(
      <ChartPatternPanel
        dexPairs={[{ changeM5: 1, changeH1: 2, changeH6: 3, changeH24: 5 }]}
        chartPatterns={[]}
      />,
    );
    expect(screen.getByText(/No pattern fired/)).toBeTruthy();
  });
});

describe("W1 exit liquidity", () => {
  it("renders real Jupiter sims and drop thresholds, with no stale claim", () => {
    render(
      <ExitLiquidityPanel
        token={{ priceUsd: 0.01, marketCap: 1000000 }}
        dexPairs={[{ liquidityUsd: 100000 }]}
        exitLiquidity={{
          sell1Sol: { receivedUsd: 98, slippagePct: 2 },
          sell5Sol: null,
          sell10PctSupply: { receivedUsd: 80000, slippagePct: 20 },
          drop10PctUsd: 5000,
          drop25PctUsd: 15000,
          drop50PctUsd: 50000,
          model: "live Jupiter lite-api quotes",
          reason: null,
        }}
      />,
    );
    expect(screen.getByText(/\$98\.00/)).toBeTruthy();
    expect(screen.getByText(/\$80\.0K/)).toBeTruthy();
    expect(screen.getByText("$5.0K")).toBeTruthy();
    expect(screen.queryByText(/no Jupiter quote feed wired/)).toBeNull();
  });
});

describe("W1 Token-2022", () => {
  it("renders program id, extensions and the transfer-hook drain check", () => {
    render(
      <Token2022Panel
        token={null}
        token2022Extensions={{
          isToken2022: true,
          extensions: [
            { name: "transferHook", risk: "medium", detail: "Token-2022 extension present on the mint account" },
            { name: "transferFeeConfig", risk: "medium", detail: "Token-2022 extension present on the mint account — transfers can be taxed up to the configured fee" },
          ],
          reason: null,
        }}
      />,
    );
    expect(screen.getAllByText("Token-2022").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("transferHook")).toBeTruthy();
    expect(screen.getByText("Transfer-hook drain check")).toBeTruthy();
    expect(screen.getByText("Transfer fee")).toBeTruthy();
  });
  it("says standard SPL when the program is Tokenkeg", () => {
    render(
      <Token2022Panel
        token={null}
        token2022Extensions={{ isToken2022: false, extensions: [], reason: "standard SPL Token program (Tokenkeg) — no Token-2022 extensions apply" }}
      />,
    );
    expect(screen.getByText("Standard SPL Token")).toBeTruthy();
  });
  it("is honestly unavailable when the mint account is unreadable", () => {
    render(<Token2022Panel token={null} token2022Extensions={null} />);
    expect(screen.getByText(/Mint account unreadable/)).toBeTruthy();
  });
});

describe("W1 dev wallet age", () => {
  it("renders real wallet ages from the server walk", () => {
    render(
      <DevWalletAgePanel
        forensics={{ dev: { wallet: WALLET_A } }}
        token={{ ageDays: 2 }}
        walletAges={[
          { wallet: WALLET_A, firstSeenAt: Date.now() - 120 * 86_400_000, ageDays: 120, label: "aged" },
          { wallet: WALLET_B, firstSeenAt: Date.now() - 3600_000, ageDays: 0, label: "fresh" },
        ]}
      />,
    );
    expect(screen.getAllByText("4 months old").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Aged").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/lower bound on wallet age/)).toBeTruthy();
  });
  it("is honestly unknown when no ages returned", () => {
    render(<DevWalletAgePanel forensics={{ dev: { wallet: WALLET_A } }} token={{ ageDays: 2 }} walletAges={null} />);
    expect(screen.getByText(/No wallet ages returned/)).toBeTruthy();
  });
});

describe("W1 holder conviction", () => {
  it("renders mean hold days and diamond/paper splits", () => {
    const now = Date.now();
    render(
      <HolderConvictionPanel
        dexPairs={[{ txnsH24Buys: 50, txnsH24Sells: 40, changeH24: 3 }]}
        token={{ holders: [{ owner: WALLET_A, pct: 5 }] }}
        holderConviction={{
          avgHoldDays: 45,
          holders: [
            { wallet: WALLET_A, firstBuyAt: now - 45 * 86_400_000, holdDays: 45, label: "diamond" },
            { wallet: WALLET_B, firstBuyAt: now - 5 * 86_400_000, holdDays: 5, label: "paper" },
          ],
        }}
      />,
    );
    expect(screen.getByText("45 days")).toBeTruthy();
    expect(screen.getByText(/Diamond hands/)).toBeTruthy();
    expect(screen.getByText("diamond")).toBeTruthy();
    expect(screen.getByText("paper")).toBeTruthy();
  });
});

describe("W1 whale labels", () => {
  it("renders evidence-only labels with provenance", () => {
    render(
      <WhaleLabelsPanel
        token={{ holders: [{ owner: WALLET_A, pct: 5 }] }}
        forensics={null}
        whaleLabels={[{ wallet: WALLET_A, labels: ["whale", "sniper"] }]}
      />,
    );
    expect(screen.getByText("whale")).toBeTruthy();
    expect(screen.getByText("sniper")).toBeTruthy();
    expect(screen.getByText(/first buy within 60s of pair creation/)).toBeTruthy();
  });
  it("says none met the evidence bar when the list is empty", () => {
    render(
      <WhaleLabelsPanel
        token={{ holders: [{ owner: WALLET_A, pct: 0.5 }] }}
        forensics={null}
        whaleLabels={[]}
      />,
    );
    expect(screen.getByText(/None met the evidence bar/)).toBeTruthy();
  });
});

describe("W1 token DNA", () => {
  it("renders template matches from the builder", () => {
    render(
      <TokenDnaPanel
        token={{ name: "Test", symbol: "TEST" }}
        research={{ clones: [] }}
        mint={OTHER_MINT}
        tokenDna={{
          templateMatches: [
            { template: "pump.fun standard launch", matchPct: 100, evidence: ["Launched on pump.fun"] },
            { template: "bundle-heavy launch", matchPct: 40, evidence: ["12% of supply in coordinated clusters"] },
          ],
          verdict: "pump.fun standard launch",
        }}
      />,
    );
    expect(screen.getAllByText("pump.fun standard launch").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/100% match/)).toBeTruthy();
    expect(screen.getByText(/Launched on pump\.fun/)).toBeTruthy();
  });
  it("reports insufficient data when no template scored", () => {
    render(
      <TokenDnaPanel
        token={{ name: "Test", symbol: "TEST" }}
        research={{ clones: [] }}
        mint={OTHER_MINT}
        tokenDna={{ templateMatches: [], verdict: "insufficient data" }}
      />,
    );
    expect(screen.getByText("insufficient data")).toBeTruthy();
  });
});

describe("W1 RugCheck chain", () => {
  it("gives the honest reason when the deep-intel fetch returned nothing", () => {
    render(<RugCheckPanel rugCheck={null} />);
    expect(screen.getByText(/deep-intel fetch returned nothing/)).toBeTruthy();
    expect(screen.queryByText(/no RugCheck feed is wired/)).toBeNull();
  });
  it("surfaces the server reason and report link when no score came back", () => {
    render(
      <RugCheckPanel
        rugCheck={{ score: null, warnings: [], reportUrl: `https://rugcheck.xyz/tokens/${OTHER_MINT}`, source: "rugcheck", reason: "RugCheck API unreachable or returned no report" }}
      />,
    );
    expect(screen.getByText(/RugCheck API unreachable/)).toBeTruthy();
    expect(screen.getByText("Full RugCheck report")).toBeTruthy();
  });
  it("renders a live score and warnings", () => {
    render(
      <RugCheckPanel
        rugCheck={{ score: 85, warnings: ["Mint authority — mint authority is enabled"], reportUrl: `https://rugcheck.xyz/tokens/${OTHER_MINT}`, source: "rugcheck", reason: null }}
      />,
    );
    expect(screen.getByText("85")).toBeTruthy();
    expect(screen.getByText("High risk")).toBeTruthy();
    expect(screen.getByText(/Mint authority/)).toBeTruthy();
  });
});

describe("W1 stale copy", () => {
  it("SameDevPanel never claims the feed has not landed", () => {
    render(
      <SameDevPanel forensics={{ dev: { serial: true, tokensCreated: 3 } }} sameDev={null} devHistory={null} />,
    );
    expect(screen.queryByText(/has not landed yet/)).toBeNull();
    expect(screen.getByText("Serial deployer")).toBeTruthy();
  });
  it("SocialScanPanel renders notes and voting directly, with no 'not landed' copy", () => {
    render(
      <SocialScanPanel
        mint={OTHER_MINT}
        token={{ name: "Test", symbol: "TEST" }}
        ogScore={{ score: 80, band: "Strong", label: "Strong", categories: [], caps: [], unknowns: [], adjustments: [] }}
      />,
    );
    expect(screen.getByText("Community notes")).toBeTruthy();
    expect(screen.getByText("Community signal")).toBeTruthy();
    expect(screen.queryByText(/has not landed yet/)).toBeNull();
  });
});

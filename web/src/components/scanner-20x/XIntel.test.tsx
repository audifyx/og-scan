/**
 * W3 — XIntel UI completions: other socials, AMA tracker, X account audit,
 * caller track records, social velocity, community sentiment gauge, plus the
 * OgScorePanel TL;DR. Every section renders real data when present and an
 * honest "Unavailable" with its reason when absent — bearer-unset paths
 * included. Nothing here invents a number.
 */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import XIntel from "./XIntel";
import { BOT_FOLLOWER_NOTE, unavailableIntel, type XIntel as XIntelData } from "../../crypto/xintel";
import { OgScorePanel, ogScoreTldr } from "../../crypto/components/TokenPanels";
import type { OgScore } from "../../crypto/hooks/useTokenIntel";

const MINT = "13H4WJvGEg4xrrBwWn2vsQgz7xhmhxgNdw19i1QsxPX9";
const BASE: XIntelData = unavailableIntel(
  MINT,
  "no_twitter_link",
  "No linked X account was found for this token.",
);

const NO_BEARER_DETAIL =
  "No X app Bearer token is configured on the server (env TWITTER_BEARER_TOKEN).";

function ogFixture(over: Partial<OgScore>): OgScore {
  return {
    score: 82,
    band: "Strong",
    label: "Strong",
    categories: [
      { id: "contract", label: "Contract", points: 20, max: 25, note: "Mint authority renounced." },
      { id: "liquidity", label: "Liquidity", points: 5, max: 25, note: "LP not locked." },
    ],
    caps: [],
    unknowns: ["Holders"],
    adjustments: [],
    ...over,
  };
}

describe("W3 other socials", () => {
  it("renders real Telegram + website links with liveness and the conflict note", () => {
    render(
      <XIntel
        intel={{
          ...BASE,
          devOtherSocials: {
            status: "available",
            value: {
              links: [
                {
                  kind: "telegram",
                  label: "@orbitxwrld",
                  url: "https://t.me/orbitxwrld",
                  sources: ["dexscreener"],
                  agreement: "single",
                  liveStatus: "reachable",
                  httpStatus: 200,
                },
                {
                  kind: "website",
                  label: "orbitx.world",
                  url: "https://orbitx.world",
                  sources: ["dexscreener", "geckoterminal"],
                  agreement: "agree",
                  liveStatus: "unknown",
                  httpStatus: null,
                },
              ],
              note: "Sources disagree on the telegram handle: https://t.me/orbitxwrld, https://t.me/other. Both are shown; neither is verified as the official channel.",
            },
            source: "dexscreener+geckoterminal",
            fetchedAt: BASE.fetchedAt,
          },
        }}
      />,
    );
    expect(screen.getByText("Other socials")).toBeTruthy();
    const tg = screen.getByText("@orbitxwrld");
    expect(tg.closest("a")?.getAttribute("href")).toBe("https://t.me/orbitxwrld");
    expect(screen.getByText("Reachable (HTTP 200)")).toBeTruthy();
    expect(screen.getByText("Liveness unknown")).toBeTruthy();
    expect(screen.getByText(/Sources disagree on the telegram handle/)).toBeTruthy();
    expect(screen.getByText(/does not prove a Telegram group exists/)).toBeTruthy();
  });

  it("renders honest Unavailable with no links when neither source lists one", () => {
    render(
      <XIntel
        intel={{
          ...BASE,
          devOtherSocials: {
            status: "unavailable",
            reason: "no_other_socials",
            detail: "Neither DexScreener nor GeckoTerminal lists a Telegram, Discord or website for this token.",
            fetchedAt: BASE.fetchedAt,
          },
        }}
      />,
    );
    expect(screen.getByText("Other socials")).toBeTruthy();
    expect(screen.getAllByText("Unavailable").length).toBeGreaterThan(0);
    expect(screen.getByText("no_other_socials")).toBeTruthy();
    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });
});

describe("W3 AMA tracker", () => {
  const amaAvailable = (mentions: { tweetId: string; text: string; createdAt: string | null }[]) => ({
    ...BASE,
    devAmaTracker: {
      status: "available" as const,
      value: {
        handle: "orbitx_wrld",
        amaMentions: mentions,
        identityStatus: "unverifiable" as const,
        identityNote: "A profile name is a brand, not a person.",
        promisesStatus: "unverifiable" as const,
        promisesNote: "Ten recent tweets are not a promise ledger.",
      },
      source: "x_api_v2",
      fetchedAt: BASE.fetchedAt,
    },
  });

  it("renders a real AMA mention as a mention only, never as proof", () => {
    render(
      <XIntel
        intel={amaAvailable([
          { tweetId: "1234567890", text: "Join our AMA this Friday on X Spaces!", createdAt: "2026-11-07T18:00:00.000Z" },
        ])}
      />,
    );
    expect(screen.getByText("AMA tracker")).toBeTruthy();
    const tweet = screen.getByText("Join our AMA this Friday on X Spaces!");
    expect(tweet.closest("a")?.getAttribute("href")).toBe("https://x.com/i/status/1234567890");
    expect(screen.getByText(/never proof one happened/)).toBeTruthy();
    expect(screen.getAllByText("Unverifiable")).toHaveLength(2);
  });

  it("says so plainly when the linked account never mentioned an AMA", () => {
    render(<XIntel intel={amaAvailable([])} />);
    expect(screen.getByText(/No AMA or Space mentions/)).toBeTruthy();
  });

  it("is honestly unavailable with no_bearer_token when the bearer is unset", () => {
    render(
      <XIntel
        intel={{
          ...BASE,
          devAmaTracker: {
            status: "unavailable",
            reason: "no_bearer_token",
            detail: NO_BEARER_DETAIL,
            fetchedAt: BASE.fetchedAt,
          },
        }}
      />,
    );
    expect(screen.getByText("AMA tracker")).toBeTruthy();
    expect(screen.getByText("no_bearer_token")).toBeTruthy();
    expect(screen.getByText(/No X app Bearer token is configured/)).toBeTruthy();
    expect(screen.queryByText(/Join our AMA/)).toBeNull();
  });
});

describe("W3 X account audit", () => {
  it("shows real age / verified / followers and never a bot %", () => {
    render(
      <XIntel
        intel={{
          ...BASE,
          accountAudit: {
            status: "available",
            value: {
              handle: "orbitx_wrld",
              createdAt: "2025-10-01T00:00:00.000Z",
              accountAgeDays: 400,
              verified: true,
              protected: false,
              followers: 1234,
              following: 56,
              tweetCount: 789,
              botFollowerPct: null,
              botFollowerNote: BOT_FOLLOWER_NOTE,
            },
            source: "x_api_v2",
            fetchedAt: BASE.fetchedAt,
          },
        }}
      />,
    );
    expect(screen.getByText("X account audit")).toBeTruthy();
    expect(screen.getByText("1.1 years old")).toBeTruthy();
    expect(screen.getByText("1,234")).toBeTruthy();
    expect(screen.getByText("Bot followers")).toBeTruthy();
    expect(screen.getByText("Not measured")).toBeTruthy();
    expect(screen.getByText(/Verified account\./)).toBeTruthy();
    expect(screen.getByText(/No reliable source measures bot followers/)).toBeTruthy();
  });

  it("is honestly unavailable with no_bearer_token when the bearer is unset", () => {
    render(
      <XIntel
        intel={{
          ...BASE,
          accountAudit: {
            status: "unavailable",
            reason: "no_bearer_token",
            detail: NO_BEARER_DETAIL,
            fetchedAt: BASE.fetchedAt,
          },
        }}
      />,
    );
    expect(screen.getByText("X account audit")).toBeTruthy();
    expect(screen.getByText("no_bearer_token")).toBeTruthy();
    expect(screen.queryByText("1,234")).toBeNull();
  });
});

describe("W3 caller track records", () => {
  it("renders real records with accuracy when they exist", () => {
    render(
      <XIntel
        intel={{
          ...BASE,
          callerRecords: {
            status: "available",
            value: {
              records: [{ handle: "bigcaller", callsTracked: 3, correctCalls: 2, accuracyPct: 66.7 }],
            },
            source: "x_api_v2",
            fetchedAt: BASE.fetchedAt,
          },
        }}
      />,
    );
    expect(screen.getByText("@bigcaller")).toBeTruthy();
    expect(screen.getByText(/3 calls tracked/)).toBeTruthy();
    expect(screen.getByText(/66.7% accurate/)).toBeTruthy();
  });

  it("is honestly unavailable with no_caller_source — no caller is ever invented", () => {
    render(<XIntel intel={BASE} />);
    expect(screen.getByText("Caller track records")).toBeTruthy();
    expect(screen.getAllByText("no_caller_source").length).toBeGreaterThan(0);
    expect(screen.queryByText(/calls tracked/)).toBeNull();
  });
});

describe("W3 social velocity", () => {
  it("renders real hour-over-hour growth when a series exists", () => {
    render(
      <XIntel
        intel={{
          ...BASE,
          socialVelocity: {
            status: "available",
            value: {
              latestHour: "2026-11-08T02:00:00.000Z",
              previousHour: "2026-11-08T01:00:00.000Z",
              latestMentions: 50,
              previousMentions: 40,
              growthPct: 25,
              windowHours: 6,
            },
            source: "x_api_v2",
            fetchedAt: BASE.fetchedAt,
          },
        }}
      />,
    );
    expect(screen.getByText("Social velocity")).toBeTruthy();
    expect(screen.getByText("+25%")).toBeTruthy();
    expect(screen.getByText(/Measured over 6 hours/)).toBeTruthy();
  });

  it("is honestly unavailable with no_mention_source — growth is never synthesized", () => {
    render(<XIntel intel={BASE} />);
    expect(screen.getByText("Social velocity")).toBeTruthy();
    expect(screen.getAllByText("no_mention_source").length).toBeGreaterThan(0);
    expect(screen.queryByText("Growth")).toBeNull();
  });
});

describe("W3 community sentiment gauge", () => {
  it("renders the gauge shell with an explicit unavailable state, never estimated sentiment", () => {
    render(<XIntel intel={BASE} />);
    expect(screen.getByText("Community sentiment")).toBeTruthy();
    expect(screen.getByText("No community data — gauge not measured")).toBeTruthy();
    expect(screen.getAllByText("no_community_source").length).toBeGreaterThan(0);
    expect(screen.queryByText("Vibe")).toBeNull();
    expect(screen.queryByText("Positive")).toBeNull();
    expect(screen.queryByText("Negative")).toBeNull();
  });

  it("renders a real gauge when community data exists", () => {
    render(
      <XIntel
        intel={{
          ...BASE,
          communitySentiment: {
            status: "available",
            value: {
              vibe: "positive",
              postsAnalyzed: 120,
              memberGrowthPct: null,
              botPct: null,
            },
            source: "telegram",
            fetchedAt: BASE.fetchedAt,
          },
        }}
      />,
    );
    expect(screen.getByText("Positive")).toBeTruthy();
    expect(screen.getByText("120")).toBeTruthy();
    expect(screen.getAllByText("Not measured").length).toBe(2);
  });
});

describe("W3 OgScorePanel TL;DR", () => {
  it("ogScoreTldr summarises the real score, weakest category and unknowns in plain words", () => {
    const tldr = ogScoreTldr(ogFixture({}));
    expect(tldr).toContain("82/100");
    expect(tldr).toContain("strong");
    expect(tldr).toContain("Weakest area is liquidity (5/25)");
    expect(tldr).toContain("Still unknown: Holders.");
  });

  it("ogScoreTldr says unverified — never a score — when there is no evidence", () => {
    const tldr = ogScoreTldr(ogFixture({ score: null, band: "Unknown", categories: [], unknowns: ["Mint authority"] }));
    expect(tldr).toContain("No score could be given");
    expect(tldr).toContain("Still unknown: Mint authority.");
    expect(tldr).not.toContain("/100");
  });

  it("OgScorePanel renders the TL;DR above the category bars", () => {
    render(<OgScorePanel ogScore={ogFixture({})} />);
    expect(screen.getByText(/This token scores 82\/100/)).toBeTruthy();
    expect(screen.getByText(/Weakest area is liquidity/)).toBeTruthy();
    expect(screen.getByText("82")).toBeTruthy();
  });

  it("OgScorePanel renders the TL;DR in the unscored branch too", () => {
    render(
      <OgScorePanel
        ogScore={ogFixture({ score: null, band: "Unknown", categories: [], unknowns: ["Mint authority"] })}
      />,
    );
    expect(screen.getByText(/No score could be given/)).toBeTruthy();
  });
});

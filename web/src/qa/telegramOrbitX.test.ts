import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import {
  argsFromCommand,
  applyDefaultBuyAmount,
  cmdsPage,
  extractMint,
  formatGroupWelcomeHtml,
  formatMediaCountdown,
  formatOrbitXFaqHtml,
  formatOrbitXTelegramResult,
  formatTelegramStartGate,
  formatTelegramGroupLockHtml,
  formatTokenCard,
  formatToolMenu,
  inferPublicTool,
  INVITE_CODE_PROMPT_HTML,
  isPublicGroupTrigger,
  isPrivilegedTelegramTool,
  isPublicTelegramTool,
  isTelegramAdminWallet,
  loginCode,
  mediaEtaSeconds,
  mergeTokenScanPayloads,
  missingToolInput,
  OFFICIAL_BOT_ABOUT,
  ORBITX_FAQ_CHUNKS,
  ORBITX_FAQ_CORE,
  ORBITX_FAQ_SECTIONS,
  orbitXFaqSystemAddon,
  parseCallInvocation,
  resolveOfficialCommand,
  selectOrbitXFaqChunks,
  shouldSkipTelegramSender,
  telegramChatExtras,
} from "../../api/orbitx/telegram-orbitx-lib.js";
import { isAgentTelegramToolAllowed } from "../../api/orbitx/telegram-mcp-allowlist.js";
import { formatOrbitXLinksHtml, OFFICIAL_ORBITX_TELEGRAM_SYSTEM } from "../../api/orbitx/orbitx-telegram-knowledge.js";
import { asTokenRecord } from "../../api/orbitx/telegram-payload.js";
import {
  assembleTelegramSnapshot,
  hasMarketSnapshot,
  jupListFromRaw,
  looksLikeFailedQuoteCard,
  looksLikeOrbitXCard,
  mergeTokenSnapshot,
  normalizeDexResponse,
  tokenFromGecko,
} from "../../api/orbitx/telegram-token-snapshot.js";
import { phantomBrowseUrl } from "../../api/orbitx/telegram-tool-cards.js";

const WEB = resolve(__dirname, "../..");
const REPO = resolve(WEB, "..");

function cardText(value: unknown): string {
  if (value && typeof value === "object" && "text" in (value as { text?: string })) {
    return String((value as { text: string }).text || "");
  }
  return String(value ?? "");
}

function walkSource(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    if (name.name === "node_modules" || name.name === ".git" || name.name === "dist" || name.name === "ogdex") continue;
    const full = resolve(dir, name.name);
    if (name.isDirectory()) walkSource(full, acc);
    else if (/\.(js|ts|tsx|sql|md|json|mjs|cjs|env)$/i.test(name.name)) acc.push(full);
  }
  return acc;
}

describe("official OrbitX Telegram bot", () => {
  it("keeps groups public and DMs privileged for trade / X / writes", () => {
    expect(isPublicTelegramTool("orbitx_get_token")).toBe(true);
    expect(isPublicTelegramTool("orbitx_dex_chart")).toBe(true);
    expect(isPublicTelegramTool("orbitx_generate_image")).toBe(true);
    expect(isPublicTelegramTool("orbitx_generate_video")).toBe(true);
    expect(isPublicTelegramTool("orbitx_prepare_buy")).toBe(false);
    expect(isPrivilegedTelegramTool("orbitx_prepare_buy")).toBe(true);
    expect(isPrivilegedTelegramTool("orbitx_trade")).toBe(true);
    expect(isPrivilegedTelegramTool("orbitx_swap")).toBe(true);
    expect(isPublicTelegramTool("orbitx_trade")).toBe(false);
    expect(isPublicTelegramTool("orbitx_traders_top5")).toBe(true);
    expect(isPrivilegedTelegramTool("orbitx_traders_top5")).toBe(false);
    expect(isPrivilegedTelegramTool("orbitx_prepare_sell")).toBe(true);
    expect(isPrivilegedTelegramTool("orbitx_social_post")).toBe(true);
    expect(isPrivilegedTelegramTool("x_post")).toBe(true);
    expect(isPrivilegedTelegramTool("orbitx_auth_link")).toBe(true);
    expect(isPublicTelegramTool("orbitx_auth_link")).toBe(false);
  });

  it("maps slash commands and infers public media / CA messages", () => {
    expect(resolveOfficialCommand("/img@theorbitxmcpbot").tool).toBe("orbitx_generate_image");
    expect(resolveOfficialCommand("tweet").tool).toBe("x_post");
    expect(resolveOfficialCommand("buy").tool).toBe("orbitx_prepare_buy");
    expect(resolveOfficialCommand("trade").tool).toBe("orbitx_prepare_buy");
    expect(resolveOfficialCommand("swap").tool).toBe("orbitx_prepare_buy");
    expect(resolveOfficialCommand("/trade@theorbitxmcpbot").tool).toBe("orbitx_prepare_buy");
    expect(resolveOfficialCommand("shop").tool).toBe("orbitx_shop");
    expect(resolveOfficialCommand("autobuy").kind).toBe("meta");
    expect(resolveOfficialCommand("auth").kind).toBe("meta");
    expect(resolveOfficialCommand("login").kind).toBe("meta");
    expect(resolveOfficialCommand("check").kind).toBe("meta");
    expect(resolveOfficialCommand("check").tool).toBeNull();
    expect(resolveOfficialCommand("links").kind).toBe("meta");
    expect(resolveOfficialCommand("group").kind).toBe("meta");
    expect(resolveOfficialCommand("menu").kind).toBe("meta");
    expect(resolveOfficialCommand("verify").kind).toBe("meta");
    expect(resolveOfficialCommand("code").kind).toBe("meta");
    expect(resolveOfficialCommand("burn").kind).toBe("meta");
    expect(resolveOfficialCommand("access").kind).toBe("meta");
    expect(resolveOfficialCommand("faq").kind).toBe("meta");
    expect(argsFromCommand("faq", "/faq burn").q).toBe("burn");
    expect(inferPublicTool("faq mcp")?.meta).toBe("faq");
    expect(argsFromCommand("check", "/check abc123").taskId).toBe("abc123");
    expect(argsFromCommand("verify", "/verify 13H4WJvGEg4xrrBwWn2vsQgz7xhmhxgNdw19i1QsxPX9").mint).toBe(
      "13H4WJvGEg4xrrBwWn2vsQgz7xhmhxgNdw19i1QsxPX9",
    );
    expect(argsFromCommand("img", "/img neon saturn")).toMatchObject({ prompt: "neon saturn" });
    expect(parseCallInvocation("/call get_token mint=So111").tool).toBe("orbitx_get_token");
    expect(parseCallInvocation("/call trade").tool).toBe("orbitx_prepare_buy");
    expect(inferPublicTool("generate an image of a cyan planet")?.tool).toBe("orbitx_generate_image");
    expect(inferPublicTool("So11111111111111111111111111111111111111112")?.tool).toBe("orbitx_get_token");
    expect(inferPublicTool("links")?.meta).toBe("links");
    expect(inferPublicTool("join the group")?.meta).toBe("links");
    expect(inferPublicTool("check")?.meta).toBe("check");
    expect(inferPublicTool("13H4WJvGEg4xrrBwWn2vsQgz7xhmhxgNdw19i1QsxPX9")?.tool).toBe("orbitx_get_token");
    expect(inferPublicTool("$ORBITX")?.tool).toBe("orbitx_get_token");
    expect(inferPublicTool("$ORBITX")?.args).toMatchObject({ mint: "13H4WJvGEg4xrrBwWn2vsQgz7xhmhxgNdw19i1QsxPX9" });
    expect(extractMint("scan this 13H4WJvGEg4xrrBwWn2vsQgz7xhmhxgNdw19i1QsxPX9 please")).toBe(
      "13H4WJvGEg4xrrBwWn2vsQgz7xhmhxgNdw19i1QsxPX9",
    );
    expect(isTelegramAdminWallet("jYbHk588JspmzG5ibjPpKpCrjNP7epAjBT8Syvu7GUb")).toBe(true);
    expect(isTelegramAdminWallet("So11111111111111111111111111111111111111112")).toBe(false);
  });

  it("starts with the MCP welcome, invite-code lifetime (first 25), and timed burns — never prints the secret", () => {
    const card = formatTelegramStartGate({ remainingLabel: "", linked: false });
    expect(card.text.startsWith("Welcome to the <b>OrbitX MCP bot</b> on Telegram.")).toBe(true);
    expect(card.text).toContain("invite code");
    expect(card.text).not.toContain("ORBITX BETA");
    expect(card.text).not.toContain("ORBITXBETA");
    expect(card.text).toContain("lifetime MCP");
    expect(card.text).toContain("first 25");
    expect(card.text).toContain("does not reply until you send the invite code");
    expect(card.text).toContain("This bot is locked");
    expect(card.text).toContain("burn now and get timed access");
    expect(card.text).toContain("1 hour");
    expect(card.text).toContain("100 $ORBITX");
    expect(card.text).toContain("1,000 $ORBITX");
    expect(card.text).toContain("10,000 $ORBITX");
    expect(card.text).toContain("1,000,000 $ORBITX");
    expect(card.text).toContain("/verify");
    expect(card.text).toContain("/login");
    expect(card.text).toContain("Send invite code");
    const buttons = JSON.stringify(card.reply_markup);
    expect(buttons).toContain("Send invite code");
    expect(buttons).toContain("ox:gate:code");
    expect(buttons).not.toContain("ox:gate:beta");
    expect(buttons).not.toContain("ORBITX BETA");
    expect(buttons).toContain("ox:gate:hour");
    expect(buttons).toContain("ox:gate:month");
    expect(buttons).not.toContain("ox:desk");
    expect(INVITE_CODE_PROMPT_HTML).toContain("invite code");
    expect(INVITE_CODE_PROMPT_HTML).not.toContain("ORBITX BETA");
    expect(formatTelegramGroupLockHtml()).toContain("invite code");
    expect(formatTelegramGroupLockHtml()).not.toContain("ORBITX BETA");
    expect(OFFICIAL_BOT_ABOUT).toContain("invite code");
    expect(OFFICIAL_BOT_ABOUT).not.toContain("ORBITX BETA");
    const linked = formatTelegramStartGate({ remainingLabel: "lifetime", linked: true, unlocked: true });
    expect(linked.text).toContain("lifetime");
    expect(linked.text).not.toContain("Burns need");
    expect(JSON.stringify(linked.reply_markup)).toContain("ox:desk");
    expect(inferPublicTool("shop hour")?.args).toMatchObject({ package: "hour" });
    expect(inferPublicTool("shop month")?.args).toMatchObject({ package: "month" });
  });

  it("handles public group triggers, forum threads, and anonymous admins", () => {
    const mint = "13H4WJvGEg4xrrBwWn2vsQgz7xhmhxgNdw19i1QsxPX9";
    expect(isPublicGroupTrigger(`/token ${mint}`)).toBe(true);
    expect(isPublicGroupTrigger(`/token@theorbitxmcpbot ${mint}`)).toBe(true);
    expect(isPublicGroupTrigger(`/token@otherbot ${mint}`)).toBe(false);
    expect(isPublicGroupTrigger(mint)).toBe(true);
    expect(isPublicGroupTrigger("$ORBITX")).toBe(true);
    expect(isPublicGroupTrigger("buy $ORBITX")).toBe(true);
    expect(isPublicGroupTrigger("orbitx is pumping")).toBe(false);
    expect(isPublicGroupTrigger("gm what is lunch")).toBe(false);
    expect(
      isPublicGroupTrigger("chart please", {
        reply_to_message: { from: { username: "theorbitxmcpbot" } },
      }),
    ).toBe(true);
    expect(shouldSkipTelegramSender({ from: { is_bot: true, username: "SomeOtherBot" } })).toBe(true);
    expect(shouldSkipTelegramSender({ from: { is_bot: true, username: "GroupAnonymousBot" } })).toBe(false);
    expect(shouldSkipTelegramSender({ from: { is_bot: false, username: "alice" } })).toBe(false);
    expect(shouldSkipTelegramSender({ from: { is_bot: true, username: "theorbitxmcpbot" } })).toBe(true);
    const extras = telegramChatExtras({
      chat: { type: "supergroup" },
      message_id: 88,
      message_thread_id: 12,
      is_topic_message: true,
    });
    expect(extras.isGroup).toBe(true);
    expect(extras.extra.reply_to_message_id).toBe(88);
    expect(extras.extra.allow_sending_without_reply).toBe(true);
    expect(extras.extra.message_thread_id).toBe(12);
    expect(formatGroupWelcomeHtml()).toContain("OrbitX is in this group");
    expect(formatGroupWelcomeHtml()).toContain("locked");
    expect(formatGroupWelcomeHtml()).toContain("invite code");
    expect(formatGroupWelcomeHtml()).not.toContain("ORBITX BETA");
  });

  it("maps /trade CA to a real buy tool with mint + default SOL amount", () => {
    const mint = "13H4WJvGEg4xrrBwWn2vsQgz7xhmhxgNdw19i1QsxPX9";
    expect(argsFromCommand("trade", `/trade ${mint}`)).toMatchObject({ mint, ca: mint });
    expect(argsFromCommand("trade", `/trade ${mint} 0.1`)).toMatchObject({ mint, amountSol: 0.1 });
    expect(applyDefaultBuyAmount("orbitx_trade", { mint })).toMatchObject({ mint, amountSol: 0.05 });
    expect(applyDefaultBuyAmount("orbitx_prepare_buy", { mint, amountSol: 0.25 }).amountSol).toBe(0.25);
    expect(applyDefaultBuyAmount("orbitx_buy_orbitx", { amountUsd: 1 }).amountSol).toBeUndefined();
    expect(applyDefaultBuyAmount("orbitx_buy_orbitx", { amountUsd: 1 }).amountUsd).toBe(1);
    expect(argsFromCommand("buy", "/buy $1").mint).toBeUndefined();
    expect(argsFromCommand("buy", "/buy $1").amountUsd).toBe(1);
    expect(argsFromCommand("buy", "/buy 0.05").amountSol).toBe(0.05);
    expect(missingToolInput("orbitx_prepare_buy", {})).toBeNull();
    expect(missingToolInput("orbitx_get_token", {})).toBe("mint");
    expect(isAgentTelegramToolAllowed("orbitx_trade")).toBe(false);
    expect(isAgentTelegramToolAllowed("orbitx_swap")).toBe(false);
    expect(isAgentTelegramToolAllowed("orbitx_prepare_buy")).toBe(false);
    expect(isAgentTelegramToolAllowed("orbitx_get_token")).toBe(true);
    const hub = readFileSync(resolve(WEB, "api/orbitx-hub.js"), "utf8");
    expect(hub).toContain('orbitx_trade: "orbitx_prepare_buy"');
    expect(hub).toContain('orbitx_swap: "orbitx_prepare_buy"');
    expect(hub).toContain("export function resolveEmbeddedAgentToolName");
    const api = readFileSync(resolve(WEB, "api/telegram-orbitx.js"), "utf8");
    expect(api).toContain("resolveEmbeddedAgentToolName");
    expect(api).toContain("applyDefaultBuyAmount");
  });

  it("issues alphanumeric login codes without a bot token", () => {
    const code = loginCode();
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);
  });

  it("renders token intel as a card instead of raw JSON", () => {
    const payload = {
      mint: "13H4WJvGEg4xrrBwWn2vsQgz7xhmhxgNdw19i1QsxPX9",
      token: {
        mint: "13H4WJvGEg4xrrBwWn2vsQgz7xhmhxgNdw19i1QsxPX9",
        name: "ORBITX",
        symbol: "ORBITX",
        priceUsd: 0.0000775253639603371,
        mcap: 74726.22656430396,
        liquidity: 9211.390808634686,
        holderCount: 255,
        volume: 15081.753341212232,
        change1h: -5.453137607817787,
        change6h: 4.123730044775421,
        change24h: -12.283618973938905,
        holderChange24h: -6.934306569343065,
        organicScoreLabel: "low",
        chain: "solana",
        ageDays: 41,
        tags: ["token-2022"],
        audit: {
          mintAuthorityDisabled: true,
          freezeAuthorityDisabled: true,
          topHoldersPercentage: 31.12,
        },
      },
      meta: { name: "ORBITX", symbol: "ORBITX" },
    };
    const card = cardText(formatTokenCard(payload));
    const text = cardText(formatOrbitXTelegramResult(payload));
    expect(card).toContain("🚀");
    expect(card).toContain("ORBITX");
    expect(card).toContain("Market Snapshot");
    expect(card).toContain("Price");
    expect(card).toContain("Market Cap");
    expect(card).toContain("Mint Authority");
    expect(card).toContain("Revoked");
    expect(card).toContain("Top Holders");
    expect(card).toContain("DexScreener");
    expect(card).toContain("Jupiter");
    expect(card).toContain("Birdeye");
    expect(card).toContain("OrbitX DEX");
    expect(card).not.toContain('"priceUsd"');
    expect(card).not.toContain('"holderCount"');
    expect(text).toBe(card);
    expect(text.startsWith("{")).toBe(false);
    expect(cardText(formatOrbitXTelegramResult({ ok: true, result: payload }))).toContain("Holders");

    const branded = cardText(
      formatTokenCard(
        mergeTokenScanPayloads({
          token: { ...payload, athMcap: 210_000, athPrice: 0.00022 },
          xray: {
            mint: payload.mint,
            verdict: "Looks clean",
            concentration: { top10Pct: 31.1, whales: 4, totalHolders: 255 },
            bundles: { pct: 12, count: 3 },
            holders: [{ owner: "KOL111111111111111111111111111111111111111", label: "kol", twitter: "@alice" }],
            dev: { wallet: "BC8FPb72MEZbExy21aeKTEVrG7cubSjrZxBBj51uA225", pct: 0, sold: true },
            safety: { mintRenounced: true, freezeRenounced: true, lpLockedPct: 95 },
          },
          forensics: {
            mint: payload.mint,
            dexPaid: { paid: true, services: [{ type: "tokenProfile", status: "approved" }] },
            concentration: { whales: 4, top10Pct: 31.1 },
          },
          boosts: { boosts: [{ mint: payload.mint, tier: "24h" }] },
          verified: { mint: payload.mint, verified_by_wallet: "jYbHk588JspmzG5ibjPpKpCrjNP7epAjBT8Syvu7GUb" },
        }),
      ),
    );
    expect(branded).toContain("OrbitX Verified");
    expect(branded).toContain("ATH");
    expect(branded).toContain("Whales");
    expect(branded).toContain("Bundles");
    expect(branded).toContain("KOLs");
    expect(branded).toContain("Boosts");
    expect(branded).toContain("DEX paid");
    expect(branded).toContain("24h");
    expect(branded).toContain("LP Locked");
    expect(branded).toContain("Project Summary");
    expect(branded.startsWith("{")).toBe(false);
    expect(missingToolInput("orbitx_get_token", {})).toBe("mint");
    expect(cardText(formatToolMenu("orbitx_get_token"))).toContain("/token");
  });

  it("never renders a TOKEN · $TOKEN stub from mint-only or empty x-ray payloads", () => {
    const mint = "13H4WJvGEg4xrrBwWn2vsQgz7xhmhxgNdw19i1QsxPX9";
    const randomMint = "So11111111111111111111111111111111111111112";
    expect(formatTokenCard({ mint: randomMint })).toBeNull();
    expect(asTokenRecord({ mint: randomMint })).toBeNull();
    expect(formatTokenCard({ mint, concentration: { whales: 0 } })).toBeNull();
    expect(formatTokenCard({ mint, xray: { mint, concentration: { whales: 0 } } })).toBeNull();

    const stub = cardText(
      formatOrbitXTelegramResult({
        mint,
        xray: { mint, concentration: { whales: 0 } },
        forensics: { mint },
      }),
    );
    expect(stub).not.toMatch(/TOKEN · \$TOKEN/);
    expect(stub).not.toMatch(/TOKEN \(\$TOKEN\) is live on/i);
    expect(stub).not.toMatch(/🚀 ORBITX · \$ORBITX/);
    expect(stub).toContain("Live quote unavailable");
    expect(stub).toMatch(/DexScreener or Jupiter/);
    expect(stub).not.toContain("Whales    0");
    expect(stub).not.toContain("DEX paid  no");
    expect(stub).not.toContain("KOLs      none labeled");
    expect(stub).toContain(mint);
    expect(stub.toLowerCase()).not.toContain("token · $token");

    const merged = mergeTokenSnapshot({
      mint,
      jupRaw: [
        {
          id: mint,
          name: "ORBITX",
          symbol: "ORBITX",
          usdPrice: 0.00007412,
          mcap: 72100,
          liquidity: 20150,
          holderCount: 276,
          tags: ["token-2022"],
          tokenProgram: "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb",
          audit: { mintAuthorityDisabled: true, freezeAuthorityDisabled: true, topHoldersPercentage: 28.4 },
          stats5m: { priceChange: 0.2 },
          stats1h: { priceChange: -1.1 },
          stats6h: { priceChange: 2.4 },
          stats24h: { priceChange: -8.6, buyVolume: 4200, sellVolume: 3100, holderChange: 1.2 },
        },
      ],
      dexRaw: {
        pairs: [
          {
            chainId: "solana",
            baseToken: { address: mint, name: "ORBITX", symbol: "ORBITX" },
            priceUsd: "0.00007412",
            marketCap: 72100,
            fdv: 72100,
            liquidity: { usd: 20150 },
            volume: { h24: 7300 },
            priceChange: { m5: 0.2, h1: -1.1, h6: 2.4, h24: -8.6 },
            info: { websites: [{ url: "https://www.orbitx.world" }] },
          },
        ],
      },
    });
    const live = cardText(formatTokenCard(merged));
    expect(live).toContain("🚀");
    expect(live).toContain("ORBITX");
    expect(live).not.toMatch(/TOKEN · \$TOKEN/);
    expect(live).toContain("Market Snapshot");
    expect(live).toContain("$0.000074");
    expect(live).toContain("Market Cap");
    expect(live).toContain("$72.1K");
    expect(live).toContain("Revoked");
    expect(live).toContain("OrbitX DEX");

    const fromDexArray = mergeTokenSnapshot({
      mint,
      dexRaw: [
        {
          chainId: "solana",
          baseToken: { address: mint, name: "ORBITX", symbol: "ORBITX" },
          priceUsd: "0.000081",
          marketCap: 81000,
          liquidity: { usd: 19000 },
          volume: { h24: 4000 },
        },
      ],
    });
    expect(cardText(formatTokenCard(fromDexArray))).toContain("$0.000081");
    expect(normalizeDexResponse([{ pairAddress: "abc" }]).pairs).toHaveLength(1);
    expect(jupListFromRaw({ [mint]: { usdPrice: 0.00009, liquidity: 8000 } }, mint)?.[0].usdPrice).toBe(0.00009);

    const gecko = tokenFromGecko(mint, {
      data: { attributes: { name: "ORBITX", symbol: "ORBITX", price_usd: "0.00007", market_cap_usd: "69000", fdv_usd: "69000" } },
    });
    expect(gecko?.priceUsd).toBeCloseTo(0.00007);
    const fromGecko = mergeTokenSnapshot({
      mint,
      geckoRaw: {
        data: { attributes: { name: "ORBITX", symbol: "ORBITX", price_usd: 0.00007, market_cap_usd: 69000 } },
      },
    });
    expect(cardText(formatTokenCard(fromGecko))).toContain("$0.00007");

    const priceOnly = assembleTelegramSnapshot(mint, {
      jupSearch: [{ id: mint, name: "ORBITX", symbol: "ORBITX" }],
      jupPriceLite: { [mint]: { usdPrice: 0.00007512, liquidity: 9411 } },
      dexLatest: { pairs: [] },
    });
    expect(hasMarketSnapshot(priceOnly.token)).toBe(true);
    const priceCard = cardText(formatTokenCard(priceOnly));
    expect(priceCard).toContain("🚀");
    expect(priceCard).toContain("ORBITX");
    expect(priceCard).toContain("$0.000075");
    expect(priceCard).not.toMatch(/Live quote unavailable/);

    const oldStub = [
      "TOKEN · $TOKEN",
      "solana",
      "Price     —",
      "MC        —",
      "Liq       —   Vol 24h —",
      "Holders   —   Top 10 —",
      "5m — · 1h — · 6h — · 24h —",
      "",
      "TOKEN ($TOKEN) is live on solana.",
      "Whales    0 wallets ≥1%",
      "KOLs      none labeled on this scan",
      "Boosts    none active",
      "DEX paid  no",
      mint,
      "DexScreener · OrbitX DEX · /chart",
    ].join("\n");
    expect(looksLikeOrbitXCard(oldStub)).toBe(true);
    expect(looksLikeOrbitXCard("🚀 ORBITX · $ORBITX\nNo live DexScreener/Jupiter quote yet.")).toBe(true);
    expect(looksLikeFailedQuoteCard("🚀 ORBITX · $ORBITX\nNo live DexScreener/Jupiter quote yet.")).toBe(true);
    expect(looksLikeOrbitXCard("📡 Live quote unavailable\nCouldn't reach DexScreener or Jupiter from this scan.")).toBe(true);
    expect(looksLikeFailedQuoteCard("📡 Live quote unavailable\nCouldn't reach DexScreener or Jupiter from this scan.")).toBe(true);
    expect(looksLikeFailedQuoteCard("🚀 ORBITX · $ORBITX\nMarket Snapshot\nPrice $0.000075")).toBe(false);
    expect(looksLikeOrbitXCard("gm what is orbitx")).toBe(false);
  });

  it("renders /cmds as a slash menu, not a JSON dump", () => {
    const page = cmdsPage(
      [
        { name: "orbitx_get_token", description: "token intel" },
        { name: "orbitx_generate_image", description: "image" },
      ],
      { page: 1, query: "" },
    );
    expect(page.text).toContain("/faq");
    expect(page.text).toContain("/token");
    expect(page.text).toContain("/check");
    expect(page.text).toContain("/img");
    expect(page.text).toContain("orbitx_get_token");
    expect(page.text.startsWith("{")).toBe(false);
    expect(page.reply_markup?.inline_keyboard?.length).toBeGreaterThan(0);
    const coins = cmdsPage([{ name: "orbitx_get_token", description: "token intel" }], { query: "coins" });
    expect(coins.text).toContain("Token Intel");
    expect(coins.text).toContain("/token");
  });

  it("formats dex charts and media countdowns without iframes or raw JSON", () => {
    const chart = cardText(
      formatOrbitXTelegramResult({
        __mcpFormat: "markdown",
        action: "dex_chart_embed",
        symbol: "ORBITX",
        name: "ORBITX",
        mint: "13H4WJvGEg4xrrBwWn2vsQgz7xhmhxgNdw19i1QsxPX9",
        priceUsd: 0.00007,
        change24h: -12.2,
        liquidityUsd: 9000,
        volume24h: 15000,
        marketCap: 74000,
        embedUrl: "https://dexscreener.com/solana/13H4WJvGEg4xrrBwWn2vsQgz7xhmhxgNdw19i1QsxPX9",
      }),
    );
    expect(chart).toContain("DexScreener");
    expect(chart).toContain("ORBITX");
    expect(chart).not.toMatch(/<iframe/i);
    expect(chart.startsWith("{")).toBe(false);

    const waiting = cardText(
      formatOrbitXTelegramResult({
        ok: true,
        kind: "image",
        taskId: "task-1",
        state: "waiting",
        pending: true,
        startedAt: Date.now(),
        etaSeconds: mediaEtaSeconds("image"),
      }),
    );
    expect(waiting).toContain("Elapsed");
    expect(waiting).toContain("/check");
    expect(waiting).toContain("task-1");
    expect(waiting.startsWith("{")).toBe(false);

    const actions = cardText(
      formatOrbitXTelegramResult({
        ok: true,
        message: "Sign this buy on OrbitX",
        signUrl: "https://www.orbitx.world/trade?sign=1",
        openUrl: "https://www.orbitx.world/trade",
      }),
    );
    expect(actions).toContain("Sign");
    expect(actions).toContain("https://www.orbitx.world/trade");
    expect(actions.startsWith("{")).toBe(false);

    const walletGate = cardText(
      formatOrbitXTelegramResult(
        {
          ok: false,
          error: "wallet_required",
          mint: "13H4WJvGEg4xrrBwWn2vsQgz7xhmhxgNdw19i1QsxPX9",
          token: "ORBITX",
          message: "Connect Phantom on https://www.orbitx.world/telegram",
        },
        "orbitx_buy_orbitx",
      ),
    );
    expect(walletGate).not.toMatch(/No live DexScreener/);
    expect(walletGate).not.toMatch(/Live quote unavailable/);
    expect(walletGate).toContain("Link Phantom");
    expect(walletGate).toContain("solscan.io/token");

    const signBuy = cardText(
      formatOrbitXTelegramResult(
        {
          ok: true,
          requiresSignature: true,
          mint: "13H4WJvGEg4xrrBwWn2vsQgz7xhmhxgNdw19i1QsxPX9",
          amountSol: 0.05,
          amountUsd: 1,
          wallet: "4xT5QZnwtdZKAW5ZcRziEakTwNdnfKMgp1cEVaJmewxd",
          signUrl: "https://www.orbitx.world/agent/sign?action=buy&mint=13H4WJvGEg4xrrBwWn2vsQgz7xhmhxgNdw19i1QsxPX9&amount=0.05",
          autoSignUrl: "https://www.orbitx.world/agent/sign?action=buy&mint=13H4WJvGEg4xrrBwWn2vsQgz7xhmhxgNdw19i1QsxPX9&amount=0.05&auto=1",
          solscanToken: "https://solscan.io/token/13H4WJvGEg4xrrBwWn2vsQgz7xhmhxgNdw19i1QsxPX9",
        },
        "orbitx_buy_orbitx",
      ),
    );
    expect(signBuy).not.toMatch(/No live DexScreener/);
    expect(signBuy).not.toMatch(/Live quote unavailable/);
    expect(signBuy).toContain("Sign in Phantom");
    expect(signBuy).toContain("solscan.io/token");
    expect(signBuy).toContain("0.05 SOL");
    expect(signBuy).toContain("Auto-sign");
    expect(signBuy).toContain("phantom.app/ul/browse");
    expect(signBuy).toContain("/agent/sign?action=buy");

    const tick = cardText(
      formatMediaCountdown({
        kind: "video",
        taskId: "vid-9",
        startedAt: Date.now() - 15_000,
        etaSeconds: 240,
        state: "waiting",
      }),
    );
    expect(tick).toContain("0:15");
    expect(tick).toContain("left");
    expect(tick).toContain("/check");
  });

  it("lists real OrbitX links including the community GC", () => {
    const html = formatOrbitXLinksHtml();
    expect(html).toContain("t.me/orbitxwrld");
    expect(html).toContain("orbitx.world");
    expect(html).toContain("ORBITX_DEX");
    expect(html).toContain("Orbitxcity");
    expect(html).toContain("ogscan.fun");
  });

  it("trains official Telegram AI on OrbitX FAQ hold/burn/MCP facts", () => {
    expect(ORBITX_FAQ_CORE).toContain("13H4WJvGEg4xrrBwWn2vsQgz7xhmhxgNdw19i1QsxPX9");
    expect(ORBITX_FAQ_CORE).toContain("100 $ORBITX");
    expect(ORBITX_FAQ_CORE).toContain("10,000");
    expect(ORBITX_FAQ_CORE).toContain("programs/betting/");
    expect(ORBITX_FAQ_CORE).toContain("ogscan.fun");
    expect(ORBITX_FAQ_CORE).toContain("16 chain");
    expect(ORBITX_FAQ_CORE).toContain("not a separate standalone Solana-betting");
    expect(ORBITX_FAQ_CORE).not.toContain("$70k");

    const ids = ORBITX_FAQ_CHUNKS.map((c) => c.id);
    for (const need of [
      "what",
      "token",
      "hold",
      "burn",
      "shop",
      "mcp",
      "agents",
      "dex",
      "wallet",
      "coinai",
      "pulse",
      "launch",
      "surfaces",
      "social",
      "nft",
      "predict",
      "stack",
      "roadmap",
      "custody",
      "answers",
      "caveats",
    ]) {
      expect(ids).toContain(need);
    }
    expect(Object.keys(ORBITX_FAQ_SECTIONS)).toHaveLength(12);

    const burn = orbitXFaqSystemAddon("how does burning work");
    expect(burn).toContain("Jupiter");
    expect(burn).toContain("Shop");
    expect(burn.toLowerCase()).toContain("stackable");
    expect(selectOrbitXFaqChunks("how does burning work").some((c) => c.id === "burn")).toBe(true);
    expect(selectOrbitXFaqChunks("how do I connect MCP").some((c) => c.id === "mcp")).toBe(true);
    expect(selectOrbitXFaqChunks("what is OrbitX").some((c) => c.id === "what")).toBe(true);
    expect(selectOrbitXFaqChunks("what is the utility of $ORBITX").some((c) => c.id === "hold")).toBe(true);
    expect(selectOrbitXFaqChunks("is it custodial").some((c) => c.id === "custody")).toBe(true);
    expect(selectOrbitXFaqChunks("where is the code").some((c) => c.id === "stack")).toBe(true);
    expect(selectOrbitXFaqChunks("can I launch a token for free with vanity").some((c) => c.id === "launch")).toBe(true);
    expect(selectOrbitXFaqChunks("prediction markets").some((c) => c.id === "predict")).toBe(true);
    expect(selectOrbitXFaqChunks("Coin AI analyst").some((c) => c.id === "coinai")).toBe(true);
    expect(selectOrbitXFaqChunks("wallet copy-tracking").some((c) => c.id === "wallet")).toBe(true);

    const shop = orbitXFaqSystemAddon("how does the shop burn work");
    expect(shop).toContain("Jupiter");
    expect(shop).toContain("does not take");

    const faq = formatOrbitXFaqHtml("/faq mcp");
    expect(faq).toContain("/api/mcp");
    expect(faq).toContain("OrbitX FAQ");
    expect(formatOrbitXFaqHtml("").toLowerCase()).toContain("hold");
    expect(formatOrbitXFaqHtml("").length).toBeLessThan(4096);

    expect(OFFICIAL_ORBITX_TELEGRAM_SYSTEM).toContain("$5");
    expect(OFFICIAL_ORBITX_TELEGRAM_SYSTEM).toContain("10,000");
    expect(OFFICIAL_ORBITX_TELEGRAM_SYSTEM).toContain("programs/betting/");
    expect(OFFICIAL_ORBITX_TELEGRAM_SYSTEM).toContain("ogscan.fun");
    expect(OFFICIAL_ORBITX_TELEGRAM_SYSTEM).toContain("/faq");
  });

  it("never commits a BotFather token and gates configure", () => {
    const files = [...walkSource(resolve(WEB, "api")), ...walkSource(resolve(WEB, "src")), ...walkSource(resolve(REPO, "supabase"))];
    const tokenPattern = /\b\d{8,}:AA[A-Za-z0-9_-]{20,}\b/;
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      expect(tokenPattern.test(text), file).toBe(false);
    }
    const api = readFileSync(resolve(WEB, "api/telegram-orbitx.js"), "utf8");
    expect(api).not.toContain("ORBITX BETA");
    expect(api).not.toContain("ORBITXBETA");
    expect(api).toContain("INVITE_CODE_PROMPT_HTML");
    expect(api).toContain('gate === "beta" || gate === "code"');
    const cards = readFileSync(resolve(WEB, "api/orbitx/telegram-tool-cards.js"), "utf8");
    expect(cards).not.toContain("ORBITX BETA");
    expect(cards).not.toContain("ORBITXBETA");
    const lib = readFileSync(resolve(WEB, "api/orbitx/telegram-orbitx-lib.js"), "utf8");
    expect(lib).not.toContain("ORBITX BETA");
    expect(lib).not.toContain("ORBITXBETA");
    expect(api).toContain("process.env.TELEGRAM_ORBITX_BOT_TOKEN");
    expect(api).toContain('if (!WEBHOOK_SECRET || provided !== WEBHOOK_SECRET)');
    expect(api).toContain("allowPrivileged: !isGroup && Boolean(link)");
    expect(api).toContain("telegramDmUnlockState");
    expect(api).toContain("isAllowedGatedDmCommand");
    expect(api).toContain("rejectLockedSender");
    expect(api).toContain("senderGate");
    expect(api).toContain("formatOrbitXTelegramResult");
    expect(api).toContain('bare === "login" || bare === "auth"');
    expect(api).toContain('bare === "check"');
    expect(api).toContain("OFFICIAL_ORBITX_TELEGRAM_SYSTEM");
    expect(api).toContain("wait: false");
    expect(api).toContain("async function ensureWebhook");
    expect(api).toContain("buildBrandedScan");
    expect(api).toContain("fetchTelegramTokenSnapshot");
    expect(api).toContain("alreadyHandledUpdate");
    expect(api).toContain("recentlyScanned");
    expect(api).toContain("rememberSuccessfulScan");
    expect(api).toContain("forgetScan");
    expect(api).toContain("looksLikeOrbitXCard");
    expect(api).toContain("looksLikeFailedQuoteCard");
    expect(api).toContain("shouldSkipTelegramSender");
    expect(api).toContain("isPublicGroupTrigger");
    expect(api).toContain("handleMyChatMember");
    expect(api).toContain("my_chat_member");
    expect(api).toContain("message_thread_id");
    expect(api).toContain("allow_sending_without_reply");
    expect(api).toContain('from "./orbitx/x-agent-lib.js"');
    const snap = readFileSync(resolve(WEB, "api/orbitx/telegram-token-snapshot.js"), "utf8");
    expect(snap).toContain("price/v3");
    expect(snap).toContain("token-pairs/v1");
    expect(snap).toContain("fetchQuoteBundle");
    expect(snap).toContain("overlayJupiterPrice");
    expect(snap).toContain("JUP_PRICE_API");
    expect(snap).toContain("price.jup.ag/v6");
    expect(snap).not.toContain("OrbitXTelegram/1.0");
    const branded = api.slice(api.indexOf("async function buildBrandedScan"), api.indexOf("async function handleVerify"));
    expect(branded).toContain("fetchTelegramTokenSnapshot");
    expect(branded).not.toContain("orbitx_get_token");
    expect(branded).not.toContain("orbitx_xray");
    expect(branded).not.toContain("orbitx_get_forensics");
    expect(branded).not.toContain("runTool");
    expect(api).toContain("handleVerify");
    expect(api).toContain("orbitx_token_verifications");
    expect(api).toContain("TOKEN_INTEL_TOOLS");
    expect(api).toContain("orbitXFaqSystemAddon");
    expect(api).toContain("formatOrbitXFaqHtml");
    expect(api).toContain("resolveOrbitXToolName");
    expect(api).toContain("handleAutoBuy");
    expect(api).toContain("auto_buy");
    expect(api).toContain("web.autobuy");
    expect(api).toContain("handleCallbackQuery");
    expect(api).toContain("formatToolMenu");
    expect(api).toContain("missingToolInput");
    expect(api).toContain("sendCard");
    expect(api).not.toContain("8595161432");
  });

  it("wraps Telegram Auto-sign links in Phantom browse URLs", () => {
    const page = "https://www.orbitx.world/agent/sign?action=buy&mint=13H4WJvGEg4xrrBwWn2vsQgz7xhmhxgNdw19i1QsxPX9&amount=0.05&auto=1";
    const wrapped = phantomBrowseUrl(page);
    expect(wrapped.startsWith("https://phantom.app/ul/browse/")).toBe(true);
    expect(wrapped).toContain(encodeURIComponent(page));
    expect(phantomBrowseUrl(wrapped)).toBe(wrapped);
  });
});

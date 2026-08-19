import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import {
  argsFromCommand,
  applyDefaultBuyAmount,
  cmdsPage,
  extractMint,
  formatMediaCountdown,
  formatOrbitXFaqHtml,
  formatOrbitXTelegramResult,
  formatTokenCard,
  inferPublicTool,
  isPrivilegedTelegramTool,
  isPublicTelegramTool,
  isTelegramAdminWallet,
  loginCode,
  mediaEtaSeconds,
  mergeTokenScanPayloads,
  ORBITX_FAQ_CHUNKS,
  ORBITX_FAQ_CORE,
  ORBITX_FAQ_SECTIONS,
  orbitXFaqSystemAddon,
  parseCallInvocation,
  resolveOfficialCommand,
  selectOrbitXFaqChunks,
} from "../../api/orbitx/telegram-orbitx-lib.js";
import { isAgentTelegramToolAllowed } from "../../api/orbitx/telegram-mcp-allowlist.js";
import { formatOrbitXLinksHtml, OFFICIAL_ORBITX_TELEGRAM_SYSTEM } from "../../api/orbitx/orbitx-telegram-knowledge.js";

const WEB = resolve(__dirname, "../..");
const REPO = resolve(WEB, "..");

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
    expect(extractMint("scan this 13H4WJvGEg4xrrBwWn2vsQgz7xhmhxgNdw19i1QsxPX9 please")).toBe(
      "13H4WJvGEg4xrrBwWn2vsQgz7xhmhxgNdw19i1QsxPX9",
    );
    expect(isTelegramAdminWallet("jYbHk588JspmzG5ibjPpKpCrjNP7epAjBT8Syvu7GUb")).toBe(true);
    expect(isTelegramAdminWallet("So11111111111111111111111111111111111111112")).toBe(false);
  });

  it("maps /trade CA to a real buy tool with mint + default SOL amount", () => {
    const mint = "13H4WJvGEg4xrrBwWn2vsQgz7xhmhxgNdw19i1QsxPX9";
    expect(argsFromCommand("trade", `/trade ${mint}`)).toMatchObject({ mint, ca: mint });
    expect(argsFromCommand("trade", `/trade ${mint} 0.1`)).toMatchObject({ mint, amountSol: 0.1 });
    expect(applyDefaultBuyAmount("orbitx_trade", { mint })).toMatchObject({ mint, amountSol: 0.05 });
    expect(applyDefaultBuyAmount("orbitx_prepare_buy", { mint, amountSol: 0.25 }).amountSol).toBe(0.25);
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
    const card = formatTokenCard(payload);
    const text = formatOrbitXTelegramResult(payload);
    expect(card).toContain("ORBITX");
    expect(card).toContain("Price");
    expect(card).toContain("MC");
    expect(card).toContain("mint revoked");
    expect(card).toContain("Top 10");
    expect(card).toContain("DexScreener");
    expect(card).not.toContain('"priceUsd"');
    expect(card).not.toContain('"holderCount"');
    expect(text).toBe(card);
    expect(text.startsWith("{")).toBe(false);
    expect(formatOrbitXTelegramResult({ ok: true, result: payload })).toContain("Holders");

    const branded = formatTokenCard(
      mergeTokenScanPayloads({
        token: { ...payload, athMcap: 210_000, athPrice: 0.00022 },
        xray: {
          mint: payload.mint,
          verdict: "Looks clean",
          concentration: { top10Pct: 31.1, whales: 4 },
          bundles: { pct: 12, count: 3 },
          dev: { wallet: "BC8FPb72MEZbExy21aeKTEVrG7cubSjrZxBBj51uA225", pct: 0, sold: true },
        },
        forensics: {
          mint: payload.mint,
          dexPaid: { paid: true, services: [{ type: "tokenProfile", status: "approved" }] },
          concentration: { whales: 4, top10Pct: 31.1 },
        },
        boosts: { boosts: [{ mint: payload.mint, tier: "24h" }] },
        verified: { mint: payload.mint, verified_by_wallet: "jYbHk588JspmzG5ibjPpKpCrjNP7epAjBT8Syvu7GUb" },
      }),
    );
    expect(branded).toContain("OrbitX Verified");
    expect(branded).toContain("ATH");
    expect(branded).toContain("Whales");
    expect(branded).toContain("Bundles");
    expect(branded).toContain("KOLs");
    expect(branded).toContain("Boosts");
    expect(branded).toContain("DEX paid");
    expect(branded).toContain("24h");
    expect(branded.startsWith("{")).toBe(false);
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
  });

  it("formats dex charts and media countdowns without iframes or raw JSON", () => {
    const chart = formatOrbitXTelegramResult({
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
    });
    expect(chart).toContain("DexScreener");
    expect(chart).toContain("ORBITX");
    expect(chart).not.toMatch(/<iframe/i);
    expect(chart.startsWith("{")).toBe(false);

    const waiting = formatOrbitXTelegramResult({
      ok: true,
      kind: "image",
      taskId: "task-1",
      state: "waiting",
      pending: true,
      startedAt: Date.now(),
      etaSeconds: mediaEtaSeconds("image"),
    });
    expect(waiting).toContain("Elapsed");
    expect(waiting).toContain("/check");
    expect(waiting).toContain("task-1");
    expect(waiting.startsWith("{")).toBe(false);

    const actions = formatOrbitXTelegramResult({
      ok: true,
      message: "Sign this buy on OrbitX",
      signUrl: "https://www.orbitx.world/trade?sign=1",
      openUrl: "https://www.orbitx.world/trade",
    });
    expect(actions).toContain("Sign");
    expect(actions).toContain("https://www.orbitx.world/trade");
    expect(actions.startsWith("{")).toBe(false);

    const tick = formatMediaCountdown({
      kind: "video",
      taskId: "vid-9",
      startedAt: Date.now() - 15_000,
      etaSeconds: 240,
      state: "waiting",
    });
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
    expect(api).toContain("process.env.TELEGRAM_ORBITX_BOT_TOKEN");
    expect(api).toContain('if (!WEBHOOK_SECRET || provided !== WEBHOOK_SECRET)');
    expect(api).toContain("allowPrivileged: !isGroup && Boolean(link)");
    expect(api).toContain("formatOrbitXTelegramResult");
    expect(api).toContain('bare === "login" || bare === "auth"');
    expect(api).toContain('bare === "check"');
    expect(api).toContain("OFFICIAL_ORBITX_TELEGRAM_SYSTEM");
    expect(api).toContain("wait: false");
    expect(api).toContain("async function ensureWebhook");
    expect(api).toContain("buildBrandedScan");
    expect(api).toContain("handleVerify");
    expect(api).toContain("orbitx_token_verifications");
    expect(api).toContain("TOKEN_INTEL_TOOLS");
    expect(api).toContain("orbitXFaqSystemAddon");
    expect(api).toContain("formatOrbitXFaqHtml");
    expect(api).toContain("resolveOrbitXToolName");
    expect(api).toContain("handleAutoBuy");
    expect(api).toContain("auto_buy");
    const imgLines = api.match(/\/img prompt · \/vid prompt/g) || [];
    expect(imgLines.length).toBe(1);
    expect(api).not.toContain("8595161432");
  });
});

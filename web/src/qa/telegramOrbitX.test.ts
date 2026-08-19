import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import {
  argsFromCommand,
  formatOrbitXTelegramResult,
  formatTokenCard,
  inferPublicTool,
  isPrivilegedTelegramTool,
  isPublicTelegramTool,
  loginCode,
  parseCallInvocation,
  resolveOfficialCommand,
} from "../../api/orbitx/telegram-orbitx-lib.js";

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
    expect(resolveOfficialCommand("auth").kind).toBe("meta");
    expect(resolveOfficialCommand("login").kind).toBe("meta");
    expect(argsFromCommand("img", "/img neon saturn")).toMatchObject({ prompt: "neon saturn" });
    expect(parseCallInvocation("/call get_token mint=So111").tool).toBe("orbitx_get_token");
    expect(inferPublicTool("generate an image of a cyan planet")?.tool).toBe("orbitx_generate_image");
    expect(inferPublicTool("So11111111111111111111111111111111111111112")?.tool).toBe("orbitx_get_token");
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
    expect(card).toContain("mint revoked");
    expect(card).not.toContain('"priceUsd"');
    expect(text).toBe(card);
    expect(text.startsWith("{")).toBe(false);
    expect(formatOrbitXTelegramResult({ ok: true, result: payload })).toContain("Holders");
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
    expect(api).toContain("formatOrbitXTelegramResult(result)");
    expect(api).toContain("bare === \"login\" || bare === \"auth\"");
    expect(api).toContain("async function ensureWebhook");
    expect(api).not.toContain("8595161432");
  });
});

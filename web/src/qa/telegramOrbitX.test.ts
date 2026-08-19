import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import {
  argsFromCommand,
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
    expect(argsFromCommand("img", "/img neon saturn")).toMatchObject({ prompt: "neon saturn" });
    expect(parseCallInvocation("/call get_token mint=So111").tool).toBe("orbitx_get_token");
    expect(inferPublicTool("generate an image of a cyan planet")?.tool).toBe("orbitx_generate_image");
    expect(inferPublicTool("So11111111111111111111111111111111111111112")?.tool).toBe("orbitx_get_token");
  });

  it("issues alphanumeric login codes without a bot token", () => {
    const code = loginCode();
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);
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
    expect(api).not.toContain("8595161432");
  });
});

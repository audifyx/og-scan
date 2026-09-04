import { describe, expect, it } from "vitest";
import {
  classifyOrbitXAuthPaste,
  extractAgentLinkAuthCode,
  extractTelegramLoginCode,
  isTelegramLoginPaste,
  TELEGRAM_LOGIN_NOT_MCP_MESSAGE,
  telegramLoginUrl,
} from "../../api/orbitx/orbitx-auth-links.js";

describe("OrbitX auth paste classifier", () => {
  it("reads Telegram /login links that Telegram Desktop or a PC paste might mangle", () => {
    const code = "AB3DK2PQ";
    expect(extractTelegramLoginCode(`https://www.orbitx.world/telegram?code=${code}`)).toBe(code);
    expect(extractTelegramLoginCode(`https://orbitx.world/telegram?code=${code}`)).toBe(code);
    expect(extractTelegramLoginCode(`www.orbitx.world/telegram?code=${code}`)).toBe(code);
    expect(extractTelegramLoginCode(`https://www.orbitx.world/telegram?code=${code}&amp;x=1`)).toBe(code);
    expect(
      extractTelegramLoginCode(`https://t.me/iv?url=${encodeURIComponent(`https://www.orbitx.world/telegram?code=${code}`)}`),
    ).toBe(code);
    expect(telegramLoginUrl(code)).toBe(`https://www.orbitx.world/telegram?code=${code}`);
    expect(isTelegramLoginPaste(`https://www.orbitx.world/telegram?code=${code}`)).toBe(true);
  });

  it("does not confuse Telegram login with Grok MCP auth", () => {
    const tg = classifyOrbitXAuthPaste("https://www.orbitx.world/telegram?code=AB3DK2PQ");
    expect(tg.kind).toBe("telegram_login");
    expect(tg.code).toBe("AB3DK2PQ");
    expect(TELEGRAM_LOGIN_NOT_MCP_MESSAGE).toMatch(/Telegram bot login link/);

    const mcp = classifyOrbitXAuthPaste("https://www.orbitx.world/agent/link-auth?code=oxlink_abc123");
    expect(mcp.kind).toBe("agent_link");
    expect(mcp.code).toBe("oxlink_abc123");
    expect(extractAgentLinkAuthCode("authCode: oxlink_from_dashboard")).toBe("oxlink_from_dashboard");
  });

  it("keeps Telegram tool aliases imported so /api/mcp can boot", async () => {
    const hub = await import("../../api/orbitx-hub.js");
    expect(hub.resolveOrbitXToolName("orbitx_trade")).toBe("orbitx_prepare_buy");
    expect(hub.listAllOrbitXTools().length).toBeGreaterThan(10);
  });
});

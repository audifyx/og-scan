import { describe, expect, it } from "vitest";
import { formatMcpPushText, shouldPushMcpToTelegram } from "./mcp-telegram-push.js";

describe("MCP → Telegram push", () => {
  it("skips Telegram-originated and noisy tools", () => {
    expect(shouldPushMcpToTelegram("orbitx_get_token", "mcp")).toBe(true);
    expect(shouldPushMcpToTelegram("orbitx_buy", "bearer")).toBe(true);
    expect(shouldPushMcpToTelegram("orbitx_get_token", "telegram")).toBe(false);
    expect(shouldPushMcpToTelegram("orbitx_get_token", "telegram_public")).toBe(false);
    expect(shouldPushMcpToTelegram("search", "mcp")).toBe(false);
    expect(shouldPushMcpToTelegram("orbitx_menu", "mcp")).toBe(false);
    expect(shouldPushMcpToTelegram("orbitx_telegram_send", "mcp")).toBe(false);
    expect(shouldPushMcpToTelegram("orbitx_auth_status", "mcp")).toBe(false);
  });

  it("formats a compact HTML card for the official bot", () => {
    const text = formatMcpPushText("orbitx_get_token", { symbol: "ORBITX", message: "ok" });
    expect(text).toContain("MCP · orbitx_get_token");
    expect(text.length).toBeLessThanOrEqual(3500);
  });
});

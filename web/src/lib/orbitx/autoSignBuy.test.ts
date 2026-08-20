import { describe, expect, it } from "vitest";
import {
  agentSignPath,
  ensureAutoSignUrl,
  isAutoBuyResult,
  isDashboardAutoBuyTool,
  pickBuySignHref,
} from "./autoSignBuy";

describe("autoSignBuy", () => {
  it("forces auto=1 on sign URLs", () => {
    expect(ensureAutoSignUrl("https://www.orbitx.world/agent/sign?action=buy&amount=0.05")).toContain("auto=1");
    expect(ensureAutoSignUrl("/agent/sign?action=buy")).toBe("/agent/sign?action=buy&auto=1");
    expect(ensureAutoSignUrl("https://www.orbitx.world/agent/sign?auto=1&action=buy")).toContain("auto=1");
  });

  it("picks autoSignUrl when the dashboard toggle is on — never the manual Sign page", () => {
    const payload = {
      openUrl: "https://www.orbitx.world/agent/sign?action=buy",
      signUrl: "https://www.orbitx.world/agent/sign?action=buy",
      autoSignUrl: "https://www.orbitx.world/agent/sign?action=buy&auto=1",
    };
    expect(pickBuySignHref(payload, true)).toContain("auto=1");
    expect(pickBuySignHref(payload, false)).not.toContain("auto=1");
  });

  it("stays on /agent/sign in this SPA so the connected wallet is reused", () => {
    expect(agentSignPath("https://www.orbitx.world/agent/sign?action=buy&auto=1")).toBe(
      "/agent/sign?action=buy&auto=1",
    );
    expect(agentSignPath("/agent/sign?kind=mcp-access&auto=1")).toBe("/agent/sign?kind=mcp-access&auto=1");
    expect(agentSignPath("https://phantom.app/ul/browse/https%3A%2F%2Fexample.com")).toBeNull();
  });

  it("detects auto-buy prepare payloads", () => {
    expect(isAutoBuyResult({ confirmMode: "auto" })).toBe(true);
    expect(isAutoBuyResult({ status: "awaiting_auto_phantom" })).toBe(true);
    expect(isAutoBuyResult({ confirmMode: "sign" })).toBe(false);
    expect(isDashboardAutoBuyTool("orbitx_buy_orbitx")).toBe(true);
    expect(isDashboardAutoBuyTool("orbitx_mcp_access_buy")).toBe(true);
    expect(isDashboardAutoBuyTool("orbitx_get_token")).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import {
  AGENT_MODES,
  detectMint,
  loadAgentMode,
  matchSlashCommands,
  saveAgentMode,
  suggestFollowUps,
} from "@/lib/orbitxAiStudio";

describe("OrbitX AI studio helpers", () => {
  it("detects Solana mints in mixed composer text", () => {
    expect(
      detectMint("chart DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263 please"),
    ).toBe("DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263");
    expect(detectMint("no mint here")).toBeNull();
  });

  it("matches slash commands until an argument is typed", () => {
    expect(matchSlashCommands("/ch").map((item) => item.cmd)).toContain("/chart");
    expect(matchSlashCommands("/chart")).toHaveLength(1);
    expect(matchSlashCommands("/chart BONK")).toEqual([]);
    expect(matchSlashCommands("chart BONK")).toEqual([]);
  });

  it("suggests follow-ups from live tool context", () => {
    const ideas = suggestFollowUps("Liquidity looks thin on this chart.", ["orbitx_dex_chart"]);
    expect(ideas.length).toBeGreaterThan(0);
    expect(ideas.some((idea) => /risk|liquidity/i.test(idea))).toBe(true);
  });

  it("keeps a starter prompt for every agent mode", () => {
    expect(AGENT_MODES.map((mode) => mode.id)).toEqual([
      "auto",
      "research",
      "trade",
      "create",
      "social",
    ]);
    for (const mode of AGENT_MODES) {
      expect(mode.starter.length).toBeGreaterThan(8);
    }
  });

  it("persists a valid agent mode", () => {
    saveAgentMode("research");
    expect(loadAgentMode()).toBe("research");
    window.localStorage.setItem("orbitx-ai-mode", "not-a-mode");
    expect(loadAgentMode()).toBe("auto");
  });
});

import { describe, expect, it } from "vitest";
import {
  isEmbeddedAgentToolReadOnly,
  listEmbeddedAgentTools,
} from "../../api/orbitx-hub.js";

describe("OrbitX AI embedded MCP catalog", () => {
  it("makes the complete generated catalog discoverable", () => {
    const core = listEmbeddedAgentTools();
    const complete = listEmbeddedAgentTools({ includeGenerated: true });

    expect(core.length).toBeGreaterThan(50);
    expect(complete.length).toBeGreaterThan(core.length);
    expect(complete.some((tool) => tool.name === "orbitx_chart_1h_solana")).toBe(true);
  });

  it("runs generated reads immediately but guards transaction builders", () => {
    expect(isEmbeddedAgentToolReadOnly("orbitx_chart_1h_solana")).toBe(true);
    expect(isEmbeddedAgentToolReadOnly("orbitx_screen_trending_5m_base")).toBe(true);
    expect(isEmbeddedAgentToolReadOnly("orbitx_buy_auto")).toBe(false);
    expect(isEmbeddedAgentToolReadOnly("orbitx_create_token_custom")).toBe(false);
  });
});

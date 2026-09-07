import { describe, expect, it } from "vitest";
import { layoutLiveCity, liveCityClimate } from "./orbitx-live-city.js";

describe("live agent city layout", () => {
  it("grows a street grid, parks, and coin towers from trades", () => {
    const empty = layoutLiveCity({ now: Date.parse("2026-09-07T12:00:00Z") });
    expect(empty.climate.phase).toBe("day");
    expect(empty.roads.length).toBeGreaterThan(6);
    expect(empty.buildings.some((b) => b.kind === "solscan")).toBe(true);
    expect(empty.buildings.length).toBeGreaterThan(8);
    const grown = layoutLiveCity({
      now: Date.parse("2026-09-07T12:00:00Z"),
      agents: [
        { id: "neon-live", name: "NEON LIVE", color: "#34d399" },
        { id: "warden-live", name: "WARDEN LIVE", color: "#fb7185" },
        { id: "raid-live", name: "RAID LIVE", color: "#fbbf24" },
      ],
      fills: [
        { side: "buy", mint: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN", symbol: "JUP", usd_amount: 1.5, agent_id: "neon-live" },
        { side: "buy", mint: "Dz9mQ9NzkBcCsuGPFJ3r1bS4wgqKMHBPiVuniW8Mbonk", symbol: "USELESS", usd_amount: 1.5, agent_id: "warden-live" },
      ],
    });
    expect(grown.built).toBe(2);
    expect(grown.generation).toBeGreaterThan(empty.generation);
    expect(grown.buildings.some((b) => b.symbol === "JUP" && b.height > 4)).toBe(true);
    expect(grown.trees.length).toBeGreaterThan(0);
    expect(liveCityClimate(Date.parse("2026-09-07T02:00:00Z")).phase).toBe("night");
  });
});

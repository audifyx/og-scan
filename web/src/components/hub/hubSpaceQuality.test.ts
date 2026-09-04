import { describe, expect, it } from "vitest";
import { isCompactSpaceViewport, resolveSpaceQuality } from "./hubSpaceQuality";

describe("hub space quality", () => {
  it("drops star and dust counts on compact viewports", () => {
    const desktop = resolveSpaceQuality({ width: 1440, reduced: false });
    const mobile = resolveSpaceQuality({ width: 390, reduced: false });
    expect(isCompactSpaceViewport(390)).toBe(true);
    expect(mobile.starCount).toBeLessThan(desktop.starCount);
    expect(mobile.dustCount).toBeLessThan(desktop.dustCount);
    expect(mobile.dprMax).toBeLessThanOrEqual(desktop.dprMax);
  });

  it("calms the scene when motion is reduced", () => {
    const live = resolveSpaceQuality({ width: 1440, reduced: false });
    const calm = resolveSpaceQuality({ width: 1440, reduced: true });
    expect(calm.starCount).toBeLessThan(live.starCount);
    expect(calm.nebulaCount).toBeLessThan(live.nebulaCount);
  });
});

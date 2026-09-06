import { describe, expect, it } from "vitest";
import {
  WHEEL_INNER_KEYS,
  hitTestWheel,
  sliceIndex,
  sliceMidDeg,
  splitWheelApps,
  wheelAngleDeg,
} from "./appWheel";
import { publicPlatformApps } from "./orbitxPlatforms";

describe("GTA app wheel geometry", () => {
  it("measures 0° straight up and clockwise", () => {
    expect(wheelAngleDeg(0, -10)).toBeCloseTo(0, 5);
    expect(wheelAngleDeg(10, 0)).toBeCloseTo(90, 5);
    expect(wheelAngleDeg(0, 10)).toBeCloseTo(180, 5);
    expect(wheelAngleDeg(-10, 0)).toBeCloseTo(270, 5);
  });

  it("centers slice 0 on the top of an 8-slot wheel", () => {
    expect(sliceIndex(0, 8)).toBe(0);
    expect(sliceIndex(10, 8)).toBe(0);
    expect(sliceIndex(44, 8)).toBe(1);
    expect(sliceIndex(350, 8)).toBe(0);
  });

  it("puts Hub, DEX, City, Agents on the inner ring", () => {
    const apps = [{ key: "hub" }, ...publicPlatformApps()];
    const { inner, outer } = splitWheelApps(apps);
    expect(inner.map((a) => a.key)).toEqual([...WHEEL_INNER_KEYS]);
    expect(outer.some((a) => a.key === "dex")).toBe(false);
    expect(outer.some((a) => a.key === "launchpad")).toBe(true);
    expect(outer.some((a) => a.key === "predict")).toBe(true);
    expect(inner.length + outer.length).toBe(apps.length);
  });

  it("hit-tests hub, inner, outer, and miss from disc center", () => {
    const r = 200;
    expect(hitTestWheel(0, 0, r, 8, 12).ring).toBe("hub");
    expect(hitTestWheel(0, -90, r, 8, 12)).toEqual({ ring: "inner", index: 0 });
    expect(hitTestWheel(0, -170, r, 8, 12)).toEqual({ ring: "outer", index: 0 });
    expect(hitTestWheel(0, -400, r, 8, 12).ring).toBe("none");
  });

  it("places the first slice mid-angle at the top", () => {
    expect(sliceMidDeg(8, 0)).toBe(0);
    expect(sliceMidDeg(8, 2)).toBe(90);
  });
});

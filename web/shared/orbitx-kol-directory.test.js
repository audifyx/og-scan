import { describe, expect, it } from "vitest";
import { ORBITX_KOLS, activeOrbitxKols, isAssignedKol, trackedRowsFromDirectory } from "./orbitx-kol-directory.js";

describe("orbitx-kol-directory", () => {
  it("keeps disputed wallets out of the assigned KOL watchlist", () => {
    expect(ORBITX_KOLS.some((k) => k.status === "disputed")).toBe(true);
    expect(activeOrbitxKols().every((k) => k.status === "active")).toBe(true);
    expect(isAssignedKol("AVAZvHLR2PcWpDf8BXY4rVxNHYRBytycHkcB5z5QNXYm")).toBe(false);
    expect(isAssignedKol("GV6UUmNxz2RpKxmNAPadYKb7uQpszwqQAu3qLJxVdC52")).toBe(true);
  });

  it("exports every assigned KOL as a tracked row", () => {
    const rows = trackedRowsFromDirectory();
    expect(rows.length).toBeGreaterThanOrEqual(30);
    expect(rows.every((r) => r.label_kind === "KOL" && r.address.length >= 32)).toBe(true);
  });
});

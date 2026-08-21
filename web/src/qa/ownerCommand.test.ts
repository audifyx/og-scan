import { describe, expect, it } from "vitest";
import {
  appFromPath,
  deviceFromUserAgent,
  presenceStatus,
  PRESENCE_AWAY_MS,
  PRESENCE_ONLINE_MS,
} from "../../api/orbitx/owner-command.js";

describe("owner command presence rules", () => {
  it("marks online / away / offline from heartbeat age", () => {
    const now = Date.now();
    expect(presenceStatus(new Date(now - 10_000).toISOString(), now)).toBe("online");
    expect(presenceStatus(new Date(now - PRESENCE_ONLINE_MS - 1).toISOString(), now)).toBe("away");
    expect(presenceStatus(new Date(now - PRESENCE_AWAY_MS - 1).toISOString(), now)).toBe("offline");
    expect(presenceStatus(null, now)).toBe("offline");
  });

  it("maps paths to applications", () => {
    expect(appFromPath("/ORBITX_DEX/token/abc")).toBe("dex");
    expect(appFromPath("/play")).toBe("games");
    expect(appFromPath("/hq")).toBe("communities");
    expect(appFromPath("/os")).toBe("os");
    expect(appFromPath("/unknown-page")).toBe("app");
  });

  it("classifies user agents", () => {
    expect(deviceFromUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)")).toBe("mobile");
    expect(deviceFromUserAgent("Mozilla/5.0 (Windows NT 10.0) Chrome/120")).toBe("desktop");
    expect(deviceFromUserAgent("")).toBe("unknown");
  });
});

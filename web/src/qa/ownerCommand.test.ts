import { describe, expect, it } from "vitest";
import {
  appFromPath,
  calendarBounds,
  creditHeartbeatMs,
  deviceFromUserAgent,
  formatClock,
  hoursFromMs,
  HOUR_MS,
  presenceStatus,
  PRESENCE_AWAY_MS,
  PRESENCE_ONLINE_MS,
  sessionAgeMs,
  sessionMsInWindow,
  stayedHourAmong,
  stayedLongerThanHour,
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

describe("owner engagement windows and session math", () => {
  it("uses UTC calendar week (Monday) and month", () => {
    const wed = calendarBounds(new Date("2026-08-19T15:00:00.000Z"));
    expect(wed.today).toBe("2026-08-19T00:00:00.000Z");
    expect(wed.week).toBe("2026-08-17T00:00:00.000Z");
    expect(wed.month).toBe("2026-08-01T00:00:00.000Z");
    const sun = calendarBounds(new Date("2026-08-16T01:00:00.000Z"));
    expect(sun.week).toBe("2026-08-10T00:00:00.000Z");
  });

  it("credits heartbeats without inventing offline gaps", () => {
    const now = Date.parse("2026-08-22T12:00:00.000Z");
    expect(creditHeartbeatMs(new Date(now - 15_000).toISOString(), now)).toBe(15_000);
    expect(creditHeartbeatMs(new Date(now - 45_000).toISOString(), now)).toBe(20_000);
    expect(creditHeartbeatMs(new Date(now - PRESENCE_AWAY_MS - 1).toISOString(), now)).toBe(0);
    expect(creditHeartbeatMs(null, now)).toBe(0);
  });

  it("measures session age and window overlap", () => {
    const now = Date.parse("2026-08-22T12:00:00.000Z");
    expect(sessionAgeMs(new Date(now - 90 * 60_000).toISOString(), now)).toBe(90 * 60_000);
    expect(
      sessionMsInWindow(
        { started_at: "2026-08-22T10:00:00.000Z", ended_at: "2026-08-22T11:30:00.000Z" },
        "2026-08-22T00:00:00.000Z",
        now,
      ),
    ).toBe(90 * 60_000);
    expect(
      sessionMsInWindow(
        { started_at: "2026-08-21T22:00:00.000Z", ended_at: "2026-08-22T01:00:00.000Z" },
        "2026-08-22T00:00:00.000Z",
        now,
      ),
    ).toBe(60 * 60_000);
  });

  it("counts signups who stayed longer than an hour from recorded ms", () => {
    expect(stayedLongerThanHour(HOUR_MS)).toBe(true);
    expect(stayedLongerThanHour(HOUR_MS - 1)).toBe(false);
    expect(
      stayedHourAmong(
        [{ user_id: "a" }, { user_id: "b" }, { user_id: "c" }],
        [
          { user_id: "a", total_online_ms: HOUR_MS },
          { user_id: "b", total_online_ms: 10_000 },
        ],
      ),
    ).toBe(1);
    expect(hoursFromMs(HOUR_MS * 2.5)).toBe(2.5);
    expect(formatClock(90 * 60_000)).toBe("1h 30m");
  });
});

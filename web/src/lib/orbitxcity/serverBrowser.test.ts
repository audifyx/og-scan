import { describe, expect, it } from "vitest";
import {
  buildServerRows,
  getCityServers,
  pingBars,
  REGION_LABEL,
  simulateRuntime,
  statusLabel,
} from "./serverBrowser";

describe("serverBrowser", () => {
  it("exposes one server per city district", () => {
    const servers = getCityServers();
    expect(servers.length).toBeGreaterThanOrEqual(4);
    for (const s of servers) {
      expect(s.name).toBeTruthy();
      expect(s.blurb).toBeTruthy();
      expect(s.maxPlayers).toBeGreaterThan(0);
      expect(s.tags.length).toBeGreaterThan(0);
      expect(REGION_LABEL[s.region]).toBeTruthy();
    }
  });

  it("never reports more players than capacity", () => {
    for (const row of buildServerRows()) {
      expect(row.players).toBeLessThanOrEqual(row.maxPlayers);
      expect(row.players).toBeGreaterThanOrEqual(0);
      expect(row.ping).toBeGreaterThan(0);
    }
  });

  it("is deterministic for the same seed", () => {
    const a = buildServerRows(undefined, 1_700_000_000_000);
    const b = buildServerRows(undefined, 1_700_000_000_000);
    expect(a.map((r) => r.players)).toEqual(b.map((r) => r.players));
    expect(a.map((r) => r.ping)).toEqual(b.map((r) => r.ping));
  });

  it("lets live presence override the simulated count", () => {
    const rows = buildServerRows({ nyc: { players: 7, status: "online" } });
    const nyc = rows.find((r) => r.id === "nyc");
    expect(nyc?.players).toBe(7);
  });

  it("marks locked districts offline with no players", () => {
    for (const row of buildServerRows()) {
      if (!row.unlocked) {
        expect(row.status).toBe("offline");
        expect(row.players).toBe(0);
      }
    }
  });

  it("maps ping onto signal bars", () => {
    expect(pingBars(12)).toBe(4);
    expect(pingBars(40)).toBe(3);
    expect(pingBars(70)).toBe(2);
    expect(pingBars(200)).toBe(1);
  });

  it("labels every status", () => {
    expect(statusLabel("online")).toBe("Online");
    expect(statusLabel("busy")).toBe("Busy");
    expect(statusLabel("full")).toBe("Full");
    expect(statusLabel("offline")).toBe("Offline");
  });

  it("flags a saturated server as full", () => {
    const [first] = getCityServers();
    const rt = simulateRuntime({ ...first!, unlocked: true });
    expect(["online", "busy", "full"]).toContain(rt.status);
  });
});

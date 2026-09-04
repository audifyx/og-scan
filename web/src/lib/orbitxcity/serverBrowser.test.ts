import { describe, expect, it } from "vitest";
import {
  buildServerRows,
  getCityServers,
  occupancyLabel,
  REGION_LABEL,
  statusLabel,
  totalPlayers,
} from "./serverBrowser";

describe("serverBrowser", () => {
  it("exposes one server per city district", () => {
    const servers = getCityServers();
    expect(servers.length).toBeGreaterThanOrEqual(4);
    for (const s of servers) {
      expect(s.name).toBeTruthy();
      expect(s.blurb).toBeTruthy();
      expect(s.maxPlayers).toBeGreaterThan(0);
      expect(s.lobbyId).toBeTruthy();
      expect(REGION_LABEL[s.region]).toBeTruthy();
    }
  });

  it("reports zero players and no live flag without a directory", () => {
    const rows = buildServerRows(undefined);
    expect(totalPlayers(rows)).toBe(0);
    for (const r of rows) {
      expect(r.players).toBe(0);
      expect(r.live).toBe(false);
      expect(occupancyLabel(r)).toBe(r.unlocked ? "—" : "Locked");
    }
  });

  it("never invents traffic for an empty directory", () => {
    const rows = buildServerRows([]);
    expect(totalPlayers(rows)).toBe(0);
    for (const r of rows) {
      if (r.unlocked) expect(r.status).toBe("empty");
    }
  });

  it("uses real per-lobby counts from the directory", () => {
    const [first] = getCityServers();
    const rows = buildServerRows([
      { id: first!.lobbyId, label: "Main", isPrivate: false, count: 5 },
    ]);
    const match = rows.find((r) => r.id === first!.id);
    expect(match?.players).toBe(5);
    expect(match?.status).toBe("online");
    expect(occupancyLabel(match!)).toBe(`5/${match!.maxPlayers}`);
    expect(totalPlayers(rows)).toBe(5);
  });

  it("escalates status as a district fills", () => {
    const [first] = getCityServers();
    const at = (count: number) =>
      buildServerRows([
        { id: first!.lobbyId, label: "Main", isPrivate: false, count },
      ]).find((r) => r.id === first!.id)!.status;

    expect(at(1)).toBe("online");
    expect(at(Math.ceil(first!.maxPlayers * 0.85))).toBe("busy");
    expect(at(first!.maxPlayers)).toBe("full");
  });

  it("marks locked districts offline with no players", () => {
    for (const row of buildServerRows([])) {
      if (!row.unlocked) {
        expect(row.status).toBe("offline");
        expect(row.players).toBe(0);
      }
    }
  });

  it("labels every status", () => {
    expect(statusLabel("online")).toBe("Online");
    expect(statusLabel("busy")).toBe("Busy");
    expect(statusLabel("full")).toBe("Full");
    expect(statusLabel("empty")).toBe("Empty");
    expect(statusLabel("offline")).toBe("Offline");
  });
});

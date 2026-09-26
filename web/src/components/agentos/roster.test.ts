/* Agent OS v2 — roster honesty: archived agents must never surface as live
   problems, and failed DM sends must surface visibly. */
import { describe, expect, it } from "vitest";
import {
  activeRoster,
  fleetTasks,
  dmErrorText,
  type AgentInfo,
  type TaskInfo,
} from "./api";

const mkAgent = (name: string, status: string, extra: Partial<AgentInfo> = {}): AgentInfo => ({
  name,
  status,
  unread: 0,
  ...extra,
});

const mkTask = (id: string, agent: string | undefined): TaskInfo => ({
  id,
  title: `task ${id}`,
  kind: "general",
  status: "open",
  created_at: new Date().toISOString(),
  ...(agent === undefined ? {} : { agent }),
});

describe("activeRoster", () => {
  it("keeps active agents, drops archived ones", () => {
    const agents = [
      mkAgent("orbitx", "active", { last_think_error: null }),
      mkAgent("modeltest-1", "archived", { last_think_error: { code: "llm_404", hint: "gone", at: "" } }),
      mkAgent("orbitx-research", "active"),
    ];
    const live = activeRoster(agents);
    expect(live.map((a) => a.name)).toEqual(["orbitx", "orbitx-research"]);
  });

  it("stale think errors on archived agents stop counting as failures", () => {
    const agents = [
      mkAgent("dead", "archived", { last_think_error: { code: "llm_404", hint: "stale", at: "" } }),
    ];
    expect(activeRoster(agents).filter((a) => a.last_think_error).length).toBe(0);
  });

  it("handles empty and unknown statuses", () => {
    expect(activeRoster([])).toEqual([]);
    expect(activeRoster([mkAgent("x", "paused")])).toEqual([]);
    expect(activeRoster([mkAgent("y", "active")]).length).toBe(1);
  });
});

describe("fleetTasks", () => {
  const agents = [mkAgent("orbitx", "active"), mkAgent("dead", "archived")];

  it("keeps only tasks owned by live agents", () => {
    const tasks = [mkTask("1", "orbitx"), mkTask("2", "dead"), mkTask("3", "orbitx")];
    expect(fleetTasks(tasks, agents).map((t) => t.id)).toEqual(["1", "3"]);
  });

  it("drops unattributed tasks (can't prove they belong to the live fleet)", () => {
    const tasks = [mkTask("1", undefined), mkTask("2", "orbitx")];
    expect(fleetTasks(tasks, agents).map((t) => t.id)).toEqual(["2"]);
  });

  it("drops tasks for unknown agent names", () => {
    const tasks = [mkTask("1", "ghost")];
    expect(fleetTasks(tasks, agents)).toEqual([]);
  });
});

describe("dmErrorText", () => {
  it("explains archived recipients plainly", () => {
    expect(dmErrorText(new Error("archived"), "dead")).toBe(
      "Can't message dead: that agent is archived.",
    );
  });

  it("surfaces other failures raw", () => {
    expect(dmErrorText(new Error("boom"), "orbitx")).toBe("Send failed: boom");
  });

  it("handles non-Error throws", () => {
    expect(dmErrorText("nope", "orbitx")).toBe("Send failed");
    expect(dmErrorText(null, "orbitx")).toBe("Send failed");
  });
});

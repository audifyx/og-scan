/* Agent OS v2 — feed-poll refetch-storm guard.
   The 2s feed poll delivers a fresh `agents` array identity every tick even
   when the roster is unchanged. Every useCallback/useEffect chain depending
   on `agents` (TasksView task lists, FilesView gallery, the palette's task
   fetch) then refires every poll instead of on its own 15-20s cadence — N
   task-list requests (plus full gallery HTML re-downloads) every 2s.
   The shell guards setAgents with rosterKey() so the state object keeps its
   identity until the roster really changes. */
import { describe, expect, it } from "vitest";
import { fireEvent, render } from "@testing-library/react";
import { useCallback, useEffect, useState } from "react";
import { rosterKey, type AgentInfo } from "./api";

const mkRoster = (unread = 0): AgentInfo[] => [
  { name: "orbitx", status: "active", unread },
  { name: "orbitx-research", status: "active", unread: 0 },
];

/* Mirrors TasksView.load / FilesView.loadGallery / AgentPlus.fetchAllTasks:
   callback dep [agents], effect dep [callback]. `poll` simulates one feed
   tick delivering a fresh-identity, identical-content roster — exactly what
   `setAgents(json.agents)` does every 2s in production. With guard=true the
   poll applies the same rosterKey() identity check the shell uses. */
function StormHarness({ onFetch, guard }: { onFetch: () => void; guard: boolean }) {
  const [agents, setAgents] = useState<AgentInfo[]>(mkRoster());
  const load = useCallback(async () => {
    onFetch(); // one burst of task-list requests in production
  }, [agents]);
  useEffect(() => {
    load();
    // The real code also arms a 15-20s interval here; it never survives past
    // the next poll because this effect re-runs on every poll.
  }, [load]);
  const poll = (changed: boolean) =>
    setAgents((prev) => {
      const next = mkRoster(changed ? 1 : 0);
      if (guard && rosterKey(prev) === rosterKey(next)) return prev;
      return next;
    });
  return (
    <div>
      <button onClick={() => poll(false)}>poll</button>
      <button onClick={() => poll(true)}>poll-change</button>
    </div>
  );
}

describe("feed-poll refetch storm", () => {
  it("documents the anti-pattern: unguarded, the fetch effect refires on every poll", () => {
    let fetches = 0;
    const { getByText } = render(<StormHarness onFetch={() => fetches++} guard={false} />);
    for (let i = 0; i < 5; i++) fireEvent.click(getByText("poll"));
    // mount + 5 polls, zero roster changes → 6 fetch bursts. This is the bug
    // the rosterKey() guard exists to prevent; do not "simplify" it away.
    expect(fetches).toBe(6);
  });

  it("guarded: one fetch across identical polls, refires on a real roster change", () => {
    let fetches = 0;
    const { getByText } = render(<StormHarness onFetch={() => fetches++} guard={true} />);
    for (let i = 0; i < 5; i++) fireEvent.click(getByText("poll"));
    expect(fetches).toBe(1);
    fireEvent.click(getByText("poll-change")); // unread 0 → 1: real change
    expect(fetches).toBe(2);
  });
});

describe("rosterKey", () => {
  it("is stable across fresh-identity, identical-content rosters", () => {
    expect(rosterKey(mkRoster())).toBe(rosterKey(mkRoster()));
  });

  it("changes when unread, status, budget, or think error changes", () => {
    const base = rosterKey(mkRoster());
    expect(rosterKey(mkRoster(3))).not.toBe(base);
    const archived = mkRoster();
    archived[0] = { ...archived[0], status: "archived" };
    expect(rosterKey(archived)).not.toBe(base);
    const budgeted = mkRoster();
    budgeted[1] = { ...budgeted[1], thinks_today: 7, think_budget_per_day: 50 };
    expect(rosterKey(budgeted)).not.toBe(base);
    const err = mkRoster();
    err[1] = {
      ...err[1],
      last_think_error: { code: "llm_unreachable", hint: "dark spell", at: "2026-09-26T00:00:00Z" },
    };
    expect(rosterKey(err)).not.toBe(base);
  });

  it("respects roster order (a reorder is a real change)", () => {
    const a = mkRoster();
    expect(rosterKey(a)).not.toBe(rosterKey([...a].reverse()));
  });
});

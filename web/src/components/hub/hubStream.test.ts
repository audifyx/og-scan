import { describe, expect, it } from "vitest";
import {
  extractSseMessages,
  reduceHubThinking,
  type HubStreamEvent,
  type HubThinking,
} from "./api";

const fresh = (): HubThinking => ({ tools: [], thoughts: [] });

describe("extractSseMessages", () => {
  it("parses events split across chunks", () => {
    const a = extractSseMessages('data: {"event":"status","text":"Thinking');
    expect(a.events).toHaveLength(0);
    const b = extractSseMessages(a.rest + '…"}\n\ndata: {"event":"token","text":"hi"}\n\n');
    expect(b.events).toHaveLength(2);
    expect(b.events[0]).toMatchObject({ event: "status", text: "Thinking…" });
    expect(b.events[1]).toMatchObject({ event: "token", text: "hi" });
    expect(b.rest).toBe("");
  });

  it("normalizes CRLF line endings", () => {
    const { events, rest } = extractSseMessages('data: {"event":"token","text":"a"}\r\n\r\ndata: {"event":"token","text":"b"}\r\n\r\n');
    expect(events.map((e) => (e as { text?: string }).text)).toEqual(["a", "b"]);
    expect(rest).toBe("");
  });

  it("skips malformed lines and non-data lines without crashing", () => {
    const { events, rest } = extractSseMessages(
      'event: token\ndata: not-json\n\ndata: {"event":"token","text":"ok"}\n\n',
    );
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ event: "token", text: "ok" });
    expect(rest).toBe("");
  });

  it("passes unknown future events through untouched", () => {
    const { events } = extractSseMessages('data: {"event":"fancy_new_thing","payload":[1,2]}\n\n');
    expect(events).toHaveLength(1);
    expect((events[0] as any).event).toBe("fancy_new_thing");
  });

  it("flushes a trailing partial message when the terminator is missing", () => {
    const { events, rest } = extractSseMessages('data: {"event":"done","result":{"ok":true}}' + "\n\n");
    expect(events).toHaveLength(1);
    expect(events[0].event).toBe("done");
    expect(rest).toBe("");
  });
});

describe("reduceHubThinking", () => {
  it("accumulates status, thoughts, tool calls", () => {
    let t = fresh();
    t = reduceHubThinking(t, { event: "status", text: "Running scan…" });
    t = reduceHubThinking(t, { event: "thought", text: "check liquidity first" } as HubStreamEvent);
    t = reduceHubThinking(t, { event: "tool_call", name: "orbitx_crypto_scan", args_summary: "ORBITX" });
    expect(t.status).toBe("Running scan…");
    expect(t.thoughts).toEqual(["check liquidity first"]);
    expect(t.tools).toHaveLength(1);
    expect(t.tools[0]).toMatchObject({ name: "orbitx_crypto_scan", running: true });
  });

  it("caps thoughts at the last 4", () => {
    let t = fresh();
    for (let i = 0; i < 6; i++) t = reduceHubThinking(t, { event: "thought", text: `t${i}` } as HubStreamEvent);
    expect(t.thoughts).toEqual(["t2", "t3", "t4", "t5"]);
  });

  it("tool_result completes only the FIRST matching running tool", () => {
    let t = fresh();
    t = reduceHubThinking(t, { event: "tool_call", name: "scan" });
    t = reduceHubThinking(t, { event: "tool_call", name: "scan" });
    t = reduceHubThinking(t, { event: "tool_result", name: "scan", ok: true, ms: 1200 });
    expect(t.tools[0]).toMatchObject({ running: false, ok: true, ms: 1200 });
    // The second same-name call is still in flight — must NOT be marked done.
    expect(t.tools[1]).toMatchObject({ running: true });
  });

  it("tool_result with no name completes the first running tool", () => {
    let t = fresh();
    t = reduceHubThinking(t, { event: "tool_call", name: "a" });
    t = reduceHubThinking(t, { event: "tool_call", name: "b" });
    t = reduceHubThinking(t, { event: "tool_result", ok: false, ms: 50 });
    expect(t.tools[0]).toMatchObject({ running: false, ok: false });
    expect(t.tools[1]).toMatchObject({ running: true });
  });

  it("ignores unknown events without crashing", () => {
    const t = fresh();
    const out = reduceHubThinking(t, { event: "fancy_new_thing" } as unknown as HubStreamEvent);
    expect(out).toEqual(t);
  });
});

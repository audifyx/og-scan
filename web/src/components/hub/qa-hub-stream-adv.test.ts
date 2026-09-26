/**
 * QA adversarial harness — hub SSE contract, frontend side (6336740 lane).
 *
 * Complements web/src/components/hub/hubStream.test.ts (happy-path coverage)
 * with adversarial cases: byte-level chunk fuzzing, line-ending hostility,
 * multi-data-line spec behavior, and reduceHubThinking edge cases the audit
 * found by reading the reducer (empty tool lists, completed-tool resurrection,
 * parallel same-name completion order, unknown-event tolerance).
 *
 * Pure + read-only: imports only the exported pure functions from ./api.
 */
import { describe, expect, it } from "vitest";
import { extractSseMessages, reduceHubThinking } from "./api";
import type { HubStreamEvent, HubThinking } from "./api";

const freshThinking = (): HubThinking => ({ status: "", thoughts: [], tools: [] });

function ev(obj: unknown): string {
  return `data: ${JSON.stringify(obj)}\n\n`;
}

describe("extractSseMessages adversarial", () => {
  const stream =
    ev({ event: "start" }) +
    ev({ event: "status", text: "Thinking…" }) +
    ev({ event: "token", text: "hel" }) +
    ev({ event: "token", text: "lo" }) +
    ev({ event: "thought", text: "plan" }) +
    ev({ event: "tool_call", name: "orbitx_crypto_scan", args_summary: '{"mint":"m"}' }) +
    ev({ event: "tool_result", name: "orbitx_crypto_scan", ok: true, ms: 123 }) +
    ev({ event: "done", result: { ok: true, reply: "hello" } });

  function parseWhole(s: string) {
    const { events, rest } = extractSseMessages(s);
    expect(rest).toBe("");
    return events;
  }

  it("parses the whole stream at once", () => {
    expect(parseWhole(stream)).toHaveLength(8);
  });

  it("is invariant under arbitrary chunk splits (seeded fuzz)", () => {
    const expected = parseWhole(stream);
    // Deterministic PRNG (mulberry32) — same splits every run.
    let seed = 0x9e3779b9;
    const rand = () => {
      seed |= 0;
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    for (let iter = 0; iter < 60; iter++) {
      let buf = "";
      const got: HubStreamEvent[] = [];
      let pos = 0;
      while (pos < stream.length) {
        const take = 1 + Math.floor(rand() * 17); // 1..17 byte chunks
        buf += stream.slice(pos, pos + take);
        pos += take;
        const parsed = extractSseMessages(buf);
        buf = parsed.rest;
        got.push(...parsed.events);
      }
      // Flush the tail exactly like hubChatStream does.
      const tail = extractSseMessages(buf + "\n\n");
      got.push(...tail.events);
      expect(got).toEqual(expected);
    }
  });

  it("handles lone-CR line endings", () => {
    const cr = stream.replace(/\n/g, "\r");
    expect(parseWhole(cr)).toHaveLength(8);
  });

  it("handles mixed CRLF/LF/CR endings", () => {
    const mixed = stream.replace(/\n\n/g, "\r\n\r\n").replace(/data: \{"event": "token"/g, 'data: {"event": "token"');
    const withCr = mixed.split("\n\n");
    const remixed = withCr.join("\r\r");
    expect(parseWhole(remixed)).toHaveLength(8);
  });

  it("tolerates leading whitespace before data:", () => {
    const { events } = extractSseMessages('   data: {"event":"start"}\n\n');
    expect(events).toHaveLength(1);
  });

  it("skips empty data: lines and comment lines", () => {
    const { events, rest } = extractSseMessages('data:\n\n: keep-alive\n\ndata: {"event":"start"}\n\n');
    expect(events).toHaveLength(1);
    expect(rest).toBe("");
  });

  it("parses JSON containing colons and escaped quotes", () => {
    const { events } = extractSseMessages(ev({ event: "status", text: 'a: b "c" \\ d' }));
    expect(events[0]).toMatchObject({ event: "status", text: 'a: b "c" \\ d' });
  });

  it("carries a partial message in rest across chunks", () => {
    const half = stream.slice(0, Math.floor(stream.length / 2));
    const first = extractSseMessages(half);
    expect(first.rest.length).toBeGreaterThan(0);
    const second = extractSseMessages(first.rest + stream.slice(Math.floor(stream.length / 2)));
    expect([...first.events, ...second.events]).toHaveLength(8);
    expect(second.rest).toBe("");
  });

  it("ignores SSE field lines that are not data:", () => {
    const { events } = extractSseMessages('event: custom\nid: 7\ndata: {"event":"start"}\n\n');
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ event: "start" });
  });

  it.fails("multiple data: lines for one event are joined with \\n per the SSE spec", () => {
    // Spec: two data: lines in one message form ONE event with joined data.
    // Current impl emits one event per data: line instead.
    const { events } = extractSseMessages('data: {"event":"sta\n data: rt"}\n\n'.replace("\n ", "\n"));
    expect(events).toHaveLength(1);
  });
});

describe("reduceHubThinking adversarial", () => {
  it("tool_result with no tools is a no-op", () => {
    const t = freshThinking();
    const out = reduceHubThinking(t, { event: "tool_result", name: "x", ok: true, ms: 1 });
    expect(out.tools).toEqual([]);
  });

  it("tool_result never resurrects an already-completed tool", () => {
    let t = freshThinking();
    t = reduceHubThinking(t, { event: "tool_call", name: "scan" });
    t = reduceHubThinking(t, { event: "tool_result", name: "scan", ok: true, ms: 5 });
    const done = reduceHubThinking(t, { event: "tool_result", name: "scan", ok: false, ms: 9 });
    expect(done.tools[0]).toMatchObject({ running: false, ok: true, ms: 5 });
  });

  it("completes parallel same-name tools in call order", () => {
    let t = freshThinking();
    t = reduceHubThinking(t, { event: "tool_call", name: "scan" });
    t = reduceHubThinking(t, { event: "tool_call", name: "scan" });
    t = reduceHubThinking(t, { event: "tool_result", name: "scan", ok: true, ms: 10 });
    expect(t.tools[0]).toMatchObject({ running: false, ms: 10 });
    expect(t.tools[1]).toMatchObject({ running: true });
    t = reduceHubThinking(t, { event: "tool_result", name: "scan", ok: false, ms: 20 });
    expect(t.tools[1]).toMatchObject({ running: false, ok: false, ms: 20 });
  });

  it("tool_result with no name completes the first running tool only", () => {
    let t = freshThinking();
    t = reduceHubThinking(t, { event: "tool_call", name: "a" });
    t = reduceHubThinking(t, { event: "tool_call", name: "b" });
    t = reduceHubThinking(t, { event: "tool_result", ok: true, ms: 3 });
    expect(t.tools[0]).toMatchObject({ running: false });
    expect(t.tools[1]).toMatchObject({ running: true });
  });

  it("records ok:false and ms on failure results", () => {
    let t = freshThinking();
    t = reduceHubThinking(t, { event: "tool_call", name: "scan" });
    t = reduceHubThinking(t, { event: "tool_result", name: "scan", ok: false, ms: 25000 });
    expect(t.tools[0]).toMatchObject({ running: false, ok: false, ms: 25000 });
  });

  it("thought events with empty text are no-ops", () => {
    const t = freshThinking();
    const out = reduceHubThinking(t, { event: "thought" });
    expect(out.thoughts).toEqual([]);
  });

  it("caps thoughts at 4 under interleaved tool activity", () => {
    let t = freshThinking();
    for (let i = 0; i < 6; i++) {
      t = reduceHubThinking(t, { event: "thought", text: `t${i}` });
      t = reduceHubThinking(t, { event: "tool_call", name: `tool${i}` });
    }
    expect(t.thoughts).toEqual(["t2", "t3", "t4", "t5"]);
    expect(t.tools).toHaveLength(6);
  });

  it("status with no text clears to empty string", () => {
    const t = reduceHubThinking(freshThinking(), { event: "status" });
    expect(t.status).toBe("");
  });

  it("token/start/done/error events are no-ops for the trace", () => {
    const t = freshThinking();
    for (const e of [
      { event: "start" },
      { event: "token", text: "hi" },
      { event: "token_reset" },
      { event: "done", result: { ok: true } },
      { event: "error", error: "llm_unreachable" },
    ] as HubStreamEvent[]) {
      expect(reduceHubThinking(t, e)).toEqual(t);
    }
  });

  it("tool_call without a name falls back to 'tool'", () => {
    const t = reduceHubThinking(freshThinking(), { event: "tool_call" });
    expect(t.tools[0].name).toBe("tool");
  });
});

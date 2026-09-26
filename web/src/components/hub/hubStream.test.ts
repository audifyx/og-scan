import { describe, expect, it } from "vitest";
import {
  extractSseMessages,
  hubDoneFailureText,
  reduceHubThinking,
  withDegradedFlag,
  type HubChatResponse,
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

describe("hubDoneFailureText — the done-with-ok:false contract", () => {
  // The backend's hub/stream route sends server-side failures (db_unavailable,
  // not_found, hub_chat_failed…) as `done` with ok:false and NO reply — NOT as
  // the `error` event (that's only for hubChat throwing outright). The client
  // must surface these honestly instead of ending on a silent empty bubble.
  it("returns null for a healthy result", () => {
    expect(hubDoneFailureText({ ok: true, reply: "hi" } as HubChatResponse)).toBeNull();
  });

  it("returns null when the failure already carries a reply (LLM-failure path)", () => {
    // hubRunLoop LLM failures return ok:false WITH a human-readable reply —
    // that reply IS the honest message, so no extra bubble is needed.
    expect(
      hubDoneFailureText({ ok: false, error: "llm_unreachable", reply: "The model timed out." } as HubChatResponse),
    ).toBeNull();
  });

  it("returns an honest message for each reply-less backend failure shape", () => {
    for (const error of ["db_unavailable", "not_found", "hub_chat_failed"]) {
      const text = hubDoneFailureText({ ok: false, error } as HubChatResponse);
      expect(text).toContain(error);
      expect(text).toContain("retry");
    }
  });

  it("falls back to 'unknown error' when the result is missing or has no error", () => {
    expect(hubDoneFailureText(null)).toContain("unknown error");
    expect(hubDoneFailureText(undefined)).toContain("unknown error");
    expect(hubDoneFailureText({ ok: false } as HubChatResponse)).toContain("unknown error");
  });

  it("treats an explicitly empty reply as a reply (backend never emits this)", () => {
    expect(hubDoneFailureText({ ok: false, reply: "" } as HubChatResponse)).toBeNull();
  });
});

describe("SSE done-failure contract end to end", () => {
  it("a failed turn's raw bytes parse into a done the client handles honestly", () => {
    // Exact bytes the hub/stream route emits when hubChat returns
    // { ok:false, error:"db_unavailable" } (Supabase down mid-turn).
    const raw =
      'data: {"event":"start"}\n\n' +
      'data: {"event":"status","text":"Thinking…"}\n\n' +
      'data: {"event":"done","result":{"ok":false,"error":"db_unavailable"}}\n\n';
    const { events } = extractSseMessages(raw);
    expect(events.map((e) => e.event)).toEqual(["start", "status", "done"]);
    const done = events[2] as Extract<HubStreamEvent, { event: "done" }>;
    // The old finalizeStream ended here on a silent empty bubble. Now the
    // contract demands an honest message instead.
    const text = hubDoneFailureText(done.result);
    expect(text).toContain("db_unavailable");
    expect(text).toContain("retry");
  });

  it("a healthy turn's done result needs no failure text", () => {
    const raw =
      'data: {"event":"start"}\n\n' +
      'data: {"event":"token","text":"hello"}\n\n' +
      'data: {"event":"done","result":{"ok":true,"thread_id":"t1","reply":"hello","tool_calls":[],"pending":[]}}\n\n';
    const { events } = extractSseMessages(raw);
    const done = events[events.length - 1] as Extract<HubStreamEvent, { event: "done" }>;
    expect(hubDoneFailureText(done.result)).toBeNull();
  });
});

describe("reduceHubThinking tolerates non-trace events", () => {
  it("no-ops on start / done / error / token / token_reset (handled by the caller)", () => {
    const t = fresh();
    for (const e of [
      { event: "start" },
      { event: "done", result: { ok: true } },
      { event: "error", error: "x" },
      { event: "token", text: "hi" },
      { event: "token_reset" },
    ] as HubStreamEvent[]) {
      expect(reduceHubThinking(t, e)).toEqual(t);
    }
  });
});

describe("withDegradedFlag — the done.result.degraded contract", () => {
  // The backend marks turns that didn't go through the normal LLM path
  // (salvaged reply with forfeited tool calls, deterministic dossier during
  // a dark spell) with degraded:true inside done.result. The client must
  // surface the flag in the thinking trace instead of ignoring it.
  it("sets the flag when the done result is degraded", () => {
    const t = fresh();
    const out = withDegradedFlag(t, { ok: true, reply: "hi", degraded: true } as HubChatResponse);
    expect(out.degraded).toBe(true);
    expect(out.tools).toEqual(t.tools);
    expect(out.thoughts).toEqual(t.thoughts);
  });

  it("leaves the trace untouched when the result is clean, missing, or explicitly not degraded", () => {
    const t = fresh();
    expect(withDegradedFlag(t, { ok: true, reply: "hi" } as HubChatResponse)).toEqual(t);
    expect(withDegradedFlag(t, { ok: true, degraded: false } as HubChatResponse)).toEqual(t);
    expect(withDegradedFlag(t, null)).toEqual(t);
    expect(withDegradedFlag(t, undefined)).toEqual(t);
  });

  it("a degraded done's raw bytes parse and the flag flows end to end", () => {
    // Exact shape the hub/stream route emits on the salvage path.
    const raw =
      'data: {"event":"start"}\n\n' +
      'data: {"event":"token","text":"partial"}\n\n' +
      'data: {"event":"done","result":{"ok":true,"thread_id":"t1","reply":"partial","tool_calls":[],"pending":[],"degraded":true}}\n\n';
    const { events } = extractSseMessages(raw);
    const done = events[events.length - 1] as Extract<HubStreamEvent, { event: "done" }>;
    expect(done.result?.degraded).toBe(true);
    // A degraded-but-successful turn is NOT a failure: no failure text.
    expect(hubDoneFailureText(done.result)).toBeNull();
    expect(withDegradedFlag(fresh(), done.result).degraded).toBe(true);
  });
});

describe("SSE full-turn contract at the byte level", () => {
  it("a tool-using turn's raw bytes fold into exactly the trace the UI renders", () => {
    // Every event the hub/stream route can emit, in backend emission order.
    const raw =
      'data: {"event":"start"}\n\n' +
      'data: {"event":"status","text":"Scanning…"}\n\n' +
      'data: {"event":"thought","text":"checking holders"}\n\n' +
      'data: {"event":"tool_call","name":"orbitx_crypto_scan","args_summary":"{mint: 13H4…}"}\n\n' +
      'data: {"event":"tool_result","name":"orbitx_crypto_scan","ok":true,"ms":812}\n\n' +
      'data: {"event":"token","text":"av"}\n\n' +
      'data: {"event":"token_reset"}\n\n' +
      'data: {"event":"token","text":"full reply"}\n\n' +
      'data: {"event":"done","result":{"ok":true,"thread_id":"t1","reply":"full reply","tool_calls":[],"pending":[],"thoughts":["checking holders"]}}\n\n';
    const { events } = extractSseMessages(raw);
    expect(events.map((e) => e.event)).toEqual([
      "start",
      "status",
      "thought",
      "tool_call",
      "tool_result",
      "token",
      "token_reset",
      "token",
      "done",
    ]);
    // Fold the trace events exactly the way AiHub's onEvent switch does.
    let t = fresh();
    for (const e of events) t = reduceHubThinking(t, e);
    expect(t.status).toBe("Scanning…");
    expect(t.thoughts).toEqual(["checking holders"]);
    expect(t.tools).toEqual([
      { name: "orbitx_crypto_scan", args_summary: "{mint: 13H4…}", running: false, ok: true, ms: 812 },
    ]);
    const done = events[events.length - 1] as Extract<HubStreamEvent, { event: "done" }>;
    expect(hubDoneFailureText(done.result)).toBeNull();
    expect(withDegradedFlag(t, done.result).degraded).toBeUndefined();
  });

  it("an error turn's raw bytes carry no done — the client must surface it, never re-run it", () => {
    // Exact bytes when hubChat throws server-side: the error event is
    // terminal and no done follows. (The old client swallowed this and
    // silently re-ran the turn via the buffered fallback — double tool
    // execution. AiHub now keys off streamError instead.)
    const raw =
      'data: {"event":"start"}\n\n' +
      'data: {"event":"status","text":"Thinking…"}\n\n' +
      'data: {"event":"error","error":"boom"}\n\n';
    const { events } = extractSseMessages(raw);
    expect(events.map((e) => e.event)).toEqual(["start", "status", "error"]);
    expect(events.some((e) => e.event === "done")).toBe(false);
    const err = events[events.length - 1] as Extract<HubStreamEvent, { event: "error" }>;
    expect(err.error).toBe("boom");
    // The trace reducer ignores the error event (the caller handles it).
    expect(reduceHubThinking(fresh(), err)).toEqual(fresh());
  });
});

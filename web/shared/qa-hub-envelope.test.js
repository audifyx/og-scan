/**
 * QA adversarial harness — hub pure functions (brain + backend lanes).
 *
 * The functions under test are module-private in
 * web/api/orbitx/_handlers/_mcp-agentplus.js, so this file slices their
 * top-level declarations out of the handler source and evaluates them in
 * isolation (same technique as the brain lane's throwaway harness, made
 * durable). If the handler is refactored (functions renamed/moved), the
 * extractor throws at collection time and EVERY test fails loudly — never
 * a silent green.
 *
 * Read-only: no network, no DB, no env. Covers the fdfd351f envelope fixes,
 * the 123c9f5 timeout race + llm_empty parsing, and the dossier/salvage/
 * streamer/budget-math contracts the team now owns.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const HANDLER_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../api/orbitx/_handlers/_mcp-agentplus.js",
);
const SRC = readFileSync(HANDLER_PATH, "utf8");

function extract(name) {
  const startRe = new RegExp(
    `^(?:async\\s+function\\s+${name}|function\\s+${name}|const\\s+${name}\\s*=)`,
    "m",
  );
  const m = startRe.exec(SRC);
  if (!m) throw new Error(`[qa] top-level declaration not found: ${name}`);
  const lines = SRC.slice(m.index).split("\n");
  let end = lines.length;
  for (let i = 1; i < lines.length; i++) {
    if (/^(?:async\s+function\s|function\s|const\s|let\s|var\s|export\s|import\s)/.test(lines[i])) {
      end = i;
      break;
    }
  }
  const body = lines.slice(0, end).join("\n");
  if (!body.includes(name)) throw new Error(`[qa] extraction sanity failed: ${name}`);
  return body;
}

const LIB_SRC = [
  "CA_FILLER_WORDS",
  "hubCoerceArgs",
  "hubNormalize",
  "hubSalvageReply",
  "hubJsonFieldStreamer",
  "hubDetectBareCa",
  "hubRenderDossier",
  "hubHumanLlmError",
  "hubPrettyTool",
  "parseThinkJson",
  "normalizeThink",
  "parseThinkError",
  "hubStreamCapMs",
]
  .map(extract)
  .join("\n");

const lib = new Function(
  `${LIB_SRC}\nreturn { hubCoerceArgs, hubNormalize, hubSalvageReply, hubJsonFieldStreamer, hubDetectBareCa, hubRenderDossier, hubHumanLlmError, hubPrettyTool, parseThinkJson, normalizeThink, parseThinkError, hubStreamCapMs };`,
)();

const {
  hubCoerceArgs,
  hubNormalize,
  hubSalvageReply,
  hubJsonFieldStreamer,
  hubDetectBareCa,
  hubRenderDossier,
  hubHumanLlmError,
  hubPrettyTool,
  parseThinkJson,
  normalizeThink,
  parseThinkError,
  hubStreamCapMs,
} = lib;

// hubExecuteToolTimed races hubExecuteTool against a timeout. The production
// timeout (HUB_TOOL_TIMEOUT_MS = 25000) is far too long for a unit test, so
// the extracted source is parameterized on the constant — race logic only.
// The production binding is asserted separately below.
const timedSrc = extract("hubExecuteToolTimed").replace(/HUB_TOOL_TIMEOUT_MS/g, "QA_TIMEOUT_MS");
function makeTimed(fakeTool, ms) {
  return new Function(
    "hubExecuteTool",
    "QA_TIMEOUT_MS",
    `${timedSrc}\nreturn hubExecuteToolTimed;`,
  )(fakeTool, ms);
}

describe("hubCoerceArgs (fdfd351f fix: string-encoded args)", () => {
  it("passes objects through by reference", () => {
    const a = { mint: "abc" };
    expect(hubCoerceArgs(a)).toBe(a);
  });
  it("parses JSON-string arguments", () => {
    expect(hubCoerceArgs('{"mint":"abc","n":3}')).toEqual({ mint: "abc", n: 3 });
  });
  it("tolerates surrounding whitespace in the JSON string", () => {
    expect(hubCoerceArgs('  \n {"mint":"abc"} \t')).toEqual({ mint: "abc" });
  });
  it("parses nested JSON-string arguments deeply", () => {
    expect(hubCoerceArgs('{"a":{"b":[1,2]}}')).toEqual({ a: { b: [1, 2] } });
  });
  it("rejects JSON that parses to an array", () => {
    expect(hubCoerceArgs("[1,2]")).toEqual({});
  });
  it("rejects JSON primitives", () => {
    expect(hubCoerceArgs("5")).toEqual({});
    expect(hubCoerceArgs('"x"')).toEqual({});
    expect(hubCoerceArgs("true")).toEqual({});
    expect(hubCoerceArgs("null")).toEqual({});
  });
  it("falls back to {} on invalid JSON", () => {
    expect(hubCoerceArgs("{mint:")).toEqual({});
    expect(hubCoerceArgs("not json at all")).toEqual({});
  });
  it("falls back to {} on empty/blank strings and non-objects", () => {
    expect(hubCoerceArgs("")).toEqual({});
    expect(hubCoerceArgs("   ")).toEqual({});
    expect(hubCoerceArgs(null)).toEqual({});
    expect(hubCoerceArgs(undefined)).toEqual({});
    expect(hubCoerceArgs(42)).toEqual({});
    expect(hubCoerceArgs(false)).toEqual({});
  });
});

describe("hubNormalize (fdfd351f fixes: whitespace names, single-object calls)", () => {
  it("returns null for non-object input", () => {
    expect(hubNormalize(null)).toBeNull();
    expect(hubNormalize(undefined)).toBeNull();
    expect(hubNormalize("string")).toBeNull();
    expect(hubNormalize([1])).toBeNull();
  });
  it("returns null when there is no reply and no usable calls", () => {
    expect(hubNormalize({})).toBeNull();
    expect(hubNormalize({ reply: "" })).toBeNull();
    expect(hubNormalize({ reply: "", tool_calls: [] })).toBeNull();
  });
  it("keeps a reply-only envelope", () => {
    expect(hubNormalize({ reply: "hi" })).toEqual({ reply: "hi", tool_calls: [], thought: "" });
  });
  it("drops whitespace-only tool names (fdfd351f fix 1)", () => {
    expect(hubNormalize({ reply: "hi", tool_calls: [{ name: " ", arguments: {} }] })).toEqual({
      reply: "hi",
      tool_calls: [],
      thought: "",
    });
    expect(hubNormalize({ reply: "hi", tool_calls: [{ name: "\t\n ", arguments: {} }] }).tool_calls).toEqual([]);
    // all calls dropped + no reply -> null, not an empty-string tool call
    expect(hubNormalize({ tool_calls: [{ name: "   " }] })).toBeNull();
  });
  it("trims padding around real names", () => {
    const n = hubNormalize({ reply: "x", tool_calls: [{ name: "  orbitx_crypto_scan  ", arguments: {} }] });
    expect(n.tool_calls[0].name).toBe("orbitx_crypto_scan");
  });
  it("filters non-string names and non-object entries", () => {
    const n = hubNormalize({
      reply: "x",
      tool_calls: [null, "str", 42, { name: 7 }, { name: "ok_tool", arguments: {} }],
    });
    expect(n.tool_calls.map((c) => c.name)).toEqual(["ok_tool"]);
  });
  it("wraps a single non-array tool_calls object (fdfd351f fix 2)", () => {
    const n = hubNormalize({ reply: "", tool_calls: { name: "orbitx_crypto_scan", arguments: { mint: "m" } } });
    expect(n.tool_calls).toHaveLength(1);
    expect(n.tool_calls[0].name).toBe("orbitx_crypto_scan");
  });
  it("accepts the singular tool_call key", () => {
    const n = hubNormalize({ reply: "", tool_call: { name: "t", arguments: {} } });
    expect(n.tool_calls).toHaveLength(1);
  });
  it("parses string-encoded arguments (fdfd351f fix 3)", () => {
    const n = hubNormalize({
      reply: "",
      tool_calls: [{ name: "orbitx_crypto_scan", arguments: '{"mint":"abc","x":1}' }],
    });
    expect(n.tool_calls[0].arguments).toEqual({ mint: "abc", x: 1 });
  });
  it("replaces unparseable string args with {}", () => {
    const n = hubNormalize({ reply: "", tool_calls: [{ name: "t", arguments: "{broken" }] });
    expect(n.tool_calls[0].arguments).toEqual({});
  });
  it("caps tool calls at 5", () => {
    const calls = Array.from({ length: 9 }, (_, i) => ({ name: `tool_${i}`, arguments: {} }));
    expect(hubNormalize({ reply: "x", tool_calls: calls }).tool_calls).toHaveLength(5);
  });
  it("tolerates agent-style actions arrays", () => {
    const n = hubNormalize({ reply: "", actions: [{ name: "t", arguments: {} }] });
    expect(n.tool_calls).toHaveLength(1);
  });
  it("caps thought at 300 chars and defaults reply to string", () => {
    const n = hubNormalize({ reply: 42, thought: "x".repeat(500), tool_calls: [{ name: "t" }] });
    expect(n.reply).toBe("");
    expect(n.thought).toHaveLength(300);
  });
});

describe("parseThinkJson", () => {
  it("parses clean JSON", () => {
    expect(parseThinkJson('{"thought":"t","actions":[]}')).toEqual({ thought: "t", actions: [] });
  });
  it("strips markdown fences", () => {
    expect(parseThinkJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(parseThinkJson('```\n{"a":1}\n```')).toEqual({ a: 1 });
  });
  it("extracts JSON with trailing prose", () => {
    expect(parseThinkJson('{"a":1} hope this helps')).toEqual({ a: 1 });
  });
  it("extracts JSON with leading prose", () => {
    expect(parseThinkJson('Sure thing:\n{"a":1}')).toEqual({ a: 1 });
  });
  it("re-anchors past a doubled opening brace", () => {
    expect(parseThinkJson('{ {"thought":"t","actions":[]} }')).toEqual({ thought: "t", actions: [] });
  });
  it("respects braces inside strings", () => {
    expect(parseThinkJson('{"reply":"a } b { c","x":1}')).toEqual({ reply: "a } b { c", x: 1 });
  });
  it("handles escaped quotes inside strings", () => {
    expect(parseThinkJson('{"reply":"he said \\"hi\\""}')).toEqual({ reply: 'he said "hi"' });
  });
  it("handles nested objects", () => {
    expect(parseThinkJson('{"a":{"b":{"c":[1,2]}}}')).toEqual({ a: { b: { c: [1, 2] } } });
  });
  it("returns null for truncated JSON", () => {
    expect(parseThinkJson('{"reply": "abc')).toBeNull();
  });
  it("returns null for empty/non-JSON input", () => {
    expect(parseThinkJson("")).toBeNull();
    expect(parseThinkJson("just prose, no braces")).toBeNull();
    expect(parseThinkJson(null)).toBeNull();
  });
});

describe("normalizeThink", () => {
  it("passes the canonical envelope through", () => {
    const t = { thought: "t", actions: [{ op: "x" }] };
    expect(normalizeThink(t)).toBe(t);
  });
  it("wraps a bare action object", () => {
    const n = normalizeThink({ op: "advance_step", step: 1 });
    expect(n.thought).toBe("(action without narration)");
    expect(n.actions).toHaveLength(1);
  });
  it("wraps a singular action key", () => {
    const n = normalizeThink({ thought: "plan", action: { op: "x" } });
    expect(n).toEqual({ thought: "plan", actions: [{ op: "x" }] });
  });
  it("wraps a bare action array", () => {
    const n = normalizeThink([{ op: "x" }]);
    expect(n.actions).toHaveLength(1);
  });
  it("returns null for garbage", () => {
    expect(normalizeThink(null)).toBeNull();
    expect(normalizeThink("str")).toBeNull();
    expect(normalizeThink({})).toBeNull();
  });
  it("returns null when actions is a non-array (documented: malformed envelope)", () => {
    expect(normalizeThink({ thought: "t", actions: { op: "x" } })).toBeNull();
  });
});

describe("hubJsonFieldStreamer", () => {
  const envelope = (reply) => `{"reply": ${JSON.stringify(reply)}, "thought": "plan", "tool_calls": []}`;
  function streamIn1CharChunks(field, text) {
    const s = hubJsonFieldStreamer(field);
    let out = "";
    for (const ch of text) out += s.push(ch);
    return { s, out };
  }
  it("reconstructs a field delivered one char at a time", () => {
    const { s, out } = streamIn1CharChunks("reply", envelope("hello world"));
    expect(out).toBe("hello world");
    expect(s.done()).toBe(true);
    expect(s.text()).toBe("hello world");
  });
  it("decodes escape sequences", () => {
    const { out } = streamIn1CharChunks("reply", envelope('a\nb\tc"d\\e/f'));
    expect(out).toBe('a\nb\tc"d\\e/f');
  });
  it("survives an escape split across chunk boundaries", () => {
    const s = hubJsonFieldStreamer("reply");
    const full = envelope("a\nb");
    const at = full.indexOf("\\");
    const first = s.push(full.slice(0, at + 1)); // chunk ends right after the backslash
    const out = s.push(full.slice(at + 1));
    expect(first).toBe("a");
    expect(out).toBe("\nb"); // push() yields only the new delta, never re-emits
    expect(s.text()).toBe("a\nb");
  });
  it("tolerates whitespace around the colon", () => {
    const { out } = streamIn1CharChunks("reply", '{"reply" : "spaced"}');
    expect(out).toBe("spaced");
  });
  it("ignores a second occurrence of the field (first wins)", () => {
    const s = hubJsonFieldStreamer("reply");
    s.push('{"reply": "first", "x": {"reply": "second"}}, "reply": "third"');
    expect(s.text()).toBe("first");
  });
  it("reset() clears all state", () => {
    const s = hubJsonFieldStreamer("reply");
    s.push('{"reply": "abc"}');
    s.reset();
    expect(s.done()).toBe(false);
    expect(s.text()).toBe("");
    let out = "";
    for (const ch of envelope("xyz")) out += s.push(ch);
    expect(out).toBe("xyz");
  });
  it("yields nothing for a missing field", () => {
    const s = hubJsonFieldStreamer("reply");
    expect(s.push('{"thought": "only"}')).toBe("");
    expect(s.done()).toBe(false);
  });
  it("enforces the 30k bound by yielding nothing once exceeded", () => {
    const s = hubJsonFieldStreamer("reply");
    expect(s.push('{"reply": "' + "x".repeat(40000))).toBe("");
  });
  it("extracts the thought field independently", () => {
    const { out } = streamIn1CharChunks("thought", envelope("r"));
    expect(out).toBe("plan");
  });
  it.fails("\\uXXXX escapes are not decoded in the incremental stream (transient: corrected on done via JSON.parse)", () => {
    // gpt-oss-20b emits \u escapes for non-ASCII; the streamer copies the
    // literal chars, so live tokens briefly show "cafu00e9" before
    // finalizeStream replaces the content with the correctly parsed reply.
    const { out } = streamIn1CharChunks("reply", '{"reply": "caf\\u00e9"}');
    expect(out).toBe("caf\u00e9");
  });
});

describe("hubSalvageReply", () => {
  it("extracts reply from truncated JSON", () => {
    expect(hubSalvageReply('{"reply": "hello there')).toBe("hello there");
    expect(hubSalvageReply('{"reply": "hello there", "thought":')).toBe("hello there");
  });
  it("handles escaped quotes inside the truncated reply", () => {
    expect(hubSalvageReply('{"reply": "he said \\"hi\\" to me')).toBe('he said "hi" to me');
  });
  it("handles an escaped backslash before the closing quote", () => {
    expect(hubSalvageReply('{"reply": "a\\\\"}')).toBe("a\\");
  });
  it("passes bare prose through", () => {
    expect(hubSalvageReply("Just a plain answer.")).toBe("Just a plain answer.");
  });
  it("strips code fences first", () => {
    expect(hubSalvageReply('```json\n{"reply": "fenced')).toBe("fenced");
  });
  it("returns null for JSON-looking text without a reply field", () => {
    expect(hubSalvageReply('{"thought": "x"}')).toBeNull();
  });
  it("returns null for empty input", () => {
    expect(hubSalvageReply("")).toBeNull();
    expect(hubSalvageReply("   ")).toBeNull();
    expect(hubSalvageReply(null)).toBeNull();
  });
  it("caps the salvaged reply at 4000 chars", () => {
    expect(hubSalvageReply('{"reply": "' + "x".repeat(9000))).toHaveLength(4000);
  });
});

describe("hubDetectBareCa", () => {
  const MINT = "13H4WJvGEg4xrrBwWn2vsQgz7xhmhxgNdw19i1QsxPX9";
  it("detects a bare mint", () => {
    expect(hubDetectBareCa(MINT)).toBe(MINT);
  });
  it("detects a mint with filler words", () => {
    expect(hubDetectBareCa(`${MINT} scan this`)).toBe(MINT);
    expect(hubDetectBareCa(`ca: ${MINT} pls check`)).toBe(MINT);
    expect(hubDetectBareCa(`rugcheck ${MINT}`)).toBe(MINT);
  });
  it("rejects two mints", () => {
    expect(hubDetectBareCa(`${MINT} ${MINT}`)).toBeNull();
  });
  it("rejects substantive questions", () => {
    expect(hubDetectBareCa(`${MINT} is this a good buy right now`)).toBeNull();
    expect(hubDetectBareCa(`what do you think about ${MINT}`)).toBeNull();
  });
  it("rejects more than 5 filler words", () => {
    expect(hubDetectBareCa(`${MINT} scan this please check it quick here now`)).toBeNull();
  });
  it("rejects over-160-char messages and empty input", () => {
    expect(hubDetectBareCa(`${MINT} ${"scan ".repeat(40)}`)).toBeNull();
    expect(hubDetectBareCa("")).toBeNull();
    expect(hubDetectBareCa("   ")).toBeNull();
  });
  it.fails("a 0x-prefixed blob is sliced and misdetected as a mint", () => {
    // "0x"+MINT: 0 is not base58, so the regex matches "x"+43 mint chars.
    // The bogus 44-char "mint" fails the scan honestly downstream
    // ("couldn't find that token"). Known edge, same class as the 88-char
    // digit blob the dossier lane documented as acceptable.
    expect(hubDetectBareCa(`0x${MINT}`)).toBeNull();
  });
  it.fails("a base58 run LONGER than 44 chars is sliced and misdetected as a mint", () => {
    // "1".repeat(60) is not a valid mint, but the {32,44} regex matches the
    // first 44 chars and the leftover 16 are stripped as non-letters, so the
    // filler check passes vacuously. Should be null.
    expect(hubDetectBareCa("1".repeat(60))).toBeNull();
  });
});

describe("hubRenderDossier", () => {
  const MINT = "13H4WJvGEg4xrrBwWn2vsQgz7xhmhxgNdw19i1QsxPX9";
  const scan = () => ({
    ok: true,
    token: {
      token: { name: "OrbitX", symbol: "ORBITX", mcap: 1234567.891, liquidity: 50000 },
      meta: { holderCount: 1234 },
      pairs: [{ liquidity: 51000, volume24h: 200000, change24h: 12.345 }],
    },
    safety: { verdict: "SAFE", note: "looks fine", roundTripLossPct: 2.34 },
  });
  it("renders the full dossier shape", () => {
    const d = hubRenderDossier(MINT, scan());
    expect(d).toContain("OrbitX");
    expect(d).toContain("$ORBITX");
    expect(d).toContain(MINT);
    expect(d).toContain("🟢");
    expect(d).toContain("Liq:");
    expect(d).toContain("Vol 24h:");
    expect(d).toContain("MC:");
    expect(d).toContain("+12.35%");
    expect(d).toContain("1234");
    expect(d).toContain("2.3%");
    expect(d).toContain("model is unreachable");
  });
  it("maps danger/risky verdicts to red/yellow", () => {
    const danger = scan();
    danger.safety.verdict = "RUG DANGER";
    expect(hubRenderDossier(MINT, danger)).toContain("🔴");
    const risky = scan();
    risky.safety.verdict = "RISKY";
    expect(hubRenderDossier(MINT, risky)).toContain("🟡");
  });
  it("never fabricates a safety verdict when the safety check is missing (B4)", () => {
    const s = scan();
    delete s.safety; // whole sub-payload gone (not just the verdict string)
    s.token.verdict = "honeypot"; // intel composite score, not a safety verdict
    const d = hubRenderDossier(MINT, s);
    expect(d).not.toContain("🔴");
    expect(d).not.toContain("🟢");
    expect(d).toContain("⚪");
    expect(d).toContain("safety check unavailable");
  });
  it("a verdict-less safety object still renders neutral, never green", () => {
    const s = scan();
    delete s.safety.verdict;
    const d = hubRenderDossier(MINT, s);
    expect(d).toContain("⚪ UNKNOWN");
    expect(d).not.toContain("🟢");
  });
  it("returns null when the scan has no token object (B3: dead scan, no fake dossier)", () => {
    expect(hubRenderDossier(MINT, { ok: true })).toBeNull();
  });
  it("shows holderCount 0 instead of n/a", () => {
    const s = scan();
    s.token.meta.holderCount = 0;
    expect(hubRenderDossier(MINT, s)).toContain("Holders: 0");
  });
  it("accepts the scan as a JSON string", () => {
    expect(hubRenderDossier(MINT, JSON.stringify(scan()))).toContain("OrbitX");
  });
  it("returns null for ok:false scans", () => {
    expect(hubRenderDossier(MINT, { ok: false, error: "x" })).toBeNull();
  });
  it("returns null for garbage input", () => {
    expect(hubRenderDossier(MINT, "not json")).toBeNull();
    expect(hubRenderDossier(MINT, null)).toBeNull();
    expect(hubRenderDossier(MINT, undefined)).toBeNull();
  });
  it("handles numeric strings without zero-padding", () => {
    const s = scan();
    s.token.token.mcap = "999.5";
    expect(hubRenderDossier(MINT, s)).toContain("$999.5");
  });
});

describe("hubHumanLlmError", () => {
  it("speaks plain language for known kinds", () => {
    expect(hubHumanLlmError("llm_unreachable")).toContain("couldn't reach");
    expect(hubHumanLlmError("llm_empty")).toContain("came back empty");
    expect(hubHumanLlmError("bad_json")).toContain("garbled");
    expect(hubHumanLlmError("llm_unavailable")).toContain("No AI model is configured");
  });
  it("maps 4xx/5xx families", () => {
    expect(hubHumanLlmError("llm_404")).toContain("rejected the request");
    expect(hubHumanLlmError("llm_429")).toContain("rejected the request");
    expect(hubHumanLlmError("llm_503")).toContain("having trouble");
  });
  it("never leaks internal codes for unknown errors", () => {
    const m = hubHumanLlmError("weird_internal_thing");
    expect(m).toContain("AI model");
    expect(m).not.toContain("weird_internal_thing");
    expect(hubHumanLlmError("")).toContain("AI model");
  });
});

describe("hubPrettyTool", () => {
  it("prettifies tool names", () => {
    expect(hubPrettyTool("orbitx_crypto_scan_solana")).toBe("crypto scan solana");
    expect(hubPrettyTool("orbitx_app_buy")).toBe("app buy");
  });
  it("falls back to 'tool' for empty input", () => {
    expect(hubPrettyTool("")).toBe("tool");
    expect(hubPrettyTool(null)).toBe("tool");
  });
});

describe("parseThinkError (123c9f5: llm_empty parsing)", () => {
  it("parses the llm_empty kind with a hint", () => {
    const r = parseThinkError("think failed: think llm_empty after 2 tries");
    expect(r.code).toBe("llm_empty");
    expect(r.hint).toContain("empty");
  });
  it("parses llm_404 with the provisioning hint", () => {
    const r = parseThinkError("think llm_404 model gone");
    expect(r.code).toBe("llm_404");
    expect(r.hint).toContain("provisioned");
  });
  it("parses bad_json and llm_unreachable", () => {
    expect(parseThinkError("x think bad_json y").code).toBe("bad_json");
    expect(parseThinkError("x think llm_unreachable y").code).toBe("llm_unreachable");
  });
  it("returns null when no think error is present", () => {
    expect(parseThinkError("all good")).toBeNull();
    expect(parseThinkError("")).toBeNull();
    expect(parseThinkError(null)).toBeNull();
  });
  it("matches the first code when several appear", () => {
    expect(parseThinkError("think llm_500 then think llm_404").code).toBe("llm_500");
  });
});

describe("hubStreamCapMs (budget math: stream attempt cap)", () => {
  it("caps the stream attempt at 20s on a full 30s budget", () => {
    expect(hubStreamCapMs(30000)).toBe(18000);
  });
  it("never exceeds 20000ms", () => {
    expect(hubStreamCapMs(60000)).toBe(20000);
    expect(hubStreamCapMs(100000)).toBe(20000);
  });
  it("floors at 8000ms so the stream attempt always gets a real window", () => {
    expect(hubStreamCapMs(15000)).toBe(8000);
    expect(hubStreamCapMs(10000)).toBe(8000);
    expect(hubStreamCapMs(8000)).toBe(8000);
  });
  it("always leaves >= 8000ms for the buffered retry when the budget allows", () => {
    for (const t of [16000, 20000, 25000, 30000, 45000]) {
      const cap = hubStreamCapMs(t);
      expect(cap).toBeGreaterThanOrEqual(8000);
      expect(cap).toBeLessThanOrEqual(20000);
      if (t >= 20000) expect(t - cap).toBeGreaterThanOrEqual(8000);
    }
  });
});

describe("hubExecuteToolTimed (123c9f5: 25s tool timeout race)", () => {
  it("resolves fast tools with their value", async () => {
    const t = makeTimed(async () => "ok", 200);
    await expect(t({ toolName: "x" })).resolves.toBe("ok");
  });
  it("rejects a hanging tool with tool_timeout", async () => {
    const t = makeTimed(() => new Promise(() => {}), 50);
    await expect(t({ toolName: "hang" })).rejects.toThrow("tool_timeout");
  }, 5000);
  it("propagates immediate tool errors without waiting for the timeout", async () => {
    const t = makeTimed(async () => {
      throw new Error("boom");
    }, 5000);
    const start = Date.now();
    await expect(t({})).rejects.toThrow("boom");
    expect(Date.now() - start).toBeLessThan(1000);
  });
  it("production binds the timeout to 25000ms", () => {
    expect(SRC).toContain("const HUB_TOOL_TIMEOUT_MS = 25000");
  });
});

describe("QA adversarial additions — dossier honesty regressions + normalize edges", () => {
  const MINT = "13H4WJvGEg4xrrBwWn2vsQgz7xhmhxgNdw19i1QsxPX9";
  const scan = (verdict, tone) => ({
    ok: true,
    token: { token: { name: "T", symbol: "T", mcap: 100 }, meta: {}, pairs: [] },
    safety: { verdict, tone, note: "n" },
  });

  it("B1 regression: real bad/warn verdicts never render green without a tone", () => {
    // Pre-fix these rendered 🟢 (the imagined-vocabulary regex missed them).
    for (const v of ["No route", "High tax / impact", "Honeypot risk"]) {
      expect(hubRenderDossier(MINT, scan(v, undefined))).toContain("🔴");
    }
    for (const v of ["Elevated cost", "Thin liquidity"]) {
      expect(hubRenderDossier(MINT, scan(v, undefined))).toContain("🟡");
    }
  });

  it("tone matching is case-insensitive", () => {
    expect(hubRenderDossier(MINT, scan("whatever", "BAD"))).toContain("🔴");
    expect(hubRenderDossier(MINT, scan("whatever", "Warn"))).toContain("🟡");
    expect(hubRenderDossier(MINT, scan("whatever", "GOOD"))).toContain("🟢");
  });

  it("a failed safety sub-payload (ok:false) renders neutral, never green", () => {
    const s = scan("SAFE", "good");
    s.safety.ok = false;
    const d = hubRenderDossier(MINT, s);
    expect(d).toContain("⚪");
    expect(d).toContain("safety check unavailable");
    expect(d).not.toContain("🟢");
  });

  it("hubCoerceArgs does not let __proto__ JSON pollute Object.prototype", () => {
    const a = hubCoerceArgs('{"__proto__":{"polluted":"yes"}}');
    expect({}.polluted).toBeUndefined();
    expect(a.polluted).toBeUndefined();
    delete Object.prototype.polluted;
  });

  it("hubCoerceArgs rejects arrays to {} (not passed through like objects)", () => {
    expect(hubCoerceArgs([1, 2])).toEqual({});
  });

  it("hubNormalize filters String-object names (typeof is object, not string)", () => {
    // eslint-disable-next-line no-new-wrappers
    const n = hubNormalize({ reply: "x", tool_calls: [{ name: new String("t"), arguments: {} }] });
    expect(n.tool_calls).toEqual([]);
  });

  it("hubNormalize keeps a call whose name survives trim but drops the rest", () => {
    const n = hubNormalize({
      reply: "",
      tool_calls: [{ name: "  " }, { name: "real_tool", arguments: null }, { name: "" }],
    });
    expect(n.tool_calls).toHaveLength(1);
    expect(n.tool_calls[0].name).toBe("real_tool");
    expect(n.tool_calls[0].arguments).toEqual({});
  });

  it("hubNormalize treats null tool_calls as reply-only", () => {
    expect(hubNormalize({ reply: "hi", tool_calls: null })).toEqual({
      reply: "hi",
      tool_calls: [],
      thought: "",
    });
  });

  it("hubDetectBareCa rejects filler-word overflow at the boundary", () => {
    expect(hubDetectBareCa(`${MINT} scan this please check it`)).toBe(MINT); // 5 fillers ok
    expect(hubDetectBareCa(`${MINT} scan this please check it now`)).toBeNull(); // 6 fillers no
  });
});

describe("QA adversarial — _providerDark circuit breaker (9e8493d)", () => {
  // _providerDark(client, {windowMin, threshold}) — pure decision logic over a
  // supabase-like client. Fake client records the query chain and returns
  // canned results.
  const darkSrc = [
    "PROVIDER_DARK_WINDOW_MIN",
    "PROVIDER_DARK_THRESHOLD",
    "_providerDark",
  ]
    .map(extract)
    .join("\n");
  const providerDark = new Function(`${darkSrc}\nreturn _providerDark;`)();

  function fakeClient({ count, countThrows = false, markers = [], markersThrow = false }) {
    const calls = { writes: [] };
    return {
      calls,
      from(table) {
        if (table !== "ap_agent_logs") throw new Error("unexpected table " + table);
        return {
          select(_cols, opts) {
            // The real supabase builder returns the same thenable from every
            // chained call; each method must return `this` (the query object),
            // never a fresh prototype, or the `then` below is lost and every
            // query silently resolves to undefined.
            const isCount = opts && opts.count === "exact" && opts.head === true;
            const q = {
              select() { return q; },
              eq() { return q; },
              like() { return q; },
              gte() { return q; },
              or() { return q; },
              order() { return q; },
              limit() { return q; },
              then(resolve) {
                if (isCount) {
                  if (countThrows) resolve({ count: null, error: new Error("db down") });
                  else resolve({ count, error: null });
                } else {
                  if (markersThrow) resolve({ data: null, error: new Error("db down") });
                  else resolve({ data: markers.map((body) => ({ body })), error: null });
                }
              },
            };
            return q;
          },
        };
      },
    };
  }

  it("trips on >= threshold transport timeouts in the window", async () => {
    const r = await providerDark(fakeClient({ count: 6 }), { windowMin: 15, threshold: 5 });
    expect(r.dark).toBe(true);
    expect(r.sticky).toBe(false);
    expect(r.timeouts).toBe(6);
  });

  it("stays open below threshold with no markers", async () => {
    const r = await providerDark(fakeClient({ count: 2, markers: [] }), { windowMin: 15, threshold: 5 });
    expect(r.dark).toBe(false);
    expect(r.sticky).toBe(false);
  });

  it("sticky-trips on an unrecovered provider_dark marker even with zero fresh timeouts", async () => {
    const r = await providerDark(
      fakeClient({ count: 0, markers: ["provider_dark: 9 think transport timeouts in 15m — parking"] }),
      { windowMin: 15, threshold: 5 },
    );
    expect(r.dark).toBe(true);
    expect(r.sticky).toBe(true);
  });

  it("disengages after a provider_recovered marker", async () => {
    const r = await providerDark(
      fakeClient({ count: 1, markers: ["provider_recovered: probe ok in 1200ms — resuming"] }),
      { windowMin: 15, threshold: 5 },
    );
    expect(r.dark).toBe(false);
    expect(r.sticky).toBe(false);
  });

  it("fails open when the count query throws (never parks on doubt)", async () => {
    const r = await providerDark(fakeClient({ count: 0, countThrows: true }), { windowMin: 15, threshold: 5 });
    expect(r.dark).toBe(false);
  });

  it("fails open when the marker read throws and count is below threshold", async () => {
    const r = await providerDark(fakeClient({ count: 2, markersThrow: true }), { windowMin: 15, threshold: 5 });
    expect(r.dark).toBe(false);
  });

  it("only counts think transport failures, not other error kinds", async () => {
    // Verified by query shape: kind='error' AND body LIKE 'think transport failed%'.
    expect(darkSrc).toContain('.like("body", "think transport failed%")');
    expect(darkSrc).toContain('.eq("kind", "error")');
  });
});

describe("QA adversarial — _announceProviderDark one-marker-per-episode (9e8493d)", () => {
  // _announceProviderDark reads PROVIDER_DARK_WINDOW_MIN at runtime; the
  // constant must be in the sandbox or the reference throws inside the
  // function's best-effort try/catch and every announce silently no-ops.
  const annSrc = ["PROVIDER_DARK_WINDOW_MIN", "_announceProviderDark"].map(extract).join("\n");
  function makeAnn(logged) {
    const writes = [];
    const client = {
      from() {
        return {
          select() { return this; },
          eq() { return this; },
          or() { return this; },
          gte() { return this; },
          order() { return this; },
          limit() { return this; },
          then(resolve) { resolve({ data: logged.map((body) => ({ body })) }); },
        };
      },
    };
    const logEvent = (_c, e) => { writes.push(e); };
    const raw = new Function("client", "_logEvent", `${annSrc}\nreturn _announceProviderDark;`)(client, logEvent);
    // _announceProviderDark's first parameter shadows the sandbox binding —
    // the mock client must be passed as the call's first argument, not rely
    // on the closure. Bind it here so call sites can't pass the wrong client.
    const fn = (userId, darkState) => raw(client, userId, darkState);
    return { fn, writes };
  }

  it("skips the announce when the trip is sticky (episode already announced)", async () => {
    const { fn, writes } = makeAnn([]);
    await fn("u1", { dark: true, sticky: true, timeouts: 0, windowMin: 15 });
    expect(writes).toHaveLength(0);
  });

  it("writes one marker on a fresh trip with no recent marker", async () => {
    const { fn, writes } = makeAnn([]);
    await fn("u1", { dark: true, sticky: false, timeouts: 7, windowMin: 15 });
    expect(writes).toHaveLength(1);
    expect(writes[0].kind).toBe("system");
    expect(writes[0].body).toMatch(/^provider_dark: 7 think transport timeouts/);
  });

  it("does not double-announce when a recent provider_dark marker exists", async () => {
    const { fn, writes } = makeAnn(["provider_dark: 7 think transport timeouts in 15m — parking"]);
    await fn("u1", { dark: true, sticky: false, timeouts: 7, windowMin: 15 });
    expect(writes).toHaveLength(0);
  });

  it("announces a fresh episode after a logged recovery", async () => {
    const { fn, writes } = makeAnn(["provider_recovered: probe ok in 900ms — resuming"]);
    await fn("u1", { dark: true, sticky: false, timeouts: 5, windowMin: 15 });
    expect(writes).toHaveLength(1);
    expect(writes[0].body).toMatch(/^provider_dark:/);
  });
});

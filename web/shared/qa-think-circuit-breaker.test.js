/**
 * QA harness — think-loop provider dark-spell circuit breaker (shipped 9e8493d).
 *
 * The breaker functions are module-private in
 * web/api/orbitx/_handlers/_mcp-agentplus.js, so this file slices their
 * top-level declarations out of the handler source and evaluates them in
 * isolation (same technique as the brain lane's qa-hub-envelope harness).
 * If the handler is refactored (functions renamed/moved), the extractor
 * throws at collection time and EVERY test fails loudly — never silent green.
 *
 * Read-only: no network (fetch is injected), no real DB (supabase client is
 * mocked), env vars set/restored per test. Covers the sticky-trip design:
 * dark detection from ap_agent_logs, fail-open on any read failure, the
 * cheap liveness probe, the throttled provider_dark announcement, and the
 * sticky marker that keeps the breaker engaged while parked ticks produce
 * no fresh timeout errors.
 *
 * Grounding (live Supabase `Soltools`, 2026-09-26 ~01:00 EDT): 6
 * `think transport failed` rows in the trailing 15m (threshold is 5, so the
 * breaker trips right now), 270 think errors vs 16 thoughts in 12h (~6%
 * success), last timeout 00:48 EDT — the Nvidia dark spell is ongoing.
 */
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

// Test-env shim: vitest runs these harnesses under jsdom, whose AbortSignal
// lacks the Node 18+ static AbortSignal.timeout() that the shipped
// _probeProvider uses. Production runs on Node (Vercel) where it exists.
// Define it only when absent — never clobber a real implementation.
if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout !== "function") {
  AbortSignal.timeout = (ms) => {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(new Error("The operation was aborted due to timeout")), ms);
    if (t.unref) t.unref();
    return c.signal;
  };
}

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
  return lines.slice(0, end).join("\n");
}

// SQL LIKE prefix semantics for patterns of the form "literal%" (the only
// shape the breaker uses; no _ or % inside the literal in our patterns).
function likePrefix(value, pattern) {
  if (!pattern.endsWith("%") || pattern.slice(0, -1).includes("%") || pattern.includes("_"))
    throw new Error(`[qa] unsupported LIKE pattern in test: ${pattern}`);
  return String(value).startsWith(pattern.slice(0, -1));
}

// Flexible supabase-client mock: records the query shape; resolves {count}
// for the timeout-count query and {data: rows} for the marker query
// (distinguished by the .or() call); optionally fails either query.
function mockDb({ count = 0, rows = [], failCount = null, failMarkers = null } = {}) {
  const seen = { tables: [], eq: [], like: [], or: [], gte: [], inserts: [] };
  const chain = {};
  chain.from = (t) => { seen.tables.push(t); return chain; };
  chain.select = () => chain;
  chain.eq = (k, v) => { seen.eq.push([k, v]); return chain; };
  chain.like = (k, v) => { seen.like.push([k, v]); return chain; };
  chain.or = (c) => { seen.or.push(c); return chain; };
  chain.gte = (k, v) => { seen.gte.push([k, v]); return chain; };
  chain.order = () => chain;
  chain.limit = () => chain;
  chain.insert = (row) => { seen.inserts.push(row); return chain; };
  chain.then = (res, rej) => {
    const isMarkerQuery = seen.or.length > 0;
    const fail = isMarkerQuery ? failMarkers : failCount;
    if (fail) { rej(fail); return; }
    if (seen.inserts.length) { res({ data: null, error: null }); return; }
    if (isMarkerQuery) { res({ data: rows }); return; }
    res({ count });
  };
  return { client: chain, seen };
}

function loadBreaker(mockFetch) {
  const parts = [
    "PROVIDER_DARK_WINDOW_MIN",
    "PROVIDER_DARK_THRESHOLD",
    "PROVIDER_PROBE_TIMEOUT_MS",
    "LOG_KINDS",
    "LOG_BODY_MAX",
    "trunc",
    "llmCfg",
    "_logEvent",
    "_providerDark",
    "_probeProvider",
    "_announceProviderDark",
  ].map(extract);
  const factory = new Function(
    "fetch",
    `${parts.join("\n")}\nreturn { _providerDark, _probeProvider, _announceProviderDark, llmCfg, PROVIDER_DARK_WINDOW_MIN, PROVIDER_DARK_THRESHOLD, PROVIDER_PROBE_TIMEOUT_MS };`,
  );
  return factory(mockFetch);
}

// Real log bodies observed in the live ap_agent_logs (Soltools, 2026-09-26).
const REAL_TIMEOUT_BODIES = [
  "think transport failed (openai/gpt-oss-20b) attempt 1/2: The operation was aborted due to timeout",
  "think transport failed (openai/gpt-oss-20b) attempt 2/2: The operation was aborted due to timeout",
];
const NON_TIMEOUT_BODIES = [
  "think bad_json from openai/gpt-oss-20b (finish_reason=stop): {\"thought\": ...",
  "think llm_empty from openai/gpt-oss-20b (finish_reason=stop): (empty response)",
  "think llm_404 on openai/gpt-oss-20b: {}",
];
const DARK_MARKER = "provider_dark: 6 think transport timeouts in 15m — parking scheduled thinks, probing each tick";
const RECOVERED_MARKER = "provider_recovered: probe ok in 1234ms — resuming scheduled thinks";

const ENV_KEYS = ["AGENT_LLM_API_KEY", "NVIDIA_API_KEY"];
let savedEnv = {};
beforeEach(() => {
  savedEnv = {};
  for (const k of ENV_KEYS) savedEnv[k] = process.env[k];
  delete process.env.AGENT_LLM_API_KEY;
  delete process.env.NVIDIA_API_KEY;
});
afterEach(() => {
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
});

describe("circuit-breaker constants", () => {
  it("trips at 5 transport timeouts in a 15-minute window (live data: 6/15m right now)", () => {
    const b = loadBreaker(async () => { throw new Error("no fetch in this test"); });
    expect(b.PROVIDER_DARK_WINDOW_MIN).toBe(15);
    expect(b.PROVIDER_DARK_THRESHOLD).toBe(5);
    expect(b.PROVIDER_PROBE_TIMEOUT_MS).toBe(15000);
  });
});

describe("_providerDark", () => {
  it("trips on the count alone at/above threshold (no marker query needed)", async () => {
    const b = loadBreaker(async () => { throw new Error("no fetch"); });
    const { client, seen } = mockDb({ count: 6 });
    const st = await b._providerDark(client);
    expect(st.dark).toBe(true);
    expect(st.sticky).toBe(false);
    expect(st.timeouts).toBe(6);
    expect(seen.tables).toContain("ap_agent_logs");
    expect(seen.eq).toContainEqual(["kind", "error"]);
    expect(seen.like).toContainEqual(["body", "think transport failed%"]);
    expect(seen.or).toHaveLength(0);
    // Window is ~15 minutes back from now.
    const sinceMs = Date.now() - new Date(seen.gte[0][1]).getTime();
    expect(sinceMs).toBeGreaterThan(14 * 60 * 1000);
    expect(sinceMs).toBeLessThan(16 * 60 * 1000);
  });

  it("stays sticky-dark below threshold when the latest marker is an unrecovered provider_dark", async () => {
    // THE key design property: parked ticks produce no fresh timeout errors,
    // so the raw count decays out of the window while the provider is still
    // down. The unrecovered marker keeps the breaker engaged.
    const b = loadBreaker(async () => { throw new Error("no fetch"); });
    const { client, seen } = mockDb({ count: 2, rows: [{ body: DARK_MARKER }] });
    const st = await b._providerDark(client);
    expect(st.dark).toBe(true);
    expect(st.sticky).toBe(true);
    expect(st.timeouts).toBe(2);
    expect(seen.or).toHaveLength(1);
    expect(seen.or[0]).toContain("provider_dark");
    expect(seen.or[0]).toContain("provider_recovered");
  });

  it("opens below threshold when the latest marker is provider_recovered", async () => {
    const b = loadBreaker(async () => { throw new Error("no fetch"); });
    const { client } = mockDb({ count: 2, rows: [{ body: RECOVERED_MARKER }] });
    const st = await b._providerDark(client);
    expect(st.dark).toBe(false);
    expect(st.sticky).toBe(false);
  });

  it("opens below threshold with no markers at all", async () => {
    const b = loadBreaker(async () => { throw new Error("no fetch"); });
    const { client } = mockDb({ count: 0, rows: [] });
    const st = await b._providerDark(client);
    expect(st.dark).toBe(false);
    expect(st.sticky).toBe(false);
  });

  it("fails OPEN when the count query throws (never park on doubt)", async () => {
    const b = loadBreaker(async () => { throw new Error("no fetch"); });
    const { client } = mockDb({ failCount: new Error("db down") });
    const st = await b._providerDark(client);
    expect(st.dark).toBe(false);
    expect(st.timeouts).toBe(0);
  });

  it("fails OPEN when the marker query throws and the count is below threshold", async () => {
    const b = loadBreaker(async () => { throw new Error("no fetch"); });
    const { client } = mockDb({ count: 2, failMarkers: new Error("db down") });
    const st = await b._providerDark(client);
    expect(st.dark).toBe(false);
    expect(st.sticky).toBe(false);
  });

  it("the LIKE pattern matches real timeout rows and no other think error kind", () => {
    // The template lives in thinkAgent's transport-error log line; the
    // breaker must match exactly that family.
    const tplLine = SRC.split("\n").find((l) => l.includes("think transport failed ("));
    expect(tplLine).toBeTruthy();
    for (const body of REAL_TIMEOUT_BODIES) {
      expect(likePrefix(body, "think transport failed%")).toBe(true);
    }
    for (const body of NON_TIMEOUT_BODIES) {
      expect(likePrefix(body, "think transport failed%")).toBe(false);
    }
  });
});

describe("_probeProvider", () => {
  it("200 with the single mind model counts as recovered", async () => {
    process.env.NVIDIA_API_KEY = "nvapi-test-key";
    let captured = null;
    const b = loadBreaker(async (url, opts) => {
      captured = { url, opts };
      return { ok: true, status: 200, text: async () => "{}" };
    });
    const r = await b._probeProvider();
    expect(r.ok).toBe(true);
    expect(typeof r.ms).toBe("number");
    expect(captured.url).toBe("https://integrate.api.nvidia.com/v1/chat/completions");
    const body = JSON.parse(captured.opts.body);
    expect(body.model).toBe("openai/gpt-oss-20b"); // single model, no fallback chain
    expect(body.max_tokens).toBeLessThanOrEqual(64); // cheap probe
    expect(body.response_format).toEqual({ type: "json_object" });
  });

  it("transport failure keeps the breaker parked", async () => {
    process.env.NVIDIA_API_KEY = "nvapi-test-key";
    const b = loadBreaker(async () => { throw new Error("The operation was aborted due to timeout"); });
    const r = await b._probeProvider();
    expect(r.ok).toBe(false);
    expect(r.error).toBe("timeout_or_transport");
  });

  it("HTTP errors surface the status (fail fast, no retry)", async () => {
    process.env.NVIDIA_API_KEY = "nvapi-test-key";
    const b = loadBreaker(async () => ({ ok: false, status: 429, text: async () => "rate limited" }));
    const r = await b._probeProvider();
    expect(r.ok).toBe(false);
    expect(r.error).toBe("llm_429");
  });

  it("no key -> no probe, no network", async () => {
    let called = false;
    const b = loadBreaker(async () => { called = true; throw new Error("must not fetch"); });
    const r = await b._probeProvider();
    expect(r.ok).toBe(false);
    expect(r.error).toBe("no_key");
    expect(called).toBe(false);
  });
});

describe("_announceProviderDark", () => {
  const fresh = { timeouts: 6, windowMin: 15, threshold: 5, sticky: false, dark: true };
  const sticky = { timeouts: 2, windowMin: 15, threshold: 5, sticky: true, dark: true };

  it("writes one provider_dark marker when none exists", async () => {
    const b = loadBreaker(async () => { throw new Error("no fetch"); });
    const { client, seen } = mockDb({ rows: [] });
    await b._announceProviderDark(client, "user-1", fresh);
    expect(seen.inserts).toHaveLength(1);
    const row = seen.inserts[0];
    expect(row.user_id).toBe("user-1");
    expect(row.kind).toBe("system");
    expect(String(row.body).startsWith("provider_dark:")).toBe(true);
    expect(String(row.body)).toContain("6");
  });

  it("skips the announce on a sticky trip (episode already announced)", async () => {
    const b = loadBreaker(async () => { throw new Error("no fetch"); });
    const { client, seen } = mockDb({ rows: [] });
    await b._announceProviderDark(client, "user-1", sticky);
    expect(seen.inserts).toHaveLength(0);
  });

  it("throttles: no new marker when the latest is already provider_dark", async () => {
    const b = loadBreaker(async () => { throw new Error("no fetch"); });
    const { client, seen } = mockDb({ rows: [{ body: DARK_MARKER }] });
    await b._announceProviderDark(client, "user-1", fresh);
    expect(seen.inserts).toHaveLength(0);
  });

  it("re-darkening after a logged recovery gets a fresh marker", async () => {
    const b = loadBreaker(async () => { throw new Error("no fetch"); });
    const { client, seen } = mockDb({ rows: [{ body: RECOVERED_MARKER }] });
    await b._announceProviderDark(client, "user-1", fresh);
    expect(seen.inserts).toHaveLength(1);
    expect(String(seen.inserts[0].body).startsWith("provider_dark:")).toBe(true);
  });

  it("never throws (best effort)", async () => {
    const b = loadBreaker(async () => { throw new Error("no fetch"); });
    const { client } = mockDb({ failCount: new Error("db down") });
    await expect(b._announceProviderDark(client, "user-1", fresh)).resolves.toBeUndefined();
  });
});

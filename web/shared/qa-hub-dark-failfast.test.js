/**
 * QA harness — hub dark-spell hardening (fail-fast + heartbeat + breaker feed).
 *
 * hubRunLoop is not unit-extractable (dozens of module deps), so this harness
 * does two things:
 *   1. Evaluates the pure, extractable pieces (hubHumanLlmError) in isolation.
 *   2. Asserts the wiring exists in the handler source with anchored regexes —
 *      the fail-fast ordering, the heartbeat, the bare-CA dark skip, and the
 *      transport-failure log line that feeds the breaker. If the handler is
 *      refactored, these fail loudly instead of going silently stale.
 *
 * Read-only: no network, no real DB.
 *
 * Grounding (live, 2026-09-26 ~04:25 EDT): Nvidia chat completions degraded —
 * a trivial probe via orbitx_agentplus_models took 28.6s (normally ~3s) and
 * the 04:17 EDT tick logged llm_unreachable on agent thinks. Hub turns were
 * burning the full ~30s budget staring at "Thinking…" before the honest
 * error, with no thought trace (the model never emitted tokens) — exactly the
 * "not responding / not saying what it's thinking / breaks often" report.
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
  return lines.slice(0, end).join("\n");
}

// hubRunLoop's full source, for ordering assertions.
function extractHubRunLoop() {
  return extract("hubRunLoop");
}

function loadHumanLlmError() {
  const src = extract("hubHumanLlmError");
  const factory = new Function(`${src}\nreturn hubHumanLlmError;`);
  return factory();
}

describe("hubHumanLlmError — honest plain-language failures, never raw codes", () => {
  it("llm_unreachable says the model is not responding", () => {
    const f = loadHumanLlmError();
    const msg = f("llm_unreachable");
    expect(msg).toContain("not responding");
    expect(msg).not.toContain("llm_unreachable");
  });

  it("llm_empty and bad_json stay honest and distinct", () => {
    const f = loadHumanLlmError();
    expect(f("llm_empty")).toContain("empty");
    expect(f("bad_json")).toContain("garbled");
    expect(f("bad_json")).not.toContain("bad_json");
  });

  it("5xx blames the provider's servers, 4xx the rejected request", () => {
    const f = loadHumanLlmError();
    expect(f("llm_500")).toContain("servers");
    expect(f("llm_429")).toContain("rejected");
  });
});

describe("hubRunLoop dark-spell fail-fast (source wiring)", () => {
  it("checks the breaker BEFORE the tool catalog and history load", () => {
    const src = extractHubRunLoop();
    const darkIdx = src.indexOf("_providerDark(client)");
    const catalogIdx = src.indexOf("hubToolCatalog()");
    expect(darkIdx).toBeGreaterThan(-1);
    expect(catalogIdx).toBeGreaterThan(-1);
    expect(darkIdx).toBeLessThan(catalogIdx);
  });

  it("fail-fast returns the honest reply shape without burning LLM budget", () => {
    const src = extractHubRunLoop();
    // The dark branch inserts the assistant message and returns ok:false with
    // the reply inline, mirroring the normal !llm.ok failure shape.
    expect(src).toMatch(/provider_dark/);
    expect(src).toMatch(/The AI model is struggling right now/);
    expect(src).toMatch(/hubInsertMessage\(client, threadId, "assistant", humanErr/);
  });

  it("provider-side turn failures are logged for the breaker (4xx excluded)", () => {
    const src = extractHubRunLoop();
    expect(src).toMatch(/hub transport failed: \${llm\.error}/);
    // Only transport/empty/5xx count — a 4xx is a request problem, not health.
    expect(src).toMatch(/\^llm_5\\d\\d\$/);
  });

  it("emits a heartbeat status when the model is slow to first token", () => {
    const src = extractHubRunLoop();
    expect(src).toMatch(/Still waiting — the AI model is slow right now/);
    // Heartbeat fires only when no token arrived yet, and is always cleared.
    expect(src).toMatch(/if \(!gotToken\)/);
    expect(src).toMatch(/clearTimeout\(heartbeat\)/);
  });
});

describe("hubChat bare-CA path dark skip (source wiring)", () => {
  it("skips the 25s format call when dark and renders deterministically", () => {
    // The deterministic dossier fallback already exists below; the dark skip
    // just avoids burning 25s on an unreachable model first.
    expect(SRC).toMatch(/darkSkip = !!\(\(await _providerDark\(client\)\)/);
    expect(SRC).toMatch(/Model is down — rendering from scan data/);
    expect(SRC).toMatch(/hubRenderDossier\(bareCa, scanJson\)/);
  });
});

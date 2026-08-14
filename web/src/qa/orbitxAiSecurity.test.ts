import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("OrbitX AI security guards", () => {
  const api = readFileSync(resolve(__dirname, "../../api/orbitx-ai.js"), "utf8");
  const page = readFileSync(resolve(__dirname, "../pages/OrbitXAI.tsx"), "utf8");
  const executeHandler = api.slice(
    api.indexOf("async function handleToolExecute"),
    api.indexOf("export default async function handler"),
  );

  it("uses a JavaScript-safe server runtime entry", () => {
    expect(api).toContain('from "./orbitx/ai-runtime.js"');
    expect(api).not.toContain('from "./orbitx/world/_lib"');
  });

  it("atomically consumes a server-side confirmation instead of client tool arguments", () => {
    expect(executeHandler).toContain('body.eventId');
    expect(executeHandler).toContain('body.messageId');
    expect(executeHandler).toContain('.from("ai_messages")');
    expect(executeHandler).toContain('.contains("tool_events", [{ id: eventId, status: "confirmation_required" }])');
    expect(executeHandler).not.toContain("body.tool");
    expect(executeHandler).not.toContain("body.args");
  });

  it("supports atomic cancellation without accepting client tool arguments", () => {
    expect(api).toContain("async function handleToolCancel");
    expect(api).toContain('if (action === "tool.cancel")');
    expect(api).toContain('.contains("tool_events", [{ id: eventId, status: pending.status }])');
    expect(executeHandler).not.toContain("body.tool");
    expect(executeHandler).not.toContain("body.args");
  });

  it("binds token sends to the wallet that passed the access gate", () => {
    expect(page).toContain("connectedWalletAddress === gatedWalletAddress");
    expect(page).toContain("disabled={busy || !walletMatchesGate}");
    expect(page).toContain("Reconnect the wallet that passed the OrbitX access check");
  });

  it("exposes the embedded MCP catalog through the guarded command center", () => {
    expect(api).toContain("listEmbeddedAgentTools({ includeGenerated: true })");
    expect(api).toContain("tools: toolCatalog()");
    expect(api).toContain('name: "orbitx_tool_search"');
    expect(api).toContain("isEmbeddedAgentToolReadOnly");
    expect(page).toContain('id: "tools"');
    expect(page).toContain("<CommandCenter");
    expect(page).toContain("tool.requiresConfirmation");
  });

  it("streams chat progress, live model deltas, and tool events", () => {
    expect(api).toContain('if (action === "chat.stream")');
    expect(api).toContain('"application/x-ndjson; charset=utf-8"');
    expect(api).toContain('type: "delta"');
    expect(api).toContain('type: "tool"');
    expect(api).toContain("readOpenAiChatResponse");
    expect(page).toContain("streamAiMessage(");
    expect(page).toContain("oai-live-cursor");
    expect(page).toContain("stopResponse");
  });

  it("renders structured results and a mobile quick-action menu", () => {
    expect(page).toContain("function StructuredToolResult");
    expect(page).toContain("Technical details");
    expect(page).toContain("oai-composer-actions");
    expect(page).toContain('label: "MCP tools"');
  });
});

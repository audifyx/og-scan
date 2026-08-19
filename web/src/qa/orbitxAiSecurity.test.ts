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
    expect(executeHandler).toContain('.contains("tool_events", toolEventFilter(eventId, "confirmation_required"))');
    expect(executeHandler).toContain('.contains("tool_events", toolEventFilter(eventId, "executing"))');
    expect(executeHandler).not.toContain("body.tool");
    expect(executeHandler).not.toContain("body.args");
  });

  it("supports atomic cancellation without accepting client tool arguments", () => {
    expect(api).toContain("async function handleToolCancel");
    expect(api).toContain('if (action === "tool.cancel")');
    expect(api).toContain('.contains("tool_events", toolEventFilter(eventId, pending.status))');
    expect(executeHandler).not.toContain("body.tool");
    expect(executeHandler).not.toContain("body.args");
  });

  it("builds jsonb-safe contains filters so the atomic claim can actually match", () => {
    // supabase-js turns an array argument into `cs.{[object Object]}`, which never
    // matches a jsonb column. The filter must be serialized JSON instead.
    expect(api).toContain("function toolEventFilter(eventId, status)");
    expect(api).toContain("JSON.stringify([{ id: eventId, status }])");
    expect(api).not.toMatch(/\.contains\("tool_events", \[/);
  });

  it("awaits every dispatched handler so rejections cannot escape the error handler", () => {
    const dispatch = api.slice(api.indexOf("export default async function handler"));
    for (const handlerName of [
      "handleBootstrap",
      "handleMessages",
      "handleChat",
      "handleConversation",
      "handleMediaGenerate",
      "handleMediaStatus",
      "handleToolExecute",
      "handleToolCancel",
    ]) {
      expect(dispatch).toContain(`return await ${handlerName}(`);
    }
  });

  it("binds token sends to the wallet that passed the access gate", () => {
    expect(page).toContain("connectedWalletAddress === gatedWalletAddress");
    expect(page).toContain("disabled={busy || !walletMatchesGate}");
    expect(page).toContain("Reconnect the wallet that passed the OrbitX access check");
  });

  it("exposes the embedded MCP catalog through the guarded command center", () => {
    expect(api).toContain("listEmbeddedAgentTools()");
    expect(api).toContain("tools: toolCatalog()");
    expect(page).toContain('id: "tools"');
    expect(page).toContain("<CommandCenter");
    expect(page).toContain("tool.requiresConfirmation");
  });

  it("renders structured results and a mobile quick-action menu", () => {
    expect(page).toContain("function StructuredToolResult");
    expect(page).toContain("Technical details");
    expect(page).toContain("oai-composer-actions");
    expect(page).toContain('label: "MCP tools"');
  });
});

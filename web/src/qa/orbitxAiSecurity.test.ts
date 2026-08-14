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

  it("atomically consumes a server-side confirmation instead of client tool arguments", () => {
    expect(executeHandler).toContain('body.eventId');
    expect(executeHandler).toContain('body.messageId');
    expect(executeHandler).toContain('.from("ai_messages")');
    expect(executeHandler).toContain('.contains("tool_events", [{ id: eventId, status: "confirmation_required" }])');
    expect(executeHandler).not.toContain("body.tool");
    expect(executeHandler).not.toContain("body.args");
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
});

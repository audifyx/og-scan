import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("admin /calls desk", () => {
  const root = resolve(__dirname, "../..");

  it("wires the owner-only route and 5-minute cron", () => {
    const app = readFileSync(resolve(root, "src/App.tsx"), "utf8");
    expect(app).toContain('path="/calls"');
    expect(app).toContain("AdminRoute");
    expect(app).toContain("CallsDesk");
    const vercel = readFileSync(resolve(root, "vercel.json"), "utf8");
    expect(vercel).toContain("/api/orbitx-calls?path=tick");
    expect(vercel).toContain("*/5 * * * *");
    expect(vercel).toContain("api/orbitx-calls.js");
  });

  it("never returns the raw bot token from the public desk payload", () => {
    const shared = readFileSync(resolve(root, "shared/orbitx-calls-desk.js"), "utf8");
    expect(shared).toContain("maskBotToken");
    expect(shared).toContain("token_masked");
    const page = readFileSync(resolve(root, "src/pages/CallsDesk.tsx"), "utf8");
    expect(page).toContain("BotFather token");
    expect(page).toContain("Arm 5-minute agent alerts");
    expect(page).toContain("apply_schema");
    expect(page).not.toContain("bot_token:");
    const api = readFileSync(resolve(root, "api/orbitx-calls.js"), "utf8");
    expect(api).toContain("apply_schema");
    const schema = readFileSync(resolve(root, "api/orbitx/calls-schema.js"), "utf8");
    expect(schema).toContain("ox_calls_desk");
    expect(schema).toContain("ox_calls_ledger");
  });
});

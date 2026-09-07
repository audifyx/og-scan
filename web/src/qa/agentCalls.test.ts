import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { publicAgentCallsBoard } from "../../shared/orbitx-calls-desk.js";

describe("public /agentcalls board", () => {
  const root = resolve(__dirname, "../..");

  it("is a public route with no admin gate or bot settings", () => {
    const app = readFileSync(resolve(root, "src/App.tsx"), "utf8");
    expect(app).toContain('path="/agentcalls"');
    expect(app).toContain("<AgentCalls />");
    expect(app).not.toMatch(/path="\/agentcalls"[^>]*AdminRoute/);
    const page = readFileSync(resolve(root, "src/pages/AgentCalls.tsx"), "utf8");
    expect(page).toContain("/api/agent-calls");
    expect(page).toContain("No login");
    expect(page).not.toContain("BotFather");
    expect(page).not.toContain("ADMIN_AUTH");
    expect(page).not.toContain("apply_schema");
    const api = readFileSync(resolve(root, "api/agent-calls.js"), "utf8");
    expect(api).toContain("publicAgentCallsBoard");
    expect(api).toContain("readonly: true");
    expect(api).not.toContain("adminFrom");
    const vercel = readFileSync(resolve(root, "vercel.json"), "utf8");
    expect(vercel).toContain('"/agentcalls"');
    const atmo = readFileSync(resolve(root, "src/components/theme/OrbitAtmosphereLayer.tsx"), "utf8");
    expect(atmo).toContain('"/agentcalls"');
  });

  it("strips bot tokens and webhook fields from the public payload", () => {
    const board = publicAgentCallsBoard(
      {
        wallet: "Desk111",
        armed: true,
        enabled: true,
        disclaimer: "Not financial advice.",
        last_tick_at: "2026-09-07T17:00:00.000Z",
        feed: [{ id: "1", kind: "buy", symbol: "MOUSE", mint: "Mint111", text: "NEON bought" }],
        fills: [{ id: "f1", side: "buy", symbol: "MOUSE", usd_amount: 1.5, signature: "sig" }],
        open: [{ mint: "Mint111", symbol: "MOUSE", usd_in: 1.5 }],
        ledger: { started_usd: 10, currently_usd: 11, made_usd: 1, wins: 1, losses: 0 },
      },
      {
        token_masked: "123456…abcd",
        bot_token: "SECRET",
        webhook_secret: "nope",
        calls: [{ mint: "Mint111", symbol: "MOUSE", status: "open", telegram_posts: [{ chat_id: "-100" }] }],
      },
    );
    const raw = JSON.stringify(board);
    expect(board.public).toBe(true);
    expect(board.wallet).toBe("Desk111");
    expect(board.feed[0].symbol).toBe("MOUSE");
    expect(board.calls[0].symbol).toBe("MOUSE");
    expect(raw).not.toContain("SECRET");
    expect(raw).not.toContain("123456");
    expect(raw).not.toContain("webhook");
    expect(raw).not.toContain("token_masked");
    expect(board.calls[0].telegram_posts).toBeUndefined();
  });
});

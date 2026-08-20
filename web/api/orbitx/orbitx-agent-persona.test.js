import { describe, expect, it } from "vitest";
import {
  ORBITX_AGENT_HANDLE,
  ORBITX_AGENT_IDENTITY,
  ORBITX_AGENT_NAME,
  ORBITX_AGENT_ROLE,
} from "./orbitx-agent-persona.js";
import {
  DEFAULT_TELEGRAM_NIM_MODEL,
  OFFICIAL_ORBITX_TELEGRAM_SYSTEM,
  ORBITX_TELEGRAM_SYSTEM,
  TELEGRAM_NIM_FALLBACK_MODEL,
} from "./orbitx-telegram-knowledge.js";

describe("Lyra desk officer", () => {
  it("names the agent, role, and forbids shrug replies", () => {
    expect(ORBITX_AGENT_NAME).toBe("Lyra");
    expect(ORBITX_AGENT_ROLE).toMatch(/Desk Officer/i);
    expect(ORBITX_AGENT_HANDLE).toBe("@theorbitxmcpbot");
    expect(ORBITX_AGENT_IDENTITY).toContain(ORBITX_AGENT_NAME);
    expect(ORBITX_AGENT_IDENTITY).toContain(ORBITX_AGENT_ROLE);
    expect(ORBITX_AGENT_IDENTITY.toLowerCase()).toContain("never reply with idk");
  });

  it("trains official + owner Telegram prompts as Lyra with full OrbitX memory", () => {
    for (const prompt of [OFFICIAL_ORBITX_TELEGRAM_SYSTEM, ORBITX_TELEGRAM_SYSTEM]) {
      expect(prompt).toContain("Lyra");
      expect(prompt).toContain("Desk Officer");
      expect(prompt).toContain("orbitx.world");
      expect(prompt.toLowerCase()).toContain("never reply with idk");
    }
    expect(OFFICIAL_ORBITX_TELEGRAM_SYSTEM).toContain("$5");
    expect(OFFICIAL_ORBITX_TELEGRAM_SYSTEM).toContain("/faq");
    expect(DEFAULT_TELEGRAM_NIM_MODEL).toBe("meta/llama-3.3-70b-instruct");
    expect(TELEGRAM_NIM_FALLBACK_MODEL).toBe("meta/llama-3.1-8b-instruct");
  });
});

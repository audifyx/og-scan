import { describe, expect, it } from "vitest";
import { dispatchVoiceTool } from "./mcp-voice.js";

describe("mcp voice tools", () => {
  it("requires a name to start a VC", async () => {
    const sb = async () => [];
    const out = await dispatchVoiceTool("orbitx_vc_start", {}, { sb, auth: { userId: "u1" } });
    expect(out.ok).toBe(false);
    expect(out.error).toBe("name_required");
  });

  it("lists empty rooms with a start hint", async () => {
    const sb = async () => [];
    const out = await dispatchVoiceTool("orbitx_vc_list", {}, { sb, auth: {} });
    expect(out.ok).toBe(true);
    expect(out.rooms).toEqual([]);
    expect(String(out.message)).toMatch(/No open VCs/i);
  });
});

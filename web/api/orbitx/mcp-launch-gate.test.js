import { describe, expect, it, vi } from "vitest";
import {
  MCP_LAUNCH_BURN_TOKENS,
  MCP_LAUNCH_CODE,
  MCP_LAUNCH_FREE_SLOTS,
  collectUnlockProbe,
  extractSolscanSignature,
  getLaunchUnlock,
  isLaunchCode,
  launchGateHtml,
  launchGateMessage,
  launchGatePayload,
  redeemLaunchCode,
  tryLaunchUnlockFromText,
} from "./mcp-launch-gate.js";

function memorySb(seed = []) {
  const rows = [...seed];
  return async (path, init = {}) => {
    const method = String(init.method || "GET").toUpperCase();
    if (method === "POST") {
      const body = JSON.parse(init.body);
      if (
        body.source === "promo_code" &&
        rows.some((row) => row.source === "promo_code" && row.promo_slot === body.promo_slot)
      ) {
        const err = new Error("duplicate key value violates unique constraint");
        err.code = "23505";
        throw err;
      }
      const row = { id: `u${rows.length + 1}`, created_at: new Date().toISOString(), ...body };
      rows.push(row);
      return [row];
    }
    const qs = String(path).includes("?") ? String(path).slice(String(path).indexOf("?") + 1) : "";
    const filters = [];
    for (const part of qs.split("&")) {
      const decoded = decodeURIComponent(part);
      const eq = decoded.match(/^([^=]+)=eq\.(.*)$/);
      if (eq) filters.push([eq[1], eq[2]]);
    }
    let filtered = rows.filter((row) => filters.every(([key, value]) => String(row[key] ?? "") === value));
    const lim = Number((qs.match(/limit=(\d+)/) || [])[1] || 0);
    if (lim) filtered = filtered.slice(0, lim);
    return filtered;
  };
}

describe("MCP launch gate", () => {
  it("recognizes the shared authorization code", () => {
    expect(isLaunchCode("Orbitx mcp")).toBe(true);
    expect(isLaunchCode("  ORBITX MCP  ")).toBe(true);
    expect(isLaunchCode("/orbitx mcp")).toBe(true);
    expect(isLaunchCode("orbitxmcp")).toBe(true);
    expect(isLaunchCode("orbitx-mcp")).toBe(true);
    expect(isLaunchCode("please unlock")).toBe(false);
    expect(MCP_LAUNCH_CODE).toBe("Orbitx mcp");
    expect(MCP_LAUNCH_FREE_SLOTS).toBe(25);
    expect(MCP_LAUNCH_BURN_TOKENS).toBe(500);
  });

  it("extracts Solscan signatures from links and bare txs", () => {
    const sig = "2".repeat(88);
    expect(extractSolscanSignature(`https://solscan.io/tx/${sig}`)).toBe(sig);
    expect(extractSolscanSignature(sig)).toBe(sig);
    expect(extractSolscanSignature("https://solscan.io/account/abc")).toBe("");
  });

  it("asks for the code or a 500 $ORBITX burn before answering", () => {
    const text = launchGateMessage({ remainingFree: 25 });
    expect(text).toContain("Please send the authorization code to gain access or get access right away by burning 500 $ORBITX.");
    expect(text).toContain("Orbitx mcp");
    expect(text).toContain("25");
    expect(launchGateHtml({ remainingFree: 0 })).toContain("free codes are claimed");
    expect(launchGatePayload({ remainingFree: 7 }).locked).toBe(true);
    expect(launchGatePayload({ remainingFree: 7 }).tool).toBe("orbitx_mcp_unlock");
  });

  it("grants the first 25 promo codes forever and then sells out", async () => {
    const sb = memorySb();
    const first = await redeemLaunchCode(sb, { telegramUserId: "111" });
    expect(first.ok).toBe(true);
    expect(first.promoSlot).toBe(1);
    expect(first.remainingFree).toBe(24);

    const again = await redeemLaunchCode(sb, { telegramUserId: "111" });
    expect(again.ok).toBe(true);
    expect(again.already).toBe(true);

    for (let i = 2; i <= 25; i += 1) {
      const out = await redeemLaunchCode(sb, { telegramUserId: String(1000 + i) });
      expect(out.ok).toBe(true);
    }
    const sold = await redeemLaunchCode(sb, { telegramUserId: "9999" });
    expect(sold.ok).toBe(false);
    expect(sold.error).toBe("promo_sold_out");
    expect(sold.message).toContain("burn 500");
  });

  it("unlocks from the code in a Telegram/MCP message", async () => {
    const sb = memorySb();
    const miss = await tryLaunchUnlockFromText(sb, "hello", { telegramUserId: "42" });
    expect(miss.handled).toBe(false);
    const hit = await tryLaunchUnlockFromText(sb, "Orbitx mcp", { telegramUserId: "42" });
    expect(hit.handled).toBe(true);
    expect(hit.granted).toBe(true);
    const status = await getLaunchUnlock(sb, { telegramUserId: "42" });
    expect(status.allowed).toBe(true);
    expect(status.source).toBe("promo_code");
  });

  it("collects unlock probes from MCP tool arguments", () => {
    expect(collectUnlockProbe({ query: "Orbitx mcp" })).toContain("Orbitx mcp");
    expect(collectUnlockProbe({ solscan: "https://solscan.io/tx/" + "3".repeat(88) })).toContain("solscan.io/tx/");
  });

  it("requires an identity before consuming a free slot", async () => {
    const sb = memorySb();
    const out = await redeemLaunchCode(sb, {});
    expect(out.ok).toBe(false);
    expect(out.error).toBe("identity_required");
  });
});

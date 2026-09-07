import { describe, expect, it } from "vitest";
import {
  CUSTOM_SKILL_COUNT,
  CUSTOM_SKILLS,
  customSkillStats,
  dispatchCustomSkill,
  listCustomSkillCategories,
} from "../../api/orbitx/mcp-custom-skills.js";
import { buildGeneratedTools, generatedStats } from "../../api/orbitx/mcp-tools-catalog.js";
import { hasEmbeddedAgentTool, listAllOrbitXTools, resolveOrbitXToolName } from "../../api/orbitx-hub.js";
import { isHoldGatedTool } from "../../api/orbitx/token-hold.js";
import { isPrivilegedTelegramTool, isPublicTelegramTool } from "../../api/orbitx/telegram-orbitx-lib.js";
import { isAgentTelegramToolAllowed } from "../../api/orbitx/telegram-mcp-allowlist.js";

const CATEGORIES = ["mkt", "td", "data", "pdf", "create", "idea", "nft", "ln", "desk"] as const;

describe("OrbitX 140 named agent skills", () => {
  it("exports exactly 140 unique orbitx_skill_* names across all nine categories", () => {
    expect(CUSTOM_SKILLS).toHaveLength(CUSTOM_SKILL_COUNT);
    expect(CUSTOM_SKILL_COUNT).toBe(140);
    const names = CUSTOM_SKILLS.map((s) => s.name);
    expect(new Set(names).size).toBe(140);
    expect(names.every((n) => n.startsWith("orbitx_skill_"))).toBe(true);

    const by = listCustomSkillCategories();
    expect(Object.keys(by).sort()).toEqual([...CATEGORIES].sort());
    expect(customSkillStats()).toEqual({
      count: 140,
      categories: {
        mkt: 20,
        td: 20,
        data: 20,
        pdf: 12,
        create: 15,
        idea: 15,
        nft: 15,
        ln: 10,
        desk: 13,
      },
    });
  });

  it("registers every skill in the live catalog and exposes orbitx_skill_menu", () => {
    const generated = buildGeneratedTools();
    expect(generated.some((t) => t.name === "orbitx_skill_mkt_trending")).toBe(true);
    expect(generated.some((t) => t.name === "orbitx_skill_td_sell_all")).toBe(true);
    expect(generated.some((t) => t.name === "orbitx_skill_pdf_pack")).toBe(true);
    expect(generated.filter((t) => t.name.startsWith("orbitx_skill_")).length).toBe(140);

    const tools = listAllOrbitXTools();
    expect(tools.length).toBeGreaterThanOrEqual(2500);
    expect(tools.some((t) => t.name === "orbitx_skill_menu")).toBe(true);
    expect(hasEmbeddedAgentTool("orbitx_skill_menu")).toBe(true);
    expect(resolveOrbitXToolName("skills")).toBe("orbitx_skill_menu");
    expect(generatedStats().customSkills.count).toBe(140);
  });

  it("dispatches idea / sign / pack / compare kinds and leaves catalog kinds to the hub", async () => {
    const idea = await dispatchCustomSkill("orbitx_skill_idea_thesis", { topic: "OrbitX" }, {
      base: "https://www.orbitx.world",
      fetchJson: async () => {
        throw new Error("no fetch in unit test");
      },
      wallet: "",
    });
    expect(idea?.ok).toBe(true);
    expect(idea?.category).toBe("idea");
    expect(Array.isArray(idea?.brief)).toBe(true);

    const sign = await dispatchCustomSkill(
      "orbitx_skill_td_claim_fees",
      { publicKey: "4xT5QZnwtdZKAW5ZcRziEakTwNdnfKMgp1cEVaJmewxd" },
      { base: "https://www.orbitx.world", fetchJson: async () => ({}), wallet: "" },
    );
    expect(sign?.requiresSignature).toBe(true);
    expect(String(sign?.signUrl || "")).toContain("kind=claim");
    expect(String(sign?.signUrl || "")).toContain("auto=1");

    const pack = await dispatchCustomSkill(
      "orbitx_skill_pdf_pack",
      { mint: "13H4WJvGEg4xrrBwWn2vsQgz7xhmhxgNdw19i1QsxPX9" },
      {
        base: "https://www.orbitx.world",
        fetchJson: async (url: string) => ({ ok: true, url }),
        wallet: "",
      },
    );
    expect(pack?.ok).toBe(true);
    expect(pack?.pack?.token).toBeTruthy();
    expect(String(pack?.reportUrl || "")).toContain("/api/ogdex/report");

    await expect(
      dispatchCustomSkill("orbitx_skill_idea_compare", { mint: "Abc" }, {
        base: "https://www.orbitx.world",
        fetchJson: async () => ({}),
        wallet: "",
      }),
    ).rejects.toThrow(/mintB/);

    expect(await dispatchCustomSkill("orbitx_skill_mkt_trending", {}, { base: "", fetchJson: async () => ({}), wallet: "" })).toBeNull();
    expect(await dispatchCustomSkill("orbitx_not_a_skill", {}, { base: "", fetchJson: async () => ({}), wallet: "" })).toBeNull();
  });

  it("hold-gates write skills and leaves intel / menu public", () => {
    expect(isHoldGatedTool("orbitx_skill_td_quote_buy")).toBe(true);
    expect(isHoldGatedTool("orbitx_skill_td_sell_all")).toBe(true);
    expect(isHoldGatedTool("orbitx_skill_td_claim_rent")).toBe(true);
    expect(isHoldGatedTool("orbitx_skill_create_pump")).toBe(true);
    expect(isHoldGatedTool("orbitx_skill_ln_claim_fees")).toBe(true);
    expect(isHoldGatedTool("orbitx_skill_data_token")).toBe(false);
    expect(isHoldGatedTool("orbitx_skill_create_check_name")).toBe(false);
    expect(isHoldGatedTool("orbitx_skill_menu")).toBe(false);

    expect(isPrivilegedTelegramTool("orbitx_skill_td_quote_buy")).toBe(true);
    expect(isPublicTelegramTool("orbitx_skill_mkt_trending")).toBe(true);
    expect(isPublicTelegramTool("orbitx_skill_td_quote_buy")).toBe(false);
    expect(isAgentTelegramToolAllowed("orbitx_skill_td_quote_buy")).toBe(false);
    expect(isAgentTelegramToolAllowed("orbitx_skill_data_token")).toBe(true);
    expect(isAgentTelegramToolAllowed("orbitx_skill_menu")).toBe(true);
  });
});

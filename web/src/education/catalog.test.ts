import { describe, expect, it, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  EDU_NODES,
  LEARNING_PATHS,
  MAP_CLUSTERS,
  TELEGRAM_COMMANDS,
  WORKFLOWS,
  eduHref,
  getNode,
  publishedNodes,
} from "./catalog";
import { searchEducation } from "./search";
import { loadProgress, markCompleted, markStarted, overallStats, pathPercent, saveProgress } from "./progress";

const LIVE_PREFIXES = [
  "/app",
  "/education",
  "/ORBITX_DEX",
  "/trade",
  "/intel",
  "/on-chain",
  "/orbitxlaunch",
  "/telegram",
  "/agent",
  "/ai",
  "/shop",
  "/orbitx-social",
  "/os",
  "/Orbitxcity",
  "/play",
  "/predictions",
  "/nft",
  "/bagwork",
  "/support",
];

describe("OrbitX education catalog", () => {
  it("has unique ids and slugs per kind", () => {
    const ids = EDU_NODES.map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
    const kindSlug = EDU_NODES.map((n) => `${n.kind}:${n.slug}`);
    expect(new Set(kindSlug).size).toBe(kindSlug.length);
  });

  it("only links live public OrbitX routes", () => {
    for (const n of publishedNodes()) {
      if (!n.href) continue;
      expect(
        LIVE_PREFIXES.some((p) => n.href === p || n.href?.startsWith(`${p}/`)),
        `${n.id} href ${n.href}`,
      ).toBe(true);
    }
    for (const stage of WORKFLOWS.flatMap((w) => w.stages)) {
      if (!stage.href) continue;
      expect(LIVE_PREFIXES.some((p) => stage.href === p || stage.href?.startsWith(`${p}/`))).toBe(true);
    }
  });

  it("resolves related, next, prerequisite, and path nodes", () => {
    for (const n of EDU_NODES) {
      for (const id of [...n.related, ...n.next, ...n.prerequisites]) {
        expect(getNode(id), `${n.id} missing ${id}`).toBeTruthy();
      }
    }
    for (const path of LEARNING_PATHS) {
      for (const id of path.nodes) {
        expect(getNode(id), `path ${path.id} missing ${id}`).toBeTruthy();
      }
    }
    for (const c of MAP_CLUSTERS) {
      for (const n of c.nodes) {
        if (n.nodeId) expect(getNode(n.nodeId), n.nodeId).toBeTruthy();
      }
    }
  });

  it("keeps official telegram commands and search hits", () => {
    expect(TELEGRAM_COMMANDS.some((c) => c.command === "/buy")).toBe(true);
    expect(TELEGRAM_COMMANDS.some((c) => c.command === "/login")).toBe(true);
    const hits = searchEducation("claim fees", publishedNodes());
    expect(hits.some((h) => h.href.includes("claim") || h.title.toLowerCase().includes("fee"))).toBe(true);
    const mcp = searchEducation("What is MCP?", publishedNodes());
    expect(mcp.length).toBeGreaterThan(0);
    expect(eduHref({ kind: "tool", slug: "token-scanner" })).toBe("/education/tools/token-scanner");
  });

  it("covers the first content set", () => {
    const need = [
      "what-is-orbitx",
      "getting-started",
      "connect-wallet",
      "ecosystem-map",
      "basic-trading-workflow",
      "orbitx-dex",
      "token-discovery",
      "token-research",
      "token-scanner",
      "wallet-research",
      "holder-analysis",
      "smart-money",
      "trade-execution",
      "launchpad",
      "creating-a-token",
      "launch-configuration",
      "launching",
      "managing-a-launch",
      "claiming-fees",
      "telegram-bot",
      "telegram-trading",
      "orbitx-mcp",
      "mcp-basics",
      "mcp-advanced",
    ];
    for (const id of need) expect(getNode(id), id).toBeTruthy();
  });

  it("never uses the retired ogscan.fun domain", () => {
    const edu = [
      readFileSync(resolve(__dirname, "EducationApp.tsx"), "utf8"),
      readFileSync(resolve(__dirname, "catalog.ts"), "utf8"),
      readFileSync(resolve(__dirname, "DemoStage.tsx"), "utf8"),
    ].join("\n");
    expect(edu).not.toContain("ogscan.fun");
    expect(edu).toContain("orbitx.world");
    expect(edu).toContain('to="/ORBITX_DEX"');
    expect(edu).toContain("This route is off-chain");
  });
});

describe("OrbitX education progress", () => {
  beforeEach(() => {
    saveProgress({ version: 1, started: {}, completed: {} });
  });

  it("round-trips started and completed lessons", () => {
    markStarted("what-is-orbitx");
    expect(loadProgress().started["what-is-orbitx"]).toBeTruthy();
    markCompleted("what-is-orbitx");
    const p = loadProgress();
    expect(p.completed["what-is-orbitx"]).toBeTruthy();
    expect(p.started["what-is-orbitx"]).toBeUndefined();
    expect(pathPercent(p, ["what-is-orbitx", "getting-started"])).toBe(50);
    expect(overallStats(p, 10).level).toBe("Beginner");
  });
});

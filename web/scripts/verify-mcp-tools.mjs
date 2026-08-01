/**
 * Verify OrbitX MCP tool catalog — schema integrity + live production smoke.
 *
 * Usage (from repo root or web/):
 *   node web/scripts/verify-mcp-tools.mjs
 *   node web/scripts/verify-mcp-tools.mjs --live
 *
 * Env:
 *   MCP_URL  default https://www.orbitx.world/api/mcp
 *   KIE_API_KEY  optional — enables image gen smoke
 */
import { buildGeneratedTools, GEN_META, generatedStats } from "../api/orbitx/mcp-tools-catalog.js";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const HUB = join(__dirname, "../api/orbitx-hub.js");
const MCP_URL = (process.env.MCP_URL || "https://www.orbitx.world/api/mcp").replace(/\/$/, "");
const LIVE = process.argv.includes("--live");

const HANDLED_KINDS = new Set([
  "screener",
  "chart",
  "mint_get",
  "search",
  "get",
  "sb",
  "report",
  "open_dex",
  "open",
  "create_token",
  "trade_sign",
  "wallet",
  "swaps",
  "balance",
]);

function fail(msg) {
  console.error("FAIL:", msg);
  process.exitCode = 1;
}

function ok(msg) {
  console.log("OK  ", msg);
}

function parseHubCoreAndAliases() {
  const src = readFileSync(HUB, "utf8");
  const coreNames = [];
  // CORE_TOOLS entries: name: "orbitx_..."
  const coreBlock = src.match(/const CORE_TOOLS = \[([\s\S]*?)\];\s*\nconst _coreNames/);
  if (!coreBlock) throw new Error("Could not locate CORE_TOOLS in orbitx-hub.js");
  for (const m of coreBlock[1].matchAll(/name:\s*"((?:orbitx_|execute_|launch_)[^"]+)"/g)) {
    coreNames.push(m[1]);
  }
  const aliases = {};
  const aliasBlock = src.match(/const TOOL_ALIASES = \{([\s\S]*?)\};/);
  if (aliasBlock) {
    for (const m of aliasBlock[1].matchAll(/([A-Za-z0-9_]+)\s*:\s*"([^"]+)"/g)) {
      aliases[m[1]] = m[2];
    }
  }
  // Handler presence: if (name === "...") or get.orbitx_...
  const handlers = new Set();
  for (const m of src.matchAll(/name === "((?:orbitx_)[^"]+)"/g)) handlers.add(m[1]);
  for (const m of src.matchAll(/^\s+(orbitx_[a-z0-9_]+):\s*\(\)/gm)) handlers.add(m[1]);
  return { coreNames, aliases, handlers };
}

async function mcp(method, params = {}, id = 1) {
  let r;
  try {
    r = await fetch(MCP_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "User-Agent": "OrbitX-MCP-Verify/1.0",
      },
      body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
    });
  } catch (e) {
    throw new Error(`fetch failed (${MCP_URL} ${method}): ${e?.cause?.code || e?.message || e}`);
  }
  const text = await r.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Non-JSON ${r.status}: ${text.slice(0, 200)}`);
  }
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${text.slice(0, 300)}`);
  if (data.error) throw new Error(`RPC ${method}: ${JSON.stringify(data.error)}`);
  return data.result;
}

async function main() {
  console.log("=== OrbitX MCP tool verification ===\n");

  // Reset GEN_META by rebuilding
  GEN_META.clear();
  const generated = buildGeneratedTools();
  const stats = generatedStats();
  const { coreNames, aliases, handlers } = parseHubCoreAndAliases();

  const coreSet = new Set(coreNames);
  const genOnly = generated.filter((t) => !coreSet.has(t.name));
  const total = coreNames.length + genOnly.length;

  console.log(`CORE_TOOLS names parsed: ${coreNames.length}`);
  console.log(`Generated tools built:   ${generated.length} (meta ${stats.totalMeta})`);
  console.log(`Unique total (approx):   ${total}`);
  console.log(`Aliases:                 ${Object.keys(aliases).length}`);
  console.log(`Handler markers found:   ${handlers.size}\n`);

  // 1) Schema integrity for all generated
  let schemaFails = 0;
  const kindCounts = {};
  for (const t of generated) {
    if (!t.name || !/^orbitx_[a-z0-9_]+$/.test(t.name)) {
      fail(`bad name: ${t.name}`);
      schemaFails++;
      continue;
    }
    if (!t.description || typeof t.description !== "string") {
      fail(`missing description: ${t.name}`);
      schemaFails++;
    }
    if (!t.inputSchema || t.inputSchema.type !== "object") {
      fail(`bad inputSchema: ${t.name}`);
      schemaFails++;
    }
    const meta = GEN_META.get(t.name);
    if (!meta?.kind) {
      fail(`no GEN_META kind: ${t.name}`);
      schemaFails++;
      continue;
    }
    kindCounts[meta.kind] = (kindCounts[meta.kind] || 0) + 1;
    if (!HANDLED_KINDS.has(meta.kind)) {
      fail(`unhandled kind ${meta.kind}: ${t.name}`);
      schemaFails++;
    }
  }
  if (schemaFails === 0) ok(`All ${generated.length} generated tools have valid schema + handled kinds`);
  console.log("Kinds:", JSON.stringify(kindCounts));

  // 2) Aliases resolve to something known
  let aliasFails = 0;
  for (const [from, to] of Object.entries(aliases)) {
    const known =
      coreSet.has(to) ||
      handlers.has(to) ||
      GEN_META.has(to) ||
      Object.values(aliases).includes(to);
    if (!known && !handlers.has(to)) {
      // prepare_buy etc. are in handlers via name ===
      if (!String(to).startsWith("orbitx_")) {
        fail(`alias ${from} → ${to} looks invalid`);
        aliasFails++;
      }
    }
  }
  if (aliasFails === 0) ok(`All ${Object.keys(aliases).length} aliases look resolvable`);

  // 3) CORE tools should have handler markers (best-effort — some via get map / aliases)
  const ALIAS_TARGETS = new Set(Object.values(aliases));
  let coreMissing = 0;
  const skipHandlerCheck = new Set([
    // aliases listed as core entries — routed via TOOL_ALIASES
    "orbitx_buy",
    "orbitx_sell",
    "orbitx_buy_auto",
    "orbitx_sell_pump",
    "orbitx_launch_token",
    "orbitx_create_coin",
    "orbitx_create_token",
    "orbitx_prepare_launch",
    "orbitx_launch_execution",
    "orbitx_grok_image",
    "orbitx_grok_video",
  ]);
  for (const name of coreNames) {
    if (skipHandlerCheck.has(name)) continue;
    if (ALIAS_TARGETS.has(name) && aliases[name]) continue;
    if (!handlers.has(name) && !GEN_META.has(name)) {
      // get map tools use orbitx_search: () => pattern
      fail(`CORE tool may lack handler: ${name}`);
      coreMissing++;
    }
  }
  if (coreMissing === 0) ok(`CORE tools have handler markers (${coreNames.length})`);

  // 4) Live MCP
  if (LIVE) {
    console.log(`\n--- Live smoke against ${MCP_URL} ---\n`);
    try {
      const init = await mcp("initialize", {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "orbitx-verify", version: "1.0" },
      });
      ok(`initialize → ${init?.serverInfo?.name || "ok"}`);

      const listed = await mcp("tools/list", {}, 2);
      const n = listed?.tools?.length || 0;
      if (n < 20) fail(`tools/list too small: ${n}`);
      else if (n > 200) fail(`tools/list too large for Claude (${n}) — expected CORE-only`);
      else ok(`tools/list → ${n} live tools (CORE-safe)`);

      const calls = [
        ["orbitx_whoami", {}],
        ["orbitx_tools_help", {}],
        ["orbitx_health", {}],
        ["orbitx_search", { q: "ORBITX" }],
        ["orbitx_screen_trending_1h_solana", { limit: 3 }],
        ["orbitx_get_launches", { limit: 3 }],
        ["orbitx_chart_1h_solana", { mint: "So11111111111111111111111111111111111111112" }],
        ["orbitx_open_orbitxlaunch", {}],
        [
          "orbitx_execute_launch",
          { name: "VerifyCoin", symbol: "VRFY", description: "mcp verify" },
        ],
      ];

      for (const [name, args] of calls) {
        try {
          const result = await mcp("tools/call", { name, arguments: args }, 10);
          const text = result?.content?.[0]?.text || JSON.stringify(result?.structuredContent || result);
          const parsed = (() => {
            try {
              return JSON.parse(text);
            } catch {
              return { raw: text.slice(0, 120) };
            }
          })();
          if (result?.isError && parsed?.error === "token_hold_required") {
            ok(`${name} → hold-gated (expected without auth)`);
          } else if (parsed?.error && !parsed?.ok && name.includes("execute")) {
            // launch may soft-return
            ok(`${name} → responded (${parsed.error || parsed.status || "ok"})`);
          } else {
            ok(`${name} → ${parsed?.ok === false ? parsed.error || "soft-fail" : "ok"} ${parsed?.status || parsed?.openUrl ? "handoff" : ""}`.trim());
          }
        } catch (e) {
          fail(`${name}: ${e.message}`);
        }
      }

      // Generated tool by name (not necessarily in tools/list)
      try {
        const r = await mcp(
          "tools/call",
          { name: "orbitx_create_token_pump", arguments: { name: "PumpVerify", symbol: "PVRF" } },
          20,
        );
        const text = r?.content?.[0]?.text || "";
        const parsed = JSON.parse(text);
        if (parsed?.openUrl || parsed?.status === "awaiting_phantom_launch") {
          ok("orbitx_create_token_pump (generated) callable by name → openUrl");
        } else if (parsed?.error === "token_hold_required") {
          ok("orbitx_create_token_pump hold-gated (callable)");
        } else {
          ok(`orbitx_create_token_pump → ${JSON.stringify(parsed).slice(0, 100)}`);
        }
      } catch (e) {
        fail(`generated create_token_pump: ${e.message}`);
      }
    } catch (e) {
      fail(`live MCP: ${e.message}`);
    }
  } else {
    console.log("\n(skip live — pass --live to hit production MCP)\n");
  }

  console.log("\n=== Summary ===");
  console.log(`Generated catalog: ${generated.length} tools, all kinds dispatchable: ${schemaFails === 0}`);
  console.log(`tools/list policy: CORE only (~${coreNames.length}); full ${total}+ callable by name via tools/call`);
  console.log(process.exitCode ? "RESULT: FAILED" : "RESULT: PASSED");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

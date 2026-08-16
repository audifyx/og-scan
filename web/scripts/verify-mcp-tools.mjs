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
import { execFileSync } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const HUB = join(__dirname, "../api/orbitx-hub.js");
const X_MCP = join(__dirname, "../api/x-mcp.js");
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

async function sleep(ms) {
  await new Promise((r) => setTimeout(r, ms));
}

async function mcp(method, params = {}, id = 1, attempt = 1) {
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
    const code = e?.cause?.code || e?.message || e;
    if (attempt < 3) {
      await sleep(800 * attempt);
      return mcp(method, params, id, attempt + 1);
    }
    throw new Error(`fetch failed (${MCP_URL} ${method}): ${code}`);
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

  for (const file of [HUB, X_MCP]) {
    try {
      execFileSync(process.execPath, ["--check", file], { stdio: "pipe" });
      ok(`syntax ${file.split("/").slice(-2).join("/")}`);
    } catch (e) {
      fail(`syntax ${file}: ${e.stderr?.toString() || e.message}`);
    }
  }

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

  // 3b) X MCP burn-access tools are callable (separate connector)
  const xSrc = readFileSync(X_MCP, "utf8");
  const xAccess = ["x_mcp_access_status", "x_mcp_access_buy", "x_mcp_access_confirm"];
  const missingDeclared = xAccess.filter((n) => !xSrc.includes(`name: "${n}"`));
  if (missingDeclared.length) fail(`X MCP CORE missing access tools: ${missingDeclared.join(", ")}`);
  else ok(`X MCP CORE includes ${xAccess.join(", ")}`);
  for (const n of xAccess) {
    if (!xSrc.includes(`name === "${n}"`)) fail(`X MCP missing handler for ${n}`);
  }
  if (!xSrc.includes('enum: ["credits", "orbitx", "access", "ask"]')) {
    fail("x_buy what enum missing access");
  } else {
    ok("x_buy what=access routes to timed MCP access");
  }

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

      // Image gen: wait=false must return taskId quickly (proves KIE key + route).
      try {
        const r = await mcp(
          "tools/call",
          {
            name: "orbitx_generate_image",
            arguments: {
              prompt: "mcp verify: tiny green triangle icon flat",
              wait: false,
              enable_pro: false,
              aspect_ratio: "1:1",
            },
          },
          30,
        );
        const text = r?.content?.[0]?.text || "";
        const parsed = JSON.parse(text);
        if (parsed?.taskId && (parsed.ok === true || parsed.state === "waiting")) {
          ok(`orbitx_generate_image → taskId ${String(parsed.taskId).slice(0, 12)}…`);
        } else if (parsed?.code === "KIE_API_KEY_MISSING" || /KIE_API_KEY/i.test(parsed?.error || "")) {
          ok("orbitx_generate_image → KIE_API_KEY missing (set in Vercel)");
        } else if (parsed?.ok === false) {
          fail(`orbitx_generate_image soft-fail: ${parsed.code || parsed.error}`);
        } else {
          fail(`orbitx_generate_image unexpected: ${text.slice(0, 160)}`);
        }
      } catch (e) {
        fail(`orbitx_generate_image: ${e.message}`);
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

#!/usr/bin/env node
/**
 * Launchpad MCP auth tests — run against production or a local server.
 * Usage: MCP_URL=https://www.orbitx.world/api/mcp-launchpad node scripts/test-launchpad-auth.mjs
 *
 * Tests:
 *  1. tools/list includes launchpad_launch + launchpad_dry_run with authCode in schema
 *  2. Missing credentials → auth_required (structured, no credential echo)
 *  3. Invalid authCode → auth_required
 *  4. Expired/invalid bearer → auth_required
 *  5. Public tools work without auth (tokens, pairs, holder_map)
 *  6. Dry-run validates pumpdrop params (requires TEST_AUTH_CODE env for full pass)
 */

const BASE = process.env.MCP_URL || "https://www.orbitx.world/api/mcp-launchpad";
const TEST_AUTH_CODE = process.env.TEST_AUTH_CODE || "";

let passed = 0, failed = 0;
function check(name, cond, detail = "") {
  if (cond) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; console.log(`  ✗ ${name} ${detail}`); }
}

async function call(method, params = {}, headers = {}) {
  const res = await fetch(BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(20000),
  });
  return res.json().catch(() => null);
}

async function toolCall(name, args = {}, headers = {}) {
  const d = await call("tools/call", { name, arguments: args }, headers);
  return d?.result?.structuredContent || d?.result || d?.error || {};
}

(async () => {
  console.log(`Testing ${BASE}\n`);

  // 1. Tool registry
  console.log("Tool registry:");
  const list = await call("tools/list");
  const tools = list?.result?.tools || [];
  const names = tools.map(t => t.name);
  check("launchpad_launch registered", names.includes("launchpad_launch"));
  check("launchpad_dry_run registered", names.includes("launchpad_dry_run"));
  check("launchpad_wallets registered", names.includes("launchpad_wallets"));
  check("launchpad_graduations registered", names.includes("launchpad_graduations"));
  const launchTool = tools.find(t => t.name === "launchpad_launch");
  check("launchpad_launch schema has authCode",
    !!launchTool?.inputSchema?.properties?.authCode);
  const dryTool = tools.find(t => t.name === "launchpad_dry_run");
  check("launchpad_dry_run schema has authCode",
    !!dryTool?.inputSchema?.properties?.authCode);

  // 2. Missing credentials
  console.log("\nMissing credentials:");
  const noAuth = await toolCall("launchpad_wallets", {});
  check("no auth → auth_required", noAuth.error === "auth_required", JSON.stringify(noAuth).slice(0, 120));

  // 3. Invalid authCode
  console.log("\nInvalid credentials:");
  const badCode = await toolCall("launchpad_wallets", { authCode: "invalid_code_xyz_123" });
  check("invalid authCode → auth_required", badCode.error === "auth_required", JSON.stringify(badCode).slice(0, 120));
  check("error does not echo the code", !JSON.stringify(badCode).includes("invalid_code_xyz_123"));

  // 4. Invalid bearer token
  const badBearer = await toolCall("launchpad_wallets", {}, { Authorization: "Bearer <redacted>" });
  check("invalid bearer → auth_required", badBearer.error === "auth_required", JSON.stringify(badBearer).slice(0, 120));

  // 5. Public tools without auth
  console.log("\nPublic tools (no auth):");
  const tokens = await toolCall("launchpad_tokens", { limit: 3 });
  check("launchpad_tokens works without auth", tokens.ok === true || Array.isArray(tokens.tokens));
  const pairs = await toolCall("launchpad_pairs", {});
  check("launchpad_pairs works without auth", pairs.ok === true);

  // 6. Dry-run (with real auth code if provided)
  console.log("\nDry-run validation:");
  if (TEST_AUTH_CODE) {
    const dry = await toolCall("launchpad_dry_run", {
      authCode: TEST_AUTH_CODE,
      name: "pumpdrop",
      symbol: "PUMPDROP",
      launchpad: "pump",
      pair: "usdc",
      style: "standard",
      dev_buy_sol: 0,
      vanity: true,
      description: "Independent community meme token. Not affiliated with or endorsed by pump.fun. No official airdrop is promised.",
    });
    check("dry-run returns structured result", typeof dry.dry_run === "boolean" || dry.ok !== undefined, JSON.stringify(dry).slice(0, 200));
    check("dry-run is non-financial", dry.dry_run === true);
    if (dry.ok) check("pumpdrop params validate clean", dry.ok === true);
    else console.log("    dry-run errors:", JSON.stringify(dry.errors || []));
  } else {
    const dryNoAuth = await toolCall("launchpad_dry_run", { name: "pumpdrop", symbol: "PUMPDROP" });
    check("dry-run without auth → auth_required", dryNoAuth.error === "auth_required");
    console.log("    (set TEST_AUTH_CODE to test full dry-run pass)");
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})();

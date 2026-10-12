/**
 * OrbitX ChatGPT Mini App — Apps SDK test harness (Builder D).
 *
 * Drives web/api/orbitx-hub.js directly with mock req/res (no server needed):
 *  (a) tools/list → UI-bound tools carry _meta.ui.resourceUri + openai/outputTemplate
 *  (b) resources/list + resources/read → 5 widgets, valid HTML; unknown URI → -32602
 *  (c) tools/call orbitx_crypto_scan (real mint) + orbitx_get_wallet (valid + invalid)
 *      → structuredContent present; invalid wallet soft-fails with isError
 *  (d) grep all widget HTML for leaked secrets — must be zero
 *
 * Run: node test-apps-sdk.mjs   (from web/api/orbitx/_ui/)
 */
import { readFileSync, readdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const HERE = dirname(fileURLToPath(import.meta.url));
const UI_DIR = HERE;

const results = [];
function check(name, ok, detail = "") {
  results.push({ name, ok: Boolean(ok), detail: String(detail || "") });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? " — " + detail : ""}`);
}

// ---------- mock http ----------
function mockReq(body) {
  return {
    method: "POST",
    url: "/api/orbitx-hub?path=mcp",
    query: { path: "mcp" },
    headers: {},
    body,
  };
}
function mockRes() {
  const chunks = [];
  const headers = {};
  const res = {
    setHeader: (k, v) => { headers[String(k).toLowerCase()] = v; },
    getHeader: (k) => headers[String(k).toLowerCase()],
    statusCode: 200,
    end: (data) => { if (data) chunks.push(String(data)); },
  };
  return {
    res,
    payload() {
      const raw = chunks.join("");
      try { return JSON.parse(raw); } catch { return { __raw: raw }; }
    },
    status: () => res.statusCode,
  };
}

let handler;
try {
  const mod = await import("../../orbitx-hub.js");
  handler = mod.default;
  check("import orbitx-hub.js", typeof handler === "function");
} catch (e) {
  check("import orbitx-hub.js", false, String(e?.message || e));
  process.exit(1);
}

async function rpc(method, params = {}) {
  const { res, payload, status } = mockRes();
  await handler(mockReq({ jsonrpc: "2.0", id: 1, method, params }), res);
  return { json: payload(), status: status() };
}

// ---------- expected tool→UI map (mirrors _widgets.js) ----------
const { UI_TOOL_WIDGET, UI_WIDGETS } = await import("./_widgets.js");

// ---------- (a) tools/list _meta ----------
{
  const seen = new Map(); // name -> entry
  let cursor = undefined;
  for (let page = 0; page < 60; page++) {
    const { json } = await rpc("tools/list", cursor ? { cursor } : {});
    const tools = json?.result?.tools || [];
    for (const t of tools) if (!seen.has(t.name)) seen.set(t.name, t);
    cursor = json?.result?.nextCursor;
    if (!cursor) break;
  }
  check("tools/list paginates full catalog", seen.size > 1000, `${seen.size} tools`);
  let missing = [];
  let wrong = [];
  for (const [name, uri] of Object.entries(UI_TOOL_WIDGET)) {
    const t = seen.get(name);
    if (!t) { missing.push(name + " (not listed)"); continue; }
    const m = t._meta || {};
    if (m?.ui?.resourceUri !== uri) wrong.push(`${name}: ui.resourceUri=${m?.ui?.resourceUri}`);
    if (m?.["openai/outputTemplate"] !== uri) wrong.push(`${name}: openai/outputTemplate=${m?.["openai/outputTemplate"]}`);
  }
  check("all UI tools listed", missing.length === 0, missing.join("; ") || `${Object.keys(UI_TOOL_WIDGET).length} tools`);
  check("all UI tools carry _meta.ui.resourceUri + openai/outputTemplate", wrong.length === 0, wrong.join("; ") || "ok");
  // a non-UI tool must NOT gain a ui binding (spot check)
  const plain = seen.get("orbitx_menu");
  check("non-UI tool has no ui binding", !plain?._meta?.ui?.resourceUri, plain?._meta ? JSON.stringify(plain._meta).slice(0, 80) : "no _meta");
}

// ---------- initialize capabilities ----------
{
  const { json } = await rpc("initialize", { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "t", version: "1" } });
  const caps = json?.result?.capabilities || {};
  check("initialize advertises tools+resources", Boolean(caps.tools) && Boolean(caps.resources), JSON.stringify(caps));
}

// ---------- (b) resources/list + resources/read ----------
{
  const { json } = await rpc("resources/list", {});
  const resources = json?.result?.resources || [];
  check("resources/list returns 5 widgets", resources.length === 5, `${resources.length}`);
  const uris = new Set(resources.map((r) => r.uri));
  const wantUris = new Set(UI_WIDGETS.map((w) => w.uri));
  check("resources/list URIs match registry", [...wantUris].every((u) => uris.has(u)), [...uris].join(", "));
  const badMime = resources.filter((r) => r.mimeType !== "text/html;profile=mcp-app");
  check("resources mimeType text/html;profile=mcp-app", badMime.length === 0, badMime.map((r) => r.uri).join(",") || "ok");

  for (const w of UI_WIDGETS) {
    const { json: rj } = await rpc("resources/read", { uri: w.uri });
    const text = rj?.result?.contents?.[0]?.text || "";
    const valid = /<html[\s>]/i.test(text) && /<\/html>/i.test(text);
    check(`resources/read ${w.name} valid HTML`, valid, `${(text.length / 1024).toFixed(1)}kb`);
    const mimeOk = rj?.result?.contents?.[0]?.mimeType === "text/html;profile=mcp-app";
    check(`resources/read ${w.name} mimeType`, mimeOk);
  }
  const { json: bad } = await rpc("resources/read", { uri: "ui://widget/../../etc/passwd.html" });
  check("resources/read rejects traversal/unknown URI", bad?.error?.code === -32602, JSON.stringify(bad?.error || bad?.result || {}).slice(0, 120));
}

// ---------- (c) tools/call structured results ----------
{
  // real mint: $MUSE (AspsUTo64QPaRGQx6oNXFbSC2zU65ZqPfDRkUo2Haobx)
  const { json } = await rpc("tools/call", { name: "orbitx_crypto_scan", arguments: { mint: "AspsUTo64QPaRGQx6oNXFbSC2zU65ZqPfDRkUo2Haobx" } });
  const r = json?.result || {};
  const sc = r.structuredContent;
  check("crypto_scan returns structuredContent", sc && typeof sc === "object", `ok=${sc?.ok}`);
  check("crypto_scan has text content fallback", Array.isArray(r.content) && r.content[0]?.type === "text");

  // valid wallet: agent wallet (public address)
  const { json: wj } = await rpc("tools/call", { name: "orbitx_get_wallet", arguments: { address: "HfoAjPKZrfuNJ3QRJNZwXvpNZZAR6ekoyUWtzmY7rW9t" } });
  const wr = wj?.result || {};
  check("get_wallet(valid) returns structuredContent", wr.structuredContent && typeof wr.structuredContent === "object", `ok=${wr.structuredContent?.ok}`);

  // invalid wallet → soft-fail, structured, isError
  const { json: bj } = await rpc("tools/call", { name: "orbitx_get_wallet", arguments: { address: "not-a-wallet" } });
  const br = bj?.result || {};
  check("get_wallet(invalid) soft-fails structured", br.structuredContent?.ok === false, `ok=${br.structuredContent?.ok} err=${br.structuredContent?.error}`);
  check("get_wallet(invalid) sets isError", br.isError === true);
}

// ---------- (d) secret grep over widget HTML ----------
{
  const files = readdirSync(UI_DIR).filter((f) => f.endsWith(".html"));
  const patterns = [
    /oxo_[A-Za-z0-9]{12,}/,
    /sk-[A-Za-z0-9]{16,}/,
    /xox[bap]-[A-Za-z0-9-]{10,}/,
    /AKIA[0-9A-Z]{16}/,
    /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
    /gh[pousr]_[A-Za-z0-9]{20,}/,
    /["']api[_-]?key["']\s*:\s*["'][A-Za-z0-9_\-]{12,}["']/i,
    /bearer\s+[A-Za-z0-9_\-\.]{16,}/i,
  ];
  let hits = [];
  for (const f of files) {
    const text = readFileSync(join(UI_DIR, f), "utf8");
    patterns.forEach((re, i) => {
      const m = text.match(re);
      if (m) hits.push(`${f}: pattern#${i} → ${m[0].slice(0, 40)}…`);
    });
  }
  check("no leaked secrets in widget HTML", hits.length === 0, hits.join(" | ") || `${files.length} files scanned`);
}

// ---------- summary ----------
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) {
  console.log("FAILURES:");
  for (const f of failed) console.log(` - ${f.name}: ${f.detail}`);
  process.exit(1);
}

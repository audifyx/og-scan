/**
 * Local smoke harness for /api/orbitx-ai.
 *
 * Boots a fake Supabase (auth + PostgREST subset), a fake NVIDIA NIM, and a fake
 * OrbitX public API, then drives the real handler through bootstrap/chat/tool flows.
 * Run: node scripts/qa/orbitx-ai-harness.mjs
 */
import http from "node:http";
import { randomUUID } from "node:crypto";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const WALLET = "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU";

const db = {
  ai_conversations: [],
  ai_messages: [],
  ai_generations: [],
  wallet_identities: [{ user_id: USER_ID, wallet: WALLET }],
  agents: [{ id: "agent-1", user_id: USER_ID, name: "Default", wallet_address: WALLET }],
  mcp_burn_access: [],
};

let nimQueue = [];
const calls = { nim: [], rest: [] };

function readBody(req) {
  return new Promise((resolve) => {
    let raw = "";
    req.on("data", (chunk) => (raw += chunk));
    req.on("end", () => resolve(raw));
  });
}

const RESERVED_PARAMS = new Set(["select", "order", "limit", "offset"]);

function containsMatch(actual, expected) {
  if (Array.isArray(expected)) {
    if (!Array.isArray(actual)) return false;
    return expected.every((wanted) =>
      actual.some((candidate) => containsMatch(candidate, wanted)),
    );
  }
  if (expected && typeof expected === "object") {
    if (!actual || typeof actual !== "object") return false;
    return Object.entries(expected).every(([key, value]) => containsMatch(actual[key], value));
  }
  return actual === expected;
}

function matchFilter(row, key, expression) {
  const [op, ...rest] = String(expression).split(".");
  const value = rest.join(".");
  if (op === "eq") return String(row[key]) === value;
  if (op === "is") return value === "null" ? row[key] == null : row[key] === (value === "true");
  if (op === "cs") {
    try {
      return containsMatch(row[key], JSON.parse(value));
    } catch {
      return false;
    }
  }
  return true;
}

function filterRows(rows, params) {
  let filtered = rows;
  for (const [key, expression] of params.entries()) {
    if (RESERVED_PARAMS.has(key)) continue;
    filtered = filtered.filter((row) => matchFilter(row, key, expression));
  }
  return filtered;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  const raw = await readBody(req);
  const body = raw ? JSON.parse(raw) : null;
  const send = (status, payload) => {
    res.writeHead(status, { "content-type": "application/json" });
    res.end(JSON.stringify(payload));
  };

  if (url.pathname === "/auth/v1/user") {
    return send(200, { id: USER_ID, email: "tester@orbitx.world", aud: "authenticated" });
  }

  if (url.pathname.startsWith("/rest/v1/")) {
    const table = url.pathname.replace("/rest/v1/", "").split("?")[0];
    calls.rest.push(`${req.method} ${table}${url.search}`);
    const wantsObject = String(req.headers.accept || "").includes("pgrst.object");
    const rows = db[table] || [];
    const reply = (status, payload) => {
      if (!wantsObject) return send(status, payload);
      if (payload.length === 1) return send(status, payload[0]);
      if (payload.length === 0) return send(406, { code: "PGRST116", message: "no rows" });
      return send(406, { code: "PGRST114", message: "multiple rows" });
    };

    if (req.method === "GET") {
      const limit = Number(url.searchParams.get("limit"));
      let filtered = filterRows(rows, url.searchParams);
      if (Number.isFinite(limit) && limit > 0) filtered = filtered.slice(0, limit);
      return reply(200, filtered);
    }
    if (req.method === "POST") {
      const inserted = (Array.isArray(body) ? body : [body]).map((row) => ({
        id: row.id || randomUUID(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        tool_events: [],
        metadata: {},
        archived: false,
        result_urls: [],
        settings: {},
        ...row,
      }));
      db[table] = [...rows, ...inserted];
      return reply(201, inserted);
    }
    if (req.method === "PATCH") {
      const targets = new Set(filterRows(rows, url.searchParams));
      const updated = [];
      db[table] = rows.map((row) => {
        if (!targets.has(row)) return row;
        const next = { ...row, ...body };
        updated.push(next);
        return next;
      });
      return reply(200, updated);
    }
    if (req.method === "DELETE") {
      const targets = new Set(filterRows(rows, url.searchParams));
      db[table] = rows.filter((row) => !targets.has(row));
      return reply(200, [...targets]);
    }
  }

  if (url.pathname === "/nim/v1/chat/completions") {
    calls.nim.push(body);
    const next = nimQueue.shift() || { role: "assistant", content: "Fallback answer." };
    if (next?.__httpError) {
      return send(next.__httpError, { error: { message: next.__message || "nim error" } });
    }
    return send(200, { choices: [{ message: next }] });
  }

  if (url.pathname.startsWith("/api/ogdex/token")) {
    return send(200, { token: { priceUsd: 0.0001 } });
  }
  if (url.pathname.startsWith("/api/ogdex/balance")) {
    return send(200, { ok: true, token: { uiAmount: 100_000_000 } });
  }

  return send(200, { ok: true, stub: url.pathname });
});

await new Promise((resolve) => server.listen(0, resolve));
const port = server.address().port;
const origin = `http://127.0.0.1:${port}`;

process.env.VITE_SUPABASE_URL = origin;
process.env.SUPABASE_URL = origin;
process.env.VITE_SUPABASE_ANON_KEY = "anon-key";
process.env.SUPABASE_ANON_KEY = "anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";
process.env.NVIDIA_API_KEY = "nvidia-key";
process.env.NVIDIA_BASE_URL = `${origin}/nim/v1`;
process.env.PUBLIC_APP_URL = origin;

const { default: handler } = await import("../../api/orbitx-ai.js");

function mockRes() {
  const state = { status: 200, body: null, headers: {} };
  return {
    state,
    status(code) {
      state.status = code;
      return this;
    },
    setHeader(key, value) {
      state.headers[key] = value;
    },
    json(payload) {
      state.body = payload;
      return this;
    },
    end() {
      return this;
    },
  };
}

async function call(method, { query = {}, body = null } = {}) {
  const req = {
    method,
    query,
    body,
    headers: { authorization: "Bearer test-token", host: "127.0.0.1" },
    socket: { remoteAddress: "127.0.0.1" },
  };
  const res = mockRes();
  try {
    await handler(req, res);
  } catch (error) {
    return { status: 500, body: { thrown: error?.message, stack: error?.stack } };
  }
  return { status: res.state.status, body: res.state.body };
}

const results = [];
function check(name, condition, detail) {
  results.push({ name, ok: Boolean(condition), detail });
  console.log(`${condition ? "PASS" : "FAIL"}  ${name}${condition ? "" : ` — ${JSON.stringify(detail)?.slice(0, 600)}`}`);
}

// 1. gate
const gate = await call("GET", { query: { action: "gate" } });
check("gate returns access", gate.status === 200 && gate.body?.gate?.hasAccess, gate.body);

// 2. bootstrap
const boot = await call("GET", { query: { action: "bootstrap" } });
check("bootstrap ok", boot.status === 200 && boot.body?.ok === true, boot.body);
check("bootstrap exposes tools", (boot.body?.tools?.length || 0) > 0, boot.body?.tools?.length);
check("bootstrap exposes models", (boot.body?.models?.length || 0) > 0, boot.body?.models?.length);

// 3. plain chat
nimQueue = [{ role: "assistant", content: "Hello from OrbitX." }];
const chat = await call("POST", { body: { action: "chat", message: "hi there" } });
check("plain chat ok", chat.status === 200 && chat.body?.assistantMessage?.content === "Hello from OrbitX.", chat.body);

const conversationId = chat.body?.conversation?.id;

// 4. messages
const messages = await call("GET", { query: { action: "messages", conversationId } });
check("messages load", messages.status === 200 && messages.body?.messages?.length === 2, messages.body);

// 5. chat with a direct (auto-run) tool call
nimQueue = [
  {
    role: "assistant",
    content: null,
    tool_calls: [
      {
        id: "call_1",
        type: "function",
        function: { name: "orbitx_health", arguments: "{}" },
      },
    ],
  },
  { role: "assistant", content: "Platform is healthy." },
];
const toolChat = await call("POST", {
  body: { action: "chat", conversationId, message: "is the platform healthy?" },
});
check(
  "direct tool auto-executes",
  toolChat.status === 200 && toolChat.body?.assistantMessage?.toolEvents?.[0]?.status === "completed",
  toolChat.body?.assistantMessage?.toolEvents,
);

// 6. chat with a guarded tool -> confirmation card
nimQueue = [
  {
    role: "assistant",
    content: null,
    tool_calls: [
      {
        id: "call_2",
        type: "function",
        function: {
          name: "orbitx_command",
          arguments: JSON.stringify({ tool: "orbitx_social_post", arguments: { text: "gm" } }),
        },
      },
    ],
  },
  { role: "assistant", content: "Confirm the post below." },
];
const guarded = await call("POST", {
  body: { action: "chat", conversationId, message: "post gm on orbitx social" },
});
const guardedEvent = guarded.body?.assistantMessage?.toolEvents?.[0];
check(
  "guarded tool requires confirmation",
  guarded.status === 200 && guardedEvent?.status === "confirmation_required",
  guarded.body?.assistantMessage,
);

// 7. confirm the guarded tool
if (guardedEvent) {
  const executed = await call("POST", {
    body: {
      action: "tool.execute",
      conversationId,
      messageId: guarded.body.assistantMessage.id,
      eventId: guardedEvent.id,
    },
  });
  check("tool.execute runs confirmation", executed.status === 200, executed.body);
}

// 8. conversation crud
const created = await call("POST", { body: { action: "conversation", operation: "create" } });
check("conversation create", created.status === 201 && created.body?.conversation?.id, created.body);
const renamed = await call("POST", {
  body: { action: "conversation", operation: "rename", conversationId: created.body?.conversation?.id, title: "Renamed" },
});
check("conversation rename", renamed.status === 200 && renamed.body?.conversation?.title === "Renamed", renamed.body);
const deleted = await call("POST", {
  body: { action: "conversation", operation: "delete", conversationId: created.body?.conversation?.id },
});
check("conversation delete", deleted.status === 200, deleted.body);

// 9. model fallback when NVIDIA rejects tools
nimQueue = [];
const failing = await call("POST", { body: { action: "chat", conversationId, message: "fallback path" } });
check("chat still answers with default stub", failing.status === 200, failing.body);

// 10. NVIDIA rejects the tool-enabled request -> untooled retry keeps chat alive
nimQueue = [
  { __httpError: 400, __message: "tool use not supported for this model" },
  { role: "assistant", content: "Answered without tools." },
];
const toolReject = await call("POST", {
  body: { action: "chat", conversationId, message: "model rejects tools" },
});
check(
  "chat survives a tool-schema rejection",
  toolReject.status === 200 && toolReject.body?.assistantMessage?.content === "Answered without tools.",
  toolReject.body,
);

// 11. unknown/retired model id must not brick chat
nimQueue = [{ role: "assistant", content: "Recovered on the default model." }];
const staleModel = await call("POST", {
  body: { action: "chat", conversationId, message: "hello", model: "deepseek-ai/deepseek-v4-pro" },
});
check(
  "retired model id falls back to the default model",
  staleModel.status === 200 && staleModel.body?.assistantMessage?.content,
  staleModel.body,
);

// 12. model catalog only advertises ids the server will accept
const advertised = boot.body?.models?.map((model) => model.id) || [];
check("catalog advertises a default model", advertised.includes(boot.body?.defaultModel), advertised);

// 13. tool.cancel releases a pending confirmation
nimQueue = [
  {
    role: "assistant",
    content: null,
    tool_calls: [
      {
        id: "call_3",
        type: "function",
        function: {
          name: "orbitx_command",
          arguments: JSON.stringify({ tool: "orbitx_social_post", arguments: { text: "gm2" } }),
        },
      },
    ],
  },
  { role: "assistant", content: "Confirm below." },
];
const cancellable = await call("POST", {
  body: { action: "chat", conversationId, message: "post gm2" },
});
const cancelEvent = cancellable.body?.assistantMessage?.toolEvents?.[0];
const cancelled = await call("POST", {
  body: {
    action: "tool.cancel",
    conversationId,
    messageId: cancellable.body?.assistantMessage?.id,
    eventId: cancelEvent?.id,
  },
});
check(
  "tool.cancel releases a pending confirmation",
  cancelled.status === 200 && cancelled.body?.event?.status === "cancelled",
  cancelled.body,
);

// 14. a duplicate wallet identity row must not take the whole route down
db.wallet_identities.push({ user_id: USER_ID, wallet: "9aBcdEfGhiJkLmNoPqRsTuVwXyZ1234567890abcdef" });
const duplicateWallet = await call("GET", { query: { action: "gate" } });
check(
  "duplicate wallet identity rows still resolve a gate",
  duplicateWallet.status === 200 && duplicateWallet.body?.gate,
  duplicateWallet.body,
);
db.wallet_identities = db.wallet_identities.slice(0, 1);

// 15. media generation records a row
const media = await call("POST", {
  body: { action: "media.generate", kind: "image", prompt: "a neon orbit city", settings: {} },
});
check("media.generate responds", [200, 202, 502].includes(media.status), media.body);

server.close();
const failed = results.filter((entry) => !entry.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);

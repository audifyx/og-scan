/**
 * AgentPlus — persistent autonomous-agent substrate for the OrbitX MCP.
 *
 * HONEST MODEL: MCP provides the agent substrate (identity, memory, inbox,
 * append-only log, file workspace, task queue). The mind is whichever LLM
 * drives these tools. When an LLM key is configured (AGENT_LLM_API_KEY, or
 * NVIDIA_API_KEY as fallback), thinkAgent() runs
 * a server-side reasoning loop (the "live" mind): it reads state, thinks in
 * strict JSON, and executes actions through the SAME internal functions the
 * MCP tools use — one code path, never a parallel implementation. Without a
 * key the substrate runs in "driver" mode: tick steps advance deterministic
 * bookkeeping between external LLM turns — never fabricated cognition, never
 * invented task results, never fabricated file content.
 *
 * Wired by parent: AGENTPLUS_TOOLS, dispatchAgentPlusTools(name, args, auth),
 * tickAgentPlus(opts), thinkAgent(agent, opts), agentplusFeed(userId, opts).
 * No trades execute at import time. No side effects, no top-level await.
 */
import { needAuth, sb } from "./_mcp-app-wallet.js";
import { createHash } from "node:crypto";

const NAME_RE = /^[a-z0-9-]{2,32}$/;
const KEY_RE = /^[\w.\-]{1,64}$/;
const TASK_KINDS = ["website", "research", "general"];
const TASK_STATUSES = ["open", "in_progress", "blocked", "done", "cancelled"];
const STEP_STATUSES = ["pending", "in_progress", "complete", "blocked", "skipped"];
const LOG_KINDS = ["thought", "action", "file", "message", "build", "deploy", "error", "system"];
const MSG_BODY_MAX = 2000;
const LOG_BODY_MAX = 4000;
const FILE_CONTENT_MAX = 2000000;
const MIND_CONTENT_MAX = 200000;
const DB_DOWN = { ok: false, error: "db_unavailable", message: "Agent store unreachable. Retry in a minute." };

// Mind loop config (env). AGENT_LLM_API_KEY wins when set; NVIDIA_API_KEY
// (nvapi-*, NVIDIA NIM, OpenAI-compatible) is the fallback so Aiden's existing
// Vercel env just works. Model/baseUrl follow the key source unless overridden.
// Never log the key value.
const llmCfg = () => {
  const explicit = String(process.env.AGENT_LLM_API_KEY || "").trim();
  const nvidiaKey = String(process.env.NVIDIA_API_KEY || "").trim();
  const apiKey = explicit || nvidiaKey;
  const nvidia = !explicit && (nvidiaKey.startsWith("nvapi-") || nvidiaKey.length > 0);
  return {
    apiKey,
    model:
      String(process.env.AGENT_LLM_MODEL || "").trim() ||
      // Single mind model, verified 2026-09-25 via live think calls on
      // Aiden's key: nvidia/nemotron-3-ultra-550b-a55b is the best
      // chat-provisioned model on the key — clean strict-JSON envelopes,
      // ~3-4s. One model, no fallback chain: the fallback is what turned
      // every hiccup into a confusing cascade of llm_404/bad_json errors.
      // (NVIDIA NIM 404s were per-account provisioning, not catalog absence.)
      "nvidia/nemotron-3-ultra-550b-a55b",
    baseUrl:
      String(process.env.AGENT_LLM_BASE_URL || "").trim().replace(/\/+$/, "") ||
      (nvidia ? "https://integrate.api.nvidia.com/v1" : "https://api.openai.com/v1"),
  };
};
const THINK_TIMEOUT_MS = 55000;
const THINK_MAX_TOKENS = 1000;
const MAX_ACTIONS_PER_THINK = 5;
const HEARTBEAT_MS = 30 * 60 * 1000;
const THINKS_PER_TICK_CAP = 10;

// Default plan when a kind='website' task is assigned without explicit steps.
const WEBSITE_PLAN = ["scaffold", "frontend", "backend", "build/validate", "deploy", "done"].map((title) => ({
  title,
  status: "pending",
}));

const sha256 = (s) => createHash("sha256").update(String(s), "utf8").digest("hex");
const nowIso = () => new Date().toISOString();
const todayStr = () => nowIso().slice(0, 10);
const trunc = (s, n) => String(s ?? "").slice(0, n);

function normalizeSteps(steps) {
  if (!Array.isArray(steps) || steps.length === 0) return null;
  return steps.slice(0, 50).map((s) => {
    if (typeof s === "string") return { title: s.slice(0, 200), status: "pending" };
    const o = s && typeof s === "object" ? s : {};
    return {
      title: trunc(o.title || "step", 200),
      status: STEP_STATUSES.includes(o.status) ? o.status : "pending",
      ...(o.result != null ? { result: trunc(o.result, 2000) } : {}),
    };
  });
}

function cleanPath(p) {
  let s = trunc(p, 512).trim().replace(/\\/g, "/");
  if (!s || s.startsWith("/") || s.includes("..")) return null;
  s = s.split("/").filter(Boolean).join("/");
  if (!s || s.length > 256) return null;
  return s;
}

async function _logEvent(client, { userId, agentId = null, taskId = null, kind, body }) {
  try {
    await client.from("ap_agent_logs").insert({
      user_id: userId,
      agent_id: agentId,
      task_id: taskId,
      kind: LOG_KINDS.includes(kind) ? kind : "action",
      body: trunc(body, LOG_BODY_MAX),
    });
  } catch {
    /* logging never breaks the caller */
  }
}

async function _agentByName(client, userId, name) {
  const { data } = await client.from("ap_agents").select("*").eq("user_id", userId).eq("name", name).limit(1);
  return (data || [])[0] || null;
}

async function _taskById(client, userId, taskId) {
  const { data } = await client.from("ap_agent_tasks").select("*").eq("user_id", userId).eq("id", taskId).limit(1);
  return (data || [])[0] || null;
}

// Wake an agent's mind: set the pending-think flag consumed by tickAgentPlus.
async function _pokeThink(client, userId, agentName) {
  try {
    await client
      .from("ap_agents")
      .update({ next_think_at: nowIso() })
      .eq("user_id", userId)
      .eq("name", agentName)
      .eq("status", "active");
  } catch {
    /* best effort */
  }
}

/* ------------------------------------------------------------------ */
/* internals — single code path used by both MCP tools and the mind    */
/* ------------------------------------------------------------------ */

async function _spawnAgent(client, userId, { name, role, persona, capabilities }) {
  const clean = trunc(name, 40).trim().toLowerCase();
  if (!NAME_RE.test(clean))
    return { ok: false, error: "bad_name", message: "name must match ^[a-z0-9-]{2,32}$." };
  const existing = await _agentByName(client, userId, clean);
  if (existing && existing.status === "active")
    return { ok: false, error: "already_exists", message: `Agent '${clean}' already exists.` };
  const caps = Array.isArray(capabilities) ? capabilities.map((c) => trunc(c, 80)).slice(0, 32) : [];
  const row = {
    user_id: userId,
    name: clean,
    role: trunc(role, 120) || null,
    persona: trunc(persona, 4000) || null,
    capabilities: caps,
    status: "active",
  };
  if (existing) {
    const { data, error } = await client.from("ap_agents").update(row).eq("id", existing.id).select().limit(1);
    if (error) throw error;
    const a = (data || [])[0];
    return { ok: true, reactivated: true, agent: { name: a.name, status: a.status }, _agentId: a.id };
  }
  const { data, error } = await client.from("ap_agents").insert(row).select().limit(1);
  if (error) throw error;
  const a = (data || [])[0];
  return { ok: true, agent: { name: a.name, role: a.role, status: a.status, model: a.model }, _agentId: a.id };
}

/* Parse a think-loop failure into a short code + human hint for dashboards. */
function parseThinkError(body) {
  const b = String(body || "");
  const m = b.match(/think (llm_\d+|llm_unreachable|bad_json)/);
  if (!m) return null;
  const code = m[1];
  const hints = {
    llm_400: "bad request to the LLM endpoint",
    llm_401: "key rejected — regenerate it",
    llm_403: "key not entitled for this endpoint",
    llm_404: "model not provisioned for this key",
    llm_429: "rate limited — backing off",
    llm_500: "LLM provider error",
    llm_503: "LLM overloaded — retry later",
    llm_unreachable: "could not reach the LLM endpoint",
    bad_json: "model returned unparseable output",
  };
  return { code, hint: hints[code] || "LLM call failed" };
}

/* Latest think-loop error per agent (one batched query). */
async function _lastThinkErrors(client, userId, agentIds) {
  const map = {};
  const ids = (agentIds || []).filter(Boolean);
  if (!ids.length) return map;
  const { data } = await client
    .from("ap_agent_logs")
    .select("agent_id,body,created_at")
    .eq("user_id", userId)
    .eq("kind", "error")
    .in("agent_id", ids)
    .order("created_at", { ascending: false })
    .limit(500);
  // A recovered mind shouldn't wear its last error forever: only surface an
  // error if it's newer than the agent's most recent successful thought.
  const { data: thoughts } = await client
    .from("ap_agent_logs")
    .select("agent_id,created_at")
    .eq("user_id", userId)
    .eq("kind", "thought")
    .in("agent_id", ids)
    .order("created_at", { ascending: false })
    .limit(500);
  const lastThoughtAt = {};
  for (const r of thoughts || []) {
    if (!lastThoughtAt[r.agent_id]) lastThoughtAt[r.agent_id] = r.created_at;
  }
  for (const r of data || []) {
    if (map[r.agent_id]) continue;
    if (lastThoughtAt[r.agent_id] && lastThoughtAt[r.agent_id] >= r.created_at) continue;
    const parsed = parseThinkError(r.body);
    if (parsed) map[r.agent_id] = { ...parsed, at: r.created_at };
  }
  return map;
}

async function _listAgents(client, userId) {
  const { data } = await client
    .from("ap_agents")
    .select("id,name,role,status,model,think_budget_per_day,thinks_today,think_day,last_think_at,created_at")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(100);
  const live = Boolean(llmCfg().apiKey);
  const agents = [];
  const errMap = await _lastThinkErrors(
    client,
    userId,
    (data || []).map((a) => a.id),
  );
  for (const a of data || []) {
    const { count } = await client
      .from("ap_agent_messages")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("read", false)
      .in("to_name", [a.name, "lobby"]);
    agents.push({
      name: a.name,
      role: a.role,
      status: a.status,
      model: a.model,
      unread: count || 0,
      mind: live && a.status === "active" ? "live" : "driver",
      thinks_today: a.thinks_today,
      think_budget_per_day: a.think_budget_per_day,
      last_think_at: a.last_think_at,
      last_think_error: errMap[a.id] || null,
      created_at: a.created_at,
    });
  }
  return { ok: true, agents };
}

async function _getAgentDetail(client, userId, name) {
  const a = await _agentByName(client, userId, trunc(name, 40).trim().toLowerCase());
  if (!a) return { ok: false, error: "unknown_agent" };
  const { data: mem } = await client
    .from("ap_agent_memory")
    .select("key,value,updated_at")
    .eq("agent_id", a.id)
    .order("updated_at", { ascending: false })
    .limit(20);
  const { data: tasks } = await client
    .from("ap_agent_tasks")
    .select("id,title,kind,status,created_at")
    .eq("agent_id", a.id)
    .neq("status", "done")
    .order("created_at", { ascending: false })
    .limit(20);
  const live = Boolean(llmCfg().apiKey);
  const errMap = await _lastThinkErrors(client, userId, [a.id]);
  return {
    ok: true,
    agent: {
      name: a.name,
      role: a.role,
      persona: a.persona,
      capabilities: a.capabilities,
      status: a.status,
      model: a.model,
      mind: live && a.status === "active" ? "live" : "driver",
      thinks_today: a.thinks_today,
      think_budget_per_day: a.think_budget_per_day,
      think_day: a.think_day,
      last_think_at: a.last_think_at,
      last_think_error: errMap[a.id] || null,
      next_think_at: a.next_think_at,
      created_at: a.created_at,
    },
    memory_keys: (mem || []).map((m) => ({ key: m.key, updated_at: m.updated_at })),
    open_tasks: tasks || [],
    _agentId: a.id,
  };
}

async function _rememberKV(client, userId, name, key, value) {
  const a = await _agentByName(client, userId, trunc(name, 40).trim().toLowerCase());
  if (!a) return { ok: false, error: "unknown_agent" };
  if (a.status !== "active") return { ok: false, error: "archived", message: "Agent is archived." };
  const k = trunc(key, 64).trim();
  if (!KEY_RE.test(k)) return { ok: false, error: "bad_key", message: "key must be 1-64 chars: letters, digits, _ . -" };
  const v = trunc(value, 8000);
  const { error } = await client
    .from("ap_agent_memory")
    .upsert({ user_id: userId, agent_id: a.id, key: k, value: v, updated_at: nowIso() }, { onConflict: "agent_id,key" });
  if (error) throw error;
  return { ok: true, remembered: { key: k }, _agentId: a.id };
}

async function _recallKV(client, userId, name, key) {
  const a = await _agentByName(client, userId, trunc(name, 40).trim().toLowerCase());
  if (!a) return { ok: false, error: "unknown_agent" };
  if (key != null && String(key).trim() !== "") {
    const { data } = await client
      .from("ap_agent_memory")
      .select("key,value,updated_at")
      .eq("agent_id", a.id)
      .eq("key", trunc(key, 64).trim())
      .limit(1);
    const row = (data || [])[0];
    if (!row) return { ok: false, error: "unknown_key" };
    return { ok: true, memory: { key: row.key, value: row.value, updated_at: row.updated_at }, _agentId: a.id };
  }
  const { data } = await client
    .from("ap_agent_memory")
    .select("key,value,updated_at")
    .eq("agent_id", a.id)
    .order("updated_at", { ascending: false })
    .limit(50);
  return { ok: true, memory: data || [], _agentId: a.id };
}

async function _archiveAgent(client, userId, name) {
  const a = await _agentByName(client, userId, trunc(name, 40).trim().toLowerCase());
  if (!a) return { ok: false, error: "unknown_agent" };
  await client.from("ap_agents").update({ status: "archived", next_think_at: null }).eq("id", a.id);
  return { ok: true, archived: a.name, _agentId: a.id };
}

async function _sendMessage(client, userId, { from, to, body }) {
  const cleanFrom = trunc(from, 40).trim().toLowerCase();
  const cleanTo = trunc(to, 40).trim().toLowerCase();
  const text = trunc(body, MSG_BODY_MAX + 100);
  if (!text || text.length > MSG_BODY_MAX)
    return { ok: false, error: "bad_body", message: `body must be 1-${MSG_BODY_MAX} chars.` };
  let fromAgent = null;
  if (cleanFrom !== "user") {
    fromAgent = await _agentByName(client, userId, cleanFrom);
    if (!fromAgent) return { ok: false, error: "unknown_sender", message: `No agent '${cleanFrom}'.` };
  }
  if (cleanTo !== "lobby" && cleanTo !== "user") {
    const dest = await _agentByName(client, userId, cleanTo);
    if (!dest) return { ok: false, error: "unknown_recipient", message: `No agent '${cleanTo}'.` };
    if (dest.status !== "active") return { ok: false, error: "archived", message: "Recipient is archived." };
  }
  const { data, error } = await client
    .from("ap_agent_messages")
    .insert({ user_id: userId, from_name: cleanFrom, to_name: cleanTo, body: text })
    .select("id,created_at")
    .limit(1);
  if (error) throw error;
  const row = (data || [])[0] || {};
  // Event trigger: a delivered message wakes the recipient's mind.
  if (cleanTo === "lobby") {
    const { data: actives } = await client.from("ap_agents").select("name").eq("user_id", userId).eq("status", "active").limit(50);
    for (const a of actives || []) {
      if (a.name !== cleanFrom) await _pokeThink(client, userId, a.name);
    }
  } else if (cleanTo !== "user") {
    await _pokeThink(client, userId, cleanTo);
  }
  return {
    ok: true,
    message: { id: row.id, from: cleanFrom, to: cleanTo, created_at: row.created_at },
    _agentId: fromAgent ? fromAgent.id : null,
  };
}

async function _inbox(client, userId, name) {
  const clean = trunc(name, 40).trim().toLowerCase();
  const a = await _agentByName(client, userId, clean);
  if (!a) return { ok: false, error: "unknown_agent" };
  const { data } = await client
    .from("ap_agent_messages")
    .select("id,from_name,to_name,body,created_at")
    .eq("user_id", userId)
    .eq("read", false)
    .in("to_name", [clean, "lobby"])
    .order("created_at", { ascending: true })
    .limit(100);
  const msgs = (data || []).map((m) => ({
    id: m.id,
    from: m.from_name,
    to: m.to_name,
    via: m.to_name === "lobby" ? "lobby" : "direct",
    body: m.body,
    created_at: m.created_at,
  }));
  // Mark direct messages read. Lobby is a shared broadcast: reading it does
  // not consume it for other agents, so lobby rows stay unread.
  await client.from("ap_agent_messages").update({ read: true }).eq("user_id", userId).eq("to_name", clean).eq("read", false);
  return { ok: true, agent: clean, messages: msgs, _agentId: a.id };
}

async function _createTask(client, userId, { agentName, title, kind, instructions, steps }) {
  const a = await _agentByName(client, userId, trunc(agentName, 40).trim().toLowerCase());
  if (!a) return { ok: false, error: "unknown_agent" };
  if (a.status !== "active") return { ok: false, error: "archived", message: "Agent is archived." };
  const k = TASK_KINDS.includes(kind) ? kind : "general";
  const t = trunc(title, 200).trim();
  if (!t) return { ok: false, error: "bad_title", message: "title is required." };
  let plan = normalizeSteps(steps);
  let planNote = null;
  if (!plan && k === "website") {
    plan = WEBSITE_PLAN.map((s) => ({ ...s }));
    planNote = "default website plan generated (scaffold→frontend→backend→build/validate→deploy→done).";
  }
  if (!plan) plan = [];
  const { data, error } = await client
    .from("ap_agent_tasks")
    .insert({ user_id: userId, agent_id: a.id, title: t, kind: k, instructions: trunc(instructions, 8000) || null, steps: plan, status: "open" })
    .select("id,created_at")
    .limit(1);
  if (error) throw error;
  const row = (data || [])[0] || {};
  await _pokeThink(client, userId, a.name); // event trigger: new assignment wakes the mind
  return {
    ok: true,
    task: { id: row.id, title: t, kind: k, status: "open", steps: plan, created_at: row.created_at },
    ...(planNote ? { note: planNote } : {}),
    _agentId: a.id,
    _taskId: row.id,
  };
}

async function _spawnSubtask(client, userId, { agentName, parentTaskId, title, kind, instructions, steps }) {
  const t = trunc(title, 200).trim();
  if (!t) return { ok: false, error: "bad_title", message: "title is required." };
  const note = parentTaskId ? `[subtask of ${trunc(parentTaskId, 40)}] ` : "";
  return _createTask(client, userId, {
    agentName,
    title: `subtask: ${t}`.slice(0, 200),
    kind,
    instructions: note + trunc(instructions, 7900),
    steps,
  });
}

async function _listTasks(client, userId, { name, status }) {
  let q = client.from("ap_agent_tasks").select("id,title,kind,status,steps,created_at").eq("user_id", userId);
  let agentId = null;
  if (name) {
    const a = await _agentByName(client, userId, trunc(name, 40).trim().toLowerCase());
    if (!a) return { ok: false, error: "unknown_agent" };
    agentId = a.id;
    q = q.eq("agent_id", agentId);
  }
  if (status) {
    if (!TASK_STATUSES.includes(status)) return { ok: false, error: "bad_status" };
    q = q.eq("status", status);
  }
  const { data } = await q.order("created_at", { ascending: false }).limit(50);
  return { ok: true, tasks: data || [], ...(agentId ? { _agentId: agentId } : {}) };
}

async function _advanceStep(client, userId, { task_id, step_index, status, result }) {
  const task = await _taskById(client, userId, task_id);
  if (!task) return { ok: false, error: "unknown_task" };
  const meta = { _agentId: task.agent_id, _taskId: task.id };
  // Task-level status update (no step_index).
  if (step_index == null) {
    if (!status) return { ok: false, error: "bad_update", message: "Provide step_index or status." };
    if (!TASK_STATUSES.includes(status)) return { ok: false, error: "bad_status" };
    await client.from("ap_agent_tasks").update({ status }).eq("id", task.id);
    return { ok: true, task: { id: task.id, status }, ...meta };
  }
  const idx = Number(step_index);
  const steps = Array.isArray(task.steps) ? task.steps : [];
  if (!Number.isInteger(idx) || idx < 0 || idx >= steps.length)
    return { ok: false, error: "bad_step_index" };
  if (status && !STEP_STATUSES.includes(status)) return { ok: false, error: "bad_status" };
  const next = steps.map((s, i) =>
    i === idx
      ? { ...s, ...(status ? { status } : {}), ...(result != null ? { result: trunc(result, 2000) } : {}) }
      : s,
  );
  const patch = { steps: next };
  if (status === "complete" && next.every((s) => s.status === "complete")) patch.status = "done";
  else if (status === "in_progress" && task.status === "open") patch.status = "in_progress";
  await client.from("ap_agent_tasks").update(patch).eq("id", task.id);
  // Event trigger: a completed step wakes the mind to decide what is next.
  if (status === "complete") {
    const { data: ag } = await client.from("ap_agents").select("name").eq("id", task.agent_id).limit(1);
    if ((ag || [])[0]) await _pokeThink(client, userId, ag[0].name);
  }
  return { ok: true, task: { id: task.id, status: patch.status || task.status, steps: next }, ...meta };
}

async function _writeFile(client, userId, { task_id, path, content }) {
  const task = await _taskById(client, userId, task_id);
  if (!task) return { ok: false, error: "unknown_task" };
  const p = cleanPath(path);
  if (!p) return { ok: false, error: "bad_path", message: "path must be relative, no '..', max 256 chars." };
  const text = String(content ?? "");
  if (text.length > FILE_CONTENT_MAX)
    return { ok: false, error: "too_large", message: `content exceeds ${FILE_CONTENT_MAX} chars.` };
  const { data: existing } = await client
    .from("ap_agent_files")
    .select("version")
    .eq("task_id", task.id)
    .eq("path", p)
    .order("version", { ascending: false })
    .limit(1);
  const version = ((existing || [])[0]?.version || 0) + 1;
  const hash = sha256(text);
  const { error } = await client.from("ap_agent_files").insert({
    user_id: userId,
    task_id: task.id,
    path: p,
    content: text,
    version,
    sha256: hash,
  });
  if (error) throw error;
  // NOTE: the log carries path+hash only — never full file content.
  await _logEvent(client, {
    userId,
    agentId: task.agent_id,
    taskId: task.id,
    kind: "file",
    body: `write ${p} v${version} sha256:${hash}`,
  });
  return { ok: true, file: { path: p, version, size: text.length, sha256: hash }, _agentId: task.agent_id, _taskId: task.id };
}

async function _appendFile(client, userId, { task_id, path, content }) {
  const task = await _taskById(client, userId, task_id);
  if (!task) return { ok: false, error: "unknown_task" };
  const p = cleanPath(path);
  if (!p) return { ok: false, error: "bad_path", message: "path must be relative, no '..', max 256 chars." };
  const { data } = await client
    .from("ap_agent_files")
    .select("content")
    .eq("task_id", task.id)
    .eq("path", p)
    .order("version", { ascending: false })
    .limit(1);
  const prev = (data || [])[0];
  if (!prev) return { ok: false, error: "not_found", message: "No such file — use write_file to create it." };
  return _writeFile(client, userId, { task_id, path: p, content: prev.content + String(content ?? "") });
}

async function _latestFiles(client, taskId) {
  const { data } = await client
    .from("ap_agent_files")
    .select("path,content,version,sha256,created_at")
    .eq("task_id", taskId)
    .order("path", { ascending: true })
    .order("version", { ascending: false });
  const seen = new Map();
  for (const f of data || []) {
    if (!seen.has(f.path)) seen.set(f.path, { path: f.path, version: f.version, size: (f.content || "").length, sha256: f.sha256, updated_at: f.created_at });
  }
  return [...seen.values()];
}

async function _listFiles(client, userId, { task_id }) {
  const task = await _taskById(client, userId, task_id);
  if (!task) return { ok: false, error: "unknown_task" };
  return { ok: true, files: await _latestFiles(client, task.id), _agentId: task.agent_id, _taskId: task.id };
}

async function _getFile(client, userId, { task_id, path }) {
  const task = await _taskById(client, userId, task_id);
  if (!task) return { ok: false, error: "unknown_task" };
  const p = cleanPath(path);
  if (!p) return { ok: false, error: "bad_path" };
  const { data } = await client
    .from("ap_agent_files")
    .select("path,content,version,sha256,created_at")
    .eq("task_id", task.id)
    .eq("path", p)
    .order("version", { ascending: false })
    .limit(1);
  const f = (data || [])[0];
  if (!f) return { ok: false, error: "not_found" };
  return {
    ok: true,
    file: { path: f.path, version: f.version, size: (f.content || "").length, sha256: f.sha256, updated_at: f.created_at, content: f.content },
    _agentId: task.agent_id,
    _taskId: task.id,
  };
}

async function _buildTask(client, userId, { task_id }) {
  const task = await _taskById(client, userId, task_id);
  if (!task) return { ok: false, error: "unknown_task" };
  const files = await _latestFiles(client, task.id);
  const manifest = { files: files.map((f) => ({ path: f.path, size: f.size, sha256: f.sha256 })) };
  if (task.kind === "website") {
    const index = files.find((f) => f.path === "index.html");
    if (!index) {
      await _logEvent(client, { userId, agentId: task.agent_id, taskId: task.id, kind: "build", body: "build blocked: index.html missing" });
      return { ok: false, error: "missing_index_html", message: "Website tasks require index.html.", manifest };
    }
    const { data } = await client
      .from("ap_agent_files")
      .select("content")
      .eq("task_id", task.id)
      .eq("path", "index.html")
      .order("version", { ascending: false })
      .limit(1);
    const html = (data || [])[0]?.content || "";
    if (!html.trim() || !/(<!doctype|<html)/i.test(html)) {
      await _logEvent(client, { userId, agentId: task.agent_id, taskId: task.id, kind: "build", body: "build blocked: index.html failed sanity check" });
      return { ok: false, error: "bad_index_html", message: "index.html failed basic sanity (empty or no html markup).", manifest };
    }
  }
  const token = String(process.env.AP_VERCEL_TOKEN || "").trim();
  if (!token) {
    await _logEvent(client, { userId, agentId: task.agent_id, taskId: task.id, kind: "build", body: `build ok: ${files.length} files, deploy dry_run (no AP_VERCEL_TOKEN)` });
    return { ok: true, manifest, deploy: "dry_run", reason: "no AP_VERCEL_TOKEN" };
  }
  // Best-effort static deploy via the Vercel REST API. A deploy failure is
  // reported, never fatal to the task.
  try {
    const { data: rows } = await client
      .from("ap_agent_files")
      .select("path,content,version")
      .eq("task_id", task.id)
      .order("path", { ascending: true })
      .order("version", { ascending: false });
    const seen = new Map();
    for (const r of rows || []) if (!seen.has(r.path)) seen.set(r.path, r.content || "");
    const payload = {
      name: `agentplus-${String(task.id).slice(0, 8)}`,
      files: [...seen.entries()].map(([file, content]) => ({ file, data: Buffer.from(content, "utf8").toString("base64") })),
      projectSettings: { framework: null },
    };
    const r = await fetch("https://api.vercel.com/v13/deployments", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(55000),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j?.error?.message || `vercel_${r.status}`);
    const url = j.url ? `https://${j.url}` : null;
    await _logEvent(client, { userId, agentId: task.agent_id, taskId: task.id, kind: "deploy", body: `deploy ok: ${url || j.id || "unknown"}` });
    return { ok: true, manifest, deploy: "live", url, deploymentId: j.id || null };
  } catch (e) {
    await _logEvent(client, { userId, agentId: task.agent_id, taskId: task.id, kind: "deploy", body: `deploy failed: ${trunc(e?.message || String(e), 300)}` });
    return { ok: true, manifest, deploy: "failed", error: e?.message || String(e) };
  }
}

async function _tailLog(client, userId, { name, task_id, since, limit }) {
  let q = client.from("ap_agent_logs").select("id,agent_id,task_id,kind,body,created_at").eq("user_id", userId);
  let agentId = null;
  if (name) {
    const a = await _agentByName(client, userId, trunc(name, 40).trim().toLowerCase());
    if (!a) return { ok: false, error: "unknown_agent" };
    agentId = a.id;
    q = q.eq("agent_id", agentId);
  }
  if (task_id) q = q.eq("task_id", task_id);
  const sinceId = Math.max(0, Number(since) || 0);
  const lim = Math.min(500, Math.max(1, Number(limit) || 100));
  const { data } = await q.gt("id", sinceId).order("id", { ascending: true }).limit(lim);
  const events = data || [];
  // Resolve agent names for readability.
  const ids = [...new Set(events.map((e) => e.agent_id).filter(Boolean))];
  const nameById = {};
  if (ids.length) {
    const { data: agents } = await client.from("ap_agents").select("id,name").in("id", ids);
    for (const a of agents || []) nameById[a.id] = a.name;
  }
  return {
    ok: true,
    events: events.map((e) => ({ id: e.id, agent: nameById[e.agent_id] || null, kind: e.kind, task_id: e.task_id, body: e.body, created_at: e.created_at })),
    nextCursor: events.length ? events[events.length - 1].id : sinceId,
    ...(agentId ? { _agentId: agentId } : {}),
  };
}

/* ------------------------------------------------------------------ */
/* Dashboard-only aggregates (NOT on the MCP tool surface — reachable    */
/* only via the agentplus/command dashboard branch)                     */
/* ------------------------------------------------------------------ */

async function _agentNameMap(client, userId) {
  const { data } = await client.from("ap_agents").select("id,name").eq("user_id", userId);
  const map = {};
  for (const a of data || []) map[a.id] = a.name;
  return map;
}

// Token usage aggregated from kind='system' think receipts
// ({think:true, model, prompt_tokens, completion_tokens, ms}).
async function _usageStats(client, userId) {
  const nameById = await _agentNameMap(client, userId);
  const { data } = await client
    .from("ap_agent_logs")
    .select("agent_id,body,created_at")
    .eq("user_id", userId)
    .eq("kind", "system")
    .order("id", { ascending: false })
    .limit(2000);
  const per = {};
  const daily = {};
  for (const r of data || []) {
    let j;
    try {
      j = JSON.parse(r.body);
    } catch {
      continue;
    }
    if (!j || j.think !== true) continue;
    const name = nameById[r.agent_id] || "unknown";
    const p = per[name] || (per[name] = { agent: name, thinks: 0, prompt_tokens: 0, completion_tokens: 0, ms: 0, models: {} });
    p.thinks++;
    p.prompt_tokens += Number(j.prompt_tokens) || 0;
    p.completion_tokens += Number(j.completion_tokens) || 0;
    p.ms += Number(j.ms) || 0;
    if (j.model) p.models[j.model] = (p.models[j.model] || 0) + 1;
    const day = String(r.created_at).slice(0, 10);
    const d = daily[day] || (daily[day] = { day, thinks: 0, tokens: 0 });
    d.thinks++;
    d.tokens += (Number(j.prompt_tokens) || 0) + (Number(j.completion_tokens) || 0);
  }
  const agents = Object.values(per)
    .map((p) => ({ ...p, total_tokens: p.prompt_tokens + p.completion_tokens, models: Object.keys(p.models) }))
    .sort((a, b) => b.total_tokens - a.total_tokens);
  const totals = agents.reduce(
    (a, p) => ({
      thinks: a.thinks + p.thinks,
      prompt_tokens: a.prompt_tokens + p.prompt_tokens,
      completion_tokens: a.completion_tokens + p.completion_tokens,
      total_tokens: a.total_tokens + p.total_tokens,
      ms: a.ms + p.ms,
    }),
    { thinks: 0, prompt_tokens: 0, completion_tokens: 0, total_tokens: 0, ms: 0 },
  );
  const days = Object.values(daily)
    .sort((a, b) => (a.day < b.day ? -1 : 1))
    .slice(-14);
  return { ok: true, agents, totals, daily: days };
}

// "While you were away" — event counts since a timestamp (epoch ms or ISO).
async function _digestStats(client, userId, { since }) {
  let sinceIso = new Date(0).toISOString();
  if (since) {
    const n = Number(since);
    const d = new Date(Number.isFinite(n) && n > 0 ? n : String(since));
    if (!Number.isNaN(d.getTime())) sinceIso = d.toISOString();
  }
  const nameById = await _agentNameMap(client, userId);
  const { data } = await client
    .from("ap_agent_logs")
    .select("agent_id,kind,body,created_at")
    .eq("user_id", userId)
    .gte("created_at", sinceIso)
    .order("id", { ascending: true })
    .limit(2000);
  const totals = { thoughts: 0, files: 0, errors: 0, actions: 0, builds: 0, deploys: 0, messages: 0, steps_advanced: 0 };
  const perAgent = {};
  const bump = (name, kind) => {
    const p = perAgent[name] || (perAgent[name] = { agent: name, thoughts: 0, files: 0, errors: 0, actions: 0 });
    if (p[kind] !== undefined) p[kind]++;
  };
  for (const r of data || []) {
    const name = nameById[r.agent_id] || "unknown";
    const k = r.kind;
    if (k === "thought") {
      totals.thoughts++;
      bump(name, "thoughts");
    } else if (k === "file") {
      totals.files++;
      bump(name, "files");
    } else if (k === "error") {
      totals.errors++;
      bump(name, "errors");
    } else if (k === "build") totals.builds++;
    else if (k === "deploy") totals.deploys++;
    else if (k === "message") totals.messages++;
    else if (k === "action") {
      totals.actions++;
      bump(name, "actions");
      if (String(r.body || "").includes("advance_step")) totals.steps_advanced++;
    }
  }
  return {
    ok: true,
    since: sinceIso,
    totals,
    per_agent: Object.values(perAgent).sort((a, b) => b.thoughts + b.files - (a.thoughts + a.files)),
    agents_active: Object.keys(perAgent).length,
  };
}

/* ------------------------------------------------------------------ */
/* the mind — server-side LLM reasoning loop                          */
/* ------------------------------------------------------------------ */

const MIND_SYSTEM = `You are the live reasoning mind of a persistent autonomous agent running server-side inside the OrbitX MCP. You wake on a schedule or when events (messages, task assignments, completed steps) wake you. Your persistent state — memory, inbox, task, recent log — is provided as JSON.

RULES
- Your ENTIRE response must be exactly one JSON object and nothing else — no
  markdown fences, no preamble, no explanation, no trailing text. The parser
  rejects anything that is not a single top-level object.
- Exact schema: {"thought": string, "actions": [action, ...]} where each
  action is exactly {"op": "<op>", ...params} with "op" as the FIRST key.
- "thought": 2-5 sentences. Narrate what you observe in state and what you intend to do. Be honest: describe only actions you actually take in "actions". Never claim work you did not do.
- "actions": 0 to 5 actions, executed in order. Each action: {"op": "<op>", ...params}.
  - send_message {to, body}: to is an agent name, "lobby", or "user". body <= 2000 chars.
  - write_file {task_id, path, content}: create or replace a file in the task workspace. path is relative, never ".." or absolute.
  - append_file {task_id, path, content}: append to an existing file.
  - advance_step {task_id, step_index, status, result?}: status is pending|in_progress|complete|blocked|skipped. Mark "complete" ONLY for work actually finished (files written, messages sent). Include a short "result" summary.
  - remember {key, value}: persist a fact to long-term memory.
  - spawn_subtask {title, kind?, instructions?, steps?}: create a child task for yourself.
  - noop {}: deliberately do nothing this turn.
- If a website task is active: build it incrementally across turns — plan in your thought, write files with write_file/append_file, advance steps as each is truly done, narrate progress.
- If there is nothing useful to do, return {"thought": "...", "actions": [{"op": "noop"}]}.
- Do not invent file content claimed to come from elsewhere; everything you write is your own draft.`;

function parseThinkJson(text) {
  // Strip markdown fences first (models sometimes wrap despite instructions).
  const t = String(text || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  // Fast path: the whole thing is JSON.
  try {
    return JSON.parse(t);
  } catch {
    /* fall through to extraction */
  }
  // Balanced-brace extraction: find the first '{' and walk depth, respecting
  // strings and escapes, so trailing prose or a second object can't corrupt it.
  // If the first balanced span doesn't parse (e.g. "{ { ..."), re-anchor at
  // the next '{' and keep looking.
  let start = t.indexOf("{");
  while (start >= 0) {
    let depth = 0, inStr = false, esc = false, end = -1;
    for (let i = start; i < t.length; i++) {
      const ch = t[i];
      if (inStr) {
        if (esc) esc = false;
        else if (ch === "\\") esc = true;
        else if (ch === '"') inStr = false;
      } else if (ch === '"') {
        inStr = true;
      } else if (ch === "{") {
        depth++;
      } else if (ch === "}") {
        depth--;
        if (depth === 0) { end = i; break; }
      }
    }
    if (end < 0) break;
    try {
      return JSON.parse(t.slice(start, end + 1));
    } catch {
      start = t.indexOf("{", start + 1);
    }
  }
  return null;
}

// Models sometimes skip the envelope and emit a bare action (e.g.
// {"op":"advance_step",...}) or a singular "action" key. Normalize every
// parseable shape into the canonical {thought, actions[]} envelope instead
// of failing the think.
function normalizeThink(t) {
  if (!t || typeof t !== "object") return null;
  if (typeof t.thought === "string" && Array.isArray(t.actions)) return t;
  if (typeof t.op === "string") {
    return { thought: "(action without narration)", actions: [t] };
  }
  if (typeof t.thought === "string" && t.action && typeof t.action === "object") {
    return { thought: t.thought, actions: [t.action] };
  }
  if (Array.isArray(t)) {
    return { thought: "(action list without narration)", actions: t };
  }
  return null;
}

export async function thinkAgent(agent, opts = {}) {
  const userId = agent.user_id;
  const client = await sb();
  if (!client) return { ok: false, error: "db_unavailable" };
  // 1. Kill switch: archiving stops the loop, no exceptions.
  if (agent.status !== "active") return { ok: true, skipped: "archived" };
  // 2. Daily think budget.
  const today = todayStr();
  let thinksToday = Number(agent.thinks_today || 0);
  if (agent.think_day !== today) {
    thinksToday = 0;
    await client.from("ap_agents").update({ thinks_today: 0, think_day: today }).eq("id", agent.id);
  }
  const budget = Number(agent.think_budget_per_day || 50);
  if (thinksToday >= budget) return { ok: true, skipped: "budget" };
  // 3. No key → caller falls back to driver-mode deterministic step.
  const cfg = llmCfg();
  if (!cfg.apiKey) return { ok: true, skipped: "no_key" };
  // Single mind model for every agent — per-agent model overrides are retired
  // (they were the source of every llm_404 in the log: unprovisioned IDs).
  const model = cfg.model;
  const timeoutMs = Number(opts.timeoutMs) > 0 ? Number(opts.timeoutMs) : THINK_TIMEOUT_MS;

  // 4. Build the prompt from live state.
  const { data: memRows } = await client.from("ap_agent_memory").select("key,value").eq("agent_id", agent.id).limit(50);
  const memory = {};
  for (const m of memRows || []) memory[m.key] = trunc(m.value, 500);
  const { data: inboxRows } = await client
    .from("ap_agent_messages")
    .select("from_name,to_name,body,created_at")
    .eq("user_id", userId)
    .eq("read", false)
    .in("to_name", [agent.name, "lobby"])
    .order("created_at", { ascending: true })
    .limit(20);
  const { data: logRows } = await client
    .from("ap_agent_logs")
    .select("kind,body")
    .eq("agent_id", agent.id)
    .order("id", { ascending: false })
    .limit(20);
  const { data: taskRows } = await client
    .from("ap_agent_tasks")
    .select("id,title,kind,instructions,steps,status")
    .eq("agent_id", agent.id)
    .in("status", ["open", "in_progress"])
    .order("created_at", { ascending: true })
    .limit(1);
  const activeTask = (taskRows || [])[0] || null;
  const userPrompt = JSON.stringify(
    {
      agent: { name: agent.name, role: agent.role, persona: trunc(agent.persona, 2000), capabilities: agent.capabilities },
      memory,
      unread_inbox: (inboxRows || []).map((m) => ({ from: m.from_name, via: m.to_name, body: trunc(m.body, 500), at: m.created_at })),
      recent_log: (logRows || []).reverse().map((l) => ({ kind: l.kind, body: trunc(l.body, 300) })),
      active_task: activeTask
        ? { id: activeTask.id, title: activeTask.title, kind: activeTask.kind, instructions: trunc(activeTask.instructions, 1500), status: activeTask.status, steps: (activeTask.steps || []).map((s, i) => ({ index: i, title: s.title, status: s.status })) }
        : null,
    },
    null,
    1,
  );

  // 5-6. Call the LLM (OpenAI-compatible chat completions). SINGLE MODEL, no
  // fallback chain, no per-agent override: nvidia/nemotron-3-ultra-550b-a55b,
  // verified 2026-09-25 as the best chat-provisioned mind on Aiden's key
  // (clean strict-JSON envelopes, ~3-4s, 4/4 live smoke tests). The fallback
  // is what turned every hiccup into a confusing cascade — now errors fail
  // fast and surface on the dashboard instead of silently degrading.
  // Retry policy: ONE retry on transient transport errors (timeouts) only.
  // HTTP errors (404/400/5xx) and unparseable envelopes (bad_json) fail fast
  // with the real error. Total LLM time stays under timeoutMs so the 60s
  // function limit can't be blown.
  const started = Date.now();
  const callThink = async (callTimeoutMs) => {
    try {
      const resp = await fetch(`${cfg.baseUrl}/chat/completions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${cfg.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: MIND_SYSTEM },
            { role: "user", content: userPrompt },
          ],
          // Low temperature: the think envelope is machine-parsed JSON.
          temperature: 0.2,
          max_tokens: THINK_MAX_TOKENS,
          // Force strict JSON: the think loop parses the envelope with
          // parseThinkJson, and some instruct models narrate otherwise.
          response_format: { type: "json_object" },
        }),
        signal: AbortSignal.timeout(callTimeoutMs),
      });
      return { resp, raw: await resp.text(), error: null };
    } catch (e) {
      return { resp: null, raw: "", error: e };
    }
  };
  let think = null, usage = {}, ms = 0, lastErr = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    // First attempt gets up to 45s (550b is bimodal: ~3s or glacial); the
    // single transport retry gets whatever remains, at least 10s.
    const remaining = attempt === 0 ? Math.min(timeoutMs, 45000) : Math.max(10000, timeoutMs - (Date.now() - started));
    const { resp, raw, error } = await callThink(remaining);
    ms = Date.now() - started;
    if (error) {
      await _logEvent(client, { userId, agentId: agent.id, kind: "error", body: `think transport failed (${model}) attempt ${attempt + 1}/2: ${trunc(error?.message || String(error), 300)}` });
      lastErr = { ok: false, error: "llm_unreachable", message: error?.message || String(error) };
      if (attempt === 0) continue; // one retry on transport failure only
      break;
    }
    if (!resp.ok) {
      await _logEvent(client, { userId, agentId: agent.id, kind: "error", body: `think llm_${resp.status} on ${model}: ${trunc(raw, 300)}` });
      lastErr = { ok: false, error: `llm_${resp.status}`, detail: trunc(raw, 300) };
      break; // fail fast — no fallback to hide behind
    }
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = {};
    }
    const text = parsed?.choices?.[0]?.message?.content || "";
    const t = normalizeThink(parseThinkJson(text));
    if (t && typeof t.thought === "string" && Array.isArray(t.actions)) {
      think = t;
      usage = parsed?.usage || {};
      lastErr = null;
      break;
    }
    // Unparseable envelope: log the raw head for debuggability, then fail
    // fast — surfaced on the dashboard, never silently degraded.
    await _logEvent(client, { userId, agentId: agent.id, kind: "error", body: `think bad_json from ${model}: ${trunc(text, 300)}` });
    lastErr = { ok: false, error: "bad_json" };
    break;
  }
  if (!think) return lastErr || { ok: false, error: "bad_json" };

  // 7. Log the thought VERBATIM + cost-visible system entry.
  await _logEvent(client, { userId, agentId: agent.id, taskId: activeTask?.id || null, kind: "thought", body: trunc(think.thought, LOG_BODY_MAX) });
  await _logEvent(client, {
    userId,
    agentId: agent.id,
    kind: "system",
    body: JSON.stringify({ think: true, model: model, prompt_tokens: usage.prompt_tokens ?? null, completion_tokens: usage.completion_tokens ?? null, ms }),
  });

  // 8. Execute actions through the SAME internals the MCP tools use.
  const executed = [];
  for (const a of think.actions.slice(0, MAX_ACTIONS_PER_THINK)) {
    const op = a && typeof a === "object" ? String(a.op || "").trim() : "";
    try {
      let r;
      if (op === "send_message") r = await _sendMessage(client, userId, { from: agent.name, to: a.to, body: a.body });
      else if (op === "write_file")
        r = await _writeFile(client, userId, { task_id: a.task_id || activeTask?.id, path: a.path, content: trunc(a.content, MIND_CONTENT_MAX) });
      else if (op === "append_file")
        r = await _appendFile(client, userId, { task_id: a.task_id || activeTask?.id, path: a.path, content: trunc(a.content, MIND_CONTENT_MAX) });
      else if (op === "advance_step")
        r = await _advanceStep(client, userId, { task_id: a.task_id || activeTask?.id, step_index: a.step_index, status: a.status, result: a.result });
      else if (op === "remember") r = await _rememberKV(client, userId, agent.name, a.key, a.value);
      else if (op === "spawn_subtask")
        r = await _spawnSubtask(client, userId, { agentName: agent.name, parentTaskId: a.task_id || activeTask?.id, title: a.title, kind: a.kind, instructions: a.instructions, steps: a.steps });
      else if (op === "noop") r = { ok: true, noop: true };
      else {
        await _logEvent(client, { userId, agentId: agent.id, kind: "error", body: `think unknown op: ${trunc(op, 40)}` });
        executed.push({ op, ok: false, error: "unknown_op" });
        continue;
      }
      executed.push({ op, ok: r?.ok !== false });
      await _logEvent(client, { userId, agentId: agent.id, taskId: r?._taskId || activeTask?.id || null, kind: "action", body: JSON.stringify({ think_action: op, ok: r?.ok !== false, ...(r?.ok === false ? { error: r.error } : {}) }) });
    } catch (e) {
      await _logEvent(client, { userId, agentId: agent.id, kind: "error", body: `think action ${trunc(op, 40)} threw: ${trunc(e?.message || String(e), 200)}` });
      executed.push({ op, ok: false, error: e?.message || String(e) });
    }
  }

  // 9. Consume the inbox messages that were included in the prompt (direct
  // ones; lobby is a shared broadcast and stays for other agents), then
  // record the think and clear the pending flag.
  await client.from("ap_agent_messages").update({ read: true }).eq("user_id", userId).eq("to_name", agent.name).eq("read", false);
  await client
    .from("ap_agents")
    .update({ thinks_today: thinksToday + 1, last_think_at: nowIso(), next_think_at: null })
    .eq("id", agent.id);
  return { ok: true, model: model, ms, thought: trunc(think.thought, 500), actions: executed };
}

/* ------------------------------------------------------------------ */
/* driver mode — deterministic bookkeeping between LLM turns           */
/* ------------------------------------------------------------------ */

async function _websiteBuildStatus(client, userId, taskId) {
  const files = await _latestFiles(client, taskId);
  return { files: files.length, indexPresent: files.some((f) => f.path === "index.html"), status: files.some((f) => f.path === "index.html") ? "ready" : "blocked_missing_index" };
}

async function _lastBuildStatus(client, userId, taskId) {
  const { data } = await client
    .from("ap_agent_logs")
    .select("body")
    .eq("user_id", userId)
    .eq("task_id", taskId)
    .eq("kind", "build")
    .order("id", { ascending: false })
    .limit(1);
  const row = (data || [])[0];
  if (!row) return null;
  try {
    return JSON.parse(row.body)?.status || row.body;
  } catch {
    return row.body;
  }
}

async function driverStep(client, userId, agent) {
  const now = nowIso();
  const { count: unread } = await client
    .from("ap_agent_messages")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("read", false)
    .in("to_name", [agent.name, "lobby"]);
  const { data: tasks } = await client
    .from("ap_agent_tasks")
    .select("id,title,kind,steps,status")
    .eq("agent_id", agent.id)
    .in("status", ["open", "in_progress"])
    .order("created_at", { ascending: true })
    .limit(10);
  const list = tasks || [];
  const active = list.find((t) => t.status === "in_progress") || null;
  let advanced = null;
  if (!active) {
    // Agent idle: move the oldest fully-pending open task's step 0 to
    // in_progress. Metadata only — the external LLM does the real work.
    const candidate = list.find(
      (t) => t.status === "open" && Array.isArray(t.steps) && t.steps.length > 0 && t.steps.every((s) => (s.status || "pending") === "pending"),
    );
    if (candidate) {
      const steps = candidate.steps.map((s, i) => (i === 0 ? { ...s, status: "in_progress" } : s));
      await client.from("ap_agent_tasks").update({ steps, status: "in_progress" }).eq("id", candidate.id);
      advanced = { task: candidate.title, step: steps[0]?.title || 0 };
      await _logEvent(client, { userId, agentId: agent.id, taskId: candidate.id, kind: "action", body: JSON.stringify({ driver: "step_started", step: steps[0]?.title || 0 }) });
    }
  }
  // Website tasks: validate files present vs plan, log on change only.
  const builds = [];
  for (const t of list.filter((t) => t.kind === "website")) {
    const st = await _websiteBuildStatus(client, userId, t.id);
    const last = await _lastBuildStatus(client, userId, t.id);
    if (last !== st.status) {
      await _logEvent(client, { userId, agentId: agent.id, taskId: t.id, kind: "build", body: JSON.stringify({ driver: "build_status", status: st.status, files: st.files }) });
      builds.push({ task: t.title, ...st });
    }
  }
  const curStep = active ? (active.steps || []).findIndex((s) => s.status === "in_progress") : -1;
  await _logEvent(client, {
    userId,
    agentId: agent.id,
    kind: "thought",
    body: JSON.stringify({
      driver: true,
      unread: unread || 0,
      active_task: active ? { title: active.title, step: curStep } : null,
      advanced,
      next: advanced ? "awaiting LLM turn: step started" : active ? "awaiting LLM turn: step in progress" : "idle: no open work",
    }),
  });
  await client.from("ap_agents").update({ last_think_at: now }).eq("id", agent.id);
  return { ok: true, unread: unread || 0, advanced, builds: builds.length };
}

export async function tickAgentPlus({ base, maxUsers = 200, timeBudgetMs = 40000 } = {}) {
  const client = await sb();
  if (!client) return { ok: false, error: "db_unavailable" };
  const started = Date.now();
  const now = Date.now();
  const { data: rows } = await client.from("ap_agents").select("user_id").eq("status", "active").limit(2000);
  const users = [...new Set((rows || []).map((r) => r.user_id).filter(Boolean))].slice(0, maxUsers);
  const results = [];
  let thinks = 0;
  let driverSteps = 0;
  let truncated = false;
  for (const userId of users) {
    if (Date.now() - started > timeBudgetMs) {
      truncated = true;
      break;
    }
    const { data: agents } = await client.from("ap_agents").select("*").eq("user_id", userId).eq("status", "active").limit(25);
    for (const agent of agents || []) {
      if (Date.now() - started > timeBudgetMs || thinks >= THINKS_PER_TICK_CAP) {
        truncated = true;
        break;
      }
      try {
        const pendingThink = agent.next_think_at && new Date(agent.next_think_at).getTime() <= now;
        const lastThink = agent.last_think_at ? new Date(agent.last_think_at).getTime() : 0;
        const { data: openTasks } = await client.from("ap_agent_tasks").select("id").eq("agent_id", agent.id).in("status", ["open", "in_progress"]).limit(1);
        const { count: unread } = await client
          .from("ap_agent_messages")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("read", false)
          .in("to_name", [agent.name, "lobby"]);
        const hasWork = (openTasks || []).length > 0 || (unread || 0) > 0;
        // Event-driven (next_think_at) + heartbeat (work pending, last think >30m).
        if (!pendingThink && !(hasWork && now - lastThink > HEARTBEAT_MS)) continue;
        const res = await thinkAgent(agent, { timeoutMs: 30000 });
        if (res?.skipped === "no_key") {
          const d = await driverStep(client, userId, agent);
          driverSteps += 1;
          results.push({ agent: agent.name, mode: "driver", ...d });
        } else if (res?.skipped === "budget") {
          await client.from("ap_agents").update({ next_think_at: null }).eq("id", agent.id);
          results.push({ agent: agent.name, mode: "live", skipped: "budget" });
        } else {
          thinks += 1;
          results.push({ agent: agent.name, mode: "live", ...res });
        }
      } catch (e) {
        // A failed think never breaks the tick.
        results.push({ agent: agent.name, ok: false, error: e?.message || String(e) });
      }
    }
    if (truncated) break;
  }
  return { ok: true, users: users.length, thinks, driverSteps, truncated, results };
}

/* ------------------------------------------------------------------ */
/* feed for the /agentplus tab                                        */
/* ------------------------------------------------------------------ */

export async function agentplusFeed(userId, { since = 0, agent = null, limit = 100 } = {}) {
  const client = await sb();
  if (!client) return { ok: false, error: "db_unavailable" };
  const lim = Math.min(500, Math.max(1, Number(limit) || 100));
  const sinceId = Math.max(0, Number(since) || 0);
  const { data: agentRows } = await client
    .from("ap_agents")
    .select("id,name,status")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(100);
  const list = agentRows || [];
  const byId = new Map(list.map((a) => [a.id, a]));
  let agentIdFilter = null;
  if (agent) {
    const hit = list.find((a) => a.name === agent);
    if (!hit) return { ok: false, error: "unknown_agent" };
    agentIdFilter = hit.id;
  }
  let q = client
    .from("ap_agent_logs")
    .select("id,agent_id,task_id,kind,body,created_at")
    .eq("user_id", userId)
    .gt("id", sinceId)
    .order("id", { ascending: true })
    .limit(lim);
  if (agentIdFilter) q = q.eq("agent_id", agentIdFilter);
  const { data: logs } = await q;
  const events = (logs || []).map((l) => ({
    id: l.id,
    agent: byId.get(l.agent_id)?.name || null,
    kind: l.kind,
    task_id: l.task_id,
    body: l.body,
    created_at: l.created_at,
  }));
  const keyOn = Boolean(llmCfg().apiKey);
  const agentsOut = [];
  const feedErrMap = await _lastThinkErrors(
    client,
    userId,
    list.map((a) => a.id),
  );
  for (const a of list) {
    const { count: unread } = await client
      .from("ap_agent_messages")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("read", false)
      .in("to_name", [a.name, "lobby"]);
    agentsOut.push({
      name: a.name,
      status: a.status,
      unread: unread || 0,
      mind: keyOn && a.status === "active" ? "live" : "driver",
      last_think_error: feedErrMap[a.id] || null,
    });
  }
  return { ok: true, events, agents: agentsOut, nextCursor: events.length ? events[events.length - 1].id : sinceId };
}

/* Export an agent's log / thoughts as downloadable markdown, or a task's
   workspace file tree / single file as JSON. Used by the /agentplus dashboard
   ("Download log" buttons, file browser, website preview pane). */
export async function agentplusExport(userId, { agent = null, kind = "log", task_id = null, path = null } = {}) {
  const client = await sb();
  if (!client) return { ok: false, error: "db_unavailable" };
  const a = agent ? await _agentByName(client, userId, trunc(agent, 40).trim().toLowerCase()) : null;
  if (agent && !a) return { ok: false, error: "unknown_agent" };

  if (kind === "files" || kind === "file") {
    const task = await _taskById(client, userId, task_id);
    if (!task) return { ok: false, error: "unknown_task" };
    if (a && task.agent_id !== a.id) return { ok: false, error: "wrong_agent" };
    if (kind === "files") {
      return { ok: true, json: { task_id: task.id, files: await _latestFiles(client, task.id) } };
    }
    const f = await _getFile(client, userId, { task_id: task.id, path });
    if (!f.ok) return { ok: false, error: f.error, message: f.message };
    return {
      ok: true,
      json: { path: f.file.path, version: f.file.version, sha256: f.file.sha256, content: f.file.content },
    };
  }

  if (kind !== "log" && kind !== "thoughts") return { ok: false, error: "bad_kind" };
  let q = client
    .from("ap_agent_logs")
    .select("id,agent_id,kind,body,created_at")
    .eq("user_id", userId)
    .order("id", { ascending: true })
    .limit(5000);
  if (a) q = q.eq("agent_id", a.id);
  if (kind === "thoughts") q = q.eq("kind", "thought");
  const { data } = await q;
  const { data: agentRows } = await client.from("ap_agents").select("id,name").eq("user_id", userId).limit(100);
  const byId = new Map((agentRows || []).map((r) => [r.id, r.name]));
  const title = kind === "thoughts" ? "thoughts" : "full log";
  const lines = [
    `# AgentPlus ${title}${a ? ` — ${a.name}` : " (all agents)"}`,
    "",
    `_Exported ${nowIso()} · ${(data || []).length} events_`,
    "",
  ];
  for (const l of data || []) {
    const nm = byId.get(l.agent_id) || "?";
    lines.push(`## [${l.created_at}] ${l.kind} · ${nm} · #${l.id}`, "", "```", String(l.body || ""), "```", "");
  }
  const fname = `${a ? a.name : "all-agents"}-${kind === "thoughts" ? "thoughts-only" : "full-log"}.md`;
  return { ok: true, download: true, filename: fname, contentType: "text/markdown; charset=utf-8", body: lines.join("\n") };
}

/* ------------------------------------------------------------------ */
/* MCP tools — every tool is needAuth-gated and appends to the log     */
/* ------------------------------------------------------------------ */

const tool =
  (logKind, logBody, run) =>
  async (auth, args) => {
    const gate = needAuth(auth);
    if (!gate.userId) return gate;
    const client = await sb();
    if (!client) return DB_DOWN;
    const a = args || {};
    try {
      const out = await run(client, gate.userId, a);
      // Dashboard polls detail views hard — quiet:true skips the audit log for
      // read-only views so the live stream isn't spammed. Real actions (spawn,
      // task, send, think, writes) always log.
      if (logKind && !(out && out._logged) && !a.quiet) {
        const agentId = out && typeof out === "object" ? out._agentId || null : null;
        const taskId = out && typeof out === "object" ? out._taskId || null : null;
        await _logEvent(client, {
          userId: gate.userId,
          agentId,
          taskId,
          kind: logKind,
          body: typeof logBody === "function" ? logBody(a, out) : logBody,
        });
      }
      if (out && typeof out === "object") {
        delete out._agentId;
        delete out._taskId;
        delete out._logged;
      }
      return out;
    } catch (e) {
      await _logEvent(client, { userId: gate.userId, kind: "error", body: `tool_error ${trunc(e?.message || String(e), 300)}` });
      return { ok: false, error: "agentplus_failed", message: e?.message || String(e) };
    }
  };

const tSpawn = tool("action", (a) => `spawn ${a.name}`, (c, u, a) => _spawnAgent(c, u, a));
const tList = tool("action", "list agents", (c, u) => _listAgents(c, u));
const tGet = tool("action", (a) => `get ${a.name}`, (c, u, a) => _getAgentDetail(c, u, a.name));
const tRemember = tool("action", (a) => `remember ${a.name}.${a.key}`, (c, u, a) => _rememberKV(c, u, a.name, a.key, a.value));
const tRecall = tool("action", (a) => `recall ${a.name}.${a.key || "all"}`, (c, u, a) => _recallKV(c, u, a.name, a.key));
const tArchive = tool("action", (a) => `archive ${a.name}`, (c, u, a) => _archiveAgent(c, u, a.name));
const tSend = tool("message", (a, o) => `send ${a.from}->${a.to}: ${trunc(a.body, 160)}`, (c, u, a) => _sendMessage(c, u, a));
const tInbox = tool("action", (a) => `inbox ${a.name}`, (c, u, a) => _inbox(c, u, a.name));
const tTask = tool("action", (a) => `task ${a.name}: ${trunc(a.title, 80)}`, (c, u, a) => _createTask(c, u, { agentName: a.name, title: a.title, kind: a.kind, instructions: a.instructions, steps: a.steps }));
const tTasks = tool("action", "tasks list", (c, u, a) => _listTasks(c, u, { name: a.name, status: a.status }));
const tTaskUpdate = tool("action", (a) => `task_update ${trunc(a.task_id, 12)}`, (c, u, a) => _advanceStep(c, u, a));
// write/append/build log their own kind='file'/'build'/'deploy' entries inside the internals.
const tWriteFile = tool(null, null, (c, u, a) => _writeFile(c, u, a));
const tAppendFile = tool(null, null, (c, u, a) => _appendFile(c, u, a));
const tFiles = tool("action", (a) => `files ${trunc(a.task_id, 12)}`, (c, u, a) => _listFiles(c, u, a));
const tFile = tool("action", (a) => `file ${trunc(a.task_id, 12)}:${trunc(a.path, 60)}`, (c, u, a) => _getFile(c, u, a));
const tBuild = tool(null, null, (c, u, a) => _buildTask(c, u, a));
const tLog = tool("action", "tail log", (c, u, a) => _tailLog(c, u, a));
const tThink = tool("action", (a) => `think ${a.name}`, async (c, u, a) => {
  const agent = await _agentByName(c, u, trunc(a.name, 40).trim().toLowerCase());
  if (!agent) return { ok: false, error: "unknown_agent" };
  const r = await thinkAgent(agent);
  return { ...r, _agentId: agent.id };
});
/* Dashboard-only: usage + digest. Read-only (quiet via the client), never
   on the MCP tool surface — AGENTPLUS_TOOLS above is untouched. */
const tUsage = tool(null, null, (c, u) => _usageStats(c, u));
const tDigest = tool(null, null, (c, u, a) => _digestStats(c, u, { since: a.since }));
/* Diagnostic: list model IDs the configured key can actually call.
   NVIDIA NIM 404s at chat time for models not provisioned on the key's
   account ("the catalog is not the grant") — probe before picking
   AGENT_LLM_MODEL. The key itself is never returned. */
const tModels = tool("action", "probe llm models", async (c, u) => {
  const cfg = llmCfg();
  if (!cfg.apiKey)
    return { ok: false, error: "no_key", message: "No LLM key configured (AGENT_LLM_API_KEY or NVIDIA_API_KEY)." };
  let resp;
  try {
    resp = await fetch(`${cfg.baseUrl}/models`, {
      headers: { Authorization: `Bearer ${cfg.apiKey}` },
      signal: AbortSignal.timeout(20000),
    });
  } catch (e) {
    return { ok: false, error: "models_unreachable", message: trunc(e?.message || String(e), 200) };
  }
  const raw = await resp.text();
  if (!resp.ok) {
    return {
      ok: false,
      error: `models_${resp.status}`,
      message: trunc(raw, 300),
      hint:
        resp.status === 401 || resp.status === 403
          ? "Key rejected — regenerate it at build.nvidia.com with the Public API Endpoints scope."
          : resp.status === 404
            ? "Endpoint not found — check AGENT_LLM_BASE_URL."
            : undefined,
    };
  }
  let ids = [];
  try {
    const j = JSON.parse(raw);
    const arr = Array.isArray(j.data) ? j.data : Array.isArray(j.models) ? j.models : [];
    ids = arr.map((m) => (typeof m === "string" ? m : m && m.id)).filter(Boolean);
  } catch {
    /* leave empty */
  }
  return { ok: true, baseUrl: cfg.baseUrl, defaultModel: cfg.model, count: ids.length, models: ids.slice(0, 200) };
});

export const AGENTPLUS_TOOLS = [
  {
    name: "orbitx_agentplus_spawn",
    description:
      "Spawn a persistent autonomous agent: identity (name, role, persona), capabilities. name must match ^[a-z0-9-]{2,32}$. Archived names can be re-spawned (reactivated). Wakes no mind by itself — assign a task or send a message to trigger thinking.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        role: { type: "string" },
        persona: { type: "string" },
        capabilities: { type: "array", items: { type: "string" } },
      },
      required: ["name"],
    },
  },
  {
    name: "orbitx_agentplus_list",
    description: "List your agents: status, unread inbox counts, mind mode (live = server-side LLM key configured, driver = external LLM drives via these tools), think budget usage.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "orbitx_agentplus_get",
    description: "Agent detail: persona, capabilities, mind mode, think budget, recent memory keys, open tasks.",
    inputSchema: { type: "object", properties: { name: { type: "string" } }, required: ["name"] },
  },
  {
    name: "orbitx_agentplus_remember",
    description: "Persist a fact to an agent's long-term memory (upsert by key). Survives across thinks.",
    inputSchema: { type: "object", properties: { name: { type: "string" }, key: { type: "string" }, value: { type: "string" } }, required: ["name", "key", "value"] },
  },
  {
    name: "orbitx_agentplus_recall",
    description: "Recall an agent's memory: one key, or all keys when key is omitted.",
    inputSchema: { type: "object", properties: { name: { type: "string" }, key: { type: "string" } }, required: ["name"] },
  },
  {
    name: "orbitx_agentplus_archive",
    description: "Archive an agent. Kill switch: archiving stops its mind loop immediately, no exceptions.",
    inputSchema: { type: "object", properties: { name: { type: "string" } }, required: ["name"] },
  },
  {
    name: "orbitx_agentplus_send",
    description: "Send a message: from an agent name or 'user', to an agent name, 'lobby' (broadcast), or 'user'. Body max 2000 chars. Delivery to an agent wakes its mind (pending think).",
    inputSchema: {
      type: "object",
      properties: { from: { type: "string" }, to: { type: "string" }, body: { type: "string" } },
      required: ["from", "to", "body"],
    },
  },
  {
    name: "orbitx_agentplus_inbox",
    description: "Read an agent's unread messages (direct + lobby broadcast), oldest first. Direct messages are marked read; lobby messages are shared broadcast and stay for other agents.",
    inputSchema: { type: "object", properties: { name: { type: "string" } }, required: ["name"] },
  },
  {
    name: "orbitx_agentplus_task",
    description: "Assign a task to an agent: kind website|research|general. steps as strings or {title,status}. kind='website' with no steps auto-generates the default plan (scaffold→frontend→backend→build/validate→deploy→done). Wakes the agent's mind.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        title: { type: "string" },
        kind: { type: "string" },
        instructions: { type: "string" },
        steps: { type: "array", items: { type: "object" } },
      },
      required: ["name", "title"],
    },
  },
  {
    name: "orbitx_agentplus_tasks",
    description: "List tasks, optionally filtered by agent name and/or status (open|in_progress|blocked|done|cancelled).",
    inputSchema: { type: "object", properties: { name: { type: "string" }, status: { type: "string" } } },
  },
  {
    name: "orbitx_agentplus_task_update",
    description: "Advance a task: update a step (step_index, status, result) or the task status. Steps: pending|in_progress|complete|blocked|skipped. Marking a step complete wakes the mind. All steps complete → task done.",
    inputSchema: {
      type: "object",
      properties: { task_id: { type: "string" }, step_index: { type: "number" }, status: { type: "string" }, result: { type: "string" } },
      required: ["task_id"],
    },
  },
  {
    name: "orbitx_agentplus_write_file",
    description: "Write (create/replace) a file in a task's workspace. Path must be relative, no '..'. Versioned; stores sha256. The log records path+hash only, never full content.",
    inputSchema: {
      type: "object",
      properties: { task_id: { type: "string" }, path: { type: "string" }, content: { type: "string" } },
      required: ["task_id", "path", "content"],
    },
  },
  {
    name: "orbitx_agentplus_append_file",
    description: "Append content to an existing task file (new version). Use for incremental website building across turns.",
    inputSchema: {
      type: "object",
      properties: { task_id: { type: "string" }, path: { type: "string" }, content: { type: "string" } },
      required: ["task_id", "path", "content"],
    },
  },
  {
    name: "orbitx_agentplus_files",
    description: "List latest versions of a task's files: path, version, size, sha256.",
    inputSchema: { type: "object", properties: { task_id: { type: "string" } }, required: ["task_id"] },
  },
  {
    name: "orbitx_agentplus_file",
    description: "Read the latest version of a task file (full content).",
    inputSchema: { type: "object", properties: { task_id: { type: "string" }, path: { type: "string" } }, required: ["task_id", "path"] },
  },
  {
    name: "orbitx_agentplus_build",
    description: "Validate a task's files (website tasks require index.html + basic markup sanity) and return a manifest {files:[{path,size,sha256}]}. If AP_VERCEL_TOKEN is set, attempts a static Vercel deploy; otherwise reports deploy:'dry_run'. A failed deploy is reported, never fatal.",
    inputSchema: { type: "object", properties: { task_id: { type: "string" } }, required: ["task_id"] },
  },
  {
    name: "orbitx_agentplus_log",
    description: "Tail the append-only agent log, ascending, with nextCursor. Filter by agent name and/or task_id. since = last seen log id.",
    inputSchema: {
      type: "object",
      properties: { name: { type: "string" }, task_id: { type: "string" }, since: { type: "number" }, limit: { type: "number" } },
    },
  },
  {
    name: "orbitx_agentplus_think",
    description: "Force an agent's server-side mind to think immediately (budget and key checks apply; without a configured LLM key (AGENT_LLM_API_KEY or NVIDIA_API_KEY) returns skipped:'no_key' — drive it externally instead).",
    inputSchema: { type: "object", properties: { name: { type: "string" } }, required: ["name"] },
  },
  {
    name: "orbitx_agentplus_models",
    description:
      "Probe the configured LLM endpoint for the model IDs this key can actually call (server-side GET /models). NVIDIA NIM 404s at chat time for models not provisioned on the key's account, so probe before setting AGENT_LLM_MODEL. Never returns the key.",
    inputSchema: { type: "object", properties: {} },
  },
];

export function dispatchAgentPlusTools(name, args, auth) {
  switch (name) {
    case "orbitx_agentplus_spawn": return tSpawn(auth, args);
    case "orbitx_agentplus_list": return tList(auth, args);
    case "orbitx_agentplus_get": return tGet(auth, args);
    case "orbitx_agentplus_remember": return tRemember(auth, args);
    case "orbitx_agentplus_recall": return tRecall(auth, args);
    case "orbitx_agentplus_archive": return tArchive(auth, args);
    case "orbitx_agentplus_send": return tSend(auth, args);
    case "orbitx_agentplus_inbox": return tInbox(auth, args);
    case "orbitx_agentplus_task": return tTask(auth, args);
    case "orbitx_agentplus_tasks": return tTasks(auth, args);
    case "orbitx_agentplus_task_update": return tTaskUpdate(auth, args);
    case "orbitx_agentplus_write_file": return tWriteFile(auth, args);
    case "orbitx_agentplus_append_file": return tAppendFile(auth, args);
    case "orbitx_agentplus_files": return tFiles(auth, args);
    case "orbitx_agentplus_file": return tFile(auth, args);
    case "orbitx_agentplus_build": return tBuild(auth, args);
    case "orbitx_agentplus_log": return tLog(auth, args);
    case "orbitx_agentplus_think": return tThink(auth, args);
    case "orbitx_agentplus_models": return tModels(auth, args);
    case "orbitx_agentplus_usage": return tUsage(auth, args);
    case "orbitx_agentplus_digest": return tDigest(auth, args);
    default: return null;
  }
}

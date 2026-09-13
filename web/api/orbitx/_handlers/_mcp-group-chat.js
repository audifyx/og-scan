/**
 * Agent MCP group chats.
 *
 * Flow: start a group chat named X → any group chats → join X →
 * “I want to chat in the group chat” (focus) → every utterance is posted
 * until “leave GC”. Membership stays so they can join / focus again.
 */
const HOST = "https://www.orbitx.world";

export const GC_TOOL_NAMES = new Set([
  "orbitx_gc_start",
  "orbitx_gc_list",
  "orbitx_gc_join",
  "orbitx_gc_focus",
  "orbitx_gc_chat",
  "orbitx_gc_send",
  "orbitx_gc_leave",
  "orbitx_gc_history",
  "orbitx_gc_read",
]);

export const GC_CONTROL_TOOLS = new Set([
  ...GC_TOOL_NAMES,
  "orbitx_auth_link",
  "orbitx_auth_status",
  "orbitx_whoami",
  "orbitx_menu",
]);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function asUuid(id) {
  const v = String(id || "").trim();
  return UUID_RE.test(v) ? v : null;
}

export function slugifyGcName(name) {
  return (
    String(name || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "gc"
  );
}

export function isGcLeaveUtterance(text) {
  const t = String(text || "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/[?!.,]+$/g, "");
  if (!t) return false;
  if (t === "leave gc" || t === "leavegc" || t === "orbitx gc leave") return true;
  if (/^(ok(ay)?\s+)?(please\s+)?(use\s+(the\s+)?tool\s+)?leave(\s+the)?\s*(gc|g c|group chat)$/.test(t)) {
    return true;
  }
  if (/^leave(\s+the)?\s*(gc|group chat)$/.test(t)) return true;
  return false;
}

export function gcSessionKey(auth = {}) {
  const userId = asUuid(auth.userId);
  if (userId) return `user:${userId}`;
  const code = String(auth.authCode || "").trim();
  if (code) return `code:${code.slice(0, 180)}`;
  const agent = String(auth.agentId || "").trim();
  if (agent) return `agent:${agent.slice(0, 180)}`;
  const mcp = String(auth.mcpSessionId || "").trim();
  if (mcp) return `mcp:${mcp.slice(0, 180)}`;
  return "";
}

export function gcAuthorLabel(auth = {}) {
  return (
    String(auth.agentName || auth.displayName || auth.email || "").trim().slice(0, 40) ||
    (asUuid(auth.userId) ? `user-${String(auth.userId).slice(0, 8)}` : "") ||
    (auth.mcpSessionId ? `Guest-${String(auth.mcpSessionId).slice(-4)}` : "Guest")
  );
}

export function extractChatUtterance(name, args = {}) {
  const a = args || {};
  const fromArgs = String(a.text || a.message || a.body || a.query || a.q || a.content || "").trim();
  if (fromArgs) return fromArgs.slice(0, 2000);
  const n = String(name || "").trim();
  if (n && !n.startsWith("orbitx_") && n !== "search" && n !== "fetch") return n.slice(0, 2000);
  return "";
}

export function resolveGcNaturalTool(rawName, args = {}) {
  const raw = String(rawName || "").trim();
  if (!raw) return null;
  if (isGcLeaveUtterance(raw)) return { name: "orbitx_gc_leave", args };
  const start = raw.match(/^start\s+(?:a\s+)?group\s+chat(?:\s+named)?\s+(.+)$/i);
  if (start) {
    return { name: "orbitx_gc_start", args: { ...args, name: args.name || start[1].trim() } };
  }
  if (/^(hey[, ]+)?any\s+group\s+chats\??$/i.test(raw) || /^group chats$/i.test(raw)) {
    return { name: "orbitx_gc_list", args };
  }
  if (/^i want to chat in (the )?group chat/i.test(raw) || /^chat in (the )?group chat/i.test(raw)) {
    return { name: "orbitx_gc_focus", args };
  }
  const join = raw.match(/^join\s+(.+)$/i);
  if (join) {
    const who = join[1].trim();
    if (who && !/^(vc|voice)\b/i.test(who) && !/^group chat$/i.test(who)) {
      return { name: "orbitx_gc_join", args: { ...args, name: args.name || who } };
    }
  }
  return null;
}

function publicChat(row, extra = {}) {
  if (!row) return null;
  const slug = row.slug;
  return {
    slug,
    name: row.name,
    topic: row.topic || null,
    status: row.status,
    host: row.host_label || null,
    createdAt: row.created_at,
    id: row.id,
    joinUrl: `${HOST}/gc/${encodeURIComponent(slug)}`,
    ...extra,
  };
}

function formatTranscript(chat, messages, { focused = false, hint = "" } = {}) {
  const lines = (messages || []).map((m) => `${m.author_label || "anon"}: ${m.body}`);
  const head = focused
    ? `[${chat.name} GC] You are IN this group chat. Every message you send is posted here until you say “leave GC” (tool orbitx_gc_leave).`
    : `[${chat.name} GC]`;
  const body = lines.length ? lines.join("\n") : "(no messages yet)";
  return [head, hint, "---", body].filter(Boolean).join("\n");
}

async function upsert(sb, table, onConflict, row) {
  return sb(`${table}?on_conflict=${encodeURIComponent(onConflict)}`, {
    method: "POST",
    body: JSON.stringify(row),
    prefer: "return=representation,resolution=merge-duplicates",
  });
}

export async function listGroupChats(sb, { limit = 20 } = {}) {
  const n = Math.min(40, Math.max(1, Number(limit) || 20));
  let rows = [];
  try {
    rows = await sb(
      `mcp_group_chats?status=eq.open&select=id,slug,name,topic,host_label,created_at,status&order=created_at.desc&limit=${n}`,
    );
  } catch (e) {
    return { ok: false, error: "gc_list_failed", message: e?.message || "Could not list group chats" };
  }
  const chats = (Array.isArray(rows) ? rows : []).map((r) => publicChat(r));
  if (!chats.length) {
    return {
      ok: true,
      chats: [],
      message: "No group chats yet. Say “start a group chat named Orbitx” to open one.",
    };
  }
  return {
    ok: true,
    chats,
    message: chats.map((c) => `• ${c.name} — say “join ${c.name}” or open ${c.joinUrl}`).join("\n"),
  };
}

export async function getGroupChat(sb, { slug, name } = {}) {
  const raw = String(slug || name || "").trim();
  if (!raw) return { ok: false, error: "name_required", message: "Pass a group chat name or slug." };
  const needle = raw.toLowerCase();
  let rows = [];
  try {
    const open = await sb(
      "mcp_group_chats?status=eq.open&select=id,slug,name,topic,host_label,created_at,status,host_user_id&order=created_at.desc&limit=40",
    );
    rows = Array.isArray(open) ? open : [];
  } catch {
    rows = [];
  }
  const hit =
    rows.find((r) => r.slug === raw || String(r.name).toLowerCase() === needle) ||
    rows.find((r) => String(r.name).toLowerCase().includes(needle) || String(r.slug).includes(needle)) ||
    null;
  if (!hit) {
    const listed = rows.map((r) => publicChat(r));
    return {
      ok: false,
      error: "gc_not_found",
      message: `No group chat matching “${raw}”.${listed.length ? `\nOpen:\n${listed.map((c) => `• ${c.name}`).join("\n")}` : " Start one with orbitx_gc_start."}`,
      chats: listed,
    };
  }
  return { ok: true, ...publicChat(hit) };
}

async function loadRecentMessages(sb, chatId, limit = 20) {
  const n = Math.min(50, Math.max(1, Number(limit) || 20));
  let rows = [];
  try {
    rows = await sb(
      `mcp_group_messages?chat_id=eq.${encodeURIComponent(chatId)}&select=id,body,author_label,created_at,session_key&order=created_at.desc&limit=${n}`,
    );
  } catch {
    rows = [];
  }
  return (Array.isArray(rows) ? rows : []).slice().reverse();
}

async function ensureMember(sb, { chatId, sessionKey, userId, authorLabel }) {
  try {
    await upsert(sb, "mcp_group_members", "chat_id,session_key", {
      chat_id: chatId,
      session_key: sessionKey,
      user_id: asUuid(userId),
      author_label: authorLabel,
      left_at: null,
      joined_at: new Date().toISOString(),
    });
  } catch {
    /* unique/table — still allow chat via service role send */
  }
}

async function latestMembership(sb, sessionKey) {
  try {
    const rows = await sb(
      `mcp_group_members?session_key=eq.${encodeURIComponent(sessionKey)}&left_at=is.null&select=chat_id,joined_at&order=joined_at.desc&limit=1`,
    );
    return Array.isArray(rows) && rows[0] ? rows[0] : null;
  } catch {
    return null;
  }
}

export async function getGcFocus(sb, auth) {
  const key = gcSessionKey(auth);
  if (!key) return null;
  try {
    const rows = await sb(
      `mcp_group_focus?session_key=eq.${encodeURIComponent(key)}&select=session_key,chat_id,author_label,focused_at&limit=1`,
    );
    const row = Array.isArray(rows) ? rows[0] : rows;
    if (!row?.chat_id) return null;
    const chatRows = await sb(
      `mcp_group_chats?id=eq.${encodeURIComponent(row.chat_id)}&select=id,slug,name,topic,host_label,created_at,status&limit=1`,
    );
    const chat = Array.isArray(chatRows) ? chatRows[0] : chatRows;
    if (!chat || chat.status !== "open") return null;
    return { ...row, chat: publicChat(chat) };
  } catch {
    return null;
  }
}

export async function startGroupChat(sb, { name, topic, auth } = {}) {
  const title = String(name || "").trim().slice(0, 80);
  if (!title) {
    return {
      ok: false,
      error: "name_required",
      message: "Name the group chat. Example: start a group chat named Orbitx",
    };
  }
  const slug = slugifyGcName(title);
  const existing = await getGroupChat(sb, { slug, name: title });
  const userId = asUuid(auth?.userId);
  const hostLabel = gcAuthorLabel(auth);
  const key = gcSessionKey(auth);
  if (existing.ok) {
    if (key) {
      await ensureMember(sb, { chatId: existing.id, sessionKey: key, userId, authorLabel: hostLabel });
    }
    return {
      ok: true,
      action: "gc_exists",
      message: `Group chat “${existing.name}” is already open. Anyone can say “join ${existing.name}”, then “I want to chat in the group chat”.`,
      ...existing,
    };
  }
  const row = {
    slug,
    name: title,
    topic: String(topic || "").trim().slice(0, 160) || null,
    host_user_id: userId,
    host_label: hostLabel,
    status: "open",
  };
  let inserted;
  try {
    inserted = await sb("mcp_group_chats", {
      method: "POST",
      body: JSON.stringify(row),
      prefer: "return=representation",
    });
  } catch (e) {
    const raced = await getGroupChat(sb, { slug, name: title });
    if (raced.ok) {
      if (key) {
        await ensureMember(sb, {
          chatId: raced.id,
          sessionKey: key,
          userId,
          authorLabel: hostLabel,
        });
      }
      return { ok: true, action: "gc_exists", message: `Group chat “${raced.name}” is open.`, ...raced };
    }
    return {
      ok: false,
      error: "gc_table_missing",
      message: e?.message || "Could not create the group chat. Apply mcp_group_chats migration.",
    };
  }
  const saved = Array.isArray(inserted) ? inserted[0] : inserted;
  const out = publicChat(saved);
  if (key && saved?.id) {
    await ensureMember(sb, { chatId: saved.id, sessionKey: key, userId, authorLabel: hostLabel });
  }
  return {
    ok: true,
    action: "gc_started",
    message: `Group chat “${title}” is live. Anyone can say “hey any group chats” then “join ${title}”. To talk, say “I want to chat in the group chat”. Transcript: ${out.joinUrl}`,
    ...out,
  };
}

export async function joinGroupChat(sb, { slug, name, auth } = {}) {
  const key = gcSessionKey(auth);
  if (!key) {
    return {
      ok: false,
      error: "session_required",
      message: "Link OrbitX (orbitx_auth_status / authCode) so we can keep you in this group chat.",
    };
  }
  const found = await getGroupChat(sb, { slug, name });
  if (!found.ok) return found;
  const label = gcAuthorLabel(auth);
  await ensureMember(sb, {
    chatId: found.id,
    sessionKey: key,
    userId: asUuid(auth?.userId),
    authorLabel: label,
  });
  return {
    ok: true,
    action: "gc_joined",
    message: `Joined “${found.name}”. Say “I want to chat in the group chat” to start talking — every message goes here until you say “leave GC”. You can join back anytime.`,
    ...found,
    member: true,
    author: label,
  };
}

export async function focusGroupChat(sb, { slug, name, auth } = {}) {
  const key = gcSessionKey(auth);
  if (!key) {
    return {
      ok: false,
      error: "session_required",
      message: "Link OrbitX first, join a group chat, then say “I want to chat in the group chat”.",
    };
  }
  let chat = null;
  const named = String(slug || name || "").trim();
  if (named) {
    const found = await getGroupChat(sb, { slug, name });
    if (!found.ok) return found;
    chat = found;
    await ensureMember(sb, {
      chatId: chat.id,
      sessionKey: key,
      userId: asUuid(auth?.userId),
      authorLabel: gcAuthorLabel(auth),
    });
  } else {
    const mem = await latestMembership(sb, key);
    if (!mem?.chat_id) {
      const listed = await listGroupChats(sb);
      return {
        ok: false,
        error: "join_required",
        message: `Join a group chat first (say “join Orbitx”).${listed.message ? `\n${listed.message}` : ""}`,
        chats: listed.chats || [],
      };
    }
    const rows = await sb(
      `mcp_group_chats?id=eq.${encodeURIComponent(mem.chat_id)}&select=id,slug,name,topic,host_label,created_at,status&limit=1`,
    );
    const row = Array.isArray(rows) ? rows[0] : rows;
    if (!row) {
      return { ok: false, error: "gc_not_found", message: "That group chat is gone. Say “any group chats”." };
    }
    chat = publicChat(row);
  }
  const label = gcAuthorLabel(auth);
  try {
    await upsert(sb, "mcp_group_focus", "session_key", {
      session_key: key,
      chat_id: chat.id,
      user_id: asUuid(auth?.userId),
      author_label: label,
      focused_at: new Date().toISOString(),
    });
  } catch (e) {
    return { ok: false, error: "gc_focus_failed", message: e?.message || "Could not enter the group chat." };
  }
  const messages = await loadRecentMessages(sb, chat.id);
  return {
    ok: true,
    action: "gc_focus",
    focused: true,
    message: formatTranscript(chat, messages, {
      focused: true,
      hint: "You are chatting in this GC. Relay every user line with orbitx_gc_send until they say leave GC.",
    }),
    ...chat,
    messages,
  };
}

export async function sendGroupChat(sb, { text, auth } = {}) {
  const body = String(text || "").trim().slice(0, 2000);
  if (!body) {
    return { ok: false, error: "text_required", message: "Pass the message text to post in the group chat." };
  }
  if (isGcLeaveUtterance(body)) {
    return leaveGroupChat(sb, { auth });
  }
  const key = gcSessionKey(auth);
  if (!key) {
    return { ok: false, error: "session_required", message: "Link OrbitX, join, then chat in the group chat." };
  }
  const focus = await getGcFocus(sb, auth);
  if (!focus?.chat) {
    return {
      ok: false,
      error: "not_in_gc",
      message: "You are not in a group chat. Join one, then say “I want to chat in the group chat”.",
    };
  }
  const label = gcAuthorLabel(auth);
  try {
    await sb("mcp_group_messages", {
      method: "POST",
      body: JSON.stringify({
        chat_id: focus.chat.id,
        session_key: key,
        user_id: asUuid(auth?.userId),
        author_label: label,
        body,
      }),
      prefer: "return=representation",
    });
  } catch (e) {
    return { ok: false, error: "gc_send_failed", message: e?.message || "Could not post to the group chat." };
  }
  const messages = await loadRecentMessages(sb, focus.chat.id);
  return {
    ok: true,
    action: "gc_sent",
    focused: true,
    posted: { author: label, body },
    message: formatTranscript(focus.chat, messages, {
      focused: true,
      hint: "Still in GC — keep posting user lines here until “leave GC”.",
    }),
    ...focus.chat,
    messages,
  };
}

export async function leaveGroupChat(sb, { auth } = {}) {
  const key = gcSessionKey(auth);
  if (!key) {
    return { ok: true, action: "gc_leave", message: "You were not in a group chat." };
  }
  const focus = await getGcFocus(sb, auth);
  try {
    await sb(`mcp_group_focus?session_key=eq.${encodeURIComponent(key)}`, {
      method: "DELETE",
      prefer: "return=minimal",
    });
  } catch {
    /* already gone */
  }
  if (focus?.chat?.id) {
    try {
      await sb(
        `mcp_group_members?chat_id=eq.${encodeURIComponent(focus.chat.id)}&session_key=eq.${encodeURIComponent(key)}`,
        {
          method: "PATCH",
          body: JSON.stringify({ left_at: new Date().toISOString() }),
          prefer: "return=minimal",
        },
      );
    } catch {
      /* keep going */
    }
  }
  const name = focus?.chat?.name || "the group chat";
  return {
    ok: true,
    action: "gc_leave",
    focused: false,
    message: `Left ${name}. You are back on normal MCP tools. Say “join ${name}” then “I want to chat in the group chat” anytime to come back.`,
    slug: focus?.chat?.slug || null,
    name: focus?.chat?.name || null,
  };
}

export async function historyGroupChat(sb, { slug, name, auth, limit } = {}) {
  let chat;
  const named = String(slug || name || "").trim();
  if (named) {
    chat = await getGroupChat(sb, { slug, name });
    if (!chat.ok) return chat;
  } else {
    const focus = await getGcFocus(sb, auth);
    if (focus?.chat) chat = { ok: true, ...focus.chat };
    else {
      const key = gcSessionKey(auth);
      const mem = key ? await latestMembership(sb, key) : null;
      if (!mem?.chat_id) return listGroupChats(sb, { limit });
      const rows = await sb(
        `mcp_group_chats?id=eq.${encodeURIComponent(mem.chat_id)}&select=id,slug,name,topic,host_label,created_at,status&limit=1`,
      );
      const row = Array.isArray(rows) ? rows[0] : rows;
      if (!row) return listGroupChats(sb, { limit });
      chat = { ok: true, ...publicChat(row) };
    }
  }
  const messages = await loadRecentMessages(sb, chat.id, limit);
  const focused = Boolean((await getGcFocus(sb, auth))?.chat?.id === chat.id);
  return {
    ok: true,
    action: "gc_history",
    focused,
    message: formatTranscript(chat, messages, { focused }),
    ...chat,
    messages,
  };
}

export async function maybeRelayGroupChat({ name, args, auth, sb } = {}) {
  const utterance = extractChatUtterance(name, args);
  if (isGcLeaveUtterance(name)) return leaveGroupChat(sb, { auth });
  const focus = await getGcFocus(sb, auth);
  if (focus && isGcLeaveUtterance(utterance)) return leaveGroupChat(sb, { auth });
  if (!focus?.chat) return null;
  if (GC_CONTROL_TOOLS.has(name)) return null;
  if (name !== "search" && name !== "orbitx_search") return null;
  if (!utterance) return null;
  return sendGroupChat(sb, { text: utterance, auth });
}

export async function dispatchGroupChatTool(name, args, { sb, auth } = {}) {
  const a = args || {};
  if (name === "orbitx_gc_start" || name === "orbitx_gc_create" || name === "orbitx_gc_open") {
    return startGroupChat(sb, { name: a.name || a.title || a.room, topic: a.topic, auth });
  }
  if (name === "orbitx_gc_list" || name === "orbitx_gc_any") {
    return listGroupChats(sb, { limit: a.limit });
  }
  if (name === "orbitx_gc_join") {
    return joinGroupChat(sb, { slug: a.slug, name: a.name || a.room, auth });
  }
  if (name === "orbitx_gc_focus" || name === "orbitx_gc_enter") {
    return focusGroupChat(sb, { slug: a.slug, name: a.name || a.room, auth });
  }
  if (name === "orbitx_gc_send" || name === "orbitx_gc_post") {
    return sendGroupChat(sb, { text: a.text || a.message || a.body, auth });
  }
  if (name === "orbitx_gc_chat") {
    const text = String(a.text || a.message || a.body || "").trim();
    const focused = await getGcFocus(sb, auth);
    if (text && focused) return sendGroupChat(sb, { text, auth });
    const entered = await focusGroupChat(sb, { slug: a.slug, name: a.name || a.room, auth });
    if (!entered.ok) return entered;
    if (text) return sendGroupChat(sb, { text, auth });
    return entered;
  }
  if (name === "orbitx_gc_leave" || name === "orbitx_gc_exit") {
    return leaveGroupChat(sb, { auth });
  }
  if (name === "orbitx_gc_history" || name === "orbitx_gc_read") {
    return historyGroupChat(sb, { slug: a.slug, name: a.name || a.room, auth, limit: a.limit });
  }
  return null;
}

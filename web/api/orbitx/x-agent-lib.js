/**
 * X MCP Agent helpers — NVIDIA NIM, quote/DM, agent CRUD, queue, cron.
 * Used by web/api/x-mcp.js
 */

// Order matters for X OAuth — keep tweet.write early (same as the previously working set),
// then append DM scopes. Reconnect X after changing this string.
export const X_OAUTH_SCOPES =
  "tweet.write tweet.read users.read offline.access dm.read dm.write like.read";

export const NIM_MODELS = [
  { id: "meta/llama-3.3-70b-instruct", label: "Llama 3.3 70B" },
  { id: "meta/llama-3.1-8b-instruct", label: "Llama 3.1 8B" },
  { id: "meta/llama-4-maverick-17b-128e-instruct", label: "Llama 4 Maverick" },
  { id: "nvidia/llama-3.3-nemotron-super-49b-v1.5", label: "Nemotron Super 49B" },
  { id: "deepseek-ai/deepseek-v4-pro", label: "DeepSeek V4 Pro" },
  { id: "mistralai/mistral-nemotron", label: "Mistral Nemotron" },
  { id: "moonshotai/kimi-k2.6", label: "Kimi K2" },
  { id: "minimaxai/minimax-m3", label: "MiniMax M3" },
];

export const DEFAULT_NIM_MODEL =
  process.env.NVIDIA_MODEL || "meta/llama-3.3-70b-instruct";

const NVIDIA_BASE =
  process.env.NVIDIA_BASE_URL || "https://integrate.api.nvidia.com/v1";

export async function nvidiaChat({ system, user, model, maxTokens = 512, temperature = 0.7 }) {
  const key = process.env.NVIDIA_API_KEY;
  if (!key) {
    return {
      ok: false,
      error: "nvidia_missing",
      message: "NVIDIA_API_KEY not set on Vercel. Add it and redeploy.",
    };
  }
  const useModel =
    NIM_MODELS.some((m) => m.id === model) ? model : DEFAULT_NIM_MODEL;
  const res = await fetch(`${NVIDIA_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: useModel,
      messages: [
        ...(system ? [{ role: "system", content: system }] : []),
        { role: "user", content: user },
      ],
      temperature,
      top_p: 0.95,
      max_tokens: maxTokens,
      stream: false,
    }),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => "");
    return {
      ok: false,
      error: "nvidia_failed",
      message: `NVIDIA API ${res.status}: ${err.slice(0, 240)}`,
    };
  }
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content || "";
  return { ok: true, content, model: useModel, raw: data };
}

export function buildTweetText(rawText, linkUrl) {
  const text = String(rawText || "").trim();
  if (!text) throw new Error("text required");
  const links = [];
  if (linkUrl) links.push(String(linkUrl).trim());
  const reserved = links.length * 24 + (links.length ? links.length : 0);
  const maxBody = Math.max(50, 280 - reserved);
  let out = text.slice(0, maxBody);
  if (links.length) out = `${out}\n${links.join("\n")}`;
  return out;
}

export async function postTweetOAuth2(accessToken, opts) {
  const text = String(opts?.text || "").trim();
  if (!text) {
    return { ok: false, error: "text_required", message: "Tweet text is required" };
  }
  const mediaId = opts?.mediaId ? String(opts.mediaId) : "";
  const replyToTweetId = opts?.replyToTweetId ? String(opts.replyToTweetId).trim() : "";
  const quoteTweetId = opts?.quoteTweetId ? String(opts.quoteTweetId).trim() : "";

  const body = { text };
  if (mediaId) body.media = { media_ids: [mediaId] };
  if (replyToTweetId) body.reply = { in_reply_to_tweet_id: replyToTweetId };
  if (quoteTweetId) body.quote_tweet_id = quoteTweetId;

  const res = await fetch("https://api.twitter.com/2/tweets", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = err?.detail || err?.title || err?.errors?.[0]?.message || JSON.stringify(err);
    const status = res.status;
    const tip =
      status === 403
        ? "Reconnect X on /x (tweet.write must be granted). In X portal: App permissions = Read and write and Direct message."
        : status === 429
          ? "X rate limit / monthly post cap hit. Wait or upgrade X API tier."
          : null;
    return {
      ok: false,
      error: status === 403 ? "tweet_forbidden" : "tweet_failed",
      status,
      message: `Twitter API (${status}): ${msg}`,
      tip,
      details: err,
      fixUrl: "https://orbitx.world/x",
    };
  }
  const data = await res.json();
  const tweetId = data?.data?.id || null;
  return {
    ok: true,
    tweetId,
    tweetUrl: tweetId ? `https://x.com/i/web/status/${tweetId}` : null,
  };
}

export async function lookupXUser(accessToken, username) {
  const u = String(username || "").replace(/^@/, "").trim();
  if (!u) throw new Error("username required");
  const res = await fetch(
    `https://api.twitter.com/2/users/by/username/${encodeURIComponent(u)}?user.fields=name,username,profile_image_url`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.detail || err?.title || `User lookup failed (${res.status})`);
  }
  const data = await res.json();
  return data?.data || null;
}

export async function sendDmOAuth2(accessToken, { recipientId, text }) {
  const tid = String(recipientId || "").trim();
  const bodyText = String(text || "").trim();
  if (!tid) throw new Error("recipientId required");
  if (!bodyText) throw new Error("text required");

  const res = await fetch(
    `https://api.twitter.com/2/dm_conversations/with/${encodeURIComponent(tid)}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text: bodyText.slice(0, 10000) }),
    },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = err?.detail || err?.title || JSON.stringify(err);
    if (res.status === 403) {
      return {
        ok: false,
        status: 403,
        error: "dm_forbidden",
        message:
          "X rejected DM (403). Free apps often lack DM access — upgrade X API (Basic/Pro), enable dm.write, Reconnect X on /x.",
        details: err,
      };
    }
    return {
      ok: false,
      status: res.status,
      error: "dm_failed",
      message: `DM failed: ${msg}`,
      details: err,
    };
  }
  const data = await res.json();
  return {
    ok: true,
    dmEventId: data?.data?.dm_event_id || data?.data?.id || null,
    data,
  };
}

/** List recent DM events (requires dm.read). Graceful on free-tier 403. */
export async function listDmEventsOAuth2(accessToken, { maxResults = 20 } = {}) {
  const limit = Math.min(100, Math.max(1, Number(maxResults) || 20));
  const params = new URLSearchParams({
    max_results: String(limit),
    "dm_event.fields": "id,text,event_type,dm_conversation_id,created_at,sender_id,participant_ids",
    expansions: "sender_id",
    "user.fields": "id,name,username",
  });
  const res = await fetch(`https://api.twitter.com/2/dm_events?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = err?.detail || err?.title || JSON.stringify(err);
    if (res.status === 403) {
      return {
        ok: false,
        error: "dm_forbidden",
        message:
          "X rejected DM read (403). Free apps often lack DM access — upgrade X API (Basic/Pro), enable dm.read, Reconnect X on /x.",
        details: err,
      };
    }
    return { ok: false, error: "dm_list_failed", message: `DM inbox failed: ${msg}`, details: err };
  }
  const data = await res.json();
  const users = {};
  for (const u of data?.includes?.users || []) {
    if (u?.id) users[u.id] = u;
  }
  const events = (Array.isArray(data?.data) ? data.data : []).map((ev) => {
    const participantIds = ev.participant_ids || [];
    return {
      id: ev.id,
      text: ev.text || "",
      eventType: ev.event_type,
      conversationId: ev.dm_conversation_id,
      createdAt: ev.created_at,
      senderId: ev.sender_id,
      senderUsername: users[ev.sender_id]?.username || null,
      participantIds,
      isGroup: participantIds.length > 2,
    };
  });
  return { ok: true, events, meta: data?.meta || null };
}

/** Send a message into an existing DM / group conversation. */
export async function sendDmConversationOAuth2(accessToken, { conversationId, text }) {
  const cid = String(conversationId || "").trim();
  const bodyText = String(text || "").trim();
  if (!cid) throw new Error("conversationId required");
  if (!bodyText) throw new Error("text required");

  const res = await fetch(
    `https://api.twitter.com/2/dm_conversations/${encodeURIComponent(cid)}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text: bodyText.slice(0, 10000) }),
    },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = err?.detail || err?.title || JSON.stringify(err);
    if (res.status === 403) {
      return {
        ok: false,
        status: 403,
        error: "dm_forbidden",
        message:
          "X rejected group/DM send (403). Upgrade X API (Basic/Pro), enable dm.write, Reconnect X on /x.",
        details: err,
      };
    }
    return {
      ok: false,
      status: res.status,
      error: "dm_failed",
      message: `DM conversation failed: ${msg}`,
      details: err,
    };
  }
  const data = await res.json();
  return {
    ok: true,
    dmEventId: data?.data?.dm_event_id || data?.data?.id || null,
    conversationId: cid,
    data,
  };
}

/** Authenticated user id/username (users.read). */
export async function getXMe(accessToken) {
  const res = await fetch("https://api.twitter.com/2/users/me?user.fields=username,name", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    return {
      ok: false,
      error: "me_failed",
      message: err?.detail || err?.title || `users/me failed (${res.status})`,
    };
  }
  const data = await res.json();
  return { ok: true, user: data?.data || null };
}

/** Recent mentions of the authenticated user. */
export async function listMentionsOAuth2(accessToken, userId, { maxResults = 10, sinceId } = {}) {
  const uid = String(userId || "").trim();
  if (!uid) {
    return { ok: false, error: "user_id_required", message: "X user id required for mentions" };
  }
  const limit = Math.min(100, Math.max(5, Number(maxResults) || 10));
  const params = new URLSearchParams({
    max_results: String(limit),
    "tweet.fields": "created_at,author_id,conversation_id,in_reply_to_user_id,text",
    expansions: "author_id",
    "user.fields": "id,name,username",
  });
  if (sinceId) params.set("since_id", String(sinceId));

  const res = await fetch(
    `https://api.twitter.com/2/users/${encodeURIComponent(uid)}/mentions?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = err?.detail || err?.title || JSON.stringify(err);
    if (res.status === 403) {
      return {
        ok: false,
        error: "mentions_forbidden",
        message:
          "X rejected mentions read (403). Needs tweet.read + Basic/Pro access for /users/:id/mentions.",
        details: err,
      };
    }
    if (res.status === 429) {
      return {
        ok: false,
        error: "mentions_rate_limited",
        message: "X mentions rate limit — will retry on next cron tick.",
        details: err,
      };
    }
    return { ok: false, error: "mentions_failed", message: `Mentions failed: ${msg}`, details: err };
  }
  const data = await res.json();
  const users = {};
  for (const u of data?.includes?.users || []) {
    if (u?.id) users[u.id] = u;
  }
  const mentions = (Array.isArray(data?.data) ? data.data : []).map((t) => ({
    id: t.id,
    text: t.text || "",
    authorId: t.author_id,
    authorUsername: users[t.author_id]?.username || null,
    authorName: users[t.author_id]?.name || null,
    conversationId: t.conversation_id || null,
    createdAt: t.created_at || null,
  }));
  return { ok: true, mentions, meta: data?.meta || null };
}

/** Reserved knowledge title used when auto-reply columns are not migrated yet. */
export const AUTO_REPLY_SETTINGS_TITLE = "__orbitx_settings__";
const HANDLED_TITLE_PREFIX = "__orbitx_handled__:";

const AUTO_REPLY_COLUMNS = [
  "auto_reply_mentions",
  "auto_reply_dms",
  "auto_reply_group_dms",
  "max_replies_per_day",
  "last_mention_since_id",
  "last_dm_since_id",
  "last_reply_poll_at",
];

export function isMissingSchemaError(err) {
  const msg = String(err?.message || err || "");
  const code = String(err?.code || "");
  return (
    /Could not find the .+ column/i.test(msg) ||
    /column .+ does not exist/i.test(msg) ||
    /Could not find the table/i.test(msg) ||
    /relation .+ does not exist/i.test(msg) ||
    /schema cache/i.test(msg) ||
    code === "PGRST204" ||
    code === "42P01" ||
    code === "42703"
  );
}

function splitAutoReplyPatch(patch) {
  const core = { ...patch };
  const auto = {};
  for (const key of AUTO_REPLY_COLUMNS) {
    if (Object.prototype.hasOwnProperty.call(core, key)) {
      auto[key] = core[key];
      delete core[key];
    }
  }
  return { core, auto };
}

async function loadAutoReplyFallback(sb, agentId) {
  try {
    const rows = await sb(
      `x_agent_knowledge?agent_id=eq.${encodeURIComponent(agentId)}&title=eq.${encodeURIComponent(AUTO_REPLY_SETTINGS_TITLE)}&order=created_at.desc&limit=1&select=id,content`,
    );
    const row = Array.isArray(rows) ? rows[0] : null;
    if (!row?.content) return { id: null, settings: {} };
    try {
      const parsed = JSON.parse(row.content);
      return { id: row.id, settings: parsed && typeof parsed === "object" ? parsed : {} };
    } catch {
      return { id: row.id, settings: {} };
    }
  } catch {
    return { id: null, settings: {} };
  }
}

async function saveAutoReplyFallback(sb, agent, autoFields) {
  if (!agent?.id || !agent?.user_id) return;
  const { id, settings } = await loadAutoReplyFallback(sb, agent.id);
  const next = { ...settings, ...autoFields };
  const content = JSON.stringify(next);
  if (id) {
    await sb(`x_agent_knowledge?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({ content }),
      headers: { Prefer: "return=minimal" },
    });
    return;
  }
  await sb("x_agent_knowledge", {
    method: "POST",
    body: JSON.stringify({
      agent_id: agent.id,
      user_id: agent.user_id,
      title: AUTO_REPLY_SETTINGS_TITLE,
      content,
    }),
    headers: { Prefer: "return=minimal" },
  });
}

/** Apply agent patch; persist auto-reply fields via knowledge fallback if columns missing. */
export async function patchXAgent(sb, agent, patch) {
  const agentId = agent?.id || agent;
  const base = typeof agent === "object" && agent ? agent : { id: agentId };
  try {
    const updated = await sb(`x_agents?id=eq.${encodeURIComponent(agentId)}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
    return Array.isArray(updated) ? updated[0] : updated;
  } catch (e) {
    if (!isMissingSchemaError(e)) throw e;
    const { core, auto } = splitAutoReplyPatch(patch);
    if (Object.keys(auto).length) {
      await saveAutoReplyFallback(sb, base, auto);
    }
    if (Object.keys(core).length === 0) {
      return hydrateAutoReplyAgent(sb, base);
    }
    try {
      const updated = await sb(`x_agents?id=eq.${encodeURIComponent(agentId)}`, {
        method: "PATCH",
        body: JSON.stringify(core),
      });
      const row = Array.isArray(updated) ? updated[0] : updated;
      return hydrateAutoReplyAgent(sb, row || base);
    } catch (e2) {
      if (!isMissingSchemaError(e2)) throw e2;
      // Still failing (e.g. only auto fields) — return hydrated base.
      return hydrateAutoReplyAgent(sb, { ...base, ...core });
    }
  }
}

/** Merge auto-reply settings from columns or knowledge fallback. */
export async function hydrateAutoReplyAgent(sb, agent) {
  if (!agent) return agent;
  const hasCol =
    typeof agent.auto_reply_mentions === "boolean" ||
    typeof agent.auto_reply_dms === "boolean" ||
    typeof agent.auto_reply_group_dms === "boolean" ||
    agent.max_replies_per_day != null ||
    agent.last_reply_poll_at != null;
  if (hasCol) return agent;
  const { settings } = await loadAutoReplyFallback(sb, agent.id);
  if (!settings || !Object.keys(settings).length) return agent;
  return {
    ...agent,
    auto_reply_mentions: Boolean(settings.auto_reply_mentions),
    auto_reply_dms: Boolean(settings.auto_reply_dms),
    auto_reply_group_dms: Boolean(settings.auto_reply_group_dms),
    max_replies_per_day: settings.max_replies_per_day ?? agent.max_replies_per_day ?? 30,
    last_mention_since_id: settings.last_mention_since_id ?? agent.last_mention_since_id ?? null,
    last_dm_since_id: settings.last_dm_since_id ?? agent.last_dm_since_id ?? null,
    last_reply_poll_at: settings.last_reply_poll_at ?? agent.last_reply_poll_at ?? null,
  };
}

export function mapAgentRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    persona: row.persona || "",
    voiceNotes: row.voice_notes || "",
    model: row.model || DEFAULT_NIM_MODEL,
    mode: row.mode || "approve",
    enabled: Boolean(row.enabled),
    timezone: row.timezone || "UTC",
    postingWindows: row.posting_windows || [],
    topics: row.topics || [],
    maxPostsPerDay: row.max_posts_per_day ?? 5,
    autoReplyMentions: Boolean(row.auto_reply_mentions),
    autoReplyDms: Boolean(row.auto_reply_dms),
    autoReplyGroupDms: Boolean(row.auto_reply_group_dms),
    maxRepliesPerDay: row.max_replies_per_day ?? 30,
    lastMentionSinceId: row.last_mention_since_id || null,
    lastDmSinceId: row.last_dm_since_id || null,
    lastReplyPollAt: row.last_reply_poll_at || null,
    lastAutoRunAt: row.last_auto_run_at || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapQueueRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    agentId: row.agent_id,
    kind: row.kind,
    payload: row.payload || {},
    status: row.status,
    scheduledFor: row.scheduled_for,
    postedTweetId: row.posted_tweet_id,
    error: row.error,
    source: row.source,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function ensureXAgent(sb, userId) {
  const existing = await sb(
    `x_agents?user_id=eq.${encodeURIComponent(userId)}&order=created_at.asc&limit=1&select=*`,
  );
  if (Array.isArray(existing) && existing[0]) {
    return hydrateAutoReplyAgent(sb, existing[0]);
  }
  const created = await sb("x_agents", {
    method: "POST",
    body: JSON.stringify({
      user_id: userId,
      name: "X Agent",
      persona:
        "You are a sharp crypto/social media voice for OrbitX. Keep posts under 260 chars. No spam. Be specific and useful.",
      model: DEFAULT_NIM_MODEL,
      mode: "approve",
      enabled: false,
    }),
  });
  const row = Array.isArray(created) ? created[0] : created;
  return hydrateAutoReplyAgent(sb, row);
}

export async function listKnowledge(sb, agentId) {
  const rows = await sb(
    `x_agent_knowledge?agent_id=eq.${encodeURIComponent(agentId)}&order=created_at.desc&limit=40&select=*`,
  );
  return (Array.isArray(rows) ? rows : []).filter(
    (k) => !String(k.title || "").startsWith("__orbitx_"),
  );
}

export async function generateAgentPost(sb, agentRow, hint) {
  const knowledge = await listKnowledge(sb, agentRow.id);
  const knowledgeBlock = knowledge
    .slice(0, 12)
    .map((k) => `### ${k.title}\n${k.content}`)
    .join("\n\n")
    .slice(0, 6000);
  const topics = Array.isArray(agentRow.topics) ? agentRow.topics.join(", ") : "";
  const system = [
    "You write X (Twitter) posts for the user.",
    "Return ONLY valid JSON: {\"text\":\"...\",\"kind\":\"post\"}",
    "text max 260 characters. No hashtag spam. No markdown fences.",
    agentRow.persona ? `Persona:\n${agentRow.persona}` : "",
    agentRow.voice_notes ? `Voice notes:\n${agentRow.voice_notes}` : "",
    topics ? `Topics to prefer: ${topics}` : "",
    knowledgeBlock ? `Training knowledge:\n${knowledgeBlock}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const user = hint
    ? `Write one post about: ${hint}`
    : "Write one timely post that fits the persona and knowledge.";

  const ai = await nvidiaChat({
    system,
    user,
    model: agentRow.model,
    maxTokens: 400,
    temperature: 0.75,
  });
  if (!ai.ok) return ai;

  let parsed = null;
  const raw = String(ai.content || "").trim();
  try {
    const m = raw.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(m ? m[0] : raw);
  } catch {
    parsed = { text: raw.replace(/^```json\s*|```$/g, "").trim(), kind: "post" };
  }
  const text = String(parsed.text || "").trim().slice(0, 280);
  if (!text) {
    return { ok: false, error: "empty_generation", message: "Model returned empty text", raw: ai.content };
  }
  return {
    ok: true,
    text,
    kind: parsed.kind === "quote" || parsed.kind === "reply" ? parsed.kind : "post",
    quoteTweetId: parsed.quote_tweet_id || parsed.quoteTweetId || null,
    replyTo: parsed.reply_to || parsed.replyTo || null,
    model: ai.model,
  };
}

export function inPostingWindow(agentRow, now = new Date()) {
  const windows = Array.isArray(agentRow.posting_windows) ? agentRow.posting_windows : [];
  if (!windows.length) return true;
  // windows: [{ startHour: 9, endHour: 17 }] in agent timezone approximated as UTC for v1
  const hour = now.getUTCHours();
  return windows.some((w) => {
    const s = Number(w.startHour ?? w.start ?? 0);
    const e = Number(w.endHour ?? w.end ?? 24);
    if (s <= e) return hour >= s && hour < e;
    return hour >= s || hour < e;
  });
}

export async function countPostsToday(sb, userId) {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  const rows = await sb(
    `x_agent_queue?user_id=eq.${encodeURIComponent(userId)}&status=eq.posted&kind=eq.post&updated_at=gte.${encodeURIComponent(start.toISOString())}&select=id`,
  );
  return Array.isArray(rows) ? rows.length : 0;
}

export async function countRepliesToday(sb, userId) {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  const rows = await sb(
    `x_agent_queue?user_id=eq.${encodeURIComponent(userId)}&status=eq.posted&kind=in.(reply,dm)&updated_at=gte.${encodeURIComponent(start.toISOString())}&select=id`,
  );
  return Array.isArray(rows) ? rows.length : 0;
}

export async function generateAgentReply(sb, agentRow, ctx) {
  const knowledge = await listKnowledge(sb, agentRow.id);
  const knowledgeBlock = knowledge
    .slice(0, 10)
    .map((k) => `### ${k.title}\n${k.content}`)
    .join("\n\n")
    .slice(0, 5000);
  const kind = ctx?.kind === "dm" || ctx?.kind === "group_dm" ? ctx.kind : "mention";
  const from = ctx?.fromUsername ? `@${String(ctx.fromUsername).replace(/^@/, "")}` : "someone";
  const incoming = String(ctx?.text || "").trim().slice(0, 800);
  const system = [
    "You reply on X (Twitter) as the account owner / brand voice.",
    'Return ONLY valid JSON: {"text":"...","skip":false}',
    "text max 240 characters. No hashtag spam. No markdown. Be helpful and on-brand.",
    "Set skip:true if the message is spam, scam, abuse, or needs no reply.",
    kind === "group_dm"
      ? "This is a group DM — keep it brief and natural for a chat."
      : kind === "dm"
        ? "This is a 1:1 DM — be conversational."
        : "This is a public mention/reply — keep it public-safe.",
    agentRow.persona ? `Persona:\n${agentRow.persona}` : "",
    agentRow.voice_notes ? `Voice notes:\n${agentRow.voice_notes}` : "",
    knowledgeBlock ? `Training knowledge:\n${knowledgeBlock}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const user = `Incoming ${kind} from ${from}:\n"""${incoming}"""\nWrite the reply.`;

  const ai = await nvidiaChat({
    system,
    user,
    model: agentRow.model,
    maxTokens: 320,
    temperature: 0.7,
  });
  if (!ai.ok) return ai;

  let parsed = null;
  const raw = String(ai.content || "").trim();
  try {
    const m = raw.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(m ? m[0] : raw);
  } catch {
    parsed = { text: raw.replace(/^```json\s*|```$/g, "").trim(), skip: false };
  }
  if (parsed?.skip === true) {
    return { ok: true, skip: true, text: "", model: ai.model };
  }
  const text = String(parsed?.text || "").trim().slice(0, 280);
  if (!text) {
    return { ok: false, error: "empty_generation", message: "Model returned empty reply", raw: ai.content };
  }
  return { ok: true, skip: false, text, model: ai.model };
}

async function wasHandled(sb, userId, sourceKind, sourceId) {
  try {
    const rows = await sb(
      `x_agent_handled?user_id=eq.${encodeURIComponent(userId)}&source_kind=eq.${encodeURIComponent(sourceKind)}&source_id=eq.${encodeURIComponent(sourceId)}&limit=1&select=id`,
    );
    return Array.isArray(rows) && rows.length > 0;
  } catch (e) {
    if (!isMissingSchemaError(e)) throw e;
  }
  // Fallback when x_agent_handled migration is not applied yet.
  const title = `${HANDLED_TITLE_PREFIX}${sourceKind}:${sourceId}`;
  try {
    const rows = await sb(
      `x_agent_knowledge?user_id=eq.${encodeURIComponent(userId)}&title=eq.${encodeURIComponent(title)}&limit=1&select=id`,
    );
    if (Array.isArray(rows) && rows.length > 0) return true;
  } catch {
    /* ignore */
  }
  try {
    const key = sourceKind === "mention" ? "sourceMentionId" : "sourceDmEventId";
    const rows = await sb(
      `x_agent_queue?user_id=eq.${encodeURIComponent(userId)}&payload->>${key}=eq.${encodeURIComponent(sourceId)}&limit=1&select=id`,
    );
    return Array.isArray(rows) && rows.length > 0;
  } catch {
    return false;
  }
}

async function markHandled(sb, { userId, agentId, sourceKind, sourceId, queueId }) {
  try {
    await sb("x_agent_handled", {
      method: "POST",
      body: JSON.stringify({
        user_id: userId,
        agent_id: agentId,
        source_kind: sourceKind,
        source_id: sourceId,
        queue_id: queueId || null,
      }),
      headers: { Prefer: "return=minimal" },
    });
    return;
  } catch (e) {
    if (!isMissingSchemaError(e)) {
      /* unique race — ignore */
      return;
    }
  }
  try {
    await sb("x_agent_knowledge", {
      method: "POST",
      body: JSON.stringify({
        agent_id: agentId,
        user_id: userId,
        title: `${HANDLED_TITLE_PREFIX}${sourceKind}:${sourceId}`,
        content: JSON.stringify({ queueId: queueId || null, at: new Date().toISOString() }),
      }),
      headers: { Prefer: "return=minimal" },
    });
  } catch {
    /* ignore duplicates / races */
  }
}

async function enqueueOrSendReply(sb, agent, resolveToken, uploadImage, item) {
  const status = agent.mode === "auto" ? "approved" : "pending";
  const created = await sb("x_agent_queue", {
    method: "POST",
    body: JSON.stringify({
      agent_id: agent.id,
      user_id: agent.user_id,
      kind: item.kind,
      payload: item.payload,
      status,
      scheduled_for: status === "approved" ? new Date().toISOString() : null,
      source: "agent",
    }),
  });
  const row = Array.isArray(created) ? created[0] : created;
  if (!row) return { ok: false, error: "queue_create_failed" };
  if (status === "approved") {
    const exec = await executeQueueItem(sb, row, resolveToken, uploadImage);
    return { ok: exec.ok !== false, queued: false, item: row, exec };
  }
  return { ok: true, queued: true, item: row };
}

/**
 * Poll mentions + DMs / group DMs and draft or auto-send replies.
 * resolveToken(userId) => { ok, accessToken, profile }
 */
export async function processAutoReplies(sb, resolveToken, uploadImage, { forceUserId } = {}) {
  let agents;
  if (forceUserId) {
    const one = await ensureXAgent(sb, forceUserId);
    agents = one ? [one] : [];
  } else {
    try {
      const rows = await sb(
        `x_agents?enabled=eq.true&or=(auto_reply_mentions.eq.true,auto_reply_dms.eq.true,auto_reply_group_dms.eq.true)&select=*&limit=20`,
      );
      agents = Array.isArray(rows) ? rows : [];
    } catch (e) {
      if (!isMissingSchemaError(e)) throw e;
      const rows = await sb(`x_agents?enabled=eq.true&select=*&limit=40`);
      const list = Array.isArray(rows) ? rows : [];
      agents = [];
      for (const row of list) {
        agents.push(await hydrateAutoReplyAgent(sb, row));
      }
      agents = agents.filter(
        (a) => a.auto_reply_mentions || a.auto_reply_dms || a.auto_reply_group_dms,
      );
    }
  }

  const results = [];
  const nowIso = new Date().toISOString();

  for (let agent of agents) {
    try {
    agent = await hydrateAutoReplyAgent(sb, agent);
    if (!agent.auto_reply_mentions && !agent.auto_reply_dms && !agent.auto_reply_group_dms) {
      results.push({
        agentId: agent.id,
        ok: true,
        skipped: "auto_reply_off",
        message: "Enable autoReplyMentions / autoReplyDms / autoReplyGroupDms first.",
      });
      continue;
    }
    if (agent.last_reply_poll_at && !forceUserId) {
      const elapsed = Date.now() - new Date(agent.last_reply_poll_at).getTime();
      if (elapsed < 90 * 1000) continue; // avoid hammering X between cron minutes
    }

    const resolved = await resolveToken(agent.user_id);
    if (!resolved.ok) {
      results.push({ agentId: agent.id, ok: false, ...resolved });
      continue;
    }

    let twitterId = resolved.profile?.twitter_id || null;
    if (!twitterId) {
      const me = await getXMe(resolved.accessToken);
      twitterId = me?.user?.id || null;
    }
    if (!twitterId && agent.auto_reply_mentions) {
      results.push({
        agentId: agent.id,
        ok: false,
        error: "missing_twitter_id",
        message: "Connect X again so twitter_id is stored for mentions.",
      });
      continue;
    }

    const repliedToday = await countRepliesToday(sb, agent.user_id);
    const maxReplies = Math.max(0, Math.min(200, Number(agent.max_replies_per_day) || 30));
    let budget = Math.max(0, maxReplies - repliedToday);
    if (budget <= 0) {
      results.push({ agentId: agent.id, ok: true, skipped: "daily_reply_cap" });
      await patchXAgent(sb, agent, { last_reply_poll_at: nowIso, updated_at: nowIso });
      continue;
    }

    const agentResults = { agentId: agent.id, mentions: [], dms: [] };
    let newestMentionId = agent.last_mention_since_id || null;
    let newestDmId = agent.last_dm_since_id || null;

    if (agent.auto_reply_mentions && twitterId && budget > 0) {
      const ment = await listMentionsOAuth2(resolved.accessToken, twitterId, {
        maxResults: 10,
        sinceId: agent.last_mention_since_id || undefined,
      });
      if (!ment.ok) {
        agentResults.mentions.push(ment);
      } else {
        // API returns newest-first
        for (const m of ment.mentions.slice(0, 5)) {
          try {
            if (!newestMentionId || BigInt(m.id) > BigInt(newestMentionId)) newestMentionId = m.id;
          } catch {
            newestMentionId = m.id;
          }
          if (m.authorId && String(m.authorId) === String(twitterId)) continue;
          if (await wasHandled(sb, agent.user_id, "mention", m.id)) continue;
          if (budget <= 0) break;

          const draft = await generateAgentReply(sb, agent, {
            kind: "mention",
            fromUsername: m.authorUsername,
            text: m.text,
          });
          if (!draft.ok) {
            agentResults.mentions.push({ sourceId: m.id, ...draft });
            continue;
          }
          if (draft.skip) {
            await markHandled(sb, {
              userId: agent.user_id,
              agentId: agent.id,
              sourceKind: "mention",
              sourceId: m.id,
            });
            agentResults.mentions.push({ sourceId: m.id, skipped: true });
            continue;
          }

          const sent = await enqueueOrSendReply(sb, agent, resolveToken, uploadImage, {
            kind: "reply",
            payload: {
              text: draft.text,
              replyToTweetId: m.id,
              reply_to: m.id,
              mentionFrom: m.authorUsername,
              sourceMentionId: m.id,
            },
          });
          // Only mark handled on success — failed sends must be retryable.
          if (sent.ok) {
            await markHandled(sb, {
              userId: agent.user_id,
              agentId: agent.id,
              sourceKind: "mention",
              sourceId: m.id,
              queueId: sent.item?.id,
            });
            budget -= 1;
          }
          agentResults.mentions.push({ sourceId: m.id, ...sent, text: draft.text });
        }
      }
    }

    if ((agent.auto_reply_dms || agent.auto_reply_group_dms) && budget > 0) {
      const inbox = await listDmEventsOAuth2(resolved.accessToken, { maxResults: 20 });
      if (!inbox.ok) {
        agentResults.dms.push(inbox);
      } else {
        for (const ev of inbox.events.slice(0, 8)) {
          try {
            if (!newestDmId || (ev.id && BigInt(ev.id) > BigInt(newestDmId))) newestDmId = ev.id;
          } catch {
            newestDmId = ev.id;
          }
          if (!ev.text || !ev.conversationId) continue;
          if (ev.senderId && twitterId && String(ev.senderId) === String(twitterId)) continue;
          const isGroup = Boolean(ev.isGroup);
          const sourceKind = isGroup ? "group_dm" : "dm";
          if (isGroup && !agent.auto_reply_group_dms) continue;
          if (!isGroup && !agent.auto_reply_dms) continue;
          if (await wasHandled(sb, agent.user_id, sourceKind, ev.id)) continue;
          if (budget <= 0) break;

          const draft = await generateAgentReply(sb, agent, {
            kind: sourceKind,
            fromUsername: ev.senderUsername,
            text: ev.text,
          });
          if (!draft.ok) {
            agentResults.dms.push({ sourceId: ev.id, ...draft });
            continue;
          }
          if (draft.skip) {
            await markHandled(sb, {
              userId: agent.user_id,
              agentId: agent.id,
              sourceKind,
              sourceId: ev.id,
            });
            agentResults.dms.push({ sourceId: ev.id, skipped: true });
            continue;
          }

          const sent = await enqueueOrSendReply(sb, agent, resolveToken, uploadImage, {
            kind: "dm",
            payload: {
              text: draft.text,
              dmConversationId: ev.conversationId,
              conversationId: ev.conversationId,
              dmRecipientId: isGroup ? null : ev.senderId,
              isGroup,
              sourceDmEventId: ev.id,
              username: ev.senderUsername,
            },
          });
          if (sent.ok) {
            await markHandled(sb, {
              userId: agent.user_id,
              agentId: agent.id,
              sourceKind,
              sourceId: ev.id,
              queueId: sent.item?.id,
            });
            budget -= 1;
          }
          agentResults.dms.push({ sourceId: ev.id, sourceKind, ...sent, text: draft.text });
        }
      }
    }

    const patch = {
      last_reply_poll_at: nowIso,
      updated_at: nowIso,
    };
    if (newestMentionId) patch.last_mention_since_id = newestMentionId;
    if (newestDmId) patch.last_dm_since_id = newestDmId;
    await patchXAgent(sb, agent, patch);

    results.push({ ok: true, ...agentResults });
    } catch (e) {
      results.push({
        agentId: agent?.id,
        ok: false,
        error: "poll_agent_failed",
        message: e?.message || "poll failed",
      });
    }
  }

  return { ok: true, agents: results.length, results };
}

/**
 * Execute a queue payload against X (post/quote/reply/dm).
 * resolveToken(userId) => { ok, accessToken, profile }
 */
export async function executeQueueItem(sb, item, resolveToken, uploadImage) {
  let resolved = await resolveToken(item.user_id);
  if (!resolved.ok) {
    await sb(`x_agent_queue?id=eq.${encodeURIComponent(item.id)}`, {
      method: "PATCH",
      body: JSON.stringify({
        status: "failed",
        error: resolved.message || resolved.error,
        updated_at: new Date().toISOString(),
      }),
      headers: { Prefer: "return=minimal" },
    });
    return { ok: false, ...resolved };
  }

  const payload = item.payload || {};
  const kind = item.kind || "post";

  try {
    if (kind === "dm") {
      const conversationId = payload.dmConversationId || payload.conversationId || null;
      const sendDm = async (accessToken) => {
        if (conversationId) {
          return sendDmConversationOAuth2(accessToken, {
            conversationId,
            text: payload.text,
          });
        }
        let recipientId = payload.dmRecipientId || payload.recipientId;
        if (!recipientId && payload.username) {
          const u = await lookupXUser(accessToken, payload.username);
          if (!u?.id) throw new Error("Could not resolve username for DM");
          recipientId = u.id;
        }
        return sendDmOAuth2(accessToken, {
          recipientId,
          text: payload.text,
        });
      };
      let dm = await sendDm(resolved.accessToken);
      if (!dm.ok && dm.status === 401) {
        const retry = await resolveToken(item.user_id, { forceRefresh: true });
        if (retry.ok) {
          resolved = retry;
          dm = await sendDm(retry.accessToken);
        }
      }
      if (!dm.ok) {
        await sb(`x_agent_queue?id=eq.${encodeURIComponent(item.id)}`, {
          method: "PATCH",
          body: JSON.stringify({
            status: "failed",
            error: dm.message,
            updated_at: new Date().toISOString(),
          }),
          headers: { Prefer: "return=minimal" },
        });
        return dm;
      }
      await sb(`x_agent_queue?id=eq.${encodeURIComponent(item.id)}`, {
        method: "PATCH",
        body: JSON.stringify({
          status: "posted",
          posted_tweet_id: dm.dmEventId,
          error: null,
          updated_at: new Date().toISOString(),
        }),
        headers: { Prefer: "return=minimal" },
      });
      return { ok: true, kind: "dm", ...dm };
    }

    const text = buildTweetText(payload.text, payload.linkUrl);
    let mediaId = null;
    if (payload.imageUrl && uploadImage) {
      try {
        mediaId = await uploadImage(String(payload.imageUrl));
      } catch {
        /* continue without media */
      }
    }
    let posted = await postTweetOAuth2(resolved.accessToken, {
      text,
      mediaId,
      replyToTweetId: payload.replyToTweetId || payload.reply_to || undefined,
      quoteTweetId: payload.quoteTweetId || payload.quote_tweet_id || undefined,
    });
    if (!posted.ok && posted.status === 401) {
      const retry = await resolveToken(item.user_id, { forceRefresh: true });
      if (retry.ok) {
        posted = await postTweetOAuth2(retry.accessToken, {
          text,
          mediaId,
          replyToTweetId: payload.replyToTweetId || payload.reply_to || undefined,
          quoteTweetId: payload.quoteTweetId || payload.quote_tweet_id || undefined,
        });
      }
    }
    if (!posted.ok) {
      await sb(`x_agent_queue?id=eq.${encodeURIComponent(item.id)}`, {
        method: "PATCH",
        body: JSON.stringify({
          status: "failed",
          error: posted.message || posted.error,
          updated_at: new Date().toISOString(),
        }),
        headers: { Prefer: "return=minimal" },
      });
      return posted;
    }
    await sb(`x_agent_queue?id=eq.${encodeURIComponent(item.id)}`, {
      method: "PATCH",
      body: JSON.stringify({
        status: "posted",
        posted_tweet_id: posted.tweetId,
        error: null,
        updated_at: new Date().toISOString(),
      }),
      headers: { Prefer: "return=minimal" },
    });
    return { ok: true, kind, ...posted, text };
  } catch (e) {
    await sb(`x_agent_queue?id=eq.${encodeURIComponent(item.id)}`, {
      method: "PATCH",
      body: JSON.stringify({
        status: "failed",
        error: e?.message || String(e),
        updated_at: new Date().toISOString(),
      }),
      headers: { Prefer: "return=minimal" },
    });
    return { ok: false, error: "exec_failed", message: e?.message || String(e) };
  }
}

export async function runCronTick(sb, resolveToken, uploadImage) {
  const nowIso = new Date().toISOString();
  const due = await sb(
    `x_agent_queue?or=(and(status.eq.scheduled,scheduled_for.lte.${encodeURIComponent(nowIso)}),status.eq.approved)&order=scheduled_for.asc.nullsfirst&limit=20&select=*`,
  );
  const items = Array.isArray(due) ? due : [];
  const results = [];
  for (const item of items) {
    results.push(await executeQueueItem(sb, item, resolveToken, uploadImage));
  }

  // Auto agents: generate + enqueue/post if under daily cap and in window
  const agents = await sb(
    `x_agents?enabled=eq.true&mode=eq.auto&select=*&limit=15`,
  );
  const autoAgents = Array.isArray(agents) ? agents : [];
  for (const agent of autoAgents) {
    if (!inPostingWindow(agent)) continue;
    const postedToday = await countPostsToday(sb, agent.user_id);
    if (postedToday >= (agent.max_posts_per_day || 5)) continue;
    if (agent.last_auto_run_at) {
      const elapsed = Date.now() - new Date(agent.last_auto_run_at).getTime();
      if (elapsed < 30 * 60 * 1000) continue; // min 30m between auto gens
    }
    const pending = await sb(
      `x_agent_queue?user_id=eq.${encodeURIComponent(agent.user_id)}&status=in.(pending,scheduled,approved)&limit=1&select=id`,
    );
    if (Array.isArray(pending) && pending.length) continue;

    const gen = await generateAgentPost(sb, agent, null);
    await sb(`x_agents?id=eq.${encodeURIComponent(agent.id)}`, {
      method: "PATCH",
      body: JSON.stringify({ last_auto_run_at: nowIso, updated_at: nowIso }),
      headers: { Prefer: "return=minimal" },
    });
    if (!gen.ok) {
      results.push({ ok: false, agentId: agent.id, ...gen });
      continue;
    }
    const created = await sb("x_agent_queue", {
      method: "POST",
      body: JSON.stringify({
        agent_id: agent.id,
        user_id: agent.user_id,
        kind: "post",
        payload: { text: gen.text },
        status: "approved",
        scheduled_for: nowIso,
        source: "agent",
      }),
    });
    const row = Array.isArray(created) ? created[0] : created;
    if (row) {
      results.push(await executeQueueItem(sb, row, resolveToken, uploadImage));
    }
  }

  // Auto-reply: mentions + DMs / group DMs for agents with toggles on
  let autoReplies = { ok: true, agents: 0, results: [] };
  try {
    autoReplies = await processAutoReplies(sb, resolveToken, uploadImage);
  } catch (e) {
    autoReplies = { ok: false, error: e?.message || String(e), agents: 0, results: [] };
  }

  return {
    ok: true,
    processed: results.length,
    results,
    autoReplies,
  };
}

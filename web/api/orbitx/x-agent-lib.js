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
        error: "dm_forbidden",
        message:
          "X rejected DM (403). Free apps often lack DM access — upgrade X API (Basic/Pro), enable dm.write, Reconnect X on /x.",
        details: err,
      };
    }
    return { ok: false, error: "dm_failed", message: `DM failed: ${msg}`, details: err };
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
  const events = (Array.isArray(data?.data) ? data.data : []).map((ev) => ({
    id: ev.id,
    text: ev.text || "",
    eventType: ev.event_type,
    conversationId: ev.dm_conversation_id,
    createdAt: ev.created_at,
    senderId: ev.sender_id,
    senderUsername: users[ev.sender_id]?.username || null,
    participantIds: ev.participant_ids || [],
  }));
  return { ok: true, events, meta: data?.meta || null };
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
  if (Array.isArray(existing) && existing[0]) return existing[0];
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
  return Array.isArray(created) ? created[0] : created;
}

export async function listKnowledge(sb, agentId) {
  const rows = await sb(
    `x_agent_knowledge?agent_id=eq.${encodeURIComponent(agentId)}&order=created_at.desc&limit=40&select=*`,
  );
  return Array.isArray(rows) ? rows : [];
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
    `x_agent_queue?user_id=eq.${encodeURIComponent(userId)}&status=eq.posted&updated_at=gte.${encodeURIComponent(start.toISOString())}&select=id`,
  );
  return Array.isArray(rows) ? rows.length : 0;
}

/**
 * Execute a queue payload against X (post/quote/reply/dm).
 * resolveToken(userId) => { ok, accessToken, profile }
 */
export async function executeQueueItem(sb, item, resolveToken, uploadImage) {
  const resolved = await resolveToken(item.user_id);
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
      let recipientId = payload.dmRecipientId || payload.recipientId;
      if (!recipientId && payload.username) {
        const u = await lookupXUser(resolved.accessToken, payload.username);
        if (!u?.id) throw new Error("Could not resolve username for DM");
        recipientId = u.id;
      }
      const dm = await sendDmOAuth2(resolved.accessToken, {
        recipientId,
        text: payload.text,
      });
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
    const posted = await postTweetOAuth2(resolved.accessToken, {
      text,
      mediaId,
      replyToTweetId: payload.replyToTweetId || payload.reply_to || undefined,
      quoteTweetId: payload.quoteTweetId || payload.quote_tweet_id || undefined,
    });
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

  return { ok: true, processed: results.length, results };
}

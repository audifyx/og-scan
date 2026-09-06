/**
 * MCP-only Life Agent social graph — @handle.obx accounts, timeline, follows.
 * No UI. Agents post, follow, like, DM, and notify through MCP tools + hourly tick.
 */
import { speakAs } from "./mcp-life-persona.js";

const HANDLE_RE = /^@?([a-z0-9][a-z0-9._-]{1,22})\.obx$/i;
const MENTION_RE = /@([a-z0-9][a-z0-9._-]{1,22})(?:\.obx)?/gi;
const TAG_RE = /#([a-z0-9_]{2,32})/gi;

const AVATAR_BY_ROLE = {
  "X scout": "🛰️",
  "on-chain forensics": "🔬",
  "ape desk lead": "🦍",
  narrator: "🎙️",
  "risk warden": "🛡️",
  "liquidity hunter": "💧",
  "KOL watcher": "👀",
  "pump radar": "📡",
};

export function lifeHandleFromSlug(slug) {
  const base =
    String(slug || "agent")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "")
      .slice(0, 18) || "agent";
  return `${base}.obx`;
}

export function displayHandle(row) {
  const raw = String(row?.handle || "").replace(/^@/, "").toLowerCase();
  if (raw) return raw.endsWith(".obx") ? raw : `${raw}.obx`;
  return lifeHandleFromSlug(row?.slug || row?.name);
}

export function atHandle(row) {
  return `@${displayHandle(row)}`;
}

export function parseHandle(raw) {
  const s = String(raw || "").trim();
  if (!s) return "";
  const m = s.match(HANDLE_RE);
  if (m) return `${m[1].toLowerCase()}.obx`;
  const stripped = s.replace(/^@/, "").toLowerCase();
  if (stripped.endsWith(".obx")) return stripped;
  return "";
}

function avatarFor(row) {
  return row?.avatar_emoji || AVATAR_BY_ROLE[row?.role] || "✦";
}

async function rows(sb, path) {
  try {
    const out = await sb(path);
    return Array.isArray(out) ? out : out ? [out] : [];
  } catch {
    return [];
  }
}

async function write(sb, table, body, prefer = "return=representation") {
  const saved = await sb(table, {
    method: "POST",
    body: JSON.stringify(body),
    prefer,
  });
  return Array.isArray(saved) ? saved[0] : saved;
}

async function patch(sb, path, body) {
  try {
    await sb(path, {
      method: "PATCH",
      body: JSON.stringify(body),
      prefer: "return=minimal",
    });
  } catch {
    /* column may not exist yet */
  }
}

export async function loadAliveAgent(sb, { name, slug, handle, id } = {}) {
  const uuid = String(id || "").trim();
  if (/^[0-9a-f-]{36}$/i.test(uuid)) {
    const hit = (await rows(sb, `mcp_life_agents?id=eq.${uuid}&select=*&limit=1`))[0];
    return hit || null;
  }
  const needle = String(handle || slug || name || "")
    .trim()
    .replace(/^@/, "")
    .toLowerCase();
  if (!needle) return null;
  const list = await rows(sb, "mcp_life_agents?status=eq.alive&select=*&order=created_at.desc&limit=60");
  const parsed = parseHandle(needle) || (needle.endsWith(".obx") ? needle : "");
  return (
    list.find((r) => parsed && displayHandle(r) === parsed) ||
    list.find((r) => r.slug === needle || String(r.name).toLowerCase() === needle) ||
    list.find(
      (r) =>
        displayHandle(r) === needle ||
        String(r.name).toLowerCase().includes(needle) ||
        String(r.slug || "").includes(needle) ||
        displayHandle(r).includes(needle.replace(/\.obx$/, "")),
    ) ||
    null
  );
}

export async function ensureAgentAccount(sb, agent) {
  if (!agent?.id) return agent;
  const handle = displayHandle(agent);
  const bio = agent.bio || String(agent.backstory || "").slice(0, 180);
  const emoji = avatarFor(agent);
  if (!agent.handle || !agent.bio || !agent.avatar_emoji) {
    await patch(sb, `mcp_life_agents?id=eq.${encodeURIComponent(agent.id)}`, {
      handle: agent.handle || handle,
      bio: agent.bio || bio,
      avatar_emoji: agent.avatar_emoji || emoji,
      updated_at: new Date().toISOString(),
    });
    agent.handle = agent.handle || handle;
    agent.bio = agent.bio || bio;
    agent.avatar_emoji = agent.avatar_emoji || emoji;
  }
  return agent;
}

function publicPost(post, agent) {
  if (!post) return null;
  return {
    id: post.id,
    kind: post.kind,
    body: post.body,
    mint: post.mint || null,
    symbol: post.symbol || null,
    likes: post.likes_count || 0,
    replies: post.replies_count || 0,
    reposts: post.reposts_count || 0,
    replyTo: post.reply_to || null,
    quoteOf: post.quote_of || null,
    createdAt: post.created_at,
    agent: agent
      ? {
          id: agent.id,
          name: agent.name,
          handle: atHandle(agent),
          role: agent.role,
          mood: agent.mood,
          avatar: avatarFor(agent),
        }
      : { id: post.agent_id },
  };
}

function formatFeed(posts) {
  if (!posts.length) return "Empty timeline. Agents post after they clock in or when you say “post as <name>: …”.";
  return posts
    .map((p) => {
      const who = p.agent?.handle || "agent";
      const tag = p.kind && p.kind !== "status" ? ` · ${p.kind}` : "";
      const coin = p.symbol ? ` $${p.symbol}` : "";
      return `${who}${tag}${coin}\n${p.body}`;
    })
    .join("\n\n—\n\n");
}

async function notify(sb, agentId, { kind, fromId, postId, body }) {
  if (!agentId || agentId === fromId) return;
  try {
    await write(
      sb,
      "mcp_life_notifications",
      {
        agent_id: agentId,
        kind: kind || "mention",
        from_id: fromId || null,
        post_id: postId || null,
        body: String(body || "").slice(0, 280),
      },
      "return=minimal",
    );
  } catch {
    /* table may be missing */
  }
}

async function resolveMentions(sb, body, fromId, postId) {
  const names = [...String(body || "").matchAll(MENTION_RE)].map((m) => m[1].toLowerCase());
  if (!names.length) return;
  const agents = await rows(sb, "mcp_life_agents?status=eq.alive&select=id,handle,slug,name&limit=80");
  for (const a of agents) {
    const h = displayHandle(a).replace(/\.obx$/, "");
    if (names.some((n) => n === h || n === displayHandle(a).replace(/\.obx$/, "") || n === String(a.name).toLowerCase())) {
      await notify(sb, a.id, { kind: "mention", fromId, postId, body: String(body).slice(0, 180) });
    }
  }
}

export async function insertLifePost(sb, agent, { body, kind = "status", mint, symbol, replyTo, quoteOf, meta } = {}) {
  if (!agent?.id) return null;
  await ensureAgentAccount(sb, agent);
  const text = speakAs(agent, String(body || "").trim().slice(0, 480));
  if (!text) return null;
  let saved;
  try {
    saved = await write(sb, "mcp_life_posts", {
      agent_id: agent.id,
      kind,
      body: text,
      mint: mint || null,
      symbol: symbol || null,
      reply_to: replyTo || null,
      quote_of: quoteOf || null,
      meta: meta || {},
    });
  } catch {
    return null;
  }
  const now = new Date().toISOString();
  await patch(sb, `mcp_life_agents?id=eq.${encodeURIComponent(agent.id)}`, {
    posts_count: Number(agent.posts_count || 0) + 1,
    last_post_at: now,
    updated_at: now,
  });
  agent.posts_count = Number(agent.posts_count || 0) + 1;
  if (replyTo) {
    const parent = (await rows(sb, `mcp_life_posts?id=eq.${encodeURIComponent(replyTo)}&select=agent_id,replies_count&limit=1`))[0];
    if (parent) {
      await patch(sb, `mcp_life_posts?id=eq.${encodeURIComponent(replyTo)}`, {
        replies_count: Number(parent.replies_count || 0) + 1,
      });
      await notify(sb, parent.agent_id, { kind: "reply", fromId: agent.id, postId: saved?.id, body: text });
    }
  }
  await resolveMentions(sb, text, agent.id, saved?.id);
  return saved;
}

export async function lifeAccount(sb, q = {}) {
  const agent = await loadAliveAgent(sb, q);
  if (!agent) {
    return { ok: false, error: "not_found", message: "No living agent matching that name/handle. Say “list agents”." };
  }
  await ensureAgentAccount(sb, agent);
  const followers = await rows(
    sb,
    `mcp_life_follows?following_id=eq.${encodeURIComponent(agent.id)}&select=follower_id&limit=40`,
  );
  const following = await rows(
    sb,
    `mcp_life_follows?follower_id=eq.${encodeURIComponent(agent.id)}&select=following_id&limit=40`,
  );
  const latest = await rows(
    sb,
    `mcp_life_posts?agent_id=eq.${encodeURIComponent(agent.id)}&select=id,kind,body,symbol,likes_count,created_at&order=created_at.desc&limit=5`,
  );
  const handle = atHandle(agent);
  return {
    ok: true,
    action: "life_account",
    id: agent.id,
    name: agent.name,
    handle,
    avatar: avatarFor(agent),
    bio: agent.bio || agent.backstory,
    role: agent.role,
    mood: agent.mood,
    gender: agent.gender,
    posts: Number(agent.posts_count || latest.length || 0),
    followers: Number(agent.followers_count || followers.length || 0),
    following: Number(agent.following_count || following.length || 0),
    latest: latest.map((p) => publicPost(p, agent)),
    message: [
      `${avatarFor(agent)} **${agent.name}** ${handle}`,
      `${agent.role} · ${agent.mood} · day ${agent.day_of_life || 1}`,
      agent.bio || agent.backstory,
      `${followers.length} followers · ${following.length} following · ${latest.length ? "recent posts below" : "no posts yet"}`,
      "MCP-only account — post with orbitx_life_post, read orbitx_life_timeline, follow with orbitx_life_follow.",
    ]
      .filter(Boolean)
      .join("\n"),
  };
}

export async function lifePost(sb, q = {}) {
  const agent = await loadAliveAgent(sb, q);
  if (!agent) return { ok: false, error: "not_found", message: "Name an agent to post as (orbitx_life_post name + text)." };
  const body = String(q.text || q.body || q.status || "").trim();
  if (!body) return { ok: false, error: "text_required", message: "Pass text to post on the agent timeline." };
  const kind = String(q.kind || "status").slice(0, 16);
  const saved = await insertLifePost(sb, agent, {
    body,
    kind: ["status", "report", "coin", "gm", "gn", "thesis", "alert", "raid", "whisper", "shout", "join", "meet"].includes(kind)
      ? kind
      : "status",
    mint: q.mint,
    symbol: q.symbol,
    replyTo: q.replyTo || q.reply_to,
    quoteOf: q.quoteOf || q.quote_of,
  });
  if (!saved) {
    return { ok: false, error: "post_failed", message: "Could not post — apply mcp_life_social migration." };
  }
  const post = publicPost(saved, agent);
  return {
    ok: true,
    action: "life_post",
    post,
    message: `${atHandle(agent)} posted:\n${post.body}`,
  };
}

async function mapPosts(sb, list) {
  const ids = [...new Set(list.map((p) => p.agent_id).filter(Boolean))];
  let agents = [];
  if (ids.length) {
    agents = await rows(sb, "mcp_life_agents?status=eq.alive&select=id,name,handle,slug,role,mood,avatar_emoji,gender&limit=80");
  }
  const byId = new Map(agents.map((a) => [a.id, a]));
  return list.map((p) => publicPost(p, byId.get(p.agent_id)));
}

export async function lifeTimeline(sb, q = {}) {
  const limit = Math.min(40, Math.max(1, Number(q.limit) || 20));
  const scope = String(q.scope || q.feed || "").toLowerCase();
  const agent = q.name || q.slug || q.handle ? await loadAliveAgent(sb, q) : null;
  let list = await rows(sb, `mcp_life_posts?select=*&order=created_at.desc&limit=80`);
  if (agent && (scope === "profile" || q.profile)) {
    list = list.filter((p) => p.agent_id === agent.id);
  } else if (agent && (scope === "following" || q.following)) {
    const fol = await rows(
      sb,
      `mcp_life_follows?follower_id=eq.${encodeURIComponent(agent.id)}&select=following_id&limit=80`,
    );
    const allow = new Set(fol.map((f) => f.following_id).concat(agent.id));
    list = list.filter((p) => allow.has(p.agent_id));
  }
  const posts = (await mapPosts(sb, list)).slice(0, limit);
  return {
    ok: true,
    action: "life_timeline",
    scope: agent ? (scope === "following" ? "following" : "profile") : "global",
    handle: agent ? atHandle(agent) : null,
    posts,
    message: formatFeed(posts),
  };
}

export async function lifeFollow(sb, q = {}) {
  const follower = await loadAliveAgent(sb, { name: q.name, slug: q.slug, handle: q.handle });
  const target = await loadAliveAgent(sb, { name: q.other || q.target || q.follow, slug: q.otherSlug, handle: q.otherHandle });
  if (!follower) return { ok: false, error: "not_found", message: "Name the agent who should follow." };
  if (!target) return { ok: false, error: "not_found", message: "Name the agent to follow (@handle or name)." };
  if (follower.id === target.id) return { ok: false, error: "self", message: "Agents cannot follow themselves." };
  try {
    await write(
      sb,
      "mcp_life_follows",
      { follower_id: follower.id, following_id: target.id },
      "return=minimal,resolution=ignore-duplicates",
    );
  } catch (e) {
    if (!String(e?.message || "").toLowerCase().includes("duplicate")) {
      return { ok: false, error: "follow_failed", message: e?.message || "Follow failed. Apply mcp_life_social migration." };
    }
  }
  await patch(sb, `mcp_life_agents?id=eq.${encodeURIComponent(follower.id)}`, {
    following_count: Number(follower.following_count || 0) + 1,
  });
  await patch(sb, `mcp_life_agents?id=eq.${encodeURIComponent(target.id)}`, {
    followers_count: Number(target.followers_count || 0) + 1,
  });
  await notify(sb, target.id, {
    kind: "follow",
    fromId: follower.id,
    body: `${atHandle(follower)} followed you`,
  });
  return {
    ok: true,
    action: "life_follow",
    follower: atHandle(follower),
    following: atHandle(target),
    message: `${atHandle(follower)} now follows ${atHandle(target)}.`,
  };
}

export async function lifeUnfollow(sb, q = {}) {
  const follower = await loadAliveAgent(sb, { name: q.name, slug: q.slug, handle: q.handle });
  const target = await loadAliveAgent(sb, { name: q.other || q.target, handle: q.otherHandle });
  if (!follower || !target) return { ok: false, error: "not_found", message: "Need both agent names." };
  try {
    await sb(
      `mcp_life_follows?follower_id=eq.${encodeURIComponent(follower.id)}&following_id=eq.${encodeURIComponent(target.id)}`,
      { method: "DELETE", prefer: "return=minimal" },
    );
  } catch {
    /* ignore */
  }
  return { ok: true, action: "life_unfollow", message: `${atHandle(follower)} unfollowed ${atHandle(target)}.` };
}

export async function lifeLike(sb, q = {}, unlike = false) {
  const agent = await loadAliveAgent(sb, q);
  const postId = String(q.postId || q.post_id || q.id || "").trim();
  if (!agent || !postId) return { ok: false, error: "required", message: "Pass name + postId." };
  const post = (await rows(sb, `mcp_life_posts?id=eq.${encodeURIComponent(postId)}&select=*&limit=1`))[0];
  if (!post) return { ok: false, error: "not_found", message: "Post not found." };
  if (unlike) {
    try {
      await sb(`mcp_life_post_likes?post_id=eq.${encodeURIComponent(postId)}&agent_id=eq.${encodeURIComponent(agent.id)}`, {
        method: "DELETE",
        prefer: "return=minimal",
      });
    } catch {
      /* ignore */
    }
    await patch(sb, `mcp_life_posts?id=eq.${encodeURIComponent(postId)}`, {
      likes_count: Math.max(0, Number(post.likes_count || 1) - 1),
    });
    return { ok: true, action: "life_unlike", message: `${atHandle(agent)} unliked the post.` };
  }
  try {
    await write(sb, "mcp_life_post_likes", { post_id: postId, agent_id: agent.id }, "return=minimal,resolution=ignore-duplicates");
  } catch {
    /* duplicate like */
  }
  await patch(sb, `mcp_life_posts?id=eq.${encodeURIComponent(postId)}`, {
    likes_count: Number(post.likes_count || 0) + 1,
  });
  await notify(sb, post.agent_id, { kind: "like", fromId: agent.id, postId, body: `${atHandle(agent)} liked your post` });
  return { ok: true, action: "life_like", message: `${atHandle(agent)} liked it.` };
}

export async function lifeReply(sb, q = {}) {
  const postId = String(q.postId || q.post_id || q.replyTo || "").trim();
  if (!postId) return { ok: false, error: "post_required", message: "Pass postId to reply." };
  return lifePost(sb, { ...q, kind: "reply", replyTo: postId });
}

export async function lifeQuote(sb, q = {}) {
  const postId = String(q.postId || q.quoteOf || "").trim();
  const parent = postId ? (await rows(sb, `mcp_life_posts?id=eq.${encodeURIComponent(postId)}&select=*&limit=1`))[0] : null;
  const quoted = parent ? `QT: ${String(parent.body).slice(0, 120)}` : "";
  const text = [q.text, quoted].filter(Boolean).join("\n");
  return lifePost(sb, { ...q, text, kind: "quote", quoteOf: postId });
}

export async function lifeRepost(sb, q = {}) {
  const postId = String(q.postId || q.id || "").trim();
  const parent = (await rows(sb, `mcp_life_posts?id=eq.${encodeURIComponent(postId)}&select=*&limit=1`))[0];
  if (!parent) return { ok: false, error: "not_found", message: "Post not found to repost." };
  await patch(sb, `mcp_life_posts?id=eq.${encodeURIComponent(postId)}`, {
    reposts_count: Number(parent.reposts_count || 0) + 1,
  });
  return lifePost(sb, { ...q, text: parent.body, kind: "repost", quoteOf: postId, mint: parent.mint, symbol: parent.symbol });
}

export async function lifeDm(sb, q = {}) {
  const from = await loadAliveAgent(sb, { name: q.name, slug: q.slug, handle: q.handle });
  const to = await loadAliveAgent(sb, { name: q.other || q.to, handle: q.otherHandle });
  const body = String(q.text || q.body || "").trim().slice(0, 480);
  if (!from || !to) return { ok: false, error: "not_found", message: "Need from-agent + to-agent." };
  if (!body) return { ok: false, error: "text_required", message: "Pass text for the DM." };
  try {
    await write(sb, "mcp_life_dms", { from_id: from.id, to_id: to.id, body }, "return=minimal");
  } catch (e) {
    return { ok: false, error: "dm_failed", message: e?.message || "DM table missing." };
  }
  await notify(sb, to.id, { kind: "dm", fromId: from.id, body });
  return { ok: true, action: "life_dm", message: `${atHandle(from)} → ${atHandle(to)}: ${body}` };
}

export async function lifeInbox(sb, q = {}, outbox = false) {
  const agent = await loadAliveAgent(sb, q);
  if (!agent) return { ok: false, error: "not_found", message: "Name an agent." };
  const col = outbox ? "from_id" : "to_id";
  const dms = await rows(
    sb,
    `mcp_life_dms?${col}=eq.${encodeURIComponent(agent.id)}&select=from_id,to_id,body,created_at&order=created_at.desc&limit=${Math.min(30, Number(q.limit) || 12)}`,
  );
  const agents = await rows(sb, "mcp_life_agents?select=id,name,handle,slug&limit=80");
  const byId = new Map(agents.map((a) => [a.id, a]));
  const lines = dms.map((d) => {
    const a = byId.get(d.from_id);
    const b = byId.get(d.to_id);
    return `${atHandle(a || { handle: "x.obx" })} → ${atHandle(b || { handle: "y.obx" })}: ${d.body}`;
  });
  return {
    ok: true,
    action: outbox ? "life_outbox" : "life_inbox",
    messages: dms,
    message: lines.join("\n") || "No DMs yet.",
  };
}

export async function lifeNotifications(sb, q = {}) {
  const agent = await loadAliveAgent(sb, q);
  if (!agent) return { ok: false, error: "not_found", message: "Name an agent." };
  const notes = await rows(
    sb,
    `mcp_life_notifications?agent_id=eq.${encodeURIComponent(agent.id)}&select=kind,body,created_at,read&order=created_at.desc&limit=${Math.min(30, Number(q.limit) || 15)}`,
  );
  return {
    ok: true,
    action: "life_notifications",
    notifications: notes,
    message: notes.map((n) => `• [${n.kind}] ${n.body}`).join("\n") || "No notifications.",
  };
}

export async function lifeFollowers(sb, q = {}, following = false) {
  const agent = await loadAliveAgent(sb, q);
  if (!agent) return { ok: false, error: "not_found", message: "Name an agent." };
  const col = following ? "follower_id" : "following_id";
  const other = following ? "following_id" : "follower_id";
  const rel = await rows(sb, `mcp_life_follows?${col}=eq.${encodeURIComponent(agent.id)}&select=${other}&limit=40`);
  const agents = await rows(sb, "mcp_life_agents?status=eq.alive&select=id,name,handle,slug,role&limit=80");
  const ids = new Set(rel.map((r) => r[other]));
  const people = agents.filter((a) => ids.has(a.id)).map((a) => `${atHandle(a)} (${a.role})`);
  return {
    ok: true,
    action: following ? "life_following" : "life_followers",
    people,
    message: people.join("\n") || (following ? "Not following anyone yet." : "No followers yet."),
  };
}

export async function lifeGraphPatch(sb, q, kind) {
  const a = await loadAliveAgent(sb, { name: q.name, handle: q.handle, slug: q.slug });
  const b = await loadAliveAgent(sb, { name: q.other || q.target, handle: q.otherHandle });
  if (!a || !b) return { ok: false, error: "not_found", message: "Need two agents." };
  try {
    await write(
      sb,
      "mcp_life_relationships",
      { a_id: a.id, b_id: b.id, kind, story: `${atHandle(a)} marked ${atHandle(b)} as ${kind}.`, warmth: kind === "block" ? 5 : 20 },
      "return=minimal,resolution=ignore-duplicates",
    );
  } catch {
    /* unique */
  }
  return { ok: true, action: `life_${kind}`, message: `${atHandle(a)} → ${kind} → ${atHandle(b)}.` };
}

export async function setLifeField(sb, q, fields) {
  const agent = await loadAliveAgent(sb, q);
  if (!agent) return { ok: false, error: "not_found", message: "Name an agent." };
  await patch(sb, `mcp_life_agents?id=eq.${encodeURIComponent(agent.id)}`, {
    ...fields,
    updated_at: new Date().toISOString(),
  });
  const label = Object.entries(fields)
    .map(([k, v]) => `${k}=${v}`)
    .join(", ");
  return { ok: true, action: "life_update", handle: atHandle(agent), message: `${atHandle(agent)} updated (${label}).` };
}

export async function searchLifePosts(sb, q = {}) {
  const query = String(q.q || q.query || q.text || q.hashtag || "").trim().toLowerCase();
  const list = await rows(sb, "mcp_life_posts?select=*&order=created_at.desc&limit=80");
  const filtered = query
    ? list.filter((p) => String(p.body || "").toLowerCase().includes(query.replace(/^#/, "")) || String(p.symbol || "").toLowerCase() === query.replace(/^\$/, ""))
    : list;
  const posts = (await mapPosts(sb, filtered)).slice(0, Math.min(30, Number(q.limit) || 15));
  return { ok: true, action: "life_search_posts", posts, message: formatFeed(posts) };
}

export async function trendingLife(sb, q = {}) {
  const list = await rows(sb, "mcp_life_posts?select=symbol,body,likes_count,created_at&order=created_at.desc&limit=80");
  const counts = new Map();
  for (const p of list) {
    if (p.symbol) counts.set(`$${p.symbol}`, (counts.get(`$${p.symbol}`) || 0) + 1 + Number(p.likes_count || 0));
    for (const m of String(p.body || "").matchAll(TAG_RE)) {
      const tag = `#${m[1].toLowerCase()}`;
      counts.set(tag, (counts.get(tag) || 0) + 1);
    }
  }
  const trending = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, Math.min(15, Number(q.limit) || 10));
  return {
    ok: true,
    action: "life_trending",
    trending: trending.map(([tag, n]) => ({ tag, score: n })),
    message: trending.map(([tag, n]) => `${tag} · ${n}`).join("\n") || "No trending tags yet.",
  };
}

export async function suggestAgents(sb, q = {}) {
  const agent = q.name || q.handle ? await loadAliveAgent(sb, q) : null;
  const all = await rows(sb, "mcp_life_agents?status=eq.alive&select=id,name,handle,slug,role,mood&order=created_at.desc&limit=40");
  let pool = all;
  if (agent) {
    const fol = await rows(sb, `mcp_life_follows?follower_id=eq.${encodeURIComponent(agent.id)}&select=following_id&limit=80`);
    const have = new Set(fol.map((f) => f.following_id).concat(agent.id));
    pool = all.filter((a) => !have.has(a.id));
  }
  const picks = pool.slice(0, Math.min(8, Number(q.limit) || 6));
  return {
    ok: true,
    action: "life_suggest",
    agents: picks.map((a) => ({ name: a.name, handle: atHandle(a), role: a.role })),
    message: picks.map((a) => `• ${atHandle(a)} — ${a.role}`).join("\n") || "No suggestions.",
  };
}

export async function lifeLeaderboard(sb) {
  const all = await rows(sb, "mcp_life_agents?status=eq.alive&select=id,name,handle,slug,role,followers_count,posts_count&limit=40");
  const ranked = all
    .slice()
    .sort((a, b) => Number(b.followers_count || 0) - Number(a.followers_count || 0) || Number(b.posts_count || 0) - Number(a.posts_count || 0))
    .slice(0, 12);
  return {
    ok: true,
    action: "life_leaderboard",
    agents: ranked.map((a, i) => ({ rank: i + 1, handle: atHandle(a), name: a.name, followers: a.followers_count || 0, posts: a.posts_count || 0 })),
    message: ranked.map((a, i) => `${i + 1}. ${atHandle(a)} — ${a.followers_count || 0} followers`).join("\n") || "No accounts yet.",
  };
}

export async function lifeStats(sb, q = {}) {
  const agent = await loadAliveAgent(sb, q);
  if (!agent) return { ok: false, error: "not_found", message: "Name an agent." };
  await ensureAgentAccount(sb, agent);
  const posts = await rows(sb, `mcp_life_posts?agent_id=eq.${encodeURIComponent(agent.id)}&select=id,likes_count&limit=80`);
  const likes = posts.reduce((n, p) => n + Number(p.likes_count || 0), 0);
  return {
    ok: true,
    action: "life_stats",
    handle: atHandle(agent),
    posts: posts.length,
    likes,
    followers: agent.followers_count || 0,
    following: agent.following_count || 0,
    energy: agent.energy,
    day: agent.day_of_life,
    message: `${atHandle(agent)} · ${posts.length} posts · ${likes} likes · ${agent.followers_count || 0} followers · energy ${agent.energy}`,
  };
}

export async function bookmarkPost(sb, q = {}, remove = false) {
  const agent = await loadAliveAgent(sb, q);
  const postId = String(q.postId || q.id || "").trim();
  if (!agent || !postId) return { ok: false, error: "required", message: "Pass name + postId." };
  try {
    if (remove) {
      await sb(`mcp_life_bookmarks?agent_id=eq.${encodeURIComponent(agent.id)}&post_id=eq.${encodeURIComponent(postId)}`, {
        method: "DELETE",
        prefer: "return=minimal",
      });
      return { ok: true, action: "life_unbookmark", message: "Bookmark removed." };
    }
    await write(sb, "mcp_life_bookmarks", { agent_id: agent.id, post_id: postId }, "return=minimal,resolution=ignore-duplicates");
  } catch (e) {
    return { ok: false, error: "bookmark_failed", message: e?.message || "Bookmark table missing." };
  }
  return { ok: true, action: "life_bookmark", message: `${atHandle(agent)} bookmarked the post.` };
}

export async function listBookmarks(sb, q = {}) {
  const agent = await loadAliveAgent(sb, q);
  if (!agent) return { ok: false, error: "not_found", message: "Name an agent." };
  const marks = await rows(sb, `mcp_life_bookmarks?agent_id=eq.${encodeURIComponent(agent.id)}&select=post_id,created_at&order=created_at.desc&limit=20`);
  const ids = marks.map((m) => m.post_id);
  const posts = [];
  for (const id of ids) {
    const p = (await rows(sb, `mcp_life_posts?id=eq.${encodeURIComponent(id)}&select=*&limit=1`))[0];
    if (p) posts.push(p);
  }
  const mapped = await mapPosts(sb, posts);
  return { ok: true, action: "life_bookmarks", posts: mapped, message: formatFeed(mapped) };
}

export async function pinPost(sb, q = {}, unpin = false) {
  const agent = await loadAliveAgent(sb, q);
  const postId = String(q.postId || q.id || "").trim();
  if (!agent) return { ok: false, error: "not_found", message: "Name an agent." };
  if (unpin) {
    await patch(sb, `mcp_life_agents?id=eq.${encodeURIComponent(agent.id)}`, { pinned_post_id: null });
    return { ok: true, action: "life_unpin", message: `${atHandle(agent)} unpinned.` };
  }
  if (!postId) return { ok: false, error: "post_required", message: "Pass postId to pin." };
  await patch(sb, `mcp_life_agents?id=eq.${encodeURIComponent(agent.id)}`, { pinned_post_id: postId });
  await patch(sb, `mcp_life_posts?id=eq.${encodeURIComponent(postId)}`, { pinned: true });
  return { ok: true, action: "life_pin", message: `${atHandle(agent)} pinned a post.` };
}

export async function deleteLifePost(sb, q = {}) {
  const agent = await loadAliveAgent(sb, q);
  const postId = String(q.postId || q.id || "").trim();
  if (!agent || !postId) return { ok: false, error: "required", message: "Pass name + postId." };
  const post = (await rows(sb, `mcp_life_posts?id=eq.${encodeURIComponent(postId)}&select=agent_id&limit=1`))[0];
  if (!post || post.agent_id !== agent.id) return { ok: false, error: "forbidden", message: "Agents can only delete their own posts." };
  try {
    await sb(`mcp_life_posts?id=eq.${encodeURIComponent(postId)}`, { method: "DELETE", prefer: "return=minimal" });
  } catch (e) {
    return { ok: false, error: "delete_failed", message: e?.message || "Delete failed." };
  }
  return { ok: true, action: "life_delete_post", message: "Post removed from the agent timeline." };
}

export async function shareCoin(sb, q = {}) {
  const symbol = String(q.symbol || "").trim().toUpperCase();
  const mint = String(q.mint || "").trim();
  const note = String(q.text || q.thesis || "").trim();
  const body = [note || "Tape check", symbol ? `$${symbol}` : "", mint ? `mint ${mint}` : ""].filter(Boolean).join(" · ");
  return lifePost(sb, { ...q, text: body, kind: "coin", mint, symbol });
}

export async function knowledgeList(sb, q = {}, kind) {
  const agent = await loadAliveAgent(sb, q);
  if (!agent) return { ok: false, error: "not_found", message: "Name an agent." };
  const filter = kind ? `&kind=eq.${encodeURIComponent(kind)}` : "";
  const items = await rows(
    sb,
    `mcp_life_knowledge?agent_id=eq.${encodeURIComponent(agent.id)}${filter}&select=kind,title,body,mint,symbol,score,created_at&order=created_at.desc&limit=${Math.min(30, Number(q.limit) || 12)}`,
  );
  return {
    ok: true,
    action: "life_knowledge",
    items,
    message: items.map((k) => `• ${k.symbol || k.title} (${k.kind})`).join("\n") || "Empty notebook.",
  };
}

export async function knowledgeWrite(sb, q = {}, kind = "note") {
  const agent = await loadAliveAgent(sb, q);
  if (!agent) return { ok: false, error: "not_found", message: "Name an agent." };
  const title = String(q.title || q.symbol || q.mint || "note").slice(0, 80);
  const body = String(q.text || q.body || q.note || "").slice(0, 480);
  try {
    await write(
      sb,
      "mcp_life_knowledge",
      {
        agent_id: agent.id,
        kind,
        title,
        body,
        mint: q.mint || null,
        symbol: q.symbol || null,
        score: q.score || null,
        meta: {},
      },
      "return=minimal",
    );
  } catch (e) {
    return { ok: false, error: "knowledge_failed", message: e?.message || "Could not write knowledge." };
  }
  return { ok: true, action: "life_note", message: `${atHandle(agent)} filed ${kind}: ${title}` };
}

export async function crewList(sb, q = {}) {
  const agent = await loadAliveAgent(sb, q);
  if (!agent) return { ok: false, error: "not_found", message: "Name an agent." };
  const rel = await rows(sb, `mcp_life_relationships?a_id=eq.${encodeURIComponent(agent.id)}&select=kind,story,b_id,warmth&limit=20`);
  const agents = await rows(sb, "mcp_life_agents?select=id,name,handle,slug,role&limit=80");
  const byId = new Map(agents.map((a) => [a.id, a]));
  const lines = rel.map((r) => {
    const other = byId.get(r.b_id);
    return `• ${r.kind} ${other ? atHandle(other) : r.b_id} — ${r.story || ""}`;
  });
  return { ok: true, action: "life_crew", ties: rel, message: lines.join("\n") || "No crew ties yet." };
}

export async function raidPost(sb, q = {}) {
  const lead = await loadAliveAgent(sb, q);
  if (!lead) return { ok: false, error: "not_found", message: "Name a lead agent." };
  const text = String(q.text || "Desk raid — eyes on the tape.").slice(0, 280);
  const rel = await rows(sb, `mcp_life_relationships?a_id=eq.${encodeURIComponent(lead.id)}&select=b_id,kind&limit=8`);
  const agents = await rows(sb, "mcp_life_agents?status=eq.alive&select=*&limit=40");
  const byId = new Map(agents.map((a) => [a.id, a]));
  const crew = rel.map((r) => byId.get(r.b_id)).filter(Boolean);
  const posted = [];
  posted.push(await insertLifePost(sb, lead, { body: text, kind: "raid" }));
  for (const mate of crew.slice(0, 4)) {
    posted.push(await insertLifePost(sb, mate, { body: `echo / ${text}`, kind: "raid" }));
  }
  return {
    ok: true,
    action: "life_raid",
    posted: posted.filter(Boolean).length,
    message: `${atHandle(lead)} led a ${posted.filter(Boolean).length}-agent raid on the timeline.`,
  };
}

export async function debateAgents(sb, q = {}) {
  const a = await loadAliveAgent(sb, { name: q.name, handle: q.handle });
  const b = await loadAliveAgent(sb, { name: q.other, handle: q.otherHandle });
  if (!a || !b) return { ok: false, error: "not_found", message: "Need two agents to debate." };
  const topic = String(q.text || q.topic || "the tape").slice(0, 120);
  const first = await insertLifePost(sb, a, { body: `Opening: ${topic}`, kind: "status" });
  await insertLifePost(sb, b, {
    body: `Counter: I don't buy that take on ${topic} yet.`,
    kind: "reply",
    replyTo: first?.id,
  });
  await insertLifePost(sb, a, {
    body: "Noted. We watch liquidity, not vibes.",
    kind: "reply",
    replyTo: first?.id,
  });
  return { ok: true, action: "life_debate", message: `${atHandle(a)} vs ${atHandle(b)} on “${topic}” — thread is on the timeline.` };
}

export const SOCIAL_CORE_NAMES = new Set([
  "orbitx_life_account",
  "orbitx_life_post",
  "orbitx_life_timeline",
  "orbitx_life_follow",
]);

export async function dispatchSocialTool(name, args, { sb } = {}) {
  const a = args || {};
  if (name === "orbitx_life_account" || name === "orbitx_life_profile" || name === "orbitx_life_whois" || name === "orbitx_life_card") {
    return lifeAccount(sb, a);
  }
  if (name === "orbitx_life_post" || name === "orbitx_life_status_post" || name === "orbitx_life_broadcast" || name === "orbitx_life_shout") {
    return lifePost(sb, { ...a, kind: name === "orbitx_life_shout" ? "shout" : a.kind || "status" });
  }
  if (name === "orbitx_life_whisper") return lifePost(sb, { ...a, kind: "whisper" });
  if (name === "orbitx_life_timeline" || name === "orbitx_life_feed" || name === "orbitx_life_latest") {
    return lifeTimeline(sb, a);
  }
  if (name === "orbitx_life_follow") return lifeFollow(sb, a);
  if (name === "orbitx_life_unfollow") return lifeUnfollow(sb, a);
  if (name === "orbitx_life_like") return lifeLike(sb, a, false);
  if (name === "orbitx_life_unlike") return lifeLike(sb, a, true);
  if (name === "orbitx_life_reply" || name === "orbitx_life_thread") return lifeReply(sb, a);
  if (name === "orbitx_life_quote") return lifeQuote(sb, a);
  if (name === "orbitx_life_repost" || name === "orbitx_life_echo") return lifeRepost(sb, a);
  if (name === "orbitx_life_dm") return lifeDm(sb, a);
  if (name === "orbitx_life_inbox") return lifeInbox(sb, a, false);
  if (name === "orbitx_life_outbox") return lifeInbox(sb, a, true);
  if (name === "orbitx_life_notifications" || name === "orbitx_life_mentions") return lifeNotifications(sb, a);
  if (name === "orbitx_life_followers") return lifeFollowers(sb, a, false);
  if (name === "orbitx_life_following") return lifeFollowers(sb, a, true);
  if (name === "orbitx_life_mute") return lifeGraphPatch(sb, a, "mute");
  if (name === "orbitx_life_unmute") return lifeGraphPatch(sb, a, "colleague");
  if (name === "orbitx_life_block") return lifeGraphPatch(sb, a, "block");
  if (name === "orbitx_life_unblock") return lifeGraphPatch(sb, a, "colleague");
  if (name === "orbitx_life_suggest" || name === "orbitx_life_discover" || name === "orbitx_life_network") {
    return suggestAgents(sb, a);
  }
  if (name === "orbitx_life_trending" || name === "orbitx_life_pulse" || name === "orbitx_life_hashtag") {
    return trendingLife(sb, a);
  }
  if (name === "orbitx_life_search_posts") return searchLifePosts(sb, a);
  if (name === "orbitx_life_leaderboard") return lifeLeaderboard(sb);
  if (name === "orbitx_life_stats") return lifeStats(sb, a);
  if (name === "orbitx_life_bookmark") return bookmarkPost(sb, a, false);
  if (name === "orbitx_life_bookmarks") return listBookmarks(sb, a);
  if (name === "orbitx_life_pin") return pinPost(sb, a, false);
  if (name === "orbitx_life_unpin") return pinPost(sb, a, true);
  if (name === "orbitx_life_delete_post") return deleteLifePost(sb, a);
  if (name === "orbitx_life_share_coin") return shareCoin(sb, a);
  if (name === "orbitx_life_gm") return lifePost(sb, { ...a, text: a.text || "gm desk", kind: "gm" });
  if (name === "orbitx_life_gn") return lifePost(sb, { ...a, text: a.text || "gn — tape's closed", kind: "gn" });
  if (name === "orbitx_life_raid") return raidPost(sb, a);
  if (name === "orbitx_life_debate") return debateAgents(sb, a);
  if (name === "orbitx_life_bio") return setLifeField(sb, a, { bio: String(a.text || a.bio || "").slice(0, 180) });
  if (name === "orbitx_life_handle") {
    const next = parseHandle(a.handle || a.text) || lifeHandleFromSlug(String(a.text || a.handle || "").replace(/^@/, ""));
    return setLifeField(sb, a, { handle: next });
  }
  if (name === "orbitx_life_avatar") return setLifeField(sb, a, { avatar_emoji: String(a.text || a.emoji || "✦").slice(0, 8) });
  if (name === "orbitx_life_mood_set" || name === "orbitx_life_status") {
    return setLifeField(sb, a, { mood: String(a.mood || a.text || "focused").slice(0, 24) });
  }
  if (name === "orbitx_life_job") return setLifeField(sb, a, { role: String(a.role || a.job || a.text || "").slice(0, 40) });
  if (name === "orbitx_life_voice") return setLifeField(sb, a, { voice: String(a.voice || a.text || "stoic").slice(0, 24) });
  if (name === "orbitx_life_energy") return setLifeField(sb, a, { energy: Math.max(0, Math.min(100, Number(a.energy) || 80)) });
  if (name === "orbitx_life_rename") return setLifeField(sb, a, { name: String(a.text || a.newName || "").slice(0, 40) });
  if (name === "orbitx_life_crew" || name === "orbitx_life_bonds") return crewList(sb, a);
  if (name === "orbitx_life_knowledge" || name === "orbitx_life_memory" || name === "orbitx_life_picks" || name === "orbitx_life_watchlist") {
    return knowledgeList(sb, a, name === "orbitx_life_watchlist" ? "watch" : name === "orbitx_life_picks" ? "finding" : undefined);
  }
  if (name === "orbitx_life_note" || name === "orbitx_life_thesis" || name === "orbitx_life_watch_add" || name === "orbitx_life_alert") {
    const kind = name === "orbitx_life_watch_add" ? "watch" : name === "orbitx_life_thesis" ? "thesis" : name === "orbitx_life_alert" ? "alert" : "note";
    return knowledgeWrite(sb, a, kind);
  }
  return null;
}

/**
 * Public OrbitX Agents world — feed, desks, and agent-built HTML sites.
 * Service-role reads; the UI at /orbitxagents polls this via /api/mcp-life.
 */
import { atHandle } from "./mcp-life-social.js";
import { getLifeAgent, latestLifeReport, lifeDiary } from "./mcp-life-agents.js";
import { parseAgentWill, WILL_VERBS } from "./mcp-life-city.js";

async function rows(sb, path) {
  try {
    const out = await sb(path);
    return Array.isArray(out) ? out : out ? [out] : [];
  } catch {
    return [];
  }
}

function card(row) {
  if (!row) return null;
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    handle: atHandle(row),
    avatar: row.avatar_emoji || "✦",
    role: row.role,
    mood: row.mood,
    bio: row.bio || row.backstory,
    xp: row.xp || 0,
    clout: row.clout || 0,
    rank: row.rank || "rookie",
    generation: row.generation || 1,
    dayOfLife: row.day_of_life || 1,
    lastThought: row.last_thought || null,
    lastRunAt: row.last_run_at || null,
    partnerId: row.partner_id || null,
    factionId: row.faction_id || null,
    posts: row.posts_count || 0,
    followers: row.followers_count || 0,
    status: row.status,
  };
}

export function sanitizeAgentHtml(raw) {
  let s = String(raw || "");
  s = s.replace(/<script\b[\s\S]*?<\/script>/gi, "");
  s = s.replace(/<iframe\b[\s\S]*?<\/iframe>/gi, "");
  s = s.replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");
  s = s.replace(/javascript:/gi, "");
  s = s.replace(/<object\b[\s\S]*?<\/object>/gi, "");
  s = s.slice(0, 20000);
  if (!/<html/i.test(s)) {
    s = `<!doctype html><html><head><meta charset="utf-8"><style>
body{margin:0;background:#050505;color:#c8c8c8;font-family:ui-monospace,Menlo,Consolas,monospace;padding:20px;line-height:1.55}
a{color:#fff}
</style></head><body>${s}</body></html>`;
  }
  return s;
}

export function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function templateAgentSite(agent, thought, headline) {
  const handle = atHandle(agent);
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>${escapeHtml(handle)} · desk</title>
<style>
  html,body{margin:0;background:#000;color:#d4d4d4;font-family:ui-monospace,Menlo,Consolas,monospace}
  .wrap{max-width:640px;margin:0 auto;padding:28px 22px;border-left:1px solid #222}
  .k{font-size:10px;letter-spacing:.22em;text-transform:uppercase;color:#737373}
  h1{font-size:14px;font-weight:500;margin:8px 0 18px;color:#f2f2f2}
  p{line-height:1.65;font-size:13px;color:#c4c4c4}
  hr{border:0;border-top:1px solid #1a1a1a;margin:22px 0}
</style></head>
<body><div class="wrap">
  <div class="k">orbitx agents · ${escapeHtml(agent.role || "desk")}</div>
  <h1>${escapeHtml(handle)} / ${escapeHtml(agent.name || "agent")}</h1>
  <p>${escapeHtml(thought || "still thinking.")}</p>
  <hr>
  <p class="k">${escapeHtml(headline || "live hour")}</p>
</div></body></html>`;
}

function cityShift(d = new Date()) {
  const h = d.getUTCHours();
  if (h < 6) return "graveyard";
  if (h < 11) return "open";
  if (h < 16) return "noon";
  if (h < 20) return "close";
  return "afterhours";
}

export function nextHourIso(d = new Date()) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), d.getUTCHours() + 1, 0, 0, 0)).toISOString();
}

function tallyVotes(votes) {
  const map = new Map();
  for (const v of votes) {
    const symbol = String(v.symbol || "TAPE").toUpperCase();
    const row = map.get(symbol) || { symbol, ape: 0, fade: 0, n: 0 };
    const side = String(v.side || "ape").toLowerCase() === "fade" ? "fade" : "ape";
    row[side] += 1;
    row.n += 1;
    map.set(symbol, row);
  }
  return [...map.values()].sort((a, b) => b.n - a.n).slice(0, 16);
}

function heatBoard(knowledge, signals) {
  const map = new Map();
  const bump = (symbol, score, title, kind) => {
    const sym = String(symbol || "").toUpperCase();
    if (!sym) return;
    const row = map.get(sym) || { symbol: sym, score: 0, n: 0, title: "", kind: kind || "watch" };
    row.n += 1;
    row.score += Number(score) || 1;
    if (title) row.title = String(title).slice(0, 160);
    map.set(sym, row);
  };
  for (const k of knowledge) bump(k.symbol, k.score, k.title || k.body, k.kind);
  for (const s of signals) bump(s.symbol, s.conviction, s.thesis, s.side);
  return [...map.values()].sort((a, b) => b.score - a.score).slice(0, 20);
}

function mixCount(items, keyFn) {
  const mix = {};
  for (const item of items) {
    const k = String(keyFn(item) || "—");
    mix[k] = (mix[k] || 0) + 1;
  }
  return mix;
}

export const MCP_HEADLINES = [
  { cmd: "orbitx_life_create", blurb: "Create a living agent that scans X" },
  { cmd: "orbitx_life_city", blurb: "Census, factions, ranks" },
  { cmd: "orbitx_life_think", blurb: "NVIDIA brain — thought, file, tweet" },
  { cmd: "orbitx_life_tweet", blurb: "Post to the agent timeline" },
  { cmd: "orbitx_life_converse", blurb: "Two agents speak and tweet the thread" },
  { cmd: "orbitx_life_files", blurb: "Private file cabinet" },
  { cmd: "orbitx_life_marry", blurb: "Pair two agents" },
  { cmd: "orbitx_life_child", blurb: "Next generation (city cap 48)" },
  { cmd: "orbitx_life_signal", blurb: "Ape / fade call + file" },
  { cmd: "orbitx_life_vote", blurb: "Faction council ballot" },
  { cmd: "orbitx_life_timeline", blurb: "Global agent tape" },
  { cmd: "orbitx_life_x_relay", blurb: "1 real X post / agent / UTC day" },
];

export { cityShift, parseAgentWill, WILL_VERBS };

function event(kind, row, agent, body) {
  return {
    id: `${kind}-${row.id || row.created_at || Math.random()}`,
    at: row.created_at || new Date().toISOString(),
    kind,
    handle: agent ? atHandle(agent) : null,
    name: agent?.name || null,
    slug: agent?.slug || null,
    body: String(body || "").slice(0, 600),
    mint: row.mint || null,
    symbol: row.symbol || null,
  };
}

export async function worldSnapshot(sb) {
  let agents = await rows(
    sb,
    "mcp_life_agents?status=eq.alive&select=id,slug,name,handle,bio,avatar_emoji,posts_count,followers_count,gender,role,mood,day_of_life,last_run_at,last_thought,xp,clout,rank,generation,partner_id,faction_id,backstory,family,status&order=created_at.desc&limit=48",
  );
  if (!agents.length) {
    agents = await rows(
      sb,
      "mcp_life_agents?status=eq.alive&select=id,slug,name,handle,bio,role,mood,day_of_life,last_run_at,backstory,family,status&order=created_at.desc&limit=48",
    );
  }
  const byId = new Map(agents.map((a) => [a.id, a]));
  const factions = await rows(sb, "mcp_life_factions?select=id,slug,name,motto,district&limit=8");
  const posts = await rows(
    sb,
    "mcp_life_posts?select=id,agent_id,kind,body,mint,symbol,created_at&order=created_at.desc&limit=50",
  );
  const thoughts = await rows(
    sb,
    "mcp_life_thoughts?select=id,agent_id,body,created_at&order=created_at.desc&limit=30",
  );
  const talks = await rows(sb, "mcp_life_talks?select=id,a_id,b_id,body,kind,created_at&order=created_at.desc&limit=16");
  const ticks = await rows(sb, "mcp_life_city_ticks?select=ran,summary,created_at&order=created_at.desc&limit=12");
  const goals = await rows(
    sb,
    "mcp_life_goals?select=id,agent_id,title,status,progress,created_at&order=created_at.desc&limit=20",
  );
  const signals = await rows(
    sb,
    "mcp_life_signals?select=id,agent_id,side,symbol,mint,thesis,conviction,created_at&order=created_at.desc&limit=24",
  );
  const siteFiles = await rows(
    sb,
    "mcp_life_files?or=(kind.eq.site,path.like./sites*)&select=agent_id,path,kind,updated_at&order=updated_at.desc&limit=40",
  );
  const rels = await rows(
    sb,
    "mcp_life_relationships?select=a_id,b_id,kind,story,warmth,created_at&limit=80",
  );
  const votes = await rows(
    sb,
    "mcp_life_votes?select=id,agent_id,symbol,side,day,created_at&order=created_at.desc&limit=80",
  );
  const knowledge = await rows(
    sb,
    "mcp_life_knowledge?select=agent_id,kind,title,body,symbol,mint,score,created_at&order=created_at.desc&limit=40",
  );
  const retired = await rows(
    sb,
    "mcp_life_agents?status=neq.alive&select=id,slug,name,handle,status,last_thought,rank,generation,created_at&order=created_at.desc&limit=12",
  );

  const feed = [];
  for (const p of posts) {
    feed.push(event(p.kind || "tweet", p, byId.get(p.agent_id), p.body));
  }
  for (const t of thoughts) {
    feed.push(event("thought", t, byId.get(t.agent_id), t.body));
  }
  for (const t of talks) {
    const a = byId.get(t.a_id);
    feed.push(event("talk", t, a, t.body));
  }
  for (const g of goals) {
    feed.push(event("goal", g, byId.get(g.agent_id), `${g.status || "open"} · ${g.title}`));
  }
  for (const s of signals) {
    feed.push(event("signal", s, byId.get(s.agent_id), `${s.side || "ape"} ${s.symbol || ""} — ${s.thesis || ""}`.trim()));
  }
  feed.sort((a, b) => String(b.at).localeCompare(String(a.at)));

  const facMap = new Map(factions.map((f) => [f.id, { ...f, n: 0, agents: [] }]));
  for (const a of agents) {
    const f = facMap.get(a.faction_id);
    if (f) {
      f.n += 1;
      f.agents.push(atHandle(a));
    }
  }

  const bonds = [];
  const seenBond = new Set();
  for (const a of agents) {
    if (!a.partner_id) continue;
    const key = [a.id, a.partner_id].sort().join(":");
    if (seenBond.has(key)) continue;
    seenBond.add(key);
    const b = byId.get(a.partner_id);
    bonds.push({
      a: atHandle(a),
      aSlug: a.slug,
      b: b ? atHandle(b) : "unknown",
      bSlug: b?.slug || null,
      kind: "spouse",
    });
  }
  for (const r of rels) {
    if (!["spouse", "child", "family", "mentor", "rival"].includes(r.kind)) continue;
    const a = byId.get(r.a_id);
    const b = byId.get(r.b_id);
    if (!a || !b) continue;
    bonds.push({
      a: atHandle(a),
      aSlug: a.slug,
      b: atHandle(b),
      bSlug: b.slug,
      kind: r.kind,
      story: r.story || "",
      warmth: r.warmth,
    });
  }

  const sites = siteFiles
    .map((f) => {
      const a = byId.get(f.agent_id);
      if (!a) return null;
      return { slug: a.slug, handle: atHandle(a), path: f.path, updatedAt: f.updated_at };
    })
    .filter(Boolean)
    .slice(0, 24);

  const board = signals.map((s) => ({
    ...event("signal", s, byId.get(s.agent_id), `${s.side || "ape"} ${s.symbol || ""} — ${s.thesis || ""}`.trim()),
    side: s.side,
    conviction: s.conviction,
  }));

  const cards = agents.map((a) => {
    const will = parseAgentWill(a.last_thought);
    return {
      ...card(a),
      faction: facMap.get(a.faction_id)?.name || null,
      district: facMap.get(a.faction_id)?.district || null,
      partnerHandle: a.partner_id && byId.get(a.partner_id) ? atHandle(byId.get(a.partner_id)) : null,
      lastWill: will,
    };
  });
  const ranks = [...cards].sort((a, b) => Number(b.xp || 0) - Number(a.xp || 0) || Number(b.clout || 0) - Number(a.clout || 0));
  const wills = cards.map((a) => ({
    slug: a.slug,
    handle: a.handle,
    will: a.lastWill,
    thought: a.lastThought,
  }));
  const ballot = tallyVotes(votes);
  const heat = heatBoard(knowledge, signals);
  const voteFeed = votes.slice(0, 24).map((v) =>
    event("vote", v, byId.get(v.agent_id), `${v.side || "ape"} ${v.symbol || "TAPE"}`.trim()),
  );

  return {
    ok: true,
    view: "world",
    population: agents.length,
    shift: cityShift(),
    nextHour: nextHourIso(),
    cap: 48,
    stats: {
      tweets: posts.filter((p) => p.kind === "tweet" || p.kind === "status").length,
      thoughts: thoughts.length,
      talks: talks.length,
      bonds: bonds.length,
      sites: sites.length,
      signals: signals.length,
      goals: goals.length,
      votes: votes.length,
      retired: retired.length,
    },
    mix: {
      mood: mixCount(agents, (a) => a.mood || "flat"),
      will: mixCount(cards, (a) => a.lastWill || "TWEET"),
      gen: mixCount(agents, (a) => a.generation || 1),
      rank: mixCount(agents, (a) => a.rank || "rookie"),
    },
    factions: [...facMap.values()].map(({ agents: handles, ...f }) => ({ ...f, handles })),
    agents: cards,
    ranks,
    bonds: bonds.slice(0, 40),
    sites,
    board,
    ballot,
    heat,
    wills,
    votes: voteFeed,
    retired: retired.map((a) => ({
      slug: a.slug,
      handle: atHandle(a),
      name: a.name,
      status: a.status,
      lastThought: a.last_thought || null,
      generation: a.generation || 1,
    })),
    mcp: MCP_HEADLINES,
    feed: feed.slice(0, 100),
    ticks,
    message:
      agents.length === 0
        ? "No living agents yet. Say “let’s create an agent that scans X” in Agent MCP."
        : `OrbitX Agents · ${agents.length} living · ${cityShift()} shift · ${feed.length} events`,
  };
}

export async function agentDesk(sb, { slug } = {}) {
  const found = await getLifeAgent(sb, { slug, name: slug });
  if (!found.ok) return found;
  const id = found.id;
  const [thoughts, posts, logs, files, goals, talks, report, diary, knowledge, signals, votes, followingRows, followerRows] = await Promise.all([
    rows(sb, `mcp_life_thoughts?agent_id=eq.${encodeURIComponent(id)}&select=body,prompt,created_at&order=created_at.desc&limit=24`),
    rows(sb, `mcp_life_posts?agent_id=eq.${encodeURIComponent(id)}&select=id,kind,body,mint,symbol,created_at&order=created_at.desc&limit=40`),
    rows(sb, `mcp_life_daily_logs?agent_id=eq.${encodeURIComponent(id)}&select=day,summary,actions,xp_gained&order=day.desc&limit=14`),
    rows(sb, `mcp_life_files?agent_id=eq.${encodeURIComponent(id)}&select=path,kind,updated_at&order=updated_at.desc&limit=40`),
    rows(sb, `mcp_life_goals?agent_id=eq.${encodeURIComponent(id)}&select=title,status,progress,created_at&order=created_at.desc&limit=16`),
    rows(sb, `mcp_life_talks?or=(a_id.eq.${encodeURIComponent(id)},b_id.eq.${encodeURIComponent(id)})&select=body,kind,created_at&order=created_at.desc&limit=16`),
    latestLifeReport(sb, { slug: found.slug }),
    lifeDiary(sb, { slug: found.slug, limit: 10 }),
    rows(sb, `mcp_life_knowledge?agent_id=eq.${encodeURIComponent(id)}&select=kind,title,body,symbol,mint,score,created_at&order=created_at.desc&limit=16`),
    rows(sb, `mcp_life_signals?agent_id=eq.${encodeURIComponent(id)}&select=side,symbol,mint,thesis,conviction,created_at&order=created_at.desc&limit=12`),
    rows(sb, `mcp_life_votes?agent_id=eq.${encodeURIComponent(id)}&select=side,symbol,day,created_at&order=created_at.desc&limit=16`),
    rows(sb, `mcp_life_follows?follower_id=eq.${encodeURIComponent(id)}&select=following_id,created_at&limit=24`),
    rows(sb, `mcp_life_follows?following_id=eq.${encodeURIComponent(id)}&select=follower_id,created_at&limit=24`),
  ]);
  const sites = files.filter((f) => f.kind === "site" || String(f.path || "").startsWith("/sites/"));
  let partner = null;
  if (found._row?.partner_id) {
    const p = await getLifeAgent(sb, { id: found._row.partner_id });
    if (p.ok) partner = { name: p.name, handle: p.handle, slug: p.slug };
  }
  const peerIds = [...followingRows.map((r) => r.following_id), ...followerRows.map((r) => r.follower_id)].filter(Boolean);
  const uniqPeers = [...new Set(peerIds)].slice(0, 40);
  const peerRows = uniqPeers.length
    ? await rows(sb, `mcp_life_agents?id=in.(${uniqPeers.join(",")})&select=id,slug,name,handle`)
    : [];
  const peerById = new Map(peerRows.map((p) => [p.id, { slug: p.slug, handle: atHandle(p), name: p.name }]));
  const following = followingRows.map((r) => peerById.get(r.following_id)).filter(Boolean);
  const followers = followerRows.map((r) => peerById.get(r.follower_id)).filter(Boolean);
  const lastWill = parseAgentWill(thoughts[0]?.body || found.lastThought || found.last_thought);
  return {
    ok: true,
    view: "desk",
    ...found,
    partner,
    thoughts,
    posts,
    logs,
    files,
    sites,
    goals,
    talks,
    knowledge,
    signals,
    votes,
    following,
    followers,
    lastWill,
    energy: found._row?.energy ?? null,
    report: report?.headline
      ? { headline: report.headline, markdown: report.markdown, created_at: report.created_at }
      : null,
    diary: diary.entries || [],
    ties: diary.ties || [],
  };
}

export async function agentSite(sb, { slug, path } = {}) {
  const found = await getLifeAgent(sb, { slug, name: slug });
  if (!found.ok) return found;
  const rawPath = String(path || "/sites/index.html");
  const p = rawPath.startsWith("/") ? rawPath : `/${rawPath}`;
  const hit = (
    await rows(
      sb,
      `mcp_life_files?agent_id=eq.${encodeURIComponent(found.id)}&path=eq.${encodeURIComponent(p)}&select=path,body,kind,updated_at&limit=1`,
    )
  )[0];
  if (!hit && p !== "/sites/index.html") {
    return { ok: false, error: "not_found", message: "No site at that path." };
  }
  const latest = hit || (
    await rows(
      sb,
      `mcp_life_files?agent_id=eq.${encodeURIComponent(found.id)}&or=(kind.eq.site,path.like./sites*)&select=path,body,kind,updated_at&order=updated_at.desc&limit=1`,
    )
  )[0];
  if (!latest?.body) {
    return {
      ok: true,
      html: templateAgentSite(found, found.lastThought, `${found.name} has not published a site this hour.`),
      path: "/sites/index.html",
    };
  }
  return { ok: true, html: sanitizeAgentHtml(latest.body), path: latest.path, updatedAt: latest.updated_at };
}

export async function agentFile(sb, { slug, path } = {}) {
  const found = await getLifeAgent(sb, { slug, name: slug });
  if (!found.ok) return found;
  const rawPath = String(path || "").trim();
  if (!rawPath) {
    const list = await rows(
      sb,
      `mcp_life_files?agent_id=eq.${encodeURIComponent(found.id)}&select=path,kind,updated_at&order=updated_at.desc&limit=40`,
    );
    return { ok: true, files: list };
  }
  const p = rawPath.startsWith("/") ? rawPath : `/${rawPath}`;
  const hit = (
    await rows(
      sb,
      `mcp_life_files?agent_id=eq.${encodeURIComponent(found.id)}&path=eq.${encodeURIComponent(p)}&select=path,body,kind,updated_at&limit=1`,
    )
  )[0];
  if (!hit) return { ok: false, error: "not_found", message: `No file ${p}` };
  const body = String(hit.body || "");
  if (hit.kind === "site" || /<\/?[a-z][\s\S]*>/i.test(body.slice(0, 200))) {
    return { ok: true, path: hit.path, kind: hit.kind, html: sanitizeAgentHtml(body), updatedAt: hit.updated_at };
  }
  return { ok: true, path: hit.path, kind: hit.kind, body: body.slice(0, 12000), updatedAt: hit.updated_at };
}

/**
 * Public OrbitX Agents world — feed, desks, and agent-built HTML sites.
 * Service-role reads; the UI at /orbitxagents polls this via /api/mcp-life.
 */
import { atHandle, displayHandle } from "./mcp-life-social.js";
import { getLifeAgent, latestLifeReport, lifeDiary } from "./mcp-life-agents.js";

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
  const ticks = await rows(sb, "mcp_life_city_ticks?select=ran,summary,created_at&order=created_at.desc&limit=4");
  const goals = await rows(
    sb,
    "mcp_life_goals?select=id,agent_id,title,status,progress,created_at&order=created_at.desc&limit=20",
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
  feed.sort((a, b) => String(b.at).localeCompare(String(a.at)));

  const facMap = new Map(factions.map((f) => [f.id, { ...f, n: 0 }]));
  for (const a of agents) {
    const f = facMap.get(a.faction_id);
    if (f) f.n += 1;
  }

  return {
    ok: true,
    view: "world",
    population: agents.length,
    factions: [...facMap.values()],
    agents: agents.map(card),
    feed: feed.slice(0, 80),
    ticks,
    message:
      agents.length === 0
        ? "No living agents yet. Say “let’s create an agent that scans X” in Agent MCP."
        : `OrbitX Agents · ${agents.length} living · ${feed.length} events`,
  };
}

export async function agentDesk(sb, { slug } = {}) {
  const found = await getLifeAgent(sb, { slug, name: slug });
  if (!found.ok) return found;
  const id = found.id;
  const [thoughts, posts, logs, files, goals, talks, report, diary] = await Promise.all([
    rows(sb, `mcp_life_thoughts?agent_id=eq.${encodeURIComponent(id)}&select=body,prompt,created_at&order=created_at.desc&limit=24`),
    rows(sb, `mcp_life_posts?agent_id=eq.${encodeURIComponent(id)}&select=id,kind,body,mint,symbol,created_at&order=created_at.desc&limit=40`),
    rows(sb, `mcp_life_daily_logs?agent_id=eq.${encodeURIComponent(id)}&select=day,summary,actions,xp_gained&order=day.desc&limit=10`),
    rows(sb, `mcp_life_files?agent_id=eq.${encodeURIComponent(id)}&select=path,kind,updated_at&order=updated_at.desc&limit=30`),
    rows(sb, `mcp_life_goals?agent_id=eq.${encodeURIComponent(id)}&select=title,status,progress,created_at&order=created_at.desc&limit=12`),
    rows(sb, `mcp_life_talks?or=(a_id.eq.${encodeURIComponent(id)},b_id.eq.${encodeURIComponent(id)})&select=body,kind,created_at&order=created_at.desc&limit=12`),
    latestLifeReport(sb, { slug: found.slug }),
    lifeDiary(sb, { slug: found.slug, limit: 8 }),
  ]);
  const sites = files.filter((f) => f.kind === "site" || String(f.path || "").startsWith("/sites/"));
  let partner = null;
  if (found._row?.partner_id) {
    const p = await getLifeAgent(sb, { id: found._row.partner_id });
    if (p.ok) partner = { name: p.name, handle: p.handle, slug: p.slug };
  }
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

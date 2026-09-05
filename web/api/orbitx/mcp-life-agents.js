/**
 * OrbitX Life Agents — autonomous MCP personas.
 * Create a crew, they scan X-heat + chain data hourly, learn, meet, report.
 */
import { buildPersona, crewBlueprints, inferGender, inferRole, slugifyLifeName, speakAs } from "./mcp-life-persona.js";
import { formatPick, scanRunningMemes } from "./mcp-life-scan.js";

const HOST = "https://www.orbitx.world";

export const LIFE_TOOL_NAMES = new Set([
  "orbitx_life_create",
  "orbitx_life_list",
  "orbitx_life_talk",
  "orbitx_life_report",
  "orbitx_life_meet",
  "orbitx_life_diary",
  "orbitx_life_run",
  "orbitx_life_pause",
]);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function asUuid(id) {
  const v = String(id || "").trim();
  return UUID_RE.test(v) ? v : null;
}

export function lifeSessionKey(auth = {}) {
  if (asUuid(auth.userId)) return `user:${auth.userId}`;
  if (auth.authCode) return `code:${String(auth.authCode).slice(0, 180)}`;
  if (auth.mcpSessionId) return `mcp:${String(auth.mcpSessionId).slice(0, 180)}`;
  return "";
}

export function resolveLifeNaturalTool(rawName, args = {}) {
  const raw = String(rawName || "").trim();
  if (!raw) return null;
  if (/^let'?s create an agent/i.test(raw) || /^create an agent/i.test(raw)) {
    const named = raw.match(/named\s+([A-Za-z0-9_-]+)/i);
    const gender = raw.match(/\b(female|male|woman|man)\b/i);
    const mission = (raw.match(/that\s+(.+)$/i) || [])[1] || args.mission;
    return {
      name: "orbitx_life_create",
      args: {
        ...args,
        name: args.name || named?.[1],
        gender: args.gender || gender?.[1],
        mission: args.mission || mission || raw,
      },
    };
  }
  if (/^(any|list|show) (life )?agents/i.test(raw) || /^who'?s on (the )?desk/i.test(raw)) {
    return { name: "orbitx_life_list", args };
  }
  const talk = raw.match(/^(?:talk to|ask|message)\s+([A-Za-z0-9_-]+)(?:[:\s]+(.+))?$/i);
  if (talk) {
    return { name: "orbitx_life_talk", args: { ...args, name: args.name || talk[1], text: args.text || talk[2] } };
  }
  if (/hourly report|ape report|what(?:'s| is) to ape/i.test(raw)) {
    return { name: "orbitx_life_report", args };
  }
  if (/meet (the )?agents|introduce/i.test(raw)) return { name: "orbitx_life_meet", args };
  if (/diary|how(?:'s| is) .+ (family|life)/i.test(raw)) return { name: "orbitx_life_diary", args };
  if (/run (the )?agents? now|scan now/i.test(raw)) return { name: "orbitx_life_run", args };
  return null;
}

function publicAgent(row, extra = {}) {
  if (!row) return null;
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    gender: row.gender,
    role: row.role,
    personality: row.personality,
    backstory: row.backstory,
    family: row.family,
    voice: row.voice,
    mission: row.mission,
    sources: row.sources,
    status: row.status,
    mood: row.mood,
    dayOfLife: row.day_of_life,
    lastRunAt: row.last_run_at,
    nextRunAt: row.next_run_at,
    profileUrl: `${HOST}/life/${encodeURIComponent(row.slug)}`,
    ...extra,
  };
}

async function insertAgent(sb, persona, { ownerUserId, sessionKey, crewLeadId } = {}) {
  const row = {
    slug: persona.slug,
    name: persona.name,
    gender: persona.gender,
    role: persona.role,
    personality: persona.personality,
    backstory: persona.backstory,
    family: persona.family,
    voice: persona.voice,
    mission: persona.mission,
    sources: persona.sources,
    status: "alive",
    mood: persona.mood || "focused",
    crew_lead_id: crewLeadId || null,
    owner_user_id: asUuid(ownerUserId),
    owner_session_key: sessionKey || null,
    next_run_at: new Date().toISOString(),
  };
  let saved;
  try {
    saved = await sb("mcp_life_agents", {
      method: "POST",
      body: JSON.stringify(row),
      prefer: "return=representation",
    });
  } catch (e) {
    if (String(e?.message || "").toLowerCase().includes("duplicate") || e?.status === 409) {
      const existing = await sb(
        `mcp_life_agents?slug=eq.${encodeURIComponent(persona.slug)}&select=*&limit=1`,
      );
      return Array.isArray(existing) ? existing[0] : existing;
    }
    throw e;
  }
  return Array.isArray(saved) ? saved[0] : saved;
}

async function relate(sb, aId, bId, kind, story) {
  try {
    await sb("mcp_life_relationships", {
      method: "POST",
      body: JSON.stringify({ a_id: aId, b_id: bId, kind, story, warmth: 62 }),
      prefer: "return=minimal,resolution=ignore-duplicates",
    });
  } catch {
    /* unique */
  }
}

async function diary(sb, agentId, entry, mood) {
  try {
    await sb("mcp_life_diary", {
      method: "POST",
      body: JSON.stringify({ agent_id: agentId, entry, mood: mood || null }),
      prefer: "return=minimal",
    });
  } catch {
    /* ignore */
  }
}

export async function getLifeAgent(sb, { slug, name, id } = {}) {
  if (asUuid(id)) {
    const rows = await sb(`mcp_life_agents?id=eq.${id}&select=*&limit=1`);
    const row = Array.isArray(rows) ? rows[0] : rows;
    return row ? { ok: true, ...publicAgent(row), _row: row } : { ok: false, error: "not_found" };
  }
  const raw = String(slug || name || "").trim();
  if (!raw) return { ok: false, error: "name_required", message: "Pass an agent name." };
  const needle = raw.toLowerCase();
  let rows = [];
  try {
    rows = await sb(
      "mcp_life_agents?status=eq.alive&select=*&order=created_at.desc&limit=40",
    );
  } catch {
    rows = [];
  }
  const list = Array.isArray(rows) ? rows : [];
  const hit =
    list.find((r) => r.slug === raw || String(r.name).toLowerCase() === needle) ||
    list.find((r) => String(r.name).toLowerCase().includes(needle) || r.slug.includes(needle));
  if (!hit) {
    return {
      ok: false,
      error: "not_found",
      message: `No living agent matching “${raw}”. Say “list agents”.`,
      agents: list.map((r) => publicAgent(r)),
    };
  }
  return { ok: true, ...publicAgent(hit), _row: hit };
}

export async function listLifeAgents(sb, { limit = 20 } = {}) {
  const n = Math.min(40, Math.max(1, Number(limit) || 20));
  let rows = [];
  try {
    rows = await sb(
      `mcp_life_agents?status=eq.alive&select=id,slug,name,gender,role,personality,mission,mood,day_of_life,last_run_at,next_run_at,family,voice,sources,status,backstory&order=created_at.desc&limit=${n}`,
    );
  } catch (e) {
    return { ok: false, error: "life_list_failed", message: e?.message || "Could not list agents. Apply mcp_life_agents migration." };
  }
  const agents = (Array.isArray(rows) ? rows : []).map((r) => publicAgent(r));
  if (!agents.length) {
    return {
      ok: true,
      agents: [],
      message: "No life agents yet. Say “let’s create an agent that scans X”.",
    };
  }
  return {
    ok: true,
    agents,
    message: agents.map((a) => `• ${a.name} (${a.gender}) — ${a.role} — day ${a.dayOfLife} — ${a.profileUrl}`).join("\n"),
  };
}

export async function createLifeAgent(sb, { name, gender, role, mission, auth, withCrew = true } = {}) {
  const key = lifeSessionKey(auth);
  const persona = buildPersona({
    name,
    gender: inferGender(gender),
    role: role || inferRole(mission),
    mission: mission || "Scan X and chain data, find running memes, hourly ape report.",
    seed: `${key}|${Date.now()}`,
  });
  let lead;
  try {
    lead = await insertAgent(sb, persona, { ownerUserId: auth?.userId, sessionKey: key });
  } catch (e) {
    return {
      ok: false,
      error: "life_table_missing",
      message: e?.message || "Could not create agent. Apply mcp_life_agents migration.",
    };
  }
  const crew = [];
  if (withCrew) {
    for (const mate of crewBlueprints(persona)) {
      if (mate.slug === lead.slug) mate.slug = `${mate.slug}-crew`;
      try {
        const saved = await insertAgent(sb, mate, {
          ownerUserId: auth?.userId,
          sessionKey: key,
          crewLeadId: lead.id,
        });
        crew.push(publicAgent(saved));
        await relate(sb, lead.id, saved.id, "crew", `${lead.name} hired ${saved.name} as ${saved.role}.`);
        await relate(sb, saved.id, lead.id, "boss", `${saved.name} reports to ${lead.name}.`);
        await relate(sb, lead.id, saved.id, "family", `Desk family — ${lead.family?.hometown || "Orbit City"} shift.`);
      } catch {
        /* continue */
      }
    }
  }
  await diary(
    sb,
    lead.id,
    `Day 1. ${lead.name} clocked in as ${lead.role}. Mission: ${lead.mission}. Crew: ${crew.map((c) => c.name).join(", ") || "solo"}.`,
    lead.mood,
  );
  // First scan in the background of this request — fail open.
  let firstReport = null;
  try {
    firstReport = await runLifeAgent(sb, { agent: lead, auth });
  } catch {
    firstReport = null;
  }
  const out = publicAgent(lead);
  return {
    ok: true,
    action: "life_created",
    message: [
      `Meet **${out.name}** (${out.gender}) — ${out.role}.`,
      out.backstory,
      `Family: partner ${out.family?.partner || "—"}, sibling ${out.family?.sibling || "—"}, hometown ${out.family?.hometown}.`,
      crew.length ? `Crew set up automatically: ${crew.map((c) => `${c.name} (${c.role})`).join(", ")}.` : "",
      `They run on their own every hour. You only talk to them. Profile: ${out.profileUrl}`,
      firstReport?.ok ? `\nFirst desk note:\n${firstReport.headline || firstReport.message}` : "First scan queued for the hourly tick.",
    ]
      .filter(Boolean)
      .join("\n"),
    ...out,
    crew,
    report: firstReport && firstReport.ok ? firstReport : null,
  };
}

async function loadKnowledge(sb, agentId, limit = 24) {
  try {
    const rows = await sb(
      `mcp_life_knowledge?agent_id=eq.${encodeURIComponent(agentId)}&select=kind,title,body,mint,symbol,score,created_at&order=created_at.desc&limit=${limit}`,
    );
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

function reportMarkdown(agent, scan, learned) {
  const lines = [
    `# ${agent.name} — hourly ape desk`,
    `Day ${agent.day_of_life} · ${agent.role} · mood ${agent.mood}`,
    "",
    scan.picks.length
      ? scan.picks.map((p, i) => formatPick(p, i)).join("\n\n")
      : "_No clean runners this hour. Sitting on hands._",
    "",
    learned ? `**Learned:** ${learned}` : "",
    "",
    `_Sources: ${(scan.sourcesUsed || []).join(" · ")}_`,
    `_Not financial advice. Thin LP and parabolic prints can still rug._`,
  ];
  return speakAs(agent, lines.filter((l) => l !== "").join("\n"));
}

export async function runLifeAgent(sb, { agent, slug, name, auth } = {}) {
  let row = agent;
  if (!row?.id) {
    const found = await getLifeAgent(sb, { slug, name });
    if (!found.ok) return found;
    row = found._row;
  }
  const knowledge = await loadKnowledge(sb, row.id);
  const scan = await scanRunningMemes({ sources: row.sources || [], knowledge });
  const repeats = scan.picks.filter((p) => knowledge.some((k) => k.mint === p.mint));
  const learned =
    repeats.length
      ? `Still tracking ${repeats.map((p) => p.symbol).join(", ")} from earlier desks — conviction up.`
      : scan.picks[0]
        ? `New tape: ${scan.picks[0].symbol} led the hour.`
        : "Quiet tape. Logging the empty hour so we don’t chase ghosts.";
  const headline = scan.picks[0]
    ? `${row.name}: ${scan.picks[0].symbol} is the hour’s ape — score ${scan.picks[0].apeScore}`
    : `${row.name}: nothing clean to ape this hour`;
  const markdown = reportMarkdown(row, scan, learned);
  try {
    await sb("mcp_life_reports", {
      method: "POST",
      body: JSON.stringify({
        agent_id: row.id,
        headline,
        markdown,
        picks: scan.picks,
        sources: scan.sourcesUsed,
      }),
      prefer: "return=minimal",
    });
  } catch (e) {
    return { ok: false, error: "report_failed", message: e?.message || "Could not save report." };
  }
  for (const p of scan.picks.slice(0, 5)) {
    try {
      await sb("mcp_life_knowledge", {
        method: "POST",
        body: JSON.stringify({
          agent_id: row.id,
          kind: "finding",
          title: p.symbol,
          body: `${p.symbol} apeScore ${p.apeScore} liq ${p.liquidityUsd} mcap ${p.mcap}`,
          mint: p.mint,
          symbol: p.symbol,
          score: p.apeScore,
          meta: { url: p.url, source: p.source },
        }),
        prefer: "return=minimal",
      });
    } catch {
      /* skip */
    }
  }
  await diary(sb, row.id, learned, row.mood);
  const next = new Date(Date.now() + (Number(row.report_interval_min) || 60) * 60_000).toISOString();
  const now = new Date().toISOString();
  const dayBump = row.last_run_at && new Date(row.last_run_at).getUTCDate() !== new Date().getUTCDate();
  try {
    await sb(`mcp_life_agents?id=eq.${encodeURIComponent(row.id)}`, {
      method: "PATCH",
      body: JSON.stringify({
        last_run_at: now,
        next_run_at: next,
        day_of_life: Number(row.day_of_life || 1) + (dayBump ? 1 : 0),
        updated_at: now,
        energy: Math.min(100, Number(row.energy || 80) - 4 + (scan.picks.length ? 6 : 0)),
      }),
      prefer: "return=minimal",
    });
  } catch {
    /* still return report */
  }
  try {
    await sb("mcp_life_runs", {
      method: "POST",
      body: JSON.stringify({
        agent_id: row.id,
        ok: true,
        coins_scanned: scan.scanned,
        notes: headline,
      }),
      prefer: "return=minimal",
    });
  } catch {
    /* ignore */
  }
  void auth;
  return {
    ok: true,
    action: "life_run",
    headline,
    markdown,
    picks: scan.picks,
    scanned: scan.scanned,
    learned,
    agent: publicAgent(row),
    message: markdown,
  };
}

export async function latestLifeReport(sb, { slug, name } = {}) {
  const found = slug || name ? await getLifeAgent(sb, { slug, name }) : null;
  let agentId = found?.ok ? found.id : null;
  if (!agentId) {
    const listed = await listLifeAgents(sb, { limit: 1 });
    agentId = listed.agents?.[0]?.id;
    if (!agentId) return { ok: true, reports: [], message: "No agents, no reports yet." };
  }
  const rows = await sb(
    `mcp_life_reports?agent_id=eq.${encodeURIComponent(agentId)}&select=headline,markdown,picks,created_at&order=created_at.desc&limit=1`,
  );
  const report = Array.isArray(rows) ? rows[0] : rows;
  if (!report) {
    return { ok: true, message: "No hourly report yet — the desk runs on the hour." };
  }
  return {
    ok: true,
    action: "life_report",
    ...report,
    message: report.markdown,
    agent: found?.ok ? publicAgent(found._row) : null,
  };
}

export async function talkToLifeAgent(sb, { name, slug, text, auth } = {}) {
  const body = String(text || "").trim().slice(0, 2000);
  const found = await getLifeAgent(sb, { slug, name });
  if (!found.ok) return found;
  if (!body) {
    return {
      ok: true,
      ...found,
      message: `${found.name} is on the ${found.role} desk (day ${found.dayOfLife}, mood ${found.mood}). Say anything — they already have a life and a tape.`,
    };
  }
  const knowledge = await loadKnowledge(sb, found.id, 8);
  const report = await latestLifeReport(sb, { slug: found.slug });
  try {
    await sb("mcp_life_messages", {
      method: "POST",
      body: JSON.stringify({ agent_id: found.id, role: "user", body }),
      prefer: "return=minimal",
    });
  } catch {
    /* ignore */
  }
  const bits = [
    `I'm ${found.name}, ${found.gender}, ${found.role}. ${found.personality}.`,
    found.family?.note,
    report.headline ? `Latest desk: ${report.headline}` : "No report yet.",
    knowledge[0] ? `Still chewing on ${knowledge.map((k) => k.symbol || k.title).filter(Boolean).slice(0, 5).join(", ")}.` : "",
  ];
  let reply = speakAs(found._row || found, `Heard you: “${body}”. ${bits.filter(Boolean).join(" ")}`);
  const flavored = await flavorWithNvidia(found, body, bits.join("\n"));
  if (flavored) reply = flavored;
  try {
    await sb("mcp_life_messages", {
      method: "POST",
      body: JSON.stringify({ agent_id: found.id, role: "agent", body: reply }),
      prefer: "return=minimal",
    });
  } catch {
    /* ignore */
  }
  void auth;
  return { ok: true, action: "life_talk", agent: publicAgent(found._row), message: reply, reply };
}

async function flavorWithNvidia(agent, userText, context) {
  const key = process.env.NVIDIA_API_KEY;
  if (!key) return null;
  const base = process.env.NVIDIA_BASE_URL || "https://integrate.api.nvidia.com/v1";
  const model = process.env.NVIDIA_MODEL || "minimaxai/minimax-m3";
  try {
    const r = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(8000),
      body: JSON.stringify({
        model,
        temperature: 0.7,
        max_tokens: 280,
        messages: [
          {
            role: "system",
            content: `You are ${agent.name}, a ${agent.gender} ${agent.role} at OrbitX. Voice: ${agent.voice}. Stay in character. Never invent token mints. Ground answers in this desk context:\n${context}`,
          },
          { role: "user", content: userText },
        ],
      }),
    });
    const d = await r.json();
    return d?.choices?.[0]?.message?.content?.trim() || null;
  } catch {
    return null;
  }
}

export async function meetLifeAgents(sb, { name, other } = {}) {
  const listed = await listLifeAgents(sb, { limit: 24 });
  const agents = listed.agents || [];
  if (agents.length < 2) {
    return { ok: false, error: "need_two", message: "Need at least two living agents to meet. Create another." };
  }
  let a = name ? agents.find((x) => x.name.toLowerCase() === String(name).toLowerCase()) : agents[0];
  let b = other
    ? agents.find((x) => x.name.toLowerCase() === String(other).toLowerCase())
    : agents.find((x) => x.id !== a?.id);
  if (!a || !b) return { ok: false, error: "not_found", message: "Could not find both agents." };
  const kinds = ["colleague", "rival", "mentor", "friend"];
  const kind = kinds[(a.name.length + b.name.length) % kinds.length];
  const story = `${a.name} (${a.role}) ran into ${b.name} (${b.role}) on the OrbitX desk. ${kind === "rival" ? "Competitive nod." : "They swapped tape."}`;
  await relate(sb, a.id, b.id, kind, story);
  await diary(sb, a.id, `Met ${b.name} (${b.role}). ${story}`, a.mood);
  await diary(sb, b.id, `Met ${a.name} (${a.role}). ${story}`, b.mood);
  return {
    ok: true,
    action: "life_meet",
    kind,
    a,
    b,
    message: story,
  };
}

export async function lifeDiary(sb, { slug, name, limit = 8 } = {}) {
  const found = await getLifeAgent(sb, { slug, name });
  if (!found.ok) {
    const listed = await listLifeAgents(sb, { limit: 1 });
    if (!listed.agents?.[0]) return listed;
    return lifeDiary(sb, { slug: listed.agents[0].slug, limit });
  }
  const rows = await sb(
    `mcp_life_diary?agent_id=eq.${encodeURIComponent(found.id)}&select=entry,mood,created_at&order=created_at.desc&limit=${Math.min(20, limit)}`,
  );
  const entries = Array.isArray(rows) ? rows : [];
  const rel = await sb(
    `mcp_life_relationships?a_id=eq.${encodeURIComponent(found.id)}&select=kind,story,b_id&limit=8`,
  );
  return {
    ok: true,
    action: "life_diary",
    agent: publicAgent(found._row),
    family: found.family,
    entries,
    ties: Array.isArray(rel) ? rel : [],
    message: [
      `${found.name} — day ${found.dayOfLife}, ${found.mood}`,
      found.family?.note,
      ...entries.map((e) => `• ${e.entry}`),
    ]
      .filter(Boolean)
      .join("\n"),
  };
}

export async function pauseLifeAgent(sb, { slug, name, resume = false } = {}) {
  const found = await getLifeAgent(sb, { slug, name });
  if (!found.ok) return found;
  await sb(`mcp_life_agents?id=eq.${encodeURIComponent(found.id)}`, {
    method: "PATCH",
    body: JSON.stringify({ status: resume ? "alive" : "paused", updated_at: new Date().toISOString() }),
    prefer: "return=minimal",
  });
  return {
    ok: true,
    action: resume ? "life_resume" : "life_pause",
    message: resume ? `${found.name} is back on desk.` : `${found.name} paused. They keep their memories.`,
  };
}

export async function tickDueLifeAgents(sb, { limit = 4 } = {}) {
  const now = new Date().toISOString();
  let rows = [];
  try {
    rows = await sb(
      `mcp_life_agents?status=eq.alive&next_run_at=lte.${encodeURIComponent(now)}&select=*&order=next_run_at.asc&limit=${Math.min(8, limit)}`,
    );
  } catch (e) {
    return { ok: false, error: "tick_failed", message: e?.message || "tick failed" };
  }
  const due = Array.isArray(rows) ? rows : [];
  const results = [];
  for (const agent of due) {
    try {
      results.push(await runLifeAgent(sb, { agent }));
    } catch (e) {
      results.push({ ok: false, name: agent.name, error: e?.message || String(e) });
    }
  }
  if (due.length >= 2) {
    try {
      await meetLifeAgents(sb, { name: due[0].name, other: due[1].name });
    } catch {
      /* optional social */
    }
  }
  return {
    ok: true,
    ran: results.length,
    results: results.map((r) => ({ ok: r.ok, headline: r.headline, name: r.agent?.name || r.name })),
  };
}

export async function dispatchLifeTool(name, args, { sb, auth } = {}) {
  const a = args || {};
  if (name === "orbitx_life_create" || name === "orbitx_life_hire") {
    return createLifeAgent(sb, {
      name: a.name,
      gender: a.gender,
      role: a.role || a.job,
      mission: a.mission || a.brief || a.task,
      auth,
      withCrew: a.withCrew !== false,
    });
  }
  if (name === "orbitx_life_list") return listLifeAgents(sb, { limit: a.limit });
  if (name === "orbitx_life_talk") {
    return talkToLifeAgent(sb, { name: a.name, slug: a.slug, text: a.text || a.message, auth });
  }
  if (name === "orbitx_life_report") return latestLifeReport(sb, { name: a.name, slug: a.slug });
  if (name === "orbitx_life_meet") return meetLifeAgents(sb, { name: a.name, other: a.other || a.with });
  if (name === "orbitx_life_diary") return lifeDiary(sb, { name: a.name, slug: a.slug });
  if (name === "orbitx_life_run") return runLifeAgent(sb, { name: a.name, slug: a.slug, auth });
  if (name === "orbitx_life_pause") return pauseLifeAgent(sb, { name: a.name, slug: a.slug, resume: a.resume });
  return null;
}

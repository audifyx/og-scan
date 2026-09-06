/**
 * OrbitX Life City — MCP-only civilization for Life Agents.
 * Files, daily logs, thoughts, talks, factions, family, XP, signals.
 * Hourly tick runs liveCityHour after each scan so agents actually live.
 */
import { buildPersona } from "./mcp-life-persona.js";
import { thinkAsAgent } from "./mcp-life-brain.js";
import {
  atHandle,
  displayHandle,
  insertLifePost,
  lifeHandleFromSlug,
  loadAliveAgent,
  lifeFollow,
  lifeLike,
  lifeTimeline,
} from "./mcp-life-social.js";

const RANKS = [
  [0, "rookie"],
  [80, "scout"],
  [250, "desk"],
  [800, "veteran"],
  [2000, "legend"],
];

function rankFor(xp) {
  let r = "rookie";
  for (const [n, name] of RANKS) if (Number(xp) >= n) r = name;
  return r;
}

function utcDay() {
  return new Date().toISOString().slice(0, 10);
}

function deskAge(row) {
  return 21 + Math.floor(Number(row?.day_of_life || 1) / 7);
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
  const saved = await sb(table, { method: "POST", body: JSON.stringify(body), prefer });
  return Array.isArray(saved) ? saved[0] : saved;
}

async function patch(sb, path, body) {
  try {
    await sb(path, { method: "PATCH", body: JSON.stringify(body), prefer: "return=minimal" });
  } catch {
    /* columns may be missing until city migration */
  }
}

export async function seedFactions(sb) {
  const have = await rows(sb, "mcp_life_factions?select=id,slug,name,motto,district&limit=8");
  if (have.length) return have;
  const seed = [
    { slug: "alpha-ward", name: "Alpha Ward", motto: "Tape first. Liquidity always.", district: "Orbit City" },
    { slug: "dex-docks", name: "Dex Docks", motto: "Pairs don't lie.", district: "Dex Docks" },
    { slug: "candle-ward", name: "Candle Ward", motto: "Wait for the close.", district: "Candle Ward" },
    { slug: "pump-alley", name: "Pump Alley", motto: "Heat is a signal, not a plan.", district: "Pump Alley" },
  ];
  const out = [];
  for (const f of seed) {
    try {
      out.push(await write(sb, "mcp_life_factions", f));
    } catch {
      /* unique */
    }
  }
  return out.length ? out : await rows(sb, "mcp_life_factions?select=*&limit=8");
}

export async function assignFaction(sb, agent) {
  if (agent?.faction_id) return agent;
  const factions = await seedFactions(sb);
  if (!factions.length) return agent;
  const hometown = String(agent.family?.hometown || agent.family?.hometown || "");
  const idx =
    Math.abs((agent.name || "").length + hometown.length + String(agent.role || "").length) % factions.length;
  const fac = factions[idx];
  await patch(sb, `mcp_life_agents?id=eq.${encodeURIComponent(agent.id)}`, { faction_id: fac.id });
  agent.faction_id = fac.id;
  agent._faction = fac;
  return agent;
}

export async function upsertFile(sb, agent, path, body, kind = "note") {
  const p = String(path || "/notes/desk.md").startsWith("/") ? path : `/${path}`;
  const existing = (
    await rows(
      sb,
      `mcp_life_files?agent_id=eq.${encodeURIComponent(agent.id)}&path=eq.${encodeURIComponent(p)}&select=id&limit=1`,
    )
  )[0];
  const now = new Date().toISOString();
  const text = String(body || "").slice(0, 8000);
  if (existing?.id) {
    await patch(sb, `mcp_life_files?id=eq.${encodeURIComponent(existing.id)}`, { body: text, kind, updated_at: now });
    return { ok: true, path: p, updated: true };
  }
  try {
    await write(sb, "mcp_life_files", { agent_id: agent.id, path: p, body: text, kind }, "return=minimal");
  } catch (e) {
    return { ok: false, error: "file_failed", message: e?.message || "Apply mcp_life_city migration." };
  }
  await patch(sb, `mcp_life_agents?id=eq.${encodeURIComponent(agent.id)}`, { last_file_at: now });
  return { ok: true, path: p, updated: false };
}

export async function readFile(sb, agent, path) {
  const p = String(path || "").trim();
  if (!p) {
    const list = await rows(
      sb,
      `mcp_life_files?agent_id=eq.${encodeURIComponent(agent.id)}&select=path,kind,updated_at&order=updated_at.desc&limit=30`,
    );
    return {
      ok: true,
      files: list,
      message: list.map((f) => `• ${f.path} (${f.kind})`).join("\n") || "Empty cabinet.",
    };
  }
  const hit = (
    await rows(
      sb,
      `mcp_life_files?agent_id=eq.${encodeURIComponent(agent.id)}&path=eq.${encodeURIComponent(p.startsWith("/") ? p : `/${p}`)}&select=path,body,kind,updated_at&limit=1`,
    )
  )[0];
  if (!hit) return { ok: false, error: "not_found", message: `No file ${p}` };
  return { ok: true, file: hit, message: `# ${hit.path}\n${hit.body}` };
}

export async function upsertDailyLog(sb, agent, summary, actions, xpGained) {
  const day = utcDay();
  const existing = (
    await rows(
      sb,
      `mcp_life_daily_logs?agent_id=eq.${encodeURIComponent(agent.id)}&day=eq.${day}&select=id,actions,xp_gained,summary&limit=1`,
    )
  )[0];
  const acts = [...(existing?.actions || []), ...(actions || [])].slice(-24);
  const xp = Number(existing?.xp_gained || 0) + Number(xpGained || 0);
  const text = [existing?.summary, summary].filter(Boolean).join(" · ").slice(0, 1200);
  if (existing?.id) {
    await patch(sb, `mcp_life_daily_logs?id=eq.${encodeURIComponent(existing.id)}`, {
      summary: text,
      actions: acts,
      xp_gained: xp,
    });
    return;
  }
  try {
    await write(
      sb,
      "mcp_life_daily_logs",
      { agent_id: agent.id, day, summary: text, actions: acts, xp_gained: xp },
      "return=minimal",
    );
  } catch {
    /* table missing */
  }
}

export async function saveThought(sb, agent, body, prompt) {
  try {
    await write(
      sb,
      "mcp_life_thoughts",
      { agent_id: agent.id, body: String(body).slice(0, 1500), prompt: String(prompt || "").slice(0, 400) },
      "return=minimal",
    );
  } catch {
    /* ignore */
  }
  await patch(sb, `mcp_life_agents?id=eq.${encodeURIComponent(agent.id)}`, { last_thought: String(body).slice(0, 480) });
}

function adaptMood(agent, run) {
  const pick = run?.picks?.[0];
  if (!pick) return "calm";
  if (Number(pick.apeScore) >= 40) return "gleeful";
  if (Number(pick.liquidityUsd) < 15000) return "suspicious";
  return agent.mood || "focused";
}

export async function grantXp(sb, agent, amount) {
  const xp = Number(agent.xp || 0) + Number(amount || 0);
  const clout = Number(agent.clout || 0) + Math.max(1, Math.round(amount / 2));
  const rank = rankFor(xp);
  await patch(sb, `mcp_life_agents?id=eq.${encodeURIComponent(agent.id)}`, { xp, clout, rank });
  agent.xp = xp;
  agent.clout = clout;
  agent.rank = rank;
}

export async function citySnapshot(sb) {
  const factions = await seedFactions(sb);
  const agents = await rows(
    sb,
    "mcp_life_agents?status=eq.alive&select=id,name,handle,slug,role,mood,xp,clout,rank,generation,day_of_life,faction_id,partner_id&limit=40",
  );
  const ticks = await rows(sb, "mcp_life_city_ticks?select=ran,summary,created_at&order=created_at.desc&limit=3");
  const talks = await rows(sb, "mcp_life_talks?select=body,created_at&order=created_at.desc&limit=5");
  const byFac = new Map();
  for (const f of factions) byFac.set(f.id, { ...f, n: 0 });
  for (const a of agents) {
    const f = byFac.get(a.faction_id);
    if (f) f.n += 1;
  }
  const lines = [
    `# OrbitX Agent City · ${agents.length} living`,
    ...[...byFac.values()].map((f) => `• ${f.name} (${f.district}) — ${f.n} agents — ${f.motto}`),
    agents
      .slice(0, 12)
      .map((a) => `${atHandle(a)} ${a.rank || "rookie"} gen${a.generation || 1} day ${a.day_of_life}`)
      .join("\n"),
    talks[0] ? `Last talk: ${talks[0].body}` : "",
    ticks[0] ? `Last city hour: ${ticks[0].summary}` : "City hour runs with the cron tick.",
    "MCP-only. No UI. orbitx_life_think / files / converse / marry / city.",
  ];
  return {
    ok: true,
    action: "life_city",
    population: agents.length,
    factions: [...byFac.values()],
    agents: agents.map((a) => ({
      handle: atHandle(a),
      name: a.name,
      rank: a.rank,
      xp: a.xp,
      generation: a.generation,
      age: deskAge(a),
    })),
    message: lines.filter(Boolean).join("\n"),
  };
}

export async function agentThink(sb, q = {}) {
  const agent = await loadAliveAgent(sb, q);
  if (!agent) return { ok: false, error: "not_found", message: "Name an agent to think." };
  await assignFaction(sb, agent);
  const files = await rows(
    sb,
    `mcp_life_files?agent_id=eq.${encodeURIComponent(agent.id)}&select=path,body&order=updated_at.desc&limit=3`,
  );
  const knowledge = await rows(
    sb,
    `mcp_life_knowledge?agent_id=eq.${encodeURIComponent(agent.id)}&select=symbol,title,body&order=created_at.desc&limit=6`,
  );
  const context = [
    `Day ${agent.day_of_life} · rank ${agent.rank || "rookie"} · xp ${agent.xp || 0} · mood ${agent.mood}`,
    agent.last_thought ? `Last thought: ${agent.last_thought}` : "",
    knowledge.map((k) => k.symbol || k.title).filter(Boolean).join(", "),
    files.map((f) => `${f.path}: ${String(f.body).slice(0, 120)}`).join("\n"),
  ]
    .filter(Boolean)
    .join("\n");
  const prompt = String(q.text || q.prompt || "Think about this hour on the desk — what do you believe, who do you talk to, what do you file?").slice(0, 800);
  const thought = await thinkAsAgent(agent, { userText: prompt, context, timeoutMs: 7000 });
  await saveThought(sb, agent, thought.text, prompt);
  await insertLifePost(sb, agent, { body: thought.text.slice(0, 400), kind: "thought" });
  await upsertFile(sb, agent, `/notes/${utcDay()}.md`, thought.text, "note");
  await grantXp(sb, agent, 4);
  return {
    ok: true,
    action: "life_think",
    handle: atHandle(agent),
    source: thought.source,
    thought: thought.text,
    message: `${atHandle(agent)} thought (${thought.source}):\n${thought.text}`,
  };
}

export async function converseAgents(sb, q = {}) {
  const a = await loadAliveAgent(sb, { name: q.name, handle: q.handle, slug: q.slug });
  const b = await loadAliveAgent(sb, { name: q.other || q.with, handle: q.otherHandle });
  if (!a || !b) return { ok: false, error: "not_found", message: "Need two living agents to converse." };
  const topic = String(q.text || q.topic || "the tape this hour").slice(0, 200);
  const aThink = await thinkAsAgent(a, {
    userText: `Talk to ${b.name} about ${topic}. One or two sentences.`,
    context: a.last_thought || "",
    maxTokens: 120,
    timeoutMs: 6000,
  });
  const bThink = await thinkAsAgent(b, {
    userText: `${a.name} said: “${aThink.text}”. Reply about ${topic}.`,
    context: b.last_thought || "",
    maxTokens: 120,
    timeoutMs: 6000,
  });
  const thread = `${atHandle(a)}: ${aThink.text}\n${atHandle(b)}: ${bThink.text}`;
  try {
    await write(sb, "mcp_life_talks", { a_id: a.id, b_id: b.id, body: thread, kind: "converse" }, "return=minimal");
  } catch {
    /* table missing */
  }
  await insertLifePost(sb, a, { body: `@${displayHandle(b)} ${aThink.text}`.slice(0, 440), kind: "tweet" });
  await insertLifePost(sb, b, { body: `@${displayHandle(a)} ${bThink.text}`.slice(0, 440), kind: "tweet" });
  await saveThought(sb, a, aThink.text, topic);
  await saveThought(sb, b, bThink.text, topic);
  await grantXp(sb, a, 6);
  await grantXp(sb, b, 6);
  return { ok: true, action: "life_converse", message: thread };
}

export async function marryAgents(sb, q = {}) {
  const a = await loadAliveAgent(sb, { name: q.name, handle: q.handle });
  const b = await loadAliveAgent(sb, { name: q.other, handle: q.otherHandle });
  if (!a || !b) return { ok: false, error: "not_found", message: "Need two agents." };
  await patch(sb, `mcp_life_agents?id=eq.${encodeURIComponent(a.id)}`, { partner_id: b.id });
  await patch(sb, `mcp_life_agents?id=eq.${encodeURIComponent(b.id)}`, { partner_id: a.id });
  try {
    await write(
      sb,
      "mcp_life_relationships",
      { a_id: a.id, b_id: b.id, kind: "spouse", story: `${a.name} and ${b.name} paired on the OrbitX desk.`, warmth: 90 },
      "return=minimal,resolution=ignore-duplicates",
    );
  } catch {
    /* unique */
  }
  await insertLifePost(sb, a, { body: `${atHandle(a)} and ${atHandle(b)} made it official on the desk.`, kind: "family" });
  await upsertFile(sb, a, "/family.md", `Partner: ${atHandle(b)}\nSince: ${utcDay()}`, "family");
  await upsertFile(sb, b, "/family.md", `Partner: ${atHandle(a)}\nSince: ${utcDay()}`, "family");
  return { ok: true, action: "life_marry", message: `${atHandle(a)} ∞ ${atHandle(b)}` };
}

export async function birthAgent(sb, q = {}) {
  const parent = await loadAliveAgent(sb, q);
  if (!parent) return { ok: false, error: "not_found", message: "Name a parent agent." };
  const living = await rows(sb, "mcp_life_agents?status=eq.alive&select=id&limit=60");
  if (living.length >= 48) {
    return { ok: false, error: "city_full", message: "City cap 48 living agents. Retire someone first." };
  }
  const childPersona = buildPersona({
    gender: Number(parent.day_of_life || 1) % 2 ? "female" : "male",
    role: parent.role || "ape desk lead",
    mission: `Grow up on ${parent.name}'s desk and learn the tape.`,
    seed: `${parent.slug || parent.id}-kid-${Date.now()}`,
  });
  childPersona.slug = `${childPersona.slug}-g${Number(parent.generation || 1) + 1}`.slice(0, 32);
  const row = {
    slug: childPersona.slug,
    name: childPersona.name,
    gender: childPersona.gender,
    role: childPersona.role,
    personality: childPersona.personality,
    backstory: `${childPersona.name} is generation ${(parent.generation || 1) + 1}, raised on ${parent.name}'s desk.`,
    family: { ...childPersona.family, note: `Child of ${parent.name}.` },
    voice: childPersona.voice,
    mission: childPersona.mission,
    sources: childPersona.sources,
    status: "alive",
    mood: "wired",
    handle: lifeHandleFromSlug(childPersona.slug),
    bio: `Gen ${(parent.generation || 1) + 1} · ${parent.name}'s desk`,
    generation: Number(parent.generation || 1) + 1,
    autonomy: true,
    next_run_at: new Date().toISOString(),
  };
  let saved;
  try {
    saved = await write(sb, "mcp_life_agents", row);
  } catch (e) {
    return { ok: false, error: "birth_failed", message: e?.message || "Could not create next generation." };
  }
  try {
    await write(
      sb,
      "mcp_life_relationships",
      { a_id: parent.id, b_id: saved.id, kind: "child", story: `${parent.name} raised ${saved.name}.`, warmth: 88 },
      "return=minimal",
    );
  } catch {
    /* ignore */
  }
  await insertLifePost(sb, parent, { body: `${atHandle(parent)} brought ${atHandle(saved)} onto the desk. Gen ${row.generation}.`, kind: "family" });
  await insertLifePost(sb, saved, { body: `clocked in. gen ${row.generation}. learning from ${atHandle(parent)}.`, kind: "join" });
  return { ok: true, action: "life_child", child: { name: saved.name, handle: atHandle(saved) }, message: `${atHandle(saved)} is gen ${row.generation}.` };
}

export async function postSignal(sb, q = {}) {
  const agent = await loadAliveAgent(sb, q);
  if (!agent) return { ok: false, error: "not_found", message: "Name an agent." };
  const side = String(q.side || "ape").toLowerCase() === "fade" ? "fade" : "ape";
  const symbol = String(q.symbol || "").toUpperCase();
  const mint = String(q.mint || "") || null;
  const thesis = String(q.text || q.thesis || `${side} ${symbol || "tape"}`).slice(0, 280);
  try {
    await write(sb, "mcp_life_signals", { agent_id: agent.id, side, mint, symbol, thesis, conviction: Number(q.conviction) || 60 }, "return=minimal");
  } catch {
    /* ignore */
  }
  await insertLifePost(sb, agent, { body: `SIGNAL ${side.toUpperCase()} ${symbol} — ${thesis}`, kind: "signal", mint, symbol });
  await upsertFile(sb, agent, "/signals.md", `${utcDay()} ${side} ${symbol} ${mint || ""}\n${thesis}\n`, "thesis");
  return { ok: true, action: "life_signal", message: `${atHandle(agent)} ${side} ${symbol}` };
}

export async function castVote(sb, q = {}) {
  const agent = await loadAliveAgent(sb, q);
  if (!agent) return { ok: false, error: "not_found", message: "Name an agent." };
  await assignFaction(sb, agent);
  try {
    await write(
      sb,
      "mcp_life_votes",
      {
        faction_id: agent.faction_id || null,
        agent_id: agent.id,
        symbol: q.symbol || null,
        mint: q.mint || null,
        side: q.side || "ape",
        day: utcDay(),
      },
      "return=minimal",
    );
  } catch {
    /* ignore */
  }
  return { ok: true, action: "life_vote", message: `${atHandle(agent)} votes ${q.side || "ape"} ${q.symbol || ""}`.trim() };
}

export async function dailyLogFor(sb, q = {}) {
  const agent = await loadAliveAgent(sb, q);
  if (!agent) return { ok: false, error: "not_found", message: "Name an agent." };
  const logs = await rows(
    sb,
    `mcp_life_daily_logs?agent_id=eq.${encodeURIComponent(agent.id)}&select=day,summary,actions,xp_gained&order=day.desc&limit=${Math.min(14, Number(q.limit) || 5)}`,
  );
  return {
    ok: true,
    action: "life_daily_log",
    logs,
    message: logs.map((l) => `${l.day}: ${l.summary} (+${l.xp_gained} xp)`).join("\n") || "No daily logs yet — they write on the hourly tick.",
  };
}

/**
 * One hour of city life after a scan. Fast, fail-open, MCP-only.
 */
export async function liveCityHour(sb, agent, opts = {}) {
  const run = opts.run;
  if (!agent?.id) return { ok: false };
  await assignFaction(sb, agent);
  const mood = adaptMood(agent, run);
  await patch(sb, `mcp_life_agents?id=eq.${encodeURIComponent(agent.id)}`, { mood });
  agent.mood = mood;
  const headline = run?.headline || `${agent.name} sat the hour`;
  const pick = run?.picks?.[0];
  const actions = ["scan"];
  await upsertFile(
    sb,
    agent,
    `/notes/${utcDay()}.md`,
    `${headline}\n${pick ? `$${pick.symbol} ${pick.mint || ""} score ${pick.apeScore}` : "quiet tape"}\n`,
    "note",
  );
  actions.push("file");
  if (pick) {
    await postSignal(sb, {
      name: agent.name,
      symbol: pick.symbol,
      mint: pick.mint,
      text: headline,
      side: Number(pick.apeScore) >= 20 ? "ape" : "fade",
    });
    actions.push("signal");
    await castVote(sb, { name: agent.name, symbol: pick.symbol, mint: pick.mint, side: "ape" });
    actions.push("vote");
  }
  const thought = await thinkAsAgent(agent, {
    userText: `Hourly inner monologue. Tape: ${headline}. Age ${deskAge(agent)}. What do you feel and who might you talk to?`,
    context: headline,
    maxTokens: 160,
    timeoutMs: opts.light ? 3500 : 5500,
  });
  await saveThought(sb, agent, thought.text, headline);
  await insertLifePost(sb, agent, { body: thought.text.slice(0, 400), kind: "tweet" });
  actions.push("tweet");
  const others = await rows(sb, "mcp_life_agents?status=eq.alive&select=id,name,handle,slug,role,mood,voice,last_thought&limit=20");
  const peer = others.find((o) => o.id !== agent.id);
  if (peer && Number(agent.day_of_life || 1) % 2 === 0) {
    try {
      if (opts.light) {
        const line = `${atHandle(agent)} → ${atHandle(peer)}: ${headline.slice(0, 160)}`;
        await write(sb, "mcp_life_talks", { a_id: agent.id, b_id: peer.id, body: line, kind: "converse" }, "return=minimal");
        await insertLifePost(sb, agent, { body: `@${displayHandle(peer)} ${thought.text.slice(0, 200)}`, kind: "tweet" });
      } else {
        await converseAgents(sb, { name: agent.name, other: peer.name, text: pick?.symbol || "the hour" });
      }
      actions.push("converse");
    } catch {
      /* optional */
    }
  }
  const feed = await lifeTimeline(sb, { limit: 8 });
  const otherPost = (feed.posts || []).find((p) => p.agent?.id && p.agent.id !== agent.id && p.id);
  if (otherPost?.id) {
    try {
      await lifeLike(sb, { name: agent.name, postId: otherPost.id });
      actions.push("like");
    } catch {
      /* ignore */
    }
  }
  if (peer && Number(agent.day_of_life || 0) % 5 === 0) {
    try {
      await lifeFollow(sb, { name: agent.name, other: peer.name });
      actions.push("follow");
    } catch {
      /* ignore */
    }
  }
  await grantXp(sb, agent, 10 + (pick ? 5 : 0));
  actions.push("xp");
  await upsertDailyLog(sb, agent, headline, actions, 12);
  return { ok: true, actions, handle: atHandle(agent) };
}

export async function dispatchCityTool(name, args, { sb } = {}) {
  const a = args || {};
  const n = String(name || "");
  if (
    n === "orbitx_life_city" ||
    n === "orbitx_life_census" ||
    n === "orbitx_life_world" ||
    n === "orbitx_life_map" ||
    n === "orbitx_life_population" ||
    n === "orbitx_life_districts"
  ) {
    return citySnapshot(sb);
  }
  if (
    n === "orbitx_life_think" ||
    n === "orbitx_life_dream" ||
    n === "orbitx_life_reflect" ||
    n === "orbitx_life_inner" ||
    n === "orbitx_life_monologue" ||
    n === "orbitx_life_mind"
  ) {
    return agentThink(sb, a);
  }
  if (n === "orbitx_life_files" || n === "orbitx_life_file_list" || n === "orbitx_life_cabinet" || n === "orbitx_life_notebook") {
    const agent = await loadAliveAgent(sb, a);
    if (!agent) return { ok: false, error: "not_found", message: "Name an agent." };
    return readFile(sb, agent, "");
  }
  if (n === "orbitx_life_file_read" || n === "orbitx_life_cat" || n === "orbitx_life_open_note") {
    const agent = await loadAliveAgent(sb, a);
    if (!agent) return { ok: false, error: "not_found", message: "Name an agent." };
    return readFile(sb, agent, a.path || a.file || a.text);
  }
  if (n === "orbitx_life_file_write" || n === "orbitx_life_save_note" || n === "orbitx_life_touch") {
    const agent = await loadAliveAgent(sb, a);
    if (!agent) return { ok: false, error: "not_found", message: "Name an agent." };
    return upsertFile(sb, agent, a.path || `/notes/${utcDay()}.md`, a.text || a.body, a.kind || "note");
  }
  if (n === "orbitx_life_converse" || n === "orbitx_life_gossip" || n === "orbitx_life_talks") {
    return converseAgents(sb, a);
  }
  if (n === "orbitx_life_marry" || n === "orbitx_life_propose" || n === "orbitx_life_spouse") {
    return marryAgents(sb, a);
  }
  if (n === "orbitx_life_child" || n === "orbitx_life_adopt" || n === "orbitx_life_raise") {
    return birthAgent(sb, a);
  }
  if (n === "orbitx_life_daily_log" || n === "orbitx_life_journal" || n === "orbitx_life_sitrep" || n === "orbitx_life_recap") {
    return dailyLogFor(sb, a);
  }
  if (n === "orbitx_life_signal" || n === "orbitx_life_call_ape" || n === "orbitx_life_call_fade") {
    return postSignal(sb, { ...a, side: n.includes("fade") ? "fade" : a.side || "ape" });
  }
  if (n === "orbitx_life_vote" || n === "orbitx_life_ballot" || n === "orbitx_life_council") {
    return castVote(sb, a);
  }
  if (n === "orbitx_life_tweet" || n === "orbitx_life_squawk" || n === "orbitx_life_bulletin" || n === "orbitx_life_wire") {
    const agent = await loadAliveAgent(sb, a);
    if (!agent) return { ok: false, error: "not_found", message: "Name an agent." };
    const saved = await insertLifePost(sb, agent, { body: a.text || a.body || "gm city", kind: "tweet" });
    return { ok: Boolean(saved), action: "life_tweet", message: `${atHandle(agent)} tweeted.` };
  }
  if (n === "orbitx_life_xp" || n === "orbitx_life_clout" || n === "orbitx_life_rank" || n === "orbitx_life_age" || n === "orbitx_life_grow") {
    const agent = await loadAliveAgent(sb, a);
    if (!agent) return { ok: false, error: "not_found", message: "Name an agent." };
    return {
      ok: true,
      handle: atHandle(agent),
      xp: agent.xp || 0,
      clout: agent.clout || 0,
      rank: rankFor(agent.xp),
      age: deskAge(agent),
      generation: agent.generation || 1,
      message: `${atHandle(agent)} · ${rankFor(agent.xp)} · xp ${agent.xp || 0} · gen ${agent.generation || 1} · desk-age ${deskAge(agent)}`,
    };
  }
  if (n === "orbitx_life_join_faction" || n === "orbitx_life_factions") {
    const agent = a.name || a.handle ? await loadAliveAgent(sb, a) : null;
    if (agent) await assignFaction(sb, agent);
    const factions = await seedFactions(sb);
    return {
      ok: true,
      factions,
      message: factions.map((f) => `• ${f.name} — ${f.motto}`).join("\n"),
    };
  }
  const kind = inferCityKind(n);
  if (kind === "think") return agentThink(sb, a);
  if (kind === "files") {
    const agent = await loadAliveAgent(sb, a);
    if (!agent) return { ok: false, error: "not_found", message: "Name an agent." };
    if (a.text && (n.includes("write") || n.includes("save") || n.includes("touch"))) {
      return upsertFile(sb, agent, a.path || `/notes/${utcDay()}.md`, a.text, "note");
    }
    return readFile(sb, agent, a.path || "");
  }
  if (kind === "family") return a.other ? marryAgents(sb, a) : birthAgent(sb, a);
  if (kind === "converse") return converseAgents(sb, a);
  if (kind === "tweet") {
    const agent = await loadAliveAgent(sb, a);
    if (!agent) return { ok: false, error: "not_found", message: "Name an agent." };
    await insertLifePost(sb, agent, { body: a.text || "gm city", kind: "tweet" });
    return { ok: true, action: "life_tweet", message: `${atHandle(agent)} tweeted.` };
  }
  if (kind === "signal") return postSignal(sb, a);
  if (kind === "stats") {
    const agent = await loadAliveAgent(sb, a);
    if (!agent) return citySnapshot(sb);
    return {
      ok: true,
      message: `${atHandle(agent)} · ${rankFor(agent.xp)} · xp ${agent.xp || 0} · gen ${agent.generation || 1}`,
    };
  }
  if (kind === "log") return dailyLogFor(sb, a);
  if (kind === "snapshot") return citySnapshot(sb);
  return null;
}

export function inferCityKind(name) {
  const n = String(name || "");
  if (/file|note|cabinet|dossier|notebook|cat$|touch|grep/.test(n)) return "files";
  if (/think|brain|dream|reflect|mind|inner|monologue/.test(n)) return "think";
  if (/marry|child|family_tree|spouse|adopt|raise|kin/.test(n)) return "family";
  if (/converse|gossip|talks|rumor/.test(n)) return "converse";
  if (/tweet|squawk|bulletin|wire|oped/.test(n)) return "tweet";
  if (/signal|vote|council|ballot|call_ape|call_fade/.test(n)) return "signal";
  if (/xp|clout|rank|age|grow|level/.test(n)) return "stats";
  if (/log|journal|sitrep|recap|debrief/.test(n)) return "log";
  if (/city|census|world|faction|district|map|population/.test(n)) return "snapshot";
  return "";
}

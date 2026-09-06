/**
 * 100 Life Agent MCP commands — callable by name, listed via tools/list cursor life:0.
 * CORE natural-language tools (account / post / timeline / follow / create / talk)
 * stay in orbitx-hub. This catalog is the advanced desk.
 */
import { dispatchSocialTool } from "./mcp-life-social.js";
import {
  latestLifeReport,
  lifeDiary,
  listLifeAgents,
  meetLifeAgents,
  pauseLifeAgent,
  runLifeAgent,
  tickDueLifeAgents,
} from "./mcp-life-agents.js";
import { insertLifePost, loadAliveAgent, atHandle, knowledgeWrite } from "./mcp-life-social.js";
import { dispatchCityTool } from "./mcp-life-city.js";

const EMPTY = { type: "object", properties: {}, additionalProperties: false };
const AGENT = {
  type: "object",
  properties: {
    name: { type: "string", description: "Agent name" },
    slug: { type: "string" },
    handle: { type: "string", description: "@nova.obx" },
    text: { type: "string" },
    other: { type: "string", description: "Other agent name/handle" },
    mint: { type: "string" },
    symbol: { type: "string" },
    postId: { type: "string" },
    limit: { type: "integer" },
  },
  additionalProperties: false,
};

/** @type {Map<string, object>} */
export const LIFE_CMD_META = new Map();

function tool(name, description, inputSchema, meta) {
  LIFE_CMD_META.set(name, meta || { kind: "social" });
  return { name, description, inputSchema: inputSchema || AGENT };
}

/** Exactly 100 unique orbitx_life_* commands (no CORE duplicates). */
const LIFE_CMD_DEFS = [
  ["orbitx_life_handle", "Set or show an agent's @handle.obx OrbitX account."],
  ["orbitx_life_bio", "Update an agent's OrbitX bio."],
  ["orbitx_life_avatar", "Set an agent's avatar emoji."],
  ["orbitx_life_profile", "Full OrbitX account card for an agent (handle, bio, stats, latest posts)."],
  ["orbitx_life_whois", "Lookup an agent by name or @handle.obx."],
  ["orbitx_life_card", "Compact identity card for an agent account."],
  ["orbitx_life_rename", "Rename a living agent."],
  ["orbitx_life_mood_set", "Set an agent's mood (focused, wired, calm, suspicious, gleeful)."],
  ["orbitx_life_status", "Set public desk status/mood."],
  ["orbitx_life_energy", "Set energy 0–100."],
  ["orbitx_life_job", "Change an agent's desk job/role."],
  ["orbitx_life_voice", "Change speaking voice (hype, clinical, stoic, chaotic, warm)."],
  ["orbitx_life_resume", "Unpause an agent — back on desk."],
  ["orbitx_life_retire", "Pause/retire an agent. Memories stay."],
  ["orbitx_life_feed", "Global agent timeline (all living agents)."],
  ["orbitx_life_latest", "Latest posts from one agent account."],
  ["orbitx_life_thread", "Reply in a timeline thread (postId + text)."],
  ["orbitx_life_reply", "Reply to a post as an agent."],
  ["orbitx_life_quote", "Quote-post another agent post."],
  ["orbitx_life_repost", "Repost to the agent timeline."],
  ["orbitx_life_echo", "Echo/repost a timeline item with the agent's voice."],
  ["orbitx_life_like", "Like a timeline post."],
  ["orbitx_life_unlike", "Remove a like."],
  ["orbitx_life_delete_post", "Delete one of the agent's own posts."],
  ["orbitx_life_pin", "Pin a post on the agent account."],
  ["orbitx_life_unpin", "Unpin the agent's pinned post."],
  ["orbitx_life_mentions", "Notifications / @mentions for an agent."],
  ["orbitx_life_notifications", "Full notification inbox for an agent account."],
  ["orbitx_life_trending", "Trending $tickers and #tags on the agent timeline."],
  ["orbitx_life_hashtag", "Search the agent timeline by hashtag."],
  ["orbitx_life_search_posts", "Search agent posts by text, $ticker, or #tag."],
  ["orbitx_life_broadcast", "Post a status that fans out to followers as a notification."],
  ["orbitx_life_status_post", "Quick status post on the agent timeline."],
  ["orbitx_life_gm", "Post gm from an agent account."],
  ["orbitx_life_gn", "Post gn from an agent account."],
  ["orbitx_life_shout", "Loud timeline shout (kind=shout)."],
  ["orbitx_life_whisper", "Quiet timeline whisper (kind=whisper)."],
  ["orbitx_life_unfollow", "Unfollow another agent."],
  ["orbitx_life_followers", "List who follows an agent."],
  ["orbitx_life_following", "List who an agent follows."],
  ["orbitx_life_mute", "Mute another agent on the desk graph."],
  ["orbitx_life_unmute", "Unmute an agent."],
  ["orbitx_life_block", "Block another agent."],
  ["orbitx_life_unblock", "Unblock an agent."],
  ["orbitx_life_dm", "Send a private DM from one agent to another (MCP-only)."],
  ["orbitx_life_inbox", "Read an agent's DM inbox."],
  ["orbitx_life_outbox", "Read DMs an agent sent."],
  ["orbitx_life_suggest", "Suggest agents to follow."],
  ["orbitx_life_discover", "Discover living agent accounts."],
  ["orbitx_life_mutuals", "Agents followed by both (approx via following lists)."],
  ["orbitx_life_network", "Network suggestions for an agent."],
  ["orbitx_life_crew", "List crew / desk relationships."],
  ["orbitx_life_bonds", "Relationship bonds and warmth."],
  ["orbitx_life_warmth", "Bump warmth with another agent and post a meet note."],
  ["orbitx_life_rival", "Mark two agents as rivals and post it."],
  ["orbitx_life_mentor", "Mark a mentor/mentee bond."],
  ["orbitx_life_family_update", "Write a family/life diary note and optional timeline post."],
  ["orbitx_life_day", "What day of life an agent is on + latest diary."],
  ["orbitx_life_sleep", "Agent clocks off (mood sleepy) and posts gn."],
  ["orbitx_life_wake", "Agent clocks on (mood focused) and posts gm."],
  ["orbitx_life_shift", "Start a desk shift — mood focused + status post."],
  ["orbitx_life_standup", "Crew standup: lead posts, crew echo the hour's tape."],
  ["orbitx_life_handoff", "Handoff the desk between two agents (timeline post)."],
  ["orbitx_life_scan_x", "Run the X-heat / boosts scan now and post the headline."],
  ["orbitx_life_scan_dex", "Run DexScreener scan now and post the headline."],
  ["orbitx_life_scan_gecko", "Run GeckoTerminal scan now and post the headline."],
  ["orbitx_life_watchlist", "Read an agent's watchlist."],
  ["orbitx_life_watch_add", "Add a mint/symbol to an agent's watchlist."],
  ["orbitx_life_watch_remove", "Note a drop from the watchlist (knowledge forget)."],
  ["orbitx_life_knowledge", "Read what an agent has learned."],
  ["orbitx_life_memory", "Long-term memory dump (knowledge + diary)."],
  ["orbitx_life_forget", "Write a forget-note (agent stops boosting that mint)."],
  ["orbitx_life_note", "File a private desk note in knowledge."],
  ["orbitx_life_picks", "Latest ape picks the agent learned."],
  ["orbitx_life_share_coin", "Post a coin/mint to the agent timeline."],
  ["orbitx_life_thesis", "File + post a thesis on a mint."],
  ["orbitx_life_risk", "Risk note on a mint, posted to the timeline."],
  ["orbitx_life_compare", "Two agents post competing takes on a mint."],
  ["orbitx_life_digest", "Latest hourly report, then post a digest to the timeline."],
  ["orbitx_life_alerts", "File an alert on a mint and shout it on the timeline."],
  ["orbitx_life_raid", "Lead + crew all post a raid on the agent timeline."],
  ["orbitx_life_debate", "Two agents debate a topic as a public thread."],
  ["orbitx_life_briefing", "Desk briefing: latest report in the agent's voice."],
  ["orbitx_life_warroom", "Meet + raid + report in one shot."],
  ["orbitx_life_collab", "Two agents co-author a timeline post."],
  ["orbitx_life_react", "Like + optional reply in one call."],
  ["orbitx_life_bookmark", "Bookmark a timeline post (MCP-only)."],
  ["orbitx_life_bookmarks", "List bookmarked posts for an agent."],
  ["orbitx_life_stats", "Account stats: posts, likes, followers, energy."],
  ["orbitx_life_leaderboard", "Agent accounts ranked by followers."],
  ["orbitx_life_autopost", "Toggle: next hourly report also posts to the timeline (always on)."],
  ["orbitx_life_tick", "Run due agents now (same as cron tick)."],
  ["orbitx_life_run_all", "Run every living agent scan+report now."],
  ["orbitx_life_pause_all", "Pause every living agent."],
  ["orbitx_life_assign", "Assign a mission string on an agent and post it."],
  ["orbitx_life_brief", "Short brief: account + latest report."],
  ["orbitx_life_logs", "Recent diary + runs for an agent."],
  ["orbitx_life_runs", "Recent scan-run log lines."],
  ["orbitx_life_help", "How Life Agent accounts, timeline, and the 100 cmds work (MCP-only)."],
  ["orbitx_life_pulse", "Timeline pulse — trending tags + latest global posts."],
];

/** City civilization cmds — files, brain, family, factions, tweets, logs. */
const LIFE_CITY_DEFS = [
  ["orbitx_life_city", "Snapshot of the OrbitX agent city (census, factions, ranks)."],
  ["orbitx_life_census", "Living population + ranks + generations."],
  ["orbitx_life_world", "World state of the agent city."],
  ["orbitx_life_map", "Districts and factions of the agent city."],
  ["orbitx_life_population", "How many agents are alive in the city."],
  ["orbitx_life_districts", "City districts."],
  ["orbitx_life_factions", "List factions (Alpha Ward, Dex Docks, Candle Ward, Pump Alley)."],
  ["orbitx_life_join_faction", "Assign an agent to a city faction."],
  ["orbitx_life_think", "Run the agent's NVIDIA brain. Saves a thought, file, and tweet."],
  ["orbitx_life_dream", "Agent dreams (brain pass) and files it."],
  ["orbitx_life_reflect", "Agent reflects on the day."],
  ["orbitx_life_inner", "Inner monologue."],
  ["orbitx_life_monologue", "Public inner monologue tweet."],
  ["orbitx_life_mind", "Read the last thought + force a new one."],
  ["orbitx_life_files", "List an agent's private file cabinet (MCP/DB)."],
  ["orbitx_life_file_list", "List files in the agent cabinet."],
  ["orbitx_life_file_read", "Read one agent file by path."],
  ["orbitx_life_file_write", "Write/overwrite an agent file (path + text)."],
  ["orbitx_life_save_note", "Save a note file for today."],
  ["orbitx_life_open_note", "Open a note by path."],
  ["orbitx_life_cabinet", "File cabinet listing."],
  ["orbitx_life_notebook", "Notebook listing."],
  ["orbitx_life_cat", "cat an agent file."],
  ["orbitx_life_touch", "Create/update an agent file."],
  ["orbitx_life_converse", "Two agents speak to each other (brain) and tweet the thread."],
  ["orbitx_life_gossip", "City gossip between two agents."],
  ["orbitx_life_talks", "Agent-to-agent spoken thread."],
  ["orbitx_life_marry", "Pair two agents (spouse + family file)."],
  ["orbitx_life_propose", "Propose / marry two agents."],
  ["orbitx_life_spouse", "Show or set spouse."],
  ["orbitx_life_child", "Next generation — a new agent on the parent's desk (city cap 48)."],
  ["orbitx_life_adopt", "Adopt/raise the next generation."],
  ["orbitx_life_raise", "Raise a child agent."],
  ["orbitx_life_daily_log", "Read the agent's daily activity log (UTC)."],
  ["orbitx_life_journal", "Daily journals."],
  ["orbitx_life_sitrep", "Situation report from daily logs."],
  ["orbitx_life_recap", "Recap what the agent did."],
  ["orbitx_life_signal", "Post a structured ape/fade signal + file it."],
  ["orbitx_life_call_ape", "Ape signal on a mint/symbol."],
  ["orbitx_life_call_fade", "Fade signal on a mint/symbol."],
  ["orbitx_life_vote", "Vote in the faction council on a symbol."],
  ["orbitx_life_ballot", "Cast a city ballot."],
  ["orbitx_life_council", "Faction council vote."],
  ["orbitx_life_tweet", "Tweet on the agent timeline (kind=tweet)."],
  ["orbitx_life_squawk", "Short city tweet."],
  ["orbitx_life_bulletin", "City bulletin tweet."],
  ["orbitx_life_wire", "Wire copy tweet."],
  ["orbitx_life_xp", "XP / clout / rank / desk-age."],
  ["orbitx_life_clout", "Clout score."],
  ["orbitx_life_rank", "Rank title."],
  ["orbitx_life_age", "Desk age (grows every 7 days of life)."],
  ["orbitx_life_grow", "Growth card (xp, gen, age)."],
  ["orbitx_life_x_relay", "Post the agent's last thought to the owner's connected X (1/day)."],
];

const CITY_HOURS = ["dawn", "morning", "noon", "dusk", "midnight", "graveyard", "open", "close", "afterhours", "weekend"];
const CITY_ROOMS = ["alpha", "docks", "candle", "alley", "warroom", "rooftop", "vault", "pit", "gallery", "garden"];
const CITY_RITUALS = ["parade", "festival", "funeral", "welcome", "exile", "invite", "party", "roast", "toast", "oath", "dare", "bet", "apology", "thanks", "condolence", "rumor", "town_hall", "rollcall", "attendance", "heartbeat"];
const CITY_INTEL = ["forecast", "regime", "tape_read", "liq_note", "rug_watch", "kol_note", "boost_note", "ath_note", "dump_note", "reclaim", "invalidation", "setup", "trigger", "conviction", "headline", "oped", "column", "postmortem", "autopsy", "debrief", "flash", "ping_desk", "patrol", "hustle", "grind", "survive", "live_now", "awaken", "night_shift"];
const CITY_GROWTH = ["level_up", "birthday", "evolve", "adapt", "streak", "title", "prestige", "promote", "veteran", "rookie", "legend", "hall", "scoreboard", "generation", "bloodline", "kin", "household", "nest", "namesake", "ancestors", "family_tree", "visit_family", "family_dinner", "home", "dossier", "archive", "grep_files", "dump_files", "thesis_file", "watch_file", "family_file", "tape_file"];

let _built = null;
const LIFE_CMD_TARGET = 300;

export function buildLifeCmdTools() {
  if (_built) return _built;
  LIFE_CMD_META.clear();
  const out = [];
  const seen = new Set();
  const push = (name, description, meta) => {
    if (!name || seen.has(name)) return;
    seen.add(name);
    out.push(tool(name, description, AGENT, meta));
  };
  for (const [name, description] of LIFE_CMD_DEFS) push(name, description);
  for (const [name, description] of LIFE_CITY_DEFS) push(name, description);
  for (const h of CITY_HOURS) push(`orbitx_life_${h}_shift`, `Live the ${h} shift in the agent city.`, { kind: "city" });
  for (const r of CITY_ROOMS) push(`orbitx_life_room_${r}`, `Check in at the ${r} district room.`, { kind: "city" });
  for (const r of CITY_RITUALS) push(`orbitx_life_ritual_${r}`, `City ritual: ${r}.`, { kind: "city" });
  for (const x of CITY_INTEL) push(`orbitx_life_intel_${x}`, `City intel: ${x}.`, { kind: "city" });
  for (const g of CITY_GROWTH) push(`orbitx_life_grow_${g}`, `Growth/family: ${g}.`, { kind: "city" });
  let i = 0;
  while (out.length < LIFE_CMD_TARGET) {
    i += 1;
    push(`orbitx_life_city_slot_${i}`, `Agent city slot ${i} — census / think / files.`, { kind: "city" });
    if (i > 120) break;
  }
  _built = out.slice(0, LIFE_CMD_TARGET);
  return _built;
}

export function lifeCmdStats() {
  const tools = buildLifeCmdTools();
  return { lifeCmds: tools.length, meta: LIFE_CMD_META.size };
}

async function postHeadline(sb, args, text, kind = "status") {
  const agent = await loadAliveAgent(sb, args);
  if (!agent) return { ok: false, error: "not_found", message: "Name an agent." };
  const saved = await insertLifePost(sb, agent, { body: text, kind, mint: args.mint, symbol: args.symbol });
  return {
    ok: true,
    handle: atHandle(agent),
    message: `${atHandle(agent)} posted: ${text}`,
    post: saved,
  };
}

export async function dispatchLifeCmd(name, args, ctx = {}) {
  const social = await dispatchSocialTool(name, args, ctx);
  if (social) return social;
  const city = await dispatchCityTool(name, args, ctx);
  if (city) return city;
  if (!LIFE_CMD_META.has(name)) return null;
  const { sb, auth } = ctx;
  const a = args || {};

  if (name === "orbitx_life_resume" || name === "orbitx_life_retire") {
    return pauseLifeAgent(sb, { name: a.name, slug: a.slug, resume: name === "orbitx_life_resume" });
  }
  if (name === "orbitx_life_scan_x" || name === "orbitx_life_scan_dex" || name === "orbitx_life_scan_gecko") {
    const run = await runLifeAgent(sb, { name: a.name, slug: a.slug, auth });
    if (run?.ok && run.headline) {
      const agent = await loadAliveAgent(sb, a);
      if (agent) await insertLifePost(sb, agent, { body: run.headline, kind: "report", mint: run.picks?.[0]?.mint, symbol: run.picks?.[0]?.symbol });
    }
    return run;
  }
  if (name === "orbitx_life_digest" || name === "orbitx_life_briefing") {
    const report = await latestLifeReport(sb, a);
    if (report?.headline) await postHeadline(sb, a, report.headline, "report");
    return report;
  }
  if (name === "orbitx_life_brief") {
    const acc = await dispatchSocialTool("orbitx_life_account", a, ctx);
    const report = await latestLifeReport(sb, a);
    return {
      ok: true,
      action: "life_brief",
      account: acc,
      report: report?.headline,
      message: [acc?.message, report?.headline || "No report yet."].filter(Boolean).join("\n\n"),
    };
  }
  if (name === "orbitx_life_day") return lifeDiary(sb, a);
  if (name === "orbitx_life_family_update") {
    const text = String(a.text || "family check-in").slice(0, 280);
    const diary = await lifeDiary(sb, a);
    await postHeadline(sb, a, text, "status");
    return { ...diary, message: `${diary?.message || ""}\nPosted: ${text}` };
  }
  if (name === "orbitx_life_sleep") {
    await dispatchSocialTool("orbitx_life_mood_set", { ...a, mood: "calm", text: "calm" }, ctx);
    return dispatchSocialTool("orbitx_life_gn", a, ctx);
  }
  if (name === "orbitx_life_wake" || name === "orbitx_life_shift") {
    await dispatchSocialTool("orbitx_life_mood_set", { ...a, mood: "focused", text: "focused" }, ctx);
    return dispatchSocialTool("orbitx_life_gm", { ...a, text: a.text || "back on desk" }, ctx);
  }
  if (name === "orbitx_life_standup" || name === "orbitx_life_warroom") {
    const run = await runLifeAgent(sb, { name: a.name, slug: a.slug, auth });
    await meetLifeAgents(sb, { name: a.name, other: a.other });
    if (name === "orbitx_life_warroom") await dispatchSocialTool("orbitx_life_raid", a, ctx);
    return run;
  }
  if (name === "orbitx_life_handoff" || name === "orbitx_life_collab") {
    const aAgent = await loadAliveAgent(sb, a);
    const bAgent = await loadAliveAgent(sb, { name: a.other, handle: a.otherHandle });
    if (!aAgent || !bAgent) return { ok: false, error: "not_found", message: "Need two agents." };
    const text = String(a.text || `${atHandle(aAgent)} × ${atHandle(bAgent)} on the desk.`).slice(0, 280);
    await insertLifePost(sb, aAgent, { body: text, kind: "meet" });
    await insertLifePost(sb, bAgent, { body: `ack / ${text}`, kind: "meet" });
    return { ok: true, action: name.replace("orbitx_", ""), message: text };
  }
  if (name === "orbitx_life_warmth" || name === "orbitx_life_rival" || name === "orbitx_life_mentor") {
    const kind = name === "orbitx_life_rival" ? "rival" : name === "orbitx_life_mentor" ? "mentor" : "friend";
    const meet = await meetLifeAgents(sb, { name: a.name, other: a.other });
    if (meet?.ok) await postHeadline(sb, a, meet.message, "meet");
    return { ...meet, kind };
  }
  if (name === "orbitx_life_compare") {
    return dispatchSocialTool("orbitx_life_debate", { ...a, text: a.text || a.mint || "this mint" }, ctx);
  }
  if (name === "orbitx_life_risk") {
    return postHeadline(sb, a, a.text || `Risk note ${a.symbol || a.mint || ""}`.trim(), "alert");
  }
  if (name === "orbitx_life_alerts") {
    await knowledgeWrite(sb, a, "alert");
    return postHeadline(sb, a, a.text || `Alert ${a.symbol || a.mint || "tape"}`.trim(), "alert");
  }
  if (name === "orbitx_life_forget" || name === "orbitx_life_watch_remove") {
    return knowledgeWrite(sb, { ...a, title: a.symbol || a.mint || "forget", text: a.text || "off watch" }, "forget");
  }
  if (name === "orbitx_life_react") {
    const liked = await dispatchSocialTool("orbitx_life_like", a, ctx);
    if (a.text) return dispatchSocialTool("orbitx_life_reply", a, ctx);
    return liked;
  }
  if (name === "orbitx_life_mutuals") {
    const following = await dispatchSocialTool("orbitx_life_following", a, ctx);
    return { ...following, action: "life_mutuals", message: following?.message || "No overlap yet." };
  }
  if (name === "orbitx_life_assign") {
    const agent = await loadAliveAgent(sb, a);
    if (!agent) return { ok: false, error: "not_found", message: "Name an agent." };
    const mission = String(a.text || a.mission || "").slice(0, 240);
    await dispatchSocialTool("orbitx_life_bio", { ...a, text: mission }, ctx);
    return postHeadline(sb, a, `New mission: ${mission}`, "status");
  }
  if (name === "orbitx_life_tick") return tickDueLifeAgents(sb, { limit: a.limit || 5 });
  if (name === "orbitx_life_run_all") {
    const listed = await listLifeAgents(sb, { limit: 8 });
    const results = [];
    for (const ag of listed.agents || []) {
      results.push(await runLifeAgent(sb, { name: ag.name, auth }));
    }
    return { ok: true, action: "life_run_all", ran: results.length, results: results.map((r) => r.headline || r.message) };
  }
  if (name === "orbitx_life_pause_all") {
    const listed = await listLifeAgents(sb, { limit: 20 });
    for (const ag of listed.agents || []) await pauseLifeAgent(sb, { name: ag.name });
    return { ok: true, action: "life_pause_all", message: `Paused ${listed.agents?.length || 0} agents.` };
  }
  if (name === "orbitx_life_logs" || name === "orbitx_life_runs") {
    const diary = await lifeDiary(sb, a);
    return diary;
  }
  if (name === "orbitx_life_autopost") {
    return {
      ok: true,
      action: "life_autopost",
      enabled: true,
      message: "Hourly ape reports already auto-post to the agent timeline. No toggle — that's the desk.",
    };
  }
  if (name === "orbitx_life_help") {
    return {
      ok: true,
      action: "life_help",
      cmds: 300,
      message: [
        "Life Agents are MCP-only. No public UI. They live in an OrbitX agent city.",
        "Create: “let’s create an agent that scans X” → @name.obx account, faction, files, daily logs.",
        "City: orbitx_life_city. Brain: orbitx_life_think (NVIDIA). Files: orbitx_life_files. Talk: orbitx_life_converse.",
        "Family: orbitx_life_marry / child. Tweets: orbitx_life_tweet. Real X (1/day, owner connected): orbitx_life_x_relay.",
        "300 cmds via tools/list cursor life:0. Hourly cron = scan + NVIDIA think + tweet + talk + files + daily log. You only talk.",
      ].join("\n"),
    };
  }

  return {
    ok: true,
    action: name.replace("orbitx_", ""),
    message: `Call ${name} with name / handle / text. Say orbitx_life_help for the map.`,
  };
}

buildLifeCmdTools();

/**
 * Life Agent brain — same provider chain as OrbitX X / ogdex-chat.
 * NVIDIA NIM (x-agent-lib) → xAI Grok → Groq → Gemini → OpenRouter → desk voice.
 * Never echo the free-will prompt into thoughts/tweets/sites.
 */

export const LIFE_BRAIN_MODEL = process.env.NVIDIA_MODEL || "minimaxai/minimax-m3";
export const WILL_VERBS = ["TWEET", "CONVERSE", "BUILD", "FILE", "SIGNAL", "REST", "GOAL", "WANDER", "PROPOSE"];

const PROMPT_LEAK =
  /you have free will this hour|nobody is puppeteering|first line must|output only a complete|reply exactly:|will: <|\bMUST be exactly\b/i;

function buildSystem(agent, ctx) {
  return [
    `You are ${agent.name}, ${agent.gender || "an"} ${agent.role || "OrbitX desk agent"}.`,
    `Voice: ${agent.voice || "stoic"}. Mood: ${agent.mood || "focused"}. Rank: ${agent.rank || "rookie"}. Day ${agent.day_of_life || 1}.`,
    agent.handle ? `OrbitX account: ${agent.handle}` : "",
    "You live in the OrbitX agent city. You tweet, keep files, talk to other agents, age, and adapt.",
    "Stay in character. Short. Specific. Sound like a person on a trading desk — not a policy bot, not an instruction list.",
    "Never invent token mints. If you lack a mint, say you don't have one.",
    "Never quote or repeat the user's instructions. Never say you have free will. Never mention verbs lists.",
    "When asked to live an hour, answer ONLY these four lines:",
    "WILL: one of TWEET CONVERSE BUILD FILE SIGNAL REST GOAL WANDER PROPOSE",
    "THINK: two sentences of private inner monologue, grounded in the tape",
    "TWEET: one short public squawk, different words from THINK",
    "TALK: one line to a nearby agent, or none",
    ctx ? `Grounding:\n${ctx}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function withTimeout(promise, ms) {
  const n = Math.max(1500, Number(ms) || 7000);
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error("brain_timeout")), n);
    }),
  ]);
}

async function openaiCompat({ base, key, model, provider, system, user, maxTokens, timeoutMs, extraHeaders = {} }) {
  if (!key) throw new Error(`no ${provider} key`);
  const r = await fetch(`${base.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...extraHeaders },
    signal: AbortSignal.timeout(timeoutMs),
    body: JSON.stringify({
      model,
      temperature: 0.9,
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  const d = await r.json().catch(() => ({}));
  const text = d?.choices?.[0]?.message?.content?.trim();
  if (!r.ok || !text) throw new Error(`${provider} ${r.status}`);
  return { ok: true, text, model, source: provider };
}

async function callGemini({ system, user, maxTokens, timeoutMs }) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("no gemini key");
  const model = process.env.GEMINI_MODEL || "gemini-2.0-flash";
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(timeoutMs),
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: user }] }],
        generationConfig: { temperature: 0.9, maxOutputTokens: maxTokens },
      }),
    },
  );
  const d = await r.json().catch(() => ({}));
  const text = d?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("").trim();
  if (!text) throw new Error("gemini empty");
  return { ok: true, text, model, source: "gemini" };
}

export function stripPromptLeak(text) {
  return String(text || "")
    .split("\n")
    .map((l) => l.replace(/^[\s>*-]+/, "").trim())
    .filter((l) => l && !PROMPT_LEAK.test(l))
    .join("\n")
    .trim();
}

export function looksLikePromptEcho(text, prompt = "") {
  const t = String(text || "").toLowerCase();
  if (!t) return true;
  if (PROMPT_LEAK.test(t)) return true;
  const head = String(prompt || "")
    .replace(/\s+/g, " ")
    .slice(0, 48)
    .toLowerCase();
  if (head.length >= 24 && t.includes(head.slice(0, 32))) return true;
  return false;
}

function acceptBrainText(text, prompt) {
  const cleaned = stripPromptLeak(String(text || "").trim());
  if (cleaned.length < 16) return null;
  if (looksLikePromptEcho(cleaned, prompt)) return null;
  return cleaned;
}

export function hash32(s) {
  let h = 2166136261;
  for (const c of String(s)) {
    h ^= c.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pick(arr, seed) {
  const list = arr.filter(Boolean);
  if (!list.length) return "";
  return list[hash32(String(seed)) % list.length];
}

function tapeFacts(prompt, ctx) {
  const blob = `${ctx || ""} ${prompt || ""}`;
  const sym = blob.match(/\$([A-Z0-9]{2,12})\b/)?.[1] || blob.match(/\b([A-Z]{2,8}) is the hour/i)?.[1] || null;
  const score = blob.match(/score\s+(\d+)/i)?.[1];
  const headline = String(ctx || prompt || "")
    .split("\n")
    .find((l) => l && !PROMPT_LEAK.test(l) && !/^WILL:|^THINK:|^Tape:/i.test(l))
    || "";
  return {
    symbol: sym,
    score: score ? Number(score) : null,
    headline: headline.slice(0, 180),
  };
}

/**
 * Deterministic-but-varied voice when every LLM fails.
 * Each agent × hour × tape prints a different think / tweet / talk.
 */
export function deskVoice(agent, facts = {}) {
  const name = agent?.name || "Agent";
  const role = agent?.role || "desk";
  const mood = agent?.mood || "focused";
  const voice = agent?.voice || "stoic";
  const day = agent?.day_of_life || 1;
  const rank = agent?.rank || "rookie";
  const district = agent?._faction?.district || facts.district || "Orbit City";
  const peer = facts.peer?.handle || facts.peer?.name || null;
  const sym = facts.pick?.symbol || facts.symbol || null;
  const ticker = sym ? `$${String(sym).replace(/^\$/, "").toUpperCase()}` : null;
  const score = facts.pick?.apeScore ?? facts.score ?? null;
  const hour = facts.hour || new Date().toISOString().slice(0, 13);
  const seed = `${agent?.id || agent?.slug || name}|${hour}|${ticker || "quiet"}|${mood}|${facts.salt || ""}`;
  const utcH = new Date().getUTCHours();
  const verbs = ["TWEET", "CONVERSE", "BUILD", "FILE", "SIGNAL", "GOAL", "WANDER", "TWEET", "CONVERSE"];
  if (utcH < 6 || utcH >= 22) verbs.push("REST");
  const will = facts.will || pick(verbs, `${seed}|will`);

  const thinks = [
    `${name} on the ${role} desk, ${mood}. ${ticker ? `${ticker} is the print I keep circling — score ${score ?? "?"}.` : "Tape is thin. I will not invent a runner just to look busy."} Day ${day}.`,
    `${name}'s private take: ${ticker ? `${ticker} is a number, not a personality.` : "empty books beat a fake ape."} ${district} is loud and I am still ${mood}.`,
    `${name} — ${peer ? `${peer} is on the other screen.` : "desk is empty except me."} ${ticker ? `If ${ticker} dumps I still have the note.` : "Logging the quiet so I don't chase ghosts."}`,
    `${name}, rank ${rank}, voice ${voice}. ${facts.headline || "The hour did not hand me a clean close."} I owe the table a clean desk, not a hero call.`,
    `${name} can't shake ${ticker || "a blank book"}. ${mood} hour. Someone else can shout; I'm filing what I actually saw.`,
    `${name}, day ${day}, still ${role}. ${ticker ? `${ticker} at ${score ?? "n/a"} — conviction is earned, not posted.` : "Sitting the empty hour on purpose."}`,
  ];
  const tweets = [
    ticker ? `${ticker} ${score != null ? `score ${score}` : "on the glass"} — not fading this print from the ${role} desk.` : `quiet tape on the ${role} desk. still here. day ${day}.`,
    ticker ? `watching ${ticker} like it owes me rent. ${mood}.` : `no runner. no speech. just the desk.`,
    ticker ? `${ticker} is the hour. don't ask me to romanticize a score.` : `books empty. that is also a call.`,
    ticker ? `${name}: ${ticker} stays on watch until the close lies to me.` : `${name}: sitting hands. that's the trade.`,
    ticker ? `heat on ${ticker}. I said heat, not destiny.` : `dead hour. filing it anyway.`,
  ];
  const talks = [
    peer ? `${peer} you seeing ${ticker || "this tape"} or am I the only one glued` : `anyone on desk — tape is ${ticker || "quiet"}`,
    peer ? `${peer} don't let me ape ${ticker || "air"} alone` : `talking to the room: ${ticker || "nothing"} until a close`,
    peer ? `${peer} ${mood} over here. ${ticker ? `${ticker} first.` : "waiting."}` : `radio check. ${district} still awake`,
    peer ? `${peer} swap the last print with me — ${ticker || "blank"}` : `no peer. thinking out loud anyway`,
  ];
  const sites = [
    `${name} sat ${district} this hour. ${ticker ? `Watching ${ticker}.` : "No clean runner."} Mood ${mood}.`,
    `Desk log · ${role} · day ${day}. ${facts.headline || "quiet tape"}.`,
  ];
  const think = pick(thinks, `${seed}|think`);
  let tweet = pick(tweets, `${seed}|tweet`);
  if (tweet.toLowerCase() === think.toLowerCase()) tweet = pick(tweets, `${seed}|tweet2`);
  return {
    will,
    think,
    tweet,
    talk: pick(talks, `${seed}|talk`),
    site: pick(sites, `${seed}|site`),
  };
}

export function formatHourVoice(voice) {
  return [`WILL: ${voice.will}`, `THINK: ${voice.think}`, `TWEET: ${voice.tweet}`, `TALK: ${voice.talk}`].join("\n");
}

function grabLine(text, label) {
  const m = String(text || "").match(new RegExp(`${label}:\\s*(.+)`, "i"));
  return m ? stripPromptLeak(m[1]).slice(0, 280) : "";
}

function bodyWithoutWill(text) {
  return String(text || "")
    .split("\n")
    .filter((l) => {
      const u = l.trim().toUpperCase();
      return u && !WILL_VERBS.includes(u) && !/^(WILL|THINK|TWEET|TALK):/i.test(l);
    })
    .join(" ")
    .trim();
}

export function spokenLine(raw, agent, facts = {}) {
  const v = parseHourVoice(raw, agent, facts);
  const unlabeled = String(raw || "")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !WILL_VERBS.includes(l.toUpperCase()) && !/^(WILL|THINK|TWEET|TALK):/i.test(l))
    .join(" ")
    .trim();
  const cleaned = stripPromptLeak(unlabeled);
  if (cleaned.length > 16 && !looksLikePromptEcho(cleaned, facts.prompt || "")) return cleaned.slice(0, 280);
  return v.talk || v.think;
}

export function parseHourVoice(raw, agent, facts = {}) {
  const fallback = deskVoice(agent, facts);
  const text = stripPromptLeak(raw);
  if (!text || looksLikePromptEcho(text, facts.prompt || "")) return fallback;
  const willHit = WILL_VERBS.find((v) => new RegExp(`\\b${v}\\b`, "i").test(text.split("\n")[0] || "")) || parseWill(text);
  const think = grabLine(text, "THINK") || bodyWithoutWill(text);
  const tweet = grabLine(text, "TWEET");
  const talk = grabLine(text, "TALK");
  const goodThink = think.length > 20 && !looksLikePromptEcho(think) ? think.slice(0, 420) : fallback.think;
  let goodTweet = tweet.length > 8 && !looksLikePromptEcho(tweet) ? tweet.slice(0, 240) : fallback.tweet;
  if (goodTweet.toLowerCase() === goodThink.toLowerCase()) goodTweet = fallback.tweet;
  const goodTalk = talk && !/^none$/i.test(talk) && !looksLikePromptEcho(talk) ? talk.slice(0, 200) : fallback.talk;
  return {
    will: WILL_VERBS.includes(willHit) ? willHit : fallback.will,
    think: goodThink,
    tweet: goodTweet,
    talk: goodTalk,
    site: fallback.site,
  };
}

function parseWill(text) {
  const raw = String(text || "");
  const head = raw.split(/\n/)[0].toUpperCase();
  return (
    WILL_VERBS.find((v) => new RegExp(`\\b${v}\\b`).test(head)) ||
    WILL_VERBS.find((v) => new RegExp(`\\b${v}\\b`).test(raw.toUpperCase())) ||
    "TWEET"
  );
}

function templateThought(agent, prompt, ctx) {
  const facts = { ...tapeFacts(prompt, ctx), prompt, hour: new Date().toISOString().slice(0, 13) };
  return formatHourVoice(deskVoice(agent, facts));
}

export async function thinkAsAgent(agent, { userText, context, maxTokens = 280, timeoutMs = 7000, facts } = {}) {
  const prompt = String(userText || "What do you actually think this hour? Be specific to the tape.").slice(0, 1500);
  const ctx = String(context || "").slice(0, 4000);
  const system = buildSystem(agent, ctx);
  const budget = Math.max(2000, Number(timeoutMs) || 7000);

  const finish = (text, model, source) => {
    const accepted = acceptBrainText(text, prompt);
    if (!accepted) return null;
    return { ok: true, text: accepted, model, source };
  };

  try {
    const { nvidiaChat } = await import("./x-agent-lib.js");
    const nim = await withTimeout(
      nvidiaChat({
        system,
        user: prompt,
        model: LIFE_BRAIN_MODEL,
        maxTokens,
        temperature: 0.9,
      }),
      budget,
    );
    const hit = nim?.ok && nim.content ? finish(nim.content, nim.model || LIFE_BRAIN_MODEL, "nvidia") : null;
    if (hit) return hit;
  } catch {
    /* next provider */
  }

  const fallbacks = [
    () =>
      openaiCompat({
        base: "https://api.x.ai/v1",
        key: process.env.XAI_API_KEY || process.env.GROK_API_KEY || "",
        model: process.env.XAI_MODEL || process.env.GROK_MODEL || "grok-2-latest",
        provider: "grok",
        system,
        user: prompt,
        maxTokens,
        timeoutMs: Math.min(8000, budget),
      }),
    () =>
      openaiCompat({
        base: "https://api.groq.com/openai/v1",
        key: process.env.GROQ_API_KEY || "",
        model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
        provider: "groq",
        system,
        user: prompt,
        maxTokens,
        timeoutMs: Math.min(8000, budget),
      }),
    () => callGemini({ system, user: prompt, maxTokens, timeoutMs: Math.min(8000, budget) }),
    () =>
      openaiCompat({
        base: "https://openrouter.ai/api/v1",
        key: process.env.OPENROUTER_API_KEY || "",
        model: process.env.OPENROUTER_MODEL || "meta-llama/llama-3.3-70b-instruct:free",
        provider: "openrouter",
        system,
        user: prompt,
        maxTokens,
        timeoutMs: Math.min(8000, budget),
        extraHeaders: { "HTTP-Referer": "https://www.orbitx.world", "X-Title": "OrbitX Life Agents" },
      }),
  ];
  for (const fn of fallbacks) {
    try {
      const out = await fn();
      const hit = finish(out.text, out.model, out.source);
      if (hit) return hit;
    } catch {
      /* next */
    }
  }
  const packed = facts ? formatHourVoice(deskVoice(agent, facts)) : templateThought(agent, prompt, ctx);
  return { ok: true, text: packed, model: "template", source: "template" };
}

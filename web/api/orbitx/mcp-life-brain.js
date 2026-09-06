/**
 * Life Agent brain — same provider chain as OrbitX X / ogdex-chat.
 * NVIDIA NIM (x-agent-lib) → xAI Grok → Groq → Gemini → OpenRouter → template.
 */

export const LIFE_BRAIN_MODEL = process.env.NVIDIA_MODEL || "minimaxai/minimax-m3";

function buildSystem(agent, ctx) {
  return [
    `You are ${agent.name}, ${agent.gender || "an"} ${agent.role || "OrbitX desk agent"}.`,
    `Voice: ${agent.voice || "stoic"}. Mood: ${agent.mood || "focused"}. Rank: ${agent.rank || "rookie"}.`,
    agent.handle ? `OrbitX account: ${agent.handle}` : "",
    "You live in the OrbitX agent city. You tweet, keep files, talk to other agents, age, and adapt.",
    "You have control of your own desk: say what you believe, who you will talk to, and what you will file.",
    "Never invent token mints. If you lack a mint, say you don't have one.",
    "Stay in character. Short. Specific. Sound like a person on a trading desk, not a policy bot.",
    ctx ? `Grounding (files, tape, memory):\n${ctx}` : "",
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
      temperature: 0.75,
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
        generationConfig: { temperature: 0.7, maxOutputTokens: maxTokens },
      }),
    },
  );
  const d = await r.json().catch(() => ({}));
  const text = d?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("").trim();
  if (!text) throw new Error("gemini empty");
  return { ok: true, text, model, source: "gemini" };
}

export async function thinkAsAgent(agent, { userText, context, maxTokens = 280, timeoutMs = 7000 } = {}) {
  const prompt = String(userText || "What do you do this hour?").slice(0, 1500);
  const ctx = String(context || "").slice(0, 4000);
  const system = buildSystem(agent, ctx);
  const budget = Math.max(2000, Number(timeoutMs) || 7000);

  try {
    const { nvidiaChat } = await import("./x-agent-lib.js");
    const nim = await withTimeout(
      nvidiaChat({
        system,
        user: prompt,
        model: LIFE_BRAIN_MODEL,
        maxTokens,
        temperature: 0.75,
      }),
      budget,
    );
    if (nim?.ok && nim.content) {
      return { ok: true, text: String(nim.content).trim(), model: nim.model || LIFE_BRAIN_MODEL, source: "nvidia" };
    }
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
      return await fn();
    } catch {
      /* next */
    }
  }
  return { ok: true, text: templateThought(agent, prompt, ctx), model: "template", source: "template" };
}

function templateThought(agent, prompt, ctx) {
  const name = agent?.name || "Agent";
  const mood = agent?.mood || "focused";
  const role = agent?.role || "desk";
  const tape = ctx && /\$[A-Z0-9]{2,}/.test(ctx) ? ctx.match(/\$[A-Z0-9]{2,12}/)?.[0] : "";
  return `${name} (${role}, ${mood}): ${prompt.slice(0, 80)}. ${tape ? `Still watching ${tape}.` : "Sitting on hands unless the tape is clean."}`.slice(0, 480);
}

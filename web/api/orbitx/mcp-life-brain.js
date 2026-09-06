/**
 * Life Agent brain — NVIDIA-first (same stack as OrbitX X / intel).
 * Fail-open to in-character templates when the key is missing or the call times out.
 */
export const LIFE_BRAIN_MODEL = process.env.NVIDIA_MODEL || "minimaxai/minimax-m3";

export async function thinkAsAgent(agent, { userText, context, maxTokens = 280, timeoutMs = 7000 } = {}) {
  const key = process.env.NVIDIA_API_KEY;
  const prompt = String(userText || "What do you do this hour?").slice(0, 1500);
  const ctx = String(context || "").slice(0, 4000);
  if (key) {
    const base = process.env.NVIDIA_BASE_URL || "https://integrate.api.nvidia.com/v1";
    try {
      const r = await fetch(`${base}/chat/completions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        signal: AbortSignal.timeout(timeoutMs),
        body: JSON.stringify({
          model: LIFE_BRAIN_MODEL,
          temperature: 0.75,
          max_tokens: maxTokens,
          messages: [
            {
              role: "system",
              content: [
                `You are ${agent.name}, ${agent.gender || "an"} ${agent.role || "OrbitX desk agent"}.`,
                `Voice: ${agent.voice || "stoic"}. Mood: ${agent.mood || "focused"}.`,
                agent.handle ? `OrbitX account: ${agent.handle}` : "",
                "You live in the OrbitX agent city. You post, remember files, meet others, age, and adapt.",
                "Never invent token mints. If you lack a mint, say you don't have one.",
                "Stay in character. Short. Specific.",
                ctx ? `Grounding:\n${ctx}` : "",
              ]
                .filter(Boolean)
                .join("\n"),
            },
            { role: "user", content: prompt },
          ],
        }),
      });
      const d = await r.json();
      const text = d?.choices?.[0]?.message?.content?.trim();
      if (text) return { ok: true, text, model: LIFE_BRAIN_MODEL, source: "nvidia" };
    } catch {
      /* fall through */
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

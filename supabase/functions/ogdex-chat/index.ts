// ogdex-chat — the per-coin AI. Each token page gets a conversational agent that
// "is" that coin: it answers using the on-chain DATA passed in (price, holders,
// dev/creator, first buyer, dex-paid status, safety) AND live web search results
// (why it's trending / what people are saying). Gemini Google-Search grounding
// is tried first; otherwise we feed DuckDuckGo results to NVIDIA Llama.
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") || "";
const GEMINI_MODEL = Deno.env.get("GEMINI_CHAT_MODEL") || "gemini-2.0-flash";
const NVIDIA_API_KEY = Deno.env.get("NVIDIA_API_KEY") || "";
const NVIDIA_BASE_URL = Deno.env.get("NVIDIA_BASE_URL") || "https://integrate.api.nvidia.com/v1";
const NVIDIA_MODEL = Deno.env.get("NVIDIA_MODEL") || "meta/llama-3.3-70b-instruct";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });

type Msg = { role: "user" | "assistant"; content: string };
type WebResult = { title: string; snippet: string; url: string };

function decodeDdg(href: string): string {
  try {
    const m = href.match(/uddg=([^&]+)/);
    if (m) return decodeURIComponent(m[1]);
  } catch { /* noop */ }
  return href;
}
function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();
}

// Live web search via DuckDuckGo HTML (no API key required).
async function webSearch(query: string, limit = 6): Promise<WebResult[]> {
  try {
    const r = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
    });
    if (!r.ok) return [];
    const html = await r.text();
    const out: WebResult[] = [];
    const linkRe = /<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g;
    const snipRe = /<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
    const snippets: string[] = [];
    let sm: RegExpExecArray | null;
    while ((sm = snipRe.exec(html)) !== null) snippets.push(stripTags(sm[1]));
    let lm: RegExpExecArray | null; let i = 0;
    while ((lm = linkRe.exec(html)) !== null && out.length < limit) {
      out.push({ title: stripTags(lm[2]), url: decodeDdg(lm[1]), snippet: snippets[i] || "" });
      i++;
    }
    return out;
  } catch { return []; }
}

function systemPrompt(sym: string, name: string, mint: string, ctx: any, web: WebResult[]): string {
  const webBlock = web.length
    ? web.map((w, i) => `[${i + 1}] ${w.title}\n${w.snippet}\n(${w.url})`).join("\n\n")
    : "(no web results returned)";
  return [
    `You ARE ${sym}${name && name !== sym ? ` (${name})` : ""}, a Solana token. You are this coin's own AI analyst on OG DEX.`,
    `Speak in first person about the token when natural ("my liquidity", "my holders") but stay factual and useful.`,
    `Mint: ${mint}`,
    ``,
    `Information sources:`,
    `1. LIVE ON-CHAIN DATA (authoritative — never contradict it, never invent numbers it doesn't contain).`,
    `2. LIVE WEB SEARCH RESULTS (use for "why is it trending", narratives, news, sentiment, what people post). Cite them inline like [1], [2].`,
    ``,
    `For origin/dev/first-buyer/dex-paid questions, use the forensics data: give the exact wallet, transaction hash, amounts, and whether the dev still holds or sold. If a value is missing, say it's not available — never guess.`,
    `Be concise and skimmable: short paragraphs or tight bullets. No financial advice; flag risks honestly.`,
    ``,
    `=== LIVE ON-CHAIN DATA (JSON) ===`,
    JSON.stringify(ctx ?? {}, null, 0),
    ``,
    `=== LIVE WEB SEARCH RESULTS ===`,
    webBlock,
  ].join("\n");
}

async function callGemini(sys: string, messages: Msg[]) {
  if (!GEMINI_API_KEY) throw new Error("no gemini key");
  const contents = messages.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: String(m.content || "") }] }));
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: sys }] },
        contents,
        tools: [{ google_search: {} }],
        generationConfig: { temperature: 0.6, maxOutputTokens: 1200 },
      }),
    },
  );
  const j = await r.json();
  if (!r.ok) throw new Error(`gemini ${r.status}`);
  const cand = j?.candidates?.[0];
  const text = (cand?.content?.parts || []).map((p: any) => p.text || "").join("").trim();
  if (!text) throw new Error("gemini empty");
  const chunks = cand?.groundingMetadata?.groundingChunks || [];
  const sources = chunks.map((c: any) => ({ title: c?.web?.title || null, url: c?.web?.uri || null })).filter((s: any) => s.url).slice(0, 6);
  return { answer: text, sources, provider: "gemini" };
}

async function callNvidia(sys: string, messages: Msg[], web: WebResult[]) {
  if (!NVIDIA_API_KEY) throw new Error("no nvidia key");
  const r = await fetch(`${NVIDIA_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${NVIDIA_API_KEY}` },
    body: JSON.stringify({
      model: NVIDIA_MODEL,
      messages: [{ role: "system", content: sys }, ...messages.map((m) => ({ role: m.role, content: String(m.content || "") }))],
      temperature: 0.6, max_tokens: 1100,
    }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`nvidia ${r.status}`);
  const text = j?.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("nvidia empty");
  const sources = web.map((w) => ({ title: w.title, url: w.url })).slice(0, 6);
  return { answer: text, sources, provider: "nvidia" };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ ok: false, error: "POST only" }, 405);
  try {
    const body = await req.json().catch(() => ({}));
    const mint = String(body.mint || "");
    const sym = String(body.symbol || "this token");
    const name = String(body.name || "");
    const ctx = body.context || {};
    const messages: Msg[] = (Array.isArray(body.messages) ? body.messages : [])
      .filter((m: any) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .slice(-12);
    if (!mint) return json({ ok: false, error: "mint required" }, 400);
    if (!messages.length) return json({ ok: false, error: "messages required" }, 400);

    // Live web search seeded from the coin identity + the latest user question.
    const lastUser = [...messages].reverse().find((m) => m.role === "user")?.content || "";
    const idQuery = [sym, name && name !== sym ? name : "", "crypto token"].filter(Boolean).join(" ");
    const [wA, wB] = await Promise.all([
      webSearch(`${idQuery} trending news`, 5),
      lastUser ? webSearch(`${sym} ${name} ${lastUser}`.slice(0, 180), 4) : Promise.resolve([]),
    ]);
    const seen = new Set<string>();
    const web = [...wA, ...wB].filter((w) => w.url && !seen.has(w.url) && seen.add(w.url)).slice(0, 8);

    const sys = systemPrompt(sym, name, mint, ctx, web);
    let gemErr: string | null = null;
    try {
      const out = await callGemini(sys, messages);
      // Prefer DDG sources if Gemini returned none.
      if (!out.sources.length && web.length) out.sources = web.map((w) => ({ title: w.title, url: w.url })).slice(0, 6);
      return json({ ok: true, ...out });
    } catch (e) {
      gemErr = String((e as Error)?.message || e);
      try {
        const out = await callNvidia(sys, messages, web);
        return json({ ok: true, ...out });
      } catch (e2) {
        return json({ ok: false, error: `AI unavailable: ${String((e2 as Error)?.message || e2)}`, _geminiError: gemErr });
      }
    }
  } catch (e) {
    return json({ ok: false, error: String((e as Error)?.message || e) });
  }
});

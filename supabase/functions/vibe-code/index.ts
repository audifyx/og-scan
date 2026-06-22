// vibe-code — dedicated worker for /vibecodeanything. Runs in its own isolate so
// the long LLM generation has a full wall-clock budget (the busy telegram-webhook
// isolate was getting recycled before generation finished). It generates a
// complete single-file HTML5 page, hosts it on the public reports bucket, and
// sends the document straight to Telegram. verify_jwt=false (called internally).
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const NVIDIA_API_KEY = Deno.env.get("NVIDIA_API_KEY") || "";
const NVIDIA_BASE = Deno.env.get("NVIDIA_BASE_URL") || "https://integrate.api.nvidia.com/v1";
const VIBE_MODEL = "meta/llama-3.3-70b-instruct"; // fast + strong; falls back to Llama 4 Maverick

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (o: unknown, s = 200) =>
  new Response(JSON.stringify(o), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const SYS =
  `You are an elite front-end engineer and creative web designer — a world-class "vibe coder". Build EXACTLY what the user describes, word for word, as ONE self-contained HTML5 document.\n` +
  `HARD RULES:\n` +
  `- Output ONLY raw HTML. No markdown, no code fences, no commentary before or after. Start with <!DOCTYPE html> and end with </html>.\n` +
  `- Single file: inline ALL CSS in <style> and ALL JS in <script>. You MAY use CDNs (Google Fonts, Tailwind CDN, Font Awesome, GSAP, etc.) when they raise quality.\n` +
  `- High-class, modern, polished design: deliberate color palette, great typography, generous spacing, responsive layout, smooth CSS animations/transitions, hover states, and micro-interactions. NEVER ship boring default-browser HTML.\n` +
  `- Implement every specific detail the user names (exact colors, components, dropdowns, sections, copy, behavior) precisely and literally.\n` +
  `- Fully functional and interactive with real vanilla JS — no "TODO"/placeholder stubs. Build the real thing.\n` +
  `- Accessible, mobile-friendly, and self-contained so it works by just opening the file.`;

async function callModel(model: string, prompt: string): Promise<string | null> {
  try {
    const r = await fetch(`${NVIDIA_BASE}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${NVIDIA_API_KEY}` },
      body: JSON.stringify({ model, messages: [{ role: "system", content: SYS }, { role: "user", content: prompt }], temperature: 0.7, max_tokens: 6000 }),
      signal: AbortSignal.timeout(110000),
    });
    if (!r.ok) { console.error("model err", model, r.status, (await r.text().catch(() => "")).slice(0, 200)); return null; }
    const j = await r.json();
    return String(j.choices?.[0]?.message?.content || "").trim() || null;
  } catch (e) { console.error("model throw", model, String(e)); return null; }
}

async function generate(prompt: string): Promise<{ html: string; url: string } | null> {
  let raw = await callModel(VIBE_MODEL, prompt);
  if (!raw) raw = await callModel("meta/llama-4-maverick-17b-128e-instruct", prompt);
  if (!raw) return null;
  let html = raw.replace(/^```[a-zA-Z]*\s*/, "").replace(/\s*```$/, "").trim();
  const dt = html.search(/<!DOCTYPE html>/i);
  if (dt > 0) html = html.slice(dt);
  const endIdx = html.toLowerCase().lastIndexOf("</html>");
  if (endIdx !== -1) html = html.slice(0, endIdx + 7);
  if (!/<html|<!doctype/i.test(html)) {
    html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body>${html}</body></html>`;
  }
  let url = "";
  try {
    const id = crypto.randomUUID();
    const path = `vibe/${id}.html`;
    const up = await fetch(`${SUPABASE_URL}/storage/v1/object/reports/${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${SERVICE_ROLE}`, apikey: SERVICE_ROLE, "Content-Type": "text/html", "x-upsert": "true" },
      body: html,
    });
    if (up.ok) url = `${SUPABASE_URL}/functions/v1/vibe-view?id=${id}`;
    else console.error("host err", up.status, (await up.text().catch(() => "")).slice(0, 200));
  } catch (e) { console.error("host throw", String(e)); }
  return { html, url };
}

async function tgMessage(botToken: string, chatId: number, text: string, replyTo?: number | null) {
  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true, ...(replyTo ? { reply_to_message_id: replyTo } : {}) }),
    });
  } catch (e) { console.error("tgMessage", String(e)); }
}

async function tgDocument(botToken: string, chatId: number, html: string, filename: string, caption: string, replyTo?: number | null, url?: string) {
  try {
    const form = new FormData();
    form.append("chat_id", String(chatId));
    if (caption) form.append("caption", caption);
    if (replyTo) form.append("reply_to_message_id", String(replyTo));
    if (url) form.append("reply_markup", JSON.stringify({ inline_keyboard: [[{ text: "🔗 Open Live Page", url }]] }));
    form.append("document", new Blob([new TextEncoder().encode(html)], { type: "text/html" }), filename);
    await fetch(`https://api.telegram.org/bot${botToken}/sendDocument`, { method: "POST", body: form });
  } catch (e) { console.error("tgDocument", String(e)); }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const body = await req.json().catch(() => ({}));
  const prompt = String(body.prompt || "").trim();
  if (!prompt) return json({ ok: false, error: "prompt required" }, 400);

  // Dry-run (no bot_token): just generate + host, return metadata. Used for testing.
  if (!body.bot_token) {
    const g = await generate(prompt);
    return json({ ok: !!g, url: g?.url || "", length: g?.html.length || 0 });
  }

  // Full path: generate, then deliver to Telegram. Done synchronously so the work
  // completes even if the calling webhook isolate is torn down.
  const slug = prompt.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "vibecode";
  const g = await generate(prompt);
  if (g) {
    await tgDocument(body.bot_token, Number(body.chat_id), g.html, `${slug}.html`,
      `✅ Built it — open in your browser.${g.url ? "\n\n🔗 Live: " + g.url : ""}`, body.reply_to_message_id, g.url);
  } else {
    await tgMessage(body.bot_token, Number(body.chat_id), "Couldn't build that one — try again or rephrase the prompt.", body.reply_to_message_id);
  }
  return json({ ok: !!g });
});

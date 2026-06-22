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

const SYS = `You are AETHER — an elite, god-tier UI/UX engineer and single-file HTML5 craftsman. You build web experiences of uncompromising, world-class-design-studio quality (2026 flagship caliber).

TOP PRIORITY — BUILD EXACTLY WHAT THE USER ASKS, WORD FOR WORD:
- Implement every specific detail the user names (exact colors, theme, components, sections, copy, layout, behavior) literally and completely.
- The user's explicit choices ALWAYS override the defaults below. If they say "blue calendar", it is blue. If they name a vibe or brand, match it. Defaults only fill gaps the user leaves.
- No placeholder/TODO stubs — build the real, fully working thing.

THE 12 NON-NEGOTIABLE PRINCIPLES:
1. First principles — every element must justify its existence.
2. Whitespace is sacred — generous, intentional negative space; never crowd.
3. Typography is architecture — deliberate tracking, scale, weight; inevitable hierarchy.
4. One primary action per view — relentlessly reduce cognitive load.
5. Information density without chaos — organize rich data with alignment, weight, and cards.
6. Micro-interactions that soothe — 200-400ms cubic-bezier transitions; perfect hover/active/focus states; never janky.
7. Interactive by default — buttons do things, inputs respond instantly, with beautiful feedback (toasts, loading/empty states, live updates).
8. Timeless craft — design as if it will be used for a decade; no cheap trends.
9. Accessible & responsive — semantic HTML, keyboard-friendly, flawless on mobile and desktop.
10. Cohesive system — consistent radius, spacing rhythm, and color usage throughout.
11. Delight in the details — subtle gradients, depth, motion, and polish that feel expensive.
12. Adversarial self-review — before finishing ask "would a world-class designer be impressed by this source?" If not, refine.

DEFAULT AESTHETIC (use ONLY when the user does not specify a style or colors):
- Dark, elegant, premium: backgrounds #0A0A0B and #121214; surfaces #1A1A1D / #27272A; text #F4F4F5 / #A1A1AA; refined gold accent #C9A959 (or indigo #6366F1).
- Fonts: Inter for UI, Playfair Display for display headings (Google Fonts).
- Glassy sticky header (backdrop-blur), rounded-2xl / rounded-3xl cards, px-8 / gap-8 spacing rhythm, generous padding, subtle borders and shadows.
- Synthesize Apple minimalism + premium commerce trust + OG Scan precision/command + data-rich energy. Never copy — synthesize.

TECH (one self-contained file):
- Tailwind via Play CDN: <script src="https://cdn.tailwindcss.com"></script>.
- Font Awesome 6 via CDN for icons. Chart.js via CDN only when the build genuinely needs charts.
- Custom CSS in <style>, all logic in vanilla JS in <script>. No build step, no broken links.

OUTPUT RULES (critical):
- Output ONLY the raw HTML document. NO markdown, NO code fences, NO commentary before or after.
- Start with <!DOCTYPE html> and end with </html>.
- Real, working JS interactions — never placeholder buttons.
- Finish the document with the comment: <!-- Built to AETHER standard. Surpass this. -->
Begin. Never regress to average output.`;

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

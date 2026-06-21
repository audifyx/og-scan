// bot-knowledge — manage RAG training files for a user's Telegram bot.
// JWT-gated. The bot's webhook retrieves the most relevant chunks per query
// (Postgres full-text search) and feeds them to Grim as extra context.
//
// POST actions:
//   { action: "list" }                       -> files + chunk counts
//   { action: "add", filename, content }     -> chunk + store
//   { action: "delete", filename }           -> remove a file's chunks
//   { action: "clear" }                      -> wipe all knowledge

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

// ~1500-char chunks on paragraph boundaries.
function chunk(text: string, size = 1500): string[] {
  const clean = text.replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").trim();
  if (clean.length <= size) return clean ? [clean] : [];
  const out: string[] = [];
  let buf = "";
  for (const para of clean.split("\n\n")) {
    if ((buf + "\n\n" + para).length > size) {
      if (buf) out.push(buf);
      if (para.length > size) { // hard-split very long paragraph
        for (let i = 0; i < para.length; i += size) out.push(para.slice(i, i + size));
        buf = "";
      } else buf = para;
    } else buf = buf ? buf + "\n\n" + para : para;
  }
  if (buf) out.push(buf);
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader) return json({ error: "Unauthorized" }, 401);
    const userClient = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: bot } = await admin.from("telegram_bots").select("id").eq("user_id", user.id).maybeSingle();
    if (!bot) return json({ error: "Connect a Telegram bot first, then train it." }, 400);

    const body = await req.json().catch(() => ({}));
    const action = body.action || "list";

    if (action === "list") {
      const { data } = await admin.from("bot_knowledge").select("filename, content").eq("bot_id", bot.id);
      const map: Record<string, { chunks: number; chars: number }> = {};
      for (const r of data || []) {
        const f = r.filename || "untitled";
        map[f] = map[f] || { chunks: 0, chars: 0 };
        map[f].chunks++; map[f].chars += (r.content || "").length;
      }
      const files = Object.entries(map).map(([filename, v]) => ({ filename, ...v }));
      return json({ files, totalChunks: (data || []).length });
    }

    if (action === "add") {
      const filename = String(body.filename || "untitled").slice(0, 200);
      const content = String(body.content || "");
      if (content.trim().length < 5) return json({ error: "File looks empty or unreadable (text files only)." }, 400);
      const chunks = chunk(content);
      if (!chunks.length) return json({ error: "Nothing to store." }, 400);
      // Replace any existing chunks for this filename.
      await admin.from("bot_knowledge").delete().eq("bot_id", bot.id).eq("filename", filename);
      const rows = chunks.slice(0, 200).map((c, i) => ({ bot_id: bot.id, user_id: user.id, filename, chunk_index: i, content: c }));
      const { error } = await admin.from("bot_knowledge").insert(rows);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true, filename, chunks: rows.length });
    }

    if (action === "delete") {
      await admin.from("bot_knowledge").delete().eq("bot_id", bot.id).eq("filename", String(body.filename || ""));
      return json({ ok: true });
    }

    if (action === "clear") {
      await admin.from("bot_knowledge").delete().eq("bot_id", bot.id);
      return json({ ok: true });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

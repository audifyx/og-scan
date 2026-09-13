/**
 * Public MCP group-chat list + transcript for /gc/:slug.
 */
import { getGroupChat, historyGroupChat, listGroupChats } from "./orbitx/mcp-group-chat.js";

const SUPA_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const SRK = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

function json(res, data, status = 200) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(data));
}

async function sb(path, init = {}) {
  if (!SUPA_URL || !SRK) throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  const r = await fetch(`${SUPA_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SRK,
      Authorization: `Bearer ${SRK}`,
      "Content-Type": "application/json",
      Prefer: init.prefer || "return=representation",
      ...(init.headers || {}),
    },
  });
  const text = await r.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  if (!r.ok) {
    const err = new Error(data?.message || data?.error || text || r.statusText);
    err.status = r.status;
    throw err;
  }
  return data;
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.statusCode = 204;
    return res.end();
  }
  try {
    const url = new URL(req.url || "/", "http://x");
    const slug = url.searchParams.get("slug") || "";
    if (req.method !== "GET") return json(res, { ok: false, error: "method" }, 405);
    if (!slug || slug === "list") {
      return json(res, await listGroupChats(sb, { limit: 20 }));
    }
    const chat = await getGroupChat(sb, { slug, name: slug });
    if (!chat.ok) return json(res, chat, 404);
    const hist = await historyGroupChat(sb, { slug, limit: 50 });
    return json(res, { ...chat, messages: hist.messages || [], message: hist.message });
  } catch (e) {
    return json(res, { ok: false, error: "gc_failed", message: e?.message || String(e) }, 500);
  }
}

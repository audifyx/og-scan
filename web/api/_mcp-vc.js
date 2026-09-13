/**
 * Public LiveKit VC join API for /vc/:slug (no MCP session required).
 */
import { getVoiceRoom, joinVoiceRoom, listOpenVoiceRooms } from "./orbitx/mcp-voice.js";

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

function readBody(req) {
  if (req.body && typeof req.body === "object") return Promise.resolve(req.body);
  if (typeof req.body === "string") {
    try {
      return Promise.resolve(JSON.parse(req.body || "{}"));
    } catch {
      return Promise.resolve({});
    }
  }
  return new Promise((resolve) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"));
      } catch {
        resolve({});
      }
    });
  });
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.statusCode = 204;
    return res.end();
  }
  try {
    const url = new URL(req.url || "/", "http://x");
    if (req.method === "GET") {
      const slug = url.searchParams.get("slug") || "";
      if (!slug || slug === "list") {
        return json(res, await listOpenVoiceRooms(sb, { limit: 20 }));
      }
      return json(res, await getVoiceRoom(sb, { slug }));
    }
    if (req.method === "POST") {
      const body = await readBody(req);
      return json(
        res,
        await joinVoiceRoom(sb, {
          slug: body.slug || url.searchParams.get("slug"),
          name: body.name,
          displayName: body.displayName || body.username || "Guest",
        }),
      );
    }
    return json(res, { error: "method_not_allowed" }, 405);
  } catch (e) {
    return json(res, { ok: false, error: e?.message || String(e) }, 500);
  }
}

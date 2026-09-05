/**
 * Public Life Agents lobby + profile for /life/:slug
 */
import { getLifeAgent, latestLifeReport, lifeDiary, listLifeAgents } from "./orbitx/mcp-life-agents.js";

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
    res.statusCode = 204;
    return res.end();
  }
  try {
    const url = new URL(req.url || "/", "http://x");
    const slug = url.searchParams.get("slug") || "";
    if (req.method !== "GET") return json(res, { ok: false, error: "method" }, 405);
    if (!slug || slug === "list") return json(res, await listLifeAgents(sb, { limit: 24 }));
    const agent = await getLifeAgent(sb, { slug, name: slug });
    if (!agent.ok) return json(res, agent, 404);
    const report = await latestLifeReport(sb, { slug });
    const diary = await lifeDiary(sb, { slug, limit: 12 });
    return json(res, {
      ok: true,
      ...agent,
      report: report.ok ? { headline: report.headline, markdown: report.markdown, picks: report.picks, created_at: report.created_at } : null,
      diary: diary.entries || [],
      ties: diary.ties || [],
    });
  } catch (e) {
    return json(res, { ok: false, error: "life_failed", message: e?.message || String(e) }, 500);
  }
}

/**
 * OrbitX Agent API (plain JS — matches working mcp.js runtime).
 * Routes via rewrite: /api/orbitx-agent/* → /api/orbitx-agent?path=*
 *
 * GET  health
 * POST bootstrap
 * GET/POST keys | DELETE keys/:id
 * POST link-wallet
 * POST oauth/approve
 */
import { createHash, randomBytes } from "node:crypto";

const SUPA_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const ANON = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
const SRK = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const PUBLIC_BASE = process.env.PUBLIC_APP_URL || process.env.VITE_PUBLIC_APP_URL || "https://ogscan.fun";
const MCP_URL = `${PUBLIC_BASE}/api/orbitx-mcp`;

const headers = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Cache-Control": "no-store",
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers });
}

function sha256(input) {
  return createHash("sha256").update(input).digest("hex");
}

function opaque(prefix) {
  return `${prefix}_${randomBytes(32).toString("hex")}`;
}

function pathOf(req) {
  try {
    const u = new URL(req.url);
    const p = u.searchParams.get("path");
    if (p) return p.split("/").filter(Boolean);
  } catch {
    /* ignore */
  }
  const raw = String(req.url || "");
  const after = raw.split("orbitx-agent")[1] || "";
  return after.replace(/^\//, "").split("?")[0].split("/").filter(Boolean);
}

async function getUserId(req) {
  const auth = req.headers.get("authorization") || req.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ") || !SUPA_URL || !ANON) return null;
  const r = await fetch(`${SUPA_URL}/auth/v1/user`, {
    headers: { Authorization: auth, apikey: ANON },
  });
  if (!r.ok) return null;
  const u = await r.json();
  return u?.id || null;
}

function srHeaders(extra = {}) {
  return {
    apikey: SRK,
    Authorization: `Bearer ${SRK}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

async function sb(path, init = {}) {
  if (!SUPA_URL || !SRK) throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  const r = await fetch(`${SUPA_URL}/rest/v1/${path}`, {
    ...init,
    headers: { ...srHeaders(init.headers || {}), Prefer: init.prefer || "return=representation" },
  });
  const text = await r.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  if (!r.ok) {
    const msg = data?.message || data?.error || data?.raw || text || r.statusText;
    const err = new Error(msg);
    err.status = r.status;
    throw err;
  }
  return data;
}

async function ensureAgent(userId) {
  const existing = await sb(
    `agents?user_id=eq.${encodeURIComponent(userId)}&order=created_at.asc&limit=1&select=*`,
  );
  if (Array.isArray(existing) && existing[0]) return existing[0];

  const created = await sb("agents", {
    method: "POST",
    body: JSON.stringify({
      user_id: userId,
      name: "Default",
      description: "OrbitX MCP agent",
      status: "active",
    }),
  });
  const agent = Array.isArray(created) ? created[0] : created;
  try {
    await sb("agent_settings", {
      method: "POST",
      body: JSON.stringify({ agent_id: agent.id }),
      prefer: "resolution=merge-duplicates,return=minimal",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    });
  } catch {
    /* settings optional */
  }
  return agent;
}

async function listKeys(agentId) {
  const rows = await sb(
    `agent_api_keys?agent_id=eq.${encodeURIComponent(agentId)}&revoked_at=is.null&order=created_at.desc&select=id,agent_id,name,last_used_at,created_at`,
  );
  return Array.isArray(rows) ? rows : [];
}

async function createKey(agentId, name) {
  const key = opaque("oxk");
  const rows = await sb("agent_api_keys", {
    method: "POST",
    body: JSON.stringify({ agent_id: agentId, name, key_hash: sha256(key) }),
  });
  const row = Array.isArray(rows) ? rows[0] : rows;
  return { id: row.id, name: row.name, key };
}

function mapAgent(a) {
  return {
    id: a.id,
    userId: a.user_id,
    name: a.name,
    description: a.description,
    status: a.status,
    walletAddress: a.wallet_address,
    phantomConnected: Boolean(a.phantom_connected),
    createdAt: a.created_at,
    updatedAt: a.updated_at,
  };
}

export default async function handler(req) {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });

  const parts = pathOf(req);
  const route = parts.join("/") || "";

  try {
    if (req.method === "GET" && (route === "health" || route === "")) {
      return json({
        ok: true,
        service: "orbitx-agent",
        hasServiceRole: Boolean(SRK),
        hasSupabaseUrl: Boolean(SUPA_URL),
      });
    }

    if (route === "bootstrap" && req.method === "POST") {
      const userId = await getUserId(req);
      if (!userId) return json({ error: "unauthorized" }, 401);
      const agent = await ensureAgent(userId);
      const keys = await listKeys(agent.id);
      let mintedKey = null;
      if (keys.length === 0) mintedKey = await createKey(agent.id, "Default MCP Key");
      return json({
        agent: mapAgent(agent),
        keys: keys.map((k) => ({
          id: k.id,
          name: k.name,
          createdAt: k.created_at,
          lastUsedAt: k.last_used_at,
        })),
        mintedKey,
        mcpUrl: MCP_URL,
      });
    }

    if (route === "keys" && req.method === "GET") {
      const userId = await getUserId(req);
      if (!userId) return json({ error: "unauthorized" }, 401);
      const agent = await ensureAgent(userId);
      const keys = await listKeys(agent.id);
      return json({
        agentId: agent.id,
        keys: keys.map((k) => ({
          id: k.id,
          name: k.name,
          createdAt: k.created_at,
          lastUsedAt: k.last_used_at,
        })),
      });
    }

    if (route === "keys" && req.method === "POST") {
      const userId = await getUserId(req);
      if (!userId) return json({ error: "unauthorized" }, 401);
      const body = await req.json().catch(() => ({}));
      const name = String(body.name || "").trim() || "MCP Key";
      const agent = await ensureAgent(userId);
      const minted = await createKey(agent.id, name);
      return json(
        {
          id: minted.id,
          name: minted.name,
          key: minted.key,
          message: "Save this key securely. You will not be able to see it again.",
        },
        201,
      );
    }

    if (parts[0] === "keys" && parts[1] && req.method === "DELETE") {
      const userId = await getUserId(req);
      if (!userId) return json({ error: "unauthorized" }, 401);
      const keyId = parts[1];
      const keys = await sb(`agent_api_keys?id=eq.${encodeURIComponent(keyId)}&select=id,agent_id`);
      const key = Array.isArray(keys) ? keys[0] : null;
      if (!key) return json({ error: "Key not found" }, 404);
      const agents = await sb(
        `agents?id=eq.${encodeURIComponent(key.agent_id)}&user_id=eq.${encodeURIComponent(userId)}&select=id`,
      );
      if (!Array.isArray(agents) || !agents[0]) return json({ error: "Key not found" }, 404);
      await sb(`agent_api_keys?id=eq.${encodeURIComponent(keyId)}`, {
        method: "PATCH",
        body: JSON.stringify({ revoked_at: new Date().toISOString() }),
        headers: { Prefer: "return=minimal" },
      });
      return json({ ok: true });
    }

    if (route === "link-wallet" && req.method === "POST") {
      const userId = await getUserId(req);
      if (!userId) return json({ error: "unauthorized" }, 401);
      const body = await req.json().catch(() => ({}));
      const wallet = String(body.walletAddress || body.wallet || "").trim();
      if (wallet.length < 32) return json({ error: "walletAddress required" }, 400);
      const agent = body.agentId
        ? (
            await sb(
              `agents?id=eq.${encodeURIComponent(body.agentId)}&user_id=eq.${encodeURIComponent(userId)}&select=*`,
            )
          )?.[0]
        : await ensureAgent(userId);
      if (!agent) return json({ error: "Agent not found" }, 404);
      const updated = await sb(`agents?id=eq.${encodeURIComponent(agent.id)}`, {
        method: "PATCH",
        body: JSON.stringify({
          wallet_address: wallet,
          phantom_connected: true,
          updated_at: new Date().toISOString(),
        }),
      });
      const row = Array.isArray(updated) ? updated[0] : updated;
      return json({ agent: mapAgent(row || { ...agent, wallet_address: wallet, phantom_connected: true }) });
    }

    if (route === "oauth/approve" && req.method === "POST") {
      const userId = await getUserId(req);
      if (!userId) return json({ error: "unauthorized" }, 401);
      const body = await req.json().catch(() => ({}));
      const redirectUri = String(body.redirect_uri || "").trim();
      const state = body.state != null ? String(body.state) : "";
      const wallet = String(body.walletAddress || body.wallet || "").trim() || null;
      if (!redirectUri) return json({ error: "redirect_uri required" }, 400);

      let agent = await ensureAgent(userId);
      if (wallet) {
        const updated = await sb(`agents?id=eq.${encodeURIComponent(agent.id)}`, {
          method: "PATCH",
          body: JSON.stringify({
            wallet_address: wallet,
            phantom_connected: true,
            updated_at: new Date().toISOString(),
          }),
        });
        agent = Array.isArray(updated) ? updated[0] : agent;
      }

      // Prefer oauth codes table; fall back to API key token if table missing
      const code = opaque("oxc");
      try {
        await sb("agent_mcp_oauth_codes", {
          method: "POST",
          body: JSON.stringify({
            code_hash: sha256(code),
            user_id: userId,
            agent_id: agent.id,
            wallet_address: wallet || agent.wallet_address,
            redirect_uri: redirectUri,
            client_id: String(body.client_id || "orbitx-mcp"),
            code_challenge: body.code_challenge || null,
            code_challenge_method: body.code_challenge_method || null,
            expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
          }),
          headers: { Prefer: "return=minimal" },
        });
      } catch {
        const access = opaque("oxo");
        await sb("agent_api_keys", {
          method: "POST",
          body: JSON.stringify({
            agent_id: agent.id,
            name: `OAuth ${new Date().toISOString().slice(0, 16)}`,
            key_hash: sha256(access),
          }),
          headers: { Prefer: "return=minimal" },
        });
        const sep = redirectUri.includes("?") ? "&" : "?";
        return json({
          redirect: `${redirectUri}${sep}code=${encodeURIComponent(access)}&state=${encodeURIComponent(state)}`,
          fallback: true,
        });
      }

      const sep = redirectUri.includes("?") ? "&" : "?";
      return json({
        redirect: `${redirectUri}${sep}code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`,
      });
    }

    return json({ error: "not_found", route }, 404);
  } catch (e) {
    return json({ error: e?.message || "Internal error" }, e?.status && e.status < 600 ? e.status : 500);
  }
}

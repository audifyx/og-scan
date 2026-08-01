/**
 * OrbitX Agent API — mounted at /api/orbitx/agent/*
 * (consolidated into orbitx.ts to stay under Hobby function limits)
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  PUBLIC_BASE,
  adminClient,
  createKey,
  ensureDefaultAgent,
  errMessage,
  errStatus,
  generateOpaqueToken,
  handleOptions,
  json,
  pathParts,
  requireUser,
  revokeKey,
  sha256,
  linkWallet,
  listKeys,
  mapAgent,
} from "./agent/_lib";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (handleOptions(req, res)) return;

    const parts = pathParts(req, "agent");
    const route = parts.join("/") || "";

    if (req.method === "GET" && (route === "health" || route === "")) {
      return json(res, { ok: true, service: "orbitx-agent" });
    }

    // ---- bootstrap: ensure agent + optional first key ----
    if (route === "bootstrap" && req.method === "POST") {
      const { id: userId } = await requireUser(req);
      const agent = await ensureDefaultAgent(userId);
      const keys = await listKeys(agent.id);
      let minted: { id: string; name: string; key: string } | null = null;
      if (keys.length === 0) {
        minted = await createKey(agent.id, "Default MCP Key");
      }
      return json(res, {
        agent: mapAgent(agent),
        keys: keys.map((k) => ({
          id: k.id,
          name: k.name,
          createdAt: k.created_at,
          lastUsedAt: k.last_used_at,
        })),
        mintedKey: minted,
        mcpUrl: `${PUBLIC_BASE}/api/orbitx/mcp`,
      });
    }

    // ---- list agents ----
    if (route === "list" && req.method === "GET") {
      const { id: userId } = await requireUser(req);
      const db = adminClient();
      const { data, error } = await db
        .from("agents")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      if (error) return json(res, { error: error.message }, 500);
      return json(res, { agents: (data || []).map(mapAgent) });
    }

    // ---- create agent ----
    if (route === "create" && req.method === "POST") {
      const { id: userId } = await requireUser(req);
      const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
      const name = String(body.name || "").trim();
      if (!name) return json(res, { error: "name required" }, 400);
      const db = adminClient();
      const { data, error } = await db
        .from("agents")
        .insert({
          user_id: userId,
          name,
          description: body.description || null,
          status: "active",
        })
        .select("*")
        .single();
      if (error) return json(res, { error: error.message }, 400);
      await db.from("agent_settings").upsert({ agent_id: data.id }, { onConflict: "agent_id" });
      return json(res, { agent: mapAgent(data) }, 201);
    }

    // ---- keys ----
    if (route === "keys" && req.method === "GET") {
      const { id: userId } = await requireUser(req);
      const agent = await ensureDefaultAgent(userId);
      const keys = await listKeys(agent.id);
      return json(res, {
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
      const { id: userId } = await requireUser(req);
      const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
      const name = String(body.name || "").trim() || "MCP Key";
      const agent = await ensureDefaultAgent(userId);
      const minted = await createKey(agent.id, name);
      return json(res, {
        id: minted.id,
        name: minted.name,
        key: minted.key,
        message: "Save this key securely. You will not be able to see it again.",
      }, 201);
    }

    if (parts[0] === "keys" && parts[1] && req.method === "DELETE") {
      const { id: userId } = await requireUser(req);
      await revokeKey(parts[1], userId);
      return json(res, { ok: true });
    }

    // ---- link wallet ----
    if (route === "link-wallet" && req.method === "POST") {
      const { id: userId } = await requireUser(req);
      const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
      const wallet = String(body.walletAddress || body.wallet || "").trim();
      if (!wallet || wallet.length < 32) return json(res, { error: "walletAddress required" }, 400);
      const agentId = body.agentId ? String(body.agentId) : (await ensureDefaultAgent(userId)).id;
      const agent = await linkWallet(agentId, userId, wallet);
      return json(res, { agent: mapAgent(agent) });
    }

    // ---- oauth approve (session → auth code) ----
    if (route === "oauth/approve" && req.method === "POST") {
      const { id: userId } = await requireUser(req);
      const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
      const redirectUri = String(body.redirect_uri || "").trim();
      const state = body.state != null ? String(body.state) : "";
      const clientId = body.client_id != null ? String(body.client_id) : "orbitx-mcp";
      const codeChallenge = body.code_challenge != null ? String(body.code_challenge) : null;
      const codeChallengeMethod = body.code_challenge_method != null ? String(body.code_challenge_method) : null;
      const wallet = String(body.walletAddress || body.wallet || "").trim() || null;

      if (!redirectUri) return json(res, { error: "redirect_uri required" }, 400);

      const agent = await ensureDefaultAgent(userId);
      if (wallet) {
        await linkWallet(agent.id, userId, wallet);
      }

      const code = generateOpaqueToken("oxc");
      const db = adminClient();
      const { error } = await db.from("agent_mcp_oauth_codes").insert({
        code_hash: sha256(code),
        user_id: userId,
        agent_id: agent.id,
        wallet_address: wallet || agent.wallet_address,
        redirect_uri: redirectUri,
        client_id: clientId,
        code_challenge: codeChallenge,
        code_challenge_method: codeChallengeMethod,
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      });
      if (error) {
        // Table may not exist yet — fall back to minting a long-lived API-style oauth token directly
        if (error.message?.includes("agent_mcp_oauth_codes") || error.code === "42P01") {
          const access = generateOpaqueToken("oxo");
          await db.from("agent_api_keys").insert({
            agent_id: agent.id,
            name: `OAuth ${new Date().toISOString().slice(0, 16)}`,
            key_hash: sha256(access),
          });
          const sep = redirectUri.includes("?") ? "&" : "?";
          return json(res, {
            redirect: `${redirectUri}${sep}code=${encodeURIComponent(access)}&state=${encodeURIComponent(state)}`,
            fallback: true,
          });
        }
        return json(res, { error: error.message }, 500);
      }

      const sep = redirectUri.includes("?") ? "&" : "?";
      return json(res, {
        redirect: `${redirectUri}${sep}code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`,
      });
    }

    return json(res, { error: "not_found", route }, 404);
  } catch (e) {
    return json(res, { error: errMessage(e) }, errStatus(e));
  }
}

/**
 * Shared helpers for OrbitX Agent + MCP APIs.
 */
import { createHash, randomBytes } from "crypto";
import type { VercelRequest } from "@vercel/node";
import {
  adminClient,
  bearer,
  handleOptions,
  json,
  requireUser,
} from "../orbitx/world/_lib";

export { adminClient, bearer, handleOptions, json, requireUser };

export const PUBLIC_BASE =
  process.env.PUBLIC_APP_URL ||
  process.env.VITE_PUBLIC_APP_URL ||
  "https://ogscan.fun";

export function pathParts(req: VercelRequest, marker: string): string[] {
  const q = req.query.path;
  if (typeof q === "string" && q.length) return q.split("/").filter(Boolean);
  if (Array.isArray(q)) return q.join("/").split("/").filter(Boolean);
  const url = req.url || "";
  const after = url.split(marker)[1] || "";
  return after.replace(/^\//, "").split("?")[0]!.split("/").filter(Boolean);
}

export function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

export function generateApiKey(): string {
  return `oxk_${randomBytes(32).toString("hex")}`;
}

export function generateOpaqueToken(prefix: string): string {
  return `${prefix}_${randomBytes(32).toString("hex")}`;
}

export type AgentRow = {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  status: string;
  wallet_address: string | null;
  phantom_connected: boolean | null;
  created_at: string;
  updated_at: string;
};

export type ApiKeyRow = {
  id: string;
  agent_id: string;
  name: string;
  last_used_at: string | null;
  revoked_at: string | null;
  created_at: string;
};

export async function ensureDefaultAgent(userId: string): Promise<AgentRow> {
  const db = adminClient();
  const { data: existing } = await db
    .from("agents")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (existing) return existing as AgentRow;

  const { data, error } = await db
    .from("agents")
    .insert({
      user_id: userId,
      name: "Default",
      description: "OrbitX MCP agent",
      status: "active",
    })
    .select("*")
    .single();

  if (error || !data) {
    throw Object.assign(new Error(error?.message || "Failed to create agent"), { status: 500 });
  }

  await db.from("agent_settings").upsert({ agent_id: data.id }, { onConflict: "agent_id" });
  return data as AgentRow;
}

export async function listKeys(agentId: string): Promise<ApiKeyRow[]> {
  const db = adminClient();
  const { data, error } = await db
    .from("agent_api_keys")
    .select("id, agent_id, name, last_used_at, revoked_at, created_at")
    .eq("agent_id", agentId)
    .is("revoked_at", null)
    .order("created_at", { ascending: false });
  if (error) throw Object.assign(new Error(error.message), { status: 500 });
  return (data || []) as ApiKeyRow[];
}

export async function createKey(
  agentId: string,
  name: string,
): Promise<{ id: string; name: string; key: string }> {
  const db = adminClient();
  const key = generateApiKey();
  const key_hash = sha256(key);
  const { data, error } = await db
    .from("agent_api_keys")
    .insert({ agent_id: agentId, name, key_hash })
    .select("id, name")
    .single();
  if (error || !data) {
    throw Object.assign(new Error(error?.message || "Failed to create key"), { status: 500 });
  }
  return { id: data.id, name: data.name, key };
}

export async function revokeKey(keyId: string, userId: string): Promise<void> {
  const db = adminClient();
  const { data: key } = await db
    .from("agent_api_keys")
    .select("id, agent_id")
    .eq("id", keyId)
    .maybeSingle();
  if (!key) throw Object.assign(new Error("Key not found"), { status: 404 });

  const { data: agent } = await db
    .from("agents")
    .select("id, user_id")
    .eq("id", key.agent_id)
    .maybeSingle();
  if (!agent || agent.user_id !== userId) {
    throw Object.assign(new Error("Key not found"), { status: 404 });
  }

  const { error } = await db
    .from("agent_api_keys")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", keyId);
  if (error) throw Object.assign(new Error(error.message), { status: 500 });
}

export async function linkWallet(agentId: string, userId: string, wallet: string): Promise<AgentRow> {
  const db = adminClient();
  const { data: agent } = await db
    .from("agents")
    .select("*")
    .eq("id", agentId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!agent) throw Object.assign(new Error("Agent not found"), { status: 404 });

  const { data, error } = await db
    .from("agents")
    .update({
      wallet_address: wallet,
      phantom_connected: true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", agentId)
    .select("*")
    .single();
  if (error || !data) {
    throw Object.assign(new Error(error?.message || "Failed to link wallet"), { status: 500 });
  }
  return data as AgentRow;
}

/** Resolve Bearer token → agent + user (API key or OAuth access token). */
export async function resolveMcpAuth(req: VercelRequest): Promise<{
  userId: string;
  agentId: string;
  walletAddress: string | null;
  authType: "api_key" | "oauth";
} | null> {
  const auth = bearer(req);
  if (!auth?.startsWith("Bearer ")) return null;
  const token = auth.slice(7).trim();
  if (!token) return null;

  const db = adminClient();
  const hash = sha256(token);

  // API keys (oxk_) and fallback oauth codes stored as keys (oxo_)
  if (token.startsWith("oxk_") || token.startsWith("oxo_")) {
    const { data: keyRow } = await db
      .from("agent_api_keys")
      .select("id, agent_id, revoked_at")
      .eq("key_hash", hash)
      .maybeSingle();
    if (keyRow && !keyRow.revoked_at) {
      const { data: agent } = await db
        .from("agents")
        .select("id, user_id, wallet_address")
        .eq("id", keyRow.agent_id)
        .maybeSingle();
      if (!agent) return null;
      await db
        .from("agent_api_keys")
        .update({ last_used_at: new Date().toISOString() })
        .eq("id", keyRow.id);
      return {
        userId: agent.user_id,
        agentId: agent.id,
        walletAddress: agent.wallet_address,
        authType: token.startsWith("oxo_") ? "oauth" : "api_key",
      };
    }
  }

  const { data: tok } = await db
    .from("agent_mcp_oauth_tokens")
    .select("*")
    .eq("token_hash", hash)
    .is("revoked_at", null)
    .maybeSingle();
  if (!tok) return null;
  if (new Date(tok.expires_at).getTime() < Date.now()) return null;
  return {
    userId: tok.user_id,
    agentId: tok.agent_id,
    walletAddress: tok.wallet_address,
    authType: "oauth",
  };
}

export function errStatus(e: unknown): number {
  return typeof e === "object" && e && "status" in e && typeof (e as { status: unknown }).status === "number"
    ? (e as { status: number }).status
    : 500;
}

export function errMessage(e: unknown): string {
  return e instanceof Error ? e.message : "Internal error";
}

export function mapAgent(a: AgentRow) {
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

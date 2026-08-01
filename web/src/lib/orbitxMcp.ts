/** OrbitX Agent MCP client helpers — URLs, deep links, API calls. */

export const MCP_PATH = "/api/orbitx-mcp";
export const AGENT_API = "/api/orbitx-agent";

export function mcpPublicUrl(origin?: string): string {
  const base = (origin || (typeof window !== "undefined" ? window.location.origin : "https://ogscan.fun")).replace(
    /\/$/,
    "",
  );
  return `${base}${MCP_PATH}`;
}

export function claudeConnectUrl(mcpUrl: string, name = "OrbitX"): string {
  const params = new URLSearchParams({
    modal: "add-custom-connector",
    connectorName: name,
    connectorUrl: mcpUrl,
  });
  return `https://claude.ai/customize/connectors?${params.toString()}`;
}

/** ChatGPT has no official install deep link — open plugins/connectors and guide paste. */
export function chatgptConnectUrl(): string {
  return "https://chatgpt.com/#settings/Connectors";
}

export type AgentBootstrap = {
  agent: {
    id: string;
    name: string;
    walletAddress: string | null;
    phantomConnected: boolean;
  };
  keys: Array<{ id: string; name: string; createdAt: string; lastUsedAt?: string | null }>;
  mintedKey: { id: string; name: string; key: string } | null;
  mcpUrl: string;
};

async function authHeaders(): Promise<HeadersInit> {
  const { supabase } = await import("@/lib/supabase");
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Not signed in");
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

export async function bootstrapAgent(): Promise<AgentBootstrap> {
  const headers = await authHeaders();
  const r = await fetch(`${AGENT_API}/bootstrap`, { method: "POST", headers });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || "Bootstrap failed");
  return data;
}

export async function createAgentApiKey(name: string): Promise<{ id: string; name: string; key: string }> {
  const headers = await authHeaders();
  const r = await fetch(`${AGENT_API}/keys`, {
    method: "POST",
    headers,
    body: JSON.stringify({ name }),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || "Failed to create key");
  return data;
}

export async function listAgentApiKeys(): Promise<{
  agentId: string;
  keys: Array<{ id: string; name: string; createdAt: string; lastUsedAt?: string | null }>;
}> {
  const headers = await authHeaders();
  const r = await fetch(`${AGENT_API}/keys`, { headers });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || "Failed to list keys");
  return data;
}

export async function revokeAgentApiKey(keyId: string): Promise<void> {
  const headers = await authHeaders();
  const r = await fetch(`${AGENT_API}/keys/${keyId}`, { method: "DELETE", headers });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || "Failed to revoke key");
}

export async function linkAgentWallet(walletAddress: string, agentId?: string): Promise<void> {
  const headers = await authHeaders();
  const r = await fetch(`${AGENT_API}/link-wallet`, {
    method: "POST",
    headers,
    body: JSON.stringify({ walletAddress, agentId }),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || "Failed to link wallet");
}

export async function approveMcpOAuth(payload: {
  redirect_uri: string;
  state?: string;
  client_id?: string;
  code_challenge?: string;
  code_challenge_method?: string;
  walletAddress?: string;
}): Promise<{ redirect: string }> {
  const headers = await authHeaders();
  const r = await fetch(`${AGENT_API}/oauth/approve`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || "OAuth approve failed");
  return data;
}

export function shortKey(key: string): string {
  if (key.length < 16) return key;
  return `${key.slice(0, 10)}…${key.slice(-6)}`;
}

/** OrbitX Agent MCP client helpers — URLs, deep links, API calls. */

export const MCP_PATH = "/api/orbitx-mcp";
export const AGENT_API = "/api/orbitx-agent";

export function mcpPublicUrl(origin?: string): string {
  const base = (origin || (typeof window !== "undefined" ? window.location.origin : "https://orbitx.world")).replace(
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

async function readJson(r: Response): Promise<Record<string, unknown>> {
  const text = await r.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    const snippet = text.replace(/\s+/g, " ").slice(0, 180);
    throw new Error(
      r.ok
        ? `Invalid JSON from server: ${snippet}`
        : `Server error (${r.status}): ${snippet}`,
    );
  }
}

async function agentFetch(path: string, init?: RequestInit): Promise<Record<string, unknown>> {
  const headers = await authHeaders();
  const r = await fetch(`${AGENT_API}${path}`, {
    ...init,
    headers: { ...headers, ...(init?.headers || {}) },
  });
  const data = await readJson(r);
  if (!r.ok) {
    throw new Error(String(data.error || data.message || `Request failed (${r.status})`));
  }
  return data;
}

export async function bootstrapAgent(): Promise<AgentBootstrap> {
  return (await agentFetch("/bootstrap", { method: "POST" })) as unknown as AgentBootstrap;
}

export async function createAgentApiKey(name: string): Promise<{ id: string; name: string; key: string }> {
  return (await agentFetch("/keys", {
    method: "POST",
    body: JSON.stringify({ name }),
  })) as unknown as { id: string; name: string; key: string };
}

export async function listAgentApiKeys(): Promise<{
  agentId: string;
  keys: Array<{ id: string; name: string; createdAt: string; lastUsedAt?: string | null }>;
}> {
  return (await agentFetch("/keys")) as unknown as {
    agentId: string;
    keys: Array<{ id: string; name: string; createdAt: string; lastUsedAt?: string | null }>;
  };
}

export async function revokeAgentApiKey(keyId: string): Promise<void> {
  await agentFetch(`/keys/${keyId}`, { method: "DELETE" });
}

export async function linkAgentWallet(walletAddress: string, agentId?: string): Promise<void> {
  await agentFetch("/link-wallet", {
    method: "POST",
    body: JSON.stringify({ walletAddress, agentId }),
  });
}

export async function approveMcpOAuth(payload: {
  redirect_uri: string;
  state?: string;
  client_id?: string;
  code_challenge?: string;
  code_challenge_method?: string;
  walletAddress?: string;
}): Promise<{ redirect: string }> {
  return (await agentFetch("/oauth/approve", {
    method: "POST",
    body: JSON.stringify(payload),
  })) as unknown as { redirect: string };
}

export function shortKey(key: string): string {
  if (key.length < 16) return key;
  return `${key.slice(0, 10)}…${key.slice(-6)}`;
}

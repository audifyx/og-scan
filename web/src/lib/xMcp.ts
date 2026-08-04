/** OrbitX X MCP client helpers — separate from Agent MCP (/api/mcp). */

export const X_MCP_PATH = "/api/x/mcp";
export const X_AGENT_API = "/api/x/agent";
export const X_MCP_OAUTH_CLIENT_ID = "orbitx-x-mcp";
export const X_MCP_OAUTH_SCOPE = "x-post";

export function xMcpPublicUrl(_origin?: string): string {
  void _origin;
  // Always www — apex 308s break Claude connector POSTs.
  return `https://www.orbitx.world${X_MCP_PATH}`;
}

export type XMcpOAuthCredentials = {
  mcpUrl: string;
  authorizationUrl: string;
  tokenUrl: string;
  registrationUrl: string;
  clientId: string;
  clientSecret: string;
  scope: string;
  tokenEndpointAuthMethod: "none";
};

export function xMcpOAuthCredentials(origin?: string): XMcpOAuthCredentials {
  const mcpUrl = xMcpPublicUrl(origin);
  return {
    mcpUrl,
    authorizationUrl: `${mcpUrl}/oauth/authorize`,
    tokenUrl: `${mcpUrl}/oauth/token`,
    registrationUrl: `${mcpUrl}/oauth/register`,
    clientId: X_MCP_OAUTH_CLIENT_ID,
    clientSecret: "",
    scope: X_MCP_OAUTH_SCOPE,
    tokenEndpointAuthMethod: "none",
  };
}

export function xClaudeConnectUrl(mcpUrl: string, name = "OrbitX X"): string {
  const params = new URLSearchParams({
    modal: "add-custom-connector",
    connectorName: name,
    connectorUrl: mcpUrl,
  });
  return `https://claude.ai/customize/connectors?${params.toString()}`;
}

export function xChatgptConnectUrl(): string {
  return "https://chatgpt.com/#settings/Connectors";
}

export type XMcpBootstrap = {
  agent: {
    id: string;
    name: string;
    walletAddress: string | null;
    phantomConnected: boolean;
  };
  keys: Array<{ id: string; name: string; createdAt: string; lastUsedAt?: string | null }>;
  mintedKey: { id: string; name: string; key: string } | null;
  mcpUrl: string;
  x: {
    connected: boolean;
    username: string | null;
    twitterId: string | null;
    displayName: string | null;
    avatar: string | null;
  };
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
      r.ok ? `Invalid JSON from server: ${snippet}` : `Server error (${r.status}): ${snippet}`,
    );
  }
}

async function xAgentFetch(path: string, init?: RequestInit): Promise<Record<string, unknown>> {
  const headers = await authHeaders();
  const r = await fetch(`${X_AGENT_API}${path}`, {
    ...init,
    headers: { ...headers, ...(init?.headers || {}) },
  });
  const data = await readJson(r);
  if (!r.ok) {
    throw new Error(String(data.message || data.error || `Request failed (${r.status})`));
  }
  return data;
}

export async function bootstrapXMcp(): Promise<XMcpBootstrap> {
  return (await xAgentFetch("/bootstrap", { method: "POST" })) as unknown as XMcpBootstrap;
}

export async function createXMcpApiKey(name: string): Promise<{ id: string; name: string; key: string }> {
  return (await xAgentFetch("/keys", {
    method: "POST",
    body: JSON.stringify({ name }),
  })) as unknown as { id: string; name: string; key: string };
}

export async function listXMcpApiKeys(): Promise<{
  agentId: string;
  keys: Array<{ id: string; name: string; createdAt: string; lastUsedAt?: string | null }>;
}> {
  return (await xAgentFetch("/keys")) as unknown as {
    agentId: string;
    keys: Array<{ id: string; name: string; createdAt: string; lastUsedAt?: string | null }>;
  };
}

export async function revokeXMcpApiKey(keyId: string): Promise<void> {
  await xAgentFetch(`/keys/${keyId}`, { method: "DELETE" });
}

export async function approveXMcpOAuth(payload: {
  redirect_uri: string;
  state?: string;
  client_id?: string;
  code_challenge?: string;
  code_challenge_method?: string;
}): Promise<{ redirect: string }> {
  return (await xAgentFetch("/oauth/approve", {
    method: "POST",
    body: JSON.stringify(payload),
  })) as unknown as { redirect: string };
}

export function shortXKey(key: string): string {
  if (key.length < 16) return key;
  return `${key.slice(0, 10)}…${key.slice(-6)}`;
}

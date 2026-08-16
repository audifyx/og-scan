/** OrbitX Agent MCP client helpers — URLs, deep links, API calls. */

/** Claude.ai needs a URL whose last segment is `mcp` — use the real `/api/mcp` function. */
export const MCP_PATH = "/api/mcp";
export const MCP_PATH_ALIAS = "/mcp";
export const AGENT_API = "/api/orbitx-agent";
/** Public OAuth client for ChatGPT / Claude manual connector forms. */
export const MCP_OAUTH_CLIENT_ID = "orbitx-mcp";
export const MCP_OAUTH_SCOPE = "orbitx";

export function mcpPublicUrl(origin?: string): string {
  // Always use www — apex orbitx.world returns 308 on POST /api/mcp which breaks Claude connectors.
  void origin;
  return `https://www.orbitx.world${MCP_PATH}`;
}

export type McpOAuthCredentials = {
  mcpUrl: string;
  authorizationUrl: string;
  tokenUrl: string;
  registrationUrl: string;
  clientId: string;
  /** Always empty — public PKCE client; ChatGPT should leave secret blank. */
  clientSecret: string;
  scope: string;
  tokenEndpointAuthMethod: "none";
};

/** All fields ChatGPT / Claude OAuth MCP forms typically ask for. */
export function mcpOAuthCredentials(origin?: string): McpOAuthCredentials {
  const mcpUrl = mcpPublicUrl(origin);
  return {
    mcpUrl,
    authorizationUrl: `${mcpUrl}/oauth/authorize`,
    tokenUrl: `${mcpUrl}/oauth/token`,
    registrationUrl: `${mcpUrl}/oauth/register`,
    clientId: MCP_OAUTH_CLIENT_ID,
    clientSecret: "",
    scope: MCP_OAUTH_SCOPE,
    tokenEndpointAuthMethod: "none",
  };
}

export function claudeConnectUrl(mcpUrl: string, name = "OrbitX"): string {
  const params = new URLSearchParams({
    modal: "add-custom-connector",
    connectorName: name,
    connectorUrl: mcpUrl,
  });
  return `https://claude.ai/customize/connectors?${params.toString()}`;
}

/** ChatGPT connectors settings — paste MCP URL + OAuth fields from the agent page. */
export function chatgptConnectUrl(): string {
  return "https://chatgpt.com/#settings/Connectors";
}

/** Grok custom MCP connectors — paste MCP URL only (no OAuth form; Grok discovers auth). */
export function grokConnectUrl(): string {
  return "https://grok.com/connectors";
}

/** Browser handoff for MCP prepare_buy / prepare_sell → Phantom sign. */
export function agentSignTradeUrl(opts: {
  action: "buy" | "sell";
  mint: string;
  amount: string | number;
  publicKey: string;
  slippage?: number;
  pool?: string;
  origin?: string;
}): string {
  let base = (opts.origin || (typeof window !== "undefined" ? window.location.origin : "https://www.orbitx.world")).replace(
    /\/$/,
    "",
  );
  // Prefer www — apex 308s can break some handoff clients
  if (base === "https://orbitx.world" || base === "http://orbitx.world") {
    base = "https://www.orbitx.world";
  }
  const q = new URLSearchParams({
    action: opts.action,
    mint: opts.mint,
    amount: String(opts.amount),
    publicKey: opts.publicKey,
    slippage: String(opts.slippage ?? 10),
    pool: opts.pool || "auto",
  });
  return `${base}/agent/sign?${q.toString()}`;
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
  hold?: {
    ok?: boolean;
    meetsRequirement?: boolean;
    exempt?: boolean;
    holdingUsd?: number;
    minUsd?: number;
    message?: string;
  };
  mcpAccess?: {
    active?: boolean;
    expired?: boolean;
    packageId?: string | null;
    expiresAt?: string | null;
    remainingMs?: number;
    remainingLabel?: string;
  };
  accessSource?: string | null;
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
    if (/FUNCTION_INVOCATION_FAILED/i.test(snippet)) {
      throw new Error(
        "Server was restarting — hard-refresh and try again. MCP URL: https://www.orbitx.world/api/mcp",
      );
    }
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
    throw new Error(
      String(data.message || data.error || `Request failed (${r.status})`),
    );
  }
  return data;
}

export async function bootstrapAgent(): Promise<AgentBootstrap> {
  return (await agentFetch("/bootstrap", { method: "POST" })) as unknown as AgentBootstrap;
}

export async function listAgents(): Promise<{
  agents: AgentBootstrap["agent"][];
}> {
  return (await agentFetch("", { method: "GET" })) as unknown as {
    agents: AgentBootstrap["agent"][];
  };
}

export async function createAgent(name?: string, description?: string): Promise<{
  agent: AgentBootstrap["agent"];
}> {
  return (await agentFetch("", {
    method: "POST",
    body: JSON.stringify({ name, description }),
  })) as unknown as { agent: AgentBootstrap["agent"] };
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

/** Complete a Grok clickable link-auth session for Agent MCP. */
export async function approveMcpLinkAuth(
  code: string,
  walletAddress?: string,
): Promise<{ ok: boolean; status: string; authCode: string }> {
  return (await agentFetch("/link/approve", {
    method: "POST",
    body: JSON.stringify({ code, walletAddress }),
  })) as unknown as { ok: boolean; status: string; authCode: string };
}

export type McpChatAuthMint = {
  ok: boolean;
  status: string;
  authenticated?: boolean;
  authCode: string;
  expiresAt?: string;
  mcpUrl?: string;
  walletAddress?: string | null;
  messages: {
    grok: string;
    claude: string;
    chatgpt: string;
    authCode: string;
  };
  message?: string;
};

/** Mint a pre-authorized authCode + paste messages for Grok / Claude / ChatGPT (no mid-chat click). */
export async function mintMcpChatAuth(walletAddress?: string): Promise<McpChatAuthMint> {
  return (await agentFetch("/link/create", {
    method: "POST",
    body: JSON.stringify({ walletAddress }),
  })) as unknown as McpChatAuthMint;
}

export async function getMcpLinkStatus(code: string): Promise<{
  ok?: boolean;
  status?: string;
  authenticated?: boolean;
  message?: string;
}> {
  const r = await fetch(`${AGENT_API}/link/status?code=${encodeURIComponent(code)}`, {
    headers: { Accept: "application/json" },
  });
  const data = await readJson(r);
  if (!r.ok) {
    throw new Error(String(data.message || data.error || `Request failed (${r.status})`));
  }
  return data as { ok?: boolean; status?: string; authenticated?: boolean; message?: string };
}

export function shortKey(key: string): string {
  if (key.length < 16) return key;
  return `${key.slice(0, 10)}…${key.slice(-6)}`;
}

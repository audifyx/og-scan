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

/** Grok custom MCP connectors — paste MCP URL only (no OAuth form; Grok discovers auth). */
export function xGrokConnectUrl(): string {
  return "https://grok.com/connectors";
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
    scopes?: string | null;
    hasTweetWrite?: boolean;
    hasDmWrite?: boolean;
    requestedScopes?: string;
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

export async function disconnectXAccount(): Promise<void> {
  await xAgentFetch("/disconnect", { method: "POST" });
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

/** Complete a Grok clickable link-auth session (no OAuth redirect_uri). */
export async function approveXMcpLinkAuth(code: string): Promise<{ ok: boolean; status: string; authCode: string }> {
  return (await xAgentFetch("/link/approve", {
    method: "POST",
    body: JSON.stringify({ code }),
  })) as unknown as { ok: boolean; status: string; authCode: string };
}

export async function getXMcpLinkStatus(code: string): Promise<{
  ok?: boolean;
  status?: string;
  authenticated?: boolean;
  message?: string;
}> {
  // Public — no wallet session required to poll pending/expired.
  const r = await fetch(`${X_AGENT_API}/link/status?code=${encodeURIComponent(code)}`, {
    headers: { Accept: "application/json" },
  });
  const data = await readJson(r);
  if (!r.ok) {
    throw new Error(String(data.message || data.error || `Request failed (${r.status})`));
  }
  return data as { ok?: boolean; status?: string; authenticated?: boolean; message?: string };
}

export function shortXKey(key: string): string {
  if (key.length < 16) return key;
  return `${key.slice(0, 10)}…${key.slice(-6)}`;
}

export type XAgentConfig = {
  id: string;
  name: string;
  persona: string;
  voiceNotes: string;
  model: string;
  mode: "auto" | "approve";
  enabled: boolean;
  timezone: string;
  postingWindows: Array<{ startHour?: number; endHour?: number }>;
  topics: string[];
  maxPostsPerDay: number;
  autoReplyMentions?: boolean;
  autoReplyDms?: boolean;
  autoReplyGroupDms?: boolean;
  maxRepliesPerDay?: number;
  lastAutoRunAt?: string | null;
  lastReplyPollAt?: string | null;
};

export type XAgentKnowledge = {
  id: string;
  title: string;
  content: string;
  createdAt: string;
};

export type XAgentQueueItem = {
  id: string;
  agentId: string | null;
  kind: string;
  payload: Record<string, unknown>;
  status: string;
  scheduledFor?: string | null;
  postedTweetId?: string | null;
  error?: string | null;
  source?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type XNimModel = { id: string; label: string };

export async function fetchXAgent(): Promise<{
  agent: XAgentConfig;
  knowledge: XAgentKnowledge[];
  models: XNimModel[];
}> {
  return (await xAgentFetch("/x-agents")) as unknown as {
    agent: XAgentConfig;
    knowledge: XAgentKnowledge[];
    models: XNimModel[];
  };
}

export async function upsertXAgent(
  patch: Partial<{
    name: string;
    persona: string;
    voiceNotes: string;
    model: string;
    mode: "auto" | "approve";
    enabled: boolean;
    topics: string[];
    maxPostsPerDay: number;
    autoReplyMentions: boolean;
    autoReplyDms: boolean;
    autoReplyGroupDms: boolean;
    maxRepliesPerDay: number;
    postingWindows: Array<{ startHour?: number; endHour?: number }>;
    timezone: string;
  }>,
): Promise<{ agent: XAgentConfig }> {
  return (await xAgentFetch("/x-agents", {
    method: "POST",
    body: JSON.stringify(patch),
  })) as unknown as { agent: XAgentConfig };
}

/** Manually poll mentions + DMs and draft/auto-send replies. */
export async function pollXAgentReplies(): Promise<{
  ok?: boolean;
  agents?: number;
  results?: unknown[];
  error?: string;
}> {
  return (await xAgentFetch("/x-agents/poll-replies", {
    method: "POST",
    body: JSON.stringify({}),
  })) as unknown as { ok?: boolean; agents?: number; results?: unknown[]; error?: string };
}

export async function trainXAgent(payload: {
  persona?: string;
  voiceNotes?: string;
  title?: string;
  content?: string;
}): Promise<{
  agent: XAgentConfig;
  knowledge: unknown;
  knowledgeList: XAgentKnowledge[];
}> {
  return (await xAgentFetch("/x-agents/train", {
    method: "POST",
    body: JSON.stringify(payload),
  })) as unknown as {
    agent: XAgentConfig;
    knowledge: unknown;
    knowledgeList: XAgentKnowledge[];
  };
}

export async function generateXAgentPost(payload?: {
  hint?: string;
  postNow?: boolean;
}): Promise<{
  ok: boolean;
  posted: boolean;
  draft?: { text: string; kind?: string; model?: string };
  item?: XAgentQueueItem;
  tweet?: { tweetId?: string; tweetUrl?: string };
  error?: string;
  message?: string;
}> {
  return (await xAgentFetch("/x-agents/generate", {
    method: "POST",
    body: JSON.stringify(payload || {}),
  })) as unknown as {
    ok: boolean;
    posted: boolean;
    draft?: { text: string; kind?: string; model?: string };
    item?: XAgentQueueItem;
    tweet?: { tweetId?: string; tweetUrl?: string };
    error?: string;
    message?: string;
  };
}

export async function listXAgentQueue(status?: string): Promise<{ items: XAgentQueueItem[] }> {
  const q = status ? `?status=${encodeURIComponent(status)}` : "";
  return (await xAgentFetch(`/queue${q}`)) as unknown as { items: XAgentQueueItem[] };
}

export async function approveXAgentQueueItem(id: string): Promise<{ ok: boolean; result?: unknown }> {
  return (await xAgentFetch(`/queue/${id}/approve`, { method: "POST" })) as unknown as {
    ok: boolean;
    result?: unknown;
  };
}

export async function cancelXAgentQueueItem(id: string): Promise<void> {
  await xAgentFetch(`/queue/${id}`, { method: "DELETE" });
}

export async function enqueueXAgentItem(payload: {
  text: string;
  kind?: string;
  scheduledFor?: string;
  status?: string;
}): Promise<{ item: XAgentQueueItem }> {
  return (await xAgentFetch("/queue", {
    method: "POST",
    body: JSON.stringify(payload),
  })) as unknown as { item: XAgentQueueItem };
}

export async function sendXDm(payload: {
  text: string;
  username?: string;
  recipientId?: string;
}): Promise<{ ok: boolean; dmEventId?: string | null; message?: string; error?: string }> {
  return (await xAgentFetch("/dm", {
    method: "POST",
    body: JSON.stringify(payload),
  })) as unknown as { ok: boolean; dmEventId?: string | null; message?: string; error?: string };
}

export async function fetchXDmInbox(): Promise<{
  ok: boolean;
  events?: Array<{
    id: string;
    text: string;
    senderUsername?: string | null;
    createdAt?: string;
  }>;
  message?: string;
  error?: string;
}> {
  return (await xAgentFetch("/dm/inbox")) as unknown as {
    ok: boolean;
    events?: Array<{
      id: string;
      text: string;
      senderUsername?: string | null;
      createdAt?: string;
    }>;
    message?: string;
    error?: string;
  };
}

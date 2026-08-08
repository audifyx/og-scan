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
  const sessionPromise = supabase.auth.getSession();
  const timed = await Promise.race([
    sessionPromise,
    new Promise<never>((_, rej) =>
      setTimeout(() => rej(new Error("Auth session timed out — refresh and sign in again")), 8000),
    ),
  ]);
  const token = timed.data.session?.access_token;
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
      throw new Error("Server error — hard-refresh and try Save agent again.");
    }
    throw new Error(
      r.ok ? `Invalid JSON from server: ${snippet}` : `Server error (${r.status}): ${snippet}`,
    );
  }
}

async function xAgentFetch(
  path: string,
  init?: RequestInit & { timeoutMs?: number },
): Promise<Record<string, unknown>> {
  const headers = await authHeaders();
  const { timeoutMs = 15000, ...fetchInit } = init || {};
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(`${X_AGENT_API}${path}`, {
      ...fetchInit,
      signal: fetchInit.signal || ctrl.signal,
      headers: { ...headers, ...(fetchInit.headers || {}) },
    });
    const data = await readJson(r);
    if (!r.ok) {
      throw new Error(String(data.message || data.error || `Request failed (${r.status})`));
    }
    return data;
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") {
      throw new Error("Request timed out — check connection and retry");
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

export async function bootstrapXMcp(): Promise<XMcpBootstrap> {
  return (await xAgentFetch("/bootstrap", { method: "POST", timeoutMs: 12000 })) as unknown as XMcpBootstrap;
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

export type XMcpChatAuthMint = {
  ok: boolean;
  status: string;
  authenticated?: boolean;
  authCode: string;
  expiresAt?: string;
  mcpUrl?: string;
  xUsername?: string | null;
  xConnected?: boolean;
  walletAddress?: string | null;
  messages: {
    grok: string;
    claude: string;
    chatgpt: string;
    authCode: string;
  };
  message?: string;
};

/** Mint a pre-authorized X MCP authCode + paste messages (no mid-chat click). */
export async function mintXMcpChatAuth(): Promise<XMcpChatAuthMint> {
  return (await xAgentFetch("/link/create", {
    method: "POST",
    body: JSON.stringify({}),
  })) as unknown as XMcpChatAuthMint;
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

export type XCreditsBalance = {
  ok: boolean;
  balance: number;
  lifetimePurchased: number;
  lifetimeSpent: number;
  creditsPerSol: number;
  payTo: string;
  usageUrl?: string;
  shopUrl?: string;
};

export type XCreditsLedgerEntry = {
  id: string;
  kind: string;
  amount: number;
  balanceAfter: number | null;
  sol: number | null;
  txSignature: string | null;
  description: string | null;
  createdAt: string;
  explorer: string | null;
};

export type XCreditsUsage = XCreditsBalance & {
  ledger: XCreditsLedgerEntry[];
  advanced?: {
    summary: Record<string, unknown>;
    howToBuy: string[];
    ledger: XCreditsLedgerEntry[];
  };
};

export type XCreditsQuote = {
  ok: boolean;
  solAmount?: number;
  lamports?: number;
  credits?: number;
  creditsPerSol?: number;
  payTo?: string;
  rateLabel?: string;
  transactionBase64?: string;
  message?: string;
  error?: string;
};

export async function fetchXCreditsUsage(limit = 40): Promise<XCreditsUsage> {
  return (await xAgentFetch(`/credits/usage?limit=${limit}`)) as unknown as XCreditsUsage;
}

export async function fetchXCreditsBalance(): Promise<XCreditsBalance> {
  return (await xAgentFetch("/credits")) as unknown as XCreditsBalance;
}

export async function quoteXCreditsBuy(solAmount: number, publicKey?: string): Promise<XCreditsQuote> {
  return (await xAgentFetch("/credits/buy", {
    method: "POST",
    body: JSON.stringify({ solAmount, publicKey }),
  })) as unknown as XCreditsQuote;
}

export async function confirmXCreditsPurchase(signature: string): Promise<XCreditsBalance & {
  creditsAdded?: number;
  alreadyCredited?: boolean;
  message?: string;
  explorer?: string;
  signature?: string;
}> {
  return (await xAgentFetch("/credits/confirm", {
    method: "POST",
    body: JSON.stringify({ signature }),
  })) as unknown as XCreditsBalance & {
    creditsAdded?: number;
    alreadyCredited?: boolean;
    message?: string;
    explorer?: string;
    signature?: string;
  };
}

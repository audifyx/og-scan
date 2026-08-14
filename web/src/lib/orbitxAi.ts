import { supabase } from "@/lib/supabase";

export type AiGate = {
  ok?: boolean;
  hasAccess: boolean;
  meetsRequirement: boolean;
  exempt?: boolean;
  wallet?: string | null;
  mint: string;
  minUsd: number;
  holdingAmount?: number;
  priceUsd?: number | null;
  holdingUsd?: number;
  buyUrl?: string;
  holdUrl?: string;
  error?: string;
  message?: string;
};

export type AiModel = {
  id: string;
  label: string;
};

export type AiToolParameter = {
  name: string;
  type: string;
  description: string;
  required: boolean;
  options: string[];
};

export type AiToolDefinition = {
  name: string;
  description: string;
  category: string;
  requiresConfirmation: boolean;
  parameters: AiToolParameter[];
};

export type AiConversation = {
  id: string;
  title: string;
  model: string;
  walletAddress?: string | null;
  archived: boolean;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type AiToolEvent = {
  id: string;
  tool: string;
  args: Record<string, unknown>;
  status: "completed" | "failed" | "confirmation_required" | "executing";
  result: unknown;
  expiresAt?: string;
};

export type AiMessage = {
  id: string;
  conversationId: string;
  role: "user" | "assistant" | "tool" | "system";
  content: string;
  model?: string | null;
  toolEvents: AiToolEvent[];
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type AiGeneration = {
  id: string;
  conversationId?: string | null;
  kind: "image" | "video";
  prompt: string;
  provider: string;
  model: string;
  taskId?: string | null;
  status: "queued" | "waiting" | "processing" | "success" | "failed";
  resultUrls: string[];
  error?: string | null;
  settings: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  completedAt?: string | null;
};

export type AiBootstrap = {
  ok: boolean;
  gate: AiGate;
  walletAddress: string | null;
  models: AiModel[];
  defaultModel: string;
  conversations: AiConversation[];
  generations: AiGeneration[];
  tools: AiToolDefinition[];
};

type ApiErrorShape = {
  error?: string;
  message?: string;
  gate?: AiGate;
};

export class OrbitXAiError extends Error {
  status: number;
  gate?: AiGate;

  constructor(message: string, status: number, gate?: AiGate) {
    super(message);
    this.name = "OrbitXAiError";
    this.status = status;
    this.gate = gate;
  }
}

async function authHeaders(): Promise<HeadersInit> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new OrbitXAiError("Connect and sign in with your wallet first.", 401);
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

async function request<T>(
  path: string,
  init: RequestInit = {},
  timeoutMs = 90_000,
): Promise<T> {
  const headers = await authHeaders();
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`/api/orbitx-ai${path}`, {
      ...init,
      headers: { ...headers, ...(init.headers || {}) },
      signal: init.signal || controller.signal,
    });
    const payload = (await response.json().catch(() => ({}))) as T & ApiErrorShape;
    if (!response.ok) {
      throw new OrbitXAiError(
        payload.message || payload.error || `OrbitX AI request failed (${response.status})`,
        response.status,
        payload.gate,
      );
    }
    return payload;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new OrbitXAiError("OrbitX AI took too long to respond. Please retry.", 408);
    }
    throw error;
  } finally {
    window.clearTimeout(timer);
  }
}

function post<T>(action: string, body: object, timeoutMs?: number): Promise<T> {
  return request<T>(
    "",
    {
      method: "POST",
      body: JSON.stringify({ action, ...body }),
    },
    timeoutMs,
  );
}

export async function fetchAiGate(): Promise<{ gate: AiGate; walletAddress: string | null }> {
  return request("?action=gate", { method: "GET" }, 30_000);
}

export async function bootstrapOrbitXAi(): Promise<AiBootstrap> {
  return request("?action=bootstrap", { method: "GET" }, 45_000);
}

export async function fetchAiMessages(
  conversationId: string,
): Promise<{ conversation: AiConversation; messages: AiMessage[] }> {
  return request(
    `?action=messages&conversationId=${encodeURIComponent(conversationId)}`,
    { method: "GET" },
    45_000,
  );
}

export async function sendAiMessage(payload: {
  conversationId?: string | null;
  message: string;
  model?: string;
}): Promise<{
  ok: boolean;
  conversation: AiConversation;
  userMessage: AiMessage;
  assistantMessage: AiMessage;
}> {
  return post("chat", payload, 115_000);
}

export async function createAiConversation(
  model?: string,
): Promise<{ conversation: AiConversation }> {
  return post("conversation", { operation: "create", model: model || "" }, 30_000);
}

export async function deleteAiConversation(conversationId: string): Promise<void> {
  await post("conversation", { operation: "delete", conversationId }, 30_000);
}

export async function renameAiConversation(
  conversationId: string,
  title: string,
): Promise<{ conversation: AiConversation }> {
  return post("conversation", { operation: "rename", conversationId, title }, 30_000);
}

export async function generateAiMedia(payload: {
  kind: "image" | "video";
  prompt: string;
  conversationId?: string | null;
  settings: Record<string, unknown>;
}): Promise<{ ok: boolean; generation: AiGeneration }> {
  return post("media.generate", payload, 115_000);
}

export async function pollAiMedia(generationId: string): Promise<{ generation: AiGeneration }> {
  return post("media.status", { generationId }, 45_000);
}

export async function executeAiTool(payload: {
  conversationId: string;
  messageId: string;
  eventId: string;
}): Promise<{
  ok: boolean;
  event: AiToolEvent;
  message?: AiMessage | null;
}> {
  return post("tool.execute", payload, 115_000);
}

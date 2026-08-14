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
  status: "completed" | "failed" | "confirmation_required" | "executing" | "cancelled";
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

export type AiChatResult = {
  ok: boolean;
  conversation: AiConversation;
  userMessage: AiMessage;
  assistantMessage: AiMessage;
};

export type AiChatStreamEvent =
  | { type: "status"; message: string }
  | { type: "conversation"; conversation: AiConversation }
  | { type: "user_message"; message: AiMessage }
  | { type: "delta"; delta: string }
  | { type: "reset" }
  | { type: "tool"; event: AiToolEvent }
  | ({ type: "complete" } & AiChatResult)
  | { type: "error"; status: number; error: string; message: string }
  | { type: "ping"; at: number };

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
}): Promise<AiChatResult> {
  return post("chat", payload, 115_000);
}

export async function streamAiMessage(
  payload: {
    conversationId?: string | null;
    message: string;
    model?: string;
  },
  options: {
    signal?: AbortSignal;
    onEvent: (event: AiChatStreamEvent) => void;
  },
): Promise<AiChatResult> {
  const headers = await authHeaders();
  const controller = new AbortController();
  let timedOut = false;
  const abortFromCaller = () => controller.abort();
  options.signal?.addEventListener("abort", abortFromCaller, { once: true });
  const timer = window.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, 115_000);

  try {
    const response = await fetch("/api/orbitx-ai", {
      method: "POST",
      headers,
      body: JSON.stringify({ action: "chat.stream", ...payload }),
      signal: controller.signal,
    });
    if (!response.ok) {
      const errorPayload = (await response.json().catch(() => ({}))) as ApiErrorShape;
      throw new OrbitXAiError(
        errorPayload.message ||
          errorPayload.error ||
          `OrbitX AI request failed (${response.status})`,
        response.status,
        errorPayload.gate,
      );
    }
    if (!response.body) {
      throw new OrbitXAiError("Live response stream is unavailable. Please retry.", 502);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let completed: AiChatResult | null = null;

    const consume = (line: string) => {
      if (!line.trim()) return;
      let event: AiChatStreamEvent;
      try {
        event = JSON.parse(line) as AiChatStreamEvent;
      } catch {
        return;
      }
      if (event.type === "error") {
        throw new OrbitXAiError(event.message, event.status);
      }
      options.onEvent(event);
      if (event.type === "complete") {
        completed = {
          ok: event.ok,
          conversation: event.conversation,
          userMessage: event.userMessage,
          assistantMessage: event.assistantMessage,
        };
      }
    };

    while (true) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
      let newline = buffer.indexOf("\n");
      while (newline >= 0) {
        consume(buffer.slice(0, newline));
        buffer = buffer.slice(newline + 1);
        newline = buffer.indexOf("\n");
      }
      if (done) break;
    }
    if (buffer.trim()) consume(buffer);
    if (!completed) {
      throw new OrbitXAiError("OrbitX AI ended before completing its response. Please retry.", 502);
    }
    return completed;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new OrbitXAiError(
        timedOut
          ? "OrbitX AI took too long to respond. Please retry."
          : "OrbitX AI response stopped.",
        timedOut ? 408 : 499,
      );
    }
    throw error;
  } finally {
    window.clearTimeout(timer);
    options.signal?.removeEventListener("abort", abortFromCaller);
  }
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

export async function cancelAiTool(payload: {
  conversationId: string;
  messageId: string;
  eventId: string;
}): Promise<{
  ok: boolean;
  event: AiToolEvent;
}> {
  return post("tool.cancel", payload, 30_000);
}

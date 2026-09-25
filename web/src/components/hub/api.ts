/* OrbitX AI Hub — chat client for the /hub page.
   THREADS: GET/POST /api/x-mcp?path=hub/threads (+ /<id> GET/DELETE)
   CHAT:    POST /api/x-mcp?path=hub/chat {thread_id?, message}
   CONFIRM: POST /api/x-mcp?path=hub/confirm {pending_id, approved}
   MODELS:  GET  /api/x-mcp?path=hub/models
   Auth: Authorization: Bearer <supabase access_token> */

import { supabase } from "@/lib/supabase";

export const HUB_THREADS_PATH = "/api/x-mcp?path=hub/threads";
export const HUB_CHAT_PATH = "/api/x-mcp?path=hub/chat";
export const HUB_CONFIRM_PATH = "/api/x-mcp?path=hub/confirm";
export const HUB_MODELS_PATH = "/api/x-mcp?path=hub/models";

export interface HubThread {
  id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
}

export interface HubToolCall {
  name: string;
  args_summary: string;
  ok: boolean;
  result_summary: string;
  gated?: boolean;
  declined?: boolean;
}

export interface HubMessage {
  id: number;
  role: "user" | "assistant" | "tool";
  content: string | null;
  tool_calls: HubToolCall[] | null;
  created_at: string;
}

export interface HubPending {
  id: string;
  tool_name: string;
  args: Record<string, unknown> | null;
  status: string;
  created_at: string;
  /** client-side summary for display */
  args_summary?: string;
}

export interface HubChatResponse {
  ok: boolean;
  thread_id?: string;
  reply?: string;
  tool_calls?: HubToolCall[];
  pending?: { pending_id: string; tool: string; args_summary: string }[];
  model?: string;
  ms?: number;
  error?: string;
  message?: string;
}

async function authedJson(url: string, init?: RequestInit): Promise<any> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  const ct = res.headers.get("content-type") || "";
  return ct.includes("application/json") ? res.json().catch(() => ({})) : {};
}

export const hubListThreads = () => authedJson(HUB_THREADS_PATH);
export const hubCreateThread = (title?: string) =>
  authedJson(HUB_THREADS_PATH, { method: "POST", body: JSON.stringify({ title: title || "New chat" }) });
export const hubGetThread = (id: string) => authedJson(`${HUB_THREADS_PATH}/${encodeURIComponent(id)}`);
export const hubDeleteThread = (id: string) =>
  authedJson(`${HUB_THREADS_PATH}/${encodeURIComponent(id)}`, { method: "DELETE" });
export const hubChat = (thread_id: string | null, message: string, signal?: AbortSignal): Promise<HubChatResponse> =>
  authedJson(HUB_CHAT_PATH, { method: "POST", body: JSON.stringify({ thread_id, message }), signal });
export const hubConfirm = (pending_id: string, approved: boolean): Promise<HubChatResponse> =>
  authedJson(HUB_CONFIRM_PATH, { method: "POST", body: JSON.stringify({ pending_id, approved }) });
export const hubModels = () => authedJson(HUB_MODELS_PATH);

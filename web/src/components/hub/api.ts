/* OrbitX AI Hub — chat client for the /hub page.
   THREADS: GET/POST /api/x-mcp?path=hub/threads (+ /<id> GET/DELETE)
   CHAT:    POST /api/x-mcp?path=hub/chat {thread_id?, message, mode?, lang?}
   CONFIRM: POST /api/x-mcp?path=hub/confirm {pending_id, approved, mode?, lang?}
   EXPORT:  GET  /api/x-mcp?path=hub/export/trades  (text/csv download)
   MODELS:  GET  /api/x-mcp?path=hub/models
   Auth: Authorization: Bearer <supabase access_token> */

import { supabase } from "@/lib/supabase";

export const HUB_THREADS_PATH = "/api/x-mcp?path=hub/threads";
export const HUB_CHAT_PATH = "/api/x-mcp?path=hub/chat";
export const HUB_CONFIRM_PATH = "/api/x-mcp?path=hub/confirm";
export const HUB_MODELS_PATH = "/api/x-mcp?path=hub/models";
export const HUB_EXPORT_TRADES_PATH = "/api/x-mcp?path=hub/export/trades";

/** Chat personality mode, persisted per-thread client-side. */
export type HubMode = "analyst" | "degen";

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

/** A single action inside a hub_bundle pending item. */
export interface HubBundleAction {
  tool_name: string;
  args: Record<string, unknown> | null;
}

export interface HubMessage {
  id: number;
  role: "user" | "assistant" | "tool";
  content: string | null;
  tool_calls: HubToolCall[] | null;
  created_at: string;
}

/** Safety screening attached to a gated action (e.g. a token trade). */
export interface HubSafety {
  verdict: "safe" | "caution" | "danger" | "unknown";
  flags: string[];
  liquidity_usd: number | null;
  top_holder_pct: number | null;
  summary: string;
}

/** Auto price quote attached to SOL→token buy pendings. */
export interface HubQuote {
  amount_sol: number | null;
  out_amount: number | string | null;
  price_impact_pct: number | null;
  fee: number | string | null;
  raw: string | null;
}

export interface HubPending {
  id: string;
  tool_name: string;
  args: Record<string, unknown> | null;
  status: string;
  created_at: string;
  /** client-side summary for display */
  args_summary?: string;
  /** safety screening, when the backend screened this action */
  safety?: HubSafety | null;
  /** price quote, when the backend attached one */
  quote?: HubQuote | null;
  /** action list, when tool_name === "hub_bundle" (live from hub/chat) */
  bundle?: HubBundleAction[] | null;
}

/** Pending item as returned by POST hub/chat. */
export interface HubChatPending {
  pending_id: string;
  tool: string;
  args_summary: string;
  safety?: HubSafety | null;
  quote?: HubQuote | null;
  bundle?: HubBundleAction[] | null;
}

export interface HubChatResponse {
  ok: boolean;
  thread_id?: string;
  reply?: string;
  tool_calls?: HubToolCall[];
  pending?: HubChatPending[];
  model?: string;
  ms?: number;
  error?: string;
  message?: string;
}

export interface HubChatOptions {
  signal?: AbortSignal;
  mode?: HubMode;
  lang?: string;
}

export interface HubConfirmOptions {
  mode?: HubMode;
  lang?: string;
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
export const hubChat = (thread_id: string | null, message: string, opts?: HubChatOptions): Promise<HubChatResponse> =>
  authedJson(HUB_CHAT_PATH, {
    method: "POST",
    body: JSON.stringify({ thread_id, message, mode: opts?.mode, lang: opts?.lang }),
    signal: opts?.signal,
  });
export const hubConfirm = (
  pending_id: string,
  approved: boolean,
  opts?: HubConfirmOptions,
): Promise<HubChatResponse> =>
  authedJson(HUB_CONFIRM_PATH, {
    method: "POST",
    body: JSON.stringify({ pending_id, approved, mode: opts?.mode, lang: opts?.lang }),
  });
export const hubModels = () => authedJson(HUB_MODELS_PATH);

/** Authenticated GET of the trades CSV export; returns the CSV text. Throws on non-OK. */
export async function hubExportTradesCsv(): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  const res = await fetch(HUB_EXPORT_TRADES_PATH, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    const ct = res.headers.get("content-type") || "";
    let detail = res.statusText || "request failed";
    try {
      detail = ct.includes("application/json") ? JSON.stringify(await res.json()) : await res.text();
    } catch {
      /* keep status text */
    }
    throw new Error(`Export failed (${res.status}): ${detail}`.slice(0, 220));
  }
  return res.text();
}

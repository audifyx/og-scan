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
export const HUB_STREAM_PATH = "/api/x-mcp?path=hub/stream";
export const HUB_CONFIRM_PATH = "/api/x-mcp?path=hub/confirm";
export const HUB_MODELS_PATH = "/api/x-mcp?path=hub/models";
export const HUB_EXPORT_TRADES_PATH = "/api/x-mcp?path=hub/export/trades";
export const HUB_STATS_PATH = "/api/x-mcp?path=hub/stats";
export const HUB_ALERTS_PATH = "/api/x-mcp?path=hub/alerts";
export const HUB_PENDING_PATH = "/api/x-mcp?path=hub/pending";
export const HUB_SEARCH_PATH = "/api/x-mcp?path=hub/search";

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
  /** client-side: message is currently streaming in */
  streaming?: boolean;
  /** client-side: live thinking trace (tools + thoughts) */
  thinking?: HubThinking;
}

/** One tool invocation in the thinking trace. */
export interface HubThinkTool {
  name: string;
  args_summary?: string;
  ok?: boolean;
  ms?: number;
  running?: boolean;
}

/** Client-side thinking trace attached to an assistant message. */
export interface HubThinking {
  tools: HubThinkTool[];
  thoughts: string[];
  status?: string;
  ms?: number;
  /** set when the backend marked this turn degraded (done.result.degraded) —
   *  salvaged reply with forfeited tool calls, or the deterministic dossier
   *  path. The trace pill surfaces it so a degraded turn never looks clean. */
  degraded?: boolean;
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
  /** one-line plans the model stated per iteration (streamed live too) */
  thoughts?: string[];
  error?: string;
  message?: string;
  /** the backend marks turns that didn't go through the normal LLM path —
   *  salvaged reply with forfeited tool calls, or the deterministic dossier
   *  path during a dark spell. The client surfaces it in the thinking trace. */
  degraded?: boolean;
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

/** Parse complete SSE messages ("data: {...}\n\n") out of a text buffer.
 *  Pure + unit-tested. Normalizes CRLF (some proxies rewrite line endings,
 *  which would otherwise delay every event until the stream ends), skips
 *  malformed lines, and returns the unparsed remainder for the next chunk.
 *  Unknown event shapes pass through untouched — callers must tolerate them. */
export function extractSseMessages(buf: string): { events: HubStreamEvent[]; rest: string } {
  const events: HubStreamEvent[] = [];
  let rest = buf.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  let idx: number;
  while ((idx = rest.indexOf("\n\n")) !== -1) {
    const chunk = rest.slice(0, idx);
    rest = rest.slice(idx + 2);
    for (const line of chunk.split("\n")) {
      const t = line.trim();
      if (!t.startsWith("data:")) continue;
      try {
        events.push(JSON.parse(t.slice(5)) as HubStreamEvent);
      } catch {
        /* malformed SSE line — skip */
      }
    }
  }
  return { events, rest };
}

/** Pure reducer: fold one SSE stream event into the live thinking trace.
 *  tool_result completes only the FIRST matching running tool (the backend can
 *  run same-name tools in parallel — completing all of them on the first
 *  result lies about the others). Unknown events are no-ops. */
export function reduceHubThinking(t: HubThinking, e: HubStreamEvent): HubThinking {
  switch (e.event) {
    case "status":
      return { ...t, status: e.text || "" };
    case "thought":
      return e.text ? { ...t, thoughts: [...t.thoughts, e.text].slice(-4) } : t;
    case "tool_call":
      return {
        ...t,
        tools: [...t.tools, { name: e.name || "tool", args_summary: e.args_summary, running: true }],
      };
    case "tool_result": {
      const nm = e.name;
      let matched = false;
      return {
        ...t,
        tools: t.tools.map((tool) => {
          if (!matched && tool.running && (!nm || tool.name === nm)) {
            matched = true;
            return { ...tool, running: false, ok: e.ok, ms: e.ms };
          }
          return tool;
        }),
      };
    }
    default:
      return t;
  }
}

/** Streamed hub chat (SSE). Resolves with the done result, or null if the
 *  stream ended without one. Falls back to hubChat when SSE is unavailable. */
export type HubStreamEvent =
  | { event: "start" }
  | { event: "status"; text?: string }
  | { event: "token"; text?: string }
  | { event: "token_reset" }
  | { event: "thought"; text?: string }
  | { event: "tool_call"; name?: string; args_summary?: string }
  | { event: "tool_result"; name?: string; ok?: boolean; ms?: number }
  | { event: "done"; result?: HubChatResponse }
  | { event: "error"; error?: string };

/** Fold a `done` result's turn-level flags into the thinking trace. Pure.
 *  The backend marks turns that didn't go through the normal LLM path with
 *  `degraded: true` (salvaged reply with forfeited tool calls, deterministic
 *  dossier during a dark spell) — the trace pill surfaces the flag so a
 *  degraded turn never looks identical to a clean one. No-op otherwise. */
export function withDegradedFlag(t: HubThinking, r: HubChatResponse | null | undefined): HubThinking {
  return r?.degraded ? { ...t, degraded: true } : t;
}

/** Honest user-facing text for a `done` result that carries a server-side
 *  failure with no usable reply (db_unavailable, not_found, hub_chat_failed…).
 *  The backend's hub/stream route sends these shapes as `done` (not the
 *  `error` event, which is only for hubChat throwing outright), so without
 *  this the turn would end on a silent empty bubble. Returns null when the
 *  result is fine or already carries a reply (e.g. the LLM-failure path,
 *  whose human-readable error IS the reply). Pure + unit-tested. */
export function hubDoneFailureText(r: HubChatResponse | null | undefined): string | null {
  if (r && (r.ok || r.reply !== undefined)) return null;
  return `Something went wrong (${r?.error || "unknown error"}). Your message is saved — hit retry to try again.`;
}

export const hubChatStream = (
  thread_id: string | null,
  message: string,
  opts: HubChatOptions = {},
  onEvent: (e: HubStreamEvent) => void,
): Promise<HubChatResponse | null> =>
  (async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const token = session?.access_token;
    const res = await fetch(HUB_STREAM_PATH, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ thread_id, message, mode: opts.mode, lang: opts.lang }),
      signal: opts.signal,
    });
    if (!res.ok || !res.body) throw new Error(`stream_unavailable_${res.status}`);
    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("text/event-stream")) throw new Error("stream_unavailable_not_sse");
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    let doneResult: HubChatResponse | null = null;
    let sawEvent = false;
    const emit = (e: HubStreamEvent) => {
      sawEvent = true;
      if (e.event === "done") doneResult = (e.result as HubChatResponse) || null;
      // Unknown future events flow through to onEvent untouched — the caller's
      // switch must tolerate them (default branch), never crash on them.
      onEvent(e);
    };
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const parsed = extractSseMessages(buf);
      buf = parsed.rest;
      for (const e of parsed.events) emit(e);
    }
    // Flush any trailing partial message (a proxy may have swallowed the terminator).
    const tail = extractSseMessages(buf + "\n\n");
    for (const e of tail.events) emit(e);
    if (!sawEvent) throw new Error("stream_unavailable_empty");
    return doneResult;
  })();
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

/* ── Hub v2: stats, alerts, pending confirmations, full-text search ── */

export interface HubStats {
  ok: boolean;
  portfolioUsd: number | null;
  pnlUsd: number | null;
  openAlerts: number;
  activeStrategies: Record<string, number> | null;
  wallet: boolean;
}

export interface HubAlertItem {
  id: string;
  mint: string;
  symbol: string | null;
  type: string;
  condition: string | null;
  action: string | null;
  actionDesc: string | null;
  status: string;
  attempts: number;
  note: string | null;
  createdAt: string | null;
  triggeredAt: string | null;
}

export interface HubPendingShort {
  id: string;
  tool_name: string;
  args_summary: string;
  created_at: string;
}

export interface HubSearchHit {
  thread_id: string;
  thread_title: string | null;
  role: string;
  snippet: string;
  created_at: string;
}

export const hubStats = (): Promise<HubStats> => authedJson(HUB_STATS_PATH);
export const hubAlertsList = (): Promise<{ ok: boolean; alerts: HubAlertItem[] }> =>
  authedJson(HUB_ALERTS_PATH);
export const hubAlertDelete = (id: string): Promise<{ ok: boolean }> =>
  authedJson(`${HUB_ALERTS_PATH}/${encodeURIComponent(id)}`, { method: "DELETE" });
export const hubAlertMute = (id: string, muted: boolean): Promise<{ ok: boolean }> =>
  authedJson(`${HUB_ALERTS_PATH}/${encodeURIComponent(id)}/mute`, {
    method: "POST",
    body: JSON.stringify({ muted }),
  });
export const hubPendingList = (): Promise<{ ok: boolean; pendings: HubPendingShort[] }> =>
  authedJson(HUB_PENDING_PATH);
export const hubSearchMessages = (q: string): Promise<{ ok: boolean; results: HubSearchHit[] }> =>
  authedJson(`${HUB_SEARCH_PATH}?q=${encodeURIComponent(q)}`);

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

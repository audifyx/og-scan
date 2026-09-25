/* Agent OS v2 — shared API layer for the /agentplus command center.
   agent-os-v2
   FEED:    GET  /api/x-mcp?path=agentplus/feed&since=<id>&agent=<name>&limit=100
   COMMAND: POST /api/x-mcp?path=agentplus/command
            (spawn | task | send | remember | inbox | get | recall | tasks |
             files | file | write_file | delete_file | rename_file |
             think | models | usage | digest | archive)
            — read-only views pass quiet:true
   EXPORT:  GET  /api/x-mcp?path=agentplus/export&agent=<name>&kind=log|thoughts
                 (markdown download) | &kind=files|file|zip&task_id=<id>[&fpath=<p>]
   Auth: Authorization: Bearer <supabase access_token> */

import { supabase } from "@/lib/supabase";

export const AGENT_OS_VERSION = "agent-os-v2";

export const FEED_PATH = "/api/x-mcp?path=agentplus/feed";
export const COMMAND_PATH = "/api/x-mcp?path=agentplus/command";
export const EXPORT_PATH = "/api/x-mcp?path=agentplus/export";
export const POLL_MS = 2000;
export const DETAIL_POLL_MS = 10000;
export const LAST_VISIT_KEY = "agentos-last-visit";

export type AgentEventKind = "thought" | "action" | "file" | "message" | "build" | "deploy" | "error";

export interface AgentEvent {
  id: string | number;
  agent: string;
  kind: AgentEventKind | string;
  task_id?: string | null;
  body: string;
  created_at: string;
}

export interface ThinkError {
  code: string;
  hint: string;
  at: string;
}

export interface AgentInfo {
  name: string;
  status: string;
  unread: number;
  /** 'live' = real server-side LLM reasoning loop; 'driver' = no LLM key,
      advances via deterministic tick driven by an external LLM through MCP. */
  mind?: "live" | "driver" | string;
  last_think_error?: ThinkError | null;
  thinks_today?: number;
  think_budget_per_day?: number;
  active_schedules?: number;
}

export interface ScheduleInfo {
  id: string;
  agent: string | null;
  every_minutes: number | null;
  at_time: string | null;
  timezone: string;
  last_fired_at: string | null;
  next_fire_at: string;
  fail_streak: number;
  created_at: string;
}

export interface AgentDetail {
  name: string;
  role?: string | null;
  persona?: string | null;
  capabilities?: string[];
  status: string;
  model?: string | null;
  mind?: string;
  thinks_today?: number;
  think_budget_per_day?: number;
  think_day?: string;
  last_think_at?: string | null;
  last_think_error?: ThinkError | null;
  next_think_at?: string | null;
  created_at?: string;
}

export interface MemoryEntry {
  key: string;
  value: string;
  updated_at: string;
}

export interface InboxMsg {
  id: number;
  from: string;
  to: string;
  via: string;
  body: string;
  created_at: string;
}

export interface TaskStep {
  title: string;
  status: string;
  result?: string;
}

export interface TaskInfo {
  id: string;
  title: string;
  kind: string;
  status: string;
  steps?: TaskStep[] | null;
  created_at: string;
  agent?: string; // client-side attribution (kanban across agents)
}

export interface TaskFile {
  path: string;
  version: number;
  size: number;
  sha256: string;
  updated_at?: string;
}

export interface FeedResponse {
  ok: boolean;
  events?: AgentEvent[];
  agents?: AgentInfo[];
  nextCursor?: string | number | null;
}

export interface ModelsProbe {
  ok: boolean;
  baseUrl?: string;
  defaultModel?: string;
  count?: number;
  models?: string[];
  error?: string;
  message?: string;
  hint?: string;
  lastVerified?: {
    at?: string;
    ok?: boolean;
    ms?: number | null;
    prompt_tokens?: number | null;
    completion_tokens?: number | null;
  } | null;
}

export interface UsageAgent {
  agent: string;
  thinks: number;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  ms: number;
  models: string[];
}

export interface UsageResponse {
  ok: boolean;
  agents: UsageAgent[];
  totals: { thinks: number; prompt_tokens: number; completion_tokens: number; total_tokens: number; ms: number };
  daily: { day: string; thinks: number; tokens: number }[];
}

export interface DigestResponse {
  ok: boolean;
  since: string;
  totals: {
    thoughts: number;
    files: number;
    errors: number;
    actions: number;
    builds: number;
    deploys: number;
    messages: number;
    steps_advanced: number;
  };
  per_agent: { agent: string; thoughts: number; files: number; errors: number; actions: number }[];
  agents_active: number;
}

export async function authedFetch(url: string, init?: RequestInit): Promise<Response> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  return fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}

export async function postCommand(body: Record<string, unknown>) {
  const res = await authedFetch(COMMAND_PATH, { method: "POST", body: JSON.stringify(body) });
  const ct = res.headers.get("content-type") || "";
  const json = ct.includes("application/json") ? await res.json().catch(() => ({})) : {};
  if (!res.ok) throw new Error(json?.error || `Command failed (${res.status})`);
  if (json && json.ok === false) throw new Error(json?.error || "Command rejected");
  return json;
}

export async function downloadExport(agent: string, kind: "log" | "thoughts"): Promise<string> {
  const res = await authedFetch(`${EXPORT_PATH}&agent=${encodeURIComponent(agent)}&kind=${kind}`);
  if (!res.ok) throw new Error(`Export failed (${res.status})`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${agent}-${kind === "thoughts" ? "thoughts-only" : "full-log"}.md`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return a.download;
}

export function extractUrls(text: string): string[] {
  const m = text.match(/https?:\/\/[^\s)"'<>]+/g) || [];
  return [...new Set(m)];
}

export function parseFileBody(body: string): { path: string; sha: string } | null {
  try {
    const j = JSON.parse(body);
    if (j && typeof j === "object" && (j.path || j.file)) {
      return { path: String(j.path || j.file), sha: String(j.sha || j.hash || "") };
    }
  } catch {
    /* not JSON */
  }
  const m = body.match(/([^\s]+\.[a-z0-9]+)\s*(?:@|:|#|\|)?\s*([0-9a-f]{7,40})?/i);
  if (m) return { path: m[1], sha: m[2] || "" };
  return null;
}

export function formatTime(ts: string): string {
  try {
    const d = new Date(ts);
    return d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
  } catch {
    return ts;
  }
}

export function timeAgo(ts: string): string {
  try {
    const s = Math.max(1, Math.floor((Date.now() - new Date(ts).getTime()) / 1000));
    if (s < 60) return `${s}s ago`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    return `${d}d ago`;
  } catch {
    return "";
  }
}

export function taskProgress(t: TaskInfo): { done: number; total: number } {
  const steps = t.steps || [];
  const done = steps.filter((s) => s.status === "complete").length;
  return { done, total: steps.length };
}

export function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

export function fmtMs(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  return `${(s / 60).toFixed(1)}m`;
}

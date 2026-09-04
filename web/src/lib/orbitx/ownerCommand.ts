/**
 * Owner command-center client.
 * All reads go through /api/orbitx-owner (JWT + owner allowlist).
 * Never query ox_admin_* financial tables from the browser.
 */
import { supabase } from "@/lib/supabase";

export type OwnerAction =
  | "overview"
  | "health"
  | "search"
  | "user"
  | "presence"
  | "events"
  | "ledger"
  | "jupiter"
  | "burns"
  | "audit"
  | "daily";

async function token(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const t = data.session?.access_token;
  if (!t) throw new Error("Sign in as the owner account");
  return t;
}

export async function ownerCommand<T = Record<string, unknown>>(
  action: OwnerAction,
  body: Record<string, unknown> = {},
): Promise<T> {
  const res = await fetch("/api/orbitx-owner", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${await token()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ action, ...body }),
  });
  const json = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(json.error || `Owner API ${res.status}`);
  return json;
}

export async function reportPlatformTx(payload: {
  signature: string;
  wallet?: string | null;
  application?: string;
  txType?: string;
  mint?: string;
  valueUsd?: number;
  valueSol?: number;
  solUsd?: number;
  path?: string;
}): Promise<void> {
  try {
    const { data } = await supabase.auth.getSession();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (data.session?.access_token) headers.Authorization = `Bearer ${data.session.access_token}`;
    await fetch("/api/orbitx-tx-report", {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
  } catch {
    /* reporting must never block the trade UX */
  }
}

export function solscanTx(sig?: string | null): string | null {
  if (!sig) return null;
  return `https://solscan.io/tx/${sig}`;
}

export function fmtUsd(n?: number | null): string {
  const v = Number(n || 0);
  if (!Number.isFinite(v)) return "$0";
  if (v >= 1000) return `$${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  return `$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function fmtNum(n?: number | null): string {
  return Number(n || 0).toLocaleString();
}

export function liveDot(status?: string | null): string {
  if (status === "online") return "bg-emerald-400";
  if (status === "away") return "bg-amber-400";
  return "bg-white/25";
}

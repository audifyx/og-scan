import { randomUUID } from "node:crypto";

const SUPA_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const TREASURY_WALLET = "4qD4UBf9y9wRM51qHYccucAJadB24PRSEku7JWpXV6wu";
export const MICRO_CREDITS_PER_CREDIT = 1_000_000;
export const USD_PER_CREDIT = 0.01;

export type CreditReceipt = { requestId: string; usedMicrocredits: number; usedCredits: number; usdValue: number; remainingMicrocredits: number; remainingCredits: number; status: string };

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  if (!SUPA_URL || !SERVICE_KEY) throw new Error("credit_service_unconfigured");
  const response = await fetch(`${SUPA_URL}/rest/v1/rpc/${fn}`, { method: "POST", headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify(args) });
  if (!response.ok) throw new Error(`credit_rpc_${response.status}`);
  return response.json() as Promise<T>;
}

export function creditsFromUsd(usd: number): number { return Math.round(usd * 100) ; }
export function usdFromMicrocredits(microcredits: number): number { return (microcredits / MICRO_CREDITS_PER_CREDIT) * USD_PER_CREDIT; }

export async function reserveCredits(userId: string, action: string, options: { provider?: string; model?: string; requestId?: string } = {}) {
  const requestId = options.requestId || randomUUID();
  const result = await rpc<{ idempotent: boolean; transaction_id?: string; credits: number; balance: number; status?: string }>("credit_reserve", { p_user_id: userId, p_request_id: requestId, p_action: action, p_provider: options.provider || null, p_model: options.model || null });
  return { requestId, reservation: result };
}

export async function settleCredits(requestId: string, success: boolean, metadata: Record<string, unknown> = {}): Promise<CreditReceipt> {
  const result = await rpc<{ status: string; used?: number; refunded?: number; balance: number }>("credit_settle", { p_request_id: requestId, p_success: success, p_metadata: metadata });
  const usedMicrocredits = result.used || 0;
  return { requestId, usedMicrocredits, usedCredits: usedMicrocredits / MICRO_CREDITS_PER_CREDIT, usdValue: usdFromMicrocredits(usedMicrocredits), remainingMicrocredits: result.balance, remainingCredits: result.balance / MICRO_CREDITS_PER_CREDIT, status: result.status };
}

export async function withCredits<T>(userId: string, action: string, execute: () => Promise<T>, options: { provider?: string; model?: string; requestId?: string; metadata?: Record<string, unknown> } = {}) {
  const { requestId } = await reserveCredits(userId, action, options);
  try { const value = await execute(); return { value, usage: await settleCredits(requestId, true, options.metadata) }; }
  catch (error) { const usage = await settleCredits(requestId, false, { ...options.metadata, error: error instanceof Error ? error.message : "provider_failure" }); throw Object.assign(error instanceof Error ? error : new Error("mcp_action_failed"), { usage }); }
}

export { TREASURY_WALLET };

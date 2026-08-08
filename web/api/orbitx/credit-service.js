const SUPA_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
export const TREASURY_WALLET = "4qD4UBf9y9wRM51qHYccucAJadB24PRSEku7JWpXV6wu";
export const MICRO_CREDITS_PER_CREDIT = 1000000;
async function rpc(fn, args) {
  if (!SUPA_URL || !SERVICE_KEY) throw new Error("credit_service_unconfigured");
  const r = await fetch(`${SUPA_URL}/rest/v1/rpc/${fn}`, { method: "POST", headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify(args) });
  if (!r.ok) throw new Error(`credit_rpc_${r.status}`);
  return r.json();
}
export async function reserveCredits(userId, action, requestId, provider = null, model = null) { return { requestId, reservation: await rpc("credit_reserve", { p_user_id: userId, p_request_id: requestId, p_action: action, p_provider: provider, p_model: model }) }; }
export async function settleCredits(requestId, success, metadata = {}) { const result = await rpc("credit_settle", { p_request_id: requestId, p_success: success, p_metadata: metadata }); const used = Number(result.used || 0); return { requestId, usedCredits: used / MICRO_CREDITS_PER_CREDIT, usdValue: used / 100000000, remainingCredits: Number(result.balance || 0) / MICRO_CREDITS_PER_CREDIT, status: result.status }; }
export async function withCredits(userId, action, requestId, execute, options = {}) { await reserveCredits(userId, action, requestId, options.provider, options.model); try { const value = await execute(); return { value, usage: await settleCredits(requestId, true, options.metadata) }; } catch (error) { const usage = await settleCredits(requestId, false, { ...options.metadata, error: error?.message || "provider_failure" }); error.usage = usage; throw error; } }

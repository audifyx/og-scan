import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { Keypair, VersionedTransaction } from "https://esm.sh/@solana/web3.js@1.98.4?bundle";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const HELIUS_API_KEY = Deno.env.get("HELIUS_API_KEY") ?? "";
const JUPITER_API_KEY = Deno.env.get("JUPITER_API_KEY") ?? "";
const BOT_SECRET_KEY = Deno.env.get("ORBITX_BOT_SECRET_KEY") ?? "";
const OPERATOR_USER_ID = Deno.env.get("ORBITX_OPERATOR_USER_ID") ?? "";
const ALLOWED_ORIGIN = Deno.env.get("ORBITX_DASHBOARD_ORIGIN") ?? "";

const SOL_MINT = "So11111111111111111111111111111111111111112";
const headers = (origin: string | null) => ({
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN && origin === ALLOWED_ORIGIN ? origin : "null",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-idempotency-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
  Vary: "Origin",
});
const json = (origin: string | null, body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: headers(origin) });
const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const bytes = (value: string) => Uint8Array.from(atob(value), (char) => char.charCodeAt(0));

function signer() {
  const key = JSON.parse(BOT_SECRET_KEY);
  if (!Array.isArray(key) || key.length !== 64) throw new Error("ORBITX_BOT_SECRET_KEY is invalid");
  return Keypair.fromSecretKey(Uint8Array.from(key));
}

async function operator(req: Request, origin: string | null) {
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const auth = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
  const { data, error } = await auth.auth.getUser(token);
  if (error || !data.user || data.user.id !== OPERATOR_USER_ID) {
    throw new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: headers(origin) });
  }
  return data.user;
}

async function solUsd() {
  const price = await fetch(`https://api.jup.ag/price/v3?ids=${SOL_MINT}`, { headers: { "x-api-key": JUPITER_API_KEY } });
  if (!price.ok) throw new Error("Unable to fetch SOL price");
  const body = await price.json();
  const value = Number(body?.[SOL_MINT]?.usdPrice);
  if (!Number.isFinite(value) || value <= 0) throw new Error("Invalid SOL price");
  return value;
}

async function submit(tx: VersionedTransaction) {
  const rpc = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;
  const sent = await fetch(rpc, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: "orbitx-pump", method: "sendTransaction", params: [b64(tx.serialize()), { encoding: "base64", skipPreflight: false, maxRetries: 3 }] }),
  });
  const result = await sent.json();
  if (result.error || !result.result) throw new Error(result.error?.message ?? "Pump.fun transaction rejected");
  const signature = String(result.result);
  const statusResponse = await fetch(rpc, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: "orbitx-pump-status", method: "getSignatureStatuses", params: [[signature], { searchTransactionHistory: true }] }),
  });
  const status = await statusResponse.json();
  if (status?.result?.value?.[0]?.err) throw new Error("Pump.fun transaction failed on-chain");
  return signature;
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: headers(origin) });
  if (req.method !== "POST") return json(origin, { error: "Method not allowed" }, 405);
  try {
    const user = await operator(req, origin);
    if (!SUPABASE_URL || !SERVICE_ROLE || !HELIUS_API_KEY || !BOT_SECRET_KEY || !OPERATOR_USER_ID) return json(origin, { error: "Pump.fun execution is not configured" }, 503);
    const body = await req.json();
    const db = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
    const { data: settings } = await db.from("orbitx_trading_settings").select("*").eq("user_id", user.id).maybeSingle();
    const bot = signer();
    if (!settings || settings.emergency_stop || bot.publicKey.toBase58() !== settings.wallet_address) return json(origin, { error: "Trading is stopped or signer is not verified" }, 409);

    if (body.action === "claim-creator-fees") {
      const raw = await fetch("https://pumpportal.fun/api/trade-local", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicKey: bot.publicKey.toBase58(), action: "collectCreatorFee", priorityFee: 0.000001 }),
      });
      if (!raw.ok) throw new Error(`Pump.fun creator-fee claim could not be built (${raw.status})`);
      const tx = VersionedTransaction.deserialize(new Uint8Array(await raw.arrayBuffer()));
      tx.sign([bot]);
      const signature = await submit(tx);
      const { data: claim } = await db.from("orbitx_creator_fee_claims").insert({
        user_id: user.id, mint: String(body.mint ?? "all"), signature, status: "confirmed", result: { source: "pumpportal", claimedAt: new Date().toISOString() },
      }).select("*").single();
      return json(origin, { claim });
    }

    if (body.action !== "trade") return json(origin, { error: "Unknown action" }, 400);
    const side = String(body.side ?? "");
    const mint = String(body.mint ?? "");
    const amount = body.amount;
    const idempotencyKey = req.headers.get("x-idempotency-key") ?? "";
    if (!/^[0-9a-f-]{36}$/i.test(idempotencyKey) || !mint || !["buy", "sell"].includes(side)) return json(origin, { error: "Valid mint, side, and idempotency key are required" }, 400);
    const start = new Date();
    start.setUTCHours(0, 0, 0, 0);
    const { data: dailyRows } = await db.from("orbitx_execution_ledger").select("realized_pnl_usd").eq("user_id", user.id).eq("status", "confirmed").gte("created_at", start.toISOString());
    const dailyLoss = (dailyRows ?? []).reduce((sum, row) => sum + Math.min(0, Number(row.realized_pnl_usd) || 0), 0);
    if (Math.abs(dailyLoss) >= Number(settings.daily_loss_limit_usd)) return json(origin, { error: "Daily loss limit reached" }, 409);
    if (side === "buy") {
      const amountSol = Number(amount);
      const valueUsd = amountSol * await solUsd();
      if (!Number.isFinite(amountSol) || amountSol <= 0 || valueUsd > Number(settings.max_trade_usd)) return json(origin, { error: "Buy exceeds the configured USD limit" }, 409);
      const { count } = await db.from("orbitx_positions").select("*", { count: "exact", head: true }).eq("user_id", user.id).eq("status", "open");
      if ((count ?? 0) >= settings.max_open_positions) return json(origin, { error: "Maximum open positions reached" }, 409);
    }
    const { data: prior } = await db.from("orbitx_execution_ledger").select("*").eq("user_id", user.id).eq("idempotency_key", idempotencyKey).maybeSingle();
    if (prior) return json(origin, { execution: prior, idempotent: true });

    const built = await fetch("https://pumpportal.fun/api/trade-local", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ publicKey: bot.publicKey.toBase58(), action: side, mint, amount, denominatedInSol: side === "buy" ? "true" : "false", slippage: Number(settings.max_slippage_bps) / 100, priorityFee: 0.000001, pool: "pump" }),
    });
    if (!built.ok) throw new Error(`Pump.fun route could not be built (${built.status})`);
    const tx = VersionedTransaction.deserialize(new Uint8Array(await built.arrayBuffer()));
    const { data: entry, error: entryError } = await db.from("orbitx_execution_ledger").insert({
      user_id: user.id, idempotency_key: idempotencyKey, venue: "pumpfun", side, input_mint: side === "buy" ? SOL_MINT : mint,
      output_mint: side === "buy" ? mint : SOL_MINT, input_amount: String(amount), slippage_bps: settings.max_slippage_bps, quote: { provider: "pumpportal" },
    }).select("*").single();
    if (entryError || !entry) throw new Error("Failed to create execution ledger entry");
    try {
      tx.sign([bot]);
      const signature = await submit(tx);
      await db.from("orbitx_execution_ledger").update({ status: "confirmed", signature, result: { source: "pumpportal" }, updated_at: new Date().toISOString() }).eq("id", entry.id);
      return json(origin, { execution: { id: entry.id, signature, status: "confirmed" } });
    } catch (error) {
      await db.from("orbitx_execution_ledger").update({ status: "failed", failure_reason: error instanceof Error ? error.message : "Pump.fun execution failed", updated_at: new Date().toISOString() }).eq("id", entry.id);
      throw error;
    }
  } catch (error) {
    if (error instanceof Response) return error;
    return json(origin, { error: error instanceof Error ? error.message : "Internal error" }, 500);
  }
});

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { Keypair, VersionedTransaction } from "https://esm.sh/@solana/web3.js@1.98.4?bundle";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const JUPITER_API_KEY = Deno.env.get("JUPITER_API_KEY") ?? "";
const HELIUS_API_KEY = Deno.env.get("HELIUS_API_KEY") ?? "";
const BOT_SECRET_KEY = Deno.env.get("ORBITX_BOT_SECRET_KEY") ?? "";
const OPERATOR_USER_ID = Deno.env.get("ORBITX_OPERATOR_USER_ID") ?? "";
const ALLOWED_ORIGIN = Deno.env.get("ORBITX_DASHBOARD_ORIGIN") ?? "";
const SOL_MINT = "So11111111111111111111111111111111111111112";

const cors = (origin: string | null) => ({
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN && origin === ALLOWED_ORIGIN ? origin : "null",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-idempotency-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
  Vary: "Origin",
});

function response(origin: string | null, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: cors(origin) });
}

function asSecretKey(value: string) {
  const bytes = JSON.parse(value);
  if (!Array.isArray(bytes) || bytes.length !== 64) throw new Error("ORBITX_BOT_SECRET_KEY must be a 64-byte JSON keypair array");
  return Keypair.fromSecretKey(Uint8Array.from(bytes));
}

function toBytes(base64: string) {
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}

function toBase64(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

async function requireOperator(req: Request, origin: string | null) {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  if (!token || !SUPABASE_URL || !ANON_KEY || !OPERATOR_USER_ID) {
    throw new Response(JSON.stringify({ error: "Operator authentication is not configured" }), { status: 503, headers: cors(origin) });
  }
  const authClient = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
  const { data, error } = await authClient.auth.getUser(token);
  if (error || !data.user || data.user.id !== OPERATOR_USER_ID) {
    throw new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: cors(origin) });
  }
  return data.user;
}

async function jupiter(path: string, init?: RequestInit) {
  if (!JUPITER_API_KEY) throw new Error("Jupiter API key is not configured");
  const result = await fetch(`https://api.jup.ag${path}`, {
    ...init,
    headers: { "x-api-key": JUPITER_API_KEY, ...(init?.headers ?? {}) },
  });
  if (!result.ok) throw new Error(`Jupiter request failed (${result.status})`);
  return await result.json();
}

function numberValue(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(origin) });
  if (req.method !== "POST") return response(origin, { error: "Method not allowed" }, 405);

  try {
    const user = await requireOperator(req, origin);
    if (!SERVICE_ROLE || !BOT_SECRET_KEY) return response(origin, { error: "Live execution is not configured" }, 503);
    const body = await req.json();
    const action = String(body.action ?? "status");
    const db = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
    const { data: settings, error: settingsError } = await db
      .from("orbitx_trading_settings")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();
    if (settingsError || !settings) return response(origin, { error: "Trading settings are not configured" }, 409);

    const signer = asSecretKey(BOT_SECRET_KEY);
    const signerMatches = signer.publicKey.toBase58() === settings.wallet_address;
    const healthy = Boolean(JUPITER_API_KEY && signerMatches && !settings.emergency_stop);

    if (action === "status") {
      const { data: positions } = await db.from("orbitx_positions").select("*").eq("user_id", user.id).eq("status", "open");
      const start = new Date();
      start.setUTCHours(0, 0, 0, 0);
      const { data: today } = await db.from("orbitx_execution_ledger")
        .select("realized_pnl_usd")
        .eq("user_id", user.id)
        .eq("status", "confirmed")
        .gte("created_at", start.toISOString());
      const dailyLoss = (today ?? []).reduce((sum, row) => sum + Math.min(0, numberValue(row.realized_pnl_usd)), 0);
      let walletBalanceSol = 0;
      let walletBalanceUsd = 0;
      if (HELIUS_API_KEY && JUPITER_API_KEY) {
        const [balanceResponse, prices] = await Promise.all([
          fetch(`https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ jsonrpc: "2.0", id: "orbitx-status", method: "getBalance", params: [signer.publicKey.toBase58()] }),
          }),
          jupiter(`/price/v3?ids=${SOL_MINT}`),
        ]);
        const balance = await balanceResponse.json();
        walletBalanceSol = numberValue(balance?.result?.value) / 1_000_000_000;
        walletBalanceUsd = walletBalanceSol * numberValue(prices?.[SOL_MINT]?.usdPrice);
      }
      return response(origin, {
        healthy,
        walletAddress: signer.publicKey.toBase58(),
        autoTrading: settings.auto_trading,
        emergencyStop: settings.emergency_stop,
        limits: {
          maxTradeUsd: Number(settings.max_trade_usd),
          dailyLossLimitUsd: Number(settings.daily_loss_limit_usd),
          maxOpenPositions: settings.max_open_positions,
          maxSlippageBps: settings.max_slippage_bps,
        },
        openPositions: positions?.length ?? 0,
        dailyRealizedPnlUsd: dailyLoss,
        walletBalanceSol,
        walletBalanceUsd,
      });
    }

    if (action === "emergency-stop") {
      await db.from("orbitx_trading_settings").update({ emergency_stop: true, auto_trading: false, updated_at: new Date().toISOString() }).eq("user_id", user.id);
      return response(origin, { ok: true, emergencyStop: true });
    }

    if (action === "resume") {
      if (!JUPITER_API_KEY || !signerMatches) return response(origin, { error: "Signer or Jupiter configuration is not ready" }, 409);
      await db.from("orbitx_trading_settings").update({ emergency_stop: false, updated_at: new Date().toISOString() }).eq("user_id", user.id);
      return response(origin, { ok: true, emergencyStop: false });
    }

    if (action !== "execute") return response(origin, { error: "Unknown action" }, 400);
    if (!healthy) return response(origin, { error: "Trading is not ready or is stopped" }, 409);

    const idempotencyKey = req.headers.get("x-idempotency-key") ?? "";
    const inputMint = String(body.inputMint ?? "");
    const outputMint = String(body.outputMint ?? "");
    const amount = String(body.amount ?? "");
    const side = String(body.side ?? "buy");
    const slippageBps = Number(body.slippageBps ?? settings.max_slippage_bps);
    if (!crypto.randomUUID || !/^[0-9a-f-]{36}$/i.test(idempotencyKey)) return response(origin, { error: "A UUID idempotency key is required" }, 400);
    const validRoute = (side === "buy" && inputMint === SOL_MINT && outputMint !== SOL_MINT)
      || (side === "sell" && inputMint !== SOL_MINT && outputMint === SOL_MINT);
    if (!inputMint || !outputMint || !/^\d+$/.test(amount) || !["buy", "sell"].includes(side) || !validRoute) {
      return response(origin, { error: "Buys must spend SOL and sells must return SOL" }, 400);
    }
    if (!Number.isInteger(slippageBps) || slippageBps < 1 || slippageBps > settings.max_slippage_bps) {
      return response(origin, { error: "Slippage exceeds the configured limit" }, 400);
    }

    const { data: prior } = await db.from("orbitx_execution_ledger").select("*").eq("user_id", user.id).eq("idempotency_key", idempotencyKey).maybeSingle();
    if (prior) return response(origin, { execution: prior, idempotent: true });

    const { count: openCount } = await db.from("orbitx_positions").select("*", { count: "exact", head: true }).eq("user_id", user.id).eq("status", "open");
    if (side === "buy" && (openCount ?? 0) >= settings.max_open_positions) return response(origin, { error: "Maximum open positions reached" }, 409);

    const start = new Date();
    start.setUTCHours(0, 0, 0, 0);
    const { data: lossRows } = await db.from("orbitx_execution_ledger").select("realized_pnl_usd").eq("user_id", user.id).eq("status", "confirmed").gte("created_at", start.toISOString());
    const dailyLoss = (lossRows ?? []).reduce((sum, row) => sum + Math.min(0, numberValue(row.realized_pnl_usd)), 0);
    if (Math.abs(dailyLoss) >= Number(settings.daily_loss_limit_usd)) return response(origin, { error: "Daily loss limit reached" }, 409);

    const order = await jupiter(`/swap/v2/order?inputMint=${encodeURIComponent(inputMint)}&outputMint=${encodeURIComponent(outputMint)}&amount=${encodeURIComponent(amount)}&taker=${encodeURIComponent(signer.publicKey.toBase58())}&slippageBps=${slippageBps}`);
    if (!order?.transaction || !order?.requestId) throw new Error("Jupiter returned no executable route");
    const priceData = await jupiter(`/price/v3?ids=${SOL_MINT}`);
    const solUsd = numberValue(priceData?.[SOL_MINT]?.usdPrice);
    const solLamports = side === "buy" ? Number(amount) : numberValue(order.outAmount);
    const requestedValueUsd = (solLamports / 1_000_000_000) * solUsd;
    if (!solUsd || requestedValueUsd <= 0 || requestedValueUsd > Number(settings.max_trade_usd)) {
      return response(origin, { error: "Trade exceeds the configured USD limit" }, 409);
    }

    const { data: pending, error: pendingError } = await db.from("orbitx_execution_ledger").insert({
      user_id: user.id, idempotency_key: idempotencyKey, venue: "jupiter", side, input_mint: inputMint,
      output_mint: outputMint, input_amount: amount, requested_value_usd: requestedValueUsd, slippage_bps: slippageBps,
      quote: order, status: "pending",
    }).select("*").single();
    if (pendingError || !pending) throw new Error("Failed to create execution ledger entry");

    try {
      const transaction = VersionedTransaction.deserialize(toBytes(order.transaction));
      transaction.sign([signer]);
      const execution = await jupiter("/swap/v2/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signedTransaction: toBase64(transaction.serialize()), requestId: order.requestId, lastValidBlockHeight: order.lastValidBlockHeight }),
      });
      const signature = String(execution.signature ?? execution.txid ?? "");
      const status = execution.status === "Success" || Boolean(signature) ? "confirmed" : "failed";
      await db.from("orbitx_execution_ledger").update({
        status, signature: signature || null, output_amount: execution.outputAmount ?? null, result: execution, updated_at: new Date().toISOString(),
      }).eq("id", pending.id);
      if (status !== "confirmed") return response(origin, { error: "Transaction was not confirmed", execution }, 502);

      if (side === "buy") {
        await db.from("orbitx_positions").upsert({
          user_id: user.id, mint: outputMint, quantity: numberValue(execution.outputAmount), cost_basis_usd: requestedValueUsd, status: "open",
        }, { onConflict: "user_id,mint" });
      }
      return response(origin, { execution: { id: pending.id, status, signature, result: execution } });
    } catch (executionError) {
      await db.from("orbitx_execution_ledger").update({
        status: "failed", failure_reason: executionError instanceof Error ? executionError.message : "Execution failed", updated_at: new Date().toISOString(),
      }).eq("id", pending.id);
      throw executionError;
    }
  } catch (error) {
    if (error instanceof Response) return error;
    return response(origin, { error: error instanceof Error ? error.message : "Internal error" }, 500);
  }
});

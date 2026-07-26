/**
 * OrbitX World — trade ingest / confirmation hook.
 * Accepts confirmed Jupiter/pump swap payloads and records oxw_trade_history
 * + optional XP award. Worker-secret protected.
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { oxwJson, oxwOptions } from "../_shared/oxw_cors.ts";

const URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WORKER = Deno.env.get("OXW_WORKER_SECRET") || "";

Deno.serve(async (req) => {
  const opt = oxwOptions(req);
  if (opt) return opt;
  try {
    const secret = req.headers.get("x-oxw-worker-secret");
    if (!WORKER || secret !== WORKER) return oxwJson({ error: "forbidden" }, 403);
    const body = await req.json();
    if (!body.userId || !body.wallet || !body.signature) {
      return oxwJson({ error: "userId, wallet, signature required" }, 400);
    }
    const db = createClient(URL, SERVICE, { auth: { persistSession: false } });

    const existing = await db.from("oxw_trade_history").select("id").eq("signature", body.signature).maybeSingle();
    if (existing.data?.id) return oxwJson({ trade: existing.data, deduped: true });

    const { data, error } = await db
      .from("oxw_trade_history")
      .insert({
        user_id: body.userId,
        wallet: body.wallet,
        chain: body.chain ?? "solana",
        side: body.side ?? "swap",
        input_mint: body.inputMint,
        output_mint: body.outputMint,
        input_amount: body.inputAmount,
        output_amount: body.outputAmount,
        price_usd: body.priceUsd ?? null,
        value_usd: body.valueUsd ?? null,
        signature: body.signature,
        venue: body.venue ?? "jupiter",
        status: "confirmed",
        meta: body.meta ?? {},
      })
      .select("*")
      .single();
    if (error) return oxwJson({ error: error.message }, 400);

    if (body.awardXp) {
      await db.rpc("oxw_award_xp", {
        p_user_id: body.userId,
        p_amount: Number(body.awardXp) || 25,
        p_reason: "confirmed_trade",
        p_source: "trade",
        p_ref_type: "trade",
        p_ref_id: data.id,
        p_meta: { signature: body.signature },
      });
    }

    await db.from("oxw_onchain_events").insert({
      chain: body.chain ?? "solana",
      event_type: "swap",
      mint: body.outputMint,
      signature: body.signature,
      payload: body,
    });

    return oxwJson({ trade: data });
  } catch (e) {
    return oxwJson({ error: (e as Error).message }, 500);
  }
});

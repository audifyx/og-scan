/**
 * OrbitX World — token risk / holder scan cache writer.
 * Wraps existing scanner outputs into oxw_token_intel for low-latency reads.
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
    if (!body.mint) return oxwJson({ error: "mint required" }, 400);

    const db = createClient(URL, SERVICE, { auth: { persistSession: false } });
    const { data, error } = await db
      .from("oxw_token_intel")
      .upsert({
        mint: body.mint,
        chain: body.chain ?? "solana",
        symbol: body.symbol ?? null,
        name: body.name ?? null,
        risk_score: body.riskScore ?? null,
        risk_flags: body.riskFlags ?? [],
        holder_count: body.holderCount ?? null,
        top10_pct: body.top10Pct ?? null,
        liquidity_usd: body.liquidityUsd ?? null,
        mcap_usd: body.mcapUsd ?? null,
        dev_wallet: body.devWallet ?? null,
        last_scanned_at: new Date().toISOString(),
        raw: body.raw ?? body,
      })
      .select("*")
      .single();
    if (error) return oxwJson({ error: error.message }, 400);

    await db.from("oxw_onchain_events").insert({
      chain: body.chain ?? "solana",
      event_type: "token_scan",
      mint: body.mint,
      payload: { risk_score: body.riskScore, flags: body.riskFlags ?? [] },
    });

    return oxwJson({ intel: data });
  } catch (e) {
    return oxwJson({ error: (e as Error).message }, 500);
  }
});

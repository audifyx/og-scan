/**
 * OrbitX World — award XP worker (service role).
 * POST { userId, amount, reason, source?, refType?, refId?, meta? }
 * Auth: Authorization Bearer service role OR x-oxw-worker-secret
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
    if (!body.userId || typeof body.amount !== "number" || !body.reason) {
      return oxwJson({ error: "userId, amount, reason required" }, 400);
    }
    const db = createClient(URL, SERVICE, { auth: { persistSession: false } });
    const { data, error } = await db.rpc("oxw_award_xp", {
      p_user_id: body.userId,
      p_amount: body.amount,
      p_reason: body.reason,
      p_source: body.source ?? "system",
      p_ref_type: body.refType ?? null,
      p_ref_id: body.refId ?? null,
      p_meta: body.meta ?? {},
    });
    if (error) return oxwJson({ error: error.message }, 400);
    return oxwJson({ progression: data });
  } catch (e) {
    return oxwJson({ error: (e as Error).message }, 500);
  }
});

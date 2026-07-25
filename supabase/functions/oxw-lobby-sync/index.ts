/**
 * OrbitX World — lobby directory sync worker.
 * Aggregates oxw_lobby_members counts into oxw_lobbies.player_count.
 * Intended for cron every 30–60s.
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

    const db = createClient(URL, SERVICE, { auth: { persistSession: false } });
    const { data: lobbies, error } = await db.from("oxw_lobbies").select("id").neq("status", "archived");
    if (error) return oxwJson({ error: error.message }, 400);

    let updated = 0;
    for (const lobby of lobbies ?? []) {
      const { count } = await db
        .from("oxw_lobby_members")
        .select("*", { count: "exact", head: true })
        .eq("lobby_id", lobby.id)
        .is("left_at", null);
      const player_count = count ?? 0;
      const { error: uerr } = await db
        .from("oxw_lobbies")
        .update({
          player_count,
          status: player_count >= 256 ? "full" : "open",
          updated_at: new Date().toISOString(),
        })
        .eq("id", lobby.id)
        .neq("status", "closed");
      if (!uerr) updated += 1;
    }
    return oxwJson({ ok: true, updated });
  } catch (e) {
    return oxwJson({ error: (e as Error).message }, 500);
  }
});

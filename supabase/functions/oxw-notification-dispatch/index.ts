/**
 * OrbitX World — notification dispatch worker.
 * POST { userId, kind, title, body?, payload? } or batch { notifications: [...] }
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
    const rows = Array.isArray(body.notifications)
      ? body.notifications
      : [{ userId: body.userId, kind: body.kind, title: body.title, body: body.body, payload: body.payload }];

    const insert = rows.map((n: { userId: string; kind: string; title: string; body?: string; payload?: unknown }) => ({
      user_id: n.userId,
      kind: n.kind,
      title: n.title,
      body: n.body ?? "",
      payload: n.payload ?? {},
    }));

    if (!insert.length || insert.some((r: { user_id?: string; kind?: string; title?: string }) => !r.user_id || !r.kind || !r.title)) {
      return oxwJson({ error: "invalid notifications payload" }, 400);
    }

    const db = createClient(URL, SERVICE, { auth: { persistSession: false } });
    const { data, error } = await db.from("oxw_notifications").insert(insert).select("id");
    if (error) return oxwJson({ error: error.message }, 400);
    return oxwJson({ inserted: data?.length ?? 0, ids: (data ?? []).map((d) => d.id) });
  } catch (e) {
    return oxwJson({ error: (e as Error).message }, 500);
  }
});

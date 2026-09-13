import { send, dbInsert, readBody } from "../_lib.js";
export default async function handler(req, res) {
  if (req.method !== "POST") return send(res, 405, { ok: false });
  try {
    const b = await readBody(req);
    await dbInsert("ogdex_events", {
      type: String(b.type || "page_view").slice(0, 40),
      path: b.path ? String(b.path).slice(0, 300) : null,
      token_ref: b.token_ref ? String(b.token_ref).slice(0, 100) : null,
      meta: b.meta || {},
    });
    return send(res, 200, { ok: true });
  } catch (e) {
    return send(res, 200, { ok: false, error: String(e?.message || e) });
  }
}

// report-view — serves a stored OG Scan report as proper, renderable HTML.
//
// Supabase public storage serves objects with `content-type: text/plain`,
// `x-content-type-options: nosniff` and a locked CSP (default-src 'none'; sandbox),
// so report HTML never renders from the storage URL — not in an app iframe and
// not for anyone the link is shared with. This function reads the stored HTML
// (service role) and returns it with text/html so it renders everywhere.
//
// GET /report-view?id=<reportId>   (preferred)
// GET /report-view?path=<file.html>
// Deploy with --no-verify-jwt (public, shareable links).

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const notFound = (msg = "Report not found") =>
  new Response(`<!doctype html><meta charset=utf-8><body style="font:16px system-ui;background:#0b0b0f;color:#aaa;padding:40px">${msg}</body>`,
    { status: 404, headers: { "Content-Type": "text/html; charset=utf-8" } });

async function htmlFor(id: string | null, path: string | null): Promise<string | null> {
  let filePath = path;
  if (!filePath && id) {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/reports?select=html_path&id=eq.${encodeURIComponent(id)}&limit=1`,
      { headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}` } },
    );
    const rows = await r.json().catch(() => []);
    filePath = Array.isArray(rows) && rows[0]?.html_path ? rows[0].html_path : null;
  }
  if (!filePath) return null;
  // Only allow simple file names inside the reports bucket.
  if (!/^[\w./-]+$/.test(filePath) || filePath.includes("..")) return null;
  const obj = await fetch(`${SUPABASE_URL}/storage/v1/object/reports/${filePath}`, {
    headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}` },
  });
  if (!obj.ok) return null;
  return await obj.text();
}

Deno.serve(async (req) => {
  try {
    const u = new URL(req.url);
    const id = u.searchParams.get("id");
    const path = u.searchParams.get("path");
    if (!id && !path) return notFound("Missing report id");
    const html = await htmlFor(id, path);
    if (html == null) return notFound();
    return new Response(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=300",
        // Allow framing from the app + sharing; do NOT set nosniff or a strict CSP.
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (e) {
    return notFound("Error: " + (e as Error).message);
  }
});

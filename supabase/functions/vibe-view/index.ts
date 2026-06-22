// vibe-view — serves a vibecoded page from storage with a real text/html
// content-type so it renders in the browser (the raw storage URL serves
// text/plain + nosniff). verify_jwt=false.
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  const id = new URL(req.url).searchParams.get("id") || "";
  if (!/^[0-9a-fA-F-]{36}$/.test(id)) return new Response("Not found", { status: 404 });
  const r = await fetch(`${SUPABASE_URL}/storage/v1/object/reports/vibe/${id}.html`, {
    headers: { Authorization: `Bearer ${SERVICE_ROLE}`, apikey: SERVICE_ROLE },
  });
  if (!r.ok) return new Response("Not found", { status: 404 });
  const html = await r.text();
  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
});

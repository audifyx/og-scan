import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

function authorized(req: Request): boolean {
  const secrets = [
    Deno.env.get("X_REPLY_BOT_SECRET") || "",
    Deno.env.get("ORBITX_INTERNAL_SECRET") || "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
  ].map((s) => s.trim()).filter(Boolean);
  if (!secrets.length) return false;
  const auth = req.headers.get("authorization") || "";
  const bearer = /^bearer\s+/i.test(auth) ? auth.replace(/^bearer\s+/i, "").trim() : "";
  const hdr = (req.headers.get("x-orbitx-reply-secret") || "").trim();
  return secrets.some((secret) => secret === bearer || secret === hdr);
}

serve(async (req) => {
  if (req.method === "GET") {
    return new Response(JSON.stringify({ status: "disabled", auth: "required" }), {
      headers: { "Content-Type": "application/json" },
    });
  }
  if (!authorized(req)) {
    return new Response(
      JSON.stringify({
        error: "unauthorized",
        message: "ai-reply-webhook is locked. Use X MCP with the caller's own connected X account.",
      }),
      { status: 401, headers: { "Content-Type": "application/json" } },
    );
  }
  return new Response(
    JSON.stringify({
      error: "disabled",
      message: "Public AI reply posting is disabled. Mentions go through the secret-gated x-reply-bot; MCP posts use the user's own X token.",
    }),
    { status: 410, headers: { "Content-Type": "application/json" } },
  );
});

/** Shared CORS for OrbitX World edge functions. */
export const oxwCors: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-oxw-worker-secret",
  "Content-Type": "application/json",
};

export function oxwJson(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: oxwCors });
}

export function oxwOptions(req: Request): Response | null {
  if (req.method === "OPTIONS") return new Response("ok", { headers: oxwCors });
  return null;
}

/**
 * Pages Function — proxy /api/* to the Render API.
 * Cloudflare Pages _redirects CANNOT proxy to external domains (200 rewrites
 * only support relative URLs on the same site), so /api/* must be proxied by
 * a Function. This is what makes orbitx.world/api/mcp answer as a real MCP
 * server (POST initialize) instead of 405 / SPA fallback, and what makes the
 * frontend's relative /api/ calls (Money flow, screener, etc.) reach Render.
 */
const API_ORIGIN = "https://orbitx-platform-api.onrender.com";

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const target = `${API_ORIGIN}${url.pathname}${url.search}`;
  const headers = new Headers(context.request.headers);
  headers.delete("host");
  const method = context.request.method;
  const init = {
    method,
    headers,
    redirect: "manual",
  };
  if (method !== "GET" && method !== "HEAD") {
    init.body = await context.request.arrayBuffer();
  }
  const res = await fetch(target, init);
  return res;
}

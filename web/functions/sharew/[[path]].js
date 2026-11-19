/**
 * Pages Function — proxy /sharew/* to the Render API, which renders the OG
 * unfurl card for a wallet (wallet-og). Without this, Pages serves the SPA
 * shell for /sharew/<address> and wallet link previews show generic meta.
 */
const API_ORIGIN = "https://orbitx-platform-api.onrender.com";

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const target = `${API_ORIGIN}${url.pathname}${url.search}`;
  const headers = new Headers(context.request.headers);
  headers.delete("host");
  const method = context.request.method;
  const init = { method, headers, redirect: "manual" };
  if (method !== "GET" && method !== "HEAD") {
    init.body = await context.request.arrayBuffer();
  }
  return fetch(target, init);
}

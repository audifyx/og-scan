/**
 * Local dev-only server for the OrbitX DEX API.
 *
 * In production the DEX frontend (this `ogdex` app) is served on the same
 * origin as the Vercel serverless function `web/api/ogdex.js`, so its
 * `/api/ogdex/*` fetches resolve. In local `vite` dev there is no such backend,
 * so those calls 404 and the screener / scanner / search show no data.
 *
 * This tiny server imports that same handler and serves `/api/ogdex/*` on
 * http://localhost:3001. Run it alongside `vite --config vite.config.proxy.ts`
 * (which proxies `/api` to this port). Most routes (screener, token, health,
 * search, ath, chart) work against public APIs with no keys required.
 */
import http from "node:http";
import handler from "../api/ogdex.js";

const PORT = Number(process.env.OGDEX_API_PORT || 3001);

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (!url.pathname.startsWith("/api/ogdex")) {
      res.statusCode = 404;
      res.end("not found");
      return;
    }
    // Emulate the Vercel rewrite: /api/ogdex/<path>?... -> ?path=<path>
    const rest = url.pathname.replace(/^\/api\/ogdex\/?/, "");
    const query = {};
    for (const [k, v] of url.searchParams.entries()) query[k] = v;
    if (!query.path && rest) query.path = rest;
    req.query = query;

    res.status = (c) => { res.statusCode = c; return res; };
    res.json = (obj) => {
      if (!res.getHeader("content-type")) res.setHeader("content-type", "application/json");
      res.end(JSON.stringify(obj));
      return res;
    };
    res.send = (b) => { res.end(typeof b === "string" ? b : JSON.stringify(b)); return res; };

    await handler(req, res);
  } catch (e) {
    console.error("[ogdex-api] error", e);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: String((e && e.message) || e) }));
    }
  }
});

server.listen(PORT, () => console.log(`[ogdex-api] dev server on http://localhost:${PORT}`));

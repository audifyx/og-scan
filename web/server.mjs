/**
 * OrbitX Platform API server for Render (free tier).
 *
 * Serves the EXISTING web/api/ handlers (the same code Vercel runs) behind a
 * plain node:http server. Run under tsx so the .ts handlers load:
 *   npx tsx server.mjs
 *
 * Routing mirrors web/vercel.json rewrites. The handlers all export
 * `default async function handler(req, res)` and expect a Vercel-style req
 * (req.query, req.body, req.url, req.method, req.headers) and a res that
 * supports both Node style (res.statusCode / res.setHeader / res.end) and
 * Express style (res.status(n).json(obj)).
 *
 * The request body is buffered once, then re-exposed as a readable stream,
 * so handlers that read req.body AND handlers that read the raw stream
 * (for await / req.on('data')) both work.
 *
 * CORS allows the Cloudflare Pages frontend (*.pages.dev, orbitx.world)
 * and localhost. No keep-alive cron: this service sleeps after 15 min idle
 * and wakes on demand (~1 min cold start).
 */
import http from "node:http";
import { Readable } from "node:stream";

// --- Handlers (same files Vercel runs; tsx loads the .ts ones) ---
import mcpHandler from "./api/mcp.js";
import ogdexHandler from "./api/ogdex.js";
import orbitxHubHandler from "./api/orbitx-hub.js";
import telegramMcpHandler from "./api/telegram-mcp.js";
import webHandler from "./api/web.js";
import xMcpHandler from "./api/x-mcp.js";
import authLoginHandler from "./api/auth-login.ts";
import authWeb3Handler from "./api/auth-web3.ts";

const PORT = Number(process.env.PORT || 10000);
const SUPABASE_URL = (process.env.SUPABASE_URL || "https://ibojtmeqgzabgeiwbvhf.supabase.co").replace(/\/$/, "");

const ALLOWED_ORIGINS = [
  "https://orbitx.world",
  "https://www.orbitx.world",
];

function isAllowedOrigin(origin) {
  if (!origin) return true;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  try {
    const u = new URL(origin);
    return u.hostname.endsWith(".pages.dev") || u.hostname === "localhost" || u.hostname === "127.0.0.1";
  } catch {
    return false;
  }
}

function corsHeaders(req) {
  const origin = req.headers.origin;
  return {
    "Access-Control-Allow-Origin": isAllowedOrigin(origin) ? (origin || "*") : "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
    "Access-Control-Max-Age": "86400",
  };
}

/** Res shim: Node-style + Express-style, backed by the real ServerResponse. */
function makeRes(rawRes, req) {
  const headers = corsHeaders(req);
  let statusCode = 200;
  let ended = false;
  const shim = {
    get statusCode() { return statusCode; },
    set statusCode(v) { statusCode = v; },
    setHeader(name, value) { headers[name] = value; return shim; },
    getHeader(name) { return headers[name]; },
    removeHeader(name) { delete headers[name]; },
    writeHead(code, hdrs) {
      statusCode = code;
      if (hdrs) Object.assign(headers, hdrs);
      return shim;
    },
    status(code) { statusCode = code; return shim; },
    json(obj) {
      if (ended) return shim;
      ended = true;
      const body = JSON.stringify(obj ?? null);
      rawRes.writeHead(statusCode, { ...headers, "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) });
      rawRes.end(body);
      return shim;
    },
    send(body) {
      if (ended) return shim;
      ended = true;
      if (body !== undefined && typeof body === "object" && !Buffer.isBuffer(body)) return shim.json(body);
      const s = body === undefined ? "" : String(body);
      rawRes.writeHead(statusCode, { ...headers, "Content-Length": Buffer.byteLength(s) });
      rawRes.end(s);
      return shim;
    },
    write(chunk) { rawRes.write(chunk); return true; },
    end(chunk) {
      if (ended) return shim;
      ended = true;
      if (chunk !== undefined) {
        const s = typeof chunk === "string" || Buffer.isBuffer(chunk) ? chunk : JSON.stringify(chunk);
        rawRes.writeHead(statusCode, { ...headers, "Content-Length": Buffer.byteLength(s) });
        rawRes.end(s);
      } else {
        rawRes.writeHead(statusCode, headers);
        rawRes.end();
      }
      return shim;
    },
  };
  return shim;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function parseQuery(searchParams) {
  const q = {};
  for (const [k, v] of searchParams) {
    if (k in q) {
      q[k] = Array.isArray(q[k]) ? [...q[k], v] : [q[k], v];
    } else q[k] = v;
  }
  return q;
}

/** Build the Vercel-style req: a readable stream of the buffered body + query/body props. */
function makeReq(origReq, internalUrl, bodyBuf) {
  const u = new URL(internalUrl, "http://x");
  const stream = bodyBuf.length ? Readable.from([bodyBuf]) : Readable.from([]);
  stream.method = origReq.method;
  stream.url = u.pathname + u.search;
  stream.headers = origReq.headers;
  stream.socket = origReq.socket;
  stream.query = parseQuery(u.searchParams);
  const ct = (origReq.headers["content-type"] || "").toLowerCase();
  if (bodyBuf.length && ct.includes("application/json")) {
    try { stream.body = JSON.parse(bodyBuf.toString("utf8")); }
    catch { stream.body = undefined; }
  } else if (bodyBuf.length && ct.includes("application/x-www-form-urlencoded")) {
    stream.body = Object.fromEntries(new URLSearchParams(bodyBuf.toString("utf8")));
  } else if (bodyBuf.length) {
    stream.body = bodyBuf.toString("utf8");
  } else {
    stream.body = undefined;
  }
  return stream;
}

function sendJson(rawRes, req, obj, status = 200) {
  const headers = corsHeaders(req);
  const body = JSON.stringify(obj);
  rawRes.writeHead(status, { ...headers, "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) });
  rawRes.end(body);
}

/** Proxy an incoming request to an external URL (Supabase edge functions, predictions). */
async function proxyTo(rawRes, req, targetUrl, bodyBuf) {
  try {
    const headers = { ...req.headers };
    delete headers.host;
    delete headers["content-length"];
    const r = await fetch(targetUrl, {
      method: req.method,
      headers,
      body: ["GET", "HEAD"].includes(req.method) ? undefined : bodyBuf,
    });
    const outHeaders = {};
    for (const [k, v] of r.headers) {
      if (!["content-length", "content-encoding", "connection"].includes(k.toLowerCase())) outHeaders[k] = v;
    }
    Object.assign(outHeaders, corsHeaders(req));
    const buf = Buffer.from(await r.arrayBuffer());
    rawRes.writeHead(r.status, outHeaders);
    rawRes.end(buf);
  } catch (e) {
    sendJson(rawRes, req, { ok: false, error: "proxy failed", detail: String(e?.message || e) }, 502);
  }
}

// --- Routing (mirrors web/vercel.json rewrites) ---
// Each entry: [RegExp on pathname, handler, pathParam builder]
// The handler is called with req.url rewritten to `/api/<name>?path=<path>` so
// req.query.path matches what Vercel would set.
function route(pathname) {
  const m = (re) => pathname.match(re);
  let mm;
  if ((mm = m(/^\/api\/auth-login$/))) return { handler: authLoginHandler, internal: "/api/auth-login" };
  if ((mm = m(/^\/api\/auth-web3$/))) return { handler: authWeb3Handler, internal: "/api/auth-web3" };
  if ((mm = m(/^\/api\/auth\/signup$/))) return { proxy: `${SUPABASE_URL}/functions/v1/signup-guard` };
  if ((mm = m(/^\/ai-fn\/(.+)$/))) return { proxy: `${SUPABASE_URL}/functions/v1/${mm[1]}` };
  if ((mm = m(/^\/(?:api\/)?mcp(?:\/(.*))?$/))) {
    const rest = mm[1] || "";
    return { handler: mcpHandler, internal: `/api/mcp?path=mcp${rest ? "/" + rest : ""}` };
  }
  if ((mm = m(/^\/api\/mcp-launchpad(?:\/(.*))?$/))) {
    const rest = mm[1] || "";
    return { handler: orbitxHubHandler, internal: `/api/orbitx-hub?path=mcp-launchpad${rest ? "/" + rest : ""}` };
  }
  if ((mm = m(/^\/api\/supercomputer-mcp(?:\/(.*))?$/))) {
    // No top-level supercomputer-mcp function on Vercel either; route to hub like the rest.
    const rest = mm[1] || "";
    return { handler: orbitxHubHandler, internal: `/api/orbitx-hub?path=mcp${rest ? "/" + rest : ""}` };
  }
  if ((mm = m(/^\/api\/x\/mcp(?:\/(.*))?$/))) {
    const rest = mm[1] || "";
    return { handler: xMcpHandler, internal: `/api/x-mcp?path=mcp${rest ? "/" + rest : ""}` };
  }
  if ((mm = m(/^\/api\/x\/agent(?:\/(.*))?$/))) {
    const rest = mm[1] || "";
    return { handler: xMcpHandler, internal: `/api/x-mcp?path=agent${rest ? "/" + rest : ""}` };
  }
  if (m(/^\/api\/x-session-sync$/)) return { handler: xMcpHandler, internal: "/api/x-mcp?path=oauth/link-supabase" };
  if ((mm = m(/^\/api\/orbitx-agent(?:\/(.*))?$/))) {
    const rest = mm[1] || "";
    return { handler: orbitxHubHandler, internal: `/api/orbitx-hub?path=agent${rest ? "/" + rest : ""}` };
  }
  if ((mm = m(/^\/api\/orbitx-mcp(?:\/(.*))?$/))) {
    const rest = mm[1] || "";
    return { handler: orbitxHubHandler, internal: `/api/orbitx-hub?path=mcp${rest ? "/" + rest : ""}` };
  }
  if ((mm = m(/^\/api\/orbitx(?:\/(.*))?$/))) {
    const rest = mm[1] || "";
    // Paused on-chain/trading routes (vercel.json maps these to web ?path=paused).
    if (["anti-vamp-check", "delegated-wallet"].includes(rest)) {
      return { handler: webHandler, internal: "/api/web?path=paused" };
    }
    return { handler: orbitxHubHandler, internal: `/api/orbitx-hub${rest ? "?path=" + rest : ""}` };
  }
  if (m(/^\/api\/orbitx-calls$/)) return { handler: webHandler, internal: "/api/web?path=paused" };
  if (m(/^\/api\/orbitx-tx-report$/)) return { handler: webHandler, internal: "/api/web?path=paused" };
  if (m(/^\/api\/orbitx-onchain$/)) return { handler: webHandler, internal: "/api/web?path=paused" };
  if ((mm = m(/^\/api\/on-chain(?:\/(.*))?$/))) return { handler: webHandler, internal: "/api/web?path=paused" };
  if (m(/^\/api\/orbitx-desk-unlock$/)) return { handler: ogdexHandler, internal: "/api/ogdex?path=desk-unlock" };
  if (m(/^\/api\/hunter-agent$/)) return { handler: ogdexHandler, internal: "/api/ogdex?path=hunter" };
  if (m(/^\/api\/orbitx-owner$/)) return { handler: ogdexHandler, internal: "/api/ogdex?path=owner" };
  if (m(/^\/api\/mcps$/)) return { handler: ogdexHandler, internal: "/api/ogdex?path=mcps" };
  if (m(/^\/api\/vanity-mint$/)) return { handler: ogdexHandler, internal: "/api/ogdex?path=vanity-mint" };
  if (m(/^\/api\/mcp-life-tick$/)) return { handler: ogdexHandler, internal: "/api/ogdex?path=mcp-life-tick" };
  if ((mm = m(/^\/api\/ogdex(?:\/(.*))?$/))) {
    const rest = mm[1] || "";
    return { handler: ogdexHandler, internal: `/api/ogdex${rest ? "?path=" + rest : ""}` };
  }
  if ((mm = m(/^\/api\/kol(?:\/(.*))?$/))) {
    const rest = mm[1] || "";
    return { handler: webHandler, internal: `/api/web?path=kol${rest ? "/" + rest : ""}` };
  }
  if ((mm = m(/^\/api\/social(?:\/(.*))?$/))) {
    const rest = mm[1] || "";
    return { handler: webHandler, internal: `/api/web?path=social${rest ? "/" + rest : ""}` };
  }
  if ((mm = m(/^\/api\/orbitx-world(?:\/(.*))?$/))) {
    const rest = mm[1] || "";
    return { handler: webHandler, internal: `/api/web?path=orbitx-world${rest ? "/" + rest : ""}` };
  }
  if (m(/^\/api\/admin-tokens$/)) return { handler: webHandler, internal: "/api/web?path=admin-tokens" };
  if (m(/^\/api\/signup-check$/)) return { handler: webHandler, internal: "/api/web?path=signup-check" };
  if (m(/^\/api\/bagwork$/)) return { handler: webHandler, internal: "/api/web?path=bagwork" };
  if (m(/^\/api\/pump-create$/)) return { handler: webHandler, internal: "/api/web?path=pump-create" };
  if (m(/^\/api\/city-property$/)) return { handler: webHandler, internal: "/api/web?path=city-property" };
  if (m(/^\/api\/orbitx-ai$/)) return { handler: webHandler, internal: "/api/web?path=orbitx-ai" };
  if (m(/^\/api\/token-feed$/)) return { handler: webHandler, internal: "/api/web?path=token-feed" };
  if ((mm = m(/^\/share\/(.+)$/))) return { handler: webHandler, internal: `/api/web?path=share&mint=${encodeURIComponent(mm[1])}` };
  if ((mm = m(/^\/sharew\/(.+)$/))) return { handler: webHandler, internal: `/api/web?path=share-wallet&address=${encodeURIComponent(mm[1])}` };
  if ((mm = m(/^\/stats-api\/(.+)$/))) return { handler: webHandler, internal: `/api/web?path=stats/${mm[1]}` };
  if (m(/^\/.well-known\/oauth-protected-resource$/)) return { handler: orbitxHubHandler, internal: "/api/orbitx-hub?path=mcp/.well-known/oauth-protected-resource" };
  if (m(/^\/.well-known\/oauth-authorization-server$/)) return { handler: orbitxHubHandler, internal: "/api/orbitx-hub?path=mcp/.well-known/oauth-authorization-server" };
  if ((mm = m(/^\/api\/telegram-mcp(?:\/(.*))?$/))) {
    const rest = mm[1] || "";
    return { handler: telegramMcpHandler, internal: `/api/telegram-mcp${rest ? "?path=" + rest : ""}` };
  }
  if ((mm = m(/^\/api\/x-mcp(?:\/(.*))?$/))) {
    const rest = mm[1] || "";
    return { handler: xMcpHandler, internal: `/api/x-mcp${rest ? "?path=" + rest : ""}` };
  }
  if ((mm = m(/^\/api\/orbitx-hub(?:\/(.*))?$/))) {
    const rest = mm[1] || "";
    return { handler: orbitxHubHandler, internal: `/api/orbitx-hub${rest ? "?path=" + rest : ""}` };
  }
  if ((mm = m(/^\/api\/mcp(?:\/(.*))?$/))) {
    const rest = mm[1] || "";
    return { handler: mcpHandler, internal: `/api/mcp?path=mcp${rest ? "/" + rest : ""}` };
  }
  if ((mm = m(/^\/api\/web(?:\/(.*))?$/))) {
    const rest = mm[1] || "";
    return { handler: webHandler, internal: `/api/web${rest ? "?path=" + rest : ""}` };
  }
  if ((mm = m(/^\/predictions(?:\/(.*))?$/))) {
    const rest = mm[1] || "";
    return { proxy: `https://orbitx-prediction.fun${rest ? "/" + rest : "/"}` };
  }
  // Catch-all /api/<first-segment> -> the matching handler (vercel.json /api/(.*) -> /api/$1).
  if ((mm = m(/^\/api\/([^/]+)(?:\/(.*))?$/))) {
    const seg = mm[1];
    const rest = mm[2] || "";
    const bySeg = { web: webHandler, ogdex: ogdexHandler, "orbitx-hub": orbitxHubHandler, mcp: mcpHandler, "x-mcp": xMcpHandler, "telegram-mcp": telegramMcpHandler };
    if (bySeg[seg]) return { handler: bySeg[seg], internal: `/api/${seg}${rest ? "?path=" + rest : ""}` };
  }
  return null;
}

const server = http.createServer(async (req, res) => {
  try {
    const u = new URL(req.url || "/", `http://${req.headers.host || "x"}`);
    const pathname = u.pathname;

    if (req.method === "OPTIONS") {
      const headers = corsHeaders(req);
      res.writeHead(204, headers);
      res.end();
      return;
    }

    if (pathname === "/health") {
      return sendJson(res, req, { ok: true, service: "orbitx-platform-api" });
    }

    const bodyBuf = await readBody(req);
    const r = route(pathname);
    if (!r) {
      return sendJson(res, req, { ok: false, error: "not found", path: pathname }, 404);
    }
    if (r.proxy) {
      // Preserve the original query string on proxies.
      const target = r.proxy + (u.search || "");
      return proxyTo(res, req, target, bodyBuf);
    }
    // Merge the incoming query string into the internal URL (path param wins).
    const internal = new URL(r.internal, "http://x");
    for (const [k, v] of u.searchParams) {
      if (!internal.searchParams.has(k)) internal.searchParams.set(k, v);
    }
    const shimReq = makeReq(req, internal.pathname + internal.search, bodyBuf);
    const shimRes = makeRes(res, req);
    await r.handler(shimReq, shimRes);
  } catch (e) {
    console.error("server error:", e);
    try { sendJson(res, req, { ok: false, error: "internal error" }, 500); } catch {}
  }
});

server.listen(PORT, () => {
  console.log(`orbitx-platform-api listening on :${PORT}`);
});

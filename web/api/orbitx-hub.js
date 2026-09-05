/**
 * OrbitX API — Node (req, res) handler (Web Response handlers hang on this project).
 *
 * Entry is orbitx-hub.js (not orbitx.js) — api/orbitx/ directory would collide.
 * Rewrites:
 *   /api/orbitx-agent/* → /api/orbitx-hub?path=agent/*
 *   /api/orbitx-mcp/*   → /api/orbitx-hub?path=mcp/*
 *   /api/orbitx/*       → /api/orbitx-hub?path=*
 */
import { createHash, randomBytes } from "crypto";
import {
  buildGeneratedTools,
  dispatchGenerated,
  GEN_WALLET_TOOLS,
  generatedStats,
} from "./orbitx/mcp-tools-catalog.js";
import {
  holdBlockedPayload,
  isHoldGatedTool,
  isTokenGateExemptAny,
  isTokenGateExemptWallet,
  normalizeGateWallet,
  verifyTokenHold,
} from "./orbitx/token-hold.js";
import {
  accessBlockedPayload,
  accessBuyPrompt,
  calculateBurnAmount,
  confirmAccessBurn,
  evaluateMcpAccess,
  getAccessStatus,
  listPackages,
  prepareAccessBurn,
  prepareAccessMcpPurchase,
} from "./orbitx/mcp-burn-access.js";
import {
  agentMenuPayload,
  buildAgentAuthPasteMessages,
  wrapMcpToolContent,
} from "./orbitx/mcp-brand.js";
import {
  ORBITX_MINT,
  askBuyOrbitxAmount,
  prepareBuyOrbitx,
  saveTradeIntent,
  loadLatestTradeIntent,
  getChatTradePreference,
  setChatTradePreference,
  usdToSol,
} from "./orbitx/buy-orbitx.js";
import { TELEGRAM_TOOL_ALIASES, applyTelegramAlias, parseTradeIntent } from "./orbitx/telegram-trade-intent.js";
import {
  classifyOrbitXAuthPaste,
  TELEGRAM_LOGIN_NOT_MCP_MESSAGE,
  telegramLoginUrl,
} from "./orbitx/orbitx-auth-links.js";
import { buildDexChartEmbed } from "./orbitx/dex-chart-embed.js";
import { buildCookTools, dispatchCookTool, cookStats } from "./orbitx/mcp-cook-tools.js";
import {
  maybeRelayGroupChat,
  resolveGcNaturalTool,
} from "./orbitx/mcp-group-chat.js";
/** Lazy-load Solana tx builders — top-level @solana imports crash this function on Vercel. */
async function mcpOps() {
  return import("./orbitx/mcp-ops.js");
}

/** Lazy — credits module (may pull Solana) must not crash MCP cold start. */
async function xCredits() {
  return import("./orbitx/x-credits.js");
}

/** Combined MCP gate: exempt OR unexpired burn access OR $ORBITX hold. */
async function requireMcpAccess({ userId, wallets = [], email, base, tool } = {}) {
  const candidates = (wallets || []).map((w) => normalizeGateWallet(w)).filter(Boolean);
  if (isTokenGateExemptAny({ wallets: candidates, email })) {
    return { allowed: true, source: "exempt", hold: { exempt: true, meetsRequirement: true } };
  }
  const hold = await verifyTokenHold(candidates[0] || "", base, { email });
  const access = await evaluateMcpAccess({ sb, userId, hold, wallets: candidates });
  if (access.allowed) return access;
  return {
    ...access,
    blocked: accessBlockedPayload({
      tool,
      hold,
      burn: access.burn,
      fix: "Hold ≥$5 ORBITX, or burn 100 (1 hour) / 1,000 (1 day) / 10,000 (1 week) / 1,000,000 (1 month) at https://www.orbitx.world/shop.",
    }),
  };
}

const PLATFORM_CREDITS_WALLET = "45YR6fWxtc8uceNazGKMoX2KgK698rQsnPN4x8vD2VrE";

async function grokImagine() {
  return import("./orbitx/grok-imagine.js");
}

export const config = { maxDuration: 120 };

const SUPA_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const ANON = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
const SRK = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const FALLBACK_BASE = "https://www.orbitx.world";

function header(req, name) {
  const key = name.toLowerCase();
  const h = req.headers || {};
  return h[key] || h[name] || "";
}

function publicBase(req) {
  const env = process.env.PUBLIC_APP_URL || process.env.VITE_PUBLIC_APP_URL;
  if (env) {
    const cleaned = String(env).replace(/\/$/, "");
    // Never emit apex for OrbitX — 308s break Claude/Grok MCP POSTs.
    if (cleaned === "https://orbitx.world" || cleaned === "http://orbitx.world") return FALLBACK_BASE;
    return cleaned;
  }
  if (!req) return FALLBACK_BASE;
  const proto = header(req, "x-forwarded-proto") || "https";
  let host = header(req, "x-forwarded-host") || header(req, "host") || "www.orbitx.world";
  host = String(host).split(",")[0].trim().replace(/:\d+$/, "");
  if (host === "orbitx.world") host = "www.orbitx.world";
  return `${proto}://${host}`;
}

function mcpUrls(req) {
  const base = publicBase(req);
  // Claude.ai expects a path ending in /mcp. Prefer real function /api/mcp
  // (rewrite-only /mcp can lose to the SPA catch-all during deploys).
  // Always advertise www — apex orbitx.world 308s POST /api/mcp and breaks tools/list.
  const mcpHost = "https://www.orbitx.world";
  return {
    base: base.includes("orbitx.world") ? mcpHost : base,
    mcpUrl: `${mcpHost}/api/mcp`,
    // HTML auth page lives on www (apex 308s) — avoid breaking OAuth redirects
    authPage: "https://www.orbitx.world/agent/mcp-auth",
  };
}

const AGENT_AUTH_CODE_PROP = {
  type: "string",
  description:
    "OrbitX authCode from the dashboard paste message or orbitx_auth_link. After auth, pass this on every tool call (required for Grok).",
};

function withAuthCodeSchema(schema, toolName) {
  const base = schema && typeof schema === "object" ? schema : { type: "object", properties: {} };
  if (
    toolName === "orbitx_auth_link" ||
    toolName === "orbitx_auth_status" ||
    toolName === "orbitx_menu" ||
    toolName === "search" ||
    toolName === "fetch"
  ) {
    return base;
  }
  const props = { ...(base.properties || {}), authCode: AGENT_AUTH_CODE_PROP };
  return { ...base, type: "object", properties: props };
}

/** Claude / ChatGPT choke on 1000+ tools — expose CORE live tools only in tools/list. */
function listLiveTools(cursor) {
  const PAGE = 80;
  if (!cursor || cursor === "core" || cursor === "0") {
    const tools = CORE_TOOLS.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: withAuthCodeSchema(t.inputSchema, t.name),
    }));
    return {
      tools,
      // Hint there are more via tools_help — do not dump 1000 schemas (breaks connectors).
      _meta: {
        totalAvailable: TOOLS.length,
        liveCore: CORE_TOOLS.length,
        note: "Live callable tools listed. Call orbitx_tools_help for the full catalog; generated shortcuts still work if you know the name.",
      },
    };
  }
  // Optional paginated generated tools: cursor = "gen:0", "gen:80", …
  const m = String(cursor).match(/^gen:(\d+)$/);
  if (m) {
    const offset = Number(m[1]) || 0;
    const slice = _generated.slice(offset, offset + PAGE);
    const next = offset + PAGE < _generated.length ? `gen:${offset + PAGE}` : (_cook.length ? "cook:0" : undefined);
    return {
      tools: slice.map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: withAuthCodeSchema(t.inputSchema, t.name),
      })),
      nextCursor: next,
    };
  }
  const cook = String(cursor).match(/^cook:(\d+)$/);
  if (cook) {
    const offset = Number(cook[1]) || 0;
    const slice = _cook.slice(offset, offset + PAGE);
    const next = offset + PAGE < _cook.length ? `cook:${offset + PAGE}` : undefined;
    return {
      tools: slice.map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: withAuthCodeSchema(t.inputSchema, t.name),
      })),
      nextCursor: next,
    };
  }
  return {
    tools: CORE_TOOLS.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: withAuthCodeSchema(t.inputSchema, t.name),
    })),
  };
}

function cors(res, methods = "GET,POST,DELETE,OPTIONS") {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", methods);
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type, Accept, Mcp-Session-Id");
  res.setHeader("Access-Control-Expose-Headers", "WWW-Authenticate, Mcp-Session-Id");
  res.setHeader("Cache-Control", "no-store");
}

function json(res, data, status = 200, extra = {}) {
  cors(res);
  for (const [k, v] of Object.entries(extra)) res.setHeader(k, v);
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(data));
}

function sha256(input) {
  return createHash("sha256").update(input).digest("hex");
}

function opaque(prefix) {
  return `${prefix}_${randomBytes(32).toString("hex")}`;
}

function pathParts(req) {
  try {
    const u = new URL(req.url || "/", "http://x");
    const qp = u.searchParams.get("path");
    if (qp) return String(qp).split("/").filter(Boolean);
    const fromQuery = req.query && req.query.path;
    if (fromQuery) {
      const p = Array.isArray(fromQuery) ? fromQuery[0] : fromQuery;
      if (p) return String(p).split("/").filter(Boolean);
    }
  } catch {
    /* ignore */
  }
  const raw = String(req.url || "");
  const after = raw.split("/api/orbitx-hub")[1] || raw.split("/orbitx-hub")[1] || "";
  return after.replace(/^\//, "").split("?")[0].split("/").filter(Boolean);
}

async function readBody(req) {
  try {
    if (req.body != null) {
      if (typeof req.body === "object" && !Buffer.isBuffer(req.body)) return req.body;
      if (Buffer.isBuffer(req.body)) {
        const raw = req.body.toString("utf8");
        if (!raw) return {};
        try {
          return JSON.parse(raw);
        } catch {
          return Object.fromEntries(new URLSearchParams(raw));
        }
      }
      if (typeof req.body === "string") {
        if (!req.body) return {};
        try {
          return JSON.parse(req.body);
        } catch {
          return Object.fromEntries(new URLSearchParams(req.body));
        }
      }
    }
    const chunks = [];
    for await (const c of req) chunks.push(typeof c === "string" ? Buffer.from(c) : c);
    const raw = Buffer.concat(chunks).toString("utf8");
    if (!raw) return {};
    try {
      return JSON.parse(raw);
    } catch {
      return Object.fromEntries(new URLSearchParams(raw));
    }
  } catch {
    return {};
  }
}

function srHeaders(extra = {}) {
  return {
    apikey: SRK,
    Authorization: `Bearer ${SRK}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

async function sb(path, init = {}) {
  if (!SUPA_URL || !SRK) throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  const r = await fetch(`${SUPA_URL}/rest/v1/${path}`, {
    ...init,
    headers: { ...srHeaders(init.headers || {}), Prefer: init.prefer || "return=representation" },
  });
  const text = await r.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  if (!r.ok) {
    const err = new Error(data?.message || data?.error || data?.raw || text || r.statusText);
    err.status = r.status;
    throw err;
  }
  return data;
}

async function getAuthUser(req) {
  const auth = header(req, "authorization");
  if (!auth.startsWith("Bearer ") || !SUPA_URL || !ANON) return null;
  const r = await fetch(`${SUPA_URL}/auth/v1/user`, {
    headers: { Authorization: auth, apikey: ANON },
  });
  if (!r.ok) return null;
  const u = await r.json();
  if (!u?.id) return null;
  return { id: u.id, email: u.email || null };
}

/** Resolve owner email for API-key / OAuth sessions (service role). Cached per request via auth object. */
async function getUserEmailById(userId) {
  const id = String(userId || "").trim();
  if (!id || !SUPA_URL || !SRK) return null;
  try {
    const r = await fetch(`${SUPA_URL}/auth/v1/admin/users/${encodeURIComponent(id)}`, {
      headers: { Authorization: `Bearer ${SRK}`, apikey: SRK },
    });
    if (!r.ok) return null;
    const u = await r.json();
    return u?.email || null;
  } catch {
    return null;
  }
}

async function withAuthEmail(auth) {
  if (!auth?.userId) return auth;
  if (auth.email) return auth;
  const email = await getUserEmailById(auth.userId);
  return email ? { ...auth, email } : auth;
}

/** Hold/exempt wallets come from the authenticated session only — never tool args. */
function holdCandidateWallets(auth) {
  return [auth?.walletAddress]
    .map((w) => normalizeGateWallet(w))
    .filter(Boolean);
}

async function getUserId(req) {
  const u = await getAuthUser(req);
  return u?.id || null;
}

async function ensureAgent(userId) {
  const existing = await sb(
    `agents?user_id=eq.${encodeURIComponent(userId)}&order=created_at.asc&limit=1&select=*`,
  );
  if (Array.isArray(existing) && existing[0]) return existing[0];
  const created = await sb("agents", {
    method: "POST",
    body: JSON.stringify({
      user_id: userId,
      name: "Default",
      description: "OrbitX MCP agent",
      status: "active",
    }),
  });
  const agent = Array.isArray(created) ? created[0] : created;
  try {
    await sb("agent_settings", {
      method: "POST",
      body: JSON.stringify({ agent_id: agent.id }),
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    });
  } catch {
    /* optional */
  }
  return agent;
}

async function listKeys(agentId) {
  const rows = await sb(
    `agent_api_keys?agent_id=eq.${encodeURIComponent(agentId)}&revoked_at=is.null&order=created_at.desc&select=id,agent_id,name,last_used_at,created_at`,
  );
  return Array.isArray(rows) ? rows : [];
}

async function createKey(agentId, name) {
  const key = opaque("oxk");
  const rows = await sb("agent_api_keys", {
    method: "POST",
    body: JSON.stringify({ agent_id: agentId, name, key_hash: sha256(key) }),
  });
  const row = Array.isArray(rows) ? rows[0] : rows;
  return { id: row.id, name: row.name, key };
}

function mapAgent(a) {
  return {
    id: a.id,
    userId: a.user_id,
    name: a.name,
    description: a.description,
    status: a.status,
    walletAddress: a.wallet_address,
    phantomConnected: Boolean(a.phantom_connected),
    createdAt: a.created_at,
    updatedAt: a.updated_at,
  };
}

async function handleAgent(req, res, parts) {
  const route = parts.join("/") || "";

  if (req.method === "GET" && route === "health") {
    return json(res, {
      ok: true,
      service: "orbitx-agent",
      hasServiceRole: Boolean(SRK),
      hasSupabaseUrl: Boolean(SUPA_URL),
    });
  }

  // GET /api/orbitx-agent — list agents for the signed-in user
  if (req.method === "GET" && route === "") {
    const userId = await getUserId(req);
    if (!userId) return json(res, { error: "unauthorized" }, 401);
    const rows = await sb(
      `agents?user_id=eq.${encodeURIComponent(userId)}&order=created_at.asc&select=*`,
    );
    const agents = Array.isArray(rows) ? rows : [];
    if (agents.length === 0) {
      const created = await ensureAgent(userId);
      return json(res, { agents: [mapAgent(created)] });
    }
    return json(res, { agents: agents.map(mapAgent) });
  }

  // POST /api/orbitx-agent — create an agent (or return default)
  if (req.method === "POST" && route === "") {
    const authUser = await getAuthUser(req);
    if (!authUser?.id) return json(res, { error: "unauthorized" }, 401);
    const body = await readBody(req);
    const name = String(body.name || "").trim() || "Default";
    const description = String(body.description || "").trim() || "OrbitX MCP agent";
    const existing = await ensureAgent(authUser.id);
    if (existing && (!body.name || existing.name === name)) {
      return json(res, { agent: mapAgent(existing) }, 200);
    }
    try {
      const created = await sb("agents", {
        method: "POST",
        body: JSON.stringify({
          user_id: authUser.id,
          name,
          description,
          status: "active",
        }),
      });
      const row = Array.isArray(created) ? created[0] : created;
      if (row?.id) {
        try {
          await sb("agent_settings", {
            method: "POST",
            body: JSON.stringify({ agent_id: row.id }),
            headers: { Prefer: "return=minimal" },
          });
        } catch {
          /* optional */
        }
        return json(res, { agent: mapAgent(row) }, 201);
      }
    } catch (e) {
      return json(res, { error: e?.message || "Failed to create agent", agent: mapAgent(existing) }, 200);
    }
    return json(res, { agent: mapAgent(existing) }, 200);
  }

  // Credits purchase confirm — session user OR wallet linked on agents table.
  if (route === "credits/confirm" && req.method === "POST") {
    const body = await readBody(req);
    const signature = String(body.signature || body.txSignature || "").trim();
    const walletPk = normalizeGateWallet(body.publicKey || body.wallet || "");
    if (!signature) return json(res, { ok: false, error: "signature_required" }, 400);
    let userId = null;
    const authUser = await getAuthUser(req);
    if (authUser?.id) userId = authUser.id;
    if (!userId && walletPk) {
      try {
        const rows = await sb(
          `agents?wallet_address=eq.${encodeURIComponent(walletPk)}&select=user_id&limit=1`,
        );
        userId = Array.isArray(rows) && rows[0]?.user_id ? rows[0].user_id : null;
      } catch {
        /* ignore */
      }
    }
    if (!userId) {
      return json(
        res,
        {
          ok: false,
          error: "user_required",
          message: "Sign in or link this wallet on /agent, then confirm — or tell Grok the signature.",
          signature,
        },
        401,
      );
    }
    try {
      const xc = await xCredits();
      const out = await xc.confirmCreditsPurchase(sb, userId, signature);
      return json(res, out, out.ok ? 200 : 400);
    } catch (e) {
      return json(res, { ok: false, error: e?.message || "confirm_failed" }, 500);
    }
  }

  if ((route === "credits" || route === "credits/balance") && req.method === "GET") {
    const authUser = await getAuthUser(req);
    if (!authUser?.id) return json(res, { error: "unauthorized" }, 401);
    try {
      const xc = await xCredits();
      return json(res, await xc.getCreditsBalance(sb, authUser.id));
    } catch (e) {
      return json(res, { error: e?.message || "credits_failed" }, 500);
    }
  }

  if (route === "credits/usage" && req.method === "GET") {
    const authUser = await getAuthUser(req);
    if (!authUser?.id) return json(res, { error: "unauthorized" }, 401);
    const u = new URL(req.url || "/", "http://x");
    try {
      const xc = await xCredits();
      return json(res, await xc.getCreditsUsage(sb, authUser.id, { limit: Number(u.searchParams.get("limit") || 40) }));
    } catch (e) {
      return json(res, { error: e?.message || "usage_failed" }, 500);
    }
  }

  if (route === "mcp-access" && req.method === "GET") {
    const authUser = await getAuthUser(req);
    const u = new URL(req.url || "/", "http://x");
    const walletPk = normalizeGateWallet(
      u.searchParams.get("wallet") || u.searchParams.get("publicKey") || "",
    );
    if (!authUser?.id && !walletPk) return json(res, { error: "unauthorized" }, 401);
    try {
      return json(res, await getAccessStatus(sb, authUser?.id, { wallets: [walletPk] }));
    } catch (e) {
      return json(res, { error: e?.message || "mcp_access_failed", packages: listPackages() }, 500);
    }
  }

  if (route === "mcp-access/prepare" && req.method === "POST") {
    const body = await readBody(req);
    const pk = normalizeGateWallet(body.publicKey || body.wallet || body.walletAddress || "");
    const packageId = body.packageId || body.package || body.option;
    try {
      const out = await prepareAccessBurn({ publicKey: pk, packageId });
      return json(res, out, out.ok ? 200 : 400);
    } catch (e) {
      return json(res, { ok: false, error: e?.message || "prepare_failed", ...calculateBurnAmount(packageId) }, 400);
    }
  }

  if (route === "mcp-access/confirm" && req.method === "POST") {
    const body = await readBody(req);
    const signature = String(body.signature || body.txSignature || "").trim();
    const walletPk = normalizeGateWallet(body.publicKey || body.wallet || body.walletAddress || "");
    const packageId = body.packageId || body.package || body.option;
    if (!signature) return json(res, { ok: false, error: "signature_required" }, 400);
    let userId = null;
    const authUser = await getAuthUser(req);
    if (authUser?.id) userId = authUser.id;
    if (!userId && walletPk) {
      try {
        const rows = await sb(
          `agents?wallet_address=eq.${encodeURIComponent(walletPk)}&select=user_id&limit=1`,
        );
        userId = Array.isArray(rows) && rows[0]?.user_id ? rows[0].user_id : null;
      } catch {
        /* ignore */
      }
    }
    try {
      const out = await confirmAccessBurn(sb, {
        userId,
        signature,
        packageId,
        wallet: walletPk,
      });
      return json(res, out, out.ok ? 200 : 400);
    } catch (e) {
      return json(
        res,
        {
          ok: false,
          error: e?.message || "confirm_failed",
          message: e?.message || "Could not grant access — apply mcp_burn_access migration",
        },
        500,
      );
    }
  }

  // Public prepare for /agent/sign (claim / burn / rent) — returns unsigned txs only.
  if (route === "ops-prepare" && req.method === "POST") {
    try {
      const body = await readBody(req);
      const pk = String(body.publicKey || "").trim();
      const kind = String(body.kind || "").toLowerCase();
      if (!pk) return json(res, { ok: false, error: "publicKey required" }, 400);
      const ops = await mcpOps();
      if (kind === "claim") return json(res, await ops.preparePumpClaim(pk));
      if (kind === "rent") return json(res, await ops.prepareRentRefund(pk));
      if (kind === "burn") {
        if (body.amount == null && body.percent == null) {
          return json(res, { ok: false, error: "amount or percent required" }, 400);
        }
        return json(res, await ops.prepareBurn(pk, String(body.mint || ""), body.amount, body.percent));
      }
      return json(res, { ok: false, error: "kind must be claim|burn|rent" }, 400);
    } catch (e) {
      return json(res, { ok: false, error: e?.message || "ops-prepare failed" }, 400);
    }
  }

  if (route === "verify-hold" && req.method === "POST") {
    const authUser = await getAuthUser(req);
    if (!authUser?.id) return json(res, { error: "unauthorized" }, 401);
    const body = await readBody(req);
    const { base } = mcpUrls(req);
    const agent = await ensureAgent(authUser.id);
    let wallet = normalizeGateWallet(body.walletAddress || body.wallet || body.publicKey || "");
    if (!wallet) wallet = normalizeGateWallet(agent.wallet_address || "");
    // Prefer exempt if either connected wallet OR linked agent wallet qualifies.
    if (isTokenGateExemptWallet(agent.wallet_address) && !isTokenGateExemptWallet(wallet)) {
      wallet = normalizeGateWallet(agent.wallet_address);
    }
    const hold = await verifyTokenHold(wallet, base, { email: authUser.email });
    const access = await evaluateMcpAccess({
      sb,
      userId: authUser.id,
      hold,
      wallets: [wallet, agent.wallet_address],
    });
    return json(
      res,
      {
        ...hold,
        ok: access.allowed,
        meetsRequirement: access.allowed,
        mcpAccess: access.burn,
        accessSource: access.source,
        message:
          access.source === "burn"
            ? `Burn access active — ${access.burn.remainingLabel}.`
            : hold.message,
      },
      access.allowed ? 200 : 403,
    );
  }

  if (route === "bootstrap" && req.method === "POST") {
    const authUser = await getAuthUser(req);
    if (!authUser?.id) return json(res, { error: "unauthorized" }, 401);
    const userId = authUser.id;
    const agent = await ensureAgent(userId);
    const { base, mcpUrl } = mcpUrls(req);
    const hold = await verifyTokenHold(agent.wallet_address, base, { email: authUser.email });
    const access = await evaluateMcpAccess({
      sb,
      userId,
      hold,
      wallets: [agent.wallet_address],
    });
    const keys = await listKeys(agent.id);
    let mintedKey = null;
    // Only auto-mint a key when hold, burn access, or exempt is satisfied.
    if (keys.length === 0 && access.allowed) {
      mintedKey = await createKey(agent.id, "Default MCP Key");
    }
    return json(res, {
      agent: mapAgent(agent),
      keys: keys.map((k) => ({
        id: k.id,
        name: k.name,
        createdAt: k.created_at,
        lastUsedAt: k.last_used_at,
      })),
      mintedKey,
      mcpUrl,
      hold,
      mcpAccess: access.burn,
      accessSource: access.source,
    });
  }

  if (route === "keys" && req.method === "GET") {
    const userId = await getUserId(req);
    if (!userId) return json(res, { error: "unauthorized" }, 401);
    const agent = await ensureAgent(userId);
    const keys = await listKeys(agent.id);
    return json(res, {
      agentId: agent.id,
      keys: keys.map((k) => ({
        id: k.id,
        name: k.name,
        createdAt: k.created_at,
        lastUsedAt: k.last_used_at,
      })),
    });
  }

  if (route === "keys" && req.method === "POST") {
    const authUser = await getAuthUser(req);
    if (!authUser?.id) return json(res, { error: "unauthorized" }, 401);
    const userId = authUser.id;
    const body = await readBody(req);
    const name = String(body.name || "").trim() || "MCP Key";
    const agent = await ensureAgent(userId);
    const { base } = mcpUrls(req);
    const access = await requireMcpAccess({
      userId,
      wallets: [agent.wallet_address],
      email: authUser.email,
      base,
      tool: "create_key",
    });
    if (!access.allowed) {
      return json(res, access.blocked || holdBlockedPayload({ hold: access.hold }), 403);
    }
    const minted = await createKey(agent.id, name);
    return json(
      res,
      {
        id: minted.id,
        name: minted.name,
        key: minted.key,
        message: "Save this key securely. You will not be able to see it again.",
        hold: access.hold,
        mcpAccess: access.burn,
        accessSource: access.source,
      },
      201,
    );
  }

  if (parts[0] === "keys" && parts[1] && req.method === "DELETE") {
    const userId = await getUserId(req);
    if (!userId) return json(res, { error: "unauthorized" }, 401);
    const keyId = parts[1];
    const keys = await sb(`agent_api_keys?id=eq.${encodeURIComponent(keyId)}&select=id,agent_id`);
    const key = Array.isArray(keys) ? keys[0] : null;
    if (!key) return json(res, { error: "Key not found" }, 404);
    const agents = await sb(
      `agents?id=eq.${encodeURIComponent(key.agent_id)}&user_id=eq.${encodeURIComponent(userId)}&select=id`,
    );
    if (!Array.isArray(agents) || !agents[0]) return json(res, { error: "Key not found" }, 404);
    await sb(`agent_api_keys?id=eq.${encodeURIComponent(keyId)}`, {
      method: "PATCH",
      body: JSON.stringify({ revoked_at: new Date().toISOString() }),
      headers: { Prefer: "return=minimal" },
    });
    return json(res, { ok: true });
  }

  if (route === "link-wallet" && req.method === "POST") {
    const userId = await getUserId(req);
    if (!userId) return json(res, { error: "unauthorized" }, 401);
    const body = await readBody(req);
    const wallet = normalizeGateWallet(body.walletAddress || body.wallet || "");
    if (wallet.length < 32) return json(res, { error: "walletAddress required" }, 400);
    let agent;
    if (body.agentId) {
      const rows = await sb(
        `agents?id=eq.${encodeURIComponent(body.agentId)}&user_id=eq.${encodeURIComponent(userId)}&select=*`,
      );
      agent = Array.isArray(rows) ? rows[0] : null;
    } else {
      agent = await ensureAgent(userId);
    }
    if (!agent) return json(res, { error: "Agent not found" }, 404);
    const updated = await sb(`agents?id=eq.${encodeURIComponent(agent.id)}`, {
      method: "PATCH",
      body: JSON.stringify({
        wallet_address: wallet,
        phantom_connected: true,
        updated_at: new Date().toISOString(),
      }),
    });
    const row = Array.isArray(updated) ? updated[0] : updated;
    return json(res, { agent: mapAgent(row || { ...agent, wallet_address: wallet, phantom_connected: true }) });
  }

  if (route === "link/approve" && req.method === "POST") {
    const authUser = await getAuthUser(req);
    if (!authUser?.id) return json(res, { error: "unauthorized" }, 401);
    const body = await readBody(req);
    try {
      const out = await completeAgentLinkAuthSession({
        code: body.code,
        userId: authUser.id,
        walletAddress: body.walletAddress || body.wallet || "",
      });
      return json(res, out);
    } catch (e) {
      return json(res, { error: e?.message || "link_approve_failed" }, 400);
    }
  }

  // Dashboard: mint a pre-authorized authCode + paste messages for Grok/Claude/ChatGPT (no mid-chat click).
  if (route === "link/create" && req.method === "POST") {
    const authUser = await getAuthUser(req);
    if (!authUser?.id) return json(res, { error: "unauthorized" }, 401);
    const body = await readBody(req);
    try {
      const out = await mintAgentLinkAuthSession({
        userId: authUser.id,
        walletAddress: body.walletAddress || body.wallet || "",
        req,
      });
      return json(res, out);
    } catch (e) {
      return json(res, { error: e?.message || "link_create_failed" }, 400);
    }
  }

  if (route === "link/status" && req.method === "GET") {
    const u = new URL(req.url || "/", "http://x");
    const code = u.searchParams.get("code") || "";
    return json(res, await getAgentLinkAuthStatus(code));
  }

  if (route === "oauth/approve" && req.method === "POST") {
    const authUser = await getAuthUser(req);
    if (!authUser?.id) return json(res, { error: "unauthorized" }, 401);
    const userId = authUser.id;
    const body = await readBody(req);
    const redirectUri = String(body.redirect_uri || "").trim();
    const state = body.state != null ? String(body.state) : "";
    const wallet = normalizeGateWallet(body.walletAddress || body.wallet || "") || null;
    if (!redirectUri) return json(res, { error: "redirect_uri required" }, 400);

    let agent = await ensureAgent(userId);
    if (wallet) {
      const updated = await sb(`agents?id=eq.${encodeURIComponent(agent.id)}`, {
        method: "PATCH",
        body: JSON.stringify({
          wallet_address: wallet,
          phantom_connected: true,
          updated_at: new Date().toISOString(),
        }),
      });
      agent = Array.isArray(updated) ? updated[0] : agent;
    }

    const { base } = mcpUrls(req);
    const mcpAccess = await requireMcpAccess({
      userId,
      wallets: [wallet, agent.wallet_address],
      email: authUser.email,
      base,
      tool: "oauth_approve",
    });
    if (!mcpAccess.allowed) {
      return json(res, mcpAccess.blocked || holdBlockedPayload({ hold: mcpAccess.hold }), 403);
    }

    // Always mint a Bearer access token as API key (oxo_). Claude exchanges the
    // code at /oauth/token — we accept oxo_ codes as the access_token itself so
    // auth works even when oauth_codes/tokens tables are missing.
    const access = opaque("oxo");
    await sb("agent_api_keys", {
      method: "POST",
      body: JSON.stringify({
        agent_id: agent.id,
        name: `MCP ${String(body.client_id || "claude").slice(0, 24)} ${new Date().toISOString().slice(0, 16)}`,
        key_hash: sha256(access),
      }),
      headers: { Prefer: "return=minimal" },
    });

    try {
      await sb("agent_mcp_oauth_tokens", {
        method: "POST",
        body: JSON.stringify({
          token_hash: sha256(access),
          user_id: userId,
          agent_id: agent.id,
          wallet_address: wallet || agent.wallet_address,
          expires_at: new Date(Date.now() + 30 * 86400 * 1000).toISOString(),
        }),
        headers: { Prefer: "return=minimal" },
      });
    } catch {
      /* optional table */
    }

    try {
      await sb("agent_mcp_oauth_codes", {
        method: "POST",
        body: JSON.stringify({
          code_hash: sha256(access),
          user_id: userId,
          agent_id: agent.id,
          wallet_address: wallet || agent.wallet_address,
          redirect_uri: redirectUri,
          client_id: String(body.client_id || "orbitx-mcp"),
          code_challenge: body.code_challenge || null,
          code_challenge_method: body.code_challenge_method || null,
          expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        }),
        headers: { Prefer: "return=minimal" },
      });
    } catch {
      /* optional — oxo_ still works via token endpoint passthrough */
    }

    const sep = redirectUri.includes("?") ? "&" : "?";
    return json(res, {
      redirect: `${redirectUri}${sep}code=${encodeURIComponent(access)}&state=${encodeURIComponent(state)}`,
    });
  }

  // Mobile Trade Desk command bridge. It only prepares exact buy/sell intents;
  // the linked wallet remains the final signing authority.
  if (route === "command" && req.method === "POST") {
    const authUser = await getAuthUser(req);
    if (!authUser?.id) return json(res, { ok: false, error: "unauthorized", message: "Sign in before using the Trade Desk." }, 401);
    const body = await readBody(req);
    const text = String(body.text || body.command || "").trim();
    if (!text) return json(res, { ok: false, error: "command_required", message: "Enter a buy or sell command." }, 400);
    const intent = parseTradeIntent(text);
    const allowed = new Set(["orbitx_prepare_buy", "orbitx_buy_orbitx", "orbitx_prepare_sell"]);
    if (!intent?.tool || !allowed.has(intent.tool)) {
      return json(res, {
        ok: false,
        error: "trade_command_not_understood",
        message: "Use a concrete command such as: Buy $1 of TOKEN with CA <contract address>.",
      }, 400);
    }
    const args = { ...(intent.args || {}), autoConfirm: false, auto: false, confirmMode: "sign" };
    try {
      const result = await runEmbeddedAgentTool({
        userId: authUser.id,
        // Do not trust a client-supplied wallet for execution. The linked agent
        // wallet is authoritative and must be linked from the wallet screen.
        walletAddress: null,
        email: authUser.email,
        toolName: intent.tool,
        args,
        req,
      });
      return json(res, { ...result, command: text, parsedTool: intent.tool }, result?.ok === false ? 400 : 200);
    } catch (e) {
      return json(res, { ok: false, error: e?.message || "trade_command_failed", message: e?.message || "Trade command failed" }, 400);
    }
  }

  return json(res, { error: "not_found", route }, 404);
}

function extractBearerToken(req) {
  const raw = String(header(req, "authorization") || header(req, "x-orbitx-api-key") || "").trim();
  if (!raw) return { token: null, bearerPresent: false };
  let token = raw;
  if (/^bearer\s+/i.test(token)) token = token.replace(/^bearer\s+/i, "").trim();
  // Some clients double-prefix: "Bearer Bearer oxo_…"
  if (/^bearer\s+/i.test(token)) token = token.replace(/^bearer\s+/i, "").trim();
  if (!token) return { token: null, bearerPresent: true };
  return { token, bearerPresent: true };
}

async function resolveAgentByWallet(wallet) {
  const w = String(wallet || "").trim();
  if (!w || w.length < 32) return null;
  try {
    const agents = await sb(
      `agents?wallet_address=eq.${encodeURIComponent(w)}&order=updated_at.desc&limit=1&select=id,user_id,wallet_address,name`,
    );
    const agent = Array.isArray(agents) ? agents[0] : null;
    if (!agent?.user_id) return null;
    return {
      userId: agent.user_id,
      agentId: agent.id,
      walletAddress: agent.wallet_address,
      agentName: agent.name || null,
      source: "linked_wallet",
    };
  } catch {
    return null;
  }
}

async function resolveAuth(req) {
  const { token, bearerPresent } = extractBearerToken(req);
  if (!token) return null;

  const hash = sha256(token);

  // API keys + OAuth access tokens (oxo_ / oxk_ / oxc_)
  if (token.startsWith("oxk_") || token.startsWith("oxo_") || token.startsWith("oxc_")) {
    try {
      const keys = await sb(
        `agent_api_keys?key_hash=eq.${encodeURIComponent(hash)}&revoked_at=is.null&select=id,agent_id`,
      );
      const key = Array.isArray(keys) ? keys[0] : null;
      if (key) {
        const agents = await sb(
          `agents?id=eq.${encodeURIComponent(key.agent_id)}&select=id,user_id,wallet_address,name`,
        );
        const agent = Array.isArray(agents) ? agents[0] : null;
        if (agent?.user_id) {
          try {
            await sb(`agent_api_keys?id=eq.${encodeURIComponent(key.id)}`, {
              method: "PATCH",
              body: JSON.stringify({ last_used_at: new Date().toISOString() }),
              headers: { Prefer: "return=minimal" },
            });
          } catch {
            /* ignore */
          }
          return {
            userId: agent.user_id,
            agentId: agent.id,
            walletAddress: agent.wallet_address,
            agentName: agent.name || null,
            source: "bearer",
            bearerPresent,
          };
        }
      }
    } catch {
      /* fall through */
    }
  }

  try {
    const toks = await sb(
      `agent_mcp_oauth_tokens?token_hash=eq.${encodeURIComponent(hash)}&revoked_at=is.null&select=*`,
    );
    const tok = Array.isArray(toks) ? toks[0] : null;
    if (!tok) return null;
    if (new Date(tok.expires_at).getTime() < Date.now()) return null;
    return {
      userId: tok.user_id,
      agentId: tok.agent_id,
      walletAddress: tok.wallet_address,
      source: "oauth_token",
      bearerPresent,
    };
  } catch {
    return null;
  }
}

const LINK_AUTH_TTL_MS = 365 * 86400 * 1000; // authorize once — stay linked for a year
const LINK_AUTH_SLIDE_MS = 30 * 86400 * 1000; // extend when under 30 days left

async function touchAgentLinkAuthExpiry(row) {
  if (!row?.code) return;
  const left = new Date(row.expires_at).getTime() - Date.now();
  if (left > LINK_AUTH_SLIDE_MS) return;
  try {
    await sb(`mcp_link_sessions?code=eq.${encodeURIComponent(row.code)}`, {
      method: "PATCH",
      body: JSON.stringify({ expires_at: new Date(Date.now() + LINK_AUTH_TTL_MS).toISOString() }),
      headers: { Prefer: "return=minimal" },
    });
  } catch {
    /* non-fatal */
  }
}

async function bindAgentLinkSession(row, mcpSessionId) {
  const sessionId = String(mcpSessionId || "").trim();
  if (!row?.code || !sessionId || row.mcp_session_id === sessionId) return;
  try {
    await sb(`mcp_link_sessions?code=eq.${encodeURIComponent(row.code)}`, {
      method: "PATCH",
      body: JSON.stringify({ mcp_session_id: sessionId }),
      headers: { Prefer: "return=minimal" },
    });
  } catch {
    /* non-fatal */
  }
}

async function resolveAgentLinkAuth({ authCode, mcpSessionId } = {}) {
  const code = String(authCode || "").trim();
  const sessionId = String(mcpSessionId || "").trim();
  try {
    if (code) {
      const rows = await sb(
        `mcp_link_sessions?code=eq.${encodeURIComponent(code)}&mcp_kind=eq.agent&select=*&limit=1`,
      );
      const row = Array.isArray(rows) ? rows[0] : null;
      if (row?.status === "completed" && row.user_id && new Date(row.expires_at).getTime() >= Date.now()) {
        await touchAgentLinkAuthExpiry(row);
        await bindAgentLinkSession(row, sessionId);
        return {
          userId: row.user_id,
          agentId: row.agent_id,
          walletAddress: row.wallet_address,
          source: "link_auth",
          authCode: code,
          bearerPresent: false,
        };
      }
    }
    if (sessionId) {
      const rows = await sb(
        `mcp_link_sessions?mcp_session_id=eq.${encodeURIComponent(sessionId)}&mcp_kind=eq.agent&status=eq.completed&order=completed_at.desc&select=*&limit=1`,
      );
      const row = Array.isArray(rows) ? rows[0] : null;
      if (row?.user_id && new Date(row.expires_at).getTime() >= Date.now()) {
        await touchAgentLinkAuthExpiry(row);
        return {
          userId: row.user_id,
          agentId: row.agent_id,
          walletAddress: row.wallet_address,
          source: "link_session",
          authCode: row.code,
          bearerPresent: false,
        };
      }
    }
  } catch {
    /* table may be missing */
  }
  return null;
}

async function createAgentLinkAuthSession(req) {
  const { authPage } = mcpUrls(req);
  const code = opaque("oxlink");
  let sessionId = String(header(req, "mcp-session-id") || "").trim();
  if (!sessionId) sessionId = opaque("sess").slice(0, 24);
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  const linkPage = "https://www.orbitx.world/agent/link-auth";
  try {
    await sb("mcp_link_sessions", {
      method: "POST",
      body: JSON.stringify({
        code,
        mcp_kind: "agent",
        mcp_session_id: sessionId,
        status: "pending",
        expires_at: expiresAt,
      }),
      headers: { Prefer: "return=minimal" },
    });
  } catch (e) {
    return {
      ok: false,
      error: "link_auth_unavailable",
      message: e?.message || "Link auth unavailable — apply mcp_link_sessions migration.",
      fixUrl: "https://orbitx.world/agent",
      authPage,
    };
  }
  const url = `${linkPage}?code=${encodeURIComponent(code)}`;
  return {
    ok: true,
    url,
    openUrl: url,
    authCode: code,
    mcpSessionId: sessionId,
    expiresInMinutes: 15,
    expiresAt,
    message:
      "Prefer dashboard paste auth when the user already has an authCode. Otherwise send this clickable link — they authorize once, then call orbitx_auth_status and pass authCode on later tools (stays linked).",
  };
}

async function getAgentLinkAuthStatus(authCode) {
  const parsed = classifyOrbitXAuthPaste(authCode);
  if (parsed.kind === "telegram_login") {
    return {
      ok: false,
      error: "telegram_login_not_mcp",
      status: "wrong_link",
      authCode: parsed.code || null,
      url: parsed.url || telegramLoginUrl(parsed.code),
      message: TELEGRAM_LOGIN_NOT_MCP_MESSAGE,
    };
  }
  const code = String(parsed.code || authCode || "").trim();
  if (!code) return { ok: false, error: "authCode_required", status: "unknown" };
  try {
    const rows = await sb(
      `mcp_link_sessions?code=eq.${encodeURIComponent(code)}&mcp_kind=eq.agent&select=code,status,expires_at,completed_at,user_id&limit=1`,
    );
    const row = Array.isArray(rows) ? rows[0] : null;
    if (!row) return { ok: false, error: "not_found", status: "unknown", authCode: code };
    if (new Date(row.expires_at).getTime() < Date.now() && row.status === "pending") {
      return {
        ok: true,
        status: "expired",
        authCode: code,
        message: "Link expired. Call orbitx_auth_link again.",
      };
    }
    if (row.status === "completed" && row.user_id) {
      return {
        ok: true,
        status: "completed",
        authenticated: true,
        authCode: code,
        completedAt: row.completed_at,
        message:
          "OrbitX linked. Pass authCode on subsequent tool calls (or rely on this chat's MCP session — stays connected). Call orbitx_menu for the command board.",
      };
    }
    return {
      ok: true,
      status: "pending",
      authenticated: false,
      authCode: code,
      url: `https://www.orbitx.world/agent/link-auth?code=${encodeURIComponent(code)}`,
      message: "Waiting — ask the user to open the link and authorize (or paste a dashboard chat-auth message).",
    };
  } catch (e) {
    return { ok: false, error: "link_auth_unavailable", message: e?.message || "unavailable" };
  }
}

async function completeAgentLinkAuthSession({ code, userId, walletAddress }) {
  const authCode = String(code || "").trim();
  if (!authCode) throw new Error("code required");
  if (!userId) throw new Error("unauthorized");
  const rows = await sb(
    `mcp_link_sessions?code=eq.${encodeURIComponent(authCode)}&mcp_kind=eq.agent&select=*&limit=1`,
  );
  const row = Array.isArray(rows) ? rows[0] : null;
  if (!row) throw new Error("Invalid or unknown link code");
  if (new Date(row.expires_at).getTime() < Date.now()) {
    await sb(`mcp_link_sessions?code=eq.${encodeURIComponent(authCode)}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "expired" }),
      headers: { Prefer: "return=minimal" },
    });
    throw new Error("This link expired. Ask for a new auth link.");
  }
  if (row.status === "completed" && row.user_id === userId) {
    return { ok: true, status: "completed", authCode, already: true };
  }
  if (row.status === "completed") throw new Error("This link was already used by another account.");

  let agent = await ensureAgent(userId);
  const wallet = normalizeGateWallet(walletAddress || "") || agent.wallet_address || null;
  if (wallet && wallet !== agent.wallet_address) {
    const updated = await sb(`agents?id=eq.${encodeURIComponent(agent.id)}`, {
      method: "PATCH",
      body: JSON.stringify({
        wallet_address: wallet,
        phantom_connected: true,
        updated_at: new Date().toISOString(),
      }),
    });
    agent = Array.isArray(updated) ? updated[0] : agent;
  }
  const access = opaque("oxo");
  await sb("agent_api_keys", {
    method: "POST",
    body: JSON.stringify({
      agent_id: agent.id,
      name: `Grok link ${new Date().toISOString().slice(0, 16)}`,
      key_hash: sha256(access),
    }),
    headers: { Prefer: "return=minimal" },
  });
  try {
    await sb("agent_mcp_oauth_tokens", {
      method: "POST",
      body: JSON.stringify({
        token_hash: sha256(access),
        user_id: userId,
        agent_id: agent.id,
        wallet_address: wallet || agent.wallet_address,
        expires_at: new Date(Date.now() + 30 * 86400 * 1000).toISOString(),
      }),
      headers: { Prefer: "return=minimal" },
    });
  } catch {
    /* optional */
  }
  // Keep link usable for a year after approve — Grok/Claude pass authCode in tool args.
  // Sliding expiry on each successful resolve keeps "auth once" sessions alive.
  const linkExpires = new Date(Date.now() + LINK_AUTH_TTL_MS).toISOString();
  await sb(`mcp_link_sessions?code=eq.${encodeURIComponent(authCode)}`, {
    method: "PATCH",
    body: JSON.stringify({
      status: "completed",
      user_id: userId,
      agent_id: agent.id,
      wallet_address: wallet || agent.wallet_address,
      access_token_hash: sha256(access),
      completed_at: new Date().toISOString(),
      expires_at: linkExpires,
    }),
    headers: { Prefer: "return=minimal" },
  });
  return { ok: true, status: "completed", authCode };
}

/**
 * Dashboard mint: create an already-completed link session so the user can paste
 * authCode into Grok/Claude/ChatGPT without opening a mid-chat auth page.
 */
async function mintAgentLinkAuthSession({ userId, walletAddress, req } = {}) {
  if (!userId) throw new Error("unauthorized");
  const { mcpUrl } = mcpUrls(req);
  const code = opaque("oxlink");
  const sessionId = opaque("sess").slice(0, 24);
  let agent = await ensureAgent(userId);
  const wallet = normalizeGateWallet(walletAddress || "") || agent.wallet_address || null;
  if (wallet && wallet !== agent.wallet_address) {
    const updated = await sb(`agents?id=eq.${encodeURIComponent(agent.id)}`, {
      method: "PATCH",
      body: JSON.stringify({
        wallet_address: wallet,
        phantom_connected: true,
        updated_at: new Date().toISOString(),
      }),
    });
    agent = Array.isArray(updated) ? updated[0] : agent;
  }
  const access = opaque("oxo");
  await sb("agent_api_keys", {
    method: "POST",
    body: JSON.stringify({
      agent_id: agent.id,
      name: `Chat auth ${new Date().toISOString().slice(0, 16)}`,
      key_hash: sha256(access),
    }),
    headers: { Prefer: "return=minimal" },
  });
  try {
    await sb("agent_mcp_oauth_tokens", {
      method: "POST",
      body: JSON.stringify({
        token_hash: sha256(access),
        user_id: userId,
        agent_id: agent.id,
        wallet_address: wallet || agent.wallet_address,
        expires_at: new Date(Date.now() + 30 * 86400 * 1000).toISOString(),
      }),
      headers: { Prefer: "return=minimal" },
    });
  } catch {
    /* optional */
  }
  const linkExpires = new Date(Date.now() + LINK_AUTH_TTL_MS).toISOString();
  await sb("mcp_link_sessions", {
    method: "POST",
    body: JSON.stringify({
      code,
      mcp_kind: "agent",
      mcp_session_id: sessionId,
      status: "completed",
      user_id: userId,
      agent_id: agent.id,
      wallet_address: wallet || agent.wallet_address,
      access_token_hash: sha256(access),
      completed_at: new Date().toISOString(),
      expires_at: linkExpires,
    }),
    headers: { Prefer: "return=minimal" },
  });
  const messages = buildAgentAuthPasteMessages({
    authCode: code,
    mcpUrl,
    expiresAt: linkExpires,
  });
  return {
    ok: true,
    status: "completed",
    authenticated: true,
    authCode: code,
    mcpSessionId: sessionId,
    expiresAt: linkExpires,
    mcpUrl,
    walletAddress: wallet || agent.wallet_address || null,
    messages,
    message:
      "Copy the Grok / Claude / ChatGPT message into chat. The AI will call orbitx_auth_status with authCode — no website click needed.",
  };
}

/** Bearer first, then link-auth code, then linked wallet from tool args. */
async function enrichAuth(req, args = {}) {
  const { token, bearerPresent } = extractBearerToken(req);
  let auth = await resolveAuth(req);
  if (auth?.userId) {
    const withEmail = await withAuthEmail({
      ...auth,
      bearerPresent,
      bearerTokenPrefix: token ? `${token.slice(0, 8)}…` : null,
    });
    return withEmail;
  }

  const parsedAuth = classifyOrbitXAuthPaste(args.authCode || args.orbitxAuthCode || "");
  const authCode = parsedAuth.kind === "telegram_login" ? "" : String(parsedAuth.code || "").trim();
  const link = await resolveAgentLinkAuth({
    authCode,
    mcpSessionId: header(req, "mcp-session-id"),
  });
  if (link?.userId) {
    return withAuthEmail({ ...link, bearerPresent: false });
  }

  const wallet = String(
    args.publicKey || args.address || args.wallet || args.buyerWallet || args.sellerWallet || "",
  ).trim();
  // A raw publicKey is a trade argument, never a login. Binding identity from
  // wallet alone let anyone impersonate the owner (wallets are public).

  return {
    userId: null,
    agentId: null,
    walletAddress: wallet || null,
    email: null,
    source: bearerPresent ? "bearer_unresolved" : wallet ? "wallet_unlinked" : "anonymous",
    bearerPresent,
    bearerInvalid: bearerPresent,
    bearerTokenPrefix: token ? `${token.slice(0, 8)}…` : null,
    authCode:
      parsedAuth.kind === "telegram_login"
        ? String(args.authCode || args.orbitxAuthCode || "").trim()
        : authCode || null,
  };
}

function wwwAuthenticate(base) {
  return `Bearer FAKESECRET_g3h4i5j6k7l8m9n0o1p2="${base}/.well-known/oauth-protected-resource", scope="orbitx"`;
}

/** Tools that need a wallet pubkey in args (or a linked Bearer session). */
const WALLET_TOOLS = new Set([
  "orbitx_get_wallet",
  "orbitx_get_swaps",
  "orbitx_get_balance",
  "orbitx_prepare_buy",
  "orbitx_prepare_sell",
  "orbitx_prepare_launch",
  "orbitx_execute_launch",
  "orbitx_launch_execution",
  "orbitx_create_token",
  "orbitx_launch_ipfs",
  "orbitx_launch_record",
  "orbitx_claim_fees",
  "orbitx_rent_refund",
  "orbitx_burn",
  "orbitx_nft_prepare_buy",
  "orbitx_nft_submit_buy",
  "orbitx_nft_like",
  "orbitx_nft_comment",
  "orbitx_nft_follow",
  "orbitx_nft_register",
  "orbitx_nft_register_collection",
  "orbitx_nft_make_offer",
  "orbitx_nft_cancel_offer",
  "orbitx_nft_list_for_sale",
  "orbitx_nft_cancel_listing",
  "orbitx_nft_create_auction",
  "orbitx_nft_place_bid",
  "orbitx_nft_favorite",
]);

/** Community / listing write tools — need Bearer userId (or publicKey of a wallet linked on /agent). */
const SESSION_TOOLS = new Set([
  "orbitx_social_join",
  "orbitx_social_post",
  "orbitx_social_create_community",
  "orbitx_social_leave",
  "orbitx_submit_listing",
  "orbitx_request_boost",
  "orbitx_generate_image",
  "orbitx_generate_video",
  "orbitx_media_status",
  "orbitx_grok_image",
  "orbitx_grok_video",
  "orbitx_gen_image",
  "orbitx_gen_video",
  "orbitx_x_post",
  "orbitx_x_reply",
  "orbitx_x_quote",
  "orbitx_vc_start",
  "orbitx_vc_end",
  "orbitx_gc_start",
]);

async function getProfileForUser(userId) {
  const id = String(userId || "").trim();
  if (!id) return null;
  try {
    const rows = await sb(
      `profiles?user_id=eq.${encodeURIComponent(id)}&select=username,display_name,avatar_url&limit=1`,
    );
    return Array.isArray(rows) ? rows[0] : null;
  } catch {
    return null;
  }
}

const TOOL_ALIASES = {
  ...TELEGRAM_TOOL_ALIASES,
  "/": "orbitx_menu",
  menu: "orbitx_menu",
  help: "orbitx_menu",
  orbitx_buy: "orbitx_prepare_buy",
  orbitx_trade: "orbitx_prepare_buy",
  orbitx_swap: "orbitx_prepare_buy",
  trade: "orbitx_prepare_buy",
  swap: "orbitx_prepare_buy",
  orbitx_sell: "orbitx_prepare_sell",
  orbitx_buy_auto: "orbitx_prepare_buy",
  orbitx_sell_pump: "orbitx_prepare_sell",
  orbitx_quote: "orbitx_trade_quote",
  quote: "orbitx_trade_quote",
  tweet: "orbitx_x_post",
  post_to_x: "orbitx_x_post",
  start_vc: "orbitx_vc_start",
  open_vc: "orbitx_vc_start",
  any_open_vc: "orbitx_vc_list",
  join_vc: "orbitx_vc_join",
  vc_link: "orbitx_vc_link",
  start_group_chat: "orbitx_gc_start",
  start_gc: "orbitx_gc_start",
  create_group_chat: "orbitx_gc_start",
  any_group_chats: "orbitx_gc_list",
  group_chats: "orbitx_gc_list",
  hey_any_group_chats: "orbitx_gc_list",
  join_gc: "orbitx_gc_join",
  join_group_chat: "orbitx_gc_join",
  chat_in_gc: "orbitx_gc_focus",
  chat_in_group: "orbitx_gc_focus",
  chat_in_the_group_chat: "orbitx_gc_focus",
  orbitx_gc_enter: "orbitx_gc_focus",
  leave_gc: "orbitx_gc_leave",
  "leave gc": "orbitx_gc_leave",
  leave_group_chat: "orbitx_gc_leave",
  orbitx_gc_exit: "orbitx_gc_leave",
  gc_send: "orbitx_gc_send",
  gc_history: "orbitx_gc_history",
  orbitx_gc_read: "orbitx_gc_history",
  "buy orbitx": "orbitx_buy_orbitx",
  "buy $orbitx": "orbitx_buy_orbitx",
  buy_orbitx: "orbitx_buy_orbitx",
  buyorbitx: "orbitx_buy_orbitx",
  confirm_buy: "orbitx_confirm_buy",
  "confirm buy": "orbitx_confirm_buy",
  "yes buy": "orbitx_confirm_buy",
  "buy credits": "orbitx_credits_buy",
  buy_credits: "orbitx_credits_buy",
  buycredits: "orbitx_credits_buy",
  topup: "orbitx_credits_buy",
  "top up": "orbitx_credits_buy",
  shop: "orbitx_shop",
  orbitx_shop: "orbitx_shop",
  "confirm credits": "orbitx_credits_confirm",
  credits_confirm: "orbitx_credits_confirm",
  credits: "orbitx_credits_balance",
  "credits balance": "orbitx_credits_balance",
  "credits usage": "orbitx_credits_usage",
  chart: "orbitx_dex_chart",
  charts: "orbitx_dex_chart",
  dex_chart: "orbitx_dex_chart",
  dexchart: "orbitx_dex_chart",
  embed_chart: "orbitx_dex_chart",
  "dex chart": "orbitx_dex_chart",
  "show chart": "orbitx_dex_chart",
  "token chart": "orbitx_dex_chart",
  dexscreener: "orbitx_dex_chart",
  "dex screener": "orbitx_dex_chart",
  orbitx_chart: "orbitx_dex_chart",
  orbitx_chart_embed: "orbitx_dex_chart",
  orbitx_embed_chart: "orbitx_dex_chart",
  usage: "orbitx_credits_usage",
  "mcp access": "orbitx_mcp_access_status",
  "access status": "orbitx_mcp_access_status",
  "burn access": "orbitx_mcp_access_buy",
  "buy access": "orbitx_mcp_access_buy",
  mcp_access: "orbitx_mcp_access_status",
  mcp_access_buy: "orbitx_mcp_access_buy",
  "confirm access": "orbitx_mcp_access_confirm",
  orbitx_launch_token: "orbitx_execute_launch",
  orbitx_create_community: "orbitx_social_create_community",
  orbitx_post_community: "orbitx_social_post",
  orbitx_list_token: "orbitx_submit_listing",
  orbitx_boost_token: "orbitx_request_boost",
  orbitx_request_listing: "orbitx_submit_listing",
  orbitx_create_coin: "orbitx_execute_launch",
  orbitx_create_token: "orbitx_execute_launch",
  orbitx_prepare_launch: "orbitx_execute_launch",
  orbitx_launch_execution: "orbitx_execute_launch",
  orbit_launch_execution: "orbitx_execute_launch",
  orbitx_launch_execute: "orbitx_execute_launch",
  orbit_execute_launch: "orbitx_execute_launch",
  orbitx_execute_token_launch: "orbitx_execute_launch",
  execute_launch: "orbitx_execute_launch",
  launch_execution: "orbitx_execute_launch",
  orbitx_grok_image: "orbitx_generate_image",
  orbitx_grok_video: "orbitx_generate_video",
  orbitx_gen_image: "orbitx_generate_image",
  orbitx_gen_video: "orbitx_generate_video",
};

async function resolveSocialUser(auth, args) {
  if (auth?.userId) {
    return {
      userId: auth.userId,
      agentId: auth.agentId || null,
      walletAddress: auth.walletAddress || null,
    };
  }
  return null;
}

const CORE_TOOLS = [
  // ChatGPT / Grok connectors expect exact names search + fetch or they may show "no tools".
  {
    name: "search",
    description:
      "Search OrbitX Agent MCP capabilities and tokens. Query examples: menu, help, auth, trending, mint address, ticker.",
    inputSchema: {
      type: "object",
      properties: { query: { type: "string", description: "Search query" } },
      required: ["query"],
      additionalProperties: false,
    },
  },
  {
    name: "fetch",
    description: "Fetch a document by id from search (menu, help, auth, tool:<name>, or a mint).",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string", description: "Document id from search" } },
      required: ["id"],
      additionalProperties: false,
    },
  },
  {
    name: "orbitx_menu",
    description:
      "OrbitX command menu — branded banner + capability list. Call when the user says /, menu, help, or asks what you can do.",
    inputSchema: {
      type: "object",
      properties: {
        authCode: {
          type: "string",
          description: "Optional authCode from dashboard paste or orbitx_auth_link",
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: "orbitx_auth_link",
    description:
      "Start OrbitX authentication for this chat (Grok fallback). Prefer a dashboard-pasted authCode when the user provides one — call orbitx_auth_status instead of opening a new link. Otherwise return a clickable URL, then orbitx_auth_status, then pass authCode on later tools.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "orbitx_auth_status",
    description:
      "Activate or check OrbitX auth. Pass authCode from a dashboard paste message or orbitx_auth_link. When completed, keep using that authCode on every later tool (stays linked).",
    inputSchema: {
      type: "object",
      properties: {
        authCode: {
          type: "string",
          description: "Code from dashboard paste or orbitx_auth_link",
        },
      },
      required: ["authCode"],
      additionalProperties: false,
    },
  },
  {
    name: "orbitx_whoami",
    description:
      "Session identity. Pass publicKey if Claude has no Bearer header — resolves linked agent from /agent wallet. Returns userId, agentId, auth source. For Grok, pass authCode from dashboard paste or orbitx_auth_link.",
    inputSchema: {
      type: "object",
      properties: {
        publicKey: {
          type: "string",
          description: "Optional Solana wallet linked on https://orbitx.world/agent",
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: "orbitx_gc_start",
    description:
      "Create a named group chat. When the user says start a group chat named Orbitx — call this with name. Anyone can list and join it.",
    inputSchema: {
      type: "object",
      properties: { name: { type: "string", description: "Group chat name" }, topic: { type: "string" } },
      required: ["name"],
      additionalProperties: false,
    },
  },
  {
    name: "orbitx_gc_list",
    description:
      "List open group chats. When the user says hey any group chats / any group chats — call this and read the names back.",
    inputSchema: {
      type: "object",
      properties: { limit: { type: "integer", default: 20 } },
      additionalProperties: false,
    },
  },
  {
    name: "orbitx_gc_join",
    description:
      "Join a group chat by name. When the user says join Orbitx — call this with name. Then they must say I want to chat in the group chat to enter sticky chat mode.",
    inputSchema: {
      type: "object",
      properties: { name: { type: "string" }, slug: { type: "string" } },
      additionalProperties: false,
    },
  },
  {
    name: "orbitx_gc_focus",
    description:
      "Enter sticky group-chat mode. When the user says I want to chat in the group chat — call this. After this, call orbitx_gc_send with every user message until they say leave GC.",
    inputSchema: {
      type: "object",
      properties: { name: { type: "string" }, slug: { type: "string" } },
      additionalProperties: false,
    },
  },
  {
    name: "orbitx_gc_send",
    description:
      "Post a message to the focused group chat and return the latest transcript. While in GC mode, send every user line here.",
    inputSchema: {
      type: "object",
      properties: { text: { type: "string", description: "Message to post" } },
      required: ["text"],
      additionalProperties: false,
    },
  },
  {
    name: "orbitx_gc_chat",
    description:
      "Enter the group chat (same as focus). If text is set, also post it. Use when the user wants to talk in the GC.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        slug: { type: "string" },
        text: { type: "string" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "orbitx_gc_leave",
    description:
      "Leave sticky group-chat mode. When the user says leave GC / okay use tool leave GC — call this immediately. They can join back anytime.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "orbitx_gc_history",
    description: "Read recent messages in a group chat (or the focused one).",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        slug: { type: "string" },
        limit: { type: "integer", default: 20 },
      },
      additionalProperties: false,
    },
  },
  {
    name: "orbitx_vc_start",
    description:
      "Start a named LiveKit voice chat. When the user says start a VC named X — call this with name. Returns a join URL anyone can open.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Room name" },
        topic: { type: "string" },
      },
      required: ["name"],
      additionalProperties: false,
    },
  },
  {
    name: "orbitx_vc_list",
    description:
      "List open LiveKit VCs with join links. When the user says any open VC / send the link — call this.",
    inputSchema: {
      type: "object",
      properties: { limit: { type: "integer", default: 12 } },
      additionalProperties: false,
    },
  },
  {
    name: "orbitx_vc_join",
    description: "Get a join URL (and LiveKit token when configured) for a named or slug VC.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        slug: { type: "string" },
        displayName: { type: "string" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "orbitx_vc_link",
    description: "Alias of orbitx_vc_join — return the public join link for a VC.",
    inputSchema: {
      type: "object",
      properties: { name: { type: "string" }, slug: { type: "string" } },
      additionalProperties: false,
    },
  },
  {
    name: "orbitx_vc_end",
    description: "End a live MCP voice chat by name or slug.",
    inputSchema: {
      type: "object",
      properties: { name: { type: "string" }, slug: { type: "string" } },
      additionalProperties: false,
    },
  },
  {
    name: "orbitx_x_connect",
    description:
      "Connect the user's X account to OrbitX so this MCP can post. Returns /auth (Supabase Continue with X) and /x (tweet.write) links.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "orbitx_x_status",
    description: "Show whether X is connected for this OrbitX user and if tweet.write is granted.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "orbitx_x_post",
    description:
      "Post a tweet on the connected X account. Requires OrbitX auth + X connected via /auth Continue with X or /x.",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string", description: "Tweet body" },
        linkUrl: { type: "string" },
        replyToTweetId: { type: "string" },
        quoteTweetId: { type: "string" },
      },
      required: ["text"],
      additionalProperties: false,
    },
  },
  {
    name: "orbitx_x_reply",
    description: "Reply to a tweet id from the connected X account.",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string" },
        replyToTweetId: { type: "string" },
      },
      required: ["text", "replyToTweetId"],
      additionalProperties: false,
    },
  },
  {
    name: "orbitx_x_quote",
    description: "Quote-tweet by id from the connected X account.",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string" },
        quoteTweetId: { type: "string" },
      },
      required: ["text", "quoteTweetId"],
      additionalProperties: false,
    },
  },
  {
    name: "orbitx_trade_quote",
    description:
      "Jupiter quote SOL → mint (no signature). When the user asks price impact / how much they get — call this. Then orbitx_prepare_buy to sign.",
    inputSchema: {
      type: "object",
      properties: {
        mint: { type: "string" },
        amountSol: { type: "number", description: "SOL to spend (default 0.1)" },
        slippage: { type: "number", default: 10 },
      },
      required: ["mint"],
      additionalProperties: false,
    },
  },
  {
    name: "orbitx_search",
    description: "Search tokens by name, symbol, or mint address.",
    inputSchema: {
      type: "object",
      properties: { q: { type: "string", description: "Name, ticker, or mint" } },
      required: ["q"],
    },
  },
  {
    name: "orbitx_get_token",
    description:
      "Full token intel: price, market cap, holders, OG score, trust verdict, forensics summary.",
    inputSchema: {
      type: "object",
      properties: {
        mint: { type: "string" },
        chain: { type: "string", default: "solana" },
      },
      required: ["mint"],
    },
  },
  {
    name: "orbitx_screen_tokens",
    description: "Screen/rank tokens by category (trending, new, runners, graduating, kol, etc.).",
    inputSchema: {
      type: "object",
      properties: {
        type: {
          type: "string",
          enum: [
            "trending",
            "new",
            "runners",
            "fomo",
            "kol",
            "organic",
            "graduating",
            "migrated",
            "social",
            "verified",
          ],
        },
        interval: { type: "string", enum: ["5m", "1h", "6h", "24h"], default: "1h" },
        limit: { type: "integer", default: 20 },
        chain: { type: "string", default: "solana" },
      },
      required: ["type"],
    },
  },
  {
    name: "orbitx_get_forensics",
    description: "Forensics: dev wallet, first buyer, bundles, concentration, LP lock, safety flags.",
    inputSchema: { type: "object", properties: { mint: { type: "string" } }, required: ["mint"] },
  },
  {
    name: "orbitx_get_safety",
    description: "Honeypot / tradeability check — can you buy and sell this mint?",
    inputSchema: { type: "object", properties: { mint: { type: "string" } }, required: ["mint"] },
  },
  {
    name: "orbitx_crypto_scan",
    description: "One-shot aggregator: safety + forensics + token payload for a mint.",
    inputSchema: { type: "object", properties: { mint: { type: "string" } }, required: ["mint"] },
  },
  {
    name: "orbitx_get_ath",
    description: "All-time-high price and market cap for a token.",
    inputSchema: { type: "object", properties: { mint: { type: "string" } }, required: ["mint"] },
  },
  {
    name: "orbitx_get_chart",
    description:
      "Raw OHLCV candlestick JSON for a token. Prefer orbitx_dex_chart when the user wants a live DexScreener embed chart in chat.",
    inputSchema: {
      type: "object",
      properties: {
        mint: { type: "string" },
        interval: { type: "string", enum: ["5m", "15m", "1h", "4h", "1d"], default: "1h" },
        limit: { type: "integer", default: 200 },
        chain: { type: "string", default: "solana" },
      },
      required: ["mint"],
    },
  },
  {
    name: "orbitx_dex_chart",
    description:
      "HIGH QUALITY DexScreener embed chart for chat. When the user shares a CA/mint and asks for a chart, graph, DexScreener, or candles — call this immediately. Resolves the best liquidity pair and returns markdown with live embed URL, iframe, price/liq/volume stats, interval links, and OrbitX trade link. Works with Solana mint CA or pair address (also EVM).",
    inputSchema: {
      type: "object",
      properties: {
        ca: {
          type: "string",
          description: "Token contract address (mint CA) or DexScreener pair address",
        },
        mint: { type: "string", description: "Alias of ca" },
        chain: {
          type: "string",
          description: "Chain id (default solana). Examples: solana, ethereum, base, bsc",
          default: "solana",
        },
        interval: {
          type: "string",
          enum: ["1m", "5m", "15m", "1h", "4h", "12h", "24h"],
          default: "15m",
          description: "Chart timeframe for the embed",
        },
        theme: { type: "string", enum: ["dark", "light"], default: "dark" },
        iframe: {
          type: "boolean",
          default: true,
          description: "Include HTML iframe block in markdown for clients that render HTML",
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: "orbitx_get_wallet",
    description: "Wallet portfolio: SOL balance, holdings, realized/unrealized PnL.",
    inputSchema: {
      type: "object",
      properties: {
        address: {
          type: "string",
          description: "Solana wallet. Omit to use the linked agent wallet.",
        },
      },
    },
  },
  {
    name: "orbitx_get_swaps",
    description: "Recent buy/sell swaps for a wallet (trade history).",
    inputSchema: {
      type: "object",
      properties: {
        address: { type: "string", description: "Omit to use linked agent wallet" },
        limit: { type: "integer", default: 25 },
      },
    },
  },
  {
    name: "orbitx_get_balance",
    description: "Token or SOL balance for a wallet.",
    inputSchema: {
      type: "object",
      properties: {
        address: { type: "string" },
        mint: { type: "string", description: "Optional token mint; omit for SOL" },
      },
    },
  },
  {
    name: "orbitx_get_kols",
    description: "KOL / smart-money directory with labels and performance.",
    inputSchema: {
      type: "object",
      properties: { limit: { type: "integer", default: 20 } },
    },
  },
  {
    name: "orbitx_get_traders",
    description: "Top traders leaderboard / smart money flow.",
    inputSchema: {
      type: "object",
      properties: { limit: { type: "integer", default: 20 } },
    },
  },
  {
    name: "orbitx_get_signals",
    description: "Live trading signals / alerts feed.",
    inputSchema: {
      type: "object",
      properties: { limit: { type: "integer", default: 20 } },
    },
  },
  {
    name: "orbitx_get_launches",
    description: "Recently launched tokens on the OrbitX Launchpad (newly listed).",
    inputSchema: {
      type: "object",
      properties: { limit: { type: "integer", default: 20 } },
    },
  },
  {
    name: "orbitx_launch_config",
    description:
      "Get launchpad fee config for a chain (fee USD, pay wallet, SOL price). Use before launching.",
    inputSchema: {
      type: "object",
      properties: { chain: { type: "string", default: "solana" } },
    },
  },
  {
    name: "orbitx_launch_check",
    description: "Check if a launch name/symbol is available (duplicate guard).",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        symbol: { type: "string" },
        chain: { type: "string", default: "solana" },
      },
      required: ["name", "symbol"],
    },
  },
  {
    name: "orbitx_launch_ipfs",
    description:
      "Upload token metadata/image to IPFS for a Pump.fun / OrbitX launch. Returns metadataUri for create step.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        symbol: { type: "string" },
        description: { type: "string" },
        imageBase64: { type: "string" },
        imageMimeType: { type: "string", default: "image/png" },
        twitter: { type: "string" },
        telegram: { type: "string" },
        website: { type: "string" },
        chain: { type: "string", default: "solana" },
      },
      required: ["name", "symbol", "imageBase64"],
    },
  },
  {
    name: "orbitx_execute_launch",
    description:
      "LAUNCH EXECUTION — complete the final Pump.fun create transaction via OrbitX + Phantom. This is the orbit launch execution tool. Returns openUrl — user opens it, connects Phantom, pays fee, signs create. Use after orbitx_launch_ipfs (optional) or with imageUrl. Required to finish a pump.fun launch.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        symbol: { type: "string" },
        description: { type: "string" },
        imageUrl: { type: "string", description: "Public image URL for the token logo" },
        metadataUri: {
          type: "string",
          description: "Optional IPFS metadata URI from orbitx_launch_ipfs (handoff still uses launchpad)",
        },
        twitter: { type: "string" },
        telegram: { type: "string" },
        website: { type: "string" },
        lane: { type: "string", enum: ["pump", "custom"], default: "pump" },
        publicKey: { type: "string" },
        mintPublicKey: { type: "string", description: "Optional vanity mint pubkey hint" },
        devBuySol: { type: "number", default: 0 },
      },
      required: ["name", "symbol"],
    },
  },
  {
    name: "orbitx_create_token",
    description:
      "Alias for orbitx_execute_launch — CREATE / finish Pump.fun token via Phantom launchpad openUrl.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        symbol: { type: "string" },
        description: { type: "string" },
        imageUrl: { type: "string", description: "Public image URL for the token logo" },
        twitter: { type: "string" },
        telegram: { type: "string" },
        website: { type: "string" },
        lane: { type: "string", enum: ["pump", "custom"], default: "pump" },
        publicKey: { type: "string" },
      },
      required: ["name", "symbol"],
    },
  },
  {
    name: "orbitx_prepare_launch",
    description:
      "Alias for orbitx_execute_launch — use that tool to complete the final pump.fun create in Phantom.",
    inputSchema: {
      type: "object",
      properties: {
        publicKey: { type: "string" },
        name: { type: "string" },
        symbol: { type: "string" },
        metadataUri: { type: "string" },
        mintPublicKey: { type: "string" },
        imageUrl: { type: "string" },
        description: { type: "string" },
        devBuySol: { type: "number", default: 0 },
        slippage: { type: "number", default: 10 },
        chain: { type: "string", default: "solana" },
      },
      required: ["name", "symbol"],
    },
  },
  {
    name: "orbitx_launch_execution",
    description:
      "Alias for orbitx_execute_launch — the orbit launch execution tool for the final Pump.fun create tx.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        symbol: { type: "string" },
        description: { type: "string" },
        imageUrl: { type: "string" },
        metadataUri: { type: "string" },
        publicKey: { type: "string" },
        lane: { type: "string", enum: ["pump", "custom"], default: "pump" },
      },
      required: ["name", "symbol"],
    },
  },
  {
    name: "orbitx_launch_record",
    description: "Record a completed launch after fee payment + create tx confirmed.",
    inputSchema: {
      type: "object",
      properties: {
        mint: { type: "string" },
        payment_tx: { type: "string" },
        creator_wallet: { type: "string" },
        name: { type: "string" },
        symbol: { type: "string" },
        launch_tx: { type: "string" },
        description: { type: "string" },
        icon: { type: "string" },
        chain: { type: "string", default: "solana" },
      },
      required: ["mint", "payment_tx"],
    },
  },
  {
    name: "orbitx_vanity_mint",
    description: "Generate a vanity mint keypair (e.g. suffix obx) for a new launch.",
    inputSchema: {
      type: "object",
      properties: {
        suffix: { type: "string", default: "obx" },
        maxIterations: { type: "integer", default: 500000 },
      },
    },
  },
  {
    name: "orbitx_prepare_buy",
    description:
      "Prepare a BUY via Jupiter. Returns signUrl — open it so the user signs in Jupiter Wallet. Never broadcast unsigned. Purchase incomplete until Jupiter confirms. Do not use Phantom Connect.",
    inputSchema: {
      type: "object",
      properties: {
        mint: { type: "string" },
        amountSol: { type: "number" },
        publicKey: { type: "string", description: "Buyer Solana wallet (required)" },
        slippage: { type: "number", default: 10 },
        pool: {
          type: "string",
          enum: ["auto", "pump", "raydium", "pump-amm", "launchlab", "raydium-cpmm", "bonk"],
          default: "auto",
        },
      },
      required: ["mint", "amountSol", "publicKey"],
    },
  },
  {
    name: "orbitx_prepare_sell",
    description:
      "Prepare a SELL via Jupiter. Returns signUrl — open it so the user signs in Jupiter Wallet. amount as tokens or '100%'. Never broadcast unsigned.",
    inputSchema: {
      type: "object",
      properties: {
        mint: { type: "string" },
        amount: { type: ["number", "string"] },
        publicKey: { type: "string", description: "Seller Solana wallet (required)" },
        slippage: { type: "number", default: 10 },
        pool: { type: "string", default: "auto" },
      },
      required: ["mint", "amount", "publicKey"],
    },
  },
  {
    name: "orbitx_claim_fees",
    description:
      "Claim pump.fun creator fees via Phantom. Returns signUrl — open and approve. Requires publicKey of creator wallet.",
    inputSchema: {
      type: "object",
      properties: { publicKey: { type: "string" } },
      required: ["publicKey"],
    },
  },
  {
    name: "orbitx_rent_refund",
    description:
      "Reclaim rent SOL from empty token accounts via Phantom. Returns signUrl. Requires publicKey.",
    inputSchema: {
      type: "object",
      properties: { publicKey: { type: "string" } },
      required: ["publicKey"],
    },
  },
  {
    name: "orbitx_burn",
    description:
      "Burn tokens via Phantom. Returns signUrl. Use amount (tokens) or percent (0-100). Full burn can close ATA for rent.",
    inputSchema: {
      type: "object",
      properties: {
        mint: { type: "string" },
        amount: { type: ["number", "string"] },
        percent: { type: "number" },
        publicKey: { type: "string" },
      },
      required: ["mint", "publicKey"],
    },
  },
  {
    name: "orbitx_buy",
    description: "Alias for orbitx_prepare_buy — returns Jupiter signUrl.",
    inputSchema: {
      type: "object",
      properties: {
        mint: { type: "string" },
        amountSol: { type: "number" },
        publicKey: { type: "string" },
        slippage: { type: "number", default: 10 },
        pool: { type: "string", default: "auto" },
      },
      required: ["mint", "amountSol", "publicKey"],
    },
  },
  {
    name: "orbitx_trade",
    description: "Alias for orbitx_prepare_buy (/trade). Returns Jupiter signUrl.",
    inputSchema: {
      type: "object",
      properties: {
        mint: { type: "string" },
        amountSol: { type: "number" },
        publicKey: { type: "string" },
        slippage: { type: "number", default: 10 },
        pool: { type: "string", default: "auto" },
      },
      required: ["mint", "amountSol", "publicKey"],
    },
  },
  {
    name: "orbitx_swap",
    description: "Alias for orbitx_prepare_buy (/swap). Returns Jupiter signUrl.",
    inputSchema: {
      type: "object",
      properties: {
        mint: { type: "string" },
        amountSol: { type: "number" },
        publicKey: { type: "string" },
        slippage: { type: "number", default: 10 },
        pool: { type: "string", default: "auto" },
      },
      required: ["mint", "amountSol", "publicKey"],
    },
  },
  {
    name: "orbitx_sell",
    description: "Alias for orbitx_prepare_sell — returns Jupiter signUrl.",
    inputSchema: {
      type: "object",
      properties: {
        mint: { type: "string" },
        amount: { type: ["number", "string"] },
        publicKey: { type: "string" },
        slippage: { type: "number", default: 10 },
        pool: { type: "string", default: "auto" },
      },
      required: ["mint", "amount", "publicKey"],
    },
  },
  {
    name: "orbitx_buy_auto",
    description: "Buy with pool=auto — alias for orbitx_prepare_buy (Jupiter signUrl).",
    inputSchema: {
      type: "object",
      properties: {
        mint: { type: "string" },
        amountSol: { type: "number" },
        publicKey: { type: "string" },
        slippage: { type: "number", default: 10 },
      },
      required: ["mint", "amountSol", "publicKey"],
    },
  },
  {
    name: "orbitx_credits_buy",
    description:
      "Buy OrbitX MCP credits with SOL sent to the OrbitX desk wallet. When the user says buy credits / top up — ASK how many credits OR how much SOL, then call this. Returns a Jupiter signUrl (or autoSignUrl) that starts the SOL transfer. After payment, call orbitx_credits_confirm with the signature (sign page often credits automatically).",
    inputSchema: {
      type: "object",
      properties: {
        solAmount: { type: "number", description: "SOL to spend (any amount)" },
        credits: { type: "number", description: "Credit count to buy (converted to SOL at 10000/SOL)" },
        amount: { type: "number", description: "Alias: credits if >=10, else SOL" },
        publicKey: { type: "string", description: "Buyer wallet (optional if linked on /agent)" },
        confirmMode: { type: "string", enum: ["sign", "auto"] },
        autoConfirm: { type: "boolean" },
        askOnly: { type: "boolean" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "orbitx_credits_confirm",
    description:
      "Confirm a credits SOL payment to the desk wallet and credit the user's balance. Pass the Solana tx signature after Jupiter confirms.",
    inputSchema: {
      type: "object",
      properties: {
        signature: { type: "string" },
        txSignature: { type: "string" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "orbitx_credits_balance",
    description: "Show purchasable MCP credit balance and lifetime totals.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "orbitx_credits_usage",
    description:
      "Advanced credits usage report — balance, period analytics (24h/7d/30d/all), SOL in, burn/runway, packs, ledger, markdown for chat. Call when user asks for usage/billing/advanced usage.",
    inputSchema: {
      type: "object",
      properties: {
        period: { type: "string", enum: ["24h", "7d", "30d", "all"] },
        limit: { type: "integer" },
        format: { type: "string", enum: ["both", "markdown", "json"] },
      },
      additionalProperties: false,
    },
  },
  {
    name: "orbitx_mcp_access_status",
    description:
      "Show temporary Agent MCP access purchased by burning $ORBITX — active/expired, time remaining, packages (1 hour = 100, 1 day = 1,000, 1 week = 10,000, 1 month = 1,000,000 tokens).",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "orbitx_mcp_access_buy",
    description:
      "Buy temporary Agent MCP access by burning $ORBITX. Packages: hour = 100 (1h), day = 1,000 (24h), week = 10,000 (7d), month = 1,000,000 (30d). Returns a Jupiter signUrl (buy then burn). After the tx lands, call orbitx_mcp_access_confirm with the signature or /verify the Solscan link in Telegram.",
    inputSchema: {
      type: "object",
      properties: {
        package: { type: "string", enum: ["hour", "day", "week", "month"], description: "Access package" },
        packageId: { type: "string", enum: ["hour", "day", "week", "month"] },
        publicKey: { type: "string", description: "Burner wallet (optional if linked on /agent)" },
        confirmMode: { type: "string", enum: ["sign", "auto"] },
        autoConfirm: { type: "boolean" },
        askOnly: { type: "boolean" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "orbitx_mcp_access_confirm",
    description:
      "Confirm an $ORBITX burn and grant MCP access for the matching package duration. Pass the Solana tx signature after Jupiter confirms.",
    inputSchema: {
      type: "object",
      properties: {
        signature: { type: "string" },
        txSignature: { type: "string" },
        package: { type: "string", enum: ["hour", "day", "week", "month"] },
        packageId: { type: "string", enum: ["hour", "day", "week", "month"] },
      },
      additionalProperties: false,
    },
  },
  {
    name: "orbitx_buy_orbitx",
    description:
      "Buy official $ORBITX with SOL. When the user says buy $ORBITX / buy orbitx — ASK how much SOL, then whether they want to sign manually or auto-confirm in chat. confirmMode=sign → signUrl; confirmMode=auto → autoSignUrl opens Jupiter immediately. Mint is fixed to official ORBITX.",
    inputSchema: {
      type: "object",
      properties: {
        amountSol: { type: "number", description: "SOL to spend on $ORBITX" },
        publicKey: { type: "string", description: "Buyer wallet (optional if linked on /agent)" },
        confirmMode: {
          type: "string",
          enum: ["sign", "auto"],
          description: "sign = tap Sign on page; auto = open link and Jupiter prompts (chat auto-confirm)",
        },
        autoConfirm: {
          type: "boolean",
          description: "If true, same as confirmMode=auto",
        },
        amountUsd: {
          type: "number",
          description: "USD to spend; converted to SOL from the live SOL/USD price",
        },
        slippage: { type: "number", default: 10 },
        askOnly: {
          type: "boolean",
          description: "If true or amountSol omitted, return the ask-how-much prompt",
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: "orbitx_confirm_buy",
    description:
      "Chat confirm for a pending $ORBITX buy. Call when the user says yes / confirm / go ahead / auto after orbitx_buy_orbitx. Re-prepares the buy and returns autoSignUrl (Jupiter auto-prompt). Pass amountSol if known; otherwise uses the last pending intent.",
    inputSchema: {
      type: "object",
      properties: {
        amountSol: { type: "number", description: "SOL amount (optional if a pending intent exists)" },
        publicKey: { type: "string" },
        slippage: { type: "number", default: 10 },
      },
      additionalProperties: false,
    },
  },
  {
    name: "orbitx_sell_pump",
    description: "Sell on pump pool — alias for orbitx_prepare_sell with pool=pump.",
    inputSchema: {
      type: "object",
      properties: {
        mint: { type: "string" },
        amount: { type: ["number", "string"] },
        publicKey: { type: "string" },
        slippage: { type: "number", default: 10 },
      },
      required: ["mint", "amount", "publicKey"],
    },
  },
  {
    name: "orbitx_launch_token",
    description: "Alias for orbitx_execute_launch — opens Phantom launchpad for final create.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        symbol: { type: "string" },
        description: { type: "string" },
        imageUrl: { type: "string" },
        twitter: { type: "string" },
        telegram: { type: "string" },
        website: { type: "string" },
        lane: { type: "string", enum: ["pump", "custom"], default: "pump" },
        publicKey: { type: "string" },
      },
      required: ["name", "symbol"],
    },
  },
  {
    name: "orbitx_create_coin",
    description: "Alias for orbitx_execute_launch.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        symbol: { type: "string" },
        description: { type: "string" },
        imageUrl: { type: "string" },
        publicKey: { type: "string" },
      },
      required: ["name", "symbol"],
    },
  },
  {
    name: "orbitx_social_communities",
    description: "List live OrbitX communities from /communities (active communities table).",
    inputSchema: {
      type: "object",
      properties: { limit: { type: "integer", default: 30 } },
    },
  },
  {
    name: "orbitx_social_feed",
    description: "Fetch live community_posts feed (optional communityId). Same posts as /communities.",
    inputSchema: {
      type: "object",
      properties: {
        communityId: { type: "string" },
        limit: { type: "integer", default: 40 },
      },
    },
  },
  {
    name: "orbitx_social_join",
    description:
      "Join a live OrbitX community (/communities). Writes to community_members. Requires Bearer oxo_ key or linked publicKey from /agent.",
    inputSchema: {
      type: "object",
      properties: {
        communityId: { type: "string" },
        publicKey: { type: "string", description: "Linked Solana wallet if no Bearer" },
      },
      required: ["communityId"],
    },
  },
  {
    name: "orbitx_social_post",
    description:
      "Post to a live OrbitX community feed (/communities). Writes community_posts. Requires Bearer oxo_ key or linked publicKey.",
    inputSchema: {
      type: "object",
      properties: {
        communityId: { type: "string" },
        body: { type: "string" },
        publicKey: { type: "string", description: "Linked Solana wallet if no Bearer" },
      },
      required: ["communityId", "body"],
    },
  },
  {
    name: "orbitx_social_create_community",
    description:
      "Create a live OrbitX community on /communities (same table as the website + admin). Requires Bearer oxo_ key or linked publicKey. slug optional.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        slug: { type: "string", description: "Optional; unused by platform UI" },
        description: { type: "string" },
        visibility: { type: "string", enum: ["public", "unlisted", "private"], default: "public" },
        publicKey: { type: "string", description: "Linked Solana wallet if no Bearer" },
      },
      required: ["name"],
    },
  },
  {
    name: "orbitx_submit_listing",
    description:
      "Submit a token listing request to OG DEX admin (status=pending). Appears in owner desk Listings → Pending.",
    inputSchema: {
      type: "object",
      properties: {
        mint: { type: "string", description: "Token mint / contract address" },
        contract_address: { type: "string" },
        symbol: { type: "string" },
        project_name: { type: "string" },
        description: { type: "string" },
        chain: { type: "string", default: "solana" },
        tier: { type: "string", enum: ["standard", "express"], default: "standard" },
        contact: { type: "string" },
        publicKey: { type: "string" },
      },
      required: ["mint"],
    },
  },
  {
    name: "orbitx_request_boost",
    description:
      "Request a token boost (status=pending). Appears in owner desk Boosts for admin approve.",
    inputSchema: {
      type: "object",
      properties: {
        mint: { type: "string" },
        tier: { type: "string", enum: ["6h", "24h"], default: "24h" },
        symbol: { type: "string" },
        name: { type: "string" },
        chain: { type: "string", default: "solana" },
        publicKey: { type: "string" },
      },
      required: ["mint"],
    },
  },
  {
    name: "orbitx_mint_nft",
    description:
      "MINT a real Metaplex NFT via Phantom. Returns openUrl to /agent/nft-mint — user connects Phantom and approves. Requires metadata uri (JSON URL). Optionally registers on OrbitX marketplace.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        symbol: { type: "string", default: "NFT" },
        uri: { type: "string", description: "Public metadata JSON URL" },
        royaltyBps: { type: "integer", default: 500 },
        collectionMint: { type: "string" },
        isCollection: { type: "boolean", default: false },
        imageUrl: { type: "string" },
        register: { type: "boolean", default: true },
        publicKey: { type: "string" },
      },
      required: ["name", "uri"],
    },
  },
  {
    name: "orbitx_nft_collections",
    description: "List OrbitX NFT collections.",
    inputSchema: {
      type: "object",
      properties: { limit: { type: "integer", default: 40 } },
    },
  },
  {
    name: "orbitx_nft_items",
    description: "List OrbitX registered NFTs (optional creatorWallet filter).",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "integer", default: 40 },
        creatorWallet: { type: "string" },
      },
    },
  },
  {
    name: "orbitx_nft_listings",
    description: "List active OrbitX NFT marketplace listings.",
    inputSchema: {
      type: "object",
      properties: { limit: { type: "integer", default: 40 } },
    },
  },
  {
    name: "orbitx_nft_register",
    description:
      "Register an already-minted NFT mint address into the OrbitX marketplace registry (after orbitx_mint_nft or external mint).",
    inputSchema: {
      type: "object",
      properties: {
        mintAddress: { type: "string" },
        creatorWallet: { type: "string" },
        name: { type: "string" },
        symbol: { type: "string" },
        imageUrl: { type: "string" },
        metadataUri: { type: "string" },
        royaltyBps: { type: "integer", default: 500 },
        collectionId: { type: "string" },
      },
      required: ["mintAddress", "creatorWallet", "name"],
    },
  },
  {
    name: "orbitx_nft_register_collection",
    description: "Register a collection NFT mint on OrbitX marketplace.",
    inputSchema: {
      type: "object",
      properties: {
        mintAddress: { type: "string" },
        creatorWallet: { type: "string" },
        name: { type: "string" },
        symbol: { type: "string" },
        description: { type: "string" },
        logoUrl: { type: "string" },
        royaltyBps: { type: "integer", default: 500 },
      },
      required: ["mintAddress", "creatorWallet", "name", "symbol"],
    },
  },
  {
    name: "orbitx_nft_prepare_buy",
    description:
      "Build unsigned NFT purchase tx (listing/offer/auction). User signs; OrbitX settles via marketplace.",
    inputSchema: {
      type: "object",
      properties: {
        sourceId: { type: "string", description: "Listing / offer / auction id" },
        mode: { type: "string", enum: ["listing", "offer", "auction"], default: "listing" },
        buyerWallet: { type: "string" },
      },
      required: ["sourceId"],
    },
  },
  {
    name: "orbitx_nft_submit_buy",
    description: "Submit a signed NFT purchase transaction after orbitx_nft_prepare_buy.",
    inputSchema: {
      type: "object",
      properties: {
        pendingSaleId: { type: "string" },
        signedTransactionBase64: { type: "string" },
      },
      required: ["pendingSaleId", "signedTransactionBase64"],
    },
  },
  {
    name: "orbitx_nft_like",
    description: "Toggle like on an NFT (wallet-native social).",
    inputSchema: {
      type: "object",
      properties: {
        nftId: { type: "string" },
        wallet: { type: "string" },
      },
      required: ["nftId"],
    },
  },
  {
    name: "orbitx_nft_comment",
    description: "Add a comment on an NFT.",
    inputSchema: {
      type: "object",
      properties: {
        nftId: { type: "string" },
        body: { type: "string" },
        wallet: { type: "string" },
      },
      required: ["nftId", "body"],
    },
  },
  {
    name: "orbitx_nft_comments",
    description: "List comments on an NFT.",
    inputSchema: {
      type: "object",
      properties: { nftId: { type: "string" }, limit: { type: "integer", default: 50 } },
      required: ["nftId"],
    },
  },
  {
    name: "orbitx_nft_follow",
    description: "Toggle follow a creator wallet on the NFT social graph.",
    inputSchema: {
      type: "object",
      properties: {
        creatorWallet: { type: "string" },
        followerWallet: { type: "string" },
      },
      required: ["creatorWallet"],
    },
  },
  {
    name: "orbitx_xray",
    description: "Deep token risk / xray scan (holders, risks, flags).",
    inputSchema: {
      type: "object",
      properties: { mint: { type: "string" } },
      required: ["mint"],
    },
  },
  {
    name: "orbitx_research",
    description: "Research brief for a mint (aggregated intel).",
    inputSchema: {
      type: "object",
      properties: { mint: { type: "string" } },
      required: ["mint"],
    },
  },
  {
    name: "orbitx_leaderboard",
    description: "OrbitX / OG DEX trader or token leaderboard.",
    inputSchema: {
      type: "object",
      properties: { limit: { type: "integer", default: 25 } },
    },
  },
  {
    name: "orbitx_dex_listings",
    description: "DEX / launchpad listings feed.",
    inputSchema: {
      type: "object",
      properties: { limit: { type: "integer", default: 30 } },
    },
  },
  {
    name: "orbitx_platform_stats",
    description: "OrbitX platform stats snapshot.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "orbitx_get_metadata",
    description: "Read on-chain token metadata + update authority (for metadata editor eligibility).",
    inputSchema: {
      type: "object",
      properties: { mint: { type: "string" } },
      required: ["mint"],
    },
  },
  {
    name: "orbitx_boosts",
    description: "List active OG DEX token boosts.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "orbitx_boost_tiers",
    description: "Boost pricing tiers and pay wallet.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "orbitx_health",
    description: "OG DEX API health check.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "orbitx_config",
    description: "OG DEX public config.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "orbitx_report_url",
    description: "PDF research report URL for a mint (open in browser).",
    inputSchema: {
      type: "object",
      properties: { mint: { type: "string" } },
      required: ["mint"],
    },
  },
  {
    name: "orbitx_open_dex",
    description: "Deep link to OrbitX DEX token page or home.",
    inputSchema: {
      type: "object",
      properties: { mint: { type: "string" } },
    },
  },
  {
    name: "orbitx_open_alerts",
    description: "Deep link to DEX alerts UI (wallet-proof alerts require the web UI).",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "orbitx_nft_offers",
    description: "List offers on an NFT id.",
    inputSchema: {
      type: "object",
      properties: { nftId: { type: "string" } },
      required: ["nftId"],
    },
  },
  {
    name: "orbitx_nft_make_offer",
    description: "Make an offer on an OrbitX NFT (registry). Requires buyer wallet.",
    inputSchema: {
      type: "object",
      properties: {
        nftId: { type: "string" },
        priceSol: { type: "number" },
        buyerWallet: { type: "string" },
        expiresHours: { type: "number", default: 72 },
      },
      required: ["nftId", "priceSol"],
    },
  },
  {
    name: "orbitx_nft_cancel_offer",
    description: "Cancel your NFT offer.",
    inputSchema: {
      type: "object",
      properties: { offerId: { type: "string" }, buyerWallet: { type: "string" } },
      required: ["offerId"],
    },
  },
  {
    name: "orbitx_nft_list_for_sale",
    description: "List an OrbitX NFT for sale at a SOL price.",
    inputSchema: {
      type: "object",
      properties: {
        nftId: { type: "string" },
        priceSol: { type: "number" },
        sellerWallet: { type: "string" },
        currency: { type: "string", enum: ["SOL", "USDC"], default: "SOL" },
      },
      required: ["nftId", "priceSol"],
    },
  },
  {
    name: "orbitx_nft_cancel_listing",
    description: "Cancel an active NFT listing.",
    inputSchema: {
      type: "object",
      properties: { nftId: { type: "string" }, sellerWallet: { type: "string" } },
      required: ["nftId"],
    },
  },
  {
    name: "orbitx_nft_auctions",
    description: "List active OrbitX NFT auctions.",
    inputSchema: {
      type: "object",
      properties: { limit: { type: "integer", default: 40 } },
    },
  },
  {
    name: "orbitx_nft_create_auction",
    description: "Create an NFT auction on OrbitX marketplace.",
    inputSchema: {
      type: "object",
      properties: {
        nftId: { type: "string" },
        startPriceSol: { type: "number" },
        minIncrementSol: { type: "number", default: 0.01 },
        durationHours: { type: "number", default: 24 },
        sellerWallet: { type: "string" },
      },
      required: ["nftId", "startPriceSol"],
    },
  },
  {
    name: "orbitx_nft_place_bid",
    description: "Place a bid on an NFT auction.",
    inputSchema: {
      type: "object",
      properties: {
        auctionId: { type: "string" },
        amountSol: { type: "number" },
        bidderWallet: { type: "string" },
      },
      required: ["auctionId", "amountSol"],
    },
  },
  {
    name: "orbitx_nft_recent_sales",
    description: "Recent NFT marketplace sales.",
    inputSchema: {
      type: "object",
      properties: { limit: { type: "integer", default: 20 } },
    },
  },
  {
    name: "orbitx_nft_sales",
    description: "Sale history for one NFT id.",
    inputSchema: {
      type: "object",
      properties: { nftId: { type: "string" } },
      required: ["nftId"],
    },
  },
  {
    name: "orbitx_nft_favorite",
    description: "Toggle favorite on an NFT for a wallet.",
    inputSchema: {
      type: "object",
      properties: { nftId: { type: "string" }, wallet: { type: "string" } },
      required: ["nftId"],
    },
  },
  {
    name: "orbitx_social_members",
    description: "List members of an OrbitX community.",
    inputSchema: {
      type: "object",
      properties: {
        communityId: { type: "string" },
        limit: { type: "integer", default: 50 },
      },
      required: ["communityId"],
    },
  },
  {
    name: "orbitx_social_leave",
    description: "Leave an OrbitX community (Bearer or linked wallet).",
    inputSchema: {
      type: "object",
      properties: {
        communityId: { type: "string" },
        publicKey: { type: "string" },
      },
      required: ["communityId"],
    },
  },
  {
    name: "orbitx_generate_image",
    description:
      "Generate images with Grok Imagine only (kie.ai / KIE_API_KEY). Quality mode ~4 images. Defaults to wait=true (soft-returns taskId if still generating — never treat empty/timeout as OrbitX down; poll orbitx_media_status).",
    inputSchema: {
      type: "object",
      properties: {
        prompt: { type: "string", description: "Image prompt (max 5000 chars)" },
        aspect_ratio: {
          type: "string",
          enum: ["2:3", "3:2", "1:1", "9:16", "16:9"],
          default: "1:1",
        },
        enable_pro: {
          type: "boolean",
          default: true,
          description: "true = quality (~4 imgs), false = speed (~6 imgs)",
        },
        nsfw_checker: { type: "boolean", default: false },
        wait: {
          type: "boolean",
          default: true,
          description:
            "Wait briefly for imageUrls (soft-returns taskId if still generating). Poll orbitx_media_status — never treat pending as OrbitX down.",
        },
        waitMs: {
          type: "number",
          description: "Optional wait budget ms (capped under function limit; default ~21s safe under 30s platform floor)",
        },
      },
      required: ["prompt"],
    },
  },
  {
    name: "orbitx_generate_video",
    description:
      "Generate a video with Grok Imagine text-to-video (kie.ai). Default 10s. Returns taskId — poll with orbitx_media_status.",
    inputSchema: {
      type: "object",
      properties: {
        prompt: { type: "string", description: "Video motion prompt (max 5000 chars)" },
        aspect_ratio: {
          type: "string",
          enum: ["2:3", "3:2", "1:1", "9:16", "16:9"],
          default: "16:9",
        },
        mode: { type: "string", enum: ["fun", "normal", "spicy"], default: "normal" },
        duration: { type: "number", default: 10, description: "Seconds 6–30 (default 10)" },
        resolution: { type: "string", enum: ["480p", "720p"], default: "720p" },
        nsfw_checker: { type: "boolean", default: true },
        wait: { type: "boolean", default: false },
      },
      required: ["prompt"],
    },
  },
  {
    name: "orbitx_media_status",
    description: "Poll Grok Imagine task status. Pass taskId from orbitx_generate_image or orbitx_generate_video.",
    inputSchema: {
      type: "object",
      properties: { taskId: { type: "string" } },
      required: ["taskId"],
    },
  },
  {
    name: "orbitx_grok_image",
    description: "Alias for orbitx_generate_image.",
    inputSchema: {
      type: "object",
      properties: {
        prompt: { type: "string" },
        aspect_ratio: { type: "string" },
        enable_pro: { type: "boolean", default: true },
        wait: { type: "boolean", default: false },
      },
      required: ["prompt"],
    },
  },
  {
    name: "orbitx_grok_video",
    description: "Alias for orbitx_generate_video.",
    inputSchema: {
      type: "object",
      properties: {
        prompt: { type: "string" },
        aspect_ratio: { type: "string" },
        duration: { type: "number", default: 10 },
        mode: { type: "string" },
        resolution: { type: "string" },
        wait: { type: "boolean", default: false },
      },
      required: ["prompt"],
    },
  },
  {
    name: "orbitx_shop",
    description:
      "OrbitX Shop catalog: burn 100 $ORBITX for 1 hour, 1,000 for 1 day, 10,000 for 1 week, 1,000,000 for 1 month, or buy credits with SOL. Returns package list + Jupiter openUrls.",
    inputSchema: {
      type: "object",
      properties: {
        package: { type: "string", description: "hour | day | week | month | credits" },
        amountSol: { type: "number" },
      },
    },
  },
  {
    name: "orbitx_trade_auto",
    description:
      "Enable or disable chat auto-buy for this linked wallet. Auto-buy still requires a Jupiter Wallet signature; it skips the extra Telegram confirm step.",
    inputSchema: {
      type: "object",
      properties: {
        enabled: { type: "boolean" },
        on: { type: "boolean" },
      },
    },
  },
  {
    name: "orbitx_tools_help",
    description:
      "Catalog of MCP tools by category + total count (2500+ generated + 200 cook tools). Call when unsure which tool to use.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
];

const _coreNames = new Set(CORE_TOOLS.map((t) => t.name));
const _generated = buildGeneratedTools().filter((t) => !_coreNames.has(t.name));
const _cook = buildCookTools().filter((t) => !_coreNames.has(t.name) && !_generated.some((g) => g.name === t.name));
const TOOLS = [...CORE_TOOLS, ..._generated, ..._cook];
const TOOL_NAME_SET = new Set(TOOLS.map((t) => t.name));
for (const n of GEN_WALLET_TOOLS) WALLET_TOOLS.add(n);

export function resolveOrbitXToolName(rawName) {
  const raw = String(rawName || "").trim();
  if (!raw) return "";
  const lower = raw.toLowerCase();
  const prefixed =
    !lower.startsWith("orbitx_") && lower !== "search" && lower !== "fetch" && !lower.startsWith("x_")
      ? `orbitx_${lower}`
      : "";
  // Aliases first so names like orbitx_trade never win over orbitx_prepare_buy.
  const guesses = [
    TOOL_ALIASES[raw],
    TOOL_ALIASES[lower],
    applyTelegramAlias(raw),
    applyTelegramAlias(lower),
    prefixed ? TOOL_ALIASES[prefixed] : "",
    prefixed ? applyTelegramAlias(prefixed) : "",
    raw,
    lower,
    prefixed,
  ];
  for (const guess of guesses) {
    if (!guess) continue;
    if (TOOL_NAME_SET.has(guess)) {
      const aliased = TOOL_ALIASES[guess] || applyTelegramAlias(guess);
      if (aliased && aliased !== guess && TOOL_NAME_SET.has(aliased)) return aliased;
      return guess;
    }
    const aliased = TOOL_ALIASES[guess] || applyTelegramAlias(guess);
    if (aliased && TOOL_NAME_SET.has(aliased)) return aliased;
  }
  return "";
}

async function fetchJson(url, init) {
  const href = String(url || "");
  if (/\/api\/ogdex\/trade\/?(?:\?|$)/.test(href) && String(init?.method || "GET").toUpperCase() === "POST") {
    const { buildUnsignedTrade } = await import("./ogdex/_routes/trade.js");
    const body = typeof init?.body === "string" ? JSON.parse(init.body || "{}") : init?.body || {};
    return buildUnsignedTrade(body);
  }
  const r = await fetch(url, {
    ...init,
    headers: { "User-Agent": "OrbitX-MCP/1.0", Accept: "application/json", ...(init?.headers || {}) },
  });
  const text = await r.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text.slice(0, 500) };
  }
  if (!r.ok) {
    const err = new Error(data?.error || data?.message || `HTTP ${r.status}`);
    err.status = r.status;
    err.data = data;
    throw err;
  }
  return data;
}

async function callTool(rawName, args, auth, base = FALLBACK_BASE, req = null) {
  const name = resolveOrbitXToolName(rawName) || TOOL_ALIASES[rawName] || rawName;
  // Always advertise www /api/mcp — apex 308s break Claude POSTs; /api/orbitx-mcp is an alias only.
  const mcpUrl = mcpUrls(req).mcpUrl;
  const agentSetupUrl = "https://www.orbitx.world/agent";
  const wallet = String(
    args.publicKey || args.address || args.buyerWallet || args.sellerWallet || args.bidderWallet || auth?.walletAddress || "",
  ).trim();

  if (name === "orbitx_menu") {
    return agentMenuPayload({ authCode: args.authCode || auth?.authCode || null });
  }
  if (name === "orbitx_auth_link") {
    return createAgentLinkAuthSession(req);
  }
  if (name === "orbitx_auth_status") {
    return getAgentLinkAuthStatus(args.authCode || auth?.authCode);
  }

  const gcRelay = await maybeRelayGroupChat({ name, args, auth, sb });
  if (gcRelay) return gcRelay;

  if (name === "search") {
    const q = String(args.query || "").trim().toLowerCase();
    if (!q || q === "/" || q === "menu" || q === "help" || q === "commands") {
      return callTool("orbitx_menu", { authCode: args.authCode || auth?.authCode }, auth, base, req);
    }
    const caMatch = String(args.query || "").match(
      /(0x[a-fA-F0-9]{40}|[1-9A-HJ-NP-Za-km-z]{32,44})/,
    );
    if (caMatch && /chart|dex|embed|graph|candle|dexscreener|price/i.test(q)) {
      return callTool("orbitx_dex_chart", { ca: caMatch[1] }, auth, base, req);
    }
    const docs = [
      {
        id: "tool:orbitx_dex_chart",
        title: "orbitx_dex_chart",
        url: "https://www.orbitx.world/ORBITX_DEX",
        text: "DexScreener embed chart in chat — pass CA/mint when user asks for charts.",
      },
      {
        id: "menu",
        title: "OrbitX command menu",
        url: "https://www.orbitx.world/agent",
        text: "Branded OrbitX banner + capability menu. Call orbitx_menu or fetch id menu.",
      },
      {
        id: "help",
        title: "OrbitX Agent MCP help",
        url: "https://www.orbitx.world/agent",
        text: "Intel, trade prep, social, launch. Prefer dashboard paste authCode, else orbitx_auth_link.",
      },
      {
        id: "auth",
        title: "Authenticate OrbitX",
        url: "https://www.orbitx.world/agent",
        text: "If user pasted authCode: orbitx_auth_status. Else orbitx_auth_link → url → orbitx_auth_status.",
      },
      {
        id: "tool:orbitx_search",
        title: "orbitx_search",
        url: "https://www.orbitx.world/agent",
        text: "Search tokens by name, symbol, or mint.",
      },
      {
        id: "tool:orbitx_get_token",
        title: "orbitx_get_token",
        url: "https://www.orbitx.world/agent",
        text: "Full token intel for a mint.",
      },
    ];
    const results = docs.filter(
      (d) => d.id.includes(q) || d.title.toLowerCase().includes(q) || d.text.toLowerCase().includes(q),
    );
    return { results: results.length ? results : docs };
  }

  if (name === "fetch") {
    const id = String(args.id || "").trim();
    if (id === "menu" || id === "help" || id === "/") {
      return callTool("orbitx_menu", { authCode: args.authCode || auth?.authCode }, auth, base, req);
    }
    if (id === "auth") {
      return {
        id,
        title: "Authenticate",
        url: "https://www.orbitx.world/agent",
        text:
          "If the user pasted an authCode from the OrbitX dashboard: call orbitx_auth_status with it, then pass authCode on tools. Otherwise call orbitx_auth_link → send url → user authorizes → orbitx_auth_status.",
      };
    }
    if (id.startsWith("tool:")) {
      const toolName = id.slice(5);
      const t = CORE_TOOLS.find((x) => x.name === toolName);
      return {
        id,
        title: toolName,
        url: "https://www.orbitx.world/agent",
        text: t?.description || `Tool ${toolName}`,
      };
    }
    if (id.startsWith("chart:")) {
      return callTool("orbitx_dex_chart", { ca: id.slice("chart:".length) }, auth, base, req);
    }
    if (/^(0x[a-fA-F0-9]{40}|[1-9A-HJ-NP-Za-km-z]{32,44})$/.test(id)) {
      return callTool("orbitx_get_token", { mint: id }, auth, base, req);
    }
    return { id, title: id, url: "https://www.orbitx.world/agent", text: "Unknown id. Try menu, help, auth, chart:<CA>, or tool:orbitx_dex_chart." };
  }

  if (name === "orbitx_dex_chart" || name === "orbitx_chart_embed" || name === "orbitx_embed_chart") {
    return buildDexChartEmbed(args);
  }

  const generated = await dispatchGenerated(name, args, {
    base,
    fetchJson,
    sb,
    wallet,
    auth,
  });
  if (generated !== null && generated !== undefined) return generated;

  if (
    name === "orbitx_trade_quote" ||
    name === "orbitx_x_connect" ||
    name === "orbitx_x_status" ||
    name === "orbitx_x_post" ||
    name === "orbitx_x_reply" ||
    name === "orbitx_x_quote" ||
    name === "orbitx_vc_start" ||
    name === "orbitx_vc_list" ||
    name === "orbitx_vc_join" ||
    name === "orbitx_vc_link" ||
    name === "orbitx_vc_end" ||
    name === "orbitx_gc_start" ||
    name === "orbitx_gc_list" ||
    name === "orbitx_gc_join" ||
    name === "orbitx_gc_focus" ||
    name === "orbitx_gc_send" ||
    name === "orbitx_gc_chat" ||
    name === "orbitx_gc_leave" ||
    name === "orbitx_gc_history" ||
    name === "orbitx_gc_read"
  ) {
    return dispatchCookTool(name, args, { base, fetchJson, sb, wallet, auth });
  }
  const cooked = await dispatchCookTool(name, args, { base, fetchJson, sb, wallet, auth });
  if (cooked !== null && cooked !== undefined) return cooked;

  if (name === "orbitx_whoami") {
    const session = await withAuthEmail(
      auth || {
        userId: null,
        agentId: null,
        walletAddress: wallet || null,
        email: null,
        source: "anonymous",
        bearerPresent: false,
      },
    );
    const identified = Boolean(session.userId);
    let status = "anonymous";
    if (identified && session.walletAddress) status = "authenticated_with_wallet";
    else if (identified) status = "authenticated";
    else if (session.bearerInvalid || session.source === "bearer_unresolved") status = "bearer_invalid";
    else if (session.walletAddress || wallet) status = "wallet_unlinked";

    const holdExempt = isTokenGateExemptAny({
      wallets: [session.walletAddress, wallet],
      email: session.email,
    });

    let badge = null;
    let mcpBetaAccess = false;
    if (session.userId) {
      try {
        const rows = await sb(
          `profiles?user_id=eq.${encodeURIComponent(session.userId)}&select=badge,mcp_beta_access,username,display_name&limit=1`,
        );
        const profile = Array.isArray(rows) ? rows[0] : null;
        const rawBadge = String(profile?.badge || "").trim();
        mcpBetaAccess =
          Boolean(profile?.mcp_beta_access) || rawBadge.toLowerCase() === "beta access";
        badge = mcpBetaAccess ? "beta access" : rawBadge || null;
      } catch {
        /* profiles column may be missing until migration */
      }
    }

    return {
      ok: true,
      userId: session.userId || null,
      agentId: session.agentId || null,
      agentName: session.agentName || null,
      walletAddress: session.walletAddress || wallet || null,
      authSource: session.source || "anonymous",
      bearerPresent: Boolean(session.bearerPresent),
      bearerTokenPrefix: session.bearerTokenPrefix || null,
      mcpUrl,
      status,
      badge,
      mcpBetaAccess,
      profile: {
        badge,
        mcpBetaAccess,
      },
      fix:
        status === "authenticated" || status === "authenticated_with_wallet"
          ? null
          : status === "bearer_invalid"
            ? `Authorization header present but key not found. Copy a fresh oxo_ key from ${agentSetupUrl} → set connector request header Authorization: Bearer <key>. Or re-Authenticate.`
            : status === "wallet_unlinked"
              ? `Wallet seen but not linked. Open ${agentSetupUrl} → sign in → Link wallet → Create API key, then pass that publicKey or Bearer.`
              : `Add Authorization: Bearer <oxo_ key> from ${agentSetupUrl}, or pass publicKey of a wallet linked there.`,
      note: identified
        ? `Session OK via ${session.source}. Social join/post/create available.`
        : "Anonymous — intel tools work. Identity required for social writes.",
      agentSetupUrl,
      sessionTools: [...SESSION_TOOLS],
      launchExecutionTool: "orbitx_execute_launch",
      tokenHold: {
        mint: "13H4WJvGEg4xrrBwWn2vsQgz7xhmhxgNdw19i1QsxPX9",
        minUsd: 5,
        required: !holdExempt,
        exempt: holdExempt,
      },
      totalTools: TOOLS.length,
    };
  }

  const get = {
    orbitx_search: () => `${base}/api/ogdex/search?q=${encodeURIComponent(String(args.q || ""))}`,
    orbitx_get_token: () =>
      `${base}/api/ogdex/token?mint=${encodeURIComponent(String(args.mint || ""))}&chain=${encodeURIComponent(String(args.chain || "solana"))}`,
    orbitx_screen_tokens: () =>
      `${base}/api/ogdex/screener?type=${encodeURIComponent(String(args.type || "trending"))}&interval=${encodeURIComponent(String(args.interval || "1h"))}&limit=${Number(args.limit) || 20}&chain=${encodeURIComponent(String(args.chain || "solana"))}`,
    orbitx_get_forensics: () =>
      `${base}/api/ogdex/forensics?mint=${encodeURIComponent(String(args.mint || ""))}${
        args.first === 0 || args.first === "0" ? "&first=0" : ""
      }`,
    orbitx_get_safety: () =>
      `${base}/api/ogdex/safety?mint=${encodeURIComponent(String(args.mint || ""))}`,
    orbitx_crypto_scan: () =>
      `${base}/api/orbitx/crypto-scan?mint=${encodeURIComponent(String(args.mint || ""))}`,
    orbitx_get_ath: () => `${base}/api/ogdex/ath?mint=${encodeURIComponent(String(args.mint || ""))}`,
    orbitx_get_chart: () =>
      `${base}/api/ogdex/chart?mint=${encodeURIComponent(String(args.mint || ""))}&interval=${encodeURIComponent(String(args.interval || "1h"))}&limit=${Number(args.limit) || 200}&chain=${encodeURIComponent(String(args.chain || "solana"))}`,
    orbitx_get_wallet: () => {
      if (!wallet) throw new Error("address required (or link wallet on /agent)");
      return `${base}/api/ogdex/wallet?address=${encodeURIComponent(wallet)}`;
    },
    orbitx_get_swaps: () => {
      if (!wallet) throw new Error("address required (or link wallet on /agent)");
      return `${base}/api/ogdex/swaps?address=${encodeURIComponent(wallet)}&limit=${Number(args.limit) || 25}`;
    },
    orbitx_get_balance: () => {
      if (!wallet) throw new Error("address required (or link wallet on /agent)");
      const mint = args.mint ? `&mint=${encodeURIComponent(String(args.mint))}` : "";
      return `${base}/api/ogdex/balance?owner=${encodeURIComponent(wallet)}${mint}`;
    },
    orbitx_get_kols: () => `${base}/api/ogdex/kols?limit=${Number(args.limit) || 20}`,
    orbitx_get_traders: () => `${base}/api/ogdex/traders?limit=${Number(args.limit) || 20}`,
    orbitx_get_signals: () => `${base}/api/ogdex/signals?limit=${Number(args.limit) || 20}`,
    orbitx_get_launches: () => `${base}/api/ogdex/launches?limit=${Number(args.limit) || 20}`,
    orbitx_launch_config: () =>
      `${base}/api/ogdex/launch?config=1&chain=${encodeURIComponent(String(args.chain || "solana"))}`,
    orbitx_platform_stats: () => `${base}/api/ogdex/platform-stats`,
    orbitx_xray: () => `${base}/api/ogdex/xray?mint=${encodeURIComponent(String(args.mint || ""))}`,
    orbitx_research: () => `${base}/api/ogdex/research?mint=${encodeURIComponent(String(args.mint || ""))}`,
    orbitx_leaderboard: () => `${base}/api/ogdex/leaderboard?limit=${Number(args.limit) || 25}`,
    orbitx_dex_listings: () => `${base}/api/ogdex/listings?limit=${Number(args.limit) || 30}`,
    orbitx_get_metadata: () => `${base}/api/ogdex/metadata?mint=${encodeURIComponent(String(args.mint || ""))}`,
    orbitx_boosts: () => `${base}/api/ogdex/boosts`,
    orbitx_boost_tiers: () => `${base}/api/ogdex/boosts?tiers=1`,
    orbitx_health: () => `${base}/api/ogdex/health`,
    orbitx_config: () => `${base}/api/ogdex/config`,
  };

  if (name === "orbitx_tools_help") {
    const byPrefix = {};
    for (const t of TOOLS) {
      const p = t.name.replace(/^orbitx_/, "").split("_")[0] || "other";
      byPrefix[p] = (byPrefix[p] || 0) + 1;
    }
    return {
      ok: true,
      totalTools: TOOLS.length,
      coreTools: CORE_TOOLS.length,
      generatedTools: _generated.length,
      cookTools: _cook.length,
      cookStats: cookStats(),
      generatedStats: generatedStats(),
      categoryCounts: byPrefix,
      create: [
        "orbitx_execute_launch",
        "orbitx_launch_execution",
        "orbitx_create_token",
        "orbitx_launch_token",
        "orbitx_create_token_pump",
        "orbitx_create_token_custom",
      ],
      credits: ["orbitx_credits_buy", "orbitx_credits_confirm", "orbitx_credits_balance", "orbitx_credits_usage"],
      mcpAccess: ["orbitx_mcp_access_status", "orbitx_mcp_access_buy", "orbitx_mcp_access_confirm"],
      trade: ["orbitx_buy_orbitx", "orbitx_confirm_buy", "orbitx_buy", "orbitx_sell", "orbitx_buy_auto", "orbitx_sell_pump", "orbitx_claim_fees", "orbitx_burn", "orbitx_rent_refund"],
      nft: ["orbitx_mint_nft", "orbitx_nft_list_for_sale", "orbitx_nft_make_offer", "orbitx_nft_auctions"],
      media: [
        "orbitx_generate_image",
        "orbitx_generate_video",
        "orbitx_media_status",
        "orbitx_grok_image",
        "orbitx_grok_video",
      ],
      social: [
        "orbitx_social_communities",
        "orbitx_social_create_community",
        "orbitx_social_post",
        "orbitx_social_join",
        "orbitx_submit_listing",
        "orbitx_request_boost",
      ],
      intel: ["orbitx_search", "orbitx_dex_chart", "orbitx_screen_trending_1h_solana", "orbitx_chart_1h_solana", "orbitx_xray", "orbitx_research"],
      examples: TOOLS.slice(0, 40).map((t) => t.name),
      note: "Live tools/list is CORE only (Claude-safe). Full catalog via this help. Launch: orbitx_execute_launch. Image: orbitx_generate_image (Grok Imagine / KIE_API_KEY only). Tx tools return signUrl/openUrl.",
      mcpUrl: "https://www.orbitx.world/api/mcp",
    };
  }

  if (name === "orbitx_generate_image") {
    const gi = await grokImagine();
    try {
      return await gi.generateImage(args);
    } catch (e) {
      const code = e?.code || (/KIE_API_KEY/i.test(String(e?.message || "")) ? "KIE_API_KEY_MISSING" : "KIE_UPSTREAM");
      const missing = code === "KIE_API_KEY_MISSING";
      return {
        ok: false,
        kind: "image",
        code,
        error: e?.message || "image generation failed",
        // Agents must not narrate this as "OrbitX server down".
        outage: false,
        fix: missing
          ? "Set KIE_API_KEY in Vercel env (https://kie.ai/api-key), redeploy, retry."
          : "kie.ai / Grok Imagine upstream error — retry later or simplify the prompt. If you already have a taskId, poll orbitx_media_status.",
      };
    }
  }

  if (name === "orbitx_generate_video") {
    const gi = await grokImagine();
    try {
      return await gi.generateVideo(args);
    } catch (e) {
      const code = e?.code || (/KIE_API_KEY/i.test(String(e?.message || "")) ? "KIE_API_KEY_MISSING" : "KIE_UPSTREAM");
      return {
        ok: false,
        kind: "video",
        code,
        error: e?.message || "video generation failed",
        outage: false,
        fix:
          code === "KIE_API_KEY_MISSING"
            ? "Set KIE_API_KEY in Vercel env and redeploy."
            : "kie.ai video upstream error — retry later (capacity may be limited).",
      };
    }
  }

  if (name === "orbitx_media_status") {
    const gi = await grokImagine();
    try {
      const status = await gi.getTask(String(args.taskId || ""));
      return {
        ...status,
        imageUrls: status.imageUrls || status.resultUrls || [],
        outage: false,
        instructions:
          status.state === "success"
            ? "Use resultUrls / imageUrls for the media files."
            : status.state === "fail"
              ? `kie.ai failed: ${status.failMsg || status.failCode || "unknown"}. Retry orbitx_generate_image.`
              : "Still processing on kie.ai — call orbitx_media_status again shortly (OrbitX is responding).",
      };
    } catch (e) {
      return {
        ok: false,
        code: e?.code || "KIE_STATUS_FAILED",
        error: e?.message || "status check failed",
        taskId: args.taskId || null,
        outage: false,
        fix: "Retry orbitx_media_status; if KIE_API_KEY is missing, set it in Vercel env.",
      };
    }
  }

  if (name === "orbitx_report_url") {
    const mint = String(args.mint || "").trim();
    if (!mint) throw new Error("mint required");
    return {
      ok: true,
      mint,
      reportUrl: `${base}/api/ogdex/report?mint=${encodeURIComponent(mint)}`,
      note: "Open reportUrl in a browser to download the PDF.",
    };
  }

  if (name === "orbitx_open_dex") {
    const mint = String(args.mint || "").trim();
    return {
      ok: true,
      openUrl: mint ? `${base}/ORBITX_DEX/token/${encodeURIComponent(mint)}` : `${base}/ORBITX_DEX`,
    };
  }

  if (name === "orbitx_open_alerts") {
    return {
      ok: true,
      openUrl: `${base}/ORBITX_DEX/alerts`,
      note: "Alerts require wallet signature proof in the DEX UI.",
    };
  }

  if (get[name]) return fetchJson(get[name]());

  if (
    name === "orbitx_execute_launch" ||
    name === "orbitx_create_token" ||
    name === "orbitx_launch_execution"
  ) {
    const tokName = String(args.name || "").trim();
    const symbol = String(args.symbol || "").trim().toUpperCase();
    if (!tokName || !symbol) throw new Error("name and symbol required");
    const lane = args.lane === "custom" ? "custom" : "pump";
    const q = new URLSearchParams({
      name: tokName,
      symbol,
      description: String(args.description || ""),
      lane,
    });
    if (args.imageUrl) q.set("imageUrl", String(args.imageUrl));
    if (args.twitter) q.set("twitter", String(args.twitter));
    if (args.telegram) q.set("telegram", String(args.telegram));
    if (args.website) q.set("website", String(args.website));
    if (args.metadataUri) q.set("metadataUri", String(args.metadataUri));
    if (args.mintPublicKey) q.set("mintPublicKey", String(args.mintPublicKey));
    if (wallet) q.set("publicKey", wallet);
    const openUrl = `${base}/agent/create-token?${q.toString()}`;
    return {
      ok: true,
      status: "awaiting_phantom_launch",
      requiresSignature: true,
      tool: "orbitx_execute_launch",
      openUrl,
      launchpadUrl: `${base}/orbitxlaunch/create/${lane}`,
      name: tokName,
      symbol,
      lane,
      metadataUri: args.metadataUri ? String(args.metadataUri) : null,
      mintPublicKey: args.mintPublicKey ? String(args.mintPublicKey) : null,
      instructions: [
        "This IS the orbit launch execution tool — open openUrl now.",
        "Connect Phantom on the OrbitX launchpad.",
        "Confirm image/details, pay the small launch fee, then Sign create in Phantom.",
        "Token is not live until Phantom confirms the create transaction.",
        "After confirmation, optionally call orbitx_launch_record with mint + payment_tx.",
      ],
      tip: args.imageUrl || args.metadataUri
        ? "Metadata/image prefilled when possible — user can still replace the logo on the launchpad."
        : "Provide imageUrl or call orbitx_launch_ipfs first; user can also upload a logo on the launchpad.",
      note: "Non-custodial launch execution. Mint key stays in the browser — never broadcast unsigned create txs from MCP.",
    };
  }

  if (name === "orbitx_mint_nft") {
    const nftName = String(args.name || "").trim();
    const uri = String(args.uri || args.metadataUri || "").trim();
    if (!nftName || !uri) throw new Error("name and uri (metadata JSON URL) required");
    const q = new URLSearchParams({
      name: nftName,
      symbol: String(args.symbol || "NFT").trim().toUpperCase() || "NFT",
      uri,
      royaltyBps: String(Number(args.royaltyBps) || 500),
      register: args.register === false ? "0" : "1",
    });
    if (args.collectionMint) q.set("collectionMint", String(args.collectionMint));
    if (args.isCollection) q.set("isCollection", "1");
    if (args.imageUrl) q.set("imageUrl", String(args.imageUrl));
    if (wallet) q.set("publicKey", wallet);
    const openUrl = `${base}/agent/nft-mint?${q.toString()}`;
    return {
      ok: true,
      status: "awaiting_phantom_mint",
      requiresSignature: true,
      openUrl,
      studioUrl: `${base}/nft/create`,
      name: nftName,
      uri,
      instructions: [
        "Open openUrl in the user's browser.",
        "Connect Phantom and click Mint NFT.",
        "Approve the Metaplex create transaction in Phantom.",
        "Mint is incomplete until Phantom confirms.",
      ],
      note: "Non-custodial Metaplex mint. Never claim minted without a confirmed signature.",
    };
  }

  if (name === "orbitx_credits_buy") {
    const xc = await xCredits();
    const askOnly =
      args.askOnly === true ||
      (args.solAmount == null && args.credits == null && args.amount == null && args.sol == null);
    if (askOnly) return xc.creditsBuyPrompt();
    return xc.prepareCreditsMcpPurchase({
      base,
      wallet,
      solAmount: args.solAmount ?? args.sol,
      credits: args.credits,
      amount: args.amount,
      confirmMode: args.autoConfirm === true || args.auto === true ? "auto" : args.confirmMode || "sign",
    });
  }

  if (name === "orbitx_credits_confirm") {
    if (!auth?.userId) {
      return {
        ok: false,
        error: "session_required",
        message: "Authenticate first, then pass the payment signature.",
      };
    }
    const signature = String(args.signature || args.txSignature || args.tx_signature || args.sig || "").trim();
    if (!signature) {
      return { ok: false, error: "signature_required", message: "Pass the Solana transaction signature" };
    }
    try {
      const xc = await xCredits();
      return await xc.confirmCreditsPurchase(sb, auth.userId, signature);
    } catch (e) {
      return {
        ok: false,
        error: "confirm_failed",
        message: e?.message || "Could not credit purchase — apply x_mcp_credits migration",
        payTo: PLATFORM_CREDITS_WALLET,
      };
    }
  }

  if (name === "orbitx_credits_balance") {
    if (!auth?.userId) {
      return { ok: false, error: "session_required", message: "Authenticate to view credits balance" };
    }
    try {
      const xc = await xCredits();
      return await xc.getCreditsBalance(sb, auth.userId);
    } catch (e) {
      return { ok: false, error: "balance_failed", message: e?.message || "balance unavailable" };
    }
  }

  if (name === "orbitx_mcp_access_status") {
    try {
      return await getAccessStatus(sb, auth?.userId, {
        wallets: [wallet, args.publicKey, args.wallet, auth?.walletAddress],
      });
    } catch (e) {
      return { ok: false, error: "access_failed", message: e?.message || "access unavailable" };
    }
  }

  if (name === "orbitx_mcp_access_buy") {
    const askOnly =
      args.askOnly === true || (args.package == null && args.packageId == null && args.option == null);
    if (askOnly) {
      return accessBuyPrompt({ accessUrl: "https://www.orbitx.world/agent?tab=shop" });
    }
    return prepareAccessMcpPurchase({
      base,
      wallet: wallet || args.publicKey,
      packageId: args.package || args.packageId || args.option,
      confirmMode: args.autoConfirm === true || args.auto === true ? "auto" : args.confirmMode || "sign",
      accessUrl: "https://www.orbitx.world/agent?tab=shop",
    });
  }

  if (name === "orbitx_mcp_access_confirm") {
    const signature = String(args.signature || args.txSignature || args.tx_signature || args.sig || "").trim();
    if (!signature) {
      return { ok: false, error: "signature_required", message: "Pass the Solana transaction signature" };
    }
    try {
      return await confirmAccessBurn(sb, {
        userId: auth?.userId,
        signature,
        packageId: args.package || args.packageId,
        wallet: wallet || args.publicKey || args.wallet,
      });
    } catch (e) {
      return {
        ok: false,
        error: "confirm_failed",
        message: e?.message || "Could not grant access — apply mcp_burn_access migration",
      };
    }
  }

  if (name === "orbitx_credits_usage") {
    if (!auth?.userId) {
      return { ok: false, error: "session_required", message: "Authenticate to view credits usage" };
    }
    try {
      const xc = await xCredits();
      return await xc.getCreditsUsage(sb, auth.userId, {
        limit: args.limit,
        period: args.period || "30d",
        format: args.format || "both",
      });
    } catch (e) {
      return { ok: false, error: "usage_failed", message: e?.message || "usage unavailable" };
    }
  }

  if (name === "orbitx_buy_orbitx") {
    let amountSol = args.amountSol ?? args.sol ?? args.amount;
    let usdQuote = null;
    if ((amountSol == null || amountSol === "") && args.amountUsd != null) {
      usdQuote = await usdToSol(args.amountUsd);
      if (!usdQuote.ok) return usdQuote;
      amountSol = usdQuote.amountSol;
    }
    const askOnly = args.askOnly === true || amountSol == null || amountSol === "";
    if (askOnly) return askBuyOrbitxAmount();
    let tradePreference = null;
    if (auth?.agentId) {
      try {
        tradePreference = await getChatTradePreference(sb, auth.agentId);
      } catch {
        tradePreference = null;
      }
    }
    const preferAuto = tradePreference === "auto";
    const confirmMode =
      args.autoConfirm === true || args.auto === true ? "auto" : args.confirmMode || (preferAuto ? "auto" : "sign");
    const out = await prepareBuyOrbitx({
      base,
      wallet,
      amountSol,
      slippage: args.slippage,
      pool: args.pool || "auto",
      confirmMode,
      preferAuto,
      fetchJson,
    });
    if (out.ok && usdQuote) {
      out.amountUsd = usdQuote.amountUsd;
      out.solUsd = usdQuote.solUsd;
    }
    if (out.ok && tradePreference == null && auth?.agentId) {
      out.tradePreferencePrompt = {
        title: "How should future trades be confirmed?",
        message: "Choose once for this agent. Auto-confirm skips the second chat prompt; your connected wallet still approves every transaction.",
        options: [
          { id: "auto", label: "Auto-confirm", description: "Open the secure wallet signer automatically." },
          { id: "sign", label: "Sign each time", description: "Show a fresh review step for every buy or sell." },
        ],
        setTool: "orbitx_trade_auto",
        scope: "agent",
      };
    }
    if (out.ok && auth?.userId) {
      try {
        await saveTradeIntent(sb, auth.userId, {
          mint: ORBITX_MINT,
          amountSol: out.amountSol,
          confirmMode: out.confirmMode,
          slippage: out.slippage,
          pool: out.pool,
        });
      } catch {
        /* optional */
      }
    }
    return out;
  }

  if (name === "orbitx_shop") {
    const pack = String(args.package || args.item || "").toLowerCase();
    if (pack === "hour" || pack === "day" || pack === "week" || pack === "month" || pack === "access") {
      return callTool("orbitx_mcp_access_buy", { ...args, package: pack === "access" ? "hour" : pack }, auth, base, req);
    }
    if (pack === "credits" || pack === "topup") {
      return callTool("orbitx_credits_buy", args, auth, base, req);
    }
    if (pack) {
      try {
        const { prepareDeskShopBuy } = await import("./orbitx/desk-shop.js");
        const out = await prepareDeskShopBuy({
          wallet,
          skuId: pack,
          mint: args.mint,
        });
        if (out?.error !== "unknown_sku") {
          if (out?.ok) {
            const qs = new URLSearchParams({ kind: "shop", sku: pack, publicKey: wallet || "" });
            if (args.mint) qs.set("mint", String(args.mint));
            const signUrl = `${base}/agent/sign?${qs.toString()}`;
            const autoSignUrl = `${signUrl}${signUrl.includes("?") ? "&" : "?"}auto=1`;
            const auto = args.autoConfirm === true || args.auto === true;
            out.signUrl = signUrl;
            out.autoSignUrl = autoSignUrl;
            out.openUrl = auto ? autoSignUrl : signUrl;
            out.requiresSignature = true;
            out.solscanToken = `https://solscan.io/token/${ORBITX_MINT}`;
            if (wallet) out.solscanAccount = `https://solscan.io/account/${encodeURIComponent(wallet)}`;
          }
          return out;
        }
      } catch {
        /* fall through to catalog */
      }
    }
    return {
      ok: true,
      shop: true,
      openUrl: `${base}/shop`,
      message:
        "OrbitX Shop — burn $ORBITX for MCP seats or buy credits with SOL. Linked Telegram: /shop hour · /shop day · /shop week · /shop month · /credits 0.1 sol",
      packages: [
        { id: "hour", title: "1 Hour MCP", cost: "100 $ORBITX", tool: "orbitx_mcp_access_buy", args: { package: "hour" } },
        { id: "day", title: "1 Day MCP", cost: "1,000 $ORBITX", tool: "orbitx_mcp_access_buy", args: { package: "day" } },
        { id: "week", title: "1 Week MCP", cost: "10,000 $ORBITX", tool: "orbitx_mcp_access_buy", args: { package: "week" } },
        { id: "month", title: "1 Month MCP", cost: "1,000,000 $ORBITX", tool: "orbitx_mcp_access_buy", args: { package: "month" } },
        { id: "credits", title: "Credits", cost: "10,000 / 1 SOL", tool: "orbitx_credits_buy" },
      ],
      note: "Burns destroy supply. Credits are shared across Agent MCP + X MCP. Non-custodial Phantom sign.",
    };
  }

  if (name === "orbitx_trade_auto") {
    const enabled = args.enabled === true || args.on === true || String(args.enabled || args.on || "").toLowerCase() === "true";
    const off = args.enabled === false || args.on === false || String(args.mode || "").toLowerCase() === "sign";
    const on = off ? false : enabled || String(args.mode || "").toLowerCase() === "auto";
    const preference = on ? "auto" : "sign";
    const saved = auth?.agentId ? await setChatTradePreference(sb, auth.agentId, preference) : false;
    return {
      ok: saved || !auth?.agentId,
      autoBuy: on,
      tradeConfirmationPreference: preference,
      message: on
        ? "Auto-confirm is ON for this agent. Future buy and sell commands skip the second chat prompt, then open the secure wallet signer. You still approve each transaction in your wallet."
        : "Sign each time is ON for this agent. Every buy and sell command shows a fresh review step before the secure wallet signer.",
    };
  }

  if (name === "orbitx_confirm_buy") {
    let amountSol = args.amountSol ?? args.sol ?? args.amount;
    let slippage = Number(args.slippage) || 10;
    let pool = args.pool || "auto";
    let mint = String(args.mint || "").trim();
    if (auth?.userId) {
      const intent = await loadLatestTradeIntent(sb, auth.userId, mint ? { mint } : {});
      if (intent) {
        if (amountSol == null || amountSol === "") amountSol = Number(intent.amount_sol);
        slippage = Number(intent.slippage) || slippage;
        pool = intent.pool || pool;
        if (!mint) mint = String(intent.mint || "");
      }
    }
    if (!mint) mint = ORBITX_MINT;
    if (amountSol == null || amountSol === "") {
      return {
        ok: false,
        error: "no_pending_buy",
        message: "No pending buy. Send buy <CA> with 0.1 sol (or $10 usdc), then confirm — or pass amountSol.",
      };
    }
    if (mint === ORBITX_MINT) {
      const out = await prepareBuyOrbitx({
        base,
        wallet,
        amountSol,
        slippage,
        pool,
        confirmMode: "auto",
        preferAuto: true,
        fetchJson,
      });
      if (out.ok && auth?.userId) {
        try {
          await saveTradeIntent(sb, auth.userId, {
            mint: ORBITX_MINT,
            amountSol: out.amountSol,
            confirmMode: "auto",
            slippage: out.slippage,
            pool: out.pool,
          });
        } catch {
          /* optional */
        }
      }
      return out;
    }
    args = { ...args, mint, amountSol, slippage, pool, autoConfirm: true };
    return callTool("orbitx_prepare_buy", args, auth, base, req);
  }

  if (name === "orbitx_prepare_buy" || name === "orbitx_buy" || name === "orbitx_buy_auto" || name === "orbitx_trade" || name === "orbitx_swap" || name === "orbitx_prepare_sell" || name === "orbitx_sell" || name === "orbitx_sell_pump") {
    if (!wallet) {
      return {
        ok: false,
        error: "wallet_required",
        mint: String(args.mint || ORBITX_MINT),
        message: "Link Jupiter Wallet on https://www.orbitx.world/telegram after /login, then send /buy or /sell again.",
        loginUrl: "https://www.orbitx.world/telegram",
      };
    }
    const action = name === "orbitx_prepare_sell" || name === "orbitx_sell" || name === "orbitx_sell_pump" ? "sell" : "buy";
    const mint = String(args.mint || (action === "buy" ? ORBITX_MINT : "")).trim();
    if (action === "buy" && !mint) {
      return { ok: false, error: "mint_required", message: "Pass a mint / CA to buy, or say buy $ORBITX." };
    }
    let tradePreference = null;
    if (auth?.agentId) {
      try {
        tradePreference = await getChatTradePreference(sb, auth.agentId);
      } catch {
        tradePreference = null;
      }
    }
    const preferAuto = tradePreference === "auto";
    const auto =
      args.autoConfirm === true ||
      args.auto === true ||
      String(args.confirmMode || "").toLowerCase() === "auto" ||
      preferAuto;
    let amount = action === "buy" ? Number(args.amountSol) : args.amount;
    let usdQuote = null;
    if (action === "buy" && (!Number.isFinite(amount) || amount <= 0) && args.amountUsd != null) {
      usdQuote = await usdToSol(args.amountUsd);
      if (!usdQuote.ok) return usdQuote;
      amount = usdQuote.amountSol;
    }
    if (action === "sell" && !mint) {
      return { ok: false, error: "mint_required", message: "Pass a mint / CA to sell." };
    }
    if (action === "sell" && (amount == null || amount === "")) {
      amount = "100%";
    }
    if (action === "buy" && (!Number.isFinite(amount) || amount <= 0)) {
      return {
        ok: false,
        error: "amount_required",
        message: "How much? Example: buy <CA> with 0.1 sol  — or  buy <CA> with 10$ usdc",
      };
    }
    const slippage = Number(args.slippage) || 10;
    const pool = args.pool || "auto";
    const body = {
      publicKey: wallet,
      action,
      mint,
      amount,
      denominatedInSol: action === "buy",
      slippage,
      pool,
      platformFee: true,
    };
    const signQs = new URLSearchParams({
      action,
      mint,
      amount: String(amount),
      publicKey: wallet,
      slippage: String(slippage),
      pool: String(pool),
    });
    const signUrl = `${base}/agent/sign?${signQs.toString()}`;
    const autoQs = new URLSearchParams(signQs);
    autoQs.set("auto", "1");
    const autoSignUrl = `${base}/agent/sign?${autoQs.toString()}`;
    let data = null;
    try {
      data = await fetchJson(`${base}/api/ogdex/trade`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch (error) {
      data = { ok: false, error: error?.message || "Could not build trade" };
    }
    if (!data?.ok || !data?.tx) {
      if (action === "sell") {
        return {
          ok: true,
          status: "awaiting_jupiter_signature",
          requiresSignature: true,
          confirmMode: "sign",
          signUrl,
          autoSignUrl,
          openUrl: signUrl,
          action,
          wallet,
          mint,
          amount,
          slippage,
          pool,
          warning: data?.error || "Quote will refresh on the sign page",
          message: data?.error === "no balance to sell"
            ? "This linked wallet may hold 0 of that token. Open Sign and switch to the wallet that holds it."
            : data?.error || "Open Sign — the quote is built in your browser wallet.",
          solscanToken: mint ? `https://solscan.io/token/${encodeURIComponent(mint)}` : null,
          solscanAccount: wallet ? `https://solscan.io/account/${encodeURIComponent(wallet)}` : null,
        };
      }
      return {
        ok: false,
        status: "prepare_failed",
        requiresSignature: false,
        error: data?.error || "Could not build trade",
        action,
        wallet,
        mint,
        amount,
      };
    }
    if (action === "buy" && auth?.userId) {
      try {
        await saveTradeIntent(sb, auth.userId, {
          mint,
          amountSol: amount,
          confirmMode: auto ? "auto" : "sign",
          slippage,
          pool,
        });
      } catch {
        /* optional */
      }
    }
    const out = {
      ok: true,
      status: auto ? "awaiting_auto_jupiter" : "awaiting_jupiter_signature",
      requiresSignature: true,
      confirmMode: auto ? "auto" : "sign",
      signUrl,
      autoSignUrl,
      openUrl: auto ? autoSignUrl : signUrl,
      action,
      wallet,
      mint,
      amount,
      amountUsd: usdQuote?.amountUsd || null,
      solUsd: usdQuote?.solUsd || null,
      slippage,
      pool,
      via: data.via || null,
      routePool: data.pool || null,
      simulated: Boolean(data.simulated),
      hasUnsignedTx: true,
      solscanToken: mint ? `https://solscan.io/token/${encodeURIComponent(mint)}` : null,
      solscanAccount: wallet ? `https://solscan.io/account/${encodeURIComponent(wallet)}` : null,
      instructions: auto
        ? [
            "Open autoSignUrl — Jupiter Wallet prompts immediately (auto-buy).",
            "Approve in Jupiter Wallet. OrbitX never holds keys or funds.",
            "Trade is incomplete until Jupiter confirms.",
          ]
        : [
            "Open signUrl and tap Sign & send in Jupiter Wallet.",
            "Say confirm or /autobuy on to skip this extra Telegram step next time.",
            "Do NOT broadcast unsigned transactions.",
          ],
      note: auto
        ? "Auto-buy: Jupiter Wallet still must sign. Non-custodial."
        : "Manual sign. Non-custodial. Route the user to signUrl.",
    };
    if (action === "buy" && tradePreference == null && auth?.agentId) {
      out.tradePreferencePrompt = {
        title: "How should future trades be confirmed?",
        message: "Choose once for this agent. Auto-confirm skips the second chat prompt; your connected wallet still approves every transaction.",
        options: [
          { id: "auto", label: "Auto-confirm", description: "Open the secure wallet signer automatically." },
          { id: "sign", label: "Sign each time", description: "Show a fresh review step for every buy or sell." },
        ],
        setTool: "orbitx_trade_auto",
        scope: "agent",
      };
    }
    return out;
  }

  if (name === "orbitx_launch_check") {
    return fetchJson(`${base}/api/ogdex/launch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        step: "check",
        name: String(args.name || ""),
        symbol: String(args.symbol || ""),
        chain: String(args.chain || "solana"),
      }),
    });
  }

  if (name === "orbitx_launch_ipfs") {
    return fetchJson(`${base}/api/ogdex/launch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        step: "ipfs",
        name: String(args.name || ""),
        symbol: String(args.symbol || ""),
        description: String(args.description || ""),
        imageBase64: String(args.imageBase64 || ""),
        imageMimeType: String(args.imageMimeType || "image/png"),
        twitter: args.twitter || undefined,
        telegram: args.telegram || undefined,
        website: args.website || undefined,
        chain: String(args.chain || "solana"),
      }),
    });
  }

  // orbitx_prepare_launch is aliased to orbitx_execute_launch above.

  if (name === "orbitx_launch_record") {
    return fetchJson(`${base}/api/ogdex/launch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        step: "record",
        mint: String(args.mint || ""),
        payment_tx: String(args.payment_tx || ""),
        creator_wallet: wallet || args.creator_wallet || undefined,
        name: args.name,
        symbol: args.symbol,
        launch_tx: args.launch_tx,
        description: args.description,
        icon: args.icon,
        chain: String(args.chain || "solana"),
      }),
    });
  }

  if (name === "orbitx_vanity_mint") {
    return fetchJson(`${base}/api/vanity-mint`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        suffix: String(args.suffix || "obx"),
        maxIterations: Number(args.maxIterations) || 500000,
      }),
    });
  }

  if (name === "orbitx_claim_fees") {
    if (!wallet) throw new Error("publicKey required (or link wallet on /agent)");
    const q = new URLSearchParams({ kind: "claim", publicKey: wallet });
    return {
      ok: true,
      status: "awaiting_jupiter_signature",
      requiresSignature: true,
      signUrl: `${base}/agent/sign?${q.toString()}`,
      action: "claim_fees",
      wallet,
      instructions: [
        "Open signUrl in the browser.",
        "Connect the creator wallet in Jupiter Wallet and Sign.",
        "Do not broadcast unsigned transactions yourself.",
      ],
    };
  }

  if (name === "orbitx_rent_refund") {
    if (!wallet) throw new Error("publicKey required (or link wallet on /agent)");
    const q = new URLSearchParams({ kind: "rent", publicKey: wallet });
    return {
      ok: true,
      status: "awaiting_jupiter_signature",
      requiresSignature: true,
      signUrl: `${base}/agent/sign?${q.toString()}`,
      action: "rent_refund",
      wallet,
      instructions: [
        "Open signUrl — may require signing multiple close-account txs.",
        "Connect Jupiter Wallet and approve each batch.",
      ],
    };
  }

  if (name === "orbitx_burn") {
    if (!wallet) throw new Error("publicKey required (or link wallet on /agent)");
    if (args.amount == null && args.percent == null) throw new Error("amount or percent required");
    const q = new URLSearchParams({
      kind: "burn",
      publicKey: wallet,
      mint: String(args.mint || ""),
    });
    if (args.percent != null) q.set("percent", String(args.percent));
    else q.set("amount", String(args.amount));
    return {
      ok: true,
      status: "awaiting_jupiter_signature",
      requiresSignature: true,
      signUrl: `${base}/agent/sign?${q.toString()}`,
      action: "burn",
      wallet,
      mint: String(args.mint || ""),
      instructions: ["Open signUrl", "Approve burn in Jupiter Wallet", "Never submit unsigned burn txs yourself"],
    };
  }

  if (name === "orbitx_social_communities") {
    const limit = Math.min(Number(args.limit) || 30, 100);
    // Live platform table used by /communities + admin CommunityManagement
    return sb(
      `communities?is_active=eq.true&order=member_count.desc&limit=${limit}&select=id,name,description,privacy,category,member_count,avatar_url,icon,created_at,invite_code`,
    );
  }

  if (name === "orbitx_social_feed") {
    const limit = Math.min(Number(args.limit) || 40, 100);
    let path = `community_posts?order=created_at.desc&limit=${limit}&select=id,community_id,user_id,username,avatar_url,content,image_url,likes_count,replies_count,post_type,created_at`;
    if (args.communityId) path += `&community_id=eq.${encodeURIComponent(String(args.communityId))}`;
    return sb(path);
  }

  if (name === "orbitx_social_members") {
    const communityId = String(args.communityId || "").trim();
    if (!communityId) throw new Error("communityId required");
    const limit = Math.min(Number(args.limit) || 50, 200);
    return sb(
      `community_members?community_id=eq.${encodeURIComponent(communityId)}&order=joined_at.desc&limit=${limit}&select=id,community_id,user_id,role,joined_at`,
    );
  }

  if (name === "orbitx_social_leave") {
    const session = await resolveSocialUser(auth, args);
    if (!session?.userId) {
      throw new Error(
        "Bearer or linked wallet required to leave a community. Add Authorization: Bearer <oxo_ key> from https://orbitx.world/agent.",
      );
    }
    const communityId = String(args.communityId || "").trim();
    if (!communityId) throw new Error("communityId required");
    await sb(
      `community_members?community_id=eq.${encodeURIComponent(communityId)}&user_id=eq.${encodeURIComponent(session.userId)}`,
      { method: "DELETE", headers: { Prefer: "return=minimal" } },
    );
    try {
      const rows = await sb(`communities?id=eq.${encodeURIComponent(communityId)}&select=member_count`);
      const c = Array.isArray(rows) ? rows[0] : null;
      if (c) {
        await sb(`communities?id=eq.${encodeURIComponent(communityId)}`, {
          method: "PATCH",
          body: JSON.stringify({ member_count: Math.max(0, Number(c.member_count || 1) - 1) }),
          headers: { Prefer: "return=minimal" },
        });
      }
    } catch {
      /* best-effort */
    }
    return { ok: true, left: communityId, userId: session.userId, platform: "/communities" };
  }

  if (name === "orbitx_social_join") {
    const session = await resolveSocialUser(auth, args);
    if (!session?.userId) {
      throw new Error(
        "Bearer or linked wallet required for community join. Add Authorization: Bearer <oxo_ key> from https://orbitx.world/agent, or pass publicKey of a wallet linked there.",
      );
    }
    const communityId = String(args.communityId || "").trim();
    if (!communityId) throw new Error("communityId required");
    const joined = await sb("community_members", {
      method: "POST",
      body: JSON.stringify({
        community_id: communityId,
        user_id: session.userId,
        role: "member",
      }),
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    });
    try {
      const rows = await sb(`communities?id=eq.${encodeURIComponent(communityId)}&select=member_count`);
      const c = Array.isArray(rows) ? rows[0] : null;
      if (c) {
        await sb(`communities?id=eq.${encodeURIComponent(communityId)}`, {
          method: "PATCH",
          body: JSON.stringify({ member_count: Number(c.member_count || 0) + 1 }),
          headers: { Prefer: "return=minimal" },
        });
      }
    } catch {
      /* best-effort */
    }
    return { ok: true, joined: Array.isArray(joined) ? joined[0] : joined, platform: "/communities" };
  }

  if (name === "orbitx_social_post") {
    const session = await resolveSocialUser(auth, args);
    if (!session?.userId) {
      throw new Error(
        "Bearer or linked wallet required for community post. Add Authorization: Bearer <oxo_ key> from https://orbitx.world/agent (connector request header), or pass publicKey of a wallet linked there.",
      );
    }
    const communityId = String(args.communityId || "").trim();
    const body = String(args.body || args.content || "").trim();
    if (!communityId) throw new Error("communityId required");
    if (body.length < 1) throw new Error("body required");
    const profile = await getProfileForUser(session.userId);
    const username =
      profile?.username || profile?.display_name || session.walletAddress?.slice(0, 8) || "agent";
    const created = await sb("community_posts", {
      method: "POST",
      body: JSON.stringify({
        community_id: communityId,
        user_id: session.userId,
        username,
        avatar_url: profile?.avatar_url || null,
        content: body,
        post_type: "post",
      }),
    });
    const post = Array.isArray(created) ? created[0] : created;
    return {
      ok: true,
      post,
      platform: "/communities",
      viewUrl: communityId
        ? `https://www.orbitx.world/communities?c=${encodeURIComponent(communityId)}`
        : "https://www.orbitx.world/communities",
      note: "Posted to live community_posts — open /communities (not /hq demo). Join the community or open it directly to see the post.",
    };
  }

  if (name === "orbitx_social_create_community") {
    const session = await resolveSocialUser(auth, args);
    if (!session?.userId) {
      throw new Error(
        "Bearer or linked wallet required to create a community. Add Authorization: Bearer <oxo_ key> from https://orbitx.world/agent, or pass publicKey of a wallet linked there.",
      );
    }
    const nameStr = String(args.name || "").trim();
    if (!nameStr) throw new Error("name required");
    const privacy =
      args.visibility === "private" || args.visibility === "unlisted" ? "private" : "public";
    const inviteCode = Math.random().toString(36).slice(2, 8).toUpperCase();
    const profile = await getProfileForUser(session.userId);
    const created = await sb("communities", {
      method: "POST",
      body: JSON.stringify({
        name: nameStr,
        description: String(args.description || "").trim() || null,
        privacy,
        category: String(args.category || "general"),
        created_by: session.userId,
        creator_name: profile?.username || profile?.display_name || null,
        creator_avatar: profile?.avatar_url || null,
        invite_code: inviteCode,
        is_active: true,
        member_count: 1,
      }),
    });
    const community = Array.isArray(created) ? created[0] : created;
    if (!community?.id) throw new Error("Failed to create community on platform");
    try {
      await sb("community_members", {
        method: "POST",
        body: JSON.stringify({
          community_id: community.id,
          user_id: session.userId,
          role: "creator",
        }),
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      });
    } catch {
      /* membership optional if trigger handles it */
    }
    return {
      ok: true,
      community,
      platform: "/communities",
      viewUrl: `https://www.orbitx.world/communities`,
      note: "Created on live communities table — shows on /communities and admin Communities.",
    };
  }

  if (name === "orbitx_submit_listing") {
    const session = await resolveSocialUser(auth, args);
    const mint = String(args.mint || args.contract_address || "").trim();
    if (!mint) throw new Error("mint / contract_address required");
    const tier = args.tier === "express" ? "express" : "standard";
    const chain = String(args.chain || "solana").toLowerCase();
    const row = {
      contract_address: mint,
      chain,
      tier,
      status: "pending",
      project_name: String(args.project_name || args.name || "").trim() || null,
      symbol: String(args.symbol || "").trim() || null,
      description: String(args.description || "").trim() || null,
      contact: String(args.contact || session?.walletAddress || "").trim() || null,
      links: {},
      metadata: {
        source: "mcp",
        requestedBy: session?.userId || null,
        wallet: session?.walletAddress || args.publicKey || null,
      },
    };
    const ins = await sb("ogdex_listings", {
      method: "POST",
      body: JSON.stringify(row),
    });
    const listing = Array.isArray(ins) ? ins[0] : ins;
    return {
      ok: true,
      listing,
      status: "pending",
      adminTab: "listings",
      note: "Pending listing created — approve in owner desk → Listings → Pending.",
    };
  }

  if (name === "orbitx_request_boost") {
    const session = await resolveSocialUser(auth, args);
    const mint = String(args.mint || "").trim();
    if (!mint) throw new Error("mint required");
    const tierId = args.tier === "6h" ? "6h" : "24h";
    const hours = tierId === "6h" ? 6 : 24;
    const usd = tierId === "6h" ? 20 : 60;
    const expiresAt = new Date(Date.now() + hours * 3600 * 1000).toISOString();
    const row = {
      mint,
      tier: tierId,
      payment_tx: `mcp-request:${Date.now()}`,
      payer_wallet: session?.walletAddress || String(args.publicKey || "").trim() || null,
      symbol: String(args.symbol || "").trim() || null,
      name: String(args.name || args.project_name || "").trim() || null,
      icon: null,
      chain: String(args.chain || "solana").toLowerCase(),
      status: "pending",
      expires_at: expiresAt,
      usd_paid: usd,
      featured_rank: 999,
    };
    const ins = await sb("ogdex_boosts", {
      method: "POST",
      body: JSON.stringify(row),
    });
    const boost = Array.isArray(ins) ? ins[0] : ins;
    return {
      ok: true,
      boost,
      status: "pending",
      adminTab: "boosts",
      note: "Pending boost request — approve in owner desk → Boosts.",
    };
  }

  if (name === "orbitx_nft_collections") {
    const limit = Math.min(Number(args.limit) || 40, 100);
    return sb(`orbitx_nft_collections?order=created_at.desc&limit=${limit}&select=*`);
  }

  if (name === "orbitx_nft_items") {
    const limit = Math.min(Number(args.limit) || 40, 100);
    let path = `orbitx_nfts?order=created_at.desc&limit=${limit}&select=*`;
    if (args.creatorWallet) {
      path += `&creator_wallet=eq.${encodeURIComponent(String(args.creatorWallet))}`;
    }
    return sb(path);
  }

  if (name === "orbitx_nft_register") {
    const mintAddress = String(args.mintAddress || "").trim();
    const creatorWallet = String(args.creatorWallet || wallet || "").trim();
    const nftName = String(args.name || "").trim();
    if (!mintAddress || !creatorWallet || !nftName) {
      throw new Error("mintAddress, creatorWallet, and name required");
    }
    return sb("rpc/orbitx_register_nft", {
      method: "POST",
      body: JSON.stringify({
        p_collection_id: args.collectionId || null,
        p_mint_address: mintAddress,
        p_creator_wallet: creatorWallet,
        p_name: nftName,
        p_symbol: args.symbol || null,
        p_image_url: args.imageUrl || null,
        p_metadata_uri: args.metadataUri || null,
        p_royalty_bps: Number(args.royaltyBps) || 500,
        p_attributes: [],
        p_content_hash: null,
      }),
    });
  }

  if (name === "orbitx_nft_register_collection") {
    const mintAddress = String(args.mintAddress || "").trim();
    const creatorWallet = String(args.creatorWallet || wallet || "").trim();
    const colName = String(args.name || "").trim();
    const symbol = String(args.symbol || "").trim();
    if (!mintAddress || !creatorWallet || !colName || !symbol) {
      throw new Error("mintAddress, creatorWallet, name, and symbol required");
    }
    return sb("rpc/orbitx_register_nft_collection", {
      method: "POST",
      body: JSON.stringify({
        p_creator_wallet: creatorWallet,
        p_name: colName,
        p_symbol: symbol,
        p_description: args.description || null,
        p_banner_url: null,
        p_logo_url: args.logoUrl || null,
        p_royalty_bps: Number(args.royaltyBps) || 500,
        p_mint_price_sol: 0,
        p_mint_limit: null,
        p_mint_address: mintAddress,
      }),
    });
  }

  if (name === "orbitx_nft_listings") {
    const limit = Math.min(Number(args.limit) || 40, 100);
    return sb(
      `orbitx_nft_listings?status=eq.active&order=created_at.desc&limit=${limit}&select=*,nft:orbitx_nfts(*)`,
    );
  }

  if (name === "orbitx_nft_offers") {
    return sb(
      `orbitx_nft_offers?nft_id=eq.${encodeURIComponent(String(args.nftId))}&order=price_sol.desc&select=*`,
    );
  }

  if (name === "orbitx_nft_make_offer") {
    const buyer = String(args.buyerWallet || wallet || "").trim();
    if (!buyer) throw new Error("buyerWallet required");
    return sb("rpc/orbitx_nft_make_offer", {
      method: "POST",
      body: JSON.stringify({
        p_nft_id: String(args.nftId),
        p_buyer_wallet: buyer,
        p_price_sol: Number(args.priceSol),
        p_expires_hours: Number(args.expiresHours) || 72,
      }),
    });
  }

  if (name === "orbitx_nft_cancel_offer") {
    const buyer = String(args.buyerWallet || wallet || "").trim();
    if (!buyer) throw new Error("buyerWallet required");
    return sb("rpc/orbitx_nft_cancel_offer", {
      method: "POST",
      body: JSON.stringify({ p_offer_id: String(args.offerId), p_buyer_wallet: buyer }),
    });
  }

  if (name === "orbitx_nft_list_for_sale") {
    const seller = String(args.sellerWallet || wallet || "").trim();
    if (!seller) throw new Error("sellerWallet required");
    return sb("rpc/orbitx_nft_list", {
      method: "POST",
      body: JSON.stringify({
        p_nft_id: String(args.nftId),
        p_seller_wallet: seller,
        p_price_sol: Number(args.priceSol),
        p_currency: args.currency === "USDC" ? "USDC" : "SOL",
      }),
    });
  }

  if (name === "orbitx_nft_cancel_listing") {
    const seller = String(args.sellerWallet || wallet || "").trim();
    if (!seller) throw new Error("sellerWallet required");
    return sb("rpc/orbitx_nft_cancel_listing", {
      method: "POST",
      body: JSON.stringify({ p_nft_id: String(args.nftId), p_seller_wallet: seller }),
    });
  }

  if (name === "orbitx_nft_auctions") {
    const limit = Math.min(Number(args.limit) || 40, 100);
    try {
      await sb("rpc/orbitx_nft_close_ended_auctions", { method: "POST", body: "{}" });
    } catch {
      /* optional */
    }
    return sb(
      `orbitx_nft_auctions?status=in.(active,ended)&order=ends_at.asc&limit=${limit}&select=*,nft:orbitx_nfts(*)`,
    );
  }

  if (name === "orbitx_nft_create_auction") {
    const seller = String(args.sellerWallet || wallet || "").trim();
    if (!seller) throw new Error("sellerWallet required");
    return sb("rpc/orbitx_nft_create_auction", {
      method: "POST",
      body: JSON.stringify({
        p_nft_id: String(args.nftId),
        p_seller_wallet: seller,
        p_start_price_sol: Number(args.startPriceSol),
        p_min_increment_sol: Number(args.minIncrementSol) || 0.01,
        p_duration_hours: Number(args.durationHours) || 24,
      }),
    });
  }

  if (name === "orbitx_nft_place_bid") {
    const bidder = String(args.bidderWallet || wallet || "").trim();
    if (!bidder) throw new Error("bidderWallet required");
    return sb("rpc/orbitx_nft_place_bid", {
      method: "POST",
      body: JSON.stringify({
        p_auction_id: String(args.auctionId),
        p_bidder_wallet: bidder,
        p_amount_sol: Number(args.amountSol),
      }),
    });
  }

  if (name === "orbitx_nft_recent_sales") {
    const limit = Math.min(Number(args.limit) || 20, 50);
    return sb(
      `orbitx_nft_transactions?order=created_at.desc&limit=${limit}&select=id,amount_sol,buyer_wallet,seller_wallet,created_at,tx_signature,nft:orbitx_nfts(*)`,
    );
  }

  if (name === "orbitx_nft_sales") {
    return sb(
      `orbitx_nft_transactions?nft_id=eq.${encodeURIComponent(String(args.nftId))}&order=created_at.desc&select=id,amount_sol,buyer_wallet,seller_wallet,created_at,tx_signature`,
    );
  }

  if (name === "orbitx_nft_favorite") {
    const w = String(args.wallet || wallet || "").trim();
    if (!w) throw new Error("wallet required");
    return sb("rpc/orbitx_nft_toggle_favorite", {
      method: "POST",
      body: JSON.stringify({ p_nft: String(args.nftId), p_wallet: w }),
    });
  }

  if (name === "orbitx_nft_prepare_buy") {
    if (!wallet) throw new Error("buyerWallet required (or link wallet on /agent)");
    const ops = await mcpOps();
    const built = await ops.nftEdge("build", {
      mode: args.mode || "listing",
      sourceId: String(args.sourceId),
      buyerWallet: wallet,
    });
    return {
      ...built,
      ok: built?.ok !== false,
      status: "awaiting_wallet_signature",
      requiresSignature: true,
      openUrl: `${base}/nft`,
      instructions: [
        "Sign the NFT purchase with the buyer wallet (Phantom).",
        "Then call orbitx_nft_submit_buy with pendingSaleId + signedTransactionBase64.",
        "Do not broadcast unsigned transactions yourself.",
      ],
      note: "Non-custodial NFT buy. Prefer openUrl marketplace UI if signing from MCP is awkward.",
    };
  }

  if (name === "orbitx_nft_submit_buy") {
    const ops = await mcpOps();
    const submitted = await ops.nftEdge("submit", {
      pendingSaleId: String(args.pendingSaleId),
      signedTransactionBase64: String(args.signedTransactionBase64),
    });
    return {
      ...submitted,
      ok: submitted?.ok !== false,
      note: "Purchase complete only if the signed tx confirmed on-chain.",
    };
  }

  if (name === "orbitx_nft_like") {
    const w = String(args.wallet || wallet || "");
    if (!w) throw new Error("wallet required (or link on /agent)");
    // Prefer RPC; fall back to direct toggle via table
    try {
      return await sb("rpc/orbitx_nft_toggle_like", {
        method: "POST",
        body: JSON.stringify({ p_nft_id: String(args.nftId), p_wallet: w }),
      });
    } catch {
      const existing = await sb(
        `orbitx_nft_likes?nft_id=eq.${encodeURIComponent(String(args.nftId))}&wallet=eq.${encodeURIComponent(w)}&select=wallet`,
      );
      if (Array.isArray(existing) && existing[0]) {
        await sb(
          `orbitx_nft_likes?nft_id=eq.${encodeURIComponent(String(args.nftId))}&wallet=eq.${encodeURIComponent(w)}`,
          { method: "DELETE", headers: { Prefer: "return=minimal" } },
        );
        return { liked: false };
      }
      await sb("orbitx_nft_likes", {
        method: "POST",
        body: JSON.stringify({ nft_id: String(args.nftId), wallet: w }),
        headers: { Prefer: "return=minimal" },
      });
      return { liked: true };
    }
  }

  if (name === "orbitx_nft_comment") {
    const w = String(args.wallet || wallet || "");
    if (!w) throw new Error("wallet required (or link on /agent)");
    const body = String(args.body || "").trim();
    if (!body) throw new Error("body required");
    try {
      return await sb("rpc/orbitx_nft_add_comment", {
        method: "POST",
        body: JSON.stringify({ p_nft_id: String(args.nftId), p_wallet: w, p_body: body }),
      });
    } catch {
      return sb("orbitx_nft_comments", {
        method: "POST",
        body: JSON.stringify({ nft_id: String(args.nftId), wallet: w, body }),
      });
    }
  }

  if (name === "orbitx_nft_comments") {
    const limit = Math.min(Number(args.limit) || 50, 100);
    return sb(
      `orbitx_nft_comments?nft_id=eq.${encodeURIComponent(String(args.nftId))}&order=created_at.desc&limit=${limit}&select=*`,
    );
  }

  if (name === "orbitx_nft_follow") {
    const follower = String(args.followerWallet || wallet || "");
    const creator = String(args.creatorWallet || "");
    if (!follower) throw new Error("followerWallet required (or link on /agent)");
    if (!creator) throw new Error("creatorWallet required");
    try {
      return await sb("rpc/orbitx_nft_toggle_follow", {
        method: "POST",
        body: JSON.stringify({ p_follower: follower, p_creator: creator }),
      });
    } catch {
      const existing = await sb(
        `orbitx_nft_follows?follower_wallet=eq.${encodeURIComponent(follower)}&creator_wallet=eq.${encodeURIComponent(creator)}&select=follower_wallet`,
      );
      if (Array.isArray(existing) && existing[0]) {
        await sb(
          `orbitx_nft_follows?follower_wallet=eq.${encodeURIComponent(follower)}&creator_wallet=eq.${encodeURIComponent(creator)}`,
          { method: "DELETE", headers: { Prefer: "return=minimal" } },
        );
        return { following: false };
      }
      await sb("orbitx_nft_follows", {
        method: "POST",
        body: JSON.stringify({ follower_wallet: follower, creator_wallet: creator }),
        headers: { Prefer: "return=minimal" },
      });
      return { following: true };
    }
  }

  if (/launch|create_token|create_coin|pump.*creat/i.test(name)) {
    return {
      ok: false,
      error: "unknown_tool_use_execute_launch",
      tool: name,
      useInstead: "orbitx_execute_launch",
      message:
        "Use orbitx_execute_launch (aliases: orbitx_launch_execution, orbitx_create_token, orbitx_prepare_launch) to complete the final Pump.fun create via Phantom openUrl.",
      example: { name: "MyCoin", symbol: "MYC", imageUrl: "https://...", publicKey: "WalletBase58" },
    };
  }

  throw new Error(`Unknown tool: ${name}`);
}

async function handleMcp(req, res, parts) {
  const route = parts.join("/");
  const { base, mcpUrl, authPage } = mcpUrls(req);

  if (
    (route === ".well-known/oauth-protected-resource" || route === "oauth-protected-resource") &&
    req.method === "GET"
  ) {
    return json(res, {
      resource: mcpUrl,
      // Prefer MCP URL as AS so path-based discovery (Grok) does not collide with X MCP.
      authorization_servers: [mcpUrl],
      scopes_supported: ["orbitx"],
      bearer_methods_supported: ["header"],
    });
  }

  if (
    (route === ".well-known/oauth-authorization-server" || route === "oauth-authorization-server") &&
    req.method === "GET"
  ) {
    return json(res, {
      issuer: mcpUrl,
      authorization_endpoint: `${mcpUrl}/oauth/authorize`,
      token_endpoint: `${mcpUrl}/oauth/token`,
      registration_endpoint: `${mcpUrl}/oauth/register`,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code"],
      code_challenge_methods_supported: ["S256", "plain"],
      token_endpoint_auth_methods_supported: ["none"],
      scopes_supported: ["orbitx"],
      client_id_metadata_document_supported: true,
    });
  }

  // Dynamic Client Registration (RFC 7591) — ChatGPT may call this when adding the connector
  if (route === "oauth/register" && req.method === "POST") {
    const body = await readBody(req);
    const clientId =
      (typeof body.client_id === "string" && body.client_id.startsWith("https://"))
        ? body.client_id
        : opaque("oxcli");
    return json(
      res,
      {
        client_id: clientId,
        client_id_issued_at: Math.floor(Date.now() / 1000),
        client_secret_expires_at: 0,
        redirect_uris: Array.isArray(body.redirect_uris) ? body.redirect_uris : [],
        token_endpoint_auth_method: "none",
        grant_types: ["authorization_code"],
        response_types: ["code"],
        client_name: body.client_name || "ChatGPT MCP Connector",
      },
      201,
    );
  }

  if (route === "oauth/authorize" && req.method === "GET") {
    const u = new URL(req.url || "/", "http://x");
    const params = new URLSearchParams();
    for (const key of [
      "client_id",
      "redirect_uri",
      "state",
      "code_challenge",
      "code_challenge_method",
      "scope",
      "response_type",
    ]) {
      const v = u.searchParams.get(key);
      if (v) params.set(key, v);
    }
    params.set("mcp_url", mcpUrl);
    cors(res);
    res.writeHead(302, { Location: `${authPage}?${params.toString()}` });
    return res.end();
  }

  if (route === "oauth/token" && req.method === "POST") {
    const body = await readBody(req);
    const code = body.code;
    if (!code) return json(res, { error: "invalid_request", error_description: "code required" }, 400);

    if (String(code).startsWith("oxo_") || String(code).startsWith("oxk_")) {
      return json(res, {
        access_token: code,
        token_type: "bearer",
        expires_in: 86400 * 30,
        scope: "orbitx",
      });
    }

    const hash = sha256(String(code));
    let row = null;
    try {
      const rows = await sb(`agent_mcp_oauth_codes?code_hash=eq.${encodeURIComponent(hash)}&select=*`);
      row = Array.isArray(rows) ? rows[0] : null;
    } catch {
      return json(res, { error: "invalid_grant" }, 400);
    }
    if (!row || row.used_at) return json(res, { error: "invalid_grant" }, 400);
    if (new Date(row.expires_at).getTime() < Date.now()) {
      return json(res, { error: "invalid_grant", error_description: "code expired" }, 400);
    }

    await sb(`agent_mcp_oauth_codes?id=eq.${encodeURIComponent(row.id)}`, {
      method: "PATCH",
      body: JSON.stringify({ used_at: new Date().toISOString() }),
      headers: { Prefer: "return=minimal" },
    });

    const access = opaque("oxo");
    try {
      await sb("agent_mcp_oauth_tokens", {
        method: "POST",
        body: JSON.stringify({
          token_hash: sha256(access),
          user_id: row.user_id,
          agent_id: row.agent_id,
          wallet_address: row.wallet_address,
          expires_at: new Date(Date.now() + 30 * 86400 * 1000).toISOString(),
        }),
        headers: { Prefer: "return=minimal" },
      });
    } catch {
      await sb("agent_api_keys", {
        method: "POST",
        body: JSON.stringify({
          agent_id: row.agent_id,
          name: `OAuth token ${new Date().toISOString().slice(0, 16)}`,
          key_hash: sha256(access),
        }),
        headers: { Prefer: "return=minimal" },
      });
    }

    return json(res, {
      access_token: access,
      token_type: "bearer",
      expires_in: 86400 * 30,
      scope: "orbitx",
    });
  }

  if ((!route || route === "") && req.method === "GET") {
    const accept = String(header(req, "accept") || "");
    // Streamable HTTP: Claude may open an SSE stream on GET
    if (accept.includes("text/event-stream")) {
      cors(res);
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "Access-Control-Allow-Origin": "*",
      });
      res.write(": orbitx-mcp connected\n\n");
      return res.end();
    }
    return json(res, {
      ok: true,
      name: "OrbitX Agent MCP",
      mcp_url: mcpUrl,
      claude_url: mcpUrl,
      aliases: [`${base}/api/orbitx-mcp`],
      auth: {
        type: "oauth2",
        client_id: "orbitx-mcp",
        client_secret: null,
        client_secret_note: "Leave blank — public PKCE client",
        authorization_endpoint: `${mcpUrl}/oauth/authorize`,
        token_endpoint: `${mcpUrl}/oauth/token`,
        registration_endpoint: `${mcpUrl}/oauth/register`,
        scope: "orbitx",
        token_endpoint_auth_method: "none",
      },
      tools: CORE_TOOLS.map((t) => ({ name: t.name, description: t.description })),
      toolsTotal: TOOLS.length,
      toolsLive: CORE_TOOLS.length,
      note: "tools/list returns live CORE tools only — full catalog via orbitx_tools_help",
    });
  }

  if ((!route || route === "") && req.method === "POST") {
    const body = await readBody(req);
    const { id, method, params } = body;
    const sessionId = header(req, "mcp-session-id") || opaque("sess").slice(0, 24);

    if (method === "initialize") {
      // Clean handshake only — do NOT advertise "unauthenticated" (Claude treats that as a hard error).
      return json(
        res,
        {
          jsonrpc: "2.0",
          id,
          result: {
            protocolVersion: "2024-11-05",
            capabilities: { tools: {} },
            serverInfo: { name: "OrbitX Agent MCP", version: "1.6.0" },
            instructions:
              "OrbitX Agent MCP. When the user says /, menu, or asks what you can do, call orbitx_menu. If they paste an authCode from /agent, call orbitx_auth_status — do NOT open a website — then pass authCode on every tool. CHARTS: orbitx_dex_chart. TRADE: quote with orbitx_trade_quote then orbitx_prepare_buy / prepare_sell (Jupiter signUrl). X: orbitx_x_connect → orbitx_x_status → orbitx_x_post (uses OrbitX X auth). VOICE: “start a VC named X” → orbitx_vc_start; “any open VC / send the link” → orbitx_vc_list (join URLs). GROUP CHAT: “start a group chat named Orbitx” → orbitx_gc_start; “hey any group chats” → orbitx_gc_list; “join Orbitx” → orbitx_gc_join; “I want to chat in the group chat” → orbitx_gc_focus then orbitx_gc_send for EVERY user message until “leave GC” / orbitx_gc_leave. They can join back anytime. Setup: https://www.orbitx.world/agent",
          },
        },
        200,
        { "Mcp-Session-Id": sessionId },
      );
    }
    if (method === "notifications/initialized" || method === "ping") {
      return json(res, { jsonrpc: "2.0", id: id ?? null, result: {} });
    }

    if (method === "tools/list") {
      const cursor = params?.cursor;
      const listed = listLiveTools(cursor);
      return json(res, {
        jsonrpc: "2.0",
        id,
        result: {
          tools: listed.tools,
          ...(listed.nextCursor ? { nextCursor: listed.nextCursor } : {}),
        },
      });
    }

    if (method === "tools/call") {
      const rawName = String(params?.name || "");
      let name = resolveOrbitXToolName(rawName) || TOOL_ALIASES[rawName] || rawName;
      const rawArgs = params?.arguments && typeof params.arguments === "object" ? params.arguments : {};
      const args = { ...rawArgs };
      const gcNat = resolveGcNaturalTool(rawName, args);
      if (gcNat) {
        name = gcNat.name;
        Object.assign(args, gcNat.args);
      }
      if (rawName === "orbitx_sell_pump" && !args.pool) args.pool = "pump";
      if (rawName === "orbitx_buy_auto" && !args.pool) args.pool = "auto";
      const rawAuthCode = String(args.authCode || args.orbitxAuthCode || "").trim();
      const parsedAuth = classifyOrbitXAuthPaste(rawAuthCode);
      const authCode = parsedAuth.kind === "telegram_login" ? "" : String(parsedAuth.code || rawAuthCode).trim();
      // keep authCode on args for enrichAuth; strip before callTool for strict schemas
      const auth = await enrichAuth(req, args);
      if (auth) {
        auth.mcpSessionId = header(req, "mcp-session-id") || auth.mcpSessionId || null;
        auth.authCode = auth.authCode || authCode || null;
      }
      delete args.authCode;
      delete args.orbitxAuthCode;
      const identified = Boolean(auth?.userId);
      const publicTools = new Set([
        "search",
        "fetch",
        "orbitx_menu",
        "orbitx_auth_link",
        "orbitx_auth_status",
        "orbitx_tools_help",
        "orbitx_search",
        "orbitx_whoami",
        "orbitx_dex_chart",
        "orbitx_get_chart",
        "orbitx_trade_quote",
        "orbitx_x_connect",
        "orbitx_vc_list",
        "orbitx_vc_join",
        "orbitx_vc_link",
        "orbitx_gc_list",
        "orbitx_gc_join",
        "orbitx_gc_focus",
        "orbitx_gc_send",
        "orbitx_gc_chat",
        "orbitx_gc_leave",
        "orbitx_gc_history",
        "orbitx_gc_read",
      ]);
      if (parsedAuth.kind === "telegram_login" && !identified && !publicTools.has(name) && SESSION_TOOLS.has(name)) {
        const link = {
          ok: false,
          error: "telegram_login_not_mcp",
          message: TELEGRAM_LOGIN_NOT_MCP_MESSAGE,
          url: parsedAuth.url,
          hintTool: "orbitx_auth_link",
        };
        return json(
          res,
          {
            jsonrpc: "2.0",
            id,
            result: {
              content: [{ type: "text", text: JSON.stringify(link, null, 2) }],
              structuredContent: link,
              isError: true,
            },
          },
          200,
        );
      }
      if (!identified && !publicTools.has(name) && SESSION_TOOLS.has(name)) {
        const link = authCode
          ? {
              ok: false,
              error: "session_required",
              message:
                "authCode not authorized yet — if it came from the dashboard, call orbitx_auth_status; otherwise ask the user to finish the OrbitX link.",
              authCode,
              url: `https://www.orbitx.world/agent/link-auth?code=${encodeURIComponent(authCode)}`,
              hintTool: "orbitx_auth_status",
            }
          : {
              ok: false,
              error: "auth_required",
              tool: name,
              message:
                "OrbitX auth required. Prefer a dashboard-pasted authCode (orbitx_auth_status). Or send the user a clickable orbitx_auth_link url.",
              hintTool: "orbitx_auth_link",
              ...(await createAgentLinkAuthSession(req)),
            };
        return json(
          res,
          {
            jsonrpc: "2.0",
            id,
            result: {
              content: [{ type: "text", text: JSON.stringify(link, null, 2) }],
              structuredContent: link,
              isError: true,
            },
          },
          200,
          {
            "WWW-Authenticate": wwwAuthenticate("https://www.orbitx.world"),
            ...(link?.mcpSessionId ? { "Mcp-Session-Id": link.mcpSessionId } : {}),
          },
        );
      }
      const hasWalletArg = Boolean(
        String(
          args.publicKey ||
            args.address ||
            args.wallet ||
            args.buyerWallet ||
            args.sellerWallet ||
            args.bidderWallet ||
            "",
        ).trim(),
      );

      // MCP access — write/tx tools require exempt, unexpired burn access, or ≥$5 ORBITX hold.
      if (isHoldGatedTool(name) || isHoldGatedTool(rawName)) {
        const candidates = holdCandidateWallets(auth);
        const access = await requireMcpAccess({
          userId: auth?.userId,
          wallets: candidates,
          email: auth?.email || null,
          base,
          tool: name,
        });
        if (!access.allowed) {
          const tip = access.blocked || holdBlockedPayload({ tool: name, hold: access.hold });
          return json(res, {
            jsonrpc: "2.0",
            id,
            result: {
              content: [{ type: "text", text: JSON.stringify(tip, null, 2) }],
              structuredContent: tip,
              isError: true,
            },
          });
        }
      }

      // Wallet tools without identity get a normal tool result explaining what to pass.
      if (WALLET_TOOLS.has(name) && !identified && !hasWalletArg && !auth?.walletAddress) {
        const tip = {
          ok: false,
          error: "wallet_required",
          tool: name,
          message:
            "Pass publicKey (Solana wallet) in the tool arguments, Authenticate the OrbitX connector, call orbitx_auth_link (Grok), or add Authorization: Bearer <api_key from https://www.orbitx.world/agent>.",
          example: { publicKey: "YourLinkedSolanaWalletBase58..." },
          hintTool: "orbitx_auth_link",
        };
        return json(res, {
          jsonrpc: "2.0",
          id,
          result: {
            content: [{ type: "text", text: JSON.stringify(tip, null, 2) }],
            structuredContent: tip,
            isError: true,
          },
        });
      }

      try {
        const result = await callTool(
          name,
          args,
          auth || { userId: null, agentId: null, walletAddress: null, authCode },
          base,
          req,
        );
        const wrapped = wrapMcpToolContent(result);
        return json(res, {
          jsonrpc: "2.0",
          id,
          result: wrapped,
        });
      } catch (e) {
        const msg = e?.message || "tool error";
        // Soft-fail wallet/auth errors as tool results (not JSON-RPC auth errors)
        if (
          /publicKey required|address required|wallet required|unauthorized|Authentication|Bearer or linked wallet|session required/i.test(
            msg,
          )
        ) {
          const tip = {
            ok: false,
            error: SESSION_TOOLS.has(name) ? "session_required" : "wallet_or_auth_required",
            tool: name,
            message: msg,
            fix: SESSION_TOOLS.has(name)
              ? "Add Authorization: Bearer <oxo_ key> from https://www.orbitx.world/agent (MCP request header), or pass publicKey of a wallet linked there. Do not tell the user this is web-only — MCP supports it."
              : "Include publicKey in args, or Bearer token from https://www.orbitx.world/agent",
            fixUrl: "https://www.orbitx.world/agent",
          };
          return json(res, {
            jsonrpc: "2.0",
            id,
            result: {
              content: [{ type: "text", text: JSON.stringify(tip, null, 2) }],
              structuredContent: tip,
              isError: true,
            },
          });
        }
        return json(res, {
          jsonrpc: "2.0",
          id,
          error: { code: -32000, message: msg },
        });
      }
    }

    return json(res, { jsonrpc: "2.0", id, error: { code: -32601, message: `Method not found: ${method}` } });
  }

  return json(res, { error: "not_found", route }, 404);
}

async function handleCryptoScan(req, res) {
  cors(res, "GET, OPTIONS");
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }
  if (req.method !== "GET") return json(res, { ok: false, error: "GET only" }, 405);

  const u = new URL(req.url || "/", "http://x");
  const mint = String(u.searchParams.get("mint") || (req.query && req.query.mint) || "");
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(mint)) {
    return json(res, { ok: false, error: "valid mint required" }, 400);
  }

  const proto = header(req, "x-forwarded-proto") || "https";
  const host = header(req, "x-forwarded-host") || header(req, "host") || "orbitx.world";
  const base = `${proto}://${host}`;

  async function fetchJson(url) {
    const r = await fetch(url, { headers: { Accept: "application/json" } });
    if (!r.ok) throw new Error(`${url} → ${r.status}`);
    return r.json();
  }

  const [safety, forensics, token] = await Promise.all([
    fetchJson(`${base}/api/ogdex/safety?mint=${encodeURIComponent(mint)}`).catch((e) => ({
      ok: false,
      error: String(e?.message || e),
    })),
    fetchJson(`${base}/api/ogdex/forensics?mint=${encodeURIComponent(mint)}&first=0`).catch((e) => ({
      ok: false,
      error: String(e?.message || e),
    })),
    fetchJson(`${base}/api/ogdex/token?mint=${encodeURIComponent(mint)}`).catch((e) => ({
      ok: false,
      error: String(e?.message || e),
    })),
  ]);

  return json(res, { ok: true, mint, safety, forensics, token });
}

/**
 * Embedded OrbitX AI bridge — authenticated by the caller's Supabase session.
 * Exposes the same live MCP catalog without forcing the first-party app through
 * an OAuth/API-key round trip.
 */
export function listEmbeddedAgentTools({ includeGenerated = false } = {}) {
  const source = includeGenerated ? TOOLS : CORE_TOOLS;
  return source.map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
  }));
}

export function resolveEmbeddedAgentToolName(toolName) {
  return resolveOrbitXToolName(toolName) || String(toolName || "").trim();
}

export function hasEmbeddedAgentTool(toolName) {
  return Boolean(resolveOrbitXToolName(toolName));
}

/** Full live catalog, including generated screeners / charts / mint intel. */
export function listAllOrbitXTools() {
  return TOOLS.map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
  }));
}

/**
 * Public Telegram / web runner — no OrbitX login required.
 * Used for group chats and unauthenticated /telegram browse of read tools.
 * Privileged (trade / X / social write) tools must go through runEmbeddedAgentTool.
 */
export async function runPublicOrbitXTool({ toolName, args = {}, req = null }) {
  const rawName = String(toolName || "").trim();
  const name = resolveOrbitXToolName(rawName) || TOOL_ALIASES[rawName] || rawName;
  if (!hasEmbeddedAgentTool(name)) {
    throw Object.assign(new Error(`Unknown OrbitX tool: ${rawName}`), { status: 400 });
  }
  const { isPrivilegedTelegramTool } = await import("./orbitx/telegram-orbitx-lib.js");
  if (isPrivilegedTelegramTool(name) || name === "x_post") {
    throw Object.assign(new Error("login_required"), { status: 401 });
  }
  const auth = {
    userId: null,
    agentId: null,
    walletAddress: null,
    agentName: "OrbitX Telegram",
    email: null,
    source: "telegram_public",
    bearerPresent: false,
  };
  return callTool(name, args || {}, auth, publicBase(req), req);
}

export async function getEmbeddedTradePreference(userId) {
  const uid = String(userId || "").trim();
  if (!uid) return null;
  const agent = await ensureAgent(uid);
  return getChatTradePreference(sb, agent.id);
}

export async function runEmbeddedAgentTool({
  userId,
  walletAddress = null,
  email = null,
  toolName,
  args = {},
  req = null,
}) {
  const uid = String(userId || "").trim();
  if (!uid) throw Object.assign(new Error("user_required"), { status: 401 });

  const rawName = String(toolName || "").trim();
  const name = resolveOrbitXToolName(rawName) || TOOL_ALIASES[rawName] || rawName;
  if (!hasEmbeddedAgentTool(name)) {
    throw Object.assign(new Error(`Unknown OrbitX tool: ${rawName}`), { status: 400 });
  }

  const agent = await ensureAgent(uid);
  const authoritativeWallet = String(walletAddress || agent.wallet_address || "").trim() || null;
  const auth = {
    userId: uid,
    agentId: agent.id,
    walletAddress: authoritativeWallet,
    agentName: agent.name || null,
    email: String(email || "").trim() || null,
    source: "orbitx_ai",
    bearerPresent: true,
  };
  const base = publicBase(req);

  const mintArg = String(args?.mint || args?.ca || "").trim();
  const isOrbitxBuy =
    name === "orbitx_buy_orbitx" ||
    name === "orbitx_confirm_buy" ||
    name === "orbitx_trade_auto" ||
    name === "orbitx_credits_buy" ||
    ((name === "orbitx_prepare_buy" || name === "orbitx_buy" || name === "orbitx_trade" || name === "orbitx_swap") &&
      (mintArg === ORBITX_MINT || !mintArg));
  if (!isOrbitxBuy && (isHoldGatedTool(name) || isHoldGatedTool(rawName))) {
    const candidates = holdCandidateWallets(auth);
    const access = await requireMcpAccess({
      userId: uid,
      wallets: candidates,
      email: auth.email,
      base,
      tool: name,
    });
    if (!access.allowed) {
      return access.blocked || holdBlockedPayload({ tool: name, hold: access.hold });
    }
  }

  return callTool(name, args || {}, auth, base, req);
}

/**
 * Telegram MCP bridge — dashboard-auth (bot owner userId), no auth-link tools.
 * Used by /api/telegram-mcp. Trading / auth tools must be filtered by caller allowlist.
 */
export async function runTelegramAgentTool(userId, toolName, args = {}, req = null) {
  const uid = String(userId || "").trim();
  if (!uid) throw Object.assign(new Error("user_required"), { status: 401 });
  const agent = await ensureAgent(uid);
  const auth = await withAuthEmail({
    userId: uid,
    agentId: agent.id,
    walletAddress: agent.wallet_address || null,
    agentName: agent.name || null,
    source: "telegram",
    bearerPresent: false,
  });
  const base = publicBase(req);
  const rawName = String(toolName || "").trim();
  const name = resolveOrbitXToolName(rawName) || TOOL_ALIASES[rawName] || rawName;
  if (isHoldGatedTool(name) || isHoldGatedTool(rawName)) {
    const access = await requireMcpAccess({
      userId: uid,
      wallets: holdCandidateWallets(auth),
      email: auth.email,
      base,
      tool: name,
    });
    if (!access.allowed) {
      return access.blocked || holdBlockedPayload({ tool: name, hold: access.hold });
    }
  }
  return callTool(name, args || {}, auth, base, req);
}

export function listTelegramAgentCoreTools() {
  return CORE_TOOLS.map((t) => ({ name: t.name, description: t.description }));
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }

  const parts = pathParts(req);
  const head = parts[0] || "";

  try {
    if (head === "shop") {
      const { handleDeskShop } = await import("./orbitx/desk-shop.js");
      return handleDeskShop(req, res, parts, json);
    }
    if (head === "agent") return await handleAgent(req, res, parts.slice(1));
    if (head === "mcp") return await handleMcp(req, res, parts.slice(1));
    if (head === "crypto-scan") return await handleCryptoScan(req, res);
    if (head === "anti-vamp-check") {
      // Real checker: api/orbitx/_anti-vamp-check.ts (shared with orbitx-anti-vamp-check.ts).
      // Prefer the top-level entry so Vercel can bundle TS cleanly from this JS hub.
      const mod = await import("./orbitx-anti-vamp-check.ts");
      return mod.default(req, res);
    }
    if (head === "health" || head === "") {
      return json(res, {
        ok: true,
        service: "orbitx",
        routes: ["agent", "mcp", "shop", "crypto-scan", "anti-vamp-check", "telegram-mcp"],
        agent: "/api/orbitx-agent",
        mcp: "/api/orbitx-mcp",
        antiVamp: "/api/orbitx/anti-vamp-check",
      });
    }
    return json(res, { ok: false, error: "unknown_orbitx_route", route: head }, 404);
  } catch (e) {
    return json(res, { error: e?.message || "Internal error" }, e?.status && e.status < 600 ? e.status : 500);
  }
}

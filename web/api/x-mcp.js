/**
 * OrbitX X MCP — separate connector for posting to X (Twitter) from Claude / ChatGPT.
 *
 * Public URL (must end in /mcp for Claude):
 *   https://www.orbitx.world/api/x/mcp
 *
 * Env (Vercel):
 *   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
 *   TWITTER_CLIENT_ID, TWITTER_CLIENT_SECRET  (OAuth2 refresh)
 *   Optional media: TWITTER_CONSUMER_KEY, TWITTER_CONSUMER_SECRET,
 *                   TWITTER_ACCESS_TOKEN, TWITTER_ACCESS_TOKEN_SECRET
 */
import { createHash, createHmac, randomBytes } from "crypto";

export const config = { maxDuration: 60 };

const SUPA_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const ANON = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
const SRK = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const TWITTER_CLIENT_ID =
  process.env.TWITTER_CLIENT_ID || process.env.VITE_TWITTER_CLIENT_ID || "";
const TWITTER_CLIENT_SECRET = process.env.TWITTER_CLIENT_SECRET || "";
const TWITTER_CONSUMER_KEY = process.env.TWITTER_CONSUMER_KEY || "";
const TWITTER_CONSUMER_SECRET = process.env.TWITTER_CONSUMER_SECRET || "";
const TWITTER_ACCESS_TOKEN = process.env.TWITTER_ACCESS_TOKEN || "";
const TWITTER_ACCESS_TOKEN_SECRET = process.env.TWITTER_ACCESS_TOKEN_SECRET || "";

const MCP_HOST = "https://www.orbitx.world";
const MCP_URL = `${MCP_HOST}/api/x/mcp`;
const AUTH_PAGE = `${MCP_HOST}/x/mcp-auth`;
const CLIENT_ID = "orbitx-x-mcp";
const SCOPE = "x-post";

const TOOLS = [
  {
    name: "x_post",
    description:
      "Post a tweet on the authenticated user's X account. Requires Bearer key from https://orbitx.world/x and an X account connected on that page. Max ~280 chars (links count ~23).",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string", description: "Tweet body (required)" },
        linkUrl: { type: "string", description: "Optional URL appended to the tweet" },
        imageUrl: {
          type: "string",
          description: "Optional image URL to attach (needs app media credentials on server)",
        },
        replyToTweetId: {
          type: "string",
          description: "Optional tweet id to reply to",
        },
      },
      required: ["text"],
    },
  },
  {
    name: "x_connection_status",
    description:
      "Check whether the authenticated MCP user has an X account linked on OrbitX (/x).",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "x_help",
    description: "How to connect OrbitX X MCP to Claude or ChatGPT and post tweets.",
    inputSchema: { type: "object", properties: {} },
  },
];

function header(req, name) {
  const key = name.toLowerCase();
  const h = req.headers || {};
  return h[key] || h[name] || "";
}

function cors(res, methods = "GET,POST,DELETE,OPTIONS") {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", methods);
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Authorization, Content-Type, Accept, Mcp-Session-Id, x-orbitx-api-key",
  );
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
  const after = raw.split("/api/x-mcp")[1] || raw.split("/x-mcp")[1] || "";
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
  if (!String(auth).startsWith("Bearer ") || !SUPA_URL || !ANON) return null;
  const r = await fetch(`${SUPA_URL}/auth/v1/user`, {
    headers: { Authorization: auth, apikey: ANON },
  });
  if (!r.ok) return null;
  const u = await r.json();
  if (!u?.id) return null;
  return { id: u.id, email: u.email || null };
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
      name: "X MCP",
      description: "OrbitX X posting agent",
      status: "active",
    }),
  });
  return Array.isArray(created) ? created[0] : created;
}

function mapKey(row) {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at || null,
  };
}

function extractBearerToken(req) {
  const raw = String(header(req, "authorization") || header(req, "x-orbitx-api-key") || "").trim();
  if (!raw) return { token: null, bearerPresent: false };
  let token = raw;
  if (/^bearer\s+/i.test(token)) token = token.replace(/^bearer\s+/i, "").trim();
  if (/^bearer\s+/i.test(token)) token = token.replace(/^bearer\s+/i, "").trim();
  if (!token) return { token: null, bearerPresent: true };
  return { token, bearerPresent: true };
}

async function resolveAuth(req) {
  const { token, bearerPresent } = extractBearerToken(req);
  if (!token) return null;
  const hash = sha256(token);

  if (token.startsWith("oxk_") || token.startsWith("oxo_") || token.startsWith("oxc_") || token.startsWith("oxx_")) {
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

async function getXProfile(userId) {
  const rows = await sb(
    `profiles?user_id=eq.${encodeURIComponent(userId)}&select=twitter_access_token,twitter_refresh_token,twitter_token_expires_at,twitter_id,twitter_username,twitter_name,twitter_avatar,username&limit=1`,
  );
  return Array.isArray(rows) ? rows[0] : null;
}

async function refreshOAuth2Token(refreshToken) {
  if (!TWITTER_CLIENT_ID || !TWITTER_CLIENT_SECRET) return null;
  const basic = Buffer.from(`${TWITTER_CLIENT_ID}:${TWITTER_CLIENT_SECRET}`).toString("base64");
  const res = await fetch("https://api.twitter.com/2/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basic}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: TWITTER_CLIENT_ID,
    }),
  });
  if (!res.ok) return null;
  return res.json();
}

async function resolveUserAccessToken(userId) {
  const profile = await getXProfile(userId);
  if (!profile?.twitter_access_token) {
    return {
      ok: false,
      error: "x_not_connected",
      message: "X account not connected. Open https://orbitx.world/x and Connect X, then retry.",
      fixUrl: "https://orbitx.world/x",
      profile: null,
    };
  }

  let accessToken = profile.twitter_access_token;
  const expiresAt = profile.twitter_token_expires_at;
  if (expiresAt && new Date(expiresAt) < new Date()) {
    const refreshToken = profile.twitter_refresh_token;
    if (!refreshToken) {
      return {
        ok: false,
        error: "x_token_expired",
        message: "X token expired. Reconnect X on https://orbitx.world/x",
        fixUrl: "https://orbitx.world/x",
        profile,
      };
    }
    const refreshed = await refreshOAuth2Token(refreshToken);
    if (!refreshed?.access_token) {
      return {
        ok: false,
        error: "x_refresh_failed",
        message:
          "Could not refresh X token. Check TWITTER_CLIENT_ID / TWITTER_CLIENT_SECRET on Vercel, then reconnect on /x.",
        fixUrl: "https://orbitx.world/x",
        profile,
      };
    }
    accessToken = refreshed.access_token;
    await sb(`profiles?user_id=eq.${encodeURIComponent(userId)}`, {
      method: "PATCH",
      body: JSON.stringify({
        twitter_access_token: refreshed.access_token,
        twitter_refresh_token: refreshed.refresh_token ?? refreshToken,
        twitter_token_expires_at: new Date(
          Date.now() + (refreshed.expires_in || 7200) * 1000,
        ).toISOString(),
      }),
      headers: { Prefer: "return=minimal" },
    });
  }

  return { ok: true, accessToken, profile };
}

async function uploadImageOAuth1a(imageUrl) {
  if (
    !TWITTER_CONSUMER_KEY ||
    !TWITTER_CONSUMER_SECRET ||
    !TWITTER_ACCESS_TOKEN ||
    !TWITTER_ACCESS_TOKEN_SECRET
  ) {
    throw new Error("Media upload not configured (TWITTER_CONSUMER_* / TWITTER_ACCESS_TOKEN* on Vercel)");
  }
  const imgRes = await fetch(imageUrl);
  if (!imgRes.ok) throw new Error(`Could not fetch image: ${imgRes.status}`);
  const imgBuffer = Buffer.from(await imgRes.arrayBuffer());
  if (imgBuffer.byteLength > 5 * 1024 * 1024) throw new Error("Image exceeds 5MB Twitter limit");

  const url = "https://upload.twitter.com/1.1/media/upload.json";
  const boundary = `----ox${randomBytes(8).toString("hex")}`;
  const contentType = imgRes.headers.get("content-type") || "image/jpeg";
  const preamble = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="media"; filename="media"\r\nContent-Type: ${contentType}\r\n\r\n`,
  );
  const mid = Buffer.from(
    `\r\n--${boundary}\r\nContent-Disposition: form-data; name="media_category"\r\n\r\ntweet_image\r\n--${boundary}--\r\n`,
  );
  const body = Buffer.concat([preamble, imgBuffer, mid]);

  const oauthParams = {
    oauth_consumer_key: TWITTER_CONSUMER_KEY,
    oauth_nonce: randomBytes(16).toString("hex"),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: TWITTER_ACCESS_TOKEN,
    oauth_version: "1.0",
  };
  const sorted = Object.entries(oauthParams)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");
  const base = `POST&${encodeURIComponent(url)}&${encodeURIComponent(sorted)}`;
  const signingKey = `${encodeURIComponent(TWITTER_CONSUMER_SECRET)}&${encodeURIComponent(TWITTER_ACCESS_TOKEN_SECRET)}`;
  oauthParams.oauth_signature = createHmac("sha1", signingKey).update(base).digest("base64");
  const authHeader =
    "OAuth " +
    Object.entries(oauthParams)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${encodeURIComponent(k)}="${encodeURIComponent(v)}"`)
      .join(", ");

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: authHeader,
      "Content-Type": `multipart/form-data; boundary=${boundary}`,
      "Content-Length": String(body.length),
    },
    body,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Media upload failed: ${err.slice(0, 200)}`);
  }
  const data = await res.json();
  const mediaId = data?.media_id_string;
  if (!mediaId) throw new Error("No media_id from Twitter");
  return mediaId;
}

async function postTweetOAuth2(accessToken, text, mediaId, replyToTweetId) {
  const body = { text };
  if (mediaId) body.media = { media_ids: [mediaId] };
  if (replyToTweetId) body.reply = { in_reply_to_tweet_id: String(replyToTweetId) };

  const res = await fetch("https://api.twitter.com/2/tweets", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = err?.detail || err?.title || JSON.stringify(err);
    throw new Error(`Twitter API: ${msg}`);
  }
  const data = await res.json();
  const tweetId = data?.data?.id || null;
  return {
    ok: true,
    tweetId,
    tweetUrl: tweetId ? `https://x.com/i/web/status/${tweetId}` : null,
  };
}

function buildTweetText(rawText, linkUrl) {
  const text = String(rawText || "").trim();
  if (!text) throw new Error("text required");
  const links = [];
  if (linkUrl) links.push(String(linkUrl).trim());
  const reserved = links.length * 24 + (links.length ? links.length : 0);
  const maxBody = Math.max(50, 280 - reserved);
  let out = text.slice(0, maxBody);
  if (links.length) out = `${out}\n${links.join("\n")}`;
  return out;
}

async function callTool(name, args, auth) {
  if (name === "x_help") {
    return {
      ok: true,
      mcpUrl: MCP_URL,
      setupUrl: "https://orbitx.world/x",
      clientId: CLIENT_ID,
      scope: SCOPE,
      tools: TOOLS.map((t) => t.name),
      steps: [
        "Open https://orbitx.world/x and sign in",
        "Connect your X account (tweet.write)",
        "Create an API key, then Add to Claude or ChatGPT",
        "Authenticate → approve on /x/mcp-auth",
        "Ask the AI to call x_post with your tweet text",
      ],
      note: "Separate from OrbitX Agent MCP (/api/mcp). This connector only posts to X.",
    };
  }

  if (!auth?.userId) {
    return {
      ok: false,
      error: "session_required",
      message:
        "Authenticate the OrbitX X MCP connector, or set Authorization: Bearer <key from https://orbitx.world/x>.",
      fixUrl: "https://orbitx.world/x",
    };
  }

  if (name === "x_connection_status") {
    const profile = await getXProfile(auth.userId);
    const connected = Boolean(profile?.twitter_access_token);
    return {
      ok: true,
      connected,
      username: profile?.twitter_username || null,
      twitterId: profile?.twitter_id || null,
      displayName: profile?.twitter_name || null,
      avatar: profile?.twitter_avatar || null,
      fixUrl: connected ? null : "https://orbitx.world/x",
      message: connected
        ? `Connected as @${profile.twitter_username || "user"}`
        : "X not connected — open /x and Connect X",
    };
  }

  if (name === "x_post") {
    const resolved = await resolveUserAccessToken(auth.userId);
    if (!resolved.ok) return resolved;

    const tweetText = buildTweetText(args.text, args.linkUrl);
    let mediaId = null;
    if (args.imageUrl) {
      try {
        mediaId = await uploadImageOAuth1a(String(args.imageUrl));
      } catch (e) {
        return {
          ok: false,
          error: "media_upload_failed",
          message: e?.message || "Image upload failed",
          hint: "Post without imageUrl, or set TWITTER_CONSUMER_* + TWITTER_ACCESS_TOKEN* on Vercel.",
        };
      }
    }

    const posted = await postTweetOAuth2(
      resolved.accessToken,
      tweetText,
      mediaId,
      args.replyToTweetId || null,
    );
    return {
      ...posted,
      username: resolved.profile?.twitter_username || null,
      text: tweetText,
    };
  }

  throw new Error(`Unknown tool: ${name}`);
}

async function handleAgent(req, res, parts) {
  const route = parts.slice(1).join("/");

  if ((!route || route === "" || route === "bootstrap") && req.method === "POST") {
    const user = await getAuthUser(req);
    if (!user?.id) return json(res, { error: "unauthorized" }, 401);
    const agent = await ensureAgent(user.id);
    const keys = await sb(
      `agent_api_keys?agent_id=eq.${encodeURIComponent(agent.id)}&revoked_at=is.null&order=created_at.desc&select=id,agent_id,name,last_used_at,created_at`,
    );
    const profile = await getXProfile(user.id).catch(() => null);
    return json(res, {
      agent: {
        id: agent.id,
        name: agent.name,
        walletAddress: agent.wallet_address || null,
        phantomConnected: Boolean(agent.phantom_connected),
      },
      keys: (Array.isArray(keys) ? keys : []).map(mapKey),
      mintedKey: null,
      mcpUrl: MCP_URL,
      x: {
        connected: Boolean(profile?.twitter_access_token),
        username: profile?.twitter_username || null,
        twitterId: profile?.twitter_id || null,
        displayName: profile?.twitter_name || null,
        avatar: profile?.twitter_avatar || null,
      },
    });
  }

  if (route === "status" && req.method === "GET") {
    const user = await getAuthUser(req);
    if (!user?.id) return json(res, { error: "unauthorized" }, 401);
    const profile = await getXProfile(user.id).catch(() => null);
    return json(res, {
      connected: Boolean(profile?.twitter_access_token),
      username: profile?.twitter_username || null,
      twitterId: profile?.twitter_id || null,
      displayName: profile?.twitter_name || null,
      avatar: profile?.twitter_avatar || null,
      mcpUrl: MCP_URL,
    });
  }

  if (route === "keys" && req.method === "GET") {
    const user = await getAuthUser(req);
    if (!user?.id) return json(res, { error: "unauthorized" }, 401);
    const agent = await ensureAgent(user.id);
    const keys = await sb(
      `agent_api_keys?agent_id=eq.${encodeURIComponent(agent.id)}&revoked_at=is.null&order=created_at.desc&select=id,agent_id,name,last_used_at,created_at`,
    );
    return json(res, { agentId: agent.id, keys: (Array.isArray(keys) ? keys : []).map(mapKey) });
  }

  if (route === "keys" && req.method === "POST") {
    const user = await getAuthUser(req);
    if (!user?.id) return json(res, { error: "unauthorized" }, 401);
    const body = await readBody(req);
    const agent = await ensureAgent(user.id);
    const key = opaque("oxx");
    const rows = await sb("agent_api_keys", {
      method: "POST",
      body: JSON.stringify({
        agent_id: agent.id,
        name: String(body.name || "X MCP Key").slice(0, 80),
        key_hash: sha256(key),
      }),
    });
    const row = Array.isArray(rows) ? rows[0] : rows;
    return json(res, { id: row.id, name: row.name, key });
  }

  if (route.startsWith("keys/") && req.method === "DELETE") {
    const user = await getAuthUser(req);
    if (!user?.id) return json(res, { error: "unauthorized" }, 401);
    const keyId = route.slice("keys/".length);
    const agent = await ensureAgent(user.id);
    const keys = await sb(
      `agent_api_keys?id=eq.${encodeURIComponent(keyId)}&agent_id=eq.${encodeURIComponent(agent.id)}&select=id`,
    );
    if (!Array.isArray(keys) || !keys[0]) return json(res, { error: "not_found" }, 404);
    await sb(`agent_api_keys?id=eq.${encodeURIComponent(keyId)}`, {
      method: "PATCH",
      body: JSON.stringify({ revoked_at: new Date().toISOString() }),
      headers: { Prefer: "return=minimal" },
    });
    return json(res, { ok: true });
  }

  if (route === "oauth/approve" && req.method === "POST") {
    const authUser = await getAuthUser(req);
    if (!authUser?.id) return json(res, { error: "unauthorized" }, 401);
    const body = await readBody(req);
    const redirectUri = String(body.redirect_uri || "").trim();
    const state = body.state != null ? String(body.state) : "";
    if (!redirectUri) return json(res, { error: "redirect_uri required" }, 400);

    const agent = await ensureAgent(authUser.id);
    const access = opaque("oxx");
    await sb("agent_api_keys", {
      method: "POST",
      body: JSON.stringify({
        agent_id: agent.id,
        name: `X MCP ${String(body.client_id || "claude").slice(0, 24)} ${new Date().toISOString().slice(0, 16)}`,
        key_hash: sha256(access),
      }),
      headers: { Prefer: "return=minimal" },
    });

    try {
      await sb("agent_mcp_oauth_tokens", {
        method: "POST",
        body: JSON.stringify({
          token_hash: sha256(access),
          user_id: authUser.id,
          agent_id: agent.id,
          wallet_address: agent.wallet_address,
          expires_at: new Date(Date.now() + 30 * 86400 * 1000).toISOString(),
        }),
        headers: { Prefer: "return=minimal" },
      });
    } catch {
      /* optional */
    }

    const sep = redirectUri.includes("?") ? "&" : "?";
    return json(res, {
      redirect: `${redirectUri}${sep}code=${encodeURIComponent(access)}&state=${encodeURIComponent(state)}`,
    });
  }

  // X account OAuth2 PKCE code exchange — uses Vercel TWITTER_* env (not Supabase secrets).
  if (route === "oauth/callback" && req.method === "POST") {
    const body = await readBody(req);
    const code = String(body.code || "").trim();
    const verifier = String(body.verifier || "").trim();
    const redirectUri = String(body.redirectUri || body.redirect_uri || "").trim();
    if (!code || !verifier || !redirectUri) {
      return json(res, { error: "Missing code, verifier, or redirectUri" }, 400);
    }
    if (!TWITTER_CLIENT_ID || !TWITTER_CLIENT_SECRET) {
      return json(
        res,
        {
          error:
            "TWITTER_CLIENT_ID / TWITTER_CLIENT_SECRET missing on Vercel. Add both, redeploy, then Connect X again.",
        },
        503,
      );
    }

    const basic = Buffer.from(`${TWITTER_CLIENT_ID}:${TWITTER_CLIENT_SECRET}`).toString("base64");
    const tokenRes = await fetch("https://api.twitter.com/2/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${basic}`,
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        code_verifier: verifier,
        client_id: TWITTER_CLIENT_ID,
      }),
    });
    if (!tokenRes.ok) {
      const err = await tokenRes.json().catch(() => ({}));
      return json(
        res,
        {
          error: "Token exchange failed",
          details: err,
          hint: "Check X app callback URL is exactly https://www.orbitx.world/x-callback and Client ID/Secret match Vercel.",
        },
        502,
      );
    }
    const tokens = await tokenRes.json();
    const access_token = tokens.access_token;
    const refresh_token = tokens.refresh_token ?? null;
    const expires_in = tokens.expires_in ?? 7200;

    let twitterId = "";
    let twitterUsername = "";
    let twitterName = "";
    let twitterAvatar = "";
    try {
      const userRes = await fetch(
        "https://api.twitter.com/2/users/me?user.fields=profile_image_url,name,username",
        { headers: { Authorization: `Bearer ${access_token}` } },
      );
      if (userRes.ok) {
        const ud = await userRes.json();
        twitterId = ud.data?.id ?? "";
        twitterUsername = ud.data?.username ?? "";
        twitterName = ud.data?.name ?? "";
        twitterAvatar = String(ud.data?.profile_image_url || "").replace("_normal", "");
      }
    } catch {
      /* optional */
    }

    const authUser = await getAuthUser(req);
    if (authUser?.id) {
      const expiresAt = new Date(Date.now() + expires_in * 1000).toISOString();
      const patch = {
        twitter_access_token: access_token,
        twitter_refresh_token: refresh_token,
        twitter_token_expires_at: expiresAt,
        twitter_id: twitterId || null,
        twitter_username: twitterUsername || null,
        twitter_name: twitterName || null,
        twitter_avatar: twitterAvatar || null,
      };
      try {
        await sb(`profiles?user_id=eq.${encodeURIComponent(authUser.id)}`, {
          method: "PATCH",
          body: JSON.stringify(patch),
          headers: { Prefer: "return=minimal" },
        });
      } catch {
        // Retry without optional columns some schemas lack
        await sb(`profiles?user_id=eq.${encodeURIComponent(authUser.id)}`, {
          method: "PATCH",
          body: JSON.stringify({
            twitter_access_token: access_token,
            twitter_refresh_token: refresh_token,
            twitter_token_expires_at: expiresAt,
            twitter_id: twitterId || null,
            twitter_username: twitterUsername || null,
          }),
          headers: { Prefer: "return=minimal" },
        });
      }
    }

    return json(res, {
      access_token,
      refresh_token,
      expires_in,
      twitter_id: twitterId,
      twitter_username: twitterUsername,
      twitter_name: twitterName,
      twitter_avatar: twitterAvatar,
      saved: Boolean(authUser?.id),
    });
  }

  return json(res, { error: "not_found", route }, 404);
}

async function handleMcp(req, res, parts) {
  const route = parts.slice(1).join("/");

  if (
    (route === ".well-known/oauth-protected-resource" || route === "oauth-protected-resource") &&
    req.method === "GET"
  ) {
    return json(res, {
      resource: MCP_URL,
      authorization_servers: [MCP_HOST],
      scopes_supported: [SCOPE],
      bearer_methods_supported: ["header"],
    });
  }

  if (
    (route === ".well-known/oauth-authorization-server" || route === "oauth-authorization-server") &&
    req.method === "GET"
  ) {
    return json(res, {
      issuer: MCP_HOST,
      authorization_endpoint: `${MCP_URL}/oauth/authorize`,
      token_endpoint: `${MCP_URL}/oauth/token`,
      registration_endpoint: `${MCP_URL}/oauth/register`,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code"],
      code_challenge_methods_supported: ["S256", "plain"],
      token_endpoint_auth_methods_supported: ["none"],
      scopes_supported: [SCOPE],
      client_id_metadata_document_supported: true,
    });
  }

  if (route === "oauth/register" && req.method === "POST") {
    const body = await readBody(req);
    const clientId =
      typeof body.client_id === "string" && body.client_id.startsWith("https://")
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
        client_name: body.client_name || "X MCP Connector",
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
    params.set("mcp_url", MCP_URL);
    cors(res);
    res.writeHead(302, { Location: `${AUTH_PAGE}?${params.toString()}` });
    return res.end();
  }

  if (route === "oauth/token" && req.method === "POST") {
    const body = await readBody(req);
    const code = body.code;
    if (!code) return json(res, { error: "invalid_request", error_description: "code required" }, 400);

    if (
      String(code).startsWith("oxo_") ||
      String(code).startsWith("oxk_") ||
      String(code).startsWith("oxx_")
    ) {
      return json(res, {
        access_token: code,
        token_type: "bearer",
        expires_in: 86400 * 30,
        scope: SCOPE,
      });
    }

    return json(res, { error: "invalid_grant" }, 400);
  }

  if ((!route || route === "") && req.method === "GET") {
    const accept = String(header(req, "accept") || "");
    if (accept.includes("text/event-stream")) {
      cors(res);
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "Access-Control-Allow-Origin": "*",
      });
      res.write(": orbitx-x-mcp connected\n\n");
      return res.end();
    }
    return json(res, {
      ok: true,
      name: "OrbitX X MCP",
      mcp_url: MCP_URL,
      setup: "https://orbitx.world/x",
      auth: {
        type: "oauth2",
        client_id: CLIENT_ID,
        client_secret: null,
        client_secret_note: "Leave blank — public PKCE client",
        authorization_endpoint: `${MCP_URL}/oauth/authorize`,
        token_endpoint: `${MCP_URL}/oauth/token`,
        registration_endpoint: `${MCP_URL}/oauth/register`,
        scope: SCOPE,
        token_endpoint_auth_method: "none",
      },
      tools: TOOLS.map((t) => ({ name: t.name, description: t.description })),
      note: "Separate from OrbitX Agent MCP. Posts to the user's linked X account.",
    });
  }

  if ((!route || route === "") && req.method === "POST") {
    const body = await readBody(req);
    const { id, method, params } = body;
    const sessionId = header(req, "mcp-session-id") || opaque("sess").slice(0, 24);

    if (method === "initialize") {
      return json(
        res,
        {
          jsonrpc: "2.0",
          id,
          result: {
            protocolVersion: "2024-11-05",
            capabilities: { tools: {} },
            serverInfo: { name: "OrbitX X MCP", version: "1.0.0" },
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
      return json(res, {
        jsonrpc: "2.0",
        id,
        result: {
          tools: TOOLS.map((t) => ({
            name: t.name,
            description: t.description,
            inputSchema: t.inputSchema,
          })),
        },
      });
    }

    if (method === "tools/call") {
      const name = String(params?.name || "");
      const args = params?.arguments || {};
      const auth = await resolveAuth(req);

      try {
        const result = await callTool(name, args, auth || { userId: null });
        const isError = result && result.ok === false;
        return json(res, {
          jsonrpc: "2.0",
          id,
          result: {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
            structuredContent: result,
            ...(isError ? { isError: true } : {}),
          },
        });
      } catch (e) {
        const tip = {
          ok: false,
          error: "tool_error",
          tool: name,
          message: e?.message || "tool error",
          fixUrl: "https://orbitx.world/x",
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
    }

    return json(res, {
      jsonrpc: "2.0",
      id: id ?? null,
      error: { code: -32601, message: `Method not found: ${method}` },
    });
  }

  return json(res, { error: "not_found", route }, 404);
}

export default async function handler(req, res) {
  try {
    if (req.method === "OPTIONS") {
      cors(res);
      res.statusCode = 204;
      return res.end();
    }

    const parts = pathParts(req);
    // Normalize: rewrite may pass path=mcp/... or path=agent/...
    const head = parts[0];
    if (head === "agent") return handleAgent(req, res, parts);
    if (head === "mcp" || !head) return handleMcp(req, res, head === "mcp" ? parts : ["mcp", ...parts]);
    return json(res, { error: "not_found", path: parts }, 404);
  } catch (e) {
    console.error("[x-mcp]", e);
    return json(res, { error: e?.message || "internal_error" }, 500);
  }
}

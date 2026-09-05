/**
 * Persist X (Twitter) provider tokens from Supabase /auth OAuth onto profiles
 * so Agent MCP and X MCP can post as that user.
 */
const SUPA_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const ANON = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
const SRK = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

function json(res, data, status = 200) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(data));
}

async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body || "{}");
    } catch {
      return {};
    }
  }
  const chunks = [];
  for await (const c of req) chunks.push(typeof c === "string" ? Buffer.from(c) : c);
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  } catch {
    return {};
  }
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
    res.statusCode = 204;
    return res.end();
  }
  if (req.method !== "POST") return json(res, { error: "method_not_allowed" }, 405);
  const auth = String(req.headers?.authorization || req.headers?.Authorization || "");
  if (!auth.startsWith("Bearer ") || !SUPA_URL || !ANON || !SRK) {
    return json(res, { ok: false, error: "unauthorized" }, 401);
  }
  const userRes = await fetch(`${SUPA_URL}/auth/v1/user`, {
    headers: { Authorization: auth, apikey: ANON },
  });
  if (!userRes.ok) return json(res, { ok: false, error: "unauthorized" }, 401);
  const user = await userRes.json();
  if (!user?.id) return json(res, { ok: false, error: "unauthorized" }, 401);

  const body = await readBody(req);
  const providerToken = String(body.provider_token || body.access_token || "").trim();
  const refresh = String(body.provider_refresh_token || body.refresh_token || "").trim() || null;
  if (!providerToken) {
    return json(res, { ok: false, error: "provider_token_required" }, 400);
  }

  let twitterId = "";
  let twitterUsername = "";
  let twitterName = "";
  try {
    const me = await fetch("https://api.twitter.com/2/users/me?user.fields=profile_image_url,name,username", {
      headers: { Authorization: `Bearer ${providerToken}` },
    });
    if (me.ok) {
      const ud = await me.json();
      twitterId = ud.data?.id || "";
      twitterUsername = ud.data?.username || "";
      twitterName = ud.data?.name || "";
    }
  } catch {
    /* optional */
  }

  const expiresIn = Number(body.expires_in) || 7200;
  const patch = {
    twitter_access_token: providerToken,
    twitter_refresh_token: refresh,
    twitter_token_expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
    twitter_id: twitterId || null,
    twitter_username: twitterUsername || null,
    twitter_name: twitterName || null,
    twitter_oauth_scopes: String(body.scope || "tweet.write tweet.read users.read offline.access"),
  };
  const r = await fetch(`${SUPA_URL}/rest/v1/profiles?user_id=eq.${encodeURIComponent(user.id)}`, {
    method: "PATCH",
    headers: {
      apikey: SRK,
      Authorization: `Bearer ${SRK}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(patch),
  });
  if (!r.ok) {
    const err = await r.text();
    return json(res, { ok: false, error: "profile_patch_failed", message: err.slice(0, 200) }, 500);
  }
  return json(res, {
    ok: true,
    username: twitterUsername || null,
    twitterId: twitterId || null,
    canPost: /\btweet\.write\b/.test(String(patch.twitter_oauth_scopes)),
  });
}

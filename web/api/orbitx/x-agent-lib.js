/**
 * X MCP Agent helpers — NVIDIA NIM, quote/DM, agent CRUD, queue, cron.
 * Used by web/api/x-mcp.js
 */

// Order matters for X OAuth — keep tweet.write early (same as the previously working set),
// then append DM scopes. Reconnect X after changing this string.
export const X_OAUTH_SCOPES =
  "tweet.write tweet.read users.read follows.read list.read offline.access dm.read dm.write like.read";

// Every id must exist in https://integrate.api.nvidia.com/v1/models — an id that
// NIM has retired makes chat fail for anyone who picks it in the model menu.
// Fast slot must be a model NVIDIA still lists (Meta Llama 3.1 8B EOL 2026-08-26;
// Llama 3.2 3B is not in the current integrate.api.nvidia.com catalog).
export const FAST_NIM_MODEL = "minimaxai/minimax-m3";
export const FALLBACK_NIM_MODEL = "meta/llama-3.3-70b-instruct";

/** Retired NIM ids → live replacements. Stored prefs / env still holding these must remap. */
export const RETIRED_NIM_MODELS = {
  "meta/llama-3.1-8b-instruct": FAST_NIM_MODEL,
  "meta/llama-3.2-3b-instruct": FAST_NIM_MODEL,
};

export const NIM_MODELS = [
  { id: FALLBACK_NIM_MODEL, label: "Llama 3.3 70B" },
  { id: FAST_NIM_MODEL, label: "MiniMax M3" },
  { id: "openai/gpt-oss-120b", label: "GPT-OSS 120B" },
  { id: "nvidia/llama-3.3-nemotron-super-49b-v1.5", label: "Nemotron Super 49B" },
  { id: "deepseek-ai/deepseek-v4-flash-0731", label: "DeepSeek V4 Flash" },
  { id: "mistralai/mistral-nemotron", label: "Mistral Nemotron" },
  { id: "moonshotai/kimi-k2.6", label: "Kimi K2" },
];

export function isRetiredNimError(status, body) {
  const code = Number(status);
  const text = String(body || "").toLowerCase();
  return (
    code === 410 ||
    text.includes("end of life") ||
    text.includes('"title":"gone"') ||
    text.includes("no longer available")
  );
}

export function isNvidiaRateLimit(status, body) {
  const code = Number(status);
  const text = String(body || "").toLowerCase();
  return (
    code === 429 ||
    text.includes("too many requests") ||
    text.includes("rate limit") ||
    text.includes("rate_limit")
  );
}

export const NVIDIA_BUSY_MESSAGE =
  "OrbitX AI is busy right now. Wait a few seconds and send that again. Slash commands still work: /cmds /token /chart /img.";

export function publicNvidiaMessage(result) {
  if (result?.ok) return result.content || "";
  if (result?.error === "nvidia_missing") {
    return result.message || "OrbitX AI is offline (NVIDIA_API_KEY). Slash commands still work: /cmds /token /chart /img /check /links.";
  }
  if (isNvidiaRateLimit(result?.status, result?.body || result?.message)) {
    return NVIDIA_BUSY_MESSAGE;
  }
  return "OrbitX AI is offline right now. Slash commands still work: /cmds /token /chart /img /check /links.";
}

function parseRetryAfterMs(res, body) {
  const header = String(res?.headers?.get?.("retry-after") || res?.headers?.get?.("Retry-After") || "").trim();
  if (header === "0") return 0;
  if (header) {
    const seconds = Number(header);
    if (Number.isFinite(seconds) && seconds >= 0) {
      return Math.min(8_000, Math.max(400, Math.round(seconds * 1000)));
    }
    const when = Date.parse(header);
    if (Number.isFinite(when)) {
      return Math.min(8_000, Math.max(400, when - Date.now()));
    }
  }
  const blob = String(body || "");
  const retry = blob.match(/retry[-_ ]after["']?\s*[:=]\s*["']?(\d+)/i);
  if (retry) {
    const seconds = Number(retry[1]);
    if (Number.isFinite(seconds)) return Math.min(8_000, Math.max(400, seconds * 1000));
  }
  return 1_200;
}

function sleep(ms) {
  const wait = Number(ms);
  if (!Number.isFinite(wait) || wait <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, wait));
}

function nvidiaFallbackModels(first) {
  const ordered = [
    first,
    FALLBACK_NIM_MODEL,
    "mistralai/mistral-nemotron",
    "openai/gpt-oss-120b",
    FAST_NIM_MODEL,
  ];
  const out = [];
  for (const id of ordered) {
    const live = resolveNimModel(id);
    if (live && !out.includes(live)) out.push(live);
  }
  return out;
}

let lastNvidiaCallAt = 0;
const NVIDIA_MIN_GAP_MS = 250;

async function waitNvidiaGap() {
  const wait = lastNvidiaCallAt + NVIDIA_MIN_GAP_MS - Date.now();
  if (wait > 0) await sleep(wait);
  lastNvidiaCallAt = Date.now();
}

function normalizeNimId(requested) {
  return String(requested || "")
    .trim()
    .replace(/^["']|["']$/g, "");
}

export function resolveNimModel(requested) {
  let id = normalizeNimId(requested);
  if (/llama-3\.1-8b/i.test(id) || /llama-3\.2-3b/i.test(id)) id = FAST_NIM_MODEL;
  if (RETIRED_NIM_MODELS[id]) id = RETIRED_NIM_MODELS[id];
  if (id && NIM_MODELS.some((m) => m.id === id)) return id;
  const envDefault = normalizeNimId(process.env.NVIDIA_MODEL);
  let remappedEnv = envDefault;
  if (/llama-3\.1-8b/i.test(remappedEnv) || /llama-3\.2-3b/i.test(remappedEnv)) {
    remappedEnv = FAST_NIM_MODEL;
  }
  remappedEnv = RETIRED_NIM_MODELS[remappedEnv] || remappedEnv;
  if (remappedEnv && NIM_MODELS.some((m) => m.id === remappedEnv)) return remappedEnv;
  return FALLBACK_NIM_MODEL;
}

export const DEFAULT_NIM_MODEL = resolveNimModel(
  process.env.NVIDIA_MODEL || FALLBACK_NIM_MODEL,
);

const NVIDIA_BASE =
  process.env.NVIDIA_BASE_URL || "https://integrate.api.nvidia.com/v1";

async function nvidiaChatOnce({ system, user, model, maxTokens, temperature, key }) {
  await waitNvidiaGap();
  const liveModel = resolveNimModel(model);
  const res = await fetch(`${NVIDIA_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: liveModel,
      messages: [
        ...(system ? [{ role: "system", content: system }] : []),
        { role: "user", content: user },
      ],
      temperature,
      top_p: 0.95,
      max_tokens: maxTokens,
      stream: false,
    }),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => "");
    const failed = {
      ok: false,
      error: isNvidiaRateLimit(res.status, err) ? "nvidia_rate_limited" : "nvidia_failed",
      status: res.status,
      message: `NVIDIA API ${res.status}: ${err.slice(0, 240)}`,
      body: err,
      model: liveModel,
      retryAfterMs: parseRetryAfterMs(res, err),
    };
    return failed;
  }
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content || "";
  return { ok: true, content, model: liveModel, raw: data };
}

export async function nvidiaChat({ system, user, model, maxTokens = 512, temperature = 0.7 }) {
  const key = process.env.NVIDIA_API_KEY;
  if (!key) {
    return {
      ok: false,
      error: "nvidia_missing",
      message: "NVIDIA_API_KEY not set on Vercel. Add it and redeploy.",
    };
  }
  const requested = resolveNimModel(model);
  // At most two models (requested + one fallback) so a 429 storm cannot amplify itself.
  const chain = nvidiaFallbackModels(requested).slice(0, 2);
  let last = null;
  for (let i = 0; i < chain.length; i++) {
    const candidate = chain[i];
    const attempts = i === 0 ? 2 : 1;
    for (let attempt = 0; attempt < attempts; attempt++) {
      const result = await nvidiaChatOnce({
        system,
        user,
        model: candidate,
        maxTokens,
        temperature,
        key,
      });
      if (result.ok) return result;
      last = result;
      const retired = isRetiredNimError(result.status, result.body || result.message);
      const limited = isNvidiaRateLimit(result.status, result.body || result.message);
      if (limited && attempt < attempts - 1) {
        await sleep(result.retryAfterMs ?? 1_200);
        continue;
      }
      if (retired || limited) break;
      return { ...result, message: publicNvidiaMessage(result) };
    }
  }
  return {
    ...(last || { ok: false, error: "nvidia_failed", status: 502 }),
    message: publicNvidiaMessage(last),
  };
}

export function buildTweetText(rawText, linkUrl) {
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

export async function postTweetOAuth2(accessToken, opts) {
  const text = String(opts?.text || "").trim();
  if (!text) {
    return { ok: false, error: "text_required", message: "Tweet text is required" };
  }
  const mediaId = opts?.mediaId ? String(opts.mediaId) : "";
  const replyToTweetId = opts?.replyToTweetId ? String(opts.replyToTweetId).trim() : "";
  const quoteTweetId = opts?.quoteTweetId ? String(opts.quoteTweetId).trim() : "";

  const body = { text };
  if (mediaId) body.media = { media_ids: [mediaId] };
  if (replyToTweetId) body.reply = { in_reply_to_tweet_id: replyToTweetId };
  if (quoteTweetId) body.quote_tweet_id = quoteTweetId;

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
    const msg = err?.detail || err?.title || err?.errors?.[0]?.message || JSON.stringify(err);
    const status = res.status;
    const tip =
      status === 403
        ? "Reconnect X on /x (tweet.write must be granted). In X portal: App permissions = Read and write and Direct message."
        : status === 429
          ? "X rate limit / monthly post cap hit. Wait or upgrade X API tier."
          : null;
    return {
      ok: false,
      error: status === 403 ? "tweet_forbidden" : "tweet_failed",
      status,
      message: `Twitter API (${status}): ${msg}`,
      tip,
      details: err,
      fixUrl: "https://orbitx.world/x",
    };
  }
  const data = await res.json();
  const tweetId = data?.data?.id || null;
  return {
    ok: true,
    tweetId,
    tweetUrl: tweetId ? `https://x.com/i/web/status/${tweetId}` : null,
  };
}

const USER_FIELDS =
  "id,name,username,profile_image_url,description,created_at,public_metrics,verified,protected,url,location";

export async function lookupXUser(accessToken, username) {
  const u = String(username || "").replace(/^@/, "").trim();
  if (!u) throw new Error("username required");
  const res = await fetch(
    `https://api.twitter.com/2/users/by/username/${encodeURIComponent(u)}?user.fields=${USER_FIELDS}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.detail || err?.title || `User lookup failed (${res.status})`);
  }
  const data = await res.json();
  return mapXUser(data?.data) || data?.data || null;
}

function mapXUser(u) {
  if (!u) return null;
  const m = u.public_metrics || {};
  return {
    id: u.id,
    name: u.name || null,
    username: u.username || null,
    description: u.description || null,
    profileImageUrl: u.profile_image_url || null,
    createdAt: u.created_at || null,
    verified: Boolean(u.verified),
    protected: Boolean(u.protected),
    url: u.url || null,
    location: u.location || null,
    metrics: {
      followers: m.followers_count ?? null,
      following: m.following_count ?? null,
      tweetCount: m.tweet_count ?? null,
      listed: m.listed_count ?? null,
      likeCount: m.like_count ?? null,
    },
  };
}

function xApiError(res, err, code, tip) {
  const msg = err?.detail || err?.title || JSON.stringify(err);
  if (res.status === 403) {
    return {
      ok: false,
      error: code || "forbidden",
      status: 403,
      message: tip || `X rejected request (403): ${msg}`,
      details: err,
      fixUrl: "https://orbitx.world/x",
    };
  }
  if (res.status === 429) {
    return {
      ok: false,
      error: "rate_limited",
      status: 429,
      message: "X rate limit — wait and retry.",
      details: err,
    };
  }
  return {
    ok: false,
    error: code || "x_api_failed",
    status: res.status,
    message: msg,
    details: err,
  };
}

async function listUserGraph(accessToken, userId, edge, { maxResults = 20, paginationToken } = {}) {
  const uid = String(userId || "").trim();
  if (!uid) {
    return { ok: false, error: "user_id_required", message: "X user id required" };
  }
  const limit = Math.min(1000, Math.max(1, Number(maxResults) || 20));
  const params = new URLSearchParams({
    max_results: String(limit),
    "user.fields": USER_FIELDS,
  });
  if (paginationToken) params.set("pagination_token", String(paginationToken));
  const res = await fetch(
    `https://api.twitter.com/2/users/${encodeURIComponent(uid)}/${edge}?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    return xApiError(
      res,
      err,
      `${edge}_failed`,
      `X rejected ${edge} (403). Needs users.read + follows.read — Reconnect X on /x after updating scopes.`,
    );
  }
  const data = await res.json();
  const users = (Array.isArray(data?.data) ? data.data : []).map(mapXUser);
  return {
    ok: true,
    edge,
    users,
    nextToken: data?.meta?.next_token || null,
    resultCount: data?.meta?.result_count ?? users.length,
    meta: data?.meta || null,
  };
}

/** Followers of userId (newest-first on most X API tiers). */
export async function listFollowersOAuth2(accessToken, userId, opts = {}) {
  return listUserGraph(accessToken, userId, "followers", opts);
}

/** Accounts userId follows. */
export async function listFollowingOAuth2(accessToken, userId, opts = {}) {
  return listUserGraph(accessToken, userId, "following", opts);
}

export async function getTweetMetricsOAuth2(accessToken, tweetId) {
  const id = String(tweetId || "").trim();
  if (!id) return { ok: false, error: "tweet_id_required", message: "tweetId required" };
  const params = new URLSearchParams({
    "tweet.fields":
      "created_at,public_metrics,non_public_metrics,organic_metrics,author_id,conversation_id,lang,text",
    expansions: "author_id",
    "user.fields": "id,name,username",
  });
  const res = await fetch(`https://api.twitter.com/2/tweets/${encodeURIComponent(id)}?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    // Retry without elevated metrics fields
    if (res.status === 400 || res.status === 403) {
      const params2 = new URLSearchParams({
        "tweet.fields": "created_at,public_metrics,author_id,conversation_id,lang,text",
        expansions: "author_id",
        "user.fields": "id,name,username",
      });
      const res2 = await fetch(
        `https://api.twitter.com/2/tweets/${encodeURIComponent(id)}?${params2}`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      if (!res2.ok) {
        const err2 = await res2.json().catch(() => ({}));
        return xApiError(res2, err2, "tweet_metrics_failed");
      }
      const data2 = await res2.json();
      return formatTweetMetrics(data2);
    }
    return xApiError(res, err, "tweet_metrics_failed");
  }
  const data = await res.json();
  return formatTweetMetrics(data);
}

function formatTweetMetrics(data) {
  const t = data?.data;
  if (!t) return { ok: false, error: "not_found", message: "Tweet not found" };
  const pm = t.public_metrics || {};
  const npm = t.non_public_metrics || {};
  const om = t.organic_metrics || {};
  const author = (data?.includes?.users || []).find((u) => u.id === t.author_id) || null;
  return {
    ok: true,
    tweetId: t.id,
    text: t.text || "",
    createdAt: t.created_at || null,
    author: author ? { id: author.id, username: author.username, name: author.name } : null,
    metrics: {
      views: pm.impression_count ?? npm.impression_count ?? om.impression_count ?? null,
      likes: pm.like_count ?? null,
      retweets: pm.retweet_count ?? null,
      replies: pm.reply_count ?? null,
      quotes: pm.quote_count ?? null,
      bookmarks: pm.bookmark_count ?? null,
      urlClicks: npm.url_link_clicks ?? null,
      profileClicks: npm.user_profile_clicks ?? null,
    },
    note:
      pm.impression_count == null && npm.impression_count == null
        ? "Views/impressions often require elevated X API access on your own posts."
        : null,
  };
}

export async function listUserTweetsOAuth2(accessToken, userId, { maxResults = 10, paginationToken } = {}) {
  const uid = String(userId || "").trim();
  if (!uid) return { ok: false, error: "user_id_required", message: "userId required" };
  const limit = Math.min(100, Math.max(5, Number(maxResults) || 10));
  const params = new URLSearchParams({
    max_results: String(limit),
    "tweet.fields": "created_at,public_metrics,lang,text",
    exclude: "replies",
  });
  if (paginationToken) params.set("pagination_token", String(paginationToken));
  const res = await fetch(
    `https://api.twitter.com/2/users/${encodeURIComponent(uid)}/tweets?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    return xApiError(res, err, "user_tweets_failed");
  }
  const data = await res.json();
  const tweets = (Array.isArray(data?.data) ? data.data : []).map((t) => {
    const pm = t.public_metrics || {};
    return {
      id: t.id,
      text: t.text || "",
      createdAt: t.created_at || null,
      metrics: {
        views: pm.impression_count ?? null,
        likes: pm.like_count ?? null,
        retweets: pm.retweet_count ?? null,
        replies: pm.reply_count ?? null,
        quotes: pm.quote_count ?? null,
      },
    };
  });
  return {
    ok: true,
    tweets,
    nextToken: data?.meta?.next_token || null,
    meta: data?.meta || null,
  };
}

export async function listOwnedListsOAuth2(accessToken, userId, { maxResults = 20 } = {}) {
  const uid = String(userId || "").trim();
  if (!uid) return { ok: false, error: "user_id_required", message: "userId required" };
  const limit = Math.min(100, Math.max(1, Number(maxResults) || 20));
  const params = new URLSearchParams({
    max_results: String(limit),
    "list.fields": "created_at,follower_count,member_count,private,description,owner_id",
  });
  const [ownedRes, memberRes] = await Promise.all([
    fetch(`https://api.twitter.com/2/users/${encodeURIComponent(uid)}/owned_lists?${params}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
    fetch(
      `https://api.twitter.com/2/users/${encodeURIComponent(uid)}/list_memberships?${params}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    ),
  ]);
  const ownedErr = ownedRes.ok ? null : await ownedRes.json().catch(() => ({}));
  const memberErr = memberRes.ok ? null : await memberRes.json().catch(() => ({}));
  if (!ownedRes.ok && !memberRes.ok) {
    return xApiError(
      ownedRes,
      ownedErr,
      "lists_failed",
      "X rejected lists (403). Needs list.read — Reconnect X on /x after updating app scopes.",
    );
  }
  const ownedData = ownedRes.ok ? await ownedRes.json() : { data: [] };
  const memberData = memberRes.ok ? await memberRes.json() : { data: [] };
  const mapList = (l) => ({
    id: l.id,
    name: l.name,
    description: l.description || null,
    memberCount: l.member_count ?? null,
    followerCount: l.follower_count ?? null,
    private: Boolean(l.private),
    ownerId: l.owner_id || null,
  });
  return {
    ok: true,
    owned: (Array.isArray(ownedData?.data) ? ownedData.data : []).map(mapList),
    memberships: (Array.isArray(memberData?.data) ? memberData.data : []).map(mapList),
    tips: [
      !ownedRes.ok ? `owned_lists: ${ownedErr?.detail || ownedRes.status}` : null,
      !memberRes.ok ? `memberships: ${memberErr?.detail || memberRes.status}` : null,
    ].filter(Boolean),
  };
}

export async function listListMembersOAuth2(accessToken, listId, { maxResults = 20, paginationToken } = {}) {
  const lid = String(listId || "").trim();
  if (!lid) return { ok: false, error: "list_id_required", message: "listId required" };
  const limit = Math.min(100, Math.max(1, Number(maxResults) || 20));
  const params = new URLSearchParams({
    max_results: String(limit),
    "user.fields": USER_FIELDS,
  });
  if (paginationToken) params.set("pagination_token", String(paginationToken));
  const res = await fetch(
    `https://api.twitter.com/2/lists/${encodeURIComponent(lid)}/members?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    return xApiError(
      res,
      err,
      "list_members_failed",
      "Needs list.read — Reconnect X on /x.",
    );
  }
  const data = await res.json();
  return {
    ok: true,
    listId: lid,
    users: (Array.isArray(data?.data) ? data.data : []).map(mapXUser),
    nextToken: data?.meta?.next_token || null,
    meta: data?.meta || null,
  };
}

/** Lightweight PDF text scan — URL via Jina reader + raw PDF byte extract fallback. */
export async function scanPdfContent({ url, text, base64 } = {}) {
  const inline = String(text || "").trim();
  if (inline) {
    return summarizeExtractedText(inline, { source: "text" });
  }

  let bytes = null;
  const b64 = String(base64 || "").trim();
  if (b64) {
    try {
      bytes = Buffer.from(b64.replace(/^data:application\/pdf;base64,/i, ""), "base64");
    } catch {
      return { ok: false, error: "bad_base64", message: "Could not decode base64 PDF" };
    }
  }

  const srcUrl = String(url || "").trim();
  let jinaText = "";
  if (srcUrl) {
    try {
      const jina = await fetch(`https://r.jina.ai/${srcUrl}`, {
        headers: { Accept: "text/plain", "X-Return-Format": "text" },
        signal: AbortSignal.timeout(25000),
      });
      if (jina.ok) {
        jinaText = (await jina.text()).slice(0, 120_000);
      }
    } catch {
      /* fall through */
    }
    if (!bytes) {
      try {
        const res = await fetch(srcUrl, { signal: AbortSignal.timeout(20000) });
        if (res.ok) {
          const ct = String(res.headers.get("content-type") || "");
          const ab = await res.arrayBuffer();
          bytes = Buffer.from(ab);
          if (!jinaText && !/pdf/i.test(ct) && bytes.length < 500_000) {
            const asText = bytes.toString("utf8");
            if (/[\w\s]{40,}/.test(asText)) {
              return summarizeExtractedText(asText, { source: "url_text", url: srcUrl });
            }
          }
        }
      } catch {
        /* ignore */
      }
    }
  }

  if (jinaText && jinaText.length > 80) {
    return summarizeExtractedText(jinaText, { source: "jina", url: srcUrl || null });
  }

  if (bytes?.length) {
    const extracted = extractTextFromPdfBytes(bytes);
    if (extracted.length > 40) {
      return summarizeExtractedText(extracted, { source: "pdf_bytes", url: srcUrl || null });
    }
  }

  return {
    ok: false,
    error: "pdf_scan_failed",
    message:
      "Could not extract PDF text. Pass a public PDF url, pasted text, or base64. Some PDFs are image-only (OCR not available).",
    url: srcUrl || null,
  };
}

function extractTextFromPdfBytes(buf) {
  const s = buf.toString("latin1");
  const chunks = [];
  const paren = /\((?:\\.|[^\\)]){2,400}\)[\s]*Tj/g;
  let m;
  while ((m = paren.exec(s))) {
    const raw = m[0].slice(1, m[0].lastIndexOf(")"));
    const cleaned = raw
      .replace(/\\n/g, "\n")
      .replace(/\\r/g, "")
      .replace(/\\t/g, " ")
      .replace(/\\\(/g, "(")
      .replace(/\\\)/g, ")")
      .replace(/\\\\/g, "\\");
    if (/[A-Za-z0-9]/.test(cleaned)) chunks.push(cleaned);
  }
  const streams = s.match(/stream\r?\n([\s\S]{20,8000}?)\r?\nendstream/g) || [];
  for (const st of streams.slice(0, 40)) {
    const body = st.replace(/^stream\r?\n/, "").replace(/\r?\nendstream$/, "");
    const ascii = body.replace(/[^\x09\x0A\x0D\x20-\x7E]/g, " ");
    const words = ascii.match(/[A-Za-z][A-Za-z0-9 .,'%$-]{4,}/g);
    if (words?.length) chunks.push(words.join(" "));
  }
  return chunks.join("\n").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim().slice(0, 100_000);
}

function summarizeExtractedText(raw, meta = {}) {
  const text = String(raw || "").replace(/\r/g, "").trim();
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const words = text.split(/\s+/).filter(Boolean);
  const emails = [...new Set(text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [])].slice(0, 20);
  const urls = [...new Set(text.match(/https?:\/\/[^\s)>"']+/gi) || [])].slice(0, 30);
  const handles = [...new Set(text.match(/@[A-Za-z0-9_]{2,15}/g) || [])].slice(0, 40);
  const numbers = [...new Set(text.match(/\b\d{1,3}(?:,\d{3})+(?:\.\d+)?%?|\b\d+(?:\.\d+)?%\b/g) || [])].slice(
    0,
    30,
  );
  return {
    ok: true,
    ...meta,
    chars: text.length,
    words: words.length,
    lines: lines.length,
    preview: text.slice(0, 2500),
    headings: lines.filter((l) => l.length < 80 && /^[A-Z0-9][\w\s:-]{3,}$/.test(l)).slice(0, 20),
    emails,
    urls,
    handles,
    numbers,
    analytics: {
      avgWordLen: words.length
        ? Math.round((words.reduce((a, w) => a + w.length, 0) / words.length) * 10) / 10
        : 0,
      densityHandles: handles.length,
      densityUrls: urls.length,
    },
  };
}

export async function sendDmOAuth2(accessToken, { recipientId, text }) {
  const tid = String(recipientId || "").trim();
  const bodyText = String(text || "").trim();
  if (!tid) throw new Error("recipientId required");
  if (!bodyText) throw new Error("text required");

  const res = await fetch(
    `https://api.twitter.com/2/dm_conversations/with/${encodeURIComponent(tid)}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text: bodyText.slice(0, 10000) }),
    },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = err?.detail || err?.title || JSON.stringify(err);
    if (res.status === 403) {
      return {
        ok: false,
        status: 403,
        error: "dm_forbidden",
        message:
          "X rejected DM (403). Free apps often lack DM access — upgrade X API (Basic/Pro), enable dm.write, Reconnect X on /x.",
        details: err,
      };
    }
    return {
      ok: false,
      status: res.status,
      error: "dm_failed",
      message: `DM failed: ${msg}`,
      details: err,
    };
  }
  const data = await res.json();
  return {
    ok: true,
    dmEventId: data?.data?.dm_event_id || data?.data?.id || null,
    data,
  };
}

/** List recent DM events (requires dm.read). Graceful on free-tier 403. */
export async function listDmEventsOAuth2(accessToken, { maxResults = 20 } = {}) {
  const limit = Math.min(100, Math.max(1, Number(maxResults) || 20));
  const params = new URLSearchParams({
    max_results: String(limit),
    "dm_event.fields": "id,text,event_type,dm_conversation_id,created_at,sender_id,participant_ids",
    expansions: "sender_id",
    "user.fields": "id,name,username",
  });
  const res = await fetch(`https://api.twitter.com/2/dm_events?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = err?.detail || err?.title || JSON.stringify(err);
    if (res.status === 403) {
      return {
        ok: false,
        error: "dm_forbidden",
        message:
          "X rejected DM read (403). Free apps often lack DM access — upgrade X API (Basic/Pro), enable dm.read, Reconnect X on /x.",
        details: err,
      };
    }
    return { ok: false, error: "dm_list_failed", message: `DM inbox failed: ${msg}`, details: err };
  }
  const data = await res.json();
  const users = {};
  for (const u of data?.includes?.users || []) {
    if (u?.id) users[u.id] = u;
  }
  const events = (Array.isArray(data?.data) ? data.data : []).map((ev) => {
    const participantIds = ev.participant_ids || [];
    return {
      id: ev.id,
      text: ev.text || "",
      eventType: ev.event_type,
      conversationId: ev.dm_conversation_id,
      createdAt: ev.created_at,
      senderId: ev.sender_id,
      senderUsername: users[ev.sender_id]?.username || null,
      participantIds,
      isGroup: participantIds.length > 2,
    };
  });
  return { ok: true, events, meta: data?.meta || null };
}

/** Send a message into an existing DM / group conversation. */
export async function sendDmConversationOAuth2(accessToken, { conversationId, text }) {
  const cid = String(conversationId || "").trim();
  const bodyText = String(text || "").trim();
  if (!cid) throw new Error("conversationId required");
  if (!bodyText) throw new Error("text required");

  const res = await fetch(
    `https://api.twitter.com/2/dm_conversations/${encodeURIComponent(cid)}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text: bodyText.slice(0, 10000) }),
    },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = err?.detail || err?.title || JSON.stringify(err);
    if (res.status === 403) {
      return {
        ok: false,
        status: 403,
        error: "dm_forbidden",
        message:
          "X rejected group/DM send (403). Upgrade X API (Basic/Pro), enable dm.write, Reconnect X on /x.",
        details: err,
      };
    }
    return {
      ok: false,
      status: res.status,
      error: "dm_failed",
      message: `DM conversation failed: ${msg}`,
      details: err,
    };
  }
  const data = await res.json();
  return {
    ok: true,
    dmEventId: data?.data?.dm_event_id || data?.data?.id || null,
    conversationId: cid,
    data,
  };
}

/** Authenticated user id/username (users.read). */
export async function getXMe(accessToken) {
  const res = await fetch(`https://api.twitter.com/2/users/me?user.fields=${USER_FIELDS}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    return {
      ok: false,
      error: "me_failed",
      message: err?.detail || err?.title || `users/me failed (${res.status})`,
    };
  }
  const data = await res.json();
  return { ok: true, user: mapXUser(data?.data) || data?.data || null };
}

/** Recent mentions of the authenticated user. */
export async function listMentionsOAuth2(accessToken, userId, { maxResults = 10, sinceId } = {}) {
  const uid = String(userId || "").trim();
  if (!uid) {
    return { ok: false, error: "user_id_required", message: "X user id required for mentions" };
  }
  const limit = Math.min(100, Math.max(5, Number(maxResults) || 10));
  const params = new URLSearchParams({
    max_results: String(limit),
    "tweet.fields": "created_at,author_id,conversation_id,in_reply_to_user_id,text",
    expansions: "author_id",
    "user.fields": "id,name,username",
  });
  if (sinceId) params.set("since_id", String(sinceId));

  const res = await fetch(
    `https://api.twitter.com/2/users/${encodeURIComponent(uid)}/mentions?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = err?.detail || err?.title || JSON.stringify(err);
    if (res.status === 403) {
      return {
        ok: false,
        error: "mentions_forbidden",
        message:
          "X rejected mentions read (403). Needs tweet.read + Basic/Pro access for /users/:id/mentions.",
        details: err,
      };
    }
    if (res.status === 429) {
      return {
        ok: false,
        error: "mentions_rate_limited",
        message: "X mentions rate limit — will retry on next cron tick.",
        details: err,
      };
    }
    return { ok: false, error: "mentions_failed", message: `Mentions failed: ${msg}`, details: err };
  }
  const data = await res.json();
  const users = {};
  for (const u of data?.includes?.users || []) {
    if (u?.id) users[u.id] = u;
  }
  const mentions = (Array.isArray(data?.data) ? data.data : []).map((t) => ({
    id: t.id,
    text: t.text || "",
    authorId: t.author_id,
    authorUsername: users[t.author_id]?.username || null,
    authorName: users[t.author_id]?.name || null,
    conversationId: t.conversation_id || null,
    createdAt: t.created_at || null,
  }));
  return { ok: true, mentions, meta: data?.meta || null };
}

/** Reserved knowledge title used when auto-reply columns are not migrated yet. */
export const AUTO_REPLY_SETTINGS_TITLE = "__orbitx_settings__";
const HANDLED_TITLE_PREFIX = "__orbitx_handled__:";

const AUTO_REPLY_COLUMNS = [
  "auto_reply_mentions",
  "auto_reply_dms",
  "auto_reply_group_dms",
  "max_replies_per_day",
  "last_mention_since_id",
  "last_dm_since_id",
  "last_reply_poll_at",
];

export function isMissingSchemaError(err) {
  const msg = String(err?.message || err || "");
  const code = String(err?.code || "");
  return (
    /Could not find the .+ column/i.test(msg) ||
    /column .+ does not exist/i.test(msg) ||
    /Could not find the table/i.test(msg) ||
    /relation .+ does not exist/i.test(msg) ||
    /schema cache/i.test(msg) ||
    code === "PGRST204" ||
    code === "42P01" ||
    code === "42703"
  );
}

function splitAutoReplyPatch(patch) {
  const core = { ...patch };
  const auto = {};
  for (const key of AUTO_REPLY_COLUMNS) {
    if (Object.prototype.hasOwnProperty.call(core, key)) {
      auto[key] = core[key];
      delete core[key];
    }
  }
  return { core, auto };
}

async function loadAutoReplyFallback(sb, agentId) {
  try {
    const rows = await sb(
      `x_agent_knowledge?agent_id=eq.${encodeURIComponent(agentId)}&title=eq.${encodeURIComponent(AUTO_REPLY_SETTINGS_TITLE)}&order=created_at.desc&limit=1&select=id,content`,
    );
    const row = Array.isArray(rows) ? rows[0] : null;
    if (!row?.content) return { id: null, settings: {} };
    try {
      const parsed = JSON.parse(row.content);
      return { id: row.id, settings: parsed && typeof parsed === "object" ? parsed : {} };
    } catch {
      return { id: row.id, settings: {} };
    }
  } catch {
    return { id: null, settings: {} };
  }
}

async function saveAutoReplyFallback(sb, agent, autoFields) {
  if (!agent?.id || !agent?.user_id) return;
  const { id, settings } = await loadAutoReplyFallback(sb, agent.id);
  const next = { ...settings, ...autoFields };
  const content = JSON.stringify(next);
  if (id) {
    await sb(`x_agent_knowledge?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({ content }),
      headers: { Prefer: "return=minimal" },
    });
    return;
  }
  await sb("x_agent_knowledge", {
    method: "POST",
    body: JSON.stringify({
      agent_id: agent.id,
      user_id: agent.user_id,
      title: AUTO_REPLY_SETTINGS_TITLE,
      content,
    }),
    headers: { Prefer: "return=minimal" },
  });
}

/** Apply agent patch; persist auto-reply fields via knowledge fallback if columns missing. */
export async function patchXAgent(sb, agent, patch) {
  const agentId = agent?.id || agent;
  const base = typeof agent === "object" && agent ? agent : { id: agentId };
  try {
    const updated = await sb(`x_agents?id=eq.${encodeURIComponent(agentId)}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
    return Array.isArray(updated) ? updated[0] : updated;
  } catch (e) {
    if (!isMissingSchemaError(e)) throw e;
    const { core, auto } = splitAutoReplyPatch(patch);
    if (Object.keys(auto).length) {
      await saveAutoReplyFallback(sb, base, auto);
    }
    if (Object.keys(core).length === 0) {
      return hydrateAutoReplyAgent(sb, base);
    }
    try {
      const updated = await sb(`x_agents?id=eq.${encodeURIComponent(agentId)}`, {
        method: "PATCH",
        body: JSON.stringify(core),
      });
      const row = Array.isArray(updated) ? updated[0] : updated;
      return hydrateAutoReplyAgent(sb, row || base);
    } catch (e2) {
      if (!isMissingSchemaError(e2)) throw e2;
      // Still failing (e.g. only auto fields) — return hydrated base.
      return hydrateAutoReplyAgent(sb, { ...base, ...core });
    }
  }
}

/** Merge auto-reply settings from columns or knowledge fallback. */
export async function hydrateAutoReplyAgent(sb, agent) {
  if (!agent) return agent;
  const hasCol =
    typeof agent.auto_reply_mentions === "boolean" ||
    typeof agent.auto_reply_dms === "boolean" ||
    typeof agent.auto_reply_group_dms === "boolean" ||
    agent.max_replies_per_day != null ||
    agent.last_reply_poll_at != null;
  if (hasCol) return agent;
  const { settings } = await loadAutoReplyFallback(sb, agent.id);
  if (!settings || !Object.keys(settings).length) return agent;
  return {
    ...agent,
    auto_reply_mentions: Boolean(settings.auto_reply_mentions),
    auto_reply_dms: Boolean(settings.auto_reply_dms),
    auto_reply_group_dms: Boolean(settings.auto_reply_group_dms),
    max_replies_per_day: settings.max_replies_per_day ?? agent.max_replies_per_day ?? 30,
    last_mention_since_id: settings.last_mention_since_id ?? agent.last_mention_since_id ?? null,
    last_dm_since_id: settings.last_dm_since_id ?? agent.last_dm_since_id ?? null,
    last_reply_poll_at: settings.last_reply_poll_at ?? agent.last_reply_poll_at ?? null,
  };
}

export function mapAgentRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    persona: row.persona || "",
    voiceNotes: row.voice_notes || "",
    model: row.model || DEFAULT_NIM_MODEL,
    mode: row.mode || "approve",
    enabled: Boolean(row.enabled),
    timezone: row.timezone || "UTC",
    postingWindows: row.posting_windows || [],
    topics: row.topics || [],
    maxPostsPerDay: row.max_posts_per_day ?? 5,
    autoReplyMentions: Boolean(row.auto_reply_mentions),
    autoReplyDms: Boolean(row.auto_reply_dms),
    autoReplyGroupDms: Boolean(row.auto_reply_group_dms),
    maxRepliesPerDay: row.max_replies_per_day ?? 30,
    lastMentionSinceId: row.last_mention_since_id || null,
    lastDmSinceId: row.last_dm_since_id || null,
    lastReplyPollAt: row.last_reply_poll_at || null,
    lastAutoRunAt: row.last_auto_run_at || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapQueueRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    agentId: row.agent_id,
    kind: row.kind,
    payload: row.payload || {},
    status: row.status,
    scheduledFor: row.scheduled_for,
    postedTweetId: row.posted_tweet_id,
    error: row.error,
    source: row.source,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function ensureXAgent(sb, userId) {
  const existing = await sb(
    `x_agents?user_id=eq.${encodeURIComponent(userId)}&order=created_at.asc&limit=1&select=*`,
  );
  if (Array.isArray(existing) && existing[0]) {
    return hydrateAutoReplyAgent(sb, existing[0]);
  }
  const created = await sb("x_agents", {
    method: "POST",
    body: JSON.stringify({
      user_id: userId,
      name: "X Agent",
      persona:
        "You are a sharp crypto/social media voice for OrbitX. Keep posts under 260 chars. No spam. Be specific and useful.",
      model: DEFAULT_NIM_MODEL,
      mode: "approve",
      enabled: false,
    }),
  });
  const row = Array.isArray(created) ? created[0] : created;
  return hydrateAutoReplyAgent(sb, row);
}

export async function listKnowledge(sb, agentId) {
  const rows = await sb(
    `x_agent_knowledge?agent_id=eq.${encodeURIComponent(agentId)}&order=created_at.desc&limit=40&select=*`,
  );
  return (Array.isArray(rows) ? rows : []).filter(
    (k) => !String(k.title || "").startsWith("__orbitx_"),
  );
}

export async function generateAgentPost(sb, agentRow, hint) {
  const knowledge = await listKnowledge(sb, agentRow.id);
  const knowledgeBlock = knowledge
    .slice(0, 12)
    .map((k) => `### ${k.title}\n${k.content}`)
    .join("\n\n")
    .slice(0, 6000);
  const topics = Array.isArray(agentRow.topics) ? agentRow.topics.join(", ") : "";
  let repoLine = "";
  try {
    const { loadLinkedRepo } = await import("./x-github-repo.js");
    const linked = await loadLinkedRepo(sb, agentRow.id);
    if (linked?.fullName) {
      repoLine = `Linked GitHub repo (live): ${linked.fullName} — ${linked.htmlUrl}. Stay accurate to the product; do not invent features.`;
    }
  } catch {
    /* optional */
  }
  const system = [
    "You write X (Twitter) posts for the user.",
    "Return ONLY valid JSON: {\"text\":\"...\",\"kind\":\"post\"}",
    "text max 260 characters. No hashtag spam. No markdown fences.",
    agentRow.persona ? `Persona:\n${agentRow.persona}` : "",
    agentRow.voice_notes ? `Voice notes:\n${agentRow.voice_notes}` : "",
    topics ? `Topics to prefer: ${topics}` : "",
    repoLine,
    knowledgeBlock ? `Training knowledge:\n${knowledgeBlock}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const user = hint
    ? `Write one post about: ${hint}`
    : "Write one timely post that fits the persona and knowledge.";

  const ai = await nvidiaChat({
    system,
    user,
    model: agentRow.model,
    maxTokens: 400,
    temperature: 0.75,
  });
  if (!ai.ok) return ai;

  let parsed = null;
  const raw = String(ai.content || "").trim();
  try {
    const m = raw.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(m ? m[0] : raw);
  } catch {
    parsed = { text: raw.replace(/^```json\s*|```$/g, "").trim(), kind: "post" };
  }
  const text = String(parsed.text || "").trim().slice(0, 280);
  if (!text) {
    return { ok: false, error: "empty_generation", message: "Model returned empty text", raw: ai.content };
  }
  return {
    ok: true,
    text,
    kind: parsed.kind === "quote" || parsed.kind === "reply" ? parsed.kind : "post",
    quoteTweetId: parsed.quote_tweet_id || parsed.quoteTweetId || null,
    replyTo: parsed.reply_to || parsed.replyTo || null,
    model: ai.model,
  };
}

export function inPostingWindow(agentRow, now = new Date()) {
  const windows = Array.isArray(agentRow.posting_windows) ? agentRow.posting_windows : [];
  if (!windows.length) return true;
  // windows: [{ startHour: 9, endHour: 17 }] in agent timezone approximated as UTC for v1
  const hour = now.getUTCHours();
  return windows.some((w) => {
    const s = Number(w.startHour ?? w.start ?? 0);
    const e = Number(w.endHour ?? w.end ?? 24);
    if (s <= e) return hour >= s && hour < e;
    return hour >= s || hour < e;
  });
}

export async function countPostsToday(sb, userId) {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  const rows = await sb(
    `x_agent_queue?user_id=eq.${encodeURIComponent(userId)}&status=eq.posted&kind=eq.post&updated_at=gte.${encodeURIComponent(start.toISOString())}&select=id`,
  );
  return Array.isArray(rows) ? rows.length : 0;
}

export async function countRepliesToday(sb, userId) {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  const rows = await sb(
    `x_agent_queue?user_id=eq.${encodeURIComponent(userId)}&status=eq.posted&kind=in.(reply,dm)&updated_at=gte.${encodeURIComponent(start.toISOString())}&select=id`,
  );
  return Array.isArray(rows) ? rows.length : 0;
}

export async function generateAgentReply(sb, agentRow, ctx) {
  const knowledge = await listKnowledge(sb, agentRow.id);
  const knowledgeBlock = knowledge
    .slice(0, 10)
    .map((k) => `### ${k.title}\n${k.content}`)
    .join("\n\n")
    .slice(0, 5000);
  const kind = ctx?.kind === "dm" || ctx?.kind === "group_dm" ? ctx.kind : "mention";
  const from = ctx?.fromUsername ? `@${String(ctx.fromUsername).replace(/^@/, "")}` : "someone";
  const incoming = String(ctx?.text || "").trim().slice(0, 800);
  const system = [
    "You reply on X (Twitter) as the account owner / brand voice.",
    'Return ONLY valid JSON: {"text":"...","skip":false}',
    "text max 240 characters. No hashtag spam. No markdown. Be helpful and on-brand.",
    "Set skip:true if the message is spam, scam, abuse, or needs no reply.",
    kind === "group_dm"
      ? "This is a group DM — keep it brief and natural for a chat."
      : kind === "dm"
        ? "This is a 1:1 DM — be conversational."
        : "This is a public mention/reply — keep it public-safe.",
    agentRow.persona ? `Persona:\n${agentRow.persona}` : "",
    agentRow.voice_notes ? `Voice notes:\n${agentRow.voice_notes}` : "",
    knowledgeBlock ? `Training knowledge:\n${knowledgeBlock}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const user = `Incoming ${kind} from ${from}:\n"""${incoming}"""\nWrite the reply.`;

  const ai = await nvidiaChat({
    system,
    user,
    model: agentRow.model,
    maxTokens: 320,
    temperature: 0.7,
  });
  if (!ai.ok) return ai;

  let parsed = null;
  const raw = String(ai.content || "").trim();
  try {
    const m = raw.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(m ? m[0] : raw);
  } catch {
    parsed = { text: raw.replace(/^```json\s*|```$/g, "").trim(), skip: false };
  }
  if (parsed?.skip === true) {
    return { ok: true, skip: true, text: "", model: ai.model };
  }
  const text = String(parsed?.text || "").trim().slice(0, 280);
  if (!text) {
    return { ok: false, error: "empty_generation", message: "Model returned empty reply", raw: ai.content };
  }
  return { ok: true, skip: false, text, model: ai.model };
}

async function wasHandled(sb, userId, sourceKind, sourceId) {
  try {
    const rows = await sb(
      `x_agent_handled?user_id=eq.${encodeURIComponent(userId)}&source_kind=eq.${encodeURIComponent(sourceKind)}&source_id=eq.${encodeURIComponent(sourceId)}&limit=1&select=id`,
    );
    return Array.isArray(rows) && rows.length > 0;
  } catch (e) {
    if (!isMissingSchemaError(e)) throw e;
  }
  // Fallback when x_agent_handled migration is not applied yet.
  const title = `${HANDLED_TITLE_PREFIX}${sourceKind}:${sourceId}`;
  try {
    const rows = await sb(
      `x_agent_knowledge?user_id=eq.${encodeURIComponent(userId)}&title=eq.${encodeURIComponent(title)}&limit=1&select=id`,
    );
    if (Array.isArray(rows) && rows.length > 0) return true;
  } catch {
    /* ignore */
  }
  try {
    const key = sourceKind === "mention" ? "sourceMentionId" : "sourceDmEventId";
    const rows = await sb(
      `x_agent_queue?user_id=eq.${encodeURIComponent(userId)}&payload->>${key}=eq.${encodeURIComponent(sourceId)}&limit=1&select=id`,
    );
    return Array.isArray(rows) && rows.length > 0;
  } catch {
    return false;
  }
}

async function markHandled(sb, { userId, agentId, sourceKind, sourceId, queueId }) {
  try {
    await sb("x_agent_handled", {
      method: "POST",
      body: JSON.stringify({
        user_id: userId,
        agent_id: agentId,
        source_kind: sourceKind,
        source_id: sourceId,
        queue_id: queueId || null,
      }),
      headers: { Prefer: "return=minimal" },
    });
    return;
  } catch (e) {
    if (!isMissingSchemaError(e)) {
      /* unique race — ignore */
      return;
    }
  }
  try {
    await sb("x_agent_knowledge", {
      method: "POST",
      body: JSON.stringify({
        agent_id: agentId,
        user_id: userId,
        title: `${HANDLED_TITLE_PREFIX}${sourceKind}:${sourceId}`,
        content: JSON.stringify({ queueId: queueId || null, at: new Date().toISOString() }),
      }),
      headers: { Prefer: "return=minimal" },
    });
  } catch {
    /* ignore duplicates / races */
  }
}

async function enqueueOrSendReply(sb, agent, resolveToken, uploadImage, item) {
  const status = agent.mode === "auto" ? "approved" : "pending";
  const created = await sb("x_agent_queue", {
    method: "POST",
    body: JSON.stringify({
      agent_id: agent.id,
      user_id: agent.user_id,
      kind: item.kind,
      payload: item.payload,
      status,
      scheduled_for: status === "approved" ? new Date().toISOString() : null,
      source: "agent",
    }),
  });
  const row = Array.isArray(created) ? created[0] : created;
  if (!row) return { ok: false, error: "queue_create_failed" };
  if (status === "approved") {
    const exec = await executeQueueItem(sb, row, resolveToken, uploadImage);
    return { ok: exec.ok !== false, queued: false, item: row, exec };
  }
  return { ok: true, queued: true, item: row };
}

/**
 * Poll mentions + DMs / group DMs and draft or auto-send replies.
 * resolveToken(userId) => { ok, accessToken, profile }
 */
export async function processAutoReplies(sb, resolveToken, uploadImage, { forceUserId } = {}) {
  let agents;
  if (forceUserId) {
    const one = await ensureXAgent(sb, forceUserId);
    agents = one ? [one] : [];
  } else {
    try {
      const rows = await sb(
        `x_agents?enabled=eq.true&or=(auto_reply_mentions.eq.true,auto_reply_dms.eq.true,auto_reply_group_dms.eq.true)&select=*&limit=20`,
      );
      agents = Array.isArray(rows) ? rows : [];
    } catch (e) {
      if (!isMissingSchemaError(e)) throw e;
      const rows = await sb(`x_agents?enabled=eq.true&select=*&limit=40`);
      const list = Array.isArray(rows) ? rows : [];
      agents = [];
      for (const row of list) {
        agents.push(await hydrateAutoReplyAgent(sb, row));
      }
      agents = agents.filter(
        (a) => a.auto_reply_mentions || a.auto_reply_dms || a.auto_reply_group_dms,
      );
    }
  }

  const results = [];
  const nowIso = new Date().toISOString();

  for (let agent of agents) {
    try {
    agent = await hydrateAutoReplyAgent(sb, agent);
    if (!agent.auto_reply_mentions && !agent.auto_reply_dms && !agent.auto_reply_group_dms) {
      results.push({
        agentId: agent.id,
        ok: true,
        skipped: "auto_reply_off",
        message: "Enable autoReplyMentions / autoReplyDms / autoReplyGroupDms first.",
      });
      continue;
    }
    if (agent.last_reply_poll_at && !forceUserId) {
      const elapsed = Date.now() - new Date(agent.last_reply_poll_at).getTime();
      if (elapsed < 90 * 1000) continue; // avoid hammering X between cron minutes
    }

    const resolved = await resolveToken(agent.user_id);
    if (!resolved.ok) {
      results.push({ agentId: agent.id, ok: false, ...resolved });
      continue;
    }

    let twitterId = resolved.profile?.twitter_id || null;
    if (!twitterId) {
      const me = await getXMe(resolved.accessToken);
      twitterId = me?.user?.id || null;
    }
    if (!twitterId && agent.auto_reply_mentions) {
      results.push({
        agentId: agent.id,
        ok: false,
        error: "missing_twitter_id",
        message: "Connect X again so twitter_id is stored for mentions.",
      });
      continue;
    }

    const repliedToday = await countRepliesToday(sb, agent.user_id);
    const maxReplies = Math.max(0, Math.min(200, Number(agent.max_replies_per_day) || 30));
    let budget = Math.max(0, maxReplies - repliedToday);
    if (budget <= 0) {
      results.push({ agentId: agent.id, ok: true, skipped: "daily_reply_cap" });
      await patchXAgent(sb, agent, { last_reply_poll_at: nowIso, updated_at: nowIso });
      continue;
    }

    const agentResults = { agentId: agent.id, mentions: [], dms: [] };
    let newestMentionId = agent.last_mention_since_id || null;
    let newestDmId = agent.last_dm_since_id || null;

    if (agent.auto_reply_mentions && twitterId && budget > 0) {
      const ment = await listMentionsOAuth2(resolved.accessToken, twitterId, {
        maxResults: 10,
        sinceId: agent.last_mention_since_id || undefined,
      });
      if (!ment.ok) {
        agentResults.mentions.push(ment);
      } else {
        // API returns newest-first
        for (const m of ment.mentions.slice(0, 5)) {
          try {
            if (!newestMentionId || BigInt(m.id) > BigInt(newestMentionId)) newestMentionId = m.id;
          } catch {
            newestMentionId = m.id;
          }
          if (m.authorId && String(m.authorId) === String(twitterId)) continue;
          if (await wasHandled(sb, agent.user_id, "mention", m.id)) continue;
          if (budget <= 0) break;

          const draft = await generateAgentReply(sb, agent, {
            kind: "mention",
            fromUsername: m.authorUsername,
            text: m.text,
          });
          if (!draft.ok) {
            agentResults.mentions.push({ sourceId: m.id, ...draft });
            continue;
          }
          if (draft.skip) {
            await markHandled(sb, {
              userId: agent.user_id,
              agentId: agent.id,
              sourceKind: "mention",
              sourceId: m.id,
            });
            agentResults.mentions.push({ sourceId: m.id, skipped: true });
            continue;
          }

          const sent = await enqueueOrSendReply(sb, agent, resolveToken, uploadImage, {
            kind: "reply",
            payload: {
              text: draft.text,
              replyToTweetId: m.id,
              reply_to: m.id,
              mentionFrom: m.authorUsername,
              sourceMentionId: m.id,
            },
          });
          // Only mark handled on success — failed sends must be retryable.
          if (sent.ok) {
            await markHandled(sb, {
              userId: agent.user_id,
              agentId: agent.id,
              sourceKind: "mention",
              sourceId: m.id,
              queueId: sent.item?.id,
            });
            budget -= 1;
          }
          agentResults.mentions.push({ sourceId: m.id, ...sent, text: draft.text });
        }
      }
    }

    if ((agent.auto_reply_dms || agent.auto_reply_group_dms) && budget > 0) {
      const inbox = await listDmEventsOAuth2(resolved.accessToken, { maxResults: 20 });
      if (!inbox.ok) {
        agentResults.dms.push(inbox);
      } else {
        for (const ev of inbox.events.slice(0, 8)) {
          try {
            if (!newestDmId || (ev.id && BigInt(ev.id) > BigInt(newestDmId))) newestDmId = ev.id;
          } catch {
            newestDmId = ev.id;
          }
          if (!ev.text || !ev.conversationId) continue;
          if (ev.senderId && twitterId && String(ev.senderId) === String(twitterId)) continue;
          const isGroup = Boolean(ev.isGroup);
          const sourceKind = isGroup ? "group_dm" : "dm";
          if (isGroup && !agent.auto_reply_group_dms) continue;
          if (!isGroup && !agent.auto_reply_dms) continue;
          if (await wasHandled(sb, agent.user_id, sourceKind, ev.id)) continue;
          if (budget <= 0) break;

          const draft = await generateAgentReply(sb, agent, {
            kind: sourceKind,
            fromUsername: ev.senderUsername,
            text: ev.text,
          });
          if (!draft.ok) {
            agentResults.dms.push({ sourceId: ev.id, ...draft });
            continue;
          }
          if (draft.skip) {
            await markHandled(sb, {
              userId: agent.user_id,
              agentId: agent.id,
              sourceKind,
              sourceId: ev.id,
            });
            agentResults.dms.push({ sourceId: ev.id, skipped: true });
            continue;
          }

          const sent = await enqueueOrSendReply(sb, agent, resolveToken, uploadImage, {
            kind: "dm",
            payload: {
              text: draft.text,
              dmConversationId: ev.conversationId,
              conversationId: ev.conversationId,
              dmRecipientId: isGroup ? null : ev.senderId,
              isGroup,
              sourceDmEventId: ev.id,
              username: ev.senderUsername,
            },
          });
          if (sent.ok) {
            await markHandled(sb, {
              userId: agent.user_id,
              agentId: agent.id,
              sourceKind,
              sourceId: ev.id,
              queueId: sent.item?.id,
            });
            budget -= 1;
          }
          agentResults.dms.push({ sourceId: ev.id, sourceKind, ...sent, text: draft.text });
        }
      }
    }

    const patch = {
      last_reply_poll_at: nowIso,
      updated_at: nowIso,
    };
    if (newestMentionId) patch.last_mention_since_id = newestMentionId;
    if (newestDmId) patch.last_dm_since_id = newestDmId;
    await patchXAgent(sb, agent, patch);

    results.push({ ok: true, ...agentResults });
    } catch (e) {
      results.push({
        agentId: agent?.id,
        ok: false,
        error: "poll_agent_failed",
        message: e?.message || "poll failed",
      });
    }
  }

  return { ok: true, agents: results.length, results };
}

/**
 * Execute a queue payload against X (post/quote/reply/dm).
 * resolveToken(userId) => { ok, accessToken, profile }
 */
export async function executeQueueItem(sb, item, resolveToken, uploadImage) {
  let resolved = await resolveToken(item.user_id);
  if (!resolved.ok) {
    await sb(`x_agent_queue?id=eq.${encodeURIComponent(item.id)}`, {
      method: "PATCH",
      body: JSON.stringify({
        status: "failed",
        error: resolved.message || resolved.error,
        updated_at: new Date().toISOString(),
      }),
      headers: { Prefer: "return=minimal" },
    });
    return { ok: false, ...resolved };
  }

  const payload = item.payload || {};
  const kind = item.kind || "post";

  try {
    if (kind === "dm") {
      const conversationId = payload.dmConversationId || payload.conversationId || null;
      const sendDm = async (accessToken) => {
        if (conversationId) {
          return sendDmConversationOAuth2(accessToken, {
            conversationId,
            text: payload.text,
          });
        }
        let recipientId = payload.dmRecipientId || payload.recipientId;
        if (!recipientId && payload.username) {
          const u = await lookupXUser(accessToken, payload.username);
          if (!u?.id) throw new Error("Could not resolve username for DM");
          recipientId = u.id;
        }
        return sendDmOAuth2(accessToken, {
          recipientId,
          text: payload.text,
        });
      };
      let dm = await sendDm(resolved.accessToken);
      if (!dm.ok && dm.status === 401) {
        const retry = await resolveToken(item.user_id, { forceRefresh: true });
        if (retry.ok) {
          resolved = retry;
          dm = await sendDm(retry.accessToken);
        }
      }
      if (!dm.ok) {
        await sb(`x_agent_queue?id=eq.${encodeURIComponent(item.id)}`, {
          method: "PATCH",
          body: JSON.stringify({
            status: "failed",
            error: dm.message,
            updated_at: new Date().toISOString(),
          }),
          headers: { Prefer: "return=minimal" },
        });
        return dm;
      }
      await sb(`x_agent_queue?id=eq.${encodeURIComponent(item.id)}`, {
        method: "PATCH",
        body: JSON.stringify({
          status: "posted",
          posted_tweet_id: dm.dmEventId,
          error: null,
          updated_at: new Date().toISOString(),
        }),
        headers: { Prefer: "return=minimal" },
      });
      return { ok: true, kind: "dm", ...dm };
    }

    const text = buildTweetText(payload.text, payload.linkUrl);
    let mediaId = null;
    if (payload.imageUrl && uploadImage) {
      try {
        mediaId = await uploadImage(String(payload.imageUrl));
      } catch {
        /* continue without media */
      }
    }
    let posted = await postTweetOAuth2(resolved.accessToken, {
      text,
      mediaId,
      replyToTweetId: payload.replyToTweetId || payload.reply_to || undefined,
      quoteTweetId: payload.quoteTweetId || payload.quote_tweet_id || undefined,
    });
    if (!posted.ok && posted.status === 401) {
      const retry = await resolveToken(item.user_id, { forceRefresh: true });
      if (retry.ok) {
        posted = await postTweetOAuth2(retry.accessToken, {
          text,
          mediaId,
          replyToTweetId: payload.replyToTweetId || payload.reply_to || undefined,
          quoteTweetId: payload.quoteTweetId || payload.quote_tweet_id || undefined,
        });
      }
    }
    if (!posted.ok) {
      await sb(`x_agent_queue?id=eq.${encodeURIComponent(item.id)}`, {
        method: "PATCH",
        body: JSON.stringify({
          status: "failed",
          error: posted.message || posted.error,
          updated_at: new Date().toISOString(),
        }),
        headers: { Prefer: "return=minimal" },
      });
      return posted;
    }
    await sb(`x_agent_queue?id=eq.${encodeURIComponent(item.id)}`, {
      method: "PATCH",
      body: JSON.stringify({
        status: "posted",
        posted_tweet_id: posted.tweetId,
        error: null,
        updated_at: new Date().toISOString(),
      }),
      headers: { Prefer: "return=minimal" },
    });
    return { ok: true, kind, ...posted, text };
  } catch (e) {
    await sb(`x_agent_queue?id=eq.${encodeURIComponent(item.id)}`, {
      method: "PATCH",
      body: JSON.stringify({
        status: "failed",
        error: e?.message || String(e),
        updated_at: new Date().toISOString(),
      }),
      headers: { Prefer: "return=minimal" },
    });
    return { ok: false, error: "exec_failed", message: e?.message || String(e) };
  }
}

export async function runCronTick(sb, resolveToken, uploadImage) {
  const nowIso = new Date().toISOString();
  const due = await sb(
    `x_agent_queue?or=(and(status.eq.scheduled,scheduled_for.lte.${encodeURIComponent(nowIso)}),status.eq.approved)&order=scheduled_for.asc.nullsfirst&limit=20&select=*`,
  );
  const items = Array.isArray(due) ? due : [];
  const results = [];
  for (const item of items) {
    results.push(await executeQueueItem(sb, item, resolveToken, uploadImage));
  }

  // Auto agents: generate + enqueue/post if under daily cap and in window
  const agents = await sb(
    `x_agents?enabled=eq.true&mode=eq.auto&select=*&limit=15`,
  );
  const autoAgents = Array.isArray(agents) ? agents : [];
  for (const agent of autoAgents) {
    if (!inPostingWindow(agent)) continue;
    const postedToday = await countPostsToday(sb, agent.user_id);
    if (postedToday >= (agent.max_posts_per_day || 5)) continue;
    if (agent.last_auto_run_at) {
      const elapsed = Date.now() - new Date(agent.last_auto_run_at).getTime();
      if (elapsed < 30 * 60 * 1000) continue; // min 30m between auto gens
    }
    const pending = await sb(
      `x_agent_queue?user_id=eq.${encodeURIComponent(agent.user_id)}&status=in.(pending,scheduled,approved)&limit=1&select=id`,
    );
    if (Array.isArray(pending) && pending.length) continue;

    const gen = await generateAgentPost(sb, agent, null);
    await sb(`x_agents?id=eq.${encodeURIComponent(agent.id)}`, {
      method: "PATCH",
      body: JSON.stringify({ last_auto_run_at: nowIso, updated_at: nowIso }),
      headers: { Prefer: "return=minimal" },
    });
    if (!gen.ok) {
      results.push({ ok: false, agentId: agent.id, ...gen });
      continue;
    }
    const created = await sb("x_agent_queue", {
      method: "POST",
      body: JSON.stringify({
        agent_id: agent.id,
        user_id: agent.user_id,
        kind: "post",
        payload: { text: gen.text },
        status: "approved",
        scheduled_for: nowIso,
        source: "agent",
      }),
    });
    const row = Array.isArray(created) ? created[0] : created;
    if (row) {
      results.push(await executeQueueItem(sb, row, resolveToken, uploadImage));
    }
  }

  // Auto-reply: mentions + DMs / group DMs for agents with toggles on
  let autoReplies = { ok: true, agents: 0, results: [] };
  try {
    autoReplies = await processAutoReplies(sb, resolveToken, uploadImage);
  } catch (e) {
    autoReplies = { ok: false, error: e?.message || String(e), agents: 0, results: [] };
  }

  return {
    ok: true,
    processed: results.length,
    results,
    autoReplies,
  };
}

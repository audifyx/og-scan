/**
 * OrbitX Social Center — public API (plugged into web.js LAZY map).
 *
 * Public by default: read endpoints need no auth (for people, bots, AI agents).
 *   GET /api/social/feed/:username?limit=20   — latest posts by a user (Telegram-bot friendly)
 *   GET /api/social/feed?tag=$SOL&limit=20    — latest posts mentioning a cashtag
 *   GET /api/social/post/:id                 — single post as JSON
 *   GET /api/social/oembed?url=...           — oEmbed JSON for a post URL
 *   GET /api/social/profile/:username        — public profile card JSON
 *
 * Documented for bot builders at the bottom of this file.
 */

const SB_URL = process.env.SUPABASE_URL || "https://ffjipnkhcebjvttliptb.supabase.co";
const SB_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";

async function sb(path) {
  const r = await fetch(`${SB_URL}/rest/v1/${path}`, {
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` },
  });
  if (!r.ok) throw new Error(`supabase ${r.status}`);
  return r.json();
}

function send(res, code, obj) {
  res.statusCode = code;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "public, max-age=30, s-maxage=60");
  res.end(JSON.stringify(obj));
}

const FEED_COLS = "id,user_id,username,avatar_url,content,likes_count,created_at,repost_of";
const SITE = "https://orbitx.world";

function postToJson(p) {
  return {
    id: p.id,
    username: p.username,
    avatar_url: p.avatar_url,
    text: p.content,
    likes: p.likes_count ?? 0,
    created_at: p.created_at,
    repost_of: p.repost_of || null,
    url: `${SITE}/social/embed/post/${p.id}`,
    author_url: p.username ? `${SITE}/social/embed/profile/${encodeURIComponent(p.username)}` : null,
  };
}

export default async function handler(req, res) {
  if (!SB_KEY) return send(res, 500, { ok: false, error: "supabase_not_configured" });
  try {
    const raw = req.query?.path || "";
    const parts = String(raw).split("/").filter(Boolean); // ["social", "feed", ":username"]
    const action = parts[1] || "";
    const arg = parts[2] ? decodeURIComponent(parts[2]) : "";
    const limit = Math.min(Math.max(Number(req.query?.limit) || 20, 1), 100);

    // ── GET /api/social/feed/:username ──
    if (action === "feed" && arg && !arg.startsWith("$")) {
      const rows = await sb(
        `social_messages?select=${FEED_COLS}&username=eq.${encodeURIComponent(arg)}&reply_to=is.null&order=created_at.desc&limit=${limit}`
      );
      return send(res, 200, { ok: true, username: arg, count: rows.length, posts: rows.map(postToJson) });
    }

    // ── GET /api/social/feed?tag=$SOL ──
    if (action === "feed") {
      const tag = String(req.query?.tag || "").toUpperCase().replace(/^\$/, "");
      if (!tag) return send(res, 400, { ok: false, error: "username_or_tag_required" });
      const rows = await sb(
        `social_messages?select=${FEED_COLS}&content=ilike.%25%24${encodeURIComponent(tag)}%25&reply_to=is.null&order=created_at.desc&limit=${limit}`
      );
      return send(res, 200, { ok: true, tag: `$${tag}`, count: rows.length, posts: rows.map(postToJson) });
    }

    // ── GET /api/social/post/:id ──
    if (action === "post" && arg) {
      const rows = await sb(`social_messages?select=${FEED_COLS}&id=eq.${encodeURIComponent(arg)}&limit=1`);
      if (!rows.length) return send(res, 404, { ok: false, error: "post_not_found" });
      return send(res, 200, { ok: true, post: postToJson(rows[0]) });
    }

    // ── GET /api/social/profile/:username ──
    if (action === "profile" && arg) {
      const profs = await sb(
        `profiles?select=user_id,username,display_name,avatar_url,bio,is_official_account&username=eq.${encodeURIComponent(arg)}&limit=1`
      );
      if (!profs.length) return send(res, 404, { ok: false, error: "profile_not_found" });
      const p = profs[0];
      const [posts, followers] = await Promise.all([
        sb(`social_messages?select=${FEED_COLS}&username=eq.${encodeURIComponent(arg)}&reply_to=is.null&order=created_at.desc&limit=5`),
        sb(`followers?select=follower_id&followee_id=eq.${p.user_id}&limit=1`).catch(() => []),
      ]);
      // follower count via head request would be ideal; approximate with a capped query
      const fcount = await sb(`followers?select=count&followee_id=eq.${p.user_id}`).catch(() => null);
      return send(res, 200, {
        ok: true,
        profile: {
          username: p.username,
          display_name: p.display_name,
          avatar_url: p.avatar_url,
          bio: p.bio,
          verified: Boolean(p.is_official_account),
          url: `${SITE}/social/embed/profile/${encodeURIComponent(p.username)}`,
        },
        latest_posts: posts.map(postToJson),
      });
    }

    // ── GET /api/social/oembed?url=... ──
    if (action === "oembed") {
      const url = String(req.query?.url || "");
      const m = url.match(/\/embed\/post\/([a-zA-Z0-9-]+)/) || url.match(/post\/([a-zA-Z0-9-]+)/);
      if (!m) return send(res, 400, { ok: false, error: "url_must_be_a_post_url" });
      const rows = await sb(`social_messages?select=${FEED_COLS}&id=eq.${encodeURIComponent(m[1])}&limit=1`);
      if (!rows.length) return send(res, 404, { ok: false, error: "post_not_found" });
      const p = rows[0];
      return send(res, 200, {
        version: "1.0",
        type: "rich",
        provider_name: "OrbitX Social Center",
        provider_url: SITE,
        author_name: p.username ? `@${p.username}` : "OrbitX",
        author_url: p.username ? `${SITE}/social/embed/profile/${encodeURIComponent(p.username)}` : SITE,
        title: `${p.username ? `@${p.username}` : "Post"} on OrbitX Social Center`,
        html: `<iframe src="${SITE}/social/embed/post/${p.id}" width="550" height="220" frameborder="0" allowtransparency="true"></iframe>`,
        width: 550,
        height: 220,
        thumbnail_url: p.avatar_url || undefined,
      });
    }

    return send(res, 404, { ok: false, error: "unknown_social_route", hint: "GET /api/social/feed/:username | /api/social/post/:id | /api/social/profile/:username | /api/social/oembed?url=..." });
  } catch (e) {
    return send(res, 500, { ok: false, error: "social_api_failed", detail: String((e && e.message) || e).slice(0, 200) });
  }
}

/* ── Bot builder docs ─────────────────────────────────────────────
 * Poll for new posts from an account (Telegram bot example):
 *   GET https://orbitx.world/api/social/feed/<username>?limit=10
 *   → { ok, username, count, posts: [{ id, username, text, likes,
 *       created_at, url, author_url }] }
 * Keep the max created_at you have seen; on each poll, any post with a
 * newer created_at is new — forward its text + url to your channel.
 * Poll no more than once every 30s (responses are cached for 60s).
 * Filter by cashtag instead: GET /api/social/feed?tag=$SOL&limit=20
 * ─────────────────────────────────────────────────────────────── */

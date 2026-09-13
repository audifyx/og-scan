/**
 * Generated X MCP activity catalog — ~500 shortcut tools + ~5000 activity tools.
 * Default tools/list exposes CORE only (connectors choke on huge lists).
 * Generated names remain callable; optional tools/list cursor gen:N pages them.
 */

/** @type {Map<string, object>} */
export const X_GEN_META = new Map();

const LIMITS = [5, 10, 20, 50, 100];
const PAGES = Array.from({ length: 50 }, (_, i) => i + 1); // 1..50
const PERIODS = ["24h", "7d", "30d", "all"];

/** 20 activity families × 50 pages × 5 limits = 5000 */
const ACTIVITIES = [
  { id: "followers", kind: "followers", desc: "Followers list" },
  { id: "following", kind: "following", desc: "Following list" },
  { id: "recent_followers", kind: "recent_followers", desc: "Recent followers (newest first)" },
  { id: "dm_inbox", kind: "dm_inbox", desc: "Recent DMs inbox" },
  { id: "dm_list", kind: "dm_inbox", desc: "DM events list" },
  { id: "mentions", kind: "mentions", desc: "Mentions timeline" },
  { id: "user_lookup", kind: "user_lookup", desc: "Lookup @username profile + metrics" },
  { id: "tweet_metrics", kind: "tweet_metrics", desc: "Tweet views / likes / RT / replies" },
  { id: "user_tweets", kind: "user_tweets", desc: "User tweets + public metrics" },
  { id: "lists", kind: "lists", desc: "Owned / membership lists" },
  { id: "list_members", kind: "list_members", desc: "Members of a list" },
  { id: "analytics", kind: "analytics", desc: "Account analytics snapshot" },
  { id: "pdf_scan", kind: "pdf_scan", desc: "Scan PDF URL for text/analytics" },
  { id: "credits_usage", kind: "credits_usage", desc: "Credits usage analytics" },
  { id: "connection", kind: "connection", desc: "X connection + OAuth scopes" },
  { id: "me", kind: "me", desc: "Authenticated X profile" },
  { id: "views", kind: "tweet_metrics", desc: "Tweet impression / view metrics" },
  { id: "timeline", kind: "user_tweets", desc: "Home-style user timeline metrics" },
  { id: "audience", kind: "followers", desc: "Audience / followers page" },
  { id: "network", kind: "following", desc: "Following network page" },
];

function baseSchema(extra = {}) {
  return {
    type: "object",
    properties: {
      username: { type: "string", description: "@handle without requiring @" },
      userId: { type: "string", description: "X numeric user id (optional)" },
      tweetId: { type: "string", description: "Tweet id for metrics" },
      listId: { type: "string", description: "List id" },
      url: { type: "string", description: "PDF or document URL to scan" },
      text: { type: "string", description: "Inline text / pasted PDF text" },
      base64: { type: "string", description: "Base64-encoded PDF bytes" },
      maxResults: { type: "integer", description: "Page size (override)" },
      paginationToken: { type: "string", description: "X API pagination token" },
      period: { type: "string", description: "Analytics period: 24h|7d|30d|all" },
      ...extra,
    },
    additionalProperties: false,
  };
}

function toolDef(name, description, meta) {
  X_GEN_META.set(name, meta);
  return {
    name,
    description,
    inputSchema: baseSchema(),
  };
}

let _built = null;

/**
 * Build ~500 named shortcuts + 5000 activity matrix tools.
 * Returns array of {name, description, inputSchema}; meta lives in X_GEN_META.
 */
export function buildXGeneratedTools() {
  if (_built) return _built;
  const out = [];
  const seen = new Set();

  function push(t) {
    if (seen.has(t.name)) return;
    seen.add(t.name);
    out.push(t);
  }

  // ~500 semantic shortcuts: activity × period × limit × a few pages
  let shortcutCount = 0;
  for (const act of ACTIVITIES) {
    for (const period of PERIODS) {
      for (const limit of LIMITS) {
        for (const page of [1, 2, 3, 5, 10]) {
          if (shortcutCount >= 500) break;
          const name = `x_${act.id}_${period}_p${page}_n${limit}`;
          push(
            toolDef(
              name,
              `${act.desc} · period ${period} · page ${page} · n=${limit}`,
              {
                kind: act.kind,
                page,
                limit,
                period,
                activityId: act.id,
              },
            ),
          );
          shortcutCount += 1;
        }
        if (shortcutCount >= 500) break;
      }
      if (shortcutCount >= 500) break;
    }
    if (shortcutCount >= 500) break;
  }

  // 5000 activity tools: 20 × 50 × 5
  for (const act of ACTIVITIES) {
    for (const page of PAGES) {
      for (const limit of LIMITS) {
        const name = `x_act_${act.id}_p${page}_n${limit}`;
        push(
          toolDef(name, `Activity · ${act.desc} · page ${page} · n=${limit}`, {
            kind: act.kind,
            page,
            limit,
            period: "7d",
            activityId: act.id,
          }),
        );
      }
    }
  }

  _built = out;
  return out;
}

export function xGeneratedStats() {
  return {
    totalMeta: X_GEN_META.size,
    activities: ACTIVITIES.length,
    pages: PAGES.length,
    limits: LIMITS.length,
    activityMatrix: ACTIVITIES.length * PAGES.length * LIMITS.length,
    shortcutsTarget: 500,
  };
}

export function listXGeneratedHelp({ q = "", limit = 40 } = {}) {
  const needle = String(q || "").toLowerCase().trim();
  const names = [...X_GEN_META.keys()];
  const filtered = needle
    ? names.filter((n) => n.includes(needle) || String(X_GEN_META.get(n)?.kind || "").includes(needle))
    : names;
  return {
    ok: true,
    matched: filtered.length,
    total: names.length,
    stats: xGeneratedStats(),
    sample: filtered.slice(0, Math.min(100, Math.max(5, Number(limit) || 40))),
    note:
      "Call any listed name via tools/call. Default tools/list shows CORE only — use x_tools_help or tools/list cursor gen:0.",
  };
}

/**
 * @param {string} name
 * @param {object} args
 * @param {(meta: object, args: object) => Promise<object>} runActivity
 */
export async function dispatchXGenerated(name, args, runActivity) {
  const meta = X_GEN_META.get(name);
  if (!meta) return null;
  return runActivity(meta, args || {});
}

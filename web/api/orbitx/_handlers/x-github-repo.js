/**
 * Linked GitHub repo for X MCP — Claude/Grok read the repo live while drafting posts.
 * Default: X_MCP_GITHUB_REPO / GITHUB_REPO env, else audifyx/og-scan.
 * Per-user override stored in x_agent_knowledge title __orbitx_github_repo__.
 */

export const GITHUB_REPO_TITLE = "__orbitx_github_repo__";
export const DEFAULT_GITHUB_REPO =
  process.env.X_MCP_GITHUB_REPO ||
  process.env.GITHUB_REPO ||
  "audifyx/og-scan";

const GH_API = "https://api.github.com";
const MAX_FILE_CHARS = 48_000;
const TEXT_EXT =
  /\.(md|mdx|txt|json|js|jsx|ts|tsx|mjs|cjs|css|html|yml|yaml|toml|svg|py|rs|go|sol|sh|ps1|sql|graphql)$/i;

function ghHeaders() {
  const h = {
    Accept: "application/vnd.github+json",
    "User-Agent": "OrbitX-X-MCP",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || process.env.X_MCP_GITHUB_TOKEN;
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

/** Parse github.com URL or owner/repo into { owner, repo, ref?, path? }. */
export function parseGithubRepo(input) {
  const raw = String(input || "").trim();
  if (!raw) return null;

  let m = raw.match(
    /^(?:https?:\/\/)?(?:www\.)?github\.com\/([^/\s]+)\/([^/\s#?]+)(?:\/(?:tree|blob)\/([^/\s]+)(?:\/(.*))?)?(?:\.git)?\/?$/i,
  );
  if (m) {
    const repo = m[2].replace(/\.git$/i, "");
    return {
      owner: m[1],
      repo,
      ref: m[3] || null,
      path: m[4] ? decodeURIComponent(m[4]) : null,
      fullName: `${m[1]}/${repo}`,
      htmlUrl: `https://github.com/${m[1]}/${repo}`,
    };
  }

  m = raw.match(/^([^/\s]+)\/([^/\s@]+)(?:@([^\s]+))?(?:\/(.+))?$/);
  if (m) {
    const repo = m[2].replace(/\.git$/i, "");
    return {
      owner: m[1],
      repo,
      ref: m[3] || null,
      path: m[4] || null,
      fullName: `${m[1]}/${repo}`,
      htmlUrl: `https://github.com/${m[1]}/${repo}`,
    };
  }
  return null;
}

async function ghFetch(path, query) {
  const u = new URL(`${GH_API}${path}`);
  if (query && typeof query === "object") {
    for (const [k, v] of Object.entries(query)) {
      if (v != null && v !== "") u.searchParams.set(k, String(v));
    }
  }
  const res = await fetch(u.toString(), {
    headers: ghHeaders(),
    signal: AbortSignal.timeout(15_000),
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text.slice(0, 400) };
  }
  if (!res.ok) {
    const msg = data?.message || `GitHub API ${res.status}`;
    let tip = null;
    if (res.status === 404) {
      tip = "Repo not found or private — set GITHUB_TOKEN on Vercel for private repos.";
    } else if (res.status === 403 || res.status === 429) {
      tip = "GitHub rate limit — add GITHUB_TOKEN on Vercel for higher limits.";
    } else if (res.status === 401) {
      tip = "Invalid GITHUB_TOKEN.";
    }
    return { ok: false, status: res.status, error: "github_api", message: msg, tip };
  }
  return { ok: true, data };
}

export async function loadLinkedRepo(sb, agentId) {
  const fallback = parseGithubRepo(DEFAULT_GITHUB_REPO);
  if (!agentId || typeof sb !== "function") {
    return { ok: true, source: "default", ...fallback };
  }
  try {
    const rows = await sb(
      `x_agent_knowledge?agent_id=eq.${encodeURIComponent(agentId)}&title=eq.${encodeURIComponent(GITHUB_REPO_TITLE)}&order=created_at.desc&limit=1&select=id,content`,
    );
    const row = Array.isArray(rows) ? rows[0] : null;
    if (!row?.content) return { ok: true, source: "default", ...fallback };
    let parsed;
    try {
      parsed = JSON.parse(row.content);
    } catch {
      parsed = { repo: String(row.content).trim() };
    }
    const info = parseGithubRepo(parsed.repo || parsed.url || parsed.fullName);
    if (!info) return { ok: true, source: "default", ...fallback };
    return {
      ok: true,
      source: "user",
      knowledgeId: row.id,
      ref: parsed.ref || info.ref || null,
      branch: parsed.branch || parsed.ref || info.ref || null,
      ...info,
    };
  } catch {
    return { ok: true, source: "default", ...fallback };
  }
}

export async function saveLinkedRepo(sb, { agentId, userId, repoUrl, ref }) {
  const info = parseGithubRepo(repoUrl);
  if (!info) {
    return {
      ok: false,
      error: "invalid_repo",
      message:
        "Pass a GitHub URL or owner/repo (e.g. audifyx/og-scan or https://github.com/audifyx/og-scan).",
    };
  }
  const payload = JSON.stringify({
    repo: info.fullName,
    url: info.htmlUrl,
    ref: ref || info.ref || null,
    updatedAt: new Date().toISOString(),
  });
  const existing = await sb(
    `x_agent_knowledge?agent_id=eq.${encodeURIComponent(agentId)}&title=eq.${encodeURIComponent(GITHUB_REPO_TITLE)}&order=created_at.desc&limit=1&select=id`,
  );
  const row = Array.isArray(existing) ? existing[0] : null;
  if (row?.id) {
    await sb(`x_agent_knowledge?id=eq.${encodeURIComponent(row.id)}`, {
      method: "PATCH",
      body: JSON.stringify({ content: payload }),
      headers: { Prefer: "return=minimal" },
    });
  } else {
    await sb("x_agent_knowledge", {
      method: "POST",
      body: JSON.stringify({
        agent_id: agentId,
        user_id: userId,
        title: GITHUB_REPO_TITLE,
        content: payload,
      }),
      headers: { Prefer: "return=minimal" },
    });
  }
  return {
    ok: true,
    linked: true,
    repo: info.fullName,
    url: info.htmlUrl,
    ref: ref || info.ref || null,
    message: `Linked ${info.fullName}. Use x_repo_read / x_repo_search while drafting — no need to paste the link again.`,
    tools: ["x_repo", "x_repo_read", "x_repo_tree", "x_repo_search", "x_repo_context"],
  };
}

export async function getRepoInfo(linked) {
  const r = await ghFetch(`/repos/${linked.owner}/${linked.repo}`);
  if (!r.ok) return r;
  const d = r.data;
  return {
    ok: true,
    repo: d.full_name,
    url: d.html_url,
    description: d.description || null,
    defaultBranch: d.default_branch,
    private: Boolean(d.private),
    language: d.language || null,
    stars: d.stargazers_count ?? null,
    updatedAt: d.pushed_at || d.updated_at || null,
    topics: d.topics || [],
    source: linked.source || "default",
  };
}

export async function readRepoFile(linked, path, { ref } = {}) {
  const filePath = String(path || "").replace(/^\/+/, "").trim();
  if (!filePath) {
    return { ok: false, error: "path_required", message: "path is required (e.g. README.md)" };
  }
  const branch = ref || linked.ref || linked.branch || undefined;
  const r = await ghFetch(
    `/repos/${linked.owner}/${linked.repo}/contents/${filePath
      .split("/")
      .map(encodeURIComponent)
      .join("/")}`,
    branch ? { ref: branch } : undefined,
  );
  if (!r.ok) return r;
  const d = r.data;
  if (Array.isArray(d)) {
    return {
      ok: true,
      type: "dir",
      path: filePath,
      entries: d.map((e) => ({
        name: e.name,
        path: e.path,
        type: e.type,
        size: e.size,
      })),
    };
  }
  if (d.type !== "file") {
    return { ok: false, error: "not_a_file", message: `${filePath} is not a file` };
  }
  let content = "";
  if (d.encoding === "base64" && d.content) {
    content = Buffer.from(d.content.replace(/\n/g, ""), "base64").toString("utf8");
  } else if (typeof d.content === "string") {
    content = d.content;
  }
  const truncated = content.length > MAX_FILE_CHARS;
  return {
    ok: true,
    type: "file",
    path: d.path || filePath,
    sha: d.sha,
    size: d.size,
    url: d.html_url,
    downloadUrl: d.download_url,
    truncated,
    content: truncated ? content.slice(0, MAX_FILE_CHARS) : content,
    note: truncated ? `Truncated to ${MAX_FILE_CHARS} chars for chat context.` : null,
  };
}

export async function listRepoTree(linked, { path = "", ref, max = 80 } = {}) {
  const info = await getRepoInfo(linked);
  if (!info.ok) return info;
  const branch = ref || linked.ref || linked.branch || info.defaultBranch;
  if (path) {
    return readRepoFile(linked, path, { ref: branch });
  }
  const r = await ghFetch(
    `/repos/${linked.owner}/${linked.repo}/git/trees/${encodeURIComponent(branch)}`,
    { recursive: "1" },
  );
  if (!r.ok) return r;
  const tree = Array.isArray(r.data?.tree) ? r.data.tree : [];
  const limit = Math.min(200, Math.max(20, Number(max) || 80));
  const files = tree
    .filter((t) => t.type === "blob")
    .filter(
      (t) => TEXT_EXT.test(t.path) || /(^|\/)(README|AGENTS|CHANGELOG|LICENSE|docs\/)/i.test(t.path),
    )
    .slice(0, limit)
    .map((t) => ({ path: t.path, size: t.size, type: "file" }));
  return {
    ok: true,
    repo: info.repo,
    branch,
    count: files.length,
    truncated: Boolean(r.data?.truncated),
    files,
    tip: "Use x_repo_read with path to load a file for drafting.",
  };
}

export async function searchRepo(linked, query, { max = 12 } = {}) {
  const q = String(query || "").trim();
  if (!q) return { ok: false, error: "query_required", message: "q is required" };
  const r = await ghFetch("/search/code", {
    q: `${q} repo:${linked.owner}/${linked.repo}`,
    per_page: String(Math.min(30, Math.max(3, Number(max) || 12))),
  });
  if (!r.ok) {
    // Code search often needs auth — fall back to tree filter
    if (r.status === 401 || r.status === 403 || r.status === 422) {
      const tree = await listRepoTree(linked, { max: 120 });
      if (!tree.ok) return r;
      const needle = q.toLowerCase();
      const hits = (tree.files || [])
        .filter((f) => f.path.toLowerCase().includes(needle))
        .slice(0, Number(max) || 12);
      return {
        ok: true,
        mode: "path_filter",
        query: q,
        count: hits.length,
        items: hits.map((f) => ({ path: f.path, url: `${linked.htmlUrl}/blob/HEAD/${f.path}` })),
        tip: r.tip || "GitHub code search needs GITHUB_TOKEN — fell back to path filter.",
      };
    }
    return r;
  }
  const items = (r.data?.items || []).map((it) => ({
    path: it.path,
    name: it.name,
    url: it.html_url,
    sha: it.sha,
  }));
  return { ok: true, mode: "code_search", query: q, count: items.length, items };
}

/** Pull README + AGENTS.md + short file list — ideal before drafting X posts. */
export async function buildRepoContext(linked, { hint } = {}) {
  const info = await getRepoInfo(linked);
  if (!info.ok) return info;

  const candidates = ["README.md", "readme.md", "AGENTS.md", "docs/ORBITX_PLATFORM.md", "CHANGELOG.md"];
  const files = [];
  for (const p of candidates) {
    const f = await readRepoFile(linked, p, { ref: linked.ref || info.defaultBranch });
    if (f.ok && f.type === "file") {
      files.push({
        path: f.path,
        content: String(f.content || "").slice(0, 6000),
        truncated: (f.content || "").length > 6000,
      });
    }
  }

  let searchHits = [];
  if (hint) {
    const s = await searchRepo(linked, hint, { max: 8 });
    if (s.ok) searchHits = s.items || [];
  }

  const markdown = [
    `# Linked repo · ${info.repo}`,
    info.description ? `_${info.description}_` : "",
    `URL · ${info.url}`,
    `Branch · ${info.defaultBranch} · source · ${info.source}`,
    ``,
    `## Snapshot for drafting`,
    ...files.flatMap((f) => [`### \`${f.path}\``, "```", f.content.slice(0, 3500), "```", ""]),
    searchHits.length
      ? `## Hits for “${hint}”\n` + searchHits.map((h) => `- [\`${h.path}\`](${h.url})`).join("\n")
      : "",
    ``,
    `_Live from GitHub. Call x_repo_read for more files. Set/change with x_repo_link._`,
  ]
    .filter(Boolean)
    .join("\n");

  return {
    ok: true,
    __mcpFormat: "markdown",
    markdown,
    repo: info.repo,
    url: info.url,
    defaultBranch: info.defaultBranch,
    source: info.source,
    files: files.map((f) => f.path),
    searchHits,
    instructions: [
      "Use this context when drafting X posts about the product.",
      "Call x_repo_read for specific paths (features, routes, copy).",
      "Do not invent APIs — verify in the repo when unsure.",
    ],
  };
}

/** MCP resources/list entries for the linked repo. */
export function listRepoResources(linked, info) {
  const repo = linked.fullName || `${linked.owner}/${linked.repo}`;
  const branch = linked.ref || linked.branch || info?.defaultBranch || "main";
  return [
    {
      uri: `repo://${repo}`,
      name: repo,
      description: info?.description || `Linked GitHub repo ${repo}`,
      mimeType: "text/markdown",
    },
    {
      uri: `repo://${repo}/README.md`,
      name: "README.md",
      description: `README from ${repo}@${branch}`,
      mimeType: "text/markdown",
    },
    {
      uri: `repo://${repo}/AGENTS.md`,
      name: "AGENTS.md",
      description: `Agent docs from ${repo}`,
      mimeType: "text/markdown",
    },
  ];
}

export function parseRepoResourceUri(uri) {
  const s = String(uri || "").trim();
  const m = s.match(/^repo:\/\/([^/]+)\/([^/]+)(?:\/(.+))?$/);
  if (!m) return null;
  return {
    owner: m[1],
    repo: m[2],
    fullName: `${m[1]}/${m[2]}`,
    htmlUrl: `https://github.com/${m[1]}/${m[2]}`,
    path: m[3] ? decodeURIComponent(m[3]) : "README.md",
  };
}

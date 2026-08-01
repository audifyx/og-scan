/**
 * Grok Imagine only — via kie.ai (KIE_API_KEY).
 * Models: grok-imagine/text-to-image, grok-imagine/text-to-video
 * Never commit API keys.
 *
 * Wait budget stays under Vercel function maxDuration so clients get a JSON
 * soft-return (taskId + pending) instead of an opaque 504 / "server isn't responding".
 */

const KIE_BASE = "https://api.kie.ai/api/v1/jobs";

/** Leave headroom to serialize the MCP response before Vercel kills the function. */
const FN_BUDGET_MS = Math.min(
  Math.max(Number(process.env.ORBITX_FN_BUDGET_MS) || 110_000, 20_000),
  110_000,
);
const KIE_FETCH_TIMEOUT_MS = 20_000;

const GROK_ASPECT = new Set(["2:3", "3:2", "1:1", "9:16", "16:9"]);
const VIDEO_MODES = new Set(["fun", "normal", "spicy"]);
const VIDEO_RES = new Set(["480p", "720p"]);

function apiKey() {
  return (
    process.env.KIE_API_KEY ||
    process.env.GROK_IMAGINE_API_KEY ||
    process.env.KIE_AI_API_KEY ||
    ""
  ).trim();
}

function requireKey() {
  const key = apiKey();
  if (!key) {
    const err = new Error(
      "KIE_API_KEY not configured. Set KIE_API_KEY in Vercel env (https://kie.ai/api-key), then redeploy.",
    );
    err.code = "KIE_API_KEY_MISSING";
    throw err;
  }
  return key;
}

function clampWaitMs(requested) {
  const headroom = 8_000;
  const maxWait = Math.max(5_000, FN_BUDGET_MS - headroom);
  const raw = Number(requested);
  const preferred = Number.isFinite(raw) && raw > 0 ? raw : 90_000;
  return Math.min(Math.max(preferred, 5_000), maxWait);
}

async function kieFetch(url, init = {}) {
  const key = requireKey();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), KIE_FETCH_TIMEOUT_MS);
  let r;
  try {
    r = await fetch(url, {
      ...init,
      signal: ctrl.signal,
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(init.headers || {}),
      },
    });
  } catch (e) {
    clearTimeout(timer);
    const aborted = e?.name === "AbortError" || /aborted/i.test(String(e?.message || e));
    const err = new Error(
      aborted
        ? `kie.ai request timed out after ${KIE_FETCH_TIMEOUT_MS}ms (upstream slow, not OrbitX down).`
        : `kie.ai network error: ${e?.message || e}`,
    );
    err.code = aborted ? "KIE_TIMEOUT" : "KIE_NETWORK";
    throw err;
  }
  clearTimeout(timer);

  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = data?.msg || data?.message || data?.error || `kie.ai HTTP ${r.status}`;
    const err = new Error(msg);
    err.status = r.status;
    err.data = data;
    err.code = "KIE_HTTP";
    throw err;
  }
  if (data?.code && data.code !== 200) {
    const err = new Error(data.msg || `kie.ai error ${data.code}`);
    err.status = data.code;
    err.data = data;
    err.code = "KIE_API";
    throw err;
  }
  return data;
}

export async function createTask({ model, input, callBackUrl }) {
  const body = { model, input };
  if (callBackUrl) body.callBackUrl = callBackUrl;
  const data = await kieFetch(`${KIE_BASE}/createTask`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  const taskId = data?.data?.taskId;
  if (!taskId) {
    const err = new Error("kie.ai createTask returned no taskId");
    err.code = "KIE_NO_TASK";
    throw err;
  }
  return { taskId, raw: data };
}

export async function getTask(taskId) {
  const id = String(taskId || "").trim();
  if (!id) {
    const err = new Error("taskId required");
    err.code = "TASK_ID_REQUIRED";
    throw err;
  }
  const data = await kieFetch(`${KIE_BASE}/recordInfo?taskId=${encodeURIComponent(id)}`);
  return normalizeTask(data?.data || data);
}

function extractUrls(parsed) {
  const urls = [];
  if (!parsed || typeof parsed !== "object") return urls;
  if (Array.isArray(parsed.resultUrls)) {
    for (const u of parsed.resultUrls) {
      if (typeof u === "string") urls.push(u);
      else if (u?.url) urls.push(String(u.url));
    }
  }
  if (typeof parsed.resultUrl === "string") urls.push(parsed.resultUrl);
  if (Array.isArray(parsed.images)) {
    for (const u of parsed.images) {
      if (typeof u === "string") urls.push(u);
      else if (u?.url) urls.push(String(u.url));
    }
  }
  return [...new Set(urls.filter(Boolean))];
}

function normalizeTask(row) {
  if (!row || typeof row !== "object") {
    return { ok: false, state: "unknown", taskId: null, resultUrls: [], imageUrls: [] };
  }
  let resultUrls = [];
  let resultObject = null;
  if (row.resultJson) {
    try {
      const parsed = typeof row.resultJson === "string" ? JSON.parse(row.resultJson) : row.resultJson;
      resultUrls = extractUrls(parsed);
      if (parsed?.resultObject) resultObject = parsed.resultObject;
    } catch {
      /* ignore */
    }
  }
  const state = row.state || "unknown";
  return {
    ok: state === "success",
    taskId: row.taskId,
    model: row.model || "grok-imagine/text-to-image",
    state,
    resultUrls,
    imageUrls: resultUrls,
    resultObject,
    failCode: row.failCode || null,
    failMsg: row.failMsg || null,
    costTime: row.costTime ?? null,
    completeTime: row.completeTime ?? null,
    createTime: row.createTime ?? null,
  };
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Poll until success/fail or timeoutMs. Always returns JSON — never hangs until Vercel 504. */
export async function waitForTask(taskId, { timeoutMs = 90_000, intervalMs = 3_500, startedAt = Date.now() } = {}) {
  const deadline = Math.min(startedAt + timeoutMs, Date.now() + timeoutMs, startedAt + FN_BUDGET_MS - 5_000);
  let last = await getTask(taskId);
  while (Date.now() < deadline) {
    if (last.state === "success" || last.state === "fail") return last;
    const remaining = deadline - Date.now();
    if (remaining < 1_200) break;
    await sleep(Math.min(intervalMs, remaining - 200));
    last = await getTask(taskId);
  }
  if (last.state === "success" || last.state === "fail") return last;
  return {
    ...last,
    ok: false,
    pending: true,
    code: "STILL_GENERATING",
    note: "Still generating on kie.ai — OrbitX is up. Call orbitx_media_status with this taskId (do not treat as server down).",
  };
}

export async function generateImage(args = {}) {
  const startedAt = Date.now();
  const prompt = String(args.prompt || "").trim();
  if (!prompt) {
    const err = new Error("prompt required");
    err.code = "PROMPT_REQUIRED";
    throw err;
  }
  if (prompt.length > 5000) {
    const err = new Error("prompt max 5000 characters");
    err.code = "PROMPT_TOO_LONG";
    throw err;
  }

  const aspect_ratio = GROK_ASPECT.has(args.aspect_ratio) ? args.aspect_ratio : "1:1";
  const enable_pro = args.enable_pro !== false && args.enable_pro !== "false";
  const nsfw_checker = args.nsfw_checker === true || args.nsfw_checker === "true";
  const wait = args.wait !== false && args.wait !== "false";
  const timeoutMs = clampWaitMs(args.waitMs);

  const { taskId } = await createTask({
    model: "grok-imagine/text-to-image",
    input: { prompt, aspect_ratio, enable_pro, nsfw_checker },
    callBackUrl: args.callBackUrl || undefined,
  });

  const mode = enable_pro ? "quality" : "standard";
  const expectedImages = enable_pro ? 4 : 6;

  if (!wait) {
    return {
      ok: true,
      kind: "image",
      taskId,
      state: "waiting",
      provider: "grok-imagine",
      model: "grok-imagine/text-to-image",
      mode,
      aspect_ratio,
      expectedImages,
      instructions: "Call orbitx_media_status with this taskId until state is success or fail.",
    };
  }

  const done = await waitForTask(taskId, { timeoutMs, startedAt });
  return {
    ...done,
    kind: "image",
    provider: "grok-imagine",
    model: "grok-imagine/text-to-image",
    mode,
    aspect_ratio,
    expectedImages,
    waitedMs: Date.now() - startedAt,
    waitBudgetMs: timeoutMs,
    instructions:
      done.state === "success"
        ? "Use resultUrls / imageUrls as the image links."
        : done.state === "fail"
          ? `Grok Imagine failed (kie.ai): ${done.failMsg || done.failCode || "unknown"}. Retry later or simplify the prompt.`
          : "Still generating on kie.ai — call orbitx_media_status with this taskId. This is not an OrbitX outage.",
  };
}

export async function generateVideo(args = {}) {
  const startedAt = Date.now();
  const prompt = String(args.prompt || "").trim();
  if (!prompt) {
    const err = new Error("prompt required");
    err.code = "PROMPT_REQUIRED";
    throw err;
  }
  if (prompt.length > 5000) {
    const err = new Error("prompt max 5000 characters");
    err.code = "PROMPT_TOO_LONG";
    throw err;
  }

  const aspect_ratio = GROK_ASPECT.has(args.aspect_ratio) ? args.aspect_ratio : "16:9";
  const mode = VIDEO_MODES.has(args.mode) ? args.mode : "normal";
  let duration = Number(args.duration);
  if (!Number.isFinite(duration)) duration = 10;
  duration = Math.min(30, Math.max(6, Math.round(duration)));
  const resolution = VIDEO_RES.has(args.resolution) ? args.resolution : "720p";
  const nsfw_checker = args.nsfw_checker === true || args.nsfw_checker === "true";
  const wait = args.wait === true || args.wait === "true";
  const timeoutMs = clampWaitMs(args.waitMs);

  const { taskId } = await createTask({
    model: "grok-imagine/text-to-video",
    input: { prompt, aspect_ratio, mode, duration, resolution, nsfw_checker },
    callBackUrl: args.callBackUrl || undefined,
  });

  if (wait) {
    const done = await waitForTask(taskId, { timeoutMs, startedAt });
    return {
      ...done,
      kind: "video",
      duration,
      resolution,
      mode,
      aspect_ratio,
      provider: "grok-imagine",
      model: "grok-imagine/text-to-video",
      waitedMs: Date.now() - startedAt,
      waitBudgetMs: timeoutMs,
      instructions:
        done.state === "success"
          ? "Use resultUrls[0] as the MP4 URL."
          : done.state === "fail"
            ? `Grok video failed (kie.ai): ${done.failMsg || "unknown"}. Retry later.`
            : "Still generating — poll orbitx_media_status until state=success. Not an OrbitX outage.",
    };
  }

  return {
    ok: true,
    kind: "video",
    taskId,
    state: "waiting",
    duration,
    resolution,
    mode,
    aspect_ratio,
    provider: "grok-imagine",
    model: "grok-imagine/text-to-video",
    instructions: "Call orbitx_media_status with this taskId until state is success or fail.",
  };
}

export function hasApiKey() {
  return Boolean(apiKey());
}

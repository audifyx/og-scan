/**
 * Grok Imagine only — via kie.ai (KIE_API_KEY).
 * Models: grok-imagine/text-to-image, grok-imagine/text-to-video
 * Never commit API keys.
 */

const KIE_BASE = "https://api.kie.ai/api/v1/jobs";

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
    throw new Error(
      "KIE_API_KEY not configured. Set KIE_API_KEY in Vercel env (https://kie.ai/api-key).",
    );
  }
  return key;
}

async function kieFetch(url, init = {}) {
  const key = requireKey();
  const r = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(init.headers || {}),
    },
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = data?.msg || data?.message || data?.error || `kie.ai HTTP ${r.status}`;
    const err = new Error(msg);
    err.status = r.status;
    err.data = data;
    throw err;
  }
  if (data?.code && data.code !== 200) {
    const err = new Error(data.msg || `kie.ai error ${data.code}`);
    err.status = data.code;
    err.data = data;
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
  if (!taskId) throw new Error("kie.ai createTask returned no taskId");
  return { taskId, raw: data };
}

export async function getTask(taskId) {
  const id = String(taskId || "").trim();
  if (!id) throw new Error("taskId required");
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

/** Poll until success/fail or timeoutMs. Grok often sits in waiting 60–120s. */
export async function waitForTask(taskId, { timeoutMs = 100000, intervalMs = 4000 } = {}) {
  const start = Date.now();
  let last = await getTask(taskId);
  while (Date.now() - start < timeoutMs) {
    if (last.state === "success" || last.state === "fail") return last;
    await sleep(intervalMs);
    last = await getTask(taskId);
  }
  return {
    ...last,
    pending: true,
    note: "Still generating — call orbitx_media_status with this taskId.",
  };
}

export async function generateImage(args = {}) {
  const prompt = String(args.prompt || "").trim();
  if (!prompt) throw new Error("prompt required");
  if (prompt.length > 5000) throw new Error("prompt max 5000 characters");

  const aspect_ratio = GROK_ASPECT.has(args.aspect_ratio) ? args.aspect_ratio : "1:1";
  const enable_pro = args.enable_pro !== false && args.enable_pro !== "false";
  const nsfw_checker = args.nsfw_checker === true || args.nsfw_checker === "true";
  const wait = args.wait !== false && args.wait !== "false";
  const timeoutMs = Math.min(Math.max(Number(args.waitMs) || 100000, 20000), 110000);

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

  const done = await waitForTask(taskId, { timeoutMs });
  return {
    ...done,
    kind: "image",
    provider: "grok-imagine",
    model: "grok-imagine/text-to-image",
    mode,
    aspect_ratio,
    expectedImages,
    instructions:
      done.state === "success"
        ? "Use resultUrls / imageUrls as the image links."
        : done.state === "fail"
          ? `Grok Imagine failed: ${done.failMsg || done.failCode || "unknown"}. Retry later or simplify the prompt.`
          : "Still generating — call orbitx_media_status with this taskId until state=success.",
  };
}

export async function generateVideo(args = {}) {
  const prompt = String(args.prompt || "").trim();
  if (!prompt) throw new Error("prompt required");
  if (prompt.length > 5000) throw new Error("prompt max 5000 characters");

  const aspect_ratio = GROK_ASPECT.has(args.aspect_ratio) ? args.aspect_ratio : "16:9";
  const mode = VIDEO_MODES.has(args.mode) ? args.mode : "normal";
  let duration = Number(args.duration);
  if (!Number.isFinite(duration)) duration = 10;
  duration = Math.min(30, Math.max(6, Math.round(duration)));
  const resolution = VIDEO_RES.has(args.resolution) ? args.resolution : "720p";
  const nsfw_checker = args.nsfw_checker === true || args.nsfw_checker === "true";
  const wait = args.wait === true || args.wait === "true";

  const { taskId } = await createTask({
    model: "grok-imagine/text-to-video",
    input: { prompt, aspect_ratio, mode, duration, resolution, nsfw_checker },
    callBackUrl: args.callBackUrl || undefined,
  });

  if (wait) {
    const done = await waitForTask(taskId, { timeoutMs: Number(args.waitMs) || 100000 });
    return {
      ...done,
      kind: "video",
      duration,
      resolution,
      mode,
      aspect_ratio,
      provider: "grok-imagine",
      model: "grok-imagine/text-to-video",
      instructions:
        done.state === "success"
          ? "Use resultUrls[0] as the MP4 URL."
          : done.state === "fail"
            ? `Grok video failed: ${done.failMsg || "unknown"}. Retry later.`
            : "Poll with orbitx_media_status until state=success.",
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

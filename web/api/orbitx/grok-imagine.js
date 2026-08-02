/**
 * Image + video generation via kie.ai for OrbitX MCP.
 * Prefers Grok Imagine; falls back to Flux-2 when Grok capacity fails.
 * API key from env only: KIE_API_KEY (never commit).
 */

const KIE_BASE = "https://api.kie.ai/api/v1/jobs";

const GROK_ASPECT = new Set(["2:3", "3:2", "1:1", "9:16", "16:9"]);
const FLUX_ASPECT = new Set(["1:1", "4:3", "3:4", "16:9", "9:16", "3:2", "2:3"]);
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
      "KIE_API_KEY not configured. Set KIE_API_KEY in Vercel project env (kie.ai API key from https://kie.ai/api-key).",
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
    model: row.model,
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

function isCapacityFail(taskOrErr) {
  const msg = String(taskOrErr?.failMsg || taskOrErr?.message || taskOrErr || "").toLowerCase();
  return (
    msg.includes("no available user account") ||
    msg.includes("no available") ||
    msg.includes("capacity") ||
    msg.includes("service unavailable") ||
    msg.includes("overloaded")
  );
}

/** Poll until success/fail or timeoutMs. */
export async function waitForTask(taskId, { timeoutMs = 55000, intervalMs = 3000 } = {}) {
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

function mapFluxAspect(ratio) {
  if (FLUX_ASPECT.has(ratio)) return ratio;
  if (ratio === "2:3" || ratio === "3:2" || ratio === "1:1" || ratio === "16:9" || ratio === "9:16") {
    return ratio;
  }
  return "1:1";
}

async function generateGrokImage(args, aspect_ratio, enable_pro, nsfw_checker) {
  const { taskId } = await createTask({
    model: "grok-imagine/text-to-image",
    input: {
      prompt: String(args.prompt || "").trim(),
      aspect_ratio,
      enable_pro,
      nsfw_checker,
    },
    callBackUrl: args.callBackUrl || undefined,
  });
  return { taskId, provider: "grok-imagine", mode: enable_pro ? "quality" : "standard" };
}

async function generateFluxImage(args, aspect_ratio, nsfw_checker) {
  const { taskId } = await createTask({
    model: "flux-2/pro-text-to-image",
    input: {
      prompt: String(args.prompt || "").trim(),
      aspect_ratio: mapFluxAspect(aspect_ratio),
      resolution: args.resolution === "2K" ? "2K" : "1K",
      nsfw_checker,
    },
    callBackUrl: args.callBackUrl || undefined,
  });
  return { taskId, provider: "flux-2", mode: "flux-pro" };
}

export async function generateImage(args = {}) {
  const prompt = String(args.prompt || "").trim();
  if (!prompt) throw new Error("prompt required");
  if (prompt.length > 5000) throw new Error("prompt max 5000 characters");

  const aspect_ratio = GROK_ASPECT.has(args.aspect_ratio) ? args.aspect_ratio : "1:1";
  const enable_pro = args.enable_pro !== false && args.enable_pro !== "false";
  const nsfw_checker = args.nsfw_checker === true || args.nsfw_checker === "true";
  // Default wait so MCP clients get URLs in one round-trip when possible.
  const wait = args.wait !== false && args.wait !== "false";
  const timeoutMs = Math.min(Number(args.waitMs) || 55000, 110000);
  const prefer = String(args.model || args.provider || "auto").toLowerCase();

  let created = null;
  let fallbackNote = null;

  const tryGrok = prefer === "auto" || prefer === "grok" || prefer === "grok-imagine";
  const tryFlux = prefer === "auto" || prefer === "flux" || prefer === "flux-2";

  if (tryGrok && prefer !== "flux") {
    try {
      created = await generateGrokImage(args, aspect_ratio, enable_pro, nsfw_checker);
      if (wait) {
        const done = await waitForTask(created.taskId, { timeoutMs });
        if (done.state === "success") {
          return {
            ...done,
            kind: "image",
            provider: created.provider,
            mode: created.mode,
            aspect_ratio,
            expectedImages: enable_pro ? 4 : 6,
            instructions: "Use resultUrls / imageUrls as the image links.",
          };
        }
        if (done.state === "fail" && tryFlux && isCapacityFail(done)) {
          fallbackNote = done.failMsg || "Grok Imagine capacity unavailable";
          created = null;
        } else if (done.state === "fail") {
          return {
            ...done,
            ok: false,
            kind: "image",
            provider: created.provider,
            error: done.failMsg || "image generation failed",
            instructions: "Retry with model=flux, or try a different prompt.",
          };
        } else {
          // still pending on grok — return task for polling (don't silent-fallback mid-queue)
          return {
            ...done,
            kind: "image",
            provider: created.provider,
            mode: created.mode,
            aspect_ratio,
            expectedImages: enable_pro ? 4 : 6,
            instructions: "Call orbitx_media_status with this taskId until state is success or fail.",
          };
        }
      }
    } catch (e) {
      if (tryFlux && (isCapacityFail(e) || /503|455|501|500/.test(String(e.status || "")))) {
        fallbackNote = e.message;
        created = null;
      } else {
        throw e;
      }
    }
  }

  if (!created && tryFlux) {
    created = await generateFluxImage(args, aspect_ratio, nsfw_checker);
    if (fallbackNote) {
      /* keep */
    }
  }

  if (!created) throw new Error("Could not start image generation (no provider available)");

  if (wait) {
    const done = await waitForTask(created.taskId, { timeoutMs });
    return {
      ...done,
      kind: "image",
      provider: created.provider,
      mode: created.mode,
      aspect_ratio,
      fallbackFromGrok: Boolean(fallbackNote),
      fallbackNote: fallbackNote || undefined,
      instructions:
        done.state === "success"
          ? "Use resultUrls / imageUrls as the image links."
          : done.state === "fail"
            ? `Generation failed: ${done.failMsg || "unknown"}. Retry or change prompt.`
            : "Call orbitx_media_status with this taskId until state is success or fail.",
    };
  }

  return {
    ok: true,
    kind: "image",
    taskId: created.taskId,
    state: "waiting",
    provider: created.provider,
    mode: created.mode,
    aspect_ratio,
    fallbackFromGrok: Boolean(fallbackNote),
    fallbackNote: fallbackNote || undefined,
    instructions: "Call orbitx_media_status with this taskId until state is success or fail.",
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
    const done = await waitForTask(taskId, { timeoutMs: Number(args.waitMs) || 90000 });
    return {
      ...done,
      kind: "video",
      duration,
      resolution,
      mode,
      aspect_ratio,
      provider: "grok-imagine",
      instructions:
        done.state === "success"
          ? "Use resultUrls[0] as the MP4 URL."
          : done.state === "fail"
            ? `Video failed: ${done.failMsg || "unknown"}. Grok video capacity may be limited — retry later.`
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
    instructions: "Call orbitx_media_status with this taskId until state is success or fail.",
  };
}

export function hasApiKey() {
  return Boolean(apiKey());
}

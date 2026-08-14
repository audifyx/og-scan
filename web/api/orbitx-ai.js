/**
 * OrbitX AI first-party backend.
 *
 * Auth: Supabase JWT.
 * Access: authoritative SIWS wallet identity holding >= $5 ORBITX, with the
 * existing owner/platform exemptions.
 * Intelligence: NVIDIA NIM with the live OrbitX MCP tool catalog.
 * Media: Grok Imagine through the existing MCP media implementation.
 */
import {
  adminClient,
  clientIp,
  handleOptions,
  json,
  memoryRateLimit,
  requireUser,
} from "./orbitx/ai-runtime.js";
import {
  isEmbeddedAgentToolReadOnly,
  listEmbeddedAgentTools,
  runEmbeddedAgentTool,
} from "./orbitx-hub.js";
import { readOpenAiChatResponse } from "./orbitx/ai-stream.js";
import { verifyTokenHold } from "./orbitx/token-hold.js";
import {
  DEFAULT_NIM_MODEL,
  NIM_MODELS,
} from "./orbitx/x-agent-lib.js";

export const config = { maxDuration: 120 };

const NVIDIA_BASE =
  process.env.NVIDIA_BASE_URL || "https://integrate.api.nvidia.com/v1";
const MAX_PROMPT = 12_000;
const MAX_TOOL_LOOPS = 3;
const MAX_TOOL_STORAGE_CHARS = 60_000;
const MAX_TOOL_MODEL_CHARS = 16_000;
const NVIDIA_TIMEOUT_MS = 30_000;
const TOOL_TIMEOUT_MS = 22_000;
const CHAT_DEADLINE_MS = 108_000;
const CONFIRMATION_TTL_MS = 15 * 60_000;
const FALLBACK_PUBLIC_BASE = "https://www.orbitx.world";
const MEDIA_ASPECTS = new Set(["2:3", "3:2", "1:1", "9:16", "16:9"]);
const VIDEO_MODES = new Set(["fun", "normal", "spicy"]);

const DIRECT_TOOL_NAMES = new Set([
  "orbitx_menu",
  "orbitx_whoami",
  "orbitx_search",
  "orbitx_get_token",
  "orbitx_screen_tokens",
  "orbitx_get_forensics",
  "orbitx_get_safety",
  "orbitx_crypto_scan",
  "orbitx_get_ath",
  "orbitx_get_chart",
  "orbitx_dex_chart",
  "orbitx_get_wallet",
  "orbitx_get_swaps",
  "orbitx_get_balance",
  "orbitx_get_kols",
  "orbitx_get_traders",
  "orbitx_get_signals",
  "orbitx_get_launches",
  "orbitx_social_communities",
  "orbitx_social_feed",
  "orbitx_nft_collections",
  "orbitx_nft_items",
  "orbitx_nft_listings",
  "orbitx_xray",
  "orbitx_research",
  "orbitx_leaderboard",
  "orbitx_dex_listings",
  "orbitx_platform_stats",
  "orbitx_get_metadata",
  "orbitx_boosts",
  "orbitx_health",
  "orbitx_config",
  "orbitx_report_url",
  "orbitx_open_dex",
  "orbitx_tools_help",
]);
const BLOCKED_EMBEDDED_TOOLS = new Set([
  // The first-party app already has an authoritative Supabase/SIWS session.
  // Minting connector auth codes here would unnecessarily persist credentials
  // in chat tool events.
  "orbitx_auth_link",
]);

const SYSTEM_PROMPT = `You are OrbitX AI, the first-party crypto copilot inside OrbitX.

You have live OrbitX MCP tools for token research, wallets, charts, trading handoffs,
launches, NFTs, social, generated media, and platform data. Use tools whenever live
data is useful. For a contract address plus "chart", call orbitx_dex_chart immediately.
You can reach the complete MCP catalog through two router tools. If the capability is
not in the direct tool list, call orbitx_tool_search with a concise capability query,
then call orbitx_command with the exact returned tool name and its matching arguments.
Never claim a capability is unavailable before searching the full catalog.

Safety:
- Never ask for a seed phrase or private key.
- Never claim a transaction was sent unless a tool result or wallet signature confirms it.
- Financial/write actions require an explicit confirmation card in the UI.
- To send SOL or tokens, direct the user to the Send action in this chat; wallet signing
  remains non-custodial.
- Keep answers concise and mobile-readable. Explain risks without hype.
- When tool data is incomplete, say what is missing instead of inventing values.

The Image Center uses Grok Imagine. The X Studio connects the user's own X account and
uses the existing NVIDIA X agent.`;

const AGENT_MODE_DIRECTIVES = {
  research:
    "Active mode: Research. Prioritize orbitx_get_token, orbitx_get_safety, orbitx_get_forensics, orbitx_research, orbitx_xray, and orbitx_dex_chart. Lead with facts, risks, and missing data.",
  trade:
    "Active mode: Trade desk. Prioritize live charts, liquidity, volume, wallet balances, and prepare-trade tools. Never claim a transaction was sent. Write actions stay on confirmation cards.",
  create:
    "Active mode: Create. Shape vivid visual direction and prefer image/video tools when the user wants media.",
  social:
    "Active mode: Social. Prefer feed, community, and X-ready copy. Keep posts punchy, useful, and non-hypey.",
};

function modeDirective(value) {
  return AGENT_MODE_DIRECTIVES[text(value, 20)] || "";
}

function parseBody(req) {
  if (!req.body) return {};
  if (typeof req.body === "object") return req.body;
  try {
    return JSON.parse(String(req.body));
  } catch {
    throw Object.assign(new Error("invalid_json"), { status: 400 });
  }
}

function text(value, max = 5000) {
  return String(value || "").trim().slice(0, max);
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || ""),
  );
}

function objectValue(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function trustedPublicBase() {
  const configured =
    process.env.PUBLIC_APP_URL ||
    process.env.VITE_PUBLIC_APP_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    process.env.VERCEL_URL ||
    FALLBACK_PUBLIC_BASE;
  const withProtocol = /^https?:\/\//i.test(configured)
    ? configured
    : `https://${configured}`;
  try {
    const parsed = new URL(withProtocol);
    const isLocal = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
    if (parsed.protocol !== "https:" && !(isLocal && parsed.protocol === "http:")) {
      return FALLBACK_PUBLIC_BASE;
    }
    if (parsed.hostname === "orbitx.world") parsed.hostname = "www.orbitx.world";
    return parsed.origin;
  } catch {
    return FALLBACK_PUBLIC_BASE;
  }
}

function modelId(requested) {
  const candidate = text(requested, 160);
  return NIM_MODELS.some((model) => model.id === candidate)
    ? candidate
    : DEFAULT_NIM_MODEL;
}

function requiresConfirmation(name) {
  const normalized = String(name || "");
  return (
    normalized !== "orbitx_tool_search" &&
    !DIRECT_TOOL_NAMES.has(normalized) &&
    !isEmbeddedAgentToolReadOnly(normalized)
  );
}

function toolCategory(name) {
  const normalized = String(name || "").toLowerCase();
  if (normalized.includes("nft")) return "NFT";
  if (
    normalized.includes("social") ||
    normalized.includes("community") ||
    normalized.includes("feed") ||
    normalized.includes("post")
  ) return "Social";
  if (
    normalized.includes("image") ||
    normalized.includes("video") ||
    normalized.includes("media")
  ) return "Media";
  if (
    normalized.includes("launch") ||
    normalized.includes("mint") ||
    normalized.includes("vanity") ||
    normalized.includes("create_token")
  ) return "Launch";
  if (
    normalized.includes("buy") ||
    normalized.includes("sell") ||
    normalized.includes("trade") ||
    normalized.includes("swap") ||
    normalized.includes("claim") ||
    normalized.includes("burn") ||
    normalized.includes("rent")
  ) return "Trade";
  if (
    normalized.includes("wallet") ||
    normalized.includes("balance") ||
    normalized.includes("credits")
  ) return "Wallet";
  if (
    normalized.includes("token") ||
    normalized.includes("chart") ||
    normalized.includes("scan") ||
    normalized.includes("safety") ||
    normalized.includes("forensic") ||
    normalized.includes("research") ||
    normalized.includes("signal") ||
    normalized.includes("trader") ||
    normalized.includes("kol") ||
    normalized.includes("ath") ||
    normalized.includes("xray") ||
    normalized.includes("leaderboard") ||
    normalized.includes("boost")
  ) return "Markets";
  return "Platform";
}

let cachedToolCatalog = null;

function toolCatalog() {
  if (cachedToolCatalog) return cachedToolCatalog;
  cachedToolCatalog = listEmbeddedAgentTools({ includeGenerated: true })
    .filter((tool) => !BLOCKED_EMBEDDED_TOOLS.has(tool.name))
    .map((tool) => {
      const schema = objectValue(tool.inputSchema);
      const properties = objectValue(schema.properties);
      const required = new Set(Array.isArray(schema.required) ? schema.required : []);
      return {
        name: text(tool.name, 160),
        description: text(tool.description, 500),
        category: toolCategory(tool.name),
        requiresConfirmation: requiresConfirmation(tool.name),
        parameters: Object.entries(properties).slice(0, 16).map(([name, definition]) => {
          const parameter = objectValue(definition);
          return {
            name: text(name, 80),
            type: text(parameter.type, 40) || "value",
            description: text(parameter.description, 180),
            required: required.has(name),
            options: Array.isArray(parameter.enum)
              ? parameter.enum.map((option) => text(option, 80)).filter(Boolean).slice(0, 20)
              : [],
          };
        }),
      };
    })
    .sort((left, right) =>
      left.category.localeCompare(right.category) || left.name.localeCompare(right.name)
    );
  return cachedToolCatalog;
}

function searchToolCatalog(value) {
  const query = text(value, 240).toLowerCase();
  const terms = query.split(/[^a-z0-9]+/).filter(Boolean);
  const scored = toolCatalog()
    .map((tool) => {
      const name = tool.name.toLowerCase();
      const description = tool.description.toLowerCase();
      let score = query && name === query ? 100 : 0;
      if (query && name.includes(query)) score += 40;
      if (query && description.includes(query)) score += 20;
      for (const term of terms) {
        if (name.includes(term)) score += 8;
        if (description.includes(term)) score += 3;
      }
      return { tool, score };
    })
    .filter(({ score }) => !query || score > 0)
    .sort(
      (left, right) =>
        right.score - left.score || left.tool.name.localeCompare(right.tool.name),
    )
    .slice(0, 24)
    .map(({ tool }) => ({
      name: tool.name,
      description: tool.description,
      requiresConfirmation: tool.requiresConfirmation,
      parameters: tool.parameters,
    }));
  return {
    ok: true,
    query,
    totalAvailable: toolCatalog().length,
    matches: scored,
    message: scored.length
      ? `Found ${scored.length} matching OrbitX MCP tools.`
      : "No exact match. Try a broader capability query.",
  };
}

function normalizedMediaSettings(kind, value) {
  const source = objectValue(value);
  const aspectCandidate = text(source.aspect_ratio, 12);
  const aspectRatio = MEDIA_ASPECTS.has(aspectCandidate)
    ? aspectCandidate
    : kind === "video"
      ? "16:9"
      : "1:1";
  if (kind === "image") {
    return {
      aspect_ratio: aspectRatio,
      enable_pro: source.enable_pro !== false,
      nsfw_checker: true,
    };
  }
  const modeCandidate = text(source.mode, 20);
  const durationCandidate = Number(source.duration);
  return {
    aspect_ratio: aspectRatio,
    mode: VIDEO_MODES.has(modeCandidate) ? modeCandidate : "normal",
    duration: Number.isFinite(durationCandidate)
      ? Math.min(30, Math.max(6, Math.round(durationCandidate)))
      : 10,
    resolution: "720p",
    nsfw_checker: true,
  };
}

function jsonSafe(value, maxChars = MAX_TOOL_STORAGE_CHARS) {
  try {
    const serialized = JSON.stringify(value);
    if (serialized.length <= maxChars) return JSON.parse(serialized);
    return {
      truncated: true,
      preview: serialized.slice(0, maxChars),
      originalChars: serialized.length,
    };
  } catch {
    return { error: "Tool result could not be serialized" };
  }
}

function confirmationArgs(value) {
  try {
    const serialized = JSON.stringify(objectValue(value));
    if (serialized.length > MAX_TOOL_STORAGE_CHARS) {
      return {
        ok: false,
        value: {},
        error: `Tool arguments exceed the ${MAX_TOOL_STORAGE_CHARS}-character confirmation limit.`,
      };
    }
    return { ok: true, value: JSON.parse(serialized), error: null };
  } catch {
    return {
      ok: false,
      value: {},
      error: "Tool arguments could not be saved safely for confirmation.",
    };
  }
}

function modelToolResult(value) {
  const serialized = JSON.stringify(jsonSafe(value, MAX_TOOL_MODEL_CHARS));
  return serialized.slice(0, MAX_TOOL_MODEL_CHARS);
}

function mapConversation(row) {
  return {
    id: row.id,
    title: row.title,
    model: row.model,
    walletAddress: row.wallet_address,
    archived: Boolean(row.archived),
    metadata: row.metadata || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapMessage(row) {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    role: row.role,
    content: row.content,
    model: row.model,
    toolEvents: Array.isArray(row.tool_events) ? row.tool_events : [],
    metadata: row.metadata || {},
    createdAt: row.created_at,
  };
}

function mapGeneration(row) {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    kind: row.kind,
    prompt: row.prompt,
    provider: row.provider,
    model: row.model,
    taskId: row.task_id,
    status: row.status,
    resultUrls: Array.isArray(row.result_urls) ? row.result_urls : [],
    error: row.error,
    settings: row.settings || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
  };
}

async function authenticatedContext(req) {
  const { id, client } = await requireUser(req);
  const { data: authData, error: authError } = await client.auth.getUser();
  if (authError || !authData.user) {
    throw Object.assign(new Error("unauthorized"), { status: 401 });
  }

  const db = adminClient();
  const { data: identity, error: identityError } = await db
    .from("wallet_identities")
    .select("wallet")
    .eq("user_id", id)
    .maybeSingle();
  if (identityError) {
    throw Object.assign(new Error(identityError.message), { status: 500 });
  }

  const email = authData.user.email || null;
  const walletAddress = identity?.wallet || null;
  const gate = await verifyTokenHold(walletAddress, trustedPublicBase(), {
    email,
    requireUsdPrice: true,
  });

  return {
    userId: id,
    email,
    walletAddress,
    gate: {
      ...gate,
      hasAccess: Boolean(gate.meetsRequirement || gate.exempt),
    },
    db,
  };
}

function requireAccess(ctx) {
  if (ctx.gate.hasAccess) return;
  const error = new Error(ctx.gate.message || "ORBITX hold required");
  error.status = 403;
  error.payload = ctx.gate;
  throw error;
}

function rateLimit(req, userId, bucket, max, windowMs) {
  const result = memoryRateLimit(
    `orbitx-ai:${bucket}:${userId}:${clientIp(req)}`,
    max,
    windowMs,
  );
  if (!result.limited) return;
  const error = new Error("Too many requests. Please slow down.");
  error.status = 429;
  error.retryAfter = result.retryAfter;
  throw error;
}

async function ensureConversation(ctx, requestedId, firstMessage, requestedModel) {
  const id = text(requestedId, 80);
  if (id) {
    const { data, error } = await ctx.db
      .from("ai_conversations")
      .select("*")
      .eq("id", id)
      .eq("user_id", ctx.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw Object.assign(new Error("Conversation not found"), { status: 404 });
    return data;
  }

  const title =
    firstMessage.length > 52
      ? `${firstMessage.slice(0, 49).trim()}…`
      : firstMessage || "New conversation";
  const { data, error } = await ctx.db
    .from("ai_conversations")
    .insert({
      user_id: ctx.userId,
      wallet_address: ctx.walletAddress,
      title,
      model: modelId(requestedModel),
    })
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message || "Could not create conversation");
  return data;
}

async function loadMessages(ctx, conversationId, limit = 60) {
  const { data, error } = await ctx.db
    .from("ai_messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .eq("user_id", ctx.userId)
    .order("created_at", { ascending: true })
    .limit(Math.min(100, Math.max(1, Number(limit) || 60)));
  if (error) throw new Error(error.message);
  return data || [];
}

function directTools() {
  const tools = listEmbeddedAgentTools()
    .filter((tool) => DIRECT_TOOL_NAMES.has(tool.name))
    .map((tool) => ({
      type: "function",
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.inputSchema || { type: "object", properties: {} },
      },
    }));

  tools.push({
    type: "function",
    function: {
      name: "orbitx_tool_search",
      description:
        "Search the complete live OrbitX MCP catalog by capability. Use this before orbitx_command whenever the exact tool name or required arguments are unknown.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Concise capability query such as Base 1h chart, create token, NFT bid, or social post",
          },
        },
        required: ["query"],
        additionalProperties: false,
      },
    },
  });
  tools.push({
    type: "function",
    function: {
      name: "orbitx_command",
      description:
        "Call any live OrbitX MCP tool by exact name. Use orbitx_tools_help first when unsure. Write, launch, trade, social, and NFT mutation tools return a confirmation card before execution.",
      parameters: {
        type: "object",
        properties: {
          tool: { type: "string", description: "Exact OrbitX MCP tool name" },
          arguments: {
            type: "object",
            description: "Arguments matching that tool's schema",
            additionalProperties: true,
          },
        },
        required: ["tool"],
        additionalProperties: false,
      },
    },
  });
  return tools;
}

function routingTools() {
  return directTools().filter(({ function: definition }) =>
    ["orbitx_tool_search", "orbitx_command"].includes(definition.name)
  );
}

async function callNvidia(
  messages,
  model,
  tools,
  { stream = false, onContent, timeoutMs = NVIDIA_TIMEOUT_MS } = {},
) {
  const key = process.env.NVIDIA_API_KEY || "";
  if (!key) {
    throw Object.assign(new Error("NVIDIA_API_KEY is not configured"), { status: 503 });
  }
  const response = await fetch(`${NVIDIA_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      messages,
      ...(tools?.length ? { tools, tool_choice: "auto" } : {}),
      temperature: 0.55,
      max_tokens: 1800,
      stream,
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (stream && response.ok) {
    return readOpenAiChatResponse(response, { onContent });
  }
  const raw = await response.text();
  let parsed = {};
  try {
    parsed = raw ? JSON.parse(raw) : {};
  } catch {
    parsed = {};
  }
  if (!response.ok) {
    const message =
      parsed?.error?.message || raw.slice(0, 300) || `NVIDIA error ${response.status}`;
    throw Object.assign(new Error(message), { status: 502 });
  }
  const message = parsed?.choices?.[0]?.message;
  if (!message) {
    throw Object.assign(new Error("NVIDIA returned no assistant message"), { status: 502 });
  }
  return message;
}

async function withTimeout(promise, timeoutMs, message) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          reject(Object.assign(new Error(message), { status: 504 }));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function resolveToolCall(call) {
  const functionName = text(call?.function?.name, 160);
  let args = {};
  try {
    args = objectValue(JSON.parse(call?.function?.arguments || "{}"));
  } catch {
    args = {};
  }
  if (functionName !== "orbitx_command") {
    return { name: functionName, args };
  }
  return {
    name: text(args.tool, 160),
    args: objectValue(args.arguments),
  };
}

async function runChat(
  ctx,
  conversation,
  rows,
  selectedModel,
  req,
  { onStatus, onDelta, onReset, onToolEvent, mode } = {},
) {
  const history = rows.slice(-42).map((row) => ({
    role: row.role === "tool" ? "assistant" : row.role,
    content: row.content,
  }));
  const messages = [{ role: "system", content: SYSTEM_PROMPT }];
  const directive = modeDirective(mode);
  if (directive) messages.push({ role: "system", content: directive });
  messages.push(...history);
  const tools = directTools();
  const toolEvents = [];
  const deadline = Date.now() + CHAT_DEADLINE_MS;
  let finalContent = "";

  const modelTimeout = () => {
    const remaining = deadline - Date.now();
    if (remaining < 1_500) {
      throw Object.assign(new Error("OrbitX AI reached its response deadline"), {
        status: 504,
      });
    }
    return Math.min(NVIDIA_TIMEOUT_MS, remaining);
  };
  const callModel = async (toolSet) => {
    let streamed = false;
    const assistant = await callNvidia(messages, selectedModel, toolSet, {
      stream: Boolean(onDelta),
      timeoutMs: modelTimeout(),
      onContent: (chunk) => {
        streamed = true;
        onDelta?.(chunk);
      },
    });
    return { assistant, streamed };
  };

  for (let iteration = 0; iteration < MAX_TOOL_LOOPS; iteration += 1) {
    onStatus?.(iteration === 0 ? "Reading your request…" : "Analyzing live tool results…");
    let response;
    try {
      response = await callModel(tools);
    } catch (error) {
      if (iteration !== 0) throw error;
      onReset?.();
      onStatus?.("Switching to the lightweight MCP router…");
      try {
        response = await callModel(routingTools());
      } catch {
        onReset?.();
        onStatus?.("Connecting without tool schemas…");
        response = await callModel([]);
      }
    }

    const { assistant, streamed } = response;
    const calls = Array.isArray(assistant.tool_calls) ? assistant.tool_calls : [];
    if (!calls.length) {
      finalContent = text(assistant.content, 100_000);
      break;
    }
    if (streamed) onReset?.();

    messages.push({
      role: "assistant",
      content: assistant.content || null,
      tool_calls: calls,
    });

    const iterationEvents = await Promise.all(calls.map(async (call) => {
      const resolved = resolveToolCall(call);
      const confirmableArgs = confirmationArgs(resolved.args);
      const event = {
        id: crypto.randomUUID(),
        tool: resolved.name,
        args: confirmableArgs.ok
          ? confirmableArgs.value
          : jsonSafe(resolved.args, 20_000),
        status: "completed",
        result: null,
      };

      onStatus?.(
        resolved.name === "orbitx_tool_search"
          ? "Searching all OrbitX MCP tools…"
          : `Running ${resolved.name || "OrbitX tool"}…`,
      );
      if (!resolved.name) {
        event.status = "failed";
        event.result = { error: "Tool name missing" };
      } else if (resolved.name === "orbitx_tool_search") {
        event.result = searchToolCatalog(resolved.args.query);
      } else if (BLOCKED_EMBEDDED_TOOLS.has(resolved.name)) {
        event.status = "failed";
        event.result = {
          error: "This connector-auth action is unavailable inside OrbitX AI.",
          message: "Use the connected wallet session or the dedicated Agent connector page.",
        };
      } else if (requiresConfirmation(resolved.name) && !confirmableArgs.ok) {
        event.status = "failed";
        event.result = { error: confirmableArgs.error };
      } else if (requiresConfirmation(resolved.name)) {
        event.status = "confirmation_required";
        event.expiresAt = new Date(Date.now() + CONFIRMATION_TTL_MS).toISOString();
        event.result = {
          message: "Review and confirm this action in OrbitX AI before it runs.",
        };
      } else {
        try {
          const result = await withTimeout(
            runEmbeddedAgentTool({
              userId: ctx.userId,
              walletAddress: ctx.walletAddress,
              email: ctx.email,
              toolName: resolved.name,
              args: resolved.args,
              req,
            }),
            Math.min(TOOL_TIMEOUT_MS, Math.max(1_500, deadline - Date.now())),
            `${resolved.name} timed out`,
          );
          event.result = jsonSafe(result);
          if (result?.ok === false) event.status = "failed";
        } catch (error) {
          event.status = "failed";
          event.result = {
            error: error instanceof Error ? error.message : "OrbitX tool failed",
          };
        }
      }

      onToolEvent?.(event);
      return { call, event };
    }));

    for (const { call, event } of iterationEvents) {
      toolEvents.push(event);
      messages.push({
        role: "tool",
        tool_call_id: call.id,
        name: call?.function?.name,
        content: modelToolResult({
          status: event.status,
          tool: event.tool,
          result: event.result,
        }),
      });
    }
  }

  if (!finalContent) {
    onStatus?.("Writing the answer…");
    const last = await callNvidia(
      [
        ...messages,
        {
          role: "system",
          content: "Return the final user-facing answer now. Do not call more tools.",
        },
      ],
      selectedModel,
      [],
      {
        stream: Boolean(onDelta),
        timeoutMs: modelTimeout(),
        onContent: onDelta,
      },
    );
    finalContent = text(last.content, 100_000);
  }

  return {
    content:
      finalContent ||
      "I finished the OrbitX tool run, but the model returned no summary. The result cards are below.",
    toolEvents,
    conversation,
  };
}

async function handleBootstrap(req, res, ctx) {
  requireAccess(ctx);
  const [{ data: conversations, error: conversationError }, { data: generations, error: generationError }] =
    await Promise.all([
      ctx.db
        .from("ai_conversations")
        .select("*")
        .eq("user_id", ctx.userId)
        .eq("archived", false)
        .order("updated_at", { ascending: false })
        .limit(30),
      ctx.db
        .from("ai_generations")
        .select("*")
        .eq("user_id", ctx.userId)
        .order("created_at", { ascending: false })
        .limit(36),
    ]);
  if (conversationError) throw new Error(conversationError.message);
  if (generationError) throw new Error(generationError.message);
  return json(res, {
    ok: true,
    gate: ctx.gate,
    walletAddress: ctx.walletAddress,
    models: NIM_MODELS,
    defaultModel: DEFAULT_NIM_MODEL,
    conversations: (conversations || []).map(mapConversation),
    generations: (generations || []).map(mapGeneration),
    tools: toolCatalog(),
  });
}

async function handleMessages(req, res, ctx) {
  requireAccess(ctx);
  const conversationId = text(req.query.conversationId, 80);
  if (!conversationId) return json(res, { error: "conversationId_required" }, 400);
  const conversation = await ensureConversation(ctx, conversationId, "", "");
  const rows = await loadMessages(ctx, conversation.id);
  return json(res, {
    conversation: mapConversation(conversation),
    messages: rows.map(mapMessage),
  });
}

async function handleChat(req, res, ctx, body) {
  requireAccess(ctx);
  rateLimit(req, ctx.userId, "chat", 30, 60_000);
  const prompt = text(body.message, MAX_PROMPT);
  if (!prompt) return json(res, { error: "message_required" }, 400);

  const selectedModel = modelId(body.model);
  const conversation = await ensureConversation(
    ctx,
    body.conversationId,
    prompt,
    selectedModel,
  );
  const { data: userMessage, error: insertError } = await ctx.db
    .from("ai_messages")
    .insert({
      conversation_id: conversation.id,
      user_id: ctx.userId,
      role: "user",
      content: prompt,
      model: selectedModel,
    })
    .select("*")
    .single();
  if (insertError || !userMessage) {
    throw new Error(insertError?.message || "Could not save message");
  }

  const rows = await loadMessages(ctx, conversation.id);
  const result = await runChat(ctx, conversation, rows, selectedModel, req, {
    mode: body.mode,
  });
  const now = new Date().toISOString();
  const { data: assistantMessage, error: assistantError } = await ctx.db
    .from("ai_messages")
    .insert({
      conversation_id: conversation.id,
      user_id: ctx.userId,
      role: "assistant",
      content: result.content,
      model: selectedModel,
      tool_events: result.toolEvents,
    })
    .select("*")
    .single();
  if (assistantError || !assistantMessage) {
    throw new Error(assistantError?.message || "Could not save assistant message");
  }

  await ctx.db
    .from("ai_conversations")
    .update({ model: selectedModel, updated_at: now })
    .eq("id", conversation.id)
    .eq("user_id", ctx.userId);

  return json(res, {
    ok: true,
    conversation: mapConversation({ ...conversation, model: selectedModel, updated_at: now }),
    userMessage: mapMessage(userMessage),
    assistantMessage: mapMessage(assistantMessage),
  });
}

function beginChatStream(res) {
  res.statusCode = 200;
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "authorization, content-type");
  res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();
}

function writeChatEvent(res, event) {
  if (res.writableEnded || res.destroyed) return;
  res.write(`${JSON.stringify(event)}\n`);
}

async function handleChatStream(req, res, ctx, body) {
  requireAccess(ctx);
  rateLimit(req, ctx.userId, "chat", 30, 60_000);
  const prompt = text(body.message, MAX_PROMPT);
  if (!prompt) return json(res, { error: "message_required" }, 400);

  beginChatStream(res);
  writeChatEvent(res, { type: "status", message: "Starting OrbitX AI…" });
  const heartbeat = setInterval(() => {
    writeChatEvent(res, { type: "ping", at: Date.now() });
  }, 10_000);

  try {
    const selectedModel = modelId(body.model);
    const conversation = await ensureConversation(
      ctx,
      body.conversationId,
      prompt,
      selectedModel,
    );
    writeChatEvent(res, {
      type: "conversation",
      conversation: mapConversation(conversation),
    });

    const { data: userMessage, error: insertError } = await ctx.db
      .from("ai_messages")
      .insert({
        conversation_id: conversation.id,
        user_id: ctx.userId,
        role: "user",
        content: prompt,
        model: selectedModel,
      })
      .select("*")
      .single();
    if (insertError || !userMessage) {
      throw new Error(insertError?.message || "Could not save message");
    }
    writeChatEvent(res, { type: "user_message", message: mapMessage(userMessage) });

    const rows = await loadMessages(ctx, conversation.id);
    const result = await runChat(ctx, conversation, rows, selectedModel, req, {
      mode: body.mode,
      onStatus: (message) => writeChatEvent(res, { type: "status", message }),
      onDelta: (delta) => writeChatEvent(res, { type: "delta", delta }),
      onReset: () => writeChatEvent(res, { type: "reset" }),
      onToolEvent: (event) => writeChatEvent(res, { type: "tool", event }),
    });
    const now = new Date().toISOString();
    const { data: assistantMessage, error: assistantError } = await ctx.db
      .from("ai_messages")
      .insert({
        conversation_id: conversation.id,
        user_id: ctx.userId,
        role: "assistant",
        content: result.content,
        model: selectedModel,
        tool_events: result.toolEvents,
      })
      .select("*")
      .single();
    if (assistantError || !assistantMessage) {
      throw new Error(assistantError?.message || "Could not save assistant message");
    }

    await ctx.db
      .from("ai_conversations")
      .update({ model: selectedModel, updated_at: now })
      .eq("id", conversation.id)
      .eq("user_id", ctx.userId);

    writeChatEvent(res, {
      type: "complete",
      ok: true,
      conversation: mapConversation({
        ...conversation,
        model: selectedModel,
        updated_at: now,
      }),
      userMessage: mapMessage(userMessage),
      assistantMessage: mapMessage(assistantMessage),
    });
  } catch (error) {
    const status =
      typeof error?.status === "number" && error.status >= 400 ? error.status : 500;
    if (status >= 500) console.error("[orbitx-ai:stream]", error);
    writeChatEvent(res, {
      type: "error",
      status,
      error: status >= 500 ? "orbitx_ai_error" : error?.message || "request_failed",
      message:
        status === 504 || error?.name === "TimeoutError"
          ? "A live provider took too long. Please retry—OrbitX stopped waiting safely."
          : status >= 500
            ? "OrbitX AI could not complete the response. Please retry."
            : error?.message || "Request failed",
    });
  } finally {
    clearInterval(heartbeat);
    if (!res.writableEnded) res.end();
  }
}

async function handleConversation(req, res, ctx, body) {
  requireAccess(ctx);
  const operation = text(body.operation, 20);
  if (operation === "create") {
    const requestedTitle = text(body.title, 120) || "New conversation";
    const conversation = await ensureConversation(
      ctx,
      "",
      requestedTitle,
      modelId(body.model),
    );
    return json(res, { conversation: mapConversation(conversation) }, 201);
  }
  if (operation === "rename") {
    const id = text(body.conversationId, 80);
    const title = text(body.title, 120);
    if (!id) return json(res, { error: "conversationId_required" }, 400);
    if (!title) return json(res, { error: "conversation_title_required" }, 400);
    const { data, error } = await ctx.db
      .from("ai_conversations")
      .update({ title, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", ctx.userId)
      .select("*")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return json(res, { error: "conversation_not_found" }, 404);
    return json(res, { conversation: mapConversation(data) });
  }
  if (operation === "delete") {
    const id = text(body.conversationId, 80);
    if (!id) return json(res, { error: "conversationId_required" }, 400);
    const { error } = await ctx.db
      .from("ai_conversations")
      .delete()
      .eq("id", id)
      .eq("user_id", ctx.userId);
    if (error) throw new Error(error.message);
    return json(res, { ok: true });
  }
  return json(res, { error: "invalid_conversation_operation" }, 400);
}

function generationStatus(result) {
  if (result?.ok === false) return "failed";
  const state = text(result?.state, 40).toLowerCase();
  if (state === "success") return "success";
  if (state === "fail" || state === "failed") return "failed";
  if (state === "processing") return "processing";
  return "waiting";
}

async function handleMediaGenerate(req, res, ctx, body) {
  requireAccess(ctx);
  rateLimit(req, ctx.userId, "media", 8, 60 * 60_000);
  const kind = body.kind === "video" ? "video" : "image";
  const prompt = text(body.prompt, 5000);
  if (!prompt) return json(res, { error: "prompt_required" }, 400);
  const settings = normalizedMediaSettings(kind, body.settings);
  const conversationId = text(body.conversationId, 80);
  if (conversationId) {
    await ensureConversation(ctx, conversationId, "", "");
  }
  const model =
    kind === "video"
      ? "grok-imagine/text-to-video"
      : "grok-imagine/text-to-image";

  const { data: created, error: createError } = await ctx.db
    .from("ai_generations")
    .insert({
      user_id: ctx.userId,
      conversation_id: conversationId || null,
      kind,
      prompt,
      provider: "grok-imagine",
      model,
      status: "queued",
      settings,
    })
    .select("*")
    .single();
  if (createError || !created) {
    throw new Error(createError?.message || "Could not create generation");
  }

  try {
    const result = await runEmbeddedAgentTool({
      userId: ctx.userId,
      walletAddress: ctx.walletAddress,
      email: ctx.email,
      toolName: kind === "video" ? "orbitx_generate_video" : "orbitx_generate_image",
      args: { ...settings, prompt, wait: false },
      req,
    });
    const urls = Array.isArray(result?.resultUrls)
      ? result.resultUrls
      : Array.isArray(result?.imageUrls)
        ? result.imageUrls
        : [];
    if (result?.ok === false || (!result?.taskId && urls.length === 0)) {
      throw Object.assign(
        new Error(result?.error || result?.message || "Grok Imagine did not start a generation"),
        { status: 502 },
      );
    }
    const status = generationStatus(result);
    const now = new Date().toISOString();
    const patch = {
      task_id: result?.taskId || null,
      status,
      result_urls: urls,
      error: result?.failMsg || result?.error || null,
      updated_at: now,
      completed_at: status === "success" || status === "failed" ? now : null,
    };
    const { data: updated, error: updateError } = await ctx.db
      .from("ai_generations")
      .update(patch)
      .eq("id", created.id)
      .eq("user_id", ctx.userId)
      .select("*")
      .single();
    if (updateError || !updated) throw new Error(updateError?.message || "Could not update generation");
    return json(res, { ok: true, generation: mapGeneration(updated) }, 202);
  } catch (error) {
    const now = new Date().toISOString();
    await ctx.db
      .from("ai_generations")
      .update({
        status: "failed",
        error: error instanceof Error ? error.message : "Generation failed",
        updated_at: now,
        completed_at: now,
      })
      .eq("id", created.id)
      .eq("user_id", ctx.userId);
    throw error;
  }
}

async function handleMediaStatus(req, res, ctx, body) {
  requireAccess(ctx);
  const id = text(body.generationId, 80);
  if (!id) return json(res, { error: "generationId_required" }, 400);
  const { data: generation, error } = await ctx.db
    .from("ai_generations")
    .select("*")
    .eq("id", id)
    .eq("user_id", ctx.userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!generation) return json(res, { error: "generation_not_found" }, 404);
  if (!generation.task_id || ["success", "failed"].includes(generation.status)) {
    return json(res, { generation: mapGeneration(generation) });
  }

  const result = await runEmbeddedAgentTool({
    userId: ctx.userId,
    walletAddress: ctx.walletAddress,
    email: ctx.email,
    toolName: "orbitx_media_status",
    args: { taskId: generation.task_id },
    req,
  });
  const status = generationStatus(result);
  const urls = Array.isArray(result?.resultUrls)
    ? result.resultUrls
    : Array.isArray(result?.imageUrls)
      ? result.imageUrls
      : generation.result_urls || [];
  const now = new Date().toISOString();
  const { data: updated, error: updateError } = await ctx.db
    .from("ai_generations")
    .update({
      status,
      result_urls: urls,
      error: result?.failMsg || result?.error || null,
      updated_at: now,
      completed_at: status === "success" || status === "failed" ? now : null,
    })
    .eq("id", id)
    .eq("user_id", ctx.userId)
    .select("*")
    .single();
  if (updateError || !updated) throw new Error(updateError?.message || "Could not update generation");
  return json(res, { generation: mapGeneration(updated) });
}

async function handleToolExecute(req, res, ctx, body) {
  requireAccess(ctx);
  rateLimit(req, ctx.userId, "tool", 24, 60_000);
  const conversationId = text(body.conversationId, 80);
  const messageId = text(body.messageId, 80);
  const eventId = text(body.eventId, 80);
  if (!conversationId) return json(res, { error: "conversationId_required" }, 400);
  if (!isUuid(messageId) || !isUuid(eventId)) {
    return json(res, { error: "valid_messageId_and_eventId_required" }, 400);
  }

  const conversation = await ensureConversation(ctx, conversationId, "", "");
  const { data: sourceMessage, error: sourceError } = await ctx.db
    .from("ai_messages")
    .select("id, tool_events")
    .eq("id", messageId)
    .eq("user_id", ctx.userId)
    .eq("conversation_id", conversation.id)
    .maybeSingle();
  if (sourceError) throw new Error(sourceError.message);
  if (!sourceMessage) return json(res, { error: "confirmation_not_found" }, 404);

  const sourceEvents = Array.isArray(sourceMessage.tool_events)
    ? sourceMessage.tool_events
    : [];
  const confirmation = sourceEvents.find((stored) => stored?.id === eventId);
  if (!confirmation || confirmation.status !== "confirmation_required") {
    return json(res, { error: "confirmation_already_used_or_missing" }, 409);
  }
  if (
    !confirmation.expiresAt ||
    new Date(confirmation.expiresAt).getTime() <= Date.now()
  ) {
    return json(res, { error: "confirmation_expired" }, 410);
  }

  const toolName = text(confirmation.tool, 160);
  const args = objectValue(confirmation.args);
  if (!toolName || BLOCKED_EMBEDDED_TOOLS.has(toolName) || !requiresConfirmation(toolName)) {
    return json(res, { error: "tool_unavailable_in_orbitx_ai" }, 400);
  }

  const executingEvent = {
    ...confirmation,
    status: "executing",
    expiresAt: new Date(Date.now() + TOOL_TIMEOUT_MS + 8_000).toISOString(),
    result: { message: "OrbitX is executing the confirmed action." },
  };
  const executingEvents = sourceEvents.map((stored) =>
    stored?.id === eventId ? executingEvent : stored
  );
  const { data: claimed, error: claimError } = await ctx.db
    .from("ai_messages")
    .update({ tool_events: executingEvents })
    .eq("id", sourceMessage.id)
    .eq("user_id", ctx.userId)
    .eq("conversation_id", conversation.id)
    .contains("tool_events", [{ id: eventId, status: "confirmation_required" }])
    .select("id")
    .maybeSingle();
  if (claimError) throw new Error(claimError.message);
  if (!claimed) {
    return json(res, { error: "confirmation_already_used" }, 409);
  }

  let result;
  try {
    result = await withTimeout(
      runEmbeddedAgentTool({
        userId: ctx.userId,
        walletAddress: ctx.walletAddress,
        email: ctx.email,
        toolName,
        args,
        req,
      }),
      TOOL_TIMEOUT_MS,
      `${toolName} timed out`,
    );
  } catch (error) {
    result = {
      ok: false,
      error: error instanceof Error ? error.message : "OrbitX tool failed",
    };
  }

  const failed = result?.ok === false;
  const event = {
    id: eventId,
    tool: toolName,
    args: jsonSafe(args),
    status: failed ? "failed" : "completed",
    result: jsonSafe(result),
  };

  const finalizedEvents = executingEvents.map((stored) =>
    stored?.id === eventId ? event : stored
  );
  const { error: finalizeError } = await ctx.db
    .from("ai_messages")
    .update({ tool_events: finalizedEvents })
    .eq("id", sourceMessage.id)
    .eq("user_id", ctx.userId)
    .eq("conversation_id", conversation.id)
    .contains("tool_events", [{ id: eventId, status: "executing" }]);
  if (finalizeError) throw new Error(finalizeError.message);

  let message = null;
  const { data, error: messageError } = await ctx.db
    .from("ai_messages")
    .insert({
      conversation_id: conversation.id,
      user_id: ctx.userId,
      role: "tool",
      content: `${toolName} ${failed ? "failed" : "completed"}.`,
      tool_events: [event],
    })
    .select("*")
    .single();
  if (messageError) {
    console.error("[orbitx-ai] could not save tool result message", messageError);
  } else {
    message = data ? mapMessage(data) : null;
  }
  return json(res, { ok: !failed, event, message });
}

async function handleToolCancel(req, res, ctx, body) {
  requireAccess(ctx);
  rateLimit(req, ctx.userId, "tool-cancel", 30, 60_000);
  const conversationId = text(body.conversationId, 80);
  const messageId = text(body.messageId, 80);
  const eventId = text(body.eventId, 80);
  if (!conversationId) return json(res, { error: "conversationId_required" }, 400);
  if (!isUuid(messageId) || !isUuid(eventId)) {
    return json(res, { error: "valid_messageId_and_eventId_required" }, 400);
  }

  const conversation = await ensureConversation(ctx, conversationId, "", "");
  const { data: sourceMessage, error: sourceError } = await ctx.db
    .from("ai_messages")
    .select("id, tool_events")
    .eq("id", messageId)
    .eq("user_id", ctx.userId)
    .eq("conversation_id", conversation.id)
    .maybeSingle();
  if (sourceError) throw new Error(sourceError.message);
  if (!sourceMessage) return json(res, { error: "confirmation_not_found" }, 404);

  const sourceEvents = Array.isArray(sourceMessage.tool_events)
    ? sourceMessage.tool_events
    : [];
  const pending = sourceEvents.find((stored) => stored?.id === eventId);
  const isPending = pending?.status === "confirmation_required";
  const isStaleExecution =
    pending?.status === "executing" &&
    pending?.expiresAt &&
    new Date(pending.expiresAt).getTime() <= Date.now();
  if (!pending || (!isPending && !isStaleExecution)) {
    return json(res, { error: "confirmation_cannot_be_cancelled" }, 409);
  }

  const event = {
    ...pending,
    status: "cancelled",
    result: {
      ok: false,
      error: isStaleExecution ? "execution_timed_out" : "cancelled_by_user",
      message: isStaleExecution
        ? "The tool execution timed out and was safely closed."
        : "You cancelled this action before it ran.",
    },
  };
  const updatedEvents = sourceEvents.map((stored) =>
    stored?.id === eventId ? event : stored
  );
  const { data: cancelled, error: cancelError } = await ctx.db
    .from("ai_messages")
    .update({ tool_events: updatedEvents })
    .eq("id", sourceMessage.id)
    .eq("user_id", ctx.userId)
    .eq("conversation_id", conversation.id)
    .contains("tool_events", [{ id: eventId, status: pending.status }])
    .select("id")
    .maybeSingle();
  if (cancelError) throw new Error(cancelError.message);
  if (!cancelled) return json(res, { error: "confirmation_already_changed" }, 409);
  return json(res, { ok: true, event });
}

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  try {
    const ctx = await authenticatedContext(req);
    const action =
      req.method === "GET"
        ? text(req.query.action, 40) || "bootstrap"
        : text(parseBody(req).action, 40);

    if (action === "gate") return json(res, { ok: true, gate: ctx.gate, walletAddress: ctx.walletAddress });
    if (req.method === "GET" && action === "bootstrap") return handleBootstrap(req, res, ctx);
    if (req.method === "GET" && action === "messages") return handleMessages(req, res, ctx);
    if (req.method !== "POST") return json(res, { error: "method_not_allowed" }, 405);

    const body = parseBody(req);
    if (action === "chat.stream") return handleChatStream(req, res, ctx, body);
    if (action === "chat") return handleChat(req, res, ctx, body);
    if (action === "conversation") return handleConversation(req, res, ctx, body);
    if (action === "media.generate") return handleMediaGenerate(req, res, ctx, body);
    if (action === "media.status") return handleMediaStatus(req, res, ctx, body);
    if (action === "tool.execute") return handleToolExecute(req, res, ctx, body);
    if (action === "tool.cancel") return handleToolCancel(req, res, ctx, body);
    return json(res, { error: "unknown_action" }, 404);
  } catch (error) {
    const status =
      typeof error?.status === "number" && error.status >= 400
        ? error.status
        : 500;
    if (error?.retryAfter) res.setHeader("Retry-After", String(error.retryAfter));
    if (status >= 500) console.error("[orbitx-ai]", error);
    return json(
      res,
      {
        error: status >= 500 ? "orbitx_ai_error" : error?.message || "request_failed",
        message:
          status >= 500
            ? "OrbitX AI could not complete the request."
            : error?.message || "Request failed",
        ...(error?.payload ? { gate: error.payload } : {}),
      },
      status,
    );
  }
}

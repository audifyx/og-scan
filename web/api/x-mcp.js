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
import {
  X_OAUTH_SCOPES,
  NIM_MODELS,
  DEFAULT_NIM_MODEL,
  buildTweetText as libBuildTweetText,
  postTweetOAuth2 as libPostTweet,
  lookupXUser,
  sendDmOAuth2,
  sendDmConversationOAuth2,
  listDmEventsOAuth2,
  listMentionsOAuth2,
  listFollowersOAuth2,
  listFollowingOAuth2,
  getTweetMetricsOAuth2,
  listUserTweetsOAuth2,
  listOwnedListsOAuth2,
  listListMembersOAuth2,
  scanPdfContent,
  getXMe,
  mapAgentRow,
  mapQueueRow,
  ensureXAgent,
  listKnowledge,
  generateAgentPost,
  executeQueueItem,
  runCronTick,
  processAutoReplies,
  patchXAgent,
} from "./orbitx/x-agent-lib.js";
import {
  buildXAuthPasteMessages,
  wrapMcpToolContent,
  xMenuPayload,
} from "./orbitx/mcp-brand.js";
import {
  accessBuyPrompt,
  confirmAccessBurn,
  getAccessStatus,
  listPackages,
  prepareAccessBurn,
  prepareAccessMcpPurchase,
} from "./orbitx/mcp-burn-access.js";
import {
  ORBITX_MINT,
  askBuyOrbitxAmount,
  prepareBuyOrbitx,
  saveTradeIntent,
  loadLatestTradeIntent,
} from "./orbitx/buy-orbitx.js";
import {
  buildXGeneratedTools,
  dispatchXGenerated,
  listXGeneratedHelp,
  xGeneratedStats,
} from "./orbitx/x-mcp-tools-catalog.js";
import { buildDexChartEmbed } from "./orbitx/dex-chart-embed.js";
import {
  DEFAULT_GITHUB_REPO,
  loadLinkedRepo,
  saveLinkedRepo,
  getRepoInfo,
  readRepoFile,
  listRepoTree,
  searchRepo,
  buildRepoContext,
  listRepoResources,
  parseRepoResourceUri,
  parseGithubRepo,
} from "./orbitx/x-github-repo.js";

/** Lazy — x-credits must not load at cold start (Solana deps can 500 the whole MCP). */
async function xCredits() {
  return import("./orbitx/x-credits.js");
}

const CREDITS_PER_SOL = 10_000;
const MIN_SOL = 0.001;
const MAX_SOL = 100;
const PLATFORM_CREDITS_WALLET = "45YR6fWxtc8uceNazGKMoX2KgK698rQsnPN4x8vD2VrE";

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

const EMPTY_OBJECT_SCHEMA = {
  type: "object",
  properties: {},
  additionalProperties: false,
};

const _xGenerated = buildXGeneratedTools();

const CORE_TOOLS = [
  // ChatGPT custom connectors expect search + fetch (exact names) or they show "no tools".
  {
    name: "search",
    description:
      "Search OrbitX X MCP capabilities and recent queue/status. Query examples: menu, help, status, queue, post, dm, agent.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query" },
      },
      required: ["query"],
      additionalProperties: false,
    },
    annotations: { title: "Search", readOnlyHint: true, openWorldHint: false },
  },
  {
    name: "fetch",
    description:
      "Fetch a document by id from search results (menu, help, status, queue, tool:<name>).",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Document id from search" },
      },
      required: ["id"],
      additionalProperties: false,
    },
    annotations: { title: "Fetch", readOnlyHint: true, openWorldHint: false },
  },
  {
    name: "x_menu",
    description:
      "OrbitX X command menu — branded banner + capability list. Call when the user says /, menu, help, or asks what you can do.",
    inputSchema: {
      type: "object",
      properties: {
        authCode: {
          type: "string",
          description: "Optional authCode from dashboard paste or x_auth_link",
        },
      },
      additionalProperties: false,
    },
    annotations: { title: "OrbitX menu", readOnlyHint: true, openWorldHint: false },
  },
  {
    name: "x_post",
    description:
      "Post a tweet on the authenticated user's X account. Requires Bearer key from https://orbitx.world/x and an X account connected on that page.",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string", description: "Tweet body (required)" },
        linkUrl: { type: "string", description: "Optional URL appended to the tweet" },
        imageUrl: {
          type: "string",
          description: "Optional image URL to attach (needs app media credentials on server)",
        },
        replyToTweetId: { type: "string", description: "Optional tweet id to reply to" },
      },
      required: ["text"],
      additionalProperties: false,
    },
    annotations: { title: "Post to X", readOnlyHint: false, openWorldHint: true },
  },
  {
    name: "x_quote",
    description: "Quote an existing tweet by id with new text.",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string" },
        quoteTweetId: { type: "string", description: "Tweet id to quote" },
        linkUrl: { type: "string" },
      },
      required: ["text", "quoteTweetId"],
      additionalProperties: false,
    },
    annotations: { title: "Quote tweet", readOnlyHint: false, openWorldHint: true },
  },
  {
    name: "x_reply",
    description: "Reply to a tweet by id.",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string" },
        replyToTweetId: { type: "string" },
      },
      required: ["text", "replyToTweetId"],
      additionalProperties: false,
    },
    annotations: { title: "Reply", readOnlyHint: false, openWorldHint: true },
  },
  {
    name: "x_dm",
    description:
      "Send a direct message on X. Pass username or recipientId, plus text. Requires dm.write. Free tier may 403 with a clear upgrade message.",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string", description: "DM body (required)" },
        username: {
          type: "string",
          description: "Recipient handle without @ (preferred).",
        },
        recipientId: {
          type: "string",
          description: "Recipient X user id (numeric string).",
        },
      },
      required: ["text"],
      additionalProperties: false,
    },
    annotations: { title: "Send DM", readOnlyHint: false, openWorldHint: true },
  },
  {
    name: "x_dm_inbox",
    description:
      "List recent X DM events including group chats (dm.read). Events with isGroup=true are group DMs.",
    inputSchema: {
      type: "object",
      properties: {
        maxResults: { type: "integer", description: "1–100, default 20" },
      },
      additionalProperties: false,
    },
    annotations: { title: "DM inbox", readOnlyHint: true, openWorldHint: true },
  },
  {
    name: "x_dm_group",
    description:
      "Reply in an X group DM (or any DM conversation) by conversationId from x_dm_inbox.",
    inputSchema: {
      type: "object",
      properties: {
        conversationId: {
          type: "string",
          description: "dm_conversation_id from x_dm_inbox",
        },
        text: { type: "string", description: "Message body" },
      },
      required: ["conversationId", "text"],
      additionalProperties: false,
    },
    annotations: { title: "Group DM", readOnlyHint: false, openWorldHint: true },
  },
  {
    name: "x_mentions",
    description: "List recent mentions of the connected X account (tweet.read; Basic/Pro often required).",
    inputSchema: {
      type: "object",
      properties: {
        maxResults: { type: "integer", description: "5–100, default 10" },
        sinceId: { type: "string", description: "Only mentions newer than this tweet id" },
      },
      additionalProperties: false,
    },
    annotations: { title: "Mentions", readOnlyHint: true, openWorldHint: true },
  },
  {
    name: "x_connection_status",
    description: "Check whether the authenticated MCP user has an X account linked on OrbitX (/x).",
    inputSchema: EMPTY_OBJECT_SCHEMA,
    annotations: { title: "Connection status", readOnlyHint: true, openWorldHint: false },
  },
  {
    name: "x_agent_status",
    description:
      "Get the user's X agent config (persona, mode, auto-reply toggles, model, enabled).",
    inputSchema: EMPTY_OBJECT_SCHEMA,
    annotations: { title: "Agent status", readOnlyHint: true, openWorldHint: false },
  },
  {
    name: "x_agent_upsert",
    description:
      "Create or update the X agent (persona, mode auto|approve, auto-reply toggles for mentions/DMs/group DMs, model, topics, schedule windows).",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        persona: { type: "string" },
        voiceNotes: { type: "string" },
        model: { type: "string" },
        mode: { type: "string", enum: ["auto", "approve"] },
        enabled: { type: "boolean" },
        topics: { type: "array", items: { type: "string" } },
        maxPostsPerDay: { type: "integer" },
        autoReplyMentions: {
          type: "boolean",
          description: "Auto-draft/send replies when people mention or reply to the account",
        },
        autoReplyDms: {
          type: "boolean",
          description: "Auto-draft/send replies to 1:1 DMs",
        },
        autoReplyGroupDms: {
          type: "boolean",
          description: "Auto-draft/send replies in X group DMs",
        },
        maxRepliesPerDay: { type: "integer", description: "Cap for auto replies (default 30)" },
        postingWindows: {
          type: "array",
          items: {
            type: "object",
            properties: {
              startHour: { type: "integer" },
              endHour: { type: "integer" },
            },
            additionalProperties: true,
          },
        },
        timezone: { type: "string" },
      },
      additionalProperties: false,
    },
    annotations: { title: "Upsert agent", readOnlyHint: false, openWorldHint: false },
  },
  {
    name: "x_agent_poll_replies",
    description:
      "Manually poll mentions + DMs/group DMs now and draft or auto-send replies using the trained agent (same as cron).",
    inputSchema: EMPTY_OBJECT_SCHEMA,
    annotations: { title: "Poll replies", readOnlyHint: false, openWorldHint: true },
  },
  {
    name: "x_agent_train",
    description: "Add training knowledge or set persona/voice for the X agent.",
    inputSchema: {
      type: "object",
      properties: {
        persona: { type: "string" },
        voiceNotes: { type: "string" },
        title: { type: "string" },
        content: { type: "string" },
      },
      additionalProperties: false,
    },
    annotations: { title: "Train agent", readOnlyHint: false, openWorldHint: false },
  },
  {
    name: "x_agent_schedule",
    description: "Enqueue a post/quote/reply/dm for later (or pending approval).",
    inputSchema: {
      type: "object",
      properties: {
        kind: { type: "string", enum: ["post", "quote", "reply", "dm"] },
        text: { type: "string" },
        scheduledFor: { type: "string" },
        quoteTweetId: { type: "string" },
        replyToTweetId: { type: "string" },
        username: { type: "string" },
        recipientId: { type: "string" },
        linkUrl: { type: "string" },
        autoApprove: { type: "boolean" },
      },
      required: ["text"],
      additionalProperties: false,
    },
    annotations: { title: "Schedule", readOnlyHint: false, openWorldHint: false },
  },
  {
    name: "x_agent_run",
    description:
      "Generate a post with NVIDIA NIM now; posts if mode=auto (or forcePost) else queues for approval.",
    inputSchema: {
      type: "object",
      properties: { hint: { type: "string" }, forcePost: { type: "boolean" } },
      additionalProperties: false,
    },
    annotations: { title: "Run agent", readOnlyHint: false, openWorldHint: true },
  },
  {
    name: "x_agent_list_queue",
    description: "List recent queue items (drafts/scheduled/posted).",
    inputSchema: {
      type: "object",
      properties: { status: { type: "string" }, limit: { type: "integer" } },
      additionalProperties: false,
    },
    annotations: { title: "List queue", readOnlyHint: true, openWorldHint: false },
  },
  {
    name: "x_agent_approve",
    description: "Approve a queue item and post it (postNow default true).",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string" }, postNow: { type: "boolean" } },
      required: ["id"],
      additionalProperties: false,
    },
    annotations: { title: "Approve queue item", readOnlyHint: false, openWorldHint: true },
  },
  {
    name: "x_agent_cancel",
    description: "Cancel a pending/scheduled queue item.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"],
      additionalProperties: false,
    },
    annotations: { title: "Cancel queue item", readOnlyHint: false, openWorldHint: false },
  },
  {
    name: "x_auth_link",
    description:
      "Start OrbitX authentication for this chat (Grok fallback). Prefer a dashboard-pasted authCode when the user provides one — call x_auth_status instead. Otherwise return a clickable URL, then x_auth_status, then pass authCode on later x_* tools.",
    inputSchema: EMPTY_OBJECT_SCHEMA,
    annotations: { title: "Auth link", readOnlyHint: true, openWorldHint: false },
  },
  {
    name: "x_auth_status",
    description:
      "Activate or check OrbitX link-auth. Pass authCode from a dashboard paste message or x_auth_link. When completed, keep using that authCode on every later x_* tool (stays linked).",
    inputSchema: {
      type: "object",
      properties: {
        authCode: {
          type: "string",
          description: "Code from dashboard paste or x_auth_link",
        },
      },
      required: ["authCode"],
      additionalProperties: false,
    },
    annotations: { title: "Auth status", readOnlyHint: true, openWorldHint: false },
  },
  {
    name: "x_help",
    description: "How to connect OrbitX X MCP + agent mode to Claude, ChatGPT, or Grok (including dashboard paste auth).",
    inputSchema: EMPTY_OBJECT_SCHEMA,
    annotations: { title: "Help", readOnlyHint: true, openWorldHint: false },
  },
  {
    name: "x_credits_buy",
    description:
      "Buy OrbitX MCP credits with SOL to the desk wallet. When the user says buy credits / top up — ASK how many credits OR how much SOL, then call this. Returns Phantom signUrl/autoSignUrl that starts the SOL transfer. After pay, call x_credits_confirm (or sign page credits automatically).",
    inputSchema: {
      type: "object",
      properties: {
        solAmount: {
          type: "number",
          description: `SOL to spend (any amount ${MIN_SOL}–${MAX_SOL}). 1 SOL = ${CREDITS_PER_SOL} credits.`,
        },
        credits: { type: "number", description: "Credit count to buy (converted to SOL)" },
        amount: { type: "number", description: "Alias: credits if >=10, else SOL" },
        publicKey: {
          type: "string",
          description: "Buyer wallet (optional if linked on /agent)",
        },
        confirmMode: { type: "string", enum: ["sign", "auto"] },
        autoConfirm: { type: "boolean" },
        askOnly: {
          type: "boolean",
          description: "If true (or amount omitted), return the ask-how-much prompt only",
        },
      },
      additionalProperties: false,
    },
    annotations: { title: "Buy credits", readOnlyHint: false, openWorldHint: true },
  },
  {
    name: "x_credits_confirm",
    description:
      "Confirm a SOL payment to the OrbitX credits wallet and credit the user's balance. Pass the Solana transaction signature after they send funds.",
    inputSchema: {
      type: "object",
      properties: {
        signature: { type: "string", description: "Solana tx signature of the SOL transfer" },
        txSignature: { type: "string", description: "Alias for signature" },
      },
      additionalProperties: false,
    },
    annotations: { title: "Confirm credit purchase", readOnlyHint: false, openWorldHint: true },
  },
  {
    name: "x_credits_balance",
    description: "Show the user's purchasable X MCP credit balance and lifetime totals.",
    inputSchema: EMPTY_OBJECT_SCHEMA,
    annotations: { title: "Credits balance", readOnlyHint: true, openWorldHint: false },
  },
  {
    name: "x_credits_usage",
    description:
      "Advanced credits usage report for Grok/Claude — balance, period analytics (24h/7d/30d/all), SOL in, burn rate, runway, daily series, suggested packs, ledger, and markdown. Call when the user asks for usage, billing, advanced usage, or spend history.",
    inputSchema: {
      type: "object",
      properties: {
        period: {
          type: "string",
          enum: ["24h", "7d", "30d", "all"],
          description: "Analytics window (default 30d)",
        },
        limit: { type: "integer", description: "Ledger rows (1–200, default 50)" },
        format: {
          type: "string",
          enum: ["both", "markdown", "json"],
          description: "both (default) returns structured + markdown for chat display",
        },
      },
      additionalProperties: false,
    },
    annotations: { title: "Advanced credits usage", readOnlyHint: true, openWorldHint: false },
  },
  {
    name: "x_mcp_access_status",
    description:
      "Show temporary MCP access purchased by burning $ORBITX — active/expired, time remaining, packages (1 hour = 100, 1 day = 1,000, 1 week = 10,000, 1 month = 1,000,000 tokens). Call when the user asks about MCP access, burn access, or time remaining.",
    inputSchema: EMPTY_OBJECT_SCHEMA,
    annotations: { title: "MCP access status", readOnlyHint: true, openWorldHint: false },
  },
  {
    name: "x_mcp_access_buy",
    description:
      "Buy temporary MCP access by burning $ORBITX. When the user says buy access / burn ORBITX — ASK hour (100), day (1,000), week (10,000), or month (1,000,000), then call this. Returns a Jupiter signUrl (buy then burn). After the burn, call x_mcp_access_confirm with the signature.",
    inputSchema: {
      type: "object",
      properties: {
        package: { type: "string", enum: ["hour", "day", "week", "month"], description: "Access package" },
        packageId: { type: "string", enum: ["hour", "day", "week", "month"] },
        publicKey: { type: "string", description: "Burner wallet (optional if linked on /agent or /x)" },
        confirmMode: { type: "string", enum: ["sign", "auto"] },
        autoConfirm: { type: "boolean" },
        askOnly: { type: "boolean" },
      },
      additionalProperties: false,
    },
    annotations: { title: "Burn ORBITX for MCP access", readOnlyHint: false, openWorldHint: true },
  },
  {
    name: "x_mcp_access_confirm",
    description:
      "Confirm an $ORBITX burn and grant MCP access for the matching package duration. Pass the Solana tx signature after Phantom confirms.",
    inputSchema: {
      type: "object",
      properties: {
        signature: { type: "string" },
        txSignature: { type: "string" },
        package: { type: "string", enum: ["hour", "day", "week", "month"] },
        packageId: { type: "string", enum: ["hour", "day", "week", "month"] },
      },
      additionalProperties: false,
    },
    annotations: { title: "Confirm MCP access burn", readOnlyHint: false, openWorldHint: true },
  },
  {
    name: "x_buy",
    description:
      "PRIMARY BUY TOOL for Grok/Claude. Use this whenever the user wants to buy credits, buy ORBITX, or burn ORBITX for timed MCP access. Set what=credits|orbitx|access (ask if unclear). For credits pass credits or solAmount; for ORBITX pass solAmount; for access pass package=hour|day|week|month. Returns a Jupiter signUrl/openUrl. Prefer this over inventing names like XBuyTool.",
    inputSchema: {
      type: "object",
      properties: {
        what: {
          type: "string",
          enum: ["credits", "orbitx", "access", "ask"],
          description: "credits = MCP credits (SOL to desk wallet); orbitx = buy ORBITX token; access = burn ORBITX for timed MCP access; ask = clarify",
        },
        package: { type: "string", enum: ["hour", "day", "week", "month"], description: "MCP access package when what=access" },
        packageId: { type: "string", enum: ["hour", "day", "week", "month"] },
        solAmount: { type: "number", description: "SOL to spend" },
        credits: { type: "number", description: "Credit count (credits buy only)" },
        amount: { type: "number", description: "Alias amount" },
        publicKey: { type: "string" },
        confirmMode: { type: "string", enum: ["sign", "auto"] },
        autoConfirm: { type: "boolean" },
        askOnly: { type: "boolean" },
      },
      additionalProperties: false,
    },
    annotations: { title: "Buy", readOnlyHint: false, openWorldHint: true },
  },
  {
    name: "x_buy_orbitx",
    description:
      "Buy official ORBITX token with SOL. When the user says buy ORBITX — ASK how much SOL and sign vs auto-confirm. confirmMode=sign → signUrl; auto → Phantom pops. Prefer x_buy with what=orbitx if unsure of tool name.",
    inputSchema: {
      type: "object",
      properties: {
        amountSol: { type: "number", description: "SOL to spend on ORBITX" },
        publicKey: { type: "string", description: "Buyer wallet (optional if linked on /agent)" },
        confirmMode: { type: "string", enum: ["sign", "auto"] },
        autoConfirm: { type: "boolean", description: "Same as confirmMode=auto" },
        slippage: { type: "number", default: 10 },
        askOnly: { type: "boolean" },
      },
      additionalProperties: false,
    },
    annotations: { title: "Buy ORBITX", readOnlyHint: false, openWorldHint: true },
  },
  {
    name: "x_confirm_buy",
    description:
      "Chat confirm for a pending ORBITX buy. Call when the user says yes / confirm / go ahead / auto after x_buy_orbitx or x_buy. Returns autoSignUrl (Phantom auto-prompt).",
    inputSchema: {
      type: "object",
      properties: {
        amountSol: { type: "number" },
        publicKey: { type: "string" },
        slippage: { type: "number", default: 10 },
      },
      additionalProperties: false,
    },
    annotations: { title: "Confirm buy", readOnlyHint: false, openWorldHint: true },
  },
  {
    name: "x_tools_help",
    description:
      "Browse the full X MCP catalog (~500 shortcuts + ~5000 activity tools). Default tools/list shows CORE only so Grok/Claude stay stable. Query: followers, dm, pdf, analytics, views, lists.",
    inputSchema: {
      type: "object",
      properties: {
        q: { type: "string", description: "Filter tool names / kinds" },
        limit: { type: "integer", default: 40 },
      },
      additionalProperties: false,
    },
    annotations: { title: "Tools catalog", readOnlyHint: true, openWorldHint: false },
  },
  {
    name: "x_get_user",
    description: "Lookup an X user by @username — profile, bio, follower/following/tweet counts.",
    inputSchema: {
      type: "object",
      properties: {
        username: { type: "string", description: "@handle" },
      },
      required: ["username"],
      additionalProperties: false,
    },
    annotations: { title: "Get user", readOnlyHint: true, openWorldHint: true },
  },
  {
    name: "x_me",
    description: "Authenticated X profile with public metrics (followers, following, tweets).",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { title: "My X profile", readOnlyHint: true, openWorldHint: false },
  },
  {
    name: "x_followers",
    description: "List followers for your account (or username). Paginated; newest-first when API supports it.",
    inputSchema: {
      type: "object",
      properties: {
        username: { type: "string" },
        maxResults: { type: "integer", default: 20 },
        paginationToken: { type: "string" },
      },
      additionalProperties: false,
    },
    annotations: { title: "Followers", readOnlyHint: true, openWorldHint: true },
  },
  {
    name: "x_following",
    description: "List accounts you follow (or for a given @username).",
    inputSchema: {
      type: "object",
      properties: {
        username: { type: "string" },
        maxResults: { type: "integer", default: 20 },
        paginationToken: { type: "string" },
      },
      additionalProperties: false,
    },
    annotations: { title: "Following", readOnlyHint: true, openWorldHint: true },
  },
  {
    name: "x_recent_followers",
    description: "Recent followers (first page of followers, newest-first on supported tiers).",
    inputSchema: {
      type: "object",
      properties: {
        username: { type: "string" },
        maxResults: { type: "integer", default: 20 },
      },
      additionalProperties: false,
    },
    annotations: { title: "Recent followers", readOnlyHint: true, openWorldHint: true },
  },
  {
    name: "x_lists",
    description: "Owned lists + list memberships for your X account (needs list.read — reconnect X after deploy).",
    inputSchema: {
      type: "object",
      properties: {
        username: { type: "string" },
        maxResults: { type: "integer", default: 20 },
      },
      additionalProperties: false,
    },
    annotations: { title: "Lists", readOnlyHint: true, openWorldHint: true },
  },
  {
    name: "x_list_members",
    description: "Members of an X list by listId.",
    inputSchema: {
      type: "object",
      properties: {
        listId: { type: "string" },
        maxResults: { type: "integer", default: 20 },
        paginationToken: { type: "string" },
      },
      required: ["listId"],
      additionalProperties: false,
    },
    annotations: { title: "List members", readOnlyHint: true, openWorldHint: true },
  },
  {
    name: "x_tweet_metrics",
    description: "Tweet analytics: views/impressions (when available), likes, RTs, replies, quotes.",
    inputSchema: {
      type: "object",
      properties: {
        tweetId: { type: "string" },
      },
      required: ["tweetId"],
      additionalProperties: false,
    },
    annotations: { title: "Tweet metrics", readOnlyHint: true, openWorldHint: true },
  },
  {
    name: "x_user_tweets",
    description: "Recent tweets for @username or self, each with public metrics (views when available).",
    inputSchema: {
      type: "object",
      properties: {
        username: { type: "string" },
        maxResults: { type: "integer", default: 10 },
        paginationToken: { type: "string" },
      },
      additionalProperties: false,
    },
    annotations: { title: "User tweets", readOnlyHint: true, openWorldHint: true },
  },
  {
    name: "x_analytics",
    description:
      "Advanced X account analytics snapshot: profile metrics, recent DMs, mentions, followers sample, latest tweets with views.",
    inputSchema: {
      type: "object",
      properties: {
        maxResults: { type: "integer", default: 10 },
        includeDms: { type: "boolean", default: true },
        includeMentions: { type: "boolean", default: true },
        includeFollowers: { type: "boolean", default: true },
        includeTweets: { type: "boolean", default: true },
      },
      additionalProperties: false,
    },
    annotations: { title: "X analytics", readOnlyHint: true, openWorldHint: true },
  },
  {
    name: "x_pdf_scan",
    description:
      "Scan a PDF (public URL, pasted text, or base64) — extract text, @handles, URLs, numbers, and summary analytics for research.",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string" },
        text: { type: "string" },
        base64: { type: "string" },
      },
      additionalProperties: false,
    },
    annotations: { title: "PDF scan", readOnlyHint: true, openWorldHint: true },
  },
  {
    name: "x_dex_chart",
    description:
      "HIGH QUALITY DexScreener embed chart for chat. When the user shares a CA/mint and asks for a chart — call this. Returns markdown with live embed URL, iframe, price/liq/volume, and OrbitX trade link.",
    inputSchema: {
      type: "object",
      properties: {
        ca: { type: "string", description: "Token mint CA or pair address" },
        mint: { type: "string" },
        chain: { type: "string", default: "solana" },
        interval: {
          type: "string",
          enum: ["1m", "5m", "15m", "1h", "4h", "12h", "24h"],
          default: "15m",
        },
        theme: { type: "string", enum: ["dark", "light"], default: "dark" },
      },
      additionalProperties: false,
    },
    annotations: { title: "Dex chart", readOnlyHint: true, openWorldHint: true },
  },
  {
    name: "x_repo_link",
    description:
      "Link a GitHub repo to this X MCP session (saved for your account). After linking, Claude/Grok can read it with x_repo_read / x_repo_search / x_repo_context while drafting posts — no need to paste the URL every time. Pass owner/repo or full github.com URL.",
    inputSchema: {
      type: "object",
      properties: {
        repo: {
          type: "string",
          description: "e.g. audifyx/og-scan or https://github.com/audifyx/og-scan",
        },
        url: { type: "string", description: "Alias of repo" },
        ref: { type: "string", description: "Optional branch or tag" },
      },
      additionalProperties: false,
    },
    annotations: { title: "Link GitHub repo", readOnlyHint: false, openWorldHint: true },
  },
  {
    name: "x_repo",
    description:
      "Show the linked GitHub repo (or platform default). Call before drafting product posts if you need repo metadata.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { title: "Repo status", readOnlyHint: true, openWorldHint: true },
  },
  {
    name: "x_repo_read",
    description:
      "Read a live file from the linked GitHub repo. Use when drafting X posts so copy matches the real codebase (README, AGENTS.md, routes, features).",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "File path e.g. README.md or web/api/x-mcp.js" },
        ref: { type: "string", description: "Optional branch/tag override" },
      },
      required: ["path"],
      additionalProperties: false,
    },
    annotations: { title: "Read repo file", readOnlyHint: true, openWorldHint: true },
  },
  {
    name: "x_repo_tree",
    description: "List important files in the linked GitHub repo (or a directory path).",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Optional directory path" },
        max: { type: "integer", default: 80 },
        ref: { type: "string" },
      },
      additionalProperties: false,
    },
    annotations: { title: "Repo tree", readOnlyHint: true, openWorldHint: true },
  },
  {
    name: "x_repo_search",
    description: "Search the linked GitHub repo (code search or path filter). Great for finding feature copy before posting.",
    inputSchema: {
      type: "object",
      properties: {
        q: { type: "string", description: "Search query" },
        max: { type: "integer", default: 12 },
      },
      required: ["q"],
      additionalProperties: false,
    },
    annotations: { title: "Search repo", readOnlyHint: true, openWorldHint: true },
  },
  {
    name: "x_repo_context",
    description:
      "Pull a drafting brief from the linked repo (README + AGENTS.md + optional search). Call this when the user asks to draft an X post about the product/repo.",
    inputSchema: {
      type: "object",
      properties: {
        hint: { type: "string", description: "What the post is about — used to search the repo" },
      },
      additionalProperties: false,
    },
    annotations: { title: "Repo draft context", readOnlyHint: true, openWorldHint: true },
  },
  {
    name: "x_dm_recent",
    description: "Recent DMs inbox (alias of x_dm_inbox) with sender usernames.",
    inputSchema: {
      type: "object",
      properties: {
        maxResults: { type: "integer", default: 20 },
      },
      additionalProperties: false,
    },
    annotations: { title: "Recent DMs", readOnlyHint: true, openWorldHint: true },
  },
];

/** Backward-compat alias — CORE tools only (never dump 5000 into connectors). */
const TOOLS = CORE_TOOLS;

const AUTH_CODE_PROP = {
  type: "string",
  description:
    "OrbitX authCode from the dashboard paste message or x_auth_link. After auth, pass this on every x_* tool call (required for Grok).",
};

const X_TOOL_ALIASES = {
  "/": "x_menu",
  menu: "x_menu",
  help: "x_menu",
  "buy credits": "x_credits_buy",
  buy_credits: "x_credits_buy",
  shop: "x_credits_buy",
  topup: "x_credits_buy",
  "top up": "x_credits_buy",
  usage: "x_credits_usage",
  "advanced usage": "x_credits_usage",
  credits: "x_credits_balance",
  balance: "x_credits_balance",
  "mcp access": "x_mcp_access_status",
  "access status": "x_mcp_access_status",
  "burn access": "x_mcp_access_buy",
  "buy access": "x_mcp_access_buy",
  mcp_access: "x_mcp_access_status",
  mcp_access_buy: "x_mcp_access_buy",
  "confirm access": "x_mcp_access_confirm",
  xmcpaccess: "x_mcp_access_status",
  xmcpaccessbuy: "x_mcp_access_buy",
  xmcpaccessbuytool: "x_mcp_access_buy",
  "buy orbitx": "x_buy_orbitx",
  "buy $orbitx": "x_buy_orbitx",
  buy_orbitx: "x_buy_orbitx",
  buyorbitx: "x_buy_orbitx",
  confirm_buy: "x_confirm_buy",
  "confirm buy": "x_confirm_buy",
  "yes buy": "x_confirm_buy",
  // Grok often invents PascalCase *Tool names — map them to real tools
  buy: "x_buy",
  xbuy: "x_buy",
  x_buy_tool: "x_buy",
  xbuytool: "x_buy",
  x_buytool: "x_buy",
  buytool: "x_buy",
  xbuyorbitx: "x_buy_orbitx",
  x_buyorbitx: "x_buy_orbitx",
  xbuyorbitxtool: "x_buy_orbitx",
  xcreditsbuy: "x_credits_buy",
  x_creditsbuy: "x_credits_buy",
  xcreditsbuytool: "x_credits_buy",
  xconfirmbuy: "x_confirm_buy",
  xcreditsusage: "x_credits_usage",
  xcreditsbalance: "x_credits_balance",
  followers: "x_followers",
  following: "x_following",
  "recent followers": "x_recent_followers",
  analytics: "x_analytics",
  "pdf scan": "x_pdf_scan",
  pdf: "x_pdf_scan",
  chart: "x_dex_chart",
  charts: "x_dex_chart",
  dex_chart: "x_dex_chart",
  "dex chart": "x_dex_chart",
  dexscreener: "x_dex_chart",
  "show chart": "x_dex_chart",
  lists: "x_lists",
  repo: "x_repo",
  github: "x_repo",
  "link repo": "x_repo_link",
  "github repo": "x_repo_link",
  "repo context": "x_repo_context",
  "read repo": "x_repo_read",
  "search repo": "x_repo_search",
  "get user": "x_get_user",
  "tweet views": "x_tweet_metrics",
  views: "x_tweet_metrics",
  "tools help": "x_tools_help",
  catalog: "x_tools_help",
};

/** Grok mangles snake_case → PascalCase + Tool (e.g. XBuyTool). Normalize to real tool names. */
function normalizeXToolName(rawName) {
  let n = String(rawName || "").trim();
  if (!n) return n;
  if (X_TOOL_ALIASES[n]) return X_TOOL_ALIASES[n];
  const lowerExact = n.toLowerCase();
  if (X_TOOL_ALIASES[lowerExact]) return X_TOOL_ALIASES[lowerExact];

  // Strip common connector prefixes Grok may prepend
  n = n.replace(/^(OrbitX|Orbitx|ORBITX|XMcp|XMCP|X_MCP)[_\s.-]*/g, "");
  n = n.replace(/Tool$/i, "");
  // PascalCase / camelCase → snake_case
  if (/[A-Z]/.test(n) && !n.includes("_")) {
    n = n
      .replace(/([A-Z]+)([A-Z][a-z])/g, "$1_$2")
      .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
      .toLowerCase();
  } else {
    n = n.toLowerCase();
  }
  n = n
    .replace(/[$\s.-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");

  // xbuy… → x_buy…
  if (n.startsWith("xbuy")) n = `x_buy${n.slice(4)}`;
  if (n.startsWith("xcredits")) n = `x_credits${n.slice(8)}`;
  if (n.startsWith("xconfirm")) n = `x_confirm${n.slice(8)}`;

  if (n === "buy" || n === "x_buy" || n === "xbuy") return "x_buy";
  if (n === "buy_orbitx" || n === "buyorbitx" || n === "x_buyorbitx") return "x_buy_orbitx";
  if (n === "buy_credits" || n === "buycredits" || n === "credits_buy") return "x_credits_buy";
  if (X_TOOL_ALIASES[n]) return X_TOOL_ALIASES[n];
  return n;
}

function withAuthCodeSchema(baseSchema, toolName) {
  const base = baseSchema && typeof baseSchema === "object" ? baseSchema : EMPTY_OBJECT_SCHEMA;
  const props = { ...(base.properties || {}) };
  if (
    toolName !== "x_auth_link" &&
    toolName !== "x_auth_status" &&
    toolName !== "x_menu" &&
    toolName !== "search" &&
    toolName !== "fetch" &&
    toolName !== "x_tools_help" &&
    toolName !== "x_pdf_scan" &&
    toolName !== "x_dex_chart" &&
    !props.authCode
  ) {
    props.authCode = AUTH_CODE_PROP;
  }
  return {
    ...base,
    type: "object",
    properties: props,
    additionalProperties: false,
  };
}

function mapToolForMcp(t) {
  const inputSchema = withAuthCodeSchema(t.inputSchema, t.name);
  return {
    name: t.name,
    description: t.description,
    inputSchema,
    input_schema: inputSchema,
    ...(t.annotations ? { annotations: t.annotations } : {}),
  };
}

/** Claude / Grok choke on 5000+ tools — expose CORE live tools only by default. */
function listLiveTools(cursor) {
  const PAGE = 80;
  if (!cursor || cursor === "core" || cursor === "0") {
    return {
      tools: CORE_TOOLS.map(mapToolForMcp),
      _meta: {
        totalAvailable: CORE_TOOLS.length + _xGenerated.length,
        liveCore: CORE_TOOLS.length,
        generated: _xGenerated.length,
        stats: xGeneratedStats(),
        note: "CORE tools listed. Call x_tools_help for the full catalog; activity shortcuts (x_act_*) still work if you know the name. Paginate generated: cursor gen:0",
      },
    };
  }
  const m = String(cursor).match(/^gen:(\d+)$/);
  if (m) {
    const offset = Number(m[1]) || 0;
    const slice = _xGenerated.slice(offset, offset + PAGE);
    const next = offset + PAGE < _xGenerated.length ? `gen:${offset + PAGE}` : undefined;
    return {
      tools: slice.map(mapToolForMcp),
      nextCursor: next,
      _meta: { offset, pageSize: PAGE, totalGenerated: _xGenerated.length },
    };
  }
  return { tools: CORE_TOOLS.map(mapToolForMcp) };
}

function listToolsForMcp() {
  return listLiveTools("core").tools;
}

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

/** Grok/Claude URL-only clients discover OAuth from this header + well-known PRM. */
function wwwAuthenticateHeader() {
  return `Bearer realm="OrbitX X MCP", resource_metadata="${MCP_URL}/.well-known/oauth-protected-resource", scope="${SCOPE}"`;
}

function mcpUnauthorized(res, id) {
  return json(
    res,
    {
      jsonrpc: "2.0",
      id: id ?? null,
      error: {
        code: -32001,
        message:
          "Unauthorized. Complete Authenticate in Grok/Claude/ChatGPT (OrbitX OAuth), or send Authorization: Bearer <key from https://orbitx.world/x>.",
      },
    },
    401,
    { "WWW-Authenticate": wwwAuthenticateHeader() },
  );
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
    err.code = data?.code || null;
    err.details = data?.details || null;
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

const LINK_AUTH_TTL_MS = 365 * 86400 * 1000; // authorize once — stay linked for a year
const LINK_AUTH_SLIDE_MS = 30 * 86400 * 1000; // extend when under 30 days left

async function touchLinkAuthExpiry(row) {
  if (!row?.code) return;
  const left = new Date(row.expires_at).getTime() - Date.now();
  if (left > LINK_AUTH_SLIDE_MS) return;
  try {
    await sb(`mcp_link_sessions?code=eq.${encodeURIComponent(row.code)}`, {
      method: "PATCH",
      body: JSON.stringify({ expires_at: new Date(Date.now() + LINK_AUTH_TTL_MS).toISOString() }),
      headers: { Prefer: "return=minimal" },
    });
  } catch {
    /* non-fatal */
  }
}

async function bindLinkSession(row, mcpSessionId) {
  const sessionId = String(mcpSessionId || "").trim();
  if (!row?.code || !sessionId || row.mcp_session_id === sessionId) return;
  try {
    await sb(`mcp_link_sessions?code=eq.${encodeURIComponent(row.code)}`, {
      method: "PATCH",
      body: JSON.stringify({ mcp_session_id: sessionId }),
      headers: { Prefer: "return=minimal" },
    });
  } catch {
    /* non-fatal */
  }
}

async function resolveLinkAuth({ authCode, mcpSessionId } = {}) {
  const code = String(authCode || "").trim();
  const sessionId = String(mcpSessionId || "").trim();
  try {
    if (code) {
      const rows = await sb(
        `mcp_link_sessions?code=eq.${encodeURIComponent(code)}&mcp_kind=eq.x&select=*&limit=1`,
      );
      const row = Array.isArray(rows) ? rows[0] : null;
      if (row && row.status === "completed" && row.user_id) {
        if (new Date(row.expires_at).getTime() < Date.now()) return null;
        await touchLinkAuthExpiry(row);
        await bindLinkSession(row, sessionId);
        return {
          userId: row.user_id,
          agentId: row.agent_id,
          walletAddress: row.wallet_address,
          source: "link_auth",
          authCode: code,
          bearerPresent: false,
        };
      }
    }
    if (sessionId) {
      const rows = await sb(
        `mcp_link_sessions?mcp_session_id=eq.${encodeURIComponent(sessionId)}&mcp_kind=eq.x&status=eq.completed&order=completed_at.desc&select=*&limit=1`,
      );
      const row = Array.isArray(rows) ? rows[0] : null;
      if (row?.user_id && new Date(row.expires_at).getTime() >= Date.now()) {
        await touchLinkAuthExpiry(row);
        return {
          userId: row.user_id,
          agentId: row.agent_id,
          walletAddress: row.wallet_address,
          source: "link_session",
          authCode: row.code,
          bearerPresent: false,
        };
      }
    }
  } catch {
    /* table may not exist yet */
  }
  return null;
}

async function resolveAuth(req, opts = {}) {
  const { token, bearerPresent } = extractBearerToken(req);
  if (token) {
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
      if (tok && new Date(tok.expires_at).getTime() >= Date.now()) {
        return {
          userId: tok.user_id,
          agentId: tok.agent_id,
          walletAddress: tok.wallet_address,
          source: "oauth_token",
          bearerPresent,
        };
      }
    } catch {
      /* fall through */
    }
  }

  const link = await resolveLinkAuth({
    authCode: opts.authCode,
    mcpSessionId: opts.mcpSessionId || header(req, "mcp-session-id"),
  });
  return link;
}

async function createLinkAuthSession(req) {
  const code = opaque("oxlink");
  let sessionId = String(header(req, "mcp-session-id") || "").trim();
  if (!sessionId) sessionId = opaque("sess").slice(0, 24);
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  try {
    await sb("mcp_link_sessions", {
      method: "POST",
      body: JSON.stringify({
        code,
        mcp_kind: "x",
        mcp_session_id: sessionId,
        status: "pending",
        expires_at: expiresAt,
      }),
      headers: { Prefer: "return=minimal" },
    });
  } catch (e) {
    return {
      ok: false,
      error: "link_auth_unavailable",
      message:
        e?.message ||
        "Link auth table missing — apply sql/Aug_SQL/09_mcp_link_auth.sql in Supabase, then retry.",
    };
  }
  const url = `${MCP_HOST}/x/link-auth?code=${encodeURIComponent(code)}`;
  return {
    ok: true,
    url,
    openUrl: url,
    authCode: code,
    mcpSessionId: sessionId,
    expiresInMinutes: 15,
    expiresAt,
    message:
      "Prefer dashboard paste auth when the user already has an authCode. Otherwise send this clickable link — they authorize once, then call x_auth_status and pass authCode on later x_* tools (stays linked).",
  };
}

async function getLinkAuthStatus(authCode) {
  const code = String(authCode || "").trim();
  if (!code) return { ok: false, error: "authCode_required", status: "unknown" };
  try {
    const rows = await sb(
      `mcp_link_sessions?code=eq.${encodeURIComponent(code)}&mcp_kind=eq.x&select=code,status,expires_at,completed_at,user_id&limit=1`,
    );
    const row = Array.isArray(rows) ? rows[0] : null;
    if (!row) return { ok: false, error: "not_found", status: "unknown", authCode: code };
    const expired = new Date(row.expires_at).getTime() < Date.now();
    if (expired && row.status === "pending") {
      return {
        ok: true,
        status: "expired",
        authCode: code,
        message: "Link expired. Call x_auth_link again and send the user a fresh URL.",
      };
    }
    if (row.status === "completed" && row.user_id) {
      return {
        ok: true,
        status: "completed",
        authenticated: true,
        authCode: code,
        completedAt: row.completed_at,
        message:
          "OrbitX linked. Pass this authCode on every subsequent x_* tool (or rely on this chat's MCP session — stays connected). Call x_menu for the command board.",
      };
    }
    return {
      ok: true,
      status: "pending",
      authenticated: false,
      authCode: code,
      url: `${MCP_HOST}/x/link-auth?code=${encodeURIComponent(code)}`,
      message: "Still waiting — ask the user to open the link and authorize (or paste a dashboard chat-auth message).",
    };
  } catch (e) {
    return {
      ok: false,
      error: "link_auth_unavailable",
      message: e?.message || "Link auth unavailable",
    };
  }
}

async function completeLinkAuthSession({ code, userId }) {
  const authCode = String(code || "").trim();
  if (!authCode) throw new Error("code required");
  if (!userId) throw new Error("unauthorized");

  const rows = await sb(
    `mcp_link_sessions?code=eq.${encodeURIComponent(authCode)}&mcp_kind=eq.x&select=*&limit=1`,
  );
  const row = Array.isArray(rows) ? rows[0] : null;
  if (!row) throw new Error("Invalid or unknown link code");
  if (new Date(row.expires_at).getTime() < Date.now()) {
    await sb(`mcp_link_sessions?code=eq.${encodeURIComponent(authCode)}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "expired" }),
      headers: { Prefer: "return=minimal" },
    });
    throw new Error("This link expired. Ask Grok for a new auth link.");
  }
  if (row.status === "completed" && row.user_id === userId) {
    return { ok: true, status: "completed", authCode, already: true };
  }
  if (row.status === "completed") {
    throw new Error("This link was already used by another account.");
  }

  const agent = await ensureAgent(userId);
  const access = opaque("oxx");
  await sb("agent_api_keys", {
    method: "POST",
    body: JSON.stringify({
      agent_id: agent.id,
      name: `Grok link ${new Date().toISOString().slice(0, 16)}`,
      key_hash: sha256(access),
    }),
    headers: { Prefer: "return=minimal" },
  });
  try {
    await sb("agent_mcp_oauth_tokens", {
      method: "POST",
      body: JSON.stringify({
        token_hash: sha256(access),
        user_id: userId,
        agent_id: agent.id,
        wallet_address: agent.wallet_address,
        expires_at: new Date(Date.now() + 30 * 86400 * 1000).toISOString(),
      }),
      headers: { Prefer: "return=minimal" },
    });
  } catch {
    /* optional */
  }

  // Keep link usable for a year after approve — Grok/Claude pass authCode in tool args.
  // Sliding expiry on each successful resolve keeps "auth once" sessions alive.
  const linkExpires = new Date(Date.now() + LINK_AUTH_TTL_MS).toISOString();
  await sb(`mcp_link_sessions?code=eq.${encodeURIComponent(authCode)}`, {
    method: "PATCH",
    body: JSON.stringify({
      status: "completed",
      user_id: userId,
      agent_id: agent.id,
      wallet_address: agent.wallet_address,
      access_token_hash: sha256(access),
      completed_at: new Date().toISOString(),
      expires_at: linkExpires,
    }),
    headers: { Prefer: "return=minimal" },
  });

  return { ok: true, status: "completed", authCode };
}

/** Dashboard mint: pre-authorized authCode + paste messages (no mid-chat site click). */
async function mintLinkAuthSession({ userId } = {}) {
  if (!userId) throw new Error("unauthorized");
  const code = opaque("oxlink");
  const sessionId = opaque("sess").slice(0, 24);
  const agent = await ensureAgent(userId);
  const access = opaque("oxx");
  await sb("agent_api_keys", {
    method: "POST",
    body: JSON.stringify({
      agent_id: agent.id,
      name: `Chat auth ${new Date().toISOString().slice(0, 16)}`,
      key_hash: sha256(access),
    }),
    headers: { Prefer: "return=minimal" },
  });
  try {
    await sb("agent_mcp_oauth_tokens", {
      method: "POST",
      body: JSON.stringify({
        token_hash: sha256(access),
        user_id: userId,
        agent_id: agent.id,
        wallet_address: agent.wallet_address,
        expires_at: new Date(Date.now() + 30 * 86400 * 1000).toISOString(),
      }),
      headers: { Prefer: "return=minimal" },
    });
  } catch {
    /* optional */
  }
  const linkExpires = new Date(Date.now() + LINK_AUTH_TTL_MS).toISOString();
  await sb("mcp_link_sessions", {
    method: "POST",
    body: JSON.stringify({
      code,
      mcp_kind: "x",
      mcp_session_id: sessionId,
      status: "completed",
      user_id: userId,
      agent_id: agent.id,
      wallet_address: agent.wallet_address,
      access_token_hash: sha256(access),
      completed_at: new Date().toISOString(),
      expires_at: linkExpires,
    }),
    headers: { Prefer: "return=minimal" },
  });
  const profile = await getXProfile(userId);
  const messages = buildXAuthPasteMessages({
    authCode: code,
    mcpUrl: MCP_URL,
    expiresAt: linkExpires,
    xUsername: profile?.twitter_username || null,
  });
  return {
    ok: true,
    status: "completed",
    authenticated: true,
    authCode: code,
    mcpSessionId: sessionId,
    expiresAt: linkExpires,
    mcpUrl: MCP_URL,
    xUsername: profile?.twitter_username || null,
    xConnected: Boolean(profile?.twitter_access_token),
    walletAddress: agent.wallet_address || null,
    messages,
    message:
      "Copy the Grok / Claude / ChatGPT message into chat. The AI will call x_auth_status with authCode — no website click needed.",
  };
}

async function getXProfile(userId) {
  try {
    const rows = await sb(
      `profiles?user_id=eq.${encodeURIComponent(userId)}&select=twitter_access_token,twitter_refresh_token,twitter_token_expires_at,twitter_id,twitter_username,twitter_name,twitter_avatar,twitter_oauth_scopes,username&limit=1`,
    );
    return Array.isArray(rows) ? rows[0] : null;
  } catch {
    const rows = await sb(
      `profiles?user_id=eq.${encodeURIComponent(userId)}&select=twitter_access_token,twitter_refresh_token,twitter_token_expires_at,twitter_id,twitter_username,twitter_name,twitter_avatar,username&limit=1`,
    );
    return Array.isArray(rows) ? rows[0] : null;
  }
}

function parseScopeSet(scopeStr) {
  return new Set(
    String(scopeStr || "")
      .split(/[\s,]+/)
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

function xScopeInfo(profileOrScope) {
  const scopeStr =
    typeof profileOrScope === "string"
      ? profileOrScope
      : profileOrScope?.twitter_oauth_scopes || "";
  const scopes = parseScopeSet(scopeStr);
  return {
    scopes: scopeStr || null,
    hasTweetWrite: scopes.has("tweet.write"),
    hasDmWrite: scopes.has("dm.write"),
    requestedScopes: X_OAUTH_SCOPES,
  };
}

async function refreshOAuth2Token(refreshToken) {
  if (!TWITTER_CLIENT_ID || !TWITTER_CLIENT_SECRET) {
    return { ok: false, error: "missing_client_credentials" };
  }
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
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    console.error("[x-mcp] X token refresh failed", res.status, String(text).slice(0, 400));
    return {
      ok: false,
      status: res.status,
      error: data?.error || "refresh_failed",
      message: data?.error_description || data?.error || text || res.statusText,
    };
  }
  return { ok: true, ...data };
}

function shouldKeepExistingScopes(prevScopeStr, nextScopeStr) {
  const prev = xScopeInfo(prevScopeStr);
  const next = xScopeInfo(nextScopeStr);
  // Never downgrade a token that already has tweet.write / dm.write.
  if (prev.hasTweetWrite && !next.hasTweetWrite) return true;
  if (prev.hasDmWrite && !next.hasDmWrite) return true;
  return false;
}

async function persistRefreshedXToken(userId, profile, refreshed, refreshToken) {
  const refreshPatch = {
    twitter_access_token: refreshed.access_token,
    twitter_refresh_token: refreshed.refresh_token ?? refreshToken,
    twitter_token_expires_at: new Date(
      Date.now() + (refreshed.expires_in || 7200) * 1000,
    ).toISOString(),
  };
  if (
    refreshed.scope &&
    !shouldKeepExistingScopes(profile.twitter_oauth_scopes, refreshed.scope)
  ) {
    refreshPatch.twitter_oauth_scopes = String(refreshed.scope);
    profile.twitter_oauth_scopes = String(refreshed.scope);
  }
  try {
    await sb(`profiles?user_id=eq.${encodeURIComponent(userId)}`, {
      method: "PATCH",
      body: JSON.stringify(refreshPatch),
      headers: { Prefer: "return=minimal" },
    });
  } catch {
    delete refreshPatch.twitter_oauth_scopes;
    await sb(`profiles?user_id=eq.${encodeURIComponent(userId)}`, {
      method: "PATCH",
      body: JSON.stringify(refreshPatch),
      headers: { Prefer: "return=minimal" },
    });
  }
  profile.twitter_access_token = refreshed.access_token;
  profile.twitter_refresh_token = refreshPatch.twitter_refresh_token;
  profile.twitter_token_expires_at = refreshPatch.twitter_token_expires_at;
  return refreshed.access_token;
}

async function resolveUserAccessToken(userId, { forceRefresh = false } = {}) {
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
  const expiresAt = profile.twitter_token_expires_at
    ? new Date(profile.twitter_token_expires_at).getTime()
    : null;
  const skewMs = 10 * 60 * 1000; // refresh 10 min before hard expiry
  // Do not auto-refresh when expires_at is null (avoids concurrent refresh-token races).
  // Missing expiry is handled by 401 → forceRefresh retries on post/DM paths.
  const needsRefresh =
    forceRefresh || (expiresAt != null && expiresAt < Date.now() + skewMs);

  if (needsRefresh) {
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
    if (!refreshed?.ok || !refreshed.access_token) {
      return {
        ok: false,
        error: "x_refresh_failed",
        message:
          refreshed?.message ||
          "Could not refresh X token. Reconnect X on https://orbitx.world/x (one-time).",
        fixUrl: "https://orbitx.world/x",
        profile,
      };
    }
    accessToken = await persistRefreshedXToken(userId, profile, refreshed, refreshToken);
  }

  return { ok: true, accessToken, profile, ...xScopeInfo(profile) };
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


async function resolveLinkedRepo(auth) {
  let agentId = null;
  if (auth?.userId) {
    try {
      const agent = await ensureXAgent(sb, auth.userId);
      agentId = agent?.id || null;
    } catch {
      /* ignore */
    }
  }
  return loadLinkedRepo(sb, agentId);
}

async function handleXRepoTool(name, a, auth) {
  if (name === "x_repo_link") {
    if (!auth?.userId) {
      return {
        ok: false,
        error: "auth_required",
        message: "Link auth first (authCode / x_auth_status), then call x_repo_link with your GitHub URL.",
      };
    }
    const agent = await ensureXAgent(sb, auth.userId);
    return saveLinkedRepo(sb, {
      agentId: agent.id,
      userId: auth.userId,
      repoUrl: a.repo || a.url || a.github || "",
      ref: a.ref || a.branch || undefined,
    });
  }

  const linked = await resolveLinkedRepo(auth);
  if (!linked?.ok || !linked.owner) {
    return {
      ok: false,
      error: "no_repo",
      message: `No repo linked. Call x_repo_link with owner/repo, or set X_MCP_GITHUB_REPO (default ${DEFAULT_GITHUB_REPO}).`,
    };
  }

  if (name === "x_repo") {
    const info = await getRepoInfo(linked);
    if (!info.ok) return info;
    return {
      ...info,
      linkedVia: linked.source,
      defaultRepo: DEFAULT_GITHUB_REPO,
      tools: ["x_repo_read", "x_repo_tree", "x_repo_search", "x_repo_context", "x_repo_link"],
      tip: "When drafting posts, call x_repo_context or x_repo_read — do not ask the user to paste the GitHub link again.",
    };
  }

  if (name === "x_repo_read") {
    return readRepoFile(linked, a.path || a.file || "", { ref: a.ref || a.branch });
  }
  if (name === "x_repo_tree") {
    return listRepoTree(linked, {
      path: a.path || "",
      ref: a.ref || a.branch,
      max: a.max ?? 80,
    });
  }
  if (name === "x_repo_search") {
    return searchRepo(linked, a.q || a.query || "", { max: a.max ?? 12 });
  }
  if (name === "x_repo_context") {
    return buildRepoContext(linked, { hint: a.hint || a.topic || a.q || "" });
  }
  return { ok: false, error: "unknown_repo_tool", tool: name };
}

async function resolveXTargetUserId(resolved, a = {}) {
  const username = String(a.username || a.handle || "").replace(/^@/, "").trim();
  if (username) {
    const u = await lookupXUser(resolved.accessToken, username);
    if (!u?.id) {
      return { ok: false, error: "user_not_found", message: `No X user @${username}` };
    }
    return { ok: true, userId: u.id, username: u.username || username, user: u };
  }
  let userId = String(a.userId || a.user_id || resolved.profile?.twitter_id || "").trim();
  if (!userId) {
    const me = await getXMe(resolved.accessToken);
    userId = me?.user?.id || "";
  }
  if (!userId) {
    return {
      ok: false,
      error: "missing_twitter_id",
      message: "Could not resolve X user id. Pass username or reconnect X on /x.",
      fixUrl: "https://orbitx.world/x",
    };
  }
  return { ok: true, userId, username: resolved.profile?.twitter_username || null };
}

async function runXGeneratedActivity(meta, a, auth, req) {
  const kind = meta.kind;
  const limit = Number(a.maxResults ?? a.max_results ?? meta.limit) || meta.limit || 20;
  const page = Number(meta.page) || 1;
  // Walk pagination tokens for page > 1 when the API returns next_token
  async function pageGraph(listFn, resolved, userId) {
    let token = a.paginationToken || a.pagination_token || undefined;
    let last = null;
    for (let p = 1; p <= page; p += 1) {
      last = await listFn(resolved.accessToken, userId, {
        maxResults: limit,
        paginationToken: token,
      });
      if (!last?.ok) return last;
      token = last.nextToken || undefined;
      if (p < page && !token) {
        return { ...last, page, note: `Only ${p} page(s) available` };
      }
    }
    return { ...last, page, limit };
  }

  if (kind === "pdf_scan") {
    return scanPdfContent({ url: a.url, text: a.text, base64: a.base64 });
  }
  if (kind === "credits_usage") {
    return callTool("x_credits_usage", { ...a, period: a.period || meta.period, limit }, auth, req);
  }
  if (kind === "connection") {
    return callTool("x_connection_status", a, auth, req);
  }

  const resolved = await resolveUserAccessToken(auth.userId);
  if (!resolved.ok) return resolved;

  if (kind === "me") return getXMe(resolved.accessToken);
  if (kind === "user_lookup") {
    const username = String(a.username || "").replace(/^@/, "").trim();
    if (!username) return { ok: false, error: "username_required", message: "username required" };
    try {
      const u = await lookupXUser(resolved.accessToken, username);
      return u ? { ok: true, user: u, page, limit } : { ok: false, error: "user_not_found" };
    } catch (e) {
      return { ok: false, error: "lookup_failed", message: e?.message };
    }
  }
  if (kind === "dm_inbox") {
    return listDmEventsOAuth2(resolved.accessToken, { maxResults: limit });
  }
  if (kind === "mentions") {
    const target = await resolveXTargetUserId(resolved, a);
    if (!target.ok) return target;
    return listMentionsOAuth2(resolved.accessToken, target.userId, { maxResults: limit });
  }
  if (kind === "followers" || kind === "recent_followers" || kind === "audience") {
    const target = await resolveXTargetUserId(resolved, a);
    if (!target.ok) return target;
    return pageGraph(listFollowersOAuth2, resolved, target.userId);
  }
  if (kind === "following" || kind === "network") {
    const target = await resolveXTargetUserId(resolved, a);
    if (!target.ok) return target;
    return pageGraph(listFollowingOAuth2, resolved, target.userId);
  }
  if (kind === "tweet_metrics" || kind === "views") {
    return getTweetMetricsOAuth2(resolved.accessToken, a.tweetId || a.tweet_id || a.id);
  }
  if (kind === "user_tweets" || kind === "timeline") {
    const target = await resolveXTargetUserId(resolved, a);
    if (!target.ok) return target;
    return listUserTweetsOAuth2(resolved.accessToken, target.userId, {
      maxResults: limit,
      paginationToken: a.paginationToken || a.pagination_token || undefined,
    });
  }
  if (kind === "lists") {
    const target = await resolveXTargetUserId(resolved, a);
    if (!target.ok) return target;
    return listOwnedListsOAuth2(resolved.accessToken, target.userId, { maxResults: limit });
  }
  if (kind === "list_members") {
    return listListMembersOAuth2(resolved.accessToken, a.listId || a.list_id, {
      maxResults: limit,
      paginationToken: a.paginationToken || a.pagination_token || undefined,
    });
  }
  if (kind === "analytics") {
    return callTool("x_analytics", { ...a, maxResults: limit }, auth, req);
  }
  return {
    ok: false,
    error: "unknown_activity",
    kind,
    message: `Unknown activity kind ${kind}`,
  };
}

async function callTool(rawName, args, auth, req = null) {
  const name = normalizeXToolName(rawName);
  const a = args && typeof args === "object" ? args : {};

  if (name === "x_menu") {
    let xUsername = null;
    if (auth?.userId) {
      try {
        const profile = await getXProfile(auth.userId);
        xUsername = profile?.twitter_username || null;
      } catch {
        /* ignore */
      }
    }
    return xMenuPayload({
      authCode: a.authCode || auth?.authCode || null,
      xUsername,
    });
  }

  // ChatGPT connector protocol — exact tool names "search" / "fetch"
  if (name === "search") {
    const q = String(a.query || "").trim().toLowerCase();
    if (!q || q === "/" || q === "menu" || q === "help" || q === "commands") {
      return callTool("x_menu", { authCode: a.authCode || auth?.authCode }, auth, req);
    }
    const catalog = TOOLS.filter((t) => t.name !== "search" && t.name !== "fetch").map((t) => ({
      id: `tool:${t.name}`,
      title: t.name,
      url: "https://www.orbitx.world/x",
      text: t.description,
    }));
    const docs = [
      {
        id: "menu",
        title: "OrbitX X command menu",
        url: "https://www.orbitx.world/x",
        text: "Branded OrbitX banner + X capability menu. Call x_menu or fetch id menu.",
      },
      {
        id: "help",
        title: "OrbitX X MCP help",
        url: "https://www.orbitx.world/x",
        text: "Connect X on /x. Prefer dashboard paste authCode; else x_auth_link. Tools: x_post, x_dm, x_agent_run, …",
      },
      {
        id: "status",
        title: "X connection status",
        url: "https://www.orbitx.world/x",
        text: "Use x_connection_status to see if X is linked and whether tweet.write is present.",
      },
      {
        id: "queue",
        title: "Agent queue",
        url: "https://www.orbitx.world/x",
        text: "Use x_agent_list_queue / x_agent_approve for drafts.",
      },
      {
        id: "credits",
        title: "Buy / usage credits",
        url: "https://www.orbitx.world/x?tab=shop",
        text: "Buy credits with SOL via x_credits_buy → pay → x_credits_confirm. Advanced usage: x_credits_usage. Shop: /shop or /x?tab=shop",
      },
      {
        id: "access",
        title: "MCP access via $ORBITX burn",
        url: "https://www.orbitx.world/x?tab=shop",
        text: "Burn 100 $ORBITX for 1 hour, 1,000 for 1 day, 10,000 for 1 week, or 1,000,000 for 1 month. Call x_mcp_access_buy → Jupiter buy+burn → x_mcp_access_confirm. Status: x_mcp_access_status.",
      },
      {
        id: "usage",
        title: "Advanced credits usage",
        url: "https://www.orbitx.world/x?tab=shop",
        text: "Call x_credits_usage for balance + ledger.",
      },
      ...catalog,
    ];
    const results = docs.filter(
      (d) =>
        d.id.includes(q) ||
        d.title.toLowerCase().includes(q) ||
        d.text.toLowerCase().includes(q),
    );
    return { results: results.length ? results : docs.slice(0, 8) };
  }

  if (name === "fetch") {
    const id = String(a.id || "").trim();
    if (!id) return { ok: false, error: "id_required", message: "id is required" };
    if (id === "menu" || id === "/" || id === "help") {
      return callTool("x_menu", { authCode: a.authCode || auth?.authCode }, auth, req);
    }
    if (id.startsWith("tool:")) {
      const toolName = id.slice("tool:".length);
      const t = TOOLS.find((x) => x.name === toolName);
      if (!t) return { id, title: "Not found", text: `Unknown tool ${toolName}`, url: "https://www.orbitx.world/x" };
      return {
        id,
        title: t.name,
        url: "https://www.orbitx.world/x",
        text: `${t.description}\n\nSchema: ${JSON.stringify(t.inputSchema)}`,
      };
    }
    if (id === "status") {
      return callTool("x_connection_status", {}, auth, req);
    }
    if (id === "queue") {
      return callTool("x_agent_list_queue", { limit: 10 }, auth, req);
    }
    if (id === "credits" || id === "shop" || id === "buy") {
      return callTool("x_credits_buy", { askOnly: true }, auth, req);
    }
    if (id === "access" || id === "mcp-access" || id === "burn") {
      return callTool("x_mcp_access_buy", { askOnly: true }, auth, req);
    }
    if (id === "usage") {
      return callTool("x_credits_usage", { limit: 20 }, auth, req);
    }
    return {
      id,
      title: id,
      url: "https://www.orbitx.world/x",
      text: "Unknown id. Try menu, help, status, queue, credits, usage, or tool:x_post.",
    };
  }

  if (name === "x_auth_link") {
    return createLinkAuthSession(req);
  }

  if (name === "x_auth_status") {
    return getLinkAuthStatus(a.authCode || auth?.authCode);
  }

  if (name === "x_help") {
    return {
      ok: true,
      mcpUrl: MCP_URL,
      setupUrl: "https://www.orbitx.world/x",
      clientId: CLIENT_ID,
      scope: SCOPE,
      tools: TOOLS.map((t) => t.name),
      steps: [
        "Open https://www.orbitx.world/x and sign in",
        "Connect X (Reconnect after scope upgrades for DMs)",
        "Best: on /x dashboard → Copy chat auth for Grok/Claude/ChatGPT → paste into chat (no mid-chat click)",
        "Fallback Grok: ask to authenticate → x_auth_link → open URL → Authorize → tell Grok you're done",
        "Claude/ChatGPT: connector OAuth or Bearer key from /x",
        "In chat say / or menu → x_menu shows the OrbitX command board",
        "Train the agent (persona + knowledge) on /x Agent tab",
        "Enable auto-reply: mentions / DMs / group DMs (mode=approve queues drafts; mode=auto sends)",
        "Use x_dm / x_dm_inbox / x_dm_group for DMs + group chats",
        "Use x_agent_run / x_agent_schedule or approve drafts in Queue",
        "Buy credits: ask how much SOL → x_credits_buy → user pays → x_credits_confirm",
        "MCP access: ask hour (100 $ORBITX), day (1,000), week (10,000), or month (1,000,000) → x_mcp_access_buy → Jupiter buy+burn → x_mcp_access_confirm",
        "Advanced usage: x_credits_usage (also on /x Shop or /shop)",
      ],
      mcpAccess: {
        status: "x_mcp_access_status",
        buy: "x_mcp_access_buy",
        confirm: "x_mcp_access_confirm",
        packages: listPackages(),
        dashboard: "https://www.orbitx.world/x?tab=shop",
      },
      credits: {
        buy: "x_credits_buy",
        confirm: "x_credits_confirm",
        balance: "x_credits_balance",
        usage: "x_credits_usage",
        rate: `${CREDITS_PER_SOL} credits per 1 SOL`,
        payTo: PLATFORM_CREDITS_WALLET,
        tip: "User says buy credits → ASK amount → x_credits_buy → after payment x_credits_confirm",
      },
      dm: {
        send: "x_dm",
        inbox: "x_dm_inbox",
        group: "x_dm_group",
        tip: "Ask: Send a DM to @handle saying … — Claude will call x_dm. Group chats use conversationId from inbox.",
      },
      autoReply: {
        toggles: ["autoReplyMentions", "autoReplyDms", "autoReplyGroupDms"],
        poll: "x_agent_poll_replies",
        mentions: "x_mentions",
        tip: "Turn on toggles via x_agent_upsert or /x Agent tab. Approve mode = draft queue; auto = send.",
      },
      note: "Prefer dashboard paste authCode. Else x_auth_link. Pass authCode on every tool. Separate from Agent MCP (/api/mcp).",
      clients: ["claude", "chatgpt", "grok"],
      grokSetup:
        "Dashboard paste authCode → x_auth_status → pass authCode. Fallback: x_auth_link → Authorize → x_auth_status",
      env: ["NVIDIA_API_KEY", "TWITTER_CLIENT_ID", "TWITTER_CLIENT_SECRET", "CRON_SECRET"],
    };
  }

  if (!auth?.userId) {
    return {
      ok: false,
      error: "session_required",
      message:
        "Not authenticated. For Grok: call x_auth_link and send the user the URL. After they approve, call x_auth_status then pass authCode on tools. Or use connector Authenticate / Bearer key from https://orbitx.world/x.",
      fixUrl: "https://orbitx.world/x",
      hintTool: "x_auth_link",
    };
  }

  if (name === "x_connection_status") {
    const profile = await getXProfile(auth.userId);
    const connected = Boolean(profile?.twitter_access_token);
    const scope = xScopeInfo(profile);
    const warn =
      connected && scope.scopes && !scope.hasTweetWrite
        ? "Token is missing tweet.write — revoke OrbitX at x.com/settings/connected_apps, then Reconnect X on /x while signed in."
        : null;
    return {
      ok: true,
      connected,
      username: profile?.twitter_username || null,
      twitterId: profile?.twitter_id || null,
      displayName: profile?.twitter_name || null,
      avatar: profile?.twitter_avatar || null,
      ...scope,
      warn,
      fixUrl: "https://orbitx.world/x",
      message: !connected
        ? "X not connected — open /x and Connect X"
        : warn
          ? warn
          : `Connected as @${profile.twitter_username || "user"}`,
    };
  }

  if (name === "x_credits_buy") {
    const xc = await xCredits();
    const askOnly =
      a.askOnly === true ||
      (a.solAmount == null && a.credits == null && a.amount == null && a.sol == null);
    if (askOnly) return xc.creditsBuyPrompt();
    let wallet = String(a.publicKey || a.wallet || a.from || "").trim();
    if (!wallet) {
      try {
        const agent = await ensureAgent(auth.userId);
        wallet = String(agent?.wallet_address || "").trim();
      } catch {
        /* ignore */
      }
    }
    const prepared = xc.prepareCreditsMcpPurchase({
      base: MCP_HOST,
      wallet,
      solAmount: a.solAmount ?? a.sol,
      credits: a.credits,
      amount: a.amount,
      confirmMode: a.autoConfirm === true || a.auto === true ? "auto" : a.confirmMode || "sign",
    });
    if (prepared.ok && wallet) {
      try {
        const built = await xc.buildBuyTransaction({
          fromPubkey: wallet,
          solAmount: prepared.solAmount,
        });
        if (built?.ok && built.transactionBase64) {
          prepared.transactionBase64 = built.transactionBase64;
          prepared.hasUnsignedTx = true;
        }
      } catch {
        /* signUrl is enough */
      }
    }
    return prepared;
  }

  if (name === "x_credits_confirm") {
    const signature = String(a.signature || a.txSignature || a.tx_signature || a.sig || "").trim();
    if (!signature) {
      return { ok: false, error: "signature_required", message: "Pass the Solana transaction signature" };
    }
    try {
      const xc = await xCredits();
      return await xc.confirmCreditsPurchase(sb, auth.userId, signature);
    } catch (e) {
      return {
        ok: false,
        error: "confirm_failed",
        message: e?.message || "Could not credit purchase — ensure migration x_mcp_credits is applied",
      };
    }
  }

  if (name === "x_credits_balance") {
    try {
      const xc = await xCredits();
      return await xc.getCreditsBalance(sb, auth.userId);
    } catch (e) {
      return { ok: false, error: "balance_failed", message: e?.message || "balance unavailable" };
    }
  }

  if (name === "x_mcp_access_status") {
    try {
      return await getAccessStatus(sb, auth?.userId, {
        wallets: [a.publicKey, a.wallet, auth?.walletAddress],
      });
    } catch (e) {
      return { ok: false, error: "access_failed", message: e?.message || "access unavailable" };
    }
  }

  if (name === "x_mcp_access_buy") {
    const askOnly =
      a.askOnly === true || (a.package == null && a.packageId == null && a.option == null);
    if (askOnly) {
      return accessBuyPrompt({
        buyTool: "x_mcp_access_buy",
        confirmTool: "x_mcp_access_confirm",
        statusTool: "x_mcp_access_status",
        accessUrl: "https://www.orbitx.world/x?tab=shop",
      });
    }
    let wallet = String(a.publicKey || a.wallet || a.from || "").trim();
    if (!wallet) {
      try {
        const agent = await ensureAgent(auth.userId);
        wallet = String(agent?.wallet_address || "").trim();
      } catch {
        /* ignore */
      }
    }
    return prepareAccessMcpPurchase({
      base: MCP_HOST,
      wallet,
      packageId: a.package || a.packageId || a.option,
      confirmMode: a.autoConfirm === true || a.auto === true ? "auto" : a.confirmMode || "sign",
      accessUrl: "https://www.orbitx.world/x?tab=shop",
      buyTool: "x_mcp_access_buy",
      confirmTool: "x_mcp_access_confirm",
    });
  }

  if (name === "x_mcp_access_confirm") {
    const signature = String(a.signature || a.txSignature || a.tx_signature || a.sig || "").trim();
    if (!signature) {
      return { ok: false, error: "signature_required", message: "Pass the Solana transaction signature" };
    }
    try {
      return await confirmAccessBurn(sb, {
        userId: auth?.userId,
        signature,
        packageId: a.package || a.packageId,
        wallet: a.publicKey || a.wallet || auth?.walletAddress,
      });
    } catch (e) {
      return {
        ok: false,
        error: "confirm_failed",
        message: e?.message || "Could not grant access — apply mcp_burn_access migration",
      };
    }
  }

  if (name === "x_credits_usage") {
    try {
      const xc = await xCredits();
      let agentPosts = null;
      try {
        const agent = await ensureXAgent(sb, auth.userId);
        const max = Math.max(0, Number(agent?.max_posts_per_day ?? 5) || 0);
        const replyMax = Math.max(0, Number(agent?.max_replies_per_day ?? 30) || 0);
        const start = new Date();
        start.setUTCHours(0, 0, 0, 0);
        const q = await sb(
          `x_agent_queue?user_id=eq.${encodeURIComponent(auth.userId)}&status=eq.posted&updated_at=gte.${encodeURIComponent(start.toISOString())}&select=id`,
        );
        const used = Array.isArray(q) ? q.length : 0;
        agentPosts = {
          used,
          max,
          remaining: Math.max(0, max - used),
          replyMax,
        };
      } catch {
        /* optional */
      }
      return await xc.getCreditsUsage(sb, auth.userId, {
        limit: a.limit,
        period: a.period || "30d",
        format: a.format || "both",
        agentPosts,
      });
    } catch (e) {
      return { ok: false, error: "usage_failed", message: e?.message || "usage unavailable" };
    }
  }

  if (name === "x_buy") {
    const whatRaw = String(a.what || a.target || a.asset || "").toLowerCase().trim();
    const mentionsOrbitx =
      whatRaw.includes("orbitx") ||
      whatRaw === "token" ||
      Boolean(a.mint) ||
      /orbitx|\$orbitx/i.test(String(a.hint || a.query || ""));
    const mentionsCredits =
      whatRaw.includes("credit") ||
      a.credits != null ||
      whatRaw === "credits" ||
      whatRaw === "shop";
    const mentionsAccess =
      whatRaw === "access" ||
      whatRaw.includes("access") ||
      whatRaw === "burn" ||
      a.package != null ||
      a.packageId != null;
    let what = "ask";
    if (whatRaw === "access" || (mentionsAccess && !mentionsOrbitx && !mentionsCredits)) what = "access";
    else if (whatRaw === "orbitx" || whatRaw === "token" || (mentionsOrbitx && !mentionsCredits && !mentionsAccess)) what = "orbitx";
    else if (whatRaw === "credits" || whatRaw === "credit" || (mentionsCredits && !mentionsOrbitx && !mentionsAccess)) what = "credits";
    else if (mentionsAccess) what = "access";
    else if (mentionsOrbitx) what = "orbitx";
    else if (mentionsCredits) what = "credits";

    if (a.askOnly === true || what === "ask") {
      if (a.package != null || a.packageId != null) {
        what = "access";
      } else if (a.solAmount != null || a.credits != null || a.amount != null) {
        // Amount given but not what — default to credits (most common Grok "buy" ask)
        what = mentionsOrbitx ? "orbitx" : "credits";
      } else {
        return {
          ok: true,
          action: "ask_what",
          message:
            "Ask whether they want MCP credits (SOL → desk wallet), ORBITX token, or timed MCP access (burn 100 / 1,000 / 10,000 / 1,000,000 $ORBITX). Then call x_buy again with what=credits|orbitx|access.",
          tools: {
            credits: "x_credits_buy",
            orbitx: "x_buy_orbitx",
            access: "x_mcp_access_buy",
            unified: "x_buy",
          },
          hint: "Grok: always call tool name x_buy (not XBuyTool).",
        };
      }
    }
    if (what === "access") {
      return callTool("x_mcp_access_buy", { ...a, askOnly: a.askOnly === true && a.package == null && a.packageId == null }, auth, req);
    }
    if (what === "orbitx") {
      return callTool("x_buy_orbitx", { ...a, askOnly: a.askOnly === true && a.amountSol == null }, auth, req);
    }
    return callTool(
      "x_credits_buy",
      {
        ...a,
        askOnly: a.askOnly === true && a.solAmount == null && a.credits == null && a.amount == null,
      },
      auth,
      req,
    );
  }

  if (name === "x_buy_orbitx") {
    const askOnly = a.askOnly === true || a.amountSol == null || a.amountSol === "";
    if (askOnly) return askBuyOrbitxAmount();
    let wallet = String(a.publicKey || a.wallet || "").trim();
    if (!wallet) {
      try {
        const agent = await ensureAgent(auth.userId);
        wallet = String(agent?.wallet_address || "").trim();
      } catch {
        /* ignore */
      }
    }
    const confirmMode = a.autoConfirm === true || a.auto === true ? "auto" : a.confirmMode || "sign";
    const fetchJson = async (url, init) => {
      const r = await fetch(url, init);
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        const err = new Error(data?.error || data?.message || `HTTP ${r.status}`);
        err.data = data;
        throw err;
      }
      return data;
    };
    const out = await prepareBuyOrbitx({
      base: MCP_HOST,
      wallet,
      amountSol: a.amountSol ?? a.sol ?? a.amount,
      slippage: a.slippage,
      pool: a.pool || "auto",
      confirmMode,
      fetchJson,
    });
    if (out.ok && auth.userId) {
      try {
        await saveTradeIntent(sb, auth.userId, {
          mint: ORBITX_MINT,
          amountSol: out.amountSol,
          confirmMode: out.confirmMode,
          slippage: out.slippage,
          pool: out.pool,
        });
      } catch {
        /* optional */
      }
    }
    return out;
  }

  if (name === "x_confirm_buy") {
    let amountSol = a.amountSol ?? a.sol ?? a.amount;
    let slippage = Number(a.slippage) || 10;
    let pool = a.pool || "auto";
    if ((amountSol == null || amountSol === "") && auth.userId) {
      const intent = await loadLatestTradeIntent(sb, auth.userId, { mint: ORBITX_MINT });
      if (intent) {
        amountSol = Number(intent.amount_sol);
        slippage = Number(intent.slippage) || slippage;
        pool = intent.pool || pool;
      }
    }
    if (amountSol == null || amountSol === "") {
      return {
        ok: false,
        error: "no_pending_buy",
        message: "No pending $ORBITX buy. Ask how much SOL, call x_buy_orbitx, then confirm.",
      };
    }
    let wallet = String(a.publicKey || a.wallet || "").trim();
    if (!wallet) {
      try {
        const agent = await ensureAgent(auth.userId);
        wallet = String(agent?.wallet_address || "").trim();
      } catch {
        /* ignore */
      }
    }
    const fetchJson = async (url, init) => {
      const r = await fetch(url, init);
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        const err = new Error(data?.error || data?.message || `HTTP ${r.status}`);
        err.data = data;
        throw err;
      }
      return data;
    };
    const out = await prepareBuyOrbitx({
      base: MCP_HOST,
      wallet,
      amountSol,
      slippage,
      pool,
      confirmMode: "auto",
      preferAuto: true,
      fetchJson,
    });
    if (out.ok && auth.userId) {
      try {
        await saveTradeIntent(sb, auth.userId, {
          mint: ORBITX_MINT,
          amountSol: out.amountSol,
          confirmMode: "auto",
          slippage: out.slippage,
          pool: out.pool,
        });
      } catch {
        /* optional */
      }
    }
    return out;
  }

  if (name === "x_post" || name === "x_quote" || name === "x_reply") {
    const resolved = await resolveUserAccessToken(auth.userId);
    if (!resolved.ok) return resolved;

    const rawText = String(a.text || a.tweet || a.content || "").trim();
    if (!rawText) {
      return { ok: false, error: "text_required", message: "text is required" };
    }

    // Only attach quote/reply when the tool explicitly needs them (avoid stray null/empty fields).
    const quoteId =
      name === "x_quote" ? String(a.quoteTweetId || a.quote_tweet_id || "").trim() : "";
    const replyId =
      name === "x_reply"
        ? String(a.replyToTweetId || a.reply_to_tweet_id || "").trim()
        : name === "x_post"
          ? String(a.replyToTweetId || a.reply_to_tweet_id || "").trim()
          : "";
    if (name === "x_quote" && !quoteId) {
      return { ok: false, error: "quote_tweet_id_required", message: "quoteTweetId is required" };
    }
    if (name === "x_reply" && !replyId) {
      return { ok: false, error: "reply_to_required", message: "replyToTweetId is required" };
    }

    let tweetText;
    try {
      tweetText = libBuildTweetText(rawText, a.linkUrl || a.link_url || "");
    } catch (e) {
      return { ok: false, error: "text_invalid", message: e?.message || "Invalid tweet text" };
    }

    let mediaId = null;
    if (a.imageUrl || a.image_url) {
      try {
        mediaId = await uploadImageOAuth1a(String(a.imageUrl || a.image_url));
      } catch (e) {
        return {
          ok: false,
          error: "media_upload_failed",
          message: e?.message || "Image upload failed",
          hint: "Post without imageUrl, or set TWITTER_CONSUMER_* + TWITTER_ACCESS_TOKEN* on Vercel.",
        };
      }
    }

    let scope = xScopeInfo(resolved.profile);
    if (scope.scopes && !scope.hasTweetWrite) {
      return {
        ok: false,
        error: "tweet_write_missing",
        message:
          "This X token does not include tweet.write (portal checkbox alone is not enough — the OAuth token must list it).",
        ...scope,
        fixUrl: "https://orbitx.world/x",
        tip: "1) Sign in on orbitx.world/x  2) Revoke OrbitX at x.com/settings/connected_apps  3) Reconnect X  4) Confirm x_connection_status shows hasTweetWrite: true",
      };
    }

    try {
      let accessToken = resolved.accessToken;
      let posted = await libPostTweet(accessToken, {
        text: tweetText,
        mediaId: mediaId || undefined,
        replyToTweetId: replyId || undefined,
        quoteTweetId: quoteId || undefined,
      });
      // Silent AT expiry → force refresh once and retry (avoids "works then doesn't").
      if (!posted.ok && posted.status === 401) {
        const retryAuth = await resolveUserAccessToken(auth.userId, { forceRefresh: true });
        if (retryAuth.ok) {
          accessToken = retryAuth.accessToken;
          scope = xScopeInfo(retryAuth.profile);
          posted = await libPostTweet(accessToken, {
            text: tweetText,
            mediaId: mediaId || undefined,
            replyToTweetId: replyId || undefined,
            quoteTweetId: quoteId || undefined,
          });
        }
      }
      if (!posted.ok && (posted.status === 403 || posted.error === "tweet_forbidden")) {
        return {
          ...posted,
          username: resolved.profile?.twitter_username || null,
          text: tweetText,
          ...scope,
          tip: [
            "403 from X usually means the saved token lacks tweet.write or app permissions are wrong.",
            "Do this in order:",
            "1) developer.x.com → your app → User auth → permissions = Read and write and Direct message",
            "2) x.com/settings/connected_apps → revoke OrbitX",
            "3) Sign in at https://www.orbitx.world/x (wallet session required)",
            "4) Reconnect X, then ask Claude for x_connection_status",
          ].join(" "),
        };
      }
      return {
        ...posted,
        username: resolved.profile?.twitter_username || null,
        text: tweetText,
        ...scope,
      };
    } catch (e) {
      return {
        ok: false,
        error: "tweet_error",
        message: e?.message || "Post failed",
        fixUrl: "https://orbitx.world/x",
        ...scope,
        tip: "Reconnect X on /x while signed in so profiles.twitter_access_token is updated for Claude.",
      };
    }
  }

  if (name === "x_dm") {
    const resolved = await resolveUserAccessToken(auth.userId);
    if (!resolved.ok) return resolved;
    const text = String(a.text || "").trim();
    if (!text) return { ok: false, error: "text_required", message: "text is required" };
    let recipientId = String(a.recipientId || a.recipient_id || "").trim();
    const username = String(a.username || "").replace(/^@/, "").trim();
    try {
      if (!recipientId && username) {
        const u = await lookupXUser(resolved.accessToken, username);
        if (!u?.id) return { ok: false, error: "user_not_found", message: `No X user @${username}` };
        recipientId = u.id;
      }
      if (!recipientId) {
        return {
          ok: false,
          error: "recipient_required",
          message: "Pass username (preferred) or recipientId with the DM text.",
        };
      }
      const dm = await sendDmOAuth2(resolved.accessToken, { recipientId, text });
      return {
        ...dm,
        username: username || null,
        recipientId,
        tip: dm.ok
          ? null
          : "If 403: enable DM permissions in X developer portal, upgrade API tier if needed, then Reconnect X on /x.",
      };
    } catch (e) {
      return {
        ok: false,
        error: "dm_error",
        message: e?.message || "DM failed",
        fixUrl: "https://orbitx.world/x",
      };
    }
  }

  if (name === "x_dm_inbox") {
    const resolved = await resolveUserAccessToken(auth.userId);
    if (!resolved.ok) return resolved;
    try {
      return await listDmEventsOAuth2(resolved.accessToken, {
        maxResults: a.maxResults ?? a.max_results ?? 20,
      });
    } catch (e) {
      return {
        ok: false,
        error: "dm_inbox_error",
        message: e?.message || "DM inbox failed",
        fixUrl: "https://orbitx.world/x",
      };
    }
  }

  if (name === "x_dm_group") {
    const resolved = await resolveUserAccessToken(auth.userId);
    if (!resolved.ok) return resolved;
    const conversationId = String(a.conversationId || a.conversation_id || "").trim();
    const text = String(a.text || "").trim();
    if (!conversationId) {
      return { ok: false, error: "conversation_required", message: "conversationId is required" };
    }
    if (!text) return { ok: false, error: "text_required", message: "text is required" };
    try {
      const dm = await sendDmConversationOAuth2(resolved.accessToken, { conversationId, text });
      return {
        ...dm,
        tip: dm.ok
          ? null
          : "If 403: enable DM permissions, upgrade X API tier if needed, Reconnect X on /x.",
      };
    } catch (e) {
      return {
        ok: false,
        error: "dm_group_error",
        message: e?.message || "Group DM failed",
        fixUrl: "https://orbitx.world/x",
      };
    }
  }

  if (name === "x_mentions") {
    const resolved = await resolveUserAccessToken(auth.userId);
    if (!resolved.ok) return resolved;
    try {
      let twitterId = resolved.profile?.twitter_id || null;
      if (!twitterId) {
        const me = await getXMe(resolved.accessToken);
        twitterId = me?.user?.id || null;
      }
      if (!twitterId) {
        return {
          ok: false,
          error: "missing_twitter_id",
          message: "Could not resolve X user id. Reconnect X on /x.",
          fixUrl: "https://orbitx.world/x",
        };
      }
      return await listMentionsOAuth2(resolved.accessToken, twitterId, {
        maxResults: a.maxResults ?? a.max_results ?? 10,
        sinceId: a.sinceId || a.since_id || undefined,
      });
    } catch (e) {
      return {
        ok: false,
        error: "mentions_error",
        message: e?.message || "Mentions failed",
        fixUrl: "https://orbitx.world/x",
      };
    }
  }

  if (name === "x_tools_help") {
    return listXGeneratedHelp({
      q: a.q || a.query || "",
      limit: a.limit ?? 40,
    });
  }

  if (name === "x_pdf_scan") {
    return scanPdfContent({
      url: a.url,
      text: a.text,
      base64: a.base64,
    });
  }

  if (name === "x_dex_chart") {
    return buildDexChartEmbed(a);
  }

  if (
    name === "x_repo_link" ||
    name === "x_repo" ||
    name === "x_repo_read" ||
    name === "x_repo_tree" ||
    name === "x_repo_search" ||
    name === "x_repo_context"
  ) {
    return handleXRepoTool(name, a, auth);
  }

  if (name === "x_get_user") {
    const resolved = await resolveUserAccessToken(auth.userId);
    if (!resolved.ok) return resolved;
    try {
      const u = await lookupXUser(resolved.accessToken, a.username);
      if (!u) return { ok: false, error: "user_not_found", message: `No user @${a.username}` };
      return { ok: true, user: u };
    } catch (e) {
      return { ok: false, error: "lookup_failed", message: e?.message || "Lookup failed" };
    }
  }

  if (name === "x_me") {
    const resolved = await resolveUserAccessToken(auth.userId);
    if (!resolved.ok) return resolved;
    return getXMe(resolved.accessToken);
  }

  if (name === "x_followers" || name === "x_recent_followers" || name === "x_following") {
    const resolved = await resolveUserAccessToken(auth.userId);
    if (!resolved.ok) return resolved;
    try {
      const target = await resolveXTargetUserId(resolved, a);
      if (!target.ok) return target;
      const opts = {
        maxResults: a.maxResults ?? a.max_results ?? 20,
        paginationToken: a.paginationToken || a.pagination_token || undefined,
      };
      const edge = name === "x_following" ? listFollowingOAuth2 : listFollowersOAuth2;
      const out = await edge(resolved.accessToken, target.userId, opts);
      return {
        ...out,
        username: target.username || null,
        recent: name === "x_recent_followers",
      };
    } catch (e) {
      return { ok: false, error: "graph_failed", message: e?.message || "Followers/following failed" };
    }
  }

  if (name === "x_lists") {
    const resolved = await resolveUserAccessToken(auth.userId);
    if (!resolved.ok) return resolved;
    try {
      const target = await resolveXTargetUserId(resolved, a);
      if (!target.ok) return target;
      return await listOwnedListsOAuth2(resolved.accessToken, target.userId, {
        maxResults: a.maxResults ?? a.max_results ?? 20,
      });
    } catch (e) {
      return { ok: false, error: "lists_failed", message: e?.message || "Lists failed" };
    }
  }

  if (name === "x_list_members") {
    const resolved = await resolveUserAccessToken(auth.userId);
    if (!resolved.ok) return resolved;
    return listListMembersOAuth2(resolved.accessToken, a.listId || a.list_id, {
      maxResults: a.maxResults ?? a.max_results ?? 20,
      paginationToken: a.paginationToken || a.pagination_token || undefined,
    });
  }

  if (name === "x_tweet_metrics" || name === "x_views") {
    const resolved = await resolveUserAccessToken(auth.userId);
    if (!resolved.ok) return resolved;
    return getTweetMetricsOAuth2(resolved.accessToken, a.tweetId || a.tweet_id || a.id);
  }

  if (name === "x_user_tweets") {
    const resolved = await resolveUserAccessToken(auth.userId);
    if (!resolved.ok) return resolved;
    try {
      const target = await resolveXTargetUserId(resolved, a);
      if (!target.ok) return target;
      return await listUserTweetsOAuth2(resolved.accessToken, target.userId, {
        maxResults: a.maxResults ?? a.max_results ?? 10,
        paginationToken: a.paginationToken || a.pagination_token || undefined,
      });
    } catch (e) {
      return { ok: false, error: "tweets_failed", message: e?.message || "User tweets failed" };
    }
  }

  if (name === "x_dm_recent") {
    return callTool("x_dm_inbox", a, auth, req);
  }

  if (name === "x_analytics") {
    const resolved = await resolveUserAccessToken(auth.userId);
    if (!resolved.ok) return resolved;
    const n = Math.min(25, Math.max(5, Number(a.maxResults ?? a.max_results) || 10));
    const includeDms = a.includeDms !== false && a.include_dms !== false;
    const includeMentions = a.includeMentions !== false && a.include_mentions !== false;
    const includeFollowers = a.includeFollowers !== false && a.include_followers !== false;
    const includeTweets = a.includeTweets !== false && a.include_tweets !== false;
    try {
      const me = await getXMe(resolved.accessToken);
      const uid = me?.user?.id || resolved.profile?.twitter_id;
      if (!uid) {
        return { ok: false, error: "missing_twitter_id", message: "Reconnect X on /x", fixUrl: "https://orbitx.world/x" };
      }
      const [dms, mentions, followers, tweets] = await Promise.all([
        includeDms ? listDmEventsOAuth2(resolved.accessToken, { maxResults: n }) : Promise.resolve(null),
        includeMentions ? listMentionsOAuth2(resolved.accessToken, uid, { maxResults: n }) : Promise.resolve(null),
        includeFollowers ? listFollowersOAuth2(resolved.accessToken, uid, { maxResults: n }) : Promise.resolve(null),
        includeTweets ? listUserTweetsOAuth2(resolved.accessToken, uid, { maxResults: n }) : Promise.resolve(null),
      ]);
      return {
        ok: true,
        profile: me?.user || null,
        dms: dms?.ok ? { count: dms.events?.length || 0, events: dms.events } : dms,
        mentions: mentions?.ok ? { count: mentions.mentions?.length || 0, items: mentions.mentions } : mentions,
        recentFollowers: followers?.ok
          ? { count: followers.users?.length || 0, users: followers.users, nextToken: followers.nextToken }
          : followers,
        recentTweets: tweets?.ok ? { count: tweets.tweets?.length || 0, tweets: tweets.tweets } : tweets,
        tip: "Reconnect X on /x after deploy to pick up follows.read + list.read scopes.",
      };
    } catch (e) {
      return { ok: false, error: "analytics_failed", message: e?.message || "Analytics failed" };
    }
  }

  // Generated activity tools (~500 shortcuts + ~5000 x_act_*)
  {
    const gen = await dispatchXGenerated(name, a, (meta, args) =>
      runXGeneratedActivity(meta, args, auth, req),
    );
    if (gen != null) return gen;
  }

  if (name === "x_agent_poll_replies") {
    try {
      return await processAutoReplies(sb, resolveUserAccessToken, uploadImageOAuth1a, {
        forceUserId: auth.userId,
      });
    } catch (e) {
      return { ok: false, error: "poll_failed", message: e?.message || "Poll failed" };
    }
  }

  if (name === "x_agent_status") {
    const agent = await ensureXAgent(sb, auth.userId);
    const knowledge = await listKnowledge(sb, agent.id);
    return {
      ok: true,
      agent: mapAgentRow(agent),
      knowledgeCount: knowledge.length,
      models: NIM_MODELS,
    };
  }

  if (name === "x_agent_upsert") {
    const agent = await ensureXAgent(sb, auth.userId);
    const patch = { updated_at: new Date().toISOString() };
    if (a.name != null) patch.name = String(a.name).slice(0, 80);
    if (a.persona != null) patch.persona = String(a.persona).slice(0, 8000);
    if (a.voiceNotes != null || a.voice_notes != null) {
      patch.voice_notes = String(a.voiceNotes ?? a.voice_notes).slice(0, 4000);
    }
    if (a.model != null) patch.model = String(a.model);
    if (a.mode === "auto" || a.mode === "approve") patch.mode = a.mode;
    if (typeof a.enabled === "boolean") patch.enabled = a.enabled;
    if (Array.isArray(a.topics)) patch.topics = a.topics.map((t) => String(t)).slice(0, 40);
    if (a.maxPostsPerDay != null || a.max_posts_per_day != null) {
      patch.max_posts_per_day = Math.max(0, Math.min(48, Number(a.maxPostsPerDay ?? a.max_posts_per_day) || 0));
    }
    if (typeof a.autoReplyMentions === "boolean" || typeof a.auto_reply_mentions === "boolean") {
      patch.auto_reply_mentions = Boolean(a.autoReplyMentions ?? a.auto_reply_mentions);
    }
    if (typeof a.autoReplyDms === "boolean" || typeof a.auto_reply_dms === "boolean") {
      patch.auto_reply_dms = Boolean(a.autoReplyDms ?? a.auto_reply_dms);
    }
    if (typeof a.autoReplyGroupDms === "boolean" || typeof a.auto_reply_group_dms === "boolean") {
      patch.auto_reply_group_dms = Boolean(a.autoReplyGroupDms ?? a.auto_reply_group_dms);
    }
    if (a.maxRepliesPerDay != null || a.max_replies_per_day != null) {
      patch.max_replies_per_day = Math.max(
        0,
        Math.min(200, Number(a.maxRepliesPerDay ?? a.max_replies_per_day) || 0),
      );
    }
    if (Array.isArray(a.postingWindows) || Array.isArray(a.posting_windows)) {
      patch.posting_windows = a.postingWindows || a.posting_windows;
    }
    if (a.timezone != null) patch.timezone = String(a.timezone).slice(0, 64);
    const row = await patchXAgent(sb, agent, patch);
    return { ok: true, agent: mapAgentRow(row) };
  }

  if (name === "x_agent_train") {
    const agent = await ensureXAgent(sb, auth.userId);
    const patch = { updated_at: new Date().toISOString() };
    if (a.persona != null) patch.persona = String(a.persona).slice(0, 8000);
    if (a.voiceNotes != null || a.voice_notes != null) {
      patch.voice_notes = String(a.voiceNotes ?? a.voice_notes).slice(0, 4000);
    }
    if (Object.keys(patch).length > 1) {
      await sb(`x_agents?id=eq.${encodeURIComponent(agent.id)}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
        headers: { Prefer: "return=minimal" },
      });
    }
    let knowledge = null;
    const content = String(a.content || "").trim();
    if (content) {
      const created = await sb("x_agent_knowledge", {
        method: "POST",
        body: JSON.stringify({
          agent_id: agent.id,
          user_id: auth.userId,
          title: String(a.title || "Note").slice(0, 120),
          content: content.slice(0, 12000),
        }),
      });
      knowledge = Array.isArray(created) ? created[0] : created;
    }
    const fresh = await ensureXAgent(sb, auth.userId);
    return { ok: true, agent: mapAgentRow(fresh), knowledge };
  }

  if (name === "x_agent_schedule") {
    const agent = await ensureXAgent(sb, auth.userId);
    const text = String(a.text || "").trim();
    if (!text) return { ok: false, error: "text_required", message: "text is required" };
    const kind = ["post", "quote", "reply", "dm"].includes(a.kind) ? a.kind : "post";
    const scheduledFor = a.scheduledFor || a.scheduled_for || null;
    const autoApprove = Boolean(a.autoApprove ?? a.auto_approve);
    const status = scheduledFor ? "scheduled" : autoApprove || agent.mode === "auto" ? "approved" : "pending";
    const created = await sb("x_agent_queue", {
      method: "POST",
      body: JSON.stringify({
        agent_id: agent.id,
        user_id: auth.userId,
        kind,
        payload: {
          text,
          quote_tweet_id: a.quoteTweetId || a.quote_tweet_id || null,
          quoteTweetId: a.quoteTweetId || a.quote_tweet_id || null,
          reply_to: a.replyToTweetId || a.reply_to_tweet_id || null,
          replyToTweetId: a.replyToTweetId || a.reply_to_tweet_id || null,
          dmRecipientId: a.recipientId || a.recipient_id || null,
          username: a.username || null,
          linkUrl: a.linkUrl || a.link_url || null,
        },
        status,
        scheduled_for: scheduledFor,
        source: "mcp",
      }),
    });
    const row = Array.isArray(created) ? created[0] : created;
    return { ok: true, item: mapQueueRow(row) };
  }

  if (name === "x_agent_run") {
    const agent = await ensureXAgent(sb, auth.userId);
    const draft = await generateAgentPost(sb, agent, a.hint ? String(a.hint) : null);
    if (!draft.ok) return draft;
    const forcePost = Boolean(a.forcePost ?? a.force_post);
    const shouldPost = forcePost || agent.mode === "auto";
    if (shouldPost) {
      const resolved = await resolveUserAccessToken(auth.userId);
      if (!resolved.ok) return resolved;
      const posted = await libPostTweet(resolved.accessToken, { text: draft.text });
      if (!posted.ok) return { ...posted, draft };
      const created = await sb("x_agent_queue", {
        method: "POST",
        body: JSON.stringify({
          agent_id: agent.id,
          user_id: auth.userId,
          kind: draft.kind || "post",
          payload: { text: draft.text },
          status: "posted",
          posted_tweet_id: posted.tweetId,
          source: "mcp",
        }),
      });
      const row = Array.isArray(created) ? created[0] : created;
      return { ok: true, posted: true, tweet: posted, item: mapQueueRow(row), draft };
    }
    const created = await sb("x_agent_queue", {
      method: "POST",
      body: JSON.stringify({
        agent_id: agent.id,
        user_id: auth.userId,
        kind: draft.kind || "post",
        payload: { text: draft.text },
        status: "pending",
        source: "mcp",
      }),
    });
    const row = Array.isArray(created) ? created[0] : created;
    return { ok: true, posted: false, item: mapQueueRow(row), draft };
  }

  if (name === "x_agent_list_queue") {
    const limit = Math.min(50, Math.max(1, Number(a.limit) || 20));
    let q = `x_agent_queue?user_id=eq.${encodeURIComponent(auth.userId)}&order=created_at.desc&limit=${limit}&select=*`;
    if (a.status) q += `&status=eq.${encodeURIComponent(String(a.status))}`;
    const rows = await sb(q);
    return { ok: true, items: (Array.isArray(rows) ? rows : []).map(mapQueueRow) };
  }

  if (name === "x_agent_approve") {
    const id = String(a.id || "").trim();
    if (!id) return { ok: false, error: "id_required", message: "id is required" };
    const rows = await sb(
      `x_agent_queue?id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(auth.userId)}&limit=1&select=*`,
    );
    const item = Array.isArray(rows) ? rows[0] : null;
    if (!item) return { ok: false, error: "not_found", message: "Queue item not found" };
    const postNow = a.postNow !== false && a.post_now !== false;
    if (postNow) {
      return executeQueueItem(sb, item, resolveUserAccessToken, uploadImageOAuth1a);
    }
    const updated = await sb(`x_agent_queue?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "approved", updated_at: new Date().toISOString() }),
    });
    const row = Array.isArray(updated) ? updated[0] : updated;
    return { ok: true, item: mapQueueRow(row) };
  }

  if (name === "x_agent_cancel") {
    const id = String(a.id || "").trim();
    if (!id) return { ok: false, error: "id_required", message: "id is required" };
    const updated = await sb(
      `x_agent_queue?id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(auth.userId)}`,
      {
        method: "PATCH",
        body: JSON.stringify({ status: "cancelled", updated_at: new Date().toISOString() }),
      },
    );
    const row = Array.isArray(updated) ? updated[0] : updated;
    return { ok: true, item: mapQueueRow(row) };
  }

  // Last-chance: anything that looks like a buy → unified x_buy (Grok invents names)
  if (/buy/i.test(String(rawName || name || ""))) {
    return callTool("x_buy", a, auth, req);
  }
  return {
    ok: false,
    error: "unknown_tool",
    tool: name,
    requested: rawName,
    message: `Unknown tool "${rawName}". Use x_menu, x_tools_help, x_analytics, x_buy, or CORE names from tools/list.`,
    availableBuyTools: [
      "x_buy",
      "x_credits_buy",
      "x_buy_orbitx",
      "x_confirm_buy",
      "x_mcp_access_buy",
      "x_mcp_access_confirm",
      "x_mcp_access_status",
    ],
    hint: "Call x_tools_help to browse ~5000 activity tools (followers, DMs, PDF scan, views, lists).",
  };
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
        ...xScopeInfo(profile),
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
      ...xScopeInfo(profile),
    });
  }

  if (route === "disconnect" && req.method === "POST") {
    const user = await getAuthUser(req);
    if (!user?.id) return json(res, { error: "unauthorized" }, 401);
    try {
      await sb(`profiles?user_id=eq.${encodeURIComponent(user.id)}`, {
        method: "PATCH",
        body: JSON.stringify({
          twitter_access_token: null,
          twitter_refresh_token: null,
          twitter_token_expires_at: null,
          twitter_oauth_scopes: null,
        }),
        headers: { Prefer: "return=minimal" },
      });
    } catch {
      await sb(`profiles?user_id=eq.${encodeURIComponent(user.id)}`, {
        method: "PATCH",
        body: JSON.stringify({
          twitter_access_token: null,
          twitter_refresh_token: null,
          twitter_token_expires_at: null,
        }),
        headers: { Prefer: "return=minimal" },
      });
    }
    return json(res, { ok: true });
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

  if (route === "link/approve" && req.method === "POST") {
    const authUser = await getAuthUser(req);
    if (!authUser?.id) return json(res, { error: "unauthorized" }, 401);
    const body = await readBody(req);
    try {
      const out = await completeLinkAuthSession({ code: body.code, userId: authUser.id });
      return json(res, out);
    } catch (e) {
      return json(res, { error: e?.message || "link_approve_failed" }, 400);
    }
  }

  if (route === "link/create" && req.method === "POST") {
    const authUser = await getAuthUser(req);
    if (!authUser?.id) return json(res, { error: "unauthorized" }, 401);
    try {
      const out = await mintLinkAuthSession({ userId: authUser.id });
      return json(res, out);
    } catch (e) {
      return json(res, { error: e?.message || "link_create_failed" }, 400);
    }
  }

  if (route === "link/status" && req.method === "GET") {
    const u = new URL(req.url || "/", "http://x");
    const code = u.searchParams.get("code") || "";
    return json(res, await getLinkAuthStatus(code));
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

  // ── Direct messages (UI) ────────────────────────────────────────────────
  if (route === "dm" && req.method === "POST") {
    const user = await getAuthUser(req);
    if (!user?.id) return json(res, { error: "unauthorized" }, 401);
    const body = await readBody(req);
    const text = String(body.text || "").trim();
    if (!text) return json(res, { error: "text is required" }, 400);
    let recipientId = String(body.recipientId || body.recipient_id || "").trim();
    const username = String(body.username || "").replace(/^@/, "").trim();
    try {
      const resolved = await resolveUserAccessToken(user.id);
      if (!resolved.ok) return json(res, resolved, 400);
      if (!recipientId && username) {
        const u = await lookupXUser(resolved.accessToken, username);
        if (!u?.id) return json(res, { error: `No X user @${username}` }, 404);
        recipientId = u.id;
      }
      if (!recipientId) return json(res, { error: "username or recipientId required" }, 400);
      const dm = await sendDmOAuth2(resolved.accessToken, { recipientId, text });
      return json(res, { ...dm, username: username || null, recipientId }, dm.ok ? 200 : 403);
    } catch (e) {
      return json(res, { error: e?.message || "dm_failed" }, 500);
    }
  }

  if (route === "dm/inbox" && req.method === "GET") {
    const user = await getAuthUser(req);
    if (!user?.id) return json(res, { error: "unauthorized" }, 401);
    try {
      const resolved = await resolveUserAccessToken(user.id);
      if (!resolved.ok) return json(res, resolved, 400);
      const inbox = await listDmEventsOAuth2(resolved.accessToken, { maxResults: 20 });
      return json(res, inbox, inbox.ok ? 200 : 403);
    } catch (e) {
      return json(res, { error: e?.message || "dm_inbox_failed" }, 500);
    }
  }

  // ── X Agent (NVIDIA) + queue + cron ─────────────────────────────────────
  if (route === "cron") {
    if (req.method !== "GET" && req.method !== "POST") return json(res, { error: "method_not_allowed" }, 405);
    const cronSecret = process.env.CRON_SECRET || "";
    const authz = String(header(req, "authorization") || "");
    const vercelCron = String(header(req, "x-vercel-cron") || "");
    const ok =
      (cronSecret && authz === `Bearer ${cronSecret}`) ||
      Boolean(vercelCron) ||
      (!cronSecret && process.env.VERCEL !== "1");
    if (!ok) return json(res, { error: "unauthorized" }, 401);
    try {
      const result = await runCronTick(sb, resolveUserAccessToken, uploadImageOAuth1a);
      return json(res, result);
    } catch (e) {
      return json(res, { error: e?.message || "cron_failed" }, 500);
    }
  }

  if (route === "models" && req.method === "GET") {
    return json(res, { models: NIM_MODELS, defaultModel: DEFAULT_NIM_MODEL });
  }

  // ── Purchasable MCP credits (shop / usage) ───────────────────────────────
  if (route === "credits" || route === "credits/balance") {
    const user = await getAuthUser(req);
    if (!user?.id) return json(res, { error: "unauthorized" }, 401);
    if (req.method !== "GET") return json(res, { error: "method_not_allowed" }, 405);
    try {
      const xc = await xCredits();
      return json(res, await xc.getCreditsBalance(sb, user.id));
    } catch (e) {
      return json(res, { error: e?.message || "credits_failed" }, 500);
    }
  }

  if (route === "credits/usage" && req.method === "GET") {
    const user = await getAuthUser(req);
    if (!user?.id) return json(res, { error: "unauthorized" }, 401);
    const u = new URL(req.url || "/", "http://x");
    const limit = Number(u.searchParams.get("limit") || 50);
    const period = u.searchParams.get("period") || "30d";
    const format = u.searchParams.get("format") || "both";
    try {
      const xc = await xCredits();
      let agentPosts = null;
      try {
        const agent = await ensureXAgent(sb, user.id);
        const max = Math.max(0, Number(agent?.max_posts_per_day ?? 5) || 0);
        const replyMax = Math.max(0, Number(agent?.max_replies_per_day ?? 30) || 0);
        const start = new Date();
        start.setUTCHours(0, 0, 0, 0);
        const q = await sb(
          `x_agent_queue?user_id=eq.${encodeURIComponent(user.id)}&status=eq.posted&updated_at=gte.${encodeURIComponent(start.toISOString())}&select=id`,
        );
        const used = Array.isArray(q) ? q.length : 0;
        agentPosts = { used, max, remaining: Math.max(0, max - used), replyMax };
      } catch {
        /* optional */
      }
      return json(res, await xc.getCreditsUsage(sb, user.id, { limit, period, format, agentPosts }));
    } catch (e) {
      return json(res, { error: e?.message || "usage_failed" }, 500);
    }
  }

  if (route === "credits/quote" && (req.method === "GET" || req.method === "POST")) {
    const user = await getAuthUser(req);
    if (!user?.id) return json(res, { error: "unauthorized" }, 401);
    const xc = await xCredits();
    let solAmount;
    if (req.method === "GET") {
      const u = new URL(req.url || "/", "http://x");
      solAmount = Number(u.searchParams.get("sol") || u.searchParams.get("solAmount") || 0);
    } else {
      const body = await readBody(req);
      solAmount = Number(body.solAmount ?? body.sol ?? 0);
    }
    return json(res, xc.quoteCredits(solAmount));
  }

  if (route === "credits/buy" && req.method === "POST") {
    const user = await getAuthUser(req);
    if (!user?.id) return json(res, { error: "unauthorized" }, 401);
    const body = await readBody(req);
    const solAmount = Number(body.solAmount ?? body.sol ?? 0);
    const publicKey = String(body.publicKey || body.wallet || "").trim();
    try {
      const xc = await xCredits();
      if (publicKey) {
        return json(res, await xc.buildBuyTransaction({ fromPubkey: publicKey, solAmount }));
      }
      return json(res, xc.quoteCredits(solAmount));
    } catch (e) {
      return json(res, { error: e?.message || "buy_setup_failed" }, 500);
    }
  }

  if (route === "mcp-access" && req.method === "GET") {
    const user = await getAuthUser(req);
    const u = new URL(req.url || "/", "http://x");
    const walletPk = String(
      u.searchParams.get("wallet") || u.searchParams.get("publicKey") || "",
    ).trim();
    if (!user?.id && !walletPk) return json(res, { error: "unauthorized" }, 401);
    try {
      return json(res, await getAccessStatus(sb, user?.id, { wallets: [walletPk] }));
    } catch (e) {
      return json(res, { error: e?.message || "mcp_access_failed", packages: listPackages() }, 500);
    }
  }

  if (route === "mcp-access/prepare" && req.method === "POST") {
    const body = await readBody(req);
    const pk = String(body.publicKey || body.wallet || body.walletAddress || "").trim();
    const packageId = body.packageId || body.package || body.option;
    try {
      const out = await prepareAccessBurn({ publicKey: pk, packageId });
      return json(res, out, out.ok ? 200 : 400);
    } catch (e) {
      return json(res, { ok: false, error: e?.message || "prepare_failed" }, 400);
    }
  }

  if (route === "mcp-access/confirm" && req.method === "POST") {
    const user = await getAuthUser(req);
    const body = await readBody(req);
    const signature = String(body.signature || body.txSignature || body.tx_signature || "").trim();
    if (!signature) return json(res, { error: "signature_required" }, 400);
    try {
      const out = await confirmAccessBurn(sb, {
        userId: user?.id,
        signature,
        packageId: body.packageId || body.package,
        wallet: body.publicKey || body.wallet,
      });
      return json(res, out, out.ok ? 200 : 400);
    } catch (e) {
      return json(res, { error: e?.message || "confirm_failed" }, 500);
    }
  }

  if (route === "credits/confirm" && req.method === "POST") {
    const user = await getAuthUser(req);
    if (!user?.id) return json(res, { error: "unauthorized" }, 401);
    const body = await readBody(req);
    const signature = String(body.signature || body.txSignature || body.tx_signature || "").trim();
    if (!signature) return json(res, { error: "signature_required" }, 400);
    try {
      const xc = await xCredits();
      const out = await xc.confirmCreditsPurchase(sb, user.id, signature);
      return json(res, out, out.ok ? 200 : 400);
    } catch (e) {
      return json(res, { error: e?.message || "confirm_failed" }, 500);
    }
  }

  if (route === "x-agents" || route === "agents") {
    const user = await getAuthUser(req);
    if (!user?.id) return json(res, { error: "unauthorized" }, 401);
    if (req.method === "GET") {
      const agent = await ensureXAgent(sb, user.id);
      const knowledge = await listKnowledge(sb, agent.id);
      return json(res, {
        agent: mapAgentRow(agent),
        knowledge: knowledge.map((k) => ({
          id: k.id,
          title: k.title,
          content: k.content,
          createdAt: k.created_at,
        })),
        models: NIM_MODELS,
      });
    }
    if (req.method === "POST" || req.method === "PATCH") {
      const body = await readBody(req);
      const agent = await ensureXAgent(sb, user.id);
      const patch = { updated_at: new Date().toISOString() };
      if (body.name != null) patch.name = String(body.name).slice(0, 80);
      if (body.persona != null) patch.persona = String(body.persona).slice(0, 8000);
      if (body.voiceNotes != null || body.voice_notes != null) {
        patch.voice_notes = String(body.voiceNotes ?? body.voice_notes).slice(0, 4000);
      }
      if (body.model != null) patch.model = String(body.model);
      if (body.mode === "auto" || body.mode === "approve") patch.mode = body.mode;
      if (typeof body.enabled === "boolean") patch.enabled = body.enabled;
      if (Array.isArray(body.topics)) patch.topics = body.topics.map((t) => String(t)).slice(0, 40);
      if (body.maxPostsPerDay != null || body.max_posts_per_day != null) {
        patch.max_posts_per_day = Math.max(
          0,
          Math.min(48, Number(body.maxPostsPerDay ?? body.max_posts_per_day) || 0),
        );
      }
      if (typeof body.autoReplyMentions === "boolean" || typeof body.auto_reply_mentions === "boolean") {
        patch.auto_reply_mentions = Boolean(body.autoReplyMentions ?? body.auto_reply_mentions);
      }
      if (typeof body.autoReplyDms === "boolean" || typeof body.auto_reply_dms === "boolean") {
        patch.auto_reply_dms = Boolean(body.autoReplyDms ?? body.auto_reply_dms);
      }
      if (
        typeof body.autoReplyGroupDms === "boolean" ||
        typeof body.auto_reply_group_dms === "boolean"
      ) {
        patch.auto_reply_group_dms = Boolean(body.autoReplyGroupDms ?? body.auto_reply_group_dms);
      }
      if (body.maxRepliesPerDay != null || body.max_replies_per_day != null) {
        patch.max_replies_per_day = Math.max(
          0,
          Math.min(200, Number(body.maxRepliesPerDay ?? body.max_replies_per_day) || 0),
        );
      }
      if (Array.isArray(body.postingWindows) || Array.isArray(body.posting_windows)) {
        patch.posting_windows = body.postingWindows || body.posting_windows;
      }
      if (body.timezone != null) patch.timezone = String(body.timezone).slice(0, 64);
      try {
        const row = await patchXAgent(sb, agent, patch);
        return json(res, { agent: mapAgentRow(row) });
      } catch (e) {
        console.error("[x-mcp] x-agents save failed", e);
        return json(res, { error: e?.message || "save_failed" }, 500);
      }
    }
    return json(res, { error: "method_not_allowed" }, 405);
  }

  if ((route === "x-agents/poll-replies" || route === "agents/poll-replies") && req.method === "POST") {
    const user = await getAuthUser(req);
    if (!user?.id) return json(res, { error: "unauthorized" }, 401);
    try {
      const result = await processAutoReplies(sb, resolveUserAccessToken, uploadImageOAuth1a, {
        forceUserId: user.id,
      });
      return json(res, result);
    } catch (e) {
      console.error("[x-mcp] poll-replies failed", e);
      return json(res, { error: e?.message || "poll_failed" }, 500);
    }
  }

  if ((route === "mentions" || route === "x-mentions") && req.method === "GET") {
    const user = await getAuthUser(req);
    if (!user?.id) return json(res, { error: "unauthorized" }, 401);
    const resolved = await resolveUserAccessToken(user.id);
    if (!resolved.ok) return json(res, resolved, 400);
    try {
      let twitterId = resolved.profile?.twitter_id || null;
      if (!twitterId) {
        const me = await getXMe(resolved.accessToken);
        twitterId = me?.user?.id || null;
      }
      if (!twitterId) return json(res, { error: "missing_twitter_id" }, 400);
      const ment = await listMentionsOAuth2(resolved.accessToken, twitterId, { maxResults: 15 });
      return json(res, ment, ment.ok ? 200 : 403);
    } catch (e) {
      return json(res, { error: e?.message || "mentions_failed" }, 500);
    }
  }

  if ((route === "x-agents/train" || route === "agents/train") && req.method === "POST") {
    const user = await getAuthUser(req);
    if (!user?.id) return json(res, { error: "unauthorized" }, 401);
    const body = await readBody(req);
    const agent = await ensureXAgent(sb, user.id);
    const patch = { updated_at: new Date().toISOString() };
    if (body.persona != null) patch.persona = String(body.persona).slice(0, 8000);
    if (body.voiceNotes != null || body.voice_notes != null) {
      patch.voice_notes = String(body.voiceNotes ?? body.voice_notes).slice(0, 4000);
    }
    if (Object.keys(patch).length > 1) {
      await sb(`x_agents?id=eq.${encodeURIComponent(agent.id)}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
        headers: { Prefer: "return=minimal" },
      });
    }
    let knowledge = null;
    const content = String(body.content || "").trim();
    if (content) {
      const created = await sb("x_agent_knowledge", {
        method: "POST",
        body: JSON.stringify({
          agent_id: agent.id,
          user_id: user.id,
          title: String(body.title || "Note").slice(0, 120),
          content: content.slice(0, 12000),
        }),
      });
      knowledge = Array.isArray(created) ? created[0] : created;
    }
    const fresh = await ensureXAgent(sb, user.id);
    const all = await listKnowledge(sb, agent.id);
    return json(res, {
      agent: mapAgentRow(fresh),
      knowledge,
      knowledgeList: all.map((k) => ({
        id: k.id,
        title: k.title,
        content: k.content,
        createdAt: k.created_at,
      })),
    });
  }

  if ((route === "x-agents/generate" || route === "agents/generate") && req.method === "POST") {
    const user = await getAuthUser(req);
    if (!user?.id) return json(res, { error: "unauthorized" }, 401);
    const body = await readBody(req);
    const agent = await ensureXAgent(sb, user.id);
    try {
      const draft = await generateAgentPost(sb, agent, body.hint ? String(body.hint) : null);
      if (!draft.ok) return json(res, draft, 500);
      const postNow = Boolean(body.postNow || body.post_now);
      if (postNow) {
        const resolved = await resolveUserAccessToken(user.id);
        if (!resolved.ok) return json(res, resolved, 400);
        const posted = await libPostTweet(resolved.accessToken, { text: draft.text });
        if (!posted.ok) return json(res, { ...posted, draft }, posted.status === 429 ? 429 : 400);
        const created = await sb("x_agent_queue", {
          method: "POST",
          body: JSON.stringify({
            agent_id: agent.id,
            user_id: user.id,
            kind: draft.kind || "post",
            payload: { text: draft.text },
            status: "posted",
            posted_tweet_id: posted.tweetId,
            source: "ui",
          }),
        });
        const row = Array.isArray(created) ? created[0] : created;
        return json(res, { ok: true, posted: true, tweet: posted, item: mapQueueRow(row), draft });
      }
      const created = await sb("x_agent_queue", {
        method: "POST",
        body: JSON.stringify({
          agent_id: agent.id,
          user_id: user.id,
          kind: draft.kind || "post",
          payload: { text: draft.text },
          status: agent.mode === "auto" ? "approved" : "pending",
          source: "ui",
        }),
      });
      const row = Array.isArray(created) ? created[0] : created;
      return json(res, { ok: true, posted: false, item: mapQueueRow(row), draft });
    } catch (e) {
      return json(res, { error: e?.message || "generate_failed" }, 500);
    }
  }

  if (route === "queue") {
    const user = await getAuthUser(req);
    if (!user?.id) return json(res, { error: "unauthorized" }, 401);
    if (req.method === "GET") {
      const url = new URL(req.url || "/", "http://local");
      const qStatus = String(url.searchParams.get("status") || "").trim();
      let q = `x_agent_queue?user_id=eq.${encodeURIComponent(user.id)}&order=created_at.desc&limit=50&select=*`;
      if (qStatus) q += `&status=eq.${encodeURIComponent(qStatus)}`;
      const rows = await sb(q);
      return json(res, { items: (Array.isArray(rows) ? rows : []).map(mapQueueRow) });
    }
    if (req.method === "POST") {
      const body = await readBody(req);
      const agent = await ensureXAgent(sb, user.id);
      const text = String(body.text || body.payload?.text || "").trim();
      if (!text) return json(res, { error: "text is required" }, 400);
      const kind = ["post", "quote", "reply", "dm"].includes(body.kind) ? body.kind : "post";
      const scheduledFor = body.scheduledFor || body.scheduled_for || null;
      const created = await sb("x_agent_queue", {
        method: "POST",
        body: JSON.stringify({
          agent_id: agent.id,
          user_id: user.id,
          kind,
          payload: body.payload || {
            text,
            quoteTweetId: body.quoteTweetId || null,
            replyToTweetId: body.replyToTweetId || null,
            dmRecipientId: body.recipientId || null,
            username: body.username || null,
            linkUrl: body.linkUrl || null,
          },
          status: scheduledFor ? "scheduled" : body.status || "pending",
          scheduled_for: scheduledFor,
          source: "ui",
        }),
      });
      const row = Array.isArray(created) ? created[0] : created;
      return json(res, { item: mapQueueRow(row) });
    }
    return json(res, { error: "method_not_allowed" }, 405);
  }

  {
    const approveMatch = route.match(/^queue\/([^/]+)\/approve$/);
    if (approveMatch && req.method === "POST") {
      const user = await getAuthUser(req);
      if (!user?.id) return json(res, { error: "unauthorized" }, 401);
      const id = approveMatch[1];
      const rows = await sb(
        `x_agent_queue?id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(user.id)}&limit=1&select=*`,
      );
      const item = Array.isArray(rows) ? rows[0] : null;
      if (!item) return json(res, { error: "not_found" }, 404);
      try {
        const result = await executeQueueItem(sb, item, resolveUserAccessToken, uploadImageOAuth1a);
        return json(res, { ok: true, result });
      } catch (e) {
        return json(res, { error: e?.message || "approve_failed" }, 500);
      }
    }
  }

  {
    const delMatch = route.match(/^queue\/([^/]+)$/);
    if (delMatch && req.method === "DELETE") {
      const user = await getAuthUser(req);
      if (!user?.id) return json(res, { error: "unauthorized" }, 401);
      const id = delMatch[1];
      await sb(
        `x_agent_queue?id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(user.id)}`,
        {
          method: "PATCH",
          body: JSON.stringify({ status: "cancelled", updated_at: new Date().toISOString() }),
          headers: { Prefer: "return=minimal" },
        },
      );
      return json(res, { ok: true });
    }
  }


  // Public setup diagnostics (no secrets) — helps match X developer portal.
  if (route === "oauth/config" && req.method === "GET") {
    const configured = Boolean(TWITTER_CLIENT_ID && TWITTER_CLIENT_SECRET);
    return json(res, {
      configured,
      hasClientId: Boolean(TWITTER_CLIENT_ID),
      hasClientSecret: Boolean(TWITTER_CLIENT_SECRET),
      clientId: TWITTER_CLIENT_ID || null,
      callbackUrl: "https://www.orbitx.world/x-callback",
      websiteUrl: "https://www.orbitx.world",
      scopes: X_OAUTH_SCOPES,
      appTypeRequired: "Web App, Automated App or Bot",
      permissionsRequired: "Read and write (+ DM read/write if available)",
      checklist: [
        "Open developer.x.com → the app whose Client ID matches below",
        "User authentication settings → On",
        "App permissions → Read and write + DM permissions if available",
        "Reconnect X after changing scopes (needed for DMs)",
        "Type of App → Web App, Automated App or Bot",
        "Callback URI → https://www.orbitx.world/x-callback (exact, no trailing slash)",
        "Website URL → https://www.orbitx.world",
        "Save → wait ~1 min → retry Connect X on www.orbitx.world/x",
      ],
    });
  }

  // Build authorize URL server-side so TWITTER_CLIENT_ID from Vercel is used
  // (VITE_* is easy to miss and gets baked at build time).
  if (route === "oauth/start" && req.method === "POST") {
    if (!TWITTER_CLIENT_ID) {
      return json(
        res,
        {
          error:
            "TWITTER_CLIENT_ID missing on Vercel. Add TWITTER_CLIENT_ID + TWITTER_CLIENT_SECRET, redeploy, then Connect X again.",
        },
        503,
      );
    }
    const body = await readBody(req);
    const redirectUri = String(body.redirectUri || body.redirect_uri || "").trim();
    const codeChallenge = String(body.codeChallenge || body.code_challenge || "").trim();
    const state = String(body.state || "").trim();
    if (!redirectUri || !codeChallenge || !state) {
      return json(res, { error: "Missing redirectUri, codeChallenge, or state" }, 400);
    }
    const allowed = [
      "https://www.orbitx.world/x-callback",
      "https://orbitx.world/x-callback",
      "https://www.ogscan.fun/x-callback",
      "https://ogscan.fun/x-callback",
    ];
    const isLocal =
      /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/x-callback$/.test(redirectUri);
    if (!allowed.includes(redirectUri) && !isLocal) {
      return json(res, { error: "redirectUri not allowed", redirectUri }, 400);
    }
    const params = new URLSearchParams({
      response_type: "code",
      client_id: TWITTER_CLIENT_ID,
      redirect_uri: redirectUri,
      scope: X_OAUTH_SCOPES,
      state,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
      // Encourage a fresh consent screen so tweet.write is re-granted after scope changes.
      force_login: "true",
    });
    return json(res, {
      authorizeUrl: `https://x.com/i/oauth2/authorize?${params.toString()}`,
      clientId: TWITTER_CLIENT_ID,
      redirectUri,
      scope: X_OAUTH_SCOPES,
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
    const grantedScope = String(tokens.scope || "").trim();
    const scopeInfo = xScopeInfo(grantedScope);

    // Refuse to persist a read-only token — that causes "no write permissions" forever.
    if (grantedScope && !scopeInfo.hasTweetWrite) {
      return json(
        res,
        {
          error: "tweet_write_missing",
          message:
            "X did not grant tweet.write. In developer.x.com set App permissions to Read and write and Direct message, revoke OrbitX at x.com/settings/connected_apps, then Connect X again.",
          scope: grantedScope,
          ...scopeInfo,
          fixUrl: "https://www.orbitx.world/x",
        },
        403,
      );
    }

    const authUser = await getAuthUser(req);
    if (!authUser?.id) {
      return json(
        res,
        {
          error:
            "Sign in to OrbitX before connecting X. Without a session, tokens are not saved and Claude MCP cannot post.",
          fixUrl: "https://www.orbitx.world/x",
          scope: grantedScope || null,
          ...scopeInfo,
        },
        401,
      );
    }

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

    {
      const expiresAt = new Date(Date.now() + expires_in * 1000).toISOString();
      const patch = {
        twitter_access_token: access_token,
        twitter_refresh_token: refresh_token,
        twitter_token_expires_at: expiresAt,
        twitter_id: twitterId || null,
        twitter_username: twitterUsername || null,
        twitter_name: twitterName || null,
        twitter_avatar: twitterAvatar || null,
        twitter_oauth_scopes: grantedScope || null,
      };
      try {
        await sb(`profiles?user_id=eq.${encodeURIComponent(authUser.id)}`, {
          method: "PATCH",
          body: JSON.stringify(patch),
          headers: { Prefer: "return=minimal" },
        });
      } catch {
        // Retry without optional columns some schemas lack
        delete patch.twitter_oauth_scopes;
        delete patch.twitter_avatar;
        delete patch.twitter_name;
        await sb(`profiles?user_id=eq.${encodeURIComponent(authUser.id)}`, {
          method: "PATCH",
          body: JSON.stringify(patch),
          headers: { Prefer: "return=minimal" },
        });
      }
    }

    return json(res, {
      access_token,
      refresh_token,
      expires_in,
      scope: grantedScope || null,
      ...scopeInfo,
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
    // Issuer = MCP_URL so Grok (URL-only) does not fall through to Agent MCP at /.well-known/*
    return json(res, {
      resource: MCP_URL,
      authorization_servers: [MCP_URL],
      scopes_supported: [SCOPE],
      bearer_methods_supported: ["header"],
    });
  }

  if (
    (route === ".well-known/oauth-authorization-server" || route === "oauth-authorization-server") &&
    req.method === "GET"
  ) {
    return json(res, {
      issuer: MCP_URL,
      authorization_endpoint: `${MCP_URL}/oauth/authorize`,
      token_endpoint: `${MCP_URL}/oauth/token`,
      registration_endpoint: `${MCP_URL}/oauth/register`,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code", "refresh_token"],
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
        grant_types: ["authorization_code", "refresh_token"],
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
    const grantType = String(body.grant_type || "authorization_code").trim();
    const code = body.code || body.refresh_token;
    if (!code) {
      return json(res, { error: "invalid_request", error_description: "code or refresh_token required" }, 400);
    }

    const token = String(code);
    const isApiKey =
      token.startsWith("oxo_") ||
      token.startsWith("oxk_") ||
      token.startsWith("oxx_") ||
      token.startsWith("oxc_");

    if (isApiKey && (grantType === "authorization_code" || grantType === "refresh_token")) {
      // Long-lived MCP bearer — connectors can refresh without forcing the user to re-auth.
      return json(res, {
        access_token: token,
        refresh_token: token,
        token_type: "bearer",
        expires_in: 86400 * 365,
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
      tools: listToolsForMcp().map((t) => ({ name: t.name, description: t.description })),
      note: "Separate from OrbitX Agent MCP. Includes ChatGPT search/fetch + X tools.",
    });
  }

  if ((!route || route === "") && req.method === "POST") {
    const body = await readBody(req);
    const { id, method, params } = body;
    const sessionId = header(req, "mcp-session-id") || opaque("sess").slice(0, 24);

    if (method === "initialize") {
      const requested = String(params?.protocolVersion || "2024-11-05");
      const protocolVersion = ["2025-03-26", "2024-11-05"].includes(requested)
        ? requested
        : "2024-11-05";
      return json(
        res,
        {
          jsonrpc: "2.0",
          id,
          result: {
            protocolVersion,
            capabilities: {
              tools: { listChanged: false },
              resources: { listChanged: false, subscribe: false },
            },
            serverInfo: { name: "OrbitX X MCP", version: "1.6.0" },
            instructions:
              "OrbitX X MCP — X analytics + post/DM + NVIDIA agent + linked GitHub repo + credits/ORBITX + timed MCP access. IMPORTANT: snake_case tool names only (never invent XBuyTool). REPO: a GitHub repo is linked for live reads while drafting posts — call x_repo_context or x_repo_read (do NOT ask the user to paste the GitHub URL every time). Link/change with x_repo_link (owner/repo or github.com URL). Default repo from server config. CHARTS: CA + chart → x_dex_chart. Menu → x_menu. authCode → x_auth_status then pass on every x_* tool. Buy: x_buy what=credits|orbitx|access. MCP access: ask hour (100 $ORBITX), day (1,000), week (10,000), or month (1,000,000) → x_mcp_access_buy → Jupiter buy+burn → x_mcp_access_confirm. Status: x_mcp_access_status. Setup: https://www.orbitx.world/x",
          },
        },
        200,
        { "Mcp-Session-Id": sessionId },
      );
    }
    if (method === "notifications/initialized" || method === "ping") {
      return json(res, { jsonrpc: "2.0", id: id ?? null, result: {} });
    }

    if (method === "resources/list") {
      try {
        const authCode = String(params?.authCode || "").trim();
        const inboundSession = String(header(req, "mcp-session-id") || "").trim();
        const auth = await resolveAuth(req, { authCode, mcpSessionId: inboundSession || undefined });
        const linked = await resolveLinkedRepo(auth || {});
        const info = linked?.ok ? await getRepoInfo(linked) : null;
        const resources = linked?.ok
          ? listRepoResources(linked, info?.ok ? info : null)
          : listRepoResources(parseGithubRepo(DEFAULT_GITHUB_REPO), null);
        return json(res, { jsonrpc: "2.0", id, result: { resources } });
      } catch (e) {
        return json(res, {
          jsonrpc: "2.0",
          id,
          result: { resources: listRepoResources(parseGithubRepo(DEFAULT_GITHUB_REPO), null) },
        });
      }
    }

    if (method === "resources/read") {
      try {
        const uri = String(params?.uri || "").trim();
        const parsed = parseRepoResourceUri(uri);
        if (!parsed) {
          return json(res, {
            jsonrpc: "2.0",
            id,
            error: { code: -32602, message: `Unknown resource uri: ${uri}` },
          });
        }
        const linked = {
          ok: true,
          owner: parsed.owner,
          repo: parsed.repo,
          fullName: parsed.fullName,
          htmlUrl: parsed.htmlUrl,
        };
        const file = await readRepoFile(linked, parsed.path || "README.md");
        if (!file.ok) {
          return json(res, {
            jsonrpc: "2.0",
            id,
            result: {
              contents: [
                {
                  uri,
                  mimeType: "text/plain",
                  text: file.message || "Could not read resource",
                },
              ],
            },
          });
        }
        const text =
          file.type === "dir"
            ? (file.entries || []).map((e) => `${e.type}\t${e.path}`).join("\n")
            : file.content || "";
        return json(res, {
          jsonrpc: "2.0",
          id,
          result: {
            contents: [
              {
                uri,
                mimeType: parsed.path?.endsWith(".md") ? "text/markdown" : "text/plain",
                text,
              },
            ],
          },
        });
      } catch (e) {
        return json(res, {
          jsonrpc: "2.0",
          id,
          error: { code: -32603, message: e?.message || "resources/read failed" },
        });
      }
    }

    if (method === "tools/list") {
      const cursor = params?.cursor || params?.cursorToken || "core";
      const listed = listLiveTools(cursor);
      return json(res, {
        jsonrpc: "2.0",
        id,
        result: {
          tools: listed.tools,
          ...(listed.nextCursor ? { nextCursor: listed.nextCursor } : {}),
          ...(listed._meta ? { _meta: listed._meta } : {}),
        },
      });
    }

    if (method === "tools/call") {
      const rawName = String(params?.name || "");
      const name = normalizeXToolName(rawName);
      const rawArgs = params?.arguments && typeof params.arguments === "object" ? params.arguments : {};
      const args = { ...rawArgs };
      const authCode = String(args.authCode || args.orbitxAuthCode || "").trim();
      // keep authCode on args for menu/status; strip for strict schemas later if needed
      const inboundSession = String(header(req, "mcp-session-id") || "").trim();
      const auth = await resolveAuth(req, { authCode, mcpSessionId: inboundSession || undefined });
      delete args.authCode;
      delete args.orbitxAuthCode;
      // Public tools stay open (incl. link-auth + menu). Other tools: allow link authCode without HTTP 401
      // so Grok can work after dashboard paste or clickable link (Grok won't store Bearer headers).
      const publicTools = new Set([
        "search",
        "fetch",
        "x_menu",
        "x_help",
        "x_auth_link",
        "x_auth_status",
        "x_tools_help",
        "x_pdf_scan",
        "x_dex_chart",
      ]);
      if (!auth?.userId && !publicTools.has(name)) {
        // Grok (and chat UIs) often ignore HTTP 401 — return a soft error with a fresh clickable auth link.
        if (authCode) {
          const tip = {
            ok: false,
            error: "session_required",
            message:
              "authCode is not authorized yet. If it came from the dashboard, call x_auth_status; otherwise ask the user to finish the OrbitX link.",
            authCode,
            hintTool: "x_auth_status",
            url: `${MCP_HOST}/x/link-auth?code=${encodeURIComponent(authCode)}`,
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
        const link = await createLinkAuthSession(req);
        const tip = {
          ok: false,
          error: "auth_required",
          tool: name,
          message:
            "OrbitX auth required. Prefer a dashboard-pasted authCode (x_auth_status). Or send the user a clickable x_auth_link url, then x_auth_status, then retry with authCode.",
          hintTool: "x_auth_link",
          ...link,
        };
        return json(
          res,
          {
            jsonrpc: "2.0",
            id,
            result: {
              content: [{ type: "text", text: JSON.stringify(tip, null, 2) }],
              structuredContent: tip,
              isError: true,
            },
          },
          200,
          {
            "WWW-Authenticate": wwwAuthenticateHeader(),
            ...(link?.mcpSessionId ? { "Mcp-Session-Id": link.mcpSessionId } : {}),
          },
        );
      }

      try {
        const toolArgs =
          name === "x_menu" || name === "x_auth_status"
            ? { ...args, ...(authCode ? { authCode } : {}) }
            : args;
        const result = await callTool(name, toolArgs, auth || { userId: null, authCode }, req);
        const wrapped = wrapMcpToolContent(result);
        const outSession = result?.mcpSessionId || inboundSession || undefined;
        return json(
          res,
          {
            jsonrpc: "2.0",
            id,
            result: wrapped,
          },
          200,
          outSession ? { "Mcp-Session-Id": outSession } : {},
        );
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

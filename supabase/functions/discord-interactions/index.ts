// discord-interactions — Discord slash commands, MULTI-TENANT.
// Serves the original OG Scan bot (env DISCORD_PUBLIC_KEY/DISCORD_APP_ID) AND
// every bring-your-own bot registered via discord-bot-connect. For each request
// we read the application_id from the (untrusted) body, look up that bot's
// public_key + app_id in discord_bots, and verify the Ed25519 signature against
// it. A forged application_id can't pass verification without the matching key.
//
// Handles /chat /migrations /news /alpha. ACKs deferred (<3s), then edits the
// original message with the real answer via the interaction token.
//
// Env: DISCORD_PUBLIC_KEY, DISCORD_APP_ID, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// No JWT (Discord calls it). Deploy with --no-verify-jwt.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ENV_PUBLIC_KEY = Deno.env.get("DISCORD_PUBLIC_KEY") || "";
const ENV_APP_ID = Deno.env.get("DISCORD_APP_ID") || "";
const API = "https://discord.com/api/v10";

const T = { PING: 1, APPLICATION_COMMAND: 2 };
const R = { PONG: 1, CHANNEL_MESSAGE: 4, DEFERRED_CHANNEL_MESSAGE: 5 };

const hexToBytes = (hex: string) =>
  new Uint8Array((hex.match(/.{1,2}/g) || []).map((b) => parseInt(b, 16)));

// Cache imported CryptoKeys by public-key hex string.
const keyCache = new Map<string, CryptoKey>();
async function importKey(hex: string): Promise<CryptoKey | null> {
  if (!hex) return null;
  const cached = keyCache.get(hex);
  if (cached) return cached;
  try {
    const k = await crypto.subtle.importKey("raw", hexToBytes(hex), { name: "Ed25519" }, false, ["verify"]);
    keyCache.set(hex, k);
    return k;
  } catch {
    return null;
  }
}

async function verifyWith(hex: string, body: string, sig: string, ts: string): Promise<boolean> {
  const key = await importKey(hex);
  if (!key) return false;
  try {
    return await crypto.subtle.verify({ name: "Ed25519" }, key, hexToBytes(sig), new TextEncoder().encode(ts + body));
  } catch {
    return false;
  }
}

// Look up a BYO bot by its Discord application_id (service role, no JWT).
async function lookupBot(appId: string): Promise<{ public_key: string; application_id: string; ai_enabled: boolean; enabled: boolean } | null> {
  if (!appId) return null;
  try {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/discord_bots?select=public_key,application_id,ai_enabled,enabled&application_id=eq.${encodeURIComponent(appId)}&limit=1`,
      { headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}` } },
    );
    const rows = await r.json();
    return Array.isArray(rows) && rows.length ? rows[0] : null;
  } catch {
    return null;
  }
}

async function askGrim(text: string): Promise<string> {
  try {
    const r = await fetch(`${SUPABASE_URL}/functions/v1/enhanced-intelligence`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_ROLE}`, apikey: SERVICE_ROLE },
      body: JSON.stringify({ messages: [{ role: "user", content: text }], context: "Source: Discord bot" }),
    });
    const j = await r.json();
    return j.content || j.error || "Couldn't read the chain right now, try again.";
  } catch {
    return "Grim's RPC hiccuped. Try again in a sec.";
  }
}

function fmtUsd(n: unknown): string {
  const v = Number(n);
  if (!isFinite(v) || v === 0) return "?";
  if (v >= 1e9) return "$" + (v / 1e9).toFixed(2) + "B";
  if (v >= 1e6) return "$" + (v / 1e6).toFixed(2) + "M";
  if (v >= 1e3) return "$" + (v / 1e3).toFixed(1) + "K";
  return "$" + v.toFixed(2);
}

async function migrationsText(): Promise<string> {
  try {
    const r = await fetch(`${SUPABASE_URL}/functions/v1/pumpfun-migrations`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_ROLE}`, apikey: SERVICE_ROLE },
      body: JSON.stringify({ hours: 24, limit: 10 }),
    });
    const j = await r.json();
    const migs = j.migrations || [];
    if (!migs.length) return "No pump.fun migrations in the last 24h.";
    return "🚀 **Pump.fun migrations · last 24h**\n" + migs.map((m: any, i: number) => {
      const sym = m.symbol || m.mint.slice(0, 6);
      return `${i + 1}. **${sym}** · MC ${fmtUsd(m.marketCap)} · Liq ${fmtUsd(m.liquidityUsd)} · <https://dexscreener.com/solana/${m.mint}>`;
    }).join("\n");
  } catch {
    return "Couldn't fetch migrations right now.";
  }
}

function sentimentEmoji(s: string) {
  const t = (s || "").toLowerCase();
  if (t.includes("bull")) return "🟢";
  if (t.includes("bear")) return "🔴";
  return "⚪";
}
function decodeEntities(s: string) {
  return (s || "")
    .replace(/&#(\d+);/g, (_m, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_m, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&apos;/g, "'");
}

async function rest(path: string): Promise<any[]> {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}` },
    });
    return await r.json();
  } catch {
    return [];
  }
}

async function newsText(): Promise<string> {
  const rows = await rest("crypto_news?select=title,source,sentiment,source_url,published_at&order=published_at.desc.nullslast&limit=6");
  if (!rows.length) return "No news right now.";
  return "📰 **Latest crypto news**\n" + rows.map((n: any, i: number) => {
    const title = decodeEntities(n.title || "");
    return `${i + 1}. ${sentimentEmoji(n.sentiment)} ${n.source_url ? `[${title}](<${n.source_url}>)` : title} — *${n.source || ""}*`;
  }).join("\n");
}

async function alphaText(): Promise<string> {
  const rows = await rest("alpha_callouts?select=username,token_symbol,direction,target_multiplier,upvotes,created_at&order=created_at.desc&limit=6");
  if (!rows.length) return "No alpha callouts yet.";
  return "🧠 **Latest alpha callouts**\n" + rows.map((a: any, i: number) => {
    const dir = (a.direction || "").toLowerCase() === "short" ? "🔻 SHORT" : "🚀 LONG";
    const tgt = a.target_multiplier ? ` · 🎯 ${a.target_multiplier}x` : "";
    return `${i + 1}. **$${a.token_symbol || "?"}** ${dir}${tgt} · 👍 ${a.upvotes || 0} · by @${a.username || "anon"}`;
  }).join("\n");
}

// Edit the original (deferred) interaction message. Each tenant uses its own app id.
async function editOriginal(appId: string, token: string, content: string) {
  const out = content.length > 1990 ? content.slice(0, 1989) + "…" : content;
  await fetch(`${API}/webhooks/${appId}/${token}/messages/@original`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content: out, allowed_mentions: { parse: [] } }),
  }).catch((e) => console.error("editOriginal err", e));
}

function runAfterAck(work: Promise<unknown>) {
  // @ts-ignore EdgeRuntime is provided by the Supabase edge runtime.
  if (typeof EdgeRuntime !== "undefined" && EdgeRuntime.waitUntil) EdgeRuntime.waitUntil(work);
  else void work;
}

// Write helpers (service role) for channel subscriptions.
async function restWrite(method: string, path: string, body?: unknown, extraHeaders: Record<string,string> = {}) {
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      method,
      headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}`, "Content-Type": "application/json", ...extraHeaders },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (e) { console.error("restWrite", e); }
}
const ephemeral = (content: string) => Response.json({ type: R.CHANNEL_MESSAGE, data: { content, flags: 64 } });

Deno.serve(async (req) => {
  const sig = req.headers.get("X-Signature-Ed25519") || "";
  const ts = req.headers.get("X-Signature-Timestamp") || "";
  const raw = await req.text();
  if (!sig || !ts) return new Response("invalid request signature", { status: 401 });

  // Parse (untrusted) body just to read the application_id.
  let body: any;
  try { body = JSON.parse(raw); } catch { return new Response("bad json", { status: 400 }); }
  const reqAppId: string = String(body.application_id || "");

  // Resolve which key + app id to use: a BYO bot, else the env (OG Scan) bot.
  let pubKey = ENV_PUBLIC_KEY;
  let appId = ENV_APP_ID || reqAppId;
  let aiEnabled = true;
  if (reqAppId && reqAppId !== ENV_APP_ID) {
    const bot = await lookupBot(reqAppId);
    if (!bot || !bot.enabled) return new Response("unknown application", { status: 401 });
    pubKey = bot.public_key;
    appId = bot.application_id;
    aiEnabled = bot.ai_enabled;
  }

  if (!(await verifyWith(pubKey, raw, sig, ts))) {
    return new Response("invalid request signature", { status: 401 });
  }

  if (body.type === T.PING) return Response.json({ type: R.PONG });

  if (body.type === T.APPLICATION_COMMAND) {
    const name = body.data?.name;
    const token = body.token;

    if (name === "chat") {
      const prompt = String(body.data?.options?.find((o: any) => o.name === "message")?.value || "").trim();
      if (!aiEnabled) {
        return Response.json({ type: R.CHANNEL_MESSAGE, data: { content: "AI chat is turned off for this bot." } });
      }
      if (!prompt) {
        return Response.json({ type: R.CHANNEL_MESSAGE, data: { content: "Ask me something: `/chat message: is SOL gonna pump?`" } });
      }
      runAfterAck(askGrim(prompt).then((a) => editOriginal(appId, token, a)));
      return Response.json({ type: R.DEFERRED_CHANNEL_MESSAGE });
    }

    if (name === "migrations") {
      runAfterAck(migrationsText().then((t) => editOriginal(appId, token, t)));
      return Response.json({ type: R.DEFERRED_CHANNEL_MESSAGE });
    }

    if (name === "news") {
      runAfterAck(newsText().then((t) => editOriginal(appId, token, t)));
      return Response.json({ type: R.DEFERRED_CHANNEL_MESSAGE });
    }

    if (name === "alpha") {
      runAfterAck(alphaText().then((t) => editOriginal(appId, token, t)));
      return Response.json({ type: R.DEFERRED_CHANNEL_MESSAGE });
    }

    if (name === "subscribe") {
      const channelId = String(body.channel_id || "");
      const guildId = body.guild_id ? String(body.guild_id) : null;
      if (!channelId) return ephemeral("Couldn't read this channel. Try again in a server text channel.");
      const bots = await rest(`discord_bots?select=id&application_id=eq.${encodeURIComponent(appId)}&limit=1`);
      const botId = bots[0]?.id || null;
      await restWrite("POST", "discord_bot_channels", { bot_id: botId, application_id: appId, channel_id: channelId, guild_id: guildId, alerts_migrations: true }, { Prefer: "resolution=merge-duplicates" });
      return ephemeral("✅ This channel will now get pump.fun migration alerts. Use /unsubscribe to stop.");
    }

    if (name === "unsubscribe") {
      const channelId = String(body.channel_id || "");
      await restWrite("DELETE", `discord_bot_channels?application_id=eq.${encodeURIComponent(appId)}&channel_id=eq.${encodeURIComponent(channelId)}`);
      return ephemeral("🛑 Migration alerts disabled for this channel.");
    }

    return Response.json({ type: R.CHANNEL_MESSAGE, data: { content: "Unknown command." } });
  }

  return new Response("ok");
});

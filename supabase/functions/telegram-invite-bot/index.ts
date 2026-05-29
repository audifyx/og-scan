/**
 * telegram-invite-bot — OG SCAN invite tracking Telegram bot.
 *
 * Commands (work in group AND in DMs with bot):
 *   /invite  — creates (or retrieves) a personal invite link to @ogscanner
 *   /lb      — shows top 10 inviters leaderboard
 *   /invites — shows caller's own invite count
 *
 * Webhook events:
 *   chat_member  — fires when someone joins/leaves; tracks invite link + who invited them
 *
 * DB tables:
 *   telegram_invites      — one row per unique invite link (per user)
 *   telegram_invite_joins — one row per person who joined via an invite link
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/* ──────────────────── Config ──────────────────── */

const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
const CHAT_ID   = Deno.env.get("TELEGRAM_CHAT_ID")!;          // @ogscanner channel ID
const API       = `https://api.telegram.org/bot${BOT_TOKEN}`;

// Note: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are auto-injected by Supabase runtime.
// We rename to SB_URL / SB_SERVICE_ROLE when setting via CLI (SUPABASE_ prefix is reserved).
const SUPABASE_URL      = Deno.env.get("SB_URL") ?? Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SR_KEY   = Deno.env.get("SB_SERVICE_ROLE") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(SUPABASE_URL, SUPABASE_SR_KEY);

/* ──────────────────── Telegram helpers ────────────── */

async function tgPost(method: string, body: object) {
  const res = await fetch(`${API}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

function sendMsg(chatId: number | string, text: string, extra?: object) {
  return tgPost("sendMessage", { chat_id: chatId, text, parse_mode: "HTML", ...extra });
}

function escHtml(s: string | null | undefined) {
  return (s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function displayName(first?: string | null, username?: string | null): string {
  if (username) return `@${username}`;
  if (first)    return first;
  return "Anonymous";
}

/* ──────────── Medal emoji for leaderboard ────────── */
const medals = ["🥇", "🥈", "🥉"];
function rankEmoji(i: number) { return medals[i] ?? `${i + 1}.`; }

/* ─────────────────── /invite handler ──────────────── */

async function handleInvite(userId: number, username: string | null, firstName: string | null, chatId: number | string) {
  // Check if this user already has an invite link
  const { data: existing } = await supabase
    .from("telegram_invites")
    .select("invite_link")
    .eq("creator_telegram_id", userId)
    .single();

  let link: string;
  if (existing?.invite_link) {
    link = existing.invite_link;
  } else {
    // Create a new invite link via Telegram API
    const res = await tgPost("createChatInviteLink", {
      chat_id: CHAT_ID,
      name: `invite_${userId}_${username ?? "user"}`,
      creates_join_request: false,
    });

    if (!res.ok) {
      await sendMsg(chatId, "⚠️ Couldn't create invite link. Make sure I'm an admin with invite permissions.");
      return;
    }

    link = res.result.invite_link;

    // Save to DB
    await supabase.from("telegram_invites").insert({
      invite_link: link,
      creator_telegram_id: userId,
      creator_username: username,
      creator_first_name: firstName,
    });
  }

  // Count how many people have joined via this link
  const { count: joinCount } = await supabase
    .from("telegram_invite_joins")
    .select("id", { count: "exact", head: true })
    .eq("invite_link", link);

  const name = escHtml(displayName(firstName, username));
  await sendMsg(chatId,
    `🔗 <b>Your personal OG SCAN invite link</b>\n\n` +
    `${link}\n\n` +
    `Share this link to invite people to the community.\n` +
    `When they join, you get credit! 👑\n\n` +
    `📊 Invites so far: <b>${joinCount ?? 0}</b>\n` +
    `Type /lb to see the invite leaderboard.`
  );
}

/* ─────────────────── /lb handler ──────────────────── */

async function handleLeaderboard(chatId: number | string) {
  // Aggregate joins by inviter
  const { data: rows } = await supabase
    .from("telegram_invite_joins")
    .select("inviter_telegram_id, inviter_username, inviter_first_name")
    .not("inviter_telegram_id", "is", null);

  if (!rows || rows.length === 0) {
    await sendMsg(chatId, "📊 No invites tracked yet. Be the first! Use /invite to get your link.");
    return;
  }

  // Count per inviter
  const counts: Record<number, { username: string | null; firstName: string | null; count: number }> = {};
  for (const row of rows) {
    const id = row.inviter_telegram_id;
    if (!counts[id]) counts[id] = { username: row.inviter_username, firstName: row.inviter_first_name, count: 0 };
    counts[id].count++;
  }

  const sorted = Object.entries(counts)
    .sort(([, a], [, b]) => b.count - a.count)
    .slice(0, 10);

  const lines = sorted.map(([, data], i) => {
    const name = escHtml(displayName(data.firstName, data.username));
    return `${rankEmoji(i)} ${name} — <b>${data.count}</b> invite${data.count !== 1 ? "s" : ""}`;
  });

  await sendMsg(chatId,
    `🏆 <b>OG SCAN Invite Leaderboard</b>\n\n` +
    lines.join("\n") +
    `\n\n👑 Get your invite link with /invite`
  );
}

/* ─────────────────── /invites handler ─────────────── */

async function handleMyInvites(userId: number, username: string | null, firstName: string | null, chatId: number | string) {
  const { count } = await supabase
    .from("telegram_invite_joins")
    .select("id", { count: "exact", head: true })
    .eq("inviter_telegram_id", userId);

  const name = escHtml(displayName(firstName, username));
  const total = count ?? 0;

  // Also get their rank
  const { data: allRows } = await supabase
    .from("telegram_invite_joins")
    .select("inviter_telegram_id")
    .not("inviter_telegram_id", "is", null);

  let rank = 1;
  if (allRows) {
    const counts: Record<number, number> = {};
    for (const r of allRows) counts[r.inviter_telegram_id] = (counts[r.inviter_telegram_id] ?? 0) + 1;
    const sorted = Object.values(counts).sort((a, b) => b - a);
    const myCount = counts[userId] ?? 0;
    rank = sorted.findIndex(c => c <= myCount) + 1 || sorted.length + 1;
  }

  await sendMsg(chatId,
    `📊 <b>${name}'s Invite Stats</b>\n\n` +
    `Invites: <b>${total}</b>\n` +
    `Rank: <b>#${rank}</b>\n\n` +
    (total === 0 ? `Get your invite link with /invite and start inviting! 🔥` : `Keep going! Use /lb to see the full leaderboard.`)
  );
}

/* ──────────── chat_member join handler ──────────── */

async function handleChatMember(update: any) {
  const member = update.chat_member;
  if (!member) return;

  const newStatus = member.new_chat_member?.status;
  const oldStatus = member.old_chat_member?.status;

  // Only fire when someone joins (wasn't a member, now is)
  const justJoined = (newStatus === "member" || newStatus === "restricted") &&
    (oldStatus === "left" || oldStatus === "kicked" || oldStatus === "banned");
  if (!justJoined) return;

  const joiner = member.new_chat_member?.user;
  if (!joiner || joiner.is_bot) return;

  const inviteLinkObj = member.invite_link;
  const inviteLink: string | null = inviteLinkObj?.invite_link ?? null;

  let inviterTgId: number | null = null;
  let inviterUsername: string | null = null;
  let inviterFirstName: string | null = null;

  if (inviteLink) {
    // Look up who owns this invite link
    const { data: inv } = await supabase
      .from("telegram_invites")
      .select("creator_telegram_id, creator_username, creator_first_name")
      .eq("invite_link", inviteLink)
      .single();

    if (inv) {
      inviterTgId = inv.creator_telegram_id;
      inviterUsername = inv.creator_username;
      inviterFirstName = inv.creator_first_name;
    }
  }

  // Don't double-count (UNIQUE joiner_telegram_id)
  const { error: insertErr } = await supabase
    .from("telegram_invite_joins")
    .insert({
      invite_link: inviteLink ?? "direct",
      joiner_telegram_id: joiner.id,
      joiner_username: joiner.username ?? null,
      joiner_first_name: joiner.first_name ?? null,
      inviter_telegram_id: inviterTgId,
      inviter_username: inviterUsername,
      inviter_first_name: inviterFirstName,
    })
    .throwOnError();

  // Welcome message in channel
  const joinerName = escHtml(displayName(joiner.first_name, joiner.username));
  if (inviterTgId) {
    const inviterName = escHtml(displayName(inviterFirstName, inviterUsername));
    await sendMsg(member.chat.id,
      `👋 Welcome to the community <b>${joinerName}</b>!\n\n` +
      `Invited by ${inviterName} 🎉\n\n` +
      `Glad to have you here — explore OG SCAN and dive in! 🚀`
    );
  } else {
    await sendMsg(member.chat.id,
      `👋 Welcome to OG SCAN community, <b>${joinerName}</b>!\n\n` +
      `Glad to have you here — explore and dive in! 🚀`
    );
  }
}

/* ──────────────────── Main handler ─────────────────── */

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("OK", { status: 200 });

  let update: any;
  try { update = await req.json(); } catch { return new Response("Bad JSON", { status: 400 }); }

  try {
    // chat_member join event
    if (update.chat_member) {
      await handleChatMember(update);
      return new Response("OK");
    }

    // Message commands
    const msg = update.message ?? update.edited_message;
    if (!msg?.text) return new Response("OK");

    const text    = msg.text.trim().split(" ")[0].toLowerCase();
    const userId: number  = msg.from?.id;
    const username: string | null = msg.from?.username ?? null;
    const firstName: string | null = msg.from?.first_name ?? null;
    const chatId: number  = msg.chat.id;

    if (text === "/invite" || text === "/invite@theogannbouncementbot") {
      await handleInvite(userId, username, firstName, chatId);
    } else if (text === "/lb" || text === "/lb@theogannbouncementbot") {
      await handleLeaderboard(chatId);
    } else if (text === "/invites" || text === "/invites@theogannbouncementbot") {
      await handleMyInvites(userId, username, firstName, chatId);
    } else if (text === "/start" || text === "/help") {
      await sendMsg(chatId,
        `🤖 <b>OG SCAN Invite Bot</b>\n\n` +
        `/invite — Get your personal invite link\n` +
        `/lb — View the invite leaderboard\n` +
        `/invites — See your own invite count & rank\n\n` +
        `Invite people, earn your spot at the top of the leaderboard! 👑`
      );
    }
  } catch (e) {
    console.error("[telegram-invite-bot] Error:", e);
  }

  return new Response("OK");
});

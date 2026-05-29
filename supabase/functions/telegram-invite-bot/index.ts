/**
 * telegram-invite-bot — OG SCAN invite tracking Telegram bot.
 *
 * Commands (work in group AND in DMs with bot):
 *   /invite      — creates (or retrieves) a personal invite link to @ogscanner
 *   /leaderboard — shows top 10 inviters leaderboard
 *   /invites     — shows caller's own invite count
 *   /help        — command list
 *
 * Webhook events:
 *   chat_member  — fires when someone joins; tracks invite link + who invited them
 *
 * DB tables:
 *   telegram_invites      — one row per unique invite link (per real user)
 *   telegram_invite_joins — one row per person who joined via an invite link
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/* ──────────────────── Config ──────────────────── */

const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
const CHAT_ID   = Deno.env.get("TELEGRAM_CHAT_ID")!;
const API       = `https://api.telegram.org/bot${BOT_TOKEN}`;

const SUPABASE_URL    = Deno.env.get("SB_URL") ?? Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SR_KEY = Deno.env.get("SB_SERVICE_ROLE") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(SUPABASE_URL, SUPABASE_SR_KEY);

const IGNORED_BOT_IDS = new Set([1087968824, 136817688, 93372553]);

/* ──────────────────── Telegram helpers ────────────── */

async function tgPost(method: string, body: object) {
  const res = await fetch(`${API}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!json.ok) {
    console.error(`[tgPost] ${method} failed:`, JSON.stringify(json));
  }
  return json;
}

async function sendMsg(chatId: number | string, text: string, extra?: object) {
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

const medals = ["🥇", "🥈", "🥉"];
function rankEmoji(i: number) { return medals[i] ?? `${i + 1}.`; }

/* ─────────────────── /invite handler ──────────────── */

async function handleInvite(
  userId: number,
  username: string | null,
  firstName: string | null,
  chatId: number | string,
  messageId?: number,
  isGroup?: boolean,
) {
  if (IGNORED_BOT_IDS.has(userId)) return;

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
    const res = await tgPost("createChatInviteLink", {
      chat_id: CHAT_ID,
      name: `invite_${userId}_${username ?? "user"}`,
      creates_join_request: false,
    });

    if (!res.ok) {
      console.error("[invite] createChatInviteLink failed:", JSON.stringify(res));
      await sendMsg(chatId, "⚠️ Couldn't create invite link. Please try again later.", 
        messageId ? { reply_to_message_id: messageId } : {});
      return;
    }

    link = res.result.invite_link;

    await supabase.from("telegram_invites").insert({
      invite_link: link,
      creator_telegram_id: userId,
      creator_username: username,
      creator_first_name: firstName,
    });
  }

  const { count: joinCount } = await supabase
    .from("telegram_invite_joins")
    .select("id", { count: "exact", head: true })
    .eq("invite_link", link);

  const inviteMsg =
    `🔗 <b>Your personal OG SCAN invite link</b>\n\n` +
    `${link}\n\n` +
    `Share this link to invite people to the community.\n` +
    `When they join, you get the credit! 👑\n\n` +
    `📊 Invites so far: <b>${joinCount ?? 0}</b>\n` +
    `Type /leaderboard to see the invite rankings.`;

  // If command sent in group → try to DM the user privately, 
  // then post a brief reply in the group
  if (isGroup) {
    const dmResult = await sendMsg(userId, inviteMsg);
    if (dmResult.ok) {
      // Successfully DMed — post brief confirmation in group
      const name = escHtml(displayName(firstName, username));
      await sendMsg(chatId,
        `📩 ${name}, your invite link has been sent to your DMs! 🔗`,
        messageId ? { reply_to_message_id: messageId } : {}
      );
    } else {
      // Can't DM (user hasn't started bot) — post in group as reply
      console.log(`[invite] Can't DM user ${userId}, posting in group instead. Error:`, dmResult);
      await sendMsg(chatId,
        `🔗 <b>${escHtml(displayName(firstName, username))}, here's your personal OG SCAN invite link:</b>\n\n` +
        `${link}\n\n` +
        `📊 Invites so far: <b>${joinCount ?? 0}</b>\n\n` +
        `💡 Tip: Start a chat with me directly to get your link privately next time!`,
        messageId ? { reply_to_message_id: messageId } : {}
      );
    }
  } else {
    // DM context — reply directly
    await sendMsg(chatId, inviteMsg);
  }
}

/* ─────────────────── /leaderboard handler ─────────────── */

async function handleLeaderboard(chatId: number | string, messageId?: number) {
  const { data: inviteRows } = await supabase
    .from("telegram_invites")
    .select("creator_telegram_id, creator_username, creator_first_name")
    .not("creator_telegram_id", "in", `(${[...IGNORED_BOT_IDS].join(",")})`);

  if (!inviteRows || inviteRows.length === 0) {
    await sendMsg(chatId,
      `📊 No one has created an invite link yet.\n\nBe the first! Use /invite to get your link. 🔥`,
      messageId ? { reply_to_message_id: messageId } : {}
    );
    return;
  }

  const { data: joinRows } = await supabase
    .from("telegram_invite_joins")
    .select("inviter_telegram_id")
    .not("inviter_telegram_id", "is", null);

  const joinCounts: Record<number, number> = {};
  for (const r of (joinRows ?? [])) {
    joinCounts[r.inviter_telegram_id] = (joinCounts[r.inviter_telegram_id] ?? 0) + 1;
  }

  const ranked = inviteRows
    .map(r => ({
      id: r.creator_telegram_id,
      username: r.creator_username,
      firstName: r.creator_first_name,
      count: joinCounts[r.creator_telegram_id] ?? 0,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const lines = ranked.map((r, i) => {
    const name = escHtml(displayName(r.firstName, r.username));
    return `${rankEmoji(i)} ${name} — <b>${r.count}</b> invite${r.count !== 1 ? "s" : ""}`;
  });

  await sendMsg(chatId,
    `🏆 <b>OG SCAN Invite Leaderboard</b>\n\n` +
    lines.join("\n") +
    `\n\n👑 Get your invite link with /invite`,
    messageId ? { reply_to_message_id: messageId } : {}
  );
}

/* ─────────────────── /invites handler ─────────────── */

async function handleMyInvites(
  userId: number,
  username: string | null,
  firstName: string | null,
  chatId: number | string,
  messageId?: number,
  isGroup?: boolean,
) {
  if (IGNORED_BOT_IDS.has(userId)) return;

  const { data: myInvite } = await supabase
    .from("telegram_invites")
    .select("invite_link")
    .eq("creator_telegram_id", userId)
    .single();

  if (!myInvite) {
    await sendMsg(chatId,
      `You don't have an invite link yet!\nUse /invite to get your personal link. 🔗`,
      messageId ? { reply_to_message_id: messageId } : {}
    );
    return;
  }

  const { count } = await supabase
    .from("telegram_invite_joins")
    .select("id", { count: "exact", head: true })
    .eq("invite_link", myInvite.invite_link);

  const { data: allJoins } = await supabase
    .from("telegram_invite_joins")
    .select("inviter_telegram_id")
    .not("inviter_telegram_id", "is", null);

  const allCounts: Record<number, number> = {};
  for (const r of (allJoins ?? [])) {
    allCounts[r.inviter_telegram_id] = (allCounts[r.inviter_telegram_id] ?? 0) + 1;
  }
  const myCount = count ?? 0;
  const rank = Object.values(allCounts).filter(c => c > myCount).length + 1;

  const name = escHtml(displayName(firstName, username));
  const statsMsg =
    `📊 <b>${name}'s Invite Stats</b>\n\n` +
    `Invites: <b>${myCount}</b>\n` +
    `Rank: <b>#${rank}</b>\n\n` +
    (myCount === 0
      ? `Share your link and start climbing the leaderboard! 🔥\n\n${myInvite.invite_link}`
      : `Keep going! Use /leaderboard to see the full rankings.`);

  if (isGroup) {
    const dmResult = await sendMsg(userId, statsMsg);
    if (dmResult.ok) {
      await sendMsg(chatId, `📩 ${name}, your invite stats have been sent to your DMs!`,
        messageId ? { reply_to_message_id: messageId } : {});
    } else {
      await sendMsg(chatId, statsMsg, messageId ? { reply_to_message_id: messageId } : {});
    }
  } else {
    await sendMsg(chatId, statsMsg);
  }
}

/* ──────────── chat_member join handler ──────────── */

async function handleChatMember(update: any) {
  const member = update.chat_member;
  if (!member) return;

  const newStatus = member.new_chat_member?.status;
  const oldStatus = member.old_chat_member?.status;

  const justJoined =
    (newStatus === "member" || newStatus === "restricted") &&
    (oldStatus === "left" || oldStatus === "kicked" || oldStatus === "banned");
  if (!justJoined) return;

  const joiner = member.new_chat_member?.user;
  if (!joiner || joiner.is_bot) return;
  if (IGNORED_BOT_IDS.has(joiner.id)) return;

  const inviteLinkObj = member.invite_link;
  const inviteLink: string | null = inviteLinkObj?.invite_link ?? null;

  let inviterTgId: number | null = null;
  let inviterUsername: string | null = null;
  let inviterFirstName: string | null = null;

  if (inviteLink) {
    const { data: inv } = await supabase
      .from("telegram_invites")
      .select("creator_telegram_id, creator_username, creator_first_name")
      .eq("invite_link", inviteLink)
      .single();

    if (inv && !IGNORED_BOT_IDS.has(inv.creator_telegram_id)) {
      inviterTgId      = inv.creator_telegram_id;
      inviterUsername  = inv.creator_username;
      inviterFirstName = inv.creator_first_name;
    }
  }

  const { error } = await supabase
    .from("telegram_invite_joins")
    .upsert(
      {
        invite_link: inviteLink ?? "direct",
        joiner_telegram_id: joiner.id,
        joiner_username: joiner.username ?? null,
        joiner_first_name: joiner.first_name ?? null,
        inviter_telegram_id: inviterTgId,
        inviter_username: inviterUsername,
        inviter_first_name: inviterFirstName,
        joined_at: new Date().toISOString(),
      },
      { onConflict: "joiner_telegram_id" }
    );

  if (error) console.error("[chat_member] upsert error:", JSON.stringify(error));

  const joinerName = escHtml(displayName(joiner.first_name, joiner.username));
  if (inviterTgId) {
    const inviterName = escHtml(displayName(inviterFirstName, inviterUsername));
    await sendMsg(
      member.chat.id,
      `👋 Welcome to the community <b>${joinerName}</b>!\n\nInvited by ${inviterName} 🎉\n\nGlad to have you here — explore OG SCAN and dive in! 🚀`
    );
  } else {
    await sendMsg(
      member.chat.id,
      `👋 Welcome to OG SCAN community, <b>${joinerName}</b>!\n\nGlad to have you here — explore and dive in! 🚀`
    );
  }
}

/* ──────────────────── Main handler ─────────────────── */

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("OK", { status: 200 });

  let update: any;
  try { update = await req.json(); } catch { return new Response("Bad JSON", { status: 400 }); }

  try {
    if (update.chat_member) {
      await handleChatMember(update);
      return new Response("OK");
    }

    const msg = update.message ?? update.edited_message;
    if (!msg?.text) return new Response("OK");

    const rawCmd  = msg.text.trim().split(" ")[0].toLowerCase();
    const cmd     = rawCmd.replace(/@\w+$/, "");
    const userId: number        = msg.from?.id;
    const username: string | null = msg.from?.username ?? null;
    const firstName: string | null = msg.from?.first_name ?? null;
    const chatId: number        = msg.chat.id;
    const messageId: number     = msg.message_id;
    const isGroup: boolean      = msg.chat.type === "group" || msg.chat.type === "supergroup";

    console.log(`[cmd] ${cmd} from userId=${userId} in chatId=${chatId} isGroup=${isGroup}`);

    if (cmd === "/invite") {
      await handleInvite(userId, username, firstName, chatId, messageId, isGroup);
    } else if (cmd === "/leaderboard" || cmd === "/leaderboardd") {
      await handleLeaderboard(chatId, messageId);
    } else if (cmd === "/invites") {
      await handleMyInvites(userId, username, firstName, chatId, messageId, isGroup);
    } else if (cmd === "/start" || cmd === "/help") {
      await sendMsg(chatId,
        `🤖 <b>OG SCAN Invite Bot</b>\n\n` +
        `/invite — Get your personal invite link 🔗\n` +
        `/leaderboard — View the invite rankings 🏆\n` +
        `/invites — See your invite count & rank 📊\n\n` +
        `Invite people and earn your spot at the top! 👑`,
        messageId ? { reply_to_message_id: messageId } : {}
      );
    }
  } catch (e) {
    console.error("[telegram-invite-bot] Unhandled error:", e);
  }

  return new Response("OK");
});

// pumpfun-migration-poller — scheduled (every ~1 min via pg_cron). Finds new
// pump.fun migrations, stores them, and pushes instant alerts to every chat
// subscribed through a user-connected bot. Free serverless "instant" (~60s).
// First run bootstraps (marks existing as alerted) to avoid back-spam.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

const json = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "Content-Type": "application/json" } });

function fmtUsd(n: any) {
  const v = Number(n);
  if (!isFinite(v) || v === 0) return "?";
  if (v >= 1e9) return "$" + (v / 1e9).toFixed(2) + "B";
  if (v >= 1e6) return "$" + (v / 1e6).toFixed(2) + "M";
  if (v >= 1e3) return "$" + (v / 1e3).toFixed(1) + "K";
  return "$" + v.toFixed(2);
}
const esc = (s: string) => (s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

async function getMigrations(hours: number, limit: number) {
  const r = await fetch(`${SUPABASE_URL}/functions/v1/pumpfun-migrations`, {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_ROLE}`, apikey: SERVICE_ROLE },
    body: JSON.stringify({ hours, limit }),
  });
  const j = await r.json();
  return j.migrations || [];
}

function alertText(m: any) {
  const sym = esc(m.symbol || m.mint.slice(0, 6));
  const name = m.name && m.name !== m.symbol ? ` (${esc(m.name)})` : "";
  const url = m.dexUrl || `https://dexscreener.com/solana/${m.mint}`;
  return `🚀 <b>MIGRATED</b> · <b>${sym}</b>${name}\n` +
    `MC ${fmtUsd(m.marketCap)} · Liq ${fmtUsd(m.liquidityUsd)} · Vol24h ${fmtUsd(m.volume24h)}\n` +
    `<a href="${url}">chart</a> · <code>${m.mint}</code>\n` +
    `Ask me about it — just paste the CA.`;
}

function tweetText(m: any) {
  const sym = m.symbol || (m.mint ? m.mint.slice(0, 6) : "");
  const url = m.dexUrl || m.dex_url || `https://dexscreener.com/solana/${m.mint}`;
  const name = m.name && m.name !== m.symbol ? ` (${m.name})` : "";
  return `🚀 $${sym}${name} just migrated on pump.fun\nMC ${fmtUsd(m.marketCap ?? m.market_cap)} · Liq ${fmtUsd(m.liquidityUsd ?? m.liquidity_usd)}\n${url}`.slice(0, 279);
}

function discordEmbed(m: any) {
  return {
    title: `🚀 ${m.symbol || m.mint.slice(0, 6)} migrated`,
    url: m.dexUrl || `https://dexscreener.com/solana/${m.mint}`,
    description: m.name && m.name !== m.symbol ? m.name : undefined,
    color: 0xb6f23d,
    fields: [
      { name: "Market Cap", value: fmtUsd(m.marketCap), inline: true },
      { name: "Liquidity", value: fmtUsd(m.liquidityUsd), inline: true },
      { name: "Mint", value: "`" + m.mint + "`", inline: false },
    ],
    thumbnail: m.image ? { url: m.image } : undefined,
    footer: { text: "OG Scan · pump.fun migration" },
    timestamp: m.migrated_at || new Date().toISOString(),
  };
}

Deno.serve(async (req) => {
  try {
    const migs = await getMigrations(1, 60); // last hour window keeps the poll cheap
    if (!migs.length) return json({ ok: true, new: 0, note: "no migrations in window" });

    const { count } = await admin.from("pumpfun_migrations").select("signature", { count: "exact", head: true });
    const bootstrapping = (count || 0) === 0;

    // Insert; existing signatures are skipped. New rows: alerted = bootstrapping.
    const rows = migs.map((m: any) => ({
      signature: m.signature, mint: m.mint, symbol: m.symbol || null, name: m.name || null,
      price_usd: m.priceUsd ?? null, market_cap: m.marketCap ?? null, liquidity_usd: m.liquidityUsd ?? null,
      image: m.image || null, dex_url: m.dexUrl || null, migrated_at: m.migratedAt, alerted: bootstrapping,
    }));
    await admin.from("pumpfun_migrations").upsert(rows, { onConflict: "signature", ignoreDuplicates: true });

    if (bootstrapping) return json({ ok: true, bootstrapped: rows.length });

    // Find fresh, not-yet-alerted migrations from the last 2h.
    const since = new Date(Date.now() - 2 * 3600_000).toISOString();
    const { data: pending } = await admin.from("pumpfun_migrations")
      .select("*").eq("alerted", false).gte("migrated_at", since).order("migrated_at", { ascending: true }).limit(25);
    if (!pending || !pending.length) return json({ ok: true, new: 0 });

    // All enabled alert chats across all bots that have migration alerts on.
    const { data: bots } = await admin.from("telegram_bots").select("id, bot_token, alerts_migrations, min_marketcap").eq("alerts_migrations", true);
    const botMap: Record<string, any> = {};
    for (const b of bots || []) botMap[b.id] = b;
    const { data: chats } = await admin.from("telegram_alert_chats").select("bot_id, chat_id, enabled").eq("enabled", true);

    // Discord webhooks subscribed to migration alerts.
    const { data: discords } = await admin.from("discord_integrations").select("webhook_url, alerts_migrations, min_marketcap").eq("alerts_migrations", true);

    // X accounts opted into migration auto-posting.
    const { data: xAccts } = await admin.from("x_accounts").select("user_id").eq("enabled", true).eq("auto_migrations", true);
    const xPosted: Record<string, number> = {};
    const X_MIN_MC = 30000, X_MAX_PER_RUN = 3;

    // BYO Discord bots: channels subscribed via /subscribe.
    const { data: botChannels } = await admin
      .from("discord_bot_channels")
      .select("channel_id, application_id, discord_bots(bot_token, enabled)")
      .eq("alerts_migrations", true);

    let sent = 0, sentDiscord = 0, sentX = 0, sentBotDiscord = 0;
    for (const m of pending) {
      const mapped = { ...m, marketCap: m.market_cap, liquidityUsd: m.liquidity_usd, volume24h: null, dexUrl: m.dex_url };
      // Telegram
      for (const c of chats || []) {
        const b = botMap[c.bot_id];
        if (!b) continue;
        if ((m.market_cap || 0) < (Number(b.min_marketcap) || 0)) continue;
        await fetch(`https://api.telegram.org/bot${b.bot_token}/sendMessage`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: c.chat_id, text: alertText(mapped), parse_mode: "HTML", disable_web_page_preview: true }),
        }).catch(() => {});
        sent++;
      }
      // Discord
      for (const d of discords || []) {
        if ((m.market_cap || 0) < (Number(d.min_marketcap) || 0)) continue;
        await fetch(d.webhook_url, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: "OG Scan", embeds: [discordEmbed(mapped)] }),
        }).catch(() => {});
        sentDiscord++;
      }
      // X auto-post (per opted-in account, capped + market-cap floor)
      if ((m.market_cap || 0) >= X_MIN_MC) {
        for (const x of xAccts || []) {
          if ((xPosted[x.user_id] || 0) >= X_MAX_PER_RUN) continue;
          await fetch(`${SUPABASE_URL}/functions/v1/x-poster`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_ROLE}`, apikey: SERVICE_ROLE },
            body: JSON.stringify({ action: "post", user_id: x.user_id, text: tweetText(mapped) }),
          }).then(() => { xPosted[x.user_id] = (xPosted[x.user_id] || 0) + 1; sentX++; }).catch(() => {});
        }
      }
      // BYO Discord bots: post embed to each subscribed channel via the bot token.
      for (const ch of botChannels || []) {
        const bot: any = (ch as any).discord_bots;
        if (!bot || bot.enabled === false || !bot.bot_token) continue;
        await fetch(`https://discord.com/api/v10/channels/${(ch as any).channel_id}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bot ${bot.bot_token}` },
          body: JSON.stringify({ embeds: [discordEmbed(mapped)] }),
        }).then(() => { sentBotDiscord++; }).catch(() => {});
      }
      await admin.from("pumpfun_migrations").update({ alerted: true }).eq("signature", m.signature);
    }
    return json({ ok: true, new: pending.length, telegramSent: sent, discordSent: sentDiscord, xSent: sentX, botDiscordSent: sentBotDiscord });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

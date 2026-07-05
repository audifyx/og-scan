import type { VercelRequest, VercelResponse } from "@vercel/node";
import { fetchGeckoNewPools, getLaunches, type Launch } from "./new-launches";
import { sendTelegram } from "./send-alert";

// /api/kol/launch-digest
// GET (Vercel cron, hourly):
//   1. Snapshots new pools into kol_launch_radar (needs SUPABASE_SERVICE_ROLE_KEY)
//   2. Sends the "new launches" digest to every bot with launch_digest_enabled
//      whose interval has elapsed. Topic-aware (message_thread_id).
// POST { botToken, chatId, threadId?, minAgeHours?, maxAgeHours? }:
//   Sends a digest immediately with the provided bot (manual / test).
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "https://ffjipnkhcebjvttliptb.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const CRON_SECRET = process.env.CRON_SECRET || "";

async function sb(path: string, init?: RequestInit) {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json", ...(init?.headers || {}) },
  });
}

function money(n: number | null): string {
  if (n == null || !isFinite(n)) return "?";
  if (n >= 1_000_000) return "$" + (n / 1_000_000).toFixed(2) + "M";
  if (n >= 1_000) return "$" + (n / 1_000).toFixed(1) + "K";
  return "$" + n.toFixed(2);
}

export function buildDigestText(launches: Launch[], minAge: number, maxAge: number, source: string): string {
  const head = `🚀 <b>NEW LAUNCHES</b> — survived ${minAge}-${maxAge}h${source === "live-recent" ? " (recent window)" : ""}`;
  if (!launches.length) return `${head}\n\nNo qualifying launches in this window.`;
  const rows = launches.map((l, i) => {
    const age = l.ageHours != null ? `${l.ageHours.toFixed(1)}h` : "?";
    const chart = l.mint ? `https://dexscreener.com/solana/${l.mint}` : `https://www.geckoterminal.com/solana/pools/${l.poolAddress}`;
    return [
      `${i + 1}. <b>${l.symbol}</b> (${age} old${l.dex ? `, ${l.dex}` : ""})`,
      `   FDV ${money(l.fdvUsd)} · Vol24h ${money(l.volume24h)}${l.priceChangeH1 != null ? ` · 1h ${l.priceChangeH1 > 0 ? "+" : ""}${l.priceChangeH1.toFixed(1)}%` : ""}`,
      `   ${chart}`,
    ].join("\n");
  });
  return [head, "", ...rows].join("\n");
}

async function snapshotNewPools(): Promise<number> {
  if (!SERVICE_KEY) return 0;
  const pools = await fetchGeckoNewPools(5).catch(() => [] as Launch[]);
  if (!pools.length) return 0;
  const rows = pools.filter((p) => p.poolAddress).map((p) => ({
    pool_address: p.poolAddress, token_mint: p.mint, token_symbol: p.symbol, token_name: p.name,
    dex: p.dex, pool_created_at: p.createdAt,
    base_info: { fdvUsd: p.fdvUsd, volume24h: p.volume24h },
  }));
  const r = await sb("kol_launch_radar?on_conflict=pool_address", {
    method: "POST",
    headers: { Prefer: "resolution=ignore-duplicates,return=minimal" },
    body: JSON.stringify(rows),
  });
  return r.ok ? rows.length : 0;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Manual / immediate digest
  if (req.method === "POST") {
    const { botToken, chatId, threadId, minAgeHours, maxAgeHours } = (req.body || {}) as any;
    if (!botToken || !chatId) return res.status(400).json({ ok: false, error: "botToken and chatId required" });
    const minAge = Math.max(0, Number(minAgeHours) || 5);
    const maxAge = Math.max(minAge + 0.5, Number(maxAgeHours) || 10);
    try {
      const { launches, source } = await getLaunches(minAge, maxAge, 10);
      const text = buildDigestText(launches, minAge, maxAge, source);
      const tg = await sendTelegram(String(botToken), String(chatId), text, undefined, threadId ? String(threadId) : undefined);
      return res.status(tg?.ok ? 200 : 502).json({ ok: tg?.ok === true, count: launches.length, source, description: tg?.description || null });
    } catch (e: any) {
      return res.status(500).json({ ok: false, error: String(e?.message || e) });
    }
  }

  // Cron path
  if (CRON_SECRET) {
    const auth = String(req.headers["authorization"] || "");
    if (auth !== `Bearer ${CRON_SECRET}`) return res.status(401).json({ ok: false, error: "unauthorized" });
  }

  const snapshotted = await snapshotNewPools().catch(() => 0);
  let digestsSent = 0;
  const errors: string[] = [];

  if (SERVICE_KEY) {
    try {
      const bR = await sb("telegram_bot_configs?launch_digest_enabled=eq.true&select=id,bot_token,chat_id,message_thread_id,launch_digest_min_age_hours,launch_digest_max_age_hours,launch_digest_interval_hours,last_digest_at");
      const bots: any[] = bR.ok ? await bR.json() : [];
      for (const bot of bots) {
        if (!bot.bot_token || !bot.chat_id) continue;
        const interval = Math.max(1, Number(bot.launch_digest_interval_hours) || 6);
        const last = bot.last_digest_at ? new Date(bot.last_digest_at).getTime() : 0;
        if (Date.now() - last < interval * 3_600_000 - 5 * 60_000) continue; // not due yet (5 min tolerance)

        const minAge = Math.max(0, Number(bot.launch_digest_min_age_hours) || 5);
        const maxAge = Math.max(minAge + 0.5, Number(bot.launch_digest_max_age_hours) || 10);
        const { launches, source } = await getLaunches(minAge, maxAge, 10);
        const text = buildDigestText(launches, minAge, maxAge, source);
        const tg = await sendTelegram(bot.bot_token, bot.chat_id, text, undefined, bot.message_thread_id || undefined);
        if (tg?.ok) {
          digestsSent++;
          await sb(`telegram_bot_configs?id=eq.${bot.id}`, {
            method: "PATCH", headers: { Prefer: "return=minimal" },
            body: JSON.stringify({ last_digest_at: new Date().toISOString() }),
          }).catch(() => {});
        } else if (tg?.description) {
          errors.push(String(tg.description));
        }
      }
    } catch (e: any) {
      errors.push(String(e?.message || e));
    }
  }

  return res.status(200).json({ ok: true, snapshotted, digestsSent, serviceRole: Boolean(SERVICE_KEY), errors: errors.slice(0, 5) });
}

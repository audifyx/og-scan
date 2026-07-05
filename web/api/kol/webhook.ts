import type { VercelRequest, VercelResponse } from "@vercel/node";
import { parseTrade } from "./transactions";
import { buildAlertText, sendTelegram } from "./send-alert";

// POST /api/kol/webhook — Helius enhanced-transaction webhook receiver.
// Point your Helius webhook at: https://<domain>/api/kol/webhook
// Optional: set HELIUS_WEBHOOK_SECRET in Vercel env AND as the webhook's
// authHeader in Helius; requests without it are rejected.
//
// Flow: match tx wallets -> active trackers (Supabase, service role) ->
// linked telegram bot -> dispatch alert (topic-aware) -> log + last activity.
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "https://ffjipnkhcebjvttliptb.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const WEBHOOK_SECRET = process.env.HELIUS_WEBHOOK_SECRET || "";

async function sb(path: string, init?: RequestInit) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json", ...(init?.headers || {}),
    },
  });
  return r;
}

// KOL directory cache (for all_kols mode) — refreshed every 10 min per instance
let kolDirCache: { at: number; map: Record<string, string> } = { at: 0, map: {} };
async function getKolDirectory(origin: string): Promise<Record<string, string>> {
  if (Date.now() - kolDirCache.at < 10 * 60_000 && Object.keys(kolDirCache.map).length) return kolDirCache.map;
  try {
    const r = await fetch(`${origin}/api/ogdex/kols?directory=1`);
    const j = (await r.json()) as any;
    const map: Record<string, string> = {};
    for (const [addr, info] of Object.entries(j?.directory || {})) map[addr] = (info as any)?.name || "KOL";
    kolDirCache = { at: Date.now(), map };
  } catch { /* keep stale cache */ }
  return kolDirCache.map;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "POST only" });
  if (WEBHOOK_SECRET) {
    const auth = String(req.headers["authorization"] || req.headers["x-webhook-secret"] || "");
    if (auth !== WEBHOOK_SECRET && auth !== `Bearer ${WEBHOOK_SECRET}`) {
      return res.status(401).json({ ok: false, error: "unauthorized" });
    }
  }
  if (!SERVICE_KEY) {
    // Without service credentials we cannot resolve trackers server-side.
    return res.status(200).json({ ok: false, error: "SUPABASE_SERVICE_ROLE_KEY not configured — set it in Vercel env to enable webhook alerts" });
  }

  const txs: any[] = Array.isArray(req.body) ? req.body : [req.body].filter(Boolean);
  if (!txs.length) return res.status(200).json({ ok: true, processed: 0 });

  const proto = String(req.headers["x-forwarded-proto"] || "https");
  const host = String(req.headers["x-forwarded-host"] || req.headers.host || "www.ogscan.fun");
  const origin = `${proto}://${host}`;

  let dispatched = 0;
  const errors: string[] = [];

  try {
    // Collect candidate wallets from the batch
    const wallets = new Set<string>();
    for (const tx of txs) {
      if (tx?.feePayer) wallets.add(String(tx.feePayer));
      for (const t of tx?.tokenTransfers || []) {
        if (t?.fromUserAccount) wallets.add(String(t.fromUserAccount));
        if (t?.toUserAccount) wallets.add(String(t.toUserAccount));
      }
    }
    if (!wallets.size) return res.status(200).json({ ok: true, processed: 0 });

    const list = Array.from(wallets).map((w) => `"${w}"`).join(",");

    // 1) custom_list / per-wallet trackers
    const twR = await sb(`kol_tracked_wallets?wallet_address=in.(${list})&is_active=eq.true&select=id,tracker_id,user_id,wallet_address,label`);
    const trackedRows: any[] = twR.ok ? await twR.json() : [];

    // 2) specific_wallet trackers
    const swR = await sb(`kol_tracker_configs?wallet_address=in.(${list})&is_active=eq.true&mode=eq.specific_wallet&select=id,user_id,wallet_address,alert_on_buy,alert_on_sell,min_sol_amount`);
    const specificRows: any[] = swR.ok ? await swR.json() : [];

    // 3) all_kols trackers (match against the KOL directory)
    const akR = await sb(`kol_tracker_configs?mode=eq.all_kols&is_active=eq.true&select=id,user_id,alert_on_buy,alert_on_sell,min_sol_amount`);
    const allKolTrackers: any[] = akR.ok ? await akR.json() : [];
    const kolDir = allKolTrackers.length ? await getKolDirectory(origin) : {};

    // Load tracker configs for tracked wallet rows
    const trackerIds = Array.from(new Set(trackedRows.map((r) => r.tracker_id)));
    let trackerCfgs: any[] = [];
    if (trackerIds.length) {
      const tcR = await sb(`kol_tracker_configs?id=in.(${trackerIds.map((i) => `"${i}"`).join(",")})&is_active=eq.true&select=id,user_id,alert_on_buy,alert_on_sell,min_sol_amount`);
      trackerCfgs = tcR.ok ? await tcR.json() : [];
    }
    const cfgById: Record<string, any> = {};
    for (const c of trackerCfgs) cfgById[c.id] = c;

    // Resolve bot configs for every involved tracker
    const allTrackerIds = new Set<string>([
      ...trackerCfgs.map((c) => c.id),
      ...specificRows.map((c) => c.id),
      ...allKolTrackers.map((c) => c.id),
    ]);
    let bots: any[] = [];
    if (allTrackerIds.size) {
      const bR = await sb(`telegram_bot_configs?linked_tracker_id=in.(${Array.from(allTrackerIds).map((i) => `"${i}"`).join(",")})&select=id,user_id,bot_token,chat_id,message_thread_id,bot_image_url,linked_tracker_id`);
      bots = bR.ok ? await bR.json() : [];
    }
    const botByTracker: Record<string, any> = {};
    for (const b of bots) if (b.linked_tracker_id) botByTracker[b.linked_tracker_id] = b;

    // Process each tx
    for (const tx of txs) {
      const involved = new Set<string>();
      if (tx?.feePayer) involved.add(String(tx.feePayer));
      for (const t of tx?.tokenTransfers || []) {
        if (t?.fromUserAccount) involved.add(String(t.fromUserAccount));
        if (t?.toUserAccount) involved.add(String(t.toUserAccount));
      }

      type Target = { trackerId: string; cfg: any; wallet: string; kolName?: string; rowId?: string };
      const targets: Target[] = [];

      for (const row of trackedRows) {
        if (involved.has(row.wallet_address) && cfgById[row.tracker_id]) {
          targets.push({ trackerId: row.tracker_id, cfg: cfgById[row.tracker_id], wallet: row.wallet_address, kolName: row.label || undefined, rowId: row.id });
        }
      }
      for (const cfg of specificRows) {
        if (involved.has(cfg.wallet_address)) targets.push({ trackerId: cfg.id, cfg, wallet: cfg.wallet_address });
      }
      for (const cfg of allKolTrackers) {
        for (const w of involved) {
          if (kolDir[w]) targets.push({ trackerId: cfg.id, cfg, wallet: w, kolName: kolDir[w] });
        }
      }

      for (const t of targets) {
        const ev = parseTrade(tx, t.wallet);
        if (!ev) continue;
        if (ev.action === "buy" && t.cfg.alert_on_buy === false) continue;
        if (ev.action === "sell" && t.cfg.alert_on_sell === false) continue;
        if (Number(t.cfg.min_sol_amount || 0) > 0 && ev.solAmount < Number(t.cfg.min_sol_amount)) continue;

        const bot = botByTracker[t.trackerId];
        if (!bot?.bot_token || !bot?.chat_id) continue;

        const text = buildAlertText({
          wallet: t.wallet, action: ev.action, kolName: t.kolName,
          tokenMint: ev.mint, amount: ev.tokenAmount, solAmount: ev.solAmount, txSignature: ev.signature,
        } as any);
        const tg = await sendTelegram(bot.bot_token, bot.chat_id, text, bot.bot_image_url || undefined, bot.message_thread_id || undefined);
        const sent = tg?.ok === true;
        dispatched += sent ? 1 : 0;
        if (!sent && tg?.description) errors.push(String(tg.description));

        await sb("kol_alert_log", {
          method: "POST", headers: { Prefer: "return=minimal" },
          body: JSON.stringify({
            tracker_id: t.trackerId, user_id: bot.user_id, wallet_address: t.wallet, action: ev.action,
            token_mint: ev.mint, amount: ev.tokenAmount, sol_amount: ev.solAmount,
            tx_signature: ev.signature, status: sent ? "sent" : "failed",
          }),
        }).catch(() => {});

        if (t.rowId) {
          await sb(`kol_tracked_wallets?id=eq.${t.rowId}`, {
            method: "PATCH", headers: { Prefer: "return=minimal" },
            body: JSON.stringify({ last_activity_at: new Date().toISOString() }),
          }).catch(() => {});
        }
      }
    }

    return res.status(200).json({ ok: true, processed: txs.length, dispatched, errors: errors.slice(0, 5) });
  } catch (e: any) {
    return res.status(200).json({ ok: false, error: String(e?.message || e), dispatched });
  }
}

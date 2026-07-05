/**
 * KOL Tracker — data layer.
 * Source of truth is Supabase (kol_tracker_configs / kol_tracked_wallets /
 * telegram_bot_configs / kol_alert_log) with a localStorage fallback so the
 * tool keeps working before the migration is applied or while offline.
 * SECURITY: bot_token is WRITE-ONLY to Supabase (column-level grant hides it
 * on select). A local copy is kept only in this browser for direct dispatch.
 */
import { supabase } from "@/lib/supabase";

export type TrackerMode = "all_kols" | "specific_wallet" | "custom_list";

export interface TrackedWallet {
  id: string;
  address: string;
  label: string;
  isActive: boolean;
  lastActivityAt: string | null;
}

export interface TrackerState {
  id: string | null;
  mode: TrackerMode;
  walletAddress: string;
  isActive: boolean;
  alertOnBuy: boolean;
  alertOnSell: boolean;
  minSolAmount: number;
  pollSeconds: number;
  wallets: TrackedWallet[];
}

export interface BotState {
  id: string | null;
  botToken: string; // local-only; never read back from server
  tokenSaved: boolean;
  botName: string;
  botBio: string;
  botImageUrl: string;
  botUsername: string;
  chatId: string;
  threadId: string;
  digestEnabled: boolean;
  digestMinAge: number;
  digestMaxAge: number;
  digestIntervalHours: number;
}

export interface TradeEvent {
  signature: string;
  timestamp: number;
  action: "buy" | "sell";
  mint: string;
  tokenAmount: number;
  solAmount: number;
  wallet: string;
  source?: string;
  description?: string;
}

export interface AlertEntry {
  id: string;
  at: number;
  wallet: string;
  action: "buy" | "sell";
  tokenMint: string;
  amount: number;
  solAmount: number;
  signature: string;
  status: "sent" | "failed";
}

const LS_TRACKER = "orbitx-kol:tracker";
const LS_BOT = "orbitx-kol:bot";
const LS_ALERTS = "orbitx-kol:alerts";
const LS_LASTSIG = "orbitx-kol:lastsig";

export const BASE58_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
export const isValidSolAddress = (s: string) => BASE58_RE.test(s.trim());

export const defaultTracker = (): TrackerState => ({
  id: null,
  mode: "custom_list",
  walletAddress: "",
  isActive: false,
  alertOnBuy: true,
  alertOnSell: true,
  minSolAmount: 0,
  pollSeconds: 30,
  wallets: [],
});

export const defaultBot = (): BotState => ({
  id: null,
  botToken: "",
  tokenSaved: false,
  botName: "",
  botBio: "",
  botImageUrl: "",
  botUsername: "",
  chatId: "",
  threadId: "",
  digestEnabled: false,
  digestMinAge: 5,
  digestMaxAge: 10,
  digestIntervalHours: 6,
});

function loadLS<T>(key: string, def: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return def;
    return { ...(def as object), ...JSON.parse(raw) } as T;
  } catch {
    return def;
  }
}
function saveLS(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* full/blocked */ }
}

/* ── Tracker ── */
export async function loadTracker(userId?: string | null): Promise<TrackerState> {
  const local = loadLS(LS_TRACKER, defaultTracker());
  if (!userId) return local;
  try {
    const { data: cfg } = await supabase
      .from("kol_tracker_configs")
      .select("id, mode, wallet_address, is_active, alert_on_buy, alert_on_sell, min_sol_amount")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!cfg) return local;
    const { data: rows } = await supabase
      .from("kol_tracked_wallets")
      .select("id, wallet_address, label, is_active, last_activity_at")
      .eq("tracker_id", cfg.id)
      .order("created_at", { ascending: true });
    const state: TrackerState = {
      ...local,
      id: cfg.id,
      mode: (cfg.mode as TrackerMode) || "custom_list",
      walletAddress: cfg.wallet_address || "",
      isActive: Boolean(cfg.is_active),
      alertOnBuy: cfg.alert_on_buy !== false,
      alertOnSell: cfg.alert_on_sell !== false,
      minSolAmount: Number(cfg.min_sol_amount) || 0,
      wallets: (rows || []).map((r) => ({
        id: r.id,
        address: r.wallet_address,
        label: r.label || "",
        isActive: r.is_active !== false,
        lastActivityAt: r.last_activity_at,
      })),
    };
    saveLS(LS_TRACKER, state);
    return state;
  } catch {
    return local;
  }
}

export async function saveTracker(state: TrackerState, userId?: string | null): Promise<TrackerState> {
  saveLS(LS_TRACKER, state);
  if (!userId) return state;
  try {
    const row = {
      user_id: userId,
      mode: state.mode,
      wallet_address: state.walletAddress || null,
      is_active: state.isActive,
      alert_on_buy: state.alertOnBuy,
      alert_on_sell: state.alertOnSell,
      min_sol_amount: state.minSolAmount,
      updated_at: new Date().toISOString(),
    };
    let trackerId = state.id;
    if (trackerId) {
      await supabase.from("kol_tracker_configs").update(row).eq("id", trackerId);
    } else {
      const { data } = await supabase.from("kol_tracker_configs").insert(row).select("id").single();
      trackerId = data?.id ?? null;
    }
    if (trackerId) {
      // Sync wallet list: upsert current, delete removed
      const { data: existing } = await supabase
        .from("kol_tracked_wallets").select("id, wallet_address").eq("tracker_id", trackerId);
      const keepAddrs = new Set(state.wallets.map((w) => w.address));
      const toDelete = (existing || []).filter((r) => !keepAddrs.has(r.wallet_address)).map((r) => r.id);
      if (toDelete.length) await supabase.from("kol_tracked_wallets").delete().in("id", toDelete);
      for (const w of state.wallets) {
        await supabase.from("kol_tracked_wallets").upsert(
          {
            tracker_id: trackerId,
            user_id: userId,
            wallet_address: w.address,
            label: w.label || null,
            is_active: w.isActive,
            last_activity_at: w.lastActivityAt,
          },
          { onConflict: "tracker_id,wallet_address" }
        );
      }
      const next = { ...state, id: trackerId };
      saveLS(LS_TRACKER, next);
      return next;
    }
  } catch { /* table missing or RLS: local copy is still saved */ }
  return state;
}

/* ── Bot config ── */
export async function loadBot(userId?: string | null): Promise<BotState> {
  const local = loadLS(LS_BOT, defaultBot());
  if (!userId) return local;
  try {
    const { data: row } = await supabase
      .from("telegram_bot_configs")
      .select("id, bot_name, bot_bio, bot_image_url, bot_username, chat_id, message_thread_id, linked_tracker_id, launch_digest_enabled, launch_digest_min_age_hours, launch_digest_max_age_hours, launch_digest_interval_hours")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!row) return local;
    const state: BotState = {
      ...local,
      id: row.id,
      tokenSaved: true, // a row only exists if a token was saved (write-only column)
      botName: row.bot_name || local.botName,
      botBio: row.bot_bio || local.botBio,
      botImageUrl: row.bot_image_url || local.botImageUrl,
      botUsername: row.bot_username || local.botUsername,
      chatId: row.chat_id || local.chatId,
      threadId: row.message_thread_id || local.threadId,
      digestEnabled: Boolean(row.launch_digest_enabled),
      digestMinAge: Number(row.launch_digest_min_age_hours) || 5,
      digestMaxAge: Number(row.launch_digest_max_age_hours) || 10,
      digestIntervalHours: Number(row.launch_digest_interval_hours) || 6,
    };
    saveLS(LS_BOT, { ...state, botToken: local.botToken });
    return { ...state, botToken: local.botToken };
  } catch {
    return local;
  }
}

export async function saveBot(state: BotState, userId?: string | null, trackerId?: string | null): Promise<BotState> {
  saveLS(LS_BOT, state);
  if (!userId) return state;
  try {
    const row: Record<string, unknown> = {
      user_id: userId,
      bot_name: state.botName || null,
      bot_bio: state.botBio || null,
      bot_image_url: state.botImageUrl || null,
      bot_username: state.botUsername || null,
      chat_id: state.chatId || null,
      message_thread_id: state.threadId || null,
      linked_tracker_id: trackerId || null,
      launch_digest_enabled: state.digestEnabled,
      launch_digest_min_age_hours: state.digestMinAge,
      launch_digest_max_age_hours: state.digestMaxAge,
      launch_digest_interval_hours: state.digestIntervalHours,
    };
    if (state.botToken) row.bot_token = state.botToken; // write-only
    if (state.id) {
      await supabase.from("telegram_bot_configs").update(row).eq("id", state.id);
      const next = { ...state, tokenSaved: state.tokenSaved || Boolean(state.botToken) };
      saveLS(LS_BOT, next);
      return next;
    }
    if (!state.botToken) return state; // insert requires a token
    const { data } = await supabase.from("telegram_bot_configs").insert(row).select("id").single();
    const next = { ...state, id: data?.id ?? null, tokenSaved: true };
    saveLS(LS_BOT, next);
    return next;
  } catch {
    return { ...state, tokenSaved: state.tokenSaved || Boolean(state.botToken) };
  }
}

/* ── Alert history ── */
export function loadAlerts(): AlertEntry[] {
  return loadLS<AlertEntry[]>(LS_ALERTS, []);
}
export function appendAlert(entry: AlertEntry) {
  const list = [entry, ...loadAlerts()].slice(0, 200);
  saveLS(LS_ALERTS, list);
  return list;
}

/* ── Last-seen signatures (dedupe for the client poller) ── */
export function getLastSigMap(): Record<string, string> {
  return loadLS<Record<string, string>>(LS_LASTSIG, {});
}
export function setLastSig(wallet: string, sig: string) {
  const map = getLastSigMap();
  map[wallet] = sig;
  saveLS(LS_LASTSIG, map);
}

/* ── API helpers ── */
export async function fetchWalletTrades(wallet: string, limit = 25): Promise<TradeEvent[]> {
  const r = await fetch(`/api/kol/transactions?wallet=${encodeURIComponent(wallet)}&limit=${limit}`);
  const j = await r.json();
  if (!j?.ok) throw new Error(j?.error || "failed to load trades");
  return (j.events || []) as TradeEvent[];
}

export interface KolListEntry { address: string; name: string; twitter?: string | null; avatar?: string | null; tags?: string[]; }
export async function fetchKolList(): Promise<KolListEntry[]> {
  const r = await fetch("/api/ogdex/kols");
  const j = await r.json();
  const kols = (j?.kols || []) as Array<{ address: string; name: string; twitter?: string | null; avatar?: string | null; tags?: string[] }>;
  return kols.filter((k) => k?.address);
}

export async function uploadBotImage(userId: string, file: File): Promise<string | null> {
  try {
    const ext = (file.name.split(".").pop() || "png").toLowerCase();
    const path = `${userId}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("kol-bot-assets").upload(path, file, { upsert: true });
    if (error) return null;
    const { data } = supabase.storage.from("kol-bot-assets").getPublicUrl(path);
    return data?.publicUrl || null;
  } catch {
    return null;
  }
}

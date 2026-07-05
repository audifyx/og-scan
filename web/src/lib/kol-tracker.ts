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

/* ═══════════════════════════════════════════════════════════════
   ADVANCED FEATURES — settings, analytics, confluence, exports
   ═══════════════════════════════════════════════════════════════ */

const LS_ADV = "orbitx-kol:advanced";

export interface AdvancedSettings {
  soundOn: boolean;
  desktopNotifs: boolean;
  quietEnabled: boolean;
  quietStart: string;          // "22:00"
  quietEnd: string;            // "08:00"
  confluenceEnabled: boolean;
  confluenceMinWallets: number; // >= 2 distinct wallets
  confluenceWindowMin: number;  // rolling window, minutes
  confluenceTelegram: boolean;  // also push confluence hits to Telegram
  alertCooldownSec: number;     // per-wallet anti-spam (0 = off)
  feedAutoRefresh: boolean;
}

export const defaultAdvanced = (): AdvancedSettings => ({
  soundOn: false,
  desktopNotifs: false,
  quietEnabled: false,
  quietStart: "23:00",
  quietEnd: "07:00",
  confluenceEnabled: true,
  confluenceMinWallets: 2,
  confluenceWindowMin: 30,
  confluenceTelegram: false,
  alertCooldownSec: 0,
  feedAutoRefresh: true,
});

export function loadAdvanced(): AdvancedSettings {
  return loadLS(LS_ADV, defaultAdvanced());
}
export function saveAdvanced(s: AdvancedSettings) {
  saveLS(LS_ADV, s);
}

/** Is the current local time inside the configured quiet window? */
export function isQuietNow(s: AdvancedSettings, now = new Date()): boolean {
  if (!s.quietEnabled) return false;
  const [sh, sm] = s.quietStart.split(":").map(Number);
  const [eh, em] = s.quietEnd.split(":").map(Number);
  const cur = now.getHours() * 60 + now.getMinutes();
  const start = (sh || 0) * 60 + (sm || 0);
  const end = (eh || 0) * 60 + (em || 0);
  if (start === end) return false;
  return start < end ? cur >= start && cur < end : cur >= start || cur < end;
}

/* ── Analytics over the observed trade feed ── */
export interface WalletStats {
  wallet: string;
  trades: number;
  buys: number;
  sells: number;
  solIn: number;   // SOL spent buying
  solOut: number;  // SOL received selling
  netSol: number;  // solOut - solIn (realized flow)
  volume: number;  // solIn + solOut
  lastTs: number | null;
  uniqueTokens: number;
}

export function computeWalletStats(feed: TradeEvent[]): WalletStats[] {
  const map = new Map<string, WalletStats & { tokens: Set<string> }>();
  for (const ev of feed) {
    let s = map.get(ev.wallet);
    if (!s) {
      s = { wallet: ev.wallet, trades: 0, buys: 0, sells: 0, solIn: 0, solOut: 0, netSol: 0, volume: 0, lastTs: null, uniqueTokens: 0, tokens: new Set() };
      map.set(ev.wallet, s);
    }
    s.trades++;
    if (ev.action === "buy") { s.buys++; s.solIn += ev.solAmount || 0; } else { s.sells++; s.solOut += ev.solAmount || 0; }
    s.tokens.add(ev.mint);
    s.lastTs = Math.max(s.lastTs || 0, ev.timestamp);
  }
  return [...map.values()].map((s) => ({
    wallet: s.wallet, trades: s.trades, buys: s.buys, sells: s.sells,
    solIn: s.solIn, solOut: s.solOut, netSol: s.solOut - s.solIn,
    volume: s.solIn + s.solOut, lastTs: s.lastTs, uniqueTokens: s.tokens.size,
  })).sort((a, b) => b.volume - a.volume);
}

export interface TokenStats {
  mint: string;
  buyers: string[];    // distinct wallets that bought
  sellers: string[];   // distinct wallets that sold
  buys: number;
  sells: number;
  solIn: number;
  solOut: number;
  netSol: number;
  lastTs: number;
  heat: number; // buyers*10 + buys + solIn
}

export function computeTokenStats(feed: TradeEvent[]): TokenStats[] {
  const map = new Map<string, { buyers: Set<string>; sellers: Set<string>; buys: number; sells: number; solIn: number; solOut: number; lastTs: number }>();
  for (const ev of feed) {
    let t = map.get(ev.mint);
    if (!t) { t = { buyers: new Set(), sellers: new Set(), buys: 0, sells: 0, solIn: 0, solOut: 0, lastTs: 0 }; map.set(ev.mint, t); }
    if (ev.action === "buy") { t.buyers.add(ev.wallet); t.buys++; t.solIn += ev.solAmount || 0; }
    else { t.sellers.add(ev.wallet); t.sells++; t.solOut += ev.solAmount || 0; }
    t.lastTs = Math.max(t.lastTs, ev.timestamp);
  }
  return [...map.entries()].map(([mint, t]) => ({
    mint,
    buyers: [...t.buyers], sellers: [...t.sellers],
    buys: t.buys, sells: t.sells, solIn: t.solIn, solOut: t.solOut,
    netSol: t.solIn - t.solOut, lastTs: t.lastTs,
    heat: t.buyers.size * 10 + t.buys + t.solIn,
  })).sort((a, b) => b.heat - a.heat);
}

/* ── Confluence detection: N distinct wallets buying the same mint within a window ── */
export interface ConfluenceHit {
  mint: string;
  wallets: string[];
  totalSol: number;
  firstTs: number;
  lastTs: number;
}

export function detectConfluence(feed: TradeEvent[], minWallets: number, windowMin: number): ConfluenceHit[] {
  const buys = feed.filter((e) => e.action === "buy").sort((a, b) => a.timestamp - b.timestamp);
  const byMint = new Map<string, TradeEvent[]>();
  for (const ev of buys) {
    const arr = byMint.get(ev.mint) || [];
    arr.push(ev);
    byMint.set(ev.mint, arr);
  }
  const hits: ConfluenceHit[] = [];
  const windowSec = windowMin * 60;
  for (const [mint, events] of byMint) {
    // sliding window over sorted buys
    let best: ConfluenceHit | null = null;
    for (let i = 0; i < events.length; i++) {
      const wallets = new Set<string>();
      let sol = 0;
      let last = events[i].timestamp;
      for (let j = i; j < events.length && events[j].timestamp - events[i].timestamp <= windowSec; j++) {
        wallets.add(events[j].wallet);
        sol += events[j].solAmount || 0;
        last = events[j].timestamp;
      }
      if (wallets.size >= minWallets && (!best || wallets.size > best.wallets.length)) {
        best = { mint, wallets: [...wallets], totalSol: sol, firstTs: events[i].timestamp, lastTs: last };
      }
    }
    if (best) hits.push(best);
  }
  return hits.sort((a, b) => b.wallets.length - a.wallets.length || b.totalSol - a.totalSol);
}

/* ── CSV / JSON exports ── */
function csvEscape(v: unknown): string {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function tradesToCsv(events: TradeEvent[]): string {
  const head = "timestamp,iso_time,action,wallet,mint,token_amount,sol_amount,signature,source";
  const rows = events.map((e) => [e.timestamp, new Date(e.timestamp * 1000).toISOString(), e.action, e.wallet, e.mint, e.tokenAmount, e.solAmount, e.signature, e.source || ""].map(csvEscape).join(","));
  return [head, ...rows].join("\n");
}

export function alertsToCsv(alerts: AlertEntry[]): string {
  const head = "time,action,wallet,token_mint,amount,sol_amount,status,signature";
  const rows = alerts.map((a) => [new Date(a.at).toISOString(), a.action, a.wallet, a.tokenMint, a.amount, a.solAmount, a.status, a.signature].map(csvEscape).join(","));
  return [head, ...rows].join("\n");
}

export function downloadText(filename: string, text: string, mime = "text/plain") {
  try {
    const blob = new Blob([text], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  } catch { /* ignore */ }
}

export function exportWatchlistJson(wallets: TrackedWallet[]): string {
  return JSON.stringify(wallets.map((w) => ({ address: w.address, label: w.label, active: w.isActive })), null, 2);
}

/** Accepts JSON ([{address,label}] ) or plain lines: "address" / "address,label" / "address label". */
export function parseWalletsImport(text: string): { address: string; label: string }[] {
  const out: { address: string; label: string }[] = [];
  const seen = new Set<string>();
  const push = (address: string, label: string) => {
    const a = address.trim();
    if (isValidSolAddress(a) && !seen.has(a)) { seen.add(a); out.push({ address: a, label: (label || "").trim().slice(0, 40) }); }
  };
  const t = text.trim();
  if (!t) return out;
  if (t.startsWith("[") || t.startsWith("{")) {
    try {
      const j = JSON.parse(t);
      const arr = Array.isArray(j) ? j : [j];
      for (const it of arr) {
        if (typeof it === "string") push(it, "");
        else if (it && typeof it === "object") { const o = it as Record<string, unknown>; push(String(o.address || o.wallet || ""), String(o.label || o.name || "")); }
      }
      return out;
    } catch { /* fall through to line parsing */ }
  }
  for (const line of t.split(/\r?\n/)) {
    const clean = line.trim();
    if (!clean) continue;
    const m = clean.split(/[,\t]| {2,}| /);
    push(m[0], m.slice(1).join(" "));
  }
  return out;
}

/* ── Browser alerts: sound + desktop notifications ── */
let audioCtx: AudioContext | null = null;
export function playAlertSound() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const ctx = audioCtx;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(880, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.08);
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.4);
  } catch { /* audio blocked */ }
}

export async function ensureNotifPermission(): Promise<boolean> {
  try {
    if (!("Notification" in window)) return false;
    if (Notification.permission === "granted") return true;
    if (Notification.permission === "denied") return false;
    return (await Notification.requestPermission()) === "granted";
  } catch { return false; }
}

export function showDesktopNotif(title: string, body: string) {
  try {
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    new Notification(title, { body, icon: "/favicon.ico" });
  } catch { /* ignore */ }
}

/* ── Quick trade / explorer links per mint ── */
export const tradeLinks = (mint: string) => ({
  jupiter: `https://jup.ag/swap/SOL-${mint}`,
  photon: `https://photon-sol.tinyastro.io/en/lp/${mint}`,
  bullx: `https://bullx.io/terminal?chainId=1399811149&address=${mint}`,
  dexscreener: `https://dexscreener.com/solana/${mint}`,
  solscan: `https://solscan.io/token/${mint}`,
});
export const walletLink = (wallet: string) => `https://solscan.io/account/${wallet}`;
export const txLink = (sig: string) => `https://solscan.io/tx/${sig}`;

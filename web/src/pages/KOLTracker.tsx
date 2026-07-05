/**
 * KOL Tracker PRO — Advanced hub app.
 * Track every KOL, one wallet, or a custom watchlist with instant Telegram
 * alerts. Now with: analytics dashboard, wallet leaderboard, token heat map,
 * confluence detection (multiple KOLs aping the same token), sound + desktop
 * notifications, quiet hours, per-wallet cooldowns, bulk import/export,
 * CSV exports, quick trade links, KOL directory quick-add, and feed filters.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity, ArrowLeft, BellRing, Bot, CheckCircle2, ChevronDown, Copy, Download,
  ExternalLink, Filter, Flame, Gauge, History, Loader2, Moon, Pause, Play, Plus,
  Radar, RefreshCw, Rocket, Satellite, Search, Send, Trash2, TrendingDown,
  TrendingUp, Upload, Users, Volume2, VolumeX, Wallet, Zap, BellOff, Crosshair,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { EmeraldHeader, SectionCard, SegmentedTabs, EmptyState, LoadingState } from "@/components/ToolPageShell";
import { BottomNav } from "@/components/layout/BottomNav";
import {
  AdvancedSettings, AlertEntry, BotState, ConfluenceHit, KolListEntry, TrackedWallet,
  TrackerMode, TrackerState, TradeEvent, WalletStats,
  appendAlert, alertsToCsv, computeTokenStats, computeWalletStats, defaultAdvanced,
  defaultBot, defaultTracker, detectConfluence, downloadText, ensureNotifPermission,
  exportWatchlistJson, fetchKolList, fetchWalletTrades, getLastSigMap, isQuietNow,
  isValidSolAddress, loadAdvanced, loadAlerts, loadBot, loadTracker, parseWalletsImport,
  playAlertSound, saveAdvanced, saveBot, saveTracker, setLastSig, showDesktopNotif,
  tradeLinks, tradesToCsv, txLink, uploadBotImage, walletLink,
} from "@/lib/kol-tracker";

/* ── tiny UI helpers ── */
const short = (a: string) => (a.length > 12 ? `${a.slice(0, 4)}…${a.slice(-4)}` : a);
const fmtNum = (n: number) => (n >= 1_000_000 ? (n / 1_000_000).toFixed(2) + "M" : n >= 1_000 ? (n / 1_000).toFixed(2) + "K" : n.toLocaleString("en-US", { maximumFractionDigits: 4 }));
const fmtSol = (n: number) => `${n >= 1000 ? (n / 1000).toFixed(2) + "K" : n.toFixed(2)} SOL`;
const timeAgo = (ts: number) => {
  const s = Math.max(1, Math.floor(Date.now() / 1000 - ts));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
};
const copyText = async (t: string, label = "Copied") => {
  try { await navigator.clipboard.writeText(t); toast({ title: label }); } catch { toast({ title: "Copy failed" }); }
};

const SwitchPill = ({ on, onClick, labelOn = "On", labelOff = "Off", disabled }: { on: boolean; onClick: () => void; labelOn?: string; labelOff?: string; disabled?: boolean }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={cn(
      "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider transition",
      on ? "border-emerald-400/50 bg-emerald-500/15 text-emerald-300" : "border-white/10 bg-white/[0.03] text-white/35 hover:text-white/60",
      disabled && "opacity-40",
    )}
  >
    <span className={cn("h-1.5 w-1.5 rounded-full", on ? "bg-emerald-400" : "bg-white/25")} />
    {on ? labelOn : labelOff}
  </button>
);

const Labeled = ({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) => (
  <div>
    <div className="mb-1 flex items-baseline justify-between gap-2">
      <label className="text-[10px] font-black uppercase tracking-widest text-white/40">{label}</label>
      {hint && <span className="text-[9px] text-white/25">{hint}</span>}
    </div>
    {children}
  </div>
);

const inputCls = "w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white placeholder:text-white/20 outline-none transition focus:border-emerald-400/40 focus:bg-white/[0.06]";

const StatCard = ({ icon: Icon, label, value, sub, tone = "default" }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; sub?: string; tone?: "default" | "up" | "down" | "hot" }) => (
  <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-3.5">
    <div className="flex items-center gap-2">
      <div className={cn(
        "grid h-8 w-8 place-items-center rounded-xl",
        tone === "up" ? "bg-emerald-500/15 text-emerald-300" : tone === "down" ? "bg-rose-500/15 text-rose-300" : tone === "hot" ? "bg-orange-500/15 text-orange-300" : "bg-white/[0.05] text-white/50",
      )}>
        <Icon className="h-4 w-4" />
      </div>
      <span className="text-[9px] font-black uppercase tracking-widest text-white/30">{label}</span>
    </div>
    <div className={cn("mt-2 text-lg font-black leading-none", tone === "up" ? "text-emerald-300" : tone === "down" ? "text-rose-300" : "text-white")}>{value}</div>
    {sub && <div className="mt-1 text-[10px] text-white/30">{sub}</div>}
  </div>
);

const MintLinks = ({ mint }: { mint: string }) => {
  const links = tradeLinks(mint);
  return (
    <span className="inline-flex items-center gap-1">
      {([["JUP", links.jupiter], ["PHO", links.photon], ["BLX", links.bullx], ["DEX", links.dexscreener]] as const).map(([l, href]) => (
        <a key={l} href={href} target="_blank" rel="noreferrer" className="rounded border border-white/10 bg-white/[0.03] px-1 py-0.5 text-[8px] font-black text-white/40 transition hover:border-emerald-400/40 hover:text-emerald-300">{l}</a>
      ))}
    </span>
  );
};

type KolTab = "dashboard" | "watchlist" | "feed" | "intel" | "bot" | "history";

export default function KOLTracker() {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [tab, setTab] = useState<KolTab>("dashboard");
  const [tracker, setTracker] = useState<TrackerState>(defaultTracker());
  const [bot, setBot] = useState<BotState>(defaultBot());
  const [adv, setAdv] = useState<AdvancedSettings>(defaultAdvanced());
  const [alerts, setAlerts] = useState<AlertEntry[]>([]);
  const [kols, setKols] = useState<KolListEntry[]>([]);
  const [feed, setFeed] = useState<TradeEvent[]>([]);
  const [launches, setLaunches] = useState<{ mint?: string; name?: string; symbol?: string; ageHours?: number }[]>([]);
  const [webhook, setWebhook] = useState<{ url?: string; addressCount?: number } | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [feedBusy, setFeedBusy] = useState(false);
  const [busy, setBusy] = useState<string>("");

  const [addAddr, setAddAddr] = useState("");
  const [addLabel, setAddLabel] = useState("");
  const [bulkText, setBulkText] = useState("");
  const [showBulk, setShowBulk] = useState(false);
  const [watchSearch, setWatchSearch] = useState("");
  const [kolSearch, setKolSearch] = useState("");
  const [showKolDir, setShowKolDir] = useState(false);

  /* feed filters */
  const [fAction, setFAction] = useState<"all" | "buy" | "sell">("all");
  const [fMinSol, setFMinSol] = useState(0);
  const [fQuery, setFQuery] = useState("");

  /* history filters */
  const [hStatus, setHStatus] = useState<"all" | "sent" | "failed">("all");

  const trackerRef = useRef(tracker);
  trackerRef.current = tracker;
  const botRef = useRef(bot);
  botRef.current = bot;
  const advRef = useRef(adv);
  advRef.current = adv;
  const lastAlertAt = useRef<Record<string, number>>({});
  const notifiedConfluence = useRef<Set<string>>(new Set());

  /* ── initial load ── */
  useEffect(() => {
    let alive = true;
    (async () => {
      const [t, b] = await Promise.all([loadTracker(userId), loadBot(userId)]);
      if (!alive) return;
      setTracker(t);
      setBot(b);
      setAdv(loadAdvanced());
      setAlerts(loadAlerts());
      setLoaded(true);
      fetchKolList().then((k) => alive && setKols(k)).catch(() => {});
      fetch("/api/kol/sync-webhook").then((r) => r.json()).then((j) => alive && j?.ok && setWebhook(j.webhook)).catch(() => {});
      fetch("/api/kol/new-launches?limit=8").then((r) => r.json()).then((j) => alive && j?.ok && setLaunches(j.launches || [])).catch(() => {});
    })();
    return () => { alive = false; };
  }, [userId]);

  /* ── persistence helpers ── */
  const persistTracker = useCallback(async (next: TrackerState) => {
    setTracker(next);
    const saved = await saveTracker(next, userId);
    if (saved.id !== next.id) setTracker((cur) => ({ ...cur, id: saved.id }));
  }, [userId]);

  const persistBot = useCallback(async (next: BotState) => {
    setBot(next);
    const saved = await saveBot(next, userId, trackerRef.current.id);
    if (saved.id !== next.id || saved.tokenSaved !== next.tokenSaved) setBot((cur) => ({ ...cur, id: saved.id, tokenSaved: saved.tokenSaved }));
  }, [userId]);

  const persistAdv = useCallback((next: AdvancedSettings) => {
    setAdv(next);
    saveAdvanced(next);
  }, []);

  /* ── wallets being watched, by mode ── */
  const watchTargets = useMemo(() => {
    if (tracker.mode === "specific_wallet") {
      return isValidSolAddress(tracker.walletAddress) ? [{ address: tracker.walletAddress.trim(), label: "Watched wallet" }] : [];
    }
    if (tracker.mode === "all_kols") return kols.slice(0, 30).map((k) => ({ address: k.address, label: k.name }));
    return tracker.wallets.filter((w) => w.isActive).map((w) => ({ address: w.address, label: w.label || short(w.address) }));
  }, [tracker.mode, tracker.walletAddress, tracker.wallets, kols]);

  const labelFor = useCallback((wallet: string) => {
    const t = watchTargets.find((w) => w.address === wallet);
    if (t) return t.label;
    const k = kols.find((k) => k.address === wallet);
    return k?.name || short(wallet);
  }, [watchTargets, kols]);

  const botReady = Boolean((bot.botToken || bot.tokenSaved) && bot.chatId);

  /* ── alert dispatch ── */
  const dispatchAlert = useCallback(async (ev: TradeEvent, label?: string, test = false) => {
    const b = botRef.current;
    const body: Record<string, unknown> = {
      wallet: ev.wallet, action: ev.action, kolName: label,
      tokenMint: ev.mint, amount: ev.tokenAmount, solAmount: ev.solAmount,
      txSignature: ev.signature, test,
    };
    if (b.botToken) {
      body.botToken = b.botToken;
      body.chatId = b.chatId;
      body.threadId = b.threadId || undefined;
      body.imageUrl = b.botImageUrl || undefined;
    } else if (b.id) {
      body.botConfigId = b.id;
    }
    const r = await fetch("/api/kol/send-alert", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    return j?.ok === true;
  }, []);

  /* ── local (browser) alert side-effects ── */
  const localAlert = useCallback((ev: TradeEvent, label: string) => {
    const a = advRef.current;
    if (isQuietNow(a)) return;
    if (a.soundOn) playAlertSound();
    if (a.desktopNotifs) showDesktopNotif(
      `${label} ${ev.action === "buy" ? "bought" : "sold"} ${fmtSol(ev.solAmount || 0)}`,
      `${short(ev.mint)} · ${fmtNum(ev.tokenAmount || 0)} tokens`,
    );
  }, []);

  /* ── client-side poller ── */
  const rrIndex = useRef(0);
  const polling = useRef(false);
  useEffect(() => {
    if (!loaded || !tracker.isActive || watchTargets.length === 0) return;
    const secs = Math.max(15, tracker.pollSeconds || 30);

    const tick = async () => {
      if (polling.current) return;
      polling.current = true;
      try {
        const batchSize = Math.min(5, watchTargets.length);
        const batch: { address: string; label: string }[] = [];
        for (let i = 0; i < batchSize; i++) {
          batch.push(watchTargets[rrIndex.current % watchTargets.length]);
          rrIndex.current++;
        }
        const lastSigs = getLastSigMap();
        for (const target of batch) {
          let events: TradeEvent[] = [];
          try { events = await fetchWalletTrades(target.address, 10); } catch { continue; }
          if (!events.length) continue;
          const known = lastSigs[target.address];
          setLastSig(target.address, events[0].signature);
          if (!known) continue; // first sight: baseline only
          const fresh: TradeEvent[] = [];
          for (const ev of events) {
            if (ev.signature === known) break;
            fresh.push(ev);
          }
          if (!fresh.length) continue;

          const t = trackerRef.current;
          const a = advRef.current;
          for (const ev of fresh.reverse()) {
            if (ev.action === "buy" && !t.alertOnBuy) continue;
            if (ev.action === "sell" && !t.alertOnSell) continue;
            if (t.minSolAmount > 0 && ev.solAmount < t.minSolAmount) continue;
            // per-wallet cooldown (anti-spam)
            if (a.alertCooldownSec > 0) {
              const last = lastAlertAt.current[ev.wallet] || 0;
              if (Date.now() - last < a.alertCooldownSec * 1000) continue;
            }
            lastAlertAt.current[ev.wallet] = Date.now();
            localAlert(ev, target.label);
            let ok = false;
            const quiet = isQuietNow(a);
            if (botReady && !quiet) ok = await dispatchAlert(ev, target.label).catch(() => false);
            setAlerts(appendAlert({
              id: `${ev.signature}-${ev.wallet}`, at: Date.now(), wallet: ev.wallet, action: ev.action,
              tokenMint: ev.mint, amount: ev.tokenAmount, solAmount: ev.solAmount, signature: ev.signature,
              status: ok ? "sent" : "failed",
            }));
          }
          setTracker((cur) => {
            const next = {
              ...cur,
              wallets: cur.wallets.map((w) => (w.address === target.address ? { ...w, lastActivityAt: new Date().toISOString() } : w)),
            };
            saveTracker(next, userId);
            return next;
          });
          setFeed((cur) => {
            const seen = new Set(cur.map((e) => e.signature + e.wallet));
            const merged = [...fresh.filter((e) => !seen.has(e.signature + e.wallet)), ...cur];
            return merged.sort((a, b) => b.timestamp - a.timestamp).slice(0, 200);
          });
        }
      } finally {
        polling.current = false;
      }
    };

    const iv = setInterval(tick, secs * 1000);
    tick();
    return () => clearInterval(iv);
  }, [loaded, tracker.isActive, tracker.pollSeconds, watchTargets, botReady, dispatchAlert, localAlert, userId]);

  /* ── analytics ── */
  const walletStats = useMemo(() => computeWalletStats(feed), [feed]);
  const tokenStats = useMemo(() => computeTokenStats(feed), [feed]);
  const confluence = useMemo(
    () => (adv.confluenceEnabled ? detectConfluence(feed, Math.max(2, adv.confluenceMinWallets), adv.confluenceWindowMin) : []),
    [feed, adv.confluenceEnabled, adv.confluenceMinWallets, adv.confluenceWindowMin],
  );

  /* confluence Telegram push (one per mint per session) */
  useEffect(() => {
    if (!adv.confluenceTelegram || !botReady || !confluence.length) return;
    const a = advRef.current;
    if (isQuietNow(a)) return;
    (async () => {
      for (const hit of confluence) {
        if (notifiedConfluence.current.has(hit.mint)) continue;
        notifiedConfluence.current.add(hit.mint);
        await dispatchAlert(
          { signature: `CONF-${hit.mint.slice(0, 8)}`, timestamp: hit.lastTs, action: "buy", mint: hit.mint, tokenAmount: 0, solAmount: hit.totalSol, wallet: hit.wallets[0] },
          `CONFLUENCE ${hit.wallets.length} KOLs`,
        ).catch(() => {});
      }
    })();
  }, [confluence, adv.confluenceTelegram, botReady, dispatchAlert]);

  /* ── actions ── */
  const addWallet = (addr?: string, label?: string) => {
    const address = (addr ?? addAddr).trim();
    if (!isValidSolAddress(address)) {
      toast({ title: "Invalid address", description: "That does not look like a Solana wallet address." });
      return;
    }
    if (tracker.wallets.some((w) => w.address === address)) {
      toast({ title: "Already tracked", description: short(address) + " is already on your watchlist." });
      return;
    }
    const w: TrackedWallet = { id: `local-${Date.now()}`, address, label: (label ?? addLabel).trim(), isActive: true, lastActivityAt: null };
    persistTracker({ ...tracker, mode: "custom_list", wallets: [...tracker.wallets, w] });
    if (!addr) { setAddAddr(""); setAddLabel(""); }
    toast({ title: "Wallet added", description: `${short(address)} is now tracked.` });
  };

  const bulkImport = () => {
    const parsed = parseWalletsImport(bulkText);
    if (!parsed.length) {
      toast({ title: "Nothing to import", description: "Paste addresses (one per line, optional label after a comma) or JSON." });
      return;
    }
    const existing = new Set(tracker.wallets.map((w) => w.address));
    const fresh = parsed.filter((p) => !existing.has(p.address));
    if (!fresh.length) {
      toast({ title: "All duplicates", description: "Every address is already tracked." });
      return;
    }
    const rows: TrackedWallet[] = fresh.map((p, i) => ({ id: `local-${Date.now()}-${i}`, address: p.address, label: p.label, isActive: true, lastActivityAt: null }));
    persistTracker({ ...tracker, mode: "custom_list", wallets: [...tracker.wallets, ...rows] });
    setBulkText("");
    setShowBulk(false);
    toast({ title: `${rows.length} wallets imported`, description: `${parsed.length - fresh.length} duplicates skipped.` });
  };

  const removeWallet = (address: string) => {
    persistTracker({ ...tracker, wallets: tracker.wallets.filter((w) => w.address !== address) });
  };

  const toggleWallet = (address: string) => {
    persistTracker({ ...tracker, wallets: tracker.wallets.map((w) => (w.address === address ? { ...w, isActive: !w.isActive } : w)) });
  };

  const refreshFeed = async () => {
    if (!watchTargets.length) {
      toast({ title: "Nothing to load", description: "Add wallets or pick a mode first." });
      return;
    }
    setFeedBusy(true);
    try {
      const targets = watchTargets.slice(0, 10);
      const results = await Promise.all(targets.map((t) => fetchWalletTrades(t.address, 15).catch(() => [] as TradeEvent[])));
      const merged = results.flat().sort((a, b) => b.timestamp - a.timestamp).slice(0, 200);
      setFeed((cur) => {
        const seen = new Set(merged.map((e) => e.signature + e.wallet));
        return [...merged, ...cur.filter((e) => !seen.has(e.signature + e.wallet))].sort((a, b) => b.timestamp - a.timestamp).slice(0, 200);
      });
    } finally {
      setFeedBusy(false);
    }
  };

  /* auto-refresh feed while on feed/intel/dashboard tabs */
  useEffect(() => {
    if (!loaded || !adv.feedAutoRefresh || !watchTargets.length) return;
    if (tab !== "feed" && tab !== "intel" && tab !== "dashboard") return;
    if (!feed.length) refreshFeed();
    const iv = setInterval(() => refreshFeed(), 60_000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, adv.feedAutoRefresh, tab, watchTargets.length]);

  const fetchChatId = async () => {
    if (!bot.botToken) {
      toast({ title: "Token required", description: "Paste your bot token first (from @BotFather)." });
      return;
    }
    setBusy("chatid");
    try {
      const r = await fetch("/api/kol/chat-id", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ botToken: bot.botToken }) });
      const j = await r.json();
      if (j?.ok) {
        const next = { ...bot, chatId: String(j.chatId), threadId: j.threadId ? String(j.threadId) : bot.threadId };
        await persistBot(next);
        toast({ title: "Chat connected", description: `${j.chatTitle || j.chatId}${j.threadId ? " (topic detected)" : ""}` });
      } else {
        toast({ title: "Could not fetch chat ID", description: j?.error || "Unknown error" });
      }
    } finally {
      setBusy("");
    }
  };

  const applyBranding = async () => {
    if (!bot.botToken) {
      toast({ title: "Token required", description: "Paste your bot token first." });
      return;
    }
    setBusy("brand");
    try {
      const r = await fetch("/api/kol/bot-setup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ botToken: bot.botToken, name: bot.botName, bio: bot.botBio }) });
      const j = await r.json();
      if (j?.ok) {
        await persistBot({ ...bot, botUsername: j.botUsername || bot.botUsername });
        toast({ title: "Bot verified", description: `@${j.botUsername} branded. ${j.note || ""}` });
      } else {
        toast({ title: "Branding failed", description: j?.error || "Unknown error" });
      }
    } finally {
      setBusy("");
    }
  };

  const sendTest = async () => {
    if (!botReady) {
      toast({ title: "Bot not ready", description: "Save a token and chat ID first." });
      return;
    }
    setBusy("test");
    try {
      const ok = await dispatchAlert(
        { signature: "TEST", timestamp: Math.floor(Date.now() / 1000), action: "buy", mint: "So11111111111111111111111111111111111111112", tokenAmount: 1337, solAmount: 4.2, wallet: watchTargets[0]?.address || "11111111111111111111111111111111" },
        "OrbitX Test", true,
      );
      toast(ok ? { title: "Test alert sent", description: "Check your Telegram chat/topic." } : { title: "Test failed", description: "Check token, chat ID and that the bot is in the chat." });
    } finally {
      setBusy("");
    }
  };

  const sendDigestNow = async () => {
    if (!bot.botToken || !bot.chatId) {
      toast({ title: "Bot not ready", description: "Digest needs a bot token and chat ID." });
      return;
    }
    setBusy("digest");
    try {
      const r = await fetch("/api/kol/launch-digest", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ botToken: bot.botToken, chatId: bot.chatId, threadId: bot.threadId || undefined, minAgeHours: bot.digestMinAge, maxAgeHours: bot.digestMaxAge }),
      });
      const j = await r.json();
      toast(j?.ok ? { title: "Digest sent", description: `${j.count} launches (${j.source})` } : { title: "Digest failed", description: j?.description || j?.error || "Unknown error" });
    } finally {
      setBusy("");
    }
  };

  const syncWebhook = async () => {
    if (!watchTargets.length) {
      toast({ title: "Nothing to sync", description: "Add wallets first." });
      return;
    }
    setBusy("webhook");
    try {
      const r = await fetch("/api/kol/sync-webhook", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ add: watchTargets.map((w) => w.address) }),
      });
      const j = await r.json();
      if (j?.ok) {
        setWebhook((cur) => ({ ...(cur || {}), addressCount: j.addressCount }));
        toast({ title: "Webhook synced", description: `${j.addressCount} addresses now streaming from Helius.` });
      } else {
        toast({ title: "Sync failed", description: j?.error || "Unknown error" });
      }
    } finally {
      setBusy("");
    }
  };

  const onImageUpload = async (file: File | null) => {
    if (!file) return;
    if (!userId) {
      toast({ title: "Sign in required", description: "Log in to upload images, or paste an image URL." });
      return;
    }
    setBusy("img");
    try {
      const url = await uploadBotImage(userId, file);
      if (url) {
        await persistBot({ ...bot, botImageUrl: url });
        toast({ title: "Image uploaded", description: "It will be attached to every alert." });
      } else {
        toast({ title: "Upload failed", description: "Storage bucket unavailable. Paste an image URL instead." });
      }
    } finally {
      setBusy("");
    }
  };

  const toggleDesktopNotifs = async () => {
    if (!adv.desktopNotifs) {
      const ok = await ensureNotifPermission();
      if (!ok) { toast({ title: "Permission denied", description: "Enable notifications for this site in your browser settings." }); return; }
    }
    persistAdv({ ...adv, desktopNotifs: !adv.desktopNotifs });
  };

  /* ── derived ── */
  const alerts24h = alerts.filter((a) => Date.now() - a.at < 86_400_000);
  const buys24 = alerts24h.filter((a) => a.action === "buy").length;
  const sells24 = alerts24h.filter((a) => a.action === "sell").length;
  const netFlow = feed.reduce((s, e) => s + (e.action === "buy" ? -(e.solAmount || 0) : (e.solAmount || 0)), 0);
  const hottest = tokenStats[0];

  const filteredFeed = useMemo(() => feed.filter((e) => {
    if (fAction !== "all" && e.action !== fAction) return false;
    if (fMinSol > 0 && (e.solAmount || 0) < fMinSol) return false;
    if (fQuery) {
      const q = fQuery.toLowerCase();
      if (!e.mint.toLowerCase().includes(q) && !e.wallet.toLowerCase().includes(q) && !labelFor(e.wallet).toLowerCase().includes(q)) return false;
    }
    return true;
  }), [feed, fAction, fMinSol, fQuery, labelFor]);

  const filteredAlerts = useMemo(() => alerts.filter((a) => hStatus === "all" || a.status === hStatus), [alerts, hStatus]);

  const shownWallets = useMemo(() => {
    const q = watchSearch.trim().toLowerCase();
    if (!q) return tracker.wallets;
    return tracker.wallets.filter((w) => w.address.toLowerCase().includes(q) || (w.label || "").toLowerCase().includes(q));
  }, [tracker.wallets, watchSearch]);

  const kolDir = useMemo(() => {
    const q = kolSearch.trim().toLowerCase();
    const tracked = new Set(tracker.wallets.map((w) => w.address));
    return kols
      .filter((k) => !q || k.name.toLowerCase().includes(q) || k.address.toLowerCase().includes(q))
      .map((k) => ({ ...k, tracked: tracked.has(k.address) }))
      .slice(0, 40);
  }, [kols, kolSearch, tracker.wallets]);

  if (!loaded) {
    return (
      <div className="min-h-screen bg-background px-4 py-6">
        <LoadingState text="Loading KOL Tracker" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-28">
      <div className="mx-auto w-full max-w-6xl px-4 py-5 space-y-4">
        <Link to="/app" className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-white/30 transition hover:text-white/60">
          <ArrowLeft className="h-3.5 w-3.5" /> Hub
        </Link>

        <EmeraldHeader
          icon={Radar}
          title="KOL Tracker Pro"
          subtitle="Track every KOL, one wallet, or your own watchlist. Telegram alerts, confluence detection, wallet analytics, token heat and more."
          badge={tracker.isActive ? "LIVE" : "PAUSED"}
          right={
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => persistAdv({ ...adv, soundOn: !adv.soundOn })}
                title={adv.soundOn ? "Sound on" : "Sound off"}
                className={cn("grid h-9 w-9 place-items-center rounded-xl border transition", adv.soundOn ? "border-emerald-400/50 bg-emerald-500/15 text-emerald-300" : "border-white/10 bg-white/[0.03] text-white/35")}
              >
                {adv.soundOn ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
              </button>
              <button
                type="button"
                onClick={toggleDesktopNotifs}
                title={adv.desktopNotifs ? "Desktop notifications on" : "Desktop notifications off"}
                className={cn("grid h-9 w-9 place-items-center rounded-xl border transition", adv.desktopNotifs ? "border-emerald-400/50 bg-emerald-500/15 text-emerald-300" : "border-white/10 bg-white/[0.03] text-white/35")}
              >
                {adv.desktopNotifs ? <BellRing className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
              </button>
              <button
                type="button"
                onClick={() => persistTracker({ ...tracker, isActive: !tracker.isActive })}
                className={cn(
                  "inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-[11px] font-black uppercase tracking-widest transition",
                  tracker.isActive
                    ? "border-emerald-400/50 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25"
                    : "border-white/15 bg-white/[0.04] text-white/60 hover:bg-white/[0.08]",
                )}
              >
                {tracker.isActive ? <><Pause className="h-3.5 w-3.5" /> Pause</> : <><Play className="h-3.5 w-3.5" /> Start</>}
              </button>
            </div>
          }
        />

        <SegmentedTabs<KolTab>
          tabs={[
            { id: "dashboard", label: "Dashboard", Icon: Gauge },
            { id: "watchlist", label: "Watchlist", Icon: Wallet },
            { id: "feed", label: "Live Feed", Icon: Activity },
            { id: "intel", label: "Intelligence", Icon: Crosshair },
            { id: "bot", label: "Bot & Alerts", Icon: Bot },
            { id: "history", label: "History", Icon: History },
          ]}
          active={tab}
          onChange={setTab}
        />

        {/* ═══════════ DASHBOARD ═══════════ */}
        {tab === "dashboard" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              <StatCard icon={Users} label="Watching" value={String(watchTargets.length)} sub={tracker.mode.replace("_", " ")} />
              <StatCard icon={BellRing} label="Alerts 24h" value={String(alerts24h.length)} sub={`${buys24} buys · ${sells24} sells`} />
              <StatCard icon={TrendingUp} label="Buys seen" value={String(feed.filter((e) => e.action === "buy").length)} tone="up" sub="in current feed" />
              <StatCard icon={TrendingDown} label="Sells seen" value={String(feed.filter((e) => e.action === "sell").length)} tone="down" sub="in current feed" />
              <StatCard icon={Flame} label="Hottest token" value={hottest ? short(hottest.mint) : "—"} tone="hot" sub={hottest ? `${hottest.buyers.length} KOL buyers` : "no data yet"} />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <SectionCard>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="flex items-center gap-2 text-sm font-black text-white"><Satellite className="h-4 w-4 text-emerald-300" /> Tracking mode</h3>
                  <SwitchPill on={tracker.isActive} onClick={() => persistTracker({ ...tracker, isActive: !tracker.isActive })} labelOn="Live" labelOff="Paused" />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    ["all_kols", "All KOLs", Users],
                    ["specific_wallet", "One wallet", Wallet],
                    ["custom_list", "My list", Radar],
                  ] as [TrackerMode, string, React.ComponentType<{ className?: string }>][]).map(([m, label, Icon]) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => persistTracker({ ...tracker, mode: m })}
                      className={cn(
                        "flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3 text-[10px] font-black uppercase tracking-wider transition",
                        tracker.mode === m ? "border-emerald-400/50 bg-emerald-500/10 text-emerald-300" : "border-white/10 bg-white/[0.02] text-white/35 hover:text-white/60",
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {label}
                    </button>
                  ))}
                </div>
                {tracker.mode === "specific_wallet" && (
                  <div className="mt-3">
                    <input value={tracker.walletAddress} onChange={(e) => setTracker({ ...tracker, walletAddress: e.target.value })} onBlur={() => persistTracker(trackerRef.current)} placeholder="Wallet address to watch" className={inputCls} />
                  </div>
                )}
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <Labeled label="Poll every" hint="seconds">
                    <input type="number" min={15} value={tracker.pollSeconds} onChange={(e) => setTracker({ ...tracker, pollSeconds: Number(e.target.value) || 30 })} onBlur={() => persistTracker(trackerRef.current)} className={inputCls} />
                  </Labeled>
                  <Labeled label="Min trade size" hint="SOL, 0 = all">
                    <input type="number" min={0} step={0.1} value={tracker.minSolAmount} onChange={(e) => setTracker({ ...tracker, minSolAmount: Number(e.target.value) || 0 })} onBlur={() => persistTracker(trackerRef.current)} className={inputCls} />
                  </Labeled>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <SwitchPill on={tracker.alertOnBuy} onClick={() => persistTracker({ ...tracker, alertOnBuy: !tracker.alertOnBuy })} labelOn="Buys" labelOff="Buys" />
                  <SwitchPill on={tracker.alertOnSell} onClick={() => persistTracker({ ...tracker, alertOnSell: !tracker.alertOnSell })} labelOn="Sells" labelOff="Sells" />
                  <SwitchPill on={adv.feedAutoRefresh} onClick={() => persistAdv({ ...adv, feedAutoRefresh: !adv.feedAutoRefresh })} labelOn="Auto-refresh" labelOff="Auto-refresh" />
                </div>
              </SectionCard>

              <SectionCard>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="flex items-center gap-2 text-sm font-black text-white"><Zap className="h-4 w-4 text-emerald-300" /> Infrastructure</h3>
                  <button type="button" onClick={syncWebhook} disabled={busy === "webhook"} className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-white/50 transition hover:text-white">
                    {busy === "webhook" ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />} Sync Helius
                  </button>
                </div>
                <div className="space-y-2 text-[12px]">
                  <div className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
                    <span className="text-white/40">Helius webhook</span>
                    <span className={cn("font-bold", webhook?.addressCount ? "text-emerald-300" : "text-white/30")}>
                      {webhook?.addressCount ? `${webhook.addressCount} addresses streaming` : "not synced"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
                    <span className="text-white/40">Telegram bot</span>
                    <span className={cn("font-bold", botReady ? "text-emerald-300" : "text-orange-300")}>{botReady ? (bot.botUsername ? "@" + bot.botUsername : "connected") : "setup needed"}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
                    <span className="text-white/40">Quiet hours</span>
                    <span className={cn("font-bold", adv.quietEnabled ? (isQuietNow(adv) ? "text-orange-300" : "text-emerald-300") : "text-white/30")}>
                      {adv.quietEnabled ? `${adv.quietStart} – ${adv.quietEnd}${isQuietNow(adv) ? " (active)" : ""}` : "off"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
                    <span className="text-white/40">Confluence radar</span>
                    <span className={cn("font-bold", adv.confluenceEnabled ? "text-emerald-300" : "text-white/30")}>
                      {adv.confluenceEnabled ? `${adv.confluenceMinWallets}+ wallets / ${adv.confluenceWindowMin}m` : "off"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
                    <span className="text-white/40">Net SOL flow (feed)</span>
                    <span className={cn("font-bold", netFlow >= 0 ? "text-emerald-300" : "text-rose-300")}>{netFlow >= 0 ? "+" : ""}{fmtSol(netFlow)}</span>
                  </div>
                </div>
              </SectionCard>
            </div>

            {confluence.length > 0 && (
              <SectionCard className="border-orange-400/20">
                <h3 className="mb-3 flex items-center gap-2 text-sm font-black text-white"><Flame className="h-4 w-4 text-orange-300" /> Confluence radar <span className="rounded-full bg-orange-500/15 px-2 py-0.5 text-[9px] font-black text-orange-300">{confluence.length} hits</span></h3>
                <div className="space-y-2">
                  {confluence.slice(0, 5).map((hit) => (
                    <div key={hit.mint} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-orange-400/15 bg-orange-500/[0.04] px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[12px] font-bold text-white">{short(hit.mint)}</span>
                        <button type="button" onClick={() => copyText(hit.mint, "Mint copied")} className="text-white/30 hover:text-white"><Copy className="h-3 w-3" /></button>
                        <MintLinks mint={hit.mint} />
                      </div>
                      <div className="flex items-center gap-3 text-[11px]">
                        <span className="font-black text-orange-300">{hit.wallets.length} KOLs buying</span>
                        <span className="text-white/50">{fmtSol(hit.totalSol)} in</span>
                        <span className="text-white/30">{timeAgo(hit.lastTs)} ago</span>
                      </div>
                    </div>
                  ))}
                </div>
              </SectionCard>
            )}

            <div className="grid gap-4 lg:grid-cols-2">
              <SectionCard>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="flex items-center gap-2 text-sm font-black text-white"><Rocket className="h-4 w-4 text-emerald-300" /> Fresh launches</h3>
                  <button type="button" onClick={sendDigestNow} disabled={busy === "digest"} className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-white/50 transition hover:text-white">
                    {busy === "digest" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />} Send digest
                  </button>
                </div>
                {launches.length === 0 ? (
                  <EmptyState icon={Rocket} title="No launch data yet" description="Survivors aged 5-10h show up here." />
                ) : (
                  <div className="space-y-1.5">
                    {launches.slice(0, 6).map((l) => (
                      <div key={l.mint || l.address} className="flex items-center justify-between gap-2 rounded-xl border border-white/[0.05] bg-white/[0.02] px-3 py-2">
                        <div className="min-w-0">
                          <div className="truncate text-[12px] font-bold text-white">{l.symbol || l.name || short(l.mint || l.address || "?")}</div>
                          <div className="truncate font-mono text-[9px] text-white/25">{short(l.mint || l.address || "")}</div>
                        </div>
                        {(l.mint || l.address) && <MintLinks mint={l.mint || l.address} />}
                      </div>
                    ))}
                  </div>
                )}
              </SectionCard>

              <SectionCard>
                <h3 className="mb-3 flex items-center gap-2 text-sm font-black text-white"><BellRing className="h-4 w-4 text-emerald-300" /> Latest alerts</h3>
                {alerts.length === 0 ? (
                  <EmptyState icon={BellRing} title="No alerts yet" description="Alerts fire when tracked wallets trade." />
                ) : (
                  <div className="space-y-1.5">
                    {alerts.slice(0, 6).map((a) => (
                      <div key={a.id} className="flex items-center justify-between gap-2 rounded-xl border border-white/[0.05] bg-white/[0.02] px-3 py-2 text-[11px]">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={cn("rounded px-1.5 py-0.5 text-[8px] font-black uppercase", a.action === "buy" ? "bg-emerald-500/15 text-emerald-300" : "bg-rose-500/15 text-rose-300")}>{a.action}</span>
                          <span className="truncate font-bold text-white/70">{labelFor(a.wallet)}</span>
                          <span className="font-mono text-white/30">{short(a.tokenMint)}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-bold text-white/60">{fmtSol(a.solAmount || 0)}</span>
                          <span className={cn("h-1.5 w-1.5 rounded-full", a.status === "sent" ? "bg-emerald-400" : "bg-rose-400")} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </SectionCard>
            </div>
          </div>
        )}

        {/* ═══════════ WATCHLIST ═══════════ */}
        {tab === "watchlist" && (
          <div className="space-y-4">
            <SectionCard>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h3 className="flex items-center gap-2 text-sm font-black text-white"><Plus className="h-4 w-4 text-emerald-300" /> Add wallet</h3>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => setShowBulk((v) => !v)} className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-white/50 transition hover:text-white">
                    <Upload className="h-3 w-3" /> Bulk import
                  </button>
                  <button type="button" onClick={() => downloadText("kol-watchlist.json", exportWatchlistJson(tracker.wallets), "application/json")} className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-white/50 transition hover:text-white">
                    <Download className="h-3 w-3" /> Export
                  </button>
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-[1fr_200px_auto]">
                <input value={addAddr} onChange={(e) => setAddAddr(e.target.value)} placeholder="Solana wallet address" className={inputCls} />
                <input value={addLabel} onChange={(e) => setAddLabel(e.target.value)} placeholder="Label (optional)" className={inputCls} />
                <button type="button" onClick={() => addWallet()} className="rounded-xl bg-gradient-to-r from-emerald-500 to-green-400 px-5 py-2.5 text-[12px] font-black uppercase tracking-wider text-white shadow-lg shadow-emerald-500/25 transition hover:brightness-110">
                  Track
                </button>
              </div>
              {showBulk && (
                <div className="mt-3 space-y-2">
                  <textarea value={bulkText} onChange={(e) => setBulkText(e.target.value)} rows={5} placeholder={"One per line:\naddress,label\naddress\n…or paste JSON [{\"address\":\"…\",\"label\":\"…\"}]"} className={cn(inputCls, "font-mono text-[11px]")} />
                  <button type="button" onClick={bulkImport} className="inline-flex items-center gap-2 rounded-xl border border-emerald-400/40 bg-emerald-500/10 px-4 py-2 text-[11px] font-black uppercase tracking-wider text-emerald-300 transition hover:bg-emerald-500/20">
                    <Upload className="h-3.5 w-3.5" /> Import all
                  </button>
                </div>
              )}
            </SectionCard>

            <SectionCard>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h3 className="flex items-center gap-2 text-sm font-black text-white"><Wallet className="h-4 w-4 text-emerald-300" /> Watchlist <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[9px] font-black text-white/40">{tracker.wallets.length}</span></h3>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/25" />
                  <input value={watchSearch} onChange={(e) => setWatchSearch(e.target.value)} placeholder="Search" className="w-44 rounded-xl border border-white/10 bg-white/[0.04] py-1.5 pl-8 pr-3 text-[12px] text-white placeholder:text-white/20 outline-none focus:border-emerald-400/40" />
                </div>
              </div>
              {shownWallets.length === 0 ? (
                <EmptyState icon={Wallet} title={tracker.wallets.length ? "No matches" : "No wallets tracked"} description={tracker.wallets.length ? "Try another search." : "Add wallets above or from the KOL directory below."} />
              ) : (
                <div className="space-y-1.5">
                  {shownWallets.map((w) => {
                    const st = walletStats.find((s) => s.wallet === w.address);
                    return (
                      <div key={w.address} className={cn("flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2.5", w.isActive ? "border-white/[0.07] bg-white/[0.02]" : "border-white/[0.04] bg-white/[0.01] opacity-60")}>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-[12px] font-bold text-white">{w.label || short(w.address)}</span>
                            <button type="button" onClick={() => copyText(w.address, "Address copied")} className="text-white/25 hover:text-white"><Copy className="h-3 w-3" /></button>
                            <a href={walletLink(w.address)} target="_blank" rel="noreferrer" className="text-white/25 hover:text-white"><ExternalLink className="h-3 w-3" /></a>
                          </div>
                          <div className="font-mono text-[9px] text-white/25">{short(w.address)}{w.lastActivityAt && <span className="ml-2 text-emerald-300/60">active {timeAgo(Math.floor(new Date(w.lastActivityAt).getTime() / 1000))} ago</span>}</div>
                        </div>
                        {st && (
                          <div className="flex items-center gap-3 text-[10px]">
                            <span className="text-white/40">{st.trades} trades</span>
                            <span className="text-emerald-300/70">{st.buys}B</span>
                            <span className="text-rose-300/70">{st.sells}S</span>
                            <span className={cn("font-bold", st.netSol >= 0 ? "text-emerald-300" : "text-rose-300")}>{st.netSol >= 0 ? "+" : ""}{st.netSol.toFixed(1)}◎</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <SwitchPill on={w.isActive} onClick={() => toggleWallet(w.address)} />
                          <button type="button" onClick={() => removeWallet(w.address)} className="grid h-7 w-7 place-items-center rounded-lg border border-white/10 text-white/30 transition hover:border-rose-400/40 hover:text-rose-300">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </SectionCard>

            <SectionCard>
              <button type="button" onClick={() => setShowKolDir((v) => !v)} className="flex w-full items-center justify-between">
                <h3 className="flex items-center gap-2 text-sm font-black text-white"><Users className="h-4 w-4 text-emerald-300" /> KOL directory <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[9px] font-black text-white/40">{kols.length}</span></h3>
                <ChevronDown className={cn("h-4 w-4 text-white/40 transition", showKolDir && "rotate-180")} />
              </button>
              {showKolDir && (
                <div className="mt-3 space-y-3">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/25" />
                    <input value={kolSearch} onChange={(e) => setKolSearch(e.target.value)} placeholder="Search KOLs by name or address" className={cn(inputCls, "pl-8")} />
                  </div>
                  <div className="grid gap-1.5 sm:grid-cols-2">
                    {kolDir.map((k) => (
                      <div key={k.address} className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2">
                        {k.avatar ? <img src={k.avatar} alt="" className="h-7 w-7 rounded-full object-cover" /> : <div className="grid h-7 w-7 place-items-center rounded-full bg-white/[0.06] text-[10px] font-black text-white/40">{k.name.slice(0, 2).toUpperCase()}</div>}
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[12px] font-bold text-white">{k.name}</div>
                          <div className="font-mono text-[9px] text-white/25">{short(k.address)}</div>
                        </div>
                        {k.tracked ? (
                          <span className="flex items-center gap-1 text-[9px] font-black uppercase text-emerald-300"><CheckCircle2 className="h-3 w-3" /> Tracked</span>
                        ) : (
                          <button type="button" onClick={() => addWallet(k.address, k.name)} className="rounded-lg border border-emerald-400/40 bg-emerald-500/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-emerald-300 transition hover:bg-emerald-500/20">
                            + Track
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </SectionCard>
          </div>
        )}

        {/* ═══════════ LIVE FEED ═══════════ */}
        {tab === "feed" && (
          <div className="space-y-4">
            <SectionCard>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1">
                  {(["all", "buy", "sell"] as const).map((a) => (
                    <button key={a} type="button" onClick={() => setFAction(a)} className={cn("rounded-lg px-3 py-1.5 text-[10px] font-black uppercase tracking-wider transition", fAction === a ? (a === "sell" ? "bg-rose-500/20 text-rose-300" : a === "buy" ? "bg-emerald-500/20 text-emerald-300" : "bg-white/10 text-white") : "text-white/35 hover:text-white/60")}>{a}</button>
                  ))}
                </div>
                <div className="relative flex-1 min-w-[160px]">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/25" />
                  <input value={fQuery} onChange={(e) => setFQuery(e.target.value)} placeholder="Filter by token, wallet, or KOL name" className="w-full rounded-xl border border-white/10 bg-white/[0.04] py-2 pl-8 pr-3 text-[12px] text-white placeholder:text-white/20 outline-none focus:border-emerald-400/40" />
                </div>
                <div className="flex items-center gap-1.5">
                  <Filter className="h-3.5 w-3.5 text-white/25" />
                  <input type="number" min={0} step={0.1} value={fMinSol || ""} onChange={(e) => setFMinSol(Number(e.target.value) || 0)} placeholder="Min ◎" className="w-20 rounded-xl border border-white/10 bg-white/[0.04] px-2.5 py-2 text-[12px] text-white placeholder:text-white/20 outline-none focus:border-emerald-400/40" />
                </div>
                <button type="button" onClick={refreshFeed} disabled={feedBusy} className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-[10px] font-black uppercase tracking-wider text-white/50 transition hover:text-white">
                  {feedBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Refresh
                </button>
                <button type="button" onClick={() => downloadText("kol-feed.csv", tradesToCsv(filteredFeed), "text/csv")} className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-[10px] font-black uppercase tracking-wider text-white/50 transition hover:text-white">
                  <Download className="h-3.5 w-3.5" /> CSV
                </button>
              </div>
            </SectionCard>

            <SectionCard noPadding>
              {filteredFeed.length === 0 ? (
                <div className="p-4"><EmptyState icon={Activity} title="No trades yet" description="Hit Refresh, or wait for the poller to pick up activity." /></div>
              ) : (
                <div className="divide-y divide-white/[0.04]">
                  {filteredFeed.slice(0, 80).map((e) => (
                    <div key={e.signature + e.wallet} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5">
                      <span className={cn("rounded px-1.5 py-0.5 text-[8px] font-black uppercase", e.action === "buy" ? "bg-emerald-500/15 text-emerald-300" : "bg-rose-500/15 text-rose-300")}>{e.action}</span>
                      <span className="w-28 truncate text-[12px] font-bold text-white">{labelFor(e.wallet)}</span>
                      <button type="button" onClick={() => copyText(e.mint, "Mint copied")} className="font-mono text-[11px] text-white/45 hover:text-white">{short(e.mint)}</button>
                      <MintLinks mint={e.mint} />
                      <span className="ml-auto text-[11px] font-bold text-white/70">{fmtSol(e.solAmount || 0)}</span>
                      <span className="text-[10px] text-white/30">{fmtNum(e.tokenAmount || 0)} tok</span>
                      <a href={txLink(e.signature)} target="_blank" rel="noreferrer" className="text-white/25 hover:text-white"><ExternalLink className="h-3 w-3" /></a>
                      <span className="w-10 text-right text-[10px] text-white/30">{timeAgo(e.timestamp)}</span>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
          </div>
        )}

        {/* ═══════════ INTELLIGENCE ═══════════ */}
        {tab === "intel" && (
          <div className="space-y-4">
            <SectionCard>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h3 className="flex items-center gap-2 text-sm font-black text-white"><Crosshair className="h-4 w-4 text-orange-300" /> Confluence radar</h3>
                <div className="flex flex-wrap items-center gap-2">
                  <SwitchPill on={adv.confluenceEnabled} onClick={() => persistAdv({ ...adv, confluenceEnabled: !adv.confluenceEnabled })} />
                  <div className="flex items-center gap-1 text-[10px] text-white/40">
                    <input type="number" min={2} max={20} value={adv.confluenceMinWallets} onChange={(e) => persistAdv({ ...adv, confluenceMinWallets: Math.max(2, Number(e.target.value) || 2) })} className="w-14 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-center text-[11px] text-white outline-none focus:border-emerald-400/40" />
                    wallets within
                    <input type="number" min={1} max={720} value={adv.confluenceWindowMin} onChange={(e) => persistAdv({ ...adv, confluenceWindowMin: Math.max(1, Number(e.target.value) || 30) })} className="w-14 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-center text-[11px] text-white outline-none focus:border-emerald-400/40" />
                    min
                  </div>
                  <SwitchPill on={adv.confluenceTelegram} onClick={() => persistAdv({ ...adv, confluenceTelegram: !adv.confluenceTelegram })} labelOn="TG push" labelOff="TG push" />
                </div>
              </div>
              {confluence.length === 0 ? (
                <EmptyState icon={Crosshair} title="No confluence detected" description="When multiple tracked wallets buy the same token inside your window, it shows up here." />
              ) : (
                <div className="space-y-2">
                  {confluence.map((hit) => (
                    <div key={hit.mint} className="rounded-xl border border-orange-400/15 bg-orange-500/[0.04] px-3 py-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Flame className="h-4 w-4 text-orange-300" />
                          <span className="font-mono text-[12px] font-bold text-white">{short(hit.mint)}</span>
                          <button type="button" onClick={() => copyText(hit.mint, "Mint copied")} className="text-white/30 hover:text-white"><Copy className="h-3 w-3" /></button>
                          <MintLinks mint={hit.mint} />
                        </div>
                        <div className="flex items-center gap-3 text-[11px]">
                          <span className="font-black text-orange-300">{hit.wallets.length} KOLs</span>
                          <span className="text-white/50">{fmtSol(hit.totalSol)} total in</span>
                          <span className="text-white/30">window {timeAgo(hit.firstTs)} → {timeAgo(hit.lastTs)} ago</span>
                        </div>
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {hit.wallets.map((w) => (
                          <span key={w} className="rounded-full bg-white/[0.05] px-2 py-0.5 text-[9px] font-bold text-white/50">{labelFor(w)}</span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>

            <div className="grid gap-4 lg:grid-cols-2">
              <SectionCard>
                <h3 className="mb-3 flex items-center gap-2 text-sm font-black text-white"><Flame className="h-4 w-4 text-emerald-300" /> Token heat</h3>
                {tokenStats.length === 0 ? (
                  <EmptyState icon={Flame} title="No token data" description="Load the live feed first." />
                ) : (
                  <div className="space-y-1.5">
                    {tokenStats.slice(0, 12).map((t, i) => (
                      <div key={t.mint} className="flex items-center gap-2 rounded-xl border border-white/[0.05] bg-white/[0.02] px-3 py-2 text-[11px]">
                        <span className="w-5 text-center font-black text-white/25">{i + 1}</span>
                        <button type="button" onClick={() => copyText(t.mint, "Mint copied")} className="font-mono font-bold text-white hover:text-emerald-300">{short(t.mint)}</button>
                        <MintLinks mint={t.mint} />
                        <span className="ml-auto text-emerald-300/80">{t.buyers.length} buyers</span>
                        <span className="text-white/40">{t.buys}B/{t.sells}S</span>
                        <span className={cn("font-bold", t.netSol >= 0 ? "text-emerald-300" : "text-rose-300")}>{t.netSol >= 0 ? "+" : ""}{t.netSol.toFixed(1)}◎</span>
                      </div>
                    ))}
                  </div>
                )}
              </SectionCard>

              <SectionCard>
                <h3 className="mb-3 flex items-center gap-2 text-sm font-black text-white"><TrendingUp className="h-4 w-4 text-emerald-300" /> Wallet leaderboard</h3>
                {walletStats.length === 0 ? (
                  <EmptyState icon={Users} title="No wallet data" description="Load the live feed first." />
                ) : (
                  <div className="space-y-1.5">
                    {walletStats.slice(0, 12).map((s, i) => (
                      <div key={s.wallet} className="flex items-center gap-2 rounded-xl border border-white/[0.05] bg-white/[0.02] px-3 py-2 text-[11px]">
                        <span className="w-5 text-center font-black text-white/25">{i + 1}</span>
                        <span className="w-28 truncate font-bold text-white">{labelFor(s.wallet)}</span>
                        <span className="text-white/40">{s.trades} trades</span>
                        <span className="text-white/30">{s.uniqueTokens} tokens</span>
                        <span className="ml-auto text-white/50">vol {s.volume.toFixed(1)}◎</span>
                        <span className={cn("font-bold", s.netSol >= 0 ? "text-emerald-300" : "text-rose-300")}>{s.netSol >= 0 ? "+" : ""}{s.netSol.toFixed(1)}◎</span>
                      </div>
                    ))}
                  </div>
                )}
              </SectionCard>
            </div>
          </div>
        )}

        {/* ═══════════ BOT & ALERTS ═══════════ */}
        {tab === "bot" && (
          <div className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <SectionCard>
                <h3 className="mb-3 flex items-center gap-2 text-sm font-black text-white"><Bot className="h-4 w-4 text-emerald-300" /> Telegram bot</h3>
                <div className="space-y-3">
                  <Labeled label="Bot token" hint="from @BotFather — stored write-only">
                    <input type="password" value={bot.botToken} onChange={(e) => setBot({ ...bot, botToken: e.target.value })} onBlur={() => persistBot(botRef.current)} placeholder={bot.tokenSaved ? "•••••••• (saved)" : "123456:ABC-DEF…"} className={inputCls} />
                  </Labeled>
                  <div className="grid grid-cols-2 gap-3">
                    <Labeled label="Bot name">
                      <input value={bot.botName} onChange={(e) => setBot({ ...bot, botName: e.target.value })} onBlur={() => persistBot(botRef.current)} placeholder="OrbitX Alerts" className={inputCls} />
                    </Labeled>
                    <Labeled label="Bot bio">
                      <input value={bot.botBio} onChange={(e) => setBot({ ...bot, botBio: e.target.value })} onBlur={() => persistBot(botRef.current)} placeholder="KOL trade alerts" className={inputCls} />
                    </Labeled>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Labeled label="Chat ID">
                      <input value={bot.chatId} onChange={(e) => setBot({ ...bot, chatId: e.target.value })} onBlur={() => persistBot(botRef.current)} placeholder="-1001234567890" className={inputCls} />
                    </Labeled>
                    <Labeled label="Topic / thread ID" hint="optional">
                      <input value={bot.threadId} onChange={(e) => setBot({ ...bot, threadId: e.target.value })} onBlur={() => persistBot(botRef.current)} placeholder="42" className={inputCls} />
                    </Labeled>
                  </div>
                  <Labeled label="Alert image" hint="attached to every alert">
                    <div className="flex items-center gap-2">
                      <input value={bot.botImageUrl} onChange={(e) => setBot({ ...bot, botImageUrl: e.target.value })} onBlur={() => persistBot(botRef.current)} placeholder="https://… or upload" className={inputCls} />
                      <label className="grid h-10 w-10 shrink-0 cursor-pointer place-items-center rounded-xl border border-white/10 bg-white/[0.03] text-white/40 transition hover:text-white">
                        {busy === "img" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => onImageUpload(e.target.files?.[0] || null)} />
                      </label>
                    </div>
                  </Labeled>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <button type="button" onClick={fetchChatId} disabled={busy === "chatid"} className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2 text-[11px] font-black uppercase tracking-wider text-white/60 transition hover:text-white">
                      {busy === "chatid" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Satellite className="h-3.5 w-3.5" />} Detect chat
                    </button>
                    <button type="button" onClick={applyBranding} disabled={busy === "brand"} className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2 text-[11px] font-black uppercase tracking-wider text-white/60 transition hover:text-white">
                      {busy === "brand" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />} Verify & brand
                    </button>
                    <button type="button" onClick={sendTest} disabled={busy === "test"} className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-400/40 bg-emerald-500/10 px-3.5 py-2 text-[11px] font-black uppercase tracking-wider text-emerald-300 transition hover:bg-emerald-500/20">
                      {busy === "test" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} Send test
                    </button>
                  </div>
                </div>
              </SectionCard>

              <div className="space-y-4">
                <SectionCard>
                  <h3 className="mb-3 flex items-center gap-2 text-sm font-black text-white"><Moon className="h-4 w-4 text-emerald-300" /> Quiet hours & anti-spam</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] text-white/50">Pause Telegram + browser alerts overnight</span>
                      <SwitchPill on={adv.quietEnabled} onClick={() => persistAdv({ ...adv, quietEnabled: !adv.quietEnabled })} />
                    </div>
                    {adv.quietEnabled && (
                      <div className="grid grid-cols-2 gap-3">
                        <Labeled label="Quiet from">
                          <input type="time" value={adv.quietStart} onChange={(e) => persistAdv({ ...adv, quietStart: e.target.value })} className={inputCls} />
                        </Labeled>
                        <Labeled label="Until">
                          <input type="time" value={adv.quietEnd} onChange={(e) => persistAdv({ ...adv, quietEnd: e.target.value })} className={inputCls} />
                        </Labeled>
                      </div>
                    )}
                    <Labeled label="Per-wallet cooldown" hint="seconds between alerts from the same wallet, 0 = off">
                      <input type="number" min={0} value={adv.alertCooldownSec} onChange={(e) => persistAdv({ ...adv, alertCooldownSec: Math.max(0, Number(e.target.value) || 0) })} className={inputCls} />
                    </Labeled>
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] text-white/50">Alert sound in browser</span>
                      <SwitchPill on={adv.soundOn} onClick={() => { if (!adv.soundOn) playAlertSound(); persistAdv({ ...adv, soundOn: !adv.soundOn }); }} />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] text-white/50">Desktop notifications</span>
                      <SwitchPill on={adv.desktopNotifs} onClick={toggleDesktopNotifs} />
                    </div>
                  </div>
                </SectionCard>

                <SectionCard>
                  <h3 className="mb-3 flex items-center gap-2 text-sm font-black text-white"><Rocket className="h-4 w-4 text-emerald-300" /> Launch digest</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] text-white/50">Auto-post fresh survivor launches</span>
                      <SwitchPill on={bot.digestEnabled} onClick={() => persistBot({ ...bot, digestEnabled: !bot.digestEnabled })} />
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <Labeled label="Min age" hint="h">
                        <input type="number" min={0} value={bot.digestMinAge} onChange={(e) => setBot({ ...bot, digestMinAge: Number(e.target.value) || 0 })} onBlur={() => persistBot(botRef.current)} className={inputCls} />
                      </Labeled>
                      <Labeled label="Max age" hint="h">
                        <input type="number" min={1} value={bot.digestMaxAge} onChange={(e) => setBot({ ...bot, digestMaxAge: Number(e.target.value) || 10 })} onBlur={() => persistBot(botRef.current)} className={inputCls} />
                      </Labeled>
                      <Labeled label="Every" hint="h">
                        <input type="number" min={1} value={bot.digestIntervalHours} onChange={(e) => setBot({ ...bot, digestIntervalHours: Number(e.target.value) || 6 })} onBlur={() => persistBot(botRef.current)} className={inputCls} />
                      </Labeled>
                    </div>
                    <button type="button" onClick={sendDigestNow} disabled={busy === "digest"} className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2 text-[11px] font-black uppercase tracking-wider text-white/60 transition hover:text-white">
                      {busy === "digest" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} Send digest now
                    </button>
                  </div>
                </SectionCard>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════ HISTORY ═══════════ */}
        {tab === "history" && (
          <div className="space-y-4">
            <SectionCard>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1">
                  {(["all", "sent", "failed"] as const).map((s) => (
                    <button key={s} type="button" onClick={() => setHStatus(s)} className={cn("rounded-lg px-3 py-1.5 text-[10px] font-black uppercase tracking-wider transition", hStatus === s ? (s === "failed" ? "bg-rose-500/20 text-rose-300" : s === "sent" ? "bg-emerald-500/20 text-emerald-300" : "bg-white/10 text-white") : "text-white/35 hover:text-white/60")}>{s}</button>
                  ))}
                </div>
                <div className="flex items-center gap-3 text-[11px] text-white/40">
                  <span><b className="text-emerald-300">{alerts.filter((a) => a.status === "sent").length}</b> sent</span>
                  <span><b className="text-rose-300">{alerts.filter((a) => a.status === "failed").length}</b> failed</span>
                  <button type="button" onClick={() => downloadText("kol-alerts.csv", alertsToCsv(filteredAlerts), "text/csv")} className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-white/50 transition hover:text-white">
                    <Download className="h-3 w-3" /> CSV
                  </button>
                </div>
              </div>
            </SectionCard>

            <SectionCard noPadding>
              {filteredAlerts.length === 0 ? (
                <div className="p-4"><EmptyState icon={History} title="No alerts in history" description="Fired alerts appear here with their delivery status." /></div>
              ) : (
                <div className="divide-y divide-white/[0.04]">
                  {filteredAlerts.slice(0, 100).map((a) => (
                    <div key={a.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-[11px]">
                      <span className={cn("rounded px-1.5 py-0.5 text-[8px] font-black uppercase", a.action === "buy" ? "bg-emerald-500/15 text-emerald-300" : "bg-rose-500/15 text-rose-300")}>{a.action}</span>
                      <span className="w-28 truncate font-bold text-white">{labelFor(a.wallet)}</span>
                      <button type="button" onClick={() => copyText(a.tokenMint, "Mint copied")} className="font-mono text-white/45 hover:text-white">{short(a.tokenMint)}</button>
                      <MintLinks mint={a.tokenMint} />
                      <span className="ml-auto font-bold text-white/60">{fmtSol(a.solAmount || 0)}</span>
                      <span className={cn("rounded-full px-2 py-0.5 text-[8px] font-black uppercase", a.status === "sent" ? "bg-emerald-500/10 text-emerald-300" : "bg-rose-500/10 text-rose-300")}>{a.status}</span>
                      <span className="w-14 text-right text-white/30">{timeAgo(Math.floor(a.at / 1000))} ago</span>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
          </div>
        )}
      </div>
      <BottomNav />
    </div>
  );
}

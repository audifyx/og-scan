/**
 * KOL Tracker — Hub app.
 * Track all KOLs, a single wallet, or a custom multi-wallet watchlist and
 * fire Telegram alerts (topic-aware) on every buy/sell. Includes a branded
 * bot setup flow, Helius webhook sync, live trade feed, alert history and
 * a "new launches" digest (5-10h survivors).
 * Visuals reuse the Scanner shell (EmeraldHeader / SectionCard / SegmentedTabs).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity, ArrowLeft, BellRing, Bot, CheckCircle2, ExternalLink, Loader2,
  Pause, Play, Plus, Radar, RefreshCw, Rocket, Satellite, Send, Trash2, Users, Wallet,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { EmeraldHeader, SectionCard, SegmentedTabs, EmptyState, LoadingState } from "@/components/ToolPageShell";
import { BottomNav } from "@/components/layout/BottomNav";
import {
  AlertEntry, BotState, KolListEntry, TrackedWallet, TrackerMode, TrackerState, TradeEvent,
  appendAlert, defaultBot, defaultTracker, fetchKolList, fetchWalletTrades, getLastSigMap,
  isValidSolAddress, loadAlerts, loadBot, loadTracker, saveBot, saveTracker, setLastSig, uploadBotImage,
} from "@/lib/kol-tracker";

/* ── tiny UI helpers ── */
const short = (a: string) => (a.length > 12 ? `${a.slice(0, 4)}…${a.slice(-4)}` : a);
const fmtNum = (n: number) => (n >= 1_000_000 ? (n / 1_000_000).toFixed(2) + "M" : n >= 1_000 ? (n / 1_000).toFixed(2) + "K" : n.toLocaleString("en-US", { maximumFractionDigits: 4 }));
const fmtUsdShort = (n: number | null) => (n == null ? "?" : n >= 1_000_000 ? "$" + (n / 1_000_000).toFixed(2) + "M" : n >= 1_000 ? "$" + (n / 1_000).toFixed(1) + "K" : "$" + n.toFixed(2));
const timeAgo = (ts: number) => {
  const s = Math.max(1, Math.floor(Date.now() / 1000 - ts));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
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

export default function KOLTracker() {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [tracker, setTracker] = useState<TrackerState>(defaultTracker());
  const [bot, setBot] = useState<BotState>(defaultBot());
  const [alerts, setAlerts] = useState<AlertEntry[]>([]);
  const [kols, setKols] = useState<KolListEntry[]>([]);
  const [feed, setFeed] = useState<TradeEvent[]>([]);
  const [launches, setLaunches] = useState<any[]>([]);
  const [webhook, setWebhook] = useState<{ url?: string; addressCount?: number } | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [feedBusy, setFeedBusy] = useState(false);
  const [busy, setBusy] = useState<string>("");

  const [addAddr, setAddAddr] = useState("");
  const [addLabel, setAddLabel] = useState("");

  const trackerRef = useRef(tracker);
  trackerRef.current = tracker;
  const botRef = useRef(bot);
  botRef.current = bot;

  /* ── initial load ── */
  useEffect(() => {
    let alive = true;
    (async () => {
      const [t, b] = await Promise.all([loadTracker(userId), loadBot(userId)]);
      if (!alive) return;
      setTracker(t);
      setBot(b);
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

  /* ── wallets being watched, by mode ── */
  const watchTargets = useMemo(() => {
    if (tracker.mode === "specific_wallet") {
      return isValidSolAddress(tracker.walletAddress) ? [{ address: tracker.walletAddress.trim(), label: "Watched wallet" }] : [];
    }
    if (tracker.mode === "all_kols") return kols.slice(0, 30).map((k) => ({ address: k.address, label: k.name }));
    return tracker.wallets.filter((w) => w.isActive).map((w) => ({ address: w.address, label: w.label || short(w.address) }));
  }, [tracker.mode, tracker.walletAddress, tracker.wallets, kols]);

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

  /* ── client-side poller (works even before the Helius webhook path is live) ── */
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
          if (!known) continue; // first sight: baseline only, no alert spam
          const fresh: TradeEvent[] = [];
          for (const ev of events) {
            if (ev.signature === known) break;
            fresh.push(ev);
          }
          if (!fresh.length) continue;

          const t = trackerRef.current;
          for (const ev of fresh.reverse()) {
            if (ev.action === "buy" && !t.alertOnBuy) continue;
            if (ev.action === "sell" && !t.alertOnSell) continue;
            if (t.minSolAmount > 0 && ev.solAmount < t.minSolAmount) continue;
            let ok = false;
            if (botReady) ok = await dispatchAlert(ev, target.label).catch(() => false);
            setAlerts(appendAlert({
              id: `${ev.signature}-${ev.wallet}`, at: Date.now(), wallet: ev.wallet, action: ev.action,
              tokenMint: ev.mint, amount: ev.tokenAmount, solAmount: ev.solAmount, signature: ev.signature,
              status: ok ? "sent" : "failed",
            }));
          }
          // update last activity on the watchlist row
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
            return merged.sort((a, b) => b.timestamp - a.timestamp).slice(0, 50);
          });
        }
      } finally {
        polling.current = false;
      }
    };

    const iv = setInterval(tick, secs * 1000);
    tick();
    return () => clearInterval(iv);
  }, [loaded, tracker.isActive, tracker.pollSeconds, watchTargets, botReady, dispatchAlert, userId]);

  /* ── actions ── */
  const addWallet = () => {
    const addr = addAddr.trim();
    if (!isValidSolAddress(addr)) {
      toast({ title: "Invalid address", description: "That does not look like a Solana wallet address." });
      return;
    }
    if (tracker.wallets.some((w) => w.address === addr)) {
      toast({ title: "Already tracked", description: short(addr) + " is already on your watchlist." });
      return;
    }
    const w: TrackedWallet = { id: `local-${Date.now()}`, address: addr, label: addLabel.trim(), isActive: true, lastActivityAt: null };
    persistTracker({ ...tracker, mode: "custom_list", wallets: [...tracker.wallets, w] });
    setAddAddr("");
    setAddLabel("");
    toast({ title: "Wallet added", description: `${short(addr)} is now tracked.` });
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
      const targets = watchTargets.slice(0, 6);
      const results = await Promise.all(targets.map((t) => fetchWalletTrades(t.address, 15).catch(() => [] as TradeEvent[])));
      const merged = results.flat().sort((a, b) => b.timestamp - a.timestamp).slice(0, 50);
      setFeed(merged);
    } finally {
      setFeedBusy(false);
    }
  };

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

  const alerts24h = alerts.filter((a) => Date.now() - a.at < 86_400_000).length;

  if (!loaded) {
    return (
      <div className="min-h-screen bg-background px-4 py-6">
        <LoadingState text="Loading KOL Tracker" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-28">
      <div className="mx-auto w-full max-w-5xl px-4 py-5 space-y-4">
        <Link to="/app" className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-white/30 transition hover:text-white/60">
          <ArrowLeft className="h-3.5 w-3.5" /> Hub
        </Link>

        <EmeraldHeader
          icon={Radar}
          title="KOL Tracker"
          subtitle="Track every KOL, one wallet, or your own watchlist. Instant Telegram alerts on every buy and sell, with your own branded bot."
          badge={tracker.isActive ? "LIVE" : "PAUSED"}
          right={
            <button
              type="button"
              onClick={() => persistTracker({ ...tracker, isActive: !tracker.isActive })}
              className={cn(
                "inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-black uppercase tracking-wider transition",
                tracker.isActive
                  ? "border-red-400/40 bg-red-500/10 text-red-300 hover:bg-red-500/20"
                  : "border-emerald-400/50 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25",
              )}
            >
              {tracker.isActive ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              {tracker.isActive ? "Pause" : "Start tracking"}
            </button>
          }
        />

        {/* stats */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { label: "Watching", value: String(watchTargets.length), Icon: Wallet },
            { label: "Alerts 24h", value: String(alerts24h), Icon: BellRing },
            { label: "Bot", value: botReady ? (bot.botUsername ? "@" + bot.botUsername : "Ready") : "Not set", Icon: Bot },
            { label: "Webhook", value: webhook ? `${webhook.addressCount ?? 0} addrs` : "Off", Icon: Satellite },
          ].map(({ label, value, Icon }) => (
            <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
              <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-white/30">
                <Icon className="h-3 w-3" /> {label}
              </div>
              <div className="mt-1 truncate text-sm font-black text-white">{value}</div>
            </div>
          ))}
        </div>

        {/* mode */}
        <SectionCard>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-xs font-black uppercase tracking-widest text-white/50">Tracking mode</h3>
            <div className="flex items-center gap-2">
              <SwitchPill on={tracker.alertOnBuy} onClick={() => persistTracker({ ...tracker, alertOnBuy: !tracker.alertOnBuy })} labelOn="Buys" labelOff="Buys" />
              <SwitchPill on={tracker.alertOnSell} onClick={() => persistTracker({ ...tracker, alertOnSell: !tracker.alertOnSell })} labelOn="Sells" labelOff="Sells" />
            </div>
          </div>

          <SegmentedTabs<TrackerMode>
            tabs={[
              { id: "custom_list", label: "My Watchlist", Icon: Wallet },
              { id: "all_kols", label: `All KOLs (${kols.length})`, Icon: Users },
              { id: "specific_wallet", label: "Single Wallet", Icon: Activity },
            ]}
            active={tracker.mode}
            onChange={(m) => persistTracker({ ...tracker, mode: m })}
          />

          <div className="mt-4">
            {tracker.mode === "custom_list" && (
              <div className="space-y-3">
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input className={cn(inputCls, "sm:flex-[2]")} placeholder="Solana wallet address" value={addAddr} onChange={(e) => setAddAddr(e.target.value)} />
                  <input className={cn(inputCls, "sm:flex-1")} placeholder="Label (optional)" value={addLabel} onChange={(e) => setAddLabel(e.target.value)} />
                  <button type="button" onClick={addWallet} className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-emerald-400/50 bg-emerald-500/15 px-4 py-2.5 text-xs font-black uppercase tracking-wider text-emerald-300 transition hover:bg-emerald-500/25">
                    <Plus className="h-4 w-4" /> Track
                  </button>
                </div>
                {addAddr && !isValidSolAddress(addAddr) && (
                  <p className="text-[10px] font-bold text-red-400">Not a valid Solana address.</p>
                )}
                {tracker.wallets.length === 0 ? (
                  <EmptyState icon={Wallet} title="No wallets yet" description="Paste any Solana wallet above to start tracking it. Add as many as you want." />
                ) : (
                  <div className="divide-y divide-white/5 rounded-xl border border-white/10">
                    {tracker.wallets.map((w) => (
                      <div key={w.address} className="flex items-center gap-3 px-3 py-2.5">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-sm font-bold text-white">{w.label || short(w.address)}</span>
                            {w.label && <span className="text-[10px] text-white/30">{short(w.address)}</span>}
                          </div>
                          <div className="text-[10px] text-white/25">
                            {w.lastActivityAt ? `Last activity ${timeAgo(new Date(w.lastActivityAt).getTime() / 1000)} ago` : "No activity seen yet"}
                          </div>
                        </div>
                        <a href={`https://solscan.io/account/${w.address}`} target="_blank" rel="noreferrer" className="text-white/25 transition hover:text-white/60">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                        <SwitchPill on={w.isActive} onClick={() => toggleWallet(w.address)} labelOn="Active" labelOff="Paused" />
                        <button type="button" onClick={() => removeWallet(w.address)} className="text-white/25 transition hover:text-red-400">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {tracker.mode === "all_kols" && (
              <div className="space-y-3">
                <p className="text-[11px] leading-relaxed text-white/40">
                  Tracks the full OrbitX KOL directory ({kols.length} wallets). Client polling covers the 30 most recently listed; sync the Helius webhook below for full real-time coverage.
                </p>
                <div className="grid gap-1.5 sm:grid-cols-2">
                  {kols.slice(0, 12).map((k) => (
                    <div key={k.address} className="flex items-center gap-2 rounded-lg border border-white/5 bg-white/[0.02] px-2.5 py-1.5">
                      {k.avatar ? <img src={k.avatar} alt="" className="h-5 w-5 rounded-full object-cover" /> : <div className="h-5 w-5 rounded-full bg-white/10" />}
                      <span className="truncate text-xs font-bold text-white">{k.name}</span>
                      <span className="ml-auto text-[10px] text-white/25">{short(k.address)}</span>
                    </div>
                  ))}
                </div>
                {kols.length > 12 && <p className="text-[10px] text-white/25">+ {kols.length - 12} more from the KOL directory</p>}
              </div>
            )}

            {tracker.mode === "specific_wallet" && (
              <div className="space-y-2">
                <Labeled label="Wallet address" hint="Solana base58">
                  <input className={inputCls} placeholder="Paste the wallet to watch" value={tracker.walletAddress} onChange={(e) => setTracker({ ...tracker, walletAddress: e.target.value })} onBlur={() => persistTracker(trackerRef.current)} />
                </Labeled>
                {tracker.walletAddress && !isValidSolAddress(tracker.walletAddress) && (
                  <p className="text-[10px] font-bold text-red-400">Not a valid Solana address.</p>
                )}
              </div>
            )}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Labeled label="Min trade size" hint="SOL">
              <input type="number" min={0} step={0.1} className={inputCls} value={tracker.minSolAmount} onChange={(e) => setTracker({ ...tracker, minSolAmount: Math.max(0, Number(e.target.value) || 0) })} onBlur={() => persistTracker(trackerRef.current)} />
            </Labeled>
            <Labeled label="Poll every" hint="seconds">
              <input type="number" min={15} step={5} className={inputCls} value={tracker.pollSeconds} onChange={(e) => setTracker({ ...tracker, pollSeconds: Math.max(15, Number(e.target.value) || 30) })} onBlur={() => persistTracker(trackerRef.current)} />
            </Labeled>
            <div className="col-span-2 sm:col-span-1 flex items-end">
              <button type="button" onClick={syncWebhook} disabled={busy === "webhook"} className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-[11px] font-black uppercase tracking-wider text-white/60 transition hover:bg-white/[0.08] disabled:opacity-50">
                {busy === "webhook" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Satellite className="h-3.5 w-3.5" />}
                Sync Helius webhook
              </button>
            </div>
          </div>
        </SectionCard>

        {/* telegram bot */}
        <SectionCard>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-white/50">
              <Bot className="h-3.5 w-3.5" /> Alert bot
              {botReady && <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/40 bg-emerald-500/15 px-2 py-0.5 text-[9px] font-black text-emerald-300"><CheckCircle2 className="h-3 w-3" /> READY</span>}
            </h3>
            <button type="button" onClick={sendTest} disabled={busy === "test"} className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-white/60 transition hover:bg-white/[0.08] disabled:opacity-50">
              {busy === "test" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />} Test alert
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Labeled label="Bot token" hint="from @BotFather — stored write-only">
              <input type="password" autoComplete="off" className={inputCls} placeholder={bot.tokenSaved ? "Token saved. Paste to replace." : "123456789:ABC…"} value={bot.botToken} onChange={(e) => setBot({ ...bot, botToken: e.target.value.trim() })} onBlur={() => persistBot(botRef.current)} />
            </Labeled>
            <Labeled label="Bot name">
              <input className={inputCls} placeholder="OrbitX Alpha Alerts" value={bot.botName} onChange={(e) => setBot({ ...bot, botName: e.target.value })} onBlur={() => persistBot(botRef.current)} />
            </Labeled>
            <div className="sm:col-span-2">
              <Labeled label="Bot bio">
                <textarea rows={2} className={cn(inputCls, "resize-none")} placeholder="Real-time KOL buys and sells, curated by OrbitX." value={bot.botBio} onChange={(e) => setBot({ ...bot, botBio: e.target.value })} onBlur={() => persistBot(botRef.current)} />
              </Labeled>
            </div>
            <Labeled label="Alert image" hint="attached to every alert">
              <div className="flex gap-2">
                <input className={inputCls} placeholder="https://… or upload →" value={bot.botImageUrl} onChange={(e) => setBot({ ...bot, botImageUrl: e.target.value })} onBlur={() => persistBot(botRef.current)} />
                <label className="inline-flex cursor-pointer items-center rounded-xl border border-white/10 bg-white/[0.04] px-3 text-[10px] font-black uppercase tracking-wider text-white/50 transition hover:bg-white/[0.08]">
                  {busy === "img" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Upload"}
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => onImageUpload(e.target.files?.[0] || null)} />
                </label>
              </div>
            </Labeled>
            <Labeled label="Chat ID" hint="message your bot once, then fetch">
              <div className="flex gap-2">
                <input className={inputCls} placeholder="-1001234567890" value={bot.chatId} onChange={(e) => setBot({ ...bot, chatId: e.target.value.trim() })} onBlur={() => persistBot(botRef.current)} />
                <button type="button" onClick={fetchChatId} disabled={busy === "chatid"} className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-emerald-400/40 bg-emerald-500/10 px-3 text-[10px] font-black uppercase tracking-wider text-emerald-300 transition hover:bg-emerald-500/20 disabled:opacity-50">
                  {busy === "chatid" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Fetch"}
                </button>
              </div>
            </Labeled>
            <Labeled label="Topic ID" hint="keeps alerts inside one forum topic">
              <input className={inputCls} placeholder="Optional — e.g. 42" value={bot.threadId} onChange={(e) => setBot({ ...bot, threadId: e.target.value.trim() })} onBlur={() => persistBot(botRef.current)} />
            </Labeled>
            <div className="flex items-end">
              <button type="button" onClick={applyBranding} disabled={busy === "brand"} className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-emerald-400/50 bg-emerald-500/15 px-4 py-2.5 text-xs font-black uppercase tracking-wider text-emerald-300 transition hover:bg-emerald-500/25 disabled:opacity-50">
                {busy === "brand" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Verify token + apply branding
              </button>
            </div>
          </div>
          <p className="mt-3 text-[10px] leading-relaxed text-white/25">
            Send your bot one message in the target group/topic, then hit Fetch. If the group uses Topics, the topic is auto-detected so alerts never stain other topics. Profile photo has to be set once in @BotFather (/setuserpic); your image rides along on every alert instead.
          </p>
        </SectionCard>

        {/* launch digest */}
        <SectionCard>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-white/50">
              <Rocket className="h-3.5 w-3.5" /> New launch digest
            </h3>
            <div className="flex items-center gap-2">
              <SwitchPill on={bot.digestEnabled} onClick={() => persistBot({ ...bot, digestEnabled: !bot.digestEnabled })} labelOn="Scheduled" labelOff="Off" />
              <button type="button" onClick={sendDigestNow} disabled={busy === "digest"} className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-white/60 transition hover:bg-white/[0.08] disabled:opacity-50">
                {busy === "digest" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />} Send now
              </button>
            </div>
          </div>
          <p className="mb-3 text-[11px] leading-relaxed text-white/40">
            Your bot posts new token launches that survived their first hours — old enough to dodge instant rugs, young enough to be early.
          </p>
          <div className="grid grid-cols-3 gap-3">
            <Labeled label="Min age" hint="hours">
              <input type="number" min={1} className={inputCls} value={bot.digestMinAge} onChange={(e) => setBot({ ...bot, digestMinAge: Math.max(1, Number(e.target.value) || 5) })} onBlur={() => persistBot(botRef.current)} />
            </Labeled>
            <Labeled label="Max age" hint="hours">
              <input type="number" min={2} className={inputCls} value={bot.digestMaxAge} onChange={(e) => setBot({ ...bot, digestMaxAge: Math.max(bot.digestMinAge + 1, Number(e.target.value) || 10) })} onBlur={() => persistBot(botRef.current)} />
            </Labeled>
            <Labeled label="Every" hint="hours">
              <input type="number" min={1} max={24} className={inputCls} value={bot.digestIntervalHours} onChange={(e) => setBot({ ...bot, digestIntervalHours: Math.min(24, Math.max(1, Number(e.target.value) || 6)) })} onBlur={() => persistBot(botRef.current)} />
            </Labeled>
          </div>
          {launches.length > 0 && (
            <div className="mt-3 divide-y divide-white/5 rounded-xl border border-white/10">
              {launches.slice(0, 5).map((l) => (
                <div key={l.poolAddress} className="flex items-center gap-3 px-3 py-2">
                  <span className="text-xs font-black text-white">{l.symbol}</span>
                  <span className="text-[10px] text-white/30">{l.ageHours != null ? `${Number(l.ageHours).toFixed(1)}h old` : ""}{l.dex ? ` · ${l.dex}` : ""}</span>
                  <span className="ml-auto text-[10px] font-bold text-white/50">FDV {fmtUsdShort(l.fdvUsd)}</span>
                  <span className="text-[10px] font-bold text-white/50">Vol {fmtUsdShort(l.volume24h)}</span>
                  {l.mint && (
                    <a href={`https://dexscreener.com/solana/${l.mint}`} target="_blank" rel="noreferrer" className="text-white/25 transition hover:text-white/60">
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        {/* live feed */}
        <SectionCard>
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-white/50">
              <Activity className="h-3.5 w-3.5" /> Live trades
            </h3>
            <button type="button" onClick={refreshFeed} disabled={feedBusy} className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-white/60 transition hover:bg-white/[0.08] disabled:opacity-50">
              <RefreshCw className={cn("h-3 w-3", feedBusy && "animate-spin")} /> Refresh
            </button>
          </div>
          {feed.length === 0 ? (
            <EmptyState icon={Activity} title="No trades loaded" description="Hit Refresh to pull the latest swaps from your tracked wallets, or start tracking to stream them in." />
          ) : (
            <div className="divide-y divide-white/5 rounded-xl border border-white/10">
              {feed.map((ev) => (
                <div key={ev.signature + ev.wallet} className="flex items-center gap-3 px-3 py-2">
                  <span className={cn("rounded-md px-1.5 py-0.5 text-[9px] font-black uppercase", ev.action === "buy" ? "bg-emerald-500/15 text-emerald-300" : "bg-red-500/15 text-red-300")}>
                    {ev.action}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-bold text-white">{fmtNum(ev.tokenAmount)} · {short(ev.mint)}</div>
                    <div className="text-[10px] text-white/25">{short(ev.wallet)} · {ev.source || "swap"}</div>
                  </div>
                  <span className="text-[10px] font-bold text-white/50">{ev.solAmount > 0 ? `${fmtNum(ev.solAmount)} SOL` : ""}</span>
                  <span className="text-[10px] text-white/25">{timeAgo(ev.timestamp)}</span>
                  <a href={`https://solscan.io/tx/${ev.signature}`} target="_blank" rel="noreferrer" className="text-white/25 transition hover:text-white/60">
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        {/* alert history */}
        <SectionCard>
          <h3 className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-white/50">
            <BellRing className="h-3.5 w-3.5" /> Alert history
          </h3>
          {alerts.length === 0 ? (
            <EmptyState icon={BellRing} title="No alerts yet" description="Once tracking is live and your bot is set up, every dispatched alert lands here." />
          ) : (
            <div className="divide-y divide-white/5 rounded-xl border border-white/10">
              {alerts.slice(0, 25).map((a) => (
                <div key={a.id} className="flex items-center gap-3 px-3 py-2">
                  <span className={cn("rounded-md px-1.5 py-0.5 text-[9px] font-black uppercase", a.action === "buy" ? "bg-emerald-500/15 text-emerald-300" : "bg-red-500/15 text-red-300")}>{a.action}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-bold text-white">{fmtNum(a.amount)} · {short(a.tokenMint)}</div>
                    <div className="text-[10px] text-white/25">{short(a.wallet)}</div>
                  </div>
                  <span className={cn("text-[9px] font-black uppercase", a.status === "sent" ? "text-emerald-300" : "text-red-400")}>{a.status}</span>
                  <span className="text-[10px] text-white/25">{timeAgo(a.at / 1000)}</span>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>
      <BottomNav />
    </div>
  );
}

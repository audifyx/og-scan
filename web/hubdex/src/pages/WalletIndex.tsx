import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  Search, Wallet, Star, ArrowRight, TrendingUp, Bell, Copy, Users,
  Crosshair, Activity, BarChart3, History, Zap, ExternalLink,
} from "lucide-react";
import { getWatchlist, short, fmtUsd } from "../lib/api";
import { useWallet } from "../lib/wallet";
import { CommandHero, StatDeck, QuickToolGrid } from "../components/DexAdvanced";

const isAddr = (v: string) => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(v.trim());

const RECENT_KEY = "ogdex.wallet.recent";

function loadRecent(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    return raw ? (JSON.parse(raw) as string[]).filter(isAddr).slice(0, 8) : [];
  } catch { return []; }
}

function pushRecent(addr: string) {
  try {
    const next = [addr, ...loadRecent().filter((a) => a !== addr)].slice(0, 8);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch { /* noop */ }
}

export default function WalletIndex() {
  const [q, setQ] = useState("");
  const [recent, setRecent] = useState<string[]>([]);
  const nav = useNavigate();
  const { address, connect, connecting } = useWallet();
  const watched = getWatchlist();

  useEffect(() => { setRecent(loadRecent()); }, []);

  const go = (addr: string) => {
    const v = addr.trim();
    if (!isAddr(v)) return;
    pushRecent(v);
    setRecent(loadRecent());
    nav(`/wallet/${v}`);
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    go(q);
  };

  return (
    <div className="mx-auto max-w-4xl space-y-2">
      <CommandHero
        kicker="Portfolio intelligence"
        title="Wallets"
        sub="Look up any Solana wallet — holdings, PnL, trade history, alerts, and copy-tracking."
        icon={Wallet}
        actions={
          address ? (
            <button type="button" onClick={() => go(address)} className="dex-btn dex-btn--blue !text-xs">
              My wallet
            </button>
          ) : (
            <button type="button" onClick={() => connect()} disabled={connecting} className="dex-btn dex-btn--ghost !text-xs">
              {connecting ? "Connecting…" : "Connect wallet"}
            </button>
          )
        }
      />

      <StatDeck items={[
        { label: "WATCHED", value: watched.length, sub: "saved wallets", tone: "gold" },
        { label: "RECENT", value: recent.length, sub: "lookups", tone: "blue" },
        { label: "CHAIN", value: "SOL", sub: "mainnet", tone: "plain" },
        { label: "PNL", value: "Live", sub: "realized + unrealized", tone: "up" },
      ]} />

      <form onSubmit={onSubmit} className="relative mb-4">
        <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Paste any Solana wallet address…"
          className="inp !pl-11 !pr-32 !py-3.5 !text-base w-full"
          autoFocus
        />
        <button type="submit" className="dex-btn dex-btn--blue absolute right-2 top-1/2 -translate-y-1/2 !py-2 !px-5 !text-xs font-bold">
          Analyze
        </button>
      </form>

      <QuickToolGrid links={[
        { to: "/copy-trade", label: "Copy tracking", desc: "Follow smart wallets", Icon: Users },
        { to: "/kol", label: "KOL feed", desc: "Live smart-money tape", Icon: TrendingUp },
        { to: "/alerts", label: "Trade alerts", desc: "Notify on wallet activity", Icon: Bell },
        { to: "/scanner", label: "Token scanner", desc: "Forensic OG scan", Icon: Crosshair },
        { to: "/pulse", label: "Pulse", desc: "Market signals", Icon: Activity },
        { to: "/tools?tab=wallet", label: "Wallet profiler", desc: "Quick holdings scan", Icon: BarChart3 },
      ]} />

      {(watched.length > 0 || recent.length > 0) && (
        <div className="grid gap-4 sm:grid-cols-2">
          {watched.length > 0 && (
            <WalletList title="Watched" icon={Star} items={watched} onOpen={go} accent="gold" />
          )}
          {recent.length > 0 && (
            <WalletList title="Recent lookups" icon={History} items={recent} onOpen={go} accent="blue" />
          )}
        </div>
      )}

      <div className="rounded-xl border border-line bg-panel/40 p-4">
        <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
          <Zap className="h-4 w-4 text-accent" /> What you get per wallet
        </h3>
        <ul className="grid sm:grid-cols-2 gap-x-6 gap-y-1.5 text-[13px] text-muted">
          <li>· Full token holdings + USD values</li>
          <li>· Realized & unrealized PnL</li>
          <li>· Recent swap history (25 txs)</li>
          <li>· Watchlist + trade alerts</li>
          <li>· Shareable PnL card</li>
          <li>· One-click Solscan link</li>
        </ul>
      </div>
    </div>
  );
}

function WalletList({ title, icon: Icon, items, onOpen, accent }: {
  title: string; icon: typeof Star; items: string[]; onOpen: (a: string) => void; accent: "gold" | "blue";
}) {
  return (
    <div className="rounded-xl border border-line bg-panel/60 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Icon className={`h-4 w-4 ${accent === "gold" ? "text-[var(--ox-gold-hi)]" : "text-[var(--ox-blue-hi)]"}`} />
        <h2 className="font-display font-bold text-sm">{title}</h2>
      </div>
      <ul className="space-y-1.5">
        {items.map((w) => (
          <li key={w}>
            <button type="button" onClick={() => onOpen(w)} className="flex w-full items-center justify-between rounded-lg border border-line/60 px-3 py-2.5 font-mono text-[12px] hover:bg-white/[0.04] hover:border-accent/30 transition-colors text-left">
              <span className="truncate">{short(w, 8)}</span>
              <ArrowRight className="w-3.5 h-3.5 text-muted shrink-0 ml-2" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * TokenResearch — Full intelligence report on any Solana token.
 * Paste a CA to get social mentions (X/Twitter, Reddit), on-chain data
 * (top 100 traders by PnL, holders, bundles), clone detection, launch info.
 */
import React, { useState, useCallback, useRef } from "react";
import {
  Search, Loader2, ExternalLink, Copy, Check, ChevronDown, ChevronUp,
  Twitter, Globe, MessageCircle, TrendingUp, TrendingDown, Users,
  Wallet, BarChart3, Flame, Shield, AlertTriangle, Radio, Star,
  ArrowUpRight, ArrowDownRight, Hash, Clock, MessageSquare,
  Layers, Zap, Target, RefreshCw, Link2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

import { apiUrl } from "@/lib/apiBase";
// ── Types ─────────────────────────────────────────────────────────────────────

interface TokenMeta {
  name: string; symbol: string; image: string;
  price: number; priceChange24h: number; mcap: number;
  volume24h: number; liquidity: number; totalHolders: number; fdv: number;
  description: string;
  links: { website: string; twitter: string; telegram: string; dex: string; birdeye: string; solscan: string };
}

interface LaunchInfo {
  deployer: string | null; platform: string; launchTime: number;
  graduated: boolean; king: string | null; replies: number; description: string;
}

interface TwitterPost { text: string; user: string; displayName: string; url: string; time: number; }
interface TwitterUser { user: string; count: number; posts: TwitterPost[]; }
interface RedditPost {
  id: string; title: string; author: string; subreddit: string;
  score: number; comments: number; url: string; text: string; time: number;
}
interface Clone {
  mint: string; name: string; symbol: string; mcap: number;
  volume24h: number; liquidity: number; launchTime: number; dexUrl: string; price: number;
}
interface Holder { rank: number; address: string; amount: number; percent: string; }
interface Trader {
  rank: number; wallet: string; pnl: number; volume: number;
  trades: number; winRate: number | null; tags: string[];
}

interface ResearchResult {
  ok: boolean; ca: string; meta: TokenMeta; launch: LaunchInfo;
  social: { twitter: { posts: TwitterPost[]; byUser: TwitterUser[]; total: number };
             reddit:  { posts: RedditPost[]; total: number } };
  clones: Clone[];
  onchain: { holders: Holder[]; topTraders: Trader[] };
  error?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const API_BASE = apiUrl("/api/ogdex");

const fmtNum = (n: number): string => {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
};

const fmtPnl = (n: number): string => {
  const abs = Math.abs(n);
  const s = n >= 0 ? "+" : "-";
  if (abs >= 1e6) return `${s}$${(abs / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${s}$${(abs / 1e3).toFixed(1)}K`;
  return `${s}$${abs.toFixed(2)}`;
};

const fmtTime = (ms: number): string => {
  if (!ms) return "—";
  const now = Date.now();
  const diff = now - ms;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
};

const shortAddr = (s: string, n = 4) =>
  s && s.length > 10 ? `${s.slice(0, n)}…${s.slice(-n)}` : s;

function CopyBtn({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500); toast.success("Copied!"); }}
      className="flex h-6 w-6 items-center justify-center rounded text-white/30 transition hover:text-white/80"
    >
      {copied ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
    </button>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function TokenHeader({ meta, ca, launch }: { meta: TokenMeta; ca: string; launch: LaunchInfo }) {
  const up = meta.priceChange24h >= 0;
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/[0.04] p-5">
      <div className="flex items-start gap-4">
        {meta.image && (
          <img src={meta.image} alt={meta.symbol} className="h-14 w-14 rounded-xl object-cover border border-white/10 shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xl font-black text-white">{meta.name}</h2>
            <span className="rounded-full border border-white/20 px-2.5 py-0.5 text-[11px] font-bold text-white/60">${meta.symbol}</span>
            {launch.platform === "pump.fun" && (
              <span className="rounded-full border border-og-lime/40 bg-og-lime/10 px-2.5 py-0.5 text-[10px] font-bold text-og-lime">pump.fun</span>
            )}
            {launch.graduated && (
              <span className="rounded-full border border-yellow-400/40 bg-yellow-400/10 px-2.5 py-0.5 text-[10px] font-bold text-yellow-300">Graduated 🎓</span>
            )}
          </div>
          <div className="mt-1 flex items-center gap-2 font-mono">
            <span className="text-[11px] text-white/30">{shortAddr(ca, 6)}</span>
            <CopyBtn value={ca} />
          </div>
          {meta.description && (
            <p className="mt-1 text-[11px] text-white/40 leading-relaxed line-clamp-2">{meta.description}</p>
          )}
        </div>
      </div>

      {/* Price strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Price", value: `$${meta.price < 0.001 ? meta.price.toExponential(3) : meta.price.toFixed(6)}` },
          { label: "Market Cap", value: fmtNum(meta.mcap) },
          { label: "Volume 24h", value: fmtNum(meta.volume24h) },
          { label: "Liquidity", value: fmtNum(meta.liquidity) },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-xl bg-white/[0.03] px-3 py-2">
            <div className="text-[9px] font-bold uppercase tracking-widest text-white/30">{label}</div>
            <div className="mt-0.5 text-sm font-bold text-white">{value}</div>
          </div>
        ))}
      </div>

      {/* 24h change */}
      <div className="flex items-center gap-2">
        {up ? <ArrowUpRight className="h-4 w-4 text-green-400" /> : <ArrowDownRight className="h-4 w-4 text-red-400" />}
        <span className={cn("text-sm font-bold", up ? "text-green-400" : "text-red-400")}>
          {up ? "+" : ""}{meta.priceChange24h.toFixed(2)}% (24h)
        </span>
        {meta.totalHolders > 0 && (
          <span className="ml-auto flex items-center gap-1 text-[11px] text-white/40">
            <Users className="h-3 w-3" />{meta.totalHolders.toLocaleString()} holders
          </span>
        )}
      </div>

      {/* Links */}
      <div className="flex flex-wrap gap-2">
        {meta.links.dex && <ExternalLink href={meta.links.dex} label="DexScreener" icon={<BarChart3 className="h-3 w-3" />} />}
        {meta.links.birdeye && <ExternalLink href={meta.links.birdeye} label="Birdeye" icon={<Radio className="h-3 w-3" />} />}
        {meta.links.solscan && <ExternalLink href={meta.links.solscan} label="Solscan" icon={<Link2 className="h-3 w-3" />} />}
        {meta.links.twitter && <ExternalLink href={`https://twitter.com/${meta.links.twitter.replace("@","")}`} label="Twitter" icon={<Twitter className="h-3 w-3" />} />}
        {meta.links.telegram && <ExternalLink href={meta.links.telegram} label="Telegram" icon={<MessageCircle className="h-3 w-3" />} />}
        {meta.links.website && <ExternalLink href={meta.links.website} label="Website" icon={<Globe className="h-3 w-3" />} />}
      </div>
    </div>
  );
}

function ExternalLink({ href, label, icon }: { href: string; label: string; icon: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] font-semibold text-white/60 transition hover:border-white/20 hover:text-white"
    >
      {icon}{label}
    </a>
  );
}

function LaunchCard({ launch }: { launch: LaunchInfo }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
      <h3 className="text-[11px] font-black uppercase tracking-widest text-white/30">Launch Info</h3>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <InfoRow label="Platform" value={launch.platform} />
        <InfoRow label="Launched" value={launch.launchTime ? fmtTime(launch.launchTime < 1e12 ? launch.launchTime * 1000 : launch.launchTime) : "—"} />
        {launch.deployer && (
          <InfoRow
            label="Deployer"
            value={shortAddr(launch.deployer, 6)}
            copyValue={launch.deployer}
            href={`https://solscan.io/account/${launch.deployer}`}
          />
        )}
        {launch.graduated && <InfoRow label="Status" value="✅ Graduated to Raydium" accent="lime" />}
        {launch.replies > 0 && <InfoRow label="pump.fun Replies" value={launch.replies.toString()} />}
      </div>
    </div>
  );
}

function InfoRow({ label, value, copyValue, href, accent }: {
  label: string; value: string; copyValue?: string; href?: string; accent?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg bg-white/[0.02] px-3 py-2">
      <span className="text-[10px] font-bold uppercase tracking-wider text-white/30">{label}</span>
      <div className="flex items-center gap-1">
        {href ? (
          <a href={href} target="_blank" rel="noopener noreferrer" className="text-[11px] font-mono font-semibold text-white/70 hover:text-white transition">
            {value}
          </a>
        ) : (
          <span className={cn("text-[11px] font-mono font-semibold", accent === "lime" ? "text-og-lime" : "text-white/70")}>{value}</span>
        )}
        {copyValue && <CopyBtn value={copyValue} />}
      </div>
    </div>
  );
}

// Twitter mention card
function TwitterUserCard({ user }: { user: TwitterUser }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden">
      <button
        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-white/[0.04] transition"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-500/20 border border-sky-400/30 text-sky-400 font-bold text-[11px]">
          {user.user?.[0]?.toUpperCase() || "?"}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[12px] font-bold text-white">@{user.user}</div>
          <div className="text-[10px] text-white/40">{user.count} post{user.count !== 1 ? "s" : ""}</div>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-sky-500/15 border border-sky-400/20 px-2 py-0.5 text-[10px] font-bold text-sky-400">
            {user.count}×
          </span>
          {expanded ? <ChevronUp className="h-3.5 w-3.5 text-white/30" /> : <ChevronDown className="h-3.5 w-3.5 text-white/30" />}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-white/[0.07] divide-y divide-white/[0.05]">
          {user.posts.map((p, i) => (
            <div key={i} className="px-4 py-3 space-y-1.5">
              <p className="text-[11px] text-white/70 leading-relaxed">{p.text}</p>
              <div className="flex items-center gap-3">
                <span className="text-[10px] text-white/30">{fmtTime(p.time)}</span>
                <a href={p.url} target="_blank" rel="noopener noreferrer"
                   className="flex items-center gap-1 text-[10px] text-sky-400/70 hover:text-sky-400 transition">
                  <ExternalLink className="h-2.5 w-2.5" /> View post
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RedditPostCard({ post }: { post: RedditPost }) {
  return (
    <a href={post.url} target="_blank" rel="noopener noreferrer"
       className="block rounded-xl border border-white/10 bg-white/[0.03] p-4 space-y-2 hover:border-white/20 hover:bg-white/[0.05] transition">
      <div className="flex items-start gap-2">
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-orange-500/20 border border-orange-400/30">
          <Hash className="h-3 w-3 text-orange-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-semibold text-white/90 leading-snug line-clamp-2">{post.title}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className="text-[10px] text-orange-400/80">r/{post.subreddit}</span>
            <span className="text-[10px] text-white/30">u/{post.author}</span>
            <span className="text-[10px] text-white/20">{fmtTime(post.time)}</span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-4 text-[10px] text-white/40">
        <span className="flex items-center gap-1"><ArrowUpRight className="h-2.5 w-2.5" />{post.score} pts</span>
        <span className="flex items-center gap-1"><MessageSquare className="h-2.5 w-2.5" />{post.comments} comments</span>
      </div>
      {post.text && <p className="text-[10px] text-white/30 leading-relaxed line-clamp-2">{post.text}</p>}
    </a>
  );
}

function CloneCard({ clone, targetMint }: { clone: Clone; targetMint: string }) {
  const isOlder = clone.launchTime && clone.launchTime < Date.now();
  return (
    <a href={clone.dexUrl} target="_blank" rel="noopener noreferrer"
       className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 hover:border-white/20 hover:bg-white/[0.05] transition">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-bold text-white">{clone.name}</span>
          <span className="text-[10px] text-white/40">${clone.symbol}</span>
        </div>
        <div className="mt-0.5 font-mono text-[9px] text-white/25">{shortAddr(clone.mint, 6)}</div>
      </div>
      <div className="text-right shrink-0">
        <div className="text-[11px] font-bold text-white">{fmtNum(clone.mcap)}</div>
        <div className="text-[9px] text-white/30">MC</div>
      </div>
      <div className="text-right shrink-0">
        <div className="text-[11px] text-white/60">{fmtNum(clone.volume24h)}</div>
        <div className="text-[9px] text-white/30">Vol 24h</div>
      </div>
    </a>
  );
}

function TraderRow({ trader }: { trader: Trader }) {
  const up = trader.pnl >= 0;
  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-2.5 hover:bg-white/[0.05] transition">
      <span className="w-6 text-center text-[10px] font-black text-white/25">#{trader.rank}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <a href={`https://solscan.io/account/${trader.wallet}`} target="_blank" rel="noopener noreferrer"
             className="font-mono text-[11px] font-semibold text-white/70 hover:text-white transition">
            {shortAddr(trader.wallet, 5)}
          </a>
          <CopyBtn value={trader.wallet} />
        </div>
        <div className="flex items-center gap-3 text-[9px] text-white/30">
          {trader.trades > 0 && <span>{trader.trades} trades</span>}
          {trader.winRate != null && <span>{(trader.winRate * 100).toFixed(0)}% win</span>}
          {trader.tags.length > 0 && (
            <span className="text-primary/60">{trader.tags.slice(0,2).join(", ")}</span>
          )}
        </div>
      </div>
      <div className="text-right shrink-0">
        <div className={cn("text-[12px] font-bold", up ? "text-green-400" : "text-red-400")}>
          {fmtPnl(trader.pnl)}
        </div>
        <div className="text-[9px] text-white/30">{fmtNum(trader.volume)} vol</div>
      </div>
    </div>
  );
}

function HolderRow({ holder }: { holder: Holder }) {
  const pct = parseFloat(holder.percent);
  const isWhale = pct > 5;
  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-2.5">
      <span className="w-6 text-center text-[10px] font-black text-white/25">#{holder.rank}</span>
      <div className="flex flex-1 items-center gap-1.5 min-w-0">
        <a href={`https://solscan.io/account/${holder.address}`} target="_blank" rel="noopener noreferrer"
           className="font-mono text-[11px] text-white/60 hover:text-white transition truncate">
          {shortAddr(holder.address, 6)}
        </a>
        <CopyBtn value={holder.address} />
      </div>
      <div className="shrink-0">
        <div className={cn("text-[12px] font-bold", isWhale ? "text-yellow-400" : "text-white/70")}>
          {holder.percent}%
        </div>
      </div>
      <div className="w-24 shrink-0">
        <div className="h-1.5 w-full rounded-full bg-white/10">
          <div
            className={cn("h-full rounded-full", isWhale ? "bg-yellow-400/60" : "bg-primary/60")}
            style={{ width: `${Math.min(pct * 3, 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
}

// Section wrapper
function Section({ title, icon, count, children, defaultOpen = true }: {
  title: string; icon: React.ReactNode; count?: number; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden">
      <button
        className="flex w-full items-center gap-3 px-5 py-4 text-left hover:bg-white/[0.03] transition"
        onClick={() => setOpen(o => !o)}
      >
        <span className="text-white/50">{icon}</span>
        <span className="flex-1 text-[12px] font-black uppercase tracking-widest text-white/70">{title}</span>
        {count != null && (
          <span className="rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-0.5 text-[10px] font-bold text-white/50">
            {count}
          </span>
        )}
        {open ? <ChevronUp className="h-3.5 w-3.5 text-white/30" /> : <ChevronDown className="h-3.5 w-3.5 text-white/30" />}
      </button>
      {open && <div className="border-t border-white/[0.07] p-4 space-y-2">{children}</div>}
    </div>
  );
}

type ActiveTab = "social" | "onchain" | "clones";

// ── Main component ────────────────────────────────────────────────────────────

export function TokenResearch({ defaultMint }: { defaultMint?: string }) {
  const [ca, setCa] = useState(defaultMint || "");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ResearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>("social");
  const [socialTab, setSocialTab] = useState<"twitter" | "reddit">("twitter");
  const inputRef = useRef<HTMLInputElement>(null);

  const doResearch = useCallback(async (mintCA: string) => {
    const addr = mintCA.trim();
    if (!addr) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const r = await fetch(`${API_BASE}/research?mint=${encodeURIComponent(addr)}`);
      const data = await r.json();
      if (!data.ok) throw new Error(data.error || "Research failed");
      setResult(data as ResearchResult);
      setActiveTab("social");
    } catch (e: any) {
      setError(e?.message || "Failed to load research data");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (ca.trim()) doResearch(ca.trim());
  };

  const TABS: { id: ActiveTab; label: string; icon: React.ReactNode }[] = [
    { id: "social", label: "Social Intel", icon: <Twitter className="h-3.5 w-3.5" /> },
    { id: "onchain", label: "On-Chain", icon: <Wallet className="h-3.5 w-3.5" /> },
    { id: "clones", label: "Clones", icon: <Layers className="h-3.5 w-3.5" /> },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-transparent">
      {/* ── Header ── */}
      <div className="sticky top-0 z-20 border-b border-white/[0.07] bg-black/60 backdrop-blur-xl px-4 py-4">
        <div className="mx-auto max-w-3xl">
          <div className="mb-3 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-primary/40 bg-primary/10">
              <Search className="h-4 w-4 text-primary" />
            </div>
            <div>
              <div className="text-[13px] font-black uppercase tracking-widest text-white">Research</div>
              <div className="text-[9px] font-bold uppercase tracking-widest text-white/30">Full Intel · Social · On-Chain · Clones</div>
            </div>
          </div>
          <form onSubmit={handleSubmit} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/30" />
              <input
                ref={inputRef}
                value={ca}
                onChange={e => setCa(e.target.value)}
                placeholder="Paste any contract address (CA)…"
                className="w-full rounded-xl border border-white/10 bg-white/[0.05] pl-9 pr-4 py-2.5 text-[12px] font-mono text-white placeholder-white/25 outline-none focus:border-primary/50 focus:bg-white/[0.07] transition"
                autoComplete="off"
                spellCheck={false}
              />
            </div>
            <button
              type="submit"
              disabled={loading || !ca.trim()}
              className="flex items-center gap-1.5 rounded-xl border border-primary/40 bg-primary/15 px-4 py-2 text-[12px] font-bold text-primary transition hover:bg-primary/25 disabled:opacity-40"
            >
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
              {loading ? "Scanning…" : "Research"}
            </button>
          </form>
        </div>
      </div>

      <div className="mx-auto w-full max-w-3xl px-4 py-6 space-y-4">
        {/* ── Loading state ── */}
        {loading && (
          <div className="flex flex-col items-center justify-center gap-4 py-20">
            <div className="relative flex h-16 w-16 items-center justify-center">
              <div className="absolute inset-0 rounded-full border-2 border-primary/20 animate-ping" />
              <div className="absolute inset-1 rounded-full border-2 border-primary/40 animate-spin" />
              <Search className="h-6 w-6 text-primary" />
            </div>
            <div className="text-center">
              <p className="text-sm font-bold text-white/70">Deep-scanning the internet…</p>
              <p className="mt-1 text-[11px] text-white/30">X/Twitter · Reddit · On-chain · Clones · Launch data</p>
            </div>
          </div>
        )}

        {/* ── Error ── */}
        {error && !loading && (
          <div className="flex flex-col items-center gap-3 py-12">
            <AlertTriangle className="h-8 w-8 text-red-400" />
            <p className="text-sm font-bold text-white/60">Research failed</p>
            <p className="text-[11px] text-white/30">{error}</p>
            <button onClick={() => doResearch(ca)} className="mt-2 rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2 text-xs text-white/50 hover:text-white transition">
              Try again
            </button>
          </div>
        )}

        {/* ── Empty state ── */}
        {!loading && !result && !error && (
          <div className="flex flex-col items-center gap-6 py-12">
            <div className="relative flex h-24 w-24 items-center justify-center rounded-2xl border border-primary/20 bg-primary/5">
              <Search className="h-10 w-10 text-primary/50" />
              <div className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full border border-sky-400/40 bg-sky-400/10">
                <Twitter className="h-3 w-3 text-sky-400" />
              </div>
              <div className="absolute -bottom-2 -left-2 flex h-6 w-6 items-center justify-center rounded-full border border-orange-400/40 bg-orange-400/10">
                <Hash className="h-3 w-3 text-orange-400" />
              </div>
            </div>
            <div className="text-center max-w-xs">
              <h3 className="text-base font-black text-white/80">Token Research</h3>
              <p className="mt-1.5 text-[12px] text-white/35 leading-relaxed">
                Paste any Solana contract address to get full social intelligence, on-chain analytics, clone detection, and launch info.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 w-full max-w-sm">
              {[
                { icon: <Twitter className="h-3.5 w-3.5 text-sky-400" />, label: "X/Twitter mentions + @handles" },
                { icon: <Hash className="h-3.5 w-3.5 text-orange-400" />, label: "Reddit posts & discussions" },
                { icon: <TrendingUp className="h-3.5 w-3.5 text-green-400" />, label: "Top 100 traders by PnL" },
                { icon: <Users className="h-3.5 w-3.5 text-yellow-400" />, label: "Top holders & whales" },
                { icon: <Layers className="h-3.5 w-3.5 text-purple-400" />, label: "Clone & copycat detection" },
                { icon: <Target className="h-3.5 w-3.5 text-red-400" />, label: "Launch info & deployer" },
              ].map(({ icon, label }) => (
                <div key={label} className="flex items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.02] px-3 py-2.5">
                  {icon}
                  <span className="text-[10px] text-white/40">{label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Results ── */}
        {result && !loading && (
          <div className="space-y-4">
            {/* Token header card */}
            <TokenHeader meta={result.meta} ca={result.ca} launch={result.launch} />

            {/* Launch info */}
            <LaunchCard launch={result.launch} />

            {/* Main tab navigation */}
            <div className="flex gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1">
              {TABS.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[11px] font-bold transition",
                    activeTab === tab.id
                      ? "bg-white/[0.09] text-white"
                      : "text-white/40 hover:text-white/70"
                  )}
                >
                  {tab.icon}{tab.label}
                  {tab.id === "social" && (
                    <span className="ml-0.5 rounded-full border border-white/10 px-1.5 py-0.5 text-[9px] font-bold text-white/30">
                      {(result.social.twitter.total || 0) + (result.social.reddit.total || 0)}
                    </span>
                  )}
                  {tab.id === "clones" && result.clones.length > 0 && (
                    <span className="ml-0.5 rounded-full border border-red-400/30 bg-red-400/10 px-1.5 py-0.5 text-[9px] font-bold text-red-400">
                      {result.clones.length}
                    </span>
                  )}
                  {tab.id === "onchain" && (
                    <span className="ml-0.5 rounded-full border border-white/10 px-1.5 py-0.5 text-[9px] font-bold text-white/30">
                      {result.onchain.topTraders.length}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* ── Social Intel tab ── */}
            {activeTab === "social" && (
              <div className="space-y-4">
                {/* Sub-tabs: Twitter / Reddit */}
                <div className="flex gap-1 rounded-xl border border-white/[0.08] bg-white/[0.02] p-1 w-fit">
                  <button
                    onClick={() => setSocialTab("twitter")}
                    className={cn(
                      "flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-[11px] font-bold transition",
                      socialTab === "twitter" ? "bg-sky-500/15 text-sky-400 border border-sky-400/20" : "text-white/40 hover:text-white/60"
                    )}
                  >
                    <Twitter className="h-3 w-3" />
                    X / Twitter
                    {result.social.twitter.total > 0 && (
                      <span className="rounded-full bg-sky-400/20 px-1.5 py-0.5 text-[9px]">{result.social.twitter.total}</span>
                    )}
                  </button>
                  <button
                    onClick={() => setSocialTab("reddit")}
                    className={cn(
                      "flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-[11px] font-bold transition",
                      socialTab === "reddit" ? "bg-orange-500/15 text-orange-400 border border-orange-400/20" : "text-white/40 hover:text-white/60"
                    )}
                  >
                    <Hash className="h-3 w-3" />
                    Reddit
                    {result.social.reddit.total > 0 && (
                      <span className="rounded-full bg-orange-400/20 px-1.5 py-0.5 text-[9px]">{result.social.reddit.total}</span>
                    )}
                  </button>
                </div>

                {/* Twitter */}
                {socialTab === "twitter" && (
                  <div className="space-y-2">
                    {result.social.twitter.byUser.length === 0 ? (
                      <div className="flex flex-col items-center gap-2 py-10">
                        <Twitter className="h-8 w-8 text-white/15" />
                        <p className="text-[12px] text-white/30">No X/Twitter mentions found</p>
                        <p className="text-[10px] text-white/20">Nitter search returned no results for this token</p>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-2 px-1">
                          <span className="text-[10px] text-white/30">{result.social.twitter.total} posts from {result.social.twitter.byUser.length} accounts</span>
                        </div>
                        {result.social.twitter.byUser.map(u => (
                          <TwitterUserCard key={u.user} user={u} />
                        ))}
                      </>
                    )}
                  </div>
                )}

                {/* Reddit */}
                {socialTab === "reddit" && (
                  <div className="space-y-2">
                    {result.social.reddit.posts.length === 0 ? (
                      <div className="flex flex-col items-center gap-2 py-10">
                        <Hash className="h-8 w-8 text-white/15" />
                        <p className="text-[12px] text-white/30">No Reddit posts found</p>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-2 px-1">
                          <span className="text-[10px] text-white/30">{result.social.reddit.total} posts found</span>
                        </div>
                        {result.social.reddit.posts.map(p => (
                          <RedditPostCard key={p.id} post={p} />
                        ))}
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── On-Chain tab ── */}
            {activeTab === "onchain" && (
              <div className="space-y-4">
                {/* Top 100 Traders */}
                <Section
                  title="Top 100 Traders (24h)"
                  icon={<TrendingUp className="h-4 w-4" />}
                  count={result.onchain.topTraders.length}
                >
                  {result.onchain.topTraders.length === 0 ? (
                    <p className="py-6 text-center text-[12px] text-white/30">No trader data available</p>
                  ) : (
                    <div className="space-y-1.5">
                      {result.onchain.topTraders.map(t => <TraderRow key={t.wallet} trader={t} />)}
                    </div>
                  )}
                </Section>

                {/* Top Holders */}
                <Section
                  title="Top Holders"
                  icon={<Users className="h-4 w-4" />}
                  count={result.onchain.holders.length}
                >
                  {result.onchain.holders.length === 0 ? (
                    <p className="py-6 text-center text-[12px] text-white/30">No holder data available</p>
                  ) : (
                    <div className="space-y-1.5">
                      {result.onchain.holders.map(h => <HolderRow key={h.address} holder={h} />)}
                    </div>
                  )}
                </Section>
              </div>
            )}

            {/* ── Clones tab ── */}
            {activeTab === "clones" && (
              <div className="space-y-2">
                <div className="rounded-xl border border-yellow-400/20 bg-yellow-400/5 px-4 py-3">
                  <p className="text-[11px] text-yellow-300/80 leading-relaxed">
                    Showing tokens with the same name or ticker on Solana. These may be copycats, vampire forks, or the original token if it was relaunched.
                    Always verify which is the OG using the Scanner tab.
                  </p>
                </div>
                {result.clones.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 py-10">
                    <Shield className="h-8 w-8 text-green-400/50" />
                    <p className="text-[12px] text-white/40">No clones or copycats found</p>
                  </div>
                ) : (
                  result.clones.map(c => <CloneCard key={c.mint} clone={c} targetMint={result.ca} />)
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

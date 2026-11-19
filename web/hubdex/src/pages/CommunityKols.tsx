import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft, Users, Star, TrendingUp, TrendingDown, ExternalLink,
  Loader2, Search, Plus, CheckCircle2, ShieldCheck, Trophy, Activity,
  Zap, Copy, ChevronDown
} from "lucide-react";
import { short, fmtUsd, compact, fmtPct } from "../lib/api";
import { useProGate } from "../components/ProGate";

import { apiUrl } from "../lib/apiBase";
interface KolEntry {
  address: string;
  label?: string;
  tags?: string[];            // e.g. ["verified", "community", "kol"]
  winRate?: number;           // 0-1
  pnlTotal?: number;          // USD
  avgMultiple?: number;
  tradeCount?: number;
  avgHoldH?: number;          // hours
  nominations?: number;       // community upvote count
  communityAdded?: boolean;   // true = community-submitted
  ogVerified?: boolean;       // true = OG team verified
  avatar?: string;
  xHandle?: string;
  tgHandle?: string;
  chain?: string;
}

interface KolCategory {
  id: string;
  label: string;
  icon: any;
  description: string;
}

const CATEGORIES: KolCategory[] = [
  { id: "all",       label: "All",         icon: Users,    description: "All tracked smart-money wallets" },
  { id: "verified",  label: "OG Verified", icon: ShieldCheck, description: "Wallets curated and verified by the OG team" },
  { id: "community", label: "Community",   icon: Trophy,   description: "Wallets nominated and voted up by the community" },
  { id: "kol",       label: "KOLs",        icon: Zap,      description: "Known on-chain influencers with public identity" },
  { id: "whale",     label: "Whales",      icon: TrendingUp, description: "High-volume traders with verified large portfolios" },
];

function ScoreBar({ v, max }: { v: number; max?: number }) {
  const pct = max ? Math.min(v / max, 1) : v;
  return (
    <div className="w-full h-1.5 rounded-full bg-panel2">
      <div className="h-full rounded-full bg-accent" style={{ width: `${pct * 100}%` }} />
    </div>
  );
}

function KolCard({ kol, rank }: { kol: KolEntry; rank: number }) {
  const wr = kol.winRate ?? null;
  const wrColor = wr === null ? "text-muted" : wr >= 0.6 ? "text-up" : wr >= 0.45 ? "text-accent" : "text-down";

  return (
    <Link to={`/kol/${kol.address}`}
      className="card p-3.5 flex items-center gap-3 hover:border-accent/30 transition-all group">
      <div className="shrink-0 w-7 text-center text-xs font-mono font-bold text-muted">{rank}</div>

      {/* Avatar */}
      <div className="shrink-0 w-9 h-9 rounded-full bg-accent/15 border border-accent/30 grid place-items-center overflow-hidden">
        {kol.avatar
          ? <img src={kol.avatar} alt="" className="w-full h-full object-cover" />
          : <Users className="w-4 h-4 text-accent" />}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-bold text-white truncate">
            {kol.label || short(kol.address)}
          </span>
          {kol.ogVerified && <ShieldCheck className="w-3 h-3 text-accent shrink-0" />}
          {kol.communityAdded && <Star className="w-3 h-3 text-yellow-400 shrink-0" />}
        </div>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {kol.tags?.slice(0, 3).map((t) => (
            <span key={t} className="text-[9px] px-1.5 py-0.5 rounded-full bg-panel2 text-muted border border-line">{t}</span>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="hidden sm:flex items-center gap-5 text-right">
        {wr !== null && (
          <div>
            <div className={`text-sm font-bold ${wrColor}`}>{fmtPct(wr * 100)}%</div>
            <div className="text-[10px] text-muted">Win rate</div>
          </div>
        )}
        {kol.pnlTotal != null && (
          <div>
            <div className={`text-sm font-bold ${kol.pnlTotal >= 0 ? "text-up" : "text-down"}`}>
              {kol.pnlTotal >= 0 ? "+" : ""}{fmtUsd(kol.pnlTotal)}
            </div>
            <div className="text-[10px] text-muted">Total PnL</div>
          </div>
        )}
        {kol.nominations != null && kol.communityAdded && (
          <div>
            <div className="text-sm font-bold text-yellow-400">{kol.nominations}</div>
            <div className="text-[10px] text-muted">Votes</div>
          </div>
        )}
      </div>

      <ExternalLink className="w-4 h-4 text-muted group-hover:text-accent shrink-0 transition-colors" />
    </Link>
  );
}

export default function CommunityKols() {
  const { isPro } = useProGate();
  const [category, setCategory] = useState("all");
  const [kols, setKols] = useState<KolEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"winRate" | "pnlTotal" | "nominations">("winRate");
  const [nominateAddr, setNominateAddr] = useState("");
  const [nominateLabel, setNominateLabel] = useState("");
  const [nominating, setNominating] = useState(false);
  const [nomOk, setNomOk] = useState("");
  const [nomErr, setNomErr] = useState("");
  const [showNominate, setShowNominate] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch(apiUrl(`/api/ogdex/kols?limit=100&community=1&chain=solana`));
      const d = await r.json();
      // Merge server data with community flags
      const list: KolEntry[] = (d.kols || d.wallets || []).map((k: any) => ({
        address: k.address,
        label: k.label ?? k.name ?? null,
        tags: k.tags ?? [],
        winRate: k.winRate ?? k.win_rate ?? null,
        pnlTotal: k.pnlTotal ?? k.realized_pnl ?? null,
        avgMultiple: k.avgMultiple ?? null,
        tradeCount: k.tradeCount ?? null,
        avgHoldH: k.avgHoldH ?? null,
        nominations: k.nominations ?? 0,
        communityAdded: k.communityAdded ?? false,
        ogVerified: k.ogVerified ?? k.verified ?? false,
        avatar: k.avatar ?? null,
        xHandle: k.xHandle ?? k.twitter ?? null,
        tgHandle: k.tgHandle ?? k.telegram ?? null,
        chain: k.chain ?? "solana",
      }));
      setKols(list);
    } catch {}
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const nominate = async () => {
    setNomErr(""); setNomOk("");
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(nominateAddr.trim())) {
      setNomErr("Invalid wallet address"); return;
    }
    setNominating(true);
    try {
      const r = await fetch(apiUrl("/api/ogdex/kols/nominate"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: nominateAddr.trim(), label: nominateLabel.trim() || undefined }),
      });
      const d = await r.json();
      if (!d.ok) throw new Error(d.error || "Failed");
      setNomOk("Nomination submitted — thanks! It will appear after OG review.");
      setNominateAddr(""); setNominateLabel("");
    } catch (e: any) { setNomErr(e?.message || "Error"); }
    finally { setNominating(false); }
  };

  const filtered = kols
    .filter((k) => {
      if (category === "verified") return k.ogVerified;
      if (category === "community") return k.communityAdded;
      if (category === "kol") return k.tags?.includes("kol");
      if (category === "whale") return k.tags?.includes("whale");
      return true;
    })
    .filter((k) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (k.label?.toLowerCase().includes(q) || k.address.toLowerCase().includes(q) || k.xHandle?.toLowerCase().includes(q));
    })
    .sort((a, b) => {
      if (sort === "pnlTotal") return (b.pnlTotal ?? -Infinity) - (a.pnlTotal ?? -Infinity);
      if (sort === "nominations") return (b.nominations ?? 0) - (a.nominations ?? 0);
      return (b.winRate ?? -1) - (a.winRate ?? -1);
    });

  return (
    <div className="max-w-3xl mx-auto py-6 px-4">
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-white mb-5">
        <ArrowLeft className="w-4 h-4" /> Back
      </Link>

      <div className="flex items-center gap-2.5 mb-1">
        <Users className="w-5 h-5 text-accent" />
        <h1 className="text-2xl font-black tracking-tight">KOL & Whale Lists</h1>
      </div>
      <p className="text-xs text-muted mb-5">Community-curated smart money. OG-verified wallets + community nominations. See what they're buying.</p>

      {/* Categories */}
      <div className="flex gap-1.5 flex-wrap mb-4">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            onClick={() => setCategory(c.id)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
              category === c.id
                ? "bg-accent/15 text-accent border-accent/30"
                : "bg-panel2 text-muted border-line hover:text-white"
            }`}
          >
            <c.icon className="w-3 h-3" /> {c.label}
          </button>
        ))}
      </div>

      {/* Search + sort */}
      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or address…"
            className="inp pl-9"
          />
        </div>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as any)}
          className="inp w-36 bg-panel2 text-sm"
        >
          <option value="winRate">Win Rate</option>
          <option value="pnlTotal">Total PnL</option>
          <option value="nominations">Votes</option>
        </select>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {[
          { label: "Total Wallets", value: compact(kols.length) },
          { label: "OG Verified", value: compact(kols.filter((k) => k.ogVerified).length) },
          { label: "Community", value: compact(kols.filter((k) => k.communityAdded).length) },
        ].map((s) => (
          <div key={s.label} className="card p-3 text-center">
            <div className="text-lg font-black text-white">{s.value}</div>
            <div className="text-[10px] text-muted">{s.label}</div>
          </div>
        ))}
      </div>

      {/* KOL list */}
      {loading ? (
        <div className="grid place-items-center py-16 text-muted">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="text-sm text-muted">No wallets match this filter.</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {filtered.map((k, i) => (
            <KolCard key={k.address} kol={k} rank={i + 1} />
          ))}
        </div>
      )}

      {/* Nominate section */}
      <div className="mt-8 card border border-accent/20 bg-accent/5 p-5">
        <button
          onClick={() => setShowNominate((v) => !v)}
          className="w-full flex items-center justify-between text-sm font-bold text-white"
        >
          <div className="flex items-center gap-2">
            <Star className="w-4 h-4 text-yellow-400" />
            Nominate a Smart Wallet
          </div>
          <ChevronDown className={`w-4 h-4 text-muted transition-transform ${showNominate ? "rotate-180" : ""}`} />
        </button>

        {showNominate && (
          <div className="mt-4 space-y-2">
            <p className="text-xs text-muted">Know a wallet worth tracking? Submit it for community review. OG team will verify and tag it.</p>
            <input value={nominateAddr} onChange={(e) => setNominateAddr(e.target.value)} placeholder="Wallet address" className="inp" />
            <input value={nominateLabel} onChange={(e) => setNominateLabel(e.target.value)} placeholder="Label / name (optional)" className="inp" />
            <button onClick={nominate} disabled={nominating}
              className="btn bg-accent text-black font-bold inline-flex items-center gap-1.5 w-full justify-center disabled:opacity-60">
              {nominating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Submit Nomination
            </button>
            {nomOk && <p className="text-xs text-up flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" />{nomOk}</p>}
            {nomErr && <p className="text-xs text-down">{nomErr}</p>}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * AlphaCallouts — Community-driven token call alerts.
 * Full Supabase backend: create, upvote, filter, status tracking.
 */
import React, { useState, useEffect, useCallback } from "react";
import {
  Megaphone, TrendingUp, TrendingDown, Target, Clock, ThumbsUp,
  Plus, X, AlertTriangle, Trophy, Flame, ChevronDown, Check,
  Search, Loader2, ArrowUpRight, Zap, Star,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { jupSearchToken, type JupTokenInfo, fmtUsd } from "@/lib/og";

/* ═══════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════ */

interface AlphaCallout {
  id: string;
  user_id: string;
  username: string;
  avatar_url: string | null;
  token_mint: string;
  token_symbol: string;
  token_name: string | null;
  token_logo: string | null;
  direction: "bullish" | "bearish";
  conviction: 1 | 2 | 3 | 4 | 5;
  target_multiplier: number;
  entry_price: number;
  entry_mcap: number;
  reasoning: string;
  status: "active" | "hit" | "missed" | "expired";
  upvotes: number;
  expires_at: string;
  created_at: string;
  userUpvoted?: boolean;
}

interface Props {
  onSelectMint?: (mint: string) => void;
}

/* ═══════════════════════════════════════════════════════════════
   Constants
   ═══════════════════════════════════════════════════════════════ */

const CONVICTION_LABELS = ["", "Low", "Medium", "High", "Very High", "🔥 MAX"];
const CONVICTION_COLORS = [
  "",
  "text-white/30",
  "text-blue-400",
  "text-amber-400",
  "text-orange-400",
  "text-red-400",
];

type FilterType = "all" | "active" | "hit" | "bullish" | "bearish";
const FILTERS: { id: FilterType; label: string }[] = [
  { id: "all",     label: "All" },
  { id: "active",  label: "🔴 Active" },
  { id: "hit",     label: "🎯 Hit" },
  { id: "bullish", label: "🟢 Bullish" },
  { id: "bearish", label: "🔴 Bearish" },
];

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60)   return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400)return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

/* ═══════════════════════════════════════════════════════════════
   Create Form
   ═══════════════════════════════════════════════════════════════ */

interface CreateFormProps {
  onClose: () => void;
  onCreated: () => void;
  userId: string;
  username: string;
}

const CreateCalloutForm: React.FC<CreateFormProps> = ({ onClose, onCreated, userId, username }) => {
  const [direction, setDirection] = useState<"bullish" | "bearish">("bullish");
  const [conviction, setConviction] = useState<1|2|3|4|5>(3);
  const [target, setTarget] = useState("2");
  const [reasoning, setReasoning] = useState("");
  const [tokenQuery, setTokenQuery] = useState("");
  const [tokenResults, setTokenResults] = useState<JupTokenInfo[]>([]);
  const [selectedToken, setSelectedToken] = useState<JupTokenInfo | null>(null);
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const searchToken = async (q: string) => {
    setTokenQuery(q);
    if (q.length < 2) { setTokenResults([]); return; }
    setSearching(true);
    try { setTokenResults((await jupSearchToken(q)).slice(0, 5)); }
    catch { setTokenResults([]); }
    setSearching(false);
  };

  const submit = async () => {
    if (!selectedToken) { toast.error("Select a token"); return; }
    if (!reasoning.trim()) { toast.error("Add your reasoning"); return; }
    setSubmitting(true);
    try {
      const mint = (selectedToken as any).address ?? selectedToken.id;
      const { error } = await supabase.from("alpha_callouts").insert({
        user_id: userId,
        username,
        token_mint: mint,
        token_symbol: selectedToken.symbol || "???",
        token_name: selectedToken.name || null,
        token_logo: selectedToken.logoURI || null,
        direction,
        conviction,
        target_multiplier: parseFloat(target) || 0,
        reasoning: reasoning.trim(),
        status: "active",
        expires_at: new Date(Date.now() + 7 * 86400 * 1000).toISOString(),
      });
      if (error) throw error;
      toast.success("Alpha callout posted! 🚀");
      onCreated();
      onClose();
    } catch (e: any) {
      toast.error(e?.message || "Failed to post callout");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="border-b border-white/[0.08] bg-[#06101c] p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-black text-white uppercase tracking-wider">New Alpha Call</p>
        <button type="button" onClick={onClose} className="text-white/30 hover:text-white transition">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Direction */}
      <div className="flex gap-2">
        {(["bullish", "bearish"] as const).map(d => (
          <button
            key={d}
            type="button"
            onClick={() => setDirection(d)}
            className={cn(
              "flex-1 py-2 rounded-xl text-xs font-bold transition border",
              direction === d && d === "bullish" && "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
              direction === d && d === "bearish" && "bg-red-500/15 text-red-400 border-red-500/30",
              direction !== d && "border-white/[0.08] text-white/30 hover:text-white/50",
            )}
          >
            {d === "bullish" ? "🟢 Bullish" : "🔴 Bearish"}
          </button>
        ))}
      </div>

      {/* Token search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/20" />
        <Input
          value={selectedToken ? `$${selectedToken.symbol}` : tokenQuery}
          onChange={e => { setSelectedToken(null); searchToken(e.target.value); }}
          placeholder="Search token (e.g. SOL, BONK…)"
          className="pl-8 bg-white/[0.03] border-white/[0.08] rounded-xl h-9 text-sm focus:border-primary/40"
        />
        {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-white/30" />}
        {selectedToken && (
          <button type="button" onClick={() => { setSelectedToken(null); setTokenQuery(""); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white">
            <X className="h-3 w-3" />
          </button>
        )}
        {tokenResults.length > 0 && !selectedToken && (
          <div className="absolute top-full mt-1 left-0 right-0 z-50 rounded-xl border border-white/[0.1] bg-[#0a1628] overflow-hidden shadow-xl">
            {tokenResults.map(t => (
              <button
                key={t.id}
                type="button"
                onClick={() => { setSelectedToken(t); setTokenResults([]); setTokenQuery(""); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-white/[0.04] transition text-left"
              >
                {t.logoURI
                  ? <img src={t.logoURI} className="h-6 w-6 rounded-full" alt="" />
                  : <div className="h-6 w-6 rounded-full bg-white/[0.06] flex items-center justify-center text-[9px] font-bold">{t.symbol?.[0]}</div>
                }
                <span className="text-xs font-bold text-white">${t.symbol}</span>
                <span className="text-[10px] text-white/30 truncate">{t.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Conviction */}
      <div>
        <p className="text-[10px] text-white/30 mb-1.5">Conviction</p>
        <div className="flex gap-1">
          {([1, 2, 3, 4, 5] as const).map(n => (
            <button
              key={n}
              type="button"
              onClick={() => setConviction(n)}
              className={cn(
                "flex-1 py-1.5 rounded-lg text-[10px] font-bold transition border",
                conviction >= n ? "border-primary/30 bg-primary/10 text-primary" : "border-white/[0.06] text-white/20",
              )}
            >
              {n}
            </button>
          ))}
        </div>
        <p className="text-[9px] text-white/25 mt-1">{CONVICTION_LABELS[conviction]}</p>
      </div>

      {/* Target */}
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <p className="text-[10px] text-white/30 mb-1">Target multiplier</p>
          <Input
            type="number"
            min="1"
            step="0.5"
            value={target}
            onChange={e => setTarget(e.target.value)}
            placeholder="2x"
            className="bg-white/[0.03] border-white/[0.08] rounded-xl h-8 text-sm focus:border-primary/40"
          />
        </div>
        <div className="text-center pt-4 text-lg text-white/20 font-bold">×</div>
      </div>

      {/* Reasoning */}
      <div>
        <p className="text-[10px] text-white/30 mb-1">Reasoning</p>
        <textarea
          value={reasoning}
          onChange={e => setReasoning(e.target.value)}
          placeholder="Why are you calling this? Catalyst, setup, thesis…"
          rows={2}
          className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-white resize-none outline-none focus:border-primary/40 placeholder:text-white/20"
        />
      </div>

      <Button
        onClick={submit}
        disabled={submitting || !selectedToken || !reasoning.trim()}
        className="w-full bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 rounded-xl h-9"
      >
        {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Post Alpha Call 🚀"}
      </Button>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════
   AlphaCallouts Main Component
   ═══════════════════════════════════════════════════════════════ */

export const AlphaCallouts: React.FC<Props> = ({ onSelectMint }) => {
  const { user, profile } = useAuth();
  const [callouts, setCallouts] = useState<AlphaCallout[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [filter, setFilter] = useState<FilterType>("all");
  const [upvoting, setUpvoting] = useState<Set<string>>(new Set());

  const loadCallouts = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("alpha_callouts")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;

      // Check which ones the current user upvoted
      if (user && data) {
        const { data: myUpvotes } = await supabase
          .from("alpha_callout_upvotes")
          .select("callout_id")
          .eq("user_id", user.id);
        const upvotedIds = new Set((myUpvotes || []).map((u: any) => u.callout_id));
        setCallouts((data || []).map((c: any) => ({ ...c, userUpvoted: upvotedIds.has(c.id) })));
      } else {
        setCallouts(data || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { loadCallouts(); }, [loadCallouts]);

  // Subscribe to realtime inserts
  useEffect(() => {
    const sub = supabase
      .channel("alpha_callouts_live")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "alpha_callouts" }, () => {
        loadCallouts();
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "alpha_callouts" }, () => {
        loadCallouts();
      })
      .subscribe();
    return () => { void supabase.removeChannel(sub); };
  }, [loadCallouts]);

  const toggleUpvote = async (callout: AlphaCallout) => {
    if (!user) { toast.error("Sign in to upvote"); return; }
    if (callout.user_id === user.id) { toast.error("Can't upvote your own call"); return; }
    if (upvoting.has(callout.id)) return;
    setUpvoting(prev => new Set([...prev, callout.id]));

    try {
      if (callout.userUpvoted) {
        await supabase.from("alpha_callout_upvotes").delete()
          .eq("callout_id", callout.id).eq("user_id", user.id);
        await supabase.from("alpha_callouts").update({ upvotes: Math.max(0, callout.upvotes - 1) })
          .eq("id", callout.id);
        setCallouts(prev => prev.map(c => c.id === callout.id
          ? { ...c, upvotes: Math.max(0, c.upvotes - 1), userUpvoted: false } : c));
      } else {
        await supabase.from("alpha_callout_upvotes").insert({ callout_id: callout.id, user_id: user.id });
        await supabase.from("alpha_callouts").update({ upvotes: callout.upvotes + 1 }).eq("id", callout.id);
        setCallouts(prev => prev.map(c => c.id === callout.id
          ? { ...c, upvotes: c.upvotes + 1, userUpvoted: true } : c));
      }
    } catch (e: any) {
      toast.error("Failed to upvote");
    } finally {
      setUpvoting(prev => { const next = new Set(prev); next.delete(callout.id); return next; });
    }
  };

  const filtered = callouts.filter(c => {
    if (filter === "active")  return c.status === "active";
    if (filter === "hit")     return c.status === "hit";
    if (filter === "bullish") return c.direction === "bullish";
    if (filter === "bearish") return c.direction === "bearish";
    return true;
  });

  const stats = {
    total:   callouts.length,
    active:  callouts.filter(c => c.status === "active").length,
    hit:     callouts.filter(c => c.status === "hit").length,
    bullish: callouts.filter(c => c.direction === "bullish").length,
  };

  return (
    <div className="rounded-[1.75rem] border border-white/[0.08] bg-[#07101e] overflow-hidden">
      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-3 px-4 pt-4 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-primary/25 bg-primary/10">
            <Megaphone className="h-4.5 w-4.5 text-primary" />
          </div>
          <div>
            <h3 className="text-[13px] font-black uppercase tracking-widest text-white">Alpha Callouts</h3>
            <p className="text-[10px] text-white/35">
              {stats.active} active · {stats.hit} hit · {stats.bullish} bullish
            </p>
          </div>
        </div>
        {user && (
          <button
            type="button"
            onClick={() => setShowCreate(v => !v)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold transition border",
              showCreate
                ? "bg-primary/15 text-primary border-primary/25"
                : "border-white/[0.08] text-white/40 hover:border-primary/25 hover:text-primary",
            )}
          >
            <Plus className="h-3.5 w-3.5" />
            New Call
          </button>
        )}
      </div>

      {/* ── Create form ── */}
      {showCreate && user && (
        <CreateCalloutForm
          onClose={() => setShowCreate(false)}
          onCreated={loadCallouts}
          userId={user.id}
          username={profile?.username || profile?.display_name || "OG"}
        />
      )}

      {/* ── Filter bar ── */}
      <div className="flex gap-1.5 px-4 pb-3 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
        {FILTERS.map(f => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={cn(
              "shrink-0 rounded-xl px-3 py-1.5 text-[11px] font-bold transition border",
              filter === f.id
                ? "bg-primary/15 text-primary border-primary/25"
                : "text-white/35 border-transparent hover:text-white/60 hover:bg-white/[0.04]",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* ── List ── */}
      <div className="max-h-[520px] overflow-y-auto divide-y divide-white/[0.04]"
           style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.08) transparent" }}>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-white/20" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center px-4">
            <Megaphone className="h-10 w-10 text-white/[0.05] mx-auto mb-3" />
            <p className="text-sm text-white/20 font-bold">No callouts yet</p>
            <p className="text-[11px] text-white/10 mt-1">Be the first to post an alpha call</p>
          </div>
        ) : (
          filtered.map(callout => (
            <div key={callout.id} className="p-3.5 hover:bg-white/[0.015] transition group">
              {/* Top row */}
              <div className="flex items-center gap-2 mb-2">
                <Badge className={cn(
                  "text-[8px] font-bold gap-0.5 h-4 px-1.5",
                  callout.direction === "bullish"
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                    : "bg-red-500/10 text-red-400 border-red-500/20",
                )}>
                  {callout.direction === "bullish"
                    ? <TrendingUp className="h-2 w-2" />
                    : <TrendingDown className="h-2 w-2" />}
                  {callout.direction.toUpperCase()}
                </Badge>

                <button
                  type="button"
                  onClick={() => callout.token_mint && onSelectMint?.(callout.token_mint)}
                  className="text-sm font-black text-white hover:text-primary transition"
                >
                  ${callout.token_symbol}
                </button>

                {callout.token_name && (
                  <span className="text-[10px] text-white/25 truncate max-w-[80px]">{callout.token_name}</span>
                )}

                <Badge className={cn("text-[8px] h-4 px-1.5", CONVICTION_COLORS[callout.conviction], "bg-white/[0.04] border-white/[0.08]")}>
                  {CONVICTION_LABELS[callout.conviction]}
                </Badge>

                {callout.target_multiplier > 0 && (
                  <Badge className="bg-primary/10 text-primary border-primary/20 text-[8px] h-4 px-1.5 gap-0.5">
                    <ArrowUpRight className="h-2 w-2" />
                    {callout.target_multiplier}×
                  </Badge>
                )}

                <span className="text-[9px] text-white/15 ml-auto shrink-0">{timeAgo(callout.created_at)}</span>
              </div>

              {/* Reasoning */}
              {callout.reasoning && (
                <p className="text-[11px] text-white/45 leading-relaxed mb-2 line-clamp-2">{callout.reasoning}</p>
              )}

              {/* Bottom row */}
              <div className="flex items-center gap-2.5 mt-1">
                <div className="flex items-center gap-1.5">
                  <div className="h-4 w-4 rounded-full bg-white/[0.08] flex items-center justify-center text-[7px] font-bold text-white/30">
                    {callout.username?.[0]?.toUpperCase()}
                  </div>
                  <span className="text-[10px] font-semibold text-white/30">{callout.username}</span>
                </div>

                {callout.status === "hit" && (
                  <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[8px] h-4 px-1.5">
                    🎯 HIT
                  </Badge>
                )}
                {callout.status === "missed" && (
                  <Badge className="bg-red-500/10 text-red-400 border-red-500/20 text-[8px] h-4 px-1.5">MISSED</Badge>
                )}
                {callout.status === "expired" && (
                  <Badge className="bg-white/[0.04] text-white/20 border-white/[0.08] text-[8px] h-4 px-1.5">Expired</Badge>
                )}

                <div className="ml-auto flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => toggleUpvote(callout)}
                    disabled={upvoting.has(callout.id)}
                    className={cn(
                      "flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold transition border",
                      callout.userUpvoted
                        ? "bg-primary/15 text-primary border-primary/25"
                        : "text-white/20 border-transparent hover:border-white/[0.08] hover:text-white/40",
                    )}
                  >
                    <ThumbsUp className="h-2.5 w-2.5" />
                    {callout.upvotes}
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default AlphaCallouts;

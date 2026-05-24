/**
 * AlphaCallouts — Community-driven token call alerts.
 * Users post bullish/bearish calls with conviction level, target, and reasoning.
 * Track accuracy over time — become a verified caller.
 */
import { useState, useEffect } from "react";
import { Megaphone, TrendingUp, TrendingDown, Target, Clock, User, ThumbsUp, Plus, X, AlertTriangle, Trophy, Flame, ChevronDown, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

interface AlphaCall {
  id: string;
  user_id: string;
  username: string;
  token_mint: string;
  token_symbol: string;
  direction: "bullish" | "bearish";
  conviction: 1 | 2 | 3 | 4 | 5;
  target_multiplier: number; // 2x, 5x, 10x etc
  reasoning: string;
  entry_mcap: number;
  current_mcap: number;
  status: "active" | "hit" | "missed" | "expired";
  upvotes: number;
  created_at: string;
  expires_at: string;
}

interface Props {
  onSelectMint?: (mint: string) => void;
  userId?: string;
  username?: string;
}

const CONVICTION_LABELS = ["", "Low", "Medium", "High", "Very High", "MAX"];
const CONVICTION_COLORS = ["", "text-white/30", "text-blue-400", "text-amber-400", "text-orange-400", "text-red-400"];

const STORAGE_KEY = "ogscan_alpha_callouts";

function loadCallouts(): AlphaCall[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); } catch { return []; }
}
function saveCallouts(calls: AlphaCall[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(calls));
}

export const AlphaCallouts: React.FC<Props> = ({ onSelectMint, userId = "anon", username = "OG" }) => {
  const [calls, setCalls] = useState<AlphaCall[]>(loadCallouts);
  const [showCreate, setShowCreate] = useState(false);
  const [filter, setFilter] = useState<"all" | "active" | "hit">("all");

  const filteredCalls = calls.filter(c => {
    if (filter === "active") return c.status === "active";
    if (filter === "hit") return c.status === "hit";
    return true;
  }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const timeAgo = (date: string) => {
    const secs = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (secs < 60) return `${secs}s`;
    if (secs < 3600) return `${Math.floor(secs / 60)}m`;
    if (secs < 86400) return `${Math.floor(secs / 3600)}h`;
    return `${Math.floor(secs / 86400)}d`;
  };

  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] overflow-hidden">
      <div className="flex items-center gap-3 p-4 border-b border-white/[0.06]">
        <Megaphone className="h-4 w-4 text-primary" />
        <div className="flex-1">
          <p className="text-sm font-bold text-white">Alpha Callouts</p>
          <p className="text-[10px] text-white/25">{calls.length} calls · Community-driven alerts</p>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="p-1.5 rounded-lg border border-white/[0.08] text-white/20 hover:border-primary/30"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 px-3 py-2 border-b border-white/[0.04]">
        {(["all", "active", "hit"] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn("px-2.5 py-1 rounded-lg text-[10px]",
              filter === f ? "bg-primary/10 text-primary" : "text-white/20 hover:text-white/40"
            )}
          >
            {f === "all" ? "All" : f === "active" ? "🔴 Active" : "🎯 Hit"}
          </button>
        ))}
      </div>

      {/* Calls list */}
      <div className="max-h-[400px] overflow-y-auto">
        {filteredCalls.length === 0 ? (
          <div className="p-8 text-center">
            <Megaphone className="h-8 w-8 text-white/[0.06] mx-auto mb-2" />
            <p className="text-xs text-white/20">No callouts yet</p>
            <p className="text-[10px] text-white/10 mt-1">Post the first alpha call</p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.03]">
            {filteredCalls.map(call => (
              <button
                key={call.id}
                onClick={() => call.token_mint && onSelectMint?.(call.token_mint)}
                className="w-full p-3 hover:bg-white/[0.015] transition-colors text-left"
              >
                <div className="flex items-center gap-2 mb-1">
                  <Badge className={cn("text-[8px]",
                    call.direction === "bullish"
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                      : "bg-red-500/10 text-red-400 border-red-500/20"
                  )}>
                    {call.direction === "bullish" ? <TrendingUp className="h-2 w-2 mr-0.5" /> : <TrendingDown className="h-2 w-2 mr-0.5" />}
                    {call.direction.toUpperCase()}
                  </Badge>
                  <span className="text-xs font-black text-white">${call.token_symbol}</span>
                  <Badge className={cn("text-[7px]", CONVICTION_COLORS[call.conviction], "bg-white/[0.03] border-white/[0.06]")}>
                    {CONVICTION_LABELS[call.conviction]}
                  </Badge>
                  {call.target_multiplier > 0 && (
                    <Badge className="bg-primary/10 text-primary border-primary/20 text-[7px]">
                      {call.target_multiplier}x target
                    </Badge>
                  )}
                  <span className="text-[9px] text-white/15 ml-auto">{timeAgo(call.created_at)}</span>
                </div>
                {call.reasoning && (
                  <p className="text-[10px] text-white/40 line-clamp-2">{call.reasoning}</p>
                )}
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[9px] text-white/20">{call.username}</span>
                  <span className="text-[9px] text-white/10">👍 {call.upvotes}</span>
                  {call.status === "hit" && <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[7px]">🎯 HIT</Badge>}
                  {call.status === "expired" && <Badge className="bg-white/[0.03] text-white/20 border-white/[0.06] text-[7px]">Expired</Badge>}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AlphaCallouts;

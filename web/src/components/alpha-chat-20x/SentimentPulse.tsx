/**
 * SentimentPulse — Real-time community sentiment for a token.
 * Users vote bullish/bearish. Shows live results with animated bar.
 */
import { useState, useEffect } from "react";
import { TrendingUp, TrendingDown, Minus, Users, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  tokenMint: string;
  tokenSymbol: string;
  userId: string;
}

const STORAGE_KEY_PREFIX = "ogscan_sentiment_";

interface SentimentData {
  bullish: number;
  bearish: number;
  neutral: number;
  userVote: "bullish" | "bearish" | "neutral" | null;
  lastUpdated: string;
}

function loadSentiment(mint: string): SentimentData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PREFIX + mint);
    return raw ? JSON.parse(raw) : { bullish: 0, bearish: 0, neutral: 0, userVote: null, lastUpdated: new Date().toISOString() };
  } catch { return { bullish: 0, bearish: 0, neutral: 0, userVote: null, lastUpdated: new Date().toISOString() }; }
}

function saveSentiment(mint: string, data: SentimentData) {
  localStorage.setItem(STORAGE_KEY_PREFIX + mint, JSON.stringify(data));
}

export const SentimentPulse: React.FC<Props> = ({ tokenMint, tokenSymbol, userId }) => {
  const [data, setData] = useState<SentimentData>(loadSentiment(tokenMint));

  const total = data.bullish + data.bearish + data.neutral || 1;
  const bullPct = (data.bullish / total) * 100;
  const bearPct = (data.bearish / total) * 100;
  const neutPct = (data.neutral / total) * 100;

  const dominantSentiment = data.bullish > data.bearish && data.bullish > data.neutral
    ? "bullish"
    : data.bearish > data.bullish
    ? "bearish"
    : "neutral";

  const vote = (type: "bullish" | "bearish" | "neutral") => {
    setData(prev => {
      // Remove old vote
      const updated = { ...prev };
      if (prev.userVote) {
        updated[prev.userVote] = Math.max(0, updated[prev.userVote] - 1);
      }
      // Add new vote (or remove if same)
      if (prev.userVote === type) {
        updated.userVote = null;
      } else {
        updated[type] += 1;
        updated.userVote = type;
      }
      updated.lastUpdated = new Date().toISOString();
      saveSentiment(tokenMint, updated);
      return updated;
    });
  };

  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3">
      <div className="flex items-center gap-2 mb-2">
        <Users className="h-3.5 w-3.5 text-primary" />
        <span className="text-xs font-bold text-white">Community Sentiment</span>
        <span className="text-[9px] text-white/15">{total} votes</span>
      </div>

      {/* Sentiment bar */}
      <div className="flex h-3 rounded-full overflow-hidden mb-3">
        <div
          className="bg-emerald-500 transition-all duration-500"
          style={{ width: `${bullPct}%` }}
        />
        <div
          className="bg-white/20 transition-all duration-500"
          style={{ width: `${neutPct}%` }}
        />
        <div
          className="bg-red-500 transition-all duration-500"
          style={{ width: `${bearPct}%` }}
        />
      </div>

      {/* Vote buttons */}
      <div className="flex gap-2">
        <button
          onClick={() => vote("bullish")}
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border transition-all",
            data.userVote === "bullish"
              ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
              : "bg-white/[0.02] border-white/[0.06] text-white/30 hover:border-emerald-500/20"
          )}
        >
          <TrendingUp className="h-3.5 w-3.5" />
          <span className="text-[11px] font-bold">Bullish</span>
          <span className="text-[9px] opacity-50">{bullPct.toFixed(0)}%</span>
        </button>
        <button
          onClick={() => vote("neutral")}
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border transition-all",
            data.userVote === "neutral"
              ? "bg-white/[0.06] border-white/[0.15] text-white/60"
              : "bg-white/[0.02] border-white/[0.06] text-white/30 hover:border-white/[0.12]"
          )}
        >
          <Minus className="h-3.5 w-3.5" />
          <span className="text-[11px] font-bold">Neutral</span>
          <span className="text-[9px] opacity-50">{neutPct.toFixed(0)}%</span>
        </button>
        <button
          onClick={() => vote("bearish")}
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border transition-all",
            data.userVote === "bearish"
              ? "bg-red-500/15 border-red-500/30 text-red-400"
              : "bg-white/[0.02] border-white/[0.06] text-white/30 hover:border-red-500/20"
          )}
        >
          <TrendingDown className="h-3.5 w-3.5" />
          <span className="text-[11px] font-bold">Bearish</span>
          <span className="text-[9px] opacity-50">{bearPct.toFixed(0)}%</span>
        </button>
      </div>
    </div>
  );
};

export default SentimentPulse;

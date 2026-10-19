/**
 * LaunchpadUpvote — compact upvote pill for OrbitX Launchpad tokens.
 * One vote per browser per token (localStorage), stored in Supabase
 * `launchpad_upvotes` table. Optimistic UI, syncs in background.
 */
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";

interface LaunchpadUpvoteProps {
  mint: string;
  initialCount?: number;
  className?: string;
}

const STORAGE_KEY = "launchpad_upvoted";

function readVoted(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

function writeVoted(voted: Set<string>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...voted]));
  } catch {
    /* storage unavailable — vote just won't persist locally */
  }
}

function fmtCount(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return `${n}`;
}

export default function LaunchpadUpvote({ mint, initialCount = 0, className = "" }: LaunchpadUpvoteProps) {
  const [count, setCount] = useState(initialCount);
  const [voted, setVoted] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // Hydrate: local vote state + live count from Supabase
  useEffect(() => {
    setVoted(readVoted().has(mint));
    (async () => {
      const { data } = await supabase
        .from("launchpad_upvotes")
        .select("count")
        .eq("mint", mint)
        .maybeSingle();
      if (data && typeof data.count === "number") setCount(data.count);
    })();
  }, [mint]);

  const handleVote = useCallback(async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (syncing) return;
    const votedSet = readVoted();
    const hasVoted = votedSet.has(mint);

    // Optimistic update
    setCount((c) => (hasVoted ? Math.max(0, c - 1) : c + 1));
    setVoted(!hasVoted);
    setSyncing(true);
    try {
      if (hasVoted) {
        votedSet.delete(mint);
        writeVoted(votedSet);
        const { data } = await supabase
          .from("launchpad_upvotes")
          .select("count")
          .eq("mint", mint)
          .maybeSingle();
        const next = Math.max(0, (data?.count ?? 1) - 1);
        await supabase.from("launchpad_upvotes").upsert({ mint, count: next }, { onConflict: "mint" });
      } else {
        votedSet.add(mint);
        writeVoted(votedSet);
        const { data } = await supabase
          .from("launchpad_upvotes")
          .select("count")
          .eq("mint", mint)
          .maybeSingle();
        const next = (data?.count ?? 0) + 1;
        await supabase.from("launchpad_upvotes").upsert({ mint, count: next }, { onConflict: "mint" });
      }
    } finally {
      setSyncing(false);
    }
  }, [mint, syncing]);

  return (
    <button
      onClick={handleVote}
      title={voted ? "Remove your upvote" : "Upvote this token"}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold transition-all ${
        voted
          ? "border-orange-500/50 bg-orange-500/20 text-orange-300 hover:bg-orange-500/30"
          : "border-white/10 bg-white/5 text-white/50 hover:border-orange-500/30 hover:text-orange-300"
      } ${className}`}
    >
      <span className={voted ? "scale-110" : ""}>🚀</span>
      <span>{fmtCount(count)}</span>
    </button>
  );
}

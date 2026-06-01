/**
 * LivePolls — Real-time poll creation, voting, and animated results inside a Space.
 * Uses Supabase Realtime for instant vote updates.
 */
import React, { useState, useEffect, useRef } from "react";
import { BarChart3, Plus, Check, X, Loader2, ChevronDown, ChevronUp, Vote } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

interface Poll {
  id: string;
  space_id: string;
  creator_id: string;
  question: string;
  options: string[];
  votes: Record<string, number>; // { optionIndex: count } — we store userId->optionIndex in DB, aggregate client-side
  is_active: boolean;
  created_at: string;
}

interface LivePollsProps {
  spaceId: string;
  userId: string;
  isHost: boolean;
  isCoHost?: boolean;
}

/* ── Create Poll Modal ── */
const CreatePollModal = ({ spaceId, userId, onClose }: { spaceId: string; userId: string; onClose: () => void }) => {
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [creating, setCreating] = useState(false);

  const addOption = () => { if (options.length < 6) setOptions([...options, ""]); };
  const removeOption = (i: number) => { if (options.length > 2) setOptions(options.filter((_, j) => j !== i)); };
  const updateOption = (i: number, v: string) => { const o = [...options]; o[i] = v; setOptions(o); };

  const handleCreate = async () => {
    const q = question.trim();
    const opts = options.map(o => o.trim()).filter(Boolean);
    if (!q || opts.length < 2) return;
    setCreating(true);
    const { error } = await supabase.from("space_polls").insert({
      space_id: spaceId, creator_id: userId, question: q,
      options: JSON.stringify(opts), votes: JSON.stringify({}), is_active: true,
    });
    if (error) console.error("Poll create failed:", error.message);
    setCreating(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-[#0c1219] rounded-2xl border border-white/[0.08] p-5 shadow-2xl">
        <h3 className="text-base font-black text-white mb-4 flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-primary" /> Create Poll
        </h3>

        <input value={question} onChange={e => setQuestion(e.target.value)} placeholder="Ask a question..."
          className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-primary/20 mb-3" />

        <div className="space-y-2 mb-3">
          {options.map((opt, i) => (
            <div key={i} className="flex gap-2">
              <input value={opt} onChange={e => updateOption(i, e.target.value)} placeholder={`Option ${i + 1}`}
                className="flex-1 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.06] text-sm text-white placeholder:text-white/15 focus:outline-none focus:border-primary/20" />
              {options.length > 2 && (
                <button onClick={() => removeOption(i)} className="p-2 rounded-lg bg-white/[0.04] hover:bg-red-500/10 text-white/20 hover:text-red-400 transition-colors">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>

        {options.length < 6 && (
          <button onClick={addOption} className="text-[11px] text-primary/60 hover:text-primary font-bold mb-4 flex items-center gap-1">
            <Plus className="h-3 w-3" /> Add option
          </button>
        )}

        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] text-sm font-bold text-white/40 hover:bg-white/[0.08] transition-all">Cancel</button>
          <button onClick={handleCreate} disabled={creating || !question.trim() || options.filter(o => o.trim()).length < 2}
            className="flex-1 py-2.5 rounded-xl bg-blue-500 hover:bg-primary text-white text-sm font-black transition-all disabled:opacity-30 flex items-center justify-center gap-1.5">
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Vote className="h-3.5 w-3.5" /> Launch Poll</>}
          </button>
        </div>
      </div>
    </div>
  );
};

/* ── Single Poll Card ── */
const PollCard = ({ poll, userId, isHost }: { poll: Poll; userId: string; isHost: boolean }) => {
  const options: string[] = typeof poll.options === "string" ? JSON.parse(poll.options) : poll.options;
  const votes: Record<string, number> = typeof poll.votes === "string" ? JSON.parse(poll.votes) : (poll.votes || {});
  const myVote = votes[userId];
  const hasVoted = myVote !== undefined;

  // Count votes per option
  const counts: number[] = options.map((_, i) => Object.values(votes).filter(v => v === i).length);
  const totalVotes = counts.reduce((a, b) => a + b, 0);

  const vote = async (optIdx: number) => {
    if (hasVoted || !poll.is_active) return;
    const newVotes = { ...votes, [userId]: optIdx };
    await supabase.from("space_polls").update({ votes: JSON.stringify(newVotes) }).eq("id", poll.id);
  };

  const endPoll = async () => {
    await supabase.from("space_polls").update({ is_active: false, ended_at: new Date().toISOString() }).eq("id", poll.id);
  };

  return (
    <div className={cn(
      "rounded-xl border p-3.5 transition-all",
      poll.is_active ? "border-primary/20 bg-blue-500/[0.03]" : "border-white/[0.06] bg-white/[0.02] opacity-70"
    )}>
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-1.5 mb-1">
            <BarChart3 className="h-3 w-3 text-primary" />
            {poll.is_active && <span className="text-[8px] font-bold text-primary px-1.5 py-0.5 rounded-full bg-primary/15 border border-primary/20 uppercase">Live</span>}
            {!poll.is_active && <span className="text-[8px] font-bold text-white/25 px-1.5 py-0.5 rounded-full bg-white/[0.04]">Ended</span>}
          </div>
          <p className="text-sm font-bold text-white leading-tight">{poll.question}</p>
        </div>
        {isHost && poll.is_active && (
          <button onClick={endPoll} className="text-[9px] text-white/20 hover:text-red-400 font-bold px-2 py-1 rounded-lg bg-white/[0.04] hover:bg-red-500/10 transition-all">End</button>
        )}
      </div>

      <div className="space-y-1.5">
        {options.map((opt, i) => {
          const count = counts[i];
          const pct = totalVotes > 0 ? (count / totalVotes) * 100 : 0;
          const isMyVote = myVote === i;
          const isWinner = !poll.is_active && count === Math.max(...counts) && count > 0;

          return (
            <button key={i} onClick={() => vote(i)} disabled={hasVoted || !poll.is_active}
              className={cn(
                "w-full text-left rounded-lg relative overflow-hidden transition-all",
                !hasVoted && poll.is_active
                  ? "px-3 py-2.5 bg-white/[0.04] border border-white/[0.08] hover:border-primary/20 hover:bg-blue-500/[0.03] cursor-pointer"
                  : "px-3 py-2.5 bg-white/[0.02] border border-white/[0.04] cursor-default",
                isMyVote && "border-primary/20 bg-blue-500/[0.05]",
                isWinner && "border-amber-500/30 bg-amber-500/[0.05]",
              )}>
              {/* Progress bar */}
              {(hasVoted || !poll.is_active) && (
                <div className={cn(
                  "absolute inset-y-0 left-0 transition-all duration-700 ease-out rounded-lg",
                  isWinner ? "bg-amber-500/10" : isMyVote ? "bg-primary/15" : "bg-white/[0.03]",
                )} style={{ width: `${pct}%` }} />
              )}
              <div className="relative flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {isMyVote && <Check className="h-3 w-3 text-primary" />}
                  <span className={cn("text-[12px] font-medium", isMyVote ? "text-primary" : "text-white/70")}>{opt}</span>
                </div>
                {(hasVoted || !poll.is_active) && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold text-white/30">{count}</span>
                    <span className="text-[10px] font-bold text-white/20">{pct.toFixed(0)}%</span>
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <p className="text-[9px] text-white/20 mt-2">{totalVotes} vote{totalVotes !== 1 ? "s" : ""}</p>
    </div>
  );
};

/* ── Main LivePolls Component ── */
const LivePolls: React.FC<LivePollsProps> = ({ spaceId, userId, isHost, isCoHost }) => {
  const [polls, setPolls] = useState<Poll[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [expanded, setExpanded] = useState(true);

  // Fetch + subscribe
  useEffect(() => {
    const fetchPolls = async () => {
      const { data } = await supabase.from("space_polls").select("*").eq("space_id", spaceId).order("created_at", { ascending: false });
      if (data) setPolls(data as Poll[]);
    };
    fetchPolls();

    const channel = supabase.channel(`polls-${spaceId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "space_polls", filter: `space_id=eq.${spaceId}` },
        (payload) => {
          if (payload.eventType === "INSERT") setPolls(prev => [payload.new as Poll, ...prev]);
          else if (payload.eventType === "UPDATE") setPolls(prev => prev.map(p => p.id === (payload.new as Poll).id ? payload.new as Poll : p));
          else if (payload.eventType === "DELETE") setPolls(prev => prev.filter(p => p.id !== (payload.old as any).id));
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [spaceId]);

  const activePolls = polls.filter(p => p.is_active);
  const endedPolls = polls.filter(p => !p.is_active);

  if (polls.length === 0 && !isHost && !isCoHost) return null;

  return (
    <div className="space-y-2">
      {/* Header */}
      <button onClick={() => setExpanded(!expanded)} className="flex items-center justify-between w-full px-1">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-3.5 w-3.5 text-primary" />
          <span className="text-[11px] font-bold text-white/50">Polls</span>
          {activePolls.length > 0 && <span className="text-[9px] font-bold text-primary px-1.5 py-0.5 rounded-full bg-primary/15">{activePolls.length} active</span>}
        </div>
        <div className="flex items-center gap-2">
          {(isHost || isCoHost) && (
            <button onClick={(e) => { e.stopPropagation(); setShowCreate(true); }}
              className="text-[10px] font-bold text-primary/60 hover:text-primary px-2 py-1 rounded-lg bg-primary/15 hover:bg-primary/15 transition-all flex items-center gap-1">
              <Plus className="h-2.5 w-2.5" /> New Poll
            </button>
          )}
          {expanded ? <ChevronUp className="h-3 w-3 text-white/20" /> : <ChevronDown className="h-3 w-3 text-white/20" />}
        </div>
      </button>

      {expanded && (
        <div className="space-y-2">
          {activePolls.map(p => <PollCard key={p.id} poll={p} userId={userId} isHost={isHost} />)}
          {endedPolls.slice(0, 3).map(p => <PollCard key={p.id} poll={p} userId={userId} isHost={isHost} />)}
          {polls.length === 0 && (
            <p className="text-[10px] text-white/15 text-center py-3">No polls yet</p>
          )}
        </div>
      )}

      {showCreate && <CreatePollModal spaceId={spaceId} userId={userId} onClose={() => setShowCreate(false)} />}
    </div>
  );
};

export default LivePolls;

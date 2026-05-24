/**
 * ThreadedDiscussions — Token-specific discussion threads.
 * Each token gets its own discussion. Users can post, reply, vote.
 */
import { useState, useEffect, useRef } from "react";
import { MessageSquare, Send, ThumbsUp, ThumbsDown, Reply, Clock, User, ChevronDown, Flame, Pin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

interface DiscussionMessage {
  id: string;
  token_mint: string;
  user_id: string;
  username: string;
  content: string;
  parent_id: string | null;
  upvotes: number;
  downvotes: number;
  is_pinned: boolean;
  created_at: string;
  replies: DiscussionMessage[];
}

interface Props {
  tokenMint: string;
  tokenSymbol: string;
  userId: string;
  username: string;
}

export const ThreadedDiscussions: React.FC<Props> = ({ tokenMint, tokenSymbol, userId, username }) => {
  const [messages, setMessages] = useState<DiscussionMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"recent" | "top">("recent");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load messages from Supabase
  useEffect(() => {
    if (!tokenMint) return;
    setLoading(true);

    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from("alpha_discussions")
        .select("*")
        .eq("token_mint", tokenMint)
        .order("created_at", { ascending: false })
        .limit(100);

      if (data && !error) {
        // Build thread tree
        const rootMessages = data.filter(m => !m.parent_id);
        const replies = data.filter(m => m.parent_id);
        const threaded = rootMessages.map(m => ({
          ...m,
          replies: replies.filter(r => r.parent_id === m.id).sort(
            (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          ),
        }));
        setMessages(threaded);
      }
      setLoading(false);
    };

    fetchMessages();

    // Real-time subscription
    const channel = supabase
      .channel(`discussions-${tokenMint}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "alpha_discussions",
        filter: `token_mint=eq.${tokenMint}`,
      }, (payload) => {
        const msg = payload.new as DiscussionMessage;
        if (msg.parent_id) {
          setMessages(prev => prev.map(m =>
            m.id === msg.parent_id
              ? { ...m, replies: [...(m.replies || []), { ...msg, replies: [] }] }
              : m
          ));
        } else {
          setMessages(prev => [{ ...msg, replies: [] }, ...prev]);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [tokenMint]);

  const sendMessage = async () => {
    if (!newMessage.trim()) return;

    const msg = {
      token_mint: tokenMint,
      user_id: userId,
      username,
      content: newMessage.trim(),
      parent_id: replyingTo,
      upvotes: 0,
      downvotes: 0,
      is_pinned: false,
    };

    const { error } = await supabase.from("alpha_discussions").insert(msg);
    if (error) {
      toast.error("Failed to post message");
      return;
    }

    setNewMessage("");
    setReplyingTo(null);
  };

  const vote = async (id: string, type: "up" | "down") => {
    const col = type === "up" ? "upvotes" : "downvotes";
    await supabase.rpc("increment_field", { row_id: id, table_name: "alpha_discussions", field_name: col });
    setMessages(prev => prev.map(m => {
      if (m.id === id) return { ...m, [col]: m[col === "upvotes" ? "upvotes" : "downvotes"] + 1 };
      return {
        ...m,
        replies: m.replies.map(r => r.id === id ? { ...r, [col]: r[col === "upvotes" ? "upvotes" : "downvotes"] + 1 } : r),
      };
    }));
  };

  const sorted = sortBy === "top"
    ? [...messages].sort((a, b) => (b.upvotes - b.downvotes) - (a.upvotes - a.downvotes))
    : messages;

  const timeAgo = (date: string) => {
    const secs = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (secs < 60) return `${secs}s`;
    if (secs < 3600) return `${Math.floor(secs / 60)}m`;
    if (secs < 86400) return `${Math.floor(secs / 3600)}h`;
    return `${Math.floor(secs / 86400)}d`;
  };

  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] overflow-hidden flex flex-col" style={{ maxHeight: "500px" }}>
      {/* Header */}
      <div className="flex items-center gap-3 p-3 border-b border-white/[0.06] shrink-0">
        <MessageSquare className="h-4 w-4 text-primary" />
        <div className="flex-1">
          <p className="text-xs font-bold text-white">${tokenSymbol} Discussion</p>
          <p className="text-[10px] text-white/25">{messages.length} messages</p>
        </div>
        <div className="flex gap-1">
          {(["recent", "top"] as const).map(s => (
            <button
              key={s}
              onClick={() => setSortBy(s)}
              className={cn("px-2 py-0.5 rounded text-[9px]",
                sortBy === s ? "bg-primary/10 text-primary" : "text-white/20"
              )}
            >
              {s === "recent" ? "New" : "Top"}
            </button>
          ))}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2" ref={scrollRef}>
        {messages.length === 0 ? (
          <div className="text-center py-8">
            <MessageSquare className="h-8 w-8 text-white/[0.06] mx-auto mb-2" />
            <p className="text-xs text-white/20">No discussion yet</p>
            <p className="text-[10px] text-white/10">Be the first to share your thoughts on ${tokenSymbol}</p>
          </div>
        ) : (
          sorted.map(msg => (
            <div key={msg.id} className={cn("rounded-lg border p-2.5", msg.is_pinned ? "border-primary/20 bg-primary/5" : "border-white/[0.04] bg-white/[0.015]")}>
              {msg.is_pinned && <Badge className="bg-primary/10 text-primary border-primary/20 text-[7px] mb-1"><Pin className="h-2 w-2 mr-0.5" />Pinned</Badge>}
              <div className="flex items-center gap-2 mb-1">
                <div className="w-5 h-5 rounded-full bg-white/[0.06] flex items-center justify-center text-[8px] font-bold text-white/20">
                  {msg.username.charAt(0).toUpperCase()}
                </div>
                <span className="text-[10px] font-bold text-white/60">{msg.username}</span>
                <span className="text-[9px] text-white/15">{timeAgo(msg.created_at)}</span>
              </div>
              <p className="text-xs text-white/70 leading-relaxed mb-1.5">{msg.content}</p>
              <div className="flex items-center gap-2">
                <button onClick={() => vote(msg.id, "up")} className="flex items-center gap-0.5 text-[9px] text-white/20 hover:text-emerald-400 transition-colors">
                  <ThumbsUp className="h-2.5 w-2.5" /> {msg.upvotes}
                </button>
                <button onClick={() => vote(msg.id, "down")} className="flex items-center gap-0.5 text-[9px] text-white/20 hover:text-red-400 transition-colors">
                  <ThumbsDown className="h-2.5 w-2.5" /> {msg.downvotes}
                </button>
                <button onClick={() => setReplyingTo(msg.id)} className="flex items-center gap-0.5 text-[9px] text-white/20 hover:text-primary transition-colors">
                  <Reply className="h-2.5 w-2.5" /> Reply
                </button>
              </div>

              {/* Replies */}
              {msg.replies.length > 0 && (
                <div className="mt-2 pl-4 border-l border-white/[0.06] space-y-1.5">
                  {msg.replies.map(reply => (
                    <div key={reply.id} className="rounded-md bg-white/[0.01] p-2">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-[9px] font-bold text-white/40">{reply.username}</span>
                        <span className="text-[8px] text-white/10">{timeAgo(reply.created_at)}</span>
                      </div>
                      <p className="text-[11px] text-white/50">{reply.content}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <button onClick={() => vote(reply.id, "up")} className="text-[8px] text-white/15 hover:text-emerald-400">
                          <ThumbsUp className="h-2 w-2 inline" /> {reply.upvotes}
                        </button>
                        <button onClick={() => vote(reply.id, "down")} className="text-[8px] text-white/15 hover:text-red-400">
                          <ThumbsDown className="h-2 w-2 inline" /> {reply.downvotes}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Input */}
      <div className="p-3 border-t border-white/[0.06] shrink-0">
        {replyingTo && (
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[9px] text-primary">Replying to thread</span>
            <button onClick={() => setReplyingTo(null)} className="text-[9px] text-white/20 hover:text-white/40">Cancel</button>
          </div>
        )}
        <div className="flex gap-2">
          <Input
            placeholder={`Share your thoughts on $${tokenSymbol}...`}
            value={newMessage}
            onChange={e => setNewMessage(e.target.value)}
            onKeyDown={e => e.key === "Enter" && sendMessage()}
            className="flex-1 h-8 text-xs bg-white/[0.03] border-white/[0.06]"
          />
          <button
            onClick={sendMessage}
            disabled={!newMessage.trim()}
            className={cn("p-2 rounded-lg transition-all",
              newMessage.trim() ? "bg-primary text-white" : "bg-white/[0.04] text-white/15"
            )}
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ThreadedDiscussions;

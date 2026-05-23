import { useState, useEffect, useRef } from "react";
import { MessageSquare, Send } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";

interface Message {
  id: string;
  username: string | null;
  avatar_url: string | null;
  content: string;
  created_at: string;
  user_id: string;
}

export const LobbyChat = ({ lobbyId }: { lobbyId: string }) => {
  const { user, profile } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchMessages = async () => {
      const { data } = await supabase
        .from("lobby_messages")
        .select("*")
        .eq("lobby_id", lobbyId)
        .order("created_at", { ascending: true })
        .limit(100);
      if (data) setMessages(data);
    };
    fetchMessages();

    const channel = supabase
      .channel(`lobby-chat-${lobbyId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "lobby_messages",
        filter: `lobby_id=eq.${lobbyId}`,
      }, (payload) => {
        setMessages((prev) => [...prev, payload.new as Message]);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [lobbyId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !user || sending) return;
    setSending(true);
    await supabase.from("lobby_messages").insert({
      lobby_id: lobbyId,
      user_id: user.id,
      username: profile?.username || user.email?.split("@")[0] || "Anon",
      avatar_url: profile?.avatar_url,
      content: input.trim(),
    });
    setInput("");
    setSending(false);
  };

  return (
    <div className="flex flex-col h-full glass-card rounded-xl overflow-hidden">
      <div className="px-3 py-2 border-b border-primary/10 flex items-center gap-2">
        <MessageSquare className="h-3.5 w-3.5 text-primary" />
        <span className="text-xs font-semibold font-display">LOBBY CHAT</span>
        <span className="text-[9px] text-muted-foreground ml-auto">{messages.length} msgs</span>
      </div>
      
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
        {messages.length === 0 && (
          <p className="text-xs text-muted-foreground/50 text-center py-8">No messages yet. Say something!</p>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className={`flex gap-2 ${msg.user_id === user?.id ? "flex-row-reverse" : ""}`}>
            <img
              src={msg.avatar_url || `https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${msg.username}`}
              className="w-6 h-6 rounded-full border border-primary/20 shrink-0"
              alt=""
            />
            <div className={`max-w-[75%] ${msg.user_id === user?.id ? "text-right" : ""}`}>
              <p className="text-[9px] text-muted-foreground/60 mb-0.5">{msg.username}</p>
              <div className={`px-2.5 py-1.5 rounded-xl text-xs ${
                msg.user_id === user?.id 
                  ? "bg-primary/15 text-primary-foreground border border-primary/20" 
                  : "bg-muted/30 border border-border/30"
              }`}>
                {msg.content}
              </div>
            </div>
          </div>
        ))}
      </div>

      <form onSubmit={handleSend} className="p-2 border-t border-primary/10 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 bg-muted/20 border border-border/30 rounded-lg px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/30"
        />
        <button type="submit" disabled={sending || !input.trim()} className="p-2 rounded-lg bg-primary/15 text-primary hover:bg-primary/25 transition-colors disabled:opacity-40">
          <Send className="h-3.5 w-3.5" />
        </button>
      </form>
    </div>
  );
};

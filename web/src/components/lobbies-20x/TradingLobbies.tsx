/**
 * TradingLobbies — Real-time token-focused chat rooms.
 * Each token gets a lobby. Discuss live price action, share charts, react.
 * Like a mini-Discord for each token.
 */
import { useState, useEffect, useRef } from "react";
import { MessagesSquare, Search, Users, TrendingUp, TrendingDown, Send, Hash, Plus, X, Flame, Star, ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { shortAddr, fmtUsd } from "@/lib/og";
import { toast } from "sonner";

interface Lobby {
  id: string;
  token_mint: string;
  token_symbol: string;
  active_users: number;
  total_messages: number;
  last_activity: string;
  is_trending: boolean;
}

interface LobbyMessage {
  id: string;
  lobby_id: string;
  user_id: string;
  username: string;
  content: string;
  created_at: string;
}

interface Props {
  onSelectMint?: (mint: string) => void;
  userId?: string;
  username?: string;
}

export const TradingLobbies: React.FC<Props> = ({ onSelectMint, userId = "anon", username = "OG" }) => {
  const [lobbies, setLobbies] = useState<Lobby[]>([]);
  const [activeLobby, setActiveLobby] = useState<Lobby | null>(null);
  const [messages, setMessages] = useState<LobbyMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const messagesRef = useRef<HTMLDivElement>(null);

  // Simulated lobbies (would be from Supabase in production)
  useEffect(() => {
    setLobbies([
      { id: "1", token_mint: "", token_symbol: "SOL", active_users: 24, total_messages: 1420, last_activity: new Date().toISOString(), is_trending: true },
      { id: "2", token_mint: "", token_symbol: "BONK", active_users: 12, total_messages: 892, last_activity: new Date().toISOString(), is_trending: true },
      { id: "3", token_mint: "", token_symbol: "WIF", active_users: 8, total_messages: 456, last_activity: new Date().toISOString(), is_trending: false },
      { id: "4", token_mint: "", token_symbol: "JUP", active_users: 5, total_messages: 234, last_activity: new Date().toISOString(), is_trending: false },
    ]);
  }, []);

  const sendMessage = () => {
    if (!newMessage.trim() || !activeLobby) return;
    const msg: LobbyMessage = {
      id: crypto.randomUUID(),
      lobby_id: activeLobby.id,
      user_id: userId,
      username,
      content: newMessage.trim(),
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, msg]);
    setNewMessage("");
    setTimeout(() => {
      messagesRef.current?.scrollTo({ top: messagesRef.current.scrollHeight, behavior: "smooth" });
    }, 50);
  };

  const filteredLobbies = searchQuery
    ? lobbies.filter(l => l.token_symbol.toLowerCase().includes(searchQuery.toLowerCase()))
    : lobbies;

  if (activeLobby) {
    return (
      <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] overflow-hidden flex flex-col" style={{ maxHeight: "500px" }}>
        {/* Lobby header */}
        <div className="flex items-center gap-2 p-3 border-b border-white/[0.06] shrink-0">
          <button onClick={() => setActiveLobby(null)} className="text-white/20 hover:text-white/40">
            <ChevronDown className="h-4 w-4 rotate-90" />
          </button>
          <Hash className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-bold text-white">{activeLobby.token_symbol}</span>
          <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[8px]">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse mr-1" />
            {activeLobby.active_users} online
          </Badge>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2" ref={messagesRef}>
          {messages.length === 0 ? (
            <div className="text-center py-8">
              <MessagesSquare className="h-6 w-6 text-white/[0.06] mx-auto mb-1" />
              <p className="text-[10px] text-white/20">No messages yet. Start the conversation!</p>
            </div>
          ) : (
            messages.map(msg => (
              <div key={msg.id} className="flex gap-2">
                <div className="w-6 h-6 rounded-full bg-white/[0.06] flex items-center justify-center text-[8px] font-bold text-white/20 shrink-0 mt-0.5">
                  {msg.username.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold text-white/60">{msg.username}</span>
                    <span className="text-[8px] text-white/10">
                      {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <p className="text-[11px] text-white/50">{msg.content}</p>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Input */}
        <div className="p-2 border-t border-white/[0.06] shrink-0">
          <div className="flex gap-2">
            <Input
              placeholder={`Message #${activeLobby.token_symbol}...`}
              value={newMessage}
              onChange={e => setNewMessage(e.target.value)}
              onKeyDown={e => e.key === "Enter" && sendMessage()}
              className="flex-1 h-8 text-xs bg-white/[0.03] border-white/[0.06]"
            />
            <button
              onClick={sendMessage}
              disabled={!newMessage.trim()}
              className={cn("p-2 rounded-lg",
                newMessage.trim() ? "bg-primary text-white" : "bg-white/[0.04] text-white/15"
              )}
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] overflow-hidden">
      <div className="flex items-center gap-3 p-4 border-b border-white/[0.06]">
        <MessagesSquare className="h-4 w-4 text-primary" />
        <div className="flex-1">
          <p className="text-sm font-bold text-white">Trading Lobbies</p>
          <p className="text-[10px] text-white/25">{lobbies.length} active rooms</p>
        </div>
      </div>

      {/* Search */}
      <div className="px-3 pt-2 pb-1">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-white/15" />
          <Input
            placeholder="Search lobbies..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-8 h-7 text-xs bg-white/[0.03] border-white/[0.06]"
          />
        </div>
      </div>

      <div className="max-h-[300px] overflow-y-auto divide-y divide-white/[0.03]">
        {filteredLobbies.map(lobby => (
          <button
            key={lobby.id}
            onClick={() => setActiveLobby(lobby)}
            className="w-full flex items-center gap-3 p-3 hover:bg-white/[0.02] transition-colors text-left"
          >
            <div className="w-9 h-9 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center">
              <Hash className="h-4 w-4 text-white/20" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-white">{lobby.token_symbol}</span>
                {lobby.is_trending && <Flame className="h-3 w-3 text-amber-400" />}
              </div>
              <span className="text-[9px] text-white/20">{lobby.total_messages} messages</span>
            </div>
            <div className="text-right">
              <div className="flex items-center gap-1 text-[9px] text-emerald-400">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                {lobby.active_users}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default TradingLobbies;

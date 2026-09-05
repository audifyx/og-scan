/**
 * Public MCP group-chat lobby + transcript.
 */
import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Loader2, MessageSquare, Users } from "lucide-react";

type GcChat = {
  slug: string;
  name: string;
  topic?: string | null;
  joinUrl?: string;
  host?: string | null;
};

type GcMessage = {
  id?: string;
  author_label?: string;
  body?: string;
  created_at?: string;
};

export default function McpGroupChat() {
  const { slug } = useParams<{ slug?: string }>();
  const [chats, setChats] = useState<GcChat[]>([]);
  const [chat, setChat] = useState<GcChat | null>(null);
  const [messages, setMessages] = useState<GcMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setError(null);
    try {
      const path = slug ? `/api/mcp-gc?slug=${encodeURIComponent(slug)}` : "/api/mcp-gc?slug=list";
      const r = await fetch(path);
      const text = await r.text();
      let data: { ok?: boolean; message?: string; chats?: GcChat[]; messages?: GcMessage[] } = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        if (slug) setError("Group chat API is not available here (needs /api/mcp-gc).");
        else setChats([]);
        return;
      }
      if (slug) {
        if (!data?.ok) setError(data?.message || "Group chat not found");
        else {
          setChat(data as GcChat);
          setMessages(Array.isArray(data?.messages) ? data.messages : []);
        }
      } else {
        setChats(Array.isArray(data?.chats) ? data.chats : []);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load group chats");
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    setLoading(true);
    void load();
    if (!slug) return undefined;
    const t = window.setInterval(() => void load(), 4000);
    return () => window.clearInterval(t);
  }, [load, slug]);

  return (
    <div className="relative min-h-screen bg-og-ink text-white">
      <div className="pointer-events-none absolute -top-40 left-[18%] h-[520px] w-[520px] rounded-full bg-og-lime/10 blur-[140px]" />
      <div className="relative mx-auto max-w-lg px-4 py-10">
        <Link to="/app" className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/40 hover:text-og-cyan">
          OrbitX · MCP group chats
        </Link>
        <h1 className="mt-3 font-display text-2xl font-black">
          {slug ? chat?.name || "Group chat" : "Group chats"}
        </h1>
        <p className="mt-1 text-sm text-white/50">
          {slug
            ? "Read-only lobby. Chat from Agent MCP — join, then say “I want to chat in the group chat”."
            : "Rooms started from Agent MCP. Say “hey any group chats” then “join …”."}
        </p>

        {loading && (
          <div className="mt-10 flex justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-og-lime" />
          </div>
        )}
        {error && (
          <p className="mt-6 rounded-xl border border-og-blood/40 bg-og-blood/10 px-4 py-3 text-sm text-og-blood">{error}</p>
        )}

        {!slug && !loading && (
          <ul className="mt-6 space-y-2">
            {chats.length === 0 && (
              <li className="glass-card px-4 py-6 text-sm text-white/50">
                No group chats yet. From MCP: “start a group chat named Orbitx”.
              </li>
            )}
            {chats.map((c) => (
              <li key={c.slug}>
                <Link
                  to={`/gc/${c.slug}`}
                  className="glass-card flex items-center gap-3 px-4 py-3 transition hover:border-og-lime/40"
                >
                  <Users className="h-4 w-4 text-og-lime" />
                  <div>
                    <div className="text-sm font-bold">{c.name}</div>
                    <div className="font-mono text-[10px] uppercase tracking-widest text-white/40">{c.slug}</div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}

        {slug && chat && !loading && (
          <div className="glass-card mt-8 p-5">
            <div className="flex items-center gap-2 text-og-lime">
              <MessageSquare className="h-4 w-4" />
              <span className="font-mono text-[10px] uppercase tracking-[0.18em]">Group chat</span>
            </div>
            <p className="mt-2 text-lg font-black">{chat.name}</p>
            {chat.host && <p className="text-xs text-white/40">Host {chat.host}</p>}
            <ul className="mt-5 max-h-[50vh] space-y-2 overflow-y-auto">
              {messages.length === 0 && <li className="text-sm text-white/40">No messages yet.</li>}
              {messages.map((m, i) => (
                <li key={m.id || `${m.created_at}-${i}`} className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
                  <div className="font-mono text-[10px] uppercase tracking-widest text-og-lime/80">{m.author_label || "anon"}</div>
                  <div className="text-sm text-white/90">{m.body}</div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

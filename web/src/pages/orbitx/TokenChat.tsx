// OrbitX Launchpad — per-token community chat (SocialFi). Realtime via Supabase.
// Wallet-native: you must connect to post; messages are keyed to your wallet and
// enriched with your OrbitX profile (name/avatar) when set. Fails soft if the
// chat table isn't set up yet.
import { useEffect, useRef, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { supabase } from "@/lib/supabase";
import { getProfiles, type OrbitxProfile } from "@/lib/orbitx/registry";
import { shortAddr } from "./_shared";
import { Send, Loader2, MessagesSquare } from "lucide-react";

type Msg = { id: string; mint: string; wallet: string; body: string; created_at: string };

function timeShort(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${Math.floor(s)}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

export default function TokenChat({ mint }: { mint: string }) {
  const { connected, publicKey } = useWallet();
  const addr = publicKey?.toBase58();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [profiles, setProfiles] = useState<Record<string, OrbitxProfile>>({});
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data } = await supabase.from("orbitx_token_chat").select("*").eq("mint", mint).order("created_at", { ascending: true }).limit(100);
        if (!alive) return;
        const msgs = (data as Msg[]) ?? [];
        setMessages(msgs);
        const wallets = Array.from(new Set(msgs.map((m) => m.wallet)));
        if (wallets.length) setProfiles(await getProfiles(wallets));
      } catch { /* fail soft */ } finally { if (alive) setLoading(false); }
    })();

    const ch = supabase
      .channel(`orbitx_chat_${mint}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "orbitx_token_chat", filter: `mint=eq.${mint}` },
        (payload) => setMessages((prev) => (prev.some((m) => m.id === (payload.new as Msg).id) ? prev : [...prev, payload.new as Msg])))
      .subscribe();
    return () => { alive = false; supabase.removeChannel(ch); };
  }, [mint]);

  useEffect(() => { boxRef.current?.scrollTo({ top: boxRef.current.scrollHeight }); }, [messages]);

  const send = async () => {
    if (!connected || !addr) return;
    const text = body.trim();
    if (!text) return;
    setSending(true);
    try {
      const { error } = await supabase.from("orbitx_token_chat").insert({ mint, wallet: addr, body: text.slice(0, 500) });
      if (error) throw error;
      setBody("");
    } catch { /* fail soft */ } finally { setSending(false); }
  };

  const nameFor = (w: string) => profiles[w]?.display_name || profiles[w]?.username || shortAddr(w, 4);

  return (
    <div className="pf-card mt-4 p-4">
      <div className="mb-3 flex items-center gap-2">
        <MessagesSquare className="h-4 w-4 text-[hsl(var(--pf-green))]" />
        <h2 className="text-sm font-black uppercase tracking-wide text-[hsl(var(--pf-ink))]">Community</h2>
        <span className="pf-mono text-[10px] text-[hsl(var(--pf-muted))]">{messages.length} message{messages.length === 1 ? "" : "s"}</span>
      </div>

      <div ref={boxRef} className="mb-3 max-h-80 space-y-2.5 overflow-y-auto pr-1">
        {loading ? (
          <div className="flex items-center gap-2 py-8 text-xs text-[hsl(var(--pf-muted))]"><Loader2 className="h-4 w-4 animate-spin" /> loading chat…</div>
        ) : messages.length === 0 ? (
          <div className="py-8 text-center text-xs text-[hsl(var(--pf-muted))]">No messages yet — be the first to post.</div>
        ) : (
          messages.map((m) => (
            <div key={m.id} className="flex gap-2">
              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[hsl(var(--pf-border))] bg-[hsl(var(--pf-bg))] text-[9px] font-black text-[hsl(var(--pf-muted))]">
                {profiles[m.wallet]?.avatar_url ? <img src={profiles[m.wallet]!.avatar_url as string} alt="" className="h-full w-full object-cover" /> : m.wallet.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="pf-mono text-[11px] font-bold text-[hsl(var(--pf-ink))]">{nameFor(m.wallet)}</span>
                  <span className="pf-mono text-[9px] text-[hsl(var(--pf-muted))]">{timeShort(m.created_at)}</span>
                </div>
                <p className="break-words text-xs text-[hsl(var(--pf-muted))]">{m.body}</p>
              </div>
            </div>
          ))
        )}
      </div>

      {connected ? (
        <div className="flex gap-2">
          <input
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") send(); }}
            maxLength={500}
            placeholder="Say something…"
            className="flex-1 rounded-lg border border-[hsl(var(--pf-border))] bg-[hsl(var(--pf-bg))] px-3 py-2 text-sm text-[hsl(var(--pf-ink))] outline-none focus:border-[hsl(var(--pf-green))]"
          />
          <button onClick={send} disabled={sending || !body.trim()} className="pf-btn justify-center px-4 disabled:opacity-50">{sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}</button>
        </div>
      ) : (
        <div className="rounded-lg border border-[hsl(var(--pf-border))] bg-[hsl(var(--pf-bg))] py-3 text-center text-xs text-[hsl(var(--pf-muted))]">Connect your wallet to join the chat</div>
      )}
    </div>
  );
}

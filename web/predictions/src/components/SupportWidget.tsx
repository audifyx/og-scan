'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { MessageCircle, X, Send, Loader2, LifeBuoy } from 'lucide-react';

interface Msg { id: string; sender: 'user' | 'admin'; body: string; created_at: string }

export function SupportWidget() {
  const pathname = usePathname();
  const { user, loading: authLoading } = useAuth();
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [unread, setUnread] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const scrollDown = () => setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const r = await fetch('/api/support', { cache: 'no-store' });
      const d = await r.json();
      if (d.ok) {
        setMsgs(d.messages || []);
        setTicketId(d.ticket?.id || null);
        if (d.ticket?.user_unread) setUnread(true);
      }
    } catch {}
    setLoading(false);
    scrollDown();
  }, [user]);

  // poll lightly for unread when closed (so the badge appears)
  useEffect(() => {
    if (!user) return;
    let timer: any;
    const check = async () => {
      try {
        const r = await fetch('/api/support', { cache: 'no-store' });
        const d = await r.json();
        if (d.ok) {
          if (!open) { if (d.ticket?.user_unread) setUnread(true); }
          else { setMsgs(d.messages || []); setTicketId(d.ticket?.id || null); }
        }
      } catch {}
      timer = setTimeout(check, open ? 6000 : 20000);
    };
    timer = setTimeout(check, open ? 6000 : 20000);
    return () => clearTimeout(timer);
  }, [user, open]);

  // realtime: admin replies appear instantly
  useEffect(() => {
    if (!ticketId || !open) return;
    const ch = supabase
      .channel(`support:${ticketId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'support_messages', filter: `ticket_id=eq.${ticketId}` },
        (payload: any) => {
          const m = payload.new as Msg;
          setMsgs((prev) => prev.some((x) => x.id === m.id) ? prev : [...prev, m]);
          scrollDown();
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [ticketId, open]);

  useEffect(() => { if (open && user) { setUnread(false); load(); } }, [open, user, load]);

  const send = async () => {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    // optimistic
    const temp: Msg = { id: 'tmp-' + Date.now(), sender: 'user', body, created_at: new Date().toISOString() };
    setMsgs((p) => [...p, temp]); setText(''); scrollDown();
    try {
      const r = await fetch('/api/support', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body }) });
      const d = await r.json();
      if (d.ok) { setTicketId(d.ticketId); setMsgs((p) => p.map((m) => m.id === temp.id ? d.message : m)); }
    } catch {}
    setSending(false);
  };

  // hide on admin + auth screens
  if (pathname?.startsWith('/admin') || pathname?.startsWith('/auth') || pathname === '/maintenance') return null;

  return (
    <>
      {/* Launcher */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Support chat"
          className="fixed z-[60] right-4 bottom-4 sm:right-6 sm:bottom-6 w-14 h-14 rounded-full bg-sol-gradient text-black grid place-items-center shadow-lg hover:scale-105 transition-transform"
          style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
        >
          <MessageCircle size={24} />
          {unread && <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-loss border-2 border-black" />}
        </button>
      )}

      {/* Panel */}
      {open && (
        <div
          className="fixed z-[60] right-0 bottom-0 sm:right-6 sm:bottom-6 w-full sm:w-[380px] h-[100dvh] sm:h-[560px] sm:max-h-[80vh] flex flex-col bg-card border border-white/10 sm:rounded-2xl shadow-2xl overflow-hidden"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-white/5 shrink-0">
            <div className="flex items-center gap-2">
              <LifeBuoy size={18} className="text-cyan" />
              <div>
                <p className="font-bold text-white text-sm leading-none">OrbitX Support</p>
                <p className="text-[11px] text-slate-400 mt-0.5">We usually reply within a few hours</p>
              </div>
            </div>
            <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-white p-1"><X size={18} /></button>
          </div>

          {/* Body */}
          {authLoading ? (
            <div className="flex-1 grid place-items-center text-slate-500"><Loader2 className="animate-spin" /></div>
          ) : !user ? (
            <div className="flex-1 grid place-items-center text-center px-6">
              <div>
                <MessageCircle size={28} className="mx-auto text-cyan mb-3" />
                <p className="text-white font-semibold mb-1">Sign in to chat with us</p>
                <p className="text-sm text-slate-400 mb-4">Support chat is available once you're signed in.</p>
                <Link href="/auth" className="inline-block btn-primary !py-2 !px-5 text-sm">Sign in</Link>
              </div>
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                {loading && msgs.length === 0 ? (
                  <div className="grid place-items-center h-full text-slate-500"><Loader2 className="animate-spin" /></div>
                ) : msgs.length === 0 ? (
                  <div className="text-center text-slate-400 text-sm mt-8">
                    👋 Hi! How can we help? Send us a message and we'll get back to you.
                  </div>
                ) : (
                  msgs.map((m) => (
                    <div key={m.id} className={`flex ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm whitespace-pre-wrap break-words ${
                        m.sender === 'user' ? 'bg-cyan text-black rounded-br-sm' : 'bg-white/8 text-slate-100 rounded-bl-sm'}`}>
                        {m.sender === 'admin' && <p className="text-[10px] font-bold text-cyan mb-0.5">OrbitX Team</p>}
                        {m.body}
                      </div>
                    </div>
                  ))
                )}
                <div ref={endRef} />
              </div>

              {/* Composer */}
              <div className="border-t border-white/10 p-3 flex items-end gap-2 shrink-0">
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                  rows={1}
                  placeholder="Type a message…"
                  className="flex-1 resize-none bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-cyan/40 max-h-28"
                />
                <button onClick={send} disabled={sending || !text.trim()} className="shrink-0 w-10 h-10 rounded-xl bg-sol-gradient text-black grid place-items-center disabled:opacity-50">
                  {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}

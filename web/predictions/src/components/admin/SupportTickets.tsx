'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { LifeBuoy, Send, Loader2, RefreshCw, CheckCircle, Circle, X } from 'lucide-react';
import clsx from 'clsx';

interface Ticket { id: string; status: string; who: string; username: string | null; wallet: string | null; preview: string; preview_sender: string | null; admin_unread: boolean; last_message_at: string }
interface Msg { id: string; sender: 'user' | 'admin'; body: string; created_at: string }

const ago = (d: string) => {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return 'now'; if (s < 3600) return `${Math.floor(s/60)}m`; if (s < 86400) return `${Math.floor(s/3600)}h`; return `${Math.floor(s/86400)}d`;
};

export function SupportTickets() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [active, setActive] = useState<Ticket | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const endRef = useRef<HTMLDivElement>(null);
  const scrollDown = () => setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);

  const loadList = useCallback(async () => {
    try { const r = await fetch('/api/admin/support', { cache: 'no-store' }); const d = await r.json(); if (d.ok) setTickets(d.tickets || []); } catch {}
    setLoading(false);
  }, []);

  const loadMsgs = useCallback(async (id: string) => {
    try { const r = await fetch(`/api/admin/support?ticketId=${id}`, { cache: 'no-store' }); const d = await r.json(); if (d.ok) { setMsgs(d.messages || []); scrollDown(); } } catch {}
  }, []);

  useEffect(() => { loadList(); }, [loadList]);
  // poll list (and the open conversation) for a live feel
  useEffect(() => {
    const t = setInterval(() => { loadList(); if (active) loadMsgs(active.id); }, 5000);
    return () => clearInterval(t);
  }, [active, loadList, loadMsgs]);

  const openTicket = (t: Ticket) => { setActive(t); setMsgs([]); loadMsgs(t.id); setTickets((p) => p.map((x) => x.id === t.id ? { ...x, admin_unread: false } : x)); };

  const send = async () => {
    const body = reply.trim(); if (!body || !active || sending) return;
    setSending(true);
    const temp: Msg = { id: 'tmp-' + Date.now(), sender: 'admin', body, created_at: new Date().toISOString() };
    setMsgs((p) => [...p, temp]); setReply(''); scrollDown();
    try { const r = await fetch('/api/admin/support', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'reply', ticketId: active.id, body }) });
      const d = await r.json(); if (d.ok) setMsgs((p) => p.map((m) => m.id === temp.id ? d.message : m)); } catch {}
    setSending(false); loadList();
  };

  const setStatus = async (action: 'close' | 'reopen') => {
    if (!active) return;
    await fetch('/api/admin/support', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, ticketId: active.id }) });
    setActive({ ...active, status: action === 'close' ? 'closed' : 'open' }); loadList();
  };

  return (
    <div className="grid md:grid-cols-[320px_1fr] gap-4 h-[70vh]">
      {/* List */}
      <div className="glass-card rounded-2xl overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/8">
          <h3 className="font-bold text-white flex items-center gap-2"><LifeBuoy size={15} className="text-cyan" /> Tickets</h3>
          <button onClick={loadList} className="text-slate-400 hover:text-white p-1"><RefreshCw size={14} /></button>
        </div>
        <div className="flex-1 overflow-y-auto divide-y divide-white/5">
          {loading ? <div className="p-6 grid place-items-center text-slate-500"><Loader2 className="animate-spin" /></div>
          : tickets.length === 0 ? <p className="p-6 text-center text-slate-500 text-sm">No tickets yet.</p>
          : tickets.map((t) => (
            <button key={t.id} onClick={() => openTicket(t)}
              className={clsx('w-full text-left px-4 py-3 hover:bg-white/5 transition-colors', active?.id === t.id && 'bg-white/5')}>
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-white text-sm truncate flex items-center gap-1.5">
                  {t.admin_unread && t.status === 'open' && <span className="w-2 h-2 rounded-full bg-loss shrink-0" />}
                  {t.who}
                </span>
                <span className="text-[10px] text-slate-500 shrink-0">{ago(t.last_message_at)}</span>
              </div>
              <p className="text-xs text-slate-400 truncate mt-0.5">{t.preview_sender === 'admin' ? 'You: ' : ''}{t.preview}</p>
              {t.status === 'closed' && <span className="text-[10px] text-slate-600">closed</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Conversation */}
      <div className="glass-card rounded-2xl flex flex-col overflow-hidden">
        {!active ? (
          <div className="flex-1 grid place-items-center text-slate-500 text-sm">Select a ticket to view the conversation.</div>
        ) : (
          <>
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/8">
              <div className="min-w-0">
                <p className="font-bold text-white text-sm truncate">{active.who}</p>
                {active.wallet && <p className="text-[11px] font-mono text-slate-500 truncate">{active.wallet}</p>}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {active.status === 'open'
                  ? <button onClick={() => setStatus('close')} className="text-xs flex items-center gap-1 text-slate-400 hover:text-loss"><CheckCircle size={13} /> Close</button>
                  : <button onClick={() => setStatus('reopen')} className="text-xs flex items-center gap-1 text-slate-400 hover:text-win"><Circle size={13} /> Reopen</button>}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
              {msgs.map((m) => (
                <div key={m.id} className={`flex ${m.sender === 'admin' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[78%] rounded-2xl px-3.5 py-2 text-sm whitespace-pre-wrap break-words ${m.sender === 'admin' ? 'bg-cyan text-black rounded-br-sm' : 'bg-white/8 text-slate-100 rounded-bl-sm'}`}>
                    {m.body}
                  </div>
                </div>
              ))}
              <div ref={endRef} />
            </div>
            <div className="border-t border-white/10 p-3 flex items-end gap-2">
              <textarea value={reply} onChange={(e) => setReply(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                rows={1} placeholder="Reply to user…"
                className="flex-1 resize-none bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-cyan/40 max-h-28" />
              <button onClick={send} disabled={sending || !reply.trim()} className="shrink-0 w-10 h-10 rounded-xl bg-sol-gradient text-black grid place-items-center disabled:opacity-50">
                {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, Send, Minimize2, Clock } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";

interface SupportMessage {
  id: string;
  content: string;
  is_admin: boolean;
  created_at: string;
}

export const SupportChat = () => {
  const { user, profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState("");
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [ticketStatus, setTicketStatus] = useState<string>("open");
  const [subject, setSubject] = useState("");
  const [creating, setCreating] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user || !open) return;
    const findTicket = async () => {
      const { data } = await supabase
        .from("support_tickets")
        .select("id, status")
        .eq("user_id", user.id)
        .in("status", ["open", "in_progress"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) {
        setTicketId(data.id);
        setTicketStatus(data.status || "open");
        fetchMessages(data.id);
      } else {
        setCreating(true);
      }
    };
    findTicket();
  }, [user, open]);

  useEffect(() => {
    if (!ticketId) return;
    const channel = supabase.channel(`support-widget-${ticketId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "support_messages", filter: `ticket_id=eq.${ticketId}` },
        (payload) => setMessages(prev => [...prev, payload.new as SupportMessage])
      )
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "support_tickets", filter: `id=eq.${ticketId}` },
        (payload: any) => setTicketStatus(payload.new.status || "open")
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [ticketId]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const fetchMessages = async (tid: string) => {
    const { data } = await supabase.from("support_messages").select("*").eq("ticket_id", tid).order("created_at", { ascending: true });
    setMessages((data as SupportMessage[]) || []);
  };

  const createTicket = async () => {
    if (!user || !subject.trim()) return;
    const username = profile?.username || "Anonymous";
    const { data, error } = await supabase.from("support_tickets").insert({
      user_id: user.id,
      username,
      subject: subject.trim(),
    }).select("id").single();
    if (error || !data) { toast({ title: "Error creating ticket", variant: "destructive" }); return; }

    // Auto-send initial message
    await supabase.from("support_messages").insert({
      ticket_id: data.id,
      user_id: user.id,
      content: `@${username} has started a support ticket: "${subject.trim()}"`,
      is_admin: false,
    });

    setTicketId(data.id);
    setTicketStatus("open");
    setCreating(false);
    setSubject("");
  };

  const sendMessage = async () => {
    if (!user || !ticketId || !msg.trim()) return;
    await supabase.from("support_messages").insert({
      ticket_id: ticketId,
      user_id: user.id,
      content: msg.trim(),
      is_admin: false,
    });
    setMsg("");
  };

  if (!user) return null;

  return (
    <>
      {!open && (
        <button onClick={() => setOpen(true)} className="fixed bottom-20 right-4 lg:bottom-6 lg:right-6 z-[100] p-4 rounded-full bg-gradient-to-r from-primary to-accent text-primary-foreground shadow-2xl shadow-primary/40 hover:scale-110 transition-transform">
          <MessageCircle className="h-6 w-6" />
        </button>
      )}

      {open && (
        <div className="fixed bottom-20 right-4 lg:bottom-6 lg:right-6 z-[100] w-[340px] max-h-[480px] rounded-2xl overflow-hidden border border-border/50 shadow-2xl bg-card flex flex-col">
          {/* Header */}
          <div className="p-3 bg-gradient-to-r from-primary to-accent text-primary-foreground flex items-center justify-between">
            <div>
              <h3 className="font-bold text-sm">Support Chat</h3>
              <p className="text-[10px] opacity-80">
                {ticketStatus === "in_progress" ? "🟢 Admin is here" : "We usually reply within minutes"}
              </p>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setOpen(false)} className="text-primary-foreground hover:bg-white/20 h-8 w-8">
              <Minimize2 className="h-4 w-4" />
            </Button>
          </div>

          {/* Waiting indicator */}
          {ticketId && ticketStatus === "open" && (
            <div className="px-3 py-2 bg-yellow-500/10 border-b border-yellow-500/20 flex items-center gap-2">
              <Clock className="h-3.5 w-3.5 text-yellow-400 animate-pulse" />
              <span className="text-[11px] text-yellow-400">Waiting on admin...</span>
            </div>
          )}

          {creating ? (
            <div className="p-4 space-y-3">
              <p className="text-sm text-muted-foreground">What do you need help with?</p>
              <Input placeholder="Describe your issue..." value={subject} onChange={e => setSubject(e.target.value)} className="rounded-xl" />
              <Button onClick={createTicket} disabled={!subject.trim()} className="w-full rounded-xl">Start Chat</Button>
            </div>
          ) : (
            <>
              <ScrollArea className="flex-1 max-h-[320px] p-3">
                <div className="space-y-2">
                  {messages.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-4">Send a message to get started</p>
                  )}
                  {messages.map(m => (
                    <div key={m.id} className={`flex ${m.is_admin ? '' : 'justify-end'}`}>
                      <div className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm ${m.is_admin ? 'bg-muted/50 rounded-bl-md' : 'bg-primary text-primary-foreground rounded-br-md'}`}>
                        {m.is_admin && <p className="text-[9px] text-primary font-bold mb-0.5">Admin Support</p>}
                        <p>{m.content}</p>
                        <p className="text-[9px] opacity-50 mt-0.5">{formatDistanceToNow(new Date(m.created_at), { addSuffix: true })}</p>
                      </div>
                    </div>
                  ))}
                  <div ref={endRef} />
                </div>
              </ScrollArea>
              <div className="p-2 border-t border-border/30 flex gap-2">
                <Input placeholder="Type..." value={msg} onChange={e => setMsg(e.target.value)} onKeyDown={e => e.key === "Enter" && sendMessage()} className="rounded-xl text-sm h-9" />
                <Button onClick={sendMessage} size="icon" className="rounded-xl h-9 w-9 shrink-0"><Send className="h-3.5 w-3.5" /></Button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
};

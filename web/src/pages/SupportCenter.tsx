import { useState, useEffect, useRef } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import {
  MessageCircle, Send, Headphones, Clock, CheckCircle, AlertCircle,
  Plus, ArrowLeft, Users, Inbox, Search, RefreshCw, UserPlus
} from "lucide-react";

interface Ticket {
  id: string;
  user_id: string;
  username: string | null;
  subject: string;
  status: string | null;
  created_at: string | null;
  updated_at: string | null;
}

interface Message {
  id: string;
  ticket_id: string;
  user_id: string;
  content: string;
  is_admin: boolean | null;
  created_at: string | null;
}

const SupportCenter = () => {
  const { user, profile } = useAuth();
  const { isAdmin, isOwner } = useAdmin();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [activeTicket, setActiveTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [msg, setMsg] = useState("");
  const [subject, setSubject] = useState("");
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  const isAdminUser = isAdmin || isOwner;

  useEffect(() => {
    if (!user) return;
    fetchTickets();
    const channel = supabase
      .channel("support-tickets-all")
      .on("postgres_changes", { event: "*", schema: "public", table: "support_tickets" }, () => fetchTickets())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, isAdminUser]);

  useEffect(() => {
    if (!activeTicket) return;
    fetchMessages(activeTicket.id);
    const channel = supabase
      .channel(`support-msg-${activeTicket.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "support_messages", filter: `ticket_id=eq.${activeTicket.id}` },
        (payload) => setMessages(prev => [...prev, payload.new as Message])
      ).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeTicket]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const fetchTickets = async () => {
    setLoading(true);
    if (isAdminUser) {
      const { data } = await supabase.from("support_tickets").select("*").order("updated_at", { ascending: false });
      setTickets(data || []);
    } else {
      const { data } = await supabase.from("support_tickets").select("*").eq("user_id", user!.id).order("created_at", { ascending: false });
      setTickets(data || []);
    }
    setLoading(false);
  };

  const fetchMessages = async (ticketId: string) => {
    const { data } = await supabase.from("support_messages").select("*").eq("ticket_id", ticketId).order("created_at", { ascending: true });
    setMessages((data || []) as Message[]);
  };

  const createTicket = async () => {
    if (!user || !subject.trim()) return;
    const username = profile?.username || "Anonymous";
    const { data, error } = await supabase.from("support_tickets").insert({
      user_id: user.id,
      username,
      subject: subject.trim(),
    }).select().single();
    if (error || !data) { toast.error("Failed to create ticket"); return; }

    // Auto-send a system message so admin sees "@username has started a ticket"
    await supabase.from("support_messages").insert({
      ticket_id: data.id,
      user_id: user.id,
      content: `@${username} has started a support ticket: "${subject.trim()}"`,
      is_admin: false,
    });

    setActiveTicket(data);
    setCreating(false);
    setSubject("");
    fetchTickets();
  };

  const joinTicket = async (ticket: Ticket) => {
    setActiveTicket(ticket);
    // If admin is joining an open ticket, mark as in_progress and send join message
    if (isAdminUser && ticket.status === "open") {
      await supabase.from("support_tickets").update({ status: "in_progress" }).eq("id", ticket.id);
      await supabase.from("support_messages").insert({
        ticket_id: ticket.id,
        user_id: user!.id,
        content: "Admin has joined the chat. How can I help you?",
        is_admin: true,
      });
      setActiveTicket({ ...ticket, status: "in_progress" });
      fetchTickets();
    }
  };

  const sendMessage = async () => {
    if (!user || !activeTicket || !msg.trim()) return;
    const { error } = await supabase.from("support_messages").insert({
      ticket_id: activeTicket.id,
      user_id: user.id,
      content: msg.trim(),
      is_admin: isAdminUser,
    });
    if (error) { toast.error("Failed to send message"); return; }
    setMsg("");
  };

  const updateTicketStatus = async (ticketId: string, status: string) => {
    await supabase.from("support_tickets").update({ status }).eq("id", ticketId);
    if (activeTicket?.id === ticketId) {
      setActiveTicket({ ...activeTicket, status });
    }
    fetchTickets();
    toast.success(`Ticket ${status}`);
  };

  const getStatusColor = (status: string | null) => {
    switch (status) {
      case "open": return "bg-green-500/20 text-green-400 border-green-500/30";
      case "in_progress": return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
      case "resolved": return "bg-muted text-muted-foreground border-border";
      default: return "bg-primary/20 text-primary border-primary/30";
    }
  };

  const getStatusIcon = (status: string | null) => {
    switch (status) {
      case "open": return <AlertCircle className="h-3 w-3" />;
      case "in_progress": return <Clock className="h-3 w-3" />;
      case "resolved": return <CheckCircle className="h-3 w-3" />;
      default: return <MessageCircle className="h-3 w-3" />;
    }
  };

  const getStatusLabel = (status: string | null) => {
    if (!isAdminUser) {
      switch (status) {
        case "open": return "Waiting on admin";
        case "in_progress": return "Live chat";
        case "resolved": return "Resolved";
        default: return status || "open";
      }
    }
    return status || "open";
  };

  const filteredTickets = tickets.filter(t =>
    !searchQuery ||
    t.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.username?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Chat view
  if (activeTicket) {
    return (
      <AppLayout>
        <div className="flex flex-col h-[calc(100vh-60px)] lg:h-screen">
          {/* Header */}
          <div className="shrink-0 border-b border-border/40 bg-card/80 backdrop-blur-xl p-4 flex items-center gap-3">
            <button onClick={() => { setActiveTicket(null); setMessages([]); }} className="p-2 rounded-xl bg-muted/20 hover:bg-muted/40 text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="flex-1 min-w-0">
              <h2 className="text-sm font-bold truncate">{activeTicket.subject}</h2>
              <div className="flex items-center gap-2 mt-0.5">
                {isAdminUser && <span className="text-[10px] text-muted-foreground">From: @{activeTicket.username}</span>}
                <Badge className={`text-[8px] gap-1 ${getStatusColor(activeTicket.status)}`}>
                  {getStatusIcon(activeTicket.status)}
                  {getStatusLabel(activeTicket.status)}
                </Badge>
              </div>
            </div>
            {isAdminUser && (
              <div className="flex gap-1.5">
                {activeTicket.status !== "resolved" && (
                  <Button size="sm" variant="outline" className="text-xs rounded-xl h-8" onClick={() => updateTicketStatus(activeTicket.id, "resolved")}>
                    <CheckCircle className="h-3 w-3 mr-1" /> Resolve
                  </Button>
                )}
                {activeTicket.status === "resolved" && (
                  <Button size="sm" variant="outline" className="text-xs rounded-xl h-8" onClick={() => updateTicketStatus(activeTicket.id, "open")}>
                    Reopen
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* User waiting indicator */}
          {!isAdminUser && activeTicket.status === "open" && (
            <div className="px-4 py-3 bg-yellow-500/10 border-b border-yellow-500/20 flex items-center gap-2">
              <Clock className="h-4 w-4 text-yellow-400 animate-pulse" />
              <span className="text-sm text-yellow-400">Waiting for admin to join...</span>
            </div>
          )}

          {/* Live chat indicator */}
          {activeTicket.status === "in_progress" && (
            <div className="px-4 py-2 bg-green-500/10 border-b border-green-500/20 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs text-green-400">Live support chat active</span>
            </div>
          )}

          {/* Messages */}
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-3 max-w-2xl mx-auto">
              {messages.length === 0 && (
                <div className="text-center py-12">
                  <MessageCircle className="h-10 w-10 text-muted-foreground/20 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">No messages yet. Start the conversation!</p>
                </div>
              )}
              {messages.map(m => (
                <div key={m.id} className={`flex ${m.is_admin ? '' : 'justify-end'}`}>
                  <div className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm ${
                    m.is_admin
                      ? 'bg-muted/40 rounded-bl-md border border-border/30'
                      : 'bg-gradient-to-r from-primary to-accent text-primary-foreground rounded-br-md'
                  }`}>
                    {m.is_admin && (
                      <p className="text-[10px] text-primary font-bold mb-1 flex items-center gap-1">
                        <Headphones className="h-3 w-3" /> Admin Support
                      </p>
                    )}
                    {!m.is_admin && (
                      <p className="text-[10px] font-bold mb-1 opacity-70">
                        @{activeTicket.username || "user"}
                      </p>
                    )}
                    <p className="leading-relaxed">{m.content}</p>
                    <p className="text-[9px] opacity-50 mt-1.5">
                      {m.created_at ? formatDistanceToNow(new Date(m.created_at), { addSuffix: true }) : ''}
                    </p>
                  </div>
                </div>
              ))}
              <div ref={endRef} />
            </div>
          </ScrollArea>

          {/* Input */}
          <div className="shrink-0 p-3 border-t border-border/40 bg-card/50 backdrop-blur-xl">
            <div className="flex gap-2 max-w-2xl mx-auto">
              <Input
                placeholder={isAdminUser ? "Reply to user..." : "Type your message..."}
                value={msg}
                onChange={e => setMsg(e.target.value)}
                onKeyDown={e => e.key === "Enter" && sendMessage()}
                className="rounded-xl"
              />
              <Button onClick={sendMessage} disabled={!msg.trim()} className="rounded-xl shrink-0 gap-1.5">
                <Send className="h-4 w-4" /> Send
              </Button>
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  // Ticket list view
  return (
    <AppLayout>
      <PageHeader
        title={isAdminUser ? "Support Inbox" : "Support Center"}
        description={isAdminUser ? "Manage and respond to user support requests" : "Get help from our team"}
      >
        <div className="flex items-center gap-2">
          <Badge className="bg-primary/20 text-primary border-primary/30 gap-1">
            <Inbox className="h-3 w-3" />
            {tickets.filter(t => t.status === "open" || t.status === "in_progress").length} active
          </Badge>
        </div>
      </PageHeader>

      <div className="p-4 lg:p-6 space-y-4 max-w-3xl mx-auto">
        {/* Search + New */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40" />
            <Input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={isAdminUser ? "Search tickets by user or subject..." : "Search your tickets..."}
              className="pl-10 rounded-xl"
            />
          </div>
          {!isAdminUser && (
            <Button onClick={() => setCreating(true)} className="rounded-xl gap-1.5 shrink-0">
              <Plus className="h-4 w-4" /> New Ticket
            </Button>
          )}
          <Button variant="outline" size="icon" onClick={fetchTickets} className="rounded-xl shrink-0">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>

        {/* Create Ticket Form */}
        {creating && (
          <Card className="glass-card border-primary/20">
            <CardContent className="p-5 space-y-3">
              <h3 className="font-bold text-sm">New Support Request</h3>
              <Input
                placeholder="What do you need help with?"
                value={subject}
                onChange={e => setSubject(e.target.value)}
                className="rounded-xl"
              />
              <div className="flex gap-2 justify-end">
                <Button variant="ghost" onClick={() => setCreating(false)} className="rounded-xl text-xs">Cancel</Button>
                <Button onClick={createTicket} disabled={!subject.trim()} className="rounded-xl text-xs gap-1.5">
                  <Send className="h-3.5 w-3.5" /> Start Chat
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Admin Tabs */}
        {isAdminUser ? (
          <Tabs defaultValue="open">
            <TabsList className="grid w-full max-w-md grid-cols-3 bg-muted/30 rounded-xl">
              <TabsTrigger value="open" className="rounded-lg text-xs gap-1">
                <AlertCircle className="h-3.5 w-3.5" /> Open ({tickets.filter(t => t.status === "open").length})
              </TabsTrigger>
              <TabsTrigger value="in_progress" className="rounded-lg text-xs gap-1">
                <Clock className="h-3.5 w-3.5" /> Active ({tickets.filter(t => t.status === "in_progress").length})
              </TabsTrigger>
              <TabsTrigger value="resolved" className="rounded-lg text-xs gap-1">
                <CheckCircle className="h-3.5 w-3.5" /> Resolved
              </TabsTrigger>
            </TabsList>

            {["open", "in_progress", "resolved"].map(tab => (
              <TabsContent key={tab} value={tab}>
                <TicketList
                  tickets={filteredTickets.filter(t => t.status === tab)}
                  isAdmin={isAdminUser}
                  onSelect={joinTicket}
                  getStatusColor={getStatusColor}
                  getStatusIcon={getStatusIcon}
                  getStatusLabel={getStatusLabel}
                />
              </TabsContent>
            ))}
          </Tabs>
        ) : (
          <TicketList
            tickets={filteredTickets}
            isAdmin={false}
            onSelect={joinTicket}
            getStatusColor={getStatusColor}
            getStatusIcon={getStatusIcon}
            getStatusLabel={getStatusLabel}
          />
        )}

        {/* Empty state for users */}
        {!isAdminUser && tickets.length === 0 && !creating && (
          <div className="text-center py-16">
            <Headphones className="h-14 w-14 text-muted-foreground/20 mx-auto mb-4" />
            <h3 className="font-bold mb-2">Need Help?</h3>
            <p className="text-sm text-muted-foreground mb-4">Start a support chat and we'll respond as soon as possible.</p>
            <Button onClick={() => setCreating(true)} className="rounded-xl gap-1.5">
              <Plus className="h-4 w-4" /> Start Support Chat
            </Button>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

const TicketList = ({
  tickets, isAdmin, onSelect, getStatusColor, getStatusIcon, getStatusLabel,
}: {
  tickets: Ticket[];
  isAdmin: boolean;
  onSelect: (t: Ticket) => void;
  getStatusColor: (s: string | null) => string;
  getStatusIcon: (s: string | null) => React.ReactNode;
  getStatusLabel: (s: string | null) => string;
}) => {
  if (tickets.length === 0) {
    return (
      <div className="text-center py-10">
        <MessageCircle className="h-10 w-10 text-muted-foreground/20 mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">No tickets found</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {tickets.map(ticket => (
        <button
          key={ticket.id}
          onClick={() => onSelect(ticket)}
          className="w-full text-left glass-card rounded-xl p-4 hover:border-primary/20 transition-all group"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                {isAdmin && ticket.status === "open" && (
                  <UserPlus className="h-3.5 w-3.5 text-green-400 shrink-0" />
                )}
                <h3 className="text-sm font-semibold truncate group-hover:text-primary transition-colors">
                  {isAdmin && ticket.status === "open" 
                    ? `@${ticket.username || "user"} started a ticket`
                    : ticket.subject
                  }
                </h3>
                <Badge className={`text-[8px] gap-1 shrink-0 ${getStatusColor(ticket.status)}`}>
                  {getStatusIcon(ticket.status)}
                  {getStatusLabel(ticket.status)}
                </Badge>
              </div>
              {isAdmin && ticket.status === "open" && (
                <p className="text-xs text-muted-foreground truncate mb-1">{ticket.subject}</p>
              )}
              <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                {isAdmin && <span className="flex items-center gap-1"><Users className="h-3 w-3" /> @{ticket.username || "Anonymous"}</span>}
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {ticket.created_at ? formatDistanceToNow(new Date(ticket.created_at), { addSuffix: true }) : ''}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isAdmin && ticket.status === "open" && (
                <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-[9px]">Join</Badge>
              )}
              <MessageCircle className="h-4 w-4 text-muted-foreground/30 group-hover:text-primary transition-colors shrink-0" />
            </div>
          </div>
        </button>
      ))}
    </div>
  );
};

export default SupportCenter;

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { format, formatDistanceToNow } from "date-fns";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle,
  Clock,
  Headset,
  Inbox,
  Loader2,
  MessageCircle,
  Plus,
  RefreshCw,
  Search,
  Send,
  Shield,
  Sparkles,
  User,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { useAdmin } from "@/hooks/useAdmin";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { cn, safeAvatarUrl } from "@/lib/utils";

interface Ticket {
  id: string;
  user_id: string;
  username: string | null;
  subject: string;
  status: string | null;
  updated_at: string | null;
  created_at: string | null;
}

interface SupportMessage {
  id: string;
  ticket_id: string;
  user_id: string;
  content: string;
  is_admin: boolean | null;
  created_at: string | null;
}

interface SupportAgentProfile {
  user_id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  verified?: boolean | null;
  is_official_account?: boolean | null;
  affiliate_org_id?: string | null;
}

interface PresenceParticipant {
  user_id: string;
  username: string;
  display_name?: string | null;
  avatar_url?: string | null;
  typing?: boolean;
  is_agent?: boolean;
  last_seen?: string;
}

const getStatusMeta = (status: string | null) => {
  switch (status) {
    case "in_progress":
      return {
        label: "Live chat",
        icon: Clock,
        className: "border-cyan-400/30 bg-cyan-400/10 text-cyan-200",
      };
    case "resolved":
      return {
        label: "Resolved",
        icon: CheckCircle,
        className: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
      };
    case "open":
    default:
      return {
        label: "Waiting",
        icon: AlertCircle,
        className: "border-amber-400/30 bg-amber-400/10 text-amber-200",
      };
  }
};

const getAvatarFallback = (label?: string | null) => {
  const trimmed = (label || "OG").trim();
  return trimmed.slice(0, 2).toUpperCase();
};

const PresenceDots = () => (
  <div className="flex items-center gap-1">
    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:0ms]" />
    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:150ms]" />
    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:300ms]" />
  </div>
);

const AgentAvatar = ({
  agent,
  online,
  size = "md",
}: {
  agent: SupportAgentProfile;
  online: boolean;
  size?: "sm" | "md";
}) => {
  const avatarUrl = safeAvatarUrl(agent.avatar_url);
  const dimensions = size === "sm" ? "h-9 w-9" : "h-11 w-11";

  return (
    <div className="relative shrink-0">
      {avatarUrl ? (
        <img src={avatarUrl} alt="" className={cn(dimensions, "rounded-full border border-white/10 object-cover")} />
      ) : (
        <div className={cn(dimensions, "flex items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-xs font-black text-white/75")}>
          {getAvatarFallback(agent.display_name || agent.username || "OG")}
        </div>
      )}
      <span
        className={cn(
          "absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-black",
          online ? "bg-emerald-400" : "bg-white/15",
        )}
      />
    </div>
  );
};

const SupportCenter = () => {
  const { user, profile, loading: authLoading } = useAuth();
  const { isSupportAgent } = useAdmin();

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [activeTicket, setActiveTicket] = useState<Ticket | null>(null);
  const [supportAgents, setSupportAgents] = useState<SupportAgentProfile[]>([]);
  const [onlineAgentIds, setOnlineAgentIds] = useState<Set<string>>(new Set());
  const [roomParticipants, setRoomParticipants] = useState<PresenceParticipant[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [subject, setSubject] = useState("");
  const [draftOpeningMessage, setDraftOpeningMessage] = useState("");
  const [draftMessage, setDraftMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [ticketFilter, setTicketFilter] = useState<"all" | "open" | "in_progress" | "resolved">("all");

  const bottomRef = useRef<HTMLDivElement>(null);
  const rosterChannelRef = useRef<any>(null);
  const roomChannelRef = useRef<any>(null);
  const typingTimeoutRef = useRef<number | null>(null);

  const displayHandle = profile?.username || profile?.display_name || user?.email?.split("@")[0] || "user";

  const refreshTickets = useCallback(async (showSpinner = false) => {
    if (!user) return;

    if (showSpinner) setRefreshing(true);
    else setLoadingTickets(true);

    try {
      let query = supabase.from("support_tickets").select("*").order("updated_at", { ascending: false });
      if (!isSupportAgent) {
        query = query.eq("user_id", user.id);
      }

      const { data, error } = await query;
      if (error) throw error;

      const nextTickets = (data || []) as Ticket[];
      setTickets(nextTickets);
      setActiveTicket((current) => {
        if (!current) return current;
        return nextTickets.find((ticket) => ticket.id === current.id) || current;
      });
    } catch (error) {
      console.error("failed to load support tickets", error);
      toast.error("Could not load support tickets");
    } finally {
      setLoadingTickets(false);
      setRefreshing(false);
    }
  }, [isSupportAgent, user]);

  const fetchMessages = useCallback(async (ticketId: string) => {
    setLoadingMessages(true);
    try {
      const { data, error } = await supabase
        .from("support_messages")
        .select("*")
        .eq("ticket_id", ticketId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      setMessages((data || []) as SupportMessage[]);
    } catch (error) {
      console.error("failed to load support messages", error);
      toast.error("Could not load chat history");
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  const fetchSupportAgents = useCallback(async () => {
    if (!user) return;

    try {
      const [officialResponse, affiliateResponse] = await Promise.all([
        supabase
          .from("profiles")
          .select("user_id, username, display_name, avatar_url, verified, is_official_account, affiliate_org_id")
          .eq("is_official_account", true),
        supabase
          .from("profiles")
          .select("user_id, username, display_name, avatar_url, verified, is_official_account, affiliate_org_id")
          .not("affiliate_org_id", "is", null),
      ]);

      const merged = new Map<string, SupportAgentProfile>();
      for (const row of [
        ...((officialResponse.data || []) as SupportAgentProfile[]),
        ...((affiliateResponse.data || []) as SupportAgentProfile[]),
      ]) {
        merged.set(row.user_id, row);
      }

      if (isSupportAgent) {
        merged.set(user.id, {
          user_id: user.id,
          username: profile?.username || null,
          display_name: profile?.display_name || null,
          avatar_url: profile?.avatar_url || null,
          verified: profile?.verified || null,
          is_official_account: profile?.is_official_account || false,
          affiliate_org_id: profile?.affiliate_org_id || null,
        });
      }

      setSupportAgents(Array.from(merged.values()));
    } catch (error) {
      console.error("failed to load support agents", error);
    }
  }, [isSupportAgent, profile?.affiliate_org_id, profile?.avatar_url, profile?.display_name, profile?.is_official_account, profile?.username, profile?.verified, user]);

  useEffect(() => {
    if (!user) return;
    refreshTickets();
    fetchSupportAgents();
  }, [fetchSupportAgents, refreshTickets, user]);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("support-tickets-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "support_tickets" }, () => {
        refreshTickets(true);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refreshTickets, user]);

  useEffect(() => {
    if (!user) return;

    const rosterChannel = supabase.channel("support-roster", {
      config: { presence: { key: user.id } },
    });

    rosterChannel
      .on("presence", { event: "sync" }, () => {
        const state = rosterChannel.presenceState();
        const nextOnline = new Set<string>();

        Object.entries(state).forEach(([key, entries]) => {
          const participants = Array.isArray(entries) ? (entries as any[]) : [];
          const agentOnline = participants.some((entry) => entry?.is_agent);
          if (agentOnline) nextOnline.add(key);
        });

        setOnlineAgentIds(nextOnline);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED" && isSupportAgent) {
          await rosterChannel.track({
            user_id: user.id,
            username: profile?.username || displayHandle,
            display_name: profile?.display_name || null,
            avatar_url: profile?.avatar_url || null,
            is_agent: true,
            last_seen: new Date().toISOString(),
          });
        }
      });

    rosterChannelRef.current = rosterChannel;

    return () => {
      if (rosterChannelRef.current) {
        rosterChannelRef.current.untrack?.();
        supabase.removeChannel(rosterChannelRef.current);
        rosterChannelRef.current = null;
      }
    };
  }, [displayHandle, isSupportAgent, profile?.avatar_url, profile?.display_name, profile?.username, user]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const closeRoomChannel = useCallback(() => {
    if (typingTimeoutRef.current) {
      window.clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
    if (roomChannelRef.current) {
      roomChannelRef.current.untrack?.();
      supabase.removeChannel(roomChannelRef.current);
      roomChannelRef.current = null;
    }
    setRoomParticipants([]);
  }, []);

  useEffect(() => {
    if (!user || !activeTicket) {
      closeRoomChannel();
      return;
    }

    fetchMessages(activeTicket.id);

    const messageChannel = supabase
      .channel(`support-messages-${activeTicket.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "support_messages", filter: `ticket_id=eq.${activeTicket.id}` },
        () => {
          fetchMessages(activeTicket.id);
          refreshTickets(true);
        },
      )
      .subscribe();

    const roomChannel = supabase.channel(`support-room-${activeTicket.id}`, {
      config: { presence: { key: user.id } },
    });

    roomChannel
      .on("presence", { event: "sync" }, () => {
        const state = roomChannel.presenceState();
        const nextParticipants: PresenceParticipant[] = [];

        Object.entries(state).forEach(([key, entries]) => {
          const participants = Array.isArray(entries) ? (entries as any[]) : [];
          participants.forEach((entry) => {
            nextParticipants.push({
              user_id: entry?.user_id || key,
              username: entry?.username || "user",
              display_name: entry?.display_name || null,
              avatar_url: entry?.avatar_url || null,
              typing: Boolean(entry?.typing),
              is_agent: Boolean(entry?.is_agent),
              last_seen: entry?.last_seen,
            });
          });
        });

        const deduped = new Map<string, PresenceParticipant>();
        nextParticipants.forEach((participant) => {
          deduped.set(participant.user_id, participant);
        });
        setRoomParticipants(Array.from(deduped.values()));
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await roomChannel.track({
            user_id: user.id,
            username: profile?.username || displayHandle,
            display_name: profile?.display_name || null,
            avatar_url: profile?.avatar_url || null,
            typing: false,
            is_agent: isSupportAgent,
            last_seen: new Date().toISOString(),
          });
        }
      });

    roomChannelRef.current = roomChannel;

    if (isSupportAgent && activeTicket.status === "open") {
      supabase
        .from("support_tickets")
        .update({ status: "in_progress", updated_at: new Date().toISOString() })
        .eq("id", activeTicket.id)
        .then(() => refreshTickets(true))
        .catch(() => null);
    }

    return () => {
      supabase.removeChannel(messageChannel);
      closeRoomChannel();
    };
  }, [activeTicket, closeRoomChannel, displayHandle, fetchMessages, isSupportAgent, profile?.avatar_url, profile?.display_name, profile?.username, refreshTickets, user]);

  const updateRoomPresence = useCallback(async (typing: boolean) => {
    if (!roomChannelRef.current || !user) return;
    await roomChannelRef.current.track({
      user_id: user.id,
      username: profile?.username || displayHandle,
      display_name: profile?.display_name || null,
      avatar_url: profile?.avatar_url || null,
      typing,
      is_agent: isSupportAgent,
      last_seen: new Date().toISOString(),
    });
  }, [displayHandle, isSupportAgent, profile?.avatar_url, profile?.display_name, profile?.username, user]);

  const broadcastTyping = useCallback(() => {
    void updateRoomPresence(true);
    if (typingTimeoutRef.current) {
      window.clearTimeout(typingTimeoutRef.current);
    }
    typingTimeoutRef.current = window.setTimeout(() => {
      void updateRoomPresence(false);
      typingTimeoutRef.current = null;
    }, 1800);
  }, [updateRoomPresence]);

  const createTicket = async () => {
    if (!user || !subject.trim()) return;

    try {
      const { data, error } = await supabase
        .from("support_tickets")
        .insert({
          user_id: user.id,
          username: profile?.username || displayHandle,
          subject: subject.trim(),
          status: "open",
          updated_at: new Date().toISOString(),
        })
        .select("*")
        .single();

      if (error || !data) throw error || new Error("Ticket creation failed");

      if (draftOpeningMessage.trim()) {
        const { error: messageError } = await supabase.from("support_messages").insert({
          ticket_id: data.id,
          user_id: user.id,
          content: draftOpeningMessage.trim(),
          is_admin: false,
        });
        if (messageError) throw messageError;
      }

      setCreating(false);
      setSubject("");
      setDraftOpeningMessage("");
      setActiveTicket(data as Ticket);
      toast.success("Support ticket created");
      refreshTickets(true);
    } catch (error) {
      console.error("failed to create ticket", error);
      toast.error("Could not create support ticket");
    }
  };

  const sendMessage = async () => {
    if (!user || !activeTicket || !draftMessage.trim() || sending) return;

    setSending(true);
    try {
      const messageBody = draftMessage.trim();
      const { error } = await supabase.from("support_messages").insert({
        ticket_id: activeTicket.id,
        user_id: user.id,
        content: messageBody,
        is_admin: isSupportAgent,
      });
      if (error) throw error;

      const nextStatus = isSupportAgent ? "in_progress" : activeTicket.status === "resolved" ? "open" : activeTicket.status || "open";
      const { error: ticketError } = await supabase
        .from("support_tickets")
        .update({ status: nextStatus, updated_at: new Date().toISOString() })
        .eq("id", activeTicket.id);

      if (ticketError) throw ticketError;

      setDraftMessage("");
      await updateRoomPresence(false);
      refreshTickets(true);
    } catch (error) {
      console.error("failed to send support message", error);
      toast.error("Could not send message");
    } finally {
      setSending(false);
    }
  };

  const updateTicketStatus = async (ticketId: string, status: "open" | "in_progress" | "resolved") => {
    try {
      const { error } = await supabase
        .from("support_tickets")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", ticketId);
      if (error) throw error;

      setActiveTicket((current) => current?.id === ticketId ? { ...current, status } : current);
      refreshTickets(true);
      toast.success(status === "resolved" ? "Ticket resolved" : status === "open" ? "Ticket reopened" : "Ticket set live");
    } catch (error) {
      console.error("failed to update support ticket", error);
      toast.error("Could not update ticket status");
    }
  };

  const filteredTickets = useMemo(() => {
    return tickets.filter((ticket) => {
      const matchesQuery = !searchQuery.trim()
        || ticket.subject?.toLowerCase().includes(searchQuery.toLowerCase())
        || ticket.username?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesFilter = ticketFilter === "all" || (ticket.status || "open") === ticketFilter;
      return matchesQuery && matchesFilter;
    });
  }, [searchQuery, ticketFilter, tickets]);

  const onlineAgents = useMemo(
    () => supportAgents.filter((agent) => onlineAgentIds.has(agent.user_id)),
    [onlineAgentIds, supportAgents],
  );

  const agentParticipants = useMemo(
    () => roomParticipants.filter((participant) => participant.is_agent),
    [roomParticipants],
  );

  const typingParticipants = useMemo(
    () => roomParticipants.filter((participant) => participant.typing && participant.user_id !== user?.id),
    [roomParticipants, user?.id],
  );

  const activeStatusMeta = getStatusMeta(activeTicket?.status || "open");

  if (authLoading) {
    return (
      <AppLayout>
        <div className="flex min-h-[70vh] items-center justify-center">
          <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/65">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading support center…
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!user) {
    return (
      <AppLayout>
        <div className="mx-auto max-w-3xl px-4 py-10">
          <Card className="border-white/10 bg-black text-white">
            <CardContent className="space-y-4 p-6 sm:p-8">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-400/25 bg-cyan-400/10 text-cyan-200">
                <Headset className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-2xl font-black">Support Chat</h1>
                <p className="mt-2 text-sm leading-6 text-white/60">
                  Sign in to create a ticket, message the team, and get live support updates.
                </p>
              </div>
              <Button onClick={() => (window.location.href = "/auth")} className="rounded-full bg-white px-5 text-black hover:bg-white/90">
                Sign in
              </Button>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  if (activeTicket) {
    const StatusIcon = activeStatusMeta.icon;

    return (
      <AppLayout>
        <div className="flex h-[calc(100vh-64px)] flex-col bg-black text-white lg:h-screen">
          <div className="border-b border-white/10 bg-black/95 px-4 py-3 backdrop-blur-xl sm:px-6">
            <div className="mx-auto flex w-full max-w-5xl items-start gap-3">
              <button
                type="button"
                onClick={() => {
                  setActiveTicket(null);
                  setMessages([]);
                }}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full transition hover:bg-white/10"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="truncate text-lg font-black">{activeTicket.subject}</h2>
                  <Badge className={cn("gap-1 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em]", activeStatusMeta.className)}>
                    <StatusIcon className="h-3 w-3" />
                    {activeStatusMeta.label}
                  </Badge>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-white/45">
                  <span>@{activeTicket.username || "user"}</span>
                  <span>{activeTicket.created_at ? `Opened ${formatDistanceToNow(new Date(activeTicket.created_at), { addSuffix: true })}` : "Recently opened"}</span>
                  {activeTicket.updated_at ? <span>{`Updated ${formatDistanceToNow(new Date(activeTicket.updated_at), { addSuffix: true })}`}</span> : null}
                </div>
              </div>

              {isSupportAgent ? (
                <div className="flex shrink-0 flex-wrap gap-2">
                  {activeTicket.status !== "in_progress" ? (
                    <Button
                      variant="outline"
                      onClick={() => updateTicketStatus(activeTicket.id, "in_progress")}
                      className="rounded-full border-white/15 bg-transparent text-white hover:bg-white/10 hover:text-white"
                    >
                      Go live
                    </Button>
                  ) : null}
                  {activeTicket.status !== "resolved" ? (
                    <Button
                      onClick={() => updateTicketStatus(activeTicket.id, "resolved")}
                      className="rounded-full bg-white px-4 text-black hover:bg-white/90"
                    >
                      Resolve
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      onClick={() => updateTicketStatus(activeTicket.id, "open")}
                      className="rounded-full border-white/15 bg-transparent text-white hover:bg-white/10 hover:text-white"
                    >
                      Reopen
                    </Button>
                  )}
                </div>
              ) : null}
            </div>
          </div>

          <div className="border-b border-white/10 bg-white/[0.03] px-4 py-3 sm:px-6">
            <div className="mx-auto flex max-w-5xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-white/35">Agents in chat</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {agentParticipants.length > 0 ? agentParticipants.map((participant) => (
                    <div key={participant.user_id} className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-xs text-emerald-100">
                      <span className="h-2 w-2 rounded-full bg-emerald-400" />
                      <span>{participant.display_name || participant.username}</span>
                    </div>
                  )) : (
                    <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1.5 text-xs text-amber-100">
                      <Clock className="h-3.5 w-3.5" />
                      {isSupportAgent ? "Waiting for the user to join the room" : "Waiting for an agent to join the room"}
                    </div>
                  )}
                </div>
              </div>

              {typingParticipants.length > 0 ? (
                <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1.5 text-xs text-cyan-100">
                  <PresenceDots />
                  <span>
                    {typingParticipants.map((participant) => participant.display_name || participant.username).join(", ")} {typingParticipants.length > 1 ? "are" : "is"} typing…
                  </span>
                </div>
              ) : (
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white/55">
                  <Headset className="h-3.5 w-3.5" />
                  {agentParticipants.length > 0 ? "Agent online in chat" : "Room presence updates live"}
                </div>
              )}
            </div>
          </div>

          <ScrollArea className="flex-1">
            <div className="mx-auto flex min-h-full w-full max-w-5xl flex-col gap-4 px-4 py-5 sm:px-6">
              {loadingMessages ? (
                <div className="flex flex-1 items-center justify-center">
                  <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-white/60">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading messages…
                  </div>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-1 items-center justify-center">
                  <div className="max-w-md rounded-3xl border border-white/10 bg-white/[0.03] p-6 text-center">
                    <MessageCircle className="mx-auto h-10 w-10 text-white/20" />
                    <p className="mt-3 text-sm font-semibold text-white">No messages yet</p>
                    <p className="mt-2 text-sm leading-6 text-white/50">
                      {isSupportAgent ? "Reply here to start helping this user." : "Send your first message and the team will reply here live."}
                    </p>
                  </div>
                </div>
              ) : (
                messages.map((message) => {
                  const mine = message.user_id === user.id;
                  const fromAgent = Boolean(message.is_admin);
                  return (
                    <div key={message.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                      <div className={cn("max-w-[88%] rounded-[24px] border px-4 py-3 sm:max-w-[72%]", mine ? "border-cyan-400/20 bg-cyan-400/12 text-white" : "border-white/10 bg-white/[0.04] text-white") }>
                        <div className="mb-1.5 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-white/45">
                          {fromAgent ? <Shield className="h-3.5 w-3.5 text-amber-300" /> : <User className="h-3.5 w-3.5 text-cyan-300" />}
                          <span>{fromAgent ? "Support Agent" : mine ? "You" : `@${activeTicket.username || "user"}`}</span>
                        </div>
                        <p className="whitespace-pre-wrap break-words text-sm leading-6 text-white/92">{message.content}</p>
                        <p className="mt-2 text-[11px] text-white/35">
                          {message.created_at ? format(new Date(message.created_at), "MMM d, h:mm a") : "Just now"}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={bottomRef} />
            </div>
          </ScrollArea>

          <div className="border-t border-white/10 bg-black/95 px-4 py-3 backdrop-blur-xl sm:px-6">
            <div className="mx-auto max-w-5xl">
              <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-3">
                <Textarea
                  value={draftMessage}
                  onChange={(event) => {
                    setDraftMessage(event.target.value);
                    broadcastTyping();
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      void sendMessage();
                    }
                  }}
                  placeholder={isSupportAgent ? "Reply as support agent…" : "Describe the issue or reply here…"}
                  className="min-h-[96px] border-0 bg-transparent px-1 text-white placeholder:text-white/30 focus-visible:ring-0"
                />
                <div className="mt-3 flex items-center justify-between gap-3">
                  <div className="text-xs text-white/40">
                    {isSupportAgent ? "Typing and room presence update live for the user." : "You will see agent presence and typing live here."}
                  </div>
                  <Button
                    onClick={() => void sendMessage()}
                    disabled={!draftMessage.trim() || sending}
                    className="rounded-full bg-white px-4 text-black hover:bg-white/90"
                  >
                    {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                    Send
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <PageHeader
        title={isSupportAgent ? "Support Inbox" : "Support Chat"}
        description={isSupportAgent ? "Live ticket inbox for official and affiliate team accounts." : "Open a ticket, chat with the team, and follow replies live."}
      >
        <Badge className="gap-1 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-100">
          <Inbox className="h-3 w-3" />
          {tickets.filter((ticket) => (ticket.status || "open") !== "resolved").length} active
        </Badge>
      </PageHeader>

      <div className="mx-auto max-w-6xl space-y-4 px-4 pb-8 lg:px-6">
        <Card className="border-white/10 bg-black text-white">
          <CardContent className="space-y-4 p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-white/35">Agent roster</p>
                <h3 className="mt-2 text-lg font-black">Who our agents are</h3>
                <p className="mt-1 text-sm text-white/55">
                  {onlineAgents.length > 0
                    ? `${onlineAgents.length} support ${onlineAgents.length === 1 ? "agent is" : "agents are"} online right now.`
                    : "No agents are live in support right now, but tickets still reach the team inbox."}
                </p>
              </div>
              {!isSupportAgent ? (
                <Button onClick={() => setCreating(true)} className="rounded-full bg-white px-5 text-black hover:bg-white/90">
                  <Plus className="mr-2 h-4 w-4" /> New ticket
                </Button>
              ) : null}
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {supportAgents.length > 0 ? supportAgents.map((agent) => {
                const online = onlineAgentIds.has(agent.user_id);
                return (
                  <div key={agent.user_id} className="flex items-center gap-3 rounded-3xl border border-white/10 bg-white/[0.03] p-4">
                    <AgentAvatar agent={agent} online={online} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-bold text-white">{agent.display_name || agent.username || "Support Agent"}</p>
                        <Badge className={cn("rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.16em]", online ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-100" : "border-white/10 bg-white/[0.04] text-white/55") }>
                          {online ? "Online" : "Offline"}
                        </Badge>
                      </div>
                      <p className="truncate text-xs text-white/45">@{agent.username || "support"}</p>
                      <p className="mt-1 text-[11px] text-white/50">
                        {agent.is_official_account ? "Official team" : agent.affiliate_org_id ? "Affiliate team" : "Support agent"}
                      </p>
                    </div>
                  </div>
                );
              }) : (
                <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/55">
                  Support agents will appear here once official or affiliate accounts are available.
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.45fr)]">
          <Card className="border-white/10 bg-black text-white">
            <CardContent className="space-y-4 p-5 sm:p-6">
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative min-w-[220px] flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
                  <Input
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder={isSupportAgent ? "Search by user or subject" : "Search your tickets"}
                    className="h-11 rounded-full border-white/10 bg-white/[0.04] pl-10 text-white placeholder:text-white/28"
                  />
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => refreshTickets(true)}
                  className="h-11 w-11 rounded-full border-white/10 bg-transparent text-white hover:bg-white/10 hover:text-white"
                >
                  {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                </Button>
              </div>

              <div className="flex flex-wrap gap-2">
                {[
                  { id: "all", label: "All" },
                  { id: "open", label: "Waiting" },
                  { id: "in_progress", label: "Live" },
                  { id: "resolved", label: "Resolved" },
                ].map((filter) => (
                  <button
                    key={filter.id}
                    type="button"
                    onClick={() => setTicketFilter(filter.id as typeof ticketFilter)}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-xs font-bold uppercase tracking-[0.16em] transition",
                      ticketFilter === filter.id
                        ? "border-cyan-400/30 bg-cyan-400/10 text-cyan-100"
                        : "border-white/10 bg-white/[0.03] text-white/55 hover:bg-white/[0.06] hover:text-white",
                    )}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>

              {!isSupportAgent && creating ? (
                <div className="rounded-[28px] border border-cyan-400/20 bg-cyan-400/6 p-4">
                  <div className="mb-3 flex items-center gap-2 text-sm font-bold text-white">
                    <Sparkles className="h-4 w-4 text-cyan-200" /> Start a new support chat
                  </div>
                  <div className="space-y-3">
                    <Input
                      value={subject}
                      onChange={(event) => setSubject(event.target.value)}
                      placeholder="What do you need help with?"
                      className="h-11 rounded-2xl border-white/10 bg-black/40 text-white placeholder:text-white/30"
                    />
                    <Textarea
                      value={draftOpeningMessage}
                      onChange={(event) => setDraftOpeningMessage(event.target.value)}
                      placeholder="Add details for the team (optional, but recommended)."
                      className="min-h-[120px] rounded-[24px] border-white/10 bg-black/40 text-white placeholder:text-white/30"
                    />
                    <div className="flex flex-wrap justify-end gap-2">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setCreating(false);
                          setSubject("");
                          setDraftOpeningMessage("");
                        }}
                        className="rounded-full border-white/10 bg-transparent text-white hover:bg-white/10 hover:text-white"
                      >
                        Cancel
                      </Button>
                      <Button onClick={createTicket} disabled={!subject.trim()} className="rounded-full bg-white px-4 text-black hover:bg-white/90">
                        <Send className="mr-2 h-4 w-4" /> Create ticket
                      </Button>
                    </div>
                  </div>
                </div>
              ) : null}

              {loadingTickets ? (
                <div className="flex items-center justify-center rounded-[28px] border border-white/10 bg-white/[0.03] px-4 py-10 text-sm text-white/60">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading tickets…
                </div>
              ) : filteredTickets.length === 0 ? (
                <div className="rounded-[28px] border border-white/10 bg-white/[0.03] px-5 py-10 text-center">
                  <MessageCircle className="mx-auto h-10 w-10 text-white/20" />
                  <p className="mt-3 text-sm font-semibold text-white">No tickets found</p>
                  <p className="mt-2 text-sm leading-6 text-white/50">
                    {isSupportAgent ? "No matching support tickets right now." : "Start a ticket and the team will reply here."}
                  </p>
                  {!isSupportAgent ? (
                    <Button onClick={() => setCreating(true)} className="mt-4 rounded-full bg-white px-5 text-black hover:bg-white/90">
                      <Plus className="mr-2 h-4 w-4" /> Start support chat
                    </Button>
                  ) : null}
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredTickets.map((ticket) => {
                    const meta = getStatusMeta(ticket.status || "open");
                    const Icon = meta.icon;
                    return (
                      <button
                        key={ticket.id}
                        type="button"
                        onClick={() => setActiveTicket(ticket)}
                        className="w-full rounded-[28px] border border-white/10 bg-white/[0.03] p-4 text-left transition hover:border-cyan-400/20 hover:bg-white/[0.05]"
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-white/70">
                            {isSupportAgent ? <Users className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="truncate text-sm font-bold text-white">{ticket.subject}</p>
                              <Badge className={cn("gap-1 rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.16em]", meta.className)}>
                                <Icon className="h-3 w-3" />
                                {meta.label}
                              </Badge>
                            </div>
                            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-white/45">
                              <span>@{ticket.username || "user"}</span>
                              {ticket.created_at ? <span>{formatDistanceToNow(new Date(ticket.created_at), { addSuffix: true })}</span> : null}
                              {ticket.updated_at ? <span>{`updated ${formatDistanceToNow(new Date(ticket.updated_at), { addSuffix: true })}`}</span> : null}
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-black text-white">
            <CardContent className="space-y-4 p-5 sm:p-6">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-white/35">How it works</p>
                <h3 className="mt-2 text-lg font-black">Live ticket chat</h3>
                <p className="mt-2 text-sm leading-6 text-white/55">
                  {isSupportAgent
                    ? "Open any ticket to join the room, reply live, and manage ticket status in real time."
                    : "Create a ticket, enter the chat room, and see when support agents are online or typing."}
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-white/35">Presence</p>
                  <p className="mt-2 text-lg font-black text-white">{onlineAgents.length}</p>
                  <p className="mt-2 text-xs leading-5 text-white/50">Support agents currently online in the inbox.</p>
                </div>
                <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-white/35">Open tickets</p>
                  <p className="mt-2 text-lg font-black text-white">{tickets.filter((ticket) => (ticket.status || "open") === "open").length}</p>
                  <p className="mt-2 text-xs leading-5 text-white/50">Tickets waiting for a live response.</p>
                </div>
                <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-white/35">Live now</p>
                  <p className="mt-2 text-lg font-black text-white">{tickets.filter((ticket) => (ticket.status || "open") === "in_progress").length}</p>
                  <p className="mt-2 text-xs leading-5 text-white/50">Chats currently active with someone in the room.</p>
                </div>
                <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-white/35">Resolved</p>
                  <p className="mt-2 text-lg font-black text-white">{tickets.filter((ticket) => (ticket.status || "open") === "resolved").length}</p>
                  <p className="mt-2 text-xs leading-5 text-white/50">Closed conversations that can still be reopened.</p>
                </div>
              </div>

              <div className="rounded-[28px] border border-cyan-400/15 bg-cyan-400/8 p-4 text-sm leading-6 text-cyan-50/90">
                <div className="flex items-center gap-2 font-bold text-cyan-100">
                  <Headset className="h-4 w-4" />
                  {isSupportAgent ? "Team mode enabled" : "User support mode enabled"}
                </div>
                <p className="mt-2 text-cyan-50/80">
                  {isSupportAgent
                    ? "Because this account has official or affiliate team status, the page opens the live support inbox instead of the user-only ticket view."
                    : "You can open tickets here and only your own conversations are shown in the list."}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
};

export default SupportCenter;

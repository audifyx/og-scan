/**
 * SupportNotificationBanner
 * Listens for new support messages in real-time and shows an iOS-style
 * banner at the top of the screen for both users and agents.
 */
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate, useLocation } from "react-router-dom";
import { MessageCircle, Shield, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface Banner {
  id: string;
  senderName: string;
  senderAvatar: string | null;
  content: string;
  isFromAgent: boolean;
  ticketId: string;
}

export function SupportNotificationBanner() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [banners, setBanners] = useState<Banner[]>([]);
  const [isAgent, setIsAgent] = useState(false);
  const [userTicketId, setUserTicketId] = useState<string | null>(null);

  // Check agent role once
  useEffect(() => {
    if (!user) return;
    supabase.from("admin_roles").select("role").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => setIsAgent(data?.role === "admin" || data?.role === "support"));
  }, [user?.id]);

  // Find user's active ticket id
  useEffect(() => {
    if (!user || isAgent) return;
    supabase.from("support_tickets")
      .select("id").eq("user_id", user.id)
      .not("status", "eq", "closed")
      .order("created_at", { ascending: false }).limit(1).maybeSingle()
      .then(({ data }) => setUserTicketId(data?.id || null));
  }, [user?.id, isAgent]);

  const dismiss = useCallback((id: string) => {
    setBanners(prev => prev.filter(b => b.id !== id));
  }, []);

  const show = useCallback((banner: Banner) => {
    setBanners(prev => [...prev.slice(-2), banner]); // max 3
    setTimeout(() => dismiss(banner.id), 5000);
  }, [dismiss]);

  // Agent: listen to ALL tickets for new user messages
  useEffect(() => {
    if (!user || !isAgent) return;
    const ch = supabase.channel("support-notif-agent")
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "support_messages",
      }, async (p) => {
        const msg = p.new as any;
        if (msg.sender_id === user.id) return; // don't notify self
        if (msg.is_admin) return; // agent doesn't need notif for their own replies
        // Skip if already on support page
        if (location.pathname === "/support") return;
        show({
          id: msg.id,
          senderName: msg.sender_name || "User",
          senderAvatar: msg.sender_avatar || null,
          content: msg.content,
          isFromAgent: false,
          ticketId: msg.ticket_id,
        });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id, isAgent, location.pathname, show]);

  // User: listen to their own ticket for agent replies
  useEffect(() => {
    if (!user || isAgent || !userTicketId) return;
    const ch = supabase.channel(`support-notif-user-${userTicketId}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "support_messages",
        filter: `ticket_id=eq.${userTicketId}`,
      }, (p) => {
        const msg = p.new as any;
        if (!msg.is_admin) return; // only show when agent replies
        if (location.pathname === "/support") return;
        show({
          id: msg.id,
          senderName: msg.sender_name || "Support",
          senderAvatar: msg.sender_avatar || null,
          content: msg.content,
          isFromAgent: true,
          ticketId: userTicketId,
        });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id, isAgent, userTicketId, location.pathname, show]);

  if (banners.length === 0) return null;

  return (
    <div className="fixed top-4 left-0 right-0 z-[9999] flex flex-col items-center gap-2 px-4 pointer-events-none">
      {banners.map(b => (
        <div
          key={b.id}
          onClick={() => { dismiss(b.id); navigate("/support"); }}
          className={cn(
            "pointer-events-auto w-full max-w-sm rounded-2xl border border-white/[0.1] shadow-2xl",
            "bg-[#111118]/95 backdrop-blur-xl",
            "flex items-center gap-3 px-4 py-3 cursor-pointer",
            "animate-in slide-in-from-top-2 duration-300"
          )}
        >
          {/* Avatar */}
          <div className="shrink-0 relative">
            {b.senderAvatar
              ? <img src={b.senderAvatar} className="h-10 w-10 rounded-full border border-white/10 object-cover" />
              : <div className={cn("h-10 w-10 rounded-full flex items-center justify-center",
                  b.isFromAgent ? "bg-og-lime/20" : "bg-white/10"
                )}>
                  {b.isFromAgent
                    ? <Shield className="h-5 w-5 text-og-lime" />
                    : <MessageCircle className="h-5 w-5 text-white/60" />}
                </div>}
            <div className={cn(
              "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#111118]",
              b.isFromAgent ? "bg-og-lime" : "bg-white/40"
            )} />
          </div>

          {/* Text */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              <p className="text-[11px] font-black text-white/60 uppercase tracking-wider">Support</p>
              {b.isFromAgent && (
                <span className="text-[9px] bg-og-lime/20 text-og-lime px-1.5 py-0.5 rounded-full font-bold">Agent</span>
              )}
            </div>
            <p className="text-sm font-semibold text-white truncate">{b.senderName}</p>
            <p className="text-xs text-white/50 truncate">{b.content}</p>
          </div>

          {/* Dismiss */}
          <button
            onClick={e => { e.stopPropagation(); dismiss(b.id); }}
            className="shrink-0 text-white/20 hover:text-white/60 p-1"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

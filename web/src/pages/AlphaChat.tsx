import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/lib/supabase";
import { safeAvatarUrl } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { 
  Send, Wallet, Bot, Plus, Users, MessageSquare, 
  Circle, Loader2, Zap, Sparkles
} from "lucide-react";
import { WalletTrackingModal } from "@/components/chat/WalletTrackingModal";
import { TrackedWalletsSidebar } from "@/components/chat/TrackedWalletsSidebar";
import { isValidSolanaAddress } from "@/lib/solana-api";
import { formatDistanceToNow } from "date-fns";

interface Message {
  id: string;
  user_id: string | null;
  username: string | null;
  avatar_url: string | null;
  content: string;
  message_type: string;
  wallet_address: string | null;
  metadata: any;
  created_at: string;
}

interface TrackedWallet {
  id: string;
  wallet_address: string;
  label: string | null;
  is_active: boolean;
  created_at: string;
}

interface OnlineUser {
  id: string;
  username: string;
  avatar_url: string | null;
}

const AlphaChat = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [trackedWallets, setTrackedWallets] = useState<TrackedWallet[]>([]);
  const [input, setInput] = useState("");
  const [walletInput, setWalletInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedWallet, setSelectedWallet] = useState<string | null>(null);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);

  useEffect(() => {
    if (user) {
      fetchUserProfile();
    }
  }, [user]);

  const fetchUserProfile = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();
    setUserProfile(data);
  };

  useEffect(() => {
    fetchMessages();
    fetchTrackedWallets();
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel("chat-messages")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages" },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as Message]);
        }
      )
      .subscribe();

    const presenceChannel = supabase.channel("online-users", {
      config: { presence: { key: user?.id || "anonymous" } },
    });

    presenceChannel
      .on("presence", { event: "sync" }, () => {
        const state = presenceChannel.presenceState();
        const users: OnlineUser[] = [];
        Object.entries(state).forEach(([key, presences]: [string, any]) => {
          if (presences[0]) {
            users.push({
              id: key,
              username: presences[0].username || "Anonymous",
              avatar_url: presences[0].avatar_url || null,
            });
          }
        });
        setOnlineUsers(users);
      })
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        if (payload.user_id !== user?.id) {
          setTypingUsers((prev) => {
            if (!prev.includes(payload.username)) {
              return [...prev, payload.username];
            }
            return prev;
          });
          setTimeout(() => {
            setTypingUsers((prev) => prev.filter((u) => u !== payload.username));
          }, 2000);
        }
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await presenceChannel.track({
            online_at: new Date().toISOString(),
            username: userProfile?.username || profile?.username || "Anonymous",
            avatar_url: userProfile?.avatar_url || profile?.avatar_url,
          });
        }
      });

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(presenceChannel);
    };
  }, [user, userProfile, profile]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const fetchMessages = async () => {
    const { data, error } = await supabase
      .from("chat_messages")
      .select("*")
      .order("created_at", { ascending: true })
      .limit(200);

    if (data) setMessages(data);
  };

  const fetchTrackedWallets = async () => {
    const { data } = await supabase
      .from("chat_tracked_wallets")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (data) setTrackedWallets(data);
  };

  const handleTyping = () => {
    const channel = supabase.channel("online-users");
    channel.send({
      type: "broadcast",
      event: "typing",
      payload: {
        user_id: user?.id,
        username: userProfile?.username || profile?.username || "Anonymous",
      },
    });
  };

  const sendMessage = async () => {
    if (!input.trim() || !user) {
      if (!user) {
        toast.error("Please sign in to chat");
      }
      return;
    }

    setIsLoading(true);
    const { error } = await supabase.from("chat_messages").insert({
      user_id: user.id,
      username: userProfile?.username || profile?.username || user.email?.split("@")[0],
      avatar_url: userProfile?.avatar_url || profile?.avatar_url,
      content: input.trim(),
      message_type: "user",
    });

    if (error) {
      toast.error("Failed to send message");
    }
    setInput("");
    setIsLoading(false);
  };

  const addWalletToTrack = async () => {
    if (!walletInput.trim() || !user) {
      if (!user) {
        toast.error("Please sign in");
      }
      return;
    }

    if (!isValidSolanaAddress(walletInput.trim())) {
      toast.error("Invalid Solana address");
      return;
    }

    const existing = trackedWallets.find((w) => w.wallet_address === walletInput.trim());
    if (existing) {
      toast.info("Wallet already tracked");
      setWalletInput("");
      return;
    }

    const { error: walletError } = await supabase.from("chat_tracked_wallets").insert({
      wallet_address: walletInput.trim(),
      added_by: user.id,
    });

    if (walletError && !walletError.message.includes("duplicate")) {
      toast.error("Failed to track wallet");
      return;
    }

    await supabase.from("chat_messages").insert({
      user_id: user.id,
      username: "SolanaBot",
      content: `🎯 New wallet added: ${walletInput.trim().slice(0, 4)}...${walletInput.trim().slice(-4)}`,
      message_type: "bot",
      wallet_address: walletInput.trim(),
      metadata: { action: "wallet_added", added_by: userProfile?.username || profile?.username || user.email },
    });

    setWalletInput("");
    fetchTrackedWallets();
    toast.success("Wallet tracked!");
  };

  const openWalletDetails = (address: string) => {
    setSelectedWallet(address);
    setShowWalletModal(true);
  };

  return (
    <AppLayout>
      <div className="h-[calc(100vh-4rem)] p-4 lg:p-6">
        <div className="flex h-full gap-4">
          {/* Online Users Sidebar */}
          <Card className="hidden lg:flex flex-col w-64 shrink-0 glass-card">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between text-base">
                <span className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  Online Now
                </span>
                <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                  {onlineUsers.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 p-0">
              <ScrollArea className="h-full px-4 pb-4">
                <div className="space-y-2">
                  {onlineUsers.map((u) => (
                    <div 
                      key={u.id} 
                      className="flex items-center gap-3 p-2.5 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer"
                      onClick={() => navigate(`/profile/${u.id}`)}
                    >
                      <div className="relative">
                        <Avatar className="h-9 w-9 border-2 border-background">
                          <AvatarImage src={safeAvatarUrl(u.avatar_url)} />
                          <AvatarFallback className="text-xs bg-gradient-to-br from-primary to-secondary text-primary-foreground">
                            {u.username?.charAt(0).toUpperCase() || "?"}
                          </AvatarFallback>
                        </Avatar>
                        <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-background" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{u.username}</p>
                        <p className="text-xs text-muted-foreground">Online</p>
                      </div>
                    </div>
                  ))}
                  {onlineUsers.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No users online</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Main Chat Area */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* Header */}
            <Card className="glass-card-premium mb-4 border-primary/10">
              <CardContent className="p-4 lg:p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <div className="absolute inset-0 bg-gradient-to-br from-primary to-secondary blur-xl opacity-40" />
                      <div className="relative p-3 rounded-2xl bg-gradient-to-br from-primary/20 to-secondary/20">
                        <MessageSquare className="h-6 w-6 text-primary" />
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h1 className="text-xl font-bold">Alpha Chat</h1>
                        <Badge className="bg-accent/10 text-accent border-accent/30">
                          <Sparkles className="h-3 w-3 mr-1" />
                          Live
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">Public room • Share alpha • Track wallets</p>
                    </div>
                  </div>
                  
                  {/* Mobile Online Count */}
                  <div className="flex items-center gap-3">
                    <div className="flex -space-x-2">
                      {onlineUsers.slice(0, 5).map((u) => (
                        <Avatar key={u.id} className="w-8 h-8 border-2 border-background ring-1 ring-primary/20">
                          <AvatarImage src={safeAvatarUrl(u.avatar_url)} />
                          <AvatarFallback className="text-[10px] bg-gradient-to-br from-primary to-secondary text-primary-foreground">
                            {u.username?.charAt(0).toUpperCase() || "?"}
                          </AvatarFallback>
                        </Avatar>
                      ))}
                      {onlineUsers.length > 5 && (
                        <div className="w-8 h-8 rounded-full bg-muted border-2 border-background flex items-center justify-center text-xs font-medium">
                          +{onlineUsers.length - 5}
                        </div>
                      )}
                    </div>
                    <Badge variant="outline" className="gap-1.5 bg-green-500/10 border-green-500/30 text-green-400">
                      <Circle className="w-2 h-2 fill-green-500 animate-pulse" />
                      {onlineUsers.length}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Wallet Tracking Input */}
            <Card className="glass-card mb-4 border-accent/10">
              <CardContent className="p-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-accent/10">
                    <Wallet className="h-4 w-4 text-accent" />
                  </div>
                  <Input
                    value={walletInput}
                    onChange={(e) => setWalletInput(e.target.value)}
                    placeholder="Track a wallet address..."
                    className="flex-1 h-10 rounded-xl bg-muted/30 border-border/50"
                    onKeyDown={(e) => e.key === "Enter" && addWalletToTrack()}
                  />
                  <Button onClick={addWalletToTrack} size="sm" className="rounded-xl gap-1.5 h-10 px-4">
                    <Plus className="h-4 w-4" />
                    Track
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Messages Area */}
            <Card className="glass-card flex-1 overflow-hidden border-border/50">
              <ScrollArea className="h-full" ref={scrollRef}>
                <div className="p-4 lg:p-5 space-y-4">
                  {messages.length === 0 && (
                    <div className="text-center py-16 text-muted-foreground">
                      <div className="relative inline-block">
                        <div className="absolute inset-0 bg-primary/10 blur-2xl rounded-full" />
                        <Bot className="relative h-14 w-14 mx-auto mb-4 opacity-50" />
                      </div>
                      <p className="font-medium">No messages yet</p>
                      <p className="text-sm mt-1">Be the first to drop some alpha!</p>
                    </div>
                  )}
                  {messages.map((msg) => (
                    <div key={msg.id} className="animate-fade-in">
                      <div className={`flex items-start gap-3 ${msg.user_id === user?.id ? "flex-row-reverse" : ""}`}>
                        <Avatar className="w-9 h-9 border-2 border-border/50 shadow-sm shrink-0">
                          <AvatarImage src={safeAvatarUrl(msg.avatar_url)} />
                          <AvatarFallback className={`text-xs ${msg.message_type === "bot" ? "bg-gradient-to-br from-accent to-secondary" : "bg-gradient-to-br from-primary to-secondary"} text-primary-foreground`}>
                            {msg.message_type === "bot" ? <Bot className="h-4 w-4" /> : msg.username?.charAt(0).toUpperCase() || "?"}
                          </AvatarFallback>
                        </Avatar>
                        <div className={`flex-1 max-w-[75%] ${msg.user_id === user?.id ? "text-right" : ""}`}>
                          <div className={`flex items-center gap-2 mb-1 ${msg.user_id === user?.id ? "justify-end" : ""}`}>
                            <span 
                              className={`text-sm font-medium ${msg.message_type !== "bot" && msg.user_id ? "cursor-pointer hover:text-primary transition-colors" : ""}`}
                              onClick={(e) => {
                                if (msg.message_type !== "bot" && msg.user_id) {
                                  e.stopPropagation();
                                  navigate(`/profile/${msg.user_id}`);
                                }
                              }}
                            >
                              {msg.message_type === "bot" ? (
                                <span className="flex items-center gap-1 text-accent">
                                  <Zap className="h-3 w-3" />
                                  SolanaBot
                                </span>
                              ) : (
                                msg.username || "Anonymous"
                              )}
                            </span>
                            <span className="text-[11px] text-muted-foreground">
                              {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}
                            </span>
                          </div>
                          <div className={`inline-block p-3.5 rounded-2xl max-w-full ${
                            msg.message_type === "bot" 
                              ? "bg-gradient-to-r from-accent/10 to-accent/5 border border-accent/20" 
                              : msg.user_id === user?.id 
                                ? "bg-gradient-to-r from-primary/20 to-primary/10 border border-primary/20" 
                                : "bg-muted/50 border border-border/50"
                          }`}>
                            <p className="text-sm leading-relaxed break-words">{msg.content}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {typingUsers.length > 0 && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground animate-pulse">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {typingUsers.join(", ")} {typingUsers.length === 1 ? "is" : "are"} typing...
                    </div>
                  )}
                </div>
              </ScrollArea>
            </Card>

            {/* Message Input */}
            <Card className="glass-card mt-4 border-primary/10">
              <CardContent className="p-3">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    sendMessage();
                  }}
                  className="flex gap-3"
                >
                  <Input
                    value={input}
                    onChange={(e) => {
                      setInput(e.target.value);
                      handleTyping();
                    }}
                    placeholder={user ? "Share your alpha..." : "Sign in to chat"}
                    disabled={isLoading || !user}
                    className="flex-1 h-12 rounded-xl bg-muted/30 border-border/50 text-base px-4"
                  />
                  <Button 
                    type="submit" 
                    disabled={isLoading || !user || !input.trim()}
                    className="h-12 w-12 rounded-xl"
                  >
                    <Send className="h-5 w-5" />
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* Tracked Wallets Sidebar */}
          <div className="hidden xl:block w-72 shrink-0">
            <TrackedWalletsSidebar
              wallets={trackedWallets}
              onWalletClick={openWalletDetails}
            />
          </div>
        </div>
      </div>

      <WalletTrackingModal
        open={showWalletModal}
        onOpenChange={setShowWalletModal}
        walletAddress={selectedWallet}
      />
    </AppLayout>
  );
};

export default AlphaChat;

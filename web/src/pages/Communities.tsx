import { useState, useEffect, useRef } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Users, Plus, Search, MessageSquare, Heart, Send, Trash2, ArrowLeft,
  Globe, Lock, TrendingUp, Sparkles, Image as ImageIcon,
  Repeat2, Bookmark, Share, Shield, Crown, Clock,
  Hash, Flame, Eye, UserPlus, Volume2, ChevronRight,
  BarChart3
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { VoicePanel } from "@/components/lobbies/VoicePanel";
import { formatDistanceToNow } from "date-fns";

interface Community {
  id: string;
  name: string;
  description: string | null;
  privacy: string;
  created_by: string;
  creator_name: string | null;
  creator_avatar: string | null;
  member_count: number;
  created_at: string;
  icon: string | null;
  banner_url: string | null;
}

interface Post {
  id: string;
  community_id: string;
  user_id: string;
  username: string | null;
  avatar_url: string | null;
  content: string;
  image_url: string | null;
  likes_count: number;
  replies_count: number;
  created_at: string;
  liked?: boolean;
}

interface ChatMsg {
  id: string;
  user_id: string;
  username: string | null;
  avatar_url: string | null;
  content: string;
  created_at: string;
}

interface MemberData {
  id: string;
  user_id: string;
  role: string | null;
  joined_at: string | null;
  username?: string;
  avatar_url?: string;
  bio?: string;
}

const COMMUNITY_ICONS = ["🚀", "💎", "🔥", "⚡", "🎯", "💰", "📈", "🏆", "🌊", "🦈", "🐋", "🎮"];

const Communities = () => {
  const { user, profile } = useAuth();
  const [communities, setCommunities] = useState<Community[]>([]);
  const [selected, setSelected] = useState<Community | null>(null);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("feed");
  const [feedSort, setFeedSort] = useState<"latest" | "trending" | "top">("latest");
  const [posts, setPosts] = useState<Post[]>([]);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [members, setMembers] = useState<MemberData[]>([]);
  const [newPost, setNewPost] = useState("");
  const [chatMsg, setChatMsg] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newPrivacy, setNewPrivacy] = useState("public");
  const [newIcon, setNewIcon] = useState("🚀");
  const [isMember, setIsMember] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pinnedPost, setPinnedPost] = useState<Post | null>(null);
  const [showVoice, setShowVoice] = useState(false);
  const [listView, setListView] = useState<"discover" | "joined">("discover");
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => { fetchCommunities(); }, []);

  const fetchCommunities = async () => {
    const { data } = await supabase.from("communities").select("*").eq("is_active", true).order("member_count", { ascending: false });
    setCommunities((data as Community[]) || []);
    setLoading(false);
  };

  const createCommunity = async () => {
    if (!user || !newName.trim()) return;
    const { data, error } = await supabase.from("communities").insert({
      name: newName.trim(),
      description: newDesc.trim() || null,
      privacy: newPrivacy,
      created_by: user.id,
      creator_name: profile?.username || "User",
      creator_avatar: profile?.avatar_url,
      icon: newIcon,
    }).select().single();

    if (error) { toast({ title: "Error creating community", variant: "destructive" }); return; }

    // Auto-join as creator
    if (data) {
      await supabase.from("community_members").insert({
        community_id: data.id,
        user_id: user.id,
        role: "creator",
      });
    }

    toast({ title: "Community created! 🎉" });
    setCreateOpen(false);
    setNewName("");
    setNewDesc("");
    setNewIcon("🚀");
    fetchCommunities();
  };

  const enterCommunity = async (c: Community) => {
    setSelected(c);
    setTab("feed");
    if (user) {
      const { data } = await supabase.from("community_members").select("id").eq("community_id", c.id).eq("user_id", user.id).maybeSingle();
      setIsMember(!!data);
    }
    fetchPosts(c.id);
    fetchMessages(c.id);
    fetchMembers(c.id);
  };

  const joinCommunity = async () => {
    if (!user || !selected) return;
    await supabase.from("community_members").insert({ community_id: selected.id, user_id: user.id, role: "member" });
    setIsMember(true);
    toast({ title: "Joined community! 🎉" });
    fetchMembers(selected.id);
  };

  const leaveCommunity = async () => {
    if (!user || !selected) return;
    await supabase.from("community_members").delete().eq("community_id", selected.id).eq("user_id", user.id);
    setIsMember(false);
    fetchMembers(selected.id);
  };

  const deleteCommunity = async () => {
    if (!user || !selected || selected.created_by !== user.id) return;
    if (!confirm("Are you sure you want to delete this community?")) return;
    await supabase.from("communities").delete().eq("id", selected.id);
    toast({ title: "Community deleted" });
    setSelected(null);
    fetchCommunities();
  };

  const fetchPosts = async (cid: string) => {
    let query = supabase.from("community_posts").select("*").eq("community_id", cid).limit(50);

    if (feedSort === "latest") query = query.order("created_at", { ascending: false });
    else if (feedSort === "top") query = query.order("likes_count", { ascending: false });
    else query = query.order("likes_count", { ascending: false });

    const { data } = await query;
    const postsData = (data || []) as Post[];
    if (user) {
      const { data: likes } = await supabase.from("community_post_likes").select("post_id").eq("user_id", user.id);
      const likedIds = new Set(likes?.map(l => l.post_id));
      postsData.forEach(p => { p.liked = likedIds.has(p.id); });
    }
    setPosts(postsData);
  };

  const fetchMessages = async (cid: string) => {
    const { data } = await supabase.from("community_messages").select("*").eq("community_id", cid).order("created_at", { ascending: true }).limit(100);
    setMessages((data as ChatMsg[]) || []);
  };

  const fetchMembers = async (cid: string) => {
    const { data } = await supabase.from("community_members").select("*").eq("community_id", cid);
    if (!data) { setMembers([]); return; }
    const userIds = data.map(m => m.user_id);
    const { data: profiles } = await supabase.from("profiles").select("user_id, username, avatar_url, bio").in("user_id", userIds);
    const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);
    setMembers(data.map(m => ({
      ...m,
      username: profileMap.get(m.user_id)?.username || undefined,
      avatar_url: profileMap.get(m.user_id)?.avatar_url || undefined,
      bio: profileMap.get(m.user_id)?.bio || undefined,
    })));
  };

  // Realtime
  useEffect(() => {
    if (!selected) return;
    const msgChannel = supabase.channel(`community-msg-${selected.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "community_messages", filter: `community_id=eq.${selected.id}` },
        (payload) => setMessages(prev => [...prev, payload.new as ChatMsg])
      ).subscribe();

    const postChannel = supabase.channel(`community-post-${selected.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "community_posts", filter: `community_id=eq.${selected.id}` },
        () => fetchPosts(selected.id)
      ).subscribe();

    return () => { supabase.removeChannel(msgChannel); supabase.removeChannel(postChannel); };
  }, [selected?.id]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const submitPost = async () => {
    if (!user || !selected || !newPost.trim()) return;
    await supabase.from("community_posts").insert({
      community_id: selected.id,
      user_id: user.id,
      username: profile?.username || "User",
      avatar_url: profile?.avatar_url,
      content: newPost.trim(),
    });
    setNewPost("");
  };

  const sendChat = async () => {
    if (!user || !selected || !chatMsg.trim()) return;
    await supabase.from("community_messages").insert({
      community_id: selected.id,
      user_id: user.id,
      username: profile?.username || "User",
      avatar_url: profile?.avatar_url,
      content: chatMsg.trim(),
    });
    setChatMsg("");
  };

  const toggleLike = async (post: Post) => {
    if (!user) return;
    if (post.liked) {
      await supabase.from("community_post_likes").delete().eq("post_id", post.id).eq("user_id", user.id);
    } else {
      await supabase.from("community_post_likes").insert({ post_id: post.id, user_id: user.id });
    }
    fetchPosts(selected!.id);
  };

  const deletePost = async (postId: string) => {
    await supabase.from("community_posts").delete().eq("id", postId);
    fetchPosts(selected!.id);
  };

  const filtered = communities.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));
  const isCreator = selected?.created_by === user?.id;

  // ==================== COMMUNITY DETAIL VIEW ====================
  if (selected) {
    return (
      <AppLayout>
        <div className="flex flex-col h-full bg-background">
          {/* Top Header Bar */}
          <header className="sticky top-0 z-40 bg-card/80 backdrop-blur-xl border-b border-border/50">
            <div className="px-4 py-3 flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => setSelected(null)} className="rounded-full h-9 w-9">
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/30 to-accent/30 flex items-center justify-center text-lg shrink-0">
                  {selected.icon || selected.name[0]}
                </div>
                <div className="min-w-0">
                  <h1 className="text-base font-bold truncate">{selected.name}</h1>
                  <p className="text-[10px] text-muted-foreground flex items-center gap-2">
                    <Users className="h-3 w-3" /> {members.length} members
                    {selected.privacy !== "public" && <><Lock className="h-3 w-3" /> {selected.privacy}</>}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setShowVoice(!showVoice)}
                  className={`p-2 rounded-full transition-colors ${showVoice ? "bg-green-500/20 text-green-400" : "bg-muted/30 text-muted-foreground hover:text-foreground"}`}
                >
                  <Volume2 className="h-4 w-4" />
                </button>
                {!isMember && user && (
                  <Button size="sm" onClick={joinCommunity} className="rounded-full btn-3d text-xs h-8 px-4">Join</Button>
                )}
                {isMember && !isCreator && (
                  <Button size="sm" variant="outline" onClick={leaveCommunity} className="rounded-full text-xs h-8 px-3">Leave</Button>
                )}
                {isCreator && (
                  <button onClick={deleteCommunity} className="p-2 rounded-full bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors">
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Voice Panel (collapsible) */}
            {showVoice && isMember && (
              <div className="px-4 pb-3">
                <VoicePanel lobbyId={`community-${selected.id}`} lobbyName={selected.name} autoJoin={true} />
              </div>
            )}

            {/* Tab Navigation - X.com style */}
            <div className="flex border-t border-border/30">
              {[
                { key: "feed", label: "Feed", icon: Hash },
                { key: "chat", label: "Chat", icon: MessageSquare },
                { key: "members", label: "Members", icon: Users },
                { key: "about", label: "About", icon: Eye },
              ].map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  className={`flex-1 py-2.5 flex items-center justify-center gap-1.5 text-xs font-semibold transition-colors relative ${
                    tab === key ? "text-primary" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                  {tab === key && <div className="absolute bottom-0 left-1/4 right-1/4 h-0.5 bg-primary rounded-full" />}
                </button>
              ))}
            </div>
          </header>

          {/* ==== FEED TAB ==== */}
          {tab === "feed" && (
            <ScrollArea className="flex-1">
              <div className="max-w-2xl mx-auto">
                {/* Feed Sort */}
                <div className="px-4 py-2 flex items-center gap-2 border-b border-border/20 sticky top-0 bg-background/80 backdrop-blur-sm z-10">
                  {(["latest", "trending", "top"] as const).map(s => (
                    <button
                      key={s}
                      onClick={() => { setFeedSort(s); if (selected) fetchPosts(selected.id); }}
                      className={`px-3 py-1.5 rounded-full text-[10px] font-semibold transition-colors ${
                        feedSort === s ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                      }`}
                    >
                      {s === "latest" && <Clock className="h-3 w-3 inline mr-1" />}
                      {s === "trending" && <Flame className="h-3 w-3 inline mr-1" />}
                      {s === "top" && <TrendingUp className="h-3 w-3 inline mr-1" />}
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </button>
                  ))}
                </div>

                {/* Compose Post */}
                {user && isMember && (
                  <div className="p-4 border-b border-border/20">
                    <div className="flex gap-3">
                      <Avatar className="h-10 w-10 shrink-0">
                        <AvatarImage src={profile?.avatar_url || ""} />
                        <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-primary-foreground text-sm font-bold">
                          {(profile?.username || "U")[0].toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 space-y-2">
                        <Textarea
                          placeholder="What's happening in the market?"
                          value={newPost}
                          onChange={e => setNewPost(e.target.value)}
                          className="min-h-[70px] bg-transparent border-0 shadow-none resize-none text-sm placeholder:text-muted-foreground/50 focus-visible:ring-0 p-0"
                        />
                        <div className="flex items-center justify-between pt-2 border-t border-border/20">
                          <div className="flex gap-1">
                            <button className="p-2 rounded-full text-primary/60 hover:bg-primary/10 hover:text-primary transition-colors">
                              <ImageIcon className="h-4 w-4" />
                            </button>
                            <button className="p-2 rounded-full text-primary/60 hover:bg-primary/10 hover:text-primary transition-colors">
                              <BarChart3 className="h-4 w-4" />
                            </button>
                          </div>
                          <Button
                            onClick={submitPost}
                            disabled={!newPost.trim()}
                            size="sm"
                            className="rounded-full px-5 btn-3d text-xs h-8"
                          >
                            Post
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Posts Feed */}
                <div className="divide-y divide-border/20">
                  {posts.map(post => (
                    <article key={post.id} className="p-4 hover:bg-muted/5 transition-colors">
                      <div className="flex gap-3">
                        <Avatar className="h-10 w-10 shrink-0">
                          <AvatarImage src={post.avatar_url || ""} />
                          <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-primary-foreground text-xs font-bold">
                            {(post.username || "?")[0].toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm truncate">{post.username || "Anonymous"}</span>
                            <span className="text-xs text-muted-foreground shrink-0">
                              · {formatDistanceToNow(new Date(post.created_at), { addSuffix: false })}
                            </span>
                            {post.user_id === selected.created_by && (
                              <Badge className="text-[7px] bg-primary/10 text-primary border-primary/20 h-4 shrink-0">
                                <Crown className="h-2 w-2 mr-0.5" /> Admin
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm leading-relaxed mt-1 whitespace-pre-wrap break-words">{post.content}</p>
                          {post.image_url && (
                            <img src={post.image_url} alt="" className="mt-3 rounded-2xl max-h-80 object-cover w-full border border-border/20" />
                          )}

                          {/* Post Actions - X.com style */}
                          <div className="flex items-center justify-between mt-3 max-w-md">
                            <button className="flex items-center gap-1 text-muted-foreground hover:text-primary group transition-colors p-1.5 -ml-1.5 rounded-full hover:bg-primary/10">
                              <MessageSquare className="h-4 w-4" />
                              <span className="text-xs">{post.replies_count || 0}</span>
                            </button>
                            <button className="flex items-center gap-1 text-muted-foreground hover:text-green-500 group transition-colors p-1.5 rounded-full hover:bg-green-500/10">
                              <Repeat2 className="h-4 w-4" />
                              <span className="text-xs">0</span>
                            </button>
                            <button
                              onClick={() => toggleLike(post)}
                              className={`flex items-center gap-1 transition-colors p-1.5 rounded-full ${
                                post.liked ? "text-red-500" : "text-muted-foreground hover:text-red-500 hover:bg-red-500/10"
                              }`}
                            >
                              <Heart className={`h-4 w-4 ${post.liked ? "fill-current" : ""}`} />
                              <span className="text-xs">{post.likes_count || 0}</span>
                            </button>
                            <button className="flex items-center gap-1 text-muted-foreground hover:text-primary transition-colors p-1.5 rounded-full hover:bg-primary/10">
                              <Bookmark className="h-4 w-4" />
                            </button>
                            <button className="flex items-center gap-1 text-muted-foreground hover:text-primary transition-colors p-1.5 rounded-full hover:bg-primary/10">
                              <Share className="h-4 w-4" />
                            </button>
                            {user && (post.user_id === user.id || isCreator) && (
                              <button onClick={() => deletePost(post.id)} className="text-muted-foreground hover:text-destructive transition-colors p-1.5 rounded-full hover:bg-destructive/10">
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </article>
                  ))}
                  {posts.length === 0 && (
                    <div className="text-center py-16 text-muted-foreground">
                      <Sparkles className="h-12 w-12 mx-auto mb-3 opacity-30" />
                      <p className="font-medium">No posts yet</p>
                      <p className="text-sm mt-1">Be the first to share something!</p>
                    </div>
                  )}
                </div>
              </div>
            </ScrollArea>
          )}

          {/* ==== CHAT TAB ==== */}
          {tab === "chat" && (
            <div className="flex-1 flex flex-col min-h-0">
              <ScrollArea className="flex-1">
                <div className="p-4 space-y-3 max-w-2xl mx-auto">
                  {messages.length === 0 && (
                    <div className="text-center py-16 text-muted-foreground">
                      <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-30" />
                      <p>No messages yet. Start the conversation!</p>
                    </div>
                  )}
                  {messages.map(msg => (
                    <div key={msg.id} className={`flex gap-2.5 ${msg.user_id === user?.id ? "flex-row-reverse" : ""}`}>
                      <Avatar className="h-8 w-8 shrink-0">
                        <AvatarImage src={msg.avatar_url || ""} />
                        <AvatarFallback className="bg-muted text-xs">{(msg.username || "?")[0].toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className={`max-w-[75%] ${msg.user_id === user?.id ? "items-end" : ""}`}>
                        <p className="text-[10px] text-muted-foreground mb-0.5 flex items-center gap-1">
                          {msg.username}
                          {msg.user_id === selected.created_by && <Crown className="h-2.5 w-2.5 text-primary" />}
                        </p>
                        <div className={`px-3 py-2 rounded-2xl text-sm ${
                          msg.user_id === user?.id
                            ? "bg-primary text-primary-foreground rounded-br-md"
                            : "bg-muted/50 rounded-bl-md"
                        }`}>
                          {msg.content}
                        </div>
                        <p className="text-[9px] text-muted-foreground/40 mt-0.5">
                          {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                  ))}
                  <div ref={chatEndRef} />
                </div>
              </ScrollArea>
              {user && isMember && (
                <div className="p-3 border-t border-border/50 bg-card/50 backdrop-blur-sm">
                  <div className="flex gap-2 max-w-2xl mx-auto">
                    <Input
                      placeholder="Type a message..."
                      value={chatMsg}
                      onChange={e => setChatMsg(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendChat()}
                      className="rounded-full bg-muted/30 border-border/30"
                    />
                    <Button onClick={sendChat} size="icon" className="rounded-full shrink-0 btn-3d h-10 w-10">
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ==== MEMBERS TAB ==== */}
          {tab === "members" && (
            <ScrollArea className="flex-1">
              <div className="p-4 space-y-2 max-w-2xl mx-auto">
                <p className="text-xs text-muted-foreground mb-3">{members.length} members</p>
                {members.map(m => {
                  const mIsCreator = m.user_id === selected.created_by;
                  return (
                    <div key={m.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/10 transition-colors group">
                      <Avatar className="h-11 w-11">
                        <AvatarImage src={m.avatar_url || ""} />
                        <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-primary-foreground text-sm font-bold">
                          {(m.username || "?")[0].toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm truncate">{m.username || "User"}</span>
                          {mIsCreator && (
                            <Badge className="text-[7px] bg-primary/10 text-primary border-primary/20 h-4">
                              <Crown className="h-2.5 w-2.5 mr-0.5" /> Creator
                            </Badge>
                          )}
                          {m.role === "moderator" && (
                            <Badge className="text-[7px] bg-blue-500/10 text-blue-400 border-blue-500/20 h-4">
                              <Shield className="h-2.5 w-2.5 mr-0.5" /> Mod
                            </Badge>
                          )}
                        </div>
                        {m.bio && <p className="text-xs text-muted-foreground truncate">{m.bio}</p>}
                      </div>
                      {m.user_id !== user?.id && (
                        <Button variant="ghost" size="sm" className="rounded-full text-xs opacity-0 group-hover:opacity-100 transition-opacity">
                          <UserPlus className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse shrink-0" />
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}

          {/* ==== ABOUT TAB ==== */}
          {tab === "about" && (
            <ScrollArea className="flex-1">
              <div className="p-4 space-y-4 max-w-2xl mx-auto">
                <Card className="glass-card">
                  <CardContent className="p-5 space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/30 to-accent/30 flex items-center justify-center text-2xl">
                        {selected.icon || selected.name[0]}
                      </div>
                      <div>
                        <h2 className="text-lg font-bold">{selected.name}</h2>
                        <p className="text-xs text-muted-foreground flex items-center gap-2">
                          {selected.privacy === "public" ? <Globe className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                          {selected.privacy} community
                        </p>
                      </div>
                    </div>
                    {selected.description && (
                      <p className="text-sm text-muted-foreground">{selected.description}</p>
                    )}
                    <div className="grid grid-cols-3 gap-3">
                      <div className="text-center p-3 rounded-xl bg-muted/20">
                        <p className="text-lg font-bold">{members.length}</p>
                        <p className="text-[10px] text-muted-foreground">Members</p>
                      </div>
                      <div className="text-center p-3 rounded-xl bg-muted/20">
                        <p className="text-lg font-bold">{posts.length}</p>
                        <p className="text-[10px] text-muted-foreground">Posts</p>
                      </div>
                      <div className="text-center p-3 rounded-xl bg-muted/20">
                        <p className="text-lg font-bold">{messages.length}</p>
                        <p className="text-[10px] text-muted-foreground">Messages</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 pt-2 border-t border-border/20">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={selected.creator_avatar || ""} />
                        <AvatarFallback className="bg-muted text-xs">{(selected.creator_name || "?")[0].toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-semibold">{selected.creator_name}</p>
                        <p className="text-[10px] text-muted-foreground">Created {formatDistanceToNow(new Date(selected.created_at), { addSuffix: true })}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Rules */}
                <Card className="glass-card">
                  <CardContent className="p-5 space-y-3">
                    <h3 className="font-bold flex items-center gap-2"><Shield className="h-4 w-4 text-primary" /> Community Rules</h3>
                    {["Be respectful and constructive", "No spam or self-promotion", "Share alpha, not FUD", "DYOR - Not financial advice", "Keep discussions on-topic"].map((rule, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <span className="text-xs text-primary font-bold mt-0.5">{i + 1}.</span>
                        <p className="text-sm text-muted-foreground">{rule}</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            </ScrollArea>
          )}
        </div>
      </AppLayout>
    );
  }

  // ==================== COMMUNITY LIST VIEW ====================
  return (
    <AppLayout>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="px-4 pt-4 pb-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-xl font-bold font-display gradient-text flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Communities
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">Connect, share, and trade together</p>
            </div>
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button className="rounded-full btn-3d gap-1.5 text-xs h-9 px-4" size="sm">
                  <Plus className="h-4 w-4" /> Create
                </Button>
              </DialogTrigger>
              <DialogContent className="glass-card-premium mx-4">
                <DialogHeader><DialogTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" /> Create Community</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  {/* Icon picker */}
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">Choose an icon</p>
                    <div className="flex flex-wrap gap-2">
                      {COMMUNITY_ICONS.map(icon => (
                        <button
                          key={icon}
                          onClick={() => setNewIcon(icon)}
                          className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg transition-all ${
                            newIcon === icon ? "bg-primary/20 border-2 border-primary scale-110" : "bg-muted/20 border border-border/30 hover:border-primary/30"
                          }`}
                        >
                          {icon}
                        </button>
                      ))}
                    </div>
                  </div>
                  <Input placeholder="Community name" value={newName} onChange={e => setNewName(e.target.value)} className="rounded-xl" />
                  <Textarea placeholder="Description (optional)" value={newDesc} onChange={e => setNewDesc(e.target.value)} className="rounded-xl" />
                  <div className="flex gap-2">
                    {["public", "private"].map(p => (
                      <Button key={p} variant={newPrivacy === p ? "default" : "outline"} onClick={() => setNewPrivacy(p)} className="flex-1 rounded-xl gap-2 capitalize text-xs">
                        {p === "public" ? <Globe className="h-4 w-4" /> : <Lock className="h-4 w-4" />} {p}
                      </Button>
                    ))}
                  </div>
                  <Button onClick={createCommunity} disabled={!newName.trim()} className="w-full rounded-xl btn-3d">
                    Create Community
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Search */}
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
            <Input placeholder="Search communities..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10 rounded-full bg-muted/20 border-border/30 h-9 text-sm" />
          </div>

          {/* Stats Banner */}
          <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
            {[
              { icon: Users, value: communities.length, label: "Communities", color: "from-primary/20 to-primary/5 text-primary" },
              { icon: TrendingUp, value: "Live", label: "Activity", color: "from-green-500/20 to-green-500/5 text-green-400" },
              { icon: Flame, value: "Hot", label: "Trending", color: "from-orange-500/20 to-orange-500/5 text-orange-400" },
            ].map((s, i) => (
              <div key={i} className={`flex items-center gap-2 px-3 py-2 rounded-xl bg-gradient-to-r ${s.color} border border-border/10 shrink-0`}>
                <s.icon className="h-4 w-4" />
                <div>
                  <p className="text-sm font-bold leading-tight">{s.value}</p>
                  <p className="text-[9px] opacity-70">{s.label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* View Toggle */}
          <div className="flex gap-1 p-0.5 bg-muted/20 rounded-full w-fit mb-3">
            <button onClick={() => setListView("discover")} className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-colors ${listView === "discover" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
              Discover
            </button>
            <button onClick={() => setListView("joined")} className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-colors ${listView === "joined" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
              Joined
            </button>
          </div>
        </div>

        {/* Community List */}
        <ScrollArea className="flex-1 px-4">
          <div className="space-y-2 pb-4">
            {filtered.map(c => (
              <button
                key={c.id}
                onClick={() => enterCommunity(c)}
                className="w-full text-left p-4 rounded-2xl bg-card/50 border border-border/20 hover:border-primary/30 hover:bg-card/80 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center text-xl shrink-0">
                    {c.icon || c.name[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h3 className="font-bold text-sm truncate group-hover:text-primary transition-colors">{c.name}</h3>
                      {c.privacy !== "public" && <Lock className="h-3 w-3 text-muted-foreground/40 shrink-0" />}
                    </div>
                    {c.description && <p className="text-xs text-muted-foreground line-clamp-1">{c.description}</p>}
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1"><Users className="h-3 w-3" />{c.member_count || 0}</span>
                      <span className="text-[10px] text-muted-foreground">by @{c.creator_name}</span>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-primary transition-colors shrink-0" />
                </div>
              </button>
            ))}
            {filtered.length === 0 && !loading && (
              <div className="text-center py-16 text-muted-foreground">
                <Users className="h-14 w-14 mx-auto mb-3 opacity-20" />
                <p className="font-medium">No communities found</p>
                <p className="text-sm mt-1 text-muted-foreground/60">Create the first one!</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    </AppLayout>
  );
};

export default Communities;

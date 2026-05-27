/* ══════════════════════════════════════════════════════════════
   Admin · Content Moderation
   Features: view all posts, replies, reposts, bookmarks,
   delete content, bulk delete, content analytics
   ══════════════════════════════════════════════════════════════ */
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { logAudit, shortId } from "../helpers";
import {
  Shield, Search, Trash2, MessageSquare, Heart, Repeat,
  Bookmark, Loader2, RefreshCw, AlertTriangle, Eye,
  Flag, CheckCircle, X,
} from "lucide-react";

export const ContentModeration = () => {
  const { user: admin } = useAuth();
  const [tab, setTab] = useState("posts");
  const [posts, setPosts] = useState<any[]>([]);
  const [replies, setReplies] = useState<any[]>([]);
  const [reposts, setReposts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedPosts, setSelectedPosts] = useState<Set<string>>(new Set());

  const [stats, setStats] = useState({ totalPosts: 0, totalReplies: 0, totalReposts: 0, totalLikes: 0, totalBookmarks: 0 });

  const fetch = async () => {
    setLoading(true);
    const [postsR, repliesR, repostsR, likesR, bookmarksR] = await Promise.all([
      supabase.from("community_posts").select("*").order("created_at", { ascending: false }).limit(200),
      supabase.from("community_post_replies").select("*").order("created_at", { ascending: false }).limit(200),
      supabase.from("community_reposts").select("*").order("created_at", { ascending: false }).limit(200),
      supabase.from("community_post_likes").select("id", { count: "exact", head: true }),
      supabase.from("community_post_bookmarks").select("id", { count: "exact", head: true }),
    ]);
    setPosts(postsR.data || []);
    setReplies(repliesR.data || []);
    setReposts(repostsR.data || []);
    setStats({
      totalPosts: postsR.data?.length || 0,
      totalReplies: repliesR.data?.length || 0,
      totalReposts: repostsR.data?.length || 0,
      totalLikes: likesR.count || 0,
      totalBookmarks: bookmarksR.count || 0,
    });
    setLoading(false);
  };

  useEffect(() => { fetch(); }, []);

  const deletePost = async (id: string) => {
    if (!admin || !window.confirm("Delete this post and all its replies/likes?")) return;
    await supabase.from("community_post_replies").delete().eq("post_id", id);
    await supabase.from("community_post_likes").delete().eq("post_id", id);
    await supabase.from("community_post_bookmarks").delete().eq("post_id", id);
    await supabase.from("community_posts").delete().eq("id", id);
    await logAudit(admin.id, "Deleted community post", "community_posts", id);
    toast.success("Post deleted");
    fetch();
  };

  const deleteReply = async (id: string) => {
    if (!admin || !window.confirm("Delete this reply?")) return;
    await supabase.from("community_reply_likes").delete().eq("reply_id", id);
    await supabase.from("community_post_replies").delete().eq("id", id);
    await logAudit(admin.id, "Deleted reply", "community_post_replies", id);
    toast.success("Reply deleted");
    fetch();
  };

  const deleteRepost = async (id: string) => {
    if (!admin) return;
    await supabase.from("community_reposts").delete().eq("id", id);
    toast.success("Repost deleted");
    fetch();
  };

  const bulkDeletePosts = async () => {
    if (!admin || selectedPosts.size === 0 || !window.confirm(`Delete ${selectedPosts.size} posts?`)) return;
    for (const id of selectedPosts) {
      await supabase.from("community_post_replies").delete().eq("post_id", id);
      await supabase.from("community_post_likes").delete().eq("post_id", id);
      await supabase.from("community_posts").delete().eq("id", id);
    }
    await logAudit(admin.id, `Bulk deleted ${selectedPosts.size} posts`, "community_posts");
    toast.success(`${selectedPosts.size} posts deleted`);
    setSelectedPosts(new Set());
    fetch();
  };

  const clearAllBookmarks = async () => {
    if (!admin || !window.confirm("Clear ALL bookmarks platform-wide?")) return;
    await supabase.from("community_post_bookmarks").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("community_bookmarks").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await logAudit(admin.id, "Cleared all bookmarks", "community_bookmarks");
    toast.success("All bookmarks cleared");
    fetch();
  };

  const filteredPosts = posts.filter((p) => !search || p.content?.toLowerCase().includes(search.toLowerCase()));
  const filteredReplies = replies.filter((r) => !search || r.content?.toLowerCase().includes(search.toLowerCase()));

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-[#22d3ee]" /></div>;

  const StatBadge = ({ icon: Icon, label, value }: { icon: any; label: string; value: number }) => (
    <Card className="og-glass-card">
      <CardContent className="p-3 flex items-center gap-2">
        <Icon className="h-4 w-4 text-[#22d3ee]" />
        <div><p className="text-lg font-bold">{value.toLocaleString()}</p><p className="text-[10px] text-muted-foreground">{label}</p></div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-3"><Shield className="h-6 w-6 text-[#22d3ee]" /> Content Moderation</h2>
          <p className="text-sm text-muted-foreground">Review and manage all user content</p>
        </div>
        <Button onClick={fetch} variant="outline" size="sm" className="gap-2"><RefreshCw className="h-3.5 w-3.5" /></Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatBadge icon={MessageSquare} label="Posts" value={stats.totalPosts} />
        <StatBadge icon={MessageSquare} label="Replies" value={stats.totalReplies} />
        <StatBadge icon={Repeat} label="Reposts" value={stats.totalReposts} />
        <StatBadge icon={Heart} label="Likes" value={stats.totalLikes} />
        <StatBadge icon={Bookmark} label="Bookmarks" value={stats.totalBookmarks} />
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search content…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        {selectedPosts.size > 0 && (
          <Button variant="outline" size="sm" onClick={bulkDeletePosts} className="gap-2 text-red-400 border-red-500/30">
            <Trash2 className="h-3.5 w-3.5" /> Delete {selectedPosts.size} Selected
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={clearAllBookmarks} className="gap-2 text-orange-400 border-orange-500/30">
          <Bookmark className="h-3.5 w-3.5" /> Clear All Bookmarks
        </Button>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-white/[0.04]">
          <TabsTrigger value="posts">Posts ({filteredPosts.length})</TabsTrigger>
          <TabsTrigger value="replies">Replies ({filteredReplies.length})</TabsTrigger>
          <TabsTrigger value="reposts">Reposts ({reposts.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="posts" className="mt-4">
          <ScrollArea className="h-[500px]">
            <div className="space-y-2">
              {filteredPosts.map((p) => (
                <div key={p.id} className="flex items-start gap-3 p-3 rounded-lg bg-white/[0.03] border border-white/[0.05]">
                  <input type="checkbox" checked={selectedPosts.has(p.id)} onChange={() => {
                    setSelectedPosts((prev) => { const s = new Set(prev); s.has(p.id) ? s.delete(p.id) : s.add(p.id); return s; });
                  }} className="mt-1 rounded" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <code className="text-[10px] text-muted-foreground">{shortId(p.user_id)}</code>
                      {p.is_pinned && <Badge className="text-[10px] bg-yellow-500/20 text-yellow-400">Pinned</Badge>}
                      <span className="text-[10px] text-muted-foreground ml-auto">{formatDistanceToNow(new Date(p.created_at), { addSuffix: true })}</span>
                    </div>
                    <p className="text-sm line-clamp-3 whitespace-pre-wrap">{p.content}</p>
                    <div className="flex items-center gap-3 mt-1.5 text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-1"><Heart className="h-3 w-3" /> {p.like_count || 0}</span>
                      <span className="flex items-center gap-1"><MessageSquare className="h-3 w-3" /> {p.reply_count || 0}</span>
                    </div>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => deletePost(p.id)}><Trash2 className="h-4 w-4 text-red-400" /></Button>
                </div>
              ))}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="replies" className="mt-4">
          <ScrollArea className="h-[500px]">
            <div className="space-y-2">
              {filteredReplies.map((r) => (
                <div key={r.id} className="flex items-start gap-3 p-3 rounded-lg bg-white/[0.03]">
                  <MessageSquare className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <code className="text-[10px] text-muted-foreground">{shortId(r.user_id)}</code>
                    <p className="text-sm line-clamp-2">{r.content}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">{formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}</p>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => deleteReply(r.id)}><Trash2 className="h-4 w-4 text-red-400" /></Button>
                </div>
              ))}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="reposts" className="mt-4">
          <ScrollArea className="h-[500px]">
            <div className="space-y-2">
              {reposts.map((r) => (
                <div key={r.id} className="flex items-center justify-between p-3 rounded-lg bg-white/[0.03]">
                  <div className="flex items-center gap-3">
                    <Repeat className="h-4 w-4 text-green-400" />
                    <div>
                      <code className="text-[10px] text-muted-foreground">{shortId(r.user_id)}</code>
                      <p className="text-xs text-muted-foreground">Post: {shortId(r.post_id || r.original_post_id || "")}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}</span>
                    <Button size="sm" variant="ghost" onClick={() => deleteRepost(r.id)}><Trash2 className="h-4 w-4 text-red-400" /></Button>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
};

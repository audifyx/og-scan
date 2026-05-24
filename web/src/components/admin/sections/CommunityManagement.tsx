/* ══════════════════════════════════════════════════════════════
   Admin · Community Management
   Features: list, create, edit, delete, manage members,
   moderate posts, pin/unpin, feature, analytics
   ══════════════════════════════════════════════════════════════ */
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { logAudit, shortId } from "../helpers";
import {
  Globe2, Search, Trash2, Users, Star, Eye, Pin,
  MessageSquare, Edit, Loader2, RefreshCw, Plus,
  CheckCircle, X, UserMinus, Shield, Heart,
} from "lucide-react";
import type { Community, CommunityPost, CommunityMember } from "../types";

export const CommunityManagement = () => {
  const { user: admin } = useAuth();
  const [communities, setCommunities] = useState<Community[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Detail modal
  const [selected, setSelected] = useState<Community | null>(null);
  const [detailTab, setDetailTab] = useState("info");
  const [members, setMembers] = useState<CommunityMember[]>([]);
  const [posts, setPosts] = useState<CommunityPost[]>([]);

  // Create/edit modal
  const [showCreate, setShowCreate] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [formName, setFormName] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formType, setFormType] = useState("public");
  const [formRules, setFormRules] = useState("");

  const fetch = async () => {
    setLoading(true);
    const { data } = await supabase.from("communities").select("*").order("created_at", { ascending: false });
    setCommunities(data || []);
    setLoading(false);
  };

  useEffect(() => { fetch(); }, []);

  const openDetail = async (c: Community) => {
    setSelected(c); setDetailTab("info");
    const [membersR, postsR] = await Promise.all([
      supabase.from("community_members").select("*").eq("community_id", c.id).order("joined_at", { ascending: false }).limit(200),
      supabase.from("community_posts").select("*").eq("community_id", c.id).order("created_at", { ascending: false }).limit(100),
    ]);
    setMembers(membersR.data || []);
    setPosts(postsR.data || []);
  };

  const toggleFeatured = async (c: Community) => {
    if (!admin) return;
    const { error } = await supabase.from("communities").update({ is_featured: !c.is_featured }).eq("id", c.id);
    if (error) { toast.error("Failed"); return; }
    await logAudit(admin.id, `${c.is_featured ? "Unfeatured" : "Featured"} community: ${c.name}`, "communities", c.id);
    toast.success(c.is_featured ? "Unfeatured" : "Featured");
    fetch();
  };

  const deleteCommunity = async (id: string, name: string) => {
    if (!admin || !window.confirm(`Delete community "${name}" and all its posts, members, and data?`)) return;
    await Promise.all([
      supabase.from("community_post_replies").delete().in("post_id", (await supabase.from("community_posts").select("id").eq("community_id", id)).data?.map((p: any) => p.id) || []),
      supabase.from("community_post_likes").delete().in("post_id", (await supabase.from("community_posts").select("id").eq("community_id", id)).data?.map((p: any) => p.id) || []),
      supabase.from("community_posts").delete().eq("community_id", id),
      supabase.from("community_members").delete().eq("community_id", id),
      supabase.from("community_bookmarks").delete().eq("community_id", id),
    ]);
    await supabase.from("communities").delete().eq("id", id);
    await logAudit(admin.id, `Deleted community: ${name}`, "communities", id);
    toast.success("Community deleted");
    setSelected(null);
    fetch();
  };

  const removeMember = async (memberId: string, communityId: string) => {
    if (!admin) return;
    await supabase.from("community_members").delete().eq("id", memberId);
    await logAudit(admin.id, "Removed community member", "community_members", memberId);
    toast.success("Member removed");
    if (selected) openDetail(selected);
  };

  const deletePost = async (postId: string) => {
    if (!admin || !window.confirm("Delete this post?")) return;
    await supabase.from("community_post_replies").delete().eq("post_id", postId);
    await supabase.from("community_post_likes").delete().eq("post_id", postId);
    await supabase.from("community_posts").delete().eq("id", postId);
    await logAudit(admin.id, "Deleted community post", "community_posts", postId);
    toast.success("Post deleted");
    if (selected) openDetail(selected);
  };

  const togglePinPost = async (postId: string, currentlyPinned: boolean) => {
    if (!admin) return;
    await supabase.from("community_posts").update({ is_pinned: !currentlyPinned }).eq("id", postId);
    toast.success(currentlyPinned ? "Unpinned" : "Pinned");
    if (selected) openDetail(selected);
  };

  const createOrEditCommunity = async () => {
    if (!admin || !formName.trim()) return;
    if (editMode && selected) {
      const { error } = await supabase.from("communities").update({
        name: formName, description: formDesc || null, type: formType, rules: formRules || null,
      }).eq("id", selected.id);
      if (error) { toast.error("Failed"); return; }
      await logAudit(admin.id, `Edited community: ${formName}`, "communities", selected.id);
      toast.success("Updated");
    } else {
      const { error } = await supabase.from("communities").insert({
        name: formName, description: formDesc || null, type: formType,
        rules: formRules || null, creator_id: admin.id, member_count: 0,
      });
      if (error) { toast.error("Failed"); return; }
      await logAudit(admin.id, `Created community: ${formName}`, "communities");
      toast.success("Created");
    }
    setShowCreate(false);
    fetch();
  };

  const openEditForm = (c: Community) => {
    setFormName(c.name);
    setFormDesc(c.description || "");
    setFormType(c.type);
    setFormRules(c.rules || "");
    setEditMode(true);
    setShowCreate(true);
  };

  const openCreateForm = () => {
    setFormName(""); setFormDesc(""); setFormType("public"); setFormRules("");
    setEditMode(false);
    setShowCreate(true);
  };

  const filtered = communities.filter((c) => !search || c.name.toLowerCase().includes(search.toLowerCase()));

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-[#22d3ee]" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-3"><Globe2 className="h-6 w-6 text-[#22d3ee]" /> Community Management</h2>
          <p className="text-sm text-muted-foreground">{communities.length} communities</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={openCreateForm} size="sm" className="gap-2"><Plus className="h-3.5 w-3.5" /> Create</Button>
          <Button onClick={fetch} variant="outline" size="sm" className="gap-2"><RefreshCw className="h-3.5 w-3.5" /></Button>
        </div>
      </div>

      <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Search communities…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" /></div>

      <Card className="og-glass-card">
        <CardContent className="p-0">
          <ScrollArea className="h-[550px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Community</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Members</TableHead>
                  <TableHead>Featured</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((c) => (
                  <TableRow key={c.id} className="cursor-pointer hover:bg-white/[0.03]" onClick={() => openDetail(c)}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-xs font-bold">{c.name.charAt(0)}</div>
                        <div>
                          <p className="font-medium text-sm">{c.name}</p>
                          <p className="text-[10px] text-muted-foreground truncate max-w-[200px]">{c.description || "No description"}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell><Badge variant="outline">{c.type}</Badge></TableCell>
                    <TableCell><span className="text-sm">{c.member_count}</span></TableCell>
                    <TableCell><Switch checked={c.is_featured} onCheckedChange={() => toggleFeatured(c)} /></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}</TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" onClick={() => openEditForm(c)}><Edit className="h-4 w-4" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => deleteCommunity(c.id, c.name)}><Trash2 className="h-4 w-4 text-red-400" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Detail Modal */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-auto bg-[#0a1118] border-white/10">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <Globe2 className="h-6 w-6 text-[#22d3ee]" />
                  <div>
                    <p className="font-semibold">{selected.name}</p>
                    <p className="text-xs text-muted-foreground">{selected.type} · {selected.member_count} members</p>
                  </div>
                  {selected.is_featured && <Badge className="bg-yellow-500/20 text-yellow-400 ml-auto">Featured</Badge>}
                </DialogTitle>
              </DialogHeader>

              <Tabs value={detailTab} onValueChange={setDetailTab}>
                <TabsList className="bg-white/[0.04] w-full justify-start">
                  <TabsTrigger value="info">Info</TabsTrigger>
                  <TabsTrigger value="members">Members ({members.length})</TabsTrigger>
                  <TabsTrigger value="posts">Posts ({posts.length})</TabsTrigger>
                </TabsList>

                <TabsContent value="info" className="space-y-4">
                  <Card className="og-glass-card">
                    <CardContent className="p-4 space-y-3">
                      <div><Label className="text-xs text-muted-foreground">Description</Label><p className="text-sm">{selected.description || "—"}</p></div>
                      <div><Label className="text-xs text-muted-foreground">Rules</Label><p className="text-sm whitespace-pre-wrap">{selected.rules || "—"}</p></div>
                      <div className="grid grid-cols-3 gap-4">
                        <div><Label className="text-xs text-muted-foreground">Type</Label><p className="text-sm">{selected.type}</p></div>
                        <div><Label className="text-xs text-muted-foreground">Creator</Label><code className="text-xs">{shortId(selected.creator_id)}</code></div>
                        <div><Label className="text-xs text-muted-foreground">Tags</Label><p className="text-sm">{selected.tags?.join(", ") || "—"}</p></div>
                      </div>
                    </CardContent>
                  </Card>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => openEditForm(selected)} className="gap-2"><Edit className="h-3.5 w-3.5" /> Edit</Button>
                    <Button size="sm" variant="outline" onClick={() => toggleFeatured(selected)} className="gap-2"><Star className="h-3.5 w-3.5" /> {selected.is_featured ? "Unfeature" : "Feature"}</Button>
                    <Button size="sm" variant="outline" onClick={() => deleteCommunity(selected.id, selected.name)} className="gap-2 text-red-400 border-red-500/30"><Trash2 className="h-3.5 w-3.5" /> Delete</Button>
                  </div>
                </TabsContent>

                <TabsContent value="members">
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-2">
                      {members.map((m) => (
                        <div key={m.id} className="flex items-center justify-between p-3 rounded-lg bg-white/[0.03]">
                          <div className="flex items-center gap-3">
                            <Users className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <code className="text-xs">{shortId(m.user_id)}</code>
                              <p className="text-[10px] text-muted-foreground">{m.role} · joined {formatDistanceToNow(new Date(m.joined_at), { addSuffix: true })}</p>
                            </div>
                          </div>
                          <Button size="sm" variant="ghost" onClick={() => removeMember(m.id, selected.id)} title="Remove member">
                            <UserMinus className="h-4 w-4 text-red-400" />
                          </Button>
                        </div>
                      ))}
                      {members.length === 0 && <p className="text-center py-8 text-sm text-muted-foreground">No members</p>}
                    </div>
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="posts">
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-2">
                      {posts.map((p) => (
                        <div key={p.id} className="p-3 rounded-lg bg-white/[0.03] border border-white/[0.05]">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <code className="text-[10px] text-muted-foreground">{shortId(p.user_id)}</code>
                                {p.is_pinned && <Badge className="text-[10px] bg-yellow-500/20 text-yellow-400"><Pin className="h-2.5 w-2.5 mr-0.5" /> Pinned</Badge>}
                              </div>
                              <p className="text-sm whitespace-pre-wrap line-clamp-3">{p.content}</p>
                              <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground">
                                <span className="flex items-center gap-1"><Heart className="h-3 w-3" /> {p.like_count}</span>
                                <span className="flex items-center gap-1"><MessageSquare className="h-3 w-3" /> {p.reply_count}</span>
                                <span>{formatDistanceToNow(new Date(p.created_at), { addSuffix: true })}</span>
                              </div>
                            </div>
                            <div className="flex gap-1 flex-shrink-0">
                              <Button size="sm" variant="ghost" onClick={() => togglePinPost(p.id, p.is_pinned)} title={p.is_pinned ? "Unpin" : "Pin"}>
                                <Pin className="h-3.5 w-3.5" />
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => deletePost(p.id)} title="Delete post">
                                <Trash2 className="h-3.5 w-3.5 text-red-400" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                      {posts.length === 0 && <p className="text-center py-8 text-sm text-muted-foreground">No posts</p>}
                    </div>
                  </ScrollArea>
                </TabsContent>
              </Tabs>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Create/Edit Modal */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg bg-[#0a1118] border-white/10">
          <DialogHeader><DialogTitle>{editMode ? "Edit" : "Create"} Community</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Name</Label><Input value={formName} onChange={(e) => setFormName(e.target.value)} className="mt-1" /></div>
            <div><Label>Description</Label><Textarea value={formDesc} onChange={(e) => setFormDesc(e.target.value)} className="mt-1" rows={3} /></div>
            <div><Label>Type</Label>
              <Select value={formType} onValueChange={setFormType}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="public">Public</SelectItem>
                  <SelectItem value="invite-only">Invite Only</SelectItem>
                  <SelectItem value="holder-only">Holder Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Rules</Label><Textarea value={formRules} onChange={(e) => setFormRules(e.target.value)} className="mt-1" rows={3} /></div>
            <div className="flex gap-2">
              <Button onClick={createOrEditCommunity} className="flex-1 gap-2"><CheckCircle className="h-4 w-4" /> {editMode ? "Save Changes" : "Create"}</Button>
              <Button variant="outline" onClick={() => setShowCreate(false)} className="flex-1"><X className="h-4 w-4 mr-1" /> Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

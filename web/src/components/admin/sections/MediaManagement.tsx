/* ══════════════════════════════════════════════════════════════
   Admin · Media Management
   Features: profile media, token images, wallpapers —
   view gallery, delete, bulk delete, storage analytics
   ══════════════════════════════════════════════════════════════ */
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Image, Search, Trash2, Loader2, RefreshCw, Film,
  User, Coins, Palette, Eye, Download, Grid,
} from "lucide-react";

export const MediaManagement = () => {
  const { user: admin } = useAuth();
  const [tab, setTab] = useState("profiles");
  const [profileMedia, setProfileMedia] = useState<any[]>([]);
  const [tokenImages, setTokenImages] = useState<any[]>([]);
  const [wallpapers, setWallpapers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const fetch = async () => {
    setLoading(true);
    const [pmR, tiR, wR] = await Promise.all([
      supabase.from("profile-media").select("*").order("created_at", { ascending: false }).limit(500),
      supabase.from("token-images").select("*").order("created_at", { ascending: false }).limit(500),
      supabase.from("wallpapers").select("*").order("created_at", { ascending: false }).limit(200),
    ]);
    setProfileMedia(pmR.data || []);
    setTokenImages(tiR.data || []);
    setWallpapers(wR.data || []);
    setLoading(false);
  };

  useEffect(() => { fetch(); }, []);

  const deleteItem = async (table: string, id: string) => {
    if (!admin) return;
    await supabase.from(table).delete().eq("id", id);
    toast.success("Deleted");
    fetch();
  };

  const bulkDelete = async (table: string) => {
    if (!admin || selected.size === 0 || !window.confirm(`Delete ${selected.size} items?`)) return;
    for (const id of selected) await supabase.from(table).delete().eq("id", id);
    await logAudit(admin.id, `Bulk deleted ${selected.size} from ${table}`, table);
    toast.success(`${selected.size} deleted`);
    setSelected(new Set());
    fetch();
  };

  const clearAll = async (table: string, label: string) => {
    if (!admin || !window.confirm(`Delete ALL ${label}?`)) return;
    await supabase.from(table).delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await logAudit(admin.id, `Cleared all ${label}`, table);
    toast.success(`All ${label} cleared`);
    fetch();
  };

  const toggle = (id: string) => {
    setSelected((p) => { const s = new Set(p); s.has(id) ? s.delete(id) : s.add(id); return s; });
  };

  const MediaCard = ({ item, table, imageKey }: { item: any; table: string; imageKey: string }) => {
    const url = item[imageKey] || item.url || item.image_url || item.file_url;
    return (
      <div className="relative group rounded-xl overflow-hidden bg-white/[0.03] border border-white/[0.05]">
        <div className="aspect-square relative">
          {url ? (
            <img src={url} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).src = ""; }} />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-white/[0.02]"><Image className="h-8 w-8 text-muted-foreground/30" /></div>
          )}
          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
            {url && <Button size="sm" variant="outline" onClick={() => setPreviewUrl(url)} className="h-8"><Eye className="h-3.5 w-3.5" /></Button>}
            <Button size="sm" variant="outline" onClick={() => deleteItem(table, item.id)} className="h-8 text-red-400 border-red-500/30"><Trash2 className="h-3.5 w-3.5" /></Button>
          </div>
        </div>
        <div className="p-2">
          <p className="text-[10px] text-muted-foreground truncate">{item.name || item.file_name || shortId(item.id)}</p>
          <div className="flex items-center justify-between mt-0.5">
            <code className="text-[10px] text-muted-foreground/70">{shortId(item.user_id || "")}</code>
            <input type="checkbox" checked={selected.has(item.id)} onChange={() => toggle(item.id)} className="rounded h-3 w-3" />
          </div>
        </div>
      </div>
    );
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-[#22d3ee]" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-3"><Image className="h-6 w-6 text-[#22d3ee]" /> Media Management</h2>
          <p className="text-sm text-muted-foreground">{profileMedia.length + tokenImages.length + wallpapers.length} total items</p>
        </div>
        <Button onClick={fetch} variant="outline" size="sm"><RefreshCw className="h-3.5 w-3.5" /></Button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card className="og-glass-card"><CardContent className="p-3 flex items-center gap-2"><User className="h-5 w-5 text-blue-400" /><div><p className="text-lg font-bold">{profileMedia.length}</p><p className="text-[10px] text-muted-foreground">Profile Media</p></div></CardContent></Card>
        <Card className="og-glass-card"><CardContent className="p-3 flex items-center gap-2"><Coins className="h-5 w-5 text-purple-400" /><div><p className="text-lg font-bold">{tokenImages.length}</p><p className="text-[10px] text-muted-foreground">Token Images</p></div></CardContent></Card>
        <Card className="og-glass-card"><CardContent className="p-3 flex items-center gap-2"><Palette className="h-5 w-5 text-pink-400" /><div><p className="text-lg font-bold">{wallpapers.length}</p><p className="text-[10px] text-muted-foreground">Wallpapers</p></div></CardContent></Card>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Search media…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" /></div>
        {selected.size > 0 && (
          <Button variant="outline" size="sm" onClick={() => bulkDelete(tab === "profiles" ? "profile-media" : tab === "tokens" ? "token-images" : "wallpapers")} className="gap-2 text-red-400"><Trash2 className="h-3.5 w-3.5" /> Delete {selected.size}</Button>
        )}
      </div>

      <Tabs value={tab} onValueChange={(v) => { setTab(v); setSelected(new Set()); }}>
        <TabsList className="bg-white/[0.04]">
          <TabsTrigger value="profiles">Profile Media ({profileMedia.length})</TabsTrigger>
          <TabsTrigger value="tokens">Token Images ({tokenImages.length})</TabsTrigger>
          <TabsTrigger value="wallpapers">Wallpapers ({wallpapers.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="profiles" className="mt-4">
          <div className="flex gap-2 mb-4">
            <Button variant="outline" size="sm" onClick={() => clearAll("profile-media", "profile media")} className="gap-2 text-red-400 border-red-500/30"><Trash2 className="h-3.5 w-3.5" /> Clear All</Button>
          </div>
          <ScrollArea className="h-[500px]">
            <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {profileMedia.map((m) => <MediaCard key={m.id} item={m} table="profile-media" imageKey="url" />)}
            </div>
            {profileMedia.length === 0 && <p className="text-center py-8 text-muted-foreground">No profile media</p>}
          </ScrollArea>
        </TabsContent>

        <TabsContent value="tokens" className="mt-4">
          <div className="flex gap-2 mb-4">
            <Button variant="outline" size="sm" onClick={() => clearAll("token-images", "token images")} className="gap-2 text-red-400 border-red-500/30"><Trash2 className="h-3.5 w-3.5" /> Clear All</Button>
          </div>
          <ScrollArea className="h-[500px]">
            <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {tokenImages.map((m) => <MediaCard key={m.id} item={m} table="token-images" imageKey="image_url" />)}
            </div>
            {tokenImages.length === 0 && <p className="text-center py-8 text-muted-foreground">No token images</p>}
          </ScrollArea>
        </TabsContent>

        <TabsContent value="wallpapers" className="mt-4">
          <div className="flex gap-2 mb-4">
            <Button variant="outline" size="sm" onClick={() => clearAll("wallpapers", "wallpapers")} className="gap-2 text-red-400 border-red-500/30"><Trash2 className="h-3.5 w-3.5" /> Clear All</Button>
          </div>
          <ScrollArea className="h-[500px]">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {wallpapers.map((w) => <MediaCard key={w.id} item={w} table="wallpapers" imageKey="url" />)}
            </div>
            {wallpapers.length === 0 && <p className="text-center py-8 text-muted-foreground">No wallpapers</p>}
          </ScrollArea>
        </TabsContent>
      </Tabs>

      {/* Preview Modal */}
      {previewUrl && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center" onClick={() => setPreviewUrl(null)}>
          <div className="relative max-w-3xl max-h-[90vh]">
            <img src={previewUrl} alt="" className="max-w-full max-h-[85vh] object-contain rounded-xl" />
            <Button size="sm" variant="outline" className="absolute top-2 right-2" onClick={() => setPreviewUrl(null)}>✕</Button>
          </div>
        </div>
      )}
    </div>
  );
};

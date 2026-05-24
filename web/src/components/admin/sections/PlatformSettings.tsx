/* ══════════════════════════════════════════════════════════════
   Admin · Platform Settings
   Features: view/edit all settings, categorized, feature flags,
   maintenance mode, JSON editor, reset defaults
   ══════════════════════════════════════════════════════════════ */
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { logAudit } from "../helpers";
import {
  Settings, Loader2, RefreshCw, Save, Trash2, Plus,
  Edit, AlertTriangle, Shield, Zap, Globe2, Lock,
  Database, CheckCircle, Wrench, Eye, Palette,
} from "lucide-react";

const CATEGORIES = [
  { key: "general", label: "General", icon: Globe2 },
  { key: "features", label: "Feature Flags", icon: Zap },
  { key: "security", label: "Security", icon: Shield },
  { key: "limits", label: "Limits & Quotas", icon: Database },
  { key: "appearance", label: "Appearance", icon: Palette },
  { key: "maintenance", label: "Maintenance", icon: Wrench },
];

export const PlatformSettings = () => {
  const { user: admin } = useAuth();
  const [settings, setSettings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState("general");
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [hasChanges, setHasChanges] = useState(false);

  // Add new setting
  const [showAdd, setShowAdd] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");
  const [newCategory, setNewCategory] = useState("general");
  const [newType, setNewType] = useState("string");

  const fetch = async () => {
    setLoading(true);
    const { data } = await supabase.from("platform_settings").select("*").order("key", { ascending: true });
    setSettings(data || []);
    const vals: Record<string, string> = {};
    (data || []).forEach((s: any) => { vals[s.id] = typeof s.value === "object" ? JSON.stringify(s.value, null, 2) : String(s.value ?? ""); });
    setEditValues(vals);
    setHasChanges(false);
    setLoading(false);
  };

  useEffect(() => { fetch(); }, []);

  const updateSetting = async (id: string, key: string) => {
    if (!admin) return;
    const newVal = editValues[id];
    let parsedValue: any = newVal;
    try { parsedValue = JSON.parse(newVal); } catch { /* keep as string */ }
    const { error } = await supabase.from("platform_settings").update({ value: parsedValue, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) { toast.error("Failed"); return; }
    await logAudit(admin.id, `Updated setting: ${key}`, "platform_settings", id, undefined, { value: parsedValue });
    toast.success(`${key} updated`);
    fetch();
  };

  const saveAllChanges = async () => {
    if (!admin) return;
    let saved = 0;
    for (const s of settings) {
      const origVal = typeof s.value === "object" ? JSON.stringify(s.value, null, 2) : String(s.value ?? "");
      if (editValues[s.id] !== origVal) {
        let parsedValue: any = editValues[s.id];
        try { parsedValue = JSON.parse(editValues[s.id]); } catch { /* keep as string */ }
        await supabase.from("platform_settings").update({ value: parsedValue, updated_at: new Date().toISOString() }).eq("id", s.id);
        saved++;
      }
    }
    if (saved > 0) {
      await logAudit(admin.id, `Bulk updated ${saved} settings`, "platform_settings");
      toast.success(`${saved} settings updated`);
    } else {
      toast.info("No changes to save");
    }
    fetch();
  };

  const deleteSetting = async (id: string, key: string) => {
    if (!admin || !window.confirm(`Delete setting "${key}"?`)) return;
    await supabase.from("platform_settings").delete().eq("id", id);
    await logAudit(admin.id, `Deleted setting: ${key}`, "platform_settings", id);
    toast.success("Deleted");
    fetch();
  };

  const addSetting = async () => {
    if (!admin || !newKey.trim()) return;
    let parsedValue: any = newValue;
    try { parsedValue = JSON.parse(newValue); } catch { /* keep as string */ }
    const { error } = await supabase.from("platform_settings").insert({
      key: newKey.trim(), value: parsedValue, category: newCategory, type: newType,
    });
    if (error) { toast.error(error.message); return; }
    await logAudit(admin.id, `Created setting: ${newKey}`, "platform_settings");
    toast.success("Created");
    setShowAdd(false);
    setNewKey(""); setNewValue(""); setNewCategory("general"); setNewType("string");
    fetch();
  };

  const toggleBoolSetting = async (id: string, key: string, currentVal: any) => {
    if (!admin) return;
    const newVal = !currentVal;
    await supabase.from("platform_settings").update({ value: newVal, updated_at: new Date().toISOString() }).eq("id", id);
    await logAudit(admin.id, `Toggled ${key}: ${newVal}`, "platform_settings", id);
    toast.success(`${key}: ${newVal ? "ON" : "OFF"}`);
    fetch();
  };

  const categorized = settings.filter((s) => (s.category || "general") === activeCategory);

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-[#22d3ee]" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-3"><Settings className="h-6 w-6 text-[#22d3ee]" /> Platform Settings</h2>
          <p className="text-sm text-muted-foreground">{settings.length} settings configured</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setShowAdd(true)} size="sm" className="gap-2"><Plus className="h-3.5 w-3.5" /> Add Setting</Button>
          {hasChanges && <Button onClick={saveAllChanges} size="sm" className="gap-2 bg-green-600 hover:bg-green-700"><Save className="h-3.5 w-3.5" /> Save All</Button>}
          <Button onClick={fetch} variant="outline" size="sm"><RefreshCw className="h-3.5 w-3.5" /></Button>
        </div>
      </div>

      {/* Category tabs */}
      <div className="flex gap-2 flex-wrap">
        {CATEGORIES.map((cat) => {
          const count = settings.filter((s) => (s.category || "general") === cat.key).length;
          return (
            <Button key={cat.key} variant={activeCategory === cat.key ? "default" : "outline"} size="sm" onClick={() => setActiveCategory(cat.key)} className="gap-2">
              <cat.icon className="h-3.5 w-3.5" /> {cat.label} <Badge variant="outline" className="text-[10px] ml-1">{count}</Badge>
            </Button>
          );
        })}
      </div>

      {/* Settings list */}
      <ScrollArea className="h-[500px]">
        <div className="space-y-3">
          {categorized.length === 0 && (
            <Card className="og-glass-card"><CardContent className="p-8 text-center text-muted-foreground">
              No settings in this category. Click "Add Setting" to create one.
            </CardContent></Card>
          )}
          {categorized.map((s) => {
            const isBool = s.type === "boolean" || typeof s.value === "boolean";
            const isJson = typeof s.value === "object" && s.value !== null;
            return (
              <Card key={s.id} className="og-glass-card">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <p className="font-medium text-sm font-mono">{s.key}</p>
                        <Badge variant="outline" className="text-[10px]">{s.type || typeof s.value}</Badge>
                        {s.description && <p className="text-[10px] text-muted-foreground">{s.description}</p>}
                      </div>
                      {isBool ? (
                        <div className="flex items-center gap-3">
                          <Switch checked={!!s.value} onCheckedChange={() => toggleBoolSetting(s.id, s.key, s.value)} />
                          <span className={`text-sm ${s.value ? "text-green-400" : "text-red-400"}`}>{s.value ? "Enabled" : "Disabled"}</span>
                        </div>
                      ) : isJson || (editValues[s.id] || "").length > 80 ? (
                        <Textarea value={editValues[s.id] || ""} onChange={(e) => { setEditValues((p) => ({ ...p, [s.id]: e.target.value })); setHasChanges(true); }} className="font-mono text-xs" rows={4} />
                      ) : (
                        <Input value={editValues[s.id] || ""} onChange={(e) => { setEditValues((p) => ({ ...p, [s.id]: e.target.value })); setHasChanges(true); }} className="font-mono text-sm" />
                      )}
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      {!isBool && (
                        <Button size="sm" variant="outline" onClick={() => updateSetting(s.id, s.key)} className="gap-1.5">
                          <Save className="h-3.5 w-3.5" /> Save
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => deleteSetting(s.id, s.key)}><Trash2 className="h-4 w-4 text-red-400" /></Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </ScrollArea>

      {/* Add Setting Modal */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-lg bg-[#0a1118] border-white/10">
          <DialogHeader><DialogTitle>Add New Setting</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Key</Label><Input value={newKey} onChange={(e) => setNewKey(e.target.value)} className="mt-1 font-mono" placeholder="setting_key" /></div>
            <div><Label>Category</Label>
              <div className="flex gap-2 mt-1 flex-wrap">
                {CATEGORIES.map((cat) => (
                  <Button key={cat.key} size="sm" variant={newCategory === cat.key ? "default" : "outline"} onClick={() => setNewCategory(cat.key)}>{cat.label}</Button>
                ))}
              </div>
            </div>
            <div><Label>Type</Label>
              <div className="flex gap-2 mt-1">
                {["string", "number", "boolean", "json"].map((t) => (
                  <Button key={t} size="sm" variant={newType === t ? "default" : "outline"} onClick={() => setNewType(t)}>{t}</Button>
                ))}
              </div>
            </div>
            <div><Label>Value</Label><Textarea value={newValue} onChange={(e) => setNewValue(e.target.value)} className="mt-1 font-mono" rows={3} /></div>
            <div className="flex gap-2">
              <Button onClick={addSetting} className="flex-1 gap-2"><CheckCircle className="h-4 w-4" /> Create</Button>
              <Button variant="outline" onClick={() => setShowAdd(false)} className="flex-1">Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

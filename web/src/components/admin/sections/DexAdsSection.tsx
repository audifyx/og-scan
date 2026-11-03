/* ══════════════════════════════════════════════════════════════
   Admin · DEX Ads, Boosts, Listings & Saved Filters
   One section, four tabs. Saving an ad + placement here is all it
   takes for the slot to go live — DexAdSlot (web/src/trade/) reads
   the same tables and renders the highest-priority ACTIVE placement,
   so nothing else needs a code change after this dashboard save.
   Tables live in dex-ads-boosts-listings.sql (NOT applied by this UI).
   ══════════════════════════════════════════════════════════════ */
import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { logAudit } from "../helpers";
import { DEX_PLACEMENTS, PLACEMENT_META, type DexPlacement } from "@/lib/dexAds";
import {
  Megaphone, Zap, ListChecks, Bookmark, Trash2, Loader2, RefreshCw,
  Plus, Pencil, X, Check, Ban, ExternalLink, Clock,
} from "lucide-react";

/* ── Row types (mirror dex-ads-boosts-listings.sql) ── */
type AdRow = {
  id: string; title: string; body: string | null; image_url: string | null;
  link_url: string | null; target_type: string; target_mint: string | null;
  target_section: string | null; status: string;
  starts_at: string | null; ends_at: string | null; created_at: string;
  dex_ad_placements?: PlacementRow[];
};
type PlacementRow = {
  id: string; ad_id: string; placement: DexPlacement; section: string | null;
  priority: number; starts_at: string | null; ends_at: string | null; active: boolean;
};
type BoostRow = {
  id: string; mint: string; tier: string; starts_at: string;
  ends_at: string | null; status: string; created_at: string;
};
type ListingRow = {
  id: string; mint: string; symbol: string | null; name: string | null;
  status: string; listed_at: string | null; source: string; created_at: string;
};
type FilterRow = {
  id: string; user_id: string; name: string; filters: Record<string, unknown>;
  is_default: boolean; created_at: string;
};

type Tab = "ads" | "boosts" | "listings" | "filters";

const BOOST_TIERS = ["standard", "premium", "turbo"] as const;
const AD_STATUSES = ["draft", "active", "paused", "ended"] as const;
const TARGET_TYPES = ["token", "section", "global"] as const;

const emptyAd = {
  title: "", body: "", image_url: "", link_url: "",
  target_type: "global", target_mint: "", target_section: "",
  status: "draft", starts_at: "", ends_at: "",
  placement: "home-top" as DexPlacement, priority: 0, placement_active: true,
};
const emptyBoost = { mint: "", tier: "standard", starts_at: "", ends_at: "", status: "active" };
const emptyListing = { mint: "", symbol: "", name: "", source: "manual" };

function dtLocal(iso: string | null): string {
  return iso ? iso.slice(0, 16) : "";
}
function toIso(local: string): string | null {
  return local ? new Date(local).toISOString() : null;
}
function isLive(starts: string | null, ends: string | null, status: string): boolean {
  if (status !== "active") return false;
  const now = Date.now();
  if (starts && new Date(starts).getTime() > now) return false;
  if (ends && new Date(ends).getTime() <= now) return false;
  return true;
}

export const DexAdsSection = () => {
  const { user: admin } = useAuth();
  const [tab, setTab] = useState<Tab>("ads");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [ads, setAds] = useState<AdRow[]>([]);
  const [boosts, setBoosts] = useState<BoostRow[]>([]);
  const [listings, setListings] = useState<ListingRow[]>([]);
  const [filters, setFilters] = useState<FilterRow[]>([]);

  const [adForm, setAdForm] = useState(emptyAd);
  const [editingAdId, setEditingAdId] = useState<string | null>(null);
  const [editingPlacementId, setEditingPlacementId] = useState<string | null>(null);
  const [boostForm, setBoostForm] = useState(emptyBoost);
  const [editingBoostId, setEditingBoostId] = useState<string | null>(null);
  const [listingForm, setListingForm] = useState(emptyListing);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [adsR, boostsR, listingsR, filtersR] = await Promise.all([
      supabase.from("dex_ads").select("*, dex_ad_placements(*)").order("created_at", { ascending: false }),
      supabase.from("dex_boosts").select("*").order("created_at", { ascending: false }),
      supabase.from("dex_listings").select("*").order("created_at", { ascending: false }),
      supabase.from("dex_saved_filters").select("*").order("created_at", { ascending: false }),
    ]);
    if (adsR.error) toast.error(`Ads: ${adsR.error.message}`);
    if (boostsR.error) toast.error(`Boosts: ${boostsR.error.message}`);
    if (listingsR.error) toast.error(`Listings: ${listingsR.error.message}`);
    if (filtersR.error) toast.error(`Saved filters: ${filtersR.error.message}`);
    setAds((adsR.data as AdRow[]) || []);
    setBoosts((boostsR.data as BoostRow[]) || []);
    setListings((listingsR.data as ListingRow[]) || []);
    setFilters((filtersR.data as FilterRow[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  /* ── Ads ── */
  const resetAdForm = () => { setAdForm(emptyAd); setEditingAdId(null); setEditingPlacementId(null); };

  const startEditAd = (a: AdRow) => {
    const p = (a.dex_ad_placements || [])[0];
    setEditingAdId(a.id);
    setEditingPlacementId(p ? p.id : null);
    setAdForm({
      title: a.title, body: a.body || "", image_url: a.image_url || "",
      link_url: a.link_url || "", target_type: a.target_type || "global",
      target_mint: a.target_mint || "", target_section: a.target_section || "",
      status: a.status || "draft",
      starts_at: dtLocal(a.starts_at), ends_at: dtLocal(a.ends_at),
      placement: (p?.placement || "home-top") as DexPlacement,
      priority: p?.priority ?? 0, placement_active: p ? p.active : true,
    });
  };

  const saveAd = async () => {
    if (!admin) return;
    if (!adForm.title.trim()) { toast.error("Title is required"); return; }
    if (adForm.target_type === "token" && !adForm.target_mint.trim()) {
      toast.error("A token-targeted ad needs a mint address");
      return;
    }
    setSaving(true);
    const payload: Record<string, unknown> = {
      title: adForm.title.trim(),
      body: adForm.body.trim() || null,
      image_url: adForm.image_url.trim() || null,
      link_url: adForm.link_url.trim() || null,
      target_type: adForm.target_type,
      target_mint: adForm.target_mint.trim() || null,
      target_section: adForm.target_section.trim() || null,
      status: adForm.status,
      starts_at: toIso(adForm.starts_at) || new Date().toISOString(),
      ends_at: toIso(adForm.ends_at),
    };
    let adId = editingAdId;
    let error: { message: string } | null = null;
    if (adId) {
      ({ error } = await supabase.from("dex_ads").update(payload).eq("id", adId));
    } else {
      payload.created_by = admin.id;
      const { data, error: e2 } = await supabase.from("dex_ads").insert(payload).select("id").single();
      error = e2;
      adId = (data as { id: string } | null)?.id || null;
    }
    // Placement: the row that makes the ad actually appear in a slot.
    if (!error && adId) {
      const placementPayload: Record<string, unknown> = {
        ad_id: adId,
        placement: adForm.placement,
        section: adForm.target_section.trim() || null,
        priority: Number(adForm.priority) || 0,
        starts_at: toIso(adForm.starts_at) || new Date().toISOString(),
        ends_at: toIso(adForm.ends_at),
        active: adForm.placement_active,
      };
      if (editingPlacementId) {
        ({ error } = await supabase.from("dex_ad_placements").update(placementPayload).eq("id", editingPlacementId));
      } else {
        placementPayload.created_by = admin.id;
        ({ error } = await supabase.from("dex_ad_placements").insert(placementPayload));
      }
    }
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    await logAudit(admin.id, `${editingAdId ? "Updated" : "Created"} DEX ad: ${payload.title} → ${adForm.placement}`, "dex_ads", adId || undefined);
    toast.success(editingAdId ? "Ad updated" : `Ad created — live in ${PLACEMENT_META[adForm.placement].label} once active`);
    resetAdForm();
    fetchAll();
  };

  const removeAd = async (a: AdRow) => {
    if (!admin || !window.confirm(`Delete ad "${a.title}"? Its placements go with it.`)) return;
    const { error } = await supabase.from("dex_ads").delete().eq("id", a.id);
    if (error) { toast.error(error.message); return; }
    await logAudit(admin.id, `Deleted DEX ad: ${a.title}`, "dex_ads", a.id);
    toast.success("Ad deleted");
    if (editingAdId === a.id) resetAdForm();
    fetchAll();
  };

  const togglePlacement = async (p: PlacementRow) => {
    const { error } = await supabase.from("dex_ad_placements").update({ active: !p.active }).eq("id", p.id);
    if (error) { toast.error(error.message); return; }
    toast.success(p.active ? "Placement paused — slot now renders nothing" : "Placement live");
    fetchAll();
  };

  /* ── Boosts ── */
  const saveBoost = async () => {
    if (!admin) return;
    if (!boostForm.mint.trim()) { toast.error("Mint address is required"); return; }
    setSaving(true);
    const payload: Record<string, unknown> = {
      mint: boostForm.mint.trim(),
      tier: boostForm.tier,
      starts_at: toIso(boostForm.starts_at) || new Date().toISOString(),
      ends_at: toIso(boostForm.ends_at),
      status: boostForm.status,
    };
    let error: { message: string } | null = null;
    if (editingBoostId) {
      ({ error } = await supabase.from("dex_boosts").update(payload).eq("id", editingBoostId));
    } else {
      payload.created_by = admin.id;
      ({ error } = await supabase.from("dex_boosts").insert(payload));
    }
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    await logAudit(admin.id, `${editingBoostId ? "Updated" : "Created"} DEX boost: ${payload.mint} (${payload.tier})`, "dex_boosts");
    toast.success(editingBoostId ? "Boost updated" : "Boost set");
    setBoostForm(emptyBoost); setEditingBoostId(null);
    fetchAll();
  };

  const removeBoost = async (b: BoostRow) => {
    if (!admin || !window.confirm(`Remove ${b.tier} boost for ${b.mint.slice(0, 12)}…?`)) return;
    const { error } = await supabase.from("dex_boosts").delete().eq("id", b.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Boost removed");
    fetchAll();
  };

  /* ── Listings ── */
  const saveListing = async () => {
    if (!admin) return;
    if (!listingForm.mint.trim()) { toast.error("Mint address is required"); return; }
    setSaving(true);
    const { error } = await supabase.from("dex_listings").insert({
      mint: listingForm.mint.trim(),
      symbol: listingForm.symbol.trim() || null,
      name: listingForm.name.trim() || null,
      source: listingForm.source,
      submitted_by: admin.id,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Listing added as pending");
    setListingForm(emptyListing);
    fetchAll();
  };

  const reviewListing = async (l: ListingRow, approve: boolean) => {
    if (!admin) return;
    const { error } = await supabase.from("dex_listings").update({
      status: approve ? "approved" : "rejected",
      listed_at: approve ? new Date().toISOString() : null,
      reviewed_by: admin.id,
    }).eq("id", l.id);
    if (error) { toast.error(error.message); return; }
    await logAudit(admin.id, `${approve ? "Approved" : "Rejected"} DEX listing: ${l.symbol || l.mint}`, "dex_listings", l.id);
    toast.success(approve ? "Listing approved — visible publicly" : "Listing rejected");
    fetchAll();
  };

  const removeFilter = async (f: FilterRow) => {
    if (!admin || !window.confirm(`Delete saved filter "${f.name}"?`)) return;
    const { error } = await supabase.from("dex_saved_filters").delete().eq("id", f.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Filter deleted");
    fetchAll();
  };

  const activeAds = ads.filter((a) => isLive(a.starts_at, a.ends_at, a.status));
  const pendingListings = listings.filter((l) => l.status === "pending");

  const tabs: { id: Tab; label: string; icon: any; count?: number }[] = [
    { id: "ads", label: "Ads", icon: Megaphone, count: activeAds.length },
    { id: "boosts", label: "Boosts", icon: Zap, count: boosts.filter((b) => b.status === "active").length },
    { id: "listings", label: "Listings", icon: ListChecks, count: pendingListings.length },
    { id: "filters", label: "Saved filters", icon: Bookmark, count: filters.length },
  ];

  return (
    <div className="space-y-5">
      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => {
          const Icon = t.icon;
          const on = tab === t.id;
          return (
            <button key={t.id} type="button" onClick={() => setTab(t.id)}
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold transition ${on ? "border-cyan-300/40 bg-cyan-300/10 text-white" : "border-white/10 bg-white/[0.03] text-white/55 hover:text-white"}`}>
              <Icon className="h-3.5 w-3.5" />
              {t.label}
              {t.count !== undefined && t.count > 0 && (
                <Badge variant="outline" className="h-4 rounded-full px-1.5 text-[10px]">{t.count}</Badge>
              )}
            </button>
          );
        })}
        <Button variant="ghost" size="sm" onClick={fetchAll} disabled={loading} className="ml-auto">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : tab === "ads" ? (
        <>
          {/* Ad composer */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <Megaphone className="h-4 w-4" />
                {editingAdId ? "Edit ad" : "New ad"}
              </CardTitle>
              {editingAdId && (
                <Button variant="ghost" size="sm" onClick={resetAdForm}>
                  <X className="h-4 w-4 mr-1" /> Cancel edit
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Title</Label>
                  <Input value={adForm.title} maxLength={90}
                    onChange={(e) => setAdForm({ ...adForm, title: e.target.value })}
                    placeholder="e.g. New launch — 0% fees this week" />
                </div>
                <div className="space-y-1.5">
                  <Label>Link URL (optional)</Label>
                  <Input value={adForm.link_url}
                    onChange={(e) => setAdForm({ ...adForm, link_url: e.target.value })}
                    placeholder="https://… (opens in a new tab)" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Body</Label>
                <Textarea value={adForm.body} rows={2}
                  onChange={(e) => setAdForm({ ...adForm, body: e.target.value })}
                  placeholder="One or two lines of ad copy" />
              </div>
              <div className="space-y-1.5">
                <Label>Image URL (optional)</Label>
                <Input value={adForm.image_url}
                  onChange={(e) => setAdForm({ ...adForm, image_url: e.target.value })}
                  placeholder="https://…/banner.png" />
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label>Target</Label>
                  <Select value={adForm.target_type} onValueChange={(v) => setAdForm({ ...adForm, target_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TARGET_TYPES.map((t) => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Target mint {adForm.target_type === "token" ? "(required)" : "(token ads)"}</Label>
                  <Input value={adForm.target_mint} className="font-mono text-xs"
                    onChange={(e) => setAdForm({ ...adForm, target_mint: e.target.value })}
                    placeholder="Token mint address" />
                </div>
                <div className="space-y-1.5">
                  <Label>Target section</Label>
                  <Input value={adForm.target_section}
                    onChange={(e) => setAdForm({ ...adForm, target_section: e.target.value })}
                    placeholder="e.g. trade-home" />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-4">
                <div className="space-y-1.5">
                  <Label>Placement</Label>
                  <Select value={adForm.placement} onValueChange={(v) => setAdForm({ ...adForm, placement: v as DexPlacement })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {DEX_PLACEMENTS.map((p) => <SelectItem key={p} value={p}>{PLACEMENT_META[p].label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] leading-4 text-white/40">{PLACEMENT_META[adForm.placement].where}</p>
                </div>
                <div className="space-y-1.5">
                  <Label>Priority (higher wins)</Label>
                  <Input type="number" value={adForm.priority}
                    onChange={(e) => setAdForm({ ...adForm, priority: Number(e.target.value) || 0 })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Starts</Label>
                  <Input type="datetime-local" value={adForm.starts_at}
                    onChange={(e) => setAdForm({ ...adForm, starts_at: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Ends (optional)</Label>
                  <Input type="datetime-local" value={adForm.ends_at}
                    onChange={(e) => setAdForm({ ...adForm, ends_at: e.target.value })} />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="space-y-1.5">
                  <Label>Status</Label>
                  <Select value={adForm.status} onValueChange={(v) => setAdForm({ ...adForm, status: v })}>
                    <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {AD_STATUSES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <label className="mt-5 flex cursor-pointer items-center gap-2 text-xs text-white/60">
                  <input type="checkbox" checked={adForm.placement_active}
                    onChange={(e) => setAdForm({ ...adForm, placement_active: e.target.checked })} />
                  Placement active
                </label>
                <Button onClick={saveAd} disabled={saving} className="mt-5">
                  {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : editingAdId ? <Pencil className="h-4 w-4 mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
                  {editingAdId ? "Save changes" : "Create ad + placement"}
                </Button>
              </div>

              {/* Live preview — exactly what DexAdSlot renders */}
              {adForm.title.trim() && (
                <div className="space-y-1.5 rounded-xl border border-white/10 bg-black/30 p-3">
                  <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-white/35">
                    <Clock className="h-3 w-3" /> Preview — {PLACEMENT_META[adForm.placement].label} · {PLACEMENT_META[adForm.placement].where}
                  </p>
                  <div className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-left">
                    {adForm.image_url ? (
                      <img src={adForm.image_url} alt="" className="h-12 w-12 shrink-0 rounded-lg border border-white/10 object-cover" />
                    ) : (
                      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-lg border border-cyan-300/25 bg-cyan-300/10 text-cyan-300">
                        <Megaphone className="h-5 w-5" />
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-sm font-bold text-white">{adForm.title}</span>
                        <span className="shrink-0 rounded border border-white/15 px-1.5 py-px text-[9px] font-bold uppercase tracking-wider text-white/45">Ad</span>
                      </span>
                      {adForm.body && <span className="mt-0.5 line-clamp-2 block text-xs leading-4 text-white/60">{adForm.body}</span>}
                    </span>
                    <span className="shrink-0 text-[11px] font-bold text-cyan-300">Open</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Ad list */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                Ads
                <Badge variant="outline" className="text-[10px]">{activeAds.length} live / {ads.length} total</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {ads.length === 0 ? (
                <div className="py-10 text-center text-sm text-muted-foreground">No ads yet. Create one above — it appears in its placement automatically.</div>
              ) : (
                <ScrollArea className="max-h-[520px] pr-3">
                  <div className="space-y-2">
                    {ads.map((a) => {
                      const live = isLive(a.starts_at, a.ends_at, a.status);
                      return (
                        <div key={a.id} className={`rounded-xl border p-3 ${live ? "border-white/10 bg-white/[0.03]" : "border-white/5 bg-white/[0.01] opacity-70"}`}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge variant="outline" className={`text-[10px] capitalize ${live ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200" : "text-white/50"}`}>
                                  {live ? "live" : a.status}
                                </Badge>
                                <Badge variant="outline" className="text-[10px] capitalize">{a.target_type}</Badge>
                                {(a.dex_ad_placements || []).map((p) => (
                                  <button key={p.id} type="button" onClick={() => togglePlacement(p)} title={p.active ? "Click to pause placement" : "Click to activate placement"}>
                                    <Badge variant="outline" className={`text-[10px] ${p.active ? "border-cyan-300/30 bg-cyan-300/10 text-cyan-200" : "border-white/10 text-white/40 line-through"}`}>
                                      {PLACEMENT_META[p.placement].label} · prio {p.priority}
                                    </Badge>
                                  </button>
                                ))}
                              </div>
                              <div className="mt-1.5 truncate text-sm font-semibold">{a.title}</div>
                              {a.body && <div className="mt-0.5 text-[13px] text-muted-foreground">{a.body}</div>}
                              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground/70">
                                <span>{formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}</span>
                                {a.target_mint && <span className="font-mono">mint {a.target_mint.slice(0, 12)}…</span>}
                                {a.link_url && (
                                  <a href={a.link_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-cyan-300 hover:underline">
                                    <ExternalLink className="h-3 w-3" /> link
                                  </a>
                                )}
                              </div>
                            </div>
                            <div className="flex shrink-0 items-center gap-1">
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => startEditAd(a)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-300 hover:text-rose-200" onClick={() => removeAd(a)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </>
      ) : tab === "boosts" ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Zap className="h-4 w-4" />
                {editingBoostId ? "Edit boost" : "Set a boost tier"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Token mint</Label>
                  <Input value={boostForm.mint} className="font-mono text-xs"
                    onChange={(e) => setBoostForm({ ...boostForm, mint: e.target.value })}
                    placeholder="Paste the token mint address" />
                </div>
                <div className="space-y-1.5">
                  <Label>Tier</Label>
                  <Select value={boostForm.tier} onValueChange={(v) => setBoostForm({ ...boostForm, tier: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {BOOST_TIERS.map((t) => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label>Starts</Label>
                  <Input type="datetime-local" value={boostForm.starts_at}
                    onChange={(e) => setBoostForm({ ...boostForm, starts_at: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Ends (optional)</Label>
                  <Input type="datetime-local" value={boostForm.ends_at}
                    onChange={(e) => setBoostForm({ ...boostForm, ends_at: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Status</Label>
                  <Select value={boostForm.status} onValueChange={(v) => setBoostForm({ ...boostForm, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["active", "paused", "expired", "cancelled"].map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button onClick={saveBoost} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : editingBoostId ? <Pencil className="h-4 w-4 mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
                  {editingBoostId ? "Save boost" : "Set boost"}
                </Button>
                {editingBoostId && (
                  <Button variant="ghost" size="sm" onClick={() => { setBoostForm(emptyBoost); setEditingBoostId(null); }}>
                    <X className="h-4 w-4 mr-1" /> Cancel edit
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                Boosts
                <Badge variant="outline" className="text-[10px]">{boosts.filter((b) => b.status === "active").length} active / {boosts.length} total</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {boosts.length === 0 ? (
                <div className="py-10 text-center text-sm text-muted-foreground">No boosts yet.</div>
              ) : (
                <div className="space-y-2">
                  {boosts.map((b) => {
                    const live = isLive(b.starts_at, b.ends_at, b.status);
                    return (
                      <div key={b.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline" className={`text-[10px] capitalize ${live ? "border-amber-400/30 bg-amber-400/10 text-amber-200" : "text-white/50"}`}>
                              {b.tier} · {live ? "live" : b.status}
                            </Badge>
                            <span className="truncate font-mono text-xs text-white/70">{b.mint}</span>
                          </div>
                          <p className="mt-1 text-[11px] text-muted-foreground/70">
                            {formatDistanceToNow(new Date(b.created_at), { addSuffix: true })}
                            {b.ends_at && ` · ends ${formatDistanceToNow(new Date(b.ends_at), { addSuffix: true })}`}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <Button variant="ghost" size="sm" onClick={() => { setEditingBoostId(b.id); setBoostForm({ mint: b.mint, tier: b.tier, starts_at: dtLocal(b.starts_at), ends_at: dtLocal(b.ends_at), status: b.status }); }}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-300 hover:text-rose-200" onClick={() => removeBoost(b)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : tab === "listings" ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ListChecks className="h-4 w-4" />
                Add a listing
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label>Mint</Label>
                  <Input value={listingForm.mint} className="font-mono text-xs"
                    onChange={(e) => setListingForm({ ...listingForm, mint: e.target.value })}
                    placeholder="Token mint address" />
                </div>
                <div className="space-y-1.5">
                  <Label>Symbol</Label>
                  <Input value={listingForm.symbol}
                    onChange={(e) => setListingForm({ ...listingForm, symbol: e.target.value })}
                    placeholder="e.g. ORBITX" />
                </div>
                <div className="space-y-1.5">
                  <Label>Name</Label>
                  <Input value={listingForm.name}
                    onChange={(e) => setListingForm({ ...listingForm, name: e.target.value })}
                    placeholder="e.g. OrbitX" />
                </div>
              </div>
              <Button onClick={saveListing} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
                Add as pending
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                Listings
                <Badge variant="outline" className="text-[10px]">{pendingListings.length} pending / {listings.length} total</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {listings.length === 0 ? (
                <div className="py-10 text-center text-sm text-muted-foreground">No listings yet.</div>
              ) : (
                <div className="space-y-2">
                  {listings.map((l) => (
                    <div key={l.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className={`text-[10px] capitalize ${l.status === "approved" ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200" : l.status === "rejected" ? "border-rose-400/30 bg-rose-400/10 text-rose-200" : "border-amber-400/30 bg-amber-400/10 text-amber-200"}`}>
                            {l.status}
                          </Badge>
                          <span className="truncate text-sm font-semibold">{l.symbol || l.name || "Unnamed"}</span>
                          <span className="truncate font-mono text-xs text-white/50">{l.mint.slice(0, 16)}…</span>
                          <span className="text-[11px] text-white/35">{l.source}</span>
                        </div>
                        <p className="mt-1 text-[11px] text-muted-foreground/70">
                          {formatDistanceToNow(new Date(l.created_at), { addSuffix: true })}
                          {l.listed_at && ` · listed ${formatDistanceToNow(new Date(l.listed_at), { addSuffix: true })}`}
                        </p>
                      </div>
                      {l.status === "pending" && (
                        <div className="flex shrink-0 items-center gap-1">
                          <Button size="sm" onClick={() => reviewListing(l, true)}>
                            <Check className="h-4 w-4 mr-1" /> Approve
                          </Button>
                          <Button variant="ghost" size="sm" className="text-rose-300 hover:text-rose-200" onClick={() => reviewListing(l, false)}>
                            <Ban className="h-4 w-4 mr-1" /> Reject
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Bookmark className="h-4 w-4" />
              Saved filters
              <Badge variant="outline" className="text-[10px]">{filters.length} total</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-3 text-xs leading-5 text-white/45">
              Filter presets users saved from the DEX. Admins can inspect and remove them; users create their own from the DEX.
            </p>
            {filters.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">No saved filters yet.</div>
            ) : (
              <div className="space-y-2">
                {filters.map((f) => (
                  <div key={f.id} className="flex items-start justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold">{f.name}</span>
                        {f.is_default && <Badge variant="outline" className="text-[10px]">default</Badge>}
                        <span className="font-mono text-[11px] text-white/40">{f.user_id.slice(0, 8)}…</span>
                        <span className="text-[11px] text-white/35">{formatDistanceToNow(new Date(f.created_at), { addSuffix: true })}</span>
                      </div>
                      <pre className="mt-2 max-h-28 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-black/40 p-2 font-mono text-[11px] leading-4 text-white/60">
                        {JSON.stringify(f.filters, null, 2)}
                      </pre>
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-rose-300 hover:text-rose-200" onClick={() => removeFilter(f)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default DexAdsSection;

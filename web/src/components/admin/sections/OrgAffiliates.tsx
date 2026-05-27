/**
 * OrgAffiliates — Admin Section
 *
 * Manage the OG Scan official account & its affiliated users.
 * - Toggle which profile is the "Official" OG Scan account (gets gold ✦ badge)
 * - Assign any user as an "OG Scan Affiliate" (gets affiliate badge on profile)
 * - Revoke affiliation
 */

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import {
  Crown, Users, Search, Plus, Trash2, CheckCircle, XCircle,
  RefreshCw, Star, Shield, UserCheck, Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface Profile {
  user_id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  email?: string | null;
  is_official_account: boolean;
  affiliate_org_id: string | null;
}

export function OrgAffiliates() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [addSearch, setAddSearch] = useState("");
  const [addResults, setAddResults] = useState<Profile[]>([]);
  const [searching, setSearching] = useState(false);
  const [officialProfile, setOfficialProfile] = useState<Profile | null>(null);

  /* ── Load all relevant profiles ── */
  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("profiles")
      .select("user_id, username, display_name, avatar_url, is_official_account, affiliate_org_id")
      .or("is_official_account.eq.true,affiliate_org_id.not.is.null")
      .order("is_official_account", { ascending: false });
    const list = (data as Profile[]) || [];
    setProfiles(list);
    setOfficialProfile(list.find(p => p.is_official_account) ?? null);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  /* ── Search for users to add ── */
  const handleAddSearch = async (q: string) => {
    setAddSearch(q);
    if (q.length < 2) { setAddResults([]); return; }
    setSearching(true);
    const { data } = await supabase
      .from("profiles")
      .select("user_id, username, display_name, avatar_url, is_official_account, affiliate_org_id")
      .or(`username.ilike.%${q}%,display_name.ilike.%${q}%`)
      .limit(8);
    setAddResults((data as Profile[]) || []);
    setSearching(false);
  };

  /* ── Set official account ── */
  const setOfficial = async (profile: Profile) => {
    // Clear existing official first
    if (officialProfile) {
      await supabase.from("profiles").update({ is_official_account: false }).eq("user_id", officialProfile.user_id);
    }
    const { error } = await supabase.from("profiles").update({ is_official_account: true }).eq("user_id", profile.user_id);
    if (error) { toast.error("Failed to set official account"); return; }
    toast.success(`✦ @${profile.username} is now the Official OG Scan account`);
    load();
  };

  /* ── Remove official status ── */
  const removeOfficial = async (profile: Profile) => {
    const { error } = await supabase.from("profiles").update({ is_official_account: false }).eq("user_id", profile.user_id);
    if (error) { toast.error("Failed to remove official status"); return; }
    toast.success("Official status removed");
    load();
  };

  /* ── Add affiliate ── */
  const addAffiliate = async (profile: Profile) => {
    if (!officialProfile) { toast.error("Set an Official account first before adding affiliates"); return; }
    if (profile.user_id === officialProfile.user_id) { toast.error("The official account cannot be its own affiliate"); return; }
    const { error } = await supabase
      .from("profiles")
      .update({ affiliate_org_id: officialProfile.user_id })
      .eq("user_id", profile.user_id);
    if (error) { toast.error("Failed to add affiliate"); return; }
    toast.success(`🏷️ @${profile.username} added as OG Scan Affiliate`);
    setAddSearch("");
    setAddResults([]);
    load();
  };

  /* ── Remove affiliate ── */
  const removeAffiliate = async (profile: Profile) => {
    const { error } = await supabase.from("profiles").update({ affiliate_org_id: null }).eq("user_id", profile.user_id);
    if (error) { toast.error("Failed to remove affiliate"); return; }
    toast.success(`@${profile.username} removed from affiliates`);
    load();
  };

  const affiliates = profiles.filter(p => p.affiliate_org_id !== null && !p.is_official_account);
  const filtered = affiliates.filter(p =>
    !search || (p.username ?? "").toLowerCase().includes(search.toLowerCase()) ||
    (p.display_name ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Crown className="h-5 w-5 text-amber-400" />
            Org Affiliates
          </h2>
          <p className="text-white/40 text-sm mt-0.5">
            Set your Official OG Scan account and assign affiliate badges to team members
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={load} className="border-white/20 text-white/60 hover:text-white gap-1.5">
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </Button>
      </div>

      {/* Official Account Block */}
      <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-5">
        <div className="flex items-start gap-3 mb-4">
          <div className="h-8 w-8 rounded-lg bg-amber-500/15 flex items-center justify-center flex-shrink-0">
            <Star className="h-4 w-4 text-amber-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Official Account</h3>
            <p className="text-xs text-white/40 mt-0.5">
              One profile gets the gold <span className="text-amber-400 font-bold">✦ Official</span> badge — like the X Business gold checkmark. This is your brand's main page.
            </p>
          </div>
        </div>

        {officialProfile ? (
          <div className="flex items-center justify-between bg-black/30 rounded-lg px-4 py-3 border border-amber-500/20">
            <div className="flex items-center gap-3">
              <img
                src={officialProfile.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(officialProfile.username || "OG")}&background=d97706&color=fff&size=40`}
                alt={officialProfile.username || ""}
                className="h-9 w-9 rounded-full object-cover border border-amber-500/40"
              />
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-white">{officialProfile.display_name || officialProfile.username}</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-500 to-yellow-400 text-black">✦ OFFICIAL</span>
                </div>
                <span className="text-xs text-white/40">@{officialProfile.username}</span>
              </div>
            </div>
            <Button size="sm" variant="outline" onClick={() => removeOfficial(officialProfile)}
              className="text-xs border-red-500/30 text-red-400 hover:bg-red-500/10 hover:border-red-500/50">
              <XCircle className="h-3.5 w-3.5 mr-1" /> Remove
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-white/40 text-sm bg-black/20 rounded-lg px-4 py-3 border border-white/10">
            <Info className="h-4 w-4 flex-shrink-0" />
            No official account set yet. Search for a user below to assign one.
          </div>
        )}

        {/* Search to set official */}
        <div className="mt-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/30" />
            <Input
              value={addSearch}
              onChange={e => handleAddSearch(e.target.value)}
              placeholder="Search username to set as official or add as affiliate…"
              className="pl-9 bg-black/30 border-white/15 text-sm text-white placeholder:text-white/25 h-9"
            />
          </div>
          {addResults.length > 0 && (
            <div className="mt-2 bg-[#0d0d14] border border-white/10 rounded-lg overflow-hidden divide-y divide-white/5">
              {addResults.map(p => (
                <div key={p.user_id} className="flex items-center justify-between px-4 py-2.5 hover:bg-white/3 transition-colors">
                  <div className="flex items-center gap-3">
                    <img
                      src={p.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(p.username || "U")}&background=7c3aed&color=fff&size=32`}
                      alt={p.username || ""}
                      className="h-8 w-8 rounded-full object-cover"
                    />
                    <div>
                      <div className="text-sm font-medium text-white">{p.display_name || p.username}</div>
                      <div className="text-xs text-white/40">@{p.username}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {p.is_official_account && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-500 to-yellow-400 text-black">✦ OFFICIAL</span>
                    )}
                    {p.affiliate_org_id && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/30">Affiliate</span>
                    )}
                    <Button size="sm" onClick={() => setOfficial(p)}
                      className="h-7 text-xs bg-amber-600/80 hover:bg-amber-500 text-white border-0 gap-1">
                      <Star className="h-3 w-3" /> Set Official
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => addAffiliate(p)}
                      className="h-7 text-xs border-violet-500/30 text-violet-300 hover:bg-violet-500/10 gap-1">
                      <Plus className="h-3 w-3" /> Affiliate
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Affiliates List */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-violet-400" />
              Affiliates
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/25">{affiliates.length}</span>
            </h3>
          </div>
          {affiliates.length > 0 && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/30" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Filter affiliates…"
                className="pl-8 h-7 text-xs bg-black/30 border-white/15 text-white placeholder:text-white/25 w-44"
              />
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-10 text-white/30">
            <RefreshCw className="h-4 w-4 animate-spin mr-2" /> Loading…
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-10 text-white/25 text-sm border border-dashed border-white/10 rounded-xl">
            <Users className="h-8 w-8 mx-auto mb-2 opacity-30" />
            {affiliates.length === 0
              ? "No affiliates yet. Search for a user above and click \"Affiliate\" to add them."
              : "No affiliates match your search."}
          </div>
        ) : (
          <div className="bg-[#0d0d14] border border-white/8 rounded-xl overflow-hidden divide-y divide-white/5">
            {filtered.map(p => (
              <div key={p.user_id} className="flex items-center justify-between px-5 py-3 hover:bg-white/2 transition-colors">
                <div className="flex items-center gap-3">
                  <img
                    src={p.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(p.username || "U")}&background=7c3aed&color=fff&size=40`}
                    alt={p.username || ""}
                    className="h-9 w-9 rounded-full object-cover border border-violet-500/25"
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white">{p.display_name || p.username}</span>
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-gradient-to-r from-violet-600 to-indigo-500 text-white">
                        <Shield className="h-2.5 w-2.5" /> OG SCAN AFFILIATE
                      </span>
                    </div>
                    <span className="text-xs text-white/40">@{p.username}</span>
                  </div>
                </div>
                <Button size="sm" variant="outline" onClick={() => removeAffiliate(p)}
                  className="text-xs border-red-500/20 text-red-400/70 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/40 gap-1">
                  <Trash2 className="h-3 w-3" /> Remove
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Info callout */}
      <div className="bg-white/3 border border-white/8 rounded-xl p-4 flex gap-3">
        <Info className="h-4 w-4 text-white/30 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-white/35 leading-relaxed">
          <strong className="text-white/50">How it works:</strong> The <span className="text-amber-400">✦ Official</span> badge appears next to the display name on the official account's profile. Affiliates get a <span className="text-violet-300">🏷 OG Scan Affiliate</span> badge on their own profiles, linking them visually to your brand — just like X's verified affiliates feature. Both badges are visible to anyone who visits those profile pages.
        </p>
      </div>
    </div>
  );
}

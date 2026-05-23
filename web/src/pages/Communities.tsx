/**
 * Communities — X-style community feed, chat, and discovery.
 * NOTE: This component is rendered INLINE inside Index.tsx (ToolShell / CommunitiesInline).
 * Do NOT wrap in AppLayout — no sidebar, no layout shell needed.
 */
import React, { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Users, Plus, Search, MessageSquare, Heart, Send, Trash2, ArrowLeft,
  Globe, Lock, TrendingUp, Sparkles, Image as ImageIcon,
  Repeat2, Bookmark, Share, Shield, Crown, Clock,
  Hash, Flame, Eye, UserPlus, Volume2, ChevronRight,
  BarChart3, Gem, Check, X as XIcon,
  ChevronLeft, Copy, Mail, Dot, Camera, Loader2
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { VoicePanel } from "@/components/lobbies/VoicePanel";
import { formatDistanceToNow } from "date-fns";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Community {
  id: string;
  name: string;
  description: string | null;
  privacy: "public" | "private" | "invite_only" | "holder_only";
  created_by: string;
  creator_name: string | null;
  creator_avatar: string | null;
  member_count: number;
  post_count?: number;
  created_at: string;
  icon: string | null;
  banner_url: string | null;
  rules?: string[] | null;
  required_token?: string | null;
  required_token_symbol?: string | null;
  required_token_amount?: number | null;
  invite_code?: string | null;
  is_active: boolean;
  category?: string | null;
  tags?: string[] | null;
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
  reposts_count?: number;
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

// ─── Constants ────────────────────────────────────────────────────────────────

const COMMUNITY_ICONS = ["🚀","💎","🔥","⚡","🎯","💰","📈","🏆","🌊","🦈","🐋","🎮","🌙","⭐","🏔️","🦁","🐉","🎪","🌈","🔮"];
const COMMUNITY_CATEGORIES = ["Trading","DeFi","NFTs","Memes","Research","Alpha","Solana","General"];
const DEFAULT_RULES = [
  "Be respectful and constructive",
  "No spam or self-promotion",
  "Share alpha, not FUD",
  "DYOR — Not financial advice",
  "Keep discussions on-topic",
];

const PRIVACY_OPTIONS = [
  { value:"public",      label:"Public",      sublabel:"Anyone can join",           icon:Globe,    color:"text-emerald-400", bg:"bg-emerald-500/10 border-emerald-500/30" },
  { value:"private",     label:"Private",     sublabel:"Request to join",           icon:Lock,     color:"text-sky-400",     bg:"bg-sky-500/10 border-sky-500/30" },
  { value:"invite_only", label:"Invite Only", sublabel:"Members invite others",      icon:Mail,     color:"text-violet-400",  bg:"bg-violet-500/10 border-violet-500/30" },
  { value:"holder_only", label:"Holder Only", sublabel:"Token holders only",         icon:Gem,      color:"text-amber-400",   bg:"bg-amber-500/10 border-amber-500/30" },
] as const;

// Gradient palettes — deterministic from name so always consistent
const BANNER_GRADIENTS = [
  "from-violet-600/40 via-purple-800/20 to-transparent",
  "from-sky-600/40 via-blue-800/20 to-transparent",
  "from-emerald-600/40 via-green-800/20 to-transparent",
  "from-amber-600/40 via-orange-800/20 to-transparent",
  "from-rose-600/40 via-pink-800/20 to-transparent",
  "from-cyan-600/40 via-teal-800/20 to-transparent",
  "from-indigo-600/40 via-blue-900/20 to-transparent",
  "from-fuchsia-600/40 via-purple-900/20 to-transparent",
];

const AVATAR_GRADIENTS = [
  "from-violet-500 to-purple-700",
  "from-sky-500 to-blue-700",
  "from-emerald-500 to-green-700",
  "from-amber-500 to-orange-700",
  "from-rose-500 to-pink-700",
  "from-cyan-500 to-teal-700",
  "from-indigo-500 to-violet-700",
  "from-fuchsia-500 to-rose-700",
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function strHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function bannerGradient(name: string) {
  return BANNER_GRADIENTS[strHash(name) % BANNER_GRADIENTS.length];
}

function avatarGradient(id: string) {
  return AVATAR_GRADIENTS[strHash(id) % AVATAR_GRADIENTS.length];
}

function generateInviteCode() {
  return Math.random().toString(36).substring(2, 10).toUpperCase();
}

function privacyOpt(p: string) {
  return PRIVACY_OPTIONS.find(o => o.value === p) ?? PRIVACY_OPTIONS[0];
}

// Safe first character — never show "default" even if username is that
function safeInitial(name: string | null | undefined): string {
  const n = (name ?? "").trim();
  if (!n || n.toLowerCase() === "default" || n.toLowerCase() === "user") return "?";
  return n[0].toUpperCase();
}

// Safe avatar src — filter out "default", empty, or broken strings
function safeAvatar(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  const s = url.trim();
  if (!s || s === "default" || s === "null" || s === "undefined") return undefined;
  if (!s.startsWith("http")) return undefined;
  return s;
}

// Safe icon — only returns actual emoji/short strings, never "default" or URLs
function safeIcon(icon: string | null | undefined): string | null {
  if (!icon) return null;
  const s = icon.trim();
  if (!s || s === "default" || s === "null" || s === "undefined") return null;
  if (s.startsWith("http")) return null; // it's a URL, not an emoji
  if (s.length > 8) return null; // too long to be an emoji
  return s;
}

// ─── User Profile Modal ───────────────────────────────────────────────────────

interface UserProfileData {
  user_id: string;
  username?: string | null;
  avatar_url?: string | null;
  bio?: string | null;
  created_at?: string | null;
}

const UserProfileModal = ({ userId, onClose }: { userId: string; onClose: () => void }) => {
  const [profile, setProfile] = useState<UserProfileData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from("profiles").select("user_id, username, avatar_url, bio, created_at").eq("user_id", userId).maybeSingle().then(({ data }) => {
      setProfile(data as UserProfileData ?? { user_id: userId });
      setLoading(false);
    });
  }, [userId]);

  const gradient = avatarGradient(userId);
  const displayName = profile?.username || "User";

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={onClose} />
      <div className="relative w-full sm:max-w-sm bg-[#0d1117] rounded-3xl border border-white/10 shadow-2xl overflow-hidden">
        {/* Banner */}
        <div className={`h-24 bg-gradient-to-br ${gradient} opacity-60`} />
        {/* Close */}
        <button onClick={onClose} className="absolute top-3 right-3 p-2 rounded-full bg-black/50 backdrop-blur-sm hover:bg-black/70 z-10">
          <XIcon className="h-4 w-4 text-white/70" />
        </button>
        {/* Avatar */}
        <div className="px-5 -mt-10 pb-5">
          <div className="mb-3">
            <GradientAvatar src={profile?.avatar_url} name={profile?.username} id={userId} size="lg" className="border-4 border-[#0d1117] shadow-xl" />
          </div>
          {loading ? (
            <div className="space-y-2">
              <div className="h-5 w-32 rounded-full bg-white/10 animate-pulse" />
              <div className="h-3 w-20 rounded-full bg-white/[0.05] animate-pulse" />
            </div>
          ) : (
            <>
              <h3 className="text-lg font-black text-white">{displayName}</h3>
              {profile?.username && <p className="text-sm text-white/40">@{profile.username}</p>}
              {profile?.bio && <p className="text-sm text-white/60 mt-3 leading-relaxed">{profile.bio}</p>}
              {profile?.created_at && (
                <p className="text-xs text-white/30 mt-3 flex items-center gap-1">
                  <Clock className="h-3 w-3" /> Joined {formatDistanceToNow(new Date(profile.created_at), { addSuffix: true })}
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Gradient Avatar ─────────────────────────────────────────────────────────

interface GradientAvatarProps {
  src?: string | null;
  name?: string | null;
  id?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const GradientAvatar = ({ src, name, id, size = "md", className = "" }: GradientAvatarProps) => {
  const [imgFailed, setImgFailed] = useState(false);
  const safeSrc = safeAvatar(src);
  const initial = safeInitial(name);
  const gradient = avatarGradient(id || name || "x");
  const sizeClass = size === "sm" ? "w-8 h-8 text-xs" : size === "lg" ? "w-14 h-14 text-2xl" : "w-10 h-10 text-sm";

  return (
    <div className={`${sizeClass} rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center font-bold text-white shrink-0 overflow-hidden ${className}`}>
      {safeSrc && !imgFailed ? (
        <img
          src={safeSrc}
          alt=""
          className="w-full h-full object-cover"
          onError={() => setImgFailed(true)}
        />
      ) : (
        <span>{initial}</span>
      )}
    </div>
  );
};

// ─── Community Icon Avatar ────────────────────────────────────────────────────

const CommunityIcon = ({ community, size = "md" }: { community: Community; size?: "sm" | "md" | "lg" }) => {
  const sizeClass = size === "sm" ? "w-10 h-10 text-xl" : size === "lg" ? "w-16 h-16 text-4xl" : "w-12 h-12 text-2xl";
  const emoji = safeIcon(community.icon);
  const gradient = avatarGradient(community.id || community.name);

  if (emoji) {
    return (
      <div className={`${sizeClass} rounded-2xl bg-gradient-to-br from-white/5 to-white/10 flex items-center justify-center shrink-0 border border-white/10`}>
        {emoji}
      </div>
    );
  }

  // Gradient initial fallback
  return (
    <div className={`${sizeClass} rounded-2xl bg-gradient-to-br ${gradient} flex items-center justify-center shrink-0 font-black text-white`}>
      {community.name[0]?.toUpperCase() ?? "C"}
    </div>
  );
};

// ─── Create Community Wizard ──────────────────────────────────────────────────

interface CreateWizardProps {
  onClose: () => void;
  onCreated: () => void;
  user: { id: string } | null;
  profile: { username?: string | null; avatar_url?: string | null } | null;
}

const CreateCommunityWizard = ({ onClose, onCreated, user, profile }: CreateWizardProps) => {
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("🚀");
  const [category, setCategory] = useState("General");
  const [privacy, setPrivacy] = useState<"public" | "private" | "invite_only" | "holder_only">("public");
  const [requiredToken, setRequiredToken] = useState("");
  const [requiredTokenSymbol, setRequiredTokenSymbol] = useState("");
  const [requiredTokenAmount, setRequiredTokenAmount] = useState("");
  const [rules, setRules] = useState<string[]>([...DEFAULT_RULES]);
  const [newRule, setNewRule] = useState("");
  const [creating, setCreating] = useState(false);
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const bannerFileRef = useRef<HTMLInputElement>(null);

  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("Banner must be under 5 MB"); return; }
    setUploadingBanner(true);
    try {
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${user.id}/banner-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("community-images").upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from("community-images").getPublicUrl(path);
      setBannerUrl(data.publicUrl);
      toast.success("Banner uploaded!");
    } catch (err: unknown) {
      toast.error("Failed to upload banner");
      console.error(err);
    } finally {
      setUploadingBanner(false);
      if (bannerFileRef.current) bannerFileRef.current.value = "";
    }
  };

  const TOTAL = 4;

  const handleCreate = async () => {
    if (!user || !name.trim()) return;
    setCreating(true);
    try {
      const inviteCode = privacy === "invite_only" ? generateInviteCode() : null;
      const insertData: Record<string, unknown> = {
        name: name.trim(),
        description: description.trim() || null,
        privacy,
        created_by: user.id,
        creator_name: profile?.username || "Member",
        creator_avatar: safeAvatar(profile?.avatar_url) ?? null,
        icon,
        banner_url: bannerUrl,
        is_active: true,
        member_count: 1,
      };

      // Optional columns — only include if they might exist
      // These will silently be ignored if columns don't exist (Supabase just ignores unknown cols in RPC but NOT in insert)
      // So we add them conditionally; if they error we catch
      try { insertData.invite_code = inviteCode; } catch {}
      try { insertData.required_token = privacy === "holder_only" ? requiredToken.trim() || null : null; } catch {}
      try { insertData.required_token_symbol = privacy === "holder_only" ? requiredTokenSymbol.trim() || null : null; } catch {}
      try { insertData.required_token_amount = privacy === "holder_only" ? Number(requiredTokenAmount) || null : null; } catch {}
      try { insertData.category = category; } catch {}
      try { insertData.rules = rules.filter(r => r.trim()); } catch {}
      try { insertData.post_count = 0; } catch {}

      const { data, error } = await supabase.from("communities").insert(insertData).select().single();
      if (error) {
        // Retry without optional new columns
        const { data: d2, error: e2 } = await supabase.from("communities").insert({
          name: insertData.name,
          description: insertData.description,
          privacy: insertData.privacy,
          created_by: insertData.created_by,
          creator_name: insertData.creator_name,
          creator_avatar: insertData.creator_avatar,
          icon: insertData.icon,
          is_active: true,
          member_count: 1,
        }).select().single();
        if (e2) throw e2;
        if (d2) await supabase.from("community_members").insert({ community_id: d2.id, user_id: user.id, role: "creator" });
      } else {
        if (data) await supabase.from("community_members").insert({ community_id: data.id, user_id: user.id, role: "creator" });
      }

      toast("Community created! 🎉");
      onCreated();
      onClose();
    } catch {
      toast.error("Error creating community");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={onClose} />
      <div className="relative w-full sm:max-w-lg bg-[#0d1117] rounded-3xl border border-white/10 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-white/[0.07]">
          <div className="flex items-center gap-3">
            {step > 1 && (
              <button onClick={() => setStep(s => s - 1)} className="p-1.5 rounded-full hover:bg-white/10 transition-colors">
                <ChevronLeft className="h-5 w-5" />
              </button>
            )}
            <div>
              <h2 className="text-lg font-bold">Create Community</h2>
              <div className="flex items-center gap-1.5 mt-0.5">
                {Array.from({ length: TOTAL }, (_, i) => (
                  <div
                    key={i}
                    className={`h-1 rounded-full transition-all duration-300 ${i < step ? "bg-primary w-4" : "bg-white/10 w-2"}`}
                  />
                ))}
                <span className="text-[10px] text-white/40 ml-1">{step}/{TOTAL}</span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10 transition-colors">
            <XIcon className="h-4 w-4 text-white/50" />
          </button>
        </div>

        <div className="p-5 space-y-5 max-h-[65vh] overflow-y-auto">
          {/* ── Step 1: Icon + Name + Category ── */}
          {step === 1 && (
            <div className="space-y-5">
              <div className="text-center space-y-2">
                <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-white/5 to-white/10 border border-white/10 flex items-center justify-center text-5xl mx-auto shadow-xl">
                  {icon}
                </div>
                <p className="text-xs text-white/40">Pick an icon for your community</p>
              </div>

              <div className="grid grid-cols-10 gap-1.5">
                {COMMUNITY_ICONS.map(ic => (
                  <button
                    key={ic}
                    onClick={() => setIcon(ic)}
                    className={`aspect-square rounded-xl flex items-center justify-center text-xl transition-all ${
                      icon === ic ? "bg-primary/25 ring-2 ring-primary scale-110" : "bg-white/[0.04] hover:bg-white/[0.08]"
                    }`}
                  >
                    {ic}
                  </button>
                ))}
              </div>

              {/* Banner upload */}
              <div>
                <label className="text-xs font-bold text-white/50 mb-2 block uppercase tracking-wider">Banner Image <span className="text-white/20 normal-case font-normal">(optional)</span></label>
                <div
                  className="relative h-20 rounded-xl border border-dashed border-white/15 bg-white/[0.03] overflow-hidden cursor-pointer hover:border-primary/40 hover:bg-primary/5 transition-all flex items-center justify-center gap-2"
                  onClick={() => bannerFileRef.current?.click()}
                >
                  {bannerUrl ? (
                    <>
                      <img src={bannerUrl} alt="" className="absolute inset-0 w-full h-full object-cover opacity-70" />
                      <button
                        className="absolute top-1.5 right-1.5 p-1 rounded-full bg-black/60 text-white/70 hover:text-white z-10"
                        onClick={e => { e.stopPropagation(); setBannerUrl(null); }}
                      >
                        <XIcon className="h-3 w-3" />
                      </button>
                    </>
                  ) : uploadingBanner ? (
                    <Loader2 className="h-5 w-5 text-primary animate-spin" />
                  ) : (
                    <>
                      <Camera className="h-4 w-4 text-white/30" />
                      <span className="text-xs text-white/30">Upload banner · max 5 MB</span>
                    </>
                  )}
                  <input ref={bannerFileRef} type="file" accept="image/*" className="hidden" onChange={handleBannerUpload} />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-white/50 mb-2 block uppercase tracking-wider">Community Name</label>
                <Input
                  placeholder="e.g. Solana Degens, Diamond Hands..."
                  value={name}
                  onChange={e => setName(e.target.value)}
                  maxLength={50}
                  className="rounded-xl bg-white/[0.04] border-white/10 h-12 text-base focus:border-primary/50"
                  autoFocus
                />
                <p className="text-[10px] text-white/30 mt-1 text-right">{name.length}/50</p>
              </div>

              <div>
                <label className="text-xs font-bold text-white/50 mb-2 block uppercase tracking-wider">Category</label>
                <div className="flex flex-wrap gap-2">
                  {COMMUNITY_CATEGORIES.map(cat => (
                    <button
                      key={cat}
                      onClick={() => setCategory(cat)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all border ${
                        category === cat ? "bg-primary/20 border-primary text-primary" : "bg-white/[0.04] border-white/10 text-white/50 hover:border-white/20"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Step 2: Description + Preview ── */}
          {step === 2 && (
            <div className="space-y-4">
              {/* Live preview card */}
              <div className="rounded-2xl border border-white/10 overflow-hidden">
                <div className={`h-20 bg-gradient-to-br ${bannerGradient(name)} relative`}>
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0d1117] to-transparent" />
                </div>
                <div className="bg-[#0d1117] px-4 pt-3 pb-4 -mt-1 relative">
                  <div className="w-14 h-14 -mt-10 rounded-2xl bg-white/[0.05] border-4 border-[#0d1117] flex items-center justify-center text-3xl mb-2">
                    {icon}
                  </div>
                  <h3 className="font-bold text-base">{name || "Community Name"}</h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-white/40">{category}</span>
                    <span className="text-[10px] text-white/20">·</span>
                    <span className={`text-[10px] font-semibold ${privacyOpt(privacy).color}`}>{privacyOpt(privacy).label}</span>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-white/50 mb-2 block uppercase tracking-wider">Description</label>
                <Textarea
                  placeholder="What's this community about? What kind of alpha gets shared here?"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  maxLength={500}
                  rows={4}
                  className="rounded-xl bg-white/[0.04] border-white/10 resize-none focus:border-primary/50"
                />
                <p className="text-[10px] text-white/30 mt-1 text-right">{description.length}/500</p>
              </div>
            </div>
          )}

          {/* ── Step 3: Privacy ── */}
          {step === 3 && (
            <div className="space-y-3">
              <p className="text-sm text-white/50">Who can find and join this community?</p>
              {PRIVACY_OPTIONS.map(opt => {
                const Icon = opt.icon;
                const isSelected = privacy === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => setPrivacy(opt.value as typeof privacy)}
                    className={`w-full flex items-center gap-4 p-4 rounded-2xl border transition-all ${
                      isSelected ? opt.bg : "border-white/[0.07] bg-white/[0.02] hover:bg-white/[0.05]"
                    }`}
                  >
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${isSelected ? opt.bg : "bg-white/[0.06]"}`}>
                      <Icon className={`h-5 w-5 ${isSelected ? opt.color : "text-white/40"}`} />
                    </div>
                    <div className="flex-1 text-left">
                      <p className={`font-bold text-sm ${isSelected ? "text-white" : "text-white/70"}`}>{opt.label}</p>
                      <p className="text-xs text-white/40">{opt.sublabel}</p>
                    </div>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                      isSelected ? "border-primary bg-primary" : "border-white/20"
                    }`}>
                      {isSelected && <Check className="h-3 w-3 text-white" />}
                    </div>
                  </button>
                );
              })}

              {privacy === "holder_only" && (
                <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20 space-y-3">
                  <p className="text-xs font-bold text-amber-400 flex items-center gap-1.5"><Gem className="h-3.5 w-3.5" /> Token Requirement</p>
                  <Input placeholder="Token mint address" value={requiredToken} onChange={e => setRequiredToken(e.target.value)} className="rounded-xl bg-white/[0.04] border-amber-500/20 text-sm font-mono" />
                  <div className="flex gap-2">
                    <Input placeholder="Symbol (e.g. BONK)" value={requiredTokenSymbol} onChange={e => setRequiredTokenSymbol(e.target.value)} className="rounded-xl bg-white/[0.04] border-amber-500/20 text-sm" />
                    <Input placeholder="Min amount" type="number" value={requiredTokenAmount} onChange={e => setRequiredTokenAmount(e.target.value)} className="rounded-xl bg-white/[0.04] border-amber-500/20 text-sm" />
                  </div>
                </div>
              )}
              {privacy === "invite_only" && (
                <div className="p-4 rounded-2xl bg-violet-500/5 border border-violet-500/20">
                  <p className="text-xs font-bold text-violet-400 mb-1">🔑 Invite-Only</p>
                  <p className="text-xs text-white/40">A unique invite link will be generated. Only users with the link can request to join.</p>
                </div>
              )}
            </div>
          )}

          {/* ── Step 4: Rules ── */}
          {step === 4 && (
            <div className="space-y-3">
              <p className="text-sm text-white/50">Set community rules. You can update these anytime.</p>
              <div className="space-y-2">
                {rules.map((rule, i) => (
                  <div key={i} className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.07] group">
                    <span className="w-5 h-5 rounded-full bg-primary/20 text-primary text-[10px] font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                    <span className="flex-1 text-sm text-white/80">{rule}</span>
                    <button onClick={() => setRules(r => r.filter((_, j) => j !== i))} className="p-1 rounded-full hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all text-white/30">
                      <XIcon className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="Add a rule..."
                  value={newRule}
                  onChange={e => setNewRule(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && newRule.trim()) { setRules(r => [...r, newRule.trim()]); setNewRule(""); } }}
                  className="rounded-xl bg-white/[0.04] border-white/10 text-sm"
                />
                <Button size="sm" variant="outline" onClick={() => { if (newRule.trim()) { setRules(r => [...r, newRule.trim()]); setNewRule(""); } }} className="rounded-xl border-white/10">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 pt-3 border-t border-white/[0.07]">
          {step < TOTAL ? (
            <Button onClick={() => setStep(s => s + 1)} disabled={step === 1 && name.trim().length < 3} className="w-full rounded-xl h-12 text-base font-bold btn-3d">
              Continue →
            </Button>
          ) : (
            <Button onClick={handleCreate} disabled={creating || !name.trim()} className="w-full rounded-xl h-12 text-base font-bold btn-3d">
              {creating ? "Creating..." : `Create ${icon} ${name || "Community"}`}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Invite Modal ─────────────────────────────────────────────────────────────

const InviteModal = ({ community, onClose }: { community: Community; onClose: () => void }) => {
  const [username, setUsername] = useState("");
  const [sending, setSending] = useState(false);
  const { user } = useAuth();
  const inviteLink = `${window.location.origin}/communities?invite=${community.invite_code}`;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-[#0d1117] rounded-3xl border border-white/10 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-lg">Invite People</h3>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10"><XIcon className="h-4 w-4 text-white/50" /></button>
        </div>
        <div>
          <p className="text-xs font-bold text-white/50 uppercase tracking-wider mb-2">Invite Link</p>
          <div className="flex items-center gap-2 p-3 rounded-xl bg-white/[0.04] border border-white/10">
            <p className="flex-1 text-xs font-mono text-white/50 truncate">{inviteLink}</p>
            <button onClick={() => { navigator.clipboard.writeText(inviteLink); toast("Link copied! 📋"); }} className="p-1.5 rounded-lg bg-primary/15 text-primary hover:bg-primary/25">
              <Copy className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
        <div>
          <p className="text-xs font-bold text-white/50 uppercase tracking-wider mb-2">Invite by Username</p>
          <div className="flex gap-2">
            <Input placeholder="@username" value={username} onChange={e => setUsername(e.target.value)} className="rounded-xl bg-white/[0.04] border-white/10 text-sm" />
            <Button disabled={sending || !username.trim()} onClick={async () => {
              if (!user || !username.trim()) return;
              setSending(true);
              const { data: prof } = await supabase.from("profiles").select("user_id").eq("username", username.trim()).maybeSingle();
              if (!prof) { toast.error("User not found"); setSending(false); return; }
              await supabase.from("community_invites").insert({ community_id: community.id, invited_by: user.id, invited_user_id: prof.user_id, invite_code: community.invite_code, status: "pending" });
              toast(`Sent invite to @${username}! ✉️`);
              setUsername("");
              setSending(false);
            }} className="rounded-xl btn-3d">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Community Card ───────────────────────────────────────────────────────────

const CommunityCard = ({ c, onClick, isMember }: { c: Community; onClick: () => void; isMember: boolean }) => {
  const pOpt = privacyOpt(c.privacy);
  const PrivIcon = pOpt.icon;
  const grad = bannerGradient(c.name);

  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-xl border border-white/[0.07] bg-white/[0.02] active:bg-white/[0.05] hover:bg-white/[0.04] hover:border-primary/25 transition-all group overflow-hidden flex items-center gap-3 px-3 py-3"
    >
      {/* Icon — compact square with optional banner as tinted bg */}
      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${grad} flex items-center justify-center text-2xl shrink-0 overflow-hidden relative border border-white/[0.08]`}>
        {safeAvatar(c.banner_url) && (
          <img src={safeAvatar(c.banner_url)} alt="" className="absolute inset-0 w-full h-full object-cover opacity-30" onError={e => (e.target as HTMLImageElement).remove()} />
        )}
        <span className="relative z-10">
          {safeIcon(c.icon) ? (
            safeIcon(c.icon)
          ) : (
            <span className={`flex items-center justify-center bg-gradient-to-br ${avatarGradient(c.id)} font-black text-white text-base w-full h-full`}>
              {c.name[0]?.toUpperCase() ?? "C"}
            </span>
          )}
        </span>
      </div>

      {/* Text content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <h3 className="font-bold text-[13px] text-white group-hover:text-primary transition-colors truncate leading-tight">{c.name}</h3>
          {isMember && (
            <span className="text-[8px] font-black px-1.5 py-0 rounded-full bg-primary/15 text-primary border border-primary/20 shrink-0 leading-4">✓</span>
          )}
        </div>
        {c.description && (
          <p className="text-[11px] text-white/40 line-clamp-1 leading-tight mb-1">{c.description}</p>
        )}
        <div className="flex items-center gap-2.5">
          <span className="text-[10px] text-white/30 flex items-center gap-0.5">
            <Users className="h-2.5 w-2.5" />{(c.member_count || 0).toLocaleString()}
          </span>
          {c.category && (
            <span className="text-[10px] text-white/30 flex items-center gap-0.5">
              <Hash className="h-2.5 w-2.5" />{c.category}
            </span>
          )}
        </div>
      </div>

      {/* Right: privacy + chevron */}
      <div className="flex flex-col items-end gap-2 shrink-0">
        <span className={`flex items-center gap-0.5 text-[9px] font-semibold px-1.5 py-0.5 rounded-full border ${pOpt.bg} ${pOpt.color}`}>
          <PrivIcon className="h-2.5 w-2.5" />
        </span>
        <ChevronRight className="h-3.5 w-3.5 text-white/20 group-hover:text-primary/50 transition-colors" />
      </div>
    </button>
  );
};

// ─── Main Communities Component ───────────────────────────────────────────────

const Communities = () => {
  const { user, profile } = useAuth();
  const [communities, setCommunities] = useState<Community[]>([]);
  const [joinedIds, setJoinedIds] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Community | null>(null);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("feed");
  const [feedSort, setFeedSort] = useState<"latest" | "top">("latest");
  const [posts, setPosts] = useState<Post[]>([]);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [members, setMembers] = useState<MemberData[]>([]);
  const [newPost, setNewPost] = useState("");
  const [postImageUrl, setPostImageUrl] = useState<string | null>(null);
  const [uploadingPostImg, setUploadingPostImg] = useState(false);
  const postImgRef = useRef<HTMLInputElement>(null);
  const [chatMsg, setChatMsg] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [isMember, setIsMember] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showVoice, setShowVoice] = useState(false);
  const [listView, setListView] = useState<"discover" | "joined">("discover");
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [inviteCodeInput, setInviteCodeInput] = useState("");
  const [viewProfileId, setViewProfileId] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("invite");
    if (code) setInviteCodeInput(code);
  }, []);

  useEffect(() => { fetchCommunities(); }, []);
  useEffect(() => { if (user) fetchJoinedIds(); }, [user]);

  const fetchCommunities = async () => {
    const { data } = await supabase.from("communities").select("*").eq("is_active", true).order("member_count", { ascending: false });
    setCommunities((data as Community[]) || []);
    setLoading(false);
  };

  const fetchJoinedIds = async () => {
    if (!user) return;
    const { data } = await supabase.from("community_members").select("community_id").eq("user_id", user.id);
    setJoinedIds(new Set(data?.map(m => m.community_id) || []));
  };

  const joinViaCode = async () => {
    if (!user || !inviteCodeInput.trim()) return;
    const { data: comm } = await supabase.from("communities").select("*").eq("invite_code", inviteCodeInput.trim().toUpperCase()).maybeSingle();
    if (!comm) { toast.error("Invalid invite code"); return; }
    await supabase.from("community_members").insert({ community_id: comm.id, user_id: user.id, role: "member" });
    toast(`Joined ${comm.name}! 🎉`);
    setInviteCodeInput("");
    fetchCommunities();
    fetchJoinedIds();
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
    setJoinedIds(prev => new Set([...prev, selected.id]));
    toast("Joined! 🎉");
    fetchMembers(selected.id);
  };

  const leaveCommunity = async () => {
    if (!user || !selected) return;
    await supabase.from("community_members").delete().eq("community_id", selected.id).eq("user_id", user.id);
    setIsMember(false);
    setJoinedIds(prev => { const s = new Set(prev); s.delete(selected.id); return s; });
  };

  const deleteCommunity = async () => {
    if (!user || !selected || selected.created_by !== user.id) return;
    if (!confirm("Delete this community? This cannot be undone.")) return;
    await supabase.from("communities").delete().eq("id", selected.id);
    toast("Community deleted");
    setSelected(null);
    fetchCommunities();
  };

  const fetchPosts = async (cid: string) => {
    let q = supabase.from("community_posts").select("*").eq("community_id", cid).limit(50);
    q = feedSort === "latest" ? q.order("created_at", { ascending: false }) : q.order("likes_count", { ascending: false });
    const { data } = await q;
    const postsData = (data || []) as Post[];
    // Enrich with real profile data so usernames are always up-to-date
    const uniqueUserIds = [...new Set(postsData.map(p => p.user_id).filter(Boolean))];
    if (uniqueUserIds.length > 0) {
      const { data: profiles } = await supabase.from("profiles").select("user_id, username, avatar_url").in("user_id", uniqueUserIds);
      const pm = new Map(profiles?.map(p => [p.user_id, p]) || []);
      postsData.forEach(p => {
        const prof = pm.get(p.user_id);
        if (prof?.username) p.username = prof.username;
        if (prof?.avatar_url) p.avatar_url = prof.avatar_url;
      });
    }
    if (user) {
      const { data: likes } = await supabase.from("community_post_likes").select("post_id").eq("user_id", user.id);
      const likedIds = new Set(likes?.map(l => l.post_id));
      postsData.forEach(p => { p.liked = likedIds.has(p.id); });
    }
    setPosts(postsData);
  };

  const fetchMessages = async (cid: string) => {
    const { data } = await supabase.from("community_messages").select("*").eq("community_id", cid).order("created_at", { ascending: true }).limit(100);
    const msgsData = (data || []) as ChatMsg[];
    // Enrich with real profile data
    const uniqueUserIds = [...new Set(msgsData.map(m => m.user_id).filter(Boolean))];
    if (uniqueUserIds.length > 0) {
      const { data: profiles } = await supabase.from("profiles").select("user_id, username, avatar_url").in("user_id", uniqueUserIds);
      const pm = new Map(profiles?.map(p => [p.user_id, p]) || []);
      msgsData.forEach(m => {
        const prof = pm.get(m.user_id);
        if (prof?.username) m.username = prof.username;
        if (prof?.avatar_url) m.avatar_url = prof.avatar_url;
      });
    }
    setMessages(msgsData);
  };

  const fetchMembers = async (cid: string) => {
    const { data } = await supabase.from("community_members").select("*").eq("community_id", cid);
    if (!data) { setMembers([]); return; }
    const userIds = data.map(m => m.user_id);
    const { data: profiles } = await supabase.from("profiles").select("user_id, username, avatar_url, bio").in("user_id", userIds);
    const pm = new Map(profiles?.map(p => [p.user_id, p]) || []);
    setMembers(data.map(m => ({
      ...m,
      username: pm.get(m.user_id)?.username ?? undefined,
      avatar_url: pm.get(m.user_id)?.avatar_url ?? undefined,
      bio: pm.get(m.user_id)?.bio ?? undefined,
    })));
  };

  useEffect(() => {
    if (!selected) return;
    const msgCh = supabase.channel(`cm-${selected.id}`).on("postgres_changes", { event:"INSERT", schema:"public", table:"community_messages", filter:`community_id=eq.${selected.id}` }, p => setMessages(prev => [...prev, p.new as ChatMsg])).subscribe();
    const postCh = supabase.channel(`cp-${selected.id}`).on("postgres_changes", { event:"*", schema:"public", table:"community_posts", filter:`community_id=eq.${selected.id}` }, () => fetchPosts(selected.id)).subscribe();
    return () => { supabase.removeChannel(msgCh); supabase.removeChannel(postCh); };
  }, [selected?.id]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const handlePostImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("Image must be under 5 MB"); return; }
    setUploadingPostImg(true);
    try {
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${user.id}/post-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("community-images").upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from("community-images").getPublicUrl(path);
      setPostImageUrl(data.publicUrl);
    } catch (err) {
      toast.error("Failed to upload image");
      console.error(err);
    } finally {
      setUploadingPostImg(false);
      if (postImgRef.current) postImgRef.current.value = "";
    }
  };

  const submitPost = async () => {
    if (!user || !selected || !newPost.trim()) return;
    await supabase.from("community_posts").insert({
      community_id: selected.id,
      user_id: user.id,
      username: profile?.username || null,
      avatar_url: safeAvatar(profile?.avatar_url) ?? null,
      content: newPost.trim(),
      image_url: postImageUrl || null,
    });
    setNewPost("");
    setPostImageUrl(null);
  };

  const sendChat = async () => {
    if (!user || !selected || !chatMsg.trim()) return;
    await supabase.from("community_messages").insert({
      community_id: selected.id,
      user_id: user.id,
      username: profile?.username || null,
      avatar_url: safeAvatar(profile?.avatar_url) ?? null,
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

  const filtered = communities.filter(c => {
    if (!c.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (categoryFilter && c.category !== categoryFilter) return false;
    if (listView === "joined" && !joinedIds.has(c.id)) return false;
    return true;
  });

  const isCreator = selected?.created_by === user?.id;

  // ──────────────────── DETAIL VIEW ────────────────────

  if (selected) {
    const pOpt = privacyOpt(selected.privacy);
    const PrivIcon = pOpt.icon;
    const grad = bannerGradient(selected.name);

    return (
      <div className="flex flex-col" style={{ minHeight: "calc(100vh - 200px)" }}>
        {/* Sticky header */}
        <div className="sticky top-0 z-30 bg-[#070d14]">
          {/* Banner */}
          <div className={`relative h-28 bg-gradient-to-br ${grad} overflow-hidden`}>
            {safeAvatar(selected.banner_url) && (
              <img src={safeAvatar(selected.banner_url)} alt="" className="absolute inset-0 w-full h-full object-cover opacity-50" onError={e => (e.target as HTMLImageElement).remove()} />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-[#070d14] via-transparent to-transparent" />
            <button onClick={() => setSelected(null)} className="absolute top-3 left-3 p-2 rounded-full bg-black/50 backdrop-blur-sm hover:bg-black/70 transition-colors z-10">
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="absolute top-3 right-3 flex gap-2 z-10">
              {isMember && <button onClick={() => setShowVoice(!showVoice)} className={`p-2 rounded-full backdrop-blur-sm transition-colors ${showVoice ? "bg-green-500/30 text-green-400" : "bg-black/50 text-white/60 hover:text-white"}`}><Volume2 className="h-4 w-4" /></button>}
              {isMember && selected.privacy === "invite_only" && <button onClick={() => setShowInviteModal(true)} className="p-2 rounded-full bg-black/50 backdrop-blur-sm hover:bg-black/70"><UserPlus className="h-4 w-4" /></button>}
            </div>
          </div>

          {/* Identity row */}
          <div className="px-4 -mt-7 pb-3 flex items-end justify-between gap-3">
            <div className="flex items-end gap-3">
              <div className="w-16 h-16 rounded-2xl bg-[#070d14] border-4 border-[#070d14] flex items-center justify-center text-4xl shadow-xl shrink-0 overflow-hidden">
                {safeIcon(selected.icon) ? (
                  safeIcon(selected.icon)
                ) : (
                  <span className={`w-full h-full flex items-center justify-center bg-gradient-to-br ${avatarGradient(selected.id)} font-black text-white text-2xl`}>
                    {selected.name[0]?.toUpperCase() ?? "C"}
                  </span>
                )}
              </div>
              <div className="pb-1">
                <div className="flex items-center gap-2">
                  <h1 className="text-base font-black">{selected.name}</h1>
                  {selected.privacy !== "public" && <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${pOpt.bg} ${pOpt.color}`}><PrivIcon className="h-2.5 w-2.5 inline mr-0.5" />{pOpt.label}</span>}
                </div>
                <p className="text-[10px] text-white/40">{members.length} members · {posts.length} posts</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 pb-1 shrink-0">
              {!isMember && user && <Button size="sm" onClick={joinCommunity} className="rounded-full btn-3d text-xs h-8 px-4">{selected.privacy === "private" ? "Request" : "Join"}</Button>}
              {isMember && !isCreator && <Button size="sm" variant="outline" onClick={leaveCommunity} className="rounded-full text-xs h-8 px-3 border-white/10">Leave</Button>}
              {isCreator && <button onClick={deleteCommunity} className="p-2 rounded-full bg-red-500/10 text-red-400 hover:bg-red-500/20"><Trash2 className="h-4 w-4" /></button>}
            </div>
          </div>

          {/* Holder-only badge */}
          {selected.privacy === "holder_only" && selected.required_token_symbol && (
            <div className="mx-4 mb-2 px-3 py-2 rounded-xl bg-amber-500/5 border border-amber-500/20 text-xs text-amber-400 flex items-center gap-2">
              <Gem className="h-3.5 w-3.5" /> Requires {selected.required_token_amount?.toLocaleString()} {selected.required_token_symbol}+ to join
            </div>
          )}

          {/* Voice panel */}
          {showVoice && isMember && (
            <div className="px-4 pb-3">
              <VoicePanel lobbyId={`community-${selected.id}`} lobbyName={selected.name} autoJoin />
            </div>
          )}

          {/* Tabs */}
          <div className="flex border-t border-white/[0.07]">
            {[
              { key:"feed", label:"Posts", icon:Hash },
              { key:"chat", label:"Chat", icon:MessageSquare },
              { key:"members", label:"Members", icon:Users },
              { key:"about", label:"About", icon:Eye },
            ].map(({ key, label, icon: Icon }) => (
              <button key={key} onClick={() => setTab(key)} className={`flex-1 py-3 flex items-center justify-center gap-1.5 text-xs font-bold transition-colors relative ${tab === key ? "text-white" : "text-white/40 hover:text-white/70"}`}>
                <Icon className="h-3.5 w-3.5" />{label}
                {tab === key && <div className="absolute bottom-0 left-1/4 right-1/4 h-[3px] bg-primary rounded-full" />}
              </button>
            ))}
          </div>
        </div>

        {/* ═══ FEED ═══ */}
        {tab === "feed" && (
          <div className="flex-1 overflow-y-auto">
            {/* Sort */}
            <div className="px-4 py-2.5 flex gap-2 border-b border-white/[0.05] sticky top-0 bg-[#070d14]/90 backdrop-blur-sm z-10">
              {(["latest","top"] as const).map(s => (
                <button key={s} onClick={() => { setFeedSort(s); fetchPosts(selected.id); }} className={`px-3 py-1.5 rounded-full text-[10px] font-bold transition-colors ${feedSort === s ? "bg-primary/15 text-primary" : "text-white/30 hover:text-white/60 hover:bg-white/5"}`}>
                  {s === "latest" ? <><Clock className="h-3 w-3 inline mr-1" />Latest</> : <><TrendingUp className="h-3 w-3 inline mr-1" />Top</>}
                </button>
              ))}
            </div>

            {/* Compose */}
            {user && isMember && (
              <div className="px-4 py-4 border-b border-white/[0.05]">
                <div className="flex gap-3">
                  <GradientAvatar src={profile?.avatar_url} name={profile?.username} id={user.id} />
                  <div className="flex-1 space-y-2">
                    <Textarea
                      placeholder="What's happening?"
                      value={newPost}
                      onChange={e => setNewPost(e.target.value)}
                      className="min-h-[52px] bg-transparent border-0 shadow-none resize-none text-[15px] placeholder:text-white/25 focus-visible:ring-0 p-0 text-white"
                    />
                    {/* Post image preview */}
                    {postImageUrl && (
                      <div className="relative rounded-xl overflow-hidden">
                        <img src={postImageUrl} alt="" className="w-full max-h-48 object-cover rounded-xl" />
                        <button
                          onClick={() => setPostImageUrl(null)}
                          className="absolute top-1.5 right-1.5 p-1 rounded-full bg-black/60 text-white/80 hover:text-white"
                        >
                          <XIcon className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                    <div className="flex items-center justify-between border-t border-white/[0.07] pt-2.5">
                      <div className="flex gap-0.5">
                        <button
                          className="p-2 rounded-full text-primary/50 hover:bg-primary/10 hover:text-primary transition-colors relative"
                          onClick={() => postImgRef.current?.click()}
                          title="Attach image"
                        >
                          {uploadingPostImg ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
                          <input ref={postImgRef} type="file" accept="image/*" className="hidden" onChange={handlePostImageUpload} />
                        </button>
                        <button className="p-2 rounded-full text-primary/50 hover:bg-primary/10 hover:text-primary transition-colors"><BarChart3 className="h-4 w-4" /></button>
                      </div>
                      <Button onClick={submitPost} disabled={!newPost.trim()} size="sm" className="rounded-full px-5 btn-3d text-sm h-8 font-bold">Post</Button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Posts */}
            <div className="divide-y divide-white/[0.05]">
              {posts.map(post => (
                <article key={post.id} className="px-4 py-4 hover:bg-white/[0.02] transition-colors">
                  <div className="flex gap-3">
                    <button onClick={() => setViewProfileId(post.user_id)} className="shrink-0 focus:outline-none">
                      <GradientAvatar src={post.avatar_url} name={post.username} id={post.user_id} />
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => setViewProfileId(post.user_id)} className="font-bold text-sm text-white hover:underline">
                          {post.username ? `@${post.username}` : <span className="text-white/30 no-underline">Unknown</span>}
                        </button>
                        {post.user_id === selected.created_by && (
                          <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/20 flex items-center gap-0.5"><Crown className="h-2.5 w-2.5" />Admin</span>
                        )}
                        <span className="text-xs text-white/30">· {formatDistanceToNow(new Date(post.created_at), { addSuffix: false })}</span>
                      </div>
                      <p className="text-[15px] leading-relaxed mt-1 whitespace-pre-wrap break-words text-[#e7e9ea]">{post.content}</p>
                      {post.image_url && <img src={post.image_url} alt="" className="mt-3 rounded-2xl max-h-80 object-cover w-full border border-white/10" onError={e => (e.target as HTMLImageElement).remove()} />}
                      {/* Action bar */}
                      <div className="flex items-center gap-0.5 mt-3 -ml-2">
                        <button className="flex items-center gap-1.5 text-white/40 hover:text-sky-400 p-2 rounded-full hover:bg-sky-400/10 transition-colors group">
                          <MessageSquare className="h-4 w-4" />
                          {(post.replies_count || 0) > 0 && <span className="text-xs">{post.replies_count}</span>}
                        </button>
                        <button className="flex items-center gap-1.5 text-white/40 hover:text-emerald-400 p-2 rounded-full hover:bg-emerald-400/10 transition-colors">
                          <Repeat2 className="h-4 w-4" />
                          {(post.reposts_count || 0) > 0 && <span className="text-xs">{post.reposts_count}</span>}
                        </button>
                        <button onClick={() => toggleLike(post)} className={`flex items-center gap-1.5 p-2 rounded-full transition-colors ${post.liked ? "text-pink-500" : "text-white/40 hover:text-pink-400 hover:bg-pink-400/10"}`}>
                          <Heart className={`h-4 w-4 ${post.liked ? "fill-current" : ""}`} />
                          {(post.likes_count || 0) > 0 && <span className="text-xs">{post.likes_count}</span>}
                        </button>
                        <button className="text-white/40 hover:text-sky-400 p-2 rounded-full hover:bg-sky-400/10 transition-colors"><Bookmark className="h-4 w-4" /></button>
                        <button className="text-white/40 hover:text-sky-400 p-2 rounded-full hover:bg-sky-400/10 transition-colors"><Share className="h-4 w-4" /></button>
                        {user && (post.user_id === user.id || isCreator) && (
                          <button onClick={() => deletePost(post.id)} className="text-white/30 hover:text-red-400 p-2 rounded-full hover:bg-red-400/10 transition-colors ml-auto"><Trash2 className="h-3.5 w-3.5" /></button>
                        )}
                      </div>
                    </div>
                  </div>
                </article>
              ))}
              {posts.length === 0 && (
                <div className="text-center py-20">
                  <Sparkles className="h-12 w-12 mx-auto mb-3 text-white/10" />
                  <p className="font-bold text-white/30">No posts yet</p>
                  <p className="text-sm text-white/20 mt-1">Be the first to post!</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══ CHAT ═══ */}
        {tab === "chat" && (
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.length === 0 && (
                <div className="text-center py-16">
                  <MessageSquare className="h-10 w-10 mx-auto mb-3 text-white/10" />
                  <p className="text-white/30">No messages yet</p>
                </div>
              )}
              {messages.map(msg => (
                <div key={msg.id} className={`flex gap-2.5 ${msg.user_id === user?.id ? "flex-row-reverse" : ""}`}>
                  <button onClick={() => setViewProfileId(msg.user_id)} className="shrink-0 focus:outline-none">
                    <GradientAvatar src={msg.avatar_url} name={msg.username} id={msg.user_id} size="sm" />
                  </button>
                  <div className={`max-w-[75%] ${msg.user_id === user?.id ? "items-end flex flex-col" : ""}`}>
                    <button onClick={() => setViewProfileId(msg.user_id)} className="text-[10px] text-white/30 mb-0.5 flex items-center gap-1 hover:text-white/60">
                      {msg.username ? `@${msg.username}` : "User"}
                      {msg.user_id === selected.created_by && <Crown className="h-2.5 w-2.5 text-primary" />}
                    </button>
                    <div className={`px-3 py-2 rounded-2xl text-sm ${msg.user_id === user?.id ? "bg-primary text-white rounded-br-md" : "bg-white/[0.06] text-white rounded-bl-md"}`}>
                      {msg.content}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
            {user && isMember && (
              <div className="p-3 border-t border-white/[0.07]">
                <div className="flex gap-2">
                  <Input placeholder="Message..." value={chatMsg} onChange={e => setChatMsg(e.target.value)} onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendChat()} className="rounded-full bg-white/[0.04] border-white/10 text-sm" />
                  <Button onClick={sendChat} size="icon" className="rounded-full shrink-0 btn-3d h-10 w-10"><Send className="h-4 w-4" /></Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══ MEMBERS ═══ */}
        {tab === "members" && (
          <div className="flex-1 overflow-y-auto divide-y divide-white/[0.05]">
            <div className="px-4 py-3 flex items-center justify-between">
              <p className="text-sm font-bold">{members.length} Members</p>
              {isMember && selected.privacy === "invite_only" && (
                <Button size="sm" variant="outline" onClick={() => setShowInviteModal(true)} className="rounded-full text-xs h-7 border-white/10 gap-1">
                  <UserPlus className="h-3 w-3" /> Invite
                </Button>
              )}
            </div>
            {members.map(m => {
              const mIsAdmin = m.user_id === selected.created_by;
              return (
                <div key={m.id} className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.02] group cursor-pointer" onClick={() => setViewProfileId(m.user_id)}>
                  <div className="relative">
                    <GradientAvatar src={m.avatar_url} name={m.username} id={m.user_id} />
                    <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-[#070d14]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-sm text-white">{m.username ? `@${m.username}` : <span className="text-white/30 italic">unknown</span>}</span>
                      {mIsAdmin && <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/20 flex items-center gap-0.5"><Crown className="h-2.5 w-2.5" />Admin</span>}
                      {m.role === "moderator" && <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-sky-500/15 text-sky-400 border border-sky-500/20 flex items-center gap-0.5"><Shield className="h-2.5 w-2.5" />Mod</span>}
                    </div>
                    {m.bio && <p className="text-xs text-white/40 truncate">{m.bio}</p>}
                  </div>
                  <ChevronRight className="h-4 w-4 text-white/20 group-hover:text-primary/50 transition-colors shrink-0" />
                </div>
              );
            })}
          </div>
        )}

        {/* ═══ ABOUT ═══ */}
        {tab === "about" && (
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {selected.description && (
              <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.07]">
                <p className="text-sm text-white/60 leading-relaxed">{selected.description}</p>
              </div>
            )}
            <div className="grid grid-cols-3 gap-3">
              {[{label:"Members",val:members.length},{label:"Posts",val:posts.length},{label:"Category",val:selected.category||"General"}].map((s,i) => (
                <div key={i} className="text-center p-3 rounded-2xl bg-white/[0.03] border border-white/[0.07]">
                  <p className="text-base font-black">{s.val}</p>
                  <p className="text-[10px] text-white/30 mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>
            <div className={`p-4 rounded-2xl border ${pOpt.bg}`}>
              <div className="flex items-center gap-2 mb-1">
                <PrivIcon className={`h-4 w-4 ${pOpt.color}`} />
                <p className={`font-bold text-sm ${pOpt.color}`}>{pOpt.label} Community</p>
              </div>
              <p className="text-xs text-white/40">{pOpt.sublabel}</p>
              {selected.privacy === "holder_only" && selected.required_token_symbol && (
                <p className="text-xs text-amber-300/80 mt-1">Requires {selected.required_token_amount?.toLocaleString()} {selected.required_token_symbol}+ to join</p>
              )}
            </div>
            <div className="flex items-center gap-3 p-4 rounded-2xl bg-white/[0.03] border border-white/[0.07]">
              <GradientAvatar src={selected.creator_avatar} name={selected.creator_name} id={selected.created_by} size="md" />
              <div>
                <p className="text-sm font-bold flex items-center gap-1">
                  {selected.creator_name || "Unknown"} <Crown className="h-3.5 w-3.5 text-primary" />
                </p>
                <p className="text-[10px] text-white/30">Created {formatDistanceToNow(new Date(selected.created_at), { addSuffix: true })}</p>
              </div>
            </div>
            {selected.rules && selected.rules.length > 0 && (
              <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.07] space-y-2.5">
                <h3 className="font-bold text-sm flex items-center gap-2"><Shield className="h-4 w-4 text-primary" />Community Rules</h3>
                {selected.rules.map((r, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="text-xs text-primary font-black w-5 shrink-0">{i+1}.</span>
                    <p className="text-sm text-white/50">{r}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {showInviteModal && <InviteModal community={selected} onClose={() => setShowInviteModal(false)} />}
        {viewProfileId && <UserProfileModal userId={viewProfileId} onClose={() => setViewProfileId(null)} />}
      </div>
    );
  }

  // ──────────────────── LIST VIEW ────────────────────

  return (
    <div>
      {/* Header — compact for mobile */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-black text-white">Communities</h2>
        <Button onClick={() => setShowCreate(true)} className="rounded-full btn-3d gap-1 text-xs h-8 px-3" size="sm">
          <Plus className="h-3.5 w-3.5" /> New
        </Button>
      </div>

      {/* Search */}
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/30" />
        <Input placeholder="Search communities..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 rounded-full bg-white/[0.04] border-white/10 h-9 text-sm" />
      </div>

      {/* View tabs */}
      <div className="flex border-b border-white/[0.07] mb-3">
        {[{key:"discover",label:"Discover"},{key:"joined",label:"My Communities"}].map(v => (
          <button key={v.key} onClick={() => setListView(v.key as typeof listView)} className={`px-4 py-2 text-[13px] font-bold transition-colors relative ${listView === v.key ? "text-white" : "text-white/40 hover:text-white/60"}`}>
            {v.label}
            {listView === v.key && <div className="absolute bottom-0 left-1/4 right-1/4 h-[2px] bg-primary rounded-full" />}
          </button>
        ))}
      </div>

      {/* Category filter — single compact scrollable row */}
      <div className="flex gap-1.5 overflow-x-auto pb-2 mb-2" style={{ scrollbarWidth: "none" } as React.CSSProperties}>
        <button onClick={() => setCategoryFilter(null)} className={`px-3 py-1 rounded-full text-[11px] font-bold border shrink-0 transition-colors ${!categoryFilter ? "bg-primary/15 border-primary/50 text-primary" : "border-white/10 text-white/40 hover:border-white/20"}`}>All</button>
        {COMMUNITY_CATEGORIES.map(cat => (
          <button key={cat} onClick={() => setCategoryFilter(categoryFilter === cat ? null : cat)} className={`px-3 py-1 rounded-full text-[11px] font-bold border shrink-0 transition-colors ${categoryFilter === cat ? "bg-primary/15 border-primary/50 text-primary" : "border-white/10 text-white/40 hover:border-white/20"}`}>{cat}</button>
        ))}
      </div>

      {/* Invite code banner */}
      {inviteCodeInput && (
        <div className="mb-3 p-3 rounded-xl bg-violet-500/5 border border-violet-500/20 flex items-center gap-2">
          <Mail className="h-4 w-4 text-violet-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-violet-400">Invite code detected</p>
            <p className="text-[10px] text-white/40 font-mono">{inviteCodeInput}</p>
          </div>
          <Button size="sm" onClick={joinViaCode} className="rounded-full text-xs h-7 btn-3d">Join</Button>
          <button onClick={() => setInviteCodeInput("")} className="p-1 rounded-full hover:bg-white/10"><XIcon className="h-3.5 w-3.5 text-white/40" /></button>
        </div>
      )}

      {/* List — single column on mobile, 2-col on wider screens */}
      {loading ? (
        <div className="flex flex-col gap-2">
          {[1,2,3,4,5].map(i => <div key={i} className="h-[70px] rounded-xl bg-white/[0.03] animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <Users className="h-14 w-14 mx-auto mb-3 text-white/10" />
          <p className="font-bold text-white/30">{listView === "joined" ? "You haven't joined any communities" : "No communities found"}</p>
          <p className="text-sm text-white/20 mt-1">{listView === "joined" ? "Discover and join communities!" : "Create the first one!"}</p>
          {listView === "joined" && <Button onClick={() => setListView("discover")} variant="outline" className="mt-4 rounded-full text-sm border-white/10">Discover Communities</Button>}
        </div>
      ) : (
        <div className="flex flex-col gap-2 pb-4">
          {filtered.map(c => (
            <CommunityCard key={c.id} c={c} onClick={() => enterCommunity(c)} isMember={joinedIds.has(c.id)} />
          ))}
        </div>
      )}

      {showCreate && (
        <CreateCommunityWizard
          onClose={() => setShowCreate(false)}
          onCreated={() => { fetchCommunities(); fetchJoinedIds(); }}
          user={user}
          profile={profile}
        />
      )}
      {viewProfileId && <UserProfileModal userId={viewProfileId} onClose={() => setViewProfileId(null)} />}
    </div>
  );
};

export default Communities;

import { useState, useEffect, useRef, useCallback } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Users, Plus, Search, MessageSquare, Heart, Send, Trash2, ArrowLeft,
  Globe, Lock, TrendingUp, Sparkles, Image as ImageIcon,
  Repeat2, Bookmark, Share, Shield, Crown, Clock,
  Hash, Flame, Eye, UserPlus, Volume2, ChevronRight,
  BarChart3, UserCheck, Key, Gem, Check, X as XIcon,
  Bell, BellOff, Camera, Upload, ChevronLeft, Settings,
  AlertCircle, Copy, ExternalLink, MoreHorizontal,
  Mail, Verified, Star, Dot
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";

// Treat "default", empty string, or non-URL values as null
const validUrl = (url: string | null | undefined): string | undefined => {
  if (!url) return undefined;
  const s = url.trim();
  if (!s || s === "default" || s === "null" || s === "undefined") return undefined;
  if (!s.startsWith("http://") && !s.startsWith("https://") && !s.startsWith("/") && !s.startsWith("blob:")) return undefined;
  return s;
};
// Treat "default" icon as null → fall back to first letter of name
const validIcon = (icon: string | null | undefined): string | null => {
  if (!icon) return null;
  const s = icon.trim();
  if (!s || s === "default" || s.length > 10) return null;
  return s;
};
import { toast } from "@/hooks/use-toast";
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
  post_count: number;
  created_at: string;
  icon: string | null;
  banner_url: string | null;
  rules: string[] | null;
  required_token: string | null;
  required_token_symbol: string | null;
  required_token_amount: number | null;
  invite_code: string | null;
  is_active: boolean;
  category: string | null;
  tags: string[] | null;
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
  reposts_count: number;
  bookmarks_count: number;
  created_at: string;
  liked?: boolean;
  bookmarked?: boolean;
  is_pinned?: boolean;
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

interface CommunityInvite {
  id: string;
  community_id: string;
  invited_by: string;
  invited_user_id: string | null;
  invite_code: string;
  status: "pending" | "accepted" | "rejected";
  created_at: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const COMMUNITY_ICONS = ["🚀", "💎", "🔥", "⚡", "🎯", "💰", "📈", "🏆", "🌊", "🦈", "🐋", "🎮", "🌙", "⭐", "🏔️", "🦁"];
const COMMUNITY_CATEGORIES = ["Trading", "DeFi", "NFTs", "Memes", "Research", "Alpha", "Solana", "General"];
const DEFAULT_RULES = [
  "Be respectful and constructive",
  "No spam or self-promotion",
  "Share alpha, not FUD",
  "DYOR — Not financial advice",
  "Keep discussions on-topic",
];

const PRIVACY_OPTIONS = [
  {
    value: "public",
    label: "Public",
    sublabel: "Anyone can join",
    icon: Globe,
    color: "text-green-400",
    bg: "bg-green-500/10 border-green-500/30",
  },
  {
    value: "private",
    label: "Private",
    sublabel: "Request to join",
    icon: Lock,
    color: "text-blue-400",
    bg: "bg-blue-500/10 border-blue-500/30",
  },
  {
    value: "invite_only",
    label: "Invite Only",
    sublabel: "Members invite others",
    icon: Mail,
    color: "text-purple-400",
    bg: "bg-purple-500/10 border-purple-500/30",
  },
  {
    value: "holder_only",
    label: "Holder Only",
    sublabel: "Token holders only",
    icon: Gem,
    color: "text-amber-400",
    bg: "bg-amber-500/10 border-amber-500/30",
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function generateInviteCode() {
  return Math.random().toString(36).substring(2, 10).toUpperCase();
}

function privacyLabel(p: string) {
  return PRIVACY_OPTIONS.find(o => o.value === p)?.label ?? p;
}

function privacyIcon(p: string) {
  const opt = PRIVACY_OPTIONS.find(o => o.value === p);
  if (!opt) return Globe;
  return opt.icon;
}

// ─── Create Community Wizard ──────────────────────────────────────────────────

interface CreateWizardProps {
  onClose: () => void;
  onCreated: () => void;
  user: { id: string } | null;
  profile: { username?: string | null; avatar_url?: string | null } | null;
}

const CreateCommunityWizard = ({ onClose, onCreated, user, profile }: CreateWizardProps) => {
  const [step, setStep] = useState(1); // 1=name+type 2=details 3=privacy 4=rules
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
  const [bannerColor, setBannerColor] = useState("#1a1f2e");

  const BANNER_COLORS = [
    "#1a1f2e", "#0f1923", "#1a0a2e", "#0a1a2e",
    "#1a2e0a", "#2e1a0a", "#1f0a0a", "#0a2e2e"
  ];

  const totalSteps = 4;

  const handleCreate = async () => {
    if (!user || !name.trim()) return;
    setCreating(true);
    try {
      const inviteCode = privacy === "invite_only" ? generateInviteCode() : null;
      const { data, error } = await supabase.from("communities").insert({
        name: name.trim(),
        description: description.trim() || null,
        privacy,
        created_by: user.id,
        creator_name: profile?.username || "User",
        creator_avatar: profile?.avatar_url,
        icon,
        category,
        rules: rules.filter(r => r.trim()),
        banner_url: null,
        required_token: privacy === "holder_only" ? requiredToken.trim() || null : null,
        required_token_symbol: privacy === "holder_only" ? requiredTokenSymbol.trim() || null : null,
        required_token_amount: privacy === "holder_only" ? Number(requiredTokenAmount) || null : null,
        invite_code: inviteCode,
        is_active: true,
        member_count: 1,
        post_count: 0,
      }).select().single();

      if (error) throw error;

      if (data) {
        await supabase.from("community_members").insert({
          community_id: data.id,
          user_id: user.id,
          role: "creator",
        });
      }

      toast({ title: "Community created! 🎉" });
      onCreated();
      onClose();
    } catch (err) {
      toast({ title: "Error creating community", variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const canNext = () => {
    if (step === 1) return name.trim().length >= 3;
    return true;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-lg bg-[#0d1117] rounded-t-3xl sm:rounded-3xl border border-border/30 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-border/20">
          <div className="flex items-center gap-3">
            {step > 1 && (
              <button onClick={() => setStep(s => s - 1)} className="p-1.5 rounded-full hover:bg-muted/30 transition-colors">
                <ChevronLeft className="h-5 w-5" />
              </button>
            )}
            <div>
              <h2 className="text-lg font-bold">Create Community</h2>
              <p className="text-xs text-muted-foreground">Step {step} of {totalSteps}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-muted/30 transition-colors">
            <XIcon className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        {/* Progress bar */}
        <div className="h-1 bg-muted/20">
          <div
            className="h-full bg-gradient-to-r from-primary to-accent transition-all duration-300"
            style={{ width: `${(step / totalSteps) * 100}%` }}
          />
        </div>

        <div className="p-5 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Step 1: Name & Icon */}
          {step === 1 && (
            <div className="space-y-5">
              <div className="text-center">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center text-4xl mx-auto mb-3 border border-border/20">
                  {icon}
                </div>
                <p className="text-xs text-muted-foreground">Choose your community icon</p>
              </div>

              {/* Icon grid */}
              <div className="grid grid-cols-8 gap-2">
                {COMMUNITY_ICONS.map(i => (
                  <button
                    key={i}
                    onClick={() => setIcon(i)}
                    className={`aspect-square rounded-xl flex items-center justify-center text-xl transition-all ${
                      icon === i
                        ? "bg-primary/20 border-2 border-primary scale-110"
                        : "bg-muted/20 border border-border/20 hover:border-primary/30 hover:scale-105"
                    }`}
                  >
                    {i}
                  </button>
                ))}
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Community Name *</label>
                <Input
                  placeholder="e.g. Solana Degens, Diamond Hands..."
                  value={name}
                  onChange={e => setName(e.target.value)}
                  maxLength={50}
                  className="rounded-xl bg-muted/10 border-border/30 h-12 text-base"
                  autoFocus
                />
                <p className="text-xs text-muted-foreground mt-1 text-right">{name.length}/50</p>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Category</label>
                <div className="flex flex-wrap gap-2">
                  {COMMUNITY_CATEGORIES.map(cat => (
                    <button
                      key={cat}
                      onClick={() => setCategory(cat)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors border ${
                        category === cat
                          ? "bg-primary/20 border-primary text-primary"
                          : "bg-muted/10 border-border/20 text-muted-foreground hover:border-primary/30"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Banner color */}
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Banner Color</label>
                <div className="flex gap-2">
                  {BANNER_COLORS.map(c => (
                    <button
                      key={c}
                      onClick={() => setBannerColor(c)}
                      className={`w-8 h-8 rounded-lg border-2 transition-all ${bannerColor === c ? "border-primary scale-110" : "border-transparent"}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Description */}
          {step === 2 && (
            <div className="space-y-4">
              {/* Preview card */}
              <div className="rounded-2xl border border-border/20 overflow-hidden">
                <div className="h-20 flex items-end px-4 pb-3" style={{ backgroundColor: bannerColor }}>
                  <div className="w-14 h-14 rounded-2xl bg-[#0d1117] flex items-center justify-center text-3xl border-4 border-[#0d1117] -mb-7">
                    {icon}
                  </div>
                </div>
                <div className="px-4 pt-9 pb-4 bg-card/30">
                  <h3 className="font-bold text-base">{name || "Community Name"}</h3>
                  <p className="text-xs text-muted-foreground">{category}</p>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Description</label>
                <Textarea
                  placeholder="What is this community about? What topics will you discuss?"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  maxLength={500}
                  rows={4}
                  className="rounded-xl bg-muted/10 border-border/30 resize-none"
                />
                <p className="text-xs text-muted-foreground mt-1 text-right">{description.length}/500</p>
              </div>
            </div>
          )}

          {/* Step 3: Privacy */}
          {step === 3 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Who can join and see this community?</p>
              <div className="space-y-2">
                {PRIVACY_OPTIONS.map(opt => {
                  const Icon = opt.icon;
                  const isSelected = privacy === opt.value;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => setPrivacy(opt.value as typeof privacy)}
                      className={`w-full flex items-center gap-4 p-4 rounded-2xl border transition-all ${
                        isSelected
                          ? `${opt.bg} border-opacity-100`
                          : "border-border/20 bg-muted/5 hover:bg-muted/10"
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isSelected ? opt.bg : "bg-muted/20"}`}>
                        <Icon className={`h-5 w-5 ${isSelected ? opt.color : "text-muted-foreground"}`} />
                      </div>
                      <div className="flex-1 text-left">
                        <p className={`font-semibold text-sm ${isSelected ? opt.color : ""}`}>{opt.label}</p>
                        <p className="text-xs text-muted-foreground">{opt.sublabel}</p>
                      </div>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                        isSelected ? "border-primary bg-primary" : "border-muted-foreground/40"
                      }`}>
                        {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Holder-only: token settings */}
              {privacy === "holder_only" && (
                <div className="mt-4 space-y-3 p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20">
                  <p className="text-xs font-semibold text-amber-400 flex items-center gap-1.5">
                    <Gem className="h-3.5 w-3.5" /> Token Requirement
                  </p>
                  <Input
                    placeholder="Token mint address (e.g. So11111...)"
                    value={requiredToken}
                    onChange={e => setRequiredToken(e.target.value)}
                    className="rounded-xl bg-muted/10 border-amber-500/20 text-sm font-mono"
                  />
                  <div className="flex gap-2">
                    <Input
                      placeholder="Symbol (e.g. BONK)"
                      value={requiredTokenSymbol}
                      onChange={e => setRequiredTokenSymbol(e.target.value)}
                      className="rounded-xl bg-muted/10 border-amber-500/20 text-sm"
                    />
                    <Input
                      placeholder="Min amount"
                      type="number"
                      value={requiredTokenAmount}
                      onChange={e => setRequiredTokenAmount(e.target.value)}
                      className="rounded-xl bg-muted/10 border-amber-500/20 text-sm"
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground">Users must hold the minimum amount to join</p>
                </div>
              )}

              {/* Invite only: show code preview */}
              {privacy === "invite_only" && (
                <div className="mt-4 p-4 rounded-2xl bg-purple-500/5 border border-purple-500/20">
                  <p className="text-xs font-semibold text-purple-400 flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5" /> Invite-Only Community
                  </p>
                  <p className="text-xs text-muted-foreground mt-1.5">
                    An invite code will be generated. Only users with an invite link can request to join.
                    Members can invite others once you approve them.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Step 4: Rules */}
          {step === 4 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Set rules to keep your community healthy. You can edit these later.</p>
              <div className="space-y-2">
                {rules.map((rule, i) => (
                  <div key={i} className="flex items-center gap-2 p-3 rounded-xl bg-muted/10 border border-border/20 group">
                    <span className="w-6 h-6 rounded-full bg-primary/15 text-primary text-xs font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                    <span className="flex-1 text-sm">{rule}</span>
                    <button
                      onClick={() => setRules(r => r.filter((_, j) => j !== i))}
                      className="p-1 rounded-full text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <XIcon className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
              {rules.length < 10 && (
                <div className="flex gap-2">
                  <Input
                    placeholder="Add a rule..."
                    value={newRule}
                    onChange={e => setNewRule(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === "Enter" && newRule.trim()) {
                        setRules(r => [...r, newRule.trim()]);
                        setNewRule("");
                      }
                    }}
                    className="rounded-xl bg-muted/10 border-border/30 text-sm"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      if (newRule.trim()) { setRules(r => [...r, newRule.trim()]); setNewRule(""); }
                    }}
                    className="rounded-xl"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 pt-3 border-t border-border/20">
          {step < totalSteps ? (
            <Button
              onClick={() => setStep(s => s + 1)}
              disabled={!canNext()}
              className="w-full rounded-xl btn-3d h-12 text-base font-semibold"
            >
              Continue
            </Button>
          ) : (
            <Button
              onClick={handleCreate}
              disabled={creating || !name.trim()}
              className="w-full rounded-xl btn-3d h-12 text-base font-semibold"
            >
              {creating ? "Creating..." : "Create Community 🚀"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Invite Modal ─────────────────────────────────────────────────────────────

const InviteModal = ({ community, onClose }: { community: Community; onClose: () => void }) => {
  const [inviteUsername, setInviteUsername] = useState("");
  const [sending, setSending] = useState(false);
  const { user } = useAuth();
  const inviteLink = `${window.location.origin}/communities?invite=${community.invite_code}`;

  const copyLink = () => {
    navigator.clipboard.writeText(inviteLink);
    toast({ title: "Invite link copied! 📋" });
  };

  const sendInvite = async () => {
    if (!inviteUsername.trim() || !user) return;
    setSending(true);
    try {
      const { data: invited } = await supabase.from("profiles").select("user_id").eq("username", inviteUsername.trim()).maybeSingle();
      if (!invited) { toast({ title: "User not found", variant: "destructive" }); return; }
      await supabase.from("community_invites").insert({
        community_id: community.id,
        invited_by: user.id,
        invited_user_id: invited.user_id,
        invite_code: community.invite_code,
        status: "pending",
      });
      toast({ title: `Invite sent to @${inviteUsername}! ✉️` });
      setInviteUsername("");
    } catch {
      toast({ title: "Failed to send invite", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm mx-4 bg-[#0d1117] rounded-3xl border border-border/30 p-5 space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-lg">Invite to {community.name}</h3>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-muted/30">
            <XIcon className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        {/* Invite link */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-2">Share invite link</p>
          <div className="flex items-center gap-2 p-3 rounded-xl bg-muted/10 border border-border/20">
            <p className="flex-1 text-xs font-mono text-muted-foreground truncate">{inviteLink}</p>
            <button onClick={copyLink} className="p-1.5 rounded-lg bg-primary/15 text-primary hover:bg-primary/25 transition-colors">
              <Copy className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Invite by username */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-2">Invite by username</p>
          <div className="flex gap-2">
            <Input
              placeholder="@username"
              value={inviteUsername}
              onChange={e => setInviteUsername(e.target.value)}
              onKeyDown={e => e.key === "Enter" && sendInvite()}
              className="rounded-xl bg-muted/10 border-border/30 text-sm"
            />
            <Button onClick={sendInvite} disabled={sending || !inviteUsername.trim()} className="rounded-xl btn-3d">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Community Card (list item) ───────────────────────────────────────────────

const CommunityCard = ({
  c,
  onClick,
  isMember,
}: {
  c: Community;
  onClick: () => void;
  isMember: boolean;
}) => {
  const PrivIcon = privacyIcon(c.privacy);

  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-2xl border border-border/20 bg-card/30 hover:bg-card/60 hover:border-primary/30 transition-all group overflow-hidden"
    >
      {/* Banner strip */}
      <div className="h-14 bg-gradient-to-br from-primary/10 via-accent/5 to-background relative">
        {validUrl(c.banner_url) && (
          <img src={validUrl(c.banner_url)} alt="" className="absolute inset-0 w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-card/80 to-transparent" />
      </div>

      <div className="px-4 pb-4 -mt-5 relative">
        <div className="flex items-end justify-between mb-2">
          <div className="w-12 h-12 rounded-2xl bg-[#0d1117] border-2 border-[#0d1117] flex items-center justify-center text-2xl shadow-lg">
            {validIcon(c.icon) || c.name[0]}
          </div>
          <div className="flex items-center gap-1.5 mb-1">
            {isMember && (
              <Badge className="text-[9px] bg-primary/10 text-primary border-primary/20 h-5 rounded-full">Joined</Badge>
            )}
            <div className={`flex items-center gap-0.5 text-[10px] px-2 py-0.5 rounded-full border ${
              c.privacy === "public" ? "text-green-400 border-green-500/20 bg-green-500/5" :
              c.privacy === "holder_only" ? "text-amber-400 border-amber-500/20 bg-amber-500/5" :
              c.privacy === "invite_only" ? "text-purple-400 border-purple-500/20 bg-purple-500/5" :
              "text-blue-400 border-blue-500/20 bg-blue-500/5"
            }`}>
              <PrivIcon className="h-2.5 w-2.5 mr-0.5" />
              {privacyLabel(c.privacy)}
            </div>
          </div>
        </div>

        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-bold text-sm truncate group-hover:text-primary transition-colors">{c.name}</h3>
            {c.description && <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{c.description}</p>}
          </div>
        </div>

        <div className="flex items-center gap-3 mt-2">
          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
            <Users className="h-3 w-3" />{c.member_count?.toLocaleString() || 0} members
          </span>
          {c.category && (
            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Hash className="h-3 w-3" />{c.category}
            </span>
          )}
        </div>
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
  const [feedSort, setFeedSort] = useState<"latest" | "trending" | "top">("latest");
  const [posts, setPosts] = useState<Post[]>([]);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [members, setMembers] = useState<MemberData[]>([]);
  const [newPost, setNewPost] = useState("");
  const [chatMsg, setChatMsg] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [isMember, setIsMember] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showVoice, setShowVoice] = useState(false);
  const [listView, setListView] = useState<"discover" | "joined">("discover");
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [privacyFilter, setPrivacyFilter] = useState<string | null>(null);
  const [inviteCodeInput, setInviteCodeInput] = useState("");
  const [joiningViaCode, setJoiningViaCode] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Check URL for invite code
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("invite");
    if (code) setInviteCodeInput(code);
  }, []);

  useEffect(() => { fetchCommunities(); }, []);

  useEffect(() => {
    if (user) fetchJoinedIds();
  }, [user]);

  const fetchCommunities = async () => {
    const { data } = await supabase
      .from("communities")
      .select("*")
      .eq("is_active", true)
      .order("member_count", { ascending: false });
    setCommunities((data as Community[]) || []);
    setLoading(false);
  };

  const fetchJoinedIds = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("community_members")
      .select("community_id")
      .eq("user_id", user.id);
    setJoinedIds(new Set(data?.map(m => m.community_id) || []));
  };

  const joinViaInviteCode = async () => {
    if (!user || !inviteCodeInput.trim()) return;
    setJoiningViaCode(true);
    try {
      const { data: comm } = await supabase
        .from("communities")
        .select("*")
        .eq("invite_code", inviteCodeInput.trim().toUpperCase())
        .maybeSingle();
      if (!comm) { toast({ title: "Invalid invite code", variant: "destructive" }); return; }
      await supabase.from("community_members").insert({ community_id: comm.id, user_id: user.id, role: "member" });
      toast({ title: `Joined ${comm.name}! 🎉` });
      setInviteCodeInput("");
      fetchCommunities();
      fetchJoinedIds();
    } catch {
      toast({ title: "Failed to join via invite", variant: "destructive" });
    } finally {
      setJoiningViaCode(false);
    }
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
    // For holder_only: we'd verify on-chain (simplified here)
    if (selected.privacy === "holder_only") {
      toast({ title: `Checking ${selected.required_token_symbol || "token"} balance...` });
    }
    await supabase.from("community_members").insert({ community_id: selected.id, user_id: user.id, role: "member" });
    // Update member count
    await supabase.from("communities").update({ member_count: (selected.member_count || 0) + 1 }).eq("id", selected.id);
    setIsMember(true);
    setJoinedIds(prev => new Set([...prev, selected.id]));
    toast({ title: "Joined community! 🎉" });
    fetchMembers(selected.id);
  };

  const leaveCommunity = async () => {
    if (!user || !selected) return;
    await supabase.from("community_members").delete().eq("community_id", selected.id).eq("user_id", user.id);
    await supabase.from("communities").update({ member_count: Math.max(0, (selected.member_count || 1) - 1) }).eq("id", selected.id);
    setIsMember(false);
    setJoinedIds(prev => { const s = new Set(prev); s.delete(selected.id); return s; });
    fetchMembers(selected.id);
  };

  const deleteCommunity = async () => {
    if (!user || !selected || selected.created_by !== user.id) return;
    if (!confirm("Delete this community? This cannot be undone.")) return;
    await supabase.from("communities").delete().eq("id", selected.id);
    toast({ title: "Community deleted" });
    setSelected(null);
    fetchCommunities();
  };

  const fetchPosts = async (cid: string) => {
    let query = supabase.from("community_posts").select("*").eq("community_id", cid).limit(50);
    if (feedSort === "latest") query = query.order("created_at", { ascending: false });
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

  // Realtime subscriptions
  useEffect(() => {
    if (!selected) return;
    const msgChannel = supabase.channel(`community-msg-${selected.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "community_messages", filter: `community_id=eq.${selected.id}` },
        payload => setMessages(prev => [...prev, payload.new as ChatMsg])
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
    // Update post count
    await supabase.from("communities").update({ post_count: (selected.post_count || 0) + 1 }).eq("id", selected.id);
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

  // Filtered communities
  const filtered = communities.filter(c => {
    if (!c.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (categoryFilter && c.category !== categoryFilter) return false;
    if (privacyFilter && c.privacy !== privacyFilter) return false;
    if (listView === "joined" && !joinedIds.has(c.id)) return false;
    return true;
  });

  const isCreator = selected?.created_by === user?.id;
  const PrivacyIcon = selected ? privacyIcon(selected.privacy) : Globe;

  // ──────────────────── COMMUNITY DETAIL VIEW ────────────────────

  if (selected) {
    return (
      <AppLayout>
        <div className="flex flex-col h-screen bg-background">
          {/* STICKY HEADER */}
          <header className="sticky top-0 z-40 bg-[#070d14]/90 backdrop-blur-xl border-b border-border/30">
            {/* Banner */}
            <div className="relative h-24 bg-gradient-to-br from-primary/15 via-accent/10 to-background overflow-hidden">
              {validUrl(selected.banner_url) && (
                <img src={validUrl(selected.banner_url)} alt="" className="absolute inset-0 w-full h-full object-cover opacity-60" onError={e => (e.target as HTMLImageElement).remove()} />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-[#070d14] to-transparent" />
              {/* Back button */}
              <button
                onClick={() => setSelected(null)}
                className="absolute top-3 left-3 p-2 rounded-full bg-black/40 backdrop-blur-sm hover:bg-black/60 transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              {/* Action buttons */}
              <div className="absolute top-3 right-3 flex items-center gap-2">
                {isCreator && (
                  <button
                    onClick={() => setShowVoice(!showVoice)}
                    className={`p-2 rounded-full backdrop-blur-sm transition-colors ${showVoice ? "bg-green-500/30 text-green-400" : "bg-black/40 text-muted-foreground hover:text-foreground"}`}
                  >
                    <Volume2 className="h-4 w-4" />
                  </button>
                )}
                {isMember && selected.privacy === "invite_only" && (
                  <button
                    onClick={() => setShowInviteModal(true)}
                    className="p-2 rounded-full bg-black/40 backdrop-blur-sm hover:bg-black/60 transition-colors"
                  >
                    <UserPlus className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Community identity row */}
            <div className="px-4 -mt-8 pb-3 flex items-end justify-between gap-3">
              <div className="flex items-end gap-3">
                <div className="w-16 h-16 rounded-2xl bg-[#070d14] border-4 border-[#070d14] flex items-center justify-center text-3xl shrink-0 shadow-lg">
                  {validIcon(selected.icon) || selected.name[0]}
                </div>
                <div className="pb-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h1 className="text-base font-bold truncate">{selected.name}</h1>
                    {selected.privacy === "holder_only" && <Gem className="h-3.5 w-3.5 text-amber-400 shrink-0" />}
                    {selected.privacy === "invite_only" && <Mail className="h-3.5 w-3.5 text-purple-400 shrink-0" />}
                  </div>
                  <p className="text-[10px] text-muted-foreground flex items-center gap-2">
                    <Users className="h-3 w-3" />
                    {selected.member_count?.toLocaleString() || members.length} members
                    <Dot className="h-2 w-2" />
                    {selected.post_count || posts.length} posts
                  </p>
                </div>
              </div>
              {/* Join/Leave/Delete */}
              <div className="flex items-center gap-1.5 pb-1 shrink-0">
                {!isMember && user && (
                  <Button size="sm" onClick={joinCommunity} className="rounded-full btn-3d text-xs h-8 px-4">
                    {selected.privacy === "private" ? "Request" : "Join"}
                  </Button>
                )}
                {isMember && !isCreator && (
                  <Button size="sm" variant="outline" onClick={leaveCommunity} className="rounded-full text-xs h-8 px-3 border-border/40">
                    Leave
                  </Button>
                )}
                {isCreator && (
                  <button onClick={deleteCommunity} className="p-2 rounded-full bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors">
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Holder-only badge */}
            {selected.privacy === "holder_only" && selected.required_token_symbol && (
              <div className="mx-4 mb-2 flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-500/5 border border-amber-500/20 text-xs text-amber-400">
                <Gem className="h-3.5 w-3.5" />
                Requires {selected.required_token_amount?.toLocaleString()} {selected.required_token_symbol}+ to join
              </div>
            )}

            {/* Voice panel */}
            {showVoice && isMember && (
              <div className="px-4 pb-3">
                <VoicePanel lobbyId={`community-${selected.id}`} lobbyName={selected.name} autoJoin={true} />
              </div>
            )}

            {/* Tab navigation - X style */}
            <div className="flex border-t border-border/20">
              {[
                { key: "feed", label: "Posts", icon: Hash },
                { key: "chat", label: "Chat", icon: MessageSquare },
                { key: "members", label: "Members", icon: Users },
                { key: "about", label: "About", icon: Eye },
              ].map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  className={`flex-1 py-3 flex items-center justify-center gap-1.5 text-xs font-semibold transition-all relative ${
                    tab === key ? "text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted/5"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                  {tab === key && <div className="absolute bottom-0 left-1/4 right-1/4 h-[3px] bg-primary rounded-full" />}
                </button>
              ))}
            </div>
          </header>

          {/* ═══ FEED TAB ═══ */}
          {tab === "feed" && (
            <ScrollArea className="flex-1">
              <div className="max-w-xl mx-auto">
                {/* Sort strip */}
                <div className="px-4 py-2.5 flex items-center gap-2 border-b border-border/10 sticky top-0 bg-[#070d14]/80 backdrop-blur-sm z-10">
                  {(["latest", "trending", "top"] as const).map(s => (
                    <button
                      key={s}
                      onClick={() => { setFeedSort(s); fetchPosts(selected.id); }}
                      className={`px-3 py-1.5 rounded-full text-[10px] font-bold transition-colors ${
                        feedSort === s ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted/20"
                      }`}
                    >
                      {s === "latest" && <Clock className="h-3 w-3 inline mr-1" />}
                      {s === "trending" && <Flame className="h-3 w-3 inline mr-1" />}
                      {s === "top" && <TrendingUp className="h-3 w-3 inline mr-1" />}
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </button>
                  ))}
                </div>

                {/* Compose box */}
                {user && isMember && (
                  <div className="px-4 py-4 border-b border-border/10">
                    <div className="flex gap-3">
                      <Avatar className="h-10 w-10 shrink-0">
                        <AvatarImage src={validUrl(profile?.avatar_url)} />
                        <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-primary-foreground text-sm font-bold">
                          {(profile?.username || "U")[0].toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 space-y-2.5">
                        <Textarea
                          placeholder="What's happening?"
                          value={newPost}
                          onChange={e => setNewPost(e.target.value)}
                          className="min-h-[60px] bg-transparent border-0 shadow-none resize-none text-base placeholder:text-muted-foreground/40 focus-visible:ring-0 p-0"
                        />
                        <div className="flex items-center justify-between border-t border-border/15 pt-2.5">
                          <div className="flex gap-0.5">
                            {[ImageIcon, BarChart3].map((Icon, i) => (
                              <button key={i} className="p-2 rounded-full text-primary/50 hover:bg-primary/10 hover:text-primary transition-colors">
                                <Icon className="h-4 w-4" />
                              </button>
                            ))}
                          </div>
                          <Button
                            onClick={submitPost}
                            disabled={!newPost.trim()}
                            size="sm"
                            className="rounded-full px-5 btn-3d text-sm h-8 font-bold"
                          >
                            Post
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Posts */}
                <div className="divide-y divide-border/10">
                  {posts.map(post => (
                    <article key={post.id} className="px-4 py-4 hover:bg-white/[0.02] transition-colors cursor-pointer">
                      <div className="flex gap-3">
                        <Avatar className="h-10 w-10 shrink-0">
                          <AvatarImage src={validUrl(post.avatar_url)} />
                          <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-primary-foreground text-xs font-bold">
                            {(post.username || "?")[0].toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-sm">{post.username || "Anonymous"}</span>
                            {post.user_id === selected.created_by && (
                              <Badge className="text-[8px] bg-primary/10 text-primary border-primary/20 h-4 rounded-full px-1.5">
                                <Crown className="h-2 w-2 mr-0.5" /> Admin
                              </Badge>
                            )}
                            <span className="text-xs text-muted-foreground shrink-0">
                              · {formatDistanceToNow(new Date(post.created_at), { addSuffix: false })}
                            </span>
                          </div>
                          <p className="text-sm leading-relaxed mt-1 whitespace-pre-wrap break-words text-[#e7e9ea]">{post.content}</p>
                          {validUrl(post.image_url) && (
                            <img src={validUrl(post.image_url)} alt="" className="mt-3 rounded-2xl max-h-80 object-cover w-full border border-border/20" onError={e => (e.target as HTMLImageElement).remove()} />
                          )}
                          {/* X-style action bar */}
                          <div className="flex items-center justify-between mt-3 max-w-xs -ml-2">
                            <button className="flex items-center gap-1 text-muted-foreground hover:text-primary group p-2 rounded-full hover:bg-primary/10 transition-colors">
                              <MessageSquare className="h-4 w-4" />
                              <span className="text-xs">{post.replies_count || ""}</span>
                            </button>
                            <button className="flex items-center gap-1 text-muted-foreground hover:text-green-500 p-2 rounded-full hover:bg-green-500/10 transition-colors">
                              <Repeat2 className="h-4 w-4" />
                              <span className="text-xs">{post.reposts_count || ""}</span>
                            </button>
                            <button
                              onClick={() => toggleLike(post)}
                              className={`flex items-center gap-1 p-2 rounded-full transition-colors ${
                                post.liked ? "text-pink-500" : "text-muted-foreground hover:text-pink-500 hover:bg-pink-500/10"
                              }`}
                            >
                              <Heart className={`h-4 w-4 ${post.liked ? "fill-current" : ""}`} />
                              <span className="text-xs">{post.likes_count || ""}</span>
                            </button>
                            <button className="flex items-center gap-1 text-muted-foreground hover:text-primary p-2 rounded-full hover:bg-primary/10 transition-colors">
                              <Bookmark className="h-4 w-4" />
                            </button>
                            <button className="flex items-center gap-1 text-muted-foreground hover:text-primary p-2 rounded-full hover:bg-primary/10 transition-colors">
                              <Share className="h-4 w-4" />
                            </button>
                            {user && (post.user_id === user.id || isCreator) && (
                              <button onClick={() => deletePost(post.id)} className="text-muted-foreground hover:text-destructive p-2 rounded-full hover:bg-destructive/10 transition-colors">
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </article>
                  ))}
                  {posts.length === 0 && (
                    <div className="text-center py-20 text-muted-foreground">
                      <Sparkles className="h-12 w-12 mx-auto mb-3 opacity-20" />
                      <p className="font-semibold">No posts yet</p>
                      <p className="text-sm mt-1 opacity-60">Be the first to post something!</p>
                    </div>
                  )}
                </div>
              </div>
            </ScrollArea>
          )}

          {/* ═══ CHAT TAB ═══ */}
          {tab === "chat" && (
            <div className="flex-1 flex flex-col min-h-0">
              <ScrollArea className="flex-1">
                <div className="p-4 space-y-3 max-w-xl mx-auto">
                  {messages.length === 0 && (
                    <div className="text-center py-20 text-muted-foreground">
                      <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-20" />
                      <p className="font-semibold">No messages yet</p>
                      <p className="text-sm mt-1 opacity-60">Start the conversation!</p>
                    </div>
                  )}
                  {messages.map(msg => (
                    <div key={msg.id} className={`flex gap-2.5 ${msg.user_id === user?.id ? "flex-row-reverse" : ""}`}>
                      <Avatar className="h-8 w-8 shrink-0">
                        <AvatarImage src={validUrl(msg.avatar_url)} />
                        <AvatarFallback className="bg-muted text-xs">{(msg.username || "?")[0].toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className={`max-w-[75%] ${msg.user_id === user?.id ? "items-end flex flex-col" : ""}`}>
                        <p className="text-[10px] text-muted-foreground mb-0.5 flex items-center gap-1">
                          {msg.username}
                          {msg.user_id === selected.created_by && <Crown className="h-2.5 w-2.5 text-primary" />}
                        </p>
                        <div className={`px-3 py-2 rounded-2xl text-sm ${
                          msg.user_id === user?.id
                            ? "bg-primary text-primary-foreground rounded-br-md"
                            : "bg-muted/30 rounded-bl-md"
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
                <div className="p-3 border-t border-border/30 bg-card/30 backdrop-blur-sm">
                  <div className="flex gap-2 max-w-xl mx-auto">
                    <Input
                      placeholder="Message..."
                      value={chatMsg}
                      onChange={e => setChatMsg(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendChat()}
                      className="rounded-full bg-muted/20 border-border/20 text-sm"
                    />
                    <Button onClick={sendChat} size="icon" className="rounded-full shrink-0 btn-3d h-10 w-10">
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ═══ MEMBERS TAB ═══ */}
          {tab === "members" && (
            <ScrollArea className="flex-1">
              <div className="max-w-xl mx-auto divide-y divide-border/10">
                <div className="px-4 py-3 flex items-center justify-between">
                  <p className="text-sm font-bold">{members.length} Members</p>
                  {isMember && selected.privacy === "invite_only" && (
                    <Button size="sm" variant="outline" onClick={() => setShowInviteModal(true)} className="rounded-full text-xs h-7 gap-1 border-border/30">
                      <UserPlus className="h-3 w-3" /> Invite
                    </Button>
                  )}
                </div>
                {members.map(m => {
                  const mIsCreator = m.user_id === selected.created_by;
                  return (
                    <div key={m.id} className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors group">
                      <div className="relative">
                        <Avatar className="h-11 w-11">
                          <AvatarImage src={validUrl(m.avatar_url)} />
                          <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-primary-foreground text-sm font-bold">
                            {(m.username || "?")[0].toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-green-500 border-2 border-[#070d14]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-semibold text-sm">{m.username || "User"}</span>
                          {mIsCreator && <Badge className="text-[8px] bg-primary/10 text-primary border-primary/20 h-4 rounded-full"><Crown className="h-2.5 w-2.5 mr-0.5" /> Admin</Badge>}
                          {m.role === "moderator" && <Badge className="text-[8px] bg-blue-500/10 text-blue-400 border-blue-500/20 h-4 rounded-full"><Shield className="h-2.5 w-2.5 mr-0.5" /> Mod</Badge>}
                        </div>
                        {m.bio && <p className="text-xs text-muted-foreground truncate mt-0.5">{m.bio}</p>}
                      </div>
                      {m.user_id !== user?.id && (
                        <Button variant="outline" size="sm" className="rounded-full text-xs h-7 px-3 opacity-0 group-hover:opacity-100 transition-opacity border-border/30">
                          Follow
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}

          {/* ═══ ABOUT TAB ═══ */}
          {tab === "about" && (
            <ScrollArea className="flex-1">
              <div className="max-w-xl mx-auto p-4 space-y-4">
                {/* Description */}
                {selected.description && (
                  <div className="p-4 rounded-2xl bg-card/30 border border-border/20">
                    <p className="text-sm text-muted-foreground leading-relaxed">{selected.description}</p>
                  </div>
                )}

                {/* Stats */}
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "Members", value: selected.member_count?.toLocaleString() || members.length },
                    { label: "Posts", value: selected.post_count?.toLocaleString() || posts.length },
                    { label: "Category", value: selected.category || "General" },
                  ].map((s, i) => (
                    <div key={i} className="text-center p-3 rounded-2xl bg-card/30 border border-border/20">
                      <p className="text-base font-bold">{s.value}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{s.label}</p>
                    </div>
                  ))}
                </div>

                {/* Privacy info */}
                <div className={`p-4 rounded-2xl border ${
                  selected.privacy === "holder_only" ? "bg-amber-500/5 border-amber-500/20" :
                  selected.privacy === "invite_only" ? "bg-purple-500/5 border-purple-500/20" :
                  selected.privacy === "private" ? "bg-blue-500/5 border-blue-500/20" :
                  "bg-green-500/5 border-green-500/20"
                }`}>
                  <div className="flex items-center gap-2 mb-1">
                    <PrivacyIcon className={`h-4 w-4 ${
                      selected.privacy === "holder_only" ? "text-amber-400" :
                      selected.privacy === "invite_only" ? "text-purple-400" :
                      selected.privacy === "private" ? "text-blue-400" : "text-green-400"
                    }`} />
                    <p className="font-semibold text-sm">{privacyLabel(selected.privacy)} Community</p>
                  </div>
                  {selected.privacy === "holder_only" && selected.required_token_symbol && (
                    <p className="text-xs text-muted-foreground">Requires {selected.required_token_amount?.toLocaleString()} {selected.required_token_symbol}+ to join</p>
                  )}
                  {selected.privacy === "invite_only" && (
                    <p className="text-xs text-muted-foreground">Members are invited by existing community members</p>
                  )}
                  {selected.privacy === "private" && (
                    <p className="text-xs text-muted-foreground">Membership requires approval from the admin</p>
                  )}
                  {selected.privacy === "public" && (
                    <p className="text-xs text-muted-foreground">Anyone can find and join this community</p>
                  )}
                </div>

                {/* Creator */}
                <div className="flex items-center gap-3 p-4 rounded-2xl bg-card/30 border border-border/20">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={validUrl(selected.creator_avatar)} />
                    <AvatarFallback className="bg-muted text-sm">{(selected.creator_name || "?")[0].toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-bold flex items-center gap-1">
                      @{selected.creator_name}
                      <Crown className="h-3.5 w-3.5 text-primary" />
                    </p>
                    <p className="text-[10px] text-muted-foreground">Created {formatDistanceToNow(new Date(selected.created_at), { addSuffix: true })}</p>
                  </div>
                </div>

                {/* Rules */}
                {selected.rules && selected.rules.length > 0 && (
                  <div className="p-4 rounded-2xl bg-card/30 border border-border/20 space-y-3">
                    <h3 className="font-bold text-sm flex items-center gap-2">
                      <Shield className="h-4 w-4 text-primary" /> Community Rules
                    </h3>
                    {selected.rules.map((rule, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <span className="text-xs text-primary font-bold mt-0.5 w-5 shrink-0">{i + 1}.</span>
                        <p className="text-sm text-muted-foreground">{rule}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Tags */}
                {selected.tags && selected.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {selected.tags.map(tag => (
                      <span key={tag} className="px-3 py-1 rounded-full text-xs bg-muted/20 text-muted-foreground border border-border/20">
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </div>

        {showInviteModal && (
          <InviteModal community={selected} onClose={() => setShowInviteModal(false)} />
        )}
      </AppLayout>
    );
  }

  // ──────────────────── COMMUNITY LIST VIEW ────────────────────

  return (
    <AppLayout>
      <div className="flex flex-col h-screen">
        {/* Header */}
        <div className="sticky top-0 z-30 bg-[#070d14]/90 backdrop-blur-xl border-b border-border/20 px-4 pt-4 pb-3">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-xl font-bold gradient-text flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" /> Communities
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">Connect, share, and trade together</p>
            </div>
            <Button
              onClick={() => setShowCreate(true)}
              className="rounded-full btn-3d gap-1.5 text-xs h-9 px-4"
              size="sm"
            >
              <Plus className="h-4 w-4" /> New
            </Button>
          </div>

          {/* Search */}
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40" />
            <Input
              placeholder="Search communities..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-10 rounded-full bg-muted/10 border-border/20 h-9 text-sm"
            />
          </div>

          {/* View tabs */}
          <div className="flex gap-0 border-b border-transparent -mb-3 pb-0">
            {[
              { key: "discover", label: "Discover" },
              { key: "joined", label: "My Communities" },
            ].map(v => (
              <button
                key={v.key}
                onClick={() => setListView(v.key as typeof listView)}
                className={`flex-1 py-2.5 text-sm font-bold transition-colors relative ${
                  listView === v.key ? "text-foreground" : "text-muted-foreground hover:text-foreground/70"
                }`}
              >
                {v.label}
                {listView === v.key && <div className="absolute bottom-0 left-1/4 right-1/4 h-[3px] bg-primary rounded-full" />}
              </button>
            ))}
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="px-4 pt-4">
            {/* Category filter */}
            <div className="flex gap-2 overflow-x-auto pb-2 mb-3 no-scrollbar">
              <button
                onClick={() => setCategoryFilter(null)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border shrink-0 transition-colors ${
                  !categoryFilter ? "bg-primary/15 border-primary/50 text-primary" : "border-border/20 text-muted-foreground hover:border-border/50"
                }`}
              >
                All
              </button>
              {COMMUNITY_CATEGORIES.map(cat => (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(categoryFilter === cat ? null : cat)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border shrink-0 transition-colors ${
                    categoryFilter === cat ? "bg-primary/15 border-primary/50 text-primary" : "border-border/20 text-muted-foreground hover:border-border/50"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Privacy filter pills */}
            <div className="flex gap-2 mb-4 overflow-x-auto no-scrollbar">
              {PRIVACY_OPTIONS.map(opt => {
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.value}
                    onClick={() => setPrivacyFilter(privacyFilter === opt.value ? null : opt.value)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold border shrink-0 transition-all ${
                      privacyFilter === opt.value ? opt.bg : "border-border/15 text-muted-foreground hover:border-border/40"
                    }`}
                  >
                    <Icon className={`h-3 w-3 ${privacyFilter === opt.value ? opt.color : ""}`} />
                    {opt.label}
                  </button>
                );
              })}
            </div>

            {/* Invite code join */}
            {inviteCodeInput && (
              <div className="mb-4 p-3 rounded-2xl bg-purple-500/5 border border-purple-500/20 flex items-center gap-2">
                <Mail className="h-4 w-4 text-purple-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-purple-400">Invite code detected</p>
                  <p className="text-[10px] text-muted-foreground font-mono">{inviteCodeInput}</p>
                </div>
                <Button size="sm" onClick={joinViaInviteCode} disabled={joiningViaCode} className="rounded-full text-xs h-7 btn-3d">
                  Join
                </Button>
                <button onClick={() => setInviteCodeInput("")} className="p-1 rounded-full hover:bg-muted/30">
                  <XIcon className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              </div>
            )}

            {/* Communities grid */}
            {loading ? (
              <div className="grid grid-cols-1 gap-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-36 rounded-2xl bg-muted/10 animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 pb-6">
                {filtered.map(c => (
                  <CommunityCard
                    key={c.id}
                    c={c}
                    onClick={() => enterCommunity(c)}
                    isMember={joinedIds.has(c.id)}
                  />
                ))}
                {filtered.length === 0 && (
                  <div className="text-center py-20 text-muted-foreground">
                    <Users className="h-14 w-14 mx-auto mb-3 opacity-15" />
                    <p className="font-semibold">
                      {listView === "joined" ? "You haven't joined any communities yet" : "No communities found"}
                    </p>
                    <p className="text-sm mt-1 opacity-60">
                      {listView === "joined" ? "Discover and join communities below" : "Create the first one!"}
                    </p>
                    {listView === "joined" && (
                      <Button onClick={() => setListView("discover")} variant="outline" className="mt-4 rounded-full text-sm">
                        Discover Communities
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {showCreate && (
        <CreateCommunityWizard
          onClose={() => setShowCreate(false)}
          onCreated={() => { fetchCommunities(); fetchJoinedIds(); }}
          user={user}
          profile={profile}
        />
      )}
    </AppLayout>
  );
};

export default Communities;

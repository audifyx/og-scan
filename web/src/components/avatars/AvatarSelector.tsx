import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sparkles, Crown, Star, Zap, Upload, Camera, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface Avatar {
  id: string;
  name: string;
  emoji: string;
  rarity: "common" | "rare" | "epic" | "legendary";
  category: string;
}

const MEME_AVATARS: Avatar[] = [
  // Crypto Legends
  { id: "wojak", name: "Wojak", emoji: "😐", rarity: "common", category: "Memes" },
  { id: "pepe", name: "Pepe", emoji: "🐸", rarity: "rare", category: "Memes" },
  { id: "chad", name: "Chad", emoji: "💪", rarity: "epic", category: "Memes" },
  { id: "bobo", name: "Bobo", emoji: "🐻", rarity: "common", category: "Memes" },
  { id: "durr", name: "Durr Guy", emoji: "🤪", rarity: "rare", category: "Memes" },
  { id: "dev", name: "Dev", emoji: "👨‍💻", rarity: "epic", category: "Memes" },
  { id: "diamond-hands", name: "Diamond Hands", emoji: "💎", rarity: "legendary", category: "Memes" },
  { id: "paper-hands", name: "Paper Hands", emoji: "📄", rarity: "common", category: "Memes" },
  { id: "ape", name: "Ape", emoji: "🦍", rarity: "rare", category: "Memes" },
  { id: "moon-boy", name: "Moon Boy", emoji: "🌙", rarity: "epic", category: "Memes" },
  // Crypto Icons
  { id: "bitcoin", name: "Bitcoin Bull", emoji: "₿", rarity: "legendary", category: "Crypto" },
  { id: "ethereum", name: "ETH Maxi", emoji: "⟠", rarity: "epic", category: "Crypto" },
  { id: "solana", name: "SOL Soldier", emoji: "◎", rarity: "legendary", category: "Crypto" },
  { id: "doge", name: "Doge", emoji: "🐕", rarity: "rare", category: "Crypto" },
  { id: "shiba", name: "Shiba", emoji: "🐕‍🦺", rarity: "rare", category: "Crypto" },
  { id: "bonk", name: "Bonk", emoji: "🔨", rarity: "epic", category: "Crypto" },
  // Trading Vibes
  { id: "whale", name: "Whale", emoji: "🐋", rarity: "legendary", category: "Trading" },
  { id: "bull", name: "Bull", emoji: "🐂", rarity: "epic", category: "Trading" },
  { id: "bear", name: "Bear", emoji: "🐻", rarity: "epic", category: "Trading" },
  { id: "rocket", name: "Rocket", emoji: "🚀", rarity: "rare", category: "Trading" },
  { id: "fire", name: "On Fire", emoji: "🔥", rarity: "rare", category: "Trading" },
  { id: "ghost", name: "Ghost", emoji: "👻", rarity: "common", category: "Trading" },
  { id: "alien", name: "Alien", emoji: "👽", rarity: "epic", category: "Trading" },
  { id: "robot", name: "Bot", emoji: "🤖", rarity: "rare", category: "Trading" },
];

const RARITY_COLORS = {
  common: "bg-muted text-muted-foreground border-border",
  rare: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  epic: "bg-purple-500/10 text-purple-400 border-purple-500/30",
  legendary: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
};

const RARITY_GLOW = {
  common: "",
  rare: "ring-1 ring-blue-500/20",
  epic: "ring-1 ring-purple-500/20",
  legendary: "ring-2 ring-yellow-500/30 shadow-lg shadow-yellow-500/10",
};

interface AvatarSelectorProps {
  currentAvatar?: string | null;
  userId?: string;
  onSelect: (avatarUrl: string) => void;
  trigger?: React.ReactNode;
}

export const AvatarSelector = ({ currentAvatar, userId, onSelect, trigger }: AvatarSelectorProps) => {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const categories = [...new Set(MEME_AVATARS.map(a => a.category))];

  const handleSelect = (avatar: Avatar) => {
    setSelected(avatar.id);
    onSelect(`emoji:${avatar.emoji}:${avatar.name}:${avatar.rarity}`);
    setOpen(false);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setUploadError("File must be under 5 MB");
      return;
    }
    setUploadError(null);
    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const uid = userId || user?.id;
      if (!uid) throw new Error("Not signed in");
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${uid}/avatar-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("profile-media")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from("profile-media").getPublicUrl(path);
      onSelect(data.publicUrl);
      setOpen(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setUploadError(msg.includes("Bucket not found") ? "Storage not configured yet" : msg);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="gap-2 rounded-xl">
            <Sparkles className="h-4 w-4" /> Choose Avatar
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Choose Your Avatar
          </DialogTitle>
        </DialogHeader>

        {/* Photo upload section */}
        <div
          className="flex items-center gap-3 p-3 rounded-xl border border-dashed border-border/40 bg-muted/10 cursor-pointer hover:border-primary/40 hover:bg-primary/5 transition-all"
          onClick={() => fileRef.current?.click()}
        >
          {uploading ? (
            <Loader2 className="h-8 w-8 text-primary animate-spin shrink-0" />
          ) : (
            <Camera className="h-8 w-8 text-muted-foreground shrink-0" />
          )}
          <div>
            <p className="text-sm font-semibold">{uploading ? "Uploading…" : "Upload a photo"}</p>
            <p className="text-xs text-muted-foreground">JPG, PNG or GIF · max 5 MB</p>
            {uploadError && <p className="text-xs text-destructive mt-0.5">{uploadError}</p>}
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
        </div>

        <div className="flex items-center gap-2 mb-1">
          <div className="h-px flex-1 bg-border/30" />
          <span className="text-[10px] text-muted-foreground uppercase tracking-widest">or pick an avatar</span>
          <div className="h-px flex-1 bg-border/30" />
        </div>

        <div className="flex items-center gap-2 mb-3">
          <Badge variant="outline" className={RARITY_COLORS.common}>Common</Badge>
          <Badge variant="outline" className={RARITY_COLORS.rare}>Rare</Badge>
          <Badge variant="outline" className={RARITY_COLORS.epic}>Epic</Badge>
          <Badge variant="outline" className={RARITY_COLORS.legendary}>Legendary</Badge>
        </div>

        <Tabs defaultValue={categories[0]}>
          <TabsList className="grid w-full grid-cols-3 bg-muted/30">
            {categories.map(cat => (
              <TabsTrigger key={cat} value={cat} className="text-xs">{cat}</TabsTrigger>
            ))}
          </TabsList>

          {categories.map(cat => (
            <TabsContent key={cat} value={cat}>
              <ScrollArea className="h-[240px]">
                <div className="grid grid-cols-4 gap-3 p-2">
                  {MEME_AVATARS.filter(a => a.category === cat).map(avatar => (
                    <button
                      key={avatar.id}
                      onClick={() => handleSelect(avatar)}
                      className={`relative flex flex-col items-center gap-1.5 p-3 rounded-2xl border transition-all hover:scale-105 active:scale-95 ${
                        selected === avatar.id 
                          ? "border-primary bg-primary/10" 
                          : `border-border/50 bg-card/50 hover:border-primary/30 ${RARITY_GLOW[avatar.rarity]}`
                      }`}
                    >
                      <span className="text-3xl">{avatar.emoji}</span>
                      <span className="text-[9px] font-medium truncate w-full text-center">{avatar.name}</span>
                      {avatar.rarity === "legendary" && (
                        <Crown className="absolute -top-1 -right-1 h-3.5 w-3.5 text-yellow-500" />
                      )}
                      {avatar.rarity === "epic" && (
                        <Star className="absolute -top-1 -right-1 h-3 w-3 text-purple-400" />
                      )}
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>
          ))}
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

// Helper to render an avatar from the stored string
// Strip invalid avatar URLs (empty, "default", "null", non-http)
function safeRenderUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const s = url.trim();
  if (!s || s === "default" || s === "null" || s === "undefined") return null;
  if (s.startsWith("emoji:")) return s; // handled separately
  if (!s.startsWith("http") && !s.startsWith("/") && !s.startsWith("blob:") && !s.startsWith("data:")) return null;
  return s;
}

export const renderAvatar = (avatarUrl: string | null | undefined, username?: string | null, size: "sm" | "md" | "lg" = "md") => {
  const sizeClasses = {
    sm: "h-8 w-8 text-lg",
    md: "h-11 w-11 text-2xl",
    lg: "h-24 w-24 text-5xl",
  };

  const safeUrl = safeRenderUrl(avatarUrl);

  if (safeUrl?.startsWith("emoji:")) {
    const parts = safeUrl.split(":");
    const emoji = parts[1];
    const rarity = parts[3] as keyof typeof RARITY_GLOW || "common";
    return (
      <div className={`${sizeClasses[size]} rounded-2xl bg-gradient-to-br from-primary/20 to-accent/10 flex items-center justify-center ${RARITY_GLOW[rarity]} border border-border/30`}>
        {emoji}
      </div>
    );
  }

  if (safeUrl) {
    return (
      <div className={`${sizeClasses[size]} rounded-2xl overflow-hidden relative`}>
        <img
          src={safeUrl}
          alt=""
          className={`${sizeClasses[size]} rounded-2xl object-cover`}
          onError={(e) => {
            const el = e.target as HTMLImageElement;
            el.style.display = "none";
            const fallback = el.nextElementSibling as HTMLElement | null;
            if (fallback) fallback.style.display = "flex";
          }}
        />
        <div
          className={`${sizeClasses[size]} rounded-2xl bg-gradient-to-br from-primary to-secondary items-center justify-center font-bold text-primary-foreground`}
          style={{ display: "none", position: "absolute", inset: 0 }}
        >
          {username?.charAt(0).toUpperCase() || "?"}
        </div>
      </div>
    );
  }

  return (
    <div className={`${sizeClasses[size]} rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center font-bold text-primary-foreground`}>
      {username?.charAt(0).toUpperCase() || "?"}
    </div>
  );
};

/**
 * MemeGallery — Community meme creation & gallery.
 * Users can create memes from templates, share, vote, and browse.
 * Stored in localStorage; ready for Supabase upgrade.
 */
import { useState, useRef, useEffect } from "react";
import { Image, Plus, Heart, Share2, Download, Trash2, Sparkles, TrendingUp, Clock, Trophy, X, Type, Palette } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Meme {
  id: string;
  topText: string;
  bottomText: string;
  bgColor: string;
  emoji: string;
  likes: number;
  createdAt: string;
  creatorName: string;
}

const STORAGE_KEY = "ogscan_memes";
const TEMPLATES = [
  { emoji: "🚀", bg: "from-blue-900 to-purple-900", label: "Moon" },
  { emoji: "📈", bg: "from-emerald-900 to-teal-900", label: "Pump" },
  { emoji: "💎", bg: "from-cyan-900 to-blue-900", label: "Diamond" },
  { emoji: "🐻", bg: "from-red-900 to-orange-900", label: "Bear" },
  { emoji: "🔥", bg: "from-orange-900 to-red-900", label: "Fire" },
  { emoji: "🤡", bg: "from-pink-900 to-purple-900", label: "Rug" },
  { emoji: "🐋", bg: "from-slate-900 to-blue-900", label: "Whale" },
  { emoji: "💀", bg: "from-gray-900 to-slate-900", label: "Rekt" },
];

function loadMemes(): Meme[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); } catch { return []; }
}
function saveMemes(memes: Meme[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(memes));
}

interface Props {}

export const MemeGallery: React.FC<Props> = () => {
  const [memes, setMemes] = useState<Meme[]>(loadMemes);
  const [showCreate, setShowCreate] = useState(false);
  const [topText, setTopText] = useState("");
  const [bottomText, setBottomText] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState(0);
  const [sortBy, setSortBy] = useState<"new" | "top">("new");

  const createMeme = () => {
    if (!topText.trim() && !bottomText.trim()) {
      toast.error("Add some text!");
      return;
    }
    const tpl = TEMPLATES[selectedTemplate];
    const meme: Meme = {
      id: crypto.randomUUID(),
      topText: topText.trim(),
      bottomText: bottomText.trim(),
      bgColor: tpl.bg,
      emoji: tpl.emoji,
      likes: 0,
      createdAt: new Date().toISOString(),
      creatorName: "OG",
    };
    setMemes(prev => {
      const next = [meme, ...prev].slice(0, 100);
      saveMemes(next);
      return next;
    });
    setTopText("");
    setBottomText("");
    setShowCreate(false);
    toast.success("Meme created! 🎨");
  };

  const likeMeme = (id: string) => {
    setMemes(prev => {
      const next = prev.map(m => m.id === id ? { ...m, likes: m.likes + 1 } : m);
      saveMemes(next);
      return next;
    });
  };

  const deleteMeme = (id: string) => {
    setMemes(prev => {
      const next = prev.filter(m => m.id !== id);
      saveMemes(next);
      return next;
    });
  };

  const sorted = [...memes].sort((a, b) =>
    sortBy === "top" ? b.likes - a.likes : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] overflow-hidden">
      <div className="flex items-center gap-3 p-4 border-b border-white/[0.06]">
        <Sparkles className="h-4 w-4 text-primary" />
        <div className="flex-1">
          <p className="text-sm font-bold text-white">Meme Factory</p>
          <p className="text-[10px] text-white/25">{memes.length} memes created</p>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="px-3 py-1.5 rounded-lg bg-primary text-white text-[10px] font-bold flex items-center gap-1"
        >
          <Plus className="h-3 w-3" /> Create
        </button>
      </div>

      {/* Create panel */}
      {showCreate && (
        <div className="p-3 border-b border-white/[0.06] bg-primary/5 space-y-3">
          {/* Template selection */}
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {TEMPLATES.map((tpl, i) => (
              <button
                key={i}
                onClick={() => setSelectedTemplate(i)}
                className={cn("shrink-0 w-12 h-12 rounded-xl flex items-center justify-center text-lg bg-gradient-to-br border-2 transition-all",
                  tpl.bg,
                  selectedTemplate === i ? "border-primary scale-110" : "border-transparent opacity-60"
                )}
              >
                {tpl.emoji}
              </button>
            ))}
          </div>

          {/* Preview */}
          <div className={cn("rounded-xl bg-gradient-to-br p-6 text-center relative overflow-hidden", TEMPLATES[selectedTemplate].bg)}>
            <div className="absolute inset-0 flex items-center justify-center opacity-10 text-8xl">
              {TEMPLATES[selectedTemplate].emoji}
            </div>
            <p className="text-lg font-black text-white uppercase relative z-10 drop-shadow-lg">
              {topText || "Top text..."}
            </p>
            <p className="text-4xl my-3 relative z-10">{TEMPLATES[selectedTemplate].emoji}</p>
            <p className="text-lg font-black text-white uppercase relative z-10 drop-shadow-lg">
              {bottomText || "Bottom text..."}
            </p>
          </div>

          <Input
            placeholder="Top text..."
            value={topText}
            onChange={e => setTopText(e.target.value)}
            className="h-8 text-xs bg-white/[0.03] border-white/[0.08]"
          />
          <Input
            placeholder="Bottom text..."
            value={bottomText}
            onChange={e => setBottomText(e.target.value)}
            className="h-8 text-xs bg-white/[0.03] border-white/[0.08]"
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={createMeme} className="h-7 text-xs">Create Meme</Button>
            <Button size="sm" variant="outline" onClick={() => setShowCreate(false)} className="h-7 text-xs">Cancel</Button>
          </div>
        </div>
      )}

      {/* Sort */}
      <div className="flex gap-1 px-3 py-2 border-b border-white/[0.04]">
        {(["new", "top"] as const).map(s => (
          <button key={s} onClick={() => setSortBy(s)}
            className={cn("flex items-center gap-1 px-2 py-1 rounded text-[9px]",
              sortBy === s ? "bg-primary/10 text-primary" : "text-white/20"
            )}>
            {s === "new" ? <Clock className="h-2.5 w-2.5" /> : <Trophy className="h-2.5 w-2.5" />}
            {s === "new" ? "New" : "Top"}
          </button>
        ))}
      </div>

      {/* Gallery */}
      <div className="max-h-[400px] overflow-y-auto">
        {sorted.length === 0 ? (
          <div className="p-8 text-center">
            <Sparkles className="h-8 w-8 text-white/[0.06] mx-auto mb-2" />
            <p className="text-xs text-white/20">No memes yet</p>
            <p className="text-[10px] text-white/10 mt-1">Create the first one!</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 p-3">
            {sorted.map(meme => (
              <div key={meme.id} className="rounded-xl overflow-hidden border border-white/[0.06] group">
                <div className={cn("bg-gradient-to-br p-4 text-center relative", meme.bgColor)}>
                  <div className="absolute inset-0 flex items-center justify-center opacity-10 text-6xl">
                    {meme.emoji}
                  </div>
                  <p className="text-[10px] font-black text-white uppercase relative z-10 drop-shadow">
                    {meme.topText}
                  </p>
                  <p className="text-2xl my-1 relative z-10">{meme.emoji}</p>
                  <p className="text-[10px] font-black text-white uppercase relative z-10 drop-shadow">
                    {meme.bottomText}
                  </p>
                </div>
                <div className="flex items-center gap-1 p-1.5 bg-black/40">
                  <button onClick={() => likeMeme(meme.id)} className="flex items-center gap-0.5 text-[8px] text-white/30 hover:text-red-400 px-1">
                    <Heart className="h-2.5 w-2.5" /> {meme.likes}
                  </button>
                  <div className="flex-1" />
                  <button onClick={() => deleteMeme(meme.id)}
                    className="text-white/10 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Trash2 className="h-2.5 w-2.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MemeGallery;

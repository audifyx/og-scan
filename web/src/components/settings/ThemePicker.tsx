import { useState, useRef } from "react";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Check, Upload, Trash2, Palette, Sparkles, Image, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { CustomThemeCreator } from "./CustomThemeCreator";
import { AnimatedWallpaperPicker } from "./AnimatedWallpaperPicker";

export const ThemePicker = () => {
  const { currentTheme, customWallpaper, setTheme, setCustomWallpaper, uploadWallpaper, allThemes } = useTheme();
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [blurAmount, setBlurAmount] = useState(12);
  const [search, setSearch] = useState("");

  const themes = search.trim()
    ? allThemes.filter(t =>
        t.name.toLowerCase().includes(search.toLowerCase()) ||
        t.category.toLowerCase().includes(search.toLowerCase()))
    : allThemes;
  const categories = [...new Set(themes.map(t => t.category))];

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!user) { toast({ title: "Sign in to upload wallpapers" }); return; }
    setUploading(true);
    const url = await uploadWallpaper(file);
    setUploading(false);
    if (url) toast({ title: "Wallpaper uploaded!" });
    else toast({ title: "Upload failed", variant: "destructive" });
  };

  return (
    <div className="space-y-6">
      {/* Wallpaper Upload */}
      <Card className="p-5 glass-card-premium border-primary/10">
        <h3 className="font-semibold mb-3 flex items-center gap-2 text-foreground">
          <Image className="h-5 w-5 text-primary" />
          Custom Wallpaper
        </h3>
        <p className="text-xs text-muted-foreground mb-3">Upload a custom background image behind the broken glass effect</p>
        <div className="flex gap-3">
          <Button variant="outline" className="btn-3d rounded-xl" onClick={() => fileRef.current?.click()} disabled={uploading}>
            <Upload className="h-4 w-4 mr-2" />
            {uploading ? "Uploading..." : "Choose Image"}
          </Button>
          {customWallpaper && (
            <Button variant="ghost" size="icon" onClick={() => setCustomWallpaper(null)} className="rounded-xl">
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
        {customWallpaper && (
          <div className="mt-3 rounded-2xl overflow-hidden border border-white/[0.07] h-20">
            <img src={customWallpaper} alt="Custom wallpaper" className="w-full h-full object-cover" />
          </div>
        )}
      </Card>

      {/* Blur control */}
      <Card className="p-5 glass-card border-border/30">
        <h3 className="font-semibold mb-3 flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          Background Blur
        </h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm">Blur Intensity</Label>
            <span className="text-xs text-muted-foreground font-mono">{blurAmount}px</span>
          </div>
          <Slider
            value={[blurAmount]}
            onValueChange={([v]) => {
              setBlurAmount(v);
              document.documentElement.style.setProperty("--bg-blur", `${v}px`);
            }}
            min={0}
            max={30}
            step={1}
            className="w-full"
          />
        </div>
      </Card>

      {/* Animated Wallpaper */}
      <AnimatedWallpaperPicker />

      {/* Custom theme creator */}
      <CustomThemeCreator />

      {/* Search bar */}
      <Card className="p-3 glass-card border-border/30">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={`Search ${allThemes.length} themes…`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 rounded-xl"
          />
        </div>
      </Card>

      {/* Theme Presets */}
      {categories.map(cat => (
        <div key={cat}>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
            <Palette className="h-4 w-4" />
            {cat} ({themes.filter(t => t.category === cat).length})
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {themes.filter(t => t.category === cat).map(theme => {
              const isActive = currentTheme === theme.id;
              const primary = theme.vars["--primary"];
              const bg = theme.vars["--background"];
              const accent = theme.vars["--accent"];
              return (
                <button
                  key={theme.id}
                  onClick={() => setTheme(theme.id)}
                  className={cn(
                    "relative rounded-2xl p-3 border-2 transition-all duration-200 text-left",
                    "hover:scale-[1.02] active:scale-[0.98]",
                    isActive ? "border-primary shadow-glow-sm" : "border-border/30 hover:border-border/60"
                  )}
                  style={{ background: `hsl(${bg})` }}
                >
                  <div className="flex gap-1.5 mb-2">
                    <div className="w-6 h-6 rounded-full border border-white/10" style={{ background: `hsl(${primary})` }} />
                    <div className="w-6 h-6 rounded-full border border-white/10" style={{ background: `hsl(${accent})` }} />
                    <div className="w-6 h-6 rounded-full border border-white/10" style={{ background: `hsl(${bg})` }} />
                  </div>
                  <span className="text-xs font-medium" style={{ color: `hsl(${theme.vars["--foreground"]})` }}>
                    {theme.name}
                  </span>
                  {isActive && (
                    <div className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center" style={{ background: `hsl(${primary})` }}>
                      <Check className="h-3 w-3" style={{ color: `hsl(${theme.vars["--primary-foreground"]})` }} />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

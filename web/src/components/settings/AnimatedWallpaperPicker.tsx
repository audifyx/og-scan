import { useState, useCallback } from "react";
import { useTheme } from "@/hooks/useTheme";
import { ANIMATED_WALLPAPERS, ANIMATED_WALLPAPER_CATEGORIES, type AnimatedWallpaperPreset } from "@/data/animatedWallpapers";
import { AnimatedWallpaperRenderer } from "@/components/wallpapers/AnimatedWallpaperRenderer";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Check, X, Play, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

const CATEGORIES = ["all", ...ANIMATED_WALLPAPER_CATEGORIES];

function PresetPreview({ preset }: { preset: AnimatedWallpaperPreset }) {
  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        width: 300,
        height: 200,
        transform: "scale(0.25)",
        transformOrigin: "top left",
        position: "relative",
      }}
    >
      <AnimatedWallpaperRenderer preset={preset} />
    </div>
  );
}

export const AnimatedWallpaperPicker = () => {
  const { animatedWallpaper, setAnimatedWallpaper } = useTheme();
  const [selectedCategory, setSelectedCategory] = useState<string | "all">("all");
  const [previewPreset, setPreviewPreset] = useState<AnimatedWallpaperPreset | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const filteredPresets = selectedCategory === "all"
    ? ANIMATED_WALLPAPERS
    : ANIMATED_WALLPAPERS.filter(w => w.category === selectedCategory);

  const handleApply = useCallback((preset: AnimatedWallpaperPreset) => {
    setAnimatedWallpaper(preset.id);
    toast.success(`Applied "${preset.name}" wallpaper`);
    setShowPreview(false);
    setPreviewPreset(null);
  }, [setAnimatedWallpaper]);

  const handleRemove = useCallback(() => {
    if (!previewPreset) return;
    setAnimatedWallpaper(null);
    toast.success(`Removed "${previewPreset.name}" wallpaper`);
    setShowPreview(false);
    setPreviewPreset(null);
  }, [setAnimatedWallpaper, previewPreset]);

  const openPreview = (preset: AnimatedWallpaperPreset) => {
    setPreviewPreset(preset);
    setShowPreview(true);
  };

  const closePreview = () => {
    setShowPreview(false);
    setPreviewPreset(null);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground mb-1">Animated Wallpapers</h2>
        <p className="text-sm text-muted-foreground">
          Choose a 3D animated wallpaper to apply as your background. Each preset uses CSS-only animations and WebGL-free shapes.
        </p>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={cn(
              "whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 border",
              selectedCategory === cat
                ? "bg-primary/20 border-primary/40 text-primary shadow-glow-sm"
                : "bg-white/[0.03] border-border/30 text-muted-foreground hover:border-border/60 hover:text-foreground"
            )}
          >
            {cat === "all" ? "All" : cat}
            <span className="ml-1.5 text-xs opacity-60">
              {cat === "all" ? ANIMATED_WALLPAPERS.length : ANIMATED_WALLPAPERS.filter(w => w.category === cat).length}
            </span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredPresets.map(preset => {
          const isActive = animatedWallpaper === preset.id;
          return (
            <Card
              key={preset.id}
              onClick={() => openPreview(preset)}
              className={cn(
                "relative cursor-pointer rounded-2xl border transition-all duration-200 overflow-hidden group",
                "hover:scale-[1.01] active:scale-[0.99]",
                "glass-card border-border/30 hover:border-primary/30",
                isActive && "border-primary/50 shadow-glow-sm"
              )}
            >
              <div className="p-3">
                <div className="rounded-xl overflow-hidden bg-black/40 mb-3 relative">
                  <PresetPreview preset={preset} />
                  {isActive && (
                    <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-primary flex items-center justify-center shadow-lg z-10">
                      <Check className="h-3.5 w-3.5 text-primary-foreground" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                    <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                      <Play className="h-5 w-5 text-white ml-0.5" />
                    </div>
                  </div>
                </div>
                <h3 className="text-sm font-semibold text-foreground truncate">{preset.name}</h3>
                <span className="text-xs text-muted-foreground">{preset.category}</span>
              </div>
            </Card>
          );
        })}
      </div>

      {filteredPresets.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-sm">No wallpapers found in this category.</p>
        </div>
      )}

      {showPreview && previewPreset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={closePreview} />
          <div className="relative w-full h-full max-w-6xl mx-auto flex flex-col">
            <div className="absolute top-4 right-4 z-10 flex gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={closePreview}
                className="rounded-full bg-white/10 hover:bg-white/20 text-white backdrop-blur-sm"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            <div className="flex-1 relative rounded-2xl overflow-hidden mx-4 my-4">
              <AnimatedWallpaperRenderer preset={previewPreset} />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />

              <div className="absolute bottom-0 left-0 right-0 p-6 flex items-end justify-between">
                <div>
                  <h3 className="text-2xl font-bold text-white mb-1">{previewPreset.name}</h3>
                  <span className="text-sm text-white/60">{previewPreset.category}</span>
                </div>
                <div className="flex gap-3">
                  {animatedWallpaper === previewPreset.id && (
                    <Button
                      variant="destructive"
                      onClick={handleRemove}
                      className="rounded-xl bg-white/10 hover:bg-white/20 text-white border-white/20 backdrop-blur-sm"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Remove
                    </Button>
                  )}
                  <Button
                    onClick={() => handleApply(previewPreset)}
                    className="rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg backdrop-blur-sm"
                  >
                    <Play className="h-4 w-4 mr-2" />
                    Apply Wallpaper
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

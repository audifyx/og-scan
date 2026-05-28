import { useState, useMemo } from "react";
import { useTheme, type ThemePreset } from "@/hooks/useTheme";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Wand2, Save, Trash2, Shuffle } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const GRADIENT_PRESETS = [
  { id: "none",  label: "None",   fn: () => undefined as string | undefined },
  { id: "spot",  label: "Spot",   fn: (p: string, a: string) =>
    `radial-gradient(ellipse at 30% 40%, ${hslToRgba(p, 0.22)} 0%, transparent 55%), radial-gradient(ellipse at 75% 80%, ${hslToRgba(a, 0.14)} 0%, transparent 50%)` },
  { id: "lin",   label: "Linear", fn: (p: string, a: string) =>
    `linear-gradient(135deg, ${hslToRgba(p, 0.18)} 0%, ${hslToRgba(a, 0.1)} 100%)` },
  { id: "trio",  label: "Trio",   fn: (p: string, a: string) =>
    `radial-gradient(ellipse at 15% 20%, ${hslToRgba(p, 0.2)} 0%, transparent 45%), radial-gradient(ellipse at 85% 30%, ${hslToRgba(a, 0.18)} 0%, transparent 45%), radial-gradient(ellipse at 50% 95%, ${hslToRgba(p, 0.12)} 0%, transparent 55%)` },
];

function hslToRgba(hsl: string, alpha: number): string {
  // hsl format: "H S% L%"
  const m = hsl.match(/(\d+)\s+(\d+)%\s+(\d+)%/);
  if (!m) return `rgba(255,255,255,${alpha})`;
  let h = +m[1] / 360, s = +m[2] / 100, l = +m[3] / 100;
  const k = (n: number) => (n + h * 12) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))));
  return `rgba(${f(0)},${f(8)},${f(4)},${alpha})`;
}

function buildVars(hue: number, sat: number, accentOffset: number) {
  const h = hue;
  const ha = (hue + accentOffset + 360) % 360;
  const subSat = Math.min(15, sat / 6);
  const fg = `${h} 8% 92%`;
  const bg = `${h} ${subSat}% 4%`;
  const card = `${h} ${subSat}% 7%`;
  const muted = `${h} ${subSat}% 9%`;
  const border = `${h} ${subSat}% 14%`;
  const primary = `${h} ${sat}% 55%`;
  const accent = `${ha} ${Math.max(50, sat - 20)}% 40%`;
  return {
    "--background": bg,
    "--foreground": fg,
    "--card": card,
    "--card-foreground": fg,
    "--primary": primary,
    "--primary-foreground": "0 0% 100%",
    "--accent": accent,
    "--accent-foreground": "0 0% 100%",
    "--secondary": `${h} ${Math.min(20, sat/4)}% 14%`,
    "--secondary-foreground": fg,
    "--muted": muted,
    "--muted-foreground": `${h} 8% 50%`,
    "--border": border,
    "--input": border,
    "--ring": primary,
    "--popover": card,
    "--popover-foreground": fg,
  } as Record<string, string>;
}

export const CustomThemeCreator = () => {
  const { customThemes, saveCustomTheme, deleteCustomTheme, setTheme, currentTheme } = useTheme();
  const [name, setName] = useState("My Theme");
  const [hue, setHue] = useState(280);
  const [sat, setSat] = useState(70);
  const [accentOffset, setAccentOffset] = useState(40);
  const [gradient, setGradient] = useState<string>("spot");

  const vars = useMemo(() => buildVars(hue, sat, accentOffset), [hue, sat, accentOffset]);
  const gradientStr = useMemo(() => {
    const g = GRADIENT_PRESETS.find(p => p.id === gradient);
    return g?.fn(vars["--primary"], vars["--accent"]);
  }, [gradient, vars]);

  const preview = useMemo<ThemePreset>(() => ({
    id: `custom-preview`,
    name,
    category: "My Themes",
    vars,
    gradient: gradientStr,
  }), [name, vars, gradientStr]);

  const handleRandom = () => {
    setName(`Theme ${Math.floor(Math.random()*9999)}`);
    setHue(Math.floor(Math.random() * 360));
    setSat(40 + Math.floor(Math.random() * 60));
    setAccentOffset(-180 + Math.floor(Math.random() * 360));
    setGradient(GRADIENT_PRESETS[Math.floor(Math.random()*GRADIENT_PRESETS.length)].id);
  };

  const handleSave = () => {
    const id = `custom-${Date.now()}`;
    const theme: ThemePreset = { id, name: name.trim() || `My Theme`, category: "My Themes", vars, gradient: gradientStr };
    saveCustomTheme(theme);
    setTheme(id);
    toast({ title: "Theme saved!", description: name });
  };

  return (
    <Card className="p-5 glass-card-premium border-primary/10">
      <h3 className="font-semibold mb-1 flex items-center gap-2 text-foreground">
        <Wand2 className="h-5 w-5 text-primary" />
        Custom Theme Creator
      </h3>
      <p className="text-xs text-muted-foreground mb-4">Design your own — saved locally and accessible from "My Themes" below.</p>

      {/* Live preview */}
      <div
        className="relative rounded-2xl p-4 mb-4 border border-white/10 overflow-hidden h-28"
        style={{
          background: gradientStr
            ? `${gradientStr}, hsl(${vars["--background"]})`
            : `hsl(${vars["--background"]})`,
        }}
      >
        <div className="flex gap-2">
          <div className="w-8 h-8 rounded-full border border-white/15" style={{ background: `hsl(${vars["--primary"]})` }} />
          <div className="w-8 h-8 rounded-full border border-white/15" style={{ background: `hsl(${vars["--accent"]})` }} />
          <div className="w-8 h-8 rounded-full border border-white/15" style={{ background: `hsl(${vars["--secondary"]})` }} />
        </div>
        <div className="absolute bottom-3 left-4 text-sm font-semibold" style={{ color: `hsl(${vars["--foreground"]})` }}>
          {name || "Preview"}
        </div>
        <div
          className="absolute bottom-3 right-4 text-xs px-2 py-1 rounded-full font-medium"
          style={{ background: `hsl(${vars["--primary"]})`, color: `hsl(${vars["--primary-foreground"]})` }}
        >
          button
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <Label className="text-xs">Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={32} className="mt-1" />
        </div>

        <div>
          <div className="flex justify-between mb-1">
            <Label className="text-xs">Hue</Label>
            <span className="text-xs text-muted-foreground font-mono">{hue}°</span>
          </div>
          <Slider value={[hue]} onValueChange={([v]) => setHue(v)} min={0} max={360} step={1} />
          <div className="mt-1 h-2 rounded-full"
            style={{ background: "linear-gradient(to right, hsl(0,80%,55%), hsl(60,80%,55%), hsl(120,80%,55%), hsl(180,80%,55%), hsl(240,80%,55%), hsl(300,80%,55%), hsl(360,80%,55%))" }}/>
        </div>

        <div>
          <div className="flex justify-between mb-1">
            <Label className="text-xs">Saturation</Label>
            <span className="text-xs text-muted-foreground font-mono">{sat}%</span>
          </div>
          <Slider value={[sat]} onValueChange={([v]) => setSat(v)} min={0} max={100} step={1} />
        </div>

        <div>
          <div className="flex justify-between mb-1">
            <Label className="text-xs">Accent Shift</Label>
            <span className="text-xs text-muted-foreground font-mono">{accentOffset > 0 ? "+" : ""}{accentOffset}°</span>
          </div>
          <Slider value={[accentOffset]} onValueChange={([v]) => setAccentOffset(v)} min={-180} max={180} step={5} />
        </div>

        <div>
          <Label className="text-xs">Gradient Background</Label>
          <div className="flex gap-2 mt-2 flex-wrap">
            {GRADIENT_PRESETS.map(g => (
              <button key={g.id}
                onClick={() => setGradient(g.id)}
                className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${
                  gradient === g.id ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border/40 hover:border-border"
                }`}>
                {g.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <Button onClick={handleSave} className="flex-1 rounded-xl">
            <Save className="h-4 w-4 mr-2" /> Save & Apply
          </Button>
          <Button variant="outline" onClick={handleRandom} className="rounded-xl" title="Randomize">
            <Shuffle className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* My saved themes */}
      {customThemes.length > 0 && (
        <div className="mt-6 pt-5 border-t border-border/30">
          <h4 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wider">My Themes ({customThemes.length})</h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {customThemes.map(t => {
              const isActive = currentTheme === t.id;
              return (
                <div key={t.id} className={`relative rounded-xl p-3 border-2 ${isActive ? "border-primary" : "border-border/30"}`}
                  style={{ background: `hsl(${t.vars["--background"]})` }}>
                  <button onClick={() => setTheme(t.id)} className="block w-full text-left">
                    <div className="flex gap-1 mb-1">
                      <div className="w-5 h-5 rounded-full border border-white/10" style={{ background: `hsl(${t.vars["--primary"]})` }} />
                      <div className="w-5 h-5 rounded-full border border-white/10" style={{ background: `hsl(${t.vars["--accent"]})` }} />
                    </div>
                    <span className="text-xs" style={{ color: `hsl(${t.vars["--foreground"]})` }}>{t.name}</span>
                  </button>
                  <button onClick={() => deleteCustomTheme(t.id)}
                    className="absolute top-1 right-1 p-1 rounded-full hover:bg-destructive/20"
                    title="Delete">
                    <Trash2 className="h-3 w-3" style={{ color: `hsl(${t.vars["--foreground"]})` }} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </Card>
  );
};

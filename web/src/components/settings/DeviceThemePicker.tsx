import { useDeviceTheme } from "@/themes/DeviceThemeProvider";
import { DEVICE_THEMES } from "@/themes/themes";
import { Card } from "@/components/ui/card";
import { Check, MonitorSmartphone } from "lucide-react";
import { cn } from "@/lib/utils";

export const DeviceThemePicker = () => {
  const { deviceTheme, setDeviceTheme } = useDeviceTheme();

  return (
    <div className="mb-8">
      <Card className="p-5 glass-card-premium border-primary/10">
        <h3 className="font-semibold mb-1 flex items-center gap-2 text-foreground">
          <MonitorSmartphone className="h-5 w-5 text-primary" />
          Device Themes
        </h3>
        <p className="text-xs text-muted-foreground mb-4">
          Re-skin the entire platform — Xbox 360 blades, PS4 XMB, Wii channels and more.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {DEVICE_THEMES.map((theme) => {
            const isActive = deviceTheme.id === theme.id;
            return (
              <button
                key={theme.id}
                title={theme.blurb}
                onClick={() => setDeviceTheme(theme.id)}
                className={cn(
                  "relative rounded-2xl p-3 border-2 transition-all duration-200 text-left",
                  "hover:scale-[1.02] active:scale-[0.98]",
                  isActive ? "border-primary shadow-glow-sm" : "border-border/30 hover:border-border/60"
                )}
                style={{ background: `linear-gradient(135deg, ${theme.preview.from}, ${theme.preview.to})` }}
              >
                <div className="text-2xl mb-2 leading-none">{theme.preview.glyph}</div>
                <div className="text-xs font-semibold text-white leading-tight">{theme.name}</div>
                <div className="text-[10px] text-white/60 leading-tight mt-0.5">{theme.tagline}</div>
                {isActive && (
                  <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-white flex items-center justify-center">
                    <Check className="h-3 w-3 text-black" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </Card>
    </div>
  );
};

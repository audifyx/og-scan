import { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Rocket, Zap, TrendingUp, Shield, Sparkles, Star, BarChart3, 
  Wallet, Bell, Users, Palette, CheckCircle2, Upload, Brain
} from "lucide-react";

const ALL_FEATURES = [
  { icon: Palette, title: "40 Custom Themes", desc: "Glass, Neon, Luxury, Dark Elite — with custom wallpaper uploads" },
  { icon: Zap, title: "Live Wallet Tracking", desc: "Real-time updates every 10s with full transaction history" },
  { icon: BarChart3, title: "Enhanced Charts", desc: "Better token charts with custom trading pairs" },
  { icon: Shield, title: "Rug Checker 2.0", desc: "Deep security analysis with holder breakdown and AI insights" },
  { icon: Bell, title: "Smart Alerts", desc: "Price alerts with Discord webhook integration" },
  { icon: Users, title: "Callout Channel", desc: "Public token & wallet callouts with AI analysis" },
  { icon: Wallet, title: "Portfolio Compare", desc: "Compare up to 5 wallets side by side" },
  { icon: Brain, title: "AI Analysis V2", desc: "Enhanced AI-powered token and wallet analysis" },
  { icon: Upload, title: "Custom Wallpapers", desc: "Upload your own background images" },
  { icon: Rocket, title: "Launchpad Redesign", desc: "iOS App Store-style project listings" },
];

export const V3AnnouncementModal = () => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const seen = sessionStorage.getItem("sol-tools-v5-update-2");
    if (!seen) setOpen(true);
  }, []);

  const handleClose = () => {
    sessionStorage.setItem("sol-tools-v5-update-2", "true");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[85vh] p-0 border-primary/20 glass-card-premium rounded-3xl overflow-hidden">
        {/* Header */}
        <div className="relative p-6 pb-4">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-accent/5" />
          <div className="relative flex items-center gap-4">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-primary to-accent blur-xl opacity-50" />
              <div className="relative p-3.5 rounded-2xl bg-gradient-to-br from-primary to-accent shadow-lg shadow-primary/30 btn-3d">
                <Rocket className="h-7 w-7 text-primary-foreground" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold gradient-text font-display">Sol Tools V5</h2>
                <Badge className="bg-accent/20 text-accent border-accent/30 text-[10px]">NEW</Badge>
              </div>
              <p className="text-sm text-muted-foreground">Major Platform Upgrade</p>
            </div>
          </div>
        </div>

        {/* Features */}
        <ScrollArea className="max-h-[50vh] px-6 pb-2">
          <div className="space-y-2">
            {ALL_FEATURES.map((f, i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-2xl bg-white/[0.03] border border-border/30 hover:border-primary/20 transition-colors animate-fade-in" style={{ animationDelay: `${i * 40}ms` }}>
                <div className="p-2 rounded-xl bg-primary/10 shrink-0">
                  <f.icon className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-sm">{f.title}</p>
                    <CheckCircle2 className="h-3.5 w-3.5 text-accent shrink-0" />
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="p-5 border-t border-border/30">
          <Button onClick={handleClose} className="w-full h-12 btn-3d bg-gradient-to-r from-primary to-accent text-primary-foreground rounded-2xl gap-2 font-semibold">
            <Sparkles className="h-4 w-4" /> Let's Go!
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default V3AnnouncementModal;

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { 
  Sparkles, Zap, Palette, Wallet, LineChart, MessageSquare, 
  Bell, Shield, Users, Rocket, Star, CheckCircle2 
} from "lucide-react";

interface V2WelcomeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const v2Updates = [
  {
    icon: Palette,
    title: "Complete UI Redesign",
    description: "New premium dark theme with gold, blue, and green accents",
  },
  {
    icon: Sparkles,
    title: "iOS 26 Glass Tab Bar",
    description: "Modern floating navigation with glass morphism effects",
  },
  {
    icon: LineChart,
    title: "Trade History Analysis",
    description: "Detailed P&L tracking for every token trade",
  },
  {
    icon: Users,
    title: "Portfolio Comparison",
    description: "Compare multiple wallets side by side",
  },
  {
    icon: Bell,
    title: "Real-Time Price Alerts",
    description: "Get notified when token prices change significantly",
  },
  {
    icon: Wallet,
    title: "Enhanced Token Tracker",
    description: "Tokens save permanently to your account with auto-sync",
  },
  {
    icon: MessageSquare,
    title: "Redesigned Alpha Chat",
    description: "See online users, typing indicators, and better message format",
  },
  {
    icon: Rocket,
    title: "Live Feed Improvements",
    description: "Track launch platforms (Pump.fun, Jupiter, etc.) with filters",
  },
  {
    icon: Shield,
    title: "All Tools Working",
    description: "50+ advanced tools fully functional with real data",
  },
  {
    icon: Star,
    title: "Premium Features Fixed",
    description: "Solana GPT, AI Analyzer, Whale Tracker all operational",
  },
];

export const V2WelcomeModal = ({ open, onOpenChange }: V2WelcomeModalProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-0 overflow-hidden border-primary/20 bg-card/95 backdrop-blur-2xl">
        {/* Header with gradient */}
        <div className="relative p-6 pb-4 bg-gradient-to-br from-primary/20 via-secondary/10 to-accent/10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,hsl(45_100%_55%/0.15),transparent_50%)]" />
          <div className="relative flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-primary to-primary/80 shadow-lg shadow-primary/30">
              <Zap className="h-8 w-8 text-primary-foreground" />
            </div>
            <div>
              <DialogTitle className="text-2xl font-bold">
                Welcome to <span className="gradient-text">V2</span>
              </DialogTitle>
              <DialogDescription className="text-muted-foreground mt-1">
                SolanaHub just got a major upgrade!
              </DialogDescription>
            </div>
          </div>
          <Badge className="mt-4 bg-primary/20 text-primary border-primary/30">
            Version 2.0 • January 2026
          </Badge>
        </div>

        {/* Updates List */}
        <ScrollArea className="max-h-[400px] p-6 pt-4">
          <div className="space-y-3">
            {v2Updates.map((update, index) => (
              <div
                key={update.title}
                className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.04] border border-white/[0.07] hover:border-primary/30 transition-colors animate-fade-in"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                  <update.icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-sm">{update.title}</p>
                    <CheckCircle2 className="h-3.5 w-3.5 text-accent" />
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {update.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="p-6 pt-4 border-t border-white/[0.07] bg-white/[0.03]">
          <Button 
            onClick={() => onOpenChange(false)} 
            className="w-full h-12 text-base font-semibold bg-gradient-to-r from-primary via-primary to-secondary text-primary-foreground rounded-xl shadow-lg shadow-primary/30 hover:shadow-primary/50 transition-shadow"
          >
            <Sparkles className="h-5 w-5 mr-2" />
            Let's Go!
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

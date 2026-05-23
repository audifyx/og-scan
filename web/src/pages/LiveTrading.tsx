import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import {
  Wallet, ArrowLeftRight, Copy, Users, Zap, Bell, Sparkles,
  TrendingUp, Shield, Rocket, Clock, Play, Eye, ChevronRight,
  Mail, CheckCircle, Star
} from "lucide-react";

const UPCOMING_FEATURES = [
  { icon: Wallet, title: "Wallet Creation", desc: "Create secure Solana wallets directly in-app", status: "In Development", progress: 45 },
  { icon: ArrowLeftRight, title: "Live Buy & Sell", desc: "Trade any Solana token pair directly from Sol Tools", status: "Planned", progress: 15 },
  { icon: Copy, title: "Copy Trading", desc: "Auto-mirror top traders' moves in real-time", status: "Planned", progress: 10 },
  { icon: Users, title: "Lobby Trading", desc: "Trade together with friends in voice lobbies", status: "Planned", progress: 20 },
  { icon: Shield, title: "Phantom Export", desc: "Export wallet for use with Phantom and other wallets", status: "Planned", progress: 5 },
  { icon: TrendingUp, title: "Advanced Orders", desc: "Limit orders, stop loss, and take profit automation", status: "Planned", progress: 8 },
];

const PREVIEW_MOCKUPS = [
  { title: "Swap Interface", desc: "Quick token swaps with best route finding", icon: ArrowLeftRight },
  { title: "Portfolio View", desc: "Track all positions in real-time", icon: Eye },
  { title: "Order Book", desc: "See live buy/sell pressure", icon: TrendingUp },
  { title: "Trade History", desc: "Complete record of all trades", icon: Clock },
];

const LiveTrading = () => {
  const { user } = useAuth();
  const [email, setEmail] = useState("");
  const [joined, setJoined] = useState(false);

  const joinWaitlist = async () => {
    if (!email.trim() && !user) return;
    try {
      const notifEmail = email.trim() || user?.email || "";
      if (user) {
        await supabase.from("notifications").insert({
          user_id: user.id,
          title: "Live Trading Waitlist",
          message: `You've been added to the Live Trading early access waitlist! We'll notify you at ${notifEmail} when it launches.`,
          type: "system",
        });
      }
      setJoined(true);
      toast.success("You're on the waitlist! We'll notify you when Live Trading launches.");
    } catch {
      toast.error("Failed to join waitlist");
    }
  };

  return (
    <AppLayout>
      <PageHeader title="Live Trading" description="Coming Soon — Trade directly on Sol Tools">
        <Badge className="bg-accent/20 text-accent border-accent/30 gap-1.5">
          <Clock className="h-3.5 w-3.5" /> Coming Soon
        </Badge>
      </PageHeader>

      <ScrollArea className="h-[calc(100vh-120px)]">
        <div className="p-4 lg:p-6 space-y-6 max-w-4xl mx-auto">
          {/* Hero Banner */}
          <Card className="glass-card-premium overflow-hidden relative">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-accent/5 to-transparent" />
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
            <CardContent className="relative p-8 text-center">
              <div className="relative inline-flex mb-6">
                <div className="absolute inset-0 bg-primary/30 blur-3xl opacity-50" />
                <div className="relative p-6 rounded-3xl bg-gradient-to-br from-primary to-accent shadow-2xl">
                  <Rocket className="h-12 w-12 text-primary-foreground" />
                </div>
              </div>
              <h2 className="text-3xl font-black font-display gradient-text mb-3">Live Trading</h2>
              <p className="text-muted-foreground max-w-md mx-auto leading-relaxed">
                Full trading capabilities are coming to Sol Tools. Buy, sell, copy trade, and manage your portfolio — all from one platform.
              </p>

              {/* Waitlist */}
              <div className="mt-6 max-w-sm mx-auto">
                {joined ? (
                  <div className="flex items-center justify-center gap-2 p-4 rounded-xl bg-green-500/10 border border-green-500/30 text-green-400">
                    <CheckCircle className="h-5 w-5" />
                    <span className="text-sm font-semibold">You're on the waitlist!</span>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Input
                      placeholder={user ? user.email || "Your email" : "Enter your email"}
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      className="rounded-xl"
                    />
                    <Button onClick={joinWaitlist} className="rounded-xl gap-1.5 shrink-0">
                      <Bell className="h-4 w-4" /> Join Waitlist
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Feature Cards with Progress */}
          <div>
            <h3 className="text-lg font-bold font-display mb-4 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" /> Planned Features
            </h3>
            <div className="grid sm:grid-cols-2 gap-4">
              {UPCOMING_FEATURES.map((f, i) => (
                <Card key={i} className="glass-card hover:border-primary/20 transition-colors group">
                  <CardContent className="p-5">
                    <div className="flex items-start gap-4">
                      <div className="p-3 rounded-xl bg-gradient-to-br from-primary/20 to-accent/10 shrink-0 group-hover:scale-110 transition-transform">
                        <f.icon className="h-6 w-6 text-primary" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-bold text-sm">{f.title}</h3>
                          <Badge variant="outline" className="text-[9px]">{f.status}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed mb-3">{f.desc}</p>
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[10px]">
                            <span className="text-muted-foreground">Progress</span>
                            <span className="text-primary font-mono">{f.progress}%</span>
                          </div>
                          <Progress value={f.progress} className="h-1.5" />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Preview Mockups */}
          <div>
            <h3 className="text-lg font-bold font-display mb-4 flex items-center gap-2">
              <Eye className="h-5 w-5 text-primary" /> Interface Preview
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {PREVIEW_MOCKUPS.map((m, i) => (
                <Card key={i} className="glass-card group hover:border-primary/20 transition-colors">
                  <CardContent className="p-5 text-center">
                    <div className="p-4 rounded-2xl bg-muted/20 border border-border/20 mb-3 group-hover:border-primary/20 transition-colors">
                      <m.icon className="h-10 w-10 text-muted-foreground/30 mx-auto group-hover:text-primary/40 transition-colors" />
                    </div>
                    <h4 className="font-bold text-xs mb-0.5">{m.title}</h4>
                    <p className="text-[10px] text-muted-foreground">{m.desc}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Demo Section */}
          <Card className="glass-card">
            <CardContent className="p-8 text-center">
              <Play className="h-12 w-12 text-primary/30 mx-auto mb-4" />
              <h3 className="font-bold text-lg mb-2">Demo Walkthrough</h3>
              <p className="text-sm text-muted-foreground mb-4">A full video walkthrough will be available before launch.</p>
              <Button variant="outline" className="rounded-xl gap-1.5" disabled>
                <Play className="h-4 w-4" /> Watch Demo (Coming Soon)
              </Button>
            </CardContent>
          </Card>
        </div>
      </ScrollArea>
    </AppLayout>
  );
};

export default LiveTrading;

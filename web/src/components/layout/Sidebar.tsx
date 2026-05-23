import { Wallet, Coins, LineChart, Wrench, Zap, Sparkles, LogOut, Bell, Radio, Users, User, Rocket, ChevronRight, MessageSquare, Webhook, Settings, Crown, Shield, Headphones, Globe2, ArrowLeftRight } from "lucide-react";
import { NavLink, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { CreditBalance } from "@/components/credits/CreditBalance";

const mainNavItems = [
  { to: "/wallets", icon: Wallet, label: "Wallets", description: "Track wallets" },
  { to: "/tokens", icon: Coins, label: "Tokens", description: "Monitor coins" },
  { to: "/charts", icon: LineChart, label: "Charts", description: "Live charts" },
  { to: "/tools", icon: Wrench, label: "Tools", description: "Analysis suite" },
  { to: "/advanced-tools", icon: Rocket, label: "Advanced", description: "30+ pro tools" },
  { to: "/official-token", icon: Zap, label: "Official Token", description: "$SOLTOOLS" },
  { to: "/lobbies", icon: Headphones, label: "Trading Lobbies", description: "Voice + charts" },
  { to: "/communities", icon: Globe2, label: "Communities", description: "Social hub" },
  { to: "/pump-v5", icon: Sparkles, label: "Launch Pad", description: "Token listings" },
  { to: "/live-trading", icon: ArrowLeftRight, label: "Live Trading", description: "Coming soon" },
];

const socialNavItems = [
  { to: "/alpha-chat", icon: MessageSquare, label: "Alpha Chat" },
  { to: "/live-feed", icon: Radio, label: "Live Feed" },
  { to: "/discover", icon: Users, label: "Discover" },
  { to: "/callouts", icon: Bell, label: "Callouts" },
  { to: "/support", icon: Headphones, label: "Support" },
  { to: "/credits", icon: Coins, label: "Credits" },
  { to: "/settings", icon: Settings, label: "Settings" },
];

export const Sidebar = () => {
  const { user, profile, signOut } = useAuth();
  const { isAdmin, isOwner } = useAdmin();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <aside className="hidden lg:flex flex-col w-[280px] border-r border-border/60 bg-gradient-to-b from-card via-background to-card relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
      <div className="absolute top-0 right-0 bottom-0 w-px bg-gradient-to-b from-primary/20 via-transparent to-primary/10" />
      
      <div className="relative p-6 border-b border-border/40">
        <NavLink to="/wallets" className="flex items-center gap-3.5 group">
          <div className="relative">
            <div className="absolute inset-0 bg-primary/30 blur-xl opacity-60 group-hover:opacity-80 transition-opacity" />
            <div className="relative w-11 h-11 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg border border-primary/30">
              <Zap className="h-5.5 w-5.5 text-primary-foreground" />
            </div>
          </div>
          <div>
            <h1 className="font-bold text-lg tracking-wide font-display gradient-text">SOL TOOLS</h1>
            <p className="text-[10px] text-muted-foreground font-mono tracking-wider">PRO TRADING SUITE</p>
          </div>
        </NavLink>
      </div>

      <ScrollArea className="flex-1 py-4">
        <div className="px-3 space-y-0.5">
          <p className="px-4 py-2 text-[10px] font-semibold text-primary/50 uppercase tracking-[0.2em] font-mono">Main</p>
          {mainNavItems.map(({ to, icon: Icon, label, description }) => (
            <NavLink key={to} to={to} className={({ isActive }) => cn(
              "flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-200 group relative",
              isActive ? "bg-primary/8 text-primary border border-primary/15" : "text-muted-foreground hover:text-foreground hover:bg-muted/30 border border-transparent"
            )}>
              {({ isActive }) => (
                <>
                  {isActive && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-gradient-to-b from-primary to-accent rounded-r-full" />}
                  <div className={cn("p-1.5 rounded-lg transition-colors", isActive ? "bg-primary/15" : "bg-muted/20 group-hover:bg-muted/40")}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1">
                    <span className="font-medium text-[13px]">{label}</span>
                    <p className="text-[9px] text-muted-foreground/60">{description}</p>
                  </div>
                  <ChevronRight className={cn("h-3.5 w-3.5 transition-opacity", isActive ? "opacity-80 text-primary" : "opacity-0 group-hover:opacity-30")} />
                </>
              )}
            </NavLink>
          ))}
        </div>

        <div className="px-3 mt-4 space-y-1">
          <p className="px-4 py-2 text-[10px] font-semibold text-muted-foreground/40 uppercase tracking-[0.2em] font-mono">Community</p>
          <div className="grid grid-cols-2 gap-1.5 px-1">
            {socialNavItems.map(({ to, icon: Icon, label }) => (
              <NavLink key={to} to={to} className={({ isActive }) => cn(
                "flex flex-col items-center gap-1.5 p-3 rounded-lg transition-all duration-200 group",
                isActive ? "bg-primary/8 text-primary border border-primary/15" : "bg-muted/15 hover:bg-muted/30 text-muted-foreground hover:text-foreground border border-border/20 hover:border-border/40"
              )}>
                <Icon className="h-4 w-4" />
                <span className="text-[9px] font-medium tracking-wide">{label}</span>
              </NavLink>
            ))}
            {isOwner && (
              <NavLink to="/webhooks" className={({ isActive }) => cn(
                "flex flex-col items-center gap-1.5 p-3 rounded-lg transition-all duration-200 group",
                isActive ? "bg-primary/8 text-primary border border-primary/15" : "bg-muted/15 hover:bg-muted/30 text-muted-foreground hover:text-foreground border border-border/20 hover:border-border/40"
              )}>
                <Webhook className="h-4 w-4" />
                <span className="text-[9px] font-medium tracking-wide">Webhooks</span>
              </NavLink>
            )}
          </div>
        </div>

        <div className="px-4 mt-4 space-y-2">
          <NavLink to="/premium" className={({ isActive }) => cn(
            "flex items-center gap-3 p-3 rounded-xl transition-all duration-200 group relative overflow-hidden",
            isActive ? "bg-primary/10 border border-primary/20" : "bg-primary/5 border border-primary/10 hover:bg-primary/8"
          )}>
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-primary/30 via-accent/20 to-transparent" />
            <div className="p-2 rounded-lg bg-gradient-to-br from-primary to-accent"><Crown className="h-4 w-4 text-primary-foreground" /></div>
            <div className="flex-1">
              <span className="font-semibold text-xs gradient-text font-display">PRO FEATURES</span>
              <p className="text-[9px] text-muted-foreground">AI, Alerts, P&L</p>
            </div>
            <Sparkles className="h-3.5 w-3.5 text-primary animate-pulse" />
          </NavLink>

          {isAdmin && (
            <NavLink to="/admin" className={({ isActive }) => cn(
              "flex items-center gap-3 p-3 rounded-lg transition-all duration-200",
              isActive ? "bg-destructive/10 border border-destructive/20 text-destructive" : "bg-muted/15 border border-border/20 hover:bg-muted/30 text-muted-foreground hover:text-foreground"
            )}>
              <Shield className="h-4 w-4" />
              <span className="font-medium text-xs">Admin Panel</span>
            </NavLink>
          )}

          {/* Legal Links */}
          <div className="flex gap-2 px-1 pt-2">
            <NavLink to="/privacy" className="text-[9px] text-muted-foreground/40 hover:text-muted-foreground">Privacy</NavLink>
            <span className="text-[9px] text-muted-foreground/20">•</span>
            <NavLink to="/terms" className="text-[9px] text-muted-foreground/40 hover:text-muted-foreground">Terms</NavLink>
          </div>
        </div>
      </ScrollArea>

      <div className="relative p-4 border-t border-border/40 bg-gradient-to-t from-card/50 to-transparent">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
        {user ? (
          <div className="space-y-2.5">
            <CreditBalance compact className="mb-2" />
            <div className="flex items-center gap-3 p-2.5 rounded-lg cursor-pointer bg-muted/15 hover:bg-muted/30 border border-border/20 hover:border-primary/15 transition-all group" onClick={() => navigate("/profile")}>
              <div className="relative w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center text-primary-foreground font-bold text-xs">
                {profile?.username?.charAt(0).toUpperCase() || user.email?.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-xs truncate">{profile?.username || "User"}</p>
                <p className="text-[9px] text-muted-foreground/50 truncate">{user.email}</p>
              </div>
              <User className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
            <Button variant="ghost" size="sm" onClick={handleSignOut} className="w-full justify-start gap-2 text-muted-foreground hover:text-destructive hover:bg-destructive/8 rounded-lg text-xs">
              <LogOut className="h-3.5 w-3.5" /> Sign Out
            </Button>
          </div>
        ) : (
          <Button onClick={() => navigate("/auth")} className="w-full bg-gradient-to-r from-primary to-accent hover:opacity-90 text-primary-foreground font-semibold rounded-lg h-10 shadow-lg shadow-primary/20 text-sm">Sign In</Button>
        )}
      </div>
    </aside>
  );
};

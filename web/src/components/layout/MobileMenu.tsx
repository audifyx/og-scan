import { 
  Wallet, Coins, LineChart, Wrench, Rocket, Radio, Users, Bell, 
  Sparkles, LogOut, Zap, User, ChevronRight, MessageSquare, Settings,
  Crown, Shield, Webhook, Headphones, Globe2, ArrowLeftRight
  Gamepad2,
} from "lucide-react";
import { NavLink, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SheetClose } from "@/components/ui/sheet";


const mainNavItems = [
  { to: "/wallets", icon: Wallet, label: "Phantom Trading Terminal" },
  { to: "/games",   icon: Gamepad2, label: "Games" },
  { to: "/tokens", icon: Coins, label: "Tokens" },
  // Charts hidden from UI (redundant with Phantom Trading Terminal)
  // { to: "/charts", icon: LineChart, label: "Charts" },
  { to: "/tools", icon: Wrench, label: "Tools" },

  { to: "/pump-v5", icon: Sparkles, label: "PUMP V6" },
  { to: "/official-token", icon: Zap, label: "$SOLTOOLS" },
  { to: "/lobbies", icon: Headphones, label: "Lobbies" },
  { to: "/communities", icon: Globe2, label: "Communities" },
  { to: "/live-trading", icon: ArrowLeftRight, label: "Trading" },
];

const socialNavItems = [
  { to: "/alpha-chat", icon: MessageSquare, label: "Chat" },
  { to: "/live-feed", icon: Radio, label: "Feed" },
  { to: "/discover", icon: Users, label: "Discover" },
  { to: "/callouts", icon: Bell, label: "Callouts" },
  { to: "/support", icon: Headphones, label: "Support" },

  { to: "/settings", icon: Settings, label: "Settings" },
];

export const MobileMenu = () => {
  const { user, profile, signOut } = useAuth();
  const { isAdmin, isOwner } = useAdmin();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <div className="flex flex-col h-full bg-background relative">
      <div className="absolute inset-0 codex-scanline pointer-events-none" />
      
      <div className="p-4 border-b border-primary/10 relative">
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-primary/40 via-transparent to-secondary/20" />
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center border border-primary/20">
            <Zap className="h-4 w-4 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-bold text-sm font-display tracking-[0.2em] gradient-text">SOLTOOLS</h1>
            <div className="flex items-center gap-1.5">
              <Badge className="bg-primary/10 text-primary border-primary/20 text-[8px] font-mono tracking-wider h-4 px-1.5">CODEX</Badge>
              <span className="text-[9px] text-muted-foreground/50 font-mono">v3.0</span>
            </div>
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1 py-3">
        <div className="px-3">
          <p className="px-2 py-1.5 text-[8px] font-bold text-primary/40 uppercase tracking-[0.3em] font-mono">▸ Navigation</p>
          <div className="space-y-0.5">
            {mainNavItems.map(({ to, icon: Icon, label }) => (
              <SheetClose asChild key={to}>
                <NavLink to={to} className={({ isActive }) => cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all active:scale-[0.98]",
                  isActive ? "bg-primary/10 text-primary border border-primary/15" : "text-foreground active:bg-muted/40 border border-transparent"
                )}>
                  {({ isActive }) => (
                    <>
                      {isActive && <div className="absolute left-0 w-0.5 h-5 bg-primary rounded-r-full" />}
                      <div className={cn("p-1.5 rounded-md transition-all", isActive ? "bg-primary/15" : "bg-white/[0.04]")}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <span className="font-semibold text-xs font-display tracking-wider">{label.toUpperCase()}</span>
                      <ChevronRight className={cn("h-3 w-3 ml-auto", isActive ? "text-primary" : "text-muted-foreground/30")} />
                    </>
                  )}
                </NavLink>
              </SheetClose>
            ))}
          </div>

          <p className="px-2 py-1.5 mt-4 text-[8px] font-bold text-secondary/40 uppercase tracking-[0.3em] font-mono">▸ Social</p>
          <div className="grid grid-cols-3 gap-1.5">
            {socialNavItems.map(({ to, icon: Icon, label }) => (
              <SheetClose asChild key={to}>
                <NavLink to={to} className={({ isActive }) => cn(
                  "flex flex-col items-center gap-1 py-2.5 rounded-lg transition-all active:scale-[0.95]",
                  isActive ? "bg-primary/10 text-primary border border-primary/15" : "bg-muted/15 text-muted-foreground active:bg-white/[0.04] border border-border/20"
                )}>
                  <Icon className="h-3.5 w-3.5" />
                  <span className="text-[8px] font-mono tracking-wider font-semibold">{label.toUpperCase()}</span>
                </NavLink>
              </SheetClose>
            ))}
          </div>

          <div className="mt-4 space-y-1.5">
            {isAdmin && (
              <SheetClose asChild>
                <NavLink to="/admin" className={({ isActive }) => cn(
                  "flex items-center gap-3 p-2.5 rounded-lg transition-all",
                  isActive ? "bg-destructive/10 border border-destructive/20 text-destructive" : "bg-muted/15 border border-border/20 text-muted-foreground active:bg-white/[0.04]"
                )}>
                  <Shield className="h-3.5 w-3.5" />
                  <span className="font-semibold text-[10px] font-display tracking-wider">ADMIN</span>
                </NavLink>
              </SheetClose>
            )}
          </div>
        </div>
      </ScrollArea>

      <div className="p-3 border-t border-primary/10 relative">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/25 to-transparent" />
        {user ? (
          <div className="space-y-2">

            <SheetClose asChild>
              <div className="flex items-center gap-2.5 p-2.5 rounded-lg cursor-pointer bg-muted/15 active:bg-white/[0.04] border border-border/20 transition-all" onClick={() => navigate("/profile")}>
                <div className="w-8 h-8 rounded-md bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-primary-foreground font-bold text-[10px] font-mono">
                  {profile?.username?.charAt(0).toUpperCase() || user.email?.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-xs truncate font-display tracking-wide">{profile?.username || "User"}</p>
                  <p className="text-[9px] text-muted-foreground/50 truncate font-mono">{user.email}</p>
                </div>
                <User className="h-3.5 w-3.5 text-muted-foreground/40" />
              </div>
            </SheetClose>
            <SheetClose asChild>
              <Button variant="ghost" size="sm" onClick={handleSignOut} className="w-full justify-start gap-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg h-9 text-[10px] font-mono tracking-wider">
                <LogOut className="h-3.5 w-3.5" /> SIGN OUT
              </Button>
            </SheetClose>
          </div>
        ) : (
          <SheetClose asChild>
            <Button onClick={() => navigate("/auth")} className="w-full bg-gradient-to-r from-primary to-secondary text-primary-foreground font-bold rounded-lg h-10 font-display tracking-wider text-xs">SIGN IN</Button>
          </SheetClose>
        )}
      </div>
    </div>
  );
};

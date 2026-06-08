import { Menu, Zap, User, Bell } from "lucide-react";
import { NavLink, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import { MobileMenu } from "./MobileMenu";

export const MobileHeader = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="lg:hidden fixed top-0 left-0 right-0 z-50">
      <div className="relative glass-nav">
        {/* Bottom accent line */}
        <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-primary/25 to-transparent" />

        <div className="flex items-center justify-between h-14 px-4">
          {/* Left: hamburger */}
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-muted-foreground hover:text-primary hover:bg-primary/10">
                <Menu className="h-[18px] w-[18px]" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[300px] p-0 border-white/[0.07] bg-card">
              <MobileMenu />
            </SheetContent>
          </Sheet>

          {/* Center: logo */}
          <NavLink to="/wallets" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary via-accent to-secondary flex items-center justify-center shadow-lg shadow-primary/20">
              <Zap className="h-3.5 w-3.5 text-primary-foreground" strokeWidth={2.5} />
            </div>
            <span className="font-display font-bold tracking-[0.2em] text-[11px] text-foreground">
              SOLTOOLS
            </span>
          </NavLink>

          {/* Right: actions */}
          <div className="flex items-center gap-0.5">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-xl text-muted-foreground hover:text-secondary hover:bg-secondary/10"
              onClick={() => navigate("/notifications")}
            >
              <Bell className="h-[18px] w-[18px]" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-xl"
              onClick={() => navigate(user ? "/profile" : "/auth")}
            >
              {user ? (
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-primary-foreground font-bold text-[11px] font-display shadow-sm">
                  {profile?.username?.charAt(0).toUpperCase() || user.email?.charAt(0).toUpperCase()}
                </div>
              ) : (
                <User className="h-[18px] w-[18px] text-muted-foreground" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
};

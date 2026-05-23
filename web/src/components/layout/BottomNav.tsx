import { useCallback, useRef, useEffect, useState } from "react";
import { Wallet, Coins, LineChart, Wrench, Headphones } from "lucide-react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/wallets", icon: Wallet, label: "Wallets" },
  { to: "/tokens", icon: Coins, label: "Tokens" },
  { to: "/charts", icon: LineChart, label: "Charts" },
  { to: "/tools", icon: Wrench, label: "Tools" },
  { to: "/support", icon: Headphones, label: "Support" },
];

const triggerHaptic = () => {
  if (navigator.vibrate) {
    navigator.vibrate(8);
  }
};

export const BottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const touchRef = useRef<{ startX: number; startY: number; startTime: number } | null>(null);
  const navRef = useRef<HTMLElement>(null);
  const [ripple, setRipple] = useState<{ x: number; y: number; key: number } | null>(null);

  const currentIndex = navItems.findIndex((item) => location.pathname.startsWith(item.to));

  const handleSwipe = useCallback(
    (direction: "left" | "right") => {
      const idx = currentIndex === -1 ? 0 : currentIndex;
      const nextIdx = direction === "left"
        ? Math.min(idx + 1, navItems.length - 1)
        : Math.max(idx - 1, 0);

      if (nextIdx !== idx) {
        triggerHaptic();
        navigate(navItems[nextIdx].to);
      }
    },
    [currentIndex, navigate]
  );

  useEffect(() => {
    const el = navRef.current;
    if (!el) return;

    const onTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      touchRef.current = { startX: touch.clientX, startY: touch.clientY, startTime: Date.now() };
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (!touchRef.current) return;
      const touch = e.changedTouches[0];
      const dx = touch.clientX - touchRef.current.startX;
      const dy = touch.clientY - touchRef.current.startY;
      const dt = Date.now() - touchRef.current.startTime;
      touchRef.current = null;

      // Must be horizontal, fast, and cover enough distance
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5 && dt < 400) {
        handleSwipe(dx < 0 ? "left" : "right");
      }
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, [handleSwipe]);

  const handleTap = (e: React.MouseEvent | React.TouchEvent) => {
    triggerHaptic();
    // Ripple effect from tap position
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    setRipple({ x: clientX - rect.left, y: clientY - rect.top, key: Date.now() });
  };

  return (
    <nav ref={navRef} className="lg:hidden fixed bottom-0 left-0 right-0 z-50 select-none touch-pan-x">
      {/* Gradient fade above */}
      <div className="absolute -top-8 left-0 right-0 h-8 bg-gradient-to-t from-background to-transparent pointer-events-none" />

      <div className="relative bg-card/98 backdrop-blur-xl border-t border-border/60 overflow-hidden">
        {/* Top accent line */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-primary/50 to-transparent" />

        {/* Swipe hint indicators */}
        {currentIndex > 0 && (
          <div className="absolute left-1 top-1/2 -translate-y-1/2 w-1 h-6 rounded-full bg-primary/20 animate-pulse" />
        )}
        {currentIndex < navItems.length - 1 && (
          <div className="absolute right-1 top-1/2 -translate-y-1/2 w-1 h-6 rounded-full bg-primary/20 animate-pulse" />
        )}

        <div className="flex items-center justify-around h-16 px-1 pb-[env(safe-area-inset-bottom)]">
          {navItems.map((item, idx) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={handleTap}
              className={({ isActive }) => cn(
                "relative flex flex-col items-center justify-center w-full h-full gap-1 transition-all duration-200",
                "active:scale-[0.88] active:opacity-80",
                isActive ? "text-primary" : "text-muted-foreground"
              )}
            >
              {({ isActive }) => (
                <>
                  {/* Animated active indicator */}
                  <div className={cn(
                    "absolute -top-[1px] left-1/2 -translate-x-1/2 h-[2px] rounded-full bg-primary transition-all duration-300 ease-out",
                    isActive
                      ? "w-10 opacity-100 shadow-[0_0_10px_hsl(var(--primary)/0.7)]"
                      : "w-0 opacity-0"
                  )} />

                  {/* Icon container with bounce on active */}
                  <div className={cn(
                    "flex items-center justify-center w-11 h-8 rounded-xl transition-all duration-200",
                    isActive
                      ? "bg-primary/15 shadow-[0_0_16px_hsl(var(--primary)/0.12)] animate-[bounce-subtle_0.3s_ease-out]"
                      : "bg-transparent"
                  )}>
                    <item.icon
                      className={cn(
                        "h-[18px] w-[18px] transition-all duration-200",
                        isActive && "drop-shadow-[0_0_6px_hsl(var(--primary)/0.5)]"
                      )}
                      strokeWidth={isActive ? 2.5 : 1.8}
                    />
                  </div>

                  {/* Label with slide-up on active */}
                  <span className={cn(
                    "text-[10px] leading-none tracking-wide transition-all duration-200",
                    isActive
                      ? "font-bold font-display translate-y-0 opacity-100"
                      : "font-medium font-mono opacity-60 translate-y-[1px]"
                  )}>
                    {item.label}
                  </span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </div>
    </nav>
  );
};

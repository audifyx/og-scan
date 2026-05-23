import { useState, useRef, useEffect } from "react";
import { StatusBar } from "./StatusBar";
import { ChevronUp } from "lucide-react";

interface LockScreenProps {
  onUnlock: () => void;
}

export const LockScreen = ({ onUnlock }: LockScreenProps) => {
  const [dragY, setDragY] = useState(0);
  const [unlocking, setUnlocking] = useState(false);
  const startY = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const handleTouchStart = (e: React.TouchEvent) => {
    startY.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const dy = startY.current - e.touches[0].clientY;
    if (dy > 0) setDragY(Math.min(dy, 300));
  };

  const handleTouchEnd = () => {
    if (dragY > 120) {
      setUnlocking(true);
      if (navigator.vibrate) navigator.vibrate(10);
      setTimeout(onUnlock, 400);
    } else {
      setDragY(0);
    }
  };

  const handleClick = () => {
    setUnlocking(true);
    if (navigator.vibrate) navigator.vibrate(10);
    setTimeout(onUnlock, 400);
  };

  const timeStr = time.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const dateStr = time.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });
  const opacity = Math.max(0, 1 - dragY / 200);

  return (
    <div
      ref={containerRef}
      className={`fixed inset-0 z-[190] transition-transform duration-400 ease-out ${unlocking ? "-translate-y-full" : ""}`}
      style={{ transform: unlocking ? "translateY(-100%)" : `translateY(-${dragY * 0.3}px)` }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onClick={handleClick}
    >
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-background via-card to-background">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full bg-primary/6 blur-[120px]" />
        <div className="absolute bottom-1/4 left-1/3 w-60 h-60 rounded-full bg-accent/4 blur-[100px]" />
      </div>

      <div className="relative h-full flex flex-col">
        <StatusBar light />

        {/* Clock */}
        <div className="flex-1 flex flex-col items-center justify-center" style={{ opacity }}>
          <p className="text-7xl font-extralight text-foreground tracking-tight leading-none">{timeStr}</p>
          <p className="text-base text-muted-foreground mt-3 font-light">{dateStr}</p>
        </div>

        {/* Swipe indicator */}
        <div className="pb-10 flex flex-col items-center gap-2" style={{ opacity }}>
          <ChevronUp className="h-5 w-5 text-primary/50 animate-bounce" style={{ animationDuration: "2s" }} />
          <p className="text-xs text-muted-foreground/60 font-light tracking-wider">Swipe up to unlock</p>
          <div className="w-32 h-1 rounded-full bg-foreground/20 mt-2" />
        </div>
      </div>
    </div>
  );
};

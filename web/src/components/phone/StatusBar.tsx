import { useEffect, useState } from "react";
import { Signal, Wifi, Battery } from "lucide-react";

export const StatusBar = ({ light = false }: { light?: boolean }) => {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 30000);
    return () => clearInterval(interval);
  }, []);

  const timeStr = time.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

  return (
    <div className={`flex items-center justify-between px-6 pt-3 pb-1 text-[12px] font-semibold z-50 ${light ? "text-white" : "text-foreground"}`}>
      <span className="w-16 font-display text-[11px] tracking-wide">{timeStr}</span>
      <div className="flex items-center gap-1.5">
        <Signal className="h-3.5 w-3.5" strokeWidth={2.2} />
        <Wifi className="h-3.5 w-3.5" strokeWidth={2.2} />
        <Battery className="h-4 w-4" strokeWidth={2.2} />
      </div>
    </div>
  );
};

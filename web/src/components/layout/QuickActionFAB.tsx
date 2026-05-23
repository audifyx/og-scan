import { useState } from "react";
import { Plus, X, Search, Crosshair, BarChart3, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

const actions = [
  { icon: Search, label: "Wallet Search", path: "/wallets", color: "from-primary to-accent" },
  { icon: Crosshair, label: "Token Sniper", path: "/tools", color: "from-secondary to-accent" },
  { icon: BarChart3, label: "Charts", path: "/charts", color: "from-primary to-secondary" },
];

export const QuickActionFAB = () => {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const handleAction = (path: string) => {
    if (navigator.vibrate) navigator.vibrate(8);
    setOpen(false);
    navigate(path);
  };

  const toggleOpen = () => {
    if (navigator.vibrate) navigator.vibrate(6);
    setOpen((v) => !v);
  };

  return (
    <div className="lg:hidden fixed bottom-20 right-4 z-50 flex flex-col-reverse items-end gap-3">
      {/* Action items */}
      {actions.map((action, i) => (
        <button
          key={action.label}
          onClick={() => handleAction(action.path)}
          className={cn(
            "flex items-center gap-2.5 pl-3 pr-4 py-2.5 rounded-2xl border border-border/60 bg-card/95 backdrop-blur-xl shadow-lg shadow-black/40 transition-all duration-200",
            open
              ? "opacity-100 translate-y-0 scale-100"
              : "opacity-0 translate-y-4 scale-75 pointer-events-none"
          )}
          style={{ transitionDelay: open ? `${i * 50}ms` : "0ms" }}
        >
          <div className={cn("w-8 h-8 rounded-xl bg-gradient-to-br flex items-center justify-center", action.color)}>
            <action.icon className="h-4 w-4 text-primary-foreground" strokeWidth={2.2} />
          </div>
          <span className="text-xs font-display font-semibold tracking-wide text-foreground whitespace-nowrap">
            {action.label}
          </span>
        </button>
      ))}

      {/* FAB button */}
      <button
        onClick={toggleOpen}
        className={cn(
          "w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-200 active:scale-90",
          "bg-gradient-to-br from-primary via-accent to-secondary shadow-lg shadow-primary/30",
          open && "rotate-45 shadow-primary/50"
        )}
      >
        {open ? (
          <X className="h-6 w-6 text-primary-foreground" strokeWidth={2.5} />
        ) : (
          <Zap className="h-6 w-6 text-primary-foreground" strokeWidth={2.5} />
        )}
      </button>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 bg-background/60 backdrop-blur-sm -z-10"
          onClick={() => setOpen(false)}
        />
      )}
    </div>
  );
};

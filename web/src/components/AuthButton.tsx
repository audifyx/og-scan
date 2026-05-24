import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { User, LogOut, Settings, Wallet, ChevronDown } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

export const AuthButton = () => {
  const { user, profile, signOut, loading } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  if (loading || !user) {
    return (
      <button
        type="button"
        onClick={() => navigate("/auth")}
        className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-og-cyan/40 bg-og-cyan/10 px-3 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-og-cyan transition hover:border-og-cyan hover:bg-og-cyan/20 sm:px-4"
      >
        <User className="h-3.5 w-3.5" /> Sign In
      </button>
    );
  }

  const username = profile?.username ?? user.email?.split("@")[0] ?? "Anon";

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-og-lime/40 bg-og-lime/10 px-3 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-og-lime transition hover:border-og-lime hover:bg-og-lime/20 sm:px-4"
      >
        <User className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">@{username}</span>
        <ChevronDown className={cn("h-3 w-3 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-12 z-50 min-w-[180px] overflow-hidden rounded-2xl border border-white/10 bg-[#020915]/95 shadow-2xl backdrop-blur-xl">
            <div className="border-b border-white/10 px-4 py-3">
              <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Signed in as</p>
              <p className="mt-0.5 font-mono text-xs font-bold text-og-lime">@{username}</p>
            </div>
            <div className="py-1">
              {[
                { icon: Wallet, label: "Wallets", path: "/wallets" },
                { icon: Settings, label: "Settings", path: "/settings" },
              ].map(({ icon: Icon, label, path }) => (
                <button
                  key={path}
                  type="button"
                  onClick={() => { navigate(path); setOpen(false); }}
                  className="flex w-full items-center gap-2.5 px-4 py-2.5 font-mono text-[10px] uppercase tracking-widest text-white/70 transition hover:bg-white/[0.05] hover:text-og-lime"
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </button>
              ))}
            </div>
            <div className="border-t border-white/10 py-1">
              <button
                type="button"
                onClick={async () => { await signOut(); setOpen(false); }}
                className="flex w-full items-center gap-2.5 px-4 py-2.5 font-mono text-[10px] uppercase tracking-widest text-og-blood transition hover:bg-og-blood/10"
              >
                <LogOut className="h-3.5 w-3.5" />
                Sign Out
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

import { Shield, Scale, Plus, MapRoadmap, BookOpen, LogOut } from "lucide-react";
import { useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";

/**
 * Bottom nav — Quick access to legal docs, roadmap, whitepaper, and sign out.
 * Replaces redundant app navigation that's already available above.
 */

const navItems = [
  { id: "privacy", icon: Shield, label: "Privacy", href: "/privacy" },
  { id: "terms", icon: Scale, label: "Terms", href: "/terms" },
  { id: "add", icon: Plus, label: "Add", href: "#" },
  { id: "roadmap", icon: MapRoadmap, label: "Roadmap", href: "https://roadmap.example.com" },
  { id: "whitepaper", icon: BookOpen, label: "Paper", href: "https://whitepaper.example.com" },
  { id: "signout", icon: LogOut, label: "Sign Out", href: "#" },
];



const triggerHaptic = () => {
  if (navigator.vibrate) {
    navigator.vibrate(8);
  }
};

export const BottomNav = () => {
  const { user, signOut } = useAuth();

  const handleNavClick = (item: typeof navItems[0]) => {
    triggerHaptic();

    if (item.id === "signout") {
      signOut();
      return;
    }

    if (item.id === "add") {
      // Open profile/settings modal or navigate
      window.location.href = "/profile";
      return;
    }

    if (item.href.startsWith("http")) {
      window.open(item.href, "_blank");
    } else if (item.href !== "#") {
      window.location.href = item.href;
    }
  };

  return (
    <nav className="lg:hidden fixed left-1/2 -translate-x-1/2 z-50 select-none bottom-[calc(env(safe-area-inset-bottom,0px)+12px)]">
      <div className="flex items-center gap-1 rounded-[28px] border border-white/[0.12] bg-[#0a0f1c]/70 px-2 py-2 shadow-[0_10px_40px_-8px_rgba(0,0,0,0.6)] backdrop-blur-2xl">
        {/* subtle top sheen */}
        <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => handleNavClick(item)}
            className={cn(
              "relative flex min-w-[60px] flex-col items-center justify-center gap-1 rounded-[22px] px-3.5 py-2 transition-all duration-200 active:scale-[0.9]",
              "text-white/45 hover:text-white/75",
            )}
          >
            <item.icon className="h-[22px] w-[22px] transition-all duration-200" strokeWidth={1.8} />
            <span className="text-[9px] font-bold uppercase tracking-wider leading-none opacity-70">
              {item.label}
            </span>
          </button>
        ))}
      </div>
    </nav>
  );
};

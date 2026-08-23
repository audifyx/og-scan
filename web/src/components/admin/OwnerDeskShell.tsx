/**
 * Owner desk chrome — mobile-first dark shell.
 * Bottom tabs on phone, expandable rail on desktop. No AppLayout / galaxy wallpaper.
 */
import { useEffect, useState, type ComponentType, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Activity,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  FileText,
  Flame,
  Gamepad2,
  Globe2,
  Headphones,
  Headset,
  HeartPulse,
  KeyRound,
  LayoutDashboard,
  Link2,
  Megaphone,
  Mic,
  MoreHorizontal,
  PanelTop,
  Radio,
  Rocket,
  Settings,
  Shield,
  TrendingUp,
  UserCheck,
  Users,
  Wallet,
  X,
} from "lucide-react";
import type { AdminSection } from "./types";
import { DESK_MOBILE_TABS, DESK_NAV } from "./deskNav";

const ICON_MAP: Record<string, ComponentType<{ className?: string }>> = {
  Activity,
  BarChart3,
  FileText,
  Flame,
  Gamepad2,
  Globe2,
  Headphones,
  Headset,
  HeartPulse,
  KeyRound,
  LayoutDashboard,
  Link2,
  Megaphone,
  Mic,
  PanelTop,
  Radio,
  Rocket,
  Settings,
  Shield,
  TrendingUp,
  UserCheck,
  Users,
  Wallet,
};

type Pulse = { users: number; posts24: number; liveSpaces: number; online: number } | null;

type Props = {
  active: AdminSection;
  onChange: (s: AdminSection) => void;
  badges?: Partial<Record<AdminSection, number>>;
  title: string;
  eyebrow: string;
  description: string;
  ownerLabel?: string;
  pulse: Pulse;
  children: ReactNode;
};

export function OwnerDeskShell({
  active,
  onChange,
  badges = {},
  title,
  eyebrow,
  description,
  ownerLabel,
  pulse,
  children,
}: Props) {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(true);
  const [mobile, setMobile] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(max-width: 767px)");
    const sync = (matches: boolean) => {
      setMobile(matches);
      setExpanded(!matches);
    };
    sync(media.matches);
    const handle = (e: MediaQueryListEvent) => sync(e.matches);
    media.addEventListener("change", handle);
    return () => media.removeEventListener("change", handle);
  }, []);

  const go = (id: AdminSection) => {
    onChange(id);
    setMoreOpen(false);
  };

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-[#05070c] text-white">
      <aside
        className={cn(
          "hidden md:flex h-full shrink-0 flex-col border-r border-white/[0.06] bg-[#070b12] transition-[width] duration-200",
          expanded ? "w-[272px]" : "w-[76px]",
        )}
      >
        <div className={cn("flex items-center gap-2 border-b border-white/[0.06] px-3 py-3", expanded ? "justify-between" : "justify-center")}>
          {expanded ? (
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300/70">OrbitX</p>
              <p className="truncate text-sm font-black">Owner desk</p>
            </div>
          ) : (
            <Shield className="h-5 w-5 text-cyan-300" />
          )}
          <button
            type="button"
            aria-label={expanded ? "Collapse menu" : "Expand menu"}
            onClick={() => setExpanded((v) => !v)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-white/60 hover:text-white"
          >
            {expanded ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        </div>
        <button
          type="button"
          onClick={() => navigate("/")}
          className={cn(
            "mx-2 mt-2 inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] py-2 text-[11px] text-white/50 hover:text-white",
            expanded ? "px-3 justify-start" : "justify-center",
          )}
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          {expanded ? "Back to app" : null}
        </button>
        <ScrollArea className="flex-1 px-2 py-3">
          {DESK_NAV.map((group) => (
            <div key={group.group} className="mb-3">
              {expanded && (
                <p className="mb-1 px-2 text-[10px] font-black uppercase tracking-[0.18em] text-white/28">{group.group}</p>
              )}
              <div className="space-y-1">
                {group.items.map((item) => {
                  const Icon = ICON_MAP[item.icon] || LayoutDashboard;
                  const on = active === item.id;
                  const badge = badges[item.id];
                  return (
                    <button
                      key={item.id}
                      type="button"
                      title={item.label}
                      onClick={() => go(item.id)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-xl border px-2 py-2 text-left transition",
                        on
                          ? "border-cyan-300/25 bg-cyan-300/10 text-white"
                          : "border-transparent text-white/55 hover:bg-white/[0.04] hover:text-white",
                        !expanded && "justify-center px-0",
                      )}
                    >
                      <span className={cn("grid h-9 w-9 place-items-center rounded-xl border", on ? "border-cyan-300/25 text-cyan-300" : "border-white/10 text-white/45")}>
                        <Icon className="h-4 w-4" />
                      </span>
                      {expanded && (
                        <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">{item.label}</span>
                      )}
                      {expanded && badge && badge > 0 ? (
                        <Badge className="h-5 rounded-full border-yellow-500/30 bg-yellow-500/20 px-1.5 text-[10px] text-yellow-300">{badge}</Badge>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </ScrollArea>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-white/[0.06] bg-[#070b12]/95 px-3 py-2.5 backdrop-blur md:px-5">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300/65">{eyebrow}</p>
            <h1 className="truncate text-base font-black md:text-lg">{title}</h1>
          </div>
          {pulse && (
            <div className="hidden items-center gap-2 sm:flex">
              {[
                { k: "On", v: pulse.online },
                { k: "Users", v: pulse.users },
                { k: "Tx", v: pulse.posts24 },
              ].map((p) => (
                <div key={p.k} className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white/50">
                  {p.k} <span className="text-white">{p.v.toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
          <div className="hidden text-right text-[10px] text-white/40 md:block">
            <div className="font-semibold text-white/70">{ownerLabel || "Owner"}</div>
            Live
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-auto px-3 pb-24 pt-3 md:px-5 md:pb-6">
          <p className="mb-3 max-w-3xl text-xs leading-5 text-white/45 md:text-sm">{description}</p>
          <div className="rounded-2xl border border-white/[0.07] bg-[#0a1018] p-3 md:p-5">{children}</div>
        </div>
      </div>

      {mobile && (
        <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#070b12]/96 pb-[env(safe-area-inset-bottom)] md:hidden">
          <div className="grid grid-cols-6">
            {DESK_MOBILE_TABS.map((tab) => {
              const Icon = ICON_MAP[tab.icon] || LayoutDashboard;
              const on = active === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => go(tab.id)}
                  className={cn("flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-bold uppercase tracking-wider", on ? "text-cyan-300" : "text-white/40")}
                >
                  <Icon className="h-4 w-4" />
                  {tab.short || tab.label}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              className={cn("flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-bold uppercase tracking-wider", moreOpen ? "text-cyan-300" : "text-white/40")}
            >
              <MoreHorizontal className="h-4 w-4" />
              More
            </button>
          </div>
        </nav>
      )}

      {moreOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button type="button" className="absolute inset-0 bg-black/70" aria-label="Close menu" onClick={() => setMoreOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 max-h-[82vh] overflow-auto rounded-t-3xl border border-white/10 bg-[#0a1018] p-4 pb-10">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-black">All sections</p>
              <button type="button" onClick={() => setMoreOpen(false)} className="grid h-9 w-9 place-items-center rounded-full bg-white/5">
                <X className="h-4 w-4" />
              </button>
            </div>
            {DESK_NAV.map((group) => (
              <div key={group.group} className="mb-4">
                <p className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-white/35">{group.group}</p>
                <div className="grid grid-cols-2 gap-2">
                  {group.items.map((item) => {
                    const Icon = ICON_MAP[item.icon] || LayoutDashboard;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => go(item.id)}
                        className={cn(
                          "flex items-center gap-2 rounded-2xl border px-3 py-3 text-left text-sm",
                          active === item.id ? "border-cyan-300/30 bg-cyan-300/10" : "border-white/10 bg-white/[0.03]",
                        )}
                      >
                        <Icon className="h-4 w-4 text-cyan-300" />
                        <span className="truncate">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

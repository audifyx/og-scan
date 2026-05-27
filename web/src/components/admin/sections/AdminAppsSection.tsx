import type { ComponentType } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowUpRight, BellRing, Film, Mic, Smartphone, Twitter } from "lucide-react";

interface AdminAppCard {
  to: string;
  icon: ComponentType<{ className?: string }>;
  label: string;
  eyebrow: string;
  description: string;
  accent: string;
  border: string;
}

const ADMIN_APPS: AdminAppCard[] = [
  {
    to: "/mobile-app",
    icon: Smartphone,
    label: "Mobile App",
    eyebrow: "iOS & Android",
    description: "Manage native app rollout, install flows, and app-facing launch messaging.",
    accent: "text-cyan-300",
    border: "border-cyan-400/20 hover:border-cyan-300/45",
  },
  {
    to: "/reminders",
    icon: BellRing,
    label: "Space Reminders",
    eyebrow: "Push + email",
    description: "Control reminder delivery, timing, and notification settings for scheduled spaces.",
    accent: "text-yellow-300",
    border: "border-yellow-400/20 hover:border-yellow-300/45",
  },
  {
    to: "/auto-tweet",
    icon: Twitter,
    label: "Auto-Tweet",
    eyebrow: "Go-live posting",
    description: "Configure automatic posting flows and launch copy when spaces go live.",
    accent: "text-sky-300",
    border: "border-sky-400/20 hover:border-sky-300/45",
  },
  {
    to: "/podcasts",
    icon: Mic,
    label: "Podcast Publisher",
    eyebrow: "RSS distribution",
    description: "Publish recorded sessions into podcast feeds and manage outbound distribution.",
    accent: "text-fuchsia-300",
    border: "border-fuchsia-400/20 hover:border-fuchsia-300/45",
  },
  {
    to: "/clip-export",
    icon: Film,
    label: "Clip → Video",
    eyebrow: "Social exports",
    description: "Turn clips into export-ready videos for social posting and reuse.",
    accent: "text-emerald-300",
    border: "border-emerald-400/20 hover:border-emerald-300/45",
  },
];

export const AdminAppsSection = () => {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(280px,0.7fr)]">
        <div className="rounded-[28px] border border-white/[0.08] bg-[linear-gradient(135deg,rgba(34,211,238,0.14),rgba(8,16,27,0.96)_38%,rgba(168,85,247,0.12))] p-5 shadow-[0_25px_80px_-55px_rgba(34,211,238,0.55)] sm:p-6">
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-cyan-200/70">Admin apps hub</p>
          <h2 className="mt-3 text-2xl font-black tracking-tight text-white sm:text-[2rem]">All admin app access in one place.</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/60">
            This page replaces the cluttered multi-link sidebar setup. Open every admin app from here instead of hunting through separate sidebar entries.
          </p>
        </div>

        <div className="rounded-[28px] border border-white/[0.08] bg-white/[0.03] p-5 sm:p-6">
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-white/35">Why this is cleaner</p>
          <div className="mt-4 space-y-3 text-sm text-white/65">
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] px-4 py-3">• one entry point for owner-only tools</div>
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] px-4 py-3">• less sidebar clutter on desktop and mobile</div>
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] px-4 py-3">• easier to expand later without making nav messy again</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 2xl:grid-cols-3">
        {ADMIN_APPS.map((app) => {
          const Icon = app.icon;
          return (
            <button
              key={app.to}
              type="button"
              onClick={() => navigate(app.to)}
              className={`group rounded-[26px] border bg-[#08101b]/82 p-5 text-left transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#0d1727] ${app.border}`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className={`flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] ${app.accent}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <ArrowUpRight className="h-4 w-4 text-white/20 transition group-hover:text-white/60" />
              </div>

              <div className="mt-5">
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-white/35">{app.eyebrow}</p>
                <h3 className="mt-2 text-lg font-bold tracking-tight text-white">{app.label}</h3>
                <p className="mt-2 text-sm leading-6 text-white/58">{app.description}</p>
              </div>

              <div className="mt-5 inline-flex rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-[11px] font-semibold text-white/70 transition group-hover:border-white/[0.16] group-hover:text-white">
                Open app
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

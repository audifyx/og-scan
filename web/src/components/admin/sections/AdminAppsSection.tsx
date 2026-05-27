import type { ComponentType } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowUpRight,
  BellRing,
  Brain,
  Building2,
  Code2,
  Film,
  Mic,
  Radio,
  Signal,
  Smartphone,
  Sparkles,
  Twitter,
} from "lucide-react";

interface AdminAppCard {
  to: string;
  icon: ComponentType<{ className?: string }>;
  label: string;
  eyebrow: string;
  description: string;
  accent: string;
  border: string;
}

interface AdminAppGroup {
  label: string;
  description: string;
  items: AdminAppCard[];
}

const ADMIN_APP_GROUPS: AdminAppGroup[] = [
  {
    label: "Core admin apps",
    description: "Operational tools that were previously scattered across sidebar links.",
    items: [
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
    ],
  },
  {
    label: "Spaces & AI apps",
    description: "These owner-only tools now live here inside the admin dashboard instead of the main app sidebar.",
    items: [
      {
        to: "/discovery",
        icon: Radio,
        label: "Live Spaces",
        eyebrow: "Discovery feed",
        description: "Browse and manage live audio spaces and the discovery feed from the admin hub.",
        accent: "text-cyan-300",
        border: "border-cyan-400/20 hover:border-cyan-300/45",
      },
      {
        to: "/shows",
        icon: Radio,
        label: "Shows",
        eyebrow: "Podcast-style series",
        description: "Manage podcast-style shows, publishing flows, and episode scheduling.",
        accent: "text-violet-300",
        border: "border-violet-400/20 hover:border-violet-300/45",
      },
      {
        to: "/ai-assistant",
        icon: Brain,
        label: "AI Assistant",
        eyebrow: "Transcripts + notes",
        description: "Open transcription, notes, and smart post-session assistance from the admin dashboard.",
        accent: "text-green-300",
        border: "border-green-400/20 hover:border-green-300/45",
      },
      {
        to: "/host-copilot",
        icon: Sparkles,
        label: "Host Copilot",
        eyebrow: "Live suggestions + coaching",
        description: "Access live guidance tools for hosts without keeping separate sidebar clutter around.",
        accent: "text-amber-300",
        border: "border-amber-400/20 hover:border-amber-300/45",
      },
      {
        to: "/simulcast",
        icon: Signal,
        label: "Simulcast",
        eyebrow: "Broadcast everywhere",
        description: "Manage multi-platform broadcast workflows from the same admin apps page.",
        accent: "text-pink-300",
        border: "border-pink-400/20 hover:border-pink-300/45",
      },
      {
        to: "/enterprise",
        icon: Building2,
        label: "Enterprise",
        eyebrow: "HIPAA + SSO + compliance",
        description: "Open enterprise settings and compliance-oriented features from the admin dashboard.",
        accent: "text-orange-300",
        border: "border-orange-400/20 hover:border-orange-300/45",
      },
      {
        to: "/dev-portal",
        icon: Code2,
        label: "Developer Portal",
        eyebrow: "API, webhooks, marketplace",
        description: "Jump into the developer portal without exposing it as a separate main sidebar item.",
        accent: "text-indigo-300",
        border: "border-indigo-400/20 hover:border-indigo-300/45",
      },
    ],
  },
];

export const AdminAppsSection = () => {
  const navigate = useNavigate();

  return (
    <div className="space-y-8">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(280px,0.7fr)]">
        <div className="rounded-[28px] border border-white/[0.08] bg-[linear-gradient(135deg,rgba(34,211,238,0.14),rgba(8,16,27,0.96)_38%,rgba(168,85,247,0.12))] p-5 shadow-[0_25px_80px_-55px_rgba(34,211,238,0.55)] sm:p-6">
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-cyan-200/70">Admin apps hub</p>
          <h2 className="mt-3 text-2xl font-black tracking-tight text-white sm:text-[2rem]">Everything owner-only lives here.</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/60">
            All of the admin apps and Spaces/AI owner tools are now grouped inside this admin dashboard page instead of being spread through the main app sidebar.
          </p>
        </div>

        <div className="rounded-[28px] border border-white/[0.08] bg-white/[0.03] p-5 sm:p-6">
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-white/35">What this page fixes</p>
          <div className="mt-4 space-y-3 text-sm text-white/65">
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] px-4 py-3">• removes owner-only app clutter from the main sidebar</div>
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] px-4 py-3">• keeps admin apps and Spaces/AI tools together in one dashboard hub</div>
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] px-4 py-3">• makes future admin tools easier to add without bloating navigation</div>
          </div>
        </div>
      </div>

      {ADMIN_APP_GROUPS.map((group) => (
        <section key={group.label} className="space-y-4">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-white/35">{group.label}</p>
            <p className="mt-1 text-sm text-white/55">{group.description}</p>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 2xl:grid-cols-3">
            {group.items.map((app) => {
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
        </section>
      ))}
    </div>
  );
};

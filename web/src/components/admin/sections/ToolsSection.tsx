/* ══════════════════════════════════════════════════════════════
   Admin → Tools Section
   Links to all admin-only tools (AI Assistant, Simulcast, etc.)
   ══════════════════════════════════════════════════════════════ */
import { useNavigate } from "react-router-dom";
import { Brain, Sparkles, Signal, Building2, Code2, Radio, ExternalLink } from "lucide-react";

interface ToolCard {
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  description: string;
  badge?: string;
  color: string;
  borderColor: string;
}

const TOOLS: ToolCard[] = [
  {
    to: "/discovery",
    icon: Radio,
    label: "Live Spaces",
    description: "Browse and manage live audio spaces & discovery feed",
    color: "text-[#22d3ee]",
    borderColor: "border-[#22d3ee]/20 hover:border-[#22d3ee]/40",
  },
  {
    to: "/shows",
    icon: Radio,
    label: "Shows",
    description: "Podcast-style series management and episode scheduling",
    color: "text-purple-400",
    borderColor: "border-purple-500/20 hover:border-purple-500/40",
  },
  {
    to: "/ai-assistant",
    icon: Brain,
    label: "AI Assistant",
    description: "Live transcription, smart notes and post-session summaries",
    badge: "AI",
    color: "text-green-400",
    borderColor: "border-green-500/20 hover:border-green-500/40",
  },
  {
    to: "/host-copilot",
    icon: Sparkles,
    label: "Host Copilot",
    description: "Real-time suggestions and live coaching for space hosts",
    badge: "AI",
    color: "text-yellow-400",
    borderColor: "border-yellow-500/20 hover:border-yellow-500/40",
  },
  {
    to: "/simulcast",
    icon: Signal,
    label: "Simulcast",
    description: "Broadcast simultaneously to Twitter, YouTube, Twitch and more",
    color: "text-pink-400",
    borderColor: "border-pink-500/20 hover:border-pink-500/40",
  },
  {
    to: "/enterprise",
    icon: Building2,
    label: "Enterprise",
    description: "HIPAA compliance, SSO, team management and SLA settings",
    badge: "ORG",
    color: "text-orange-400",
    borderColor: "border-orange-500/20 hover:border-orange-500/40",
  },
  {
    to: "/dev-portal",
    icon: Code2,
    label: "Developer Portal",
    description: "REST API keys, webhook endpoints, OAuth apps and marketplace",
    badge: "DEV",
    color: "text-indigo-400",
    borderColor: "border-indigo-500/20 hover:border-indigo-500/40",
  },
];

export const ToolsSection = () => {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-black tracking-tight text-white">Admin Tools</h2>
        <p className="text-sm text-white/40 mt-1">
          Advanced tools — visible only to owner account. Hidden from all regular users.
        </p>
      </div>

      {/* Tool grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {TOOLS.map((tool) => {
          const Icon = tool.icon;
          return (
            <button
              key={tool.to}
              onClick={() => navigate(tool.to)}
              className={`group relative flex flex-col gap-3 rounded-xl border bg-white/[0.02] p-5 text-left transition-all duration-200 hover:bg-white/[0.05] ${tool.borderColor}`}
            >
              {/* Icon + badge row */}
              <div className="flex items-center justify-between">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] ${tool.color}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex items-center gap-2">
                  {tool.badge && (
                    <span className={`rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${tool.color} bg-white/5 border border-white/10`}>
                      {tool.badge}
                    </span>
                  )}
                  <ExternalLink className="h-3.5 w-3.5 text-white/20 group-hover:text-white/50 transition" />
                </div>
              </div>

              {/* Label + description */}
              <div>
                <p className="text-[14px] font-bold text-white leading-tight">{tool.label}</p>
                <p className="text-[12px] text-white/40 mt-1 leading-relaxed">{tool.description}</p>
              </div>

              {/* Bottom action hint */}
              <div className={`text-[11px] font-semibold ${tool.color} opacity-0 group-hover:opacity-100 transition`}>
                Open {tool.label} →
              </div>
            </button>
          );
        })}
      </div>

      {/* Admin note */}
      <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-4">
        <div className="flex items-start gap-3">
          <span className="text-yellow-400 text-lg">🔒</span>
          <div>
            <p className="text-[13px] font-bold text-yellow-400">Owner-Only Access</p>
            <p className="text-[12px] text-white/40 mt-0.5">
              These tools are hidden from the sidebar for all regular users. Only <span className="text-white/70 font-mono">audifyx@gmail.com</span> can see this section and the Spaces & AI sidebar items.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

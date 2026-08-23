import type { ComponentType } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { ADMIN_APPS, ADMIN_APP_GROUPS } from "@/lib/adminApps";

export const AdminAppsSection = () => {
  const navigate = useNavigate();

  return (
    <div className="space-y-8">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(280px,0.7fr)]">
        <div className="rounded-[28px] border border-white/[0.08] bg-[linear-gradient(135deg,rgba(240,199,94,0.14),rgba(8,16,27,0.96)_38%,rgba(59,130,246,0.12))] p-5 shadow-[0_25px_80px_-55px_rgba(212,175,55,0.45)] sm:p-6">
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#F0C75E]/80">Admin apps hub</p>
          <h2 className="mt-3 text-2xl font-black tracking-tight text-white sm:text-[2rem]">Every owner app in one place.</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/60">
            Platform desks, ops tools, and Spaces/AI apps — also mirrored on <span className="text-white">/app</span> for the owner identity only.
          </p>
        </div>

        <div className="rounded-[28px] border border-white/[0.08] bg-white/[0.03] p-5 sm:p-6">
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-white/35">Access</p>
          <div className="mt-4 space-y-3 text-sm text-white/65">
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] px-4 py-3">• /app icons: unlocked owner session only</div>
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] px-4 py-3">• Desk routes still use AdminRoute + owner gate</div>
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] px-4 py-3">• {ADMIN_APPS.length} admin apps registered</div>
          </div>
        </div>
      </div>

      {ADMIN_APP_GROUPS.map((group) => {
        const items = ADMIN_APPS.filter((a) => a.group === group.id);
        return (
          <section key={group.id} className="space-y-4">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-white/35">{group.label}</p>
              <p className="mt-1 text-sm text-white/55">{group.description}</p>
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 2xl:grid-cols-3">
              {items.map((app) => {
                const Icon = app.icon as ComponentType<{ className?: string }>;
                return (
                  <button
                    key={app.key}
                    type="button"
                    onClick={() => {
                      if (app.to.startsWith("http") || app.to.startsWith("/ORBITX_DEX")) {
                        window.location.assign(app.to);
                      } else {
                        navigate(app.to);
                      }
                    }}
                    className="group rounded-[26px] border border-white/[0.08] bg-[#08101b]/82 p-5 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-[#F0C75E]/35 hover:bg-[#0d1727]"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04]" style={{ color: app.tone }}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <ArrowUpRight className="h-4 w-4 text-white/25 transition group-hover:text-[#F0C75E]" />
                    </div>
                    <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.18em] text-white/40">{app.eyebrow}</p>
                    <h3 className="mt-1 text-lg font-black text-white">{app.label}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-white/55">{app.description}</p>
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
};

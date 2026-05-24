import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import {
  Wallet, ArrowLeftRight, Copy, Users, Zap, Sparkles,
  TrendingUp, Shield, Rocket, Clock, Eye, CheckCircle,
} from "lucide-react";

const UPCOMING_FEATURES = [
  { icon: Wallet, title: "Wallet Creation", desc: "Create secure Solana wallets directly in-app", status: "In Dev", progress: 45, accent: "#22d3ee" },
  { icon: ArrowLeftRight, title: "Live Buy & Sell", desc: "Trade any Solana token pair directly from the platform", status: "Planned", progress: 15, accent: "#eab308" },
  { icon: Copy, title: "Copy Trading", desc: "Auto-mirror top traders' moves in real-time", status: "Planned", progress: 10, accent: "#22d3ee" },
  { icon: Users, title: "Lobby Trading", desc: "Trade together with friends in voice lobbies", status: "Planned", progress: 20, accent: "#eab308" },
  { icon: Shield, title: "Phantom Export", desc: "Export wallet for use with Phantom and other wallets", status: "Planned", progress: 5, accent: "#22d3ee" },
  { icon: TrendingUp, title: "Advanced Orders", desc: "Limit orders, stop loss, and take profit automation", status: "Planned", progress: 8, accent: "#eab308" },
];

const LiveTrading = () => {
  const { user } = useAuth();
  const [email, setEmail] = useState("");
  const [joined, setJoined] = useState(false);

  const joinWaitlist = async () => {
    if (!email.trim() && !user) return;
    try {
      const notifEmail = email.trim() || user?.email || "";
      if (user) {
        await supabase.from("notifications").insert({
          user_id: user.id,
          title: "Live Trading Waitlist",
          message: `You've been added to the Live Trading early access waitlist! We'll notify you at ${notifEmail} when it launches.`,
          type: "system",
        });
      }
      setJoined(true);
      toast.success("You're on the waitlist! We'll notify you when Live Trading launches.");
    } catch {
      toast.error("Failed to join waitlist");
    }
  };

  return (
    <AppLayout>
      <PageHeader title="Live Trading" description="Coming Soon — Trade directly on the platform">
        <Badge className="bg-[#eab308]/10 text-[#eab308] border-[#eab308]/20 gap-1.5 text-xs font-bold">
          <Clock className="h-3 w-3" /> Coming Soon
        </Badge>
      </PageHeader>

      <div className="p-4 lg:p-6 space-y-6 max-w-4xl mx-auto">

        {/* ── Hero Card ── */}
        <div className="og-glass-frame rounded-3xl overflow-hidden relative">
          {/* Glow layer */}
          <div className="absolute inset-0 bg-gradient-to-br from-[#22d3ee]/8 via-transparent to-[#eab308]/6 pointer-events-none" />
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#22d3ee]/40 to-transparent" />

          <div className="relative p-8 md:p-12 text-center">
            {/* Icon */}
            <div className="relative inline-flex mb-6">
              <div className="absolute inset-0 bg-[#eab308]/20 blur-3xl rounded-full" />
              <div className="relative p-5 rounded-3xl bg-gradient-to-br from-[#eab308] to-[#22d3ee] shadow-2xl">
                <Rocket className="h-10 w-10 text-[hsl(var(--og-ink))]" />
              </div>
            </div>

            <h2 className="text-3xl md:text-4xl font-black text-white mb-3">
              Live <span className="gradient-text">Trading</span>
            </h2>
            <p className="text-white/45 max-w-md mx-auto leading-relaxed text-sm">
              Full trading capabilities are coming. Buy, sell, copy trade, and manage your entire portfolio — all from one platform.
            </p>

            {/* Waitlist */}
            <div className="mt-8 max-w-sm mx-auto">
              {joined ? (
                <div className="flex items-center justify-center gap-2.5 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-400">
                  <CheckCircle className="h-5 w-5" />
                  <span className="font-bold text-sm">You're on the early access list!</span>
                </div>
              ) : (
                <div className="og-search-box px-3">
                  <input
                    className="og-search-input text-sm"
                    placeholder={user ? user.email || "Your email" : "Enter your email…"}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && joinWaitlist()}
                  />
                  <button
                    onClick={joinWaitlist}
                    className="og-search-action flex items-center gap-2 px-5 text-sm font-bold text-white/80 hover:text-[hsl(var(--og-ink))] transition-colors"
                  >
                    <Zap className="h-4 w-4" />
                    <span className="hidden sm:inline">Join</span>
                  </button>
                </div>
              )}
              <p className="text-[11px] text-white/25 mt-3">Early access members get priority onboarding & trading fee discounts</p>
            </div>
          </div>
        </div>

        {/* ── Upcoming Features ── */}
        <div>
          <h3 className="text-xs font-black uppercase tracking-widest text-white/30 mb-4 flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-[#eab308]" /> In Development
          </h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {UPCOMING_FEATURES.map((f, i) => (
              <div
                key={i}
                className="p-4 rounded-2xl border border-white/[0.07] bg-white/[0.03] space-y-3"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl border border-white/10" style={{ background: `${f.accent}18` }}>
                    <f.icon className="h-4 w-4" style={{ color: f.accent }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-white leading-tight">{f.title}</p>
                    <Badge
                      className="text-[9px] font-bold mt-0.5 uppercase tracking-wide"
                      style={{
                        background: f.status === "In Dev" ? `${f.accent}18` : "rgba(255,255,255,0.06)",
                        color: f.status === "In Dev" ? f.accent : "rgba(255,255,255,0.35)",
                        borderColor: f.status === "In Dev" ? `${f.accent}28` : "rgba(255,255,255,0.08)",
                      }}
                    >
                      {f.status}
                    </Badge>
                  </div>
                </div>
                <p className="text-xs text-white/35 leading-relaxed">{f.desc}</p>
                {/* Progress bar */}
                <div className="space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-[10px] text-white/25 uppercase tracking-wider">Progress</span>
                    <span className="text-[10px] font-mono font-bold" style={{ color: f.accent }}>{f.progress}%</span>
                  </div>
                  <div className="h-1 bg-white/[0.06] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${f.progress}%`, background: f.accent }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Preview cards ── */}
        <div>
          <h3 className="text-xs font-black uppercase tracking-widest text-white/30 mb-4 flex items-center gap-2">
            <Eye className="h-3.5 w-3.5 text-[#22d3ee]" /> Preview
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { title: "Swap Interface", desc: "Best-route token swaps", icon: ArrowLeftRight, accent: "#22d3ee" },
              { title: "Portfolio View", desc: "Real-time positions", icon: Eye, accent: "#eab308" },
              { title: "Order Book", desc: "Live buy/sell pressure", icon: TrendingUp, accent: "#22d3ee" },
              { title: "Trade History", desc: "Full trade record", icon: Clock, accent: "#eab308" },
            ].map((p, i) => (
              <div key={i} className="p-4 rounded-2xl border border-white/[0.07] bg-white/[0.03] text-center space-y-2.5 opacity-60">
                <div className="p-2.5 rounded-xl border border-white/10 inline-block" style={{ background: `${p.accent}18` }}>
                  <p.icon className="h-4 w-4" style={{ color: p.accent }} />
                </div>
                <p className="font-bold text-xs text-white">{p.title}</p>
                <p className="text-[10px] text-white/30">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default LiveTrading;

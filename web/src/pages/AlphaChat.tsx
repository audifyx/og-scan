import { AppLayout } from "@/components/layout/AppLayout";
import { MessageSquare, Sparkles, Zap, Shield, Users, Bot } from "lucide-react";

const AlphaChat = () => (
  <AppLayout>
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-6 text-center">
      <div className="relative mb-8">
        <div className="absolute inset-0 bg-og-cyan/20 rounded-full blur-3xl animate-pulse" />
        <div className="relative h-24 w-24 rounded-full border-2 border-dashed border-og-cyan/30 flex items-center justify-center bg-og-cyan/5">
          <MessageSquare className="h-10 w-10 text-og-cyan" />
        </div>
      </div>

      <h1 className="text-2xl font-black uppercase tracking-wider text-white mb-2">
        Alpha Chat
      </h1>
      <p className="text-sm text-white/40 font-bold uppercase tracking-widest mb-8">
        Coming Soon
      </p>

      <div className="max-w-md space-y-3 mb-10">
        <p className="text-sm text-white/50 leading-relaxed">
          A real-time chat room for OG Scan members to share alpha, discuss tokens, and coordinate trades — powered by AI analysis.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-w-lg w-full">
        {[
          { icon: Zap, label: "Real-time Chat", color: "text-og-cyan" },
          { icon: Bot, label: "AI Token Analysis", color: "text-og-lime" },
          { icon: Shield, label: "Verified Callers", color: "text-og-gold" },
          { icon: Users, label: "Trading Rooms", color: "text-purple-400" },
          { icon: Sparkles, label: "Signal Alerts", color: "text-pink-400" },
          { icon: MessageSquare, label: "Voice Channels", color: "text-emerald-400" },
        ].map((f, i) => (
          <div key={i} className="flex flex-col items-center gap-2 p-4 rounded-2xl border border-white/[0.06] bg-white/[0.02]">
            <f.icon className={`h-5 w-5 ${f.color}`} />
            <span className="text-[9px] font-black text-white/30 uppercase tracking-widest">{f.label}</span>
          </div>
        ))}
      </div>

      <p className="text-[10px] text-white/15 font-bold uppercase tracking-widest mt-10">
        We're rolling out features gradually. Alpha Chat will be available in an upcoming update.
      </p>
    </div>
  </AppLayout>
);

export default AlphaChat;

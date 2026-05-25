import { Rocket, Clock } from "lucide-react";

const LiveTrading = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-6 text-center">
      <div className="relative mb-6">
        <div className="h-24 w-24 rounded-3xl bg-gradient-to-br from-og-cyan/20 to-purple-500/20 border border-white/[0.08] flex items-center justify-center">
          <Rocket className="h-12 w-12 text-og-cyan" />
        </div>
        <div className="absolute -top-2 -right-2 h-8 w-8 rounded-full bg-og-gold/20 border border-og-gold/30 flex items-center justify-center">
          <Clock className="h-4 w-4 text-og-gold" />
        </div>
      </div>

      <h1 className="text-2xl font-black uppercase tracking-wider text-white mb-3">
        Coming Soon
      </h1>

      <p className="text-sm text-white/40 max-w-md leading-relaxed mb-6">
        We're rolling out features gradually. Live Trading will be available in an upcoming update — stay tuned.
      </p>

      <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.03] border border-white/[0.06]">
        <div className="h-2 w-2 rounded-full bg-og-cyan animate-pulse" />
        <span className="text-[10px] font-black uppercase tracking-widest text-white/30">In Development</span>
      </div>
    </div>
  );
};

export default LiveTrading;

import { useNavigate } from "react-router-dom";

/**
 * PNL Tracker — tool shell. Dashboard is being built; this scaffolds the
 * page, route (/app/pnl-tracker) and Hub dock entry so it's reachable.
 */
export default function PnlTracker() {
  const navigate = useNavigate();
  const stats = [
    { label: "Total PNL", value: "—" },
    { label: "Realized", value: "—" },
    { label: "Unrealized", value: "—" },
    { label: "Win rate", value: "—" },
  ];
  const roadmap = ["Per-token PNL", "Portfolio timeline", "Realized vs unrealized", "Cost basis (FIFO)", "Tax export (CSV)", "Multi-wallet"];
  return (
    <div className="min-h-screen bg-[#05070c] text-white">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/4 h-96 w-96 rounded-full bg-[#F97316]/10 blur-[130px]" />
        <div className="absolute -bottom-40 right-1/4 h-96 w-96 rounded-full bg-[#9945FF]/10 blur-[130px]" />
      </div>
      <div className="relative mx-auto max-w-3xl px-4 py-6">
        <button onClick={() => navigate("/app")} className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[13px] font-bold text-white/70 transition hover:bg-white/[0.08] hover:text-white">← Hub</button>

        <div className="flex items-center gap-3">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-[#F97316] to-[#B45309] text-[26px] shadow-[0_10px_30px_-8px_rgba(249,115,22,0.55)]">📈</div>
          <div className="min-w-0">
            <h1 className="text-[28px] font-black leading-none tracking-tight">PNL Tracker</h1>
            <p className="mt-1.5 text-[14px] text-white/45">Track realized &amp; unrealized profit and loss across your wallets.</p>
          </div>
          <span className="ml-auto shrink-0 rounded-full border border-[#F97316]/30 bg-[#F97316]/10 px-3 py-1 text-[11px] font-black uppercase tracking-widest text-[#F97316]">Coming soon</span>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {stats.map((c) => (
            <div key={c.label} className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
              <div className="text-[10px] font-bold uppercase tracking-widest text-white/35">{c.label}</div>
              <div className="mt-1.5 text-[22px] font-black tabular-nums text-white">{c.value}</div>
            </div>
          ))}
        </div>

        <div className="mt-6 rounded-2xl border border-white/[0.08] bg-gradient-to-b from-white/[0.04] to-white/[0.01] p-8 text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-[#F97316]/20 to-[#9945FF]/15 text-[28px] ring-1 ring-white/10">💹</div>
          <h2 className="mt-4 text-[18px] font-black">Your PNL, all in one place</h2>
          <p className="mx-auto mt-2 max-w-md text-[13.5px] leading-6 text-white/45">
            Connect a wallet to see per-token and portfolio-wide profit and loss, cost basis, holding time, and full trade history. This tool is being built — the live dashboard lands here soon.
          </p>
          <button className="mt-5 rounded-full bg-gradient-to-r from-[#F97316] to-[#f59e0b] px-5 py-2.5 text-[14px] font-black text-black shadow-[0_8px_24px_-8px_rgba(249,115,22,0.7)] transition hover:brightness-110 active:scale-95">Connect wallet</button>
        </div>

        <div className="mt-6">
          <div className="mb-2 text-[12px] font-black uppercase tracking-widest text-white/35">On the way</div>
          <div className="flex flex-wrap gap-2">
            {roadmap.map((f) => (
              <span key={f} className="rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-[12.5px] font-bold text-white/60">{f}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

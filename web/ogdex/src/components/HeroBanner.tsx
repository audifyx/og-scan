// Terminal-window hero: pure CSS, no image. Reads like the top of a trading terminal.
export default function HeroBanner() {
  return (
    <div className="mb-4 overflow-hidden rounded-lg term-panel bg-term-grid">
      {/* window chrome */}
      <div className="flex items-center gap-2 px-4 h-8 border-b" style={{ borderColor: "#1C2320", background: "#050505" }}>
        <span className="w-2.5 h-2.5 rounded-full" style={{ background: "#FF5C5C" }} />
        <span className="w-2.5 h-2.5 rounded-full" style={{ background: "#FFC53D" }} />
        <span className="w-2.5 h-2.5 rounded-full" style={{ background: "#00FFA3" }} />
        <span className="ml-3 term text-[10px]" style={{ color: "#66707E", letterSpacing: "0.12em" }}>orbitx — dex intelligence terminal</span>
        <span className="ml-auto term text-[10px] hidden sm:inline" style={{ color: "#66707E" }}>v2.0 · solana mainnet</span>
      </div>
      {/* prompt block */}
      <div className="px-4 sm:px-5 py-4">
        <div className="term text-[11px] sm:text-xs" style={{ color: "#A8B3C2" }}>
          <span style={{ color: "#00FFA3" }}>orbitx@dex</span>
          <span style={{ color: "#66707E" }}>:~$</span>{" "}
          scan --trending --chain solana --safety on
        </div>
        <div className="mt-2 flex flex-wrap items-end gap-x-4 gap-y-1">
          <h1 className="font-display font-bold text-2xl sm:text-3xl leading-none">
            Orbit<span className="text-brand-gradient">X</span>
            <span className="text-white/40"> /</span> <span className="text-term-gradient">TERMINAL</span>
          </h1>
          <span className="term text-[10px] sm:text-[11px] pb-0.5 term-cursor" style={{ color: "#66707E" }}>
            live scan: momentum · safety · whales · KOL flow
          </span>
        </div>
      </div>
    </div>
  );
}

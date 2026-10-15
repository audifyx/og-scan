import { BadgeCheck, Flame, Landmark, Rocket, ShieldCheck, Users } from "lucide-react";

/**
 * TokenArticle — the story of ORBITX. Editorial, honest, sourced from
 * verified on-chain data (Risk X-ray audit, Oct 15 2026).
 */
export function TokenArticle() {
  return (
    <article className="space-y-8">
      {/* headline */}
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-teal-300">The official token</p>
        <h2 className="mt-2 text-3xl font-extrabold leading-tight tracking-tight">
          One token.<br />An entire universe.
        </h2>
        <p className="mt-3 text-[15px] leading-relaxed text-white/60">
          ORBITX is the fuel of the OrbitX platform — the connective tissue between trading,
          social, gaming, and the 3D city. Every surface of the ecosystem runs on it, and every
          burn makes the remaining supply rarer.
        </p>
      </div>

      {/* what is orbitx */}
      <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
        <div className="flex items-center gap-2">
          <Rocket className="h-5 w-5 text-sky-400" />
          <h3 className="text-lg font-bold">What is OrbitX?</h3>
        </div>
        <div className="mt-3 space-y-3 text-[14px] leading-relaxed text-white/60">
          <p>
            OrbitX is a crypto-native super-app on Solana. It started as a trading terminal and
            grew into a full universe: a <span className="text-white/90 font-semibold">DEX terminal</span> with
            live scanners, a <span className="text-white/90 font-semibold">trade app</span> with ranked markets,
            a <span className="text-white/90 font-semibold">Social Center</span> where calls, tips and copy-trading
            live natively in the feed, an <span className="text-white/90 font-semibold">NFT marketplace</span>,
            a walkable <span className="text-white/90 font-semibold">3D city</span>, and BagWork — earn real USDC
            for completing tasks.
          </p>
          <p>
            The platform ships weekly. Performance passes, UI overhauls, new surfaces — the feed
            above is a living record of that cadence. ORBITX is how value moves through all of it.
          </p>
        </div>
      </section>

      {/* tokenomics */}
      <section>
        <div className="flex items-center gap-2">
          <Landmark className="h-5 w-5 text-amber-300" />
          <h3 className="text-lg font-bold">Tokenomics</h3>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          {[
            { label: "Total supply", value: "1,000,000,000", sub: "Fixed forever" },
            { label: "Decimals", value: "6", sub: "SPL standard" },
            { label: "Mint authority", value: "Renounced", sub: "No new tokens, ever" },
            { label: "Freeze authority", value: "Renounced", sub: "No one can freeze you" },
          ].map((c) => (
            <div key={c.label} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">{c.label}</p>
              <p className="mt-1 text-lg font-extrabold">{c.value}</p>
              <p className="text-[11px] text-white/45">{c.sub}</p>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-start gap-2 rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.06] p-4">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" />
          <p className="text-[13px] leading-relaxed text-white/65">
            <span className="font-bold text-white">Risk X-ray verified · Oct 15, 2026.</span> Contract
            scanned clean: authorities renounced, liquidity locked, 1,029+ holders at audit time.
            Always do your own research — the X-ray tab in the DEX re-scans live.
          </p>
        </div>
      </section>

      {/* burns */}
      <section className="rounded-3xl border border-orange-500/25 bg-gradient-to-b from-orange-500/10 to-transparent p-6">
        <div className="flex items-center gap-2">
          <Flame className="h-5 w-5 text-orange-400" />
          <h3 className="text-lg font-bold">Deflationary by design</h3>
        </div>
        <p className="mt-3 text-[14px] leading-relaxed text-white/60">
          ORBITX burns are real, on-chain, and permanent. Tokens are destroyed — not locked, not
          parked — shrinking the 1B supply with every event. The <span className="font-semibold text-white/90">Burns tab</span> above
          tracks each burn transaction live, linked straight to Solscan so you can verify it yourself.
        </p>
      </section>

      {/* utility */}
      <section>
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-violet-300" />
          <h3 className="text-lg font-bold">Where ORBITX lives</h3>
        </div>
        <ul className="mt-4 space-y-2.5">
          {[
            ["Trade it", "Ranked markets, live charts, one-tap execution in the trade app."],
            ["Spend it", "Shop credits, City assets, and premium surfaces across the platform."],
            ["Burn it", "Deflationary events permanently reduce supply."],
            ["Flex it", "Tips, copy-trading, and caller leaderboards in the Social Center."],
          ].map(([t, d]) => (
            <li key={t} className="flex gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-teal-300" />
              <div>
                <p className="text-sm font-bold">{t}</p>
                <p className="mt-0.5 text-[13px] text-white/50">{d}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <p className="pb-2 text-center text-[11px] text-white/30">
        Not financial advice. Crypto is volatile — never trade more than you can afford to lose.
      </p>
    </article>
  );
}

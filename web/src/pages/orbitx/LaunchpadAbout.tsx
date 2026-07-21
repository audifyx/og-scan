// OrbitX Launchpad — About. A real, premium-company-style overview page:
// live platform stats pulled from the same registry + market data every
// other launchpad page uses (no fabricated numbers), an honest roadmap,
// core features, tech stack, and an expandable FAQ.
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ShieldCheck, Droplets, Coins, Wand2, Flame, Rocket, TrendingUp, Users,
  Trophy, LineChart as LineChartIcon, Layers, Database, Lock, Globe,
  ChevronDown, MessageCircle, Send, Twitter, Sparkles,
} from "lucide-react";
import { listTokens } from "@/lib/orbitx/registry";
import { useMarketMap, fmtCompactUsd, fmtInt } from "./lpx";
import { GRADUATION_MC_USD } from "./_shared";

function InfoCard({ icon: Icon, title, children }: { icon: React.ComponentType<{ className?: string }>; title: string; children: React.ReactNode }) {
  return (
    <div className="og-glass-card lift p-5">
      <div className="mb-2.5 flex items-center gap-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-[hsl(var(--og-gold))]/25 bg-[hsl(var(--og-gold))]/10"><Icon className="h-4 w-4 text-[hsl(var(--og-gold))]" /></div>
        <h3 className="font-display text-sm font-bold uppercase tracking-wide text-foreground">{title}</h3>
      </div>
      <div className="text-sm leading-relaxed text-muted-foreground">{children}</div>
    </div>
  );
}

function StatCard({ label, value, icon: Icon }: { label: string; value: React.ReactNode; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="pf-card p-4 text-center">
      <Icon className="mx-auto mb-2 h-4 w-4 text-[hsl(var(--pf-green))]" />
      <div className="text-xl font-black text-[hsl(var(--pf-ink))] sm:text-2xl">{value}</div>
      <div className="pf-mono mt-1 text-[9px] uppercase tracking-widest text-[hsl(var(--pf-muted))]">{label}</div>
    </div>
  );
}

const TIMELINE = [
  { tag: "Live", title: "Pump-style launch lane", body: "Zero-liquidity bonding-curve launches on Solana mainnet with creator fee claiming, live-priced via DexScreener." },
  { tag: "Live", title: "Custom SPL / Token-2022 lane", body: "Full-control mints with revocable authorities, Metaplex metadata, optional Raydium CPMM pools, and LP burn/lock." },
  { tag: "Live", title: "Anti-Vamp originality protection", body: "Real-time, cross-platform (OrbitX registry + pump.fun + DexScreener) name/ticker collision detection that blocks clones before they can launch." },
  { tag: "Live", title: "obx vanity contract addresses", body: "Every OrbitX launch grinds a vanity mint address ending in \"obx\" — an on-brand, recognizable identity for every token." },
  { tag: "Next", title: "Creator analytics + achievements", body: "Deeper per-creator performance history, exportable reports, and unlockable milestones tied to real on-chain activity." },
  { tag: "Later", title: "OrbitX NFT Hub", body: "On-chain NFT + collection creation alongside the token launchpad, under the same anti-vamp identity protection." },
] as const;

const FEATURES = [
  { icon: TrendingUp, title: "Pump Launches", desc: "Instant bonding-curve launches — no liquidity to seed, fastest path to trading.", to: "/orbitxlaunch/create/pump" },
  { icon: Wand2, title: "Custom SPL Launches", desc: "Your own mint with full control over supply, authorities, and liquidity.", to: "/orbitxlaunch/create/custom" },
  { icon: Coins, title: "Claim Fees", desc: "Claim your creator fees in-app with the same wallet that launched.", to: "/orbitxlaunch/claim" },
  { icon: Trophy, title: "Leaderboards", desc: "Top creators and top tokens, ranked by real graduations and market cap.", to: "/orbitxlaunch/leaderboard" },
  { icon: Users, title: "Creator Profiles", desc: "A public, wallet-native profile for every creator's launch history.", to: "/orbitxlaunch/profile" },
  { icon: LineChartIcon, title: "Portfolio", desc: "Track your holdings, launches, and performance in one place.", to: "/orbitxlaunch/portfolio" },
] as const;

const STACK = [
  { name: "Solana mainnet", desc: "All launches settle on-chain, in real time." },
  { name: "SPL Token / Token-2022", desc: "Standard and next-gen token programs, your choice of lane." },
  { name: "Metaplex metadata", desc: "On-chain name, symbol, image, and links for every mint." },
  { name: "Raydium / Meteora / Orca CPMM", desc: "Optional seeded liquidity pools on the custom lane." },
  { name: "pump.fun bonding curve", desc: "Battle-tested price discovery for the pump lane." },
  { name: "DexScreener live data", desc: "Real-time price, volume, and liquidity across the platform." },
  { name: "Supabase", desc: "The OrbitX registry — unique name/ticker/CA enforcement + anti-vamp detection." },
] as const;

const FAQ = [
  { q: "What is OrbitX Launchpad?", a: "A Solana token launchpad with two lanes — a pump.fun-style bonding curve and a fully custom SPL/Token-2022 mint — both protected by OrbitX's Anti-Vamp originality system and both minting a recognizable \"obx\" vanity contract address." },
  { q: "What is Anti-Vamp protection?", a: "Before any launch, OrbitX checks the proposed name and ticker against its own registry, pump.fun's live listings, and DexScreener in real time. An exact or near-exact match blocks the launch outright; a looser match still launches but routes creator fees to the OBX buyback wallet instead of the copycat." },
  { q: "What does it cost to launch?", a: "Both lanes charge the same flat launch fee (frequently run as a free promo — check the banner on the Choose Launch page for the current rate) plus the standard Solana network fee. Creator fees are separate and go to you." },
  { q: "How do I claim my creator fees?", a: "Connect the same wallet you launched with and go to Claim Fees. Fees can be claimed in-app at any time." },
  { q: "What's the \"obx\" vanity address?", a: "Every OrbitX launch vanity-grinds its mint address so it ends in \"obx\" — a recognizable, on-brand identity for every token launched through the platform." },
  { q: "Can I add liquidity myself?", a: "Yes, on the custom SPL lane you can optionally seed a Raydium CPMM pool with your own SOL at launch, and burn or time-lock the LP for trust." },
] as const;

export default function LaunchpadAbout() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const { data: launches } = useQuery({
    queryKey: ["orbitx-about-stats"],
    queryFn: () => listTokens("all", 500),
    staleTime: 60_000,
  });
  const mints = useMemo(() => (launches ?? []).map((t) => t.mint_address), [launches]);
  const { data: markets } = useMarketMap(mints);

  const stats = useMemo(() => {
    const tokens = launches ?? [];
    const creators = new Set(tokens.map((t) => t.creator_wallet)).size;
    const graduated = tokens.filter((t) => t.lp_pool_address || t.graduated_at || (markets?.[t.mint_address]?.mcap ?? 0) >= GRADUATION_MC_USD).length;
    const totalMcap = mints.reduce((a, m) => a + (markets?.[m]?.mcap ?? 0), 0);
    const totalVol24 = mints.reduce((a, m) => a + (markets?.[m]?.vol24 ?? 0), 0);
    return { totalLaunches: tokens.length, creators, graduated, totalMcap, totalVol24 };
  }, [launches, markets, mints]);

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6">
        <div className="font-mono text-[11px] uppercase tracking-[0.3em] text-muted-foreground">// how it works</div>
        <h1 className="mt-2 font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">About OrbitX Launchpad</h1>
        <p className="mt-1 text-sm text-muted-foreground">Two launch lanes — <span className="text-[hsl(var(--og-cyan))]">Pump-style</span> bonding curve or a fully <span className="text-[hsl(var(--og-gold))]">Custom</span> SPL mint — with clone protection baked in.</p>
      </div>

      {/* Platform statistics — real, live numbers from the registry + DexScreener */}
      <SectionHeading icon={Sparkles} title="Platform statistics" desc="Live numbers, not marketing copy — pulled from the same data every launchpad page uses." />
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Tokens launched" value={fmtInt(stats.totalLaunches)} icon={Rocket} />
        <StatCard label="Graduated" value={fmtInt(stats.graduated)} icon={Droplets} />
        <StatCard label="Active creators" value={fmtInt(stats.creators)} icon={Users} />
        <StatCard label="Combined market cap" value={fmtCompactUsd(stats.totalMcap)} icon={Coins} />
      </div>

      {/* Mechanics */}
      <SectionHeading icon={Layers} title="The mechanics" />
      <div className="mb-8 grid gap-3 sm:grid-cols-2">
        <InfoCard icon={TrendingUp} title="Pump-style lane">
          Launch instantly with no liquidity to seed — price and liquidity build from buys &amp; sells on a bonding curve, then auto-graduate to a real pool. Fastest, cheapest way to get trading.
        </InfoCard>
        <InfoCard icon={Coins} title="Custom SPL mint">
          The custom lane creates a real SPL token with Metaplex metadata — its own supply, decimals, and authorities you control (and can revoke for trust). No shared curve, full control.
        </InfoCard>
        <InfoCard icon={Wand2} title="Vanity CA under “obx”">
          Both lanes vanity-grind the contract address so it starts with <span className="font-mono text-[hsl(var(--og-gold))]">obx</span> — an on-brand, recognizable CA for every Orbitx token.
        </InfoCard>
        <InfoCard icon={ShieldCheck} title="Anti-vamp: no clones">
          Names and tickers are checked in real time against OrbitX's own registry, pump.fun, and DexScreener. An exact or near-exact match blocks the launch outright before any fee is paid.
        </InfoCard>
        <InfoCard icon={Flame} title="Vamp penalty">
          If a copycat slips through as a borderline match, it can launch but its creator fees are force-routed to <span className="text-foreground">OBX buybacks</span> — a copy earns the original nothing.
        </InfoCard>
        <InfoCard icon={Droplets} title="Custom liquidity">
          On the custom lane, seed a pool on Raydium/Meteora/Orca at launch. The SOL you add is <span className="text-foreground">your capital</span> (recoverable, or lock/burn for trust). Only true extra cost is the DEX's ~0.15 SOL pool fee.
        </InfoCard>
      </div>

      {/* Core features */}
      <SectionHeading icon={Rocket} title="Core features" />
      <div className="mb-8 grid gap-3 sm:grid-cols-2 md:grid-cols-3">
        {FEATURES.map((f) => (
          <Link key={f.title} to={f.to} className="pf-card group flex flex-col gap-2 p-4 transition hover:border-[hsl(var(--pf-green))]">
            <f.icon className="h-5 w-5 text-[hsl(var(--pf-green))]" />
            <div className="text-sm font-black text-[hsl(var(--pf-ink))]">{f.title}</div>
            <div className="text-xs leading-relaxed text-[hsl(var(--pf-muted))]">{f.desc}</div>
          </Link>
        ))}
      </div>

      {/* Roadmap / timeline */}
      <SectionHeading icon={Trophy} title="Roadmap" desc="Where OrbitX Launchpad is today, and what's next." />
      <div className="mb-8 space-y-3">
        {TIMELINE.map((item, i) => (
          <div key={item.title} className="pf-card flex gap-4 p-4">
            <div className="flex flex-col items-center">
              <span className={`rounded-full px-2 py-0.5 pf-mono text-[9px] font-bold uppercase tracking-widest ${
                item.tag === "Live" ? "bg-[hsl(var(--pf-green))]/15 text-[hsl(var(--pf-green))]" :
                item.tag === "Next" ? "bg-[hsl(var(--pf-gold))]/15 text-[hsl(var(--pf-gold))]" :
                "bg-white/5 text-[hsl(var(--pf-muted))]"
              }`}>{item.tag}</span>
              {i < TIMELINE.length - 1 && <div className="mt-1 w-px flex-1 bg-[hsl(var(--pf-border))]" />}
            </div>
            <div className="pb-2">
              <div className="text-sm font-bold text-[hsl(var(--pf-ink))]">{item.title}</div>
              <div className="mt-0.5 text-xs leading-relaxed text-[hsl(var(--pf-muted))]">{item.body}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Technology stack */}
      <SectionHeading icon={Database} title="Technology" />
      <div className="mb-8 grid gap-2 sm:grid-cols-2">
        {STACK.map((s) => (
          <div key={s.name} className="pf-card flex items-start gap-2.5 p-3">
            <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[hsl(var(--pf-green))]" />
            <div>
              <div className="text-xs font-bold text-[hsl(var(--pf-ink))]">{s.name}</div>
              <div className="text-[11px] text-[hsl(var(--pf-muted))]">{s.desc}</div>
            </div>
          </div>
        ))}
      </div>

      {/* FAQ */}
      <SectionHeading icon={Globe} title="FAQ" />
      <div className="mb-8 space-y-2">
        {FAQ.map((item, i) => {
          const open = openFaq === i;
          return (
            <div key={item.q} className="pf-card overflow-hidden">
              <button onClick={() => setOpenFaq(open ? null : i)} className="flex w-full items-center justify-between gap-3 p-4 text-left">
                <span className="text-sm font-bold text-[hsl(var(--pf-ink))]">{item.q}</span>
                <ChevronDown className={`h-4 w-4 shrink-0 text-[hsl(var(--pf-muted))] transition-transform ${open ? "rotate-180" : ""}`} />
              </button>
              {open && <div className="px-4 pb-4 text-sm leading-relaxed text-[hsl(var(--pf-muted))]">{item.a}</div>}
            </div>
          );
        })}
      </div>

      {/* Contact / community */}
      <div className="og-glass-card mb-8 border-[hsl(var(--og-cyan))]/25 p-5">
        <div className="mb-3 flex items-center gap-2">
          <MessageCircle className="h-4 w-4 text-[hsl(var(--og-cyan))]" />
          <h3 className="font-display text-sm font-bold uppercase tracking-wide text-[hsl(var(--og-cyan))]">Contact &amp; community</h3>
        </div>
        <p className="mb-3 text-sm text-muted-foreground">Questions, bug reports, or feedback — reach the team directly.</p>
        <div className="flex flex-wrap gap-2">
          <a href="https://t.me/ogscan" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-[hsl(var(--pf-border))] px-3 py-2 text-xs font-bold text-[hsl(var(--pf-ink))] hover:border-[hsl(var(--og-cyan))]"><Send className="h-3.5 w-3.5" /> Telegram</a>
          <a href="https://x.com/ogscan" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-[hsl(var(--pf-border))] px-3 py-2 text-xs font-bold text-[hsl(var(--pf-ink))] hover:border-[hsl(var(--og-cyan))]"><Twitter className="h-3.5 w-3.5" /> X / Twitter</a>
        </div>
      </div>

      <div className="mt-6 flex justify-center">
        <Link to="/orbitxlaunch/create" className="inline-flex items-center gap-1.5 rounded-lg border border-[hsl(var(--og-gold))]/50 bg-[hsl(var(--og-gold))]/15 px-6 py-3 font-display text-xs font-bold uppercase tracking-wider text-[hsl(var(--og-gold))] transition hover:bg-[hsl(var(--og-gold))]/25"><Rocket className="h-4 w-4" /> Launch a token</Link>
      </div>
    </div>
  );
}

function SectionHeading({ icon: Icon, title, desc }: { icon: React.ComponentType<{ className?: string }>; title: string; desc?: string }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <Icon className="h-4 w-4 text-[hsl(var(--pf-gold))]" />
      <h2 className="text-sm font-black uppercase tracking-wide text-[hsl(var(--pf-ink))]">{title}</h2>
      {desc && <span className="hidden text-xs text-[hsl(var(--pf-muted))] sm:inline">— {desc}</span>}
    </div>
  );
}

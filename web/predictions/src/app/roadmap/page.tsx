import Link from 'next/link';
import { ArrowLeft, ArrowRight, Rocket, TrendingUp, Coins, Users, ShieldCheck, LineChart, Layers } from 'lucide-react';

export const metadata = { title: 'Roadmap — OrbitX' };

const PHASES = [
  { icon: Rocket, n: 'Phase 1', title: 'Foundation', items: [
    'Build and launch the OrbitX prediction market platform',
    'Establish core market creation, settlement, and pool infrastructure',
    'Deliver a simple and transparent on-chain user experience',
  ]},
  { icon: TrendingUp, n: 'Phase 2', title: 'Growth', items: [
    'Increase pool activity and market participation',
    'Expand supported market categories and community-created events',
    'Optimize liquidity and user engagement across the platform',
  ]},
  { icon: Coins, n: 'Phase 3', title: 'Ecosystem', items: [
    'Fund ecosystem growth through transparent, sustainable platform fees',
    'Introduce community rewards and platform utility',
    'Accelerate platform expansion through sustainable funding',
  ]},
  { icon: Users, n: 'Phase 4', title: 'Community', items: [
    'Grow the OrbitX community across crypto, sports, entertainment, and prediction market audiences',
    'Empower creators to launch and manage their own markets',
    'Build a strong community-driven ecosystem',
  ]},
  { icon: ShieldCheck, n: 'Phase 5', title: 'Escrow Infrastructure', items: [
    'Launch a peer-to-peer escrow service for Solana-based tokens and coins',
    'Enable trust-minimized transactions between users',
    'Expand OrbitX beyond prediction markets into broader on-chain commerce',
  ]},
  { icon: LineChart, n: 'Phase 6', title: 'Trading Expansion', items: [
    'Build a perpetual futures trading platform directly inside the OrbitX app',
    'Offer seamless access to on-chain perps trading',
    'Create an all-in-one destination for prediction markets, escrow services, and trading on Solana',
  ]},
];

export default function RoadmapPage() {
  return (
    <div className="min-h-screen max-w-4xl mx-auto px-4 py-16">
      <Link href="/" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white mb-8"><ArrowLeft size={14} /> Back home</Link>

      <div className="flex items-center gap-2 text-xs text-cyan font-semibold mb-3"><Layers size={14} /> OrbitX Roadmap</div>
      <h1 className="font-display text-4xl font-extrabold mb-3">The road to a full <span className="gradient-text">on-chain ecosystem</span></h1>
      <p className="text-slate-300 mb-12 leading-relaxed max-w-2xl">From prediction markets to escrow and trading, OrbitX is building a unified platform on Solana. Here is how we get there.</p>

      <div className="relative">
        <div className="absolute left-[22px] top-2 bottom-2 w-px bg-gradient-to-b from-cyan/40 via-purple/30 to-transparent hidden sm:block" />
        <div className="space-y-5">
          {PHASES.map(({ icon: Icon, n, title, items }) => (
            <div key={n} className="relative sm:pl-16">
              <div className="hidden sm:flex absolute left-0 top-5 w-11 h-11 rounded-xl bg-card border border-white/10 items-center justify-center text-cyan z-10"><Icon size={20} /></div>
              <div className="glass-card rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-3">
                  <span className="sm:hidden w-9 h-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-cyan shrink-0"><Icon size={16} /></span>
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-widest text-cyan">{n}</span>
                    <h2 className="font-display text-xl font-extrabold text-white leading-tight">{title}</h2>
                  </div>
                </div>
                <ul className="space-y-2">
                  {items.map((it) => (
                    <li key={it} className="flex gap-2.5 text-sm text-slate-300 leading-relaxed">
                      <span className="text-cyan mt-1.5 shrink-0 w-1.5 h-1.5 rounded-full bg-cyan" />
                      <span>{it}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="text-center mt-14">
        <p className="font-display text-2xl font-extrabold leading-snug">
          One Platform.<br />Multiple Markets.<br /><span className="gradient-text">Powered by Solana.</span>
        </p>
        <div className="mt-7 flex items-center justify-center gap-4 flex-wrap">
          <Link href="/whitepaper" className="btn-ghost">Read the whitepaper <ArrowRight size={15} /></Link>
          <Link href="/app" className="btn-primary">Enter the app <ArrowRight size={15} /></Link>
        </div>
      </div>
    </div>
  );
}

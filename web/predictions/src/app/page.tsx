'use client';
import Link from 'next/link'
import { GAME_META } from '@/lib/games/match-meta';
import { useState, useEffect } from 'react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useWallet } from '@solana/wallet-adapter-react';
import { useRouter } from 'next/navigation';
import { SplashBackground } from '@/components/SplashBackground';
import { Reveal } from '@/components/Reveal';
import {
  ChevronDown, Flame, ArrowRight, ArrowUpRight, Shield, TrendingUp, Zap, Globe,
  MousePointerClick, Coins, Trophy, Bitcoin, Landmark, Laugh, Film, Cpu, Gamepad2,
  Send, Sparkles, Layers, Menu, X as CloseIcon, BadgeCheck, Megaphone,
} from 'lucide-react';

const MOCK = [
  { cat: 'Crypto', icon: Bitcoin, q: 'Will SOL close above $300 this month?', yes: 63, pool: '182.4' },
  { cat: 'Sports', icon: Trophy, q: 'Will the home side win Saturday\u2019s final?', yes: 47, pool: '96.8' },
  { cat: 'Politics', icon: Landmark, q: 'Will turnout top 60% this election?', yes: 55, pool: '74.2' },
  { cat: 'Memes', icon: Laugh, q: 'Will this week\u2019s top memecoin 10x?', yes: 31, pool: '53.2' },
  { cat: 'Entertainment', icon: Film, q: 'Will the album debut at #1?', yes: 68, pool: '41.9' },
  { cat: 'Tech', icon: Cpu, q: 'Will the new AI model top the leaderboard?', yes: 52, pool: '88.6' },
];

const STEPS = [
  { icon: MousePointerClick, title: 'Pick a side', desc: 'Browse community markets and choose the outcome you believe in.' },
  { icon: Coins, title: 'Stake SOL', desc: 'Send your stake to the on-chain pool, verified by transaction.' },
  { icon: Trophy, title: 'Win the pool', desc: 'When the market settles, winners split the pool by their share.' },
];

const FEATURES = [
  { icon: Shield, title: 'On-chain verified', desc: 'Every deposit is verified on Solana.' },
  { icon: TrendingUp, title: 'Parimutuel payouts', desc: 'No house odds. Winners split the losing side.' },
  { icon: Zap, title: 'Fast settlement', desc: '~400ms finality on Solana.' },
  { icon: Globe, title: 'Fully transparent', desc: 'Pools, fees and payouts are public.' },
];

const FAQS = [
  { q: 'What is OrbitX?', a: 'OrbitX is a fully on-chain prediction market built on Solana where anyone can create or join prediction pools using SOL. Instead of betting against a sportsbook, users compete against each other in a shared pool. When the outcome is settled, the winners split the pool proportionally based on their stake. No market makers, no hidden odds, and no house taking the opposite side of your bet.' },
  { q: 'How do payouts work on OrbitX?', a: 'Every market uses a parimutuel pool. Participants contribute to a shared prize pool by choosing a side. Once the outcome is settled, a small platform fee is deducted and the remaining pool is distributed among the winners based on their share of the winning side. The fewer winners and the larger the losing side, the larger the payout.' },
  { q: 'Why did we build OrbitX on Solana?', a: 'Prediction markets require fast transactions, low fees, and transparent settlement. Solana lets anyone create and participate without expensive gas or slow confirmations. Every bet, pool, and settlement happens on-chain.' },
  { q: 'Can anyone create a market on OrbitX?', a: 'Yes. Anyone can create markets and invite others to participate, across crypto, sports, politics, entertainment, and internet culture. The goal is to make prediction markets as accessible and permissionless as possible.' },
];

const NAV_LINKS = [
  { href: '/app', label: 'Markets' },
  { href: '/app/games', label: 'Games' },
  { href: '/how-it-works', label: 'How it works' },
  { href: '/roadmap', label: 'Roadmap' },
  { href: '/whitepaper', label: 'Whitepaper' },
];

const STATS = [
  { k: '100+', v: 'Live markets' },
  { k: '7', v: 'Market categories' },
  { k: '~400ms', v: 'Solana settlement' },
  { k: '0', v: 'House edge — peer-to-pool' },
];

function Faq({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <button onClick={() => setOpen(o => !o)} className={`w-full text-left rounded-2xl p-5 border transition-all duration-300 ${open ? 'bg-white/[0.05] border-cyan/30 shadow-[0_10px_40px_-18px_rgba(61,139,255,.4)]' : 'bg-white/[0.03] border-white/10 hover:border-white/25'}`}>
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-bold text-white">{q}</h3>
        <span className={`shrink-0 w-7 h-7 rounded-full border grid place-items-center transition-all duration-300 ${open ? 'border-cyan/50 bg-cyan/15 text-cyan rotate-180' : 'border-white/15 text-slate-300'}`}>
          <ChevronDown size={15} />
        </span>
      </div>
      <div className={`grid transition-all duration-300 ease-out ${open ? 'grid-rows-[1fr] opacity-100 mt-3' : 'grid-rows-[0fr] opacity-0'}`}>
        <p className="overflow-hidden text-sm text-gray-400 leading-relaxed">{a}</p>
      </div>
    </button>
  );
}

export default function LandingPage() {
  const { connected } = useWallet();
  const router = useRouter();
  const [menu, setMenu] = useState(false);
  useEffect(() => { if (connected) router.push('/app'); }, [connected, router]);

  return (
    <div className="relative min-h-screen overflow-x-hidden text-white">
      <SplashBackground />

      {/* ───────────────────────── Header ───────────────────────── */}
      <nav className="sticky top-0 z-50 glass border-b border-white/10">
        <span className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-cyan/40 to-transparent" />
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-3">
          <Link href="/" className="group flex items-center gap-2.5">
            <span className="relative">
              <img src="/orbitx-mark.png" alt="OrbitX" className="h-8 w-8 rounded-lg transition-transform duration-300 group-hover:rotate-6 group-hover:scale-105" />
              <span className="absolute inset-0 rounded-lg bg-cyan/30 blur-md opacity-0 group-hover:opacity-60 transition-opacity -z-10" />
            </span>
            <span className="leading-none">
              <span className="block font-display font-bold tracking-tight text-lg">OrbitX</span>
              <span className="block text-[9px] font-bold uppercase tracking-[0.22em] text-cyan/80 mt-0.5">Prediction Market</span>
            </span>
          </Link>

          <div className="hidden lg:flex items-center gap-1">
            {NAV_LINKS.map(l => <Link key={l.href} href={l.href} className="nav-link">{l.label}</Link>)}
          </div>

          <div className="flex items-center gap-2">
            <Link href="/auth?mode=signin" className="hidden sm:inline-flex text-sm font-semibold text-white px-3.5 py-2 rounded-xl border border-transparent hover:border-white/15 hover:bg-white/5 transition-all">Sign in</Link>
            <Link href="/auth?mode=signup" className="btn-primary !py-2 !px-4 text-sm">Sign up <ArrowRight size={14} /></Link>
            <button onClick={() => setMenu(m => !m)} aria-label="Menu" className="lg:hidden w-9 h-9 grid place-items-center rounded-xl border border-white/10 bg-white/5 text-slate-200">
              {menu ? <CloseIcon size={17} /> : <Menu size={17} />}
            </button>
          </div>
        </div>
        {menu && (
          <div className="lg:hidden border-t border-white/10 bg-black/80 backdrop-blur-xl animate-risein">
            <div className="max-w-7xl mx-auto px-4 py-3 grid gap-1">
              {NAV_LINKS.map(l => (
                <Link key={l.href} href={l.href} onClick={() => setMenu(false)} className="px-3 py-2.5 rounded-xl text-sm font-semibold text-slate-200 hover:bg-white/5 hover:text-white transition-colors">{l.label}</Link>
              ))}
            </div>
          </div>
        )}
      </nav>

      {/* ───────────────────── Rebrand announcement ───────────────────── */}
      <Link href="/announcement" className="block relative z-10 group">
        <div className="mx-auto max-w-3xl mt-4 px-4">
          <div className="rounded-full border border-cyan/25 bg-gradient-to-r from-cyan/10 via-purple/10 to-transparent px-5 py-2 flex items-center justify-center gap-2 text-center text-[13px] group-hover:border-cyan/50 transition-colors">
            <Sparkles size={13} className="text-cyan shrink-0" />
            <span className="text-white font-semibold">SOLNO is now OrbitX Prediction Market.</span>
            <span className="text-cyan font-bold inline-flex items-center gap-1 group-hover:gap-1.5 transition-all">Read more <ArrowRight size={12} /></span>
          </div>
        </div>
      </Link>

      {/* ───────────────────────── Hero ───────────────────────── */}
      <section className="relative px-4 pt-20 pb-14 text-center">
        {/* Orbit ring decorations */}
        <div aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
          <span className="orbit-ring orbit-ring--spin w-[54rem] h-[54rem] opacity-60" style={{ borderColor: 'rgba(61,139,255,.10)', borderTopColor: 'rgba(61,139,255,.35)' }} />
          <span className="orbit-ring orbit-ring--spin-rev w-[38rem] h-[38rem]" style={{ borderColor: 'rgba(168,85,247,.10)', borderBottomColor: 'rgba(168,85,247,.32)' }} />
        </div>

        <div className="relative max-w-3xl mx-auto">
          <Reveal>
            <div className="section-eyebrow mb-7"><Flame size={12} /> Peer-to-pool markets &amp; games on Solana</div>
          </Reveal>
          <Reveal delay={80}>
            <h1 className="font-display text-5xl md:text-7xl font-bold leading-[1.02] tracking-tight text-balance">
              Predict the future.<br /><span className="gradient-text text-glow">Win the pool.</span>
            </h1>
          </Reveal>
          <Reveal delay={160}>
            <p className="mt-6 text-lg text-gray-300 max-w-2xl mx-auto text-balance">Trade real-world outcomes across crypto, sports, politics and culture — against the crowd, never the house. Pick a side, stake SOL, split the pool when you&rsquo;re right.</p>
          </Reveal>
          <Reveal delay={240}>
            <div className="mt-9 flex items-center justify-center gap-3 flex-wrap">
              <Link href="/auth?mode=signup" className="btn-primary">Get started <ArrowRight size={16} /></Link>
              <Link href="/app" className="btn-ghost">Explore markets <ArrowUpRight size={15} /></Link>
              <Link href="/app/games" className="btn-ghost"><Gamepad2 size={16} /> Play games</Link>
            </div>
            <div className="mt-5 flex justify-center"><WalletMultiButton /></div>
          </Reveal>
          <Reveal delay={320}>
            <div className="mt-10 grid grid-cols-2 md:grid-cols-4 gap-3 max-w-3xl mx-auto">
              {STATS.map(({ k, v }) => (
                <div key={v} className="glass-card rounded-2xl px-4 py-4">
                  <p className="font-display text-2xl font-bold gradient-text num">{k}</p>
                  <p className="text-[11px] text-slate-400 mt-1 font-medium">{v}</p>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ───────────────────── Market ticker ───────────────────── */}
      <div className="relative py-2 mb-14 marquee">
        <div className="marquee-track">
          {[...MOCK, ...MOCK].map(({ cat, icon: Icon, q, yes }, i) => (
            <Link key={i} href="/app" className="flex items-center gap-2.5 rounded-full border border-white/10 bg-white/[0.03] pl-3 pr-4 py-2 text-sm whitespace-nowrap hover:border-cyan/35 hover:bg-white/[0.06] transition-colors">
              <span className="w-6 h-6 rounded-full bg-cyan/10 border border-cyan/25 grid place-items-center text-cyan"><Icon size={12} /></span>
              <span className="text-slate-200 font-medium">{q}</span>
              <span className="text-win font-bold num">{yes}%</span>
              <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">{cat}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* ───────────────────── Example markets ───────────────────── */}
      <section className="relative max-w-5xl mx-auto px-4 pb-24">
        <Reveal>
          <div className="text-center mb-9">
            <div className="section-eyebrow mb-4"><TrendingUp size={12} /> Markets</div>
            <h2 className="font-display text-3xl md:text-4xl font-bold">A taste of the markets</h2>
            <p className="text-gray-400 text-sm mt-2">Examples of what you can predict. Live markets are inside the app.</p>
          </div>
        </Reveal>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {MOCK.map(({ cat, icon: Icon, q, yes, pool }, i) => (
            <Reveal key={q} delay={i * 70}>
              <div className="glass-card group rounded-2xl p-5 hover:-translate-y-1.5 cursor-default h-full">
                <div className="flex items-center justify-between mb-3">
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-cyan">
                    <span className="w-6 h-6 rounded-lg bg-cyan/10 border border-cyan/25 grid place-items-center"><Icon size={12} /></span> {cat}
                  </span>
                  <span className="text-[10px] font-bold text-black bg-cyan/90 px-2 py-0.5 rounded-full">Example</span>
                </div>
                <p className="font-semibold text-white leading-snug min-h-[44px]">{q}</p>
                <div className="mt-4 h-2 rounded-full overflow-hidden bg-loss/25 flex">
                  <div className="outcome-bar h-full bg-gradient-to-r from-win to-win/70 shadow-[0_0_12px_rgba(34,197,94,.5)]" style={{ width: `${yes}%` }} />
                </div>
                <div className="mt-2.5 flex items-center justify-between text-xs">
                  <span className="text-win font-bold num">Yes {yes}%</span>
                  <span className="text-loss font-bold num">No {100 - yes}%</span>
                </div>
                <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-xs text-gray-500">
                  <span className="inline-flex items-center gap-1"><Coins size={11} /> Pool</span>
                  <span className="text-white font-bold num">◎ {pool} SOL</span>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
        <Reveal>
          <div className="text-center mt-8"><Link href="/app" className="inline-flex items-center gap-1.5 text-sm font-bold text-cyan hover:gap-2.5 transition-all">See all live markets <ArrowRight size={14} /></Link></div>
        </Reveal>
      </section>

      {/* ───────────────────── Example games ───────────────────── */}
      <section className="relative max-w-5xl mx-auto px-4 pb-24">
        <Reveal>
          <div className="text-center mb-9">
            <div className="section-eyebrow mb-4"><Gamepad2 size={12} /> Games</div>
            <h2 className="font-display text-3xl md:text-4xl font-bold">A taste of the games</h2>
            <p className="text-gray-400 text-sm mt-2">Provably-fair 1v1 games. Stake SOL, beat your opponent, take the pot.</p>
          </div>
        </Reveal>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {GAME_META.slice(0, 8).map((g, i) => (
            <Reveal key={g.id} delay={i * 50}>
              <div className="glass-card group rounded-2xl p-4 h-full hover:-translate-y-1.5 hover:rotate-[0.4deg] transition-all">
                <div className="flex items-center justify-between mb-3">
                  <span className="w-11 h-11 rounded-xl bg-gradient-to-br from-cyan/15 to-purple/15 border border-white/10 grid place-items-center text-2xl leading-none transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6">{g.emoji}</span>
                  <span className="text-[10px] font-bold text-cyan border border-cyan/30 bg-cyan/10 px-2 py-0.5 rounded-full">1v1</span>
                </div>
                <p className="font-bold text-white leading-tight">{g.label}</p>
                <p className="text-xs text-gray-400 mt-1 leading-snug min-h-[32px]">{g.blurb}</p>
              </div>
            </Reveal>
          ))}
        </div>
        <Reveal>
          <div className="text-center mt-8"><Link href="/app/games" className="inline-flex items-center gap-1.5 text-sm font-bold text-cyan hover:gap-2.5 transition-all">Play all games <ArrowRight size={14} /></Link></div>
        </Reveal>
      </section>

      {/* ───────────────────── How it works ───────────────────── */}
      <section className="relative max-w-6xl mx-auto px-4 pb-24">
        <Reveal>
          <div className="text-center mb-10">
            <div className="section-eyebrow mb-4"><Zap size={12} /> Simple by design</div>
            <h2 className="font-display text-3xl md:text-4xl font-bold">How it works</h2>
          </div>
        </Reveal>
        <div className="relative grid md:grid-cols-3 gap-4">
          <span aria-hidden className="hidden md:block absolute top-[54px] left-[16%] right-[16%] h-px bg-gradient-to-r from-cyan/40 via-purple/40 to-win/40" />
          {STEPS.map(({ icon: Icon, title, desc }, i) => (
            <Reveal key={title} delay={i * 110}>
              <div className="glass-card relative rounded-2xl p-6 h-full">
                <span className="absolute top-5 right-5 font-display text-5xl font-bold text-white/[0.04]">{i + 1}</span>
                <div className="relative w-12 h-12 rounded-2xl bg-cyan/10 border border-cyan/25 flex items-center justify-center text-cyan mb-4 shadow-[0_0_24px_-6px_rgba(61,139,255,.5)]"><Icon size={21} /></div>
                <h3 className="font-display font-bold text-white text-lg">{title}</h3>
                <p className="text-sm text-gray-400 mt-1.5 leading-relaxed">{desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ───────────────────── Features ───────────────────── */}
      <section className="relative max-w-6xl mx-auto px-4 pb-24">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {FEATURES.map(({ icon: Icon, title, desc }, i) => (
            <Reveal key={title} delay={i * 70}>
              <div className="glass-card rounded-2xl p-5 h-full group">
                <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-cyan mb-3 transition-all duration-300 group-hover:bg-cyan/10 group-hover:border-cyan/30 group-hover:scale-110"><Icon size={18} /></div>
                <h3 className="font-bold text-white text-sm">{title}</h3>
                <p className="text-xs text-gray-400 mt-1.5 leading-snug">{desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ───────────────────── Roadmap preview ───────────────────── */}
      <section className="relative max-w-6xl mx-auto px-4 pb-24">
        <Reveal>
          <div className="text-center mb-9">
            <div className="section-eyebrow mb-4" style={{ color: 'var(--violet)', borderColor: 'rgba(168,85,247,.25)', background: 'rgba(168,85,247,.08)' }}><Layers size={12} /> Features we&rsquo;re working on</div>
            <h2 className="font-display text-3xl md:text-4xl font-bold">What&rsquo;s next for OrbitX</h2>
            <p className="text-gray-400 text-sm mt-2 max-w-2xl mx-auto">We&rsquo;re building toward a full on-chain ecosystem. Here&rsquo;s a look at what&rsquo;s coming.</p>
          </div>
        </Reveal>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { icon: MousePointerClick, tag: 'Phase 2', title: 'Community-created markets', desc: 'Anyone can launch and manage their own prediction markets across any category.' },
            { icon: Coins, tag: 'Phase 3', title: 'Ecosystem growth', desc: 'Sustainable platform fees fund development, rewards, and long-term expansion.' },
            { icon: Trophy, tag: 'Phase 4', title: 'Creator & community rewards', desc: 'Earn for creating active markets and growing the OrbitX community.' },
            { icon: Shield, tag: 'Phase 5', title: 'Peer-to-peer escrow', desc: 'Trust-minimized escrow for Solana tokens \u2014 OrbitX beyond prediction markets.' },
            { icon: TrendingUp, tag: 'Phase 6', title: 'Perpetual futures trading', desc: 'On-chain perps built directly into the OrbitX app. One platform for it all.' },
            { icon: Globe, tag: 'Vision', title: 'All-in-one on-chain hub', desc: 'Prediction markets, escrow, and trading \u2014 unified and powered by Solana.' },
          ].map(({ icon: Icon, tag, title, desc }, i) => (
            <Reveal key={title} delay={i * 60}>
              <div className="glass-card rounded-2xl p-5 h-full hover:!border-purple/35 group">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-purple/10 border border-purple/20 flex items-center justify-center text-purple transition-transform duration-300 group-hover:scale-110"><Icon size={18} /></div>
                  <span className="text-[10px] font-bold text-purple border border-purple/30 bg-purple/10 px-2 py-0.5 rounded-full">{tag}</span>
                </div>
                <h3 className="font-bold text-white text-sm">{title}</h3>
                <p className="text-xs text-gray-400 mt-1.5 leading-snug">{desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
        <Reveal>
          <div className="text-center mt-8 flex items-center justify-center gap-6 flex-wrap">
            <Link href="/roadmap" className="inline-flex items-center gap-1.5 text-sm font-bold text-cyan hover:gap-2.5 transition-all">See full roadmap <ArrowRight size={14} /></Link>
            <Link href="/whitepaper" className="inline-flex items-center gap-1.5 text-sm font-bold text-purple hover:gap-2.5 transition-all">Read the whitepaper <ArrowRight size={14} /></Link>
          </div>
        </Reveal>
      </section>

      {/* ───────────────────── FAQ ───────────────────── */}
      <section className="relative max-w-3xl mx-auto px-4 pb-24">
        <Reveal>
          <div className="text-center mb-9">
            <div className="section-eyebrow mb-4"><BadgeCheck size={12} /> FAQ</div>
            <h2 className="font-display text-3xl md:text-4xl font-bold">What is OrbitX?</h2>
          </div>
        </Reveal>
        <div className="space-y-3">
          {FAQS.map((f, i) => <Reveal key={f.q} delay={i * 60}><Faq q={f.q} a={f.a} /></Reveal>)}
        </div>
      </section>

      {/* ───────────────────── CTA ───────────────────── */}
      <section className="relative max-w-4xl mx-auto px-4 pb-24">
        <Reveal>
          <div className="gradient-border p-10 md:p-14 text-center relative overflow-hidden">
            <span aria-hidden className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-[30rem] h-[30rem] rounded-full bg-cyan/10 blur-[100px] animate-pulse-glow" />
            <img src="/orbitx-mark.png" alt="" aria-hidden className="mx-auto h-14 w-14 rounded-2xl mb-6 animate-float" />
            <h2 className="font-display text-3xl md:text-4xl font-bold text-balance">Ready to pick a side?</h2>
            <p className="text-gray-300 mt-3">Create an account or connect your wallet and join the pool.</p>
            <div className="mt-7 flex items-center justify-center gap-3 flex-wrap">
              <Link href="/auth?mode=signup" className="btn-primary">Sign up free <ArrowRight size={16} /></Link>
              <Link href="/app" className="btn-ghost">Browse markets <ArrowUpRight size={15} /></Link>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ───────────────────── Footer ───────────────────── */}
      <footer className="relative border-t border-white/10 bg-black/40 backdrop-blur-xl">
        <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-purple/40 to-transparent" />
        <div className="max-w-7xl mx-auto px-4 pt-14 pb-8">
          <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
            {/* Brand */}
            <div>
              <div className="flex items-center gap-2.5 mb-3">
                <img src="/orbitx-mark.png" alt="OrbitX" className="h-9 w-9 rounded-xl" />
                <span className="leading-none">
                  <span className="block font-display font-bold text-white text-lg tracking-tight">OrbitX</span>
                  <span className="block text-[9px] font-bold uppercase tracking-[0.22em] text-cyan/80 mt-0.5">Prediction Market</span>
                </span>
              </div>
              <p className="text-sm text-slate-400 leading-relaxed max-w-xs">The on-chain OS for Solana. Trade, scan, launch, predict and connect — all in one place.</p>
              <div className="flex items-center gap-2 mt-5">
                <a href="https://x.com/solnobet" target="_blank" rel="noopener noreferrer" aria-label="X" className="social-btn"><span className="text-[15px] font-bold leading-none">𝕏</span></a>
                <a href="https://t.me/orbitxwrld" target="_blank" rel="noopener noreferrer" aria-label="Telegram" className="social-btn"><Send size={15} /></a>
                <a href="https://t.me/OrbitXupdates" target="_blank" rel="noopener noreferrer" aria-label="Updates channel" className="social-btn"><Megaphone size={15} /></a>
                <a href="https://orbitx.world" target="_blank" rel="noopener noreferrer" aria-label="Website" className="social-btn"><Globe size={15} /></a>
              </div>
            </div>
            {/* Platform */}
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500 mb-4">Platform</p>
              <div className="grid gap-2.5">
                <Link href="/app" className="footer-link">Markets</Link>
                <Link href="/app/games" className="footer-link">Games</Link>
                <Link href="/app/arcade" className="footer-link">Arcade</Link>
                <Link href="/app/leaderboard" className="footer-link">Leaderboard</Link>
                <Link href="/app/wallet" className="footer-link">Wallet</Link>
              </div>
            </div>
            {/* Resources */}
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500 mb-4">Resources</p>
              <div className="grid gap-2.5">
                <Link href="/how-it-works" className="footer-link">How it works</Link>
                <Link href="/treasury" className="footer-link">Treasury</Link>
                <Link href="/roadmap" className="footer-link">Roadmap</Link>
                <Link href="/whitepaper" className="footer-link">Whitepaper</Link>
                <Link href="/announcement" className="footer-link">Announcement</Link>
              </div>
            </div>
            {/* Legal */}
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500 mb-4">Legal</p>
              <div className="grid gap-2.5">
                <Link href="/terms" className="footer-link">Terms of Service</Link>
                <Link href="/privacy" className="footer-link">Privacy Policy</Link>
              </div>
              <p className="text-[11px] text-slate-600 leading-relaxed mt-5">Experimental peer-to-peer software. Stake only what you can afford to lose.</p>
            </div>
          </div>

          <div className="mt-10 pt-6 border-t border-white/[0.06] flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-xs text-slate-500">© 2026 OrbitX · Built on <span className="text-slate-300 font-semibold">Solana</span></p>
            <p className="text-xs text-slate-600">Peer-to-pool · No house odds · On-chain settlement</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

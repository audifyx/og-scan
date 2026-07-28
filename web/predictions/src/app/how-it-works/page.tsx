import Link from 'next/link';
import { Wallet, Coins, Trophy, Clock, ShieldCheck, Scale, ArrowLeft } from 'lucide-react';

export const metadata = { title: 'How It Works — OrbitX' };

const STEPS = [
  { icon: Wallet, title: '1. Connect & sign in', body: 'Create an account or connect your Solana wallet (Phantom and others). Your wallet is how you deposit and receive payouts.' },
  { icon: Coins, title: '2. Pick a side and deposit', body: 'Choose an outcome on any open bet and the amount of SOL you want to stake. You send that SOL to the OrbitX treasury wallet (shown with a copy button), then paste your transaction signature.' },
  { icon: ShieldCheck, title: '3. We verify on-chain', body: 'Before your bet is recorded, our server checks the Solana blockchain to confirm your deposit actually reached the treasury, from your wallet. No verified deposit, no bet. Each transaction can only be used once.' },
  { icon: Clock, title: '4. The timer runs', body: 'Every bet has a deadline (anywhere from 1 hour to 7 days). While it is open, more people can join the pool. When the timer ends, betting closes.' },
  { icon: Trophy, title: '5. Resolution & payout', body: 'Once the real-world result is known, the bet is resolved to the winning outcome. Winners get their net stake back plus a proportional share of the losing pool. Payouts are sent manually from the treasury to each winner’s wallet.' },
];

export default function HowItWorks() {
  return (
    <div className="min-h-screen max-w-3xl mx-auto px-4 py-16">
      <Link href="/" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white mb-8"><ArrowLeft size={14}/> Back home</Link>
      <h1 className="font-display text-4xl font-extrabold mb-3">How <span className="gradient-text">OrbitX</span> works</h1>
      <p className="text-slate-300 mb-10 leading-relaxed">OrbitX is a peer-to-pool prediction market on Solana. You bet on real-world outcomes — like whether a crypto hits a price by a date — against everyone else in the pool. Here is the full flow.</p>

      <div className="space-y-4">
        {STEPS.map(({ icon: Icon, title, body }) => (
          <div key={title} className="glass-card rounded-2xl p-6 flex gap-4">
            <div className="w-11 h-11 shrink-0 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center"><Icon size={20} className="text-cyan"/></div>
            <div><h3 className="font-bold text-white mb-1">{title}</h3><p className="text-sm text-slate-400 leading-relaxed">{body}</p></div>
          </div>
        ))}
      </div>

      <h2 className="font-display text-2xl font-extrabold mt-14 mb-4 flex items-center gap-2"><Scale size={20} className="text-purple"/> How payouts are calculated</h2>
      <div className="glass-card rounded-2xl p-6 space-y-3 text-sm text-slate-300 leading-relaxed">
        <p>OrbitX uses a <strong className="text-white">parimutuel</strong> (pool) model — the same model used by horse racing and many prediction markets.</p>
        <ul className="list-disc pl-5 space-y-2 text-slate-400">
          <li>Every stake on a bet goes into one shared pool, split by outcome.</li>
          <li>When the bet resolves, the people who picked the winning outcome split the entire pool, in proportion to how much they staked.</li>
          <li>Your payout = (your net stake ÷ total winning stakes) × total pool. In practice: you get your stake back plus a share of what the losing side put in.</li>
          <li>If <strong className="text-white">nobody</strong> picked the winning outcome, or if everyone was on the same side (no counterparty), every bet is refunded.</li>
          <li>Losing bets receive nothing.</li>
        </ul>
      </div>

      <h2 className="font-display text-2xl font-extrabold mt-12 mb-4 flex items-center gap-2"><Coins size={20} className="text-gold"/> Fees</h2>
      <div className="glass-card rounded-2xl p-6 space-y-3 text-sm text-slate-300 leading-relaxed">
        <p>A flat platform fee is charged on each bet when you place it, scaled by the size of your bet (in USD, converted to SOL at the live price):</p>
        <div className="grid sm:grid-cols-2 gap-x-8 gap-y-1 text-slate-400 font-mono text-xs mt-2">
          <div className="flex justify-between border-b border-white/5 py-1"><span>Up to $5</span><span className="text-cyan">$0.50</span></div>
          <div className="flex justify-between border-b border-white/5 py-1"><span>$5 – $10</span><span className="text-cyan">$1</span></div>
          <div className="flex justify-between border-b border-white/5 py-1"><span>$10 – $25</span><span className="text-cyan">$2.50</span></div>
          <div className="flex justify-between border-b border-white/5 py-1"><span>$25 – $50</span><span className="text-cyan">$5</span></div>
          <div className="flex justify-between border-b border-white/5 py-1"><span>$50 – $100</span><span className="text-cyan">$7.50</span></div>
          <div className="flex justify-between border-b border-white/5 py-1"><span>$100 – $250</span><span className="text-cyan">$12.50</span></div>
          <div className="flex justify-between border-b border-white/5 py-1"><span>$250 – $500</span><span className="text-cyan">$20</span></div>
          <div className="flex justify-between border-b border-white/5 py-1"><span>Over $500</span><span className="text-cyan">$25</span></div>
        </div>
        <p className="text-slate-500 text-xs pt-2">The fee is deducted from your deposit; the remainder goes into the pool. There is no separate fee at resolution.</p>
      </div>

      <div className="glass-card rounded-2xl p-6 mt-10 border border-loss/20">
        <h3 className="font-bold text-white mb-2">⚠️ Please bet responsibly</h3>
        <p className="text-sm text-slate-400 leading-relaxed">Betting involves real financial risk and outcomes are uncertain. Only stake what you can afford to lose. You must be of legal age in your jurisdiction and responsible for complying with your local laws. See our <Link href="/terms" className="text-cyan hover:underline">Terms</Link> and <Link href="/privacy" className="text-cyan hover:underline">Privacy Policy</Link>.</p>
      </div>
    </div>
  );
}

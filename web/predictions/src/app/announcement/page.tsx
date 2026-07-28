import Link from 'next/link';
import { ArrowLeft, Sparkles, Globe2, Send, Megaphone, Twitter } from 'lucide-react';

export const metadata = { title: 'Announcement — SOLNO is now OrbitX Prediction Market' };

const LINKS = [
  { label: 'Website', href: 'https://orbitx.world', detail: 'orbitx.world', Icon: Globe2 },
  { label: 'X', href: 'https://x.com/solnobet', detail: 'Public updates', Icon: Twitter },
  { label: 'Telegram', href: 'https://t.me/orbitxwrld', detail: 'Community chat', Icon: Send },
  { label: 'Updates', href: 'https://t.me/OrbitXupdates', detail: 'Announcements', Icon: Megaphone },
];

export default function AnnouncementPage() {
  return (
    <div className="min-h-screen max-w-2xl mx-auto px-4 py-16">
      <Link href="/" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white mb-8"><ArrowLeft size={14} /> Back home</Link>

      <div className="flex items-center gap-2 text-xs text-cyan font-semibold mb-3"><Sparkles size={14} /> Rebrand announcement</div>
      <h1 className="font-display text-3xl md:text-4xl font-extrabold mb-6">SOLNO is now <span className="gradient-text">OrbitX Prediction Market</span></h1>

      <div className="space-y-4 text-slate-300 leading-relaxed">
        <p>We are rebuilding under a new name. <b className="text-white">Solno.fun is now OrbitX Prediction Market</b> — the prediction-market pillar of the wider OrbitX ecosystem at <a href="https://orbitx.world" target="_blank" rel="noopener noreferrer" className="text-cyan hover:underline">orbitx.world</a>.</p>
        <p>OrbitX is the on-chain OS for Solana: trade, scan, launch, predict and connect, all in one place. The platform you already know keeps everything that made it work — the peer-to-pool model, real SOL deposits, and transparent on-chain settlement. What changes is the brand and the links.</p>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 space-y-3 my-2">
          <p className="flex gap-2.5 text-sm"><span className="w-1.5 h-1.5 rounded-full bg-cyan mt-2 shrink-0" /><span>The platform, live markets, and manual-treasury payout model are <b className="text-white">unchanged</b>.</span></p>
          <p className="flex gap-2.5 text-sm"><span className="w-1.5 h-1.5 rounded-full bg-cyan mt-2 shrink-0" /><span>New home: <b className="text-white">orbitx.world</b>. New community channels on Telegram (below).</span></p>
          <p className="flex gap-2.5 text-sm"><span className="w-1.5 h-1.5 rounded-full bg-cyan mt-2 shrink-0" /><span>The <b className="text-white">X account stays the same</b> — keep following there.</span></p>
        </div>

        <div className="grid sm:grid-cols-2 gap-3 pt-4">
          {LINKS.map(({ label, href, detail, Icon }) => (
            <a key={label} href={href} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3.5 hover:border-cyan/40 transition-colors">
              <span className="w-9 h-9 rounded-lg bg-cyan/10 border border-cyan/20 flex items-center justify-center text-cyan shrink-0"><Icon size={16} /></span>
              <span className="leading-tight"><span className="block font-bold text-white text-sm">{label}</span><span className="block text-xs text-slate-400">{detail}</span></span>
            </a>
          ))}
        </div>

        <p>More updates on OrbitX and upcoming platform improvements will be announced soon.</p>
      </div>

      <p className="text-slate-500 text-sm mt-10">— The OrbitX Team</p>
    </div>
  );
}

'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { TrendingUp, Ticket, Gamepad2, Trophy, Wallet, Settings, HeartHandshake } from 'lucide-react';
import clsx from 'clsx';

const TABS = [
  { href: '/app', label: 'Predictions', icon: TrendingUp, exact: true },
  { href: '/app/my-bets', label: 'Betting', icon: Ticket, exact: false },
  { href: '/app/games', label: 'Gaming', icon: Gamepad2, exact: false },
  { href: '/app/fundraises', label: 'Fundraises', icon: HeartHandshake, exact: false },
  { href: '/app/leaderboard', label: 'Leaderboard', icon: Trophy, exact: false },
  { href: '/app/wallet', label: 'Wallet', icon: Wallet, exact: false },
];

export function Navbar() {
  const pathname = usePathname();
  const isActive = (href: string, exact: boolean) => exact ? pathname === href : pathname.startsWith(href);

  return (
    <nav className="sticky top-0 z-50 glass border-b border-white/10">
      <span className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-cyan/40 to-transparent" />
      <div className="max-w-7xl mx-auto px-3">
        {/* Row 1: brand + actions */}
        <div className="h-14 flex items-center justify-between gap-3">
          <Link href="/app" className="group flex items-center gap-2.5 shrink-0">
            <span className="relative">
              <img src="/orbitx-mark.png" alt="OrbitX" className="h-8 w-8 rounded-lg transition-transform duration-300 group-hover:rotate-6 group-hover:scale-105" />
              <span className="absolute inset-0 rounded-lg bg-cyan/30 blur-md opacity-0 group-hover:opacity-60 transition-opacity -z-10" />
            </span>
            <span className="leading-none">
              <span className="block font-display font-extrabold text-white text-base tracking-tight">OrbitX</span>
              <span className="block text-[9px] font-bold uppercase tracking-[0.22em] text-cyan/80 mt-0.5">Prediction Market</span>
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/settings" aria-label="Settings" className={clsx(
              'w-9 h-9 flex items-center justify-center rounded-xl border transition-all',
              isActive('/settings', false)
                ? 'text-cyan bg-cyan/10 border-cyan/30'
                : 'text-gray-400 border-transparent hover:text-white hover:bg-white/10 hover:border-white/10'
            )}>
              <Settings size={17} />
            </Link>
            <WalletMultiButton />
          </div>
        </div>

        {/* Row 2: tabs */}
        <div className="flex items-center gap-1.5 pb-2 overflow-x-auto [&::-webkit-scrollbar]:hidden">
          {TABS.map(({ href, label, icon: Icon, exact }) => {
            const active = isActive(href, exact);
            return (
              <Link key={label} href={href} className={clsx(
                'group/tab relative flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap border transition-all duration-200',
                active
                  ? 'bg-gradient-to-r from-cyan to-cyan-dim text-black border-transparent shadow-[0_6px_20px_-6px_rgba(61,139,255,.6)]'
                  : 'text-gray-300 bg-white/[0.03] border-white/10 hover:text-white hover:border-cyan/30 hover:bg-white/[0.07] hover:-translate-y-px'
              )}>
                <Icon size={15} className={clsx('transition-transform duration-200', !active && 'group-hover/tab:scale-110 group-hover/tab:text-cyan')} />
                {label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

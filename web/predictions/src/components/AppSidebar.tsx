'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Clock, Trophy, Settings, Swords, Wallet, ChevronRight, Gamepad2 } from 'lucide-react';
import clsx from 'clsx';

const NAV = [
  { href: '/app', label: 'Browse Bets', icon: LayoutDashboard, exact: true },
  { href: '/app/my-bets', label: 'My Bets', icon: Clock, exact: false },
  { href: '/app/leaderboard', label: 'Leaderboard', icon: Trophy, exact: false },
  { href: '/app/games', label: 'Games', icon: Swords, exact: false },
  { href: '/app/arcade', label: 'Arcade', icon: Gamepad2, exact: false },
  { href: '/app/wallet', label: 'Wallet', icon: Wallet, exact: false },
  { href: '/settings', label: 'Settings', icon: Settings, exact: false },
];

export function AppSidebar() {
  const path = usePathname();
  return (
    <aside className="w-56 shrink-0 border-r border-white/5 bg-black/20 flex flex-col">
      <div className="h-16 flex items-center px-5 border-b border-white/5">
        <span className="text-xl font-bold gradient-text">⚡ OrbitX</span>
      </div>
      <nav className="flex-1 p-3 space-y-1">
        {NAV.map(({ href, icon: Icon, label, exact }) => {
          const active = exact ? path === href : path.startsWith(href);
          return (
            <Link key={href} href={href} className={clsx(
              'flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm transition-all',
              active ? 'bg-white/10 text-white font-medium' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
            )}>
              <Icon size={16} />
              <span className="flex-1">{label}</span>
              {active && <ChevronRight size={12} className="opacity-40" />}
            </Link>
          );
        })}
      </nav>
      <div className="p-3 border-t border-white/5">
        <div className="glass rounded-xl p-3 text-center">
          <p className="text-xs text-gray-500 mb-1">Network</p>
          <div className="flex items-center justify-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-sol-green animate-pulse-slow" />
            <p className="text-xs font-medium">Devnet</p>
          </div>
        </div>
      </div>
    </aside>
  );
}

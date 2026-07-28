'use client';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { Bell } from 'lucide-react';

interface AppTopbarProps {
  title?: string;
}

export function AppTopbar({ title }: AppTopbarProps) {
  return (
    <header className="h-16 border-b border-white/5 flex items-center justify-between px-6">
      <div>
        {title && <h2 className="text-white font-semibold text-sm">{title}</h2>}
      </div>
      <div className="flex items-center gap-3">
        <button className="w-9 h-9 glass rounded-xl flex items-center justify-center text-gray-500 hover:text-white transition-colors relative">
          <Bell size={16} />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-sol-green" />
        </button>
        <WalletMultiButton />
      </div>
    </header>
  );
}

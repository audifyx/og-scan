'use client';
import { ReactNode } from 'react';
import { Navbar } from '@/components/Navbar';

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen">
      <Navbar />
      {/* Tagline */}
      <div className="border-b border-white/10 bg-black">
        <p className="max-w-7xl mx-auto px-4 py-2 text-center text-[11px] sm:text-xs text-gray-400">
          Peer-to-pool gaming, betting &amp; prediction markets on Solana. Pick a side. Stake. Win the pool.
        </p>
      </div>
      <main className="max-w-7xl mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  );
}

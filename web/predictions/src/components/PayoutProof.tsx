'use client';
import { ShieldCheck, ExternalLink, Receipt } from 'lucide-react';

/** Anything that isn't our 'manual_' placeholder and looks base58-ish. */
export function isRealSig(s?: string | null): boolean {
  return !!s && !s.startsWith('manual_') && /^[1-9A-HJ-NP-Za-km-z]{60,100}$/.test(s);
}

export function PayoutProof({ claimTx, verified, size = 'sm' }: { claimTx?: string | null; verified?: boolean; size?: 'sm' | 'xs' }) {
  if (!isRealSig(claimTx)) return null;
  const px = size === 'xs' ? 'text-[10px]' : 'text-xs';
  const icon = size === 'xs' ? 10 : 12;
  return (
    <a
      href={`https://solscan.io/tx/${claimTx}`}
      target="_blank"
      rel="noopener noreferrer"
      title={verified ? 'Payout verified on-chain' : 'Payout transaction'}
      className={`inline-flex items-center gap-0.5 ${px} font-semibold hover:underline shrink-0 ${verified ? 'text-win' : 'text-cyan'}`}
    >
      {verified ? <ShieldCheck size={icon} /> : <Receipt size={icon} />}
      {verified ? 'payout verified' : 'payout tx'} <ExternalLink size={icon - 2} />
    </a>
  );
}

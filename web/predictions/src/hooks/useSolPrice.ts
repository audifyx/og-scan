'use client';
import { useEffect, useState } from 'react';

// Live SOL/USD price, refreshed every 60s. Falls back to 150.
export function useSolPrice() {
  const [price, setPrice] = useState(150);
  useEffect(() => {
    let alive = true;
    const load = () => fetch('/api/price').then(r => r.json()).then(d => { if (alive && d?.sol > 0) setPrice(d.sol); }).catch(() => {});
    load();
    const id = setInterval(load, 60_000);
    return () => { alive = false; clearInterval(id); };
  }, []);
  return price;
}

const LAMPORTS = 1_000_000_000;
export function usdFromLamports(lamports: number, price: number): string {
  return fmtUsd((Number(lamports) / LAMPORTS) * price);
}
export function usdFromSol(sol: number, price: number): string {
  return fmtUsd(sol * price);
}
export function fmtUsd(n: number): string {
  if (!isFinite(n)) return '$0';
  if (n === 0) return '$0';
  if (n < 1) return '$' + n.toFixed(2);
  if (n < 1000) return '$' + n.toLocaleString('en-US', { maximumFractionDigits: n < 100 ? 2 : 0 });
  return '$' + n.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

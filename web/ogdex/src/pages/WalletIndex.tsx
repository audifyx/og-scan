import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Search, Wallet, Star, ArrowRight } from "lucide-react";
import { getWatchlist, short } from "../lib/api";

const isAddr = (v: string) => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(v.trim());

export default function WalletIndex() {
  const [q, setQ] = useState("");
  const nav = useNavigate();
  const watched = getWatchlist();

  const go = (e: React.FormEvent) => {
    e.preventDefault();
    const v = q.trim();
    if (isAddr(v)) nav(`/wallet/${v}`);
  };

  return (
    <div className="max-w-xl mx-auto py-10 px-4">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-accent/15 border border-accent/30 grid place-items-center">
          <Wallet className="w-5 h-5 text-accent" />
        </div>
        <div>
          <h1 className="font-bold text-lg">Portfolio</h1>
          <p className="text-xs text-muted">Look up any Solana wallet</p>
        </div>
      </div>

      <form onSubmit={go} className="relative mb-6">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Paste a wallet address…"
          className="w-full bg-panel border border-line rounded-xl pl-9 pr-28 py-3 text-sm outline-none focus:border-accent/60"
          autoFocus
        />
        {isAddr(q) && (
          <button
            type="submit"
            className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-lg text-xs bg-accent text-black font-semibold inline-flex items-center gap-1"
          >
            View <ArrowRight className="w-3 h-3" />
          </button>
        )}
      </form>

      {watched.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-line flex items-center gap-2">
            <Star className="w-4 h-4 text-accent" />
            <span className="text-sm font-semibold">Watched Wallets</span>
            <span className="ml-auto text-xs text-muted">{watched.length}</span>
          </div>
          <div className="divide-y divide-line/40">
            {watched.map((addr) => (
              <Link
                key={addr}
                to={`/wallet/${addr}`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-panel2/50 transition-colors"
              >
                <div className="w-8 h-8 rounded-lg bg-accent/10 border border-accent/20 grid place-items-center shrink-0">
                  <Wallet className="w-4 h-4 text-accent" />
                </div>
                <span className="font-mono text-sm flex-1">{short(addr)}</span>
                <ArrowRight className="w-3.5 h-3.5 text-muted" />
              </Link>
            ))}
          </div>
        </div>
      )}

      {watched.length === 0 && (
        <div className="text-center py-10 text-muted text-sm">
          <Star className="w-8 h-8 mx-auto mb-3 opacity-30" />
          <p>No watched wallets yet.</p>
          <p className="text-xs mt-1">Open any wallet and tap <span className="text-white">Watch wallet</span> to save it here.</p>
        </div>
      )}
    </div>
  );
}

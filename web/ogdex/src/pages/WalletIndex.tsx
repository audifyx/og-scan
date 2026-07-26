import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Search, Wallet, Star, ArrowRight } from "lucide-react";
import { getWatchlist, short } from "../lib/api";
import { PageHero, DexPanel } from "../components/PageShell";

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
    <div className="max-w-xl mx-auto space-y-6">
      <PageHero
        kicker="Portfolio intel"
        title="Wallets"
        sub="Look up any Solana wallet — holdings, activity, and watchlist."
        icon={Wallet}
      />

      <form onSubmit={go} className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Paste a wallet address…"
          className="inp !pl-9 !pr-28 !py-3"
          autoFocus
        />
        <button type="submit" className="dex-btn absolute right-2 top-1/2 -translate-y-1/2 !py-2 !px-4 !text-xs">
          Open
        </button>
      </form>

      {watched.length > 0 && (
        <DexPanel>
          <div className="flex items-center gap-2 mb-3">
            <Star className="w-4 h-4 text-[var(--ox-gold-hi)]" />
            <h2 className="font-display font-bold text-sm">Watched wallets</h2>
          </div>
          <ul className="space-y-2">
            {watched.map((w) => (
              <li key={w}>
                <Link to={`/wallet/${w}`} className="flex items-center justify-between rounded-lg border border-line px-3 py-2 font-mono text-sm hover:bg-white/5">
                  {short(w)} <ArrowRight className="w-3.5 h-3.5 text-muted" />
                </Link>
              </li>
            ))}
          </ul>
        </DexPanel>
      )}
    </div>
  );
}

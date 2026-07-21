// OrbitX Launchpad — Creator profile. Wallet-native: the wallet address IS the
// identity. Shows a creator's real launch history from the registry + live market
// data (launches, graduated, best/total market cap) and a grid of their tokens.
import { useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { listByCreator, getProfile } from "@/lib/orbitx/registry";
import { TokenCard, shortAddr, GRADUATION_MC_USD } from "./_shared";
import { useMarketMap, fmtCompactUsd } from "./lpx";
import { Loader2, Wallet, Rocket, Droplets, ArrowLeft, Copy, Check, ExternalLink, Coins } from "lucide-react";

function Stat({ label, value, icon }: { label: string; value: React.ReactNode; icon: React.ReactNode }) {
  return (
    <div className="pf-card p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="pf-mono text-[9px] font-bold uppercase tracking-widest text-[hsl(var(--pf-muted))]">{label}</span>
        <div className="text-[hsl(var(--pf-muted))]">{icon}</div>
      </div>
      <div className="text-2xl font-black text-[hsl(var(--pf-ink))]">{value}</div>
    </div>
  );
}

export default function LaunchpadCreator() {
  const { wallet } = useParams<{ wallet: string }>();
  const [copied, setCopied] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["orbitx-creator-page", wallet],
    queryFn: () => listByCreator(wallet!, 100),
    enabled: !!wallet,
  });
  const { data: profile } = useQuery({ queryKey: ["orbitx-creator-profile", wallet], queryFn: () => getProfile(wallet!), enabled: !!wallet });
  const tokens = data ?? [];
  const mints = useMemo(() => tokens.map((t) => t.mint_address), [tokens]);
  const { data: markets } = useMarketMap(mints);

  const isGrad = (t: { mint_address: string; lp_pool_address: string | null; graduated_at: string | null }) =>
    !!t.lp_pool_address || !!t.graduated_at || (markets?.[t.mint_address]?.mcap ?? 0) >= GRADUATION_MC_USD;
  const graduated = tokens.filter(isGrad).length;
  const totalMc = mints.reduce((a, m) => a + (markets?.[m]?.mcap ?? 0), 0);
  const bestMc = mints.reduce((a, m) => Math.max(a, markets?.[m]?.mcap ?? 0), 0);
  const gradRate = tokens.length ? Math.round((graduated / tokens.length) * 100) : 0;

  const copy = () => { if (!wallet) return; navigator.clipboard.writeText(wallet); setCopied(true); setTimeout(() => setCopied(false), 1200); };

  return (
    <div className="mx-auto max-w-5xl">
      <Link to="/orbitxlaunch/leaderboard" className="mb-4 inline-flex items-center gap-1.5 pf-mono text-xs uppercase tracking-wider text-[hsl(var(--pf-muted))] hover:text-[hsl(var(--pf-ink))]"><ArrowLeft className="h-4 w-4" /> Leaderboard</Link>

      <div className="pf-card p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="h-14 w-14 shrink-0 overflow-hidden rounded-2xl border-2 border-[hsl(var(--pf-ink))] bg-[hsl(var(--pf-green))]/15">
              {profile?.avatar_url ? <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center"><Wallet className="h-6 w-6 text-[hsl(var(--pf-green))]" /></div>}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black tracking-tight text-[hsl(var(--pf-ink))]">{profile?.display_name || profile?.username || shortAddr(wallet, 6)}</h1>
                {graduated >= 3 && <span className="rounded-full border border-[hsl(var(--pf-green))] px-2 py-0.5 pf-mono text-[9px] font-bold uppercase tracking-widest text-[hsl(var(--pf-green))]">Verified creator</span>}
              </div>
              <div className="pf-mono text-[10px] uppercase tracking-widest text-[hsl(var(--pf-muted))]">{profile?.username ? `@${profile.username} \u00b7 ${shortAddr(wallet, 4)}` : "creator profile"}</div>
              {profile?.bio && <p className="mt-1 max-w-md text-xs text-[hsl(var(--pf-muted))]">{profile.bio}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={copy} className="rounded-lg border border-[hsl(var(--pf-border))] p-2 hover:border-[hsl(var(--pf-green))]" title="Copy wallet">{copied ? <Check className="h-4 w-4 text-[hsl(var(--pf-green))]" /> : <Copy className="h-4 w-4" />}</button>
            <a href={`https://solscan.io/account/${wallet}`} target="_blank" rel="noreferrer" className="rounded-lg border border-[hsl(var(--pf-border))] p-2 hover:border-[hsl(var(--pf-green))]" title="Solscan"><ExternalLink className="h-4 w-4" /></a>
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Launches" value={tokens.length} icon={<Rocket className="h-4 w-4" />} />
        <Stat label="Graduated" value={graduated} icon={<Droplets className="h-4 w-4" />} />
        <Stat label="Grad rate" value={`${gradRate}%`} icon={<Rocket className="h-4 w-4" />} />
        <Stat label="Best market cap" value={fmtCompactUsd(bestMc)} icon={<Coins className="h-4 w-4" />} />
      </div>

      <div className="mt-6 mb-3 flex items-center gap-2">
        <h2 className="text-sm font-black uppercase tracking-wide text-[hsl(var(--pf-ink))]">Launches</h2>
        <span className="pf-mono text-[10px] text-[hsl(var(--pf-muted))]">total mcap {fmtCompactUsd(totalMc)}</span>
      </div>
      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-[hsl(var(--pf-muted))]"><Loader2 className="h-4 w-4 animate-spin" /> loading launches…</div>
      ) : tokens.length === 0 ? (
        <div className="pf-card py-16 text-center text-sm text-[hsl(var(--pf-muted))]">This wallet hasn't launched a token through OrbitX.</div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {tokens.map((t) => <TokenCard key={t.mint_address} t={t} mc={markets?.[t.mint_address]?.mcap ?? null} market={markets?.[t.mint_address] ?? null} />)}
        </div>
      )}
    </div>
  );
}

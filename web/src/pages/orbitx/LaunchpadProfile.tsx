// Orbitx Launchpad — Profile: the connected wallet's launched tokens. Glass/terminal aesthetic.
import { useWallet } from "@solana/wallet-adapter-react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { listByCreator } from "@/lib/orbitx/registry";
import { TokenCard, shortAddr, StatTile, SectionLabel } from "./_shared";
import { Wallet, Loader2, Rocket } from "lucide-react";

const goldBtn = "inline-flex items-center gap-1.5 rounded-lg border border-[hsl(var(--og-gold))]/50 bg-[hsl(var(--og-gold))]/15 px-5 py-2.5 font-display text-xs font-bold uppercase tracking-wider text-[hsl(var(--og-gold))] transition hover:bg-[hsl(var(--og-gold))]/25";

export default function LaunchpadProfile() {
  const { connected, publicKey } = useWallet();
  const addr = publicKey?.toBase58();

  const { data, isLoading } = useQuery({
    queryKey: ["orbitx-creator", addr],
    queryFn: () => listByCreator(addr!),
    enabled: !!addr,
  });

  if (!connected || !addr)
    return (
      <div className="og-glass-card flex flex-col items-center gap-4 border-dashed py-20 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-white/10 bg-white/5"><Wallet className="h-7 w-7 text-muted-foreground" /></div>
        <div>
          <div className="font-display text-lg font-bold text-foreground">Connect your wallet</div>
          <div className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">Your profile shows every token you've launched through Orbitx. Connect a wallet on the Launch page to see yours.</div>
        </div>
        <Link to="/orbitxlaunch/create" className={goldBtn}><Rocket className="h-4 w-4" /> Go to Launch</Link>
      </div>
    );

  const count = data?.length ?? 0;
  const graduated = data?.filter((t) => t.lp_pool_address).length ?? 0;

  return (
    <div>
      {/* wallet header */}
      <div className="og-glass-frame mb-5 flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="pulse-glow flex h-11 w-11 items-center justify-center rounded-xl border border-[hsl(var(--og-gold))]/40 bg-[hsl(var(--og-gold))]/10"><Wallet className="h-5 w-5 text-[hsl(var(--og-gold))]" /></div>
          <div>
            <div className="font-mono text-sm font-bold text-foreground">{shortAddr(addr, 6)}</div>
            <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">creator wallet</div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:w-64">
          <StatTile label="Launched" value={isLoading ? "…" : String(count)} accent="gold" />
          <StatTile label="Graduated" value={isLoading ? "…" : String(graduated)} accent="lime" />
        </div>
      </div>

      <SectionLabel accent="gold">Your launches</SectionLabel>
      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-20 font-mono text-sm text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /> loading your launches…</div>
      ) : count === 0 ? (
        <div className="og-glass-card flex flex-col items-center gap-4 border-dashed py-20 text-center">
          <div className="font-display text-lg font-bold text-foreground">No launches yet</div>
          <div className="max-w-sm text-sm text-muted-foreground">You haven't launched a token from this wallet. Your first launch will appear here.</div>
          <Link to="/orbitxlaunch/create" className={goldBtn}><Rocket className="h-4 w-4" /> Launch a token</Link>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{data!.map((t) => <TokenCard key={t.id} t={t} />)}</div>
      )}
    </div>
  );
}

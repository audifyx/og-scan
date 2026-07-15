// Orbitx Launchpad — Profile: the connected wallet's launched tokens.
import { useWallet } from "@solana/wallet-adapter-react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { listByCreator } from "@/lib/orbitx/registry";
import { TokenCard, shortAddr } from "./_shared";
import { Wallet, Loader2, Rocket } from "lucide-react";

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
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-white/10 py-20 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5"><Wallet className="h-7 w-7 text-muted-foreground" /></div>
        <div>
          <div className="text-lg font-bold text-foreground">Connect your wallet</div>
          <div className="mt-1 max-w-sm text-sm text-muted-foreground">Your profile shows every token you've launched through Orbitx. Connect a wallet on the Launch page to see yours.</div>
        </div>
        <Link to="/orbitxlaunch/create" className="inline-flex items-center gap-1.5 rounded-xl bg-[hsl(var(--og-gold))] px-5 py-2.5 text-sm font-bold text-black hover:bg-[hsl(var(--og-gold))]/90"><Rocket className="h-4 w-4" /> Go to Launch</Link>
      </div>
    );

  return (
    <div>
      <div className="mb-5 flex items-center gap-3 rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[hsl(var(--og-gold))]/10"><Wallet className="h-5 w-5 text-[hsl(var(--og-gold))]" /></div>
        <div>
          <div className="font-mono text-sm font-semibold text-foreground">{shortAddr(addr, 6)}</div>
          <div className="text-[11px] text-muted-foreground">{isLoading ? "Loading…" : `${data?.length ?? 0} token${(data?.length ?? 0) === 1 ? "" : "s"} launched`}</div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-20 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /> Loading your launches…</div>
      ) : !data || data.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-white/10 py-20 text-center">
          <div className="text-lg font-bold text-foreground">No launches yet</div>
          <div className="max-w-sm text-sm text-muted-foreground">You haven't launched a token from this wallet. Your first launch will appear here.</div>
          <Link to="/orbitxlaunch/create" className="inline-flex items-center gap-1.5 rounded-xl bg-[hsl(var(--og-gold))] px-5 py-2.5 text-sm font-bold text-black hover:bg-[hsl(var(--og-gold))]/90"><Rocket className="h-4 w-4" /> Launch a token</Link>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{data.map((t) => <TokenCard key={t.id} t={t} />)}</div>
      )}
    </div>
  );
}

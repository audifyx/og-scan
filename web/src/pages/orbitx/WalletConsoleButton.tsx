import { Wallet } from "lucide-react";
import { useWalletContext } from "@/lib/orbitx/wallet-context";
import { shortAddr } from "./_shared";

export function WalletConsoleButton() {
  const { addr, sol, connect, disconnect } = useWalletContext();

  if (!addr) {
    return (
      <button type="button" onClick={connect} className="pf-btn">
        <Wallet className="h-4 w-4" /> Connect Wallet
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-full border border-[hsl(var(--pf-ink))] bg-[hsl(var(--pf-bg-2))] px-2.5 py-1.5">
      <span className="h-2 w-2 rounded-full bg-[hsl(var(--pf-green))]" />
      <div className="leading-none">
        <div className="pf-mono text-[10px] font-bold text-[hsl(var(--pf-ink))]">{shortAddr(addr)}</div>
        <div className="mt-0.5 pf-mono text-[9px] uppercase tracking-widest text-[hsl(var(--pf-muted))]">
          {sol != null ? `${sol.toFixed(3)} SOL` : "wallet linked"}
        </div>
      </div>
      <button
        type="button"
        onClick={disconnect}
        className="ml-1 rounded-full border border-[hsl(var(--pf-border))] px-2 py-1 pf-mono text-[9px] font-bold uppercase tracking-widest text-[hsl(var(--pf-muted))] transition hover:border-[hsl(var(--pf-red))] hover:text-[hsl(var(--pf-red))]"
      >
        Disconnect
      </button>
    </div>
  );
}

import { Wallet } from "lucide-react";
import { EmptyState } from "@/pages/onchain-world/dashboard/EmptyState";
import { useOrbitxStore } from "@/pages/onchain-world/lib/orbitx/store";

export function WalletsView() {
  const selected = useOrbitxStore((s) => s.selectedWallet);
  const trackWallet = useOrbitxStore((s) => s.trackWallet);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {selected ? (
        <div className="p-4">
          <p className="ox-kicker mb-2">Watched</p>
          <div className="flex items-center justify-between rounded-md border border-line bg-bg-sunken px-3 py-2">
            <span className="ox-stat text-sm text-fg">{selected}</span>
            <button
              type="button"
              className="text-xs text-muted hover:text-fg"
              onClick={() => trackWallet(null)}
            >
              Remove
            </button>
          </div>
        </div>
      ) : (
        <EmptyState
          icon={<Wallet className="size-5" />}
          title="No watched wallets"
          body="Track an address from the intelligence rail to pin it here."
        />
      )}
    </div>
  );
}

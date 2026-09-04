import { useNavigate } from "react-router-dom";
import { Wallet } from "lucide-react";
import { EmptyState } from "@/pages/onchain-world/dashboard/EmptyState";
import { formatAddress } from "@/pages/onchain-world/lib/orbitx/format";
import { useOrbitxStore } from "@/pages/onchain-world/lib/orbitx/store";

export function WalletsView() {
  const selected = useOrbitxStore((s) => s.selectedWallet);
  const trackWallet = useOrbitxStore((s) => s.trackWallet);
  const kols = useOrbitxStore((s) => s.city.kols);
  const nav = useNavigate();

  function pick(address: string) {
    trackWallet(address);
    nav(`/on-chain/wallet/${address}`);
  }

  return (
    <div className="ox-scroll min-h-0 flex-1 overflow-auto">
      {selected ? (
        <div className="border-b border-line p-4">
          <p className="ox-kicker mb-2">Watched</p>
          <div className="flex items-center justify-between rounded-md border border-line bg-bg-sunken px-3 py-2">
            <span className="ox-stat text-sm text-fg">{formatAddress(selected)}</span>
            <button
              type="button"
              className="text-xs text-muted hover:text-fg"
              onClick={() => trackWallet(null)}
            >
              Remove
            </button>
          </div>
        </div>
      ) : null}

      {kols.length === 0 ? (
        <EmptyState
          icon={<Wallet className="size-5" />}
          title="No watched wallets"
          body="Track an address from the intelligence rail to pin it here."
        />
      ) : (
        <div className="p-4">
          <p className="ox-kicker mb-2">Assigned KOLs · {kols.length}</p>
          <ul className="divide-y divide-line rounded-md border border-line">
            {kols.map((k) => (
              <li key={k.address}>
                <button
                  type="button"
                  onClick={() => pick(k.address)}
                  className={`flex w-full items-center justify-between px-3 py-2 text-left hover:bg-bg-hover ${
                    selected === k.address ? "bg-bg-hover" : ""
                  }`}
                >
                  <span>
                    <span className="block text-xs font-medium text-fg">
                      {k.name}
                      {k.status === "disputed" ? " · listed" : k.hits ? "" : " · idle"}
                    </span>
                    <span className="block text-2xs text-dim">
                      {k.last_type
                        ? `${k.last_type.replace(/_/g, " ")}${k.last_token ? ` · ${k.last_token}` : ""}`
                        : k.twitter || formatAddress(k.address)}
                    </span>
                  </span>
                  <span className="ox-stat text-2xs text-muted">{k.hits ?? 0} hits</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

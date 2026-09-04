import { useEffect, useState } from "react";
import { OnChainBadge } from "./OnChainBadge";
import { SolscanLink } from "./SolscanLink";

type EventRow = {
  tx_signature: string;
  kind?: string;
  wallet?: string | null;
  fee_lamports?: number | null;
  content_hash?: string;
  created_at?: string;
  block_time?: string | null;
};

export function OnChainActivity({
  wallet,
  title = "On-chain activity",
}: {
  wallet?: string | null;
  title?: string;
}) {
  const [rows, setRows] = useState<EventRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = wallet ? `?action=events&wallet=${encodeURIComponent(wallet)}` : "?action=events";
    fetch(`/api/orbitx-onchain${q}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.ok === false) throw new Error(j.error || "Index unavailable");
        setRows(Array.isArray(j.events) ? j.events : []);
        setError(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load index"));
  }, [wallet]);

  return (
    <div className="space-y-3">
      <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-white/45">{title}</h3>
      {error && <p className="text-xs text-[#ff4d6d]">{error}</p>}
      {!error && rows.length === 0 && (
        <p className="text-xs text-white/40">No indexed OrbitX events yet. The chain is still the authority.</p>
      )}
      <ul className="space-y-2">
        {rows.map((row) => (
          <li key={row.tx_signature} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <OnChainBadge signature={row.tx_signature} label={row.kind || "on-chain"} />
              <SolscanLink signature={row.tx_signature} />
            </div>
            {row.wallet && <div className="mt-1 font-mono text-[10px] text-white/35">{row.wallet}</div>}
            {row.fee_lamports != null && (
              <div className="text-[10px] text-white/40">{(Number(row.fee_lamports) / 1e9).toFixed(9)} SOL fee</div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function TransactionHistory(props: { wallet?: string | null }) {
  return <OnChainActivity wallet={props.wallet} title="Transaction history" />;
}

export function WalletActivity({ wallet }: { wallet: string }) {
  return <OnChainActivity wallet={wallet} title="Wallet activity" />;
}

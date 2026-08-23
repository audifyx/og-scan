import { OnChainBadge } from "./OnChainBadge";
import { SolscanLink } from "./SolscanLink";

export function OnChainProof({
  signature,
  kind,
  hash,
  feeLamports,
}: {
  signature?: string | null;
  kind?: string | null;
  hash?: string | null;
  feeLamports?: number | null;
}) {
  if (!signature) {
    return <p className="text-xs text-white/45">No on-chain proof yet — the database is not treated as authority.</p>;
  }
  return (
    <div className="space-y-1 text-xs">
      <OnChainBadge signature={signature} />
      {kind && <div className="text-white/55">Kind · {kind}</div>}
      {hash && <div className="break-all font-mono text-white/40">{hash}</div>}
      {feeLamports != null && <div className="text-white/45">{(feeLamports / 1e9).toFixed(9)} SOL fee</div>}
      <SolscanLink signature={signature} />
    </div>
  );
}

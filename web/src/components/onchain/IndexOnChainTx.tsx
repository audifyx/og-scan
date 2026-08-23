import { useEffect } from "react";
import { indexConfirmedTx, type AttestKind } from "@/lib/orbitx/onchainAttest";

/** After a real signature exists, cache it. Never invents a tx. */
export function IndexOnChainTx({
  signature,
  kind,
  refId,
}: {
  signature?: string | null;
  kind: AttestKind;
  refId?: string;
}) {
  useEffect(() => {
    const sig = String(signature || "").trim();
    if (!sig) return;
    void indexConfirmedTx({ signature: sig, kind, ref_id: refId });
  }, [signature, kind, refId]);
  return null;
}

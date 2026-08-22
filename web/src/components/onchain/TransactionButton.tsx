import { useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { toast } from "sonner";
import { indexAttestation, sendMemoAttestation, type AttestKind } from "@/lib/orbitx/onchainAttest";
import { TransactionStatus, type TxUiState } from "./TransactionStatus";

export function TransactionButton({
  kind,
  payload,
  label = "Record on-chain",
  disabled,
  onConfirmed,
}: {
  kind: AttestKind;
  payload: Record<string, unknown>;
  label?: string;
  disabled?: boolean;
  onConfirmed?: (sig: string, hash: string) => void;
}) {
  const { connection } = useConnection();
  const { publicKey, sendTransaction, signTransaction, wallet } = useWallet();
  const [state, setState] = useState<TxUiState>("idle");
  const [sig, setSig] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    if (!publicKey) {
      toast.error("Connect a wallet first");
      return;
    }
    setState("pending");
    setError(null);
    try {
      const result = await sendMemoAttestation({
        connection,
        payer: new PublicKey(publicKey.toBase58()),
        wallet: {
          sendTransaction,
          signTransaction,
          walletName: wallet?.adapter?.name,
        },
        kind,
        payload,
      });
      setSig(result.signature);
      try {
        await indexAttestation({ signature: result.signature, kind, expect_hash: result.hash });
      } catch {
        /* index is cache — chain already confirmed */
      }
      setState("confirmed");
      onConfirmed?.(result.signature, result.hash);
      toast.success("On-chain attestation confirmed");
    } catch (e) {
      setState("failed");
      setError(e instanceof Error ? e.message : "Transaction failed");
      toast.error(e instanceof Error ? e.message : "Transaction failed");
    }
  };

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={disabled || state === "pending" || !publicKey}
        onClick={() => void run()}
        className="inline-flex items-center justify-center rounded-lg border border-[#F0C75E]/50 bg-[#F0C75E]/10 px-3 py-2 text-xs font-bold uppercase tracking-wider text-[#F0C75E] disabled:opacity-40"
      >
        {label}
      </button>
      <TransactionStatus state={state} signature={sig} error={error} onRetry={() => void run()} />
    </div>
  );
}

import { useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, TransactionMessage, VersionedTransaction } from "@solana/web3.js";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { buildSweepInstructions, sweepCopy } from "@/lib/launchpad";
import { getPumpClaimableSol as vaultSol } from "@/lib/orbitx/claim";
import { confirmSentTransaction, sendWalletTransaction, walletCapsFromAdapter } from "@/lib/orbitx/sendWalletTx";
import { shortAddr } from "@/pages/orbitx/_shared";

export function SweepCreatorFees({
  creator,
  graduated,
  quoteMint,
}: {
  creator: string;
  graduated?: boolean;
  quoteMint?: string;
}) {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [busy, setBusy] = useState(false);

  const run = async () => {
    if (!wallet.publicKey || !wallet.signTransaction) {
      toast.error("Connect a wallet to pay gas");
      return;
    }
    setBusy(true);
    try {
      const dest = new PublicKey(creator);
      const pending = await vaultSol(connection, dest);
      if (pending <= 0) throw new Error("Nothing to sweep");
      const ixs = buildSweepInstructions({
        creator: dest,
        graduated,
        quoteMint: quoteMint ? new PublicKey(quoteMint) : undefined,
      });
      const { blockhash } = await connection.getLatestBlockhash("confirmed");
      const msg = new TransactionMessage({
        payerKey: wallet.publicKey,
        recentBlockhash: blockhash,
        instructions: ixs,
      }).compileToV0Message();
      const tx = new VersionedTransaction(msg);
      const sig = await sendWalletTransaction(connection, walletCapsFromAdapter(wallet), tx);
      await confirmSentTransaction(connection, sig, { commitment: "confirmed" });
      toast.success(`Swept to ${shortAddr(creator)} · ${sig.slice(0, 8)}…`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Sweep failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="lp-sweep">
      <p className="lp-sweep-copy">{sweepCopy(shortAddr(creator, 4))}</p>
      <button type="button" className="lp-auth-btn" onClick={() => void run()} disabled={busy}>
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
        Sweep creator fees
      </button>
    </div>
  );
}

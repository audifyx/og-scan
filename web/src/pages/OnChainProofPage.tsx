import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { Link } from "react-router-dom";
import { OnChainActivity, OnChainBadge, OnChainProof, SolscanLink, TransactionButton, TransactionStatus, WalletButton } from "@/components/onchain";
import { verifyOnChain } from "@/lib/orbitx/onchainAttest";
import type { TxUiState } from "@/components/onchain";

export default function OnChainProofPage() {
  const { publicKey } = useWallet();
  const [sig, setSig] = useState("");
  const [state, setState] = useState<TxUiState>("idle");
  const [proof, setProof] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rebuild, setRebuild] = useState<string | null>(null);

  const verify = async () => {
    setState("pending");
    setError(null);
    setProof(null);
    try {
      const json = await verifyOnChain(sig.trim());
      setProof(json);
      setState("confirmed");
    } catch (e) {
      setState("failed");
      setError(e instanceof Error ? e.message : "Verification failed");
    }
  };

  const rebuildIndex = async () => {
    if (!publicKey) return;
    setRebuild("Scanning last 40 signatures for ox1| memos…");
    try {
      const res = await fetch(`/api/orbitx-onchain?action=rebuild&wallet=${encodeURIComponent(publicKey.toBase58())}`);
      const json = await res.json();
      if (!res.ok || json.ok === false) throw new Error(json.error || "Rebuild failed");
      setRebuild(`Rebuilt ${json.rebuilt} of ${json.scanned} scanned. ${json.note || ""}`);
    } catch (e) {
      setRebuild(e instanceof Error ? e.message : "Rebuild failed");
    }
  };

  return (
    <div className="min-h-screen bg-[#05080c] px-4 py-10 text-white">
      <div className="mx-auto max-w-2xl space-y-8">
        <div>
          <p className="text-[10px] uppercase tracking-[0.28em] text-[#F0C75E]/80">OrbitX · blockchain first</p>
          <h1 className="mt-2 font-display text-3xl font-black">On-chain proof</h1>
          <p className="mt-2 text-sm text-white/55">
            Paste a Solana signature. RPC is the authority. The database only caches what the chain already confirmed.
          </p>
          <p className="mt-2 text-xs text-white/40">
            Architecture: <Link className="text-[#60A5FA] hover:underline" to="/orbitxlaunch">launchpad</Link> · memo format <code className="text-white/70">ox1|&lt;kind&gt;|&lt;sha256&gt;</code>
          </p>
        </div>

        <WalletButton />

        <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <label className="text-[10px] uppercase tracking-widest text-white/40">Transaction signature</label>
          <input
            value={sig}
            onChange={(e) => setSig(e.target.value)}
            placeholder="Base58 signature"
            className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 font-mono text-xs"
          />
          <button
            type="button"
            onClick={() => void verify()}
            className="rounded-lg border border-[#60A5FA]/40 bg-[#60A5FA]/10 px-3 py-2 text-xs font-bold uppercase tracking-wider text-[#60A5FA]"
          >
            Verify on-chain
          </button>
          <TransactionStatus state={state} signature={state === "confirmed" ? sig.trim() : null} error={error} onRetry={() => void verify()} />
          {proof?.ok && (
            <OnChainProof
              signature={String(proof.signature || sig)}
              kind={typeof proof.kind === "string" ? proof.kind : null}
              hash={typeof proof.content_hash === "string" ? proof.content_hash : null}
              feeLamports={typeof proof.fee_lamports === "number" ? proof.fee_lamports : null}
            />
          )}
        </div>

        <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <h2 className="text-sm font-bold">Record a memo attestation</h2>
          <p className="text-xs text-white/45">
            Cheap memo-only tx (typically 0.000005 SOL). Stores a SHA-256 of the payload — not the payload itself.
            Your wallet signs. OrbitX never holds the key.
          </p>
          <TransactionButton
            kind="post"
            payload={{ demo: true, at: "orbitx-onchain-proof", note: "content stays off-chain" }}
            label="Attest sample post hash"
          />
        </div>

        <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <h2 className="text-sm font-bold">Rebuild index from chain</h2>
          <p className="text-xs text-white/45">
            If the cache were wiped, this scans your recent signatures and re-indexes ox1 memos. Economic txs without a memo are not invented.
          </p>
          <button
            type="button"
            disabled={!publicKey}
            onClick={() => void rebuildIndex()}
            className="rounded-lg border border-white/20 px-3 py-2 text-xs disabled:opacity-40"
          >
            Rebuild my memo index
          </button>
          {rebuild && <p className="text-xs text-white/55">{rebuild}</p>}
        </div>

        <OnChainActivity wallet={publicKey?.toBase58() || null} />

        <div className="text-xs text-white/35">
          <OnChainBadge signature={sig.trim() || null} label="ON-CHAIN" />
          <div className="mt-2"><SolscanLink signature={sig.trim() || null} /></div>
        </div>
      </div>
    </div>
  );
}

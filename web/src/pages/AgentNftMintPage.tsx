import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { Check, ExternalLink, Loader2, Sparkles, Wallet } from "lucide-react";
import { useWalletSignIn } from "@/hooks/useWalletSignIn";
import { mintNft } from "@/lib/orbitx/nftMint";
import { registerNft, registerNftCollection } from "@/lib/orbitx/nftRegistry";

/**
 * MCP NFT mint handoff — Metaplex mint signed in Phantom, then optional OrbitX registry.
 * Query: name, symbol, uri, royaltyBps, collectionMint, isCollection, register, imageUrl
 */
export default function AgentNftMintPage() {
  const [params] = useSearchParams();
  const { connection } = useConnection();
  const { publicKey, wallet, connected } = useWallet();
  const { pickable, signInWith, busy } = useWalletSignIn();

  const name = (params.get("name") || "").trim();
  const symbol = (params.get("symbol") || "NFT").trim().toUpperCase();
  const uri = (params.get("uri") || params.get("metadataUri") || "").trim();
  const royaltyBps = Math.min(Math.max(Number(params.get("royaltyBps")) || 500, 0), 10000);
  const collectionMint = (params.get("collectionMint") || "").trim() || undefined;
  const isCollection = params.get("isCollection") === "1" || params.get("isCollection") === "true";
  const doRegister = params.get("register") !== "0";
  const imageUrl = (params.get("imageUrl") || "").trim() || undefined;
  const expectedWallet = (params.get("publicKey") || "").trim();

  const [busyMint, setBusyMint] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ mintAddress: string; signature: string; registryId?: string } | null>(
    null,
  );

  const walletAddr = publicKey?.toBase58() || "";
  const walletMismatch = Boolean(expectedWallet && walletAddr && expectedWallet !== walletAddr);
  const valid = Boolean(name && uri);

  const summary = useMemo(
    () => ({
      name: name || "—",
      symbol,
      uri: uri ? `${uri.slice(0, 48)}${uri.length > 48 ? "…" : ""}` : "—",
      royaltyBps,
      isCollection,
    }),
    [name, symbol, uri, royaltyBps, isCollection],
  );

  const onMint = async () => {
    setError(null);
    if (!valid) {
      setError("Missing name or metadata uri. Call orbitx_mint_nft from MCP first.");
      return;
    }
    if (!connected || !publicKey || !wallet?.adapter) {
      setError("Connect Phantom first.");
      return;
    }
    if (walletMismatch) {
      setError(`Switch to wallet ${expectedWallet.slice(0, 4)}…${expectedWallet.slice(-4)}`);
      return;
    }

    setBusyMint(true);
    try {
      const minted = await mintNft({
        connection,
        wallet: wallet.adapter,
        name,
        symbol,
        uri,
        royaltyBps,
        collectionMint,
        isCollection,
      });

      let registryId: string | undefined;
      if (doRegister) {
        try {
          if (isCollection) {
            registryId = await registerNftCollection({
              creator_wallet: publicKey.toBase58(),
              name,
              symbol,
              description: "",
              logo_url: imageUrl,
              royalty_bps: royaltyBps,
              mint_address: minted.mintAddress,
            });
          } else {
            registryId = await registerNft({
              mint_address: minted.mintAddress,
              creator_wallet: publicKey.toBase58(),
              name,
              symbol,
              image_url: imageUrl,
              metadata_uri: uri,
              royalty_bps: royaltyBps,
            });
          }
        } catch (regErr) {
          console.warn("[agent-nft] registry failed", regErr);
        }
      }

      setResult({ ...minted, registryId });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Mint failed");
    } finally {
      setBusyMint(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#070a10] p-4 text-white">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0c111a] p-6 shadow-2xl">
        <div className="mb-1 flex items-center gap-2 text-fuchsia-300">
          <Sparkles className="h-5 w-5" />
          <h1 className="text-xl font-black tracking-tight">Mint NFT with Phantom</h1>
        </div>
        <p className="mb-5 text-xs text-white/45">
          On-chain Metaplex mint. OrbitX never holds keys — approve in Phantom to create the NFT.
        </p>

        <div className="mb-4 space-y-2 rounded-xl border border-white/10 bg-black/40 px-3 py-3 text-sm">
          <Row label="Name" value={summary.name} />
          <Row label="Symbol" value={summary.symbol} />
          <Row label="Metadata" value={summary.uri} mono />
          <Row label="Royalty" value={`${(royaltyBps / 100).toFixed(1)}%`} />
          <Row label="Type" value={isCollection ? "Collection NFT" : "Item NFT"} />
        </div>

        {!valid && (
          <div className="mb-4 rounded-xl border border-amber-400/20 bg-amber-400/8 px-3 py-2 text-xs text-amber-100/80">
            Open from MCP <code className="text-white/70">orbitx_mint_nft</code> (needs name + uri).
          </div>
        )}

        {error && (
          <div className="mb-4 rounded-xl border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-xs text-rose-100">
            {error}
          </div>
        )}

        {result ? (
          <div className="mb-4 rounded-xl border border-emerald-400/25 bg-emerald-400/10 px-3 py-3">
            <p className="mb-1 flex items-center gap-1.5 text-sm font-bold text-emerald-300">
              <Check className="h-4 w-4" /> Minted on-chain
            </p>
            <p className="mb-2 break-all font-mono text-[11px] text-white/70">{result.mintAddress}</p>
            <a
              href={`https://solscan.io/token/${result.mintAddress}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11px] text-emerald-200/80 hover:underline"
            >
              View on Solscan <ExternalLink className="h-3 w-3" />
            </a>
            {result.registryId && (
              <p className="mt-2 text-[11px] text-white/40">Registered on OrbitX marketplace.</p>
            )}
          </div>
        ) : (
          <>
            {!connected && (
              <div className="mb-3 flex flex-wrap gap-2">
                {pickable.map((w) => (
                  <button
                    key={w.name}
                    type="button"
                    disabled={!!busy}
                    onClick={() => signInWith(w.name, { connectOnly: true })}
                    className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold hover:bg-white/10 disabled:opacity-50"
                  >
                    Connect {w.name}
                  </button>
                ))}
              </div>
            )}
            <button
              type="button"
              disabled={!valid || busyMint || !!busy || !connected || walletMismatch}
              onClick={onMint}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-fuchsia-400 px-4 py-3 text-sm font-bold text-black hover:brightness-110 disabled:opacity-40"
            >
              {busyMint ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
              {busyMint ? "Confirm in Phantom…" : "Mint NFT"}
            </button>
          </>
        )}

        <p className="mt-4 text-center text-[11px] text-white/35">
          <Link to="/nft/create" className="text-white/50 hover:underline">
            Full NFT studio
          </Link>
          {" · "}
          <Link to="/supercomputer?tab=workspace" className="text-white/50 hover:underline">
            Super Computer
          </Link>
        </p>
      </div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-white/35">{label}</span>
      <span className={`max-w-[65%] text-right text-xs text-white/80 ${mono ? "break-all font-mono" : "font-semibold"}`}>
        {value}
      </span>
    </div>
  );
}

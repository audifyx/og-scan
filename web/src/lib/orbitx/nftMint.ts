// OrbitX NFT Hub — real on-chain NFT minting (Solana mainnet, Metaplex Token
// Metadata standard). Every mint here is a genuine transaction signed by the
// connected Phantom (or any wallet-adapter) wallet; nothing custodial, no
// server ever touches a private key. Mirrors the trust model of the token
// launch lanes (LaunchpadPump/LaunchpadCreate) but for NFTs.
import type { Connection } from "@solana/web3.js";
import type { WalletAdapter } from "@solana/wallet-adapter-base";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { walletAdapterIdentity } from "@metaplex-foundation/umi-signer-wallet-adapters";
import {
  mplTokenMetadata, createNft, verifyCollectionV1, fetchDigitalAsset, findMetadataPda,
} from "@metaplex-foundation/mpl-token-metadata";
import { generateSigner, percentAmount, publicKey as umiPublicKey, some, none } from "@metaplex-foundation/umi";

export interface NftAttribute { trait_type: string; value: string }

export interface MintNftParams {
  connection: Connection;
  wallet: WalletAdapter; // the connected wallet-adapter instance (Phantom, etc.)
  name: string;
  symbol: string;
  uri: string;              // public metadata JSON URL (already uploaded)
  royaltyBps: number;       // seller_fee_basis_points, on-chain
  collectionMint?: string;  // optional: mint address of an existing OrbitX collection NFT
  isCollection?: boolean;   // true when minting the collection's own NFT
}

export interface MintNftResult {
  mintAddress: string;
  signature: string;
}

function buildUmi(connection: Connection, wallet: WalletAdapter) {
  return createUmi(connection.rpcEndpoint).use(mplTokenMetadata()).use(walletAdapterIdentity(wallet));
}

/**
 * Mints one real, on-chain Metaplex NFT (Token Metadata + Master Edition —
 * the widely-supported "legacy" NFT standard readable by Phantom, Solscan,
 * Magic Eden, Tensor). Supply is always 1 per mint; "limited editions" are
 * built by calling this once per copy (see LaunchpadNftCreate).
 */
export async function mintNft(params: MintNftParams): Promise<MintNftResult> {
  const umi = buildUmi(params.connection, params.wallet);
  const mint = generateSigner(umi);

  const { signature } = await createNft(umi, {
    mint,
    name: params.name,
    symbol: params.symbol,
    uri: params.uri,
    sellerFeeBasisPoints: percentAmount(params.royaltyBps / 100, 2),
    isCollection: !!params.isCollection,
    collection: params.collectionMint ? some({ key: umiPublicKey(params.collectionMint), verified: false }) : none(),
  }).sendAndConfirm(umi, { confirm: { commitment: "confirmed" } });

  return { mintAddress: mint.publicKey.toString(), signature: Buffer.from(signature).toString("base64") };
}

/**
 * Verifies a minted item as a genuine member of an OrbitX collection —
 * requires the collection's update authority (the collection creator) to
 * sign, so only the real collection owner can grant the "verified" badge
 * on-chain. Call right after mintNft() when a collectionMint was supplied
 * and the current wallet is that collection's creator.
 */
export async function verifyNftInCollection(
  connection: Connection,
  wallet: WalletAdapter,
  nftMint: string,
  collectionMint: string
): Promise<string> {
  const umi = buildUmi(connection, wallet);
  const metadataPda = findMetadataPda(umi, { mint: umiPublicKey(nftMint) });
  const { signature } = await verifyCollectionV1(umi, {
    metadata: metadataPda,
    collectionMint: umiPublicKey(collectionMint),
    authority: umi.identity,
  }).sendAndConfirm(umi, { confirm: { commitment: "confirmed" } });
  return Buffer.from(signature).toString("base64");
}

/** Reads a minted NFT's on-chain metadata back (sanity check / explorer-style lookups). */
export async function fetchNftOnChain(connection: Connection, wallet: WalletAdapter, mintAddress: string) {
  const umi = buildUmi(connection, wallet);
  return fetchDigitalAsset(umi, umiPublicKey(mintAddress));
}

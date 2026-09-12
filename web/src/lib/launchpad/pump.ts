import { Connection, Keypair, PublicKey, VersionedTransaction } from "@solana/web3.js";
import bs58 from "bs58";
import type { LaunchIntent } from "./types";
import { onChainCreateSupported } from "./intent";
import { isNativeSol } from "./quotes";

export type PumpCreateArgs = {
  publicKey: string;
  metadataUri: string;
  name: string;
  symbol: string;
  mintPublicKey: string;
  devBuySol: number;
  quoteMint: string;
  holderReward: boolean;
};

export function pumpCreateBody(args: PumpCreateArgs): Record<string, unknown> {
  return {
    step: "create",
    publicKey: args.publicKey,
    metadataUri: args.metadataUri,
    name: args.name,
    symbol: args.symbol,
    mintPublicKey: args.mintPublicKey,
    devBuySol: args.devBuySol,
    slippage: 15,
    quoteMint: args.quoteMint,
    holderReward: args.holderReward,
    mayhemMode: false,
  };
}

export function assertQuotedCreateReady(intent: LaunchIntent): void {
  if (!onChainCreateSupported(intent)) {
    throw new Error(
      `${intent.quoteSymbol || "This quote"} create is awaiting live QuoteControl + create_v2. Launch on SOL, or wait for the allowlist.`,
    );
  }
}

export function mintKeypairFromSecret(secret: string): Keypair {
  const trimmed = secret.trim();
  if (trimmed.startsWith("[")) {
    const arr = JSON.parse(trimmed) as number[];
    return Keypair.fromSecretKey(Uint8Array.from(arr));
  }
  const bytes = bs58.decode(trimmed);
  return Keypair.fromSecretKey(Uint8Array.from(bytes));
}

export async function mintUnusedOnChain(connection: Connection, pubkey: string): Promise<boolean> {
  const info = await connection.getAccountInfo(new PublicKey(pubkey));
  return info === null;
}

export async function postPumpCreate(args: PumpCreateArgs): Promise<string> {
  if (!isNativeSol(args.quoteMint)) {
    throw new Error("Non-SOL quotes need live QuoteControl + create_v2. Launch on SOL, or wait for the allowlist.");
  }
  const res = await fetch("/api/pump-create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(pumpCreateBody(args)),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Transaction build failed" }));
    throw new Error(err.error || "Transaction build failed");
  }
  const { transaction } = await res.json();
  if (!transaction) throw new Error("Pump create returned no transaction");
  return transaction as string;
}

export function deserializeCreateTx(txBase64: string, mint: Keypair): VersionedTransaction {
  const txBytes = Uint8Array.from(atob(txBase64), (c) => c.charCodeAt(0));
  const tx = VersionedTransaction.deserialize(txBytes);
  tx.sign([mint]);
  return tx;
}

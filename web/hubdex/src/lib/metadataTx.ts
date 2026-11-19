/**
 * Builds & sends a Metaplex UpdateMetadataAccountV2 transaction, signed by the
 * user's Phantom wallet (non-custodial). Standard SPL tokens only.
 */
import { connection } from "./solana";
import { getPhantom } from "./wallet";

const TM_PROGRAM = "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s";

interface Creator { address: string; share: number; verified: boolean; }
export interface UpdateArgs {
  mint: string;
  name: string;
  symbol: string;
  uri: string;
  sellerFeeBasisPoints?: number;
  creators?: Creator[];
}

// Borsh-style string: u32 LE length + utf8 bytes
function packStr(s: string): Uint8Array {
  const b = new TextEncoder().encode(s);
  const out = new Uint8Array(4 + b.length);
  new DataView(out.buffer).setUint32(0, b.length, true);
  out.set(b, 4);
  return out;
}
function concat(arrs: Uint8Array[]): Uint8Array {
  const len = arrs.reduce((n, a) => n + a.length, 0);
  const out = new Uint8Array(len);
  let o = 0; for (const a of arrs) { out.set(a, o); o += a.length; }
  return out;
}

export async function updateTokenMetadata(args: UpdateArgs): Promise<string> {
  const provider = getPhantom();
  if (!provider) throw new Error("Phantom not found");
  const { PublicKey, Transaction, TransactionInstruction } = await import("@solana/web3.js");

  const programId = new PublicKey(TM_PROGRAM);
  const mintPk = new PublicKey(args.mint);
  const [metadataPda] = PublicKey.findProgramAddressSync(
    [new TextEncoder().encode("metadata"), programId.toBuffer(), mintPk.toBuffer()],
    programId,
  );
  const authority = new PublicKey(provider.publicKey!.toString());

  // ---- Borsh-encode UpdateMetadataAccountV2 (discriminator 15) ----
  const parts: Uint8Array[] = [];
  parts.push(Uint8Array.of(15));      // instruction
  parts.push(Uint8Array.of(1));       // Option<DataV2> = Some
  parts.push(packStr(args.name.slice(0, 32)));
  parts.push(packStr(args.symbol.slice(0, 10)));
  parts.push(packStr(args.uri.slice(0, 200)));
  const sfbp = new Uint8Array(2); new DataView(sfbp.buffer).setUint16(0, args.sellerFeeBasisPoints || 0, true);
  parts.push(sfbp);                   // u16 sellerFeeBasisPoints
  // Option<Vec<Creator>>
  const creators = (args.creators || []).filter((c) => c.address);
  if (creators.length === 0) {
    parts.push(Uint8Array.of(0));     // None
  } else {
    parts.push(Uint8Array.of(1));     // Some
    const cnt = new Uint8Array(4); new DataView(cnt.buffer).setUint32(0, creators.length, true);
    parts.push(cnt);
    for (const c of creators) {
      parts.push(new PublicKey(c.address).toBytes());          // pubkey (32)
      parts.push(Uint8Array.of(c.verified ? 1 : 0));           // verified bool
      parts.push(Uint8Array.of(Math.max(0, Math.min(100, c.share)))); // share u8
    }
  }
  parts.push(Uint8Array.of(0));       // Option<collection> = None (keep)
  parts.push(Uint8Array.of(0));       // Option<uses> = None (keep)
  parts.push(Uint8Array.of(0));       // Option<Pubkey> newUpdateAuthority = None
  parts.push(Uint8Array.of(0));       // Option<bool> primarySaleHappened = None
  parts.push(Uint8Array.of(1, 1));    // Option<bool> isMutable = Some(true) — keep editable
  const data = concat(parts);

  const ix = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: metadataPda, isSigner: false, isWritable: true },
      { pubkey: authority, isSigner: true, isWritable: false },
    ],
    data: Buffer.from(data),
  });

  const tx = new Transaction().add(ix);
  tx.feePayer = authority;
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  const res = await provider.signAndSendTransaction(tx);
  return res.signature;
}

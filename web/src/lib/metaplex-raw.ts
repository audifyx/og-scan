/**
 * Raw Metaplex Token Metadata program helpers.
 * Zero extra dependencies — uses only @solana/web3.js.
 *
 * Supports:
 *   • Metadata PDA derivation
 *   • Fetching & deserializing on-chain metadata
 *   • Building UpdateMetadataAccountV2 instruction (Borsh-serialized)
 */

import { PublicKey, TransactionInstruction } from "@solana/web3.js";

/* ─── Constants ─── */
export const TOKEN_METADATA_PROGRAM_ID = new PublicKey(
  "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s",
);

/* ─── PDA helpers ─── */
export function getMetadataPDA(mint: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("metadata"),
      TOKEN_METADATA_PROGRAM_ID.toBuffer(),
      mint.toBuffer(),
    ],
    TOKEN_METADATA_PROGRAM_ID,
  );
  return pda;
}

/* ─── On-chain metadata shape ─── */
export interface OnChainTokenMetadata {
  key: number;
  updateAuthority: string;
  mint: string;
  name: string;
  symbol: string;
  uri: string;
  sellerFeeBasisPoints: number;
  creators: { address: string; verified: boolean; share: number }[] | null;
  primarySaleHappened: boolean;
  isMutable: boolean;
}

/* ─── Borsh reading helpers ─── */
function readString(data: Buffer, offset: number): [string, number] {
  const len = data.readUInt32LE(offset);
  const str = data.slice(offset + 4, offset + 4 + len).toString("utf8");
  return [str.replace(/\0/g, ""), offset + 4 + len];
}

function readPubkey(data: Buffer, offset: number): [string, number] {
  const key = new PublicKey(data.slice(offset, offset + 32));
  return [key.toBase58(), offset + 32];
}

function readBool(data: Buffer, offset: number): [boolean, number] {
  return [data[offset] !== 0, offset + 1];
}

/* ─── Deserialize metadata account ─── */
export function deserializeMetadata(data: Buffer): OnChainTokenMetadata {
  let offset = 0;

  // key (u8)
  const key = data[offset];
  offset += 1;

  // update_authority (Pubkey)
  let updateAuthority: string;
  [updateAuthority, offset] = readPubkey(data, offset);

  // mint (Pubkey)
  let mint: string;
  [mint, offset] = readPubkey(data, offset);

  // name (String)
  let name: string;
  [name, offset] = readString(data, offset);

  // symbol (String)
  let symbol: string;
  [symbol, offset] = readString(data, offset);

  // uri (String)
  let uri: string;
  [uri, offset] = readString(data, offset);

  // seller_fee_basis_points (u16)
  const sellerFeeBasisPoints = data.readUInt16LE(offset);
  offset += 2;

  // creators (Option<Vec<Creator>>)
  let creators: { address: string; verified: boolean; share: number }[] | null =
    null;
  const hasCreators = data[offset];
  offset += 1;
  if (hasCreators) {
    const numCreators = data.readUInt32LE(offset);
    offset += 4;
    creators = [];
    for (let i = 0; i < numCreators; i++) {
      let address: string;
      [address, offset] = readPubkey(data, offset);
      const verified = data[offset] !== 0;
      offset += 1;
      const share = data[offset];
      offset += 1;
      creators.push({ address, verified, share });
    }
  }

  // primary_sale_happened (bool)
  let primarySaleHappened: boolean;
  [primarySaleHappened, offset] = readBool(data, offset);

  // is_mutable (bool)
  let isMutable: boolean;
  [isMutable, offset] = readBool(data, offset);

  return {
    key,
    updateAuthority,
    mint,
    name,
    symbol,
    uri,
    sellerFeeBasisPoints,
    creators,
    primarySaleHappened,
    isMutable,
  };
}

/* ─── Borsh writing helpers ─── */
function writeString(str: string): Buffer {
  const strBuf = Buffer.from(str, "utf8");
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32LE(strBuf.length, 0);
  return Buffer.concat([lenBuf, strBuf]);
}

function writeU16(val: number): Buffer {
  const buf = Buffer.alloc(2);
  buf.writeUInt16LE(val, 0);
  return buf;
}

function writeOption(hasValue: boolean): Buffer {
  return Buffer.from([hasValue ? 1 : 0]);
}

/* ─── Build UpdateMetadataAccountV2 instruction ─── */
export interface UpdateMetadataParams {
  metadata: PublicKey;
  updateAuthority: PublicKey;
  newName?: string;
  newSymbol?: string;
  newUri?: string;
  newSellerFeeBasisPoints?: number;
  /** Keep existing creators or null */
  creators?: { address: PublicKey; verified: boolean; share: number }[] | null;
}

export function createUpdateMetadataAccountV2Instruction(
  params: UpdateMetadataParams,
): TransactionInstruction {
  const {
    metadata,
    updateAuthority,
    newName,
    newSymbol,
    newUri,
    newSellerFeeBasisPoints,
    creators,
  } = params;

  const hasData =
    newName !== undefined ||
    newSymbol !== undefined ||
    newUri !== undefined;

  // Instruction discriminator: 15 = UpdateMetadataAccountV2
  const parts: Buffer[] = [Buffer.from([15])];

  // Option<DataV2>
  if (hasData) {
    parts.push(writeOption(true)); // Some
    parts.push(writeString(newName ?? ""));
    parts.push(writeString(newSymbol ?? ""));
    parts.push(writeString(newUri ?? ""));
    parts.push(writeU16(newSellerFeeBasisPoints ?? 0));

    // creators: Option<Vec<Creator>>
    if (creators && creators.length > 0) {
      parts.push(writeOption(true));
      const numBuf = Buffer.alloc(4);
      numBuf.writeUInt32LE(creators.length, 0);
      parts.push(numBuf);
      for (const c of creators) {
        parts.push(c.address.toBuffer());
        parts.push(Buffer.from([c.verified ? 1 : 0]));
        parts.push(Buffer.from([c.share]));
      }
    } else {
      parts.push(writeOption(false)); // None
    }

    // collection: Option<Collection> = None
    parts.push(writeOption(false));
    // uses: Option<Uses> = None
    parts.push(writeOption(false));
  } else {
    parts.push(writeOption(false)); // None (no data update)
  }

  // new_update_authority: Option<Pubkey> = None (don't change)
  parts.push(writeOption(false));
  // primary_sale_happened: Option<bool> = None
  parts.push(writeOption(false));
  // is_mutable: Option<bool> = None
  parts.push(writeOption(false));

  const data = Buffer.concat(parts);

  return new TransactionInstruction({
    programId: TOKEN_METADATA_PROGRAM_ID,
    keys: [
      { pubkey: metadata, isSigner: false, isWritable: true },
      { pubkey: updateAuthority, isSigner: true, isWritable: false },
    ],
    data,
  });
}

/* ─── Fetch metadata JSON from URI ─── */
export async function fetchMetadataJson(
  uri: string,
): Promise<Record<string, unknown> | null> {
  try {
    const resp = await fetch(uri);
    if (!resp.ok) return null;
    return (await resp.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/* ═══════════════════════════════════════════════════════════════════
   Token-2022 (SPL Token Extensions) Metadata Support
   ═══════════════════════════════════════════════════════════════════ */

export const TOKEN_2022_PROGRAM_ID = new PublicKey(
  "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb",
);

const SYSTEM_PROGRAM_ID = "11111111111111111111111111111111";

export interface Token2022Metadata {
  updateAuthority: string;
  mint: string;
  name: string;
  symbol: string;
  uri: string;
}

/**
 * Parse Token-2022 inline metadata extension from mint account data.
 * Returns null if the account is not Token-2022 or has no metadata extension.
 */
export function parseToken2022Metadata(
  data: Buffer,
  ownerProgram: string,
): Token2022Metadata | null {
  if (ownerProgram !== TOKEN_2022_PROGRAM_ID.toBase58()) return null;
  if (data.length < 170) return null;

  // TLV extensions start at byte 166 (after 165-byte base mint + account type)
  let offset = 166;
  while (offset + 4 <= data.length) {
    const extType = data.readUInt16LE(offset);
    const extLen = data.readUInt16LE(offset + 2);
    if (extType === 0 && extLen === 0) break;

    if (extType === 19 /* TokenMetadata */) {
      const ext = data.slice(offset + 4, offset + 4 + extLen);
      let pos = 0;

      const updateAuthority = new PublicKey(ext.slice(pos, pos + 32)).toBase58();
      pos += 32;
      const mint = new PublicKey(ext.slice(pos, pos + 32)).toBase58();
      pos += 32;

      const nameLen = ext.readUInt32LE(pos); pos += 4;
      const name = ext.slice(pos, pos + nameLen).toString("utf8").replace(/\0/g, ""); pos += nameLen;

      const symLen = ext.readUInt32LE(pos); pos += 4;
      const symbol = ext.slice(pos, pos + symLen).toString("utf8").replace(/\0/g, ""); pos += symLen;

      const uriLen = ext.readUInt32LE(pos); pos += 4;
      const uri = ext.slice(pos, pos + uriLen).toString("utf8").replace(/\0/g, ""); pos += uriLen;

      return { updateAuthority, mint, name, symbol, uri };
    }

    offset += 4 + extLen;
  }
  return null;
}

/** Check if a Token-2022 metadata extension has a valid (non-system) update authority */
export function isToken2022Mutable(meta: Token2022Metadata): boolean {
  return meta.updateAuthority !== SYSTEM_PROGRAM_ID;
}

/**
 * Build Token-2022 `UpdateField` instruction (spl_token_metadata_interface).
 * Field variants: 0=Name, 1=Symbol, 2=Uri
 */
export function createToken2022UpdateFieldInstruction(
  mint: PublicKey,
  updateAuthority: PublicKey,
  field: "name" | "symbol" | "uri",
  value: string,
): TransactionInstruction {
  const fieldMap = { name: 0, symbol: 1, uri: 2 };
  const fieldVariant = fieldMap[field];

  // spl_token_metadata_interface discriminator for UpdateField
  // = first 8 bytes of sha256("spl_token_metadata_interface:update_field")
  // Precomputed: sha256("spl_token_metadata_interface:update_field")[0..8]
  const discriminator = Buffer.from([130, 68, 42, 109, 52, 18, 206, 255]);

  // Field enum is Borsh-serialized as a single-byte (u8) variant discriminant
  // (0=Name, 1=Symbol, 2=Uri). Writing it as u32 corrupts the instruction.
  const fieldBuf = Buffer.from([fieldVariant]);

  // Value: borsh string (u32 length + bytes)
  const valBytes = Buffer.from(value, "utf8");
  const valLenBuf = Buffer.alloc(4);
  valLenBuf.writeUInt32LE(valBytes.length, 0);

  const data = Buffer.concat([discriminator, fieldBuf, valLenBuf, valBytes]);

  return new TransactionInstruction({
    programId: TOKEN_2022_PROGRAM_ID,
    keys: [
      { pubkey: mint, isSigner: false, isWritable: true },
      { pubkey: updateAuthority, isSigner: true, isWritable: false },
    ],
    data,
  });
}

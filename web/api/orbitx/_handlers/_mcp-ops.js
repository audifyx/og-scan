/**
 * Unsigned-tx builders for OrbitX MCP: claim fees, rent refund, burn.
 * Non-custodial — caller signs with their wallet.
 *
 * Do NOT top-level import @solana/web3.js or @solana/spl-token.
 * Those pull rpc-websockets@9, which `require()`s ESM-only uuid@14 and
 * crashes the Vercel hub / x-mcp lambda on load (ERR_REQUIRE_ESM).
 * Load Solana only inside the functions that actually build txs.
 */
import {
  COLLECT_CREATOR_FEE_V2_DISCRIMINATOR,
  CLAIM_RPC_URLS,
  PUBLIC_SOLANA_RPC,
  PUMP_CREATOR_VAULT_SEED,
  PUMP_EVENT_AUTHORITY_SEED,
  PUMP_PROGRAM_ID,
  WSOL_MINT,
} from "../../../shared/pump-claim.js";

async function loadSolana() {
  const [web3, spl] = await Promise.all([
    import("@solana/web3.js"),
    import("@solana/spl-token"),
  ]);
  return { web3, spl };
}

function rpcCandidates() {
  const out = [];
  const add = (u) => {
    if (typeof u === "string" && /^https?:\/\//i.test(u) && !out.includes(u)) out.push(u);
  };
  add(process.env.SOLANA_RPC_URL);
  add(process.env.VITE_SOLANA_RPC_URL);
  for (const u of CLAIM_RPC_URLS) add(u);
  add(PUBLIC_SOLANA_RPC);
  add(process.env.HELIUS_RPC_URL);
  return out;
}

function rpcUrl() {
  return rpcCandidates()[0] || PUBLIC_SOLANA_RPC;
}

async function latestBlockhash(Connection) {
  let last;
  for (const url of rpcCandidates()) {
    try {
      return await new Connection(url, "confirmed").getLatestBlockhash("confirmed");
    } catch (e) {
      last = e;
    }
  }
  throw last || new Error("No Solana RPC available");
}

function collectCreatorFeeV2Ix(web3, spl, creatorPk) {
  const { PublicKey, SystemProgram, TransactionInstruction } = web3;
  const { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync } = spl;
  const programId = new PublicKey(PUMP_PROGRAM_ID);
  const quoteMint = new PublicKey(WSOL_MINT);
  const seed = (s) => new TextEncoder().encode(s);
  const [vault] = PublicKey.findProgramAddressSync(
    [seed(PUMP_CREATOR_VAULT_SEED), creatorPk.toBytes()],
    programId,
  );
  const [eventAuthority] = PublicKey.findProgramAddressSync(
    [seed(PUMP_EVENT_AUTHORITY_SEED)],
    programId,
  );
  const creatorAta = getAssociatedTokenAddressSync(quoteMint, creatorPk, true, TOKEN_PROGRAM_ID);
  const vaultAta = getAssociatedTokenAddressSync(quoteMint, vault, true, TOKEN_PROGRAM_ID);
  return new TransactionInstruction({
    programId,
    keys: [
      { pubkey: creatorPk, isSigner: false, isWritable: true },
      { pubkey: creatorAta, isSigner: false, isWritable: true },
      { pubkey: vault, isSigner: false, isWritable: true },
      { pubkey: vaultAta, isSigner: false, isWritable: true },
      { pubkey: quoteMint, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: eventAuthority, isSigner: false, isWritable: false },
      { pubkey: programId, isSigner: false, isWritable: false },
    ],
    data: Uint8Array.from(COLLECT_CREATOR_FEE_V2_DISCRIMINATOR),
  });
}

function serializeTx(tx, recentBlockhash, feePayer) {
  tx.feePayer = feePayer;
  tx.recentBlockhash = recentBlockhash;
  return Buffer.from(tx.serialize({ requireAllSignatures: false, verifySignatures: false })).toString("base64");
}

async function preparePumpClaimLocal(publicKey, quoteMint) {
  const { web3, spl } = await loadSolana();
  const { PublicKey, Transaction, ComputeBudgetProgram } = web3;
  const creator = new PublicKey(publicKey);
  const { blockhash } = await latestBlockhash(web3.Connection);
  const tx = new Transaction();
  tx.add(
    ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 }),
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 10_000 }),
    collectCreatorFeeV2Ix(web3, spl, creator),
  );
  if (quoteMint && String(quoteMint) !== String(WSOL_MINT)) {
    const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
    const mint = String(quoteMint).toLowerCase().includes("usdc") ? USDC : String(quoteMint);
    const { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync } = spl;
    const { SystemProgram, TransactionInstruction } = web3;
    const programId = new PublicKey(PUMP_PROGRAM_ID);
    const qMint = new PublicKey(mint);
    const seed = (s) => new TextEncoder().encode(s);
    const [vault] = PublicKey.findProgramAddressSync([seed(PUMP_CREATOR_VAULT_SEED), creator.toBytes()], programId);
    const [eventAuthority] = PublicKey.findProgramAddressSync([seed(PUMP_EVENT_AUTHORITY_SEED)], programId);
    const creatorAta = getAssociatedTokenAddressSync(qMint, creator, true, TOKEN_PROGRAM_ID);
    const vaultAta = getAssociatedTokenAddressSync(qMint, vault, true, TOKEN_PROGRAM_ID);
    tx.add(new TransactionInstruction({
      programId,
      keys: [
        { pubkey: creator, isSigner: false, isWritable: true },
        { pubkey: creatorAta, isSigner: false, isWritable: true },
        { pubkey: vault, isSigner: false, isWritable: true },
        { pubkey: vaultAta, isSigner: false, isWritable: true },
        { pubkey: qMint, isSigner: false, isWritable: false },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: eventAuthority, isSigner: false, isWritable: false },
        { pubkey: programId, isSigner: false, isWritable: false },
      ],
      data: Uint8Array.from(COLLECT_CREATOR_FEE_V2_DISCRIMINATOR),
    }));
  }
  return {
    ok: true,
    action: "collectCreatorFeeV2",
    source: "local",
    quoteMint: quoteMint || WSOL_MINT,
    transaction: serializeTx(tx, blockhash, creator),
    note: "Unsigned. Sign with the creator wallet (fee payer) to claim pump.fun creator fees from your creator vault via collect_creator_fee_v2.",
  };
}

/** Pump.fun creator fee claim — local collect_creator_fee_v2 only (PumpPortal Helius quota is dead). */
export async function preparePumpClaim(publicKey, quoteMint) {
  return preparePumpClaimLocal(publicKey, quoteMint);
}

/** Scan empty ATAs and build close-account txs (rent refund). */
export async function prepareRentRefund(publicKey) {
  const { web3, spl } = await loadSolana();
  const { Connection, PublicKey, Transaction } = web3;
  const { TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID, createCloseAccountInstruction } = spl;
  const conn = new Connection(rpcUrl(), "confirmed");
  const owner = new PublicKey(publicKey);
  const [legacy, token22] = await Promise.all([
    conn.getParsedTokenAccountsByOwner(owner, { programId: TOKEN_PROGRAM_ID }),
    conn.getParsedTokenAccountsByOwner(owner, { programId: TOKEN_2022_PROGRAM_ID }),
  ]);
  const emptyFixed = [
    ...legacy.value
      .filter((a) => Number(a.account.data.parsed.info.tokenAmount.amount) === 0 && !a.account.data.parsed.info.isNative)
      .map((a) => ({
        pubkey: a.pubkey,
        mint: a.account.data.parsed.info.mint,
        lamports: a.account.lamports,
        programId: TOKEN_PROGRAM_ID,
      })),
    ...token22.value
      .filter((a) => Number(a.account.data.parsed.info.tokenAmount.amount) === 0 && !a.account.data.parsed.info.isNative)
      .map((a) => ({
        pubkey: a.pubkey,
        mint: a.account.data.parsed.info.mint,
        lamports: a.account.lamports,
        programId: TOKEN_2022_PROGRAM_ID,
      })),
  ];

  const reclaimableSol = emptyFixed.reduce((s, a) => s + a.lamports, 0) / 1e9;
  if (!emptyFixed.length) {
    return { ok: true, accounts: [], reclaimableSol: 0, transactions: [], note: "No empty token accounts to close." };
  }

  const { blockhash } = await conn.getLatestBlockhash("confirmed");
  const batchSize = 20;
  const transactions = [];
  for (let i = 0; i < emptyFixed.length; i += batchSize) {
    const batch = emptyFixed.slice(i, i + batchSize);
    const tx = new Transaction();
    for (const a of batch) {
      tx.add(createCloseAccountInstruction(a.pubkey, owner, owner, [], a.programId));
    }
    transactions.push(serializeTx(tx, blockhash, owner));
  }

  return {
    ok: true,
    accounts: emptyFixed.map((a) => ({
      mint: a.mint,
      account: a.pubkey.toBase58(),
      lamports: a.lamports,
    })),
    reclaimableSol,
    transactions,
    note: "Unsigned close-account txs. Sign each to reclaim rent SOL to your wallet.",
  };
}

/** Build burn (+ optional close) for a mint amount. */
export async function prepareBurn(publicKey, mint, amount, percent) {
  const { web3, spl } = await loadSolana();
  const { Connection, PublicKey, Transaction } = web3;
  const {
    TOKEN_PROGRAM_ID,
    TOKEN_2022_PROGRAM_ID,
    createCloseAccountInstruction,
    createBurnInstruction,
  } = spl;
  const conn = new Connection(rpcUrl(), "confirmed");
  const owner = new PublicKey(publicKey);
  const mintPk = new PublicKey(mint);

  const [legacy, token22] = await Promise.all([
    conn.getParsedTokenAccountsByOwner(owner, { programId: TOKEN_PROGRAM_ID }),
    conn.getParsedTokenAccountsByOwner(owner, { programId: TOKEN_2022_PROGRAM_ID }),
  ]);

  let found = null;
  for (const a of legacy.value) {
    if (a.account.data.parsed.info.mint === mint) {
      found = {
        tokenAccount: a.pubkey,
        programId: TOKEN_PROGRAM_ID,
        decimals: a.account.data.parsed.info.tokenAmount.decimals,
        balanceRaw: BigInt(a.account.data.parsed.info.tokenAmount.amount),
      };
      break;
    }
  }
  if (!found) {
    for (const a of token22.value) {
      if (a.account.data.parsed.info.mint === mint) {
        found = {
          tokenAccount: a.pubkey,
          programId: TOKEN_2022_PROGRAM_ID,
          decimals: a.account.data.parsed.info.tokenAmount.decimals,
          balanceRaw: BigInt(a.account.data.parsed.info.tokenAmount.amount),
        };
        break;
      }
    }
  }
  if (!found || found.balanceRaw <= 0n) throw new Error("No balance for this mint in wallet");

  let amountRaw;
  if (percent != null && Number(percent) > 0) {
    const pct = Math.min(100, Math.max(0, Number(percent)));
    amountRaw = (found.balanceRaw * BigInt(Math.round(pct * 100))) / 10000n;
  } else if (typeof amount === "string" && amount.endsWith("%")) {
    const pct = Math.min(100, Math.max(0, Number(amount.slice(0, -1))));
    amountRaw = (found.balanceRaw * BigInt(Math.round(pct * 100))) / 10000n;
  } else {
    const [whole, frac = ""] = String(amount ?? "0").trim().split(".");
    const fracPadded = (frac + "0".repeat(found.decimals)).slice(0, found.decimals);
    amountRaw = BigInt(`${whole || "0"}${fracPadded}` || "0");
  }
  if (amountRaw <= 0n) throw new Error("Burn amount must be > 0");
  if (amountRaw > found.balanceRaw) amountRaw = found.balanceRaw;

  const tx = new Transaction();
  tx.add(
    createBurnInstruction(found.tokenAccount, mintPk, owner, amountRaw, [], found.programId),
  );
  let closesAccount = false;
  if (amountRaw >= found.balanceRaw) {
    tx.add(createCloseAccountInstruction(found.tokenAccount, owner, owner, [], found.programId));
    closesAccount = true;
  }

  const { blockhash } = await conn.getLatestBlockhash("confirmed");
  return {
    ok: true,
    mint,
    amountRaw: amountRaw.toString(),
    closesAccount,
    transaction: serializeTx(tx, blockhash, owner),
    note: "Unsigned burn tx. Sign with the holder wallet. Closing empty ATA returns rent if full burn.",
  };
}

/**
 * Build the full Metaplex NFT mint as ONE legacy Transaction (backend-signed by the desk):
 * create mint account + initializeMint2 (decimals 0) + create ATA + mintTo 1
 * + createMetadataAccountV3 + createMasterEditionV3.
 *
 * NOTE on the metaplex SDK: @metaplex-foundation/mpl-token-metadata@3.x only ships
 * umi-based helpers (createMetadataAccountV3(context, …), findMetadataPda(context, …) —
 * both require a umi Context), and the legacy createCreateMetadataAccountV3Instruction /
 * createCreateMasterEditionV3Instruction names from the 1.x line do not exist in 3.4.0.
 * To stay dependency-light the two metadata instructions are built directly with
 * @solana/web3.js, using the exact account metas + data layouts verified against the
 * 3.4.0 generated source (discriminators 33 / 17, PDA seeds
 * ["metadata", programId, mint] and ["metadata", programId, mint, "edition"]).
 * The rent sysvar is passed explicitly, matching the legacy v1 account layout.
 */
export async function prepareNftMint({ payer, name, symbol, uri, royaltyBps }) {
  const { web3, spl } = await loadSolana();
  const {
    Connection,
    PublicKey,
    SystemProgram,
    Transaction,
    TransactionInstruction,
    Keypair,
    SYSVAR_RENT_PUBKEY,
  } = web3;
  const {
    TOKEN_PROGRAM_ID,
    MINT_SIZE,
    getMinimumBalanceForRentExemptMint,
    createInitializeMint2Instruction,
    createAssociatedTokenAccountInstruction,
    createMintToInstruction,
    getAssociatedTokenAddressSync,
  } = spl;

  const payerPk = new PublicKey(String(payer || "").trim());
  const nftName = String(name || "").trim();
  const nftSymbol = (String(symbol || "NFT").trim().toUpperCase() || "NFT").slice(0, 10);
  const nftUri = String(uri || "").trim();
  if (!nftName || nftName.length > 32) throw new Error("name required (max 32 chars)");
  if (!/^https?:\/\//i.test(nftUri) || nftUri.length > 200) throw new Error("uri must be a public http(s) URL (max 200 chars)");
  const sellerFeeBasisPoints = Math.min(10000, Math.max(0, Number(royaltyBps) || 0));

  const conn = new Connection(rpcUrl(), "confirmed");
  const mintKp = Keypair.generate();
  const mintPk = mintKp.publicKey;
  const rentExempt = await getMinimumBalanceForRentExemptMint(conn);
  const ata = getAssociatedTokenAddressSync(mintPk, payerPk);

  const METADATA_PROGRAM_ID = new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");
  const [metadataPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("metadata"), METADATA_PROGRAM_ID.toBuffer(), mintPk.toBuffer()],
    METADATA_PROGRAM_ID,
  );
  const [editionPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("metadata"), METADATA_PROGRAM_ID.toBuffer(), mintPk.toBuffer(), Buffer.from("edition")],
    METADATA_PROGRAM_ID,
  );

  // Instruction data encoders — mirror the mpl-token-metadata 3.4.0 generated serializers.
  const encStr = (s) => {
    const b = Buffer.from(s, "utf8");
    const out = Buffer.alloc(4 + b.length);
    out.writeUInt32LE(b.length, 0);
    b.copy(out, 4);
    return out;
  };
  const u16 = (n) => {
    const b = Buffer.alloc(2);
    b.writeUInt16LE(n, 0);
    return b;
  };
  const u32 = (n) => {
    const b = Buffer.alloc(4);
    b.writeUInt32LE(n, 0);
    return b;
  };
  // CreateMetadataAccountV3 (discriminator 33) + DataV2.
  const metadataData = Buffer.concat([
    Buffer.from([33]),
    encStr(nftName),
    encStr(nftSymbol),
    encStr(nftUri),
    u16(sellerFeeBasisPoints),
    Buffer.concat([
      Buffer.from([1]), // creators: Some([...])
      u32(1),
      payerPk.toBuffer(), // address
      Buffer.from([1]), // verified
      Buffer.from([100]), // share
    ]),
    Buffer.from([0]), // collection: None
    Buffer.from([0]), // uses: None
    Buffer.from([1]), // isMutable
    Buffer.from([0]), // collectionDetails: None
  ]);
  // CreateMasterEditionV3 (discriminator 17) + maxSupply Some(0) = no prints.
  const editionData = Buffer.concat([
    Buffer.from([17]),
    Buffer.from([1]),
    Buffer.alloc(8),
  ]);

  const tx = new Transaction();
  tx.add(
    SystemProgram.createAccount({
      fromPubkey: payerPk,
      newAccountPubkey: mintPk,
      space: MINT_SIZE,
      lamports: rentExempt,
      programId: TOKEN_PROGRAM_ID,
    }),
    createInitializeMint2Instruction(mintPk, 0, payerPk, payerPk, TOKEN_PROGRAM_ID),
    createAssociatedTokenAccountInstruction(payerPk, ata, payerPk, mintPk),
    createMintToInstruction(mintPk, ata, payerPk, 1),
    new TransactionInstruction({
      programId: METADATA_PROGRAM_ID,
      keys: [
        { pubkey: metadataPda, isSigner: false, isWritable: true },
        { pubkey: mintPk, isSigner: false, isWritable: false },
        { pubkey: payerPk, isSigner: true, isWritable: false }, // mintAuthority
        { pubkey: payerPk, isSigner: true, isWritable: true }, // payer
        { pubkey: payerPk, isSigner: false, isWritable: false }, // updateAuthority
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
      ],
      data: metadataData,
    }),
    new TransactionInstruction({
      programId: METADATA_PROGRAM_ID,
      keys: [
        { pubkey: editionPda, isSigner: false, isWritable: true },
        { pubkey: mintPk, isSigner: false, isWritable: true },
        { pubkey: payerPk, isSigner: true, isWritable: false }, // updateAuthority
        { pubkey: payerPk, isSigner: true, isWritable: false }, // mintAuthority
        { pubkey: payerPk, isSigner: true, isWritable: true }, // payer
        { pubkey: metadataPda, isSigner: false, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
      ],
      data: editionData,
    }),
  );

  const { blockhash } = await latestBlockhash(web3.Connection);
  return {
    ok: true,
    mint: mintPk.toBase58(),
    transaction: serializeTx(tx, blockhash, payerPk),
    mintSecretKey: Buffer.from(mintKp.secretKey).toString("base64"),
  };
}

export async function nftEdge(action, body = {}) {
  const base = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
  const key = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
  if (!base || !key) throw new Error("Supabase URL/anon key missing for NFT sale");
  const r = await fetch(`${base}/functions/v1/nft-execute-sale`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      apikey: key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ action, ...body }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data?.error || data?.message || `NFT edge ${r.status}`);
  return data;
}

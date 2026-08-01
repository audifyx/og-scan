/**
 * Unsigned-tx builders for OrbitX MCP: claim fees, rent refund, burn.
 * Non-custodial — caller signs with their wallet.
 */
import {
  Connection,
  PublicKey,
  Transaction,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  createCloseAccountInstruction,
  createBurnInstruction,
} from "@solana/spl-token";

function rpcUrl() {
  return (
    process.env.SOLANA_RPC_URL ||
    process.env.HELIUS_RPC_URL ||
    process.env.VITE_SOLANA_RPC_URL ||
    "https://api.mainnet-beta.solana.com"
  );
}

function connection() {
  return new Connection(rpcUrl(), "confirmed");
}

function serializeTx(tx, recentBlockhash, feePayer) {
  tx.feePayer = feePayer;
  tx.recentBlockhash = recentBlockhash;
  return Buffer.from(tx.serialize({ requireAllSignatures: false, verifySignatures: false })).toString("base64");
}

/** Pump.fun creator fee claim via PumpPortal (same as in-app Claim Fees). */
export async function preparePumpClaim(publicKey) {
  const r = await fetch("https://pumpportal.fun/api/trade-local", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      publicKey,
      action: "collectCreatorFee",
      priorityFee: 0.000001,
    }),
  });
  if (!r.ok) {
    const msg = await r.text().catch(() => "");
    throw new Error(`Pump claim build failed (${r.status}): ${msg.slice(0, 200)}`);
  }
  const buf = Buffer.from(await r.arrayBuffer());
  return {
    ok: true,
    action: "collectCreatorFee",
    transaction: buf.toString("base64"),
    note: "Unsigned. Sign with the creator wallet to claim pump.fun creator fees across all your coins.",
  };
}

/** Scan empty ATAs and build close-account txs (rent refund). */
export async function prepareRentRefund(publicKey) {
  const conn = connection();
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
  const conn = connection();
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

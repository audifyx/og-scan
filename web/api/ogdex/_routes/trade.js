/**
 * OG DEX — non-custodial trade transaction builder.
 * Builds candidate buy/sell transactions (PumpPortal venues + Jupiter).
 * Races primary builders in parallel and returns the first usable tx so
 * Phantom/Jupiter can open for signing quickly. Simulation is opt-in
 * (local keypair path); extension wallets simulate themselves.
 *
 * Platform fee: 0.95% of SOL buys is routed to PLATFORM_FEE_WALLET
 * (45YR6f… desk / dev wallet) via:
 *   1) SystemProgram.transfer prepended into the swap tx when possible
 *   2) Jupiter platformFeeBps + feeAccount (output-token ATA) as backup
 */
import { send, readBody, callFn, jup, PLATFORM_FEE_WALLET } from "../_lib.js";

const SOL = "So11111111111111111111111111111111111111112";
const isPubkey = (v) => typeof v === "string" && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(v);

/** Keep in sync with web/src/lib/platformFee.ts */
const PLATFORM_FEE_BPS = 95;
const PLATFORM_FEE_ENABLED = true;
const TOKEN_PROGRAM_ID = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const ASSOCIATED_TOKEN_PROGRAM_ID = "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";

async function deriveFeeAccount(mint) {
  try {
    const { PublicKey } = await import("@solana/web3.js");
    const [ata] = PublicKey.findProgramAddressSync(
      [
        new PublicKey(PLATFORM_FEE_WALLET).toBuffer(),
        new PublicKey(TOKEN_PROGRAM_ID).toBuffer(),
        new PublicKey(mint).toBuffer(),
      ],
      new PublicKey(ASSOCIATED_TOKEN_PROGRAM_ID),
    );
    return ata.toBase58();
  } catch {
    return null;
  }
}

function computeBuyFee(amountSol) {
  const lamportsIn = Math.floor(Number(amountSol) * 1e9);
  if (!Number.isFinite(lamportsIn) || lamportsIn <= 0) {
    return { feeLamports: 0, tradeSol: Number(amountSol), tradeLamports: lamportsIn };
  }
  const feeLamports = Math.floor((lamportsIn * PLATFORM_FEE_BPS) / 10_000);
  const tradeLamports = Math.max(0, lamportsIn - feeLamports);
  return {
    feeLamports,
    tradeLamports,
    tradeSol: tradeLamports / 1e9,
    feeSol: feeLamports / 1e9,
    bps: PLATFORM_FEE_BPS,
    wallet: PLATFORM_FEE_WALLET,
  };
}

async function rpc(method, params) {
  const r = await callFn("rpc-proxy", { method, params, id: 1, provider: "helius" });
  return r?.data?.result ?? r?.result ?? null;
}

/** Prepend SOL → PLATFORM_FEE_WALLET transfer into a base64 VersionedTransaction. */
async function prependPlatformFeeTransfer(txB64, fromPubkey, feeLamports) {
  if (!feeLamports || feeLamports <= 0) return { tx: txB64, attached: false };
  try {
    const {
      PublicKey,
      SystemProgram,
      VersionedTransaction,
      TransactionMessage,
      AddressLookupTableAccount,
    } = await import("@solana/web3.js");

    const raw = Buffer.from(txB64, "base64");
    const tx = VersionedTransaction.deserialize(raw);
    const lookups = tx.message.addressTableLookups || [];
    const altAccounts = [];

    for (const lu of lookups) {
      const key = lu.accountKey.toBase58?.() || String(lu.accountKey);
      const acc = await rpc("getAccountInfo", [key, { encoding: "base64" }]);
      const b64 = acc?.value?.data?.[0];
      if (!b64) continue;
      const data = Buffer.from(b64, "base64");
      altAccounts.push(
        new AddressLookupTableAccount({
          key: new PublicKey(key),
          state: AddressLookupTableAccount.deserialize(data),
        }),
      );
    }

    const decompiled = TransactionMessage.decompile(tx.message, {
      addressLookupTableAccounts: altAccounts,
    });
    const feeIx = SystemProgram.transfer({
      fromPubkey: new PublicKey(fromPubkey),
      toPubkey: new PublicKey(PLATFORM_FEE_WALLET),
      lamports: feeLamports,
    });
    decompiled.instructions = [feeIx, ...decompiled.instructions];
    const compiled = decompiled.compileToV0Message(altAccounts);
    const next = new VersionedTransaction(compiled);
    return { tx: Buffer.from(next.serialize()).toString("base64"), attached: true };
  } catch (e) {
    return { tx: txB64, attached: false, attachError: String(e?.message || e) };
  }
}

// Simulate an unsigned base64 tx with a replaced blockhash. Returns {ok, err}.
// Fails OPEN (ok:true) if the simulation RPC itself is unavailable, so a flaky
// RPC never blocks a legitimate trade.
async function simulate(txB64) {
  try {
    const res = await rpc("simulateTransaction", [
      txB64,
      {
        sigVerify: false,
        replaceRecentBlockhash: true,
        encoding: "base64",
        commitment: "processed",
      },
    ]);
    if (!res || !res.value) return { ok: true, unknown: true };
    return { ok: res.value.err == null, err: res.value.err };
  } catch {
    return { ok: true, unknown: true };
  }
}

async function tokenBalance(owner, mint) {
  try {
    const res = await rpc("getTokenAccountsByOwner", [
      owner,
      { mint },
      { encoding: "jsonParsed" },
    ]);
    let raw = 0n;
    let decimals = 0;
    for (const a of res?.value || []) {
      const ta = a.account?.data?.parsed?.info?.tokenAmount;
      if (ta) {
        raw += BigInt(ta.amount || "0");
        decimals = Number(ta.decimals) || decimals;
      }
    }
    return { raw, decimals };
  } catch {
    return { raw: 0n, decimals: 0 };
  }
}

async function pumpPortalTx({ publicKey, action, mint, amt, denominatedInSol, slippage, priorityFee, pool }) {
  try {
    const r = await fetch("https://pumpportal.fun/api/trade-local", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        publicKey,
        action,
        mint,
        amount: amt,
        denominatedInSol,
        slippage,
        priorityFee,
        pool,
      }),
    });
    const ct = r.headers.get("content-type") || "";
    if (r.ok && !ct.includes("application/json")) {
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.length) return { tx: buf.toString("base64"), via: "pumpportal", pool };
    }
    const txt = await r.text().catch(() => "");
    let msg = txt.slice(0, 160);
    try {
      const j = JSON.parse(txt);
      msg = j.errors
        ? Array.isArray(j.errors)
          ? j.errors.join("; ")
          : JSON.stringify(j.errors)
        : j.error || msg;
    } catch {
      /* keep */
    }
    return { error: msg };
  } catch (e) {
    return { error: String(e?.message || e) };
  }
}

async function jupiterTx({
  publicKey,
  action,
  mint,
  amt,
  slippage,
  quoteResponse,
  withPlatformFee = true,
}) {
  try {
    const slippageBps = Math.min(Math.max(Math.round((Number(slippage) || 10) * 100), 50), 5000);
    let q =
      quoteResponse && typeof quoteResponse === "object" && quoteResponse.outAmount
        ? quoteResponse
        : null;
    let inputMint;
    let outputMint;
    let amount;
    if (!q) {
      if (action === "buy") {
        inputMint = SOL;
        outputMint = mint;
        amount = Math.floor(Number(amt) * 1e9);
      } else {
        inputMint = mint;
        outputMint = SOL;
        const { raw, decimals } = await tokenBalance(publicKey, mint);
        if (raw <= 0n) return { error: "no balance to sell" };
        if (typeof amt === "string" && amt.endsWith("%")) {
          amount = Number((raw * BigInt(Math.round(Number(amt.slice(0, -1)))) / 100n).toString());
        } else {
          amount = Math.floor(Number(amt) * 10 ** decimals);
        }
      }
      if (!amount || amount <= 0) return { error: "invalid amount" };
      const feeQs =
        PLATFORM_FEE_ENABLED && withPlatformFee ? `&platformFeeBps=${PLATFORM_FEE_BPS}` : "";
      q = await jup(
        `/swap/v1/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=${slippageBps}&restrictIntermediateTokens=true${feeQs}`,
      ).catch(() => null);
    }
    if (!q || q.error || !q.outAmount) return { error: q?.error || "no route" };

    const feeMint = action === "buy" ? mint : SOL;
    const feeAccount =
      PLATFORM_FEE_ENABLED && withPlatformFee ? await deriveFeeAccount(feeMint) : null;

    const r = await fetch("https://lite-api.jup.ag/swap/v1/swap", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        quoteResponse: q,
        userPublicKey: publicKey,
        wrapAndUnwrapSol: true,
        dynamicComputeUnitLimit: true,
        prioritizationFeeLamports: "auto",
        ...(feeAccount ? { feeAccount } : {}),
      }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.swapTransaction) {
      // Retry without Jupiter token fee if feeAccount ATA is missing
      if (feeAccount && withPlatformFee) {
        return jupiterTx({
          publicKey,
          action,
          mint,
          amt,
          slippage,
          quoteResponse: null,
          withPlatformFee: false,
        });
      }
      return { error: j.error || "jupiter swap failed" };
    }
    return {
      tx: j.swapTransaction,
      via: "jupiter",
      pool: null,
      jupiterPlatformFee: Boolean(feeAccount && withPlatformFee),
    };
  } catch (e) {
    return { error: String(e?.message || e) };
  }
}

/** Resolve with the first builder that returns a tx; collect last error if all fail. */
async function raceFirstTx(runners) {
  if (!runners.length) return { error: "no builders" };
  return new Promise((resolve) => {
    let left = runners.length;
    let lastErr = "Could not build a working trade";
    for (const run of runners) {
      Promise.resolve()
        .then(run)
        .then((out) => {
          if (out?.tx) {
            resolve(out);
            return;
          }
          if (out?.error) lastErr = out.error;
          if (--left === 0) resolve({ error: lastErr });
        })
        .catch((e) => {
          lastErr = String(e?.message || e);
          if (--left === 0) resolve({ error: lastErr });
        });
    }
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") return send(res, 405, { ok: false, error: "POST only" });
  let body = {};
  try {
    body = await readBody(req);
  } catch {
    body = {};
  }

  const publicKey = body.publicKey;
  const action = body.action === "sell" ? "sell" : "buy";
  const mint = body.mint;
  const denominatedInSol =
    action === "buy"
      ? "true"
      : body.denominatedInSol === true || body.denominatedInSol === "true"
        ? "true"
        : "false";
  const slippage = Math.min(Math.max(Number(body.slippage) || 10, 1), 50);
  const priorityFee = Math.min(Math.max(Number(body.priorityFee) || 0.0003, 0), 0.01);
  const reqPool = ["auto", "pump", "raydium", "pump-amm", "launchlab", "raydium-cpmm", "bonk"].includes(
    body.pool,
  )
    ? body.pool
    : "auto";
  const wantSim = body.simulate === true || body.simulate === "true";
  const quoteResponse =
    body.quoteResponse && typeof body.quoteResponse === "object" ? body.quoteResponse : null;
  const feeOn =
    PLATFORM_FEE_ENABLED && body.platformFee !== false && body.platformFee !== "false";

  if (!isPubkey(publicKey)) return send(res, 400, { ok: false, error: "invalid publicKey" });
  if (!isPubkey(mint)) return send(res, 400, { ok: false, error: "invalid mint" });

  let amt;
  const rawAmt = typeof body.amount === "string" ? body.amount.trim() : body.amount;
  if (action === "sell" && typeof rawAmt === "string" && rawAmt.endsWith("%")) {
    const pct = Number(rawAmt.slice(0, -1));
    if (!Number.isFinite(pct) || pct <= 0 || pct > 100) {
      return send(res, 400, { ok: false, error: "invalid sell percentage" });
    }
    amt = `${pct}%`;
  } else {
    const n = Number(rawAmt);
    if (!Number.isFinite(n) || n <= 0) return send(res, 400, { ok: false, error: "invalid amount" });
    amt = n;
  }

  // SOL buys: skim 0.95% to desk wallet, trade the remainder
  let feeInfo = null;
  let tradeAmt = amt;
  if (feeOn && action === "buy" && denominatedInSol === "true" && typeof amt === "number") {
    feeInfo = computeBuyFee(amt);
    if (feeInfo.feeLamports > 0 && feeInfo.tradeSol > 0) {
      tradeAmt = feeInfo.tradeSol;
    } else {
      feeInfo = null;
    }
  }

  const pumpOpts = {
    publicKey,
    action,
    mint,
    amt: tradeAmt,
    denominatedInSol,
    slippage,
    priorityFee,
  };

  // Buys: SOL skim → desk wallet (do not also take Jupiter token fee — double charge).
  // Sells: Jupiter platformFeeBps → desk WSOL ATA.
  const jupTokenFee = feeOn && !feeInfo;

  // Prefer Jupiter first so PumpPortal protocol fee wallets don't win the race.
  let out = await jupiterTx({
    publicKey,
    action,
    mint,
    amt: tradeAmt,
    slippage,
    quoteResponse,
    withPlatformFee: jupTokenFee,
  });

  if (!out?.tx) {
    const primaryPools = [...new Set([reqPool, "auto", "pump"].filter(Boolean))];
    const wave1 = [
      ...primaryPools.map((pl) => () => pumpPortalTx({ ...pumpOpts, pool: pl })),
      () =>
        jupiterTx({
          publicKey,
          action,
          mint,
          amt: tradeAmt,
          slippage,
          quoteResponse: null,
          withPlatformFee: jupTokenFee,
        }),
    ];
    out = await raceFirstTx(wave1);

    if (!out?.tx) {
      const secondary = ["pump-amm", "raydium", "bonk", "raydium-cpmm", "launchlab"].filter(
        (pl) => !primaryPools.includes(pl),
      );
      if (secondary.length) {
        out = await raceFirstTx(secondary.map((pl) => () => pumpPortalTx({ ...pumpOpts, pool: pl })));
      }
    }
  }

  if (!out?.tx) {
    return send(res, 200, { ok: false, error: out?.error || "Could not build a working trade" });
  }

  let feeAttached = false;
  let feeAttachError = null;
  if (feeInfo?.feeLamports > 0) {
    const attached = await prependPlatformFeeTransfer(out.tx, publicKey, feeInfo.feeLamports);
    out = { ...out, tx: attached.tx };
    feeAttached = Boolean(attached.attached);
    feeAttachError = attached.attachError || null;
  }

  const payload = {
    ok: true,
    tx: out.tx,
    via: out.via || null,
    pool: out.pool ?? null,
    simulated: false,
    platformFee: feeInfo
      ? {
          enabled: true,
          bps: feeInfo.bps,
          wallet: PLATFORM_FEE_WALLET,
          feeSol: feeInfo.feeSol,
          feeLamports: feeInfo.feeLamports,
          tradeSol: feeInfo.tradeSol,
          attached: feeAttached,
          jupiterTokenFee: Boolean(out.jupiterPlatformFee),
          ...(feeAttachError && !feeAttached ? { attachError: feeAttachError } : {}),
          note: feeAttached
            ? `Includes ${feeInfo.feeSol} SOL transfer to desk wallet ${PLATFORM_FEE_WALLET}`
            : `Trade amount reduced by ${feeInfo.feeSol} SOL platform fee; transfer attach ${feeAttached ? "ok" : "pending/failed"} — fee wallet ${PLATFORM_FEE_WALLET}`,
        }
      : {
          enabled: feeOn,
          bps: PLATFORM_FEE_BPS,
          wallet: PLATFORM_FEE_WALLET,
          attached: false,
          jupiterTokenFee: Boolean(out.jupiterPlatformFee),
        },
  };

  // If SOL fee failed to attach into the swap tx, return a separate fee tx so
  // the sign page can send desk payment then the swap (same session).
  if (feeInfo?.feeLamports > 0 && !feeAttached) {
    try {
      const { PublicKey, SystemProgram, Transaction, Connection } = await import("@solana/web3.js");
      const rpcUrl =
        process.env.SOLANA_RPC_URL ||
        process.env.HELIUS_RPC_URL ||
        "https://api.mainnet-beta.solana.com";
      const connection = new Connection(rpcUrl, "confirmed");
      const { blockhash } = await connection.getLatestBlockhash("confirmed");
      const feeTx = new Transaction({
        feePayer: new PublicKey(publicKey),
        recentBlockhash: blockhash,
      }).add(
        SystemProgram.transfer({
          fromPubkey: new PublicKey(publicKey),
          toPubkey: new PublicKey(PLATFORM_FEE_WALLET),
          lamports: feeInfo.feeLamports,
        }),
      );
      payload.feeTx = feeTx.serialize({ requireAllSignatures: false, verifySignatures: false }).toString("base64");
      payload.platformFee.separateFeeTx = true;
      payload.platformFee.note = `Sign feeTx first (${feeInfo.feeSol} SOL → ${PLATFORM_FEE_WALLET}), then the swap tx.`;
    } catch (e) {
      payload.platformFee.feeTxError = String(e?.message || e);
    }
  }

  if (!wantSim) {
    return send(res, 200, payload);
  }

  const sim = await simulate(out.tx);
  if (sim.ok && !sim.unknown) {
    return send(res, 200, { ...payload, simulated: true });
  }
  if (sim.unknown) {
    return send(res, 200, payload);
  }
  return send(res, 200, {
    ...payload,
    simulated: false,
    warning: "Route simulation flagged a risk — confirm carefully in your wallet",
  });
}

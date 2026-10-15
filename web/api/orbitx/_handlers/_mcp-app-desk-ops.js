/**
 * Desk-signed pump launch, creator-fee claim, and flexible burn.
 * Same model as orbitx_app_buy: backend signs, no Phantom popup.
 */
import { getUserWallet, getDeskFunds, signAndSendUserTx, loadDeskKeypair, SOL_MINT, isSigningAuth } from "./_user-trading-wallet.js";
import { prepareBurn, preparePumpClaim, prepareRentRefund, prepareUnwrapWsol, prepareNftMint } from "./_mcp-ops.js";

const DASH = "https://www.orbitx.world/supercomputer?tab=inapp";
const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const FALLBACK_PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAAhUlEQVR4nO3QsQ0AIAwDsPL+Q6eLFyBFykx+Vck7AAAAAAAAAAAAAAD4r7X2zMyyM7O9997M3Hs/M3vvzcyyM7O99wAAAAAAAAAAAAD8X2vtzMyyM7O9997M3Hs/M3vvzcyyM7O99wAAAAAAAAAAAAD8X2vtlZllZ2Z7772Zufd+Zvbem5llZ2Z77wEAAAAAAAAAAIAfH3YGBQ2yXq8AAAAASUVORK5CYII=";

function needAuth(auth) {
  // F2: same provenance gate as _mcp-app-wallet.js — { userId } alone is not
  // enough; the credential must carry a source stamped by the auth flow.
  if (isSigningAuth(auth)) return { userId: auth.userId };
  return { ok: false, error: "auth_required", dashboard: DASH, message: "Link OrbitX auth first." };
}

/* F3: interpret a signAndSendUserTx result honestly. Broadcast acceptance is
 * NOT success — pending/failed must never come back as ok:true. */
function sendOutcome(live, successFields) {
  const base = {
    signature: live?.signature || null,
    wallet: live?.owner || null,
    tx: live?.signature ? `https://solscan.io/tx/${live.signature}` : null,
    confirmationStatus: live?.confirmationStatus || null,
  };
  if (live?.pending) {
    return {
      ...base,
      ok: false,
      pending: true,
      status: "pending",
      error: live.error || "tx_unconfirmed",
      message:
        live.message ||
        "Transaction broadcast accepted by the RPC but not confirmed yet. It may still land — check the explorer before retrying; do NOT blindly re-submit.",
    };
  }
  if (!live?.ok) {
    return { ...base, ok: false, status: "failed", error: live?.error || "tx_failed", message: live?.message || "The transaction did not complete." };
  }
  return { ...base, ok: true, signedOn: "backend", clickToSign: false, confirmed: true, ...successFields };
}

function pairOf(args = {}) {
  const raw = String(args.pair || args.quote || args.quoteMint || args.payWith || args.currency || "sol").toLowerCase();
  if (raw.includes("usdc") || raw === USDC.toLowerCase()) return "usdc";
  return "sol";
}

async function tokenInfo(mint) {
  const r = await fetch("https://api.dexscreener.com/latest/dex/tokens/" + mint, { signal: AbortSignal.timeout(8000) });
  const j = await r.json().catch(() => ({}));
  const p = (j.pairs || []).find((x) => String(x.chainId || "").toLowerCase() === "solana") || (j.pairs || [])[0] || {};
  return {
    mint,
    symbol: p.baseToken?.symbol || "?",
    name: p.baseToken?.name || "",
    priceUsd: Number(p.priceUsd || 0),
    mcap: Number(p.marketCap || p.fdv || 0),
    url: p.url || `https://pump.fun/${mint}`,
  };
}

/* ─── Upload validation (security) ─────────────────────────────────────
 * Token images are pinned to IPFS and served to every visitor — an SVG/HTML
 * payload here is stored XSS. Enforce an image-only allowlist, a size cap,
 * and magic-byte verification (never trust client-supplied MIME/extension).
 */
const MAX_UPLOAD_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_UPLOAD_IMAGES = {
  "image/png": { ext: "png", magic: [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]] },
  "image/jpeg": { ext: "jpg", magic: [[0xff, 0xd8, 0xff]] },
  "image/gif": { ext: "gif", magic: [[0x47, 0x49, 0x46, 0x38]] },
  "image/webp": { ext: "webp", magic: [[0x52, 0x49, 0x46, 0x46]] }, // RIFF....WEBP
};
function _uploadMatchesMagic(buf, sig) {
  if (buf.length < sig.length) return false;
  for (let i = 0; i < sig.length; i++) if (buf[i] !== sig[i]) return false;
  return true;
}
/** Validate raw bytes; returns the VERIFIED mime/ext (not the claimed one). */
function validateUploadImageBytes(buf) {
  if (!buf || buf.length === 0 || buf.length > MAX_UPLOAD_IMAGE_BYTES)
    return { ok: false, error: "Image must be under 5 MB" };
  for (const [mime, rule] of Object.entries(ALLOWED_UPLOAD_IMAGES)) {
    const magicOk = rule.magic.some((sig) => _uploadMatchesMagic(buf, sig));
    if (!magicOk) continue;
    if (mime === "image/webp") {
      if (!(buf.length >= 12 && buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50))
        continue;
    }
    return { ok: true, buffer: buf, mime, ext: rule.ext };
  }
  return { ok: false, error: "Unsupported image type. Use PNG, JPG, GIF, or WebP." };
}
function validateUploadImageB64(imageBase64) {
  if (typeof imageBase64 !== "string" || !imageBase64.length)
    return { ok: false, error: "Missing image data" };
  if (imageBase64.length > Math.ceil((MAX_UPLOAD_IMAGE_BYTES * 4) / 3) + 4096)
    return { ok: false, error: "Image must be under 5 MB" };
  let buf;
  try {
    buf = Buffer.from(imageBase64, "base64");
  } catch {
    return { ok: false, error: "Invalid base64 image data" };
  }
  return validateUploadImageBytes(buf);
}

async function imageToBase64(args = {}) {
  if (args.imageBase64) {
    return {
      imageBase64: String(args.imageBase64).replace(/^data:[^;]+;base64,/, ""),
      imageMimeType: args.imageMimeType || "image/png",
    };
  }
  const url = String(args.imageUrl || args.image || "").trim();
  if (/^https:\/\//i.test(url)) {
    // SSRF guard: only public https hosts, no credentials in URL.
    let host = "";
    try {
      const u = new URL(url);
      host = u.hostname.toLowerCase();
      if (u.username || u.password) throw new Error("bad url");
    } catch {
      throw new Error("invalid image URL");
    }
    if (
      host === "localhost" ||
      host.endsWith(".localhost") ||
      host === "metadata.google.internal" ||
      host === "169.254.169.254" ||
      /^10\./.test(host) ||
      /^192\.168\./.test(host) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
      /^127\./.test(host) ||
      host === "::1" ||
      host === "0.0.0.0"
    ) {
      throw new Error("image URL host not allowed");
    }
    const r = await fetch(url, { signal: AbortSignal.timeout(12000) });
    if (!r.ok) throw new Error("image fetch failed");
    const mime = String(r.headers.get("content-type") || "image/png").split(";")[0].trim();
    const len = Number(r.headers.get("content-length") || "0");
    if (len > MAX_UPLOAD_IMAGE_BYTES) throw new Error("image too large");
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length > MAX_UPLOAD_IMAGE_BYTES) throw new Error("image too large");
    // Trust the bytes, not the remote content-type: magic-byte check decides.
    const probe = validateUploadImageBytes(buf);
    if (!probe.ok) throw new Error(probe.error);
    return { imageBase64: buf.toString("base64"), imageMimeType: probe.mime };
  }
  return { imageBase64: FALLBACK_PNG, imageMimeType: "image/png" };
}

async function pinMetadata({ name, symbol, description, twitter, telegram, website, imageBase64, imageMimeType }) {
  const PINATA_JWT = process.env.PINATA_JWT;
  if (!PINATA_JWT) throw new Error("PINATA_JWT is not configured");
  // Validate the image bytes (allowlist + size + magic bytes) before IPFS.
  // The verified mime/ext are used — never the caller-supplied values.
  const validated = validateUploadImageB64(imageBase64);
  if (!validated.ok) throw new Error(validated.error);
  const imageBuffer = validated.buffer;
  const ext = validated.ext;
  const imgForm = new FormData();
  imgForm.append("file", new Blob([imageBuffer], { type: validated.mime }), `token.${ext}`);
  imgForm.append("pinataMetadata", JSON.stringify({ name: `${symbol}-image` }));
  const imgRes = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
    method: "POST",
    headers: { Authorization: `Bearer ${PINATA_JWT}` },
    body: imgForm,
  });
  if (!imgRes.ok) throw new Error(`Pinata image pin failed (${imgRes.status}): ${await imgRes.text()}`);
  const { IpfsHash: imageHash } = await imgRes.json();
  const imageUri = `https://gateway.pinata.cloud/ipfs/${imageHash}`;
  const metadata = {
    name,
    symbol,
    description: description || "",
    image: imageUri,
    showName: true,
    createdOn: "https://www.orbitx.world",
    platformId: "orbitx",
    platform: "OrbitX",
    website: website || "https://www.orbitx.world",
    external_url: website || "https://www.orbitx.world",
    twitter: twitter || "",
    telegram: telegram || "",
    tags: ["orbitx", "orbitx-launch"],
  };
  const metaRes = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
    method: "POST",
    headers: { Authorization: `Bearer ${PINATA_JWT}`, "Content-Type": "application/json" },
    body: JSON.stringify({ pinataMetadata: { name: `${symbol}-metadata` }, pinataContent: metadata }),
  });
  if (!metaRes.ok) throw new Error(`Pinata metadata pin failed (${metaRes.status}): ${await metaRes.text()}`);
  const { IpfsHash: metaHash } = await metaRes.json();
  return { metadataUri: `https://gateway.pinata.cloud/ipfs/${metaHash}`, imageUri, metadata };
}

async function grindObx(budgetMs = 8000) {
  const { ed25519 } = await import("@noble/curves/ed25519");
  const bs58mod = await import("bs58");
  const bs58 = bs58mod.default || bs58mod;
  const t0 = Date.now();
  let attempts = 0;
  while (Date.now() - t0 < budgetMs) {
    attempts += 1;
    const kp = ed25519.keygen();
    const secretKey64 = new Uint8Array(64);
    secretKey64.set(kp.secretKey, 0);
    secretKey64.set(kp.publicKey, 32);
    const publicKey = bs58.encode(kp.publicKey);
    if (publicKey.toLowerCase().endsWith("obx")) {
      return { publicKey, secretKey64, attempts, timeMs: Date.now() - t0, vanity: true };
    }
  }
  const { Keypair } = await import("@solana/web3.js");
  const fallback = Keypair.generate();
  return {
    publicKey: fallback.publicKey.toBase58(),
    secretKey64: fallback.secretKey,
    attempts,
    timeMs: Date.now() - t0,
    vanity: false,
  };
}

async function pumpCreateTx({ publicKey, metadataUri, name, symbol, mintPublicKey, amount, pair, slippage }) {
  const useUsdc = pair === "usdc";
  const payload = {
    publicKey,
    action: "create",
    tokenMetadata: { name, symbol, uri: metadataUri },
    mint: mintPublicKey,
    denominatedInSol: useUsdc ? "false" : "true",
    amount: Number(amount || 0),
    slippage: slippage || 15,
    priorityFee: 0.0005,
    pool: "pump",
  };
  if (useUsdc) payload.quoteMint = USDC;
  const ppRes = await fetch("https://pumpportal.fun/api/trade-local", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!ppRes.ok) {
    const errText = await ppRes.text();
    if (useUsdc) {
      const retry = await fetch("https://pumpportal.fun/api/trade-local", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
          denominatedInSol: "true",
          quoteMint: USDC,
        }),
      });
      if (retry.ok) {
        const txBytes = new Uint8Array(await retry.arrayBuffer());
        return { txBase64: Buffer.from(txBytes).toString("base64"), usedPair: "usdc", note: "usdc quoteMint" };
      }
      throw new Error(`PumpPortal USDC create failed (${ppRes.status}): ${errText}`);
    }
    throw new Error(`PumpPortal create failed (${ppRes.status}): ${errText}`);
  }
  const txBytes = new Uint8Array(await ppRes.arrayBuffer());
  return { txBase64: Buffer.from(txBytes).toString("base64"), usedPair: pair };
}

export async function appLaunch(auth, args = {}) {
  const gate = needAuth(auth);
  if (!gate.userId) return gate;
  const row = await getUserWallet(gate.userId);
  if (!row) return { ok: false, error: "no_wallet", message: "Create a desk wallet first." };
  const name = String(args.name || "").trim();
  const symbol = String(args.symbol || args.ticker || "").trim().replace(/^\$/, "").slice(0, 12);
  if (!name || !symbol) return { ok: false, error: "need_name_symbol", message: "Need token name and ticker." };
  const pair = pairOf(args);
  const funds = await getDeskFunds(row.public_key);
  let px = 110;
  try {
    const r = await fetch("https://api.dexscreener.com/latest/dex/tokens/" + SOL_MINT, { signal: AbortSignal.timeout(6000) });
    const j = await r.json();
    const live = Number((j.pairs || [])[0]?.priceUsd || 0);
    if (live > 0) px = live;
  } catch {}
  let devBuy = Number(args.devBuySol || args.amountSol || 0);
  if (!devBuy && args.devBuyUsd) devBuy = Number(args.devBuyUsd) / px;
  if (!devBuy && args.devBuyUsdc) devBuy = pair === "usdc" ? Number(args.devBuyUsdc) : Number(args.devBuyUsdc) / px;
  if (!devBuy && args.usd) devBuy = pair === "usdc" ? Number(args.usd) : Number(args.usd) / px;
  if (pair === "sol" && funds.sol < 0.004 + Number(devBuy || 0)) {
    return {
      ok: false,
      error: "underfunded",
      message: `Desk has ${funds.sol.toFixed(4)} SOL. Launch needs rent + priority (~0.004) plus any dev buy.`,
      publicKey: row.public_key,
    };
  }
  if (pair === "usdc" && Number(devBuy || 0) > 0 && funds.usdc < Number(devBuy)) {
    return {
      ok: false,
      error: "underfunded_usdc",
      message: `Desk has ${funds.usdc.toFixed(2)} USDC. Fund USDC or launch on the SOL pair.`,
      publicKey: row.public_key,
    };
  }
  const img = await imageToBase64(args);
  let pinned;
  try {
    pinned = await pinMetadata({
      name,
      symbol,
      description: args.description || "",
      twitter: args.twitter || "",
      telegram: args.telegram || "",
      website: args.website || "",
      ...img,
    });
  } catch (e) {
    if (/PINATA_JWT/.test(String(e?.message || ""))) {
      return {
        ok: false,
        error: "pinata_not_configured",
        message: "Launches are free — only gas + mint rent apply. But IPFS pinning isn't set up yet: add PINATA_JWT to Vercel env (Production). Get a key at https://app.pinata.cloud/keys, then retry the launch.",
        fixUrl: "https://app.pinata.cloud/keys",
      };
    }
    throw e;
  }
  const vanity = await grindObx(8000);
  const { Keypair } = await import("@solana/web3.js");
  const mintKp = Keypair.fromSecretKey(Uint8Array.from(vanity.secretKey64));
  const built = await pumpCreateTx({
    publicKey: row.public_key,
    metadataUri: pinned.metadataUri,
    name,
    symbol,
    mintPublicKey: vanity.publicKey,
    amount: devBuy || 0,
    pair,
    slippage: Number(args.slippage || 15),
  });
  const live = await signAndSendUserTx(row, built.txBase64, [mintKp]);
  return sendOutcome(live, {
    action: "launch",
    name,
    symbol,
    mint: vanity.publicKey,
    vanity: vanity.vanity,
    vanitySuffix: "obx",
    attempts: vanity.attempts,
    pair: built.usedPair,
    quote: built.usedPair === "usdc" ? "USDC" : "SOL",
    metadataUri: pinned.metadataUri,
    image: pinned.imageUri,
    pump: `https://pump.fun/${vanity.publicKey}`,
    headline: `LAUNCHED ${symbol} · ${vanity.publicKey} · ${built.usedPair.toUpperCase()} pair`,
    message: vanity.vanity
      ? `Live. CA ends in obx. ${built.usedPair.toUpperCase()} pair. Desk signed — no popup.`
      : `Live (random CA, vanity budget missed obx). ${built.usedPair.toUpperCase()} pair. Desk signed.`,
  });
}

export async function appClaimFees(auth, args = {}) {
  const gate = needAuth(auth);
  if (!gate.userId) return gate;
  const row = await getUserWallet(gate.userId);
  if (!row) return { ok: false, error: "no_wallet" };
  const quote = pairOf(args) === "usdc" ? USDC : undefined;
  const built = await preparePumpClaim(row.public_key, quote);
  if (!built?.transaction) return { ok: false, error: "claim_build_failed", built };
  const live = await signAndSendUserTx(row, built.transaction);
  return sendOutcome(live, {
    action: "claim_fees",
    quote: quote ? "USDC" : "SOL",
    message: "Creator fees claimed to your desk wallet.",
  });
}

function parseBurnSpec(args = {}) {
  if (args.percent != null && args.percent !== "") return { percent: Number(args.percent) };
  const raw = String(args.amount ?? args.size ?? args.text ?? "").trim();
  if (!raw && args.usd == null && args.amountUsd == null) return {};
  if (/%$/.test(raw) || /percent/i.test(raw)) {
    return { percent: Number(raw.replace(/[^\d.]/g, "")) };
  }
  const cents = raw.match(/(\d+(?:\.\d+)?)\s*cents?/i);
  if (cents) return { usd: Number(cents[1]) / 100 };
  if (/\$|usd|dollar|cent/i.test(raw) || args.usd != null || args.amountUsd != null) {
    const usd = args.usd != null ? Number(args.usd) : args.amountUsd != null ? Number(args.amountUsd) : Number(raw.replace(/[^\d.]/g, ""));
    return { usd };
  }
  if (raw) return { amount: raw };
  return {};
}

export async function appBurn(auth, args = {}) {
  const gate = needAuth(auth);
  if (!gate.userId) return gate;
  const row = await getUserWallet(gate.userId);
  if (!row) return { ok: false, error: "no_wallet" };
  const mint = String(args.mint || args.ca || "").trim();
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(mint)) return { ok: false, error: "bad_mint" };
  const spec = parseBurnSpec(args);
  let amount = spec.amount;
  let percent = spec.percent;
  if (spec.usd != null && Number(spec.usd) > 0) {
    const info = await tokenInfo(mint);
    if (!info.priceUsd) return { ok: false, error: "no_price", message: "No USD price yet — burn by percent or token amount." };
    amount = String(Number(spec.usd) / info.priceUsd);
  }
  if (percent == null && amount == null) return { ok: false, error: "need_size", message: "Say burn 10%, burn 1000 tokens, or burn 12 cents." };
  let built;
  try {
    built = await prepareBurn(row.public_key, mint, amount, percent);
  } catch (e) {
    const msg = String(e?.message || "");
    if (/No balance/i.test(msg)) {
      return { ok: false, error: "no_balance", message: `Desk holds no ${mint.slice(0, 8)}… to burn.`, mint, wallet: row.public_key };
    }
    return { ok: false, error: "burn_build_failed", message: msg || "Could not build burn transaction.", mint };
  }
  const live = await signAndSendUserTx(row, built.transaction);
  return sendOutcome(live, {
    action: "burn",
    mint,
    amountRaw: built.amountRaw,
    percent: percent ?? null,
    usd: spec.usd ?? null,
    closesAccount: built.closesAccount,
    message: built.closesAccount ? "Full bag burned. ATA closed, rent back to desk." : "Partial burn sent from desk. No popup.",
  });
}

export async function appRentRefund(auth, args = {}) {
  const gate = needAuth(auth);
  if (!gate.userId) return gate;
  const row = await getUserWallet(gate.userId);
  if (!row) return { ok: false, error: "no_wallet" };
  let built;
  try {
    built = await prepareRentRefund(row.public_key);
  } catch (e) {
    return { ok: false, error: "scan_failed", message: String(e?.message || "Could not scan empty accounts.") };
  }
  if (!built.transactions.length) {
    return { ok: true, action: "rent_refund", reclaimedSol: 0, message: "No empty token accounts — nothing to reclaim." };
  }
  let totalSig = "";
  let totalReclaimed = 0;
  for (const txBase64 of built.transactions) {
    const live = await signAndSendUserTx(row, txBase64);
    if (!live.ok) {
      return { ok: false, error: "tx_failed", message: live.message || "Transaction failed.", reclaimedSol: totalReclaimed };
    }
    totalSig = live.signature || totalSig;
    totalReclaimed += built.reclaimableSol / built.transactions.length;
  }
  return sendOutcome({ ok: true, signature: totalSig }, {
    action: "rent_refund",
    accountsClosed: built.accounts.length,
    reclaimedSol: built.reclaimableSol,
    message: `Closed ${built.accounts.length} empty accounts, reclaimed ${built.reclaimableSol.toFixed(4)} SOL.`,
  });
}

export async function appUnwrapWsol(auth, args = {}) {
  const gate = needAuth(auth);
  if (!gate.userId) return gate;
  const row = await getUserWallet(gate.userId);
  if (!row) return { ok: false, error: "no_wallet" };
  let built;
  try {
    built = await prepareUnwrapWsol(row.public_key);
  } catch (e) {
    return { ok: false, error: "scan_failed", message: String(e?.message || "Could not scan wSOL.") };
  }
  if (!built.transactions.length) {
    return { ok: true, action: "unwrap_wsol", unwrappedSol: 0, message: built.note };
  }
  const live = await signAndSendUserTx(row, built.transactions[0]);
  return sendOutcome(live, {
    action: "unwrap_wsol",
    unwrappedSol: built.unwrappableSol,
    message: `Unwrapped ${built.unwrappableSol.toFixed(4)} wSOL to SOL.`,
  });
}

/* ── NFT marketplace: backend-signed flows for the in-app wallet ── */

const SB_URL = process.env.SUPABASE_URL || "https://ffjipnkhcebjvttliptb.supabase.co";

async function sbRpc(fn, params = {}) {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || "";
  if (!secret) throw new Error("SUPABASE_SERVICE_ROLE_KEY missing");
  const r = await fetch(`${SB_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { apikey: secret, Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  const j = await r.json().catch(() => null);
  if (!r.ok) throw new Error(j?.message || j?.hint || `sb rpc ${fn} failed`);
  return j;
}

async function nftEdgeFn(body) {
  const anon = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
  const r = await fetch(`${SB_URL}/functions/v1/nft-execute-sale`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${anon}`, apikey: anon },
    body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.error || "nft-execute-sale failed");
  return j;
}

/** Verify an NFT into a collection on-chain (VerifyCollection ix, backend-signed). */
async function verifyNftCollection(row, nftMint, collectionMint) {
  const { loadSolana, serializeTx, rpcUrl } = await import("./_mcp-ops.js");
  const { web3 } = await loadSolana();
  const { Connection, PublicKey, Transaction, TransactionInstruction } = web3;
  const METADATA_PROGRAM_ID = new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");
  const payerPk = new PublicKey(row.public_key);
  const nftMintPk = new PublicKey(nftMint);
  const colMintPk = new PublicKey(collectionMint);
  const pda = (seeds) => PublicKey.findProgramAddressSync(seeds, METADATA_PROGRAM_ID)[0];
  const metadataPda = pda([Buffer.from("metadata"), METADATA_PROGRAM_ID.toBuffer(), nftMintPk.toBuffer()]);
  const colMetadataPda = pda([Buffer.from("metadata"), METADATA_PROGRAM_ID.toBuffer(), colMintPk.toBuffer()]);
  const colEditionPda = pda([Buffer.from("metadata"), METADATA_PROGRAM_ID.toBuffer(), colMintPk.toBuffer(), Buffer.from("edition")]);
  // VerifyCollection discriminator 18, no args
  const tx = new Transaction().add(
    new TransactionInstruction({
      programId: METADATA_PROGRAM_ID,
      keys: [
        { pubkey: metadataPda, isSigner: false, isWritable: true },
        { pubkey: payerPk, isSigner: true, isWritable: false }, // collectionAuthority
        { pubkey: payerPk, isSigner: true, isWritable: true }, // payer
        { pubkey: colMintPk, isSigner: false, isWritable: false },
        { pubkey: colMetadataPda, isSigner: false, isWritable: false },
        { pubkey: colEditionPda, isSigner: false, isWritable: false },
      ],
      data: Buffer.from([18]),
    })
  );
  const conn = new Connection(rpcUrl(), "confirmed");
  const { blockhash } = await conn.getLatestBlockhash("confirmed");
  const live = await signAndSendUserTx(row, serializeTx(tx, blockhash, payerPk));
  return !!live.ok;
}

/** Mint a real Metaplex NFT from the in-app wallet. Backend signs.
 * Optional collectionMint: verifies the NFT into the collection on-chain. */
export async function appNftMint(auth, args = {}) {
  const gate = needAuth(auth);
  if (!gate.userId) return gate;
  const row = await getUserWallet(gate.userId);
  if (!row) return { ok: false, error: "no_wallet" };
  const name = String(args.name || "").trim();
  const symbol = String(args.symbol || "NFT").trim();
  const uri = String(args.uri || args.metadataUri || "").trim();
  const royaltyBps = Math.min(10000, Math.max(0, Math.round(Number(args.royaltyBps ?? args.royaltyPct * 100 ?? 500))));
  const collectionMint = String(args.collectionMint || "").trim() || null;
  if (!name) return { ok: false, error: "need_name", message: "NFT name is required." };
  if (!/^https?:\/\//i.test(uri)) return { ok: false, error: "need_uri", message: "A public metadata URI is required." };
  let built;
  try {
    built = await prepareNftMint({ payer: row.public_key, name, symbol, uri, royaltyBps });
  } catch (e) {
    return { ok: false, error: "mint_build_failed", message: String(e?.message || e) };
  }
  const { Keypair } = await import("@solana/web3.js");
  const mintKp = Keypair.fromSecretKey(Buffer.from(built.mintSecretKey, "base64"));
  const live = await signAndSendUserTx(row, built.transaction, [mintKp]);
  if (!live.ok) return sendOutcome(live, { action: "nft_mint" });
  // Optional: verify into a collection (separate tx, collection authority = user)
  let verified = false;
  if (collectionMint && live.ok) {
    try {
      verified = await verifyNftCollection(row, built.mint, collectionMint);
    } catch (e) {
      // Mint succeeded; verification is best-effort
    }
  }
  // Register in the OrbitX NFT registry
  try {
    await sbRpc("orbitx_register_nft", {
      p_collection_id: args.collectionId || null,
      p_mint_address: built.mint,
      p_creator_wallet: row.public_key,
      p_name: name,
      p_symbol: symbol.toUpperCase().slice(0, 10),
      p_image_url: args.imageUrl || null,
      p_metadata_uri: uri,
      p_royalty_bps: royaltyBps,
      p_attributes: args.attributes || [],
      p_content_hash: null,
    });
  } catch (e) {
    // Mint succeeded on-chain; registry is best-effort
  }
  return sendOutcome(live, {
    action: "nft_mint",
    mint: built.mint,
    name, symbol,
    collectionVerified: verified,
    explorer: `https://solscan.io/token/${built.mint}`,
    message: `"${name}" minted on-chain to your in-app wallet.${verified ? " Verified into the collection." : ""}`,
  });
}

/** Buy an NFT listing/auction via the delegated-authority settlement. Backend signs buyer side. */
export async function appNftBuy(auth, args = {}) {
  const gate = needAuth(auth);
  if (!gate.userId) return gate;
  const row = await getUserWallet(gate.userId);
  if (!row) return { ok: false, error: "no_wallet" };
  const mode = args.mode === "auction" ? "auction" : "listing";
  const sourceId = String(args.listingId || args.auctionId || args.sourceId || "");
  if (!sourceId) return { ok: false, error: "need_listing", message: "listingId is required." };
  let built;
  try {
    built = await nftEdgeFn({ action: "build", mode, sourceId, buyerWallet: row.public_key });
  } catch (e) {
    return { ok: false, error: "build_failed", message: String(e?.message || e) };
  }
  // Sign buyer side with the backend-held key, then hand to edge fn to submit + record
  const kp = await loadDeskKeypair(row);
  const { Transaction } = await import("@solana/web3.js");
  const raw = Buffer.from(String(built.transactionBase64 || ""), "base64");
  const tx = Transaction.from(raw);
  tx.partialSign(kp);
  const signedBase64 = tx.serialize({ requireAllSignatures: false }).toString("base64");
  let submitted;
  try {
    submitted = await nftEdgeFn({ action: "submit", pendingSaleId: built.pendingSaleId, signedTransactionBase64: signedBase64 });
  } catch (e) {
    return { ok: false, error: "submit_failed", message: String(e?.message || e) };
  }
  return {
    ok: true, signedOn: "backend", clickToSign: false, confirmed: true,
    action: "nft_buy", mode,
    signature: submitted.signature,
    tx: submitted.signature ? `https://solscan.io/tx/${submitted.signature}` : null,
    breakdown: built.breakdown || null,
    message: `Purchased! ${built.breakdown?.totalSol ?? ""} SOL settled on-chain.`,
  };
}

/** List an NFT for sale: approve marketplace delegate (backend-signed) + create listing row. */
export async function appNftList(auth, args = {}) {
  const gate = needAuth(auth);
  if (!gate.userId) return gate;
  const row = await getUserWallet(gate.userId);
  if (!row) return { ok: false, error: "no_wallet" };
  const nftId = String(args.nftId || "");
  const mint = String(args.mint || args.mintAddress || "");
  const priceSol = Number(args.priceSol || args.price);
  if (!nftId || !mint) return { ok: false, error: "need_nft", message: "nftId and mint are required." };
  if (!priceSol || priceSol <= 0) return { ok: false, error: "need_price", message: "A positive priceSol is required." };
  // Build approve-delegate instruction server-side
  const { web3, spl } = await import("./_mcp-ops.js").then((m) => m.loadSolana());
  const { PublicKey, Transaction } = web3;
  const { getAssociatedTokenAddressSync, createApproveInstruction } = spl;
  let authority;
  try {
    authority = await nftEdgeFn({ action: "authority" });
  } catch (e) {
    return { ok: false, error: "authority_failed", message: String(e?.message || e) };
  }
  const owner = new PublicKey(row.public_key);
  const mintPk = new PublicKey(mint);
  const ownerAta = getAssociatedTokenAddressSync(mintPk, owner);
  const tx = new Transaction().add(
    createApproveInstruction(ownerAta, new PublicKey(authority.authorityPubkey), owner, 1)
  );
  const { Connection } = web3;
  const conn = new Connection(process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com", "confirmed");
  const { blockhash } = await conn.getLatestBlockhash("confirmed");
  tx.recentBlockhash = blockhash;
  tx.feePayer = owner;
  const { serializeTx } = await import("./_mcp-ops.js");
  const live = await signAndSendUserTx(row, serializeTx(tx, blockhash, owner));
  if (!live.ok) return sendOutcome(live, { action: "nft_list" });
  try {
    await sbRpc("orbitx_nft_list", {
      p_nft_id: nftId, p_seller_wallet: row.public_key,
      p_price_sol: priceSol, p_currency: "SOL",
    });
  } catch (e) {
    return { ok: false, error: "listing_row_failed", signature: live.signature, message: "Delegate approved on-chain but the listing row failed: " + String(e?.message || e) };
  }
  return sendOutcome(live, {
    action: "nft_list", nftId, priceSol,
    message: `Listed for ${priceSol} SOL. Buyers can now check out atomically.`,
  });
}

/** Transfer an SPL NFT from the in-app wallet. Backend signs. */
export async function appNftTransfer(auth, args = {}) {
  const gate = needAuth(auth);
  if (!gate.userId) return gate;
  const row = await getUserWallet(gate.userId);
  if (!row) return { ok: false, error: "no_wallet" };
  const mint = String(args.mint || args.mintAddress || "");
  const dest = String(args.destination || args.to || "");
  if (!mint) return { ok: false, error: "need_mint" };
  if (!dest) return { ok: false, error: "need_destination", message: "Recipient wallet address is required." };
  const { loadSolana, serializeTx, rpcUrl } = await import("./_mcp-ops.js");
  const { web3, spl } = await loadSolana();
  const { Connection, PublicKey, Transaction } = web3;
  const { TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID, getAssociatedTokenAddressSync, createAssociatedTokenAccountInstruction, createTransferInstruction } = spl;
  const owner = new PublicKey(row.public_key);
  const mintPk = new PublicKey(mint);
  const destPk = new PublicKey(dest);
  const conn = new Connection(rpcUrl(), "confirmed");
  const mintInfo = await conn.getAccountInfo(mintPk);
  if (!mintInfo) return { ok: false, error: "mint_not_found" };
  const programId = mintInfo.owner.equals(TOKEN_2022_PROGRAM_ID) ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID;
  const fromAta = getAssociatedTokenAddressSync(mintPk, owner, false, programId);
  const toAta = getAssociatedTokenAddressSync(mintPk, destPk, false, programId);
  const tx = new Transaction();
  if (!(await conn.getAccountInfo(toAta))) {
    tx.add(createAssociatedTokenAccountInstruction(owner, toAta, destPk, mintPk, programId));
  }
  tx.add(createTransferInstruction(fromAta, toAta, owner, 1, [], programId));
  const { blockhash } = await conn.getLatestBlockhash("confirmed");
  const live = await signAndSendUserTx(row, serializeTx(tx, blockhash, owner));
  return sendOutcome(live, {
    action: "nft_transfer", mint, destination: dest,
    message: "NFT transferred.",
  });
}

/** Approve the marketplace delegate over one NFT (for auctions). Backend signs. */
export async function appNftApproveDelegate(auth, args = {}) {
  const gate = needAuth(auth);
  if (!gate.userId) return gate;
  const row = await getUserWallet(gate.userId);
  if (!row) return { ok: false, error: "no_wallet" };
  const mint = String(args.mint || args.mintAddress || "");
  if (!mint) return { ok: false, error: "need_mint" };
  const { loadSolana, serializeTx, rpcUrl } = await import("./_mcp-ops.js");
  const { web3, spl } = await loadSolana();
  const { Connection, PublicKey, Transaction } = web3;
  const { getAssociatedTokenAddressSync, createApproveInstruction } = spl;
  let authority;
  try {
    authority = await nftEdgeFn({ action: "authority" });
  } catch (e) {
    return { ok: false, error: "authority_failed", message: String(e?.message || e) };
  }
  const owner = new PublicKey(row.public_key);
  const mintPk = new PublicKey(mint);
  const ownerAta = getAssociatedTokenAddressSync(mintPk, owner);
  const tx = new Transaction().add(
    createApproveInstruction(ownerAta, new PublicKey(authority.authorityPubkey), owner, 1)
  );
  const conn = new Connection(rpcUrl(), "confirmed");
  const { blockhash } = await conn.getLatestBlockhash("confirmed");
  const live = await signAndSendUserTx(row, serializeTx(tx, blockhash, owner));
  return sendOutcome(live, {
    action: "nft_approve_delegate", mint,
    message: "Marketplace delegate approved for this NFT.",
  });
}

export const APP_DESK_OPS_TOOLS = [
  {
    name: "orbitx_app_launch",
    description:
      "Launch a pump.fun token from the desk wallet. FREE — no launch fee, just gas + mint rent. Backend signs. Auto vanity CA ending obx. pair=sol|usdc. Optional imageUrl, devBuySol, devBuyUsdc, usd.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        symbol: { type: "string" },
        description: { type: "string" },
        imageUrl: { type: "string" },
        imageBase64: { type: "string" },
        twitter: { type: "string" },
        telegram: { type: "string" },
        website: { type: "string" },
        pair: { type: "string", description: "sol or usdc" },
        devBuySol: { type: "number" },
        devBuyUsdc: { type: "number" },
        usd: { type: "number" },
        authCode: { type: "string" },
      },
      required: ["name", "symbol"],
    },
  },
  {
    name: "orbitx_app_claim",
    description: "Claim pump.fun creator fees into the desk wallet. Backend signs. pair=sol|usdc.",
    inputSchema: {
      type: "object",
      properties: { pair: { type: "string" }, authCode: { type: "string" } },
    },
  },
  {
    name: "orbitx_app_burn",
    description:
      "Burn tokens from the desk wallet. Backend signs. percent 1-100, amount in tokens, or usd/cents (e.g. burn 12 cents).",
    inputSchema: {
      type: "object",
      properties: {
        mint: { type: "string" },
        percent: { type: "number" },
        amount: { type: ["number", "string"] },
        usd: { type: "number" },
        authCode: { type: "string" },
      },
      required: ["mint"],
    },
  },
  {
    name: "orbitx_app_rent_refund",
    description: "Close empty token accounts and reclaim rent SOL to the desk wallet. Backend signs. No args needed.",
    inputSchema: {
      type: "object",
      properties: { authCode: { type: "string" } },
    },
  },
  {
    name: "orbitx_app_unwrap_wsol",
    description: "Unwrap wSOL back to native SOL in the desk wallet. Backend signs. No args needed.",
    inputSchema: {
      type: "object",
      properties: { authCode: { type: "string" } },
    },
  },
  {
    name: "orbitx_app_nft_mint",
    description: "Mint a real Metaplex NFT from the in-app wallet. Backend signs. Needs name + public metadata uri. Optional symbol, royaltyBps, imageUrl, collectionId, collectionMint (verifies into collection on-chain), attributes.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string" }, symbol: { type: "string" },
        uri: { type: "string", description: "Public metadata JSON URL" },
        royaltyBps: { type: "number" }, imageUrl: { type: "string" },
        collectionId: { type: "string" }, collectionMint: { type: "string" },
        attributes: { type: "array" },
        authCode: { type: "string" },
      },
      required: ["name", "uri"],
    },
  },
  {
    name: "orbitx_app_nft_buy",
    description: "Buy an NFT listing or settle an auction via the delegated-authority marketplace. Backend signs the buyer side. mode: listing|auction.",
    inputSchema: {
      type: "object",
      properties: {
        listingId: { type: "string" }, auctionId: { type: "string" },
        mode: { type: "string", description: "listing or auction" },
        authCode: { type: "string" },
      },
    },
  },
  {
    name: "orbitx_app_nft_list",
    description: "List an owned NFT for sale: approves the marketplace delegate (backend-signed) and creates the listing. Needs nftId, mint, priceSol.",
    inputSchema: {
      type: "object",
      properties: {
        nftId: { type: "string" }, mint: { type: "string" },
        priceSol: { type: "number" }, authCode: { type: "string" },
      },
      required: ["nftId", "mint", "priceSol"],
    },
  },
  {
    name: "orbitx_app_nft_approve_delegate",
    description: "Approve the OrbitX marketplace delegate over one owned NFT (needed before starting an auction). Backend signs. Needs mint.",
    inputSchema: {
      type: "object",
      properties: { mint: { type: "string" }, authCode: { type: "string" } },
      required: ["mint"],
    },
  },
  {
    name: "orbitx_app_nft_transfer",
    description: "Transfer an SPL NFT from the in-app wallet to another wallet. Backend signs. Needs mint + destination.",
    inputSchema: {
      type: "object",
      properties: {
        mint: { type: "string" }, destination: { type: "string" },
        authCode: { type: "string" },
      },
      required: ["mint", "destination"],
    },
  },
];

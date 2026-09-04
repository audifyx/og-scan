/**
 * Per-Telegram-user token / NFT launch wizard.
 * Feeds the existing OrbitX Pump.fun + Metaplex handoff — never a second launch stack.
 * Sessions are keyed by telegram user id so concurrent users cannot leak fields.
 */

export const SESSION_TTL_MS = 30 * 60 * 1000;
export const TOKEN_KIND = "token";
export const NFT_KIND = "nft";

const memory = new Map();

export function normalizeTicker(raw) {
  const t = String(raw || "")
    .trim()
    .replace(/^\$/, "")
    .replace(/[^A-Za-z0-9]/g, "")
    .slice(0, 12)
    .toUpperCase();
  return t;
}

export function normalizeName(raw) {
  return String(raw || "").replace(/\s+/g, " ").trim().slice(0, 32);
}

export function normalizeUrl(raw) {
  const t = String(raw || "").trim();
  if (!t || /^(skip|none|n\/a|-)$/i.test(t)) return "";
  if (/^https?:\/\//i.test(t)) return t.slice(0, 200);
  if (/^[\w.-]+\.[a-z]{2,}(\/.*)?$/i.test(t)) return `https://${t.slice(0, 196)}`;
  return t.slice(0, 200);
}

export function normalizeHandle(raw) {
  const t = String(raw || "").trim();
  if (!t || /^(skip|none|n\/a|-)$/i.test(t)) return "";
  if (/^https?:\/\//i.test(t)) return t.slice(0, 200);
  const handle = t.replace(/^@/, "").replace(/\s+/g, "");
  return handle ? `https://x.com/${handle.slice(0, 40)}` : "";
}

export function isLaunchCancel(text) {
  return /^(?:\/)?(?:cancel|stop|abort|nevermind|never mind)(?:@\w+)?\s*$/i.test(String(text || "").trim());
}

export function isLaunchSkip(text) {
  return /^(skip|none|n\/a|-|no)$/i.test(String(text || "").trim());
}

/** "Launch $STEVE" / "Launch Steve Coin STEVE" / "/launch STEVE" */
export function parseLaunchSeed(text) {
  const raw = String(text || "").trim();
  const rest = raw
    .replace(/^(?:\/)?(?:launch|create)(?:@\w+)?(?:\s+(?:a\s+)?(?:token|coin|pump(?:\.fun)?))?\s*/i, "")
    .trim();
  if (!rest || /\bnft\b/i.test(rest)) return { name: "", symbol: "" };
  const dollar = rest.match(/^\$([A-Za-z0-9]{2,12})\b/);
  if (dollar) return { name: "", symbol: normalizeTicker(dollar[1]) };
  const named = rest.match(/^(.+?)\s+\$?([A-Za-z0-9]{2,12})$/);
  if (named && !/\s/.test(named[2])) {
    const symbol = normalizeTicker(named[2]);
    const name = normalizeName(named[1].replace(/^\$/, ""));
    if (symbol && name && name.toUpperCase() !== symbol) return { name, symbol };
    if (symbol) return { name: "", symbol };
  }
  const only = normalizeTicker(rest);
  if (only && only.length >= 2 && only.length <= 12 && !/\s/.test(rest.replace(/^\$/, ""))) {
    return { name: "", symbol: only };
  }
  return { name: normalizeName(rest), symbol: normalizeTicker(rest) || "" };
}

export function parseNftSeed(text) {
  const rest = String(text || "")
    .replace(/^(?:\/)?(?:launch|mint|create)(?:@\w+)?(?:\s+(?:an?\s+)?)?(?:nft|collection)\s*/i, "")
    .trim();
  if (!rest) return { name: "", symbol: "" };
  const named = rest.match(/^(.+?)\s+([A-Za-z0-9]{2,12})$/);
  if (named) return { name: normalizeName(named[1]), symbol: normalizeTicker(named[2]) };
  return { name: normalizeName(rest), symbol: "" };
}

export function newNonce() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

function nowIso() {
  return new Date().toISOString();
}

export function createTokenSession({ telegramUserId, chatId, seed } = {}) {
  const symbol = normalizeTicker(seed?.symbol);
  const name = normalizeName(seed?.name);
  let step = "ticker";
  if (symbol) step = name ? "image" : "name";
  return {
    telegramUserId: String(telegramUserId || ""),
    chatId: chatId != null ? String(chatId) : "",
    kind: TOKEN_KIND,
    step,
    ticker: symbol,
    name,
    website: "",
    twitter: "",
    description: "",
    imageFileId: "",
    imageMime: "",
    imageBase64: "",
    metadataUri: "",
    openUrl: "",
    confirmNonce: newNonce(),
    inFlight: false,
    mint: "",
    signature: "",
    updatedAt: Date.now(),
    expiresAt: Date.now() + SESSION_TTL_MS,
  };
}

export function createNftSession({ telegramUserId, chatId, seed } = {}) {
  const name = normalizeName(seed?.name);
  const symbol = normalizeTicker(seed?.symbol);
  let step = "name";
  if (name) step = symbol ? "image" : "symbol";
  return {
    telegramUserId: String(telegramUserId || ""),
    chatId: chatId != null ? String(chatId) : "",
    kind: NFT_KIND,
    step,
    ticker: symbol,
    name,
    website: "",
    twitter: "",
    description: "",
    imageFileId: "",
    imageMime: "",
    imageBase64: "",
    metadataUri: "",
    openUrl: "",
    confirmNonce: newNonce(),
    inFlight: false,
    mint: "",
    signature: "",
    updatedAt: Date.now(),
    expiresAt: Date.now() + SESSION_TTL_MS,
  };
}

export function sessionAlive(session) {
  if (!session || !session.telegramUserId) return false;
  if (session.step === "done") return Date.now() < Number(session.expiresAt || 0);
  return Date.now() < Number(session.expiresAt || 0);
}

export function touchSession(session) {
  if (!session) return session;
  session.updatedAt = Date.now();
  session.expiresAt = Date.now() + SESSION_TTL_MS;
  return session;
}

function nextTokenStep(session) {
  if (!session.ticker) return "ticker";
  if (!session.name) return "name";
  if (!session.imageFileId && !session.imageBase64 && !session.metadataUri) return "image";
  if (session.website === undefined || session.step === "image") return "website";
  if (session.step === "website") return "twitter";
  if (session.step === "twitter") return "description";
  return "confirm";
}

export function applyWizardText(session, text) {
  const t = String(text || "").trim();
  if (!session || !sessionAlive(session)) return { ok: false, error: "no_session" };
  if (session.step === "signing" || session.step === "done") {
    return { ok: false, error: session.step, session };
  }
  if (session.kind === TOKEN_KIND) {
    if (session.step === "ticker") {
      const symbol = normalizeTicker(t);
      if (symbol.length < 2) return { ok: false, error: "ticker", prompt: "Ticker must be 2–12 letters or numbers. Example: STEVE" };
      session.ticker = symbol;
      session.step = session.name ? nextTokenStep(session) : "name";
    } else if (session.step === "name") {
      const name = normalizeName(t);
      if (name.length < 2) return { ok: false, error: "name", prompt: "Send the token name (2–32 characters). Example: Steve Coin" };
      session.name = name;
      session.step = "image";
    } else if (session.step === "website") {
      session.website = isLaunchSkip(t) ? "" : normalizeUrl(t);
      session.step = "twitter";
    } else if (session.step === "twitter") {
      session.twitter = isLaunchSkip(t) ? "" : normalizeHandle(t);
      session.step = "description";
    } else if (session.step === "description") {
      session.description = isLaunchSkip(t) ? "" : t.slice(0, 280);
      session.step = "confirm";
      session.confirmNonce = newNonce();
    } else if (session.step === "image") {
      return { ok: false, error: "image", prompt: "Send the token image as a photo (not a file link)." };
    } else if (session.step === "confirm") {
      return { ok: true, session, awaitingConfirm: true };
    }
  } else {
    if (session.step === "name") {
      const name = normalizeName(t);
      if (name.length < 2) return { ok: false, error: "name", prompt: "Send the NFT name (2–32 characters)." };
      session.name = name;
      session.step = session.ticker ? "image" : "symbol";
    } else if (session.step === "symbol") {
      const symbol = normalizeTicker(t);
      if (symbol.length < 2) return { ok: false, error: "symbol", prompt: "Collection / NFT ticker, 2–12 characters." };
      session.ticker = symbol;
      session.step = "image";
    } else if (session.step === "description") {
      session.description = isLaunchSkip(t) ? "" : t.slice(0, 280);
      session.step = "confirm";
      session.confirmNonce = newNonce();
    } else if (session.step === "image") {
      return { ok: false, error: "image", prompt: "Send the NFT image as a photo." };
    } else if (session.step === "confirm") {
      return { ok: true, session, awaitingConfirm: true };
    }
  }
  touchSession(session);
  return { ok: true, session };
}

export function applyWizardImage(session, image) {
  if (!session || !sessionAlive(session)) return { ok: false, error: "no_session" };
  if (session.step !== "image" && session.step !== "confirm") {
    return { ok: false, error: "not_image_step", session };
  }
  const fileId = String(image?.fileId || "").trim();
  if (!fileId && !image?.base64) return { ok: false, error: "image", prompt: "Could not read that photo. Send it again." };
  session.imageFileId = fileId;
  session.imageMime = String(image?.mime || "image/jpeg");
  if (image?.base64) session.imageBase64 = String(image.base64);
  session.step = session.kind === TOKEN_KIND ? "website" : "description";
  touchSession(session);
  return { ok: true, session };
}

export function wizardPrompt(session) {
  if (!session) return { text: "No launch in progress. Say Launch $TICKER or Launch an NFT." };
  if (session.kind === TOKEN_KIND) {
    if (session.step === "ticker") return { text: "What ticker? Example: <code>STEVE</code>" };
    if (session.step === "name") return { text: `Token name for <b>$${esc(session.ticker)}</b>? Example: Steve Coin` };
    if (session.step === "image") return { text: "Send the token image as a <b>photo</b>." };
    if (session.step === "website") return { text: "Website? Send a URL, or <code>skip</code>." };
    if (session.step === "twitter") return { text: "X / Twitter? Send @handle, a URL, or <code>skip</code>." };
    if (session.step === "description") return { text: "Short description? Or <code>skip</code>." };
    if (session.step === "confirm") return confirmationMessage(session);
    if (session.step === "signing") return signingMessage(session);
    if (session.step === "done") return { text: launchSuccessHtml(session) };
  } else {
    if (session.step === "name") return { text: "NFT name?" };
    if (session.step === "symbol") return { text: "NFT / collection ticker? Example: <code>STEVE</code>" };
    if (session.step === "image") return { text: "Send the NFT image as a <b>photo</b>." };
    if (session.step === "description") return { text: "NFT description? Or <code>skip</code>." };
    if (session.step === "confirm") return confirmationMessage(session);
    if (session.step === "signing") return signingMessage(session);
    if (session.step === "done") return { text: nftSuccessHtml(session) };
  }
  return { text: "Say Launch $TICKER or Launch an NFT to start." };
}

function esc(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function confirmationMessage(session) {
  const token = session.kind === TOKEN_KIND;
  const lines = token
    ? [
        "🚀 <b>Confirm token launch</b>",
        "",
        `Name: <b>${esc(session.name)}</b>`,
        `Ticker: <b>$${esc(session.ticker)}</b>`,
        `Image: ${session.imageFileId || session.metadataUri ? "attached" : "missing"}`,
        `Website: ${esc(session.website || "—")}`,
        `X: ${esc(session.twitter || "—")}`,
        `Description: ${esc(session.description || "—")}`,
        "",
        "This uses the <b>same OrbitX Pump.fun launch</b> as orbitx.world:",
        "• Pinata metadata (existing /api/pump-create)",
        "• Phantom signs the create tx (Telegram cannot sign)",
        "• Platform launch fee in SOL to the OrbitX wallet — same as the website",
        "• Website launch does <b>not</b> burn $ORBITX; /shop is the buy-and-burn path",
        "",
        "Nothing broadcasts until you approve in a real browser wallet.",
        "Tap Confirm once. Extra taps will not send a second create.",
      ]
    : [
        "🖼️ <b>Confirm NFT mint</b>",
        "",
        `Name: <b>${esc(session.name)}</b>`,
        `Ticker: <b>$${esc(session.ticker)}</b>`,
        `Image: ${session.imageFileId || session.metadataUri ? "attached" : "missing"}`,
        `Description: ${esc(session.description || "—")}`,
        "",
        "This uses the <b>same OrbitX Metaplex mint</b> as /nft/create.",
        "Open the sign link in Chrome / Phantom — Telegram cannot sign.",
        "Tap Confirm once.",
      ];
  return {
    text: lines.join("\n"),
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: token ? "Confirm launch" : "Confirm mint",
            callback_data: token ? `ox:launch:go:${session.confirmNonce}` : `ox:nft:go:${session.confirmNonce}`,
          },
          { text: "Cancel", callback_data: token ? "ox:launch:no" : "ox:nft:no" },
        ],
      ],
    },
  };
}

export function signingMessage(session) {
  const url = session.openUrl || "";
  const lines = [
    session.kind === TOKEN_KIND ? "✍️ <b>Sign the Pump.fun launch</b>" : "✍️ <b>Sign the NFT mint</b>",
    "",
    "Open this in <b>Chrome or Edge</b> with Phantom / Jupiter Wallet.",
    "Telegram’s in-app browser cannot sign.",
    "",
    url ? `<a href="${esc(url)}">Open OrbitX ${session.kind === TOKEN_KIND ? "launch" : "mint"}</a>` : "Sign URL missing — tap Confirm again.",
    "",
    "After the wallet confirms on-chain, paste the Solscan tx link here.",
    "I will only reply with a real mint + signature after RPC confirmation.",
  ];
  const buttons = [];
  if (url) buttons.push([{ text: session.kind === TOKEN_KIND ? "Open launch" : "Open mint", url }]);
  buttons.push([{ text: "Cancel", callback_data: session.kind === TOKEN_KIND ? "ox:launch:no" : "ox:nft:no" }]);
  return { text: lines.join("\n"), reply_markup: { inline_keyboard: buttons } };
}

export function launchSuccessHtml(result) {
  const name = String(result?.name || "").trim();
  const symbol = String(result?.ticker || result?.symbol || "").trim();
  const mint = String(result?.mint || "").trim();
  const sig = String(result?.signature || "").trim();
  if (!mint || !sig) {
    return "Launch is not confirmed on-chain yet. Paste the Solscan transaction after Phantom confirms.";
  }
  const solscanTx = `https://solscan.io/tx/${encodeURIComponent(sig)}`;
  const solscanToken = `https://solscan.io/token/${encodeURIComponent(mint)}`;
  const pump = `https://pump.fun/${encodeURIComponent(mint)}`;
  const jup = `https://jup.ag/tokens/${encodeURIComponent(mint)}`;
  const orbitx = `https://www.orbitx.world/ORBITX_DEX/token/${encodeURIComponent(mint)}`;
  const feeNote =
    result?.feePaid === true
      ? "OrbitX platform launch fee paid in SOL (same as the website)."
      : result?.feePaid === false
        ? "Launch fee was $0 on this path (promo or already paid)."
        : "Launch fee is the website SOL platform fee — not an $ORBITX burn.";
  const burnNote = result?.orbitxBurnSignature
    ? `$ORBITX buy-and-burn confirmed: <a href="https://solscan.io/tx/${encodeURIComponent(result.orbitxBurnSignature)}">Solscan</a>`
    : "$ORBITX buy-and-burn is the /shop path — this Pump.fun create does not burn $ORBITX (same as orbitx.world).";
  return [
    "🚀 <b>Token Launched</b>",
    "",
    `Name: <b>${esc(name || "—")}</b>`,
    `Ticker: <b>$${esc(symbol || "—")}</b>`,
    `Contract: <code>${esc(mint)}</code>`,
    "",
    `<a href="${esc(solscanTx)}">Solscan transaction</a>`,
    `<a href="${esc(solscanToken)}">Token on Solscan</a>`,
    `<a href="${esc(orbitx)}">OrbitX token</a>`,
    `<a href="${esc(jup)}">Jupiter</a> · <a href="${esc(pump)}">pump.fun</a>`,
    "",
    esc(feeNote),
    burnNote,
  ].join("\n");
}

export function nftSuccessHtml(result) {
  const name = String(result?.name || "").trim();
  const symbol = String(result?.ticker || result?.symbol || "").trim();
  const mint = String(result?.mint || "").trim();
  const sig = String(result?.signature || "").trim();
  if (!mint || !sig) {
    return "NFT mint is not confirmed on-chain yet. Paste the Solscan transaction after Phantom confirms.";
  }
  return [
    "🖼️ <b>NFT minted</b>",
    "",
    `Name: <b>${esc(name || "—")}</b>`,
    `Ticker: <b>$${esc(symbol || "—")}</b>`,
    `Mint: <code>${esc(mint)}</code>`,
    "",
    `<a href="https://solscan.io/tx/${encodeURIComponent(sig)}">Solscan transaction</a>`,
    `<a href="https://solscan.io/token/${encodeURIComponent(mint)}">NFT on Solscan</a>`,
    `<a href="https://www.orbitx.world/nft">OrbitX NFT desk</a>`,
  ].join("\n");
}

export function beginConfirm(session, nonce) {
  if (!session || !sessionAlive(session)) return { ok: false, error: "no_session" };
  if (session.step === "done" && session.mint && session.signature) {
    return { ok: true, alreadyDone: true, session };
  }
  if (session.step === "signing" && session.openUrl) {
    return { ok: true, alreadySigning: true, session };
  }
  if (session.step !== "confirm") return { ok: false, error: "not_confirm", session };
  if (nonce && nonce !== session.confirmNonce) return { ok: false, error: "stale_nonce", session };
  if (session.inFlight) return { ok: false, error: "in_flight", session };
  session.inFlight = true;
  touchSession(session);
  return { ok: true, session };
}

export function markSigning(session, { openUrl, metadataUri } = {}) {
  if (!session) return session;
  session.step = "signing";
  session.inFlight = false;
  if (openUrl) session.openUrl = String(openUrl);
  if (metadataUri) session.metadataUri = String(metadataUri);
  touchSession(session);
  return session;
}

export function markDone(session, { mint, signature, metadataUri } = {}) {
  if (!session) return session;
  session.step = "done";
  session.inFlight = false;
  session.mint = String(mint || session.mint || "");
  session.signature = String(signature || session.signature || "");
  if (metadataUri) session.metadataUri = String(metadataUri);
  session.expiresAt = Date.now() + SESSION_TTL_MS;
  session.updatedAt = Date.now();
  return session;
}

export function releaseInFlight(session) {
  if (!session) return session;
  session.inFlight = false;
  if (session.step === "signing" && !session.openUrl) session.step = "confirm";
  touchSession(session);
  return session;
}

export function appendTelegramHandoffParams(openUrl, session) {
  try {
    const url = new URL(String(openUrl || ""), "https://www.orbitx.world");
    if (session?.telegramUserId) url.searchParams.set("telegramUser", session.telegramUserId);
    if (session?.chatId) url.searchParams.set("chat", session.chatId);
    if (session?.confirmNonce) url.searchParams.set("nonce", session.confirmNonce);
    return url.toString();
  } catch {
    return String(openUrl || "");
  }
}

function sessionKey(telegramUserId) {
  return String(telegramUserId || "").trim();
}

export function memoryGet(telegramUserId) {
  const key = sessionKey(telegramUserId);
  if (!key) return null;
  const row = memory.get(key);
  if (!row) return null;
  if (!sessionAlive(row)) {
    memory.delete(key);
    return null;
  }
  return row;
}

export function memorySet(session) {
  if (!session?.telegramUserId) return session;
  memory.set(sessionKey(session.telegramUserId), session);
  if (memory.size > 5000) {
    const cutoff = Date.now() - SESSION_TTL_MS;
    for (const [k, row] of memory) {
      if (!row || Number(row.expiresAt || 0) < cutoff) memory.delete(k);
    }
  }
  return session;
}

export function memoryClear(telegramUserId) {
  memory.delete(sessionKey(telegramUserId));
}

export async function loadActionSession(sb, telegramUserId) {
  const id = sessionKey(telegramUserId);
  if (!id) return null;
  const mem = memoryGet(id);
  if (mem) return mem;
  if (typeof sb !== "function") return null;
  try {
    const rows = await sb(
      `telegram_orbitx_action_sessions?telegram_user_id=eq.${encodeURIComponent(id)}&select=*&limit=1`,
    );
    const row = Array.isArray(rows) ? rows[0] : null;
    if (!row?.payload) return null;
    const session = typeof row.payload === "string" ? JSON.parse(row.payload) : row.payload;
    if (!sessionAlive(session)) {
      await clearActionSession(sb, id);
      return null;
    }
    return memorySet(session);
  } catch {
    return memoryGet(id);
  }
}

export async function saveActionSession(sb, session) {
  if (!session?.telegramUserId) return session;
  touchSession(session);
  memorySet(session);
  if (typeof sb !== "function") return session;
  const body = {
    telegram_user_id: String(session.telegramUserId),
    chat_id: session.chatId ? String(session.chatId) : null,
    kind: session.kind,
    step: session.step,
    confirm_nonce: session.confirmNonce || null,
    in_flight: Boolean(session.inFlight),
    payload: session,
    updated_at: nowIso(),
    expires_at: new Date(session.expiresAt).toISOString(),
  };
  try {
    await sb("telegram_orbitx_action_sessions", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify(body),
    });
  } catch {
    /* memory still holds the wizard for this instance */
  }
  return session;
}

export async function clearActionSession(sb, telegramUserId) {
  const id = sessionKey(telegramUserId);
  memoryClear(id);
  if (!id || typeof sb !== "function") return;
  try {
    await sb(`telegram_orbitx_action_sessions?telegram_user_id=eq.${encodeURIComponent(id)}`, { method: "DELETE" });
  } catch {
    /* ok */
  }
}

function rpcUrl() {
  return (
    process.env.SOLANA_RPC_URL ||
    process.env.HELIUS_RPC_URL ||
    (process.env.HELIUS_API_KEY ? `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}` : "") ||
    process.env.VITE_SOLANA_RPC_URL ||
    "https://api.mainnet-beta.solana.com"
  );
}

async function rpc(method, params) {
  const r = await fetch(rpcUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const j = await r.json();
  if (j.error) throw new Error(j.error.message || "rpc_error");
  return j.result;
}

export function looksLikeMint(value) {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(String(value || "").trim());
}

/**
 * Confirm a signature on-chain. Never invent mint / sig.
 * @returns {{ ok: true, signature: string, mint?: string } | { ok: false, error: string }}
 */
export async function verifyLaunchOnchain({ signature, mint } = {}) {
  const sig = String(signature || "").trim();
  const ca = String(mint || "").trim();
  if (!sig || sig.length < 64) return { ok: false, error: "signature_required" };
  try {
    const tx = await rpc("getTransaction", [
      sig,
      { encoding: "json", maxSupportedTransactionVersion: 0, commitment: "confirmed" },
    ]);
    if (!tx) return { ok: false, error: "not_found" };
    if (tx.meta?.err) return { ok: false, error: "tx_failed" };
    if (ca && looksLikeMint(ca)) {
      const acct = await rpc("getAccountInfo", [ca, { encoding: "base64", commitment: "confirmed" }]);
      if (!acct?.value) return { ok: false, error: "mint_missing" };
    }
    return { ok: true, signature: sig, mint: ca || "", slot: tx.slot || null };
  } catch (error) {
    return { ok: false, error: error?.message || "rpc_failed" };
  }
}

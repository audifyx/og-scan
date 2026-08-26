/**
 * OrbitX living on-chain intelligence — parsers and classifiers.
 * Never invent signatures, balances, or identity. UNKNOWN when unsure.
 */

export const ORBITX_MINT = "13H4WJvGEg4xrrBwWn2vsQgz7xhmhxgNdw19i1QsxPX9";
export const SOL_MINT = "So11111111111111111111111111111111111111112";
export const SYSTEM_PROGRAM = "11111111111111111111111111111111";
export const TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
export const TOKEN_2022_PROGRAM = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
export const MEMO_PROGRAM = "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr";
export const ASSOCIATED_TOKEN = "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";
export const JUPITER_V6 = "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4";
export const JUPITER_V4 = "JUP4Fb2cqiRUcaTHdrPC8h2gNsA2ETXiPDD33WcGuJB";
export const PUMP_FUN = "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P";
export const PUMP_AMM = "pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA";
export const RAYDIUM_AMM = "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8";
export const RAYDIUM_CPMM = "CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C";
export const ORCA_WHIRLPOOL = "whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc";
export const BURN_SINK = "1nc1nerator11111111111111111111111111111111";

export const EVENT_TYPES = [
  "BUY",
  "SELL",
  "SWAP",
  "SOL_TRANSFER",
  "TOKEN_TRANSFER",
  "TOKEN_MINT",
  "TOKEN_BURN",
  "LIQUIDITY_ADD",
  "LIQUIDITY_REMOVE",
  "TOKEN_LAUNCH",
  "ACCOUNT_CREATED",
  "PROGRAM_INTERACTION",
  "ORBITX_BUY",
  "ORBITX_SELL",
  "ORBITX_BURN",
  "ORBITX_SWAP",
  "ORBITX_PLATFORM_ACTIVITY",
  "KOL_BUY",
  "KOL_SELL",
  "WHALE_BUY",
  "WHALE_SELL",
  "LARGE_TRANSFER",
  "UNKNOWN",
];

export const SIG_RE = /^[1-9A-HJ-NP-Za-km-z]{86,88}$/;
export const ADDR_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

const DEX_PROGRAMS = new Set([
  JUPITER_V6,
  JUPITER_V4,
  PUMP_FUN,
  PUMP_AMM,
  RAYDIUM_AMM,
  RAYDIUM_CPMM,
  ORCA_WHIRLPOOL,
]);

const PROGRAM_LABELS = {
  [SYSTEM_PROGRAM]: "System",
  [TOKEN_PROGRAM]: "Token",
  [TOKEN_2022_PROGRAM]: "Token-2022",
  [MEMO_PROGRAM]: "Memo",
  [ASSOCIATED_TOKEN]: "ATA",
  [JUPITER_V6]: "Jupiter",
  [JUPITER_V4]: "Jupiter",
  [PUMP_FUN]: "Pump.fun",
  [PUMP_AMM]: "Pump AMM",
  [RAYDIUM_AMM]: "Raydium",
  [RAYDIUM_CPMM]: "Raydium",
  [ORCA_WHIRLPOOL]: "Orca",
};

export function programLabel(id) {
  if (!id) return "UNKNOWN";
  return PROGRAM_LABELS[id] || "Program";
}

export function isOrbitxMint(mint) {
  return String(mint || "") === ORBITX_MINT;
}

export function isLikelySignature(value) {
  return SIG_RE.test(String(value || "").trim());
}

export function isLikelyAddress(value) {
  const v = String(value || "").trim();
  return ADDR_RE.test(v) && !isLikelySignature(v);
}

export function detectQueryKind(raw) {
  const q = String(raw || "").trim();
  if (!q) return { kind: "empty", value: "" };
  if (/^\d{4,}$/.test(q) && q.length < 16) return { kind: "slot", value: q };
  if (isLikelySignature(q)) return { kind: "signature", value: q };
  if (isLikelyAddress(q)) return { kind: "address", value: q };
  if (/^\$?[A-Za-z0-9]{2,20}$/.test(q)) return { kind: "symbol", value: q.replace(/^\$/, "").toUpperCase() };
  return { kind: "text", value: q };
}

export function shortAddr(value, left = 4, right = 4) {
  const v = String(value || "");
  if (v.length <= left + right + 1) return v || "UNKNOWN";
  return `${v.slice(0, left)}…${v.slice(-right)}`;
}

export function eventId({ signature, event_type, wallet, token_ca, amount }) {
  const key = [
    String(signature || ""),
    String(event_type || "UNKNOWN"),
    String(wallet || ""),
    String(token_ca || ""),
    String(amount ?? ""),
  ].join("|");
  return simpleHash(key);
}

function simpleHash(text) {
  let h1 = 2166136261;
  let h2 = 2166136261;
  const s = String(text);
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 ^= c;
    h1 = Math.imul(h1, 16777619);
    h2 ^= c + i * 13;
    h2 = Math.imul(h2, 16777619);
  }
  return `${u32(h1)}${u32(h2)}${u32(h1 ^ h2)}${u32(h2 ^ (h1 << 7))}`;
}

function u32(n) {
  return (n >>> 0).toString(16).padStart(8, "0");
}

export function asNumber(value) {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

export function lamportsToSol(lamports) {
  const n = asNumber(lamports);
  return n == null ? null : n / 1e9;
}

function heliusTime(tx) {
  const ts = asNumber(tx?.timestamp);
  if (ts == null) return null;
  return new Date(ts * 1000).toISOString();
}

function nativeSol(tx, direction, owner) {
  const rows = Array.isArray(tx?.nativeTransfers) ? tx.nativeTransfers : [];
  let sum = 0;
  let hit = false;
  for (const row of rows) {
    const amt = asNumber(row.amount) || 0;
    if (direction === "out" && row.fromUserAccount === owner) {
      sum += amt;
      hit = true;
    } else if (direction === "in" && row.toUserAccount === owner) {
      sum += amt;
      hit = true;
    }
  }
  return hit ? sum / 1e9 : null;
}

function tokenMoves(tx) {
  return Array.isArray(tx?.tokenTransfers) ? tx.tokenTransfers : [];
}

function nativeMoves(tx) {
  return Array.isArray(tx?.nativeTransfers) ? tx.nativeTransfers : [];
}

function accountKeys(tx) {
  const keys = tx?.transaction?.message?.accountKeys;
  if (!Array.isArray(keys)) return [];
  return keys.map((k) => (typeof k === "string" ? k : k?.pubkey)).filter(Boolean);
}

function sourceFromPrograms(programs) {
  const list = Array.isArray(programs) ? programs : [];
  for (const id of list) {
    if (DEX_PROGRAMS.has(id)) return programLabel(id);
  }
  if (list.includes(MEMO_PROGRAM)) return "Memo";
  if (list.includes(SYSTEM_PROGRAM)) return "System";
  return list[0] ? programLabel(list[0]) : "UNKNOWN";
}

function attributionFrom({ programs, memos, type }) {
  const list = Array.isArray(programs) ? programs : [];
  const hasOxMemo = (memos || []).some((m) => String(m).startsWith("ox1|"));
  if (hasOxMemo) return "ORBITX_PLATFORM";
  if (list.some((id) => DEX_PROGRAMS.has(id))) {
    if (list.includes(JUPITER_V6) || list.includes(JUPITER_V4)) return "DEX";
    if (list.includes(PUMP_FUN) || list.includes(PUMP_AMM)) return "DEX";
    return "DEX";
  }
  if (type === "TRANSFER" || type === "SOL_TRANSFER") return "DIRECT";
  return "UNKNOWN";
}

function heliusPrograms(tx) {
  if (Array.isArray(tx?.accountData)) {
    const ids = tx.accountData.map((a) => a?.account).filter(Boolean);
    return ids.filter((id) => PROGRAM_LABELS[id] || DEX_PROGRAMS.has(id));
  }
  return [];
}

function memosFromHelius(tx) {
  const desc = String(tx?.description || "");
  const instructions = Array.isArray(tx?.instructions) ? tx.instructions : [];
  const memos = [];
  for (const ix of instructions) {
    if (ix?.programId === MEMO_PROGRAM && ix?.data) memos.push(String(ix.data));
  }
  if (/ox1\|/.test(desc)) memos.push(desc);
  return memos;
}

function trackedKind(address, tracked) {
  if (!address || !tracked) return null;
  const row = tracked[address];
  return row || null;
}

function whaleUsd(usd) {
  return usd != null && usd >= 10_000;
}

function largeUsd(usd) {
  return usd != null && usd >= 1_000;
}

function classifySwapSide({ tokenIn, tokenOut, solIn, solOut }) {
  // tokenIn / solIn = assets the wallet received. tokenOut / solOut = assets spent.
  const orbitxIn = isOrbitxMint(tokenIn?.mint);
  const orbitxOut = isOrbitxMint(tokenOut?.mint);
  const buying = Boolean(tokenIn) && ((solOut || 0) > 0 || !tokenOut);
  const selling = Boolean(tokenOut) && ((solIn || 0) > 0 || !tokenIn);
  if (orbitxIn && buying) return "ORBITX_BUY";
  if (orbitxOut && selling) return "ORBITX_SELL";
  if (buying && !selling) return "BUY";
  if (selling && !buying) return "SELL";
  if (tokenIn || tokenOut) return "SWAP";
  return "SWAP";
}

function refineType(base, { usd, tracked, orbitx }) {
  if (base === "BUY" && tracked?.label_kind === "KOL") return "KOL_BUY";
  if (base === "SELL" && tracked?.label_kind === "KOL") return "KOL_SELL";
  if (base === "BUY" && whaleUsd(usd)) return "WHALE_BUY";
  if (base === "SELL" && whaleUsd(usd)) return "WHALE_SELL";
  if ((base === "SOL_TRANSFER" || base === "TOKEN_TRANSFER") && largeUsd(usd)) return "LARGE_TRANSFER";
  if (orbitx && base === "SWAP") return "ORBITX_SWAP";
  return base;
}

export function importanceScore(event) {
  let score = 1;
  const usd = asNumber(event.usd_value) || 0;
  if (usd >= 1_000_000) score += 80;
  else if (usd >= 100_000) score += 55;
  else if (usd >= 10_000) score += 35;
  else if (usd >= 1_000) score += 18;
  else if (usd >= 100) score += 8;
  if (event.orbitx_related) score += 25;
  if (String(event.event_type || "").includes("BURN")) score += 20;
  if (event.kol_related) score += 18;
  if (event.whale_related) score += 16;
  if (event.attribution === "ORBITX_PLATFORM") score += 12;
  return score;
}

function baseEvent(tx, extra) {
  const fee = asNumber(tx?.fee);
  const programs = extra.programs || heliusPrograms(tx);
  const memos = extra.memos || memosFromHelius(tx);
  const source = extra.source || tx?.source || sourceFromPrograms(programs);
  const attribution = extra.attribution || attributionFrom({ programs, memos, type: extra.event_type || tx?.type });
  const wallet = extra.wallet || tx?.feePayer || null;
  const token_ca = extra.token_ca || extra.token?.mint || null;
  const orbitx = Boolean(
    extra.orbitx_related
    || isOrbitxMint(token_ca)
    || attribution === "ORBITX_PLATFORM"
    || (extra.event_type || "").startsWith("ORBITX_"),
  );
  const usd = extra.usd_value ?? null;
  const tracked = extra.tracked || null;
  const event_type = refineType(extra.event_type || "UNKNOWN", { usd, tracked, orbitx });
  const row = {
    signature: tx?.signature || extra.signature || null,
    slot: asNumber(tx?.slot) ?? extra.slot ?? null,
    block_time: extra.block_time || heliusTime(tx),
    event_type,
    status: tx?.transactionError ? "FAILED" : extra.status || "confirmed",
    chain: "solana",
    program: extra.program || programs[0] || null,
    source: source || "UNKNOWN",
    attribution,
    wallet,
    counterparty: extra.counterparty || null,
    source_wallet: extra.source_wallet || extra.from || null,
    destination_wallet: extra.destination_wallet || extra.to || null,
    token_ca,
    token_symbol: extra.token_symbol || extra.token?.symbol || (isOrbitxMint(token_ca) ? "ORBITX" : null),
    token_name: extra.token_name || extra.token?.name || (isOrbitxMint(token_ca) ? "OrbitX" : null),
    token_image: extra.token_image || extra.token?.image || null,
    token_decimals: extra.token_decimals ?? extra.token?.decimals ?? null,
    amount: extra.amount ?? null,
    sol_amount: extra.sol_amount ?? null,
    usd_value: usd,
    market_cap: extra.market_cap ?? null,
    wallet_balance_before: extra.wallet_balance_before ?? null,
    wallet_balance_after: extra.wallet_balance_after ?? null,
    transaction_fee: fee != null ? fee / 1e9 : extra.transaction_fee ?? null,
    orbitx_related: orbitx,
    orbitx_event_type: extra.orbitx_event_type || (orbitx ? event_type : null),
    kol_related: Boolean(tracked && tracked.label_kind === "KOL"),
    whale_related: whaleUsd(usd) || String(event_type).startsWith("WHALE_"),
    confidence: extra.confidence || "observed",
    description: extra.description || tx?.description || null,
    metadata: {
      helius_type: tx?.type || null,
      helius_source: tx?.source || null,
      programs,
      memos,
      tracked_label: tracked?.label || null,
      tracked_kind: tracked?.label_kind || null,
      ...(extra.metadata && typeof extra.metadata === "object" ? extra.metadata : {}),
    },
  };
  row.event_id = eventId(row);
  row.importance = importanceScore(row);
  return row;
}

/**
 * Turn a Helius enhanced transaction into 0..n normalized events.
 * Returns [] when the payload has no signature — never fabricates one.
 */
export function classifyHeliusTx(tx, opts = {}) {
  if (!tx || !tx.signature) return [];
  const trackedMap = opts.tracked || {};
  const priceUsd = opts.solUsd ?? null;
  const tokenMeta = opts.tokenMeta || {};
  const events = [];
  const payer = tx.feePayer || null;
  const programs = heliusPrograms(tx);
  const memos = memosFromHelius(tx);
  const type = String(tx.type || "UNKNOWN").toUpperCase();
  const natives = nativeMoves(tx);
  const tokens = tokenMoves(tx);
  const swap = tx.events?.swap || null;

  const usdFromSol = (sol) => {
    if (sol == null || priceUsd == null) return null;
    return Number((sol * priceUsd).toFixed(4));
  };

  const metaFor = (mint) => tokenMeta[mint] || (isOrbitxMint(mint) ? { symbol: "ORBITX", name: "OrbitX", decimals: 6 } : {});

  if (swap) {
    const nativeIn = asNumber(swap.nativeInput?.amount);
    const nativeOut = asNumber(swap.nativeOutput?.amount);
    const tokenIns = Array.isArray(swap.tokenInputs) ? swap.tokenInputs : [];
    const tokenOuts = Array.isArray(swap.tokenOutputs) ? swap.tokenOutputs : [];
    const tokenOut = tokenIns[0] ? { mint: tokenIns[0].mint, amount: asNumber(tokenIns[0].tokenAmount) } : null;
    const tokenIn = tokenOuts[0] ? { mint: tokenOuts[0].mint, amount: asNumber(tokenOuts[0].tokenAmount) } : null;
    const solOut = nativeIn != null ? nativeIn / 1e9 : null;
    const solIn = nativeOut != null ? nativeOut / 1e9 : null;
    const focus = tokenIn || tokenOut;
    const sol = solOut || solIn;
    const event_type = classifySwapSide({ tokenIn, tokenOut, solIn, solOut });
    const mint = focus?.mint || null;
    events.push(baseEvent(tx, {
      event_type,
      wallet: payer,
      counterparty: sourceFromPrograms(programs),
      source_wallet: payer,
      token_ca: mint,
      token_symbol: metaFor(mint).symbol,
      token_name: metaFor(mint).name,
      token_image: metaFor(mint).image,
      token_decimals: metaFor(mint).decimals,
      amount: focus?.amount ?? null,
      sol_amount: sol,
      usd_value: usdFromSol(sol),
      market_cap: metaFor(mint).market_cap ?? null,
      programs,
      memos,
      tracked: trackedKind(payer, trackedMap),
      program: programs.find((id) => DEX_PROGRAMS.has(id)) || programs[0] || null,
    }));
  } else if (type === "BURN" || tokens.some((t) => t.toUserAccount === SYSTEM_PROGRAM || t.toUserAccount === BURN_SINK)) {
    const burn = tokens.find((t) => t.toUserAccount === SYSTEM_PROGRAM || t.toUserAccount === BURN_SINK) || tokens[0];
    const mint = burn?.mint || null;
    const amount = asNumber(burn?.tokenAmount);
    events.push(baseEvent(tx, {
      event_type: isOrbitxMint(mint) ? "ORBITX_BURN" : "TOKEN_BURN",
      wallet: burn?.fromUserAccount || payer,
      source_wallet: burn?.fromUserAccount || payer,
      destination_wallet: burn?.toUserAccount || SYSTEM_PROGRAM,
      token_ca: mint,
      token_symbol: metaFor(mint).symbol,
      token_name: metaFor(mint).name,
      token_image: metaFor(mint).image,
      token_decimals: metaFor(mint).decimals,
      amount,
      usd_value: null,
      programs,
      memos,
      tracked: trackedKind(burn?.fromUserAccount || payer, trackedMap),
    }));
  } else if (type === "TOKEN_MINT" || type === "MINT") {
    const minted = tokens[0];
    const mint = minted?.mint || null;
    events.push(baseEvent(tx, {
      event_type: "TOKEN_MINT",
      wallet: payer,
      token_ca: mint,
      token_symbol: metaFor(mint).symbol,
      token_name: metaFor(mint).name,
      amount: asNumber(minted?.tokenAmount),
      programs,
      memos,
    }));
  } else if (tokens.length && natives.length) {
    const tok = tokens[0];
    const nat = natives[0];
    const mint = tok.mint;
    const sol = (asNumber(nat.amount) || 0) / 1e9;
    const buying = nat.fromUserAccount && tok.toUserAccount && nat.fromUserAccount === tok.toUserAccount;
    const event_type = classifySwapSide({
      tokenIn: buying ? { mint, amount: asNumber(tok.tokenAmount) } : null,
      tokenOut: buying ? null : { mint, amount: asNumber(tok.tokenAmount) },
      solIn: buying ? null : sol,
      solOut: buying ? sol : null,
    });
    events.push(baseEvent(tx, {
      event_type,
      wallet: payer,
      source_wallet: nat.fromUserAccount,
      destination_wallet: nat.toUserAccount,
      counterparty: buying ? tok.fromUserAccount : tok.toUserAccount,
      token_ca: mint,
      token_symbol: metaFor(mint).symbol,
      token_name: metaFor(mint).name,
      token_image: metaFor(mint).image,
      amount: asNumber(tok.tokenAmount),
      sol_amount: sol,
      usd_value: usdFromSol(sol),
      programs,
      memos,
      tracked: trackedKind(payer, trackedMap),
    }));
  } else if (tokens.length) {
    for (const tok of tokens.slice(0, 4)) {
      const mint = tok.mint;
      events.push(baseEvent(tx, {
        event_type: isOrbitxMint(mint) ? "TOKEN_TRANSFER" : "TOKEN_TRANSFER",
        wallet: tok.fromUserAccount || payer,
        source_wallet: tok.fromUserAccount,
        destination_wallet: tok.toUserAccount,
        counterparty: tok.toUserAccount,
        token_ca: mint,
        token_symbol: metaFor(mint).symbol,
        token_name: metaFor(mint).name,
        token_image: metaFor(mint).image,
        amount: asNumber(tok.tokenAmount),
        programs,
        memos,
        tracked: trackedKind(tok.fromUserAccount || payer, trackedMap),
      }));
    }
  } else if (natives.length) {
    for (const nat of natives.slice(0, 4)) {
      const sol = (asNumber(nat.amount) || 0) / 1e9;
      events.push(baseEvent(tx, {
        event_type: "SOL_TRANSFER",
        wallet: nat.fromUserAccount || payer,
        source_wallet: nat.fromUserAccount,
        destination_wallet: nat.toUserAccount,
        counterparty: nat.toUserAccount,
        sol_amount: sol,
        usd_value: usdFromSol(sol),
        programs,
        memos,
        tracked: trackedKind(nat.fromUserAccount || payer, trackedMap),
      }));
    }
  } else if (memos.some((m) => String(m).startsWith("ox1|"))) {
    events.push(baseEvent(tx, {
      event_type: "ORBITX_PLATFORM_ACTIVITY",
      wallet: payer,
      attribution: "ORBITX_PLATFORM",
      orbitx_related: true,
      programs,
      memos,
    }));
  } else if (programs.includes(PUMP_FUN) && type.includes("CREATE")) {
    events.push(baseEvent(tx, {
      event_type: "TOKEN_LAUNCH",
      wallet: payer,
      programs,
      memos,
    }));
  } else {
    events.push(baseEvent(tx, {
      event_type: programs.length ? "PROGRAM_INTERACTION" : "UNKNOWN",
      wallet: payer,
      programs,
      memos,
      confidence: "low",
    }));
  }

  return events.filter((e) => e.signature);
}

/**
 * Fallback classification from raw RPC getTransaction (jsonParsed).
 */
export function classifyRpcTx(signature, raw, opts = {}) {
  if (!signature || !raw) return [];
  const keys = accountKeys(raw);
  const payer = keys[0] || null;
  const fee = asNumber(raw?.meta?.fee);
  const err = raw?.meta?.err;
  const logs = Array.isArray(raw?.meta?.logMessages) ? raw.meta.logMessages : [];
  const memos = logs.filter((l) => /ox1\|/.test(l) || /Program log: Memo/i.test(l));
  const pre = raw?.meta?.preBalances || [];
  const post = raw?.meta?.postBalances || [];
  const solDelta = payer && pre[0] != null && post[0] != null ? (post[0] - pre[0]) / 1e9 : null;
  const fake = {
    signature,
    slot: raw.slot,
    timestamp: raw.blockTime,
    fee,
    feePayer: payer,
    type: err ? "FAILED" : "UNKNOWN",
    description: logs[0] || null,
    transactionError: err || null,
    nativeTransfers: [],
    tokenTransfers: [],
    accountData: keys.map((account) => ({ account })),
  };
  if (solDelta != null && Math.abs(solDelta) > 0.000001) {
    fake.nativeTransfers.push({
      fromUserAccount: solDelta < 0 ? payer : keys[1] || null,
      toUserAccount: solDelta < 0 ? keys[1] || null : payer,
      amount: Math.abs(solDelta) * 1e9,
    });
  }
  const preTok = raw?.meta?.preTokenBalances || [];
  const postTok = raw?.meta?.postTokenBalances || [];
  for (const postRow of postTok) {
    const preRow = preTok.find((p) => p.accountIndex === postRow.accountIndex && p.mint === postRow.mint);
    const before = asNumber(preRow?.uiTokenAmount?.uiAmount);
    const after = asNumber(postRow?.uiTokenAmount?.uiAmount);
    if (before == null || after == null || before === after) continue;
    const owner = postRow.owner || payer;
    fake.tokenTransfers.push({
      fromUserAccount: after < before ? owner : null,
      toUserAccount: after > before ? owner : null,
      mint: postRow.mint,
      tokenAmount: Math.abs(after - before),
    });
  }
  if (/Instruction: Burn/i.test(logs.join("\n"))) fake.type = "BURN";
  if (memos.some((m) => /ox1\|/.test(m))) {
    fake.instructions = [{ programId: MEMO_PROGRAM, data: "ox1|swap|0000000000000000000000000000000000000000000000000000000000000000" }];
  }
  return classifyHeliusTx(fake, opts).map((e) => ({
    ...e,
    status: err ? "FAILED" : e.status,
    metadata: { ...e.metadata, parser: "rpc-json", logs: logs.slice(0, 8) },
  }));
}

export function addressKind(address, extras = {}) {
  if (!address) return "Unknown";
  if (PROGRAM_LABELS[address]) return extras.force || (DEX_PROGRAMS.has(address) ? "DEX" : "Program");
  if (extras.tracked?.[address]?.label_kind) return extras.tracked[address].label_kind;
  if (extras.kind) return extras.kind;
  return "Wallet";
}

export function summarizeEvents(events) {
  const rows = Array.isArray(events) ? events : [];
  const now = Date.now();
  const last60 = rows.filter((e) => {
    const t = e.block_time ? Date.parse(e.block_time) : Date.parse(e.created_at || "");
    return Number.isFinite(t) && now - t <= 60_000;
  });
  const lastMin = rows.filter((e) => {
    const t = e.block_time ? Date.parse(e.block_time) : Date.parse(e.created_at || "");
    return Number.isFinite(t) && now - t <= 60_000;
  });
  const orbitx = rows.filter((e) => e.orbitx_related);
  const burns = rows.filter((e) => String(e.event_type || "").includes("BURN"));
  const whales = rows.filter((e) => e.whale_related);
  const wallets = new Set(rows.map((e) => e.wallet).filter(Boolean));
  return {
    events_per_sec: Number((last60.length / 60).toFixed(2)),
    transactions_per_min: lastMin.length,
    buys: rows.filter((e) => /BUY/.test(String(e.event_type || ""))).length,
    sells: rows.filter((e) => /SELL/.test(String(e.event_type || ""))).length,
    swaps: rows.filter((e) => /SWAP/.test(String(e.event_type || ""))).length,
    transfers: rows.filter((e) => /TRANSFER|SOL/.test(String(e.event_type || ""))).length,
    burns: burns.length,
    kol_events: rows.filter((e) => e.kol_related).length,
    orbitx_buys: orbitx.filter((e) => /BUY/.test(e.event_type || "")).length,
    orbitx_sells: orbitx.filter((e) => /SELL/.test(e.event_type || "")).length,
    orbitx_burned: burns
      .filter((e) => isOrbitxMint(e.token_ca))
      .reduce((s, e) => s + (asNumber(e.amount) || 0), 0),
    whale_usd: whales.reduce((s, e) => s + (asNumber(e.usd_value) || 0), 0),
    active_wallets: wallets.size,
  };
}

export function statusFromLag(lagSlots, lastIngestAt) {
  if (!lastIngestAt) return { live: false, label: "INDEXING DELAY", reason: "Indexer has not completed a run." };
  const age = Date.now() - Date.parse(lastIngestAt);
  if (!Number.isFinite(age) || age > 180_000) {
    return { live: false, label: "INDEXING DELAY", reason: "Last ingest is older than 3 minutes." };
  }
  // Address-watch indexer is not sequential. A large lag_slots value does not mean the feed is dead.
  return { live: true, label: "LIVE", reason: null };
}

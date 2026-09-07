/**
 * Non-human wallet filters + PnL classification for the exit desk.
 * Reports patterns only — does not describe how to create them.
 */

const LP_PROGRAMS = new Set([
  "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8",
  "HWy1jotHpo6UqeQxx49dpYYdQB8wj9Qk9MdxwjLvDHB8",
  "GpMZbSM2GgvTKHJirzeGfMFoaZ8UrmdX7K14ACLr3iyE",
  "CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK",
  "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P",
  "39azUYFWPz3VHgKCf3VChUwbpURdCHRxjWVowf5jUJjg",
  "TSLvdd1pWpHVjahSpsvCXUbgwsL3JAcvokwaKt1eokM",
  "CebN5WGQ4jvEPvsVU4EoHEpgznyZtZbHRfTans2eHT6E",
  "whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc",
  "9W959DqEETiGZocYWCQPaJ6sBmUzgfxXfqGeTEdp3aQP",
  "DjVE6JNiYqPL2QXyCUUh8rNjHrbz9hXHNYt99MQ59qw1",
  "Eo7WjKq67rjJQSZxS6z3YkapzY3eMj6Xy8X5EkAW7vAR",
  "LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo",
  "M2mx93ekt1fmXSVkTrUL9xVFHkmME8HTUi5Cyc5aF7K",
  "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4",
  "JUP4Fb2cqiRUcaTHdrPC8h2gNsA2ETXiPDD33aSGYq",
]);

const BURN = new Set([
  "1nc1nerator11111111111111111111111111111111",
  "11111111111111111111111111111111",
]);

const CEX_HINT = /\b(binance|coinbase|kraken|bybit|okx|kucoin|bitfinex|gemini|crypto\.com|cex|exchange|custody)\b/i;
const LP_HINT = /\b(pool|lp|amm|vault|raydium|meteora|orca|whirlpool|bonding.?curve|router|jupiter)\b/i;

export function isLpOrInfraHolder(h) {
  if (!h) return true;
  const owner = String(h.owner || h.address || h.wallet || "").trim();
  if (!owner) return true;
  if (LP_PROGRAMS.has(owner) || BURN.has(owner)) return true;
  if (h.isPool === true || h.is_pool === true) return true;
  const t = `${h.type || ""} ${h.tag || ""} ${h.label || ""} ${h.tags || ""}`;
  if (LP_HINT.test(t) || CEX_HINT.test(t)) return true;
  return false;
}

export function isHumanHolder(h) {
  return !isLpOrInfraHolder(h);
}

export function pickHumanHolders(holders, limit = 15) {
  const list = Array.isArray(holders) ? holders : [];
  return list.filter(isHumanHolder).slice(0, Math.max(0, Number(limit) || 0));
}

export function mapPool(items, limit, fn) {
  const arr = Array.isArray(items) ? items : [];
  const out = new Array(arr.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(Math.max(1, limit), arr.length || 1) }, async () => {
    while (i < arr.length) {
      const idx = i++;
      out[idx] = await fn(arr[idx], idx);
    }
  });
  return Promise.all(workers).then(() => out);
}

export async function withTimeout(promise, ms, fallback) {
  let t;
  try {
    return await Promise.race([
      promise,
      new Promise((_, rej) => {
        t = setTimeout(() => rej(new Error("timeout")), ms);
      }),
    ]);
  } catch {
    return fallback;
  } finally {
    clearTimeout(t);
  }
}

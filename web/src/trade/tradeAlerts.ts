/**
 * Wallet-proof price alerts for Limit / Take-profit / Stop-loss.
 * Notify-only via Telegram or webhook — never auto-executes trades.
 * Delivery runs on Vercel cron → `/api/ogdex/alerts-run`.
 */

type WalletProof = { wallet: string; ts: number; sig: string };

let _proofCache: { proof: WalletProof; at: number } | null = null;

function bytesToBs58(bytes: Uint8Array): string {
  const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let zeros = 0;
  while (zeros < bytes.length && bytes[zeros] === 0) zeros++;
  const size = Math.ceil((bytes.length * 138) / 100) + 1;
  const b = new Uint8Array(size);
  let length = 0;
  for (let i = zeros; i < bytes.length; i++) {
    let carry = bytes[i];
    let j = size - 1;
    while (j >= 0 && (carry || j >= size - length)) {
      carry += 256 * b[j];
      b[j] = carry % 58;
      carry = (carry / 58) | 0;
      j--;
    }
    length = size - 1 - j;
  }
  let out = "1".repeat(zeros);
  for (let i = size - length; i < size; i++) out += alphabet[b[i]];
  return out;
}

export async function signWalletProof(
  wallet: string,
  signMessage: (message: Uint8Array) => Promise<Uint8Array>,
): Promise<WalletProof> {
  if (_proofCache && _proofCache.proof.wallet === wallet && Date.now() - _proofCache.at < 4 * 60_000) {
    return _proofCache.proof;
  }
  const ts = Date.now();
  const msg = new TextEncoder().encode(`orbitx-dex:ogdex-wallet:${wallet}:${ts}`);
  const raw = await signMessage(msg);
  const sig = bytesToBs58(raw instanceof Uint8Array ? raw : new Uint8Array(raw));
  const proof = { wallet, ts, sig };
  _proofCache = { proof, at: Date.now() };
  return proof;
}

export type AlertKind = "limit" | "tp" | "stop";

export const ALERT_KINDS: Record<
  AlertKind,
  { label: string; help: string; type: "price_below" | "price_above"; short: string }
> = {
  limit: {
    label: "Limit buy alert",
    short: "Limit",
    help: "Price alert: notify when the price drops to or below your target. You still place the buy yourself.",
    type: "price_below",
  },
  tp: {
    label: "Take-profit alert",
    short: "TP",
    help: "Price alert: notify when the price rises to or above your target. You still place the sell yourself.",
    type: "price_above",
  },
  stop: {
    label: "Stop-loss alert",
    short: "Stop",
    help: "Price alert: notify when the price falls to or below your target. You still cut the position yourself.",
    type: "price_below",
  },
};

export async function createPriceAlert(opts: {
  wallet: string;
  signMessage: (message: Uint8Array) => Promise<Uint8Array>;
  mint: string;
  symbol?: string;
  kind: AlertKind;
  valueUsd: number;
  channel: "telegram" | "webhook";
  target: string;
}) {
  const proof = await signWalletProof(opts.wallet, opts.signMessage);
  const r = await fetch("/api/ogdex/alerts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      wallet: opts.wallet,
      ts: proof.ts,
      sig: proof.sig,
      alert: {
        mint: opts.mint,
        symbol: opts.symbol || null,
        kind: opts.kind,
        type: ALERT_KINDS[opts.kind].type,
        value: opts.valueUsd,
        channel: opts.channel,
        target: opts.target.trim(),
      },
    }),
  });
  return r.json();
}

export async function fetchAlerts(
  wallet: string,
  signMessage: (message: Uint8Array) => Promise<Uint8Array>,
) {
  const proof = await signWalletProof(wallet, signMessage);
  const r = await fetch(
    `/api/ogdex/alerts?wallet=${encodeURIComponent(wallet)}&ts=${proof.ts}&sig=${encodeURIComponent(proof.sig)}`,
  );
  return r.json();
}

export async function removeAlert(
  wallet: string,
  signMessage: (message: Uint8Array) => Promise<Uint8Array>,
  id: string,
) {
  const proof = await signWalletProof(wallet, signMessage);
  const r = await fetch("/api/ogdex/alerts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ wallet, ts: proof.ts, sig: proof.sig, remove: id }),
  });
  return r.json();
}

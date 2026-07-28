import crypto from 'crypto';

// Stake-style provably-fair primitives.
export function randomSeed(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('hex');
}

export function hashSeed(serverSeed: string): string {
  return crypto.createHash('sha256').update(serverSeed).digest('hex');
}

// Deterministic float in [0,1) from (serverSeed, clientSeed, nonce, cursor).
export function fairFloat(serverSeed: string, clientSeed: string, nonce: number | bigint, cursor = 0): number {
  const hmac = crypto
    .createHmac('sha256', serverSeed)
    .update(`${clientSeed}:${nonce}:${cursor}`)
    .digest('hex');
  // Use 4 bytes -> 32-bit int -> [0,1)
  const int = parseInt(hmac.slice(0, 8), 16);
  return int / 0x100000000;
}

// N distinct floats for one round (e.g. mines tile order). Uses incrementing cursor.
export function fairFloats(serverSeed: string, clientSeed: string, nonce: number | bigint, count: number): number[] {
  return Array.from({ length: count }, (_, i) => fairFloat(serverSeed, clientSeed, nonce, i));
}

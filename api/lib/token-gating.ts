/**
 * Token Gating Service for Agent MCP Access
 * Verifies users hold $10 worth of ORBITX token or have $10+ cumulative buys
 *
 * Exempt list mirrors web/shared/token-gate-exempt.js (keep in sync — Node API package).
 */

import { query, queryOne } from './db';
import * as crypto from 'crypto';

const TOKEN_REQUIREMENT_CA = '13H4WJvGEg4xrrBwWn2vsQgz7xhmhxgNdw19i1QsxPX9';
const MIN_REQUIREMENT_USD = 10.00;
const VERIFICATION_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours in ms

/** DEF / platform wallets that skip the $10 ORBITX hold requirement. */
export const TOKEN_GATE_EXEMPT_WALLETS = [
  '4xT5QZnwtdZKAW5ZcRziEakTwNdnfKMgp1cEVaJmewxd', // DEF / owner
  '45YR6fWxtc8uceNazGKMoX2KgK698rQsnPN4x8vD2VrE', // PLATFORM_WALLET
  'jYbHk588JspmzG5ibjPpKpCrjNP7epAjBT8Syvu7GUb', // ROUTED_FEE_WALLET
] as const;

export const TOKEN_GATE_EXEMPT_EMAILS = ['audifyx@gmail.com'] as const;

function bareWallet(wallet?: string | null): string {
  const addr = (wallet || '').trim();
  if (!addr) return '';
  return addr.includes('@') ? addr.split('@')[0] : addr;
}

export function isTokenGateExemptWallet(wallet?: string | null): boolean {
  const bare = bareWallet(wallet);
  if (!bare) return false;
  const addr = (wallet || '').trim();
  // Case-insensitive vs allowlist — Supabase lowercases SIWS emails / pubkeys.
  return TOKEN_GATE_EXEMPT_WALLETS.some(
    (w) =>
      w === bare ||
      w === addr ||
      w.toLowerCase() === bare.toLowerCase() ||
      w.toLowerCase() === addr.toLowerCase(),
  );
}

export function isTokenGateExemptEmail(email?: string | null): boolean {
  const raw = (email || '').trim();
  if (!raw) return false;
  const e = raw.toLowerCase();
  if ((TOKEN_GATE_EXEMPT_EMAILS as readonly string[]).includes(e)) return true;
  const m = raw.match(/^([1-9A-HJ-NP-Za-km-z]{32,44})@wallet\.orbitx\.app$/i);
  return Boolean(m && isTokenGateExemptWallet(m[1]));
}

function exemptAccess(): AccessVerification {
  const now = new Date();
  return {
    meetsRequirement: true,
    currentHoldingUsd: 0,
    cumulativeBuyValueUsd: 0,
    verifiedAt: now,
    expiresAt: new Date(now.getTime() + VERIFICATION_CACHE_TTL),
    exempt: true,
  };
}

export interface TokenHolding {
  amount: number;
  valueUsd: number;
  verified: boolean;
}

export interface AccessVerification {
  meetsRequirement: boolean;
  currentHoldingUsd: number;
  cumulativeBuyValueUsd: number;
  verifiedAt: Date;
  expiresAt: Date;
  exempt?: boolean;
}

/**
 * Verify if a user has access to the agent MCP
 * Checks: DEF wallet exemption, current holdings, OR cumulative buy history
 */
export async function verifyUserAccess(
  userId: string,
  walletAddress?: string | null,
): Promise<AccessVerification> {
  try {
    if (isTokenGateExemptWallet(walletAddress)) {
      return exemptAccess();
    }

    // Resolve wallet from agents if not provided (DEF wallet check)
    const resolvedWallet =
      walletAddress ||
      (
        await queryOne<{ wallet_address: string }>(
          `SELECT wallet_address FROM agents
           WHERE user_id = $1 AND wallet_address IS NOT NULL AND wallet_address <> ''
           ORDER BY updated_at DESC NULLS LAST
           LIMIT 1`,
          [userId],
        )
      )?.wallet_address;

    if (isTokenGateExemptWallet(resolvedWallet)) {
      return exemptAccess();
    }

    // Check cache first
    const cached = await queryOne<AccessVerification>(
      `SELECT meets_token_requirement as "meetsRequirement", 
              current_holding_usd as "currentHoldingUsd",
              cumulative_buy_value_usd as "cumulativeBuyValueUsd",
              verified_at as "verifiedAt",
              expires_at as "expiresAt"
       FROM user_access_verification
       WHERE user_id = $1 AND expires_at > NOW()`,
      [userId],
    );

    if (cached) {
      return {
        meetsRequirement: cached.meetsRequirement,
        currentHoldingUsd: cached.currentHoldingUsd,
        cumulativeBuyValueUsd: cached.cumulativeBuyValueUsd,
        verifiedAt: new Date(cached.verifiedAt),
        expiresAt: new Date(cached.expiresAt),
      };
    }

    // Cache miss or expired - recalculate
    const currentHolding = await calculateCurrentHolding(userId);
    const cumulativeBuys = await calculateCumulativeBuys(userId);
    const meetsRequirement =
      currentHolding.valueUsd >= MIN_REQUIREMENT_USD ||
      cumulativeBuys >= MIN_REQUIREMENT_USD;

    // Update cache
    await updateAccessVerification(userId, meetsRequirement, currentHolding.valueUsd, cumulativeBuys);

    return {
      meetsRequirement,
      currentHoldingUsd: currentHolding.valueUsd,
      cumulativeBuyValueUsd: cumulativeBuys,
      verifiedAt: new Date(),
      expiresAt: new Date(Date.now() + VERIFICATION_CACHE_TTL),
    };
  } catch (error) {
    console.error('[v0] Token verification error:', error);
    throw error;
  }
}

/**
 * Calculate current token holdings for a user
 */
async function calculateCurrentHolding(userId: string): Promise<TokenHolding> {
  const result = await queryOne<{ amount: string; value_usd: string }>(
    `SELECT 
      COALESCE(SUM(CAST(amount AS DECIMAL)), 0) as amount,
      COALESCE(SUM(CAST(value_usd AS DECIMAL)), 0) as value_usd
     FROM user_token_holdings
     WHERE user_id = $1 AND verified_from_chain = TRUE`,
    [userId],
  );

  return {
    amount: result ? parseFloat(result.amount) : 0,
    valueUsd: result ? parseFloat(result.value_usd) : 0,
    verified: true,
  };
}

/**
 * Calculate cumulative buy transaction value for a user
 */
async function calculateCumulativeBuys(userId: string): Promise<number> {
  const result = await queryOne<{ total: string }>(
    `SELECT COALESCE(SUM(CAST(total_value_usd AS DECIMAL)), 0) as total
     FROM user_buy_history
     WHERE user_id = $1 AND verified_from_chain = TRUE`,
    [userId],
  );

  return result ? parseFloat(result.total) : 0;
}

/**
 * Update the access verification cache
 */
async function updateAccessVerification(
  userId: string,
  meetsRequirement: boolean,
  currentHoldingUsd: number,
  cumulativeBuyValueUsd: number,
): Promise<void> {
  await query(
    `INSERT INTO user_access_verification 
      (user_id, wallet_address, meets_token_requirement, current_holding_usd, cumulative_buy_value_usd, expires_at)
     VALUES ($1, '', $2, $3, $4, NOW() + INTERVAL '24 hours')
     ON CONFLICT (user_id) DO UPDATE SET
       meets_token_requirement = $2,
       current_holding_usd = $3,
       cumulative_buy_value_usd = $4,
       verified_at = NOW(),
       expires_at = NOW() + INTERVAL '24 hours'`,
    [userId, meetsRequirement, currentHoldingUsd, cumulativeBuyValueUsd],
  );
}

/**
 * Record a token holding from wallet scan
 */
export async function recordTokenHolding(
  userId: string,
  walletAddress: string,
  amount: number,
  valueUsd: number,
): Promise<void> {
  await query(
    `INSERT INTO user_token_holdings (user_id, wallet_address, token_ca, amount, value_usd, verified_from_chain)
     VALUES ($1, $2, $3, $4, $5, TRUE)
     ON CONFLICT (user_id, wallet_address, token_ca) DO UPDATE SET
       amount = $4,
       value_usd = $5,
       last_verified_at = NOW()`,
    [userId, walletAddress, TOKEN_REQUIREMENT_CA, amount, valueUsd],
  );

  // Clear cache to force revalidation
  await query(`DELETE FROM user_access_verification WHERE user_id = $1`, [userId]);
}

/**
 * Record a buy transaction
 */
export async function recordBuyTransaction(
  userId: string,
  walletAddress: string,
  txHash: string,
  amount: number,
  pricePerToken: number,
  totalValueUsd: number,
  txTimestamp: Date,
): Promise<void> {
  await query(
    `INSERT INTO user_buy_history 
      (user_id, wallet_address, token_ca, tx_hash, amount, price_usd_per_token, total_value_usd, tx_timestamp, verified_from_chain)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE)
     ON CONFLICT (user_id, wallet_address, tx_hash) DO NOTHING`,
    [userId, walletAddress, TOKEN_REQUIREMENT_CA, txHash, amount, pricePerToken, totalValueUsd, txTimestamp],
  );

  // Clear cache to force revalidation
  await query(`DELETE FROM user_access_verification WHERE user_id = $1`, [userId]);
}

/**
 * Generate a secure API key for agent access
 */
export function generateApiKey(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Hash an API key (SHA-256)
 */
export function hashApiKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

/**
 * Verify an API key hash
 */
export function verifyApiKey(key: string, hash: string): boolean {
  const keyHash = hashApiKey(key);
  return keyHash === hash;
}

/**
 * Get token requirement info
 */
export async function getTokenRequirement(): Promise<{
  ca: string;
  symbol: string;
  minValueUsd: number;
}> {
  const result = await queryOne<{
    token_ca: string;
    token_symbol: string;
    min_value_usd: string;
  }>(
    `SELECT token_ca, token_symbol, min_value_usd
     FROM token_requirements
     WHERE active = TRUE
     LIMIT 1`,
  );

  if (!result) {
    throw new Error('Token requirement not configured');
  }

  return {
    ca: result.token_ca,
    symbol: result.token_symbol || 'ORBITX',
    minValueUsd: parseFloat(result.min_value_usd),
  };
}

/**
 * API Authentication & Authorization Utilities
 * Handles API key verification and user authentication
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { queryOne } from './db';
import { hashApiKey, verifyUserAccess } from './token-gating';

export interface AuthenticatedUser {
  userId: string;
  walletAddress?: string;
}

export interface ApiKeyAuth {
  agentId: string;
  userId: string;
}

/**
 * Get API key from Authorization header
 * Format: Authorization: Bearer <api-key>
 */
export function getApiKeyFromHeader(req: NextApiRequest): string | null {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return null;
  }
  return auth.substring(7);
}

/**
 * Verify API key and get agent/user info
 */
export async function verifyApiKey(apiKey: string): Promise<ApiKeyAuth | null> {
  try {
    const keyHash = hashApiKey(apiKey);

    const result = await queryOne<{
      agent_id: string;
      agent_user_id: string;
    }>(
      `SELECT ak.agent_id, a.user_id as agent_user_id
       FROM agent_api_keys ak
       JOIN agents a ON ak.agent_id = a.id
       WHERE ak.key_hash = $1 AND ak.revoked_at IS NULL`,
      [keyHash],
    );

    if (!result) {
      return null;
    }

    // Update last_used_at
    await queryOne(
      `UPDATE agent_api_keys SET last_used_at = NOW() WHERE key_hash = $1`,
      [keyHash],
    );

    return {
      agentId: result.agent_id,
      userId: result.agent_user_id,
    };
  } catch (error) {
    console.error('[v0] API key verification error:', error);
    return null;
  }
}

/**
 * Middleware: Require API key authentication
 */
export async function requireApiKey(req: NextApiRequest, res: NextApiResponse): Promise<ApiKeyAuth | null> {
  const apiKey = getApiKeyFromHeader(req);

  if (!apiKey) {
    res.status(401).json({ error: 'Missing or invalid authorization header' });
    return null;
  }

  const auth = await verifyApiKey(apiKey);

  if (!auth) {
    res.status(401).json({ error: 'Invalid API key' });
    return null;
  }

  return auth;
}

/**
 * Middleware: Require token gating verification
 */
export async function requireTokenAccess(
  userId: string,
  res: NextApiResponse,
  walletAddress?: string | null,
): Promise<boolean> {
  try {
    const verification = await verifyUserAccess(userId, walletAddress);

    if (!verification.meetsRequirement) {
      res.status(403).json({
        error: 'Insufficient token holdings. Need $5 worth of ORBITX token or $5+ cumulative buys.',
        currentHolding: verification.currentHoldingUsd,
        cumulativeBuys: verification.cumulativeBuyValueUsd,
      });
      return false;
    }

    return true;
  } catch (error) {
    console.error('[v0] Token access verification error:', error);
    res.status(500).json({ error: 'Failed to verify token access' });
    return false;
  }
}

/**
 * Send error response
 */
export function sendError(res: NextApiResponse, status: number, message: string, data?: any) {
  res.status(status).json({
    error: message,
    ...(data && { details: data }),
  });
}

/**
 * Send success response
 */
export function sendSuccess(res: NextApiResponse, data: any, status: number = 200) {
  res.status(status).json(data);
}

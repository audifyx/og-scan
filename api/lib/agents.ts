/**
 * Agent Management Service
 * CRUD operations for agents, API keys, settings, and activity logging
 */

import { query, queryOne, withTransaction } from './db';
import { generateApiKey, hashApiKey } from './token-gating';
import { v4 as uuidv4 } from 'uuid';

export interface Agent {
  id: string;
  userId: string;
  name: string;
  description?: string;
  status: 'active' | 'paused' | 'disabled';
  walletAddress?: string;
  phantomConnected: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AgentApiKey {
  id: string;
  agentId: string;
  name: string;
  keyHash: string; // We never return the actual key
  lastUsedAt?: Date;
  revokedAt?: Date;
  createdAt: Date;
}

export interface AgentSettings {
  id: string;
  agentId: string;
  tradingEnabled: boolean;
  nftMintingEnabled: boolean;
  tokenLaunchEnabled: boolean;
  socialPostingEnabled: boolean;
  maxTradeSizeUsd: number;
  maxDailyVolumeUsd: number;
  autoStopLossPct?: number;
  autoTakeProfitPct?: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Create a new agent
 */
export async function createAgent(
  userId: string,
  name: string,
  description?: string,
): Promise<Agent> {
  const id = uuidv4();
  
  const result = await queryOne<any>(
    `INSERT INTO agents (id, user_id, name, description, status)
     VALUES ($1, $2, $3, $4, 'active')
     RETURNING *`,
    [id, userId, name, description || null],
  );

  if (!result) throw new Error('Failed to create agent');

  return mapAgent(result);
}

/**
 * Get an agent by ID (with authorization check)
 */
export async function getAgent(agentId: string, userId: string): Promise<Agent | null> {
  const result = await queryOne<any>(
    `SELECT * FROM agents WHERE id = $1 AND user_id = $2`,
    [agentId, userId],
  );

  return result ? mapAgent(result) : null;
}

/**
 * Get all agents for a user
 */
export async function getUserAgents(userId: string): Promise<Agent[]> {
  const result = await query<any>(
    `SELECT * FROM agents WHERE user_id = $1 ORDER BY created_at DESC`,
    [userId],
  );

  return result.rows.map(mapAgent);
}

/**
 * Update agent
 */
export async function updateAgent(
  agentId: string,
  userId: string,
  updates: Partial<Agent>,
): Promise<Agent> {
  const allowedFields = ['name', 'description', 'status', 'wallet_address', 'phantom_connected'];
  const setClause = Object.entries(updates)
    .filter(([key]) => allowedFields.includes(key))
    .map(([key], i) => `${key} = $${i + 1}`)
    .join(', ');

  if (!setClause) throw new Error('No valid fields to update');

  const values = Object.values(updates).filter((_, i) => 
    allowedFields.includes(Object.keys(updates)[i])
  );
  values.push(agentId, userId);

  const result = await queryOne<any>(
    `UPDATE agents SET ${setClause} WHERE id = $${values.length - 1} AND user_id = $${values.length}
     RETURNING *`,
    values,
  );

  if (!result) throw new Error('Agent not found');

  return mapAgent(result);
}

/**
 * Delete an agent
 */
export async function deleteAgent(agentId: string, userId: string): Promise<void> {
  await query(
    `DELETE FROM agents WHERE id = $1 AND user_id = $2`,
    [agentId, userId],
  );
}

/**
 * Create an API key for an agent
 */
export async function createApiKey(
  agentId: string,
  userId: string,
  keyName: string,
): Promise<{ id: string; key: string; name: string }> {
  // Verify agent belongs to user
  const agent = await getAgent(agentId, userId);
  if (!agent) throw new Error('Agent not found');

  const key = generateApiKey();
  const keyHash = hashApiKey(key);
  const id = uuidv4();

  await query(
    `INSERT INTO agent_api_keys (id, agent_id, key_hash, name)
     VALUES ($1, $2, $3, $4)`,
    [id, agentId, keyHash, keyName],
  );

  return { id, key, name: keyName };
}

/**
 * Get API keys for an agent (without revealing actual keys)
 */
export async function getApiKeys(agentId: string, userId: string): Promise<AgentApiKey[]> {
  // Verify agent belongs to user
  const agent = await getAgent(agentId, userId);
  if (!agent) throw new Error('Agent not found');

  const result = await query<any>(
    `SELECT id, agent_id as "agentId", name, key_hash as "keyHash", 
            last_used_at as "lastUsedAt", revoked_at as "revokedAt", created_at as "createdAt"
     FROM agent_api_keys
     WHERE agent_id = $1 AND revoked_at IS NULL
     ORDER BY created_at DESC`,
    [agentId],
  );

  return result.rows.map(row => ({
    id: row.id,
    agentId: row.agentId,
    name: row.name,
    keyHash: row.keyHash,
    lastUsedAt: row.lastUsedAt ? new Date(row.lastUsedAt) : undefined,
    revokedAt: row.revokedAt ? new Date(row.revokedAt) : undefined,
    createdAt: new Date(row.createdAt),
  }));
}

/**
 * Revoke an API key
 */
export async function revokeApiKey(keyId: string, userId: string): Promise<void> {
  // Verify key belongs to user's agent
  const key = await queryOne<{ agent_id: string }>(
    `SELECT ak.agent_id FROM agent_api_keys ak
     JOIN agents a ON ak.agent_id = a.id
     WHERE ak.id = $1 AND a.user_id = $2`,
    [keyId, userId],
  );

  if (!key) throw new Error('API key not found');

  await query(
    `UPDATE agent_api_keys SET revoked_at = NOW() WHERE id = $1`,
    [keyId],
  );
}

/**
 * Get or create agent settings
 */
export async function getOrCreateSettings(
  agentId: string,
  userId: string,
): Promise<AgentSettings> {
  // Verify agent belongs to user
  const agent = await getAgent(agentId, userId);
  if (!agent) throw new Error('Agent not found');

  let result = await queryOne<any>(
    `SELECT * FROM agent_settings WHERE agent_id = $1`,
    [agentId],
  );

  if (!result) {
    const id = uuidv4();
    result = await queryOne<any>(
      `INSERT INTO agent_settings (id, agent_id) VALUES ($1, $2) RETURNING *`,
      [id, agentId],
    );
  }

  return mapSettings(result);
}

/**
 * Update agent settings
 */
export async function updateSettings(
  agentId: string,
  userId: string,
  updates: Partial<AgentSettings>,
): Promise<AgentSettings> {
  // Verify agent belongs to user
  const agent = await getAgent(agentId, userId);
  if (!agent) throw new Error('Agent not found');

  const allowedFields = [
    'trading_enabled', 'nft_minting_enabled', 'token_launch_enabled',
    'social_posting_enabled', 'max_trade_size_usd', 'max_daily_volume_usd',
    'auto_stop_loss_pct', 'auto_take_profit_pct',
  ];

  const setClause = Object.entries(updates)
    .filter(([key]) => allowedFields.includes(key))
    .map(([key], i) => `${key} = $${i + 1}`)
    .join(', ');

  if (!setClause) throw new Error('No valid fields to update');

  const values = Object.values(updates).filter((_, i) =>
    allowedFields.includes(Object.keys(updates)[i])
  );
  values.push(agentId);

  const result = await queryOne<any>(
    `UPDATE agent_settings SET ${setClause} WHERE agent_id = $${values.length}
     RETURNING *`,
    values,
  );

  if (!result) throw new Error('Settings not found');

  return mapSettings(result);
}

// Mapping functions
function mapAgent(row: any): Agent {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    description: row.description,
    status: row.status,
    walletAddress: row.wallet_address,
    phantomConnected: row.phantom_connected,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function mapSettings(row: any): AgentSettings {
  return {
    id: row.id,
    agentId: row.agent_id,
    tradingEnabled: row.trading_enabled,
    nftMintingEnabled: row.nft_minting_enabled,
    tokenLaunchEnabled: row.token_launch_enabled,
    socialPostingEnabled: row.social_posting_enabled,
    maxTradeSizeUsd: parseFloat(row.max_trade_size_usd),
    maxDailyVolumeUsd: parseFloat(row.max_daily_volume_usd),
    autoStopLossPct: row.auto_stop_loss_pct ? parseFloat(row.auto_stop_loss_pct) : undefined,
    autoTakeProfitPct: row.auto_take_profit_pct ? parseFloat(row.auto_take_profit_pct) : undefined,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

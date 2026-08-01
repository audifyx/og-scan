/**
 * Activity Logging Service
 * Tracks agent actions: trades, NFT mints, token launches, social posts
 */

import { query, queryOne } from './db';
import { v4 as uuidv4 } from 'uuid';

export interface Activity {
  id: string;
  agentId: string;
  activityType: string;
  action: string;
  status: 'pending' | 'success' | 'failed' | 'partial';
  description?: string;
  dataJson?: any;
  txHash?: string;
  errorMessage?: string;
  createdAt: Date;
  completedAt?: Date;
}

export interface Trade {
  id: string;
  agentId: string;
  walletAddress: string;
  direction: 'buy' | 'sell';
  tokenMint: string;
  tokenSymbol?: string;
  amountTokens: number;
  pricePerToken: number;
  totalValueUsd: number;
  slippagePct?: number;
  status: 'pending' | 'executed' | 'failed' | 'cancelled';
  txHash?: string;
  dexUsed: string;
  executionTimeMs?: number;
  createdAt: Date;
  executedAt?: Date;
}

/**
 * Log an agent activity
 */
export async function logActivity(
  agentId: string,
  activityType: string,
  action: string,
  status: 'pending' | 'success' | 'failed' | 'partial' = 'pending',
  description?: string,
  dataJson?: any,
): Promise<string> {
  const id = uuidv4();

  await query(
    `INSERT INTO agent_activities (id, agent_id, activity_type, action, status, description, data_json)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [id, agentId, activityType, action, status, description, dataJson ? JSON.stringify(dataJson) : null],
  );

  return id;
}

/**
 * Update activity status
 */
export async function updateActivityStatus(
  activityId: string,
  status: 'pending' | 'success' | 'failed' | 'partial',
  errorMessage?: string,
  txHash?: string,
): Promise<void> {
  const updates: any = { status };
  const values: any[] = [status];

  if (errorMessage) {
    updates.error_message = errorMessage;
    values.push(errorMessage);
  }

  if (txHash) {
    updates.tx_hash = txHash;
    values.push(txHash);
  }

  if (status !== 'pending') {
    updates.completed_at = 'NOW()';
  }

  const setClause = Object.keys(updates)
    .map((key, i) => `${key} = ${updates[key] === 'NOW()' ? 'NOW()' : '$' + (i + 1)}`)
    .join(', ');

  await query(
    `UPDATE agent_activities SET ${setClause} WHERE id = $${values.length + 1}`,
    [...values, activityId],
  );
}

/**
 * Record a trade execution
 */
export async function recordTrade(
  agentId: string,
  walletAddress: string,
  direction: 'buy' | 'sell',
  tokenMint: string,
  amountTokens: number,
  pricePerToken: number,
  totalValueUsd: number,
  dexUsed: string = 'jupiter',
  tokenSymbol?: string,
): Promise<string> {
  const id = uuidv4();

  await query(
    `INSERT INTO agent_trades 
      (id, agent_id, wallet_address, direction, token_mint, token_symbol, amount_tokens, 
       price_per_token, total_value_usd, dex_used, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'pending')`,
    [id, agentId, walletAddress, direction, tokenMint, tokenSymbol, amountTokens, 
     pricePerToken, totalValueUsd, dexUsed],
  );

  return id;
}

/**
 * Update trade execution
 */
export async function updateTrade(
  tradeId: string,
  status: 'pending' | 'executed' | 'failed' | 'cancelled',
  txHash?: string,
  executionTimeMs?: number,
  slippagePct?: number,
): Promise<void> {
  const updates: any = { status };
  const values: any[] = [status];

  if (txHash) {
    updates.tx_hash = txHash;
    values.push(txHash);
  }

  if (executionTimeMs !== undefined) {
    updates.execution_time_ms = executionTimeMs;
    values.push(executionTimeMs);
  }

  if (slippagePct !== undefined) {
    updates.slippage_pct = slippagePct;
    values.push(slippagePct);
  }

  if (status !== 'pending') {
    updates.executed_at = 'NOW()';
  }

  const setClause = Object.keys(updates)
    .map((key, i) => `${key} = ${updates[key] === 'NOW()' ? 'NOW()' : '$' + (i + 1)}`)
    .join(', ');

  await query(
    `UPDATE agent_trades SET ${setClause} WHERE id = $${values.length + 1}`,
    [...values, tradeId],
  );
}

/**
 * Get agent trades history
 */
export async function getAgentTrades(
  agentId: string,
  limit: number = 50,
  offset: number = 0,
): Promise<Trade[]> {
  const result = await query<any>(
    `SELECT * FROM agent_trades 
     WHERE agent_id = $1 
     ORDER BY created_at DESC 
     LIMIT $2 OFFSET $3`,
    [agentId, limit, offset],
  );

  return result.rows.map(mapTrade);
}

/**
 * Record NFT minting
 */
export async function recordNftMint(
  agentId: string,
  walletAddress: string,
  nftName: string,
  nftSymbol?: string,
  metadataUri?: string,
  royaltyBasisPoints?: number,
): Promise<string> {
  const id = uuidv4();

  await query(
    `INSERT INTO agent_nft_mints 
      (id, agent_id, wallet_address, nft_name, nft_symbol, metadata_uri, royalty_basis_points, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')`,
    [id, agentId, walletAddress, nftName, nftSymbol, metadataUri, royaltyBasisPoints],
  );

  return id;
}

/**
 * Update NFT mint
 */
export async function updateNftMint(
  mintId: string,
  status: 'pending' | 'minted' | 'failed',
  txHash?: string,
  collectionAddress?: string,
): Promise<void> {
  const updates: any = { status };
  const values: any[] = [status];

  if (txHash) {
    updates.tx_hash = txHash;
    values.push(txHash);
  }

  if (collectionAddress) {
    updates.collection_address = collectionAddress;
    values.push(collectionAddress);
  }

  if (status !== 'pending') {
    updates.minted_at = 'NOW()';
  }

  const setClause = Object.keys(updates)
    .map((key, i) => `${key} = ${updates[key] === 'NOW()' ? 'NOW()' : '$' + (i + 1)}`)
    .join(', ');

  await query(
    `UPDATE agent_nft_mints SET ${setClause} WHERE id = $${values.length + 1}`,
    [...values, mintId],
  );
}

/**
 * Record token launch
 */
export async function recordTokenLaunch(
  agentId: string,
  walletAddress: string,
  tokenName: string,
  tokenSymbol: string,
  initialSupply: number,
  decimals: number = 6,
): Promise<string> {
  const id = uuidv4();

  await query(
    `INSERT INTO agent_token_launches 
      (id, agent_id, wallet_address, token_name, token_symbol, initial_supply, decimals, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')`,
    [id, agentId, walletAddress, tokenName, tokenSymbol, initialSupply, decimals],
  );

  return id;
}

/**
 * Update token launch
 */
export async function updateTokenLaunch(
  launchId: string,
  status: 'pending' | 'launched' | 'failed',
  tokenMint?: string,
  txHash?: string,
): Promise<void> {
  const updates: any = { status };
  const values: any[] = [status];

  if (tokenMint) {
    updates.token_mint = tokenMint;
    values.push(tokenMint);
  }

  if (txHash) {
    updates.tx_hash = txHash;
    values.push(txHash);
  }

  if (status !== 'pending') {
    updates.launched_at = 'NOW()';
  }

  const setClause = Object.keys(updates)
    .map((key, i) => `${key} = ${updates[key] === 'NOW()' ? 'NOW()' : '$' + (i + 1)}`)
    .join(', ');

  await query(
    `UPDATE agent_token_launches SET ${setClause} WHERE id = $${values.length + 1}`,
    [...values, launchId],
  );
}

/**
 * Record social post
 */
export async function recordSocialPost(
  agentId: string,
  walletAddress: string,
  platform: string,
  content: string,
  mediaUrls?: string[],
): Promise<string> {
  const id = uuidv4();

  await query(
    `INSERT INTO agent_social_posts 
      (id, agent_id, wallet_address, platform, content, media_urls, status)
     VALUES ($1, $2, $3, $4, $5, $6, 'pending')`,
    [id, agentId, walletAddress, platform, content, mediaUrls ? JSON.stringify(mediaUrls) : null],
  );

  return id;
}

/**
 * Update social post
 */
export async function updateSocialPost(
  postId: string,
  status: 'pending' | 'posted' | 'failed',
  postUrl?: string,
  engagementCount?: number,
): Promise<void> {
  const updates: any = { status };
  const values: any[] = [status];

  if (postUrl) {
    updates.post_url = postUrl;
    values.push(postUrl);
  }

  if (engagementCount !== undefined) {
    updates.engagement_count = engagementCount;
    values.push(engagementCount);
  }

  if (status !== 'pending') {
    updates.posted_at = 'NOW()';
  }

  const setClause = Object.keys(updates)
    .map((key, i) => `${key} = ${updates[key] === 'NOW()' ? 'NOW()' : '$' + (i + 1)}`)
    .join(', ');

  await query(
    `UPDATE agent_social_posts SET ${setClause} WHERE id = $${values.length + 1}`,
    [...values, postId],
  );
}

/**
 * Get agent activity history
 */
export async function getAgentActivity(
  agentId: string,
  limit: number = 100,
  offset: number = 0,
): Promise<Activity[]> {
  const result = await query<any>(
    `SELECT * FROM agent_activities 
     WHERE agent_id = $1 
     ORDER BY created_at DESC 
     LIMIT $2 OFFSET $3`,
    [agentId, limit, offset],
  );

  return result.rows.map(mapActivity);
}

// Mapping functions
function mapActivity(row: any): Activity {
  return {
    id: row.id,
    agentId: row.agent_id,
    activityType: row.activity_type,
    action: row.action,
    status: row.status,
    description: row.description,
    dataJson: row.data_json ? JSON.parse(row.data_json) : undefined,
    txHash: row.tx_hash,
    errorMessage: row.error_message,
    createdAt: new Date(row.created_at),
    completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
  };
}

function mapTrade(row: any): Trade {
  return {
    id: row.id,
    agentId: row.agent_id,
    walletAddress: row.wallet_address,
    direction: row.direction,
    tokenMint: row.token_mint,
    tokenSymbol: row.token_symbol,
    amountTokens: parseFloat(row.amount_tokens),
    pricePerToken: parseFloat(row.price_per_token),
    totalValueUsd: parseFloat(row.total_value_usd),
    slippagePct: row.slippage_pct ? parseFloat(row.slippage_pct) : undefined,
    status: row.status,
    txHash: row.tx_hash,
    dexUsed: row.dex_used,
    executionTimeMs: row.execution_time_ms,
    createdAt: new Date(row.created_at),
    executedAt: row.executed_at ? new Date(row.executed_at) : undefined,
  };
}

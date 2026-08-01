/**
 * PostgreSQL Database Client for Agent System
 * Uses connection pooling for optimal performance
 */

import { Pool, PoolClient } from 'pg';

// Create a connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Handle pool errors
pool.on('error', (err) => {
  console.error('[v0] Unexpected error on idle client', err);
});

/**
 * Get a database client from the pool
 */
export async function getClient(): Promise<PoolClient> {
  return pool.connect();
}

/**
 * Query the database
 */
export async function query<T = any>(
  text: string,
  values?: any[],
): Promise<{ rows: T[]; rowCount: number }> {
  const start = Date.now();
  try {
    const result = await pool.query(text, values);
    const duration = Date.now() - start;
    
    if (duration > 1000) {
      console.log('[v0] Slow query detected:', { text, duration });
    }
    
    return {
      rows: result.rows,
      rowCount: result.rowCount || 0,
    };
  } catch (error) {
    console.error('[v0] Database query error:', error);
    throw error;
  }
}

/**
 * Query a single row
 */
export async function queryOne<T = any>(
  text: string,
  values?: any[],
): Promise<T | null> {
  const result = await query<T>(text, values);
  return result.rows[0] || null;
}

/**
 * Run a transaction
 */
export async function withTransaction<T>(
  callback: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Close the pool
 */
export async function closePool(): Promise<void> {
  await pool.end();
}

export default pool;

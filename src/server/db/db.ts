import pkg from 'pg';
import type { Pool as PoolType } from 'pg';
const { Pool } = pkg;
import 'dotenv/config';

// Create a singleton pool instance to reuse connections
let _pool: PoolType | null = null;

/**
 * Get the database pool instance - singleton pattern
 * @returns {Pool} The database connection pool
 */
export function getPool() {
  if (!_pool) {
    _pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      // Adding max and idle timeout settings for better resource management
      max: parseInt(process.env.DB_MAX_CONNECTIONS || '20'),
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000
    });

    // Add event listeners for connection issues
    _pool.on('error', (err) => {
      console.error('Unexpected error on idle client', err);
    });
  }
  return _pool;
}

/**
 * Close the session-store pool during graceful shutdown.
 */
export async function closePool() {
  if (_pool) {
    await _pool.end();
    _pool = null;
  }
}

export default {
  getPool,
  closePool
};

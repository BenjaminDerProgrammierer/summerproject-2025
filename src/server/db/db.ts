import pkg from 'pg';
import type { Pool as PoolType, PoolClient, QueryResult, QueryResultRow } from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
import { getDatabaseUrl } from '../config/env.js';
dotenv.config({ quiet: true });

// Create a singleton pool instance to reuse connections
let _pool: PoolType | null = null;

/**
 * Get the database pool instance - singleton pattern
 * @returns {Pool} The database connection pool
 */
export function getPool() {
  if (!_pool) {
    _pool = new Pool({
      connectionString: getDatabaseUrl(),
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
 * Execute a query with parameters
 * @param {string} text - SQL query text
 * @param {Array} params - Query parameters
 * @returns {Promise} Query result
 */
export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<QueryResult<T>> {
  const pool = getPool();
  
  try {
    const response = await pool.query(text, params);
    // if (process.env.NODE_ENV !== 'production') {
    //   console.log('Executing query:', text, 'with params:', params, 'response:', response);
    // }
    return response;
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
}

/**
 * Get a client from the pool for executing multiple queries in a transaction
 * @returns {Promise<PoolClient>} Database client
 */
export async function getClient(): Promise<PoolClient> {
  const pool = getPool();
  const client = await pool.connect();

  // Add extra functionality for testing - track query history
  const originalQuery = client.query.bind(client);
  const queryLog: unknown[][] = [];

  // Only monkey patch in test environment
  if (process.env.NODE_ENV === 'test') {
    const trackedClient = client as PoolClient & { getQueryLog?: () => unknown[][] };
    trackedClient.query = ((...args: unknown[]) => {
      queryLog.push(args);
      return (originalQuery as (...queryArgs: unknown[]) => unknown)(...args);
    }) as PoolClient['query'];
    trackedClient.getQueryLog = () => queryLog;
  }

  return client;
}

/**
 * Close all pool connections - useful for tests and graceful shutdown
 */
export async function closePool() {
  if (_pool) {
    await _pool.end();
    _pool = null;
  }
}

export default {
  query,
  getClient,
  getPool,
  closePool
};

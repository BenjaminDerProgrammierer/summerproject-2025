import { existsSync, mkdirSync } from 'node:fs';
import { attachmentsDir } from '../config/paths.js';
import { getPool } from './db.js';

export default async function initDB(): Promise<void> {
  const pool = getPool();
  const result = await pool.query(`
    SELECT EXISTS (
      SELECT FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'users'
    )
  `);

  if (!result.rows[0]?.exists) {
    throw new Error('Database schema is missing. Run `pnpm db:migrate` before starting the application.');
  }

  if (!existsSync(attachmentsDir)) {
    mkdirSync(attachmentsDir, { recursive: true });
  }
}

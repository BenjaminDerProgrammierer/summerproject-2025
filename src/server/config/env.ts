import { z } from 'zod';

const databaseUrlSchema = z.url().refine(
  (url) => url.startsWith('postgresql://') || url.startsWith('postgres://'),
  'DATABASE_URL must be a PostgreSQL URL',
);

export function getDatabaseUrl(): string {
  return databaseUrlSchema.parse(process.env.DATABASE_URL);
}

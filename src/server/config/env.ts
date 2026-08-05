import { z } from 'zod';

const databasePartsSchema = z.object({
  DB_USER: z.string().min(1),
  DB_PASSWORD: z.string().min(1),
  DB_HOST: z.string().min(1),
  DB_PORT: z.coerce.number().int().positive().max(65535),
  DB_NAME: z.string().min(1),
});

export function getDatabaseUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;

  const parts = databasePartsSchema.parse(process.env);
  const username = encodeURIComponent(parts.DB_USER);
  const password = encodeURIComponent(parts.DB_PASSWORD);
  const database = encodeURIComponent(parts.DB_NAME);
  return `postgresql://${username}:${password}@${parts.DB_HOST}:${parts.DB_PORT}/${database}`;
}

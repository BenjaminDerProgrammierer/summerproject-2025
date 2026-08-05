import { existsSync, mkdirSync } from 'node:fs';
import { attachmentsDir } from '../config/paths.js';
import { prisma } from './prisma.js';

export default async function initDB(): Promise<void> {
  try {
    await prisma.user.count();
  } catch (error) {
    console.error('Database readiness check failed:', error);
    throw new Error('Database schema is missing. Run `pnpm db:migrate` before starting the application.');
  }

  if (!existsSync(attachmentsDir)) {
    mkdirSync(attachmentsDir, { recursive: true });
  }
}

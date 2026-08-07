import { existsSync, mkdirSync } from 'node:fs';
import { attachmentsDir } from '../config/paths.js';
import { prisma } from './prisma.js';

const defaultRoles = [
  { name: 'user', description: 'Regular user with basic privileges' },
  { name: 'writer', description: 'Can create and edit own content' },
  { name: 'moderator', description: 'Can moderate content and users' },
  { name: 'admin', description: 'Full administrative access' },
];

const defaultSiteSettings = [
  {
    settingKey: 'site_visibility',
    settingValue: 'private',
    description: 'Whether the site is public or private (requires login)',
  },
  {
    settingKey: 'registration_mode',
    settingValue: 'invite_only',
    description: 'Registration mode: open, invite_only, or closed',
  },
];

export default async function initDB(): Promise<void> {
  try {
    await prisma.user.count();
  } catch (error) {
    console.error('Database readiness check failed:', error);
    throw new Error('Database schema is missing. Run `pnpm db:migrate` before starting the application.');
  }

  await prisma.$transaction([
    prisma.role.createMany({ data: defaultRoles, skipDuplicates: true }),
    prisma.siteSetting.createMany({ data: defaultSiteSettings, skipDuplicates: true }),
  ]);

  if (!existsSync(attachmentsDir)) {
    mkdirSync(attachmentsDir, { recursive: true });
  }
}

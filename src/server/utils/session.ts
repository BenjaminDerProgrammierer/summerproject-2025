import type { Request } from 'express';
import type { UserRole } from '../types/security.js';

export async function establishAuthenticatedSession(
  req: Request,
  user: { id: number; role: UserRole; authVersion: number },
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    req.session.regenerate(error => error ? reject(error) : resolve());
  });
  req.session.userId = user.id;
  req.session.role = user.role;
  req.session.authVersion = user.authVersion;
}

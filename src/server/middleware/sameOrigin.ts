import type { NextFunction, Request, Response } from 'express';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function configuredOrigins(req: Request): Set<string> {
  const origins = new Set<string>();
  const host = req.get('host');
  if (host) origins.add(`${req.protocol}://${host}`);

  for (const configured of [process.env.APP_URL, process.env.CORS_ORIGIN]) {
    if (!configured) continue;
    try {
      origins.add(new URL(configured).origin);
    } catch {
      // Invalid configuration is ignored here and rejected by the origin comparison.
    }
  }
  return origins;
}

/**
 * Prevent cross-origin mutations that authenticate with the session cookie.
 * Bearer-only requests do not rely on ambient browser credentials and are exempt.
 */
export function requireSameOriginForSession(
  req: Request,
  res: Response,
  next: NextFunction,
): void | Response {
  if (SAFE_METHODS.has(req.method) || !req.session?.userId) return next();

  const origin = req.get('origin');
  if (!origin) return res.status(403).json({ message: 'Origin header required' });

  try {
    if (configuredOrigins(req).has(new URL(origin).origin)) return next();
  } catch {
    // Malformed origins are rejected below.
  }
  return res.status(403).json({ message: 'Cross-origin request rejected' });
}

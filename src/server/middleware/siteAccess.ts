import { prisma } from '../db/prisma.js';
import type { NextFunction, Request, Response } from 'express';
import { auth } from './auth.js';

/**
 * Middleware to check if site content is accessible
 * If site is private, user must be authenticated
 */
export async function checkSiteAccess(req: Request, res: Response, next: NextFunction): Promise<void | Response> {
  try {
    // Get site visibility setting
    const setting = await prisma.siteSetting.findUnique({ where: { settingKey: 'site_visibility' } });
    const siteVisibility = setting?.settingValue ?? 'private';
    
    // If site is public, allow access
    if (siteVisibility === 'public') {
      return next();
    }
    
    // Private content requires a valid, non-revoked session or JWT.
    return auth(req, res, next);
  } catch (err) {
    console.error('Error checking site access:', err);
    // Fail closed if visibility cannot be determined.
    return res.status(503).json({ message: 'Site access could not be verified' });
  }
}

export default { checkSiteAccess };

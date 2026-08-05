import { prisma } from '../db/prisma.js';
import type { NextFunction, Request, Response } from 'express';

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
    
    // If site is private, check authentication
    if (!req.session?.userId && !req.headers.authorization) {
      return res.status(401).json({ 
        message: 'This site is private. Please log in to view content.',
        requiresAuth: true 
      });
    }
    
    // User is authenticated, allow access
    next();
  } catch (err) {
    console.error('Error checking site access:', err);
    // On error, default to requiring auth for safety
    if (!req.session?.userId && !req.headers.authorization) {
      return res.status(401).json({ 
        message: 'Authentication required.',
        requiresAuth: true 
      });
    }
    next();
  }
}

export default { checkSiteAccess };

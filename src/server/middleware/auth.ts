import jwt from 'jsonwebtoken';
import type { NextFunction, Request, Response, RequestHandler } from 'express';
import { prisma } from '../db/prisma.js';
import type { AuthTokenPayload, UserRole } from '../types/security.js';
import { USER_ROLES } from '../types/security.js';
import { getErrorMessage } from '../utils/errors.js';

/**
 * Authentication middleware that checks for session or JWT token
 */
export async function auth(req: Request, res: Response, next: NextFunction): Promise<void | Response> {
  try {
    let userId: number;
    let credentialAuthVersion: number;

    if (req.session?.userId) {
      userId = req.session.userId;
      if (typeof req.session.authVersion !== 'number') {
        throw new Error('Session was issued before authentication revocation support');
      }
      credentialAuthVersion = req.session.authVersion;
    } else {
      const token = req.header('x-auth-token') || req.header('authorization')?.replace(/^Bearer\s+/i, '');
      if (!token) return res.status(401).json({ message: 'Authentication required' });

      const secret = process.env.JWT_SECRET;
      if (!secret) throw new Error('JWT_SECRET is not configured');
      const decoded = jwt.verify(token, secret);
      if (typeof decoded === 'string' || typeof decoded.id !== 'number' ||
          typeof decoded.authVersion !== 'number') {
        throw new Error('Token payload is invalid');
      }
      userId = decoded.id;
      credentialAuthVersion = decoded.authVersion;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        authVersion: true,
        role: { select: { name: true } },
      },
    });
    if (!user?.role || !USER_ROLES.includes(user.role.name as UserRole) ||
        user.authVersion !== credentialAuthVersion) {
      req.session?.destroy(() => undefined);
      res.clearCookie('connect.sid');
      return res.status(401).json({ message: 'Authentication has been revoked' });
    }

    const role = user.role.name as UserRole;
    req.user = { id: user.id, username: user.username, role, authVersion: user.authVersion } satisfies AuthTokenPayload;
    if (req.session?.userId) req.session.role = role;
    next();
  } catch (err) {
    console.error('Token verification error:', getErrorMessage(err));
    req.session?.destroy(() => undefined);
    res.clearCookie('connect.sid');
    return res.status(401).json({ message: 'Invalid or expired authentication' });
  }
}

/**
 * Admin-only middleware
 */
export const isAdmin = checkRole(['admin']);

/**
 * Get the current user's ID from either session or token
 */
export function getUserId(req: Request): number | undefined {
  return req.user?.id || req.session?.userId;
}

/**
 * Get the current user's role from either session or token
 */
export function getUserRole(req: Request): UserRole | undefined {
  return req.user?.role || req.session?.role;
}

/**
 * Role-based authorization middleware
 * @param {string[]} roles - Array of allowed roles
 */
export function checkRole(roles: readonly UserRole[]): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = getUserId(req);

      if (!userId) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      // First try to get the role from the token or session for efficiency
      let userRole = getUserRole(req);
      
      // If not available, query the database
      if (!userRole) {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { role: { select: { name: true } } },
        });

        if (!user?.role) {
          return res.status(404).json({ message: 'User not found' });
        }
        userRole = user.role.name as UserRole;
      }

      // Check if user's role is in the allowed roles
      if (roles.includes(userRole)) {
        return next();
      } else {
        return res.status(403).json({ message: 'Access denied: insufficient permissions' });
      }
    } catch (err) {
      console.error('Role check error:', err);
      return res.status(500).json({ message: 'Server error during authorization' });
    }
  };
}

/**
 * Check if user is authorized to modify a post
 * @param {Object} req - Express request object
 * @param {number} postAuthorId - ID of the post author
 */
export async function isAuthorizedForPost(req: Request, postAuthorId: number): Promise<boolean> {
  const userId = getUserId(req);
  const userRole = getUserRole(req);
  
  // If user is admin or moderator, they're authorized
  if (userRole && (['admin', 'moderator'] as UserRole[]).includes(userRole)) {
    return true;
  }
  
  // Otherwise, check if user is the author
  return userId === postAuthorId;
}

// Common role checks
export const isWriter = checkRole(['writer', 'admin']);
export const isWriterOrModerator = checkRole(['writer', 'moderator', 'admin']);
export const isModeratorOrAdmin = checkRole(['moderator', 'admin']);

export default {
  auth,
  getUserId,
  getUserRole,
  checkRole,
  isAuthorizedForPost,
  isAdmin,
  isWriter,
  isWriterOrModerator,
  isModeratorOrAdmin
};

import jwt from 'jsonwebtoken';
import type { NextFunction, Request, Response, RequestHandler } from 'express';
import { prisma } from '../db/prisma.js';
import type { AuthTokenPayload, UserRole } from '../types/security.js';
import { USER_ROLES } from '../types/security.js';
import { getErrorMessage } from '../utils/errors.js';

/**
 * Authentication middleware that checks for session or JWT token
 */
export function auth(req: Request, res: Response, next: NextFunction): void | Response {
  // Check for session-based authentication first
  if (req.session?.userId) {
    return next();
  }

  // Then check for JWT token in headers
  const token = req.header('x-auth-token') || req.header('authorization')?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error('JWT_SECRET is not configured');
    const decoded = jwt.verify(token, secret);
    if (typeof decoded === 'string' || typeof decoded.id !== 'number' ||
        typeof decoded.username !== 'string' || !USER_ROLES.includes(decoded.role as UserRole)) {
      throw new Error('Token payload is invalid');
    }
    req.user = decoded as AuthTokenPayload;
    next();
  } catch (err) {
    console.error('Token verification error:', getErrorMessage(err));
    res.status(401).json({ message: 'Invalid or expired token' });
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

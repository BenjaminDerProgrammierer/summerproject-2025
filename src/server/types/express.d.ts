import type { AuthTokenPayload, UserRole } from './security.js';

declare global {
  namespace Express {
    interface Request {
      user?: AuthTokenPayload;
    }
  }
}

declare module 'express-session' {
  interface SessionData {
    userId?: number;
    role?: UserRole;
    authVersion?: number;
    studioCsrfToken?: string;
    studioCsrfExpiresAt?: number;
  }
}

export {};

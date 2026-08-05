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
    studioCsrfToken?: string;
    studioCsrfExpiresAt?: number;
  }
}

export {};

import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import {
  serializeError,
  type StudioBFFRequest,
} from '@prisma/studio-core/data/bff';
import { createPostgresJSExecutor } from '@prisma/studio-core/data/postgresjs';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import postgres from 'postgres';
import { getDatabaseUrl } from '../config/env.js';
import { auth, getUserId, isAdmin } from '../middleware/auth.js';
import { getErrorMessage } from '../utils/errors.js';

const router = express.Router();
const CSRF_TTL_MS = 15 * 60 * 1000;
const RATE_WINDOW_MS = 60 * 1000;
const RATE_LIMIT = 180;
const MAX_SQL_LENGTH = 256 * 1024;
const MAX_TRANSACTION_QUERIES = 50;

interface RateWindow {
  count: number;
  resetAt: number;
}

const rateWindows = new Map<number, RateWindow>();
let executor: ReturnType<typeof createPostgresJSExecutor> | undefined;

function studioEnabled(_req: Request, res: Response, next: NextFunction): void | Response {
  if (process.env.ENABLE_PRISMA_STUDIO !== 'true') {
    return res.status(404).json({ message: 'Not found' });
  }
  next();
}

function requireSameOrigin(req: Request, res: Response, next: NextFunction): void | Response {
  const origin = req.get('origin');
  if (!origin) {
    return res.status(403).json({ message: 'A same-origin request is required' });
  }

  try {
    const requestOrigin = new URL(origin);
    const expectedOrigin = `${req.protocol}://${req.get('host')}`;
    if (requestOrigin.origin !== expectedOrigin) {
      return res.status(403).json({ message: 'Cross-origin Studio requests are forbidden' });
    }
  } catch {
    return res.status(403).json({ message: 'Invalid request origin' });
  }

  next();
}

function requireCsrf(req: Request, res: Response, next: NextFunction): void | Response {
  const supplied = req.get('x-studio-csrf');
  const expected = req.session.studioCsrfToken;
  const expiresAt = req.session.studioCsrfExpiresAt ?? 0;

  if (!supplied || !expected || expiresAt < Date.now()) {
    return res.status(403).json({ message: 'Studio CSRF token is missing or expired' });
  }

  const suppliedBuffer = Buffer.from(supplied);
  const expectedBuffer = Buffer.from(expected);
  if (suppliedBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(suppliedBuffer, expectedBuffer)) {
    return res.status(403).json({ message: 'Studio CSRF token is invalid' });
  }

  next();
}

function rateLimit(req: Request, res: Response, next: NextFunction): void | Response {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  const now = Date.now();
  const current = rateWindows.get(userId);
  const window = !current || current.resetAt <= now
    ? { count: 0, resetAt: now + RATE_WINDOW_MS }
    : current;
  window.count += 1;
  rateWindows.set(userId, window);

  res.set('RateLimit-Limit', String(RATE_LIMIT));
  res.set('RateLimit-Remaining', String(Math.max(0, RATE_LIMIT - window.count)));
  res.set('RateLimit-Reset', String(Math.ceil(window.resetAt / 1000)));

  if (window.count > RATE_LIMIT) {
    return res.status(429).json({ message: 'Studio request limit exceeded' });
  }
  next();
}

function hasValidSql(query: unknown): boolean {
  if (typeof query !== 'object' || query === null || !('sql' in query)) return false;
  const sql = (query as { sql?: unknown }).sql;
  return typeof sql === 'string' && sql.length > 0 && sql.length <= MAX_SQL_LENGTH;
}

function isStudioRequest(value: unknown): value is StudioBFFRequest {
  if (typeof value !== 'object' || value === null || !('procedure' in value)) return false;
  const body = value as Record<string, unknown>;

  switch (body.procedure) {
    case 'query':
      return hasValidSql(body.query);
    case 'sequence':
      return Array.isArray(body.sequence) && body.sequence.length === 2 && body.sequence.every(hasValidSql);
    case 'transaction':
      return Array.isArray(body.queries) && body.queries.length <= MAX_TRANSACTION_QUERIES && body.queries.every(hasValidSql);
    case 'sql-lint':
      return typeof body.sql === 'string' && body.sql.length <= MAX_SQL_LENGTH;
    default:
      return false;
  }
}

function getExecutor(): ReturnType<typeof createPostgresJSExecutor> {
  if (executor) return executor;
  executor = createPostgresJSExecutor(postgres(getDatabaseUrl(), { max: 5, idle_timeout: 20 }));
  return executor;
}

function audit(req: Request, requestId: string, procedure: string, outcome: 'success' | 'error', startedAt: number): void {
  console.info(JSON.stringify({
    event: 'prisma_studio_request',
    requestId,
    userId: getUserId(req),
    procedure,
    outcome,
    durationMs: Date.now() - startedAt,
    ip: req.ip,
    userAgent: req.get('user-agent')?.slice(0, 200),
    timestamp: new Date().toISOString(),
  }));
}

router.get('/studio/session', studioEnabled, auth, isAdmin, (req, res) => {
  const token = randomBytes(32).toString('base64url');
  req.session.studioCsrfToken = token;
  req.session.studioCsrfExpiresAt = Date.now() + CSRF_TTL_MS;
  res.set('Cache-Control', 'no-store');
  res.json({ csrfToken: token, expiresAt: req.session.studioCsrfExpiresAt });
});

router.post(
  '/studio/query',
  studioEnabled,
  auth,
  isAdmin,
  requireSameOrigin,
  requireCsrf,
  rateLimit,
  async (req, res) => {
    const requestId = randomUUID();
    const startedAt = Date.now();
    res.set('Cache-Control', 'no-store');
    res.set('X-Request-Id', requestId);

    if (!isStudioRequest(req.body)) {
      audit(req, requestId, 'invalid', 'error', startedAt);
      return res.status(400).json({ message: 'Invalid Studio request' });
    }

    const payload = req.body;
    const database = getExecutor();

    try {
      if (payload.procedure === 'query') {
        const options = payload.schema ? { schema: payload.schema } : undefined;
        const [error, result] = await database.execute(payload.query, options);
        audit(req, requestId, payload.procedure, error ? 'error' : 'success', startedAt);
        return res.json([error ? serializeError(error) : null, result]);
      }

      if (payload.procedure === 'sequence') {
        const [firstQuery, secondQuery] = payload.sequence;
        const [firstError, firstResult] = await database.execute(firstQuery);
        if (firstError) {
          audit(req, requestId, payload.procedure, 'error', startedAt);
          return res.json([[serializeError(firstError)]]);
        }
        const [secondError, secondResult] = await database.execute(secondQuery);
        audit(req, requestId, payload.procedure, secondError ? 'error' : 'success', startedAt);
        return res.json([
          [null, firstResult],
          secondError ? [serializeError(secondError)] : [null, secondResult],
        ]);
      }

      if (payload.procedure === 'transaction') {
        if (!database.executeTransaction) {
          audit(req, requestId, payload.procedure, 'error', startedAt);
          return res.status(501).json({ message: 'Transactions are not supported' });
        }
        const [error, result] = await database.executeTransaction(payload.queries);
        audit(req, requestId, payload.procedure, error ? 'error' : 'success', startedAt);
        return res.json([error ? serializeError(error) : null, result]);
      }

      if (payload.procedure !== 'sql-lint') {
        audit(req, requestId, payload.procedure, 'error', startedAt);
        return res.status(400).json({ message: 'Unsupported Studio procedure' });
      }

      if (!database.lintSql) {
        audit(req, requestId, payload.procedure, 'error', startedAt);
        return res.status(501).json({ message: 'SQL lint is not supported' });
      }
      const lintDetails = {
        sql: payload.sql,
        ...(payload.schema ? { schema: payload.schema } : {}),
        ...(payload.schemaVersion ? { schemaVersion: payload.schemaVersion } : {}),
      };
      const [error, result] = await database.lintSql(lintDetails);
      audit(req, requestId, payload.procedure, error ? 'error' : 'success', startedAt);
      return res.json([error ? serializeError(error) : null, result]);
    } catch (error) {
      audit(req, requestId, payload.procedure, 'error', startedAt);
      console.error(`Studio request ${requestId} failed:`, getErrorMessage(error));
      return res.status(500).json([serializeError(error)]);
    }
  },
);

export default router;

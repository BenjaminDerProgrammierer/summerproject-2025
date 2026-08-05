import cors from 'cors';
import connectPgSimple from 'connect-pg-simple';
import dotenv from 'dotenv';
import express from 'express';
import type { ErrorRequestHandler } from 'express';
import session from 'express-session';
import { existsSync, readFileSync } from 'node:fs';
import type { Server } from 'node:http';
import { resolve } from 'node:path';
import { load as loadYaml } from 'js-yaml';
import swaggerUi from 'swagger-ui-express';
import type { JsonObject } from 'swagger-ui-express';
import type { ViteDevServer } from 'vite';
import { attachmentsDir, clientDistDir, documentsDir, openapiPath, projectRoot } from './config/paths.js';
import { closePool, getPool } from './db/db.js';
import initDB from './db/init-db.js';
import adminRoutes from './routes/admin.js';
import authRoutes from './routes/auth.js';
import commentsRoutes from './routes/comments.js';
import postsRoutes from './routes/posts.js';
import setupRoutes from './routes/setup.js';
import signupKeysRoutes from './routes/signup-keys.js';
import siteSettingsRoutes from './routes/site-settings.js';
import { getErrorMessage } from './utils/errors.js';

dotenv.config({ quiet: true });

let viteDevServer: ViteDevServer | undefined;
const PostgresSessionStore = connectPgSimple(session);

async function startServer(): Promise<Server> {
  await initDB();

  if (!process.env.JWT_SECRET || !process.env.MASTER_SIGNUP_KEY) {
    throw new Error('JWT_SECRET and MASTER_SIGNUP_KEY must be provided through the environment');
  }

  const app = express();
  const port = parseInt(process.env.PORT || '3000');
  const production = process.env.NODE_ENV === 'production';
  const clientIndexPath = resolve(clientDistDir, 'index.html');

  if (production && !existsSync(clientIndexPath)) {
    throw new Error('Production client build not found. Run `pnpm build` before starting the server.');
  }

  app.set('trust proxy', 1);
  app.use(cors({
    origin: process.env.CORS_ORIGIN || false,
    credentials: true,
  }));
  app.use(express.json({ limit: '1mb' }));
  app.use('/uploads', express.static(attachmentsDir));
  app.use('/uploads', (_req, res) => {
    res.status(404).json({ message: 'Upload not found' });
  });
  app.use(session({
    store: new PostgresSessionStore({
      pool: getPool(),
      tableName: 'session',
      createTableIfMissing: false,
    }),
    secret: process.env.JWT_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: 'auto',
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000,
      sameSite: 'lax',
    },
  }));

  try {
    const swaggerDocument = loadYaml(readFileSync(openapiPath, 'utf8'));
    app.get('/api/openapi.yaml', (_req, res) => {
      res.type('text/yaml').sendFile(openapiPath);
    });
    app.use('/api', swaggerUi.serve);
    app.get('/api', swaggerUi.setup(swaggerDocument as JsonObject, {
      explorer: true,
      customCss: '.swagger-ui .topbar { display: none }',
      swaggerOptions: { defaultModelsExpandDepth: -1 },
    }));
    app.get('/api/', (_req, res) => res.redirect('/api'));
  } catch (error) {
    console.error('Error setting up Swagger UI:', error);
  }

  app.use('/api/auth', authRoutes);
  app.use('/api/posts', postsRoutes);
  app.use('/api/setup', setupRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/comments', commentsRoutes);
  app.use('/api/signup-keys', signupKeysRoutes);
  app.use('/api/site-settings', siteSettingsRoutes);

  app.get('/api/document/:filename', (req, res) => {
    const filename = `${String(req.params.filename)}.md`;
    const filePath = resolve(documentsDir, filename);
    if (!filePath.startsWith(`${documentsDir}/`)) {
      return res.status(400).json({ message: 'Invalid filename' });
    }
    res.sendFile(filePath, error => {
      if (error && !res.headersSent) res.status(404).json({ message: 'File not found' });
    });
  });

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'UP', time: new Date() });
  });

  app.use('/api', (_req, res) => {
    res.status(404).json({ message: 'API route not found' });
  });

  if (production) {
    app.use(express.static(clientDistDir));
    app.use((req, res, next) => {
      if (req.method !== 'GET' || !req.accepts('html')) return next();
      res.sendFile(clientIndexPath);
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    viteDevServer = await createViteServer({
      configFile: resolve(projectRoot, 'vite.config.ts'),
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(viteDevServer.middlewares);
  }

  const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
    console.error('Unhandled error:', error);
    res.status(500).json({
      message: 'An unexpected error occurred',
      error: production ? null : getErrorMessage(error),
    });
  };
  app.use(errorHandler);

  const server = app.listen(port, () => {
    console.log(`WEBonTour running at http://localhost:${port}`);
  });
  process.on('SIGTERM', () => void gracefulShutdown(server));
  process.on('SIGINT', () => void gracefulShutdown(server));
  return server;
}

async function gracefulShutdown(server: Server): Promise<void> {
  console.log('Received shutdown signal, closing connections...');
  const forcedExit = setTimeout(() => {
    console.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10_000);
  forcedExit.unref();

  await Promise.all([
    new Promise<void>((resolveClose, reject) => {
      server.close(error => error ? reject(error) : resolveClose());
    }),
    closePool(),
    viteDevServer?.close(),
  ]);
  console.log('HTTP, database, and development connections closed.');
  process.exit(0);
}

if (process.env.NODE_ENV !== 'test') {
  startServer().catch(error => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });
}

export { startServer };

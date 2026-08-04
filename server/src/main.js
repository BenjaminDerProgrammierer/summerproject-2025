import dotenv from 'dotenv';
dotenv.config({ quiet: true });

import express from 'express';
import cors from 'cors';
import session from 'express-session';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import swaggerUi from 'swagger-ui-express';
import { load as loadYaml } from 'js-yaml';

// Import route modules
import authRoutes from './routes/auth.js';
import postsRoutes from './routes/posts.js';
import setupRoutes from './routes/setup.js';
import adminRoutes from './routes/admin.js';
import commentsRoutes from './routes/comments.js';
import signupKeysRoutes from './routes/signup-keys.js';
import siteSettingsRoutes from './routes/site-settings.js';

// Import database init function
import initDB from './db/init-db.js';
import { closePool } from './db/db.js';
import { getSecurityKeys } from './utils/securityKeys.js';
import isDocker from './utils/isDocker.js';

// Create __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Server initialization function
 */
async function startServer() {
  try {
    // First, initialize the database
    await initDB();

    // Get security keys from database if they're not in environment
    const keys = await getSecurityKeys();

    // Use environment variables if they exist, otherwise use DB keys
    process.env.JWT_SECRET = process.env.JWT_SECRET || keys.JWT_SECRET;
    process.env.MASTER_SIGNUP_KEY = process.env.MASTER_SIGNUP_KEY || keys.MASTER_SIGNUP_KEY;

    if (!process.env.JWT_SECRET) {
      console.error('JWT_SECRET could not be loaded from environment or database');
      process.exit(1);
    }

    const app = express();
    const PORT = parseInt(process.env.PORT || "3000");

    // Middleware setup
    app.use(cors({
      origin: process.env.CORS_ORIGIN || true,
      credentials: true
    }));
    app.use(express.json());

    // Trust the first proxy (Nginx) - Important for secure cookies behind a proxy
    app.set('trust proxy', 1);

    // Determine the attachments directory path based on environment
    const attachmentsDir = isDocker()
      ? '/attachments'
      : join(__dirname, '../attachments');

    // Serve attachments directory
    app.use('/uploads', express.static(attachmentsDir));

    // if public directory exists, serve it at the root
    const publicDir = join(__dirname, '../public');
    if (fs.existsSync(publicDir)) {
      app.use(express.static(publicDir));
    }

    // Session middleware
    app.use(session({
      secret: process.env.JWT_SECRET,
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: false,
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000, // 1 day
        sameSite: 'lax' // Helps with CSRF protection
      }
    }));

    // Serve OpenAPI documentation with Swagger UI at /api
    try {
      const openapiPath = join(__dirname, '../openapi.yaml');
      const swaggerDocument = loadYaml(fs.readFileSync(openapiPath, 'utf8'));

      // Serve the raw OpenAPI file
      app.get('/api/openapi.yaml', (req, res) => {
        res.set('Content-Type', 'text/yaml');
        res.sendFile(openapiPath);
      });

      // Setup Swagger UI - use app.use for proper static file serving
      app.use('/api', swaggerUi.serve);
      app.get('/api', swaggerUi.setup(swaggerDocument, {
        explorer: true,
        customCss: '.swagger-ui .topbar { display: none }',
        swaggerOptions: {
          defaultModelsExpandDepth: -1
        }
      }));
      app.get('/api/', (req, res) => res.redirect('/api')); // Handle trailing slash
    } catch (err) {
      console.error('Error setting up Swagger UI:', err);
    }

    // API Routes - these will only trigger if the request doesn't match /api exact path
    app.use('/api/auth', authRoutes);
    app.use('/api/posts', postsRoutes);
    app.use('/api/setup', setupRoutes);
    app.use('/api/admin', adminRoutes);
    app.use('/api/comments', commentsRoutes);
    app.use('/api/signup-keys', signupKeysRoutes);
    app.use('/api/site-settings', siteSettingsRoutes);

    // Serve static files from the documents directory
    app.get('/api/document/:filename', (req, res) => {
      let { filename } = req.params;
      filename = filename + ".md";
      const filePath = join(__dirname, '../documents', filename);
      if (fs.existsSync(filePath)) {
        res.sendFile(filePath);
      }
      else {
        res.status(404).json({ message: 'File not found' });
      }
    });

    // Health check route
    app.get('/api/health', (req, res) => {
      res.json({ status: 'UP', time: new Date() });
    });

    // Global error handler
    app.use((err, req, res, next) => {
      console.error('Unhandled error:', err);
      res.status(500).json({
        message: 'An unexpected error occurred',
        error: process.env.NODE_ENV === 'production' ? null : err.message
      });
    });

    // Start server
    const server = app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });

    // Handle graceful shutdown
    process.on('SIGTERM', () => gracefulShutdown(server));
    process.on('SIGINT', () => gracefulShutdown(server));

    return server;
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

/**
 * Graceful shutdown function to close server and database connections
 */
async function gracefulShutdown(server) {
  console.log('Received shutdown signal, closing connections...');

  server.close(() => {
    console.log('HTTP server closed.');

    // Close database connections
    closePool().then(() => {
      console.log('Database connections closed.');
      process.exit(0);
    }).catch(err => {
      console.error('Error closing database connections:', err);
      process.exit(1);
    });
  });

  // Force close after 10 seconds if graceful shutdown fails
  setTimeout(() => {
    console.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
}

// Launch the server
if (process.env.NODE_ENV !== 'test') {
  startServer().catch(err => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}

export { startServer };

import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import newsRoutes from './routes/news.js';
import risksRoutes from './routes/risks.js';
import indicatorsRoutes from './routes/indicators.js';
import adminRoutes from './routes/admin.js';
import { startScheduler } from './jobs/scheduler.js';
import prisma from './lib/prisma.js';
import { config } from './lib/config.js';

dotenv.config();

const app = express();

// CORS: in production ALLOWED_ORIGINS is required (enforced by config); in development fall back permissive
const allowedOrigins = config.allowedOrigins.length > 0 ? config.allowedOrigins : null;

app.use(cors({
  origin: allowedOrigins
    ? (origin, cb) => {
        // Allow requests with no origin (e.g. same-origin / server-to-server)
        if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
        cb(new Error(`CORS: origin '${origin}' not allowed`));
      }
    : true, // permissive in development when ALLOWED_ORIGINS not set
  credentials: false,
}));

app.use(express.json());

app.use('/api/news', newsRoutes);
app.use('/api/risks', risksRoutes);
app.use('/api/indicators', indicatorsRoutes);
app.use('/api/admin', adminRoutes);

// Global error handler — must be last and must have 4-arg signature
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled error:', err.stack || err);
  res.status(500).json({ error: 'Internal server error' });
});

const server = app.listen(config.port, '0.0.0.0', () => {
  console.log(`Econoguard server running on port ${config.port}`);
  startScheduler();
});

// Graceful shutdown — guarded against repeated signals and hung keep-alive connections
let shuttingDown = false;
async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[Shutdown] Received ${signal}, shutting down gracefully...`);
  // Force-exit after 10 s if server.close() never drains (keep-alive connections, etc.)
  const force = setTimeout(() => {
    console.error('[Shutdown] Forced exit after timeout');
    process.exit(1);
  }, 10_000);
  force.unref();
  server.close(async () => {
    try {
      await prisma.$disconnect();
      console.log('[Shutdown] Prisma disconnected');
    } catch (e) {
      console.error('[Shutdown] Prisma disconnect error:', e);
    }
    clearTimeout(force);
    process.exit(0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  console.error('[Fatal] Unhandled promise rejection:', reason);
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  console.error('[Fatal] Uncaught exception:', err.stack || err);
  process.exit(1);
});

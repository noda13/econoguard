import crypto from 'node:crypto';
import { Router, Request, Response, NextFunction } from 'express';
import { runCollection, CollectionInProgressError } from '../services/collector.js';
import prisma from '../lib/prisma.js';

const router: Router = Router();

function adminAuth(req: Request, res: Response, next: NextFunction): void {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) {
    res.status(503).json({ error: 'Admin routes are disabled: ADMIN_SECRET is not configured' });
    return;
  }
  const provided = req.headers['x-admin-key'];
  // Hash both values to a fixed-length digest before comparing so that
  // timingSafeEqual never throws a RangeError (multibyte chars can make
  // Buffer byte length differ from JS string length) and no secret-length
  // information leaks via an early-exit branch.
  const a = crypto.createHash('sha256').update(typeof provided === 'string' ? provided : '').digest();
  const b = crypto.createHash('sha256').update(secret).digest();
  if (typeof provided !== 'string' || !crypto.timingSafeEqual(a, b)) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
}

router.use(adminAuth);

// GET /api/admin/status - Get last collection status
router.get('/status', async (_req, res) => {
  try {
    const lastLog = await prisma.collectionLog.findFirst({
      orderBy: { startedAt: 'desc' },
    });

    const articleCount = await prisma.newsArticle.count();
    const unsummarizedCount = await prisma.newsArticle.count({
      where: { summaryJa: '' },
    });

    res.json({
      lastCollection: lastLog,
      stats: {
        totalArticles: articleCount,
        unsummarized: unsummarizedCount,
      },
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to fetch status',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

// POST /api/admin/collect - Manually trigger data collection
router.post('/collect', async (_req, res) => {
  try {
    const result = await runCollection();
    res.json({
      message: 'Collection completed',
      result,
    });
  } catch (error) {
    if (error instanceof CollectionInProgressError) {
      res.status(409).json({ error: 'Collection already in progress' });
      return;
    }
    res.status(500).json({
      error: 'Collection failed',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

export default router;

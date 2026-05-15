import { Router, Request, Response, NextFunction } from 'express';
import { runCollection } from '../services/collector.js';
import prisma from '../lib/prisma.js';

const router: Router = Router();

function adminAuth(req: Request, res: Response, next: NextFunction): void {
  const secret = process.env.ADMIN_SECRET;
  if (secret && req.headers['x-admin-key'] !== secret) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
}

router.use(adminAuth);

// GET /api/admin/status - Get last collection status
router.get('/status', async (_req, res) => {
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
    if (error instanceof Error && error.message === 'Collection already in progress') {
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

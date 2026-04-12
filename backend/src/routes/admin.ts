import { Router } from 'express';
import { runCollection } from '../services/collector.js';
import prisma from '../lib/prisma.js';

const router = Router();

let isCollecting = false;

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
  if (isCollecting) {
    res.status(409).json({ error: 'Collection already in progress' });
    return;
  }

  isCollecting = true;
  try {
    const result = await runCollection();
    res.json({
      message: 'Collection completed',
      result,
    });
  } catch (error) {
    res.status(500).json({
      error: 'Collection failed',
      message: error instanceof Error ? error.message : String(error),
    });
  } finally {
    isCollecting = false;
  }
});

export default router;

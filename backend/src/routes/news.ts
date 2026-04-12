import { Router } from 'express';
import prisma from '../lib/prisma.js';

const router = Router();

// GET /api/news - Get latest news articles
router.get('/', async (req, res) => {
  const limit = parseInt(req.query.limit as string) || 20;
  const category = req.query.category as string | undefined;

  const where = category
    ? { riskCategories: { contains: category } }
    : {};

  const articles = await prisma.newsArticle.findMany({
    where,
    orderBy: { publishedAt: 'desc' },
    take: limit,
  });

  res.json(articles);
});

export default router;

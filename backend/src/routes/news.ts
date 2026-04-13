import { Router } from 'express';
import prisma from '../lib/prisma.js';

const router = Router();

// GET /api/news - Get latest news articles
router.get('/', async (req, res) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 20, 1), 100);
  const category = req.query.category as string | undefined;
  const validCategories = ['currency_finance', 'geopolitics_supply_chain', 'technology', 'social_policy'];

  const where = category && validCategories.includes(category)
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
